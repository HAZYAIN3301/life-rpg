'use strict';

/* Ticking a quest from a past day (22.10 feedback: «нельзя отметить вчерашние квесты»).
 *
 * Calendar and Week show a chosen day, so a tick there counts on that day. Today's
 * overdue list keeps «done now» on the main tick and offers a readable «✓ за вчера».
 * Source contracts; the browser walk is work/fixes-20261022/yesterday-repro.mjs.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing ${end} after ${start}`);
  return source.slice(from, to);
}

test('a tick in Calendar or Week on a past day counts on that day', () => {
  const source = between(APP, "if (action === 'toggle-task')", "} else if (action === 'toggle-task-backdated')");
  assert.match(source, /State\.view === 'calendar' \|\| State\.view === 'weekly'/);
  assert.match(source, /q\.date < todayStr\(\) \? q\.date : undefined/);
  assert.match(source, /completeTask\(q, null, onDate\)/);
});

test('a hard quest keeps the past day through the mood picker', () => {
  const toggle = between(APP, "if (action === 'toggle-task')", "} else if (action === 'toggle-task-backdated')");
  assert.match(toggle, /const pop = openDesirePicker\(id, el\); if \(pop && onDate\) pop\._onDate = onDate;/);
  const pick = between(APP, "if (action === 'desire-pick')", "if (action === 'copy-feedback-for-claude')");
  assert.match(pick, /completeTask\(task, el\.dataset\.desire, overlay && overlay\._onDate\)/);
});

test('quests without a time can be ticked in the calendar tray', () => {
  const tray = between(APP, 'const trayTasks = unscheduled.map', ".join('');");
  assert.match(tray, /class="calv-chip-row"/);
  assert.match(tray, /data-action="toggle-task" data-id="\$\{task\.id\}"/);
});

test('the overdue backdate button says which day it counts on, in every language', () => {
  const row = between(APP, 'const past = !q.done && q.date && q.date < todayStr();', 'const coreLabel');
  assert.match(row, /q\.date === addDays\(todayStr\(\), -1\) \? t\('за вчера'\)/);
  assert.doesNotMatch(row, /<sub>/, 'the 9 px date subscript is gone');
  for (const key of ['за вчера', 'за дату']) {
    const entry = APP.match(new RegExp(`'${key}': \\{ en: '[^']+', de: '[^']+', uk: '[^']+', es: '[^']+' \\}`));
    assert.ok(entry, `translation for «${key}» in all four languages`);
  }
});
