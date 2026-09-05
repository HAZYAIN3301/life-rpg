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
  cases.push(state({ version: 3 }));
  cases.push(state({ version: '2' }));
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

/* ---- Схема v2: уговор про внимание ------------------------------------- */

function attentionItem(over = {}) {
  return Object.assign({
    id: 'attn:tiktok', kind: 'attention',
    title: 'TikTok — только выложить ролик',
    win: 'вечер остаётся мой',
    target: 'tiktok',
    edge: { kind: 'duration', minutes: 12 },
    core: true, modes: [], history: [],
  }, over);
}
const v2 = (over = {}) => state(Object.assign({ version: 2, items: [attentionItem()] }, over));

test('v2 принимается вместе с уговором про внимание и границей длительностью', () => {
  assert.equal(S.validateCommitmentState(v2()), true);
  // И старые данные продолжают проходить: схема расширена, а не заменена.
  assert.equal(S.validateCommitmentState(state()), true);
  assert.equal(S.validateCommitmentState(state({ version: 2 })), true, 'пять старых видов живут и в v2');
});

test('🔴 уговор про внимание не принимается под меткой v1', () => {
  // Старый читатель молча выбрасывает неизвестный вид, поэтому принятый здесь
  // v1-файл с таким уговором потерял бы его при первом же чтении. Отказ виден,
  // потеря — нет.
  assert.equal(S.validateCommitmentState(state({ version: 1, items: [attentionItem()] })), false);
});

test('🔴 ярлык занятия обязателен у attention и запрещён у прочих видов', () => {
  const { target, ...withoutTarget } = attentionItem();
  assert.equal(S.validateCommitmentState(v2({ items: [withoutTarget] })), false, 'без ярлыка уговор не совпадёт ни с чем');
  for (const bad of ['', '   ', ' tiktok', 'tiktok ', 'я'.repeat(S.MAX_TARGET + 1), 42, null, {}]) {
    assert.equal(S.validateCommitmentState(v2({ items: [attentionItem({ target: bad })] })), false, JSON.stringify(bad));
  }
  assert.equal(S.validateCommitmentState(v2({ items: [attentionItem({ target: 'я'.repeat(S.MAX_TARGET) })] })), true);
  // Ярлык у чужого вида — признак неверно собранной записи.
  assert.equal(S.validateCommitmentState(state({ version: 2, items: [item({ target: 'tiktok' })] })), false);
});

test('🔴 граница длительностью принимает только целые минуты в пределах', () => {
  const withEdge = (minutes) => v2({ items: [attentionItem({ edge: { kind: 'duration', minutes } })] });
  assert.equal(S.validateCommitmentState(withEdge(1)), true);
  assert.equal(S.validateCommitmentState(withEdge(600)), true);
  for (const bad of [0, -5, 601, 12.5, '12', null, NaN, Infinity]) {
    assert.equal(S.validateCommitmentState(withEdge(bad)), false, JSON.stringify(bad));
  }
  // Лишние и недостающие поля границы отвергаются целиком.
  assert.equal(S.validateCommitmentState(v2({ items: [attentionItem({ edge: { kind: 'duration' } })] })), false);
  assert.equal(S.validateCommitmentState(v2({ items: [attentionItem({ edge: { kind: 'duration', minutes: 12, at: '22:00' } })] })), false);
});

test('🔴 неизвестные поля не прячутся внутри уговора про внимание', () => {
  for (const extra of [{ gold: 25 }, { xp: 1 }, { url: 'https://tiktok.com/@x' }, { policyId: 'p1' }]) {
    assert.equal(S.validateCommitmentState(v2({ items: [attentionItem(extra)] })), false, JSON.stringify(extra));
  }
});

test('🔴 то, что принял CommitmentV2, принимает и сервер', () => {
  // Шов между модулем и стором: если они расходятся, человек видит сохранённую
  // границу, а на диск она не попадает — и узнаёт об этом, когда её не окажется.
  const V2 = require('../public/commitment-v2.js');
  let built = V2.emptyState();
  for (const draft of [
    { id: 'attn:tiktok', kind: 'attention', title: 'TikTok — только выложить', win: 'вечер мой', target: 'tiktok', edge: { kind: 'duration', minutes: 12 } },
    { id: 'attn:games', kind: 'attention', title: 'Игры не после 22:00', win: 'высыпаюсь', target: 'игры' },
    { id: 'c1', kind: 'anchor', title: 'Подъём в 7:00', win: 'успеваю до школы', edge: { kind: 'time', at: '07:00' } },
  ]) {
    const added = V2.add(built, draft);
    assert.equal(added.ok, true, draft.id);
    built = added.state;
  }
  assert.equal(S.validateCommitmentState(built), true, JSON.stringify(built));
});
