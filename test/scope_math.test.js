const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/renderer/scope_math.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} !~ ${b}`);

// 180 raw samples over 10 divisions, like the firmware stream
function wave(fn, tbNs, n = 180) {
  return Uint8Array.from({ length: n }, (_, i) => Math.round(fn((i / (n - 1)) * 10 * tbNs * 1e-9)));
}

test('parseVdivMv understands the firmware chip labels', () => {
  assert.strictEqual(M.parseVdivMv('20M'), 20);
  assert.strictEqual(M.parseVdivMv('500M'), 500);
  assert.strictEqual(M.parseVdivMv('1V'), 1000);
  assert.strictEqual(M.parseVdivMv('100V'), 100000);
  assert.strictEqual(M.parseVdivMv('500mV'), 500);
  assert.strictEqual(M.parseVdivMv('?'), null);
});

test('parseTimebaseNs understands the firmware chip labels', () => {
  assert.strictEqual(M.parseTimebaseNs('50N'), 50);
  assert.strictEqual(M.parseTimebaseNs('1U'), 1000);
  assert.strictEqual(M.parseTimebaseNs('1M'), 1e6);
  assert.strictEqual(M.parseTimebaseNs('5S'), 5e9);
  assert.strictEqual(M.parseTimebaseNs('500US'), 5e5);
  assert.strictEqual(M.parseTimebaseNs('10MS'), 1e7);
  assert.strictEqual(M.parseTimebaseNs('x'), null);
});

test('rawToMv follows the device scaling (8 divisions over 255 counts)', () => {
  assert.strictEqual(M.rawToMv(128, 1000), 0);
  near(M.rawToMv(255, 1000), 127 * 8 * 1000 / 255, 0.01);
  near(M.rawToMv(0, 500), -128 * 8 * 500 / 255, 0.01);
});

test('measureWave on a 500 Hz sine', () => {
  const s = wave((t) => 128 + 64 * Math.sin(2 * Math.PI * 500 * t), 1e6);
  const m = M.measureWave(s, 1000, 1e6);
  near(m.vpp, 2 * 64 * 8 * 1000 / 255, 80, 'vpp');
  near(m.vmean, 0, 40, 'mean');
  near(m.vrms, (64 * 8 * 1000 / 255) / Math.SQRT2, 40, 'rms');
  near(m.freqHz, 500, 10, 'freq');
  near(m.dutyPct, 50, 5, 'duty');
});

test('measureWave on a 25% duty square wave with a DC offset', () => {
  const s = wave((t) => ((t * 1000) % 1 < 0.25 ? 160 : 96), 1e6);
  const m = M.measureWave(s, 500, 1e6);
  near(m.freqHz, 1000, 20, 'freq');
  near(m.dutyPct, 25, 4, 'duty');
  near(m.vmax, (160 - 128) * 8 * 500 / 255, 0.01, 'vmax');
  near(m.vmin, (96 - 128) * 8 * 500 / 255, 0.01, 'vmin');
});

test('measureWave rise time of a linear ramp edge', () => {
  // 0 -> 100% over 10 samples, repeated
  const s = Uint8Array.from({ length: 180 }, (_, i) => 96 + Math.min(64, (i % 40) * 6.4));
  const m = M.measureWave(s, 1000, 1e6);
  const samplePeriodNs = 1e6 * 10 / 179;
  near(m.riseNs, 0.8 * 10 * samplePeriodNs, samplePeriodNs * 1.5, 'rise');
});

test('measureWave on a flat line gives no frequency', () => {
  const m = M.measureWave(new Uint8Array(180).fill(128), 1000, 1e6);
  assert.strictEqual(m.freqHz, null);
  assert.strictEqual(m.dutyPct, null);
  assert.strictEqual(m.riseNs, null);
  assert.strictEqual(m.vpp, 0);
});

test('measureWave ignores noise: a flat line with +/-1 count jitter has no frequency, duty or rise time', () => {
  const s = Uint8Array.from({ length: 180 }, (_, i) => 128 + (i % 2 ? 1 : -1));
  const m = M.measureWave(s, 200, 1e6);
  assert.strictEqual(m.freqHz, null);
  assert.strictEqual(m.dutyPct, null);
  assert.strictEqual(m.riseNs, null);
});

test('measureWave is not fooled by noise riding on a square wave', () => {
  const s = wave((t) => (((t * 1000) % 1 < 0.5 ? 176 : 80) + ((Math.round(t * 1e7) % 3) - 1)), 1e6);
  const m = M.measureWave(s, 500, 1e6);
  near(m.freqHz, 1000, 20, 'freq');
  near(m.dutyPct, 50, 5, 'duty');
});

test('measureWave rejects unusable input', () => {
  assert.strictEqual(M.measureWave(null, 1000, 1e6), null);
  assert.strictEqual(M.measureWave(new Uint8Array(1), 1000, 1e6), null);
  assert.strictEqual(M.measureWave(new Uint8Array(180), null, 1e6), null);
});

test('cursorReadout converts division positions into time and voltage', () => {
  const r = M.cursorReadout({ x1: 2, x2: 7, y1: 1, y2: -1.5 }, 500, 1e6);
  assert.strictEqual(r.dtNs, 5e6);
  assert.strictEqual(r.freqHz, 200);
  assert.strictEqual(r.v1Mv, 500);
  assert.strictEqual(r.v2Mv, -750);
  assert.strictEqual(r.dvMv, 1250);
});

test('cursorReadout without a time span has no frequency', () => {
  assert.strictEqual(M.cursorReadout({ x1: 3, x2: 3, y1: 0, y2: 0 }, 500, 1e6).freqHz, null);
});

test('formatters pick a readable unit', () => {
  assert.strictEqual(M.formatVoltage(1234), '1.23 V');
  assert.strictEqual(M.formatVoltage(-456), '-456 mV');
  assert.strictEqual(M.formatTime(2.5e6), '2.50 ms');
  assert.strictEqual(M.formatTime(800), '800 ns');
  assert.strictEqual(M.formatTime(3e9), '3.00 s');
  assert.strictEqual(M.formatTime(12e3), '12.0 µs');
  assert.strictEqual(M.formatFreq(1500), '1.50 kHz');
  assert.strictEqual(M.formatFreq(25), '25.0 Hz');
  assert.strictEqual(M.formatFreq(2.5e6), '2.500 MHz');
  assert.strictEqual(M.formatFreq(null), '--');
});
