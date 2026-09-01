'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../public/gamification-integrity-v1.js');
const C = require('../public/commitment-v1.js');

function treeState(perks) {
  return {
    study: {
      archetype: '📚', schemaVersion: 4,
      nodes: [{ id: 'n1', title: 'Память', unlocked: true, x: 12, custom: { keep: true }, perks }],
    },
  };
}

test('lootLuck migrates to the deterministic canonical kind without mutating input', () => {
  const input = treeState([{ kind: 'lootLuck', val: 12, note: 'keep' }, { kind: 'xpPct', val: 5 }]);
  const before = JSON.stringify(input);
  const result = G.migrateRewardPerks(input);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.migrated, 1);
  assert.deepEqual(result.state.study.nodes[0].perks, [
    { kind: 'dailyRewardGoldPct', val: 12, note: 'keep' },
    { kind: 'xpPct', val: 5 },
  ]);
  assert.equal(JSON.stringify(input), before);
  assert.notEqual(result.state, input);
  assert.notEqual(result.state.study.nodes[0], input.study.nodes[0]);
});

test('canonical reward perk wins over legacy and values are never summed', () => {
  const input = treeState([
    { kind: 'lootLuck', val: 12 },
    { kind: 'dailyRewardGoldPct', val: 7, source: 'canonical' },
    { kind: 'lootLuck', val: 10 },
    { kind: 'goldPct', val: 4 },
  ]);
  const result = G.migrateRewardPerks(input);
  assert.deepEqual(result.state.study.nodes[0].perks, [
    { kind: 'dailyRewardGoldPct', val: 7, source: 'canonical' },
    { kind: 'goldPct', val: 4 },
  ]);
  assert.equal(result.migrated, 2);
  assert.equal(result.removedDuplicates, 2);
  assert.equal(result.state.study.nodes[0].perks[0].val, 7, '12 + 7 + 10 must not become a larger reward');
});

test('duplicate legacy entries choose one value rather than combining them', () => {
  const result = G.migrateRewardPerks(treeState([
    { kind: 'lootLuck', val: 8 },
    { kind: 'lootLuck', val: 9 },
  ]));
  assert.deepEqual(result.state.study.nodes[0].perks, [{ kind: 'dailyRewardGoldPct', val: 8 }]);
  assert.equal(result.removedDuplicates, 1);
});

test('migration preserves node identity, unlock state, custom fields, and unrelated trees', () => {
  const input = treeState([{ kind: 'lootLuck', val: 12 }]);
  input.body = { schemaVersion: 99, nodes: [{ id: 'body-1', unlocked: false, row: 3, perks: [{ kind: 'energyBack', val: 2 }] }] };
  const result = G.migrateRewardPerks(input);
  assert.equal(result.state.study.nodes[0].id, 'n1');
  assert.equal(result.state.study.nodes[0].unlocked, true);
  assert.equal(result.state.study.nodes[0].x, 12);
  assert.deepEqual(result.state.study.nodes[0].custom, { keep: true });
  assert.deepEqual(result.state.body, input.body);
});

test('reward migration is idempotent', () => {
  const once = G.migrateRewardPerks(treeState([{ kind: 'lootLuck', val: 12 }])).state;
  const twice = G.migrateRewardPerks(once);
  assert.equal(twice.ok, true);
  assert.equal(twice.changed, false);
  assert.equal(twice.migrated, 0);
  assert.deepEqual(twice.state, once);
});

test('malformed tree states fail closed without a partial migration', () => {
  const input = {
    valid: { nodes: [{ id: 'a', perks: [{ kind: 'lootLuck', val: 3 }] }] },
    broken: { nodes: 'not-an-array' },
  };
  const before = JSON.stringify(input);
  const result = G.migrateRewardPerks(input);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid_tree_state');
  assert.equal(result.changed, false);
  assert.equal(JSON.stringify(result.state), before);
  assert.equal(JSON.stringify(input), before);
});

test('only exact historical synthetic ledger ids or explicit markers are classified', () => {
  for (const row of [
    { id: 'reckon_2026-08-25' },
    { id: 'oath_task-1' },
    { id: 'anything', source: 'legacy-control-v1', type: 'reckoning' },
    { id: 'anything', type: 'legacy-oath-burn' },
  ]) assert.equal(G.legacyPenaltyPurchase(row), true, JSON.stringify(row));

  for (const row of [
    null, {}, { id: 'my_reckon_2026-08-25' }, { id: 'reckon_2026-02-30' }, { id: 'reckon_2026-02-30-extra' },
    { id: 'oath_' }, { id: 'oath' }, { id: 12 },
    { id: 'normal', source: 'legacy-control-v1', type: 'shop' },
    { id: 'normal', source: 'control-v1', type: 'reckoning' },
  ]) assert.equal(G.legacyPenaltyPurchase(row), false, JSON.stringify(row));
});

test('historical synthetic costs become zero; ordinary numeric costs remain safe', () => {
  assert.equal(G.spendablePurchaseCost({ id: 'reckon_2026-08-25', cost: 15 }), 0);
  assert.equal(G.spendablePurchaseCost({ id: 'oath_q1', cost: 25 }), 0);
  assert.equal(G.spendablePurchaseCost({ id: 'shop-1', cost: 12 }), 12);
  assert.equal(G.spendablePurchaseCost({ id: 'shop-2', cost: '12.5' }), 12.5);
  for (const cost of [-1, Infinity, NaN, '', null, true, [], Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(G.spendablePurchaseCost({ id: 'shop', cost }), 0, String(cost));
  }
});

test('Control review is read-only, overdue-only, ordered, and offers reversible choices', () => {
  const tasks = [
    { id: 'today', title: 'Сегодня', date: '2026-09-01', done: false },
    { id: 'old-2', title: 'Позже', date: '2026-08-31', done: false, goldAwarded: 999 },
    { id: 'done', title: 'Готово', date: '2026-08-20', done: true },
    { id: 'old-1', title: 'Раньше', date: '2026-08-20', done: false },
    { id: 'archived', title: 'Архив', date: '2026-08-10', done: false, archived: true },
  ];
  const before = JSON.stringify(tasks);
  const review = G.controlReview(tasks, '2026-09-01');
  assert.deepEqual(review, [
    { taskId: 'old-1', title: 'Раньше', date: '2026-08-20', daysOverdue: 12, actions: ['revise', 'reschedule', 'release'] },
    { taskId: 'old-2', title: 'Позже', date: '2026-08-31', daysOverdue: 1, actions: ['revise', 'reschedule', 'release'] },
  ]);
  assert.equal(JSON.stringify(tasks), before);
  assert.equal(Object.isFrozen(review), true);
  assert.equal(Object.isFrozen(review[0]), true);
  assert.equal(Object.prototype.hasOwnProperty.call(review[1], 'goldAwarded'), false);
});

test('Control review fails closed for malformed inputs and impossible dates', () => {
  assert.deepEqual(G.controlReview(null, '2026-09-01'), []);
  assert.deepEqual(G.controlReview([], '2026-02-30'), []);
  assert.deepEqual(G.controlReview([{ id: 'x', date: 'not-a-day' }], '2026-09-01'), []);
});

test('active legacy oath becomes one live commitment and loses the dangerous field', () => {
  const tasks = [{
    id: 'q1', title: 'Снять видео', date: '2026-09-02', done: false,
    oath: { gold: 25, at: '2026-09-01T10:00:00.000Z' },
    goldAwarded: 0, xpAwarded: 0,
  }];
  const before = JSON.stringify(tasks);
  const result = G.migrateLegacyOaths(tasks, C.emptyState(), C, '2026-09-01');
  assert.equal(result.ok, true);
  assert.equal(result.migrated, 1);
  assert.equal(result.archived, 0);
  assert.equal(result.tasks[0].commitmentId, 'quest:q1');
  assert.equal(Object.prototype.hasOwnProperty.call(result.tasks[0], 'oath'), false);
  assert.equal(result.tasks[0].goldAwarded, 0);
  assert.equal(result.tasks[0].xpAwarded, 0);
  assert.equal(C.activeItems(result.commitmentState).length, 1);
  assert.equal(C.outcomeOf(result.commitmentState, 'quest:q1', '2026-09-02'), null);
  assert.equal(JSON.stringify(tasks), before);
});

test('kept and missed legacy oaths are archived with outcomes, without payout edits', () => {
  const tasks = [
    { id: 'kept', title: 'Готово', date: '2026-08-30', done: true, completedAt: '2026-08-30T18:00:00Z', oath: { kept: true, gold: 25 }, goldAwarded: 38 },
    { id: 'missed', title: 'Не сделано', date: '2026-08-29', done: false, oath: { burned: true, gold: 25 }, goldAwarded: 0 },
  ];
  const result = G.migrateLegacyOaths(tasks, C.emptyState(), C, '2026-09-01');
  assert.equal(result.ok, true);
  assert.equal(result.archived, 2);
  assert.equal(C.outcomeOf(result.commitmentState, 'quest:kept', '2026-08-30'), 'win');
  assert.equal(C.outcomeOf(result.commitmentState, 'quest:missed', '2026-08-29'), 'miss');
  assert.equal(C.activeItems(result.commitmentState).length, 0);
  assert.equal(result.tasks[0].goldAwarded, 38, 'migration must preserve the historical awarded value');
  assert.equal(result.tasks[1].goldAwarded, 0);
});

test('legacy oath migration is idempotent and never duplicates commitment ids', () => {
  const first = G.migrateLegacyOaths(
    [{ id: 'q1', title: 'Квест', date: '2026-09-02', oath: { gold: 25 } }],
    C.emptyState(), C, '2026-09-01',
  );
  const second = G.migrateLegacyOaths(first.tasks, first.commitmentState, C, '2026-09-01');
  assert.equal(second.ok, true);
  assert.equal(second.migrated, 0);
  assert.equal(second.commitmentState.items.filter((item) => item.id === 'quest:q1').length, 1);
  assert.deepEqual(second.tasks, first.tasks);
  assert.deepEqual(second.commitmentState, first.commitmentState);
});

test('existing matching commitment is reused; collisions retain the legacy oath', () => {
  const added = C.add(C.emptyState(), {
    id: 'quest:q1', kind: 'step', title: 'Квест', win: 'Финиш',
    edge: { kind: 'trigger', on: 'до 2026-09-02' }, decidedOn: '2026-09-01',
  }).state;
  const reused = G.migrateLegacyOaths([{ id: 'q1', title: 'Квест', oath: {} }], added, C, '2026-09-01');
  assert.equal(reused.ok, true);
  assert.equal(reused.commitmentState.items.length, 1);
  assert.equal(reused.tasks[0].commitmentId, 'quest:q1');

  const collision = C.add(C.emptyState(), {
    id: 'quest:q2', kind: 'edge', title: 'Другая граница', win: 'Выключить работу',
    edge: { kind: 'time', at: '22:00' }, decidedOn: '2026-09-01',
  }).state;
  const failed = G.migrateLegacyOaths([{ id: 'q2', title: 'Квест', oath: { gold: 25 } }], collision, C, '2026-09-01');
  assert.equal(failed.ok, false);
  assert.equal(failed.errors[0].error, 'commitment_id_collision');
  assert.deepEqual(failed.tasks[0].oath, { gold: 25 });
  assert.equal(failed.tasks[0].commitmentId, undefined);
});

test('13+ active legacy oaths migrate once: available slots stay live and overflow is released history', () => {
  const tasks = Array.from({ length: C.MAX_ITEMS + 3 }, (_, index) => ({
    id: 'legacy-' + index,
    title: 'Legacy ' + index,
    date: '2026-09-02',
    done: false,
    oath: { gold: 25, at: '2026-09-01T10:00:00.000Z' },
    goldAwarded: index,
    xpAwarded: index * 2,
  }));
  const before = JSON.stringify(tasks);
  const result = G.migrateLegacyOaths(tasks, C.emptyState(), C, '2026-09-01');

  assert.equal(result.ok, true);
  assert.equal(result.migrated, C.MAX_ITEMS + 3);
  assert.equal(result.linked, C.MAX_ITEMS + 3);
  assert.equal(result.archived, 3);
  assert.equal(C.activeItems(result.commitmentState).length, C.MAX_ITEMS);
  assert.equal(result.commitmentState.items.length, C.MAX_ITEMS + 3);
  assert.equal(JSON.stringify(tasks), before, 'source tasks stay immutable');
  for (let index = 0; index < result.tasks.length; index += 1) {
    const task = result.tasks[index];
    const commitment = result.commitmentState.items.find((item) => item.id === 'quest:' + task.id);
    assert.equal(Object.prototype.hasOwnProperty.call(task, 'oath'), false);
    assert.equal(task.commitmentId, 'quest:' + task.id);
    assert.equal(task.goldAwarded, index);
    assert.equal(task.xpAwarded, index * 2);
    if (index < C.MAX_ITEMS) {
      assert.equal(commitment.archivedAt, undefined);
    } else {
      assert.equal(commitment.archivedAt, '2026-09-01');
      assert.deepEqual(commitment.history.at(-1), { type: 'released', day: '2026-09-01' });
      assert.equal(C.outcomeOf(result.commitmentState, commitment.id, '2026-09-01'), null);
    }
  }

  const twice = G.migrateLegacyOaths(result.tasks, result.commitmentState, C, '2026-09-01');
  assert.equal(twice.ok, true);
  assert.equal(twice.migrated, 0);
  assert.equal(twice.archived, 0);
  assert.deepEqual(twice.tasks, result.tasks);
  assert.deepEqual(twice.commitmentState, result.commitmentState);
});

test('malformed oath or commitment collision fails closed for the whole candidate', () => {
  const collisionState = C.add(C.emptyState(), {
    id: 'quest:collision', kind: 'edge', title: 'Другая граница', win: 'Остановиться',
    edge: { kind: 'time', at: '22:00' }, decidedOn: '2026-09-01',
  }).state;
  const tasks = [
    { id: 'would-migrate', title: 'Сначала валидная', oath: { gold: 25 }, goldAwarded: 7 },
    { id: 'malformed', title: 'Повреждённая', oath: 'not-an-object' },
    { id: 'collision', title: 'Коллизия', oath: { gold: 25 } },
  ];
  const beforeTasks = structuredClone(tasks);
  const beforeState = structuredClone(collisionState);
  const result = G.migrateLegacyOaths(tasks, collisionState, C, '2026-09-01');

  assert.equal(result.ok, false);
  assert.equal(result.migrated, 0);
  assert.equal(result.linked, 0);
  assert.equal(result.archived, 0);
  assert.deepEqual(result.tasks, beforeTasks);
  assert.deepEqual(result.commitmentState, beforeState);
  assert.deepEqual(result.errors, [
    { taskId: 'malformed', error: 'invalid_oath' },
    { taskId: 'collision', error: 'commitment_id_collision' },
  ]);
});

test('missing task id fails closed even when active capacity is already full', () => {
  let full = C.emptyState();
  for (let i = 0; i < C.MAX_ITEMS; i += 1) {
    full = C.add(full, {
      id: 'i' + i, kind: 'step', title: 'Item ' + i, win: 'Win',
      edge: { kind: 'none' }, decidedOn: '2026-09-01',
    }).state;
  }
  const tasks = [
    { id: 'blocked', title: 'Не потерять', oath: { gold: 25 } },
    { title: 'Без id', oath: { gold: 25 } },
  ];
  const result = G.migrateLegacyOaths(tasks, full, C, '2026-09-01');
  assert.equal(result.ok, false);
  assert.equal(result.migrated, 0);
  assert.deepEqual(result.tasks, tasks);
  assert.deepEqual(result.commitmentState, full);
  assert.deepEqual(result.errors.map((row) => row.error), ['missing_task_id']);
});

test('module stays pure and exposes no resource mutation surface', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'gamification-integrity-v1.js'), 'utf8');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const forbidden of ['document', 'window.', 'localStorage', 'fetch(', 'State.', 'XMLHttpRequest']) {
    assert.equal(body.includes(forbidden), false, `pure module reached for ${forbidden}`);
  }
  const surface = Object.keys(G).join(' ').toLowerCase();
  for (const forbidden of ['award', 'payout', 'charge', 'deduct', 'damage', 'xp', 'gold']) {
    assert.equal(surface.includes(forbidden), false, `resource mutation API leaked through ${forbidden}`);
  }
});
