const test = require('node:test');
const assert = require('node:assert/strict');
const deviceManager = require('../src/device_manager');

const FIXE = { DeviceID: 'C:', VolumeName: 'Disque-OS', Size: 995062079488, DriveType: 3 };
const CLE = { DeviceID: 'F:', VolumeName: '', Size: 8359936, DriveType: 2 };

test('fixed drives never enter the signature', () => {
  assert.equal(deviceManager.removableSignature([FIXE]), '');
});

test('a removable drive is identified by letter, label and size', () => {
  assert.equal(deviceManager.removableSignature([FIXE, CLE]), 'F:||8359936');
});

test('the order the drives come back in does not matter', () => {
  const autre = { DeviceID: 'E:', VolumeName: 'Sauvegarde', Size: 42, DriveType: 2 };
  assert.equal(
    deviceManager.removableSignature([CLE, autre]),
    deviceManager.removableSignature([autre, CLE])
  );
});

test('unplugging the device changes the signature', () => {
  assert.notEqual(
    deviceManager.removableSignature([FIXE, CLE]),
    deviceManager.removableSignature([FIXE])
  );
});

test('swapping another stick onto the same letter changes the signature', () => {
  const autreCle = { DeviceID: 'F:', VolumeName: 'KINGSTON', Size: 16000000000, DriveType: 2 };
  assert.notEqual(
    deviceManager.removableSignature([CLE]),
    deviceManager.removableSignature([autreCle])
  );
});

test('an empty or missing list is a signature of its own, not a crash', () => {
  assert.equal(deviceManager.removableSignature([]), '');
  assert.equal(deviceManager.removableSignature(undefined), '');
  assert.equal(deviceManager.removableSignature([null, CLE]), 'F:||8359936');
});
