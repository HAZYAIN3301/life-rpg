const { test } = require('node:test');
const assert = require('node:assert/strict');
const bulk = require('../public/overdue-bulk-v1.js');
const day = '2026-10-04';
const fixtures = () => [
  { id: 'old', title: 'Old', date: '2026-10-01', done: false, goldAwarded: 0 },
  { id: 'done', title: 'Done', date: '2026-10-01', done: true, goldAwarded: 10 },
  { id: 'today', title: 'Today', date: day, done: false },
  { id: 'released', date: '2026-10-01', amnesty: day },
];
test('only unfinished past tasks are selectable; selection never mutates source or rewards', () => {
  const tasks = fixtures(), original = structuredClone(tasks), shown = bulk.snapshot(tasks, day);
  assert.deepEqual(shown.map(t => t.id), ['old']);
  const selection = bulk.select(tasks, shown, ['old', 'old'], day, { kind: 'move', date: day });
  assert.equal(selection.ok, true); assert.equal(selection.tasks.length, 1);
  assert.deepEqual(tasks, original);
  for (const id of ['today', 'done', 'released', 'missing']) assert.equal(bulk.select(tasks, shown, [id], day, { kind: 'delete' }).ok, false);
});
test('any concurrent edit to selected task rejects the stale confirmation; unrelated edits survive', () => {
  const tasks = fixtures(), shown = bulk.snapshot(tasks, day);
  for (const patch of [{ done: true }, { title: 'Edited' }, { date: '2026-10-02' }, { actualMin: 40 }, { amnesty: day }]) {
    const changed = structuredClone(tasks); Object.assign(changed[0], patch);
    assert.equal(bulk.select(changed, shown, ['old'], day, { kind: 'delete' }).error, 'changed');
  }
  tasks[2].title = 'A newer unrelated edit';
  assert.equal(bulk.select(tasks, shown, ['old'], day, { kind: 'delete' }).ok, true);
  assert.equal(bulk.select(tasks.slice(1), shown, ['old'], day, { kind: 'delete' }).ok, false);
  assert.equal(bulk.select([...tasks, tasks[0]], shown, ['old'], day, { kind: 'delete' }).ok, false);
});
test('replay, active focus, invalid dates and excessive selection do not silently change tasks', () => {
  const tasks = fixtures(), shown = bulk.snapshot(tasks, day);
  for (const date of ['2026-10-03', '2026-02-30', '2026-13-01', '', 'tomorrow']) assert.equal(bulk.select(tasks, shown, ['old'], day, { kind: 'move', date }).error, 'date');
  assert.equal(bulk.select(tasks, shown, ['old'], day, { kind: 'delete', activeTaskId: 'old' }).error, 'focus');
  assert.equal(bulk.select(tasks, shown, [], day, { kind: 'delete' }).error, 'selection');
  assert.equal(bulk.select(tasks, shown, Array.from({ length: 51 }, (_, i) => String(i)), day, { kind: 'delete' }).error, 'selection');
  tasks[0].date = day;
  assert.equal(bulk.select(tasks, shown, ['old'], day, { kind: 'move', date: day }).error, 'changed');
});
