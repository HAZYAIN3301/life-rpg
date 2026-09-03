const test = require('node:test');
const assert = require('node:assert/strict');
const Link = require('../public/quest-goal-link-v1.js');

const goal = (patch = {}) => ({ id: 'g_1', title: 'Сдать регистрацию', archived: false, completedAt: null, status: 'active', ...patch });
const task = (patch = {}) => ({ id: 't_1', title: 'Написать абзац', goalId: 'g_1', ...patch });

test('the state of a goal is read in one honest order', () => {
  assert.equal(Link.stateOf(goal()), 'active');
  assert.equal(Link.stateOf(goal({ status: 'waiting' })), 'waiting');
  assert.equal(Link.stateOf(goal({ status: 'paused' })), 'paused');
  assert.equal(Link.stateOf(goal({ completedAt: '2026-09-02T10:00:00.000Z' })), 'completed');
  assert.equal(Link.stateOf(goal({ archived: true })), 'archived');
  // архив сильнее завершения, завершение сильнее статуса — закрытая и убранная цель
  // не имеет права выглядеть активной работой сегодняшнего дня
  assert.equal(Link.stateOf(goal({ archived: true, completedAt: '2026-09-02T10:00:00.000Z', status: 'active' })), 'archived');
  assert.equal(Link.stateOf(goal({ completedAt: '2026-09-02T10:00:00.000Z', status: 'active' })), 'completed');
  assert.equal(Link.stateOf(goal({ status: 'nonsense' })), 'active');
  assert.equal(Link.stateOf(null), null);
  for (const state of ['archived', 'completed', 'waiting', 'paused', 'active']) assert.ok(Link.STATES.includes(state));
});

test('a quest that serves a goal says which one', () => {
  assert.deepEqual(Link.linkFor(task(), [goal()]), { goalId: 'g_1', title: 'Сдать регистрацию', state: 'active' });
  assert.equal(Link.linkFor(task(), [goal({ status: 'paused' })]).state, 'paused');
  assert.equal(Link.linkFor(task(), [goal({ archived: true })]).state, 'archived');
});

test('silence where there is nothing to claim', () => {
  assert.equal(Link.linkFor(task({ goalId: undefined }), [goal()]), null, 'квест без цели');
  assert.equal(Link.linkFor(task({ goalId: '   ' }), [goal()]), null);
  assert.equal(Link.linkFor(task({ goalId: 'gone' }), [goal()]), null, 'цель удалили — значка нет');
  assert.equal(Link.linkFor(task(), [goal({ title: '   ' })]), null, 'цель без названия нечего показывать');
  assert.equal(Link.linkFor(task(), []), null);
  assert.equal(Link.linkFor(task(), null), null);
  assert.equal(Link.linkFor(null, [goal()]), null);
});

test('a long goal title is trimmed instead of taking over the quest row', () => {
  const long = 'ц'.repeat(300);
  assert.equal(Link.linkFor(task(), [goal({ title: `  ${long}  ` })]).title.length, 80);
});

test('a duplicated goal id resolves to the first goal, and junk rows are skipped', () => {
  const goals = [goal({ id: 'g_1', title: 'Первая' }), goal({ id: 'g_1', title: 'Вторая' }), { id: '', title: 'x' }, null];
  assert.equal(Link.linkFor(task(), goals).title, 'Первая');
  assert.equal(Link.linksFor([task()], goals).get('t_1').title, 'Первая');
});

test('a whole day is resolved in one pass and keyed by quest id', () => {
  const goals = [goal(), goal({ id: 'g_2', title: 'Доклад', status: 'waiting' })];
  const tasks = [task(), task({ id: 't_2', goalId: 'g_2' }), task({ id: 't_3', goalId: 'gone' }), task({ id: 't_4', goalId: null }), { id: '' }];
  const links = Link.linksFor(tasks, goals);
  assert.equal(links.size, 2, 'только те квесты, про которые есть что сказать');
  assert.equal(links.get('t_1').title, 'Сдать регистрацию');
  assert.equal(links.get('t_2').state, 'waiting');
  assert.equal(links.has('t_3'), false);
  assert.equal(links.has('t_4'), false);
  assert.equal(Link.linksFor(null, goals).size, 0);
});

test('the exported surface is exactly what the app reads', () => {
  // Объявленная, но никем не читаемая функция хуже отсутствующей: клиент решил бы,
  // что сообщил о важном, а её никто не вызывает.
  assert.deepEqual(Object.keys(Link).sort(), ['STATES', 'linkFor', 'linksFor', 'stateOf']);
});

test('reading never mutates what it was given', () => {
  const goals = [goal()], tasks = [task()];
  const frozen = JSON.parse(JSON.stringify({ goals, tasks }));
  Link.linksFor(tasks, goals); Link.linkFor(tasks[0], goals);
  assert.deepEqual({ goals, tasks }, frozen);
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'quest-goal-link-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
});

// ── Клиентский контракт: день действительно называет цель ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the module is loaded before app.js and cached once for offline', () => {
  const moduleAt = INDEX.indexOf('src="quest-goal-link-v1.js');
  assert.ok(moduleAt >= 0, 'index must load quest-goal-link-v1.js');
  assert.ok(INDEX.indexOf('src="app.js') > moduleAt, 'app.js must run after the module it calls');
  assert.equal((SW.match(/'quest-goal-link-v1\.js'/g) || []).length, 1, 'SHELL must pin the module exactly once');
  assert.match(SW, /const CACHE = 'satoru-v225'/, 'новый файл в SHELL обязан поднять версию кэша');
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v225'/);
});

test('the day names the goal on the quest row itself, not only inside «•••»', () => {
  assert.match(APP, /function questGoalChipHTML\(q, links\)/);
  // чип живёт в той же ячейке, что и «Ядро дня», поэтому сетка строки не меняется
  assert.match(APP, /<div class="t-title">\$\{coreBadge\}\$\{titleControl\}\$\{questGoalChipHTML\(q, links\)\}<\/div>/);
  // и ведёт в саму цель тем же действием, что и ссылка в меню
  assert.match(APP, /task-goal-chip[^`]*data-action="goto-goal"/);
  assert.match(CSS, /\.task-goal-chip \{/);
});

test('the goal index is built once per day render, not per quest row', () => {
  assert.match(APP, /window\.QuestGoalLinkV1\s*\n?\s*\? window\.QuestGoalLinkV1\.linksFor\(\[\.\.\.todays, \.\.\.overdue\], State\.goals \|\| \[\]\)/);
  assert.equal((APP.match(/questRow\(task, questGoalLinks\)/g) || []).length, 2, 'оба списка дня — сегодняшний и просроченный');
});

test('a paused, finished or archived goal says so in words, not by colour alone', () => {
  const at = APP.indexOf('const QUEST_GOAL_STATE_COPY');
  assert.notEqual(at, -1);
  const row = APP.slice(at, APP.indexOf('});', at));
  for (const state of ['paused', 'waiting', 'completed', 'archived']) assert.match(row, new RegExp(`${state}:`), state);
  assert.match(APP, /stateCopy \? `<span class="task-goal-chip-state">/);
  for (const key of ['Ради цели', 'цель на паузе', 'цель ждёт', 'цель завершена', 'цель в архиве']) {
    const keyAt = APP.indexOf(`'${key}':`);
    assert.notEqual(keyAt, -1, key);
    const line = APP.slice(keyAt, APP.indexOf('\n', keyAt));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${key} · ${locale}`);
  }
});

test('the chip degrades to nothing when the module is missing', () => {
  const at = APP.indexOf('function questGoalChipHTML');
  const body = APP.slice(at, APP.indexOf('\n}', at));
  assert.match(body, /const api = window\.QuestGoalLinkV1; if \(!api\) return '';/);
  assert.match(body, /if \(!link\) return '';/);
});
