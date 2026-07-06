const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const tm = require('./timerMachine')

const isDev = !app.isPackaged

let state = tm.createInitialState()

let timerInterval = null
let widgetWin = null
let reminderWin = null
let tray = null

// Guard: ignore a break:start that arrives right after acknowledge, so a single
// keyboard Enter on the reminder can't chain through and skip the 'ready' step.
let readyAt = 0
const START_GUARD_MS = 400

function rendererUrl(page) {
  if (isDev) return `http://localhost:5173/${page}.html`
  return `file://${path.join(__dirname, '../../dist/renderer', `${page}.html`)}`
}

function broadcast(data) {
  ;[widgetWin, reminderWin].forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('timer:tick', data)
    }
  })
}

function tick() {
  const prev = state
  state = tm.tick(state)
  if (prev.phase === 'focus' && state.phase === 'reminder') showReminder()
  broadcast({ ...state })
}

function centerReminder() {
  if (!reminderWin || reminderWin.isDestroyed()) return
  const { workArea } = screen.getPrimaryDisplay()
  const [w, h] = reminderWin.getSize()
  reminderWin.setPosition(
    Math.round(workArea.x + (workArea.width - w) / 2),
    Math.round(workArea.y + (workArea.height - h) / 2)
  )
}

function showReminder() {
  if (!reminderWin || reminderWin.isDestroyed()) return
  centerReminder()
  reminderWin.show()
  reminderWin.setAlwaysOnTop(true, 'screen-saver')
  reminderWin.moveTop()
  reminderWin.focus()
}

function hideReminder() {
  if (!reminderWin || reminderWin.isDestroyed()) return
  reminderWin.hide()
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

function createReminderWindow() {
  reminderWin = new BrowserWindow({
    width: 400,
    height: 300,
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

  reminderWin.loadURL(rendererUrl('reminder'))
  centerReminder()

  reminderWin.webContents.on('did-finish-load', () => {
    broadcast({ ...state })
  })
}

function createTray() {
  // Tiny orange icon generated in memory
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

// ── IPC handlers ──
ipcMain.on('timer:pause', () => {
  state = tm.pause(state)
  broadcast({ ...state })
})

ipcMain.on('timer:resume', () => {
  state = tm.resume(state)
  broadcast({ ...state })
})

ipcMain.on('timer:reset', () => {
  state = tm.reset(state)
  hideReminder()
  broadcast({ ...state })
})

ipcMain.on('break:acknowledge', () => {
  const next = tm.acknowledge(state)
  if (next === state) return
  state = next
  readyAt = Date.now()
  hideReminder()
  broadcast({ ...state })
})

ipcMain.on('break:start', () => {
  const next = tm.startBreak(state, readyAt, Date.now())
  if (next === state) return
  state = next
  broadcast({ ...state })
})

ipcMain.on('break:skip', () => {
  state = tm.skipBreak(state)
  hideReminder()
  broadcast({ ...state })
})

ipcMain.on('window:minimize', () => widgetWin?.hide())
ipcMain.on('window:close', () => app.quit())

ipcMain.handle('timer:getState', () => ({ ...state }))

app.whenReady().then(() => {
  createWidgetWindow()
  createReminderWindow()
  createTray()
  timerInterval = setInterval(tick, 1000)
})

app.on('window-all-closed', () => {
  // Keep app running in tray
})

app.on('before-quit', () => {
  clearInterval(timerInterval)
})
