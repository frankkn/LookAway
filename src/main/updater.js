const { autoUpdater } = require('electron-updater')
const { app, dialog } = require('electron')

// Whether the current check was triggered manually (tray → "檢查更新").
// Manual checks give feedback in every case (found / up to date / error);
// automatic checks stay silent until an update is actually downloaded.
let manualCheck = false
let wired = false
let downloading = false

// UI hooks provided by the main process, so this module stays window-agnostic:
// status(obj) streams download state to the widget's progress strip, and
// parent() supplies a window to anchor dialogs to (keeps them visible/focused).
let ui = { status: () => {}, parent: () => null }

function setUI(hooks) {
  ui = { ...ui, ...hooks }
}

function parentWin() {
  const win = ui.parent()
  return win && !win.isDestroyed() && win.isVisible() ? win : null
}

function msgBox(opts) {
  const win = parentWin()
  return win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)
}

function wire() {
  if (wired) return
  wired = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    downloading = true
    ui.status({ state: 'downloading', version: info.version, percent: 0 })
    if (!manualCheck) return
    manualCheck = false
    msgBox({
      type: 'info', title: '檢查更新',
      message: `發現新版本 ${info.version}`,
      detail: '已開始在背景下載,主視窗底部會顯示進度,完成後會再通知你。',
      buttons: ['好'],
    })
  })

  autoUpdater.on('download-progress', (p) => {
    ui.status({
      state: 'downloading',
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', async (info) => {
    downloading = false
    ui.status({ state: 'ready', version: info.version })
    const { response } = await msgBox({
      type: 'info',
      buttons: ['立即重啟更新', '稍後'],
      defaultId: 0,
      cancelId: 1,
      title: '有新版本',
      message: `Look Away ${info.version} 已下載完成`,
      detail: '要立即重新啟動並套用更新嗎?稍後的話,更新會在下次退出時自動安裝。',
    })
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall())
  })

  autoUpdater.on('update-not-available', () => {
    downloading = false
    ui.status({ state: 'none' })
    if (!manualCheck) return
    manualCheck = false
    msgBox({
      type: 'info', title: '檢查更新',
      message: '目前已是最新版本', buttons: ['好'],
    })
  })

  autoUpdater.on('error', (err) => {
    downloading = false
    ui.status({ state: 'none' })
    if (!manualCheck) return
    manualCheck = false
    msgBox({
      type: 'error', title: '檢查更新',
      message: '檢查更新時發生錯誤',
      detail: String((err && err.message) || err),
      buttons: ['好'],
    })
  })
}

// The app lives in the tray for days at a time; a startup-only check would
// never see updates published after launch.
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

// Silent check on startup + periodic re-check (packaged builds only — dev has
// no published release)
function initAutoUpdate() {
  if (!app.isPackaged) return
  wire()
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => {
    if (!downloading) autoUpdater.checkForUpdates().catch(() => {})
  }, CHECK_INTERVAL_MS)
}

// Triggered by the tray menu; gives feedback in every case
function checkForUpdatesManually() {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: 'info', title: '檢查更新',
      message: '開發模式無法檢查更新',
      detail: '打包後的版本才會連到 GitHub Releases 檢查更新。',
      buttons: ['好'],
    })
    return
  }
  wire()
  if (downloading) {
    msgBox({
      type: 'info', title: '檢查更新',
      message: '更新正在下載中', detail: '主視窗底部會顯示進度。', buttons: ['好'],
    })
    return
  }
  manualCheck = true
  autoUpdater.checkForUpdates().catch(() => {})
}

module.exports = { initAutoUpdate, checkForUpdatesManually, setUI }
