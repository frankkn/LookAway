const path = require('path')
const fs = require('fs')
// Shared with the Settings UI (src/renderer/components/Settings.jsx).
// focusDuration max = 8h 59m 59s; breakDuration max = 59m 59s.
const LIMITS = require('../shared/limits.json')

let _app = null

const DEFAULTS = {
  widgetWidth: 280,
  widgetHeight: 360,
  widgetScale: 1,          // zoom multiplier for the whole widget
  widgetX: null,           // last dragged position; null = default corner
  widgetY: null,
  reminderWidth: 460,
  reminderHeight: 360,
  reminderFontSize: 16,
  focusDuration: 20 * 60,
  breakDuration: 20,
}

function init(app) {
  _app = app
}

function getPath() {
  return path.join(_app.getPath('userData'), 'settings.json')
}

const CLAMPED_FIELDS = [
  'widgetWidth', 'widgetHeight',
  'reminderWidth', 'reminderHeight', 'reminderFontSize',
  'focusDuration', 'breakDuration',
]

// settings.json can be hand-edited (or written by an older version), so treat
// every field as untrusted: unknown keys are dropped, wrong types fall back to
// the default, numbers are clamped into LIMITS. reminderFontSize in particular
// flows into an executeJavaScript template, so it must come out a plain number.
function sanitize(data) {
  const merged = { ...DEFAULTS, ...data }
  const s = {}
  for (const key of Object.keys(DEFAULTS)) s[key] = merged[key]
  for (const key of CLAMPED_FIELDS) {
    const { min, max } = LIMITS[key]
    s[key] = Number.isFinite(s[key]) ? Math.min(max, Math.max(min, s[key])) : DEFAULTS[key]
  }
  const pct = LIMITS.widgetScalePct
  s.widgetScale = Number.isFinite(s.widgetScale)
    ? Math.min(pct.max / 100, Math.max(pct.min / 100, s.widgetScale))
    : DEFAULTS.widgetScale
  s.widgetX = Number.isFinite(s.widgetX) ? Math.round(s.widgetX) : null
  s.widgetY = Number.isFinite(s.widgetY) ? Math.round(s.widgetY) : null
  return s
}

function load() {
  try {
    const raw = fs.readFileSync(getPath(), 'utf-8')
    return sanitize(JSON.parse(raw))
  } catch {
    return { ...DEFAULTS }
  }
}

function save(data) {
  const merged = sanitize(data)
  fs.writeFileSync(getPath(), JSON.stringify(merged, null, 2))
  return merged
}

module.exports = { DEFAULTS, LIMITS, init, load, save, sanitize }
