const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '../src');
const LANGS = ['de', 'fr', 'en'];
const locales = Object.fromEntries(LANGS.map((l) => [l, require(`../src/i18n/locales/${l}.js`)]));
const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every language defines exactly the same keys', () => {
  const ref = Object.keys(locales.de).sort();
  for (const l of LANGS) assert.deepStrictEqual(Object.keys(locales[l]).sort(), ref, l);
});

test('no empty translation and identical {params} in every language', () => {
  for (const key of Object.keys(locales.de)) {
    for (const l of LANGS) {
      assert.ok(locales[l][key].trim(), `${l}:${key} is empty`);
      assert.strictEqual(params(locales[l][key]), params(locales.de[key]), `${l}:${key} params`);
    }
  }
});

test('every key used in the HTML and in the code exists', () => {
  const html = fs.readFileSync(path.join(SRC, 'renderer/index.html'), 'utf8');
  const code = ['renderer/app.js', 'main.js', 'serial_manager.js', 'device_manager.js']
    .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  const used = [
    ...[...html.matchAll(/data-i18n(?:-\w+)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...code.matchAll(/\bt\(\s*'([\w.]+)'/g)].map((m) => m[1])
  ];
  assert.ok(used.length > 50, 'expected many translated strings');
  for (const key of used) assert.ok(key in locales.de, `missing key ${key}`);
});

test('every key is used somewhere (no dead translation)', () => {
  const files = ['renderer/index.html', 'renderer/app.js', 'main.js', 'serial_manager.js', 'device_manager.js'];
  const all = files.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  for (const key of Object.keys(locales.de)) assert.ok(all.includes(`'${key}'`) || all.includes(`"${key}"`), `unused key ${key}`);
});
