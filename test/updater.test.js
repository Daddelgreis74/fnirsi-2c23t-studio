const test = require('node:test');
const assert = require('node:assert/strict');
const { compareSemver, pickAsset } = require('../src/updater');

test('compareSemver compares major, minor, patch versions', () => {
  assert.equal(compareSemver('v1.2.0', '1.1.0'), 1);
  assert.equal(compareSemver('1.1.1', 'v1.1.0'), 1);
  assert.equal(compareSemver('1.1.0', '1.1.0'), 0);
  assert.equal(compareSemver('1.0.9', '1.1.0'), -1);
  assert.equal(compareSemver('v2.0.0', '1.99.99'), 1);
});

test('pickAsset selects Portable or Setup exe appropriately', () => {
  const assets = [
    { name: 'FNIRSI-2C23T-Studio-Portable-1.2.0.exe', browser_download_url: 'https://example.com/portable.exe' },
    { name: 'FNIRSI.2C23T.Studio.Setup.1.2.0.exe', browser_download_url: 'https://example.com/setup.exe' }
  ];
  assert.equal(pickAsset(assets, true).name, 'FNIRSI-2C23T-Studio-Portable-1.2.0.exe');
  assert.equal(pickAsset(assets, false).name, 'FNIRSI.2C23T.Studio.Setup.1.2.0.exe');
  assert.equal(pickAsset([], false), null);
});
