'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BoardV2 = require('../public/board-v2.js');
const Pacing = require('../public/board-v2-pacing.js');
const Offers = require('../public/board-v2-offers.js');

const ROOT = path.join(__dirname, '..');

function quest(id, adventureClass, score, extra) {
  const settings = extra || {};
  const template = BoardV2.compileTemplate({
    schema: BoardV2.TEMPLATE_SCHEMA, id, revision: 1, kind: 'challenge',
    scale: adventureClass === 'legendary' ? 'arc' : 'session', tags: settings.tags || ['adventure'], interests: ['adventure'],
    slots: settings.slots || [], copy: { title: settings.title || `Сделай ${id}`, details: settings.details || 'Конкретный результат.' },
    completion: { proofModes: ['result'], share: 'optional' },
    adventure: { class: adventureClass, safetyTier: 'ordinary', requiredFlags: [] },
  });
  return BoardV2.instantiate(template, {
    slots: settings.values || {}, primaryAction: settings.primaryAction,
    fit: { confidence: score, interest: score, distanceKm: 0 },
  });
}

test('standard plan publishes one primary and at most one reserve', () => {
  const quests = ['alpha', 'beta', 'gamma'].map((id, index) => quest(id, 'standard', 1 - index / 10).quest);
  const planned = Offers.planStandard(BoardV2, quests, { interests: ['adventure'] }, Offers.emptyState(Pacing), {
    day: '2026-08-25', periodKey: '2026-W35',
  });
  assert.equal(planned.ok, true);
  assert.equal(planned.primary.templateId, 'alpha');
  assert.equal(planned.reserve.templateId, 'beta');
  assert.equal(planned.plan.snapshotIds.length, 2);
  assert.equal(Object.isFrozen(planned.primary), true);
});

test('unresolved local template never becomes an offer snapshot', () => {
  const unresolved = quest('local-class', 'standard', 1, {
    slots: [{ id: 'class', type: 'local-class', required: true }], title: 'Попробуй {class}', values: {},
  });
  assert.equal(unresolved.ok, false);
  assert.equal(Offers.snapshotQuest(BoardV2, unresolved.quest, { day: '2026-08-25', mode: 'standard' }), null);
  assert.deepEqual(Offers.planStandard(BoardV2, [unresolved.quest], {}, Offers.emptyState(Pacing), {
    day: '2026-08-25', periodKey: '2026-W35',
  }), { ok: false, reason: 'no-resolved-standard' });
});

test('only a module-issued plan can mutate displayed account state', () => {
  const resolved = quest('snapshot-safe', 'standard', 1).quest;
  const planned = Offers.planStandard(BoardV2, [resolved], {}, Offers.emptyState(Pacing), { day: '2026-08-25', periodKey: 'week' });
  const forged = { ...planned.plan };
  const untouched = Offers.recordStandardDisplayed(Offers.emptyState(Pacing), forged, [planned.primary], Pacing);
  assert.equal(untouched.snapshots.length, 0);
  const recorded = Offers.recordStandardDisplayed(Offers.emptyState(Pacing), planned.plan, [planned.primary], Pacing);
  assert.equal(recorded.snapshots.length, 1);
  assert.equal(recorded.current.selectedId, planned.primary.id);
});

test('same period returns exact stored snapshot instead of resolver drift', () => {
  const firstQuest = quest('stable-copy', 'standard', 1, { title: 'Первая точная версия' }).quest;
  const first = Offers.planStandard(BoardV2, [firstQuest], {}, Offers.emptyState(Pacing), { day: '2026-08-25', periodKey: '2026-W35' });
  const state = Offers.recordStandardDisplayed(Offers.emptyState(Pacing), first.plan, [first.primary], Pacing);
  const refreshed = quest('stable-copy', 'standard', 1, { title: 'Новый текст от resolver' }).quest;
  const second = Offers.planStandard(BoardV2, [refreshed], {}, state, { day: '2026-08-26', periodKey: '2026-W35' });
  assert.equal(second.source, 'account-snapshot');
  assert.equal(second.primary.title, 'Первая точная версия');
  assert.equal(second.plan, null);
});

test('different resolved content gets a different immutable snapshot id', () => {
  const left = quest('same-template', 'standard', 1, { title: 'Вариант один' }).quest;
  const right = quest('same-template', 'standard', 1, { title: 'Вариант два' }).quest;
  const a = Offers.snapshotQuest(BoardV2, left, { day: '2026-08-25', mode: 'standard' });
  const b = Offers.snapshotQuest(BoardV2, right, { day: '2026-08-25', mode: 'standard' });
  assert.notEqual(a.id, b.id);
  assert.equal(a.reward.xp, left.reward.xp);
  assert.equal(a.completion.proofModes[0], 'result');
});

test('snapshot strips arbitrary GPS and raw provider data', () => {
  const resolved = quest('privacy-snapshot', 'standard', 1).quest;
  const attacked = { ...resolved, injected: { latitude: 52.03, rawProviderPayload: 'secret' } };
  assert.equal(Offers.snapshotQuest(BoardV2, attacked, { day: '2026-08-25', mode: 'standard' }), null, 'forged resolved quest must fail');
  const snapshot = Offers.snapshotQuest(BoardV2, resolved, { day: '2026-08-25', mode: 'standard' });
  assert.doesNotMatch(JSON.stringify(snapshot), /latitude|rawProviderPayload|52\.03|secret/);
});

test('manual unexpected and passive weekly paths share snapshot contract', () => {
  const wildcard = quest('surprise', 'wildcard', 1).quest;
  const state = Offers.emptyState(Pacing);
  const passive = Offers.planUnexpected(BoardV2, Pacing, [wildcard], {}, state, {
    mode: 'passive', day: '2026-08-25', weekKey: '2026-W35', seed: 'alpha',
  });
  assert.equal(passive.ok, true);
  assert.equal(passive.snapshot.mode, 'passive');
  const shown = Offers.recordUnexpectedDisplayed(state, passive, Pacing);
  assert.equal(shown.snapshots.length, 1);
  assert.equal(Pacing.passiveEligibility(shown.pacing, '2026-W35').reason, 'weekly-cap');
  assert.equal(Offers.planUnexpected(BoardV2, Pacing, [wildcard], {}, shown, {
    mode: 'passive', day: '2026-08-26', weekKey: '2026-W35', seed: 'beta',
  }).reason, 'weekly-cap');
});

test('return, reject and completion have distinct cooldowns', () => {
  const resolved = quest('cooldown-target', 'standard', 1).quest;
  const plan = Offers.planStandard(BoardV2, [resolved], {}, Offers.emptyState(Pacing), { day: '2026-08-01', periodKey: 'p1' });
  let state = Offers.recordStandardDisplayed(Offers.emptyState(Pacing), plan.plan, [plan.primary], Pacing);
  state = Offers.recordOutcome(state, plan.primary.id, 'returned', '2026-08-01', Pacing);
  assert.equal(Offers.planStandard(BoardV2, [resolved], {}, state, { day: '2026-08-14', periodKey: 'p2' }).reason, 'no-resolved-standard');
  assert.equal(Offers.planStandard(BoardV2, [resolved], {}, state, { day: '2026-08-15', periodKey: 'p2' }).ok, true);
  state = Offers.recordOutcome(state, plan.primary.id, 'rejected', '2026-08-01', Pacing);
  assert.equal(Offers.planStandard(BoardV2, [resolved], {}, state, { day: '2026-08-30', periodKey: 'p3' }).reason, 'no-resolved-standard');
  state = Offers.recordOutcome(state, plan.primary.id, 'completed', '2026-08-01', Pacing);
  assert.equal(Offers.planStandard(BoardV2, [resolved], {}, state, { day: '2026-11-28', periodKey: 'p4' }).reason, 'no-resolved-standard');
  assert.equal(Offers.planStandard(BoardV2, [resolved], {}, state, { day: '2026-11-29', periodKey: 'p5' }).ok, true);
});

test('corrupt state is bounded and unknown snapshots fail closed', () => {
  const resolved = quest('bounded', 'standard', 1).quest;
  const base = Offers.snapshotQuest(BoardV2, resolved, { day: '2026-08-25', mode: 'standard' });
  const snapshots = Array.from({ length: 140 }, (_, index) => ({ ...base, id: `bounded@1.${index}` }));
  const history = Array.from({ length: 250 }, (_, index) => ({ snapshotId: base.id, templateId: base.templateId, at: '2026-08-25', outcome: index % 2 ? 'taken' : 'displayed' }));
  const state = Offers.normalizeState({
    schema: Offers.STATE_SCHEMA, snapshots, history,
    current: { periodKey: 'old', snapshotIds: ['bounded@1.0'], selectedId: 'bounded@1.0' },
  }, Pacing);
  assert.equal(state.snapshots.length, Offers.MAX_SNAPSHOTS);
  assert.equal(state.history.length, Offers.MAX_HISTORY);
  assert.equal(state.current, null, 'current cannot point at an evicted snapshot');
  assert.equal(Offers.snapshotById(state, 'missing', Pacing), null);
});

test('offer persistence stays dormant until Board v2 UI integration', () => {
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(index, /board-v2-offers\.js/);
  assert.doesNotMatch(sw, /board-v2-offers\.js/);
});
