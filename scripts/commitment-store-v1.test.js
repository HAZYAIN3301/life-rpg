'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/commitment-store-v1.js');

function item(over = {}) {
  return Object.assign({
    id: 'quest:q1', kind: 'step', title: 'Снять видео',
    win: 'Завершить выбранный квест без ставки ресурсами',
    edge: { kind: 'time', at: '22:00' },
    core: false, modes: [], history: [], decidedOn: '2026-09-01',
  }, over);
}
function state(over = {}) {
  return Object.assign({ version: 1, mode: 'default', items: [item()], log: {} }, over);
}
function task(over = {}) {
  return Object.assign({ id: 'q1', title: 'Снять видео', date: '2026-09-02', done: false, commitmentId: 'quest:q1' }, over);
}
function payload(over = {}) {
  return {
    base: {
      settings: { exists: true, value: { lang: 'ru', commitmentsV1: state() } },
      tasks: { exists: true, value: [task()] },
    },
    data: Object.assign({ settings: { lang: 'ru', commitmentsV1: state() }, tasks: [task()] }, over),
  };
}

test('accepts one exact settings + tasks graph', () => {
  assert.equal(S.validateCommitPayload(payload()), true);
});

test('the cap applies to live commitments, not retained history', () => {
  const archived = Array.from({ length: 20 }, (_, index) => item({
    id: `history:${index}`, kind: 'care', edge: { kind: 'none' }, archivedAt: '2026-09-02',
  }));
  assert.equal(S.validateCommitmentState(state({ items: archived })), true);
  const active = Array.from({ length: S.MAX_ACTIVE_ITEMS + 1 }, (_, index) => item({
    id: `active:${index}`, kind: 'care', edge: { kind: 'none' },
  }));
  assert.equal(S.validateCommitmentState(state({ items: active })), false);
});

test('payload keys are exact and identity injection is rejected', () => {
  assert.equal(S.validateCommitPayload({ settings: {}, tasks: [] }), false);
  assert.equal(S.validateCommitPayload({ base: payload().base, data: payload().data, userId: 'other' }), false);
  assert.equal(S.validateCommitPayload({ base: payload().base, data: { ...payload().data, purchases: [] } }), false);
  assert.equal(S.validateCommitPayload({ base: payload().base, data: { settings: payload().data.settings } }), false);
  assert.equal(S.validateCommitPayload({ base: payload().base, data: { tasks: payload().data.tasks } }), false);
  assert.equal(S.validateCommitPayload({ base: { ...payload().base, userId: 'other' }, data: payload().data }), false);
  assert.equal(S.validateCommitPayload({ base: { settings: { exists: false, value: {} }, tasks: payload().base.tasks }, data: payload().data }), false);
});

test('graph accepts the canonical imported task bounds', () => {
  const id = ` legacy ${'x'.repeat(170)}`;
  const longTask = task({ id, title: 'д'.repeat(1000), commitmentId: `quest:${id}` });
  const longItem = item({ id: `quest:${id}`, title: 'д'.repeat(80) });
  assert.equal(S.validateCommitPayload(payload({
    settings: { commitmentsV1: state({ items: [longItem] }) }, tasks: [longTask],
  })), true);
});

test('state schema is strict and resource-like or unknown fields cannot hide inside it', () => {
  const cases = [];
  cases.push({ ...state(), gold: 25 });
  cases.push(state({ version: 2 }));
  cases.push(state({ mode: ' default ' }));
  cases.push(state({ items: [item({ gold: 25 })] }));
  cases.push(state({ items: [item({ id: 'q1', edge: { kind: 'surprise' } })] }));
  cases.push(state({ items: [item(), item()] }));
  cases.push(state({ log: { '2026-02-30': { 'quest:q1': 'win' } } }));
  cases.push(state({ log: { '2026-09-01': { missing: 'win' } } }));
  cases.push(state({ log: { '2026-09-01': { 'quest:q1': 'unknown' } } }));
  for (const candidate of cases) assert.equal(S.validateCommitmentState(candidate), false, JSON.stringify(candidate));
});

test('all edge, history, budget, archive and log forms emitted by CommitmentV1 validate', () => {
  const items = [
    item({ id: 'a', kind: 'anchor', edge: { kind: 'time', at: '07:10' }, budget: { misses: 1, perDays: 7 } }),
    item({ id: 'b', kind: 'edge', edge: { kind: 'window', from: '21:00', to: '22:00' }, archivedAt: '2026-09-02' }),
    item({ id: 'c', kind: 'care', edge: { kind: 'none' }, history: [{ type: 'released', day: '2026-09-02' }] }),
    item({ id: 'd', kind: 'moment', edge: { kind: 'trigger', on: 'после школы' }, revisedOn: '2026-09-02', history: [{
      type: 'revised', day: '2026-09-02', from: { kind: 'time', at: '20:00' }, to: { kind: 'time', at: '21:00' },
    }] }),
  ];
  assert.equal(S.validateCommitmentState({
    version: 1, mode: 'school', items,
    log: { '2026-09-01': { a: 'win', b: 'miss' } },
  }), true);
});

test('task graph rejects legacy oaths, dangling/wrong/duplicate links and orphan quest commitments', () => {
  assert.equal(S.validateCommitPayload(payload({ tasks: [task({ oath: null })] })), false);
  assert.equal(S.validateCommitPayload(payload({ tasks: [task({ commitmentId: 'quest:other' })] })), false);
  assert.equal(S.validateCommitPayload(payload({ tasks: [task({ commitmentId: 'quest:q1' }), task({ id: 'q2', commitmentId: 'quest:q1' })] })), false);
  assert.equal(S.validateCommitPayload(payload({ tasks: [task({ commitmentId: null })] })), false);
  assert.equal(S.validateCommitPayload(payload({
    settings: { commitmentsV1: state({ items: [item({ archivedAt: '2026-09-02' })] }) }, tasks: [],
  })), true, 'archived quest history may outlive a deleted task');
  assert.equal(S.validateCommitPayload(payload({ settings: { commitmentsV1: state({ items: [item({ id: 'free', kind: 'care', edge: { kind: 'none' } })] }) }, tasks: [] })), true,
    'non-quest commitments do not need a task link');
});

test('module is pure and exposes validation only', () => {
  const surface = Object.keys(S).join(' ').toLowerCase();
  for (const forbidden of ['write', 'save', 'fetch', 'award', 'charge', 'deduct', 'payout']) {
    assert.equal(surface.includes(forbidden), false, forbidden);
  }
});
