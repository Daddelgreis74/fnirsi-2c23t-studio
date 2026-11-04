const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('device:get-status'),
  onStatusChange: (callback) => ipcRenderer.on('device:status-changed', (_event, value) => callback(value)),
  getScreenshots: () => ipcRenderer.invoke('device:get-screenshots'),
  saveWaveformCsv: (filename, points) => ipcRenderer.invoke('device:save-waveform', { filename, points }),
  backupDevice: () => ipcRenderer.invoke('device:backup'),
  flashFirmware: (firmwareKey) => ipcRenderer.invoke('device:flash-firmware', firmwareKey),
  onFlashProgress: (callback) => ipcRenderer.on('device:flash-progress', (_event, value) => callback(value)),
  openInExplorer: (pathStr) => ipcRenderer.invoke('system:open-explorer', pathStr),
  openFile: (pathStr) => ipcRenderer.invoke('system:open-file', pathStr),
  selectDirectory: () => ipcRenderer.invoke('system:select-directory')
});
