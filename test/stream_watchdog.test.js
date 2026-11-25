const test = require('node:test');
const assert = require('node:assert');

const { isStreamStalled, nextWatchdogMark, DEFAULT_IDLE_MS } = require('../src/stream_watchdog');

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

test('one-shot queries and DMM/GEN frames never arm an unarmed watchdog', () => {
  for (const line of [
    '$VER,v2026.11.9,HW4.0',
    '$GEN,0,1000,14,33',
    '$DMM,AUTO,AUTO,,OK',
    '$UPD,0,0,0,0',
    '$MODE,DMM',
    '$MODE,GEN',
    '$MODE,SCOPE'
  ]) {
    assert.strictEqual(nextWatchdogMark(line, 0, 5000), 0, line);
  }
});

test('running scope frames and waves arm and refresh the watchdog', () => {
  assert.strictEqual(nextWatchdogMark('$SCOPE,1MS,1V,1V,0,0,0,0,1,1,0', 0, 5000), 5000);
  assert.strictEqual(nextWatchdogMark('$WAVE,1,808080', 5000, 6000), 6000);
});

test('paused scope, mode switches away from scope, and updates disarm the watchdog', () => {
  assert.strictEqual(nextWatchdogMark('$SCOPE,1MS,1V,1V,0,0,0,0,0,1,0', 5000, 6000), 0);
  assert.strictEqual(nextWatchdogMark('$MODE,DMM', 5000, 6000), 0);
  assert.strictEqual(nextWatchdogMark('$MODE,GEN', 5000, 6000), 0);
  assert.strictEqual(nextWatchdogMark('$DMM,DCV,3.30,V,OK', 5000, 6000), 0);
  assert.strictEqual(nextWatchdogMark('$UPD,2,0,269266,269266', 5000, 6000), 0);
});

test('one-shot $VER reply preserves an active scope mark', () => {
  assert.strictEqual(nextWatchdogMark('$VER,v2026.11.9,HW4.0', 5000, 6000), 5000);
});
