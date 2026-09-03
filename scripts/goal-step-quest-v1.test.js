const test = require('node:test');
const assert = require('node:assert/strict');
const StepQuest = require('../public/goal-step-quest-v1.js');

const TODAY = '2026-09-02';

function goal(patch = {}) {
  return {
    id: 'g_1', title: 'Сдать регистрацию', archived: false, completedAt: null,
    skillId: 'sk_body', skillIds: ['sk_body'], backgroundSkillIds: [],
    steps: [{ id: 's_1', title: 'Написать абзац о методе', done: false }],
    ...patch,
  };
}

function plan(patch = {}) {
  return StepQuest.planStepQuest({
    goal: goal(), stepId: 's_1', tasks: [], today: TODAY, id: 't_new',
    skillId: 'sk_body', skillIds: ['sk_body'], layers: [], createdAt: '2026-09-02T07:00:00.000Z',
    ...patch,
  });
}

test('the open step is the one the goal already calls «Следующий шаг»', () => {
  assert.equal(StepQuest.openStepOf(goal()).id, 's_1');
  assert.equal(StepQuest.openStepOf(goal({ steps: [{ id: 's_1', title: 'a', done: true }] })), null);
  assert.equal(StepQuest.openStepOf(goal({ steps: [{ id: 's_1', title: '  ', done: false }] })), null);
  assert.equal(StepQuest.openStepOf(goal({ steps: undefined })), null, 'цель с числовой метрикой шагов не имеет');
  assert.equal(StepQuest.openStepOf(null), null);
});

test('a step becomes exactly the quest the goal form already makes by hand', () => {
  const result = plan();
  assert.equal(result.status, 'create');
  assert.deepEqual(result.task, {
    id: 't_new', title: 'Написать абзац о методе', goalId: 'g_1', stepSourceId: 's_1',
    skillId: 'sk_body', skillIds: ['sk_body'], layers: [],
    estimateMin: StepQuest.QUEST_ESTIMATE_MIN, difficulty: StepQuest.QUEST_DIFFICULTY,
    date: TODAY, done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0,
    actualMin: null, startTime: null, createdAt: '2026-09-02T07:00:00.000Z',
  });
  assert.equal(StepQuest.QUEST_ESTIMATE_MIN, 30);
  assert.equal(StepQuest.QUEST_DIFFICULTY, 'normal');
});

test('the title is trimmed to the same limit the goal step input accepts', () => {
  const long = 'ш'.repeat(400);
  const result = plan({ goal: goal({ steps: [{ id: 's_1', title: `  ${long}  `, done: false }] }) });
  assert.equal(result.task.title.length, 160);
});

test('missing spheres never invent one, and the primary follows the list', () => {
  const bare = plan({ skillId: '', skillIds: [], layers: null });
  assert.equal(bare.task.skillId, null);
  assert.deepEqual(bare.task.skillIds, []);
  assert.deepEqual(bare.task.layers, []);
  const derived = plan({ skillId: '', skillIds: ['sk_mind', 'sk_body'], layers: ['sk_home', ''] });
  assert.equal(derived.task.skillId, 'sk_mind');
  assert.deepEqual(derived.task.layers, ['sk_home']);
});

test('nothing is invented when the inputs do not justify a quest', () => {
  assert.deepEqual(plan({ goal: null }), { status: 'invalid', reason: 'goal_missing' });
  assert.deepEqual(plan({ goal: goal({ archived: true }) }), { status: 'invalid', reason: 'goal_archived' });
  assert.deepEqual(plan({ id: '' }), { status: 'invalid', reason: 'id_missing' });
  assert.equal(plan({ stepId: 'nope' }).status, 'step_missing');
  assert.equal(plan({ stepId: '' }).status, 'step_missing');
  assert.equal(plan({ goal: goal({ steps: [{ id: 's_1', title: 'a', done: true }] }) }).status, 'step_done');
});

test('a calendar-impossible date is refused instead of becoming today', () => {
  for (const today of ['2026-02-31', '2026-13-01', '02.09.2026', '', null, '2026-9-2']) {
    assert.deepEqual(plan({ today }), { status: 'invalid', reason: 'invalid_date' }, String(today));
  }
  assert.equal(plan({ today: '2028-02-29' }).status, 'create', 'настоящий високосный день — законная дата');
});

test('a step already standing in the day never gets a second quest', () => {
  const open = { id: 't_open', goalId: 'g_1', stepSourceId: 's_1', done: false };
  const result = plan({ tasks: [{ id: 't_other', goalId: 'g_1', done: false }, open] });
  assert.equal(result.status, 'exists');
  assert.equal(result.taskId, 't_open');
  assert.equal(result.task, open);
  assert.equal(StepQuest.questForStep([open], 'g_1', 's_1').id, 't_open');
  assert.equal(StepQuest.questForStep([open], 'g_1', 's_2'), null);
  assert.equal(StepQuest.questForStep([open], 'g_2', 's_1'), null);
});

test('a finished quest frees the step to be taken into the day again', () => {
  const done = { id: 't_done', goalId: 'g_1', stepSourceId: 's_1', done: true };
  assert.equal(StepQuest.questForStep([done], 'g_1', 's_1'), null);
  const result = plan({ tasks: [done], goal: goal({ steps: [{ id: 's_1', title: 'Ещё раз', done: false }] }) });
  assert.equal(result.status, 'create');
});

test('half a link is not a link', () => {
  assert.deepEqual(StepQuest.stepLinkOf({ goalId: 'g_1', stepSourceId: 's_1' }), { goalId: 'g_1', stepId: 's_1' });
  assert.equal(StepQuest.stepLinkOf({ goalId: 'g_1' }), null);
  assert.equal(StepQuest.stepLinkOf({ stepSourceId: 's_1' }), null);
  assert.equal(StepQuest.stepLinkOf({ goalId: '  ', stepSourceId: 's_1' }), null);
  assert.equal(StepQuest.stepLinkOf(null), null);
});

test('finishing the quest ticks its own step without touching the rest', () => {
  const goals = [goal({ id: 'g_0', steps: [{ id: 's_1', title: 'чужой', done: false }] }), goal()];
  const frozen = JSON.parse(JSON.stringify(goals));
  const task = { id: 't_1', goalId: 'g_1', stepSourceId: 's_1', done: true };
  const out = StepQuest.applyStepOutcome(goals, task, true);
  assert.equal(out.changed, true);
  assert.deepEqual(out.taskPatch, { stepTicked: true });
  assert.equal(out.goals[1].steps[0].done, true);
  assert.equal(out.goals[0].steps[0].done, false, 'одинаковый id шага в другой цели не трогается');
  assert.deepEqual(goals, frozen, 'вход не мутируется');
  assert.notEqual(out.goals, goals);
});

test('the goal is left alone when there is nothing to change', () => {
  const goals = [goal()];
  for (const task of [
    { id: 't', done: true },
    { id: 't', goalId: 'missing', stepSourceId: 's_1', done: true },
    { id: 't', goalId: 'g_1', stepSourceId: 'deleted', done: true },
  ]) {
    const out = StepQuest.applyStepOutcome(goals, task, true);
    assert.equal(out.changed, false);
    assert.equal(out.goals, goals);
    assert.equal(out.taskPatch, null);
  }
  assert.equal(StepQuest.applyStepOutcome(null, { goalId: 'g_1', stepSourceId: 's_1' }, true).changed, false);
});

test('undo removes only the tick the quest itself put there', () => {
  const ticked = [goal({ steps: [{ id: 's_1', title: 'шаг', done: true }] })];
  const mine = { id: 't_1', goalId: 'g_1', stepSourceId: 's_1', done: false, stepTicked: true };
  const undone = StepQuest.applyStepOutcome(ticked, mine, false);
  assert.equal(undone.changed, true);
  assert.equal(undone.goals[0].steps[0].done, false);
  assert.deepEqual(undone.taskPatch, { stepTicked: false });

  const byHand = { id: 't_1', goalId: 'g_1', stepSourceId: 's_1', done: false };
  assert.equal(StepQuest.applyStepOutcome(ticked, byHand, false).changed, false, 'галочку человека откат квеста не снимает');
});

test('a step ticked by hand is not claimed by the quest that finishes later', () => {
  const ticked = [goal({ steps: [{ id: 's_1', title: 'шаг', done: true }] })];
  const task = { id: 't_1', goalId: 'g_1', stepSourceId: 's_1', done: true };
  const out = StepQuest.applyStepOutcome(ticked, task, true);
  assert.equal(out.changed, false);
  assert.equal(out.taskPatch, null, 'без отметки об авторстве откат потом ничего не снимет');
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'goal-step-quest-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
});

// ── Клиентский контракт: мост существует не только в модуле, но и в приложении ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the module is loaded before app.js and cached once for offline', () => {
  const moduleAt = INDEX.indexOf('src="goal-step-quest-v1.js');
  const appAt = INDEX.indexOf('src="app.js');
  assert.ok(moduleAt >= 0, 'index must load goal-step-quest-v1.js');
  assert.ok(appAt > moduleAt, 'app.js must run after the module it calls');
  assert.equal((SW.match(/'goal-step-quest-v1\.js'/g) || []).length, 1, 'SHELL must pin the module exactly once');
  assert.match(SW, /const CACHE = 'satoru-v239'/, 'новый файл в SHELL обязан поднять версию кэша');
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v239'/);
});

test('the goal checklist and the «Следующий шаг» card both offer the step to the day', () => {
  assert.match(APP, /function goalStepDayControlHTML\(g, step\)/);
  // чек-лист цели
  assert.match(APP, /\$\{esc\(step\.title\)\}<\/span>\$\{goalStepDayControlHTML\(g, step\)\}/);
  // карточка «Следующий шаг», когда следующий шаг — пункт чек-листа, а не квест
  assert.match(APP, /goalStepDayControlHTML\(g, \(g\.steps \|\| \[\]\)\.find\(\(item\) => item\.id === next\.id\)\)/);
  // уже стоящий в дне шаг ведёт в день, а не создаёт второй квест
  assert.match(APP, /questForStep\(State\.tasks \|\| \[\], g\.id, step\.id\)[\s\S]{0,220}data-action="goto-task"/);
});

test('taking a step into the day goes through the module and one atomic write', () => {
  const at = APP.indexOf("action === 'goal-step-to-day'");
  assert.notEqual(at, -1);
  const branch = APP.slice(at, APP.indexOf("action === 'delete-goal'", at));
  assert.match(branch, /api\.planStepQuest\(\{/);
  assert.match(branch, /today: todayStr\(\), id: uid\(\)/);
  assert.match(branch, /plan\.status === 'exists'/, 'второй квест на тот же шаг не создаётся');
  assert.match(branch, /if \(plan\.status !== 'create'\) return;/, 'любой другой исход ничего не пишет');
  assert.match(branch, /commitGoalMutation\(/, 'цели и квесты пишутся одной транзакцией');
});

test('finishing the quest closes its step, and undo only removes its own tick', () => {
  assert.match(APP, /async function syncGoalStepFromQuest\(task, done\)/);
  assert.match(APP, /return false;\n  \}\n  await syncGoalStepFromQuest\(task, true\);/, 'отметка шага идёт после успешного сохранения квеста');
  assert.match(APP, /else await syncGoalStepFromQuest\(q, false\);/);
  const at = APP.indexOf('async function syncGoalStepFromQuest');
  const body = APP.slice(at, APP.indexOf('\n}', at));
  assert.match(body, /if \(!outcome\.changed\) return true;/);
  assert.match(body, /if \(hadFlag\) task\.stepTicked = beforeFlag; else delete task\.stepTicked;/, 'провал записи не оставляет ложную отметку об авторстве');
  assert.match(body, /announceGoalCompletion\(nextGoal\)/, 'закрытый последним шагом цель объявляется один раз');
});

test('the honest failure line exists in all five languages', () => {
  const key = 'Квест сохранён, но шаг цели остался неотмеченным — отметь его в цели.';
  const at = APP.indexOf(`'${key}':`);
  assert.notEqual(at, -1, key);
  const row = APP.slice(at, APP.indexOf('\n', at));
  for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(row, new RegExp(locale));
  for (const label of ['В день', 'Уже в дне', 'Шаг стал квестом на сегодня']) {
    const rowAt = APP.indexOf(`'${label}':`);
    assert.notEqual(rowAt, -1, label);
    const line = APP.slice(rowAt, APP.indexOf('\n', rowAt));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${label} · ${locale}`);
  }
});
