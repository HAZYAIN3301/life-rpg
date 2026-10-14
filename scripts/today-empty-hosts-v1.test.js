'use strict';
// Ночная ветка 14.10: пустые места под пати на «Сегодня» прячутся, как уже прятался duo-host.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

test('пустые места под пати на «Сегодня» не дают пустой полосы', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  for (const host of ['trial', 'adventure', 'project']) {
    assert.match(app, new RegExp(`<div data-${host}-today-host>\\$\\{`), `${host}: место создаётся без пробелов внутри, иначе :empty не сработает`);
    assert.match(css, new RegExp(`\\[data-${host}-today-host\\]:empty`), `${host}: пустое место спрятано`);
  }
  assert.match(app, /<div data-focus-sync-host>\$\{focusSyncNotice\(\)\}<\/div>/);
  assert.match(css, /\[data-focus-sync-host\]:empty, \[data-trial-today-host\]:empty, \[data-adventure-today-host\]:empty, \[data-project-today-host\]:empty \{ display: none; \}/);
});
