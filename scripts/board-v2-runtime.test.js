'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Board = require('../public/board-v2.js');
const Pacing = require('../public/board-v2-pacing.js');
const Offers = require('../public/board-v2-offers.js');
const Completion = require('../public/board-v2-completion.js');
const Catalog = require('../public/board-v2-catalog.js');
const Issuer = require('../public/board-v2-issuer.js');
const WildcardCatalog = require('../public/board-v2-wildcard-catalog.js');
const WildcardIssuer = require('../public/board-v2-wildcard-issuer.js');
const Runtime = require('../public/board-v2-runtime.js');
const BoardV1 = require('../public/board-v1.js');

const ROOT = path.resolve(__dirname, '..');
const DAY = '2026-08-25', AT = `${DAY}T18:00:00.000Z`;
function snapshot() {
  const compiled = Board.compileTemplate({
    schema: 'satoru.board-template/2', id: 'runtime-local', revision: 1, kind: 'experience', scale: 'expedition',
    tags: ['local', 'sport'], interests: ['sport'], slots: [], copy: { title: 'Попробуй конкретную секцию', details: 'Время и запись проверены.' },
    completion: { proofModes: ['photo'], proofRequired: true, share: 'optional' },
    followUp: { interventionId: 'runtime-local', question: 'Это стоило повторить?', contextTags: ['sport', 'novelty'] },
    adventure: { class: 'standard', safetyTier: 'ordinary', requiredFlags: [] },
    reward: { tier: 3, xp: 220, titleEligible: true, title: 'Проводник' },
  });
  const quest = Board.instantiate(compiled, {}).quest;
  return Offers.snapshotQuest(Board, quest, { day: DAY, mode: 'standard' });
}
function context(action) {
  const item = snapshot();
  const settings = {
    board: { version: 1, active: [], done: [], rested: [], custom: [{ id: 'mine', title: 'Мой заказ' }] },
    boardV2Offers: { schema: Offers.STATE_SCHEMA, current: null, snapshots: [item], history: [], pacing: Pacing.emptyState() },
    boardV2Completion: Completion.emptyState(), boardV2Titles: [], marker: 'preserved',
  };
  return {
    action, boardApi: BoardV1, offersApi: Offers, completionApi: Completion, pacingApi: Pacing,
    settings, tasks: [{ id: 'existing', title: 'До заказа', done: false }], snapshotId: item.id,
    today: DAY, taskId: 'board-v2-task', completedAt: AT, skillId: 'sport',
    proof: { mode: 'photo', referenceId: 'board-media-private-1', raw: 'drop-me' },
  };
}

test('take creates one settings-only commit and preserves custom orders without mutating input', () => {
  const input = context('take'), before = { settings: structuredClone(input.settings), tasks: structuredClone(input.tasks) };
  const prepared = Runtime.prepare(input);
  assert.equal(prepared.ok, true);
  const payload = Runtime.payload(prepared.transaction);
  assert.deepEqual(Object.keys(payload.data), ['settings']);
  assert.equal(payload.data.settings.board.active[0].orderId, input.snapshotId);
  assert.deepEqual(payload.data.settings.board.custom, [{ id: 'mine', title: 'Мой заказ' }]);
  assert.deepEqual({ settings: input.settings, tasks: input.tasks }, before);
});

test('standard issue becomes one settings-only account transaction', () => {
  const input = context('take');
  const offer = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, input.settings.boardV2Offers, {
    day: DAY, periodKey: DAY,
  });
  const prepared = Runtime.prepareIssue({
    issuerApi: Issuer, boardApi: BoardV1, offersApi: Offers, pacingApi: Pacing, issue: offer,
    settings: input.settings, tasks: input.tasks,
  });
  assert.equal(prepared.ok, true);
  const payload = Runtime.payload(prepared.transaction);
  assert.deepEqual(Object.keys(payload.data), ['settings']);
  assert.equal(payload.data.settings.boardV2Offers.current.snapshotIds[0], offer.primary.id);
  assert.deepEqual(input.settings.boardV2Offers.snapshots.length, 1);
});

test('standard issue materializes Board v1 state for a legacy account', () => {
  const input = context('take');
  delete input.settings.board;
  const offer = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, input.settings.boardV2Offers, {
    day: DAY, periodKey: DAY,
  });
  const prepared = Runtime.prepareIssue({
    issuerApi: Issuer, boardApi: BoardV1, offersApi: Offers, pacingApi: Pacing, issue: offer,
    settings: input.settings, tasks: input.tasks,
  });
  assert.equal(prepared.ok, true);
  assert.deepEqual(Runtime.payload(prepared.transaction).data.settings.board, BoardV1.normalize(null));
  assert.equal(input.settings.board, undefined);
});

test('manual Wildcard is persisted without replacing the stable standard issue', () => {
  const input = context('take');
  const standard = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, input.settings.boardV2Offers, { day: DAY, periodKey: DAY });
  input.settings.boardV2Offers = Issuer.result(standard).nextOffers;
  const standardId = input.settings.boardV2Offers.current.snapshotIds[0];
  const offer = WildcardIssuer.issueManual(Board, WildcardCatalog, Offers, Pacing, {}, input.settings.boardV2Offers, {
    offline: { enabled: true, apps: 'TikTok' },
  }, { day: DAY, seed: 'manual-one' });
  const prepared = Runtime.prepareIssue({
    issuerApi: WildcardIssuer, boardApi: BoardV1, offersApi: Offers, pacingApi: Pacing, issue: offer,
    settings: input.settings, tasks: input.tasks,
  });
  assert.equal(prepared.ok, true);
  const next = Runtime.result(prepared.transaction).settings.boardV2Offers;
  assert.equal(prepared.transaction.action, 'issue-unexpected');
  assert.equal(next.current.snapshotIds[0], standardId);
  assert.equal(Offers.latestUnexpected(next, Pacing).id, offer.primary.id);
});

test('reject hides only a manual Wildcard and records the pacing signal', () => {
  const input = context('take');
  const offer = WildcardIssuer.issueManual(Board, WildcardCatalog, Offers, Pacing, {}, input.settings.boardV2Offers, {
    offline: { enabled: true, apps: 'TikTok' },
  }, { day: DAY, seed: 'manual-reject' });
  input.settings.boardV2Offers = WildcardIssuer.result(offer).nextOffers;
  input.action = 'reject'; input.snapshotId = offer.primary.id;
  const prepared = Runtime.prepare(input);
  assert.equal(prepared.ok, true);
  const next = Runtime.result(prepared.transaction).settings.boardV2Offers;
  assert.equal(Offers.latestUnexpected(next, Pacing), null);
  assert.deepEqual(next.pacing.rejections.at(-1), { templateId: offer.primary.templateId, at: DAY });
});

test('forged and already-stored issues cannot create another commit', () => {
  const input = context('take');
  assert.equal(Runtime.prepareIssue({
    issuerApi: Issuer, boardApi: BoardV1, offersApi: Offers, pacingApi: Pacing, issue: { ok: true, changed: true },
    settings: input.settings, tasks: input.tasks,
  }).reason, 'invalid-issue');
  const first = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, Offers.emptyState(Pacing), { day: DAY, periodKey: DAY });
  const stored = Issuer.result(first).nextOffers;
  const second = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, stored, { day: DAY, periodKey: DAY });
  assert.equal(Runtime.prepareIssue({
    issuerApi: Issuer, boardApi: BoardV1, offersApi: Offers, pacingApi: Pacing, issue: second,
    settings: { ...input.settings, boardV2Offers: stored }, tasks: input.tasks,
  }).reason, 'no-change');
});

test('return keeps tasks untouched and records the exact snapshot outcome', () => {
  const input = context('return');
  input.settings.board = BoardV1.takeOrder(input.settings.board, { id: input.snapshotId }, DAY).state;
  const prepared = Runtime.prepare(input);
  assert.equal(prepared.ok, true);
  const result = Runtime.result(prepared.transaction);
  assert.equal(result.tasks, null);
  assert.equal(result.settings.board.rested[0].orderId, input.snapshotId);
  assert.equal(result.settings.boardV2Offers.history.at(-1).outcome, 'returned');
});

test('completion atomically stores authored reward, private proof, Shadow follow-up and title', () => {
  const input = context('complete');
  input.settings.board = BoardV1.takeOrder(input.settings.board, { id: input.snapshotId }, DAY).state;
  const prepared = Runtime.prepare(input);
  assert.equal(prepared.ok, true);
  const payload = Runtime.payload(prepared.transaction), task = payload.data.tasks.at(-1);
  assert.deepEqual(Object.keys(payload.data).sort(), ['settings', 'tasks']);
  assert.equal(task.xpAwarded, 220); assert.equal(task.goldAwarded, 77);
  assert.deepEqual(task.boardProof, { mode: 'photo', referenceId: 'board-media-private-1' });
  assert.deepEqual(payload.data.settings.boardV2Titles, ['Проводник']);
  assert.equal(payload.data.settings.boardV2Completion.pending[0].snapshotId, input.snapshotId);
  assert.equal(payload.data.settings.marker, 'preserved');
});

test('required proof and duplicate completion fail before a transaction exists', () => {
  const missing = context('complete'); missing.proof = null;
  missing.settings.board = BoardV1.takeOrder(missing.settings.board, { id: missing.snapshotId }, DAY).state;
  assert.equal(Runtime.prepare(missing).reason, 'proof-required');
  const duplicate = context('complete'); duplicate.tasks.push({ id: 'old-board', fromBoardV2: true, boardSnapshotId: duplicate.snapshotId });
  assert.equal(Runtime.prepare(duplicate).reason, 'already-completed');
});

test('only a module-issued immutable transaction can produce commit data', () => {
  const fake = { schema: 'satoru.board-runtime-transaction/2', data: { settings: { board: {} } } };
  assert.equal(Runtime.payload(fake), null); assert.equal(Runtime.result(fake), null); assert.equal(Runtime.effects(fake), null);
  const prepared = Runtime.prepare(context('take'));
  assert.equal(Object.isFrozen(prepared.transaction), true);
  const left = Runtime.payload(prepared.transaction); left.data.settings.marker = 'attacker';
  assert.equal(Runtime.payload(prepared.transaction).data.settings.marker, 'preserved');
});

test('runtime bridge is pure and owns no DOM, State, fetch or persistence', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'board-v2-runtime.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:window|document|localStorage|sessionStorage|State|Store)\b/);
  assert.doesNotMatch(code, /fetch\s*\(/);
});
