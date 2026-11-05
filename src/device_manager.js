const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DeviceManager {
  constructor() {
    this.currentStatus = {
      connected: false,
      mode: 'DISCONNECTED', // 'DISCONNECTED' | 'OPENSCOPE' | 'STOCK' | 'BOOTLOADER'
      driveLetter: null,
      volumeName: null,
      hwVersion: 'Unbekannt',
      bootloaderCrc: null,
      firmwareVersion: null,
      freeSpace: null,
      totalSpace: null,
      files: []
    };
    this.lastFilesHash = '';
  }

  // Scan logical drives on Windows using PowerShell Get-CimInstance
  scanDrives() {
    return new Promise((resolve) => {
      const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, FileSystem, FreeSpace, Size | ConvertTo-Json -Compress"`;
      exec(psCmd, { timeout: 3500 }, (err, stdout) => {
        if (err || !stdout.trim()) {
          this.currentStatus.connected = false;
          this.currentStatus.mode = 'DISCONNECTED';
          this.currentStatus.driveLetter = null;
          return resolve(this.currentStatus);
        }

        try {
          let drives = JSON.parse(stdout.trim());
          if (!Array.isArray(drives)) drives = [drives];

          let detected = null;

          for (const d of drives) {
            const letter = d.DeviceID ? d.DeviceID.toUpperCase() : '';
            const root = letter.endsWith('\\') ? letter : letter + '\\';
            
            try {
              if (!fs.existsSync(root)) continue;

              // 1. Check BootLoader Mode: Drive has Ready.TXT or VolumeName "FNIRSI IAP"
              const hasReadyTxt = fs.existsSync(path.join(root, 'Ready.TXT')) || fs.existsSync(path.join(root, 'ready.txt'));
              if (hasReadyTxt || (d.VolumeName && d.VolumeName.toUpperCase().includes('FNIRSI'))) {
                detected = {
                  connected: true,
                  mode: 'BOOTLOADER',
                  driveLetter: root,
                  volumeName: d.VolumeName || 'FNIRSI IAP',
                  hwVersion: 'BootLoader Mode (Bereit zum Flashen)',
                  firmwareVersion: 'IAP Bootloader'
                };
                break;
              }

              // 2. Check OpenScope / Runtime Mode: Drive has boot_hw4.txt or boot_hw4.bin or boot_old.txt
              const hasBootHw4 = fs.existsSync(path.join(root, 'boot_hw4.txt')) || fs.existsSync(path.join(root, 'boot_hw4.bin'));
              const hasBootOld = fs.existsSync(path.join(root, 'boot_old.txt')) || fs.existsSync(path.join(root, 'boot_old.bin'));

              // Also check for BMP screenshots or ARBT waveforms
              const dirFiles = fs.readdirSync(root);
              const bmpFiles = dirFiles.filter(f => f.toLowerCase().endsWith('.bmp'));

              if (hasBootHw4 || hasBootOld || (bmpFiles.length > 0 && d.VolumeName !== 'Windows')) {
                let hw = 'HW: V0.4 (Gowin GW1N-UV2 FPGA)';
                let fw = 'OpenScope';
                let crc = null;

                if (hasBootHw4) {
                  try {
                    const txt = fs.readFileSync(path.join(root, 'boot_hw4.txt'), 'utf8');
                    const matchFw = txt.match(/Firmware:\s*([^\r\n]+)/i);
                    const matchCrc = txt.match(/CRC32:\s*([^\r\n]+)/i);
                    if (matchFw) fw = 'OpenScope ' + matchFw[1].trim();
                    if (matchCrc) crc = matchCrc[1].trim();
                  } catch (e) {}
                } else if (hasBootOld) {
                  hw = 'HW: <= V0.3 (AGM AG1KLP FPGA)';
                } else {
                  fw = 'FNIRSI Stock Firmware';
                }

                detected = {
                  connected: true,
                  mode: hasBootHw4 || hasBootOld ? 'OPENSCOPE' : 'STOCK',
                  driveLetter: root,
                  volumeName: d.VolumeName || 'FNIRSI 2C23T',
                  hwVersion: hw,
                  firmwareVersion: fw,
                  bootloaderCrc: crc,
                  freeSpace: d.FreeSpace,
                  totalSpace: d.Size,
                  files: dirFiles
                };
                break;
              }
            } catch (e) {
              // Drive read failed (e.g. CD-ROM or locked), skip
            }
          }

          if (detected) {
            this.currentStatus = { ...this.currentStatus, ...detected };
          } else {
            this.currentStatus.connected = false;
            this.currentStatus.mode = 'DISCONNECTED';
            this.currentStatus.driveLetter = null;
          }

          resolve(this.currentStatus);
        } catch (e) {
          resolve(this.currentStatus);
        }
      });
    });
  }

  // Get all screenshots (.bmp) with metadata & base64 preview
  getScreenshots() {
    if (!this.currentStatus.connected || !this.currentStatus.driveLetter) {
      return [];
    }

    const root = this.currentStatus.driveLetter;
    const results = [];

    try {
      const searchDirs = [root];
      const bmpSubdir = path.join(root, 'BMP');
      if (fs.existsSync(bmpSubdir)) searchDirs.push(bmpSubdir);

      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.toLowerCase().endsWith('.bmp')) {
            const fullPath = path.join(dir, f);
            const stats = fs.statSync(fullPath);
            const data = fs.readFileSync(fullPath);
            results.push({
              filename: f,
              fullPath: fullPath,
              size: stats.size,
              mtime: stats.mtime,
              previewBase64: 'data:image/bmp;base64,' + data.toString('base64')
            });
          }
        }
      }
    } catch (e) {
      console.error('Error reading screenshots:', e);
    }

    return results.sort((a, b) => b.mtime - a.mtime);
  }

  // Save custom CSV waveform to 2C23T root directory (for OpenScope Arbitrary Gen)
  saveWaveformCsv(filename, pointsArray, maxMv = 2500) {
    if (!this.currentStatus.connected || !this.currentStatus.driveLetter) {
      throw new Error('Kein FNIRSI 2C23T Laufwerk verbunden!');
    }

    const cleanName = filename.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 8);
    const targetPath = path.join(this.currentStatus.driveLetter, `${cleanName}.CSV`);

    // OpenScope DDS erwartet 8-Bit DAC Werte (0 bis 255).
    // Falls pointsArray in mV (0..2500) vorliegt, normieren wir sauber auf 0..255:
    let csvContent = pointsArray.map(p => {
      let v = typeof p === 'number' ? p : parseFloat(p);
      if (maxMv > 255) {
        v = Math.round((v / maxMv) * 255);
      } else {
        v = Math.round(v);
      }
      return Math.max(0, Math.min(255, v));
    }).join('\r\n');
    fs.writeFileSync(targetPath, csvContent, 'utf8');

    return {
      success: true,
      path: targetPath,
      name: `${cleanName}.CSV`,
      points: pointsArray.length
    };
  }
}

module.exports = new DeviceManager();
