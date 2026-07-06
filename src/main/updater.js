const { autoUpdater } = require('electron-updater')
const { app, dialog } = require('electron')

// Whether the current check was triggered manually (tray → "檢查更新").
// Manual checks show a result dialog even when already up to date; automatic
// startup checks stay silent unless an update is actually downloaded.
let manualCheck = false
let wired = false

function wire() {
  if (wired) return
  wired = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['立即重啟更新', '稍後'],
      defaultId: 0,
      cancelId: 1,
      title: '有新版本',
      message: `Look Away ${info.version} 已下載完成`,
      detail: '要立即重新啟動並套用更新嗎?',
    })
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall())
  })

  autoUpdater.on('update-not-available', () => {
    if (!manualCheck) return
    manualCheck = false
    dialog.showMessageBox({
      type: 'info', title: '檢查更新',
      message: '目前已是最新版本', buttons: ['好'],
    })
  })

  autoUpdater.on('error', (err) => {
    if (!manualCheck) return
    manualCheck = false
    dialog.showMessageBox({
      type: 'error', title: '檢查更新',
      message: '檢查更新時發生錯誤',
      detail: String((err && err.message) || err),
      buttons: ['好'],
    })
  })
}

// Silent check on startup (packaged builds only — dev has no published release)
function initAutoUpdate() {
  if (!app.isPackaged) return
  wire()
  autoUpdater.checkForUpdates().catch(() => {})
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
  manualCheck = true
  autoUpdater.checkForUpdates().catch(() => {})
}

module.exports = { initAutoUpdate, checkForUpdatesManually }
