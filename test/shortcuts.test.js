const test = require('node:test');
const assert = require('node:assert');
const { actionForKey, normalizeTheme } = require('../src/renderer/shortcuts.js');

const k = (key, extra = {}) => actionForKey({ key, tab: 'scope', typing: false, ctrl: false, alt: false, meta: false, ...extra });

test('number keys switch instrument', () => {
  assert.strictEqual(k('1'), 'tab-dmm');
  assert.strictEqual(k('2'), 'tab-scope');
  assert.strictEqual(k('3'), 'tab-generator');
});

test('space runs/stops the scope and holds the multimeter', () => {
  assert.strictEqual(k(' ', { tab: 'scope' }), 'scope-run');
  assert.strictEqual(k(' ', { tab: 'dmm' }), 'dmm-hold');
  assert.strictEqual(k(' ', { tab: 'generator' }), null);
});

test('letter shortcuts are tab specific and case insensitive', () => {
  assert.strictEqual(k('a', { tab: 'scope' }), 'scope-auto');
  assert.strictEqual(k('A', { tab: 'scope' }), 'scope-auto');
  assert.strictEqual(k('a', { tab: 'dmm' }), null);
  assert.strictEqual(k('c', { tab: 'scope' }), 'scope-cursors');
  assert.strictEqual(k('h', { tab: 'dmm' }), 'dmm-hold');
  assert.strictEqual(k('r', { tab: 'dmm' }), 'dmm-rel');
});

test('global shortcuts work on every tab', () => {
  assert.strictEqual(k('t', { tab: 'gallery' }), 'theme');
  assert.strictEqual(k('?', { tab: 'dmm' }), 'help');
});

test('nothing fires while typing or with a modifier', () => {
  assert.strictEqual(k('1', { typing: true }), null);
  assert.strictEqual(k(' ', { typing: true }), null);
  assert.strictEqual(k('a', { ctrl: true }), null);
  assert.strictEqual(k('t', { meta: true }), null);
  assert.strictEqual(k('1', { alt: true }), null);
});

test('normalizeTheme only accepts known themes', () => {
  assert.strictEqual(normalizeTheme('light'), 'light');
  assert.strictEqual(normalizeTheme('dark'), 'dark');
  assert.strictEqual(normalizeTheme('blue'), 'dark');
  assert.strictEqual(normalizeTheme(null), 'dark');
});
