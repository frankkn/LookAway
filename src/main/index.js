const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const tm = require('./timerMachine')
const cfg = require('./settings')

const isDev = !app.isPackaged

cfg.init(app)
let settings = cfg.load()
let state = tm.createInitialState(settings.focusDuration, settings.breakDuration)

let timerInterval = null
let widgetWin = null
let reminderWin = null
let settingsWin = null
let tray = null
let readyAt = 0

function rendererUrl(page) {
  if (isDev) return `http://localhost:5173/${page}.html`
  return `file://${path.join(__dirname, '../../dist/renderer', `${page}.html`)}`
}

function broadcast(data) {
  ;[widgetWin, reminderWin].forEach(win => {
    if (win && !win.isDestroyed()) win.webContents.send('timer:tick', data)
  })
}

function tick() {
  const prev = state
  state = tm.tick(state)
  if (prev.phase === 'focus' && state.phase === 'reminder') showReminder()
  broadcast({ ...state })
}

// ── apply settings to live windows ──────────────────────────────────────────

function applyFontSize(win, px) {
  if (!win || win.isDestroyed()) return
  win.webContents.executeJavaScript(
    `document.documentElement.style.setProperty('--font-size', '${px}px')`
  ).catch(() => {})
}

function repositionWidget(w, h) {
  const { workAreaSize } = screen.getPrimaryDisplay()
  widgetWin.setPosition(workAreaSize.width - w - 20, workAreaSize.height - h - 20)
}

// On Windows, setSize() is ignored on a window created with resizable:false,
// so briefly re-enable resizing around the call.
function resizeWindow(win, w, h) {
  if (!win || win.isDestroyed()) return
  const wasResizable = win.isResizable()
  win.setResizable(true)
  win.setSize(Math.round(w), Math.round(h))
  win.setResizable(wasResizable)
}

function applySettings(s) {
  if (widgetWin && !widgetWin.isDestroyed()) {
    resizeWindow(widgetWin, s.widgetWidth, s.widgetHeight)
    repositionWidget(s.widgetWidth, s.widgetHeight)
    applyFontSize(widgetWin, s.widgetFontSize)
  }
  if (reminderWin && !reminderWin.isDestroyed()) {
    resizeWindow(reminderWin, s.reminderWidth, s.reminderHeight)
    applyFontSize(reminderWin, s.reminderFontSize)
  }
  // Update timer durations in state
  state = {
    ...state,
    focusDuration: s.focusDuration,
    breakDuration: s.breakDuration,
  }
}

// ── windows ──────────────────────────────────────────────────────────────────

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
  reminderWin.webContents.send('reminder:preview-mode', false) // real break, no close X
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
  const { widgetWidth: w, widgetHeight: h } = settings

  widgetWin = new BrowserWindow({
    width: w, height: h,
    x: workAreaSize.width - w - 20,
    y: workAreaSize.height - h - 20,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })

  widgetWin.setAlwaysOnTop(true, 'floating')
  widgetWin.loadURL(rendererUrl('main'))
  widgetWin.webContents.on('did-finish-load', () => {
    broadcast({ ...state })
    applyFontSize(widgetWin, settings.widgetFontSize)
  })

  if (isDev) widgetWin.webContents.openDevTools({ mode: 'detach' })
}

function createReminderWindow() {
  const { reminderWidth: w, reminderHeight: h } = settings

  reminderWin = new BrowserWindow({
    width: w, height: h,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, show: false, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })

  reminderWin.loadURL(rendererUrl('reminder'))
  centerReminder()
  reminderWin.webContents.on('did-finish-load', () => {
    broadcast({ ...state })
    applyFontSize(reminderWin, settings.reminderFontSize)
  })
}

function createSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 400, height: 480,
    minWidth: 340, minHeight: 380,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: true, skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })

  settingsWin.loadURL(rendererUrl('settings'))
  settingsWin.on('closed', () => {
    settingsWin = null
    // Revert any live preview back to the saved settings
    applySettings(settings)
    if (state.phase !== 'reminder') hideReminder()
  })
  if (isDev) settingsWin.webContents.openDevTools({ mode: 'detach' })
}

// Draw a filled orange disc on a transparent background.
// NOTE: Windows tray bitmaps are BGRA, so blue and red bytes are swapped
// relative to the intuitive RGBA order.
function makeTrayIcon() {
  const size = 16
  const c = (size - 1) / 2
  const r = 7
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const inside = (x - c) ** 2 + (y - c) ** 2 <= r * r
      buf[i + 0] = 0x35 // B
      buf[i + 1] = 0x6b // G
      buf[i + 2] = 0xff // R
      buf[i + 3] = inside ? 0xff : 0x00 // A
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size, scaleFactor: 1 })
}

function createTray() {
  tray = new Tray(makeTrayIcon())
  tray.setToolTip('Look Away — 20-20-20')

  const menu = Menu.buildFromTemplate([
    { label: 'Show Widget', click: () => { widgetWin?.show(); widgetWin?.setAlwaysOnTop(true, 'floating') } },
    { label: 'Settings',    click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  tray.setContextMenu(menu)

  tray.on('click', () => {
    if (widgetWin?.isVisible()) widgetWin.hide()
    else { widgetWin?.show(); widgetWin?.setAlwaysOnTop(true, 'floating') }
  })
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.on('timer:pause',   () => { state = tm.pause(state);   broadcast({ ...state }) })
ipcMain.on('timer:resume',  () => { state = tm.resume(state);  broadcast({ ...state }) })
ipcMain.on('timer:reset',   () => { state = tm.reset(state); hideReminder(); broadcast({ ...state }) })

ipcMain.on('break:acknowledge', () => {
  const next = tm.acknowledge(state)
  if (next === state) return
  state = next; readyAt = Date.now(); hideReminder(); broadcast({ ...state })
})

ipcMain.on('break:start', () => {
  const next = tm.startBreak(state, readyAt, Date.now())
  if (next === state) return
  state = next; broadcast({ ...state })
})

ipcMain.on('break:skip', () => {
  state = tm.skipBreak(state); hideReminder(); broadcast({ ...state })
})

let hintShown = false
ipcMain.on('window:minimize', () => {
  widgetWin?.hide()
  // First time only: tell the user where the widget went.
  if (!hintShown && tray) {
    hintShown = true
    tray.displayBalloon?.({
      title: 'Look Away 已縮到系統匣',
      content: '點右下角的橘色圓點圖示即可叫回視窗',
    })
  }
})
ipcMain.on('window:close', (event) => {
  // Close the window that actually sent the request; only the widget quits the app
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && win === settingsWin) win.close()
  else app.quit()
})

ipcMain.handle('timer:getState', () => ({ ...state }))

ipcMain.on('settings:open', () => createSettingsWindow())

// ── live preview (does not persist) ──
ipcMain.on('settings:preview-widget', (_, s) => {
  if (!widgetWin || widgetWin.isDestroyed()) return
  if (s.widgetWidth && s.widgetHeight) {
    resizeWindow(widgetWin, s.widgetWidth, s.widgetHeight)
    repositionWidget(s.widgetWidth, s.widgetHeight)
  }
  if (s.widgetFontSize) applyFontSize(widgetWin, s.widgetFontSize)
})

ipcMain.on('widget:preview-stop', () => {
  // Revert the widget to the saved size/font
  if (!widgetWin || widgetWin.isDestroyed()) return
  resizeWindow(widgetWin, settings.widgetWidth, settings.widgetHeight)
  repositionWidget(settings.widgetWidth, settings.widgetHeight)
  applyFontSize(widgetWin, settings.widgetFontSize)
})

ipcMain.on('reminder:preview', (_, s) => {
  if (!reminderWin || reminderWin.isDestroyed()) return
  if (s.reminderWidth && s.reminderHeight) resizeWindow(reminderWin, s.reminderWidth, s.reminderHeight)
  if (s.reminderFontSize) applyFontSize(reminderWin, s.reminderFontSize)
  reminderWin.webContents.send('reminder:preview-mode', true) // show the close X
  centerReminder()
  reminderWin.showInactive() // show without stealing focus from the settings window
  reminderWin.setAlwaysOnTop(true, 'floating')
})

ipcMain.on('reminder:preview-stop', () => {
  if (state.phase !== 'reminder') hideReminder()
})

// The X on the preview window: hide it and let settings flip its toggle off
ipcMain.on('reminder:preview-close', () => {
  if (state.phase !== 'reminder') hideReminder()
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('reminder:preview-ended')
  }
})

ipcMain.handle('settings:get', () => ({ ...settings }))

ipcMain.handle('settings:save', (_, data) => {
  settings = cfg.save(data)
  applySettings(settings)
  settingsWin?.close()
  return settings
})

// ── lifecycle ─────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWidgetWindow()
  createReminderWindow()
  createTray()
  timerInterval = setInterval(tick, 1000)
})

app.on('window-all-closed', () => { /* keep running in tray */ })
app.on('before-quit', () => clearInterval(timerInterval))
