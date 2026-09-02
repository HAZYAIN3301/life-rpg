'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

test('Stats v135 exposes one labelled route surface', () => {
  assert.match(app, /<section class="stats-shell"[^>]*aria-labelledby="stats-title">/);
  assert.match(app, /<h2 id="stats-title" tabindex="-1">/);
  assert.match(css, /Stats v135: a semantic observation surface/);
});

test('Stats v135 does not render missing rhythm or plans as a negative score', () => {
  assert.match(app, /const rate = planned14\.length \? Math\.round\([\s\S]+?\) : null;/);
  assert.match(app, /const hasBalanceSignal = bal\.active >= 2 && bal\.windowMin > 0;/);
  assert.match(app, /hasBalanceSignal \? bal\.index : '—'/);
  assert.match(app, /rate == null \? t\('Пока нет планов'\) : `\$\{rate\}%/);
  assert.match(app, /Баланс появится, когда хотя бы две сферы получат внимание\. Это не оценка тебя\./);
});

test('Stats v135 keeps the global assistant reachable and ships the current offline shell', () => {
  assert.doesNotMatch(css, /body:has\(\.stats-shell\) #ai-fab[^}]*display:\s*none/);
  assert.match(sw, /const CACHE = 'satoru-v221'/);
});

test('Stats v135 additions are localized for every shipped locale', () => {
  for (const key of ['Наблюдаем баланс', 'Пока нет планов', 'Баланс появится, когда хотя бы две сферы получат внимание. Это не оценка тебя.']) {
    assert.match(app, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:\\s*\\{ en:[\\s\\S]{0,700}de:[\\s\\S]{0,700}uk:[\\s\\S]{0,700}es:`));
  }
});
