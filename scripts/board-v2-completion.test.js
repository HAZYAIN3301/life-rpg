'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const BoardV1 = require('../public/board-v1.js');
const BoardV2 = require('../public/board-v2.js');
const Pacing = require('../public/board-v2-pacing.js');
const Offers = require('../public/board-v2-offers.js');
const Completion = require('../public/board-v2-completion.js');

const DAY = '2026-08-25';
const AT = '2026-08-25T18:00:00.000Z';

function setup(options) {
  const settings = options || {};
  const template = BoardV2.compileTemplate({
    schema: BoardV2.TEMPLATE_SCHEMA,
    id: settings.id || 'guided-recovery', revision: 1, kind: settings.kind || 'recovery', scale: settings.scale || 'session',
    tags: ['recovery', 'stress'], interests: ['recovery'], slots: [],
    copy: { title: settings.title || 'Проведи восстановительный вечер', details: 'Растяжка, душ и ранний сон уже выбраны.' },
    completion: {
      proofModes: settings.proofModes || ['reflection', 'photo'],
      proofRequired: settings.proofRequired === true,
      share: 'optional',
    },
    followUp: settings.followUp === false ? null : {
      interventionId: 'guided-recovery-evening',
      question: 'Тебе стало спокойнее или голова всё ещё перегружена?',
      contextTags: ['overloaded', 'needs-recovery'],
    },
    reward: settings.reward || { xp: 120, title: settings.titleReward },
    adventure: { class: 'standard', safetyTier: 'ordinary', requiredFlags: [] },
  });
  const resolved = BoardV2.instantiate(template, { fit: { confidence: 1, interest: 1 } });
  assert.equal(resolved.ok, true);
  const planned = Offers.planStandard(BoardV2, [resolved.quest], {}, Offers.emptyState(Pacing), { day: DAY, periodKey: '2026-W35' });
  const offers = Offers.recordStandardDisplayed(Offers.emptyState(Pacing), planned.plan, [planned.primary], Pacing);
  return { snapshot: planned.primary, offers, board: BoardV1.emptyState(), completion: Completion.emptyState() };
}

function input(state, extra) {
  return Object.assign({
    boardApi: BoardV1, offersApi: Offers, pacingApi: Pacing,
    board: state.board, offers: state.offers, completion: state.completion,
    snapshotId: state.snapshot.id, today: DAY,
  }, extra || {});
}

test('take advances legacy active ledger and exact Board v2 snapshot together', () => {
  const state = setup();
  const taken = Completion.prepareTake(input(state));
  assert.equal(taken.ok, true);
  assert.equal(taken.board.active[0].orderId, state.snapshot.id);
  assert.equal(taken.offers.history.at(-1).outcome, 'taken');
  assert.equal(taken.snapshot.title, state.snapshot.title);
});

test('return is consequence-free but rests the exact snapshot for fourteen days', () => {
  const state = setup();
  const taken = Completion.prepareTake(input(state));
  const returned = Completion.prepareReturn(input({ ...state, board: taken.board, offers: taken.offers }));
  assert.equal(returned.ok, true);
  assert.equal(returned.board.active.length, 0);
  assert.deepEqual(returned.board.rested, [{ orderId: state.snapshot.id, restedAt: DAY }]);
  assert.equal(returned.offers.history.at(-1).outcome, 'returned');
  assert.equal(returned.offers.history.some((entry) => entry.outcome === 'completed'), false);
});

test('completion derives the authored reward and one atomic task draft', () => {
  const state = setup({ reward: { xp: 140 } });
  const taken = Completion.prepareTake(input(state));
  const done = Completion.prepareCompletion(input({ ...state, board: taken.board, offers: taken.offers }, {
    taskId: 'task-board-v2', completedAt: AT,
    proof: { mode: 'reflection', result: 'Стало спокойнее.' }, skillId: 'body',
  }));
  assert.equal(done.ok, true);
  assert.equal(done.task.title, state.snapshot.title);
  assert.equal(done.task.xpAwarded, 140);
  assert.equal(done.task.goldAwarded, 49);
  assert.equal(done.task.fromBoardV2, true);
  assert.equal(done.task.boardSnapshotId, state.snapshot.id);
  assert.deepEqual(done.task.skillIds, ['body']);
  assert.equal(done.offers.history.at(-1).outcome, 'completed');
  assert.equal(done.board.active.length, 0);
});

test('required natural proof fails closed; media stores only a private reference id', () => {
  const state = setup({ proofRequired: true, proofModes: ['photo'] });
  const taken = Completion.prepareTake(input(state));
  const base = input({ ...state, board: taken.board, offers: taken.offers }, { taskId: 'task', completedAt: AT });
  assert.equal(Completion.prepareCompletion(base).reason, 'proof-required');
  assert.equal(Completion.prepareCompletion({ ...base, proof: { mode: 'photo' } }).reason, 'media-reference-required');
  const done = Completion.prepareCompletion({ ...base, proof: { mode: 'photo', referenceId: 'boardmedia:private-1', raw: 'data:image/png;base64,secret' } });
  assert.equal(done.ok, true);
  assert.deepEqual(done.proof, { mode: 'photo', referenceId: 'boardmedia:private-1' });
  assert.doesNotMatch(JSON.stringify(done), /base64|secret/);
  assert.equal(done.proofPlan.shareOptional, true);
});

test('unsupported proof and forged snapshot cannot mint XP', () => {
  const state = setup();
  const taken = Completion.prepareTake(input(state));
  const base = input({ ...state, board: taken.board, offers: taken.offers }, { taskId: 'task', completedAt: AT });
  assert.equal(Completion.prepareCompletion({ ...base, proof: { mode: 'checkin' } }).reason, 'unsupported-proof');
  assert.equal(Completion.prepareCompletion({ ...base, snapshotId: 'forged@1.x' }).reason, 'completion-context-required');
});

test('large authored quest can return a title unlock without awarding it on take', () => {
  const state = setup({ scale: 'arc', reward: { xp: 700, title: 'Dungeon Master' } });
  const taken = Completion.prepareTake(input(state));
  assert.equal(taken.unlock, undefined);
  const done = Completion.prepareCompletion(input({ ...state, board: taken.board, offers: taken.offers }, {
    taskId: 'task', completedAt: AT,
    proof: { mode: 'reflection', result: 'Три сессии завершены.' },
  }));
  assert.deepEqual(done.unlock, { type: 'title', id: 'Dungeon Master' });
  assert.equal(done.task.xpAwarded, 700);
});

test('completion queues one useful Shadow question and answer becomes intervention memory', () => {
  const state = setup();
  const taken = Completion.prepareTake(input(state));
  const done = Completion.prepareCompletion(input({ ...state, board: taken.board, offers: taken.offers }, {
    taskId: 'task', completedAt: AT,
    proof: { mode: 'reflection', result: 'Стало легче.' },
  }));
  assert.equal(done.completion.pending.length, 1);
  assert.equal(done.completion.pending[0].question, 'Тебе стало спокойнее или голова всё ещё перегружена?');
  const answered = Completion.answerFollowUp(done.completion, state.snapshot.id, 'helped', '2026-08-26');
  assert.equal(answered.ok, true);
  assert.equal(answered.state.pending.length, 0);
  assert.deepEqual(Completion.knownHelp(answered.state, ['overloaded']), [{ interventionId: 'guided-recovery-evening', score: 2 }]);
});

test('neutral or negative answer does not become a future positive suggestion', () => {
  for (const outcome of ['neutral', 'did-not-help']) {
    const state = setup({ id: `recovery-${outcome}` });
    const taken = Completion.prepareTake(input(state));
    const done = Completion.prepareCompletion(input({ ...state, board: taken.board, offers: taken.offers }, {
      taskId: `task-${outcome}`, completedAt: AT,
      proof: { mode: 'reflection', result: 'Ответ.' },
    }));
    const answered = Completion.answerFollowUp(done.completion, state.snapshot.id, outcome, '2026-08-26');
    assert.deepEqual(Completion.knownHelp(answered.state, ['overloaded']), []);
  }
});

test('quest without follow-up does not invent psychological memory', () => {
  const state = setup({ followUp: false });
  const taken = Completion.prepareTake(input(state));
  const done = Completion.prepareCompletion(input({ ...state, board: taken.board, offers: taken.offers }, {
    taskId: 'task', completedAt: AT,
    proof: { mode: 'reflection', result: 'Готово.' },
  }));
  assert.equal(done.completion.pending.length, 0);
});

test('completion state is bounded and corrupt answers fail closed', () => {
  const pending = Array.from({ length: 30 }, (_, index) => ({
    snapshotId: `snapshot-${index}`, interventionId: `intervention-${index}`,
    question: 'Полезный вопрос?', contextTags: ['context'], completedAt: DAY,
  }));
  const records = Array.from({ length: 130 }, (_, index) => ({
    interventionId: `intervention-${index}`, outcome: 'helped', contextTags: ['context'], at: DAY,
  }));
  const state = Completion.normalizeState({ schema: Completion.STATE_SCHEMA, pending, records });
  assert.equal(state.pending.length, Completion.MAX_PENDING);
  assert.equal(state.records.length, Completion.MAX_RECORDS);
  assert.equal(Completion.answerFollowUp(state, 'missing', 'helped', DAY).reason, 'follow-up-not-pending');
  assert.equal(Completion.answerFollowUp(state, state.pending[0].snapshotId, 'yes', DAY).reason, 'invalid-answer');
});
