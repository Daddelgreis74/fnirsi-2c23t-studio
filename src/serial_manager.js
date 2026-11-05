// FNIRSI 2C23T Studio - Serial Telemetry Manager
// Automatic COM port detection and high-performance full-duplex C# worker for USB-CDC streaming

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class SerialManager {
  constructor() {
    this.currentPort = null;
    this.worker = null;
    this.isRunning = false;
    this.pollTimer = null;
    this.onLineCallback = null;
    this.onStatusCallback = null;
    this.onLogCallback = null;
    this.logFilePath = path.join(process.cwd(), 'dmm_telemetry.log');
  }

  logToFile(line) {
    try {
      fs.appendFileSync(this.logFilePath, `[${new Date().toISOString()}] ${line}\r\n`, 'utf8');
    } catch (e) {}
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

  start(onLine, onStatus, onLog) {
    this.onLineCallback = onLine;
    this.onStatusCallback = onStatus;
    this.onLogCallback = onLog;
    this.isRunning = true;

    this.checkAndConnect();
    this.pollTimer = setInterval(() => {
      if (this.isRunning && !this.worker) {
        this.checkAndConnect();
      }
    }, 2500);
  }

  emitLog(type, text) {
    const time = new Date().toLocaleTimeString() + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    this.logToFile(`${type.toUpperCase()}: ${text}`);
    if (this.onLogCallback) {
      this.onLogCallback({ type, text, time });
    }
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
      this.emitLog('error', `Port-Erkennungsfehler: ${e.message}`);
    }
  }

  spawnWorker(port) {
    if (this.worker) return;

    const psScript = `
$code = @'
using System;
using System.IO.Ports;
using System.Threading;

public class DmmSerialWorker {
    private static SerialPort port;
    private static volatile bool running = true;

    public static void Run(string portName) {
        try {
            port = new SerialPort(portName, 115200, Parity.None, 8, StopBits.One);
            port.DtrEnable = true;
            port.RtsEnable = true;
            port.ReadTimeout = 1500;
            port.WriteTimeout = 1500;
            port.Open();

            Console.WriteLine("[CONNECTED]:" + portName);
            Console.Out.Flush();

            Thread readerThread = new Thread(() => {
                while (running && port != null && port.IsOpen) {
                    try {
                        string cmd = Console.ReadLine();
                        if (cmd == null) break;
                        cmd = cmd.Trim();
                        if (cmd.Length > 0 && port.IsOpen) {
                            port.WriteLine(cmd);
                            Console.WriteLine("[TX]:" + cmd);
                            Console.Out.Flush();
                        }
                    } catch (Exception ex) {
                        Console.WriteLine("[ERR_TX]:" + ex.Message);
                        Console.Out.Flush();
                    }
                }
            });
            readerThread.IsBackground = true;
            readerThread.Start();

            while (running && port != null && port.IsOpen) {
                try {
                    string line = port.ReadLine();
                    if (!string.IsNullOrEmpty(line)) {
                        Console.WriteLine("[RX]:" + line.Trim());
                        Console.Out.Flush();
                    }
                } catch (TimeoutException) {
                } catch (Exception ex) {
                    Console.WriteLine("[ERR_RX]:" + ex.Message);
                    Console.Out.Flush();
                    break;
                }
            }
        } catch (Exception ex) {
            Console.WriteLine("[ERR_OPEN]:" + ex.Message);
            Console.Out.Flush();
        } finally {
            running = false;
            if (port != null) {
                try { if (port.IsOpen) port.Close(); } catch {}
                try { port.Dispose(); } catch {}
            }
            Console.WriteLine("[DISCONNECTED]");
            Console.Out.Flush();
        }
    }
}
'@
Add-Type -TypeDefinition $code
[DmmSerialWorker]::Run("${port}")
`;

    try {
      this.emitLog('info', `Initialisiere Hardware-Port ${port} (115200 Baud)...`);

      this.worker = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let lineBuffer = '';

      this.worker.stdout.on('data', (chunk) => {
        lineBuffer += chunk.toString();
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('[CONNECTED]:')) {
            const connectedPort = trimmed.substring(12);
            this.emitLog('info', `Verbunden mit ${connectedPort}`);
            if (this.onStatusCallback) {
              this.onStatusCallback({ connected: true, port: connectedPort });
            }
          } else if (trimmed.startsWith('[RX]:')) {
            const rxLine = trimmed.substring(5);
            this.emitLog('rx', rxLine);
            if (this.onLineCallback) {
              this.onLineCallback(rxLine);
            }
          } else if (trimmed.startsWith('[TX]:')) {
            const txCmd = trimmed.substring(5);
            this.emitLog('tx', txCmd);
          } else if (trimmed.startsWith('[ERR_OPEN]:')) {
            this.emitLog('error', `Fehler beim Öffnen von ${port}: ${trimmed.substring(11)}`);
          } else if (trimmed.startsWith('[ERR_TX]:')) {
            this.emitLog('error', `Sende-Fehler: ${trimmed.substring(9)}`);
          } else if (trimmed.startsWith('[ERR_RX]:')) {
            this.emitLog('error', `Empfangs-Fehler: ${trimmed.substring(9)}`);
          } else if (trimmed === '[DISCONNECTED]') {
            this.emitLog('info', `Verbindung getrennt.`);
            if (this.onStatusCallback) {
              this.onStatusCallback({ connected: false, port: null });
            }
          } else {
            this.emitLog('info', trimmed);
          }
        }
      });

      this.worker.stderr.on('data', (data) => {
        const err = data.toString().trim();
        if (err) this.emitLog('error', `PS Error: ${err}`);
      });

      this.worker.on('exit', () => {
        this.worker = null;
        if (this.onStatusCallback) {
          this.onStatusCallback({ connected: false, port: null });
        }
      });

      this.worker.on('error', (err) => {
        this.emitLog('error', `Worker Prozessfehler: ${err.message}`);
        this.worker = null;
        if (this.onStatusCallback) {
          this.onStatusCallback({ connected: false, port: null });
        }
      });
    } catch (err) {
      this.emitLog('error', `Worker-Start fehlgeschlagen: ${err.message}`);
      this.worker = null;
    }
  }

  sendCommand(cmd) {
    if (this.worker && this.worker.stdin && this.worker.stdin.writable) {
      try {
        const cleanCmd = cmd.trim();
        this.worker.stdin.write(cleanCmd + '\n');
        return { success: true };
      } catch (e) {
        this.emitLog('error', `Konnte Befehl '${cmd}' nicht senden: ${e.message}`);
        return { success: false, error: e.message };
      }
    }
    this.emitLog('error', `Befehl '${cmd}' verworfen: Port nicht verbunden`);
    return { success: false, error: 'Not connected' };
  }

  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.worker && this.worker.pid) {
      try {
        exec(`taskkill /pid ${this.worker.pid} /f /t`);
      } catch (e) {}
      this.worker = null;
    }
    if (this.onStatusCallback) {
      this.onStatusCallback({ connected: false, port: null });
    }
  }
}

module.exports = new SerialManager();
