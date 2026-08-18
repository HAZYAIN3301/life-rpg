'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../public/guide-v3.js');

test('Guide v3 defaults and normalization are safe', () => {
  assert.equal(G.defaultState().version, 3);
  assert.equal(G.defaultState().firstRunForm, 'spark');
  const state = G.normalize({ enabled: false, completedSteps: ['a', 'a', null], firstRunForm: 'wrong', voiceConsent: false });
  assert.equal(state.enabled, false);
  assert.deepEqual(state.completedSteps, ['a']);
  assert.equal(state.firstRunForm, 'spark');
  assert.equal(state.voiceConsent, false);
});

test('legacy completed tutorial does not run again but remains replayable', () => {
  const state = G.migrate(null, { done: true, seenDrips: ['d_habits'] });
  assert.equal(G.chapterResolved(state, G.FIRST_CHAPTER), true);
  assert.ok(state.seenPrompts.includes('legacy:d_habits'));
  assert.equal(state.completedSteps.length, G.FIRST_STEPS.length);
  const replay = G.reduce(state, { type: 'guide:replay', chapter: G.FIRST_CHAPTER });
  assert.equal(replay.accepted, true);
  assert.equal(replay.state.currentStep, 'welcome');
  assert.ok(replay.state.completedChapters.includes(G.FIRST_CHAPTER), 'replay keeps history');
});

test('legacy skipped tutorial resolves only the first chapter, not contextual help', () => {
  const state = G.migrate(null, { skipped: true });
  assert.ok(state.skippedChapters.includes(G.FIRST_CHAPTER));
  assert.equal(state.enabled, true);
  const habits = G.REGISTRY.find((entry) => entry.id === 'habits');
  assert.equal(G.entryEligible(habits, state, { completedTasks: 2 }), true);
});

test('seed adapter chooses a deterministic real task and recognizes its sphere/goal', () => {
  const seed = G.guideSeed({
    today: '2026-08-18',
    tasks: [
      { id: 'later', title: 'Later', date: '2026-08-20', createdAt: '2026-08-01' },
      { id: 'b', title: 'Second', date: '2026-08-18', skillId: 's', createdAt: '2026-08-18T09:00:00Z' },
      { id: 'a', title: 'First', date: '2026-08-18', skillId: 's', goalId: 'g', createdAt: '2026-08-18T08:00:00Z' },
    ],
    skills: [{ id: 's', name: 'Учёба' }],
    goals: [{ id: 'g', title: 'Сдать экзамен' }],
  });
  assert.deepEqual(seed, { branch: 'task', taskId: 'a', taskTitle: 'First', skillId: 's', skillName: 'Учёба', goalId: 'g', goalTitle: 'Сдать экзамен' });
});

test('seed adapter supports sphere-only and blank branches', () => {
  assert.equal(G.guideSeed({ tasks: [], skills: [{ id: 's', name: 'Спорт' }] }).branch, 'sphere');
  assert.equal(G.guideSeed({ tasks: [], skills: [] }).branch, 'blank');
});

test('First Journey advances only on a persisted real task loop', () => {
  let r = G.reduce(G.defaultState(), { type: 'guide:start' });
  assert.equal(r.state.currentStep, 'welcome');
  r = G.reduce(r.state, { type: 'guide:next' });
  r = G.reduce(r.state, { type: 'guide:next' });
  assert.equal(r.state.currentStep, 'choose');

  const rejectedSelect = G.reduce(r.state, { type: 'guide:select-task', taskId: 'q1', persisted: false });
  assert.equal(rejectedSelect.accepted, false);
  assert.equal(rejectedSelect.state.currentStep, 'choose');

  r = G.reduce(r.state, { type: 'guide:select-task', taskId: 'q1', persisted: true });
  assert.equal(r.metric, 'guide:first_step_selected');
  r = G.reduce(r.state, { type: 'guide:started', focus: false, persisted: true });
  assert.equal(r.state.currentStep, 'wait');

  assert.equal(G.reduce(r.state, { type: 'task:completed', taskId: 'other', persisted: true }).accepted, false);
  assert.equal(G.reduce(r.state, { type: 'task:completed', taskId: 'q1', persisted: false }).accepted, false);
  r = G.reduce(r.state, { type: 'task:completed', taskId: 'q1', persisted: true });
  assert.equal(r.metric, 'guide:first_real_completion');
  assert.equal(r.state.currentStep, 'victory');

  r = G.reduce(r.state, { type: 'guide:next' });
  r = G.reduce(r.state, { type: 'guide:next' });
  assert.equal(r.state.currentStep, 'bond');
  assert.equal(G.reduce(r.state, { type: 'guide:bond', persisted: false }).accepted, false);
  r = G.reduce(r.state, { type: 'guide:bond', persisted: true });
  r = G.reduce(r.state, { type: 'guide:finish', at: 123 });
  assert.equal(r.state.currentChapter, null);
  assert.ok(r.state.completedChapters.includes(G.FIRST_CHAPTER));
});

test('skip, snooze and disable are independent choices', () => {
  const running = G.reduce(G.defaultState(), { type: 'guide:start' }).state;
  const snooze = G.reduce(running, { type: 'guide:snooze', now: 10, until: 20 });
  assert.equal(snooze.state.currentStep, 'welcome');
  assert.equal(snooze.state.snoozedUntil, 20);
  const skipped = G.reduce(snooze.state, { type: 'guide:skip', at: 30 });
  assert.equal(skipped.state.enabled, true);
  assert.ok(skipped.state.skippedChapters.includes(G.FIRST_CHAPTER));
  const disabled = G.reduce(skipped.state, { type: 'guide:disable' });
  assert.equal(disabled.state.enabled, false);
});

test('contextual registry is deterministic and offers at most one next chapter', () => {
  const state = G.migrate(null, { done: true });
  const first = G.nextContextual(state, { completedTasks: 2, activeDays: 2, level: 4, ttsReady: true, now: 100 });
  assert.equal(first.id, 'habits', 'registry order paces simultaneous unlocks');
  const started = G.reduce(state, { type: 'guide:start', chapter: 'habits' }).state;
  assert.equal(G.nextContextual(started, { completedTasks: 2, level: 4 }), null, 'no second prompt while a chapter is active');
});

test('pure module has no application or DOM dependencies', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'guide-v3.js'), 'utf8');
  for (const forbidden of ['State.', 'document.', 'window.', 'Store.', 'fetch(']) {
    assert.equal(src.includes(forbidden), false, `module leaked dependency: ${forbidden}`);
  }
});
