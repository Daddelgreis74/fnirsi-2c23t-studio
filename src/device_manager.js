const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { t } = require('./i18n/main');

class DeviceManager {
  constructor() {
    this.currentStatus = {
      connected: false,
      mode: 'DISCONNECTED', // 'DISCONNECTED' | 'OPENSCOPE' | 'STOCK' | 'BOOTLOADER'
      driveLetter: null,
      volumeName: null,
      hwVersion: 'Unknown',
      bootloaderCrc: null,
      firmwareVersion: null,
      freeSpace: null,
      totalSpace: null,
      files: []
    };
    this.lastFilesHash = '';
    this.scanning = false;
  }

  classifyDrive(d, dirFiles = [], readFileText = () => '') {
    const letter = d && d.DeviceID ? d.DeviceID.toUpperCase() : '';
    if (!letter) return null;
    const root = letter.endsWith('\\') ? letter : letter + '\\';
    const lowerFiles = new Set(dirFiles.map((f) => String(f).toLowerCase()));
    const hasFile = (name) => lowerFiles.has(name.toLowerCase());
    const volumeName = d.VolumeName || '';

    // 1. Check BootLoader Mode: Drive has Ready.TXT or VolumeName "FNIRSI IAP"
    if (hasFile('ready.txt') || volumeName.toUpperCase().includes('FNIRSI')) {
      return {
        connected: true,
        mode: 'BOOTLOADER',
        driveLetter: root,
        volumeName: volumeName || 'FNIRSI IAP',
        hwVersion: 'BootLoader Mode (ready to flash)',
        firmwareVersion: 'IAP Bootloader',
        bootloaderCrc: null,
        freeSpace: d.FreeSpace ?? null,
        totalSpace: d.Size ?? null,
        files: dirFiles
      };
    }

    // 2. Check OpenScope / Runtime Mode: Marker files, USB disk descriptor, or BMP screenshots
    const hasBootHw4 = hasFile('boot_hw4.txt') || hasFile('boot_hw4.bin');
    const hasBootOld = hasFile('boot_old.txt') || hasFile('boot_old.bin');
    const isF2c23tUsb = !!(d.UsbModel && /F2C23T|FNIRSI/i.test(d.UsbModel));
    const bmpFiles = dirFiles.filter((f) => String(f).toLowerCase().endsWith('.bmp'));

    if (hasBootHw4 || hasBootOld || isF2c23tUsb || (bmpFiles.length > 0 && volumeName !== 'Windows')) {
      let hw = 'HW: V0.4 (Gowin GW1N-UV2 FPGA)';
      let fw = 'OpenScope';
      let crc = null;
      let mode = 'OPENSCOPE';

      if (hasBootHw4) {
        try {
          const bootFile = dirFiles.find((f) => String(f).toLowerCase() === 'boot_hw4.txt');
          const txt = bootFile ? readFileText(bootFile) : '';
          const matchFw = txt.match(/Firmware:\s*([^\r\n]+)/i);
          const matchCrc = txt.match(/CRC32:\s*([^\r\n]+)/i);
          if (matchFw) fw = 'OpenScope ' + matchFw[1].trim();
          if (matchCrc) crc = matchCrc[1].trim();
        } catch (e) {}
      } else if (hasBootOld) {
        hw = 'HW: <= V0.3 (AGM AG1KLP FPGA)';
      } else if (isF2c23tUsb) {
        fw = 'OpenScope 2C23T';
        hw = 'HW: F2C23T (USB)';
      } else {
        mode = 'STOCK';
        fw = 'FNIRSI Stock Firmware';
      }

      return {
        connected: true,
        mode,
        driveLetter: root,
        volumeName: volumeName || 'FNIRSI 2C23T',
        hwVersion: hw,
        firmwareVersion: fw,
        bootloaderCrc: crc,
        freeSpace: d.FreeSpace ?? null,
        totalSpace: d.Size ?? null,
        files: dirFiles
      };
    }

    return null;
  }

  // Scan logical drives on Windows using PowerShell Get-CimInstance
  scanDrives() {
    if (this.scanning) {
      return Promise.resolve(this.currentStatus);
    }
    this.scanning = true;

    return new Promise((resolve) => {
      const psScript = [
        '$usb = @{}',
        "Get-CimInstance Win32_DiskDrive | Where-Object { $_.Model -match 'F2C23T|FNIRSI' -or $_.PNPDeviceID -match 'F2C23T|FNIRSI' } | ForEach-Object {",
        '  $m = $_.Model',
        '  Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_DiskPartition | ForEach-Object {',
        '    Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_LogicalDisk | ForEach-Object {',
        '      if ($_.DeviceID) { $usb[$_.DeviceID.ToUpper()] = $m }',
        '    }',
        '  }',
        '}',
        'Get-CimInstance Win32_LogicalDisk | ForEach-Object {',
        '  $k = if ($_.DeviceID) { $_.DeviceID.ToUpper() } else { "" }',
        '  [PSCustomObject]@{ DeviceID = $_.DeviceID; VolumeName = $_.VolumeName; FileSystem = $_.FileSystem; FreeSpace = $_.FreeSpace; Size = $_.Size; DriveType = $_.DriveType; UsbModel = $usb[$k] }',
        '} | ConvertTo-Json -Compress'
      ].join('; ');

      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { timeout: 5000 },
        (err, stdout) => {
          try {
            if (err || !stdout || !stdout.trim()) {
              this.currentStatus = {
                ...this.currentStatus,
                connected: false,
                mode: 'DISCONNECTED',
                driveLetter: null,
                bootloaderCrc: null,
                firmwareVersion: null,
                hwVersion: 'Unknown',
                files: []
              };
              return resolve(this.currentStatus);
            }

            let drives = JSON.parse(stdout.trim());
            if (!Array.isArray(drives)) drives = [drives];

            let detected = null;

            for (const d of drives) {
              const letter = d && d.DeviceID ? d.DeviceID.toUpperCase() : '';
              if (!letter) continue;
              const root = letter.endsWith('\\') ? letter : letter + '\\';

              try {
                if (!fs.existsSync(root)) continue;
                const dirFiles = fs.readdirSync(root);
                const match = this.classifyDrive(d, dirFiles, (name) =>
                  fs.readFileSync(path.join(root, name), 'utf8')
                );
                if (match) {
                  detected = match;
                  break;
                }
              } catch (e) {
                // Drive read failed (e.g. CD-ROM or locked), skip
              }
            }

            if (detected) {
              this.currentStatus = { ...this.currentStatus, ...detected };
            } else {
              this.currentStatus = {
                ...this.currentStatus,
                connected: false,
                mode: 'DISCONNECTED',
                driveLetter: null,
                bootloaderCrc: null,
                firmwareVersion: null,
                hwVersion: 'Unknown',
                files: []
              };
            }

            resolve(this.currentStatus);
          } catch (e) {
            resolve(this.currentStatus);
          } finally {
            this.scanning = false;
          }
        }
      );
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
      throw new Error(t('device.no_drive'));
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
