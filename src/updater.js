const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const GITHUB_API_URL = 'https://api.github.com/repos/Daddelgreis74/fnirsi-2c23t-studio/releases/latest';

function parseSemver(v) {
  const clean = String(v || '').replace(/^v/i, '').split('-')[0];
  return clean.split('.').map((n) => parseInt(n, 10) || 0);
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function pickAsset(assets, isPortable) {
  if (!Array.isArray(assets)) return null;
  const exes = assets.filter((a) => a && typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe'));
  if (isPortable) {
    return exes.find((a) => a.name.toLowerCase().includes('portable')) || exes[0] || null;
  }
  return exes.find((a) => a.name.toLowerCase().includes('setup')) || exes[0] || null;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'fnirsi-2c23t-studio-updater',
          Accept: 'application/vnd.github+json'
        },
        timeout: 10000
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(fetchJson(res.headers.location));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { 'User-Agent': 'fnirsi-2c23t-studio-updater' },
        timeout: 30000
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(downloadFile(res.headers.location, destPath, onProgress));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && total > 0) {
            onProgress(Math.min(100, Math.round((downloaded / total) * 100)));
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(destPath));
        });
        file.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download Timeout'));
    });
  });
}

async function checkForUpdates(currentVersion) {
  const release = await fetchJson(GITHUB_API_URL);
  const latestTag = release.tag_name || '';
  const isNewer = compareSemver(latestTag, currentVersion) > 0;
  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  const asset = pickAsset(release.assets, isPortable);
  return {
    available: isNewer && Boolean(asset),
    currentVersion,
    latestVersion: latestTag.replace(/^v/i, ''),
    releaseUrl: release.html_url || '',
    isPortable,
    asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null
  };
}

async function downloadAndInstall(asset, onProgress, app) {
  if (!asset || !asset.url || !asset.name) {
    throw new Error('Missing update asset');
  }
  const safeName = path.basename(asset.name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = path.join(os.tmpdir(), safeName);
  await downloadFile(asset.url, destPath, onProgress);

  const portableTarget = process.env.PORTABLE_EXECUTABLE_FILE;
  if (portableTarget) {
    // Replace portable .exe after current process exits, then relaunch
    const pid = process.pid;
    const psCmd = `
      while (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 300 }
      Copy-Item -LiteralPath '${destPath.replace(/'/g, "''")}' -Destination '${portableTarget.replace(/'/g, "''")}' -Force
      Remove-Item -LiteralPath '${destPath.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue
      Start-Process -FilePath '${portableTarget.replace(/'/g, "''")}'
    `;
    const child = spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', psCmd], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } else {
    // Run NSIS installer in-place
    const child = spawn(destPath, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  }

  setTimeout(() => {
    app.quit();
  }, 400);

  return { success: true };
}

module.exports = {
  compareSemver,
  pickAsset,
  checkForUpdates,
  downloadAndInstall
};
