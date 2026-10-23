'use strict';

/* «Сегодня» v2 — локальный прототип за флажком ?today=v2a|v2b|v2c (24.10).
 * Без флажка экран прежний; с флажком — те же функции в другой подаче.
 * Опись функций: docs/research/2026-10-today-inventory.md. Браузерная проверка «ничего не пропало»:
 * satoru-release-plan work/design-20261024/today-v2/check.mjs. */
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

test('the flag only accepts the three prototype variants from the query string', () => {
  const flag = between(APP, 'function todayV2Variant()', '\nfunction renderToday()');
  assert.match(flag, /new URLSearchParams\(location\.search\)\.get\('today'\)/);
  assert.match(flag, /\['v2a', 'v2b', 'v2c'\]\.includes\(v\) \? v : ''/);
});

test('without the flag Today keeps its current composition', () => {
  const today = between(APP, 'function renderToday()', '\n// ============================================================\n//  Вид «Цели»');
  const branch = today.indexOf('if (v2) {');
  assert.ok(branch > 0, 'prototype branch is guarded by the flag');
  assert.match(today.slice(branch), /<div class="today-shell">\$\{routeHead\}\$\{tabs\}/, 'the default return still follows the guarded branch');
  const row = between(APP, 'function questRow(q, links)', '\nfunction openTaskActualDialog');
  assert.match(row, /const sphereColor = todayV2Variant\(\) \? /, 'sphere colour is added only under the flag');
});

test('every variant keeps the quest board, overdue, habits, Shadow, Tribe, capture and day close', () => {
  const today = between(APP, 'function renderToday()', '\n// ============================================================\n//  Вид «Цели»');
  for (const v of ['v2a', 'v2b', 'v2c']) {
    const order = today.match(new RegExp(`${v}: \\[([^\\]]+)\\]`));
    assert.ok(order, `order for ${v}`);
    for (const piece of ['lead', 'boardV2', 'overdueSurface', 'habitsCard', 'shadow', 'tribe', 'capture', 'extras']) {
      assert.ok(order[1].includes(piece), `${v} keeps ${piece}`);
    }
    assert.ok(order[1].includes('life') || order[1].includes('world'), `${v} keeps rewards and the gold goal`);
  }
  assert.match(today, /<div class="today-footer">\$\{shutdownCard\}<\/div><\/div>`;\n  \}/, 'day close stays in every variant');
  assert.match(today, /data-action="goto-calendar" data-date="\$\{today\}"/, 'the week moved, not removed: the date opens the calendar');
});
