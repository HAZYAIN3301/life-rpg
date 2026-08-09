const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const paren = app.indexOf('(', start);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = paren; i < app.length; i += 1) {
    if (app[i] === '(') parenDepth += 1;
    else if (app[i] === ')' && --parenDepth === 0) { paramsEnd = i; break; }
  }
  const brace = app.indexOf('{', paramsEnd);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = brace; i < app.length; i += 1) {
    const char = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('Month uses the shared Calendar shell, modes, tools, and seven-date strip', () => {
  const view = functionBody('renderCalMonth');
  assert.match(view, /calendar-shell calendar-month-shell/);
  assert.match(view, /aria-labelledby="calendar-screen-title"/);
  assert.match(view, /calModeToggle\('month'\)/);
  assert.match(view, /calendarToolsHTML\(\)/);
  assert.match(view, /Array\.from\(\{ length: 7 \}/);
  assert.match(view, /class="calv-strip month-overview"/);
});

test('Month keeps 42 compact dates and exposes one selected-day detail', () => {
  const view = functionBody('renderCalMonth');
  assert.match(view, /for \(let i = 0; i < 42; i\+\+\)/);
  assert.match(view, /data-action="cal-month-date"/);
  assert.match(view, /aria-pressed=/);
  assert.match(view, /id="month-detail-title" tabindex="-1"/);
  assert.match(view, /selectedTasks\.map\(\(task\) => weekTaskRowHTML\(task, 'detail'\)\)/);
  assert.match(view, /data-action="month-open-day"/);
});

test('Month date cells remain compact while real actions retain the touch floor', () => {
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.calendar-month-shell \.cm-cell \{ min-height: 28px/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*\.calendar-month-shell :is\(button, input, select, textarea\)[\s\S]*min-block-size: var\(--touch-min\)/);
  assert.match(css, /\.calendar-month-shell \.cm-cell \{ min-inline-size: 0; min-block-size: 0; \}/);
  assert.match(css, /\.calendar-month-shell \.month-open-day \{[^}]*min-height: var\(--touch-min\); \}/);
});

test('selected-day tasks reuse accessible editor, completion, add, and rollback paths', () => {
  const row = functionBody('weekTaskRowHTML');
  assert.match(row, /data-action="toggle-task"/);
  assert.match(row, /data-action="cal-edit-task"/);
  const submit = functionBody('onSubmit');
  const start = submit.indexOf("f.classList.contains('wk-add-form')");
  const end = submit.indexOf("f.id === 'capture-form'", start);
  const branch = submit.slice(start, end);
  assert.match(branch, /await Store\.saveNow\('tasks', State\.tasks\)/);
  assert.match(branch, /State\.tasks = State\.tasks\.filter\(\(item\) => item !== task\)/);
  assert.match(branch, /focusPathChoiceTarget\(f\.title\)/);
});

test('moving a task in Month follows the destination and keeps editor focus possible', () => {
  const editor = functionBody('saveCalendarTaskEditor');
  assert.match(editor, /State\.calMode === 'week' \|\| State\.calMode === 'month'/);
  assert.match(editor, /State\.calDate = calendarDateValue\(data\.get\('date'\)\)/);
  const click = functionBody('onClick');
  assert.match(click, /action === 'cal-month-date'/);
  assert.match(click, /State\._calendarFocusAfterCommit = '#month-detail-title'/);
  assert.match(click, /action === 'month-open-day'/);
});

test('month shifting clamps Jan, leap-Feb, and year boundaries without forcing day 28', () => {
  const source = `${functionBody('shiftedMonthDate')}; shiftedMonthDate`;
  const shifted = vm.runInNewContext(source, {
    todayStr: () => '2026-08-09',
    parseDate: (value) => new Date(`${value}T12:00:00`),
    fmtDate: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    Date,
  });
  assert.equal(shifted('2026-01-31', 1), '2026-02-28');
  assert.equal(shifted('2028-01-31', 1), '2028-02-29');
  assert.equal(shifted('2026-12-31', 1), '2027-01-31');
  assert.equal(shifted('2026-01-31', -1), '2025-12-31');
});

test('Month inherits false-empty recovery and does not render a blank grid on load failure', () => {
  const route = functionBody('renderCalendarView');
  assert.match(route, /if \(State\._tasksLoadError\) return calendarLoadRecoveryHTML\(\)/);
  assert.match(functionBody('calendarLoadRecoveryHTML'), /role="alert"/);
  assert.match(functionBody('retryTasksLoad'), /Store\.loadChecked\('tasks'/);
});

test('new Month copy and all month names cover EN, DE, UK, and ES', () => {
  for (const key of [
    'Предыдущий месяц', 'Следующий месяц', 'Дни месяца', 'Выбери день месяца',
    'Квесты этого дня', 'Открыть выбранный день',
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = app.match(new RegExp(`'${escaped}': \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`));
  }
});
