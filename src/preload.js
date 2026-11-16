const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('device:get-status'),
  onStatusChange: (callback) => ipcRenderer.on('device:status-changed', (_event, value) => callback(value)),
  getScreenshots: () => ipcRenderer.invoke('device:get-screenshots'),
  saveWaveformCsv: (filename, points) => ipcRenderer.invoke('device:save-waveform', { filename, points }),
  openInExplorer: (pathStr) => ipcRenderer.invoke('system:open-explorer', pathStr),
  openFile: (pathStr) => ipcRenderer.invoke('system:open-file', pathStr),
  saveCsv: (defaultName, content) => ipcRenderer.invoke('system:save-csv', { defaultName, content }),
  selectDirectory: () => ipcRenderer.invoke('system:select-directory'),
  onDmmLine: (callback) => ipcRenderer.on('dmm:serial-line', (_event, line) => callback(line)),
  onDmmStatus: (callback) => ipcRenderer.on('dmm:serial-status', (_event, status) => callback(status)),
  onDmmLog: (callback) => ipcRenderer.on('dmm:serial-log', (_event, log) => callback(log)),
  reconnectSerial: () => ipcRenderer.invoke('dmm:reconnect-serial'),
  setLanguage: (lang) => ipcRenderer.invoke('i18n:set-language', lang),
  sendDmmCommand: (cmd) => ipcRenderer.invoke('dmm:send-command', cmd)
});
