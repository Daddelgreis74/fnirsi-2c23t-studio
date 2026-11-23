const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const fw = require('../src/fw_flasher');

function makeImage({ size = 16384, sp = 0x20036078, reset = 0x08007201 } = {}) {
  const buf = Buffer.alloc(size, 0xff);
  if (size >= 8) {
    buf.writeUInt32LE(sp >>> 0, 0);
    buf.writeUInt32LE(reset >>> 0, 4);
  }
  return buf;
}

test('normalizeHwRev maps $VER strings and USB strings cleanly', () => {
  assert.strictEqual(fw.normalizeHwRev('HW4.0'), 'HW4.0');
  assert.strictEqual(fw.normalizeHwRev('HW: V0.4 (Gowin GW1N-UV2 FPGA)'), 'HW4.0');
  assert.strictEqual(fw.normalizeHwRev('<HW4.0'), '<HW4.0');
  assert.strictEqual(fw.normalizeHwRev('HW: <= V0.3 (AGM AG1KLP FPGA)'), '<HW4.0');
  assert.strictEqual(fw.normalizeHwRev('lt-hw4'), '<HW4.0');
  assert.strictEqual(fw.normalizeHwRev('BootLoader Mode (ready to flash)'), null);
  assert.strictEqual(fw.normalizeHwRev('HW: F2C23T (USB)'), null);
  assert.strictEqual(fw.normalizeHwRev(null), null);
});

test('validates genuine HW4.0 firmware for HW4.0 device', () => {
  const res = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ size: 270000, reset: 0x08007201 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.warning, null);
  assert.strictEqual(res.binaryHw, 'HW4.0');
  assert.strictEqual(res.deviceHw, 'HW4.0');
  assert.strictEqual(res.maxSize, 495616);
});

test('validates genuine <HW4.0 firmware for <HW4.0 device', () => {
  const res = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-08008000.bin',
    buffer: makeImage({ size: 201000, reset: 0x08008201 }),
    targetHw: '<HW4.0'
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.warning, null);
  assert.strictEqual(res.binaryHw, '<HW4.0');
  assert.strictEqual(res.deviceHw, '<HW4.0');
  assert.strictEqual(res.maxSize, 229376);
});

test('blocks <HW4.0 firmware on HW4.0 device (cross-HW protection)', () => {
  const res = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-08008000.bin',
    buffer: makeImage({ size: 201000, reset: 0x08008201 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'hw_mismatch');
  assert.strictEqual(res.binaryHw, '<HW4.0');
  assert.strictEqual(res.deviceHw, 'HW4.0');
});

test('blocks HW4.0 firmware on <HW4.0 device (cross-HW protection)', () => {
  const res = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ size: 200000, reset: 0x08007201 }),
    targetHw: '<HW4.0'
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'hw_mismatch');
  assert.strictEqual(res.binaryHw, 'HW4.0');
  assert.strictEqual(res.deviceHw, '<HW4.0');
});

test('blocks misnamed binary when vector table disagrees with filename', () => {
  const res = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ size: 200000, reset: 0x08008201 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'file_hw_conflict');
});

test('rejects boot_*.bin and non-F2C23T filenames', () => {
  for (const name of ['boot_hw4.bin', 'boot_old.bin', 'random_fw.bin', 'F2C23T-image.txt']) {
    const res = fw.validateFirmwareImage({
      filename: name,
      buffer: makeImage(),
      targetHw: 'HW4.0'
    });
    assert.strictEqual(res.ok, false, name);
    assert.strictEqual(res.reason, 'bad_filename', name);
  }
});

test('rejects images below 8 KiB minimum', () => {
  const res = fw.validateFirmwareImage({
    filename: 'F2C23T-test.bin',
    buffer: makeImage({ size: 4096 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'too_small');
});

test('enforces slot size bounds for <HW4.0 and HW4.0', () => {
  const oldTooBig = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-08008000.bin',
    buffer: makeImage({ size: 229377, reset: 0x08008201 }),
    targetHw: '<HW4.0'
  });
  assert.strictEqual(oldTooBig.ok, false);
  assert.strictEqual(oldTooBig.reason, 'too_large');

  const hw4OkAt270k = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ size: 270000, reset: 0x08007201 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(hw4OkAt270k.ok, true);

  const hw4TooBig = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ size: 495617, reset: 0x08007201 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(hw4TooBig.ok, false);
  assert.strictEqual(hw4TooBig.reason, 'too_large');
});

test('rejects invalid Cortex-M vector tables (SP out of SRAM or non-Thumb reset)', () => {
  const badSp = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ sp: 0x10000000, reset: 0x08007201 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(badSp.ok, false);
  assert.strictEqual(badSp.reason, 'bad_vector');

  const badThumb = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ sp: 0x20036078, reset: 0x08007200 }),
    targetHw: 'HW4.0'
  });
  assert.strictEqual(badThumb.ok, false);
  assert.strictEqual(badThumb.reason, 'bad_vector');
});

test('permits unknown device HW with hw_unverified warning (e.g. bootloader mode)', () => {
  const res = fw.validateFirmwareImage({
    filename: 'F2C23T-v2026.11.7-HW4.0-08007000.bin',
    buffer: makeImage({ size: 269266, reset: 0x08007201 }),
    targetHw: 'BootLoader Mode (ready to flash)'
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.warning, 'hw_unverified');
  assert.strictEqual(res.binaryHw, 'HW4.0');
});

test('validateFirmwareFile reports file_missing cleanly', () => {
  const res = fw.validateFirmwareFile(path.join(os.tmpdir(), 'nonexistent-f2c23t-12345.bin'), 'HW4.0');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'file_missing');
});

test('writeFirmwareFlushed writes complete image cleanly to disk', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c23t-flash-'));
  try {
    const dest = path.join(tmpDir, 'F2C23T-test.bin');
    const payload = makeImage({ size: 16384 + 37, reset: 0x08007201 });
    payload[100] = 0x5a;
    payload[payload.length - 1] = 0xa5;
    await fw.writeFirmwareFlushed(dest, payload);
    const written = fs.readFileSync(dest);
    assert.strictEqual(written.length, payload.length);
    assert.ok(written.equals(payload));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
