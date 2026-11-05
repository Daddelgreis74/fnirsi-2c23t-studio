const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('device:get-status'),
  onStatusChange: (callback) => ipcRenderer.on('device:status-changed', (_event, value) => callback(value)),
  getScreenshots: () => ipcRenderer.invoke('device:get-screenshots'),
  saveWaveformCsv: (filename, points) => ipcRenderer.invoke('device:save-waveform', { filename, points }),
  openInExplorer: (pathStr) => ipcRenderer.invoke('system:open-explorer', pathStr),
  openFile: (pathStr) => ipcRenderer.invoke('system:open-file', pathStr),
  saveCsv: (defaultName, content) => ipcRenderer.invoke('system:save-csv', { defaultName, content }),
  selectDirectory: () => ipcRenderer.invoke('system:select-directory')
});
