'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Presenter = require('../public/guide-presenter-v1.js');
const Copy = require('../public/guide-v3-copy-ru.js');
const Guide = require('../public/guide-v3.js');

const FIRST = Guide.FIRST_CHAPTER;

function active(step, extra) {
  return {
    version: 3,
    currentChapter: FIRST,
    currentStep: step,
    selectedTaskId: null,
    chapterMeta: {},
    completedChapters: [],
    skippedChapters: [],
    ...(extra || {}),
  };
}

function present(step, options) {
  const opts = options || {};
  return Presenter.firstJourney({
    state: opts.state || active(step),
    seed: opts.seed || { branch: 'blank' },
    tasks: opts.tasks || [],
    chapter: FIRST,
    copy: Copy,
  });
}

test('task branch recognizes the real candidate and returns only a semantic task target', () => {
  const seed = {
    branch: 'task', taskId: 'quest/1', taskTitle: 'Повторить немецкий',
    skillId: 'de', skillName: 'Немецкий', goalId: 'b2', goalTitle: 'Сдать B2',
  };
  const vm = present('recognize', {
    seed,
    tasks: [{ id: 'quest/1', title: 'Повторить немецкий', skillId: 'de', goalId: 'b2', done: false }],
  });
  assert.equal(vm.branch, 'task');
  assert.equal(vm.candidateTaskId, 'quest/1');
  assert.equal(vm.transcriptKey, 'first.recognition.seed');
  assert.equal(vm.transcript, Copy.format('first.recognition.seed', {
    goalOrSphere: 'Сдать B2', firstQuest: 'Повторить немецкий',
  }));
  assert.equal(vm.targetKey, 'task');
  assert.equal(vm.taskId, 'quest/1');
  assert.equal(vm.targetSelector, null, 'task-specific selector belongs to the app adapter with CSS.escape');
  assert.equal(vm.formHint, null);
  assert.equal(vm.choices[0].id, 'quest/1');
  assert.equal(vm.actions[0].event, 'guide:recognize-task');
  assert.equal(vm.actions[0].persistedRequired, true);
});

test('sphere branch requests one real task with a preselected sphere', () => {
  const vm = present('recognize', {
    seed: { branch: 'sphere', skillId: 'sport', skillName: 'Спорт' },
  });
  assert.equal(vm.branch, 'sphere');
  assert.equal(vm.transcript, Copy.get('first.recognition.create'));
  assert.equal(vm.targetKey, 'quick-add');
  assert.equal(vm.targetSelector, '[data-guide-target="quick-add"]');
  assert.deepEqual(vm.formHint, {
    mode: 'create-task',
    branch: 'sphere',
    labelKey: 'first.create.label',
    label: Copy.get('first.create.label'),
    placeholderKey: 'first.create.placeholder',
    placeholder: Copy.get('first.create.placeholder'),
    sphereLabelKey: 'first.create.sphere_label',
    sphereLabel: Copy.get('first.create.sphere_label'),
    defaultSphereId: 'sport',
    defaultSphereName: 'Спорт',
    requiresSphereChoice: false,
  });
  assert.equal(vm.actions[0].formAction, true);
});

test('blank branch does not invent a sphere or task', () => {
  const vm = present('recognize', { seed: { branch: 'blank' } });
  assert.equal(vm.branch, 'blank');
  assert.equal(vm.candidateTaskId, null);
  assert.equal(vm.selectedTaskId, null);
  assert.equal(vm.choices.length, 0);
  assert.equal(vm.formHint.defaultSphereId, null);
  assert.equal(vm.formHint.defaultSphereName, '');
  assert.equal(vm.formHint.requiresSphereChoice, true);
});

test('candidateTaskId and selectedTaskId drive choose/start without building id selectors', () => {
  const tasks = [
    { id: 'other', title: 'Другое', done: false },
    { id: 'q:1', title: 'Главное', done: false },
  ];
  const choose = present('choose', {
    state: active('choose', { chapterMeta: { [FIRST]: { candidateTaskId: 'q:1' } } }),
    seed: { branch: 'blank' }, tasks,
  });
  assert.equal(choose.candidateTaskId, 'q:1');
  assert.equal(choose.choices[0].id, 'q:1', 'candidate is first without mutating task input');
  assert.equal(choose.actions[0].taskId, 'q:1');
  assert.equal(choose.targetSelector, null);

  const start = present('start', {
    state: active('start', {
      selectedTaskId: 'q:1', chapterMeta: { [FIRST]: { candidateTaskId: 'q:1' } },
    }),
    seed: { branch: 'blank' }, tasks,
  });
  assert.equal(start.selectedTaskId, 'q:1');
  assert.equal(start.targetKey, 'task-start');
  assert.equal(start.taskId, 'q:1');
  assert.equal(start.targetSelector, null);
  assert.equal(start.actions[0].event, 'guide:started');
  assert.equal(start.actions[0].focus, true);
});

test('wait is always hidden and normal wait exposes no synthetic completion control', () => {
  const vm = present('wait', {
    state: active('wait', { selectedTaskId: 'q1' }),
    seed: { branch: 'task', taskId: 'q1', taskTitle: 'Настоящее дело' },
    tasks: [{ id: 'q1', title: 'Настоящее дело', done: false }],
  });
  assert.equal(vm.hidden, true);
  assert.equal(vm.targetSelector, null);
  assert.equal(vm.actions.length, 0);
  assert.equal(vm.transcript, Copy.get('first.wait'));
});

test('victory, mastery, bond and release use only centralized copy and static targets', () => {
  const cases = [
    ['victory', 'first.victory', 'quest-reward'],
    ['mastery', 'first.level_form', 'level'],
    ['bond', 'first.bond', 'shadow-contact'],
    ['release', 'first.release', 'guide-library'],
  ];
  for (const [step, key, targetKey] of cases) {
    const vm = present(step, {
      state: active(step, { selectedTaskId: 'q1' }),
      seed: { branch: 'task', taskId: 'q1', taskTitle: 'Дело' },
      tasks: [{ id: 'q1', title: 'Дело', done: true }],
    });
    assert.equal(vm.transcriptKey, key);
    assert.equal(vm.transcript, Copy.get(key));
    assert.equal(vm.targetKey, targetKey);
    assert.match(vm.targetSelector, /^\[data-guide-target="[a-z0-9_-]+"\]$/);
  }
  assert.equal(present('release').teaser, Copy.get('first.teaser'));
});

test('replay is a presentation-only sequence with no task choices or persisted actions', () => {
  for (const step of Presenter.FIRST_STEPS) {
    const state = active(step, {
      selectedTaskId: null,
      completedChapters: [FIRST],
      chapterMeta: { [FIRST]: { replay: true } },
    });
    const vm = present(step, {
      state,
      seed: { branch: 'task', taskId: 'q1', taskTitle: 'Старое дело', skillName: 'Учёба' },
      tasks: [{ id: 'q1', title: 'Старое дело', done: true }],
    });
    assert.equal(vm.replay, true);
    assert.equal(vm.presentationOnly, true);
    assert.equal(vm.textOnlyArt, true);
    assert.equal(vm.choices.length, 0);
    assert.equal(vm.formHint, null);
    assert.ok(vm.actions.length >= 1);
    assert.equal(vm.actions.some((item) => item.persistedRequired), false);
    assert.ok(vm.actions.every((item) => ['guide:next', 'guide:finish', 'guide:speak', 'guide:skip'].includes(item.event)));
  }
  const wait = present('wait', {
    state: active('wait', { completedChapters: [FIRST], chapterMeta: { [FIRST]: { replay: true } } }),
  });
  assert.equal(wait.hidden, true);
  assert.equal(wait.actions[0].event, 'guide:next');
  assert.equal(wait.actions[0].automatic, true);
});

test('generic selectors are static data-guide-target selectors only', () => {
  for (const step of Presenter.FIRST_STEPS) {
    const vm = present(step, {
      state: active(step, { selectedTaskId: 'unsafe/id' }),
      seed: { branch: 'task', taskId: 'unsafe/id', taskTitle: 'Дело' },
      tasks: [{ id: 'unsafe/id', title: 'Дело', done: false }],
    });
    if (vm.targetSelector != null) assert.match(vm.targetSelector, /^\[data-guide-target="[a-z0-9_-]+"\]$/);
    assert.ok(!String(vm.targetSelector).includes('unsafe/id'));
  }
});

test('library cards expose current/completed/available/locked/deferred and Goals are always deferred', () => {
  const state = {
    currentChapter: 'habits',
    completedChapters: [FIRST, 'goals'],
    skippedChapters: ['notes'],
  };
  const cards = Presenter.libraryCards(state, {
    availableChapters: ['calendar'],
    deferredChapters: ['stats'],
  }, Guide.REGISTRY, Copy);
  const byId = Object.fromEntries(cards.map((card) => [card.id, card]));
  assert.equal(byId[FIRST].status, 'completed');
  assert.equal(byId[FIRST].actionLabel, Copy.get('system.action.replay'));
  assert.equal(byId.habits.status, 'current');
  assert.equal(byId.habits.actionLabel, Copy.get('system.action.resume'));
  assert.equal(byId.notes.status, 'available');
  assert.equal(byId.notes.replay, true);
  assert.equal(byId.calendar.status, 'available');
  assert.equal(byId.den.status, 'locked');
  assert.equal(byId.stats.status, 'deferred');
  assert.equal(byId.goals.status, 'deferred', 'Goals stay deferred even if stale state says completed');
  assert.equal(byId.goals.description, Copy.get('library.goals.deferred'));
  for (const card of cards) {
    assert.equal(card.title, Copy.get(card.titleKey));
    assert.equal(card.statusLabel, Copy.get(card.statusKey));
    if (card.actionKey) assert.equal(card.actionLabel, Copy.get(card.actionKey));
  }
});

test('presenter tolerates missing input/copy without inventing fallback prose', () => {
  const vm = Presenter.present(null);
  assert.equal(vm.chapter, FIRST);
  assert.equal(vm.step, 'welcome');
  assert.equal(vm.title, '');
  assert.equal(vm.transcript, '');
  assert.equal(vm.progress, '');
  assert.deepEqual(Presenter.libraryCards(null, null, null, null), []);
});

test('UMD module is pure and available through CommonJS and a global', () => {
  assert.equal(Presenter.VERSION, '1.0.0');
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'guide-presenter-v1.js'), 'utf8');
  for (const forbidden of ['State.', 'document.', 'window.', 'Store.', 'fetch(', 'CSS.escape']) {
    assert.equal(source.includes(forbidden), false, `presenter leaked dependency: ${forbidden}`);
  }
  const vm = require('node:vm');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  assert.equal(sandbox.GuidePresenterV1.VERSION, '1.0.0');
});
