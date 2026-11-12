const test = require('node:test');
const assert = require('node:assert');
const { parseNumber, inBand, signedValue } = require('../src/renderer/dmm_alert.js');

test('parseNumber accepts dot or comma decimals and rejects junk', () => {
  assert.strictEqual(parseNumber('3.3'), 3.3);
  assert.strictEqual(parseNumber(' 3,3 '), 3.3);
  assert.strictEqual(parseNumber('-12'), -12);
  assert.strictEqual(parseNumber(''), null);
  assert.strictEqual(parseNumber('abc'), null);
  assert.strictEqual(parseNumber('3.3V'), null);
});

test('inBand is true while the value stays within target +/- tolerance (edges included)', () => {
  assert.strictEqual(inBand(3.3, 3.3, 0.1), true);
  assert.strictEqual(inBand(3.2, 3.3, 0.1), true);
  assert.strictEqual(inBand(3.4, 3.3, 0.1), true);
  assert.strictEqual(inBand(3.41, 3.3, 0.1), false);
  assert.strictEqual(inBand(3.19, 3.3, 0.1), false);
});

test('inBand is false when target or tolerance is missing or invalid', () => {
  assert.strictEqual(inBand(3.3, null, 0.1), false);
  assert.strictEqual(inBand(3.3, 3.3, null), false);
  assert.strictEqual(inBand(3.3, 3.3, -1), false);
  assert.strictEqual(inBand(NaN, 3.3, 0.1), false);
});

test('inBand with a zero tolerance only matches the exact value', () => {
  assert.strictEqual(inBand(5, 5, 0), true);
  assert.strictEqual(inBand(5.001, 5, 0), false);
});

test('signedValue restores the sign stripped from the displayed number', () => {
  assert.strictEqual(signedValue('-', 4.5), -4.5);
  assert.strictEqual(signedValue('', 4.5), 4.5);
});
