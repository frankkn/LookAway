// Converts build/icon.png (a marketing-style render on a white background)
// into build/icon.ico:
//   1. decode the PNG (8-bit RGBA/RGB, non-interlaced)
//   2. find the dark rounded-square artwork's bounding box and crop to it
//   3. measure its corner radius and cut the white background away with a
//      supersampled rounded-rect alpha mask (transparent corners)
//   4. box-downscale to 16..256 and pack as ICO (BMP entries + PNG for 256)
//
// Usage: node scripts/png-to-ico.js
// Also writes build/icon-cutout-preview.png (256px) for eyeballing.

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ── PNG decode ────────────────────────────────────────────────────────────────

function decodePNG(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG')
  let pos = 8
  let ihdr = null
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') ihdr = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const width = ihdr.readUInt32BE(0)
  const height = ihdr.readUInt32BE(4)
  const bitDepth = ihdr[8]
  const colorType = ihdr[9]
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || ihdr[12] !== 0) {
    throw new Error(`unsupported PNG (bitDepth=${bitDepth} colorType=${colorType} interlaced=${ihdr[12]})`)
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * bpp

  // reverse scanline filters in place
  const out = Buffer.alloc(width * height * 4)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = row[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[i] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp
      const d = (y * width + x) * 4
      out[d] = row[s]
      out[d + 1] = row[s + 1]
      out[d + 2] = row[s + 2]
      out[d + 3] = bpp === 4 ? row[s + 3] : 255
    }
    prev = row
  }
  return { width, height, rgba: out }
}

// ── artwork detection ─────────────────────────────────────────────────────────

// "Content" = clearly dark artwork pixels. The backdrop is a light gray with
// a vignette (~155 in the corners), so the cutoff sits well below it.
function isContent(rgba, i) {
  return rgba[i + 3] > 128 && Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) < 120
}

// Bounding box of the artwork: per-row/column content-pixel counts, then the
// longest contiguous run above a floor — this drops both stray noise and
// disconnected artifacts hugging the image edges (dark strips, watermarks).
function findBBox({ width, height, rgba }) {
  const MIN_RUN = 64
  const rowCounts = new Uint32Array(height)
  const colCounts = new Uint32Array(width)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isContent(rgba, (y * width + x) * 4)) {
        rowCounts[y]++
        colCounts[x]++
      }
    }
  }
  const longestRun = counts => {
    let best = null
    let start = -1
    for (let i = 0; i <= counts.length; i++) {
      if (i < counts.length && counts[i] >= MIN_RUN) {
        if (start < 0) start = i
      } else if (start >= 0) {
        if (!best || i - start > best.end - best.start) best = { start, end: i - 1 }
        start = -1
      }
    }
    return best
  }
  const rows = longestRun(rowCounts)
  const cols = longestRun(colCounts)
  if (!rows || !cols) throw new Error('no artwork found')
  return { x: cols.start, y: rows.start, w: cols.end - cols.start + 1, h: rows.end - rows.start + 1 }
}

// Corner radius ≈ horizontal inset of the first content pixel on the top row.
function measureCornerRadius(img, box) {
  const insets = []
  for (const y of [box.y, box.y + box.h - 1]) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (isContent(img.rgba, (y * img.width + x) * 4)) {
        insets.push(x - box.x)
        break
      }
    }
  }
  return Math.max(...insets)
}

// ── resize + rounded mask ─────────────────────────────────────────────────────

// Exact box-filter downscale of the square crop (side px) to S×S, then cut
// the corners with a supersampled rounded-rect mask of radius rSrc*S/side.
function renderSize(img, box, side, rSrc, S) {
  const offX = Math.round((side - box.w) / 2)
  const offY = Math.round((side - box.h) / 2)

  // accumulate source pixels into target buckets
  const sums = new Float64Array(S * S * 4)
  for (let y = 0; y < box.h; y++) {
    const ty = Math.min(S - 1, Math.floor(((y + offY) * S) / side))
    for (let x = 0; x < box.w; x++) {
      const tx = Math.min(S - 1, Math.floor(((x + offX) * S) / side))
      const s = ((box.y + y) * img.width + (box.x + x)) * 4
      const d = (ty * S + tx) * 4
      sums[d] += img.rgba[s]
      sums[d + 1] += img.rgba[s + 1]
      sums[d + 2] += img.rgba[s + 2]
      sums[d + 3]++
    }
  }
  const cell = (side / S) * (side / S) // expected samples per full bucket

  // rounded-rect mask in target space (artwork rect, corner radius scaled)
  const rx = (offX * S) / side
  const ry = (offY * S) / side
  const rw = (box.w * S) / side
  const rh = (box.h * S) / side
  const rad = Math.max(1, (rSrc * S) / side)
  const inMask = (px, py) => {
    if (px < rx || py < ry || px > rx + rw - 1 || py > ry + rh - 1) return false
    const dx = Math.max(rx + rad - px, px - (rx + rw - 1 - rad), 0)
    const dy = Math.max(ry + rad - py, py - (ry + rh - 1 - rad), 0)
    return dx * dx + dy * dy <= rad * rad
  }

  const N = 4
  const out = Buffer.alloc(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      const n = sums[i + 3]
      if (!n) continue
      let hits = 0
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          if (inMask(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5)) hits++
        }
      }
      if (!hits) continue
      out[i] = Math.round(sums[i] / n)
      out[i + 1] = Math.round(sums[i + 1] / n)
      out[i + 2] = Math.round(sums[i + 2] / n)
      out[i + 3] = Math.round(Math.min(n / cell, 1) * (hits / (N * N)) * 255)
    }
  }
  return out
}

// ── PNG encode / ICO pack (same as the retired gen-icon.js) ──────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePNG(S, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(S * (S * 4 + 1))
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0
    rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function encodeBMPEntry(S, rgba) {
  const maskRow = Math.ceil(S / 32) * 4
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(S, 4)
  header.writeInt32LE(S * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(S * S * 4 + maskRow * S, 20)
  const xor = Buffer.alloc(S * S * 4)
  for (let y = 0; y < S; y++) {
    const src = (S - 1 - y) * S * 4
    for (let x = 0; x < S; x++) {
      const si = src + x * 4
      const di = (y * S + x) * 4
      xor[di] = rgba[si + 2]
      xor[di + 1] = rgba[si + 1]
      xor[di + 2] = rgba[si]
      xor[di + 3] = rgba[si + 3]
    }
  }
  return Buffer.concat([header, xor, Buffer.alloc(maskRow * S)])
}

function buildICO(entries) {
  const dir = Buffer.alloc(6)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(entries.length, 4)
  const dirEntries = []
  const blobs = []
  let offset = 6 + entries.length * 16
  for (const { size, data } of entries) {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    dirEntries.push(e)
    blobs.push(data)
  }
  return Buffer.concat([dir, ...dirEntries, ...blobs])
}

// ── main ──────────────────────────────────────────────────────────────────────

const buildDir = path.join(__dirname, '..', 'build')
const img = decodePNG(fs.readFileSync(path.join(buildDir, 'icon.png')))
const box = findBBox(img)
const side = Math.max(box.w, box.h)
const rSrc = measureCornerRadius(img, box)
console.log(`artwork: ${box.w}x${box.h} at (${box.x},${box.y}), corner radius ≈ ${rSrc}px`)

const entries = []
for (const size of [16, 24, 32, 48, 64, 128]) {
  entries.push({ size, data: encodeBMPEntry(size, renderSize(img, box, side, rSrc, size)) })
}
const rgba256 = renderSize(img, box, side, rSrc, 256)
entries.push({ size: 256, data: encodePNG(256, rgba256) })

fs.writeFileSync(path.join(buildDir, 'icon.ico'), buildICO(entries))
fs.writeFileSync(path.join(buildDir, 'icon-cutout-preview.png'), encodePNG(256, rgba256))
console.log('build/icon.ico written (7 sizes)')
console.log('build/icon-cutout-preview.png written (for eyeballing; not used by the build)')
