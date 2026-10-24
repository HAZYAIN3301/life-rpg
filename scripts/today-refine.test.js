'use strict';

/* Доводка «Сегодня» на телефоне за флажком ?refine=gap,week,quiet,head / ?today=refine (24.10).
 * Без флажка разметка прежняя; каждый шаг включается своим именем, чтобы владелец сравнил «было/стало».
 * Опись функций: docs/research/2026-10-today-inventory.md. Браузерные замеры:
 * satoru-release-plan work/design-20261024/today-refine/check.mjs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'design-next-v1.css'), 'utf8');
function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing ${end}`);
  return source.slice(from, to);
}
const today = () => between(APP, 'function renderToday()', '\n// ============================================================\n//  Вид «Цели»');

test('the flag reads named steps or the whole set and nothing else', () => {
  const flag = between(APP, 'function todayRefineSteps()', '\nfunction renderToday()');
  assert.match(APP, /const TODAY_REFINE_STEPS = \['gap', 'week', 'quiet', 'head'\];/);
  assert.match(flag, /q\.get\('today'\) === 'refine'/);
  assert.match(flag, /TODAY_REFINE_STEPS\.filter\(\(s\) => all \|\| picked\.includes\(s\)\)/);
  assert.match(flag, /if \(State\._todayRefine\.length\) document\.documentElement\.dataset\.todayRefine = State\._todayRefine\.join\(' '\);/, 'the root carries the steps only when some are on');
});

test('without the flag the header and the day keep their markup', () => {
  const src = today();
  assert.match(src, /: `<p class="route-date\$\{refine\.includes\('head'\) \? ' is-sentence' : ''\}">\$\{dateText\}<\/p>`/);
  assert.match(src, /: `<div>\$\{routeDate\}<h2>\$\{t\('Сегодня'\)\}<\/h2><\/div>`/);
  assert.match(src, /: esc\(refine\.includes\('week'\) \? sentence\(dateLong\) : dateLong\)/, 'no flag: the same long date, escaped');
  assert.match(src, /return `<div class="today-shell">\$\{routeHead\}\$\{tabs\}/, 'the shell itself carries no flag');
  assert.match(src, /<div data-focus-sync-host>\$\{focusSyncNotice\(\)\}<\/div>\$\{weekStrip\}<div data-duo-today-host>/, 'the week strip stays in the DOM; only phone CSS hides it');
});

test('the week moves to the date: one tap to the calendar, full date for screen readers', () => {
  const src = today();
  assert.match(src, /class="route-date route-date-link" data-action="goto-calendar" data-date="\$\{today\}" aria-label="\$\{esc\(`\$\{t\('Календарь'\)\}: \$\{dateLong\}`\)\}"/);
  assert.match(CSS, /\[data-today-refine~=week\] \.today-shell \.today-week\{display:none\}/);
});

test('each step is scoped to its own name and the phone width', () => {
  const block = CSS.slice(CSS.indexOf('/* Доводка «Сегодня» на телефоне'));
  assert.ok(block.length > 0);
  const phone = block.slice(block.indexOf('@media(max-width:600px){'));
  for (const step of ['week', 'quiet', 'head']) assert.match(phone, new RegExp(`\\[data-today-refine~=${step}\\] \\.today-shell `), `${step} lives in the phone query, inside Today`);
  assert.match(block, /\[data-today-refine~=gap\] \.today-shell \.today-work>:is\(\[data-focus-sync-host\],\[data-trial-today-host\],\[data-adventure-today-host\],\[data-project-today-host\]\):empty\{display:none\}/);
  assert.doesNotMatch(block, /data-today-refine~=(?!gap|week|quiet|head)/, 'no unknown step names');
  assert.doesNotMatch(block, /\[data-today-refine~=\w+\](?! \.today-shell)/, 'every rule stays inside Today');
});

test('quiet keeps every quieted action at the touch floor', () => {
  const phone = CSS.slice(CSS.indexOf('/* Доводка «Сегодня» на телефоне'));
  assert.doesNotMatch(phone, /min-height:(?:[0-3]\d|4[0-3])px/, 'no target below 44px');
  assert.match(phone, /\.route-date-link\{[^}]*min-height:44px/);
  assert.doesNotMatch(phone, /display:none\}[^\n]*(day-recap-direct|today-add-link|cap-add|task-goal-chip)/, 'quiet never hides an action');
});

test('the focus window explains itself only when asked for', () => {
  const widget = between(APP, 'async function openFocusWidget(options = {})', '\n  if (pipWindow)');
  assert.match(widget, /if \(options\.explicit\) toast\(t\('Плавающее окно недоступно в этом браузере — показываю плашку'\)\); return;/);
  assert.match(APP, /action === 'open-pip'\) \{ openFocusWidget\(\{ explicit: true \}\);/);
  assert.match(between(APP, 'function startFocus(taskId)', '\nfunction pauseFocus()'), /openFocusWidget\(\); startTick\(\)/, 'starting focus stays silent');
});
