const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  assert.notEqual(paramsEnd, -1, `${name} params must terminate`);
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

test('Week renders one semantic Calendar shell with seven overview dates and reused tools', () => {
  const view = functionBody('renderWeekly');
  assert.match(view, /calendar-shell calendar-week-shell/);
  assert.match(view, /aria-labelledby="calendar-screen-title"/);
  assert.match(view, /id="calendar-screen-title"/);
  assert.match(view, /calModeToggle\('week'\)/);
  assert.match(view, /calendarToolsHTML\(\)/);
  assert.match(view, /Array\.from\(\{ length: 7 \}/);
  assert.match(view, /class="calv-strip week-overview"/);
  assert.match(view, /data-action="cal-date"/);
  assert.match(view, /aria-pressed=/);
  assert.match(view, /aria-current="date"/);
  assert.match(view, /main class="week-work"[\s\S]*aside class="week-secondary"/);
});

test('mobile detail and desktop board share selected date and full task actions', () => {
  const selected = functionBody('selectedWeekDate');
  assert.match(selected, /selected >= start && selected <= end/);
  assert.match(selected, /today >= start && today <= end \? today : start/);
  const row = functionBody('weekTaskRowHTML');
  assert.match(row, /data-calendar-task/);
  assert.match(row, /data-action="toggle-task"/);
  assert.match(row, /aria-pressed=/);
  assert.match(row, /data-action="cal-edit-task"/);
  assert.match(row, /class="wk-task-title" data-noi18n/);
  assert.doesNotMatch(row, /line-clamp|slice\(/);
  const view = functionBody('renderWeekly');
  assert.match(view, /class="wk-mobile-detail"/);
  assert.match(view, /class="wk-grid-wrap"/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.calendar-week-shell \.wk-grid-wrap \{ display: none; \}[\s\S]*\.calendar-week-shell \.wk-mobile-detail \{ display: grid/);
});

test('desktop Week has seven equal columns and no inherited 900px canvas', () => {
  assert.match(css, /\.calendar-week-shell \.wk-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)[\s\S]*min-width:\s*0/);
  assert.match(css, /\.calendar-week-shell \.wk-grid-wrap\s*\{[\s\S]*overflow:\s*visible/);
  const scoped = css.slice(css.indexOf('Calendar Week v121'));
  assert.doesNotMatch(scoped, /min-width:\s*900px/);
});

test('Week add is awaitable, rolls back the exact object, and returns focus', () => {
  const submit = functionBody('onSubmit');
  const start = submit.indexOf("f.classList.contains('wk-add-form')");
  const end = submit.indexOf("f.id === 'capture-form'", start);
  assert.ok(start >= 0 && end > start, 'Week submit branch must exist');
  const branch = submit.slice(start, end);
  assert.match(branch, /State\._tasksLoadError/);
  assert.match(branch, /State\.tasks\.push\(task\)/);
  assert.match(branch, /await Store\.saveNow\('tasks', State\.tasks\)/);
  assert.match(branch, /State\.tasks = State\.tasks\.filter\(\(item\) => item !== task\)/);
  assert.match(branch, /controls\.forEach\(\(control\) => \{ control\.disabled = false; \}\)/);
  assert.match(branch, /focusPathChoiceTarget\(f\.title\)/);
  assert.match(branch, /State\._calendarFocusAfterCommit/);
});

test('drag is an enhancement over the shared Move and Undo transaction', () => {
  const drop = functionBody('onWkDrop');
  assert.match(app, /async function onWkDrop/);
  assert.match(drop, /cleanupWkDrag\(\)/);
  assert.match(drop, /await moveCalendarTask\(/);
  assert.doesNotMatch(drop, /Store\.save/);
  const leave = functionBody('onWkDragLeave');
  assert.match(leave, /relatedTarget/);
  const editor = functionBody('saveCalendarTaskEditor');
  assert.match(editor, /State\.calMode === 'week'/);
  assert.match(editor, /State\.weekStart = weekStart\(State\.calDate\)/);
  assert.match(app, /document\.addEventListener\('dragleave', onWkDragLeave\)/);
  assert.match(app, /if \(_wkDragId\) \{ cleanupWkDrag\(\); return; \}/);
});

test('week navigation preserves weekday and mode switch cleans drag state', () => {
  const click = functionBody('onClick');
  assert.match(click, /action === 'week-prev' \|\| action === 'week-next'/);
  assert.match(click, /const selected = selectedWeekDate/);
  assert.match(click, /State\.calDate = addDays\(selected, delta\)/);
  assert.match(click, /cleanupWkDrag\(\)/);
  assert.match(click, /action === 'cal-mode'\) \{ cleanupWkDrag\(\)/);
});

test('Week preserves three modes, three tools, touch floor, focus, and reduced motion', () => {
  assert.match(functionBody('calModeToggle'), /option\('day'[\s\S]*option\('week'[\s\S]*option\('month'/);
  assert.match(functionBody('calendarToolsHTML'), /calExportBtn\(\)[\s\S]*calSubscribeBtn\(\)[\s\S]*calRemindBtn\(\)/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*\.calendar-week-shell :is\(button, input, select, textarea\)[\s\S]*min-block-size:\s*var\(--touch-min\)/);
  assert.match(css, /\.calendar-shell :is\(button, input, select, textarea, summary\):focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.calendar-week-shell \*[\s\S]*animation:\s*none !important/);
});

test('Week recovery uses the global no-write card and authored copy has all locales', () => {
  assert.match(functionBody('renderWeekly'), /if \(State\._tasksLoadError\) return calendarLoadRecoveryHTML\(\)/);
  for (const key of [
    'Предыдущая неделя', 'Следующая неделя', 'Квесты выбранного дня', 'Квесты недели',
    'Нет квестов на этот день', 'Без времени', 'Запланировано времени на день',
    'Поделиться итогами недели', 'Добавить квест на этот день', 'Отменить добавление',
    'На desktop можно перетащить квест в другой день; тап, клик или Enter открывает расписание.',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = app.match(new RegExp(`'${escaped}': \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`));
  }
});
