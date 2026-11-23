const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVerLine, parseUpdLine } = require('../src/renderer/cdc_meta');

test('parseVerLine extracts firmware version and hardware revision', () => {
  assert.deepEqual(parseVerLine('$VER,v2026.11.7,HW4.0'), {
    version: 'v2026.11.7',
    hw: 'HW4.0'
  });
  assert.deepEqual(parseVerLine('  $VER,v2026.11.7,<HW4.0\r\n'), {
    version: 'v2026.11.7',
    hw: '<HW4.0'
  });
});

test('parseVerLine rejects malformed or unrelated lines', () => {
  assert.equal(parseVerLine('$VER,v2026.11.7'), null);
  assert.equal(parseVerLine('$VER,,HW4.0'), null);
  assert.equal(parseVerLine('$DMM,DCV,0.000,V,OK'), null);
  assert.equal(parseVerLine(''), null);
});

test('parseUpdLine parses staging and error states cleanly', () => {
  assert.deepEqual(parseUpdLine('$UPD,1,0,131072,268302'), {
    state: 1,
    stateName: 'staging',
    error: 0,
    bytes: 131072,
    expected: 268302
  });
  assert.deepEqual(parseUpdLine('$UPD,3,2,196608,268302'), {
    state: 3,
    stateName: 'error',
    error: 2,
    bytes: 196608,
    expected: 268302
  });
});

test('parseUpdLine rejects invalid or non-update lines', () => {
  assert.equal(parseUpdLine('$UPD,1,0,100'), null);
  assert.equal(parseUpdLine('$UPD,-1,0,0,0'), null);
  assert.equal(parseUpdLine('$GEN,0,1000,0,33'), null);
});
