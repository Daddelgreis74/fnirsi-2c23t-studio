const test = require('node:test');
const assert = require('node:assert/strict');
const deviceManager = require('../src/device_manager');

test('classifyDrive detects empty OpenScope drive by USB disk descriptor', () => {
  const drive = {
    DeviceID: 'F:',
    VolumeName: '',
    FileSystem: 'FAT',
    FreeSpace: 8347648,
    Size: 8359936,
    UsbModel: 'F2C23T W25Q RAW FLASH USB Device'
  };
  const result = deviceManager.classifyDrive(drive, ['System Volume Information']);
  assert.equal(result.connected, true);
  assert.equal(result.mode, 'OPENSCOPE');
  assert.equal(result.driveLetter, 'F:\\');
  assert.equal(result.firmwareVersion, 'OpenScope 2C23T');
});

test('classifyDrive detects Bootloader drive via Ready.TXT', () => {
  const drive = { DeviceID: 'F:', VolumeName: '', FreeSpace: 1000, Size: 2000 };
  const result = deviceManager.classifyDrive(drive, ['Ready.TXT']);
  assert.equal(result.connected, true);
  assert.equal(result.mode, 'BOOTLOADER');
  assert.equal(result.firmwareVersion, 'IAP Bootloader');
});

test('classifyDrive parses OpenScope boot_hw4.txt firmware and CRC32', () => {
  const drive = { DeviceID: 'G:', VolumeName: '2C23T', FreeSpace: 5000, Size: 8000 };
  const result = deviceManager.classifyDrive(
    drive,
    ['boot_hw4.txt'],
    () => 'Firmware: v2026.11.7\r\nCRC32: 0xABCDEF01\r\n'
  );
  assert.equal(result.connected, true);
  assert.equal(result.mode, 'OPENSCOPE');
  assert.equal(result.firmwareVersion, 'OpenScope v2026.11.7');
  assert.equal(result.bootloaderCrc, '0xABCDEF01');
});

test('classifyDrive ignores ordinary non-F2C23T drives', () => {
  const drive = {
    DeviceID: 'C:',
    VolumeName: 'Windows',
    UsbModel: null
  };
  const result = deviceManager.classifyDrive(drive, ['Users', 'Windows']);
  assert.equal(result, null);
});
