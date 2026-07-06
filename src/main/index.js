const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const FOCUS_DURATION = 20 * 60 // 1200 seconds
const BREAK_DURATION = 20       // seconds

let state = {
  phase: 'focus',
  remaining: FOCUS_DURATION,
  isPaused: false,
  stats: { breaksToday: 0, focusTime: 0 },
}

let timerInterval = null
let widgetWin = null
let overlayWin = null
let tray = null

function rendererUrl(page) {
  if (isDev) return `http://localhost:5173/${page}.html`
  return `file://${path.join(__dirname, '../../dist/renderer', `${page}.html`)}`
}

function broadcast(data) {
  ;[widgetWin, overlayWin].forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('timer:tick', data)
    }
  })
}

function tick() {
  if (state.isPaused) return

  state.remaining -= 1
  if (state.phase === 'focus') state.stats.focusTime += 1

  if (state.remaining <= 0) {
    if (state.phase === 'focus') {
      state.phase = 'break'
      state.remaining = BREAK_DURATION
      showOverlay()
    } else {
      state.stats.breaksToday += 1
      state.phase = 'focus'
      state.remaining = FOCUS_DURATION
      hideOverlay()
    }
  }

  broadcast({ ...state })
}

function showOverlay() {
  if (!overlayWin || overlayWin.isDestroyed()) return
  overlayWin.show()
  overlayWin.setAlwaysOnTop(true, 'screen-saver')
  overlayWin.focus()
}

function hideOverlay() {
  if (!overlayWin || overlayWin.isDestroyed()) return
  overlayWin.hide()
  widgetWin?.focus()
}

function createWidgetWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay()

  widgetWin = new BrowserWindow({
    width: 280,
    height: 360,
    x: workAreaSize.width - 300,
    y: workAreaSize.height - 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  widgetWin.setAlwaysOnTop(true, 'floating')
  widgetWin.loadURL(rendererUrl('main'))

  widgetWin.webContents.on('did-finish-load', () => {
    broadcast({ ...state })
  })

  if (isDev) {
    widgetWin.webContents.openDevTools({ mode: 'detach' })
  }
}

function createOverlayWindow() {
  const { bounds } = screen.getPrimaryDisplay()

  overlayWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlayWin.loadURL(rendererUrl('overlay'))

  overlayWin.webContents.on('did-finish-load', () => {
    broadcast({ ...state })
  })
}

function createTray() {
  // Tiny 1-pixel orange icon generated in memory
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    buf[i * 4 + 0] = 0xff // R
    buf[i * 4 + 1] = 0x6b // G
    buf[i * 4 + 2] = 0x35 // B
    buf[i * 4 + 3] = 0xff // A
  }
  const icon = nativeImage.createFromBuffer(buf, { width: size, height: size, scaleFactor: 1 })
  tray = new Tray(icon)
  tray.setToolTip('Look Away — 20-20-20')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      click: () => { widgetWin?.show(); widgetWin?.setAlwaysOnTop(true, 'floating') }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  tray.setContextMenu(menu)

  tray.on('click', () => {
    if (widgetWin?.isVisible()) {
      widgetWin.hide()
    } else {
      widgetWin?.show()
      widgetWin?.setAlwaysOnTop(true, 'floating')
    }
  })
}

// IPC handlers
ipcMain.on('timer:pause', () => {
  state.isPaused = true
  broadcast({ ...state })
})

ipcMain.on('timer:resume', () => {
  state.isPaused = false
  broadcast({ ...state })
})

ipcMain.on('timer:reset', () => {
  state.phase = 'focus'
  state.remaining = FOCUS_DURATION
  state.isPaused = false
  hideOverlay()
  broadcast({ ...state })
})

ipcMain.on('break:skip', () => {
  state.stats.breaksToday += 1
  state.phase = 'focus'
  state.remaining = FOCUS_DURATION
  hideOverlay()
  broadcast({ ...state })
})

ipcMain.on('window:minimize', () => widgetWin?.hide())
ipcMain.on('window:close', () => app.quit())

ipcMain.handle('timer:getState', () => ({ ...state }))

app.whenReady().then(() => {
  createWidgetWindow()
  createOverlayWindow()
  createTray()
  timerInterval = setInterval(tick, 1000)
})

app.on('window-all-closed', () => {
  // Keep app running in tray
})

app.on('before-quit', () => {
  clearInterval(timerInterval)
})
