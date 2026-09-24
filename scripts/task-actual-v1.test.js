const test = require('node:test');
const assert = require('node:assert/strict');
const Actual = require('../public/task-actual-v1.js');

test('hours and minutes retain exact minute boundaries, including explicit zero', () => {
  for (const total of [0, 59, 60, 125, 1440]) {
    assert.equal(Actual.minutes(String(Math.floor(total / 60)), String(total % 60)), total);
  }
});
test('blank, fractional, negative, nonfinite and out-of-range components cannot erase time', () => {
  for (const [h, m] of [['', ''], ['', '0'], ['0', ''], ['-1', '0'], ['0', '-1'], ['1.5', '0'], ['0', '60'], ['x', '0'], ['Infinity', '0'], ['1e2', '0'], ['9007199254740991', '0']]) {
    assert.equal(Actual.minutes(h, m), null, `${h}:${m}`);
  }
});
test('editing completed task time changes no completion, reward or unrelated task fields', () => {
  const tasks = [{ id: 'a', actualMin: 59, done: true, xpAwarded: 17, goldAwarded: 3, completedAt: '2026-09-24', estimateMin: 30 }, { id: 'b', actualMin: 5 }];
  const copy = structuredClone(tasks);
  const next = Actual.update(tasks, 'a', 125, 59, null);
  assert.deepEqual(tasks, copy);
  assert.deepEqual(next, [{ ...tasks[0], actualMin: 125 }, tasks[1]]);
  assert.deepEqual(Actual.update(next, 'a', 125, 59, null), next, 'lost receipt retry is an absolute idempotent update');
  assert.equal(Actual.update(next, 'a', 60, 59, null), null, 'stale edit must not overwrite a different value');
});
test('active timer, missing task and invalid total are refused; zero keeps legacy null convention', () => {
  const tasks = [{ id: 'a', actualMin: 5, done: false }];
  assert.equal(Actual.update(tasks, 'a', 12, 5, 'a'), null);
  assert.equal(Actual.update(tasks, 'missing', 12, 5, null), null);
  for (const n of [-1, NaN, Infinity, 1.5]) assert.equal(Actual.update(tasks, 'a', n, 5, null), null);
  assert.equal(Actual.update(tasks, 'a', 0, 5, 'b')[0].actualMin, null);
});
