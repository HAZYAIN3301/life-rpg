'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const J = require('../public/commitment-journal-v1.js');

const CREATED = '2026-09-01T12:00:00.000Z';
const COMMITTED = '2026-09-01T12:00:01.000Z';

function input() {
  return {
    txId: 'commitment:20260901:0001',
    createdAt: CREATED,
    base: {
      settings: { exists: true, value: { marker: 'before', commitmentsV1: { version: 1 } } },
      tasks: { exists: false, value: null },
    },
    data: {
      settings: { marker: 'after', commitmentsV1: { version: 1 } },
      tasks: [{ id: 'q1', title: 'Квест' }],
    },
  };
}

function graphInput() {
  const source = input();
  source.txId = 'commitment:20260901:graph';
  source.base.goals = { exists: true, value: [{ id: 'g0' }] };
  source.base['goal-groups'] = { exists: false, value: null };
  source.base.skilltree = { exists: true, value: {} };
  source.data.goals = [{ id: 'g1' }];
  source.data['goal-groups'] = [{ id: 'grp1' }];
  source.data.skilltree = { skill1: { nodes: [] } };
  return source;
}

test('prepare creates immutable exact durable metadata without mutating input', () => {
  const source = input();
  const before = structuredClone(source);
  const result = J.prepare(source);
  assert.equal(result.ok, true);
  assert.equal(J.validate(result.journal), true);
  assert.equal(result.journal.schema, 'satoru.commitment-journal/1');
  assert.equal(result.journal.phase, 'prepared');
  assert.match(result.journal.checksum, /^[0-9a-f]{16}$/);
  assert.deepEqual(source, before);
  source.data.settings.marker = 'mutated-later';
  assert.equal(result.journal.files.settings.after.marker, 'after');
});

test('prepared recovery rolls back in reverse order and removes files that did not exist', () => {
  const journal = J.prepare(input()).journal;
  const plan = J.recoveryPlan(journal);
  assert.deepEqual(plan, {
    ok: true,
    txId: 'commitment:20260901:0001',
    mode: 'rollback',
    actions: [
      { op: 'remove', name: 'tasks' },
      { op: 'write', name: 'settings', value: { marker: 'before', commitmentsV1: { version: 1 } } },
    ],
    removeJournalAfterSuccess: true,
  });
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.actions), true);
});

test('committed recovery rolls forward both after-images in canonical order', () => {
  const prepared = J.prepare(input()).journal;
  const committed = J.markCommitted(prepared, COMMITTED);
  assert.equal(committed.ok, true);
  assert.equal(committed.changed, true);
  assert.equal(committed.journal.phase, 'committed');
  assert.equal(J.validate(committed.journal), true);
  assert.deepEqual(J.recoveryPlan(committed.journal), {
    ok: true,
    txId: prepared.txId,
    mode: 'rollforward',
    actions: [
      { op: 'write', name: 'settings', value: input().data.settings },
      { op: 'write', name: 'tasks', value: input().data.tasks },
    ],
    removeJournalAfterSuccess: true,
  });
});

test('five-file journal rolls back and rolls forward the complete allowlisted graph', () => {
  const source = graphInput();
  const prepared = J.prepare(source);
  assert.equal(prepared.ok, true);
  assert.equal(J.validate(prepared.journal), true);
  assert.deepEqual(Object.keys(prepared.journal.files), [
    'settings', 'tasks', 'goals', 'goal-groups', 'skilltree',
  ]);
  assert.deepEqual(J.recoveryPlan(prepared.journal).actions.map((action) => `${action.op}:${action.name}`), [
    'write:skilltree', 'remove:goal-groups', 'write:goals', 'remove:tasks', 'write:settings',
  ]);
  const committed = J.markCommitted(prepared.journal, COMMITTED);
  assert.equal(committed.ok, true);
  assert.deepEqual(J.recoveryPlan(committed.journal).actions.map((action) => `${action.op}:${action.name}`), [
    'write:settings', 'write:tasks', 'write:goals', 'write:goal-groups', 'write:skilltree',
  ]);
});

test('legacy two-file journals remain valid while optional files and unknown files are exact', () => {
  const legacy = J.prepare(input());
  assert.equal(legacy.ok, true);
  assert.equal(J.validate(legacy.journal), true);
  assert.deepEqual(J.recoveryPlan(legacy.journal).actions.map((action) => action.name), ['tasks', 'settings']);

  const missingOptionalPeer = graphInput(); delete missingOptionalPeer.data.skilltree;
  assert.deepEqual(J.prepare(missingOptionalPeer), { ok: false, error: 'invalid_prepare' });
  const unknown = graphInput();
  unknown.base.profile = { exists: false, value: null }; unknown.data.profile = {};
  assert.deepEqual(J.prepare(unknown), { ok: false, error: 'invalid_prepare' });
});

test('commit transition and recovery plans are idempotent across repeated crashes', () => {
  const prepared = J.prepare(input()).journal;
  assert.deepEqual(J.recoveryPlan(prepared), J.recoveryPlan(prepared));
  const once = J.markCommitted(prepared, COMMITTED);
  const twice = J.markCommitted(once.journal, '2026-09-01T12:00:02.000Z');
  assert.equal(twice.ok, true);
  assert.equal(twice.changed, false);
  assert.deepEqual(twice.journal, once.journal);
  assert.deepEqual(J.recoveryPlan(twice.journal), J.recoveryPlan(once.journal));
});

test('malformed, truncated, tampered, and unknown-field journals fail closed', () => {
  const valid = J.prepare(input()).journal;
  const cases = [
    null,
    {},
    { ...valid, checksum: valid.checksum.slice(1) },
    { ...valid, surprise: true },
    { ...valid, phase: 'committed' },
    { ...valid, files: { ...valid.files, tasks: { before: { exists: false, value: [] }, after: [] } } },
    { ...valid, files: { ...valid.files, settings: { ...valid.files.settings, after: { bad: Infinity } } } },
  ];
  for (const value of cases) {
    assert.equal(J.validate(value), false, JSON.stringify(value));
    assert.deepEqual(J.recoveryPlan(value), { ok: false, error: 'invalid_journal', actions: [] });
  }
});

test('prepare rejects wrong shapes, cycles, non-finite values, and invalid timestamps', () => {
  const cyclic = input(); cyclic.data.settings.self = cyclic.data.settings;
  const wrong = input(); wrong.base.tasks = { exists: true, value: {} };
  const missing = input(); delete missing.data.tasks;
  const invalidTime = input(); invalidTime.createdAt = 'yesterday';
  for (const value of [cyclic, wrong, missing, invalidTime]) {
    assert.deepEqual(J.prepare(value), { ok: false, error: 'invalid_prepare' });
  }
  const prepared = J.prepare(input()).journal;
  assert.deepEqual(J.markCommitted(prepared, '2026-08-31T23:59:59.000Z'), {
    ok: false, error: 'invalid_commit_time',
  });
});

test('module remains zero-dependency and has no filesystem, DOM, State, or network surface', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'commitment-journal-v1.js'), 'utf8');
  const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const forbidden of ['require(', 'node:fs', 'document', 'window.', 'localStorage', 'fetch(', 'State.', 'XMLHttpRequest']) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
  assert.deepEqual(Object.keys(J).sort(), [
    'FILES', 'PHASE_COMMITTED', 'PHASE_PREPARED', 'SCHEMA', 'VERSION',
    'markCommitted', 'prepare', 'recoveryPlan', 'validate',
  ].sort());
});
