const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const deviceManager = require('./device_manager');

let mainWindow = null;
let pollTimer = null;
let previousStatusJson = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: '#0a0d14',
    title: 'FNIRSI 2C23T Studio',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Start polling device status every 1500ms
  pollTimer = setInterval(async () => {
    try {
      const status = await deviceManager.scanDrives();
      const currentJson = JSON.stringify(status);
      if (currentJson !== previousStatusJson && mainWindow && !mainWindow.isDestroyed()) {
        previousStatusJson = currentJson;
        mainWindow.webContents.send('device:status-changed', status);
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, 1500);

  mainWindow.on('closed', () => {
    if (pollTimer) clearInterval(pollTimer);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

ipcMain.handle('device:get-status', async () => {
  return await deviceManager.scanDrives();
});

ipcMain.handle('device:get-screenshots', async () => {
  return deviceManager.getScreenshots();
});

ipcMain.handle('device:save-waveform', async (_event, { filename, points }) => {
  return deviceManager.saveWaveformCsv(filename, points);
});

ipcMain.handle('device:backup', async () => {
  const defaultDir = path.join(app.getPath('downloads'), '2C23T_Backups');
  return await deviceManager.backupDevice(defaultDir);
});

ipcMain.handle('system:open-firmware-folder', async () => {
  const fwDir = path.join(__dirname, '../assets/firmwares');
  if (fs.existsSync(fwDir)) {
    await shell.openPath(fwDir);
    return true;
  }
  return false;
});

ipcMain.handle('system:open-explorer', async (_event, targetPath) => {
  if (targetPath) {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        await shell.openPath(targetPath);
      } else {
        shell.showItemInFolder(targetPath);
      }
      return true;
    }
  }
  return false;
});

ipcMain.handle('system:open-file', async (_event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    await shell.openPath(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('system:save-csv', async (_event, { defaultName, content }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'DMM Messreihe speichern',
    defaultPath: defaultName || 'dmm_measurements.csv',
    filters: [{ name: 'CSV (Trennzeichen-getrennt)', extensions: ['csv'] }]
  });
  if (!res.canceled && res.filePath) {
    fs.writeFileSync(res.filePath, content, 'utf8');
    return { success: true, filePath: res.filePath };
  }
  return { success: false };
});

ipcMain.handle('system:select-directory', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (!res.canceled && res.filePaths.length > 0) {
    return res.filePaths[0];
  }
  return null;
});
