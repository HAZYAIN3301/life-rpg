'use strict';
// Ночная ветка 21.10 (FOCUS-VISIBLE.md): --focus-ring — значение для box-shadow, в outline оно недопустимо, и браузер
// рамку не рисует; у навигации фокус с клавиатуры был не виден. Для outline — свой токен --focus-outline.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');

test('у навигации рамка фокуса задана допустимым значением outline', () => {
  assert.match(CSS, /--focus-outline: 2px solid var\(--accent-2, var\(--accent\)\);/);
  const at = CSS.indexOf('#nav :is(.navsec, .navgear, .navsubtab):focus-visible');
  assert.ok(at > 0);
  const rule = CSS.slice(at, CSS.indexOf('}', at));
  assert.match(rule, /outline: var\(--focus-outline\);/);
  assert.doesNotMatch(rule, /outline: var\(--focus-ring/);
});
