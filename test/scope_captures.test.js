const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/renderer/scope_captures.js');

const cap = (extra = {}) => ({
  tb: '1M', v1: '1V', v2: '500M', ch1En: true, ch2En: true,
  wave1: Uint8Array.from([128, 160, 96]), wave2: Uint8Array.from([128, 128, 128]), takenAt: new Date(2026, 10, 12, 16, 5, 9), ...extra
});

test('the store keeps the newest captures and drops the oldest beyond its limit', () => {
  const store = C.createStore(3);
  for (let i = 0; i < 5; i++) store.add(cap({ tb: `${i}M` }));
  assert.strictEqual(store.list().length, 3);
  assert.deepStrictEqual(store.list().map((c) => c.tb), ['2M', '3M', '4M']);
});

test('captures get increasing ids and can be fetched and removed', () => {
  const store = C.createStore(5);
  const a = store.add(cap());
  const b = store.add(cap());
  assert.ok(b.id > a.id);
  assert.strictEqual(store.get(a.id).id, a.id);
  store.remove(a.id);
  assert.strictEqual(store.get(a.id), undefined);
  assert.strictEqual(store.list().length, 1);
  store.clear();
  assert.strictEqual(store.list().length, 0);
});

test('the store keeps its own copy of the waveforms', () => {
  const store = C.createStore(2);
  const w = Uint8Array.from([1, 2, 3]);
  const c = store.add(cap({ wave1: w }));
  w[0] = 99;
  assert.strictEqual(c.wave1[0], 1);
});

test('a capture needs at least one enabled channel with data', () => {
  assert.strictEqual(C.isCapturable({ ch1En: false, ch2En: false, wave1: null, wave2: null }), false);
  assert.strictEqual(C.isCapturable({ ch1En: true, ch2En: false, wave1: new Uint8Array(180), wave2: null }), true);
  assert.strictEqual(C.isCapturable({ ch1En: true, ch2En: false, wave1: null, wave2: new Uint8Array(180) }), false);
});

test('captureLabel summarises time, timebase and scales', () => {
  assert.strictEqual(C.captureLabel({ id: 4, ...cap() }), '#4 · 16:05:09 · 1M · CH1 1V · CH2 500M');
  assert.strictEqual(C.captureLabel({ id: 1, ...cap({ ch2En: false }) }), '#1 · 16:05:09 · 1M · CH1 1V');
});

test('captureToCsv writes time and millivolts per enabled channel', () => {
  const csv = C.captureToCsv(cap({ ch2En: false, wave1: Uint8Array.from([128, 255]), wave2: null }));
  const rows = csv.trim().split('\r\n');
  assert.strictEqual(rows[0], 'Zeit_ns;CH1_mV');
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[1], '0;0');
  // 2 samples over the screen's 12 divisions of 1 ms: second sample at 12 ms,
  // 127 counts * 754 * 1000 / 20000 mV
  assert.strictEqual(rows[2], `12000000;${String((127 * 754 * 1000 / 20000).toFixed(1)).replace('.', ',')}`);
});
