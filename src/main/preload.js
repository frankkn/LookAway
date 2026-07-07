const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  pauseTimer:   () => ipcRenderer.send('timer:pause'),
  resumeTimer:  () => ipcRenderer.send('timer:resume'),
  resetTimer:   () => ipcRenderer.send('timer:reset'),
  acknowledgeBreak: () => ipcRenderer.send('break:acknowledge'),
  startBreak:   () => ipcRenderer.send('break:start'),
  startFocus:   () => ipcRenderer.send('focus:start'),
  skipBreak:    () => ipcRenderer.send('break:skip'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow:  () => ipcRenderer.send('window:close'),

  getTimerState: () => ipcRenderer.invoke('timer:getState'),
  getAppVersion: () => ipcRenderer.invoke('app:version'),

  onTimerTick: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('timer:tick', handler)
    return () => ipcRenderer.removeListener('timer:tick', handler)
  },

  // Auto-update download state → widget progress strip
  onUpdateStatus: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },

  openSettings:  () => ipcRenderer.send('settings:open'),
  getSettings:   () => ipcRenderer.invoke('settings:get'),
  saveSettings:  (data) => ipcRenderer.invoke('settings:save', data),

  // Live preview (no persistence) while the settings window is open
  previewWidget:       (s) => ipcRenderer.send('settings:preview-widget', s),
  stopWidgetPreview:   ()  => ipcRenderer.send('widget:preview-stop'),
  previewReminder:     (s) => ipcRenderer.send('reminder:preview', s),
  stopReminderPreview: ()  => ipcRenderer.send('reminder:preview-stop'),

  // Reminder window: know when it is in preview mode (to show a close X),
  // let its X close the preview, and let settings know the preview ended.
  closeReminderPreview: () => ipcRenderer.send('reminder:preview-close'),
  onReminderPreviewMode: (cb) => {
    const handler = (_, on) => cb(on)
    ipcRenderer.on('reminder:preview-mode', handler)
    return () => ipcRenderer.removeListener('reminder:preview-mode', handler)
  },
  onReminderPreviewEnded: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('reminder:preview-ended', handler)
    return () => ipcRenderer.removeListener('reminder:preview-ended', handler)
  },
})
