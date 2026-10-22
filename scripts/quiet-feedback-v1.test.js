'use strict';

/* 22.10 feedback: pop-ups overload the app. Rewards are visible in place; Shadow's
 * section hints wait behind a dot instead of opening by themselves. Errors still toast. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing ${end}`);
  return source.slice(from, to);
}

test('completing a quest or a habit does not toast the reward', () => {
  const quest = between(APP, 'async function completeTask(task, desire, onDate)', '\n}\n');
  assert.doesNotMatch(quest, /else toast\(msg\)/);
  assert.doesNotMatch(quest, /toast\(t\('Состояние отмечено/);
  assert.match(quest, /if \(systemMode\(\)\) systemNarrate\(/, 'the opt-in «Система» narrator still speaks');
  assert.doesNotMatch(APP, /toast\(`\+\$\{nextLog\[day\]\[h\.id\]\.xp\} XP/);
});

test('achievements are announced only to the «Система» narrator', () => {
  assert.match(APP, /announce\(t\('Достижения'\), detail\);/);
  assert.doesNotMatch(APP, /announce\(t\('Достижения'\), detail, `/);
});

test('section hints from Shadow wait behind a dot instead of opening by themselves', () => {
  const start = between(APP, 'function guideV3MaybeStart()', '\nasync function guideV3Snooze');
  const contextual = start.slice(start.indexOf('nextContextual'));
  assert.match(contextual, /State\._guideV3Pending = pending/);
  assert.match(contextual, /return;\n  \}/, 'contextual branch returns before guide:start');
  assert.match(APP, /const moreNew = !!State\._guideV3Pending \|\|/);
  assert.match(APP, /class="help-btn"[^\n]*State\._guideV3Pending \? '<span class="navsec-dot"><\/span>'/);
  const startAction = between(APP, "if (action === 'guide-start')", "if (action === 'guide-enable')");
  assert.match(startAction, /State\._guideV3Pending = null/);
});

test('the morning and evening Shadow window does not open by itself', () => {
  const check = between(APP, 'function momentCheck() {', '\n}\n');
  assert.match(check, /if \(State\.settings\?\.shadowMoments !== true\) return;/);
  assert.ok(check.indexOf('shadowMoments') < check.indexOf('_momentTimer = setTimeout'));
});

test('save errors still reach the person', () => {
  assert.match(APP, /toast\(t\('Не удалось сохранить\. Ничего не изменено — повтори попытку\.'\)\)/);
});
