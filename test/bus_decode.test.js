const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/renderer/bus_decode.js');

const HI = 200;
const LO = 60;
const raw = (bits) => Uint8Array.from(bits, (b) => (b ? HI : LO));
const rep = (bit, n) => Array(n).fill(bit);
// the firmware always streams 180 samples: pad with idle level
const frame = (bits) => raw([...bits, ...rep(1, 180 - bits.length)]);

// UART 8N1 frame, LSB first, `spb` samples per bit
function uartBits(value, spb) {
  const bits = [0];
  for (let i = 0; i < 8; i++) bits.push((value >> i) & 1);
  bits.push(1);
  return bits.flatMap((b) => rep(b, spb));
}

test('digitize thresholds at mid level and rejects flat signals', () => {
  assert.deepStrictEqual(Array.from(B.digitize(raw([1, 1, 0, 0, 1])).bits), [1, 1, 0, 0, 1]);
  assert.strictEqual(B.digitize(new Uint8Array(20).fill(128)), null);
  assert.strictEqual(B.digitize(null), null);
});

test('decodeUart reads 8N1 bytes at a given baud rate', () => {
  const spb = 6;
  const wave = frame([...rep(1, 10), ...uartBits(0x41, spb), ...rep(1, 4), ...uartBits(0x5a, spb), ...rep(1, 10)]);
  const samplePeriodNs = 1e6 * 10 / 179;
  const baud = 1e9 / (spb * samplePeriodNs);
  const r = B.decodeUart(wave, { baud, tbNs: 1e6 });
  assert.deepStrictEqual(r.bytes.map((b) => b.value), [0x41, 0x5a]);
  assert.strictEqual(r.error, undefined);
});

test('decodeUart refuses signals that are too fast for the time base', () => {
  const wave = frame([...rep(1, 10), ...uartBits(0x41, 2), ...rep(1, 10)]);
  const baud = 1e9 / (2 * 1e6 * 10 / 179);
  assert.strictEqual(B.decodeUart(wave, { baud, tbNs: 1e6 }).error, 'too_fast');
});

test('decodeUart does not report a frame whose stop bit is low (framing error)', () => {
  const spb = 6;
  const bad = uartBits(0x41, spb);
  for (let i = bad.length - spb; i < bad.length; i++) bad[i] = 0;
  const wave = frame([...rep(1, 10), ...bad, ...rep(1, 10)]);
  const baud = 1e9 / (spb * 1e6 * 10 / 179);
  assert.ok(!B.decodeUart(wave, { baud, tbNs: 1e6 }).bytes.some((b) => b.value === 0x41));
});

test('estimateBaud snaps the shortest pulse to a standard rate', () => {
  const spb = 6;
  const wave = frame([...rep(1, 10), ...uartBits(0x55, spb), ...rep(1, 10)]);
  const samplePeriodNs = 1e6 * 10 / 179;
  const exact = 1e9 / (spb * samplePeriodNs);
  const std = B.STANDARD_BAUDS.reduce((a, b) => (Math.abs(b - exact) < Math.abs(a - exact) ? b : a));
  assert.strictEqual(B.estimateBaud(wave, 1e6), std);
  assert.strictEqual(B.estimateBaud(new Uint8Array(50).fill(128), 1e6), null);
});

// I2C: each step is one SCL period of 4 samples
function i2c(frames) {
  const scl = [];
  const sda = [];
  const push = (c, d, n = 2) => { scl.push(...rep(c, n)); sda.push(...rep(d, n)); };
  push(1, 1);
  for (const f of frames) {
    if (f === 'S') { push(1, 0); push(0, 0); }
    else if (f === 'P') { push(0, 0); push(1, 0); push(1, 1); }
    else for (const bit of f) { push(0, bit); push(1, bit); push(0, bit); }
  }
  push(1, 1);
  return [raw(scl), raw(sda)];
}
const byteBits = (v, ack) => [...Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1), ack ? 0 : 1];

test('decodeI2c finds start, address, data, acks and stop', () => {
  const [scl, sda] = i2c(['S', byteBits(0x3c << 1, true), byteBits(0xa5, true), byteBits(0x10, false), 'P']);
  const ev = B.decodeI2c(scl, sda);
  assert.deepStrictEqual(ev, [
    { type: 'start' },
    { type: 'addr', addr: 0x3c, write: true, ack: true },
    { type: 'data', value: 0xa5, ack: true },
    { type: 'data', value: 0x10, ack: false },
    { type: 'stop' }
  ]);
  assert.strictEqual(B.formatI2c(ev), 'S 0x3C W A | 0xA5 A | 0x10 N P');
});

test('decodeI2c returns nothing for a flat bus', () => {
  assert.deepStrictEqual(B.decodeI2c(new Uint8Array(20).fill(128), new Uint8Array(20).fill(128)), []);
});

test('decodeSpi samples data on rising clock edges, MSB first', () => {
  const clk = [];
  const dat = [];
  const byte = 0xb2;
  clk.push(...rep(0, 3)); dat.push(...rep(0, 3));
  for (let i = 7; i >= 0; i--) {
    const bit = (byte >> i) & 1;
    clk.push(0, 0, 1, 1); dat.push(bit, bit, bit, bit);
  }
  clk.push(...rep(0, 3)); dat.push(...rep(0, 3));
  assert.deepStrictEqual(B.decodeSpi(raw(clk), raw(dat)).map((b) => b.value), [0xb2]);
});

test('formatBytes shows hex and printable ASCII', () => {
  assert.strictEqual(B.formatBytes([{ value: 0x48 }, { value: 0x69 }, { value: 0x0a }]), '48 69 0A  "Hi."');
  assert.strictEqual(B.formatBytes([]), '');
});
