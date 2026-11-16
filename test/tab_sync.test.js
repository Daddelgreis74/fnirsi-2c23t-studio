const test = require('node:test');
const assert = require('node:assert');
const { lineInfo, tabForLine } = require('../src/renderer/tab_sync.js');

test('lineInfo recognises mode announcements and data frames', () => {
  assert.deepStrictEqual(lineInfo('$MODE,SCOPE'), { mode: 'SCOPE', announced: true });
  assert.deepStrictEqual(lineInfo('$MODE,gen'), { mode: 'GEN', announced: true });
  assert.deepStrictEqual(lineInfo('$DMM,DCV,1.0,V,OK'), { mode: 'DMM', announced: false });
  assert.deepStrictEqual(lineInfo('$SCOPE,1M,1V,1V,0,0,0,0,1,1,1'), { mode: 'SCOPE', announced: false });
  assert.deepStrictEqual(lineInfo('$WAVE,1,AB'), { mode: 'SCOPE', announced: false });
  assert.strictEqual(lineInfo('$MODE,XYZ'), null);
  assert.strictEqual(lineInfo('hello'), null);
});

test('a mode announcement always selects its tab', () => {
  assert.strictEqual(tabForLine(lineInfo('$MODE,GEN'), true), 'generator');
  assert.strictEqual(tabForLine(lineInfo('$MODE,DMM'), false), 'dmm');
  assert.strictEqual(tabForLine(lineInfo('$MODE,SCOPE'), true), 'scope');
});

test('data frames select a tab only while the device mode is still unknown', () => {
  assert.strictEqual(tabForLine(lineInfo('$WAVE,1,AB'), false), 'scope');
  assert.strictEqual(tabForLine(lineInfo('$DMM,DCV,1.0,V,OK'), false), 'dmm');
});

test('stray data frames never flip the tab once the mode is known (e.g. after a switch)', () => {
  assert.strictEqual(tabForLine(lineInfo('$WAVE,1,AB'), true), null);
  assert.strictEqual(tabForLine(lineInfo('$SCOPE,1M,1V,1V,0,0,0,0,1,1,1'), true), null);
  assert.strictEqual(tabForLine(lineInfo('$DMM,DCV,1.0,V,OK'), true), null);
});

test('no tab for an unknown line', () => {
  assert.strictEqual(tabForLine(null, false), null);
});
