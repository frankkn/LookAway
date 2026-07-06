const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  pauseTimer:   () => ipcRenderer.send('timer:pause'),
  resumeTimer:  () => ipcRenderer.send('timer:resume'),
  resetTimer:   () => ipcRenderer.send('timer:reset'),
  acknowledgeBreak: () => ipcRenderer.send('break:acknowledge'),
  startBreak:   () => ipcRenderer.send('break:start'),
  skipBreak:    () => ipcRenderer.send('break:skip'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow:  () => ipcRenderer.send('window:close'),

  getTimerState: () => ipcRenderer.invoke('timer:getState'),

  onTimerTick: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('timer:tick', handler)
    return () => ipcRenderer.removeListener('timer:tick', handler)
  },

  openSettings:  () => ipcRenderer.send('settings:open'),
  getSettings:   () => ipcRenderer.invoke('settings:get'),
  saveSettings:  (data) => ipcRenderer.invoke('settings:save', data),
})
