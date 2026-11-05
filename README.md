# FNIRSI 2C23T Studio ⚡🔬

> **Professional Windows Desktop Studio, Companion & Control Suite for the FNIRSI 2C23T Handheld 3-in-1 Digital Oscilloscope, Multimeter & DDS Function Generator.**

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-00f2fe.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v1.0.1-10b981.svg)](https://github.com/Daddelgreis74/fnirsi-2c23t-studio/releases)

---

## 🌟 Features

* **🔬 Dual-Channel 60 FPS Oscilloscope Simulator & Lab:**
  * Real-time dual trace visualization (CH1 Cyan, CH2 Amber) with phosphor persistence effect.
  * Time/Div scaling (500µs – 10ms) and Volts/Div controls.
  * Real-Time FFT Spectrum Analyzer view.
  * Live calculated signal parameters ($V_{pp}$, $V_{rms}$, frequency).
* **📸 Live Screenshot & Waveform Archiv:**
  * Auto-detects and synchronizes all `.bmp` screenshots captured with the 2C23T's `SAVE` button.
  * Built-in viewer with zoom, details, and 1-click PNG/PDF export.
* **⚡ Arbitrary Waveform Studio (OpenScope ARBT Designer):**
  * Visual interactive wave editor: draw custom curves with your mouse or select mathematical presets (Sine, Half-Sine, Square, Sawtooth, Triangle, ECG Cardiac Pulse, Exponential, Noise).
  * 1-Click Export directly onto the 2C23T's root drive as `.CSV` for immediate DDS playback in OpenScope.
* **🛠️ Firmware-Archiv & Sicherer Recovery Guide:**
  * Geprüfte Binärdateien direkt im Zugriff:
    1. **FNIRSI Stock V2.1.0** (Offizielle Werks-Firmware für HW V0.4 Gowin FPGA, Base `0x08007000`)
    2. **OpenScope v2026.10.1** (Modulares Open-Source OS für HW 4.0)
  * Schneller 1-Klick-Zugriff auf den lokalen Firmware-Ordner zur sicheren Übertragung per Explorer Drag-and-Drop (schützt vor Übertragungsabbrüchen virtueller IAP-Laufwerke).
  * Integrierte Unbrick- und Hardware-Reset-Anleitung für den Bootloader.
* **💾 Bootloader & Full Device Backup Manager:**
  * Sichert Bootloader (`boot_hw4.bin`, CRC32 `2ACD97AB`), Kalibrierungsdaten und Screenshots in zeitgestempelten Archiven.

---

## 🚀 Installation & Downloads

Download the latest version from [GitHub Releases](https://github.com/Daddelgreis74/fnirsi-2c23t-studio/releases):

* **Installer (NSIS):** `FNIRSI 2C23T Studio Setup 1.0.1.exe` (Desktop Icon & Start Menu Integration)
* **Portable:** `FNIRSI-2C23T-Studio-Portable-1.0.1.exe` (Single self-contained `.exe`)

---

## 🛠️ Development & Building

```bash
# Clone the repository
git clone https://github.com/Daddelgreis74/fnirsi-2c23t-studio.git
cd fnirsi-2c23t-studio

# Install dependencies
npm install

# Start development preview
npm start

# Build Windows Installer and Portable executable
npm run dist
```

---

## 📜 License

MIT License - Developed by **Daddelgreis74** (2026).
