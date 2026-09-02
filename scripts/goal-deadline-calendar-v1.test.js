const test = require('node:test');
const assert = require('node:assert/strict');
const Deadlines = require('../public/goal-deadline-calendar-v1.js');

const goal = (patch = {}) => ({ id: 'g_1', title: 'Сдать регистрацию', targetDate: '2026-11-30', archived: false, completedAt: null, status: 'active', ...patch });

test('a goal with a date lands on that day', () => {
  const index = Deadlines.deadlinesByDate([goal()]);
  assert.deepEqual(Deadlines.forDate(index, '2026-11-30'), [{ goalId: 'g_1', title: 'Сдать регистрацию' }]);
  assert.deepEqual(Deadlines.forDate(index, '2026-11-29'), []);
});

test('what the calendar has no business showing', () => {
  const cases = {
    'без даты': goal({ targetDate: null }),
    'пустая дата': goal({ targetDate: '' }),
    'архивная цель': goal({ archived: true }),
    'достигнутая цель': goal({ completedAt: '2026-09-02T10:00:00.000Z' }),
    'цель без названия': goal({ title: '   ' }),
    'цель без id': goal({ id: '' }),
  };
  for (const [name, item] of Object.entries(cases)) {
    assert.equal(Deadlines.deadlinesByDate([item]).size, 0, name);
  }
  assert.equal(Deadlines.deadlinesByDate([null, 'x', 42, []]).size, 0);
  assert.equal(Deadlines.deadlinesByDate(null).size, 0);
});

test('a calendar-impossible date never becomes a day', () => {
  for (const targetDate of ['2026-02-31', '2026-13-01', '2026-00-10', '30.11.2026', '2026-11-3', '2026-11-30T00:00:00Z']) {
    assert.equal(Deadlines.deadlinesByDate([goal({ targetDate })]).size, 0, targetDate);
  }
  assert.equal(Deadlines.deadlinesByDate([goal({ targetDate: '2028-02-29' })]).size, 1, 'настоящий високосный день — законная дата');
});

test('paused and waiting goals keep their date: the person set it either way', () => {
  for (const status of ['waiting', 'paused']) {
    assert.equal(Deadlines.deadlinesByDate([goal({ status })]).size, 1, status);
  }
});

test('one day can carry several deadlines, always in the same order', () => {
  const goals = [
    goal({ id: 'g_b', title: 'Ботаника' }),
    goal({ id: 'g_a', title: 'Абитура' }),
    goal({ id: 'g_c', title: 'Абитура' }),
    goal({ id: 'g_d', title: 'Доклад', targetDate: '2026-12-01' }),
  ];
  const rows = Deadlines.forDate(Deadlines.deadlinesByDate(goals), '2026-11-30');
  assert.deepEqual(rows.map((row) => row.goalId), ['g_a', 'g_c', 'g_b'], 'по названию, при равенстве — по id');
  const reordered = Deadlines.forDate(Deadlines.deadlinesByDate(goals.slice().reverse()), '2026-11-30');
  assert.deepEqual(reordered.map((row) => row.goalId), ['g_a', 'g_c', 'g_b'], 'порядок не зависит от порядка в файле');
});

test('a duplicated goal id is counted once', () => {
  const rows = Deadlines.forDate(Deadlines.deadlinesByDate([goal(), goal({ title: 'Копия' })]), '2026-11-30');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Сдать регистрацию', 'первая запись выигрывает');
});

test('a long title is trimmed instead of taking over the day cell', () => {
  const rows = Deadlines.forDate(Deadlines.deadlinesByDate([goal({ title: `  ${'ц'.repeat(300)}  ` })]), '2026-11-30');
  assert.equal(rows[0].title.length, 80);
});

test('asking for a day is safe with any input', () => {
  const index = Deadlines.deadlinesByDate([goal()]);
  for (const date of ['2026-02-31', '', null, undefined, 42, '2026-11-3']) {
    assert.deepEqual(Deadlines.forDate(index, date), [], String(date));
  }
  assert.deepEqual(Deadlines.forDate(null, '2026-11-30'), []);
  assert.deepEqual(Deadlines.forDate({}, '2026-11-30'), []);
});

test('reading never mutates what it was given', () => {
  const goals = [goal(), goal({ id: 'g_2', title: 'Доклад' })];
  const frozen = JSON.parse(JSON.stringify(goals));
  Deadlines.deadlinesByDate(goals);
  assert.deepEqual(goals, frozen);
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'goal-deadline-calendar-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
  assert.deepEqual(Object.keys(Deadlines).sort(), ['deadlinesByDate', 'forDate']);
});

// ── Клиентский контракт: календарь действительно показывает дедлайны ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the module is loaded before app.js and cached once for offline', () => {
  const moduleAt = INDEX.indexOf('src="goal-deadline-calendar-v1.js');
  assert.ok(moduleAt >= 0, 'index must load goal-deadline-calendar-v1.js');
  assert.ok(INDEX.indexOf('src="app.js') > moduleAt, 'app.js must run after the module it calls');
  assert.equal((SW.match(/'goal-deadline-calendar-v1\.js'/g) || []).length, 1, 'SHELL must pin the module exactly once');
  assert.match(SW, /const CACHE = 'satoru-v220'/, 'новый файл в SHELL обязан поднять версию кэша');
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v220'/);
});

test('all three calendar modes know about a deadline', () => {
  // день, месяц (полоса + сетка) и неделя — иначе переключение режима возвращает тупик
  assert.equal((APP.match(/const deadlines = goalDeadlineIndex\(\);/g) || []).length, 2, 'день и месяц');
  assert.match(APP, /const weekDeadlines = goalDeadlineIndex\(\);/);
  assert.equal((APP.match(/goalDeadlineMarkHTML\(due\)/g) || []).length, 3, 'полоса дня, полоса месяца, клетка месяца');
  assert.equal((APP.match(/goalDeadlineLabelPart\(due\)/g) || []).length, 4, 'каждая пометка названа и для скринридера');
  assert.equal((APP.match(/has-goal-deadline/g) || []).length, 4);
});

test('the goal is opened from the selected day, never from the day button', () => {
  // ссылка внутри кнопки выбора дня сломала бы и клавиатуру, и разметку
  assert.match(APP, /goalDeadlineRowHTML\(goalDeadlinesOn\(deadlines, date\)\)/);
  assert.equal((APP.match(/goalDeadlineRowHTML\(/g) || []).length, 4, 'объявление плюс день, месяц и неделя');
  const at = APP.indexOf('function goalDeadlineMarkHTML');
  const mark = APP.slice(at, APP.indexOf('\n}', at));
  assert.doesNotMatch(mark, /<a /, 'пометка дня не может быть ссылкой');
  const rowAt = APP.indexOf('function goalDeadlineRowHTML');
  const row = APP.slice(rowAt, APP.indexOf('\n}', rowAt));
  assert.match(row, /data-action="goto-goal"/);
  assert.match(row, /aria-label=/);
});

test('the calendar degrades to nothing when the module is missing', () => {
  const at = APP.indexOf('function goalDeadlineIndex');
  const body = APP.slice(at, APP.indexOf('function goalDeadlineMarkHTML'));
  assert.match(body, /const api = window\.GoalDeadlineCalendarV1;\n\s*return api \? api\.deadlinesByDate/);
  assert.match(body, /return api && index \? api\.forDate\(index, date\) : \[\];/);
});

test('the deadline chip and the day mark are styled, and the mark needs a positioned day', () => {
  assert.match(CSS, /\.cal-goal-mark \{/);
  assert.match(CSS, /\.calv-day, \.cm-cell \{ position: relative; \}/);
  assert.match(CSS, /\.cal-goal-deadline-title \{[^}]*text-overflow: ellipsis/);
});

test('the new copy exists in all five languages', () => {
  for (const key of ['Дедлайн цели', 'Открыть цель с дедлайном на этот день']) {
    const at = APP.indexOf(`'${key}':`);
    assert.notEqual(at, -1, key);
    const line = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${key} · ${locale}`);
  }
});
