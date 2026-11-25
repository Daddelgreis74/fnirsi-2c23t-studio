const test = require('node:test');
const assert = require('node:assert');

const { isStreamStalled, DEFAULT_IDLE_MS } = require('../src/stream_watchdog');

test('a closed port is never reported as stalled', () => {
  assert.strictEqual(
    isStreamStalled({ connected: false, lastLineAt: 1000, now: 1000000 }),
    false
  );
});

test('a connection that has not produced a line yet is left alone', () => {
  assert.strictEqual(
    isStreamStalled({ connected: true, lastLineAt: 0, now: 1000000 }),
    false
  );
});

test('a stream that still delivers is not restarted', () => {
  assert.strictEqual(
    isStreamStalled({ connected: true, lastLineAt: 10000, now: 10000 + DEFAULT_IDLE_MS - 1 }),
    false
  );
});

test('silence for the whole grace period is a stall', () => {
  assert.strictEqual(
    isStreamStalled({ connected: true, lastLineAt: 10000, now: 10000 + DEFAULT_IDLE_MS }),
    true
  );
});

test('the grace period can be overridden', () => {
  assert.strictEqual(
    isStreamStalled({ connected: true, lastLineAt: 10000, now: 10900, idleMs: 800 }),
    true
  );
  assert.strictEqual(
    isStreamStalled({ connected: true, lastLineAt: 10000, now: 10700, idleMs: 800 }),
    false
  );
});
