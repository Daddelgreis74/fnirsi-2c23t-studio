const fs = require('fs');
const path = require('path');

const RAM_BASE = 0x20000000;
const RAM_END = 0x20036078;
const MIN_SIZE = 8192;
const HARD_MAX_READ_SIZE = 2 * 1024 * 1024;

const TARGETS = {
  'HW4.0': {
    appBase: 0x08007000,
    maxSize: 0x00079000, // 495616 bytes
    appEnd: 0x08080000,
    resetWindowEnd: 0x08008000
  },
  '<HW4.0': {
    appBase: 0x08008000,
    maxSize: 0x00038000, // 229376 bytes
    appEnd: 0x08040000,
    resetWindowEnd: 0x08009000
  }
};

function normalizeHwRev(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/<\s*hw\s*4|<=\s*v0\.3|ag1klp|lt-hw4/i.test(s)) return '<HW4.0';
  if (/\b(?:hw\s*4\.?0|v0\.4|gw1n)\b/i.test(s)) return 'HW4.0';
  return null;
}

function detectFilenameHw(filename) {
  const base = path.basename(String(filename || ''));
  if (!base) return null;
  if (/hw\s*4\.?0|08007000/i.test(base)) return 'HW4.0';
  if (/08008000|lt-hw4/i.test(base)) return '<HW4.0';
  return null;
}

function inspectVectorTable(buffer) {
  if (!buffer || buffer.length < 8) {
    return {
      valid: false,
      sp: 0,
      resetRaw: 0,
      resetPc: 0,
      spValid: false,
      thumbBit: false,
      vectorHw: null
    };
  }
  const sp = buffer.readUInt32LE(0);
  const resetRaw = buffer.readUInt32LE(4);
  const spValid = sp >= RAM_BASE && sp <= RAM_END;
  const thumbBit = (resetRaw & 1) === 1;
  const resetPc = (resetRaw & ~1) >>> 0;

  let vectorHw = null;
  if (resetPc >= TARGETS['HW4.0'].appBase && resetPc < TARGETS['HW4.0'].resetWindowEnd) {
    vectorHw = 'HW4.0';
  } else if (resetPc >= TARGETS['<HW4.0'].appBase && resetPc < TARGETS['<HW4.0'].resetWindowEnd) {
    vectorHw = '<HW4.0';
  }

  const inAnyAppSlot = resetPc >= TARGETS['HW4.0'].appBase && resetPc < TARGETS['HW4.0'].appEnd;
  return {
    valid: spValid && thumbBit && inAnyAppSlot,
    sp,
    resetRaw,
    resetPc,
    spValid,
    thumbBit,
    vectorHw
  };
}

function failResult(reason, fields = {}) {
  return {
    ok: false,
    reason,
    warning: null,
    filename: fields.filename || '',
    size: fields.size ?? 0,
    deviceHw: fields.deviceHw ?? null,
    binaryHw: fields.binaryHw ?? null,
    maxSize: fields.maxSize ?? null,
    ...fields
  };
}

function validateFirmwareImage({ filename, buffer, targetHw } = {}) {
  const baseName = path.basename(String(filename || ''));
  const size = buffer ? buffer.length : 0;
  const deviceHw = normalizeHwRev(targetHw);

  if (!baseName || /^boot_/i.test(baseName) || !/f2c23t/i.test(baseName) || !/\.bin$/i.test(baseName)) {
    return failResult('bad_filename', { filename: baseName, size, deviceHw });
  }

  if (size < MIN_SIZE) {
    return failResult('too_small', { filename: baseName, size, deviceHw });
  }

  const vector = inspectVectorTable(buffer);
  if (!vector.valid) {
    return failResult('bad_vector', { filename: baseName, size, deviceHw, vector });
  }

  const filenameHw = detectFilenameHw(baseName);
  const vectorHw = vector.vectorHw;
  if (filenameHw && vectorHw && filenameHw !== vectorHw) {
    return failResult('file_hw_conflict', {
      filename: baseName,
      size,
      deviceHw,
      filenameHw,
      binaryHw: vectorHw,
      vector
    });
  }

  const binaryHw = vectorHw || filenameHw || null;
  if (deviceHw && binaryHw && deviceHw !== binaryHw) {
    return failResult('hw_mismatch', {
      filename: baseName,
      size,
      deviceHw,
      binaryHw,
      maxSize: TARGETS[deviceHw].maxSize,
      vector
    });
  }

  if (deviceHw) {
    const t = TARGETS[deviceHw];
    if (vector.resetPc < t.appBase || vector.resetPc >= t.appEnd) {
      return failResult('hw_mismatch', {
        filename: baseName,
        size,
        deviceHw,
        binaryHw: binaryHw || vectorHw,
        maxSize: t.maxSize,
        vector
      });
    }
  }

  const slotHw = deviceHw || binaryHw || 'HW4.0';
  const maxSize = TARGETS[slotHw].maxSize;
  if (size > maxSize) {
    return failResult('too_large', {
      filename: baseName,
      size,
      deviceHw,
      binaryHw,
      maxSize,
      vector
    });
  }

  const warning = !deviceHw ? 'hw_unverified' : (!binaryHw ? 'binary_hw_unknown' : null);
  return {
    ok: true,
    reason: null,
    warning,
    filename: baseName,
    size,
    deviceHw,
    binaryHw,
    maxSize,
    vector
  };
}

function validateFirmwareFile(filePath, targetHw) {
  const baseName = path.basename(String(filePath || ''));
  const deviceHw = normalizeHwRev(targetHw);

  let stat;
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return failResult('file_missing', { filename: baseName, deviceHw });
    }
    stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return failResult('file_missing', { filename: baseName, deviceHw });
    }
  } catch (e) {
    return failResult('file_missing', { filename: baseName, deviceHw });
  }

  if (stat.size > HARD_MAX_READ_SIZE) {
    return failResult('too_large', {
      filename: baseName,
      size: stat.size,
      deviceHw,
      binaryHw: detectFilenameHw(baseName),
      maxSize: TARGETS[deviceHw || 'HW4.0'].maxSize
    });
  }

  const buffer = fs.readFileSync(filePath);
  return {
    ...validateFirmwareImage({ filename: baseName, buffer, targetHw }),
    filePath
  };
}

async function writeFirmwareFlushed(targetPath, buffer) {
  const fh = await fs.promises.open(targetPath, 'w');
  try {
    await fh.writeFile(buffer);
    await fh.sync();
  } finally {
    await fh.close();
  }
}

module.exports = {
  RAM_BASE,
  RAM_END,
  MIN_SIZE,
  HARD_MAX_READ_SIZE,
  TARGETS,
  normalizeHwRev,
  detectFilenameHw,
  inspectVectorTable,
  validateFirmwareImage,
  validateFirmwareFile,
  writeFirmwareFlushed
};
