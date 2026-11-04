// FNIRSI 2C23T Studio - Core Application Logic

let currentDeviceStatus = null;
let scopeRunning = true;
let activeWavePreset = 'sine';
let wavePoints = 64;
let maxMv = 2500;
let customPoints = [];
let isDrawingWave = false;

// DOM Elements
const statusPill = document.getElementById('statusPill');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const metaHw = document.getElementById('metaHw');
const metaDrive = document.getElementById('metaDrive');
const btnRefresh = document.getElementById('btnRefresh');
const btnOpenExplorer = document.getElementById('btnOpenExplorer');

// Tabs
const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');

// Toast
const toast = document.getElementById('toast');
function showToast(msg, duration = 3000) {
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// Tab Switching
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.tab;
    navItems.forEach(n => n.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    const panel = document.getElementById(`tab-${target}`);
    if (panel) panel.classList.add('active');

    if (target === 'gallery') loadScreenshots();
  });
});

// Refresh button
btnRefresh.addEventListener('click', async () => {
  showToast('Scanne USB-Laufwerke...');
  const status = await window.api.getStatus();
  updateDeviceUI(status);
});

btnOpenExplorer.addEventListener('click', async () => {
  if (currentDeviceStatus && currentDeviceStatus.driveLetter) {
    await window.api.openInExplorer(currentDeviceStatus.driveLetter);
  } else {
    showToast('Kein 2C23T Laufwerk aktiv');
  }
});

// Update Device Status in Header
function updateDeviceUI(status) {
  currentDeviceStatus = status;
  statusPill.className = 'status-pill';

  if (!status.connected) {
    statusPill.classList.add('offline');
    statusText.innerText = 'Kein 2C23T erkannt';
    metaHw.innerText = 'HW: --';
    metaDrive.innerText = 'Laufwerk: --';
    return;
  }

  if (status.mode === 'BOOTLOADER') {
    statusPill.classList.add('bootloader');
    statusText.innerText = 'BootLoader Modus (Bereit)';
    metaHw.innerText = 'IAP Bootloader';
    metaDrive.innerText = `Laufwerk: ${status.driveLetter}`;
  } else {
    statusPill.classList.add('online');
    statusText.innerText = status.firmwareVersion || 'Verbunden';
    metaHw.innerText = status.hwVersion;
    metaDrive.innerText = `Laufwerk: ${status.driveLetter}`;

    if (status.bootloaderCrc) {
      document.getElementById('valBootloaderCrc').innerText = status.bootloaderCrc;
    }
  }
}

// Initial status fetch & listener
window.api.getStatus().then(updateDeviceUI);
window.api.onStatusChange(updateDeviceUI);

// ==========================================
// 1. OSZILLOSKOP SIMULATOR & LABOR
// ==========================================
const scopeCanvas = document.getElementById('scopeCanvas');
const scopeCtx = scopeCanvas.getContext('2d');
let timebaseVal = 1.0;
let ch1Scale = 1.0;
let ch2Scale = 1.0;
let genFreq = 1000;
let genWave = 'sine';
let scopePhase = 0;

document.getElementById('btnScopeRun').addEventListener('click', (e) => {
  scopeRunning = !scopeRunning;
  e.target.innerText = scopeRunning ? 'STOP' : 'RUN';
  e.target.style.color = scopeRunning ? '' : '#ef4444';
});

document.querySelectorAll('[data-timebase]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-timebase]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timebaseVal = parseFloat(btn.dataset.timebase);
  });
});

document.getElementById('rngCh1Scale').addEventListener('input', (e) => {
  ch1Scale = parseFloat(e.target.value);
  document.getElementById('lblCh1Scale').innerText = `${ch1Scale.toFixed(1)} V/div`;
});

document.getElementById('rngCh2Scale').addEventListener('input', (e) => {
  ch2Scale = parseFloat(e.target.value);
  document.getElementById('lblCh2Scale').innerText = `${ch2Scale.toFixed(1)} V/div`;
});

document.querySelectorAll('.sig-presets button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sig-presets button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    genWave = btn.dataset.wave;
  });
});

document.getElementById('rngGenFreq').addEventListener('input', (e) => {
  genFreq = parseInt(e.target.value);
  document.getElementById('lblGenFreq').innerText = genFreq >= 1000 ? `${(genFreq/1000).toFixed(1)} kHz` : `${genFreq} Hz`;
});

function renderScope() {
  const width = scopeCanvas.width;
  const height = scopeCanvas.height;
  const centerY = height / 2;

  const persist = document.getElementById('chkPersist').checked;
  if (persist) {
    scopeCtx.fillStyle = 'rgba(3, 6, 16, 0.22)';
    scopeCtx.fillRect(0, 0, width, height);
  } else {
    scopeCtx.fillStyle = '#030610';
    scopeCtx.fillRect(0, 0, width, height);
  }

  // Draw Grid
  scopeCtx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
  scopeCtx.lineWidth = 1;
  const divX = width / 10;
  const divY = height / 8;

  for (let x = 0; x <= width; x += divX) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(x, 0);
    scopeCtx.lineTo(x, height);
    scopeCtx.stroke();
  }
  for (let y = 0; y <= height; y += divY) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, y);
    scopeCtx.lineTo(width, y);
    scopeCtx.stroke();
  }

  // Center axes with tick marks
  scopeCtx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
  scopeCtx.beginPath();
  scopeCtx.moveTo(0, centerY);
  scopeCtx.lineTo(width, centerY);
  scopeCtx.moveTo(width / 2, 0);
  scopeCtx.lineTo(width / 2, height);
  scopeCtx.stroke();

  if (scopeRunning) {
    scopePhase += 0.05 * (genFreq / 1000) * timebaseVal;
  }

  const showCh1 = document.getElementById('chkCh1').checked;
  const showCh2 = document.getElementById('chkCh2').checked;
  const showFft = document.getElementById('chkFft').checked;

  // CH1 Wave (Cyan)
  if (showCh1) {
    scopeCtx.strokeStyle = '#00f2fe';
    scopeCtx.lineWidth = 2.5;
    scopeCtx.shadowColor = '#00f2fe';
    scopeCtx.shadowBlur = 8;
    scopeCtx.beginPath();

    for (let x = 0; x < width; x++) {
      const t = (x / width) * Math.PI * 4 * timebaseVal + scopePhase;
      let val = Math.sin(t);
      if (genWave === 'square') val = Math.sin(t) >= 0 ? 1 : -1;
      else if (genWave === 'tri') val = (2 / Math.PI) * Math.asin(Math.sin(t));
      else if (genWave === 'ecg') {
        const mod = (t % (Math.PI * 2));
        val = mod > 1.0 && mod < 1.4 ? Math.sin((mod - 1.0) * Math.PI * 5) * 1.8 : Math.sin(t * 0.5) * 0.2;
      }

      const y = centerY - (val * divY * 1.8) / ch1Scale;
      if (x === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();
    scopeCtx.shadowBlur = 0;
  }

  // CH2 Wave (Amber)
  if (showCh2) {
    scopeCtx.strokeStyle = '#fb923c';
    scopeCtx.lineWidth = 2;
    scopeCtx.shadowColor = '#fb923c';
    scopeCtx.shadowBlur = 6;
    scopeCtx.beginPath();

    for (let x = 0; x < width; x++) {
      const t = (x / width) * Math.PI * 6 * timebaseVal + (scopePhase * 1.3);
      const val = Math.cos(t);
      const y = centerY - (val * divY * 1.2) / ch2Scale;
      if (x === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();
    scopeCtx.shadowBlur = 0;
  }

  // FFT Bars (bottom)
  if (showFft) {
    scopeCtx.fillStyle = 'rgba(16, 185, 129, 0.4)';
    const bars = 40;
    const barW = width / bars;
    for (let i = 0; i < bars; i++) {
      const amp = Math.abs(Math.sin(scopePhase * 0.5 + i * 0.4)) * (height * 0.3) * (1 / (1 + i * 0.15));
      scopeCtx.fillRect(i * barW + 2, height - amp, barW - 4, amp);
    }
  }

  // Update Stats
  const vpp1 = (3.3 * (1 / ch1Scale)).toFixed(2);
  const vrms1 = (vpp1 * 0.35355).toFixed(2);
  document.getElementById('statCh1Vpp').innerText = `${vpp1} Vpp`;
  document.getElementById('statCh1Vrms').innerText = `${vrms1} Vrms`;
  document.getElementById('statCh1Freq').innerText = `${genFreq} Hz`;

  requestAnimationFrame(renderScope);
}
requestAnimationFrame(renderScope);

// ==========================================
// 2. SCREENSHOT-GALERIE
// ==========================================
async function loadScreenshots() {
  const galleryList = document.getElementById('galleryList');
  const emptyState = document.getElementById('galleryEmpty');
  const badge = document.getElementById('badgeGalleryCount');

  try {
    const list = await window.api.getScreenshots();
    badge.innerText = list.length;

    if (list.length === 0) {
      galleryList.innerHTML = '';
      galleryList.appendChild(emptyState);
      return;
    }

    galleryList.innerHTML = '';
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      const dateStr = new Date(item.mtime).toLocaleString('de-DE');
      card.innerHTML = `
        <img class="gallery-thumb" src="${item.previewBase64}" alt="${item.filename}">
        <div class="gallery-card-meta">
          <span class="filename">${item.filename}</span>
          <span class="date">${dateStr}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.gallery-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        showScreenshotPreview(item);
      });
      galleryList.appendChild(card);
    });

    if (list.length > 0) {
      showScreenshotPreview(list[0]);
    }
  } catch (e) {
    console.error('Error loading screenshots:', e);
  }
}

function showScreenshotPreview(item) {
  const pane = document.getElementById('galleryPreviewPane');
  pane.style.display = 'flex';
  document.getElementById('previewTitle').innerText = item.filename;
  document.getElementById('previewImage').src = item.previewBase64;

  document.getElementById('btnOpenInApp').onclick = () => {
    window.api.openFile(item.fullPath);
  };
}

document.getElementById('btnSyncScreenshots').addEventListener('click', () => {
  loadScreenshots();
  showToast('Screenshots synchronisiert!');
});

document.getElementById('btnOpenScreenshotFolder').addEventListener('click', () => {
  if (currentDeviceStatus && currentDeviceStatus.driveLetter) {
    window.api.openInExplorer(currentDeviceStatus.driveLetter);
  }
});

// ==========================================
// 3. ARBITRARY WAVEFORM STUDIO
// ==========================================
const desCanvas = document.getElementById('designerCanvas');
const desCtx = desCanvas.getContext('2d');

function initWavePreset(preset) {
  activeWavePreset = preset;
  customPoints = [];
  const n = wavePoints;

  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let y = 0.5;

    if (preset === 'sine') {
      y = 0.5 - Math.sin(t) * 0.45;
    } else if (preset === 'halfsine') {
      y = 0.9 - Math.abs(Math.sin(t)) * 0.8;
    } else if (preset === 'square') {
      y = i < n / 2 ? 0.1 : 0.9;
    } else if (preset === 'sawtooth') {
      y = 0.9 - (i / n) * 0.8;
    } else if (preset === 'triangle') {
      y = i < n / 2 ? 0.9 - (i / (n / 2)) * 0.8 : 0.1 + ((i - n / 2) / (n / 2)) * 0.8;
    } else if (preset === 'ecg') {
      const ph = i / n;
      if (ph > 0.4 && ph < 0.45) y = 0.6;
      else if (ph >= 0.45 && ph < 0.52) y = 0.05;
      else if (ph >= 0.52 && ph < 0.58) y = 0.95;
      else if (ph >= 0.65 && ph < 0.8) y = 0.35;
      else y = 0.5;
    } else if (preset === 'exp') {
      y = 0.9 - Math.exp((i / n) * 3) / Math.exp(3) * 0.8;
    } else if (preset === 'noise') {
      y = 0.2 + Math.random() * 0.6;
    }
    customPoints.push(Math.round((1.0 - y) * maxMv));
  }
  drawDesigner();
}

function drawDesigner() {
  const w = desCanvas.width;
  const h = desCanvas.height;
  desCtx.fillStyle = '#060a16';
  desCtx.fillRect(0, 0, w, h);

  // Grid
  desCtx.strokeStyle = 'rgba(0, 242, 254, 0.1)';
  for (let x = 0; x < w; x += w / 8) {
    desCtx.beginPath();
    desCtx.moveTo(x, 0);
    desCtx.lineTo(x, h);
    desCtx.stroke();
  }
  for (let y = 0; y < h; y += h / 6) {
    desCtx.beginPath();
    desCtx.moveTo(0, y);
    desCtx.lineTo(w, y);
    desCtx.stroke();
  }

  // Draw Wave
  if (customPoints.length > 0) {
    desCtx.strokeStyle = '#00f2fe';
    desCtx.lineWidth = 3;
    desCtx.shadowColor = '#00f2fe';
    desCtx.shadowBlur = 10;
    desCtx.beginPath();

    const stepX = w / (customPoints.length - 1);
    for (let i = 0; i < customPoints.length; i++) {
      const valNorm = customPoints[i] / maxMv;
      const x = i * stepX;
      const y = h - (valNorm * (h - 40) + 20);

      if (i === 0) desCtx.moveTo(x, y);
      else desCtx.lineTo(x, y);
    }
    desCtx.stroke();
    desCtx.shadowBlur = 0;

    // Draw dots
    desCtx.fillStyle = '#38bdf8';
    for (let i = 0; i < customPoints.length; i++) {
      const valNorm = customPoints[i] / maxMv;
      const x = i * stepX;
      const y = h - (valNorm * (h - 40) + 20);
      desCtx.beginPath();
      desCtx.arc(x, y, 3, 0, Math.PI * 2);
      desCtx.fill();
    }
  }
}

// Preset clicks
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    initWavePreset(btn.dataset.preset);
  });
});

document.getElementById('rngWavePoints').addEventListener('input', (e) => {
  wavePoints = parseInt(e.target.value);
  document.getElementById('lblWavePoints').innerText = `${wavePoints} Punkte`;
  document.getElementById('lblPointsCount').innerText = `${wavePoints} Punkte`;
  initWavePreset(activeWavePreset);
});

document.getElementById('rngWaveMv').addEventListener('input', (e) => {
  maxMv = parseInt(e.target.value);
  document.getElementById('lblWaveMv').innerText = `${maxMv} mV`;
  document.getElementById('lblMaxAmplitude').innerText = `${maxMv} mV`;
  initWavePreset(activeWavePreset);
});

// Interactive drawing
desCanvas.addEventListener('mousedown', (e) => {
  isDrawingWave = true;
  handleCanvasDraw(e);
});
window.addEventListener('mouseup', () => isDrawingWave = false);
desCanvas.addEventListener('mousemove', (e) => {
  if (isDrawingWave) handleCanvasDraw(e);
});

function handleCanvasDraw(e) {
  const rect = desCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const idx = Math.min(customPoints.length - 1, Math.max(0, Math.round((mouseX / rect.width) * (customPoints.length - 1))));
  const normY = 1.0 - Math.min(1.0, Math.max(0, mouseY / rect.height));
  customPoints[idx] = Math.round(normY * maxMv);
  drawDesigner();
}

initWavePreset('sine');

// Export CSV Waveform to 2C23T
document.getElementById('btnExportWaveform').addEventListener('click', async () => {
  const name = document.getElementById('txtWaveName').value.trim() || 'WAVE1';
  try {
    const res = await window.api.saveWaveformCsv(name, customPoints);
    showToast(`Wellenform ${res.name} erfolgreich auf 2C23T gespeichert!`);
  } catch (err) {
    alert(err.message || 'Fehler beim Speichern');
  }
});

// ==========================================
// 4. FIRMWARE & FLASH MANAGER
// ==========================================
const flashModal = document.getElementById('flashModal');
const flashProgressFill = document.getElementById('flashProgressFill');
const flashProgressPercent = document.getElementById('flashProgressPercent');
const flashProgressBytes = document.getElementById('flashProgressBytes');

window.api.onFlashProgress(({ percent, written, total }) => {
  flashProgressFill.style.width = `${percent}%`;
  flashProgressPercent.innerText = `${percent}%`;
  flashProgressBytes.innerText = `${Math.round(written/1024)} / ${Math.round(total/1024)} KB`;
});

document.querySelectorAll('.btn-flash').forEach(btn => {
  btn.addEventListener('click', async () => {
    const fwKey = btn.dataset.fw;

    if (!currentDeviceStatus || !currentDeviceStatus.connected || currentDeviceStatus.mode !== 'BOOTLOADER') {
      alert(
        "WICHTIG:\n\n" +
        "Der FNIRSI 2C23T muss sich im BootLoader-Modus befinden!\n\n" +
        "1. Schalte das Gerät aus.\n" +
        "2. Halte die Taste MENU gedrückt und drücke kurz Power.\n" +
        "3. Im Display erscheint 'BootLoader'.\n" +
        "4. Klicke dann erneut auf Flashen."
      );
      return;
    }

    if (!confirm(`Möchtest du die Firmware (${fwKey.toUpperCase()}) jetzt auf das Gerät flashen?`)) {
      return;
    }

    flashModal.style.display = 'flex';
    flashProgressFill.style.width = '0%';
    flashProgressPercent.innerText = '0%';

    try {
      const res = await window.api.flashFirmware(fwKey);
      flashModal.style.display = 'none';
      alert(`Erfolg!\n\nFirmware ${res.fileName} wurde vollständig übertragen.\nDas Gerät startet jetzt automatisch neu!`);
    } catch (err) {
      flashModal.style.display = 'none';
      alert(`Fehler beim Flashen: ${err.message}`);
    }
  });
});

// ==========================================
// 5. BACKUP MANAGER
// ==========================================
document.getElementById('btnCreateBackup').addEventListener('click', async () => {
  try {
    showToast('Erstelle Komplett-Backup...');
    const res = await window.api.backupDevice();
    alert(`Backup erfolgreich erstellt!\n\n${res.fileCount} Dateien gesichert in:\n${res.targetFolder}`);
  } catch (err) {
    alert(err.message || 'Fehler beim Erstellen des Backups');
  }
});

document.getElementById('btnOpenBackupFolder').addEventListener('click', () => {
  window.api.openInExplorer('C:\\Users\\dadde\\Downloads\\2C23T_Backups');
});
