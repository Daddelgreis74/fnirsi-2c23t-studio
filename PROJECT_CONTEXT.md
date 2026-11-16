# FNIRSI 2C23T - Projekt-Kontext & Status

## Übersicht
Dieses Projekt umfasst die Desktop-Suite **FNIRSI 2C23T Studio** sowie die Firmware **OpenScope-2C23T** für das FNIRSI 2C23T (3-in-1 Handheld Oszilloskop, Multimeter & DDS Funktionsgenerator).

---

## 1. FNIRSI 2C23T Studio (Desktop PC Software)
- **Pfad:** `c:\Users\dadde\Documents\GitHub\fnirsi-2c23t-studio`
- **Aktuelle Version:** **v1.1.0** (OpenScope v2026.11.5 Upgrade)
- **Technologie:** Electron, Node.js, HTML5 Canvas, WebGL, SerialPort
- **Entwicklungs-Befehle:**
  - `npm start` - Startet die Electron-App im Entwicklungsmodus
  - `npm run dist` - Baut den eigenständigen Windows Installer / Portable Binary
- **Features:**
  - Live Multimeter Display mit automatischer Einheiten-Skalierung (`V`, `mV`, `Ohm`, `kOhm`, `DEG C`, `DEG F`, `A`, `mA` etc.).
  - Echtzeit Dual-Kanal Oszilloskop mit 15 FPS Waveform-Streaming, nativer 300-Punkte Auflösung (1:1 mit LCD), Nachleuchten (Persistence) und Pegelmessungen.
  - **Live DDS Signalgenerator-Steuerung:** Direkte USB-CDC-Befehle (`GEN:RUN`, `GEN:STOP`, `GEN:FREQ`, `GEN:WAVE`, `GEN:AMP`, `GEN:DUTY`, `GEN:?`), Frequenzschnellwahl, alle 16 Signalformen und Arbitrary-Waveform CSV-Import (0..255).
  - **Virtuelle Fernbedienung (Remote Keypad):** Vollständiges Tastenfeld (`KEY:<NAME>`, `KEY:<NAME>_LONG`) für D-Pad, Menü, Kanäle, Softkeys und Schnappschüsse.
  - **Remote Screenshot:** Löst über USB-Befehl `SHOT` Screenshots auf dem 2C23T aus und synchronisiert die Galerie automatisch.

---

## 2. OpenScope-2C23T (Firmware)
- **Pfad:** `c:\Users\dadde\Documents\GitHub\OpenScope-2C23T`
- **Upstream:** `https://github.com/rosenrot00/OpenScope-2C23T`
- **Aktueller Stand:** **v2026.11.5**
