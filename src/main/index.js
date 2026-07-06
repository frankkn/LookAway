const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const FOCUS_DURATION = 20 * 60 // 1200 seconds
const BREAK_DURATION = 20       // seconds

// Phases:
//   focus     – counting down 20 min to next break
//   reminder  – focus elapsed; reminder window shown, waiting for user to acknowledge (timer frozen)
//   ready     – acknowledged; widget shows "開始計時休息" button, waiting for user to start (timer frozen)
//   break     – counting down 20 sec look-away
let state = {
  phase: 'focus',
  remaining: FOCUS_DURATION,
  isPaused: false,
  stats: { breaksToday: 0, focusTime: 0 },
}

let timerInterval = null
let widgetWin = null
let reminderWin = null
let tray = null

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
  if (state.isPaused) return
  // reminder & ready are frozen states — they wait for the user, no countdown
  if (state.phase !== 'focus' && state.phase !== 'break') return

  state.remaining -= 1
  if (state.phase === 'focus') state.stats.focusTime += 1

  if (state.remaining <= 0) {
    if (state.phase === 'focus') {
      // Focus done → prompt the user (no auto-start, timer waits)
      state.phase = 'reminder'
      state.remaining = BREAK_DURATION // preview value for the ready/break arc
      showReminder()
    } else {
      // Break done → back to focus
      state.stats.breaksToday += 1
      state.phase = 'focus'
      state.remaining = FOCUS_DURATION
    }
  }

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
  hideReminder()
  broadcast({ ...state })
})

// User pressed "好,我知道了" in the reminder window
ipcMain.on('break:acknowledge', () => {
  if (state.phase !== 'reminder') return
  state.phase = 'ready'
  hideReminder()
  broadcast({ ...state })
})

// User pressed "▶ 開始計時休息" on the widget
ipcMain.on('break:start', () => {
  if (state.phase !== 'ready') return
  state.phase = 'break'
  state.remaining = BREAK_DURATION
  broadcast({ ...state })
})

// User skipped the break (available during ready or break)
ipcMain.on('break:skip', () => {
  state.stats.breaksToday += 1
  state.phase = 'focus'
  state.remaining = FOCUS_DURATION
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
