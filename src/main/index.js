const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const tm = require('./timerMachine')
const cfg = require('./settings')
const updater = require('./updater')

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
let reminderShownAt = 0

// Single instance: launching the exe again just re-shows the existing widget
if (!app.requestSingleInstanceLock()) {
  app.quit()
}
app.on('second-instance', () => {
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.show()
    widgetWin.setAlwaysOnTop(true, 'floating')
    widgetWin.focus()
  }
})

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

function defaultWidgetPos(w, h) {
  const { workArea } = screen.getPrimaryDisplay()
  return [workArea.x + workArea.width - w - 20, workArea.y + workArea.height - h - 20]
}

// Keep (x, y) inside the work area of whichever display the window is on.
function clampToDisplay(x, y, w, h) {
  const { workArea } = screen.getDisplayMatching({ x, y, width: w, height: h })
  return [
    Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - w),
    Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - h),
  ]
}

// Resize keeping the bottom-right corner anchored, so the widget neither
// drifts out of its corner nor loses a position the user dragged it to.
function resizeWidget(w, h) {
  if (!widgetWin || widgetWin.isDestroyed()) return
  const b = widgetWin.getBounds()
  resizeWindow(widgetWin, w, h)
  const [x, y] = clampToDisplay(b.x + b.width - w, b.y + b.height - h, w, h)
  widgetWin.setPosition(x, y)
}

// Actual widget window size = base size × zoom. Content fills it via the
// renderer's proportional transform, so text + arc + buttons scale together.
function widgetSize(s) {
  const z = s.widgetScale || 1
  return [Math.round(s.widgetWidth * z), Math.round(s.widgetHeight * z)]
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
    const [w, h] = widgetSize(s)
    resizeWidget(w, h)
  }
  if (reminderWin && !reminderWin.isDestroyed()) {
    resizeWindow(reminderWin, s.reminderWidth, s.reminderHeight)
    applyFontSize(reminderWin, s.reminderFontSize)
  }
  state = tm.applyDurations(state, s.focusDuration, s.breakDuration)
  broadcast({ ...state })
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
  reminderShownAt = Date.now()
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
  const [w, h] = widgetSize(settings)
  const hasSavedPos = Number.isFinite(settings.widgetX) && Number.isFinite(settings.widgetY)
  const [x, y] = hasSavedPos
    ? clampToDisplay(settings.widgetX, settings.widgetY, w, h) // clamp: monitor may be gone
    : defaultWidgetPos(w, h)

  widgetWin = new BrowserWindow({
    width: w, height: h,
    x, y,
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
  })

  // Remember where the user drags the widget (debounced; 'moved' also fires
  // on our own setPosition calls, which is fine — it saves the same position)
  let savePosTimer = null
  widgetWin.on('moved', () => {
    clearTimeout(savePosTimer)
    savePosTimer = setTimeout(() => {
      if (!widgetWin || widgetWin.isDestroyed()) return
      const [px, py] = widgetWin.getPosition()
      settings = cfg.save({ ...settings, widgetX: px, widgetY: py })
    }, 500)
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

// Draw an orange eye (almond outline + centered pupil) on a transparent
// background. Rendered at 2× (32px buffer, scaleFactor 2) with 3×3 supersampling
// for smooth edges at tray size.
// NOTE: Windows tray bitmaps are BGRA, so blue and red bytes are swapped
// relative to the intuitive RGBA order.
function makeTrayIcon() {
  const size = 32
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const A = size * 0.46          // eye half-width
  const B = size * 0.30          // eye half-height
  const inA = A - size * 0.11    // inner edge of the almond outline
  const inB = B - size * 0.11
  const pupilR = size * 0.15

  // Is this (sub)pixel part of the orange glyph?
  const covered = (px, py) => {
    const dx = px - cx
    const dy = py - cy
    const outer = (dx * dx) / (A * A) + (dy * dy) / (B * B)
    const inner = (dx * dx) / (inA * inA) + (dy * dy) / (inB * inB)
    const onOutline = outer <= 1 && inner >= 1
    const inPupil = dx * dx + dy * dy <= pupilR * pupilR
    return onOutline || inPupil
  }

  const buf = Buffer.alloc(size * size * 4)
  const N = 3 // supersampling grid
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          if (covered(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5)) hits++
        }
      }
      const i = (y * size + x) * 4
      buf[i + 0] = 0x35 // B
      buf[i + 1] = 0x6b // G
      buf[i + 2] = 0xff // R
      buf[i + 3] = Math.round((hits / (N * N)) * 255) // A
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size, scaleFactor: 2 })
}

function createTray() {
  tray = new Tray(makeTrayIcon())
  tray.setToolTip('Look Away — 20-20-20')

  const menu = Menu.buildFromTemplate([
    { label: 'Show Widget', click: () => { widgetWin?.show(); widgetWin?.setAlwaysOnTop(true, 'floating') } },
    { label: 'Settings',    click: () => createSettingsWindow() },
    { label: '檢查更新',     click: () => updater.checkForUpdatesManually() },
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
ipcMain.on('timer:reset', () => {
  const next = tm.reset(state)
  if (next === state) return
  state = next; broadcast({ ...state })
})

ipcMain.on('break:acknowledge', () => {
  const next = tm.acknowledge(state, reminderShownAt, Date.now())
  if (next === state) return
  state = next; readyAt = Date.now(); hideReminder(); broadcast({ ...state })
})

ipcMain.on('break:start', () => {
  const next = tm.startBreak(state, readyAt, Date.now())
  if (next === state) return
  state = next; broadcast({ ...state })
})

ipcMain.on('break:skip', () => {
  const next = tm.skipBreak(state)
  if (next === state) return
  state = next; broadcast({ ...state })
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
  if (s.widgetWidth && s.widgetHeight) {
    const [w, h] = widgetSize(s)
    resizeWidget(w, h)
  }
})

ipcMain.on('widget:preview-stop', () => {
  // Revert the widget to the saved size
  const [w, h] = widgetSize(settings)
  resizeWidget(w, h)
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
  updater.initAutoUpdate() // silent check on startup (packaged builds only)
})

app.on('window-all-closed', () => { /* keep running in tray */ })
app.on('before-quit', () => {
  clearInterval(timerInterval)
  // Flush the widget position in case a drag happened within the save debounce
  if (widgetWin && !widgetWin.isDestroyed()) {
    const [px, py] = widgetWin.getPosition()
    settings = cfg.save({ ...settings, widgetX: px, widgetY: py })
  }
})
