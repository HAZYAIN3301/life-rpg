'use strict';
// R04B: графики — выборочные подписи, единица времени, нулевые сферы одной строкой.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/progress-charts-v1.js');

test('columns label only the maximum and the last point', () => {
  const model = C.columns([{ label: '12.09', tick: '12', value: 10 }, { label: '13.09', value: 40 }, { label: '14.09', value: 40 }, { label: '15.09', value: 25 }]);
  assert.equal(model.max, 40);
  assert.equal(model.maxIndex, 1, 'ties label the earliest maximum');
  assert.deepEqual(model.cols.map((c) => c.showValue), [false, true, false, true]);
  assert.deepEqual(model.cols.map((c) => c.pct), [25, 100, 100, 62.5]);
  assert.equal(model.cols[0].tick, '12');
  assert.equal(model.cols[1].tick, '13.09', 'tick falls back to the label');
  assert.equal(model.total, 115);
  assert.equal(model.average, 29);
  assert.equal(model.activeDays, 4);
});

test('an empty last day is not labelled as zero and empty series has no maximum', () => {
  const model = C.columns([{ label: 'a', value: 5 }, { label: 'b', value: 0 }]);
  assert.deepEqual(model.cols.map((c) => c.showValue), [true, false]);
  const empty = C.columns([{ label: 'a', value: 0 }, { label: 'b', value: -3 }, { label: 'c', value: 'x' }]);
  assert.equal(empty.max, 0);
  assert.equal(empty.maxIndex, -1);
  assert.ok(empty.cols.every((c) => !c.showValue && c.pct === 0));
  assert.deepEqual(C.columns(null).cols, []);
});

test('bars sort by value, keep entity colour and fold zero categories', () => {
  const model = C.bars([
    { id: 'a', label: 'Recovery', value: 150, color: '#5fbf7a' },
    { id: 'b', label: 'Relationships & family', value: 750, color: '#e0526a' },
    { id: 'c', label: 'Work', value: 0, color: '#22c1a4' },
    { id: 'd', label: 'Study', value: 150, color: '#4f86f7' },
    { id: 'e', label: 'Sport', value: null },
  ]);
  assert.deepEqual(model.rows.map((r) => r.id), ['b', 'a', 'd'], 'ties keep the original order');
  assert.deepEqual(model.rows.map((r) => r.pct), [100, 20, 20]);
  assert.equal(model.rows[0].color, '#e0526a', 'colour follows the entity, not the rank');
  assert.deepEqual(model.zero.map((r) => r.id), ['c', 'e']);
  assert.equal(model.total, 1050);
  assert.deepEqual(model.rows.map((r) => r.share), [71, 14, 14]);
  assert.equal(C.bars([]).total, 0);
});
