// FNIRSI 2C23T Studio - Serial Telemetry Manager
// Automatic COM port detection and live line streaming via PowerShell background worker

const { spawn, exec } = require('child_process');

class SerialManager {
  constructor() {
    this.currentPort = null;
    this.worker = null;
    this.isRunning = false;
    this.pollTimer = null;
    this.onLineCallback = null;
    this.onStatusCallback = null;
  }

  // Scan Windows PnP for 2C23T Virtual COM Port (VID: 2E3C)
  detectPort() {
    return new Promise((resolve) => {
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-PnpDevice -Class Ports -Status OK -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match '2E3C' } | ForEach-Object { if ($_.FriendlyName -match '\\((COM\\d+)\\)') { $matches[1] } }"`;
      exec(cmd, { timeout: 3000 }, (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const match = stdout.trim().match(/COM\d+/);
        resolve(match ? match[0] : null);
      });
    });
  }

  start(onLine, onStatus) {
    this.onLineCallback = onLine;
    this.onStatusCallback = onStatus;
    this.isRunning = true;

    this.checkAndConnect();
    this.pollTimer = setInterval(() => {
      if (this.isRunning && !this.worker) {
        this.checkAndConnect();
      }
    }, 2500);
  }

  async checkAndConnect() {
    if (!this.isRunning || this.worker) return;

    try {
      const port = await this.detectPort();
      if (port) {
        this.currentPort = port;
        this.spawnWorker(port);
      } else {
        if (this.onStatusCallback) {
          this.onStatusCallback({ connected: false, port: null });
        }
      }
    } catch (e) {
      console.warn('Port detection error:', e);
    }
  }

  spawnWorker(port) {
    if (this.worker) return;

    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'
      $p = New-Object System.IO.Ports.SerialPort '${port}', 115200, None, 8, One
      $p.DtrEnable = $true
      $p.RtsEnable = $true
      $p.ReadTimeout = 1500
      try {
        $p.Open()
        [Console]::WriteLine('CONNECTED')
        [Console]::Out.Flush()

        $thread = [System.Threading.Thread]::new([System.Threading.ThreadStart]{
          while ($p.IsOpen) {
            try {
              $cmd = [Console]::ReadLine()
              if ($cmd -and $p.IsOpen) {
                $p.WriteLine($cmd)
              }
            } catch {}
          }
        })
        $thread.IsBackground = $true
        $thread.Start()

        while ($p.IsOpen) {
          try {
            $line = $p.ReadLine()
            if ($line -and $line.Trim().Length -gt 0) {
              [Console]::WriteLine($line.Trim())
              [Console]::Out.Flush()
            }
          } catch [System.TimeoutException] {}
        }
      } catch {
        [Console]::WriteLine('ERROR: ' + $_.Exception.Message)
        [Console]::Out.Flush()
      } finally {
        if ($p.IsOpen) { $p.Close() }
      }
    `;

    try {
      this.worker = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
        windowsHide: true
      });

      let lineBuffer = '';

      this.worker.stdout.on('data', (chunk) => {
        lineBuffer += chunk.toString();
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === 'CONNECTED') {
            if (this.onStatusCallback) {
              this.onStatusCallback({ connected: true, port: this.currentPort });
            }
          } else if (trimmed.startsWith('$DMM,')) {
            if (this.onLineCallback) {
              this.onLineCallback(trimmed);
            }
          }
        }
      });

      this.worker.stderr.on('data', () => {});

      this.worker.on('exit', () => {
        this.worker = null;
        if (this.onStatusCallback) {
          this.onStatusCallback({ connected: false, port: null });
        }
      });

      this.worker.on('error', () => {
        this.worker = null;
        if (this.onStatusCallback) {
          this.onStatusCallback({ connected: false, port: null });
        }
      });
    } catch (err) {
      console.warn('Failed to spawn serial worker:', err);
      this.worker = null;
    }
  }

  sendCommand(cmd) {
    if (this.worker && this.worker.stdin && this.worker.stdin.writable) {
      try {
        this.worker.stdin.write(cmd.trim() + '\n');
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'Not connected' };
  }

  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.worker) {
      try {
        this.worker.kill();
      } catch (e) {}
      this.worker = null;
    }
    if (this.onStatusCallback) {
      this.onStatusCallback({ connected: false, port: null });
    }
  }
}

module.exports = new SerialManager();
