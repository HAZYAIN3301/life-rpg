'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BoardV2 = require('../public/board-v2.js');

const ROOT = path.join(__dirname, '..');
const review = fs.readFileSync(path.join(ROOT, 'BOARD-V2-QUEST-REVIEW-02.md'), 'utf8');
const primary = review.match(/## A\. Основной пул[\s\S]*?(?=\n## B\.)/)?.[0] || '';
const examples = review.match(/## D\. Как это выглядит[\s\S]*?(?=\n## E\.)/)?.[0] || '';

test('review остаётся обсуждением и не выдаёт неутверждённую copy за runtime', () => {
  assert.match(review, /текст для обсуждения, не runtime-copy/i);
  assert.match(review, /неутверждённый review-файл в runtime не подключается/i);
});

test('основной review содержит ровно 36 конкретных шаблонов', () => {
  const headings = [...primary.matchAll(/^### (\d+)\. /gm)].map((match) => Number(match[1]));
  assert.deepEqual(headings, Array.from({ length: 36 }, (_, index) => index + 1));
  assert.equal((primary.match(/\*\*Нужно:/g) || []).length, 36);
  assert.equal((primary.match(/\*\*Закрытие:/g) || []).length, 36);
});

test('пользовательская copy основного пула проходит Board v2 tone gate', () => {
  const userFacing = [...primary.matchAll(/\*\*Текст(?: после resolver)?:\*\*\s*[«“"]([^\n]+)[»”"]/g)]
    .map((match) => match[1]);
  assert.ok(userFacing.length >= 30);
  for (const copy of userFacing) assert.deepEqual(BoardV2.lintCopy(copy), [], copy);
});

test('Bielefeld proof-of-concept даёт пять открываемых официальных источников', () => {
  const sampleHeadings = [...examples.matchAll(/^### Пример \d+ /gm)];
  const urls = [...examples.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
  assert.equal(sampleHeadings.length, 5);
  assert.equal(urls.length, 5);
  assert.equal(urls.every((url) => new URL(url).protocol === 'https:'), true);
});

test('review остаётся dormant и не попадает в app shell', () => {
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(index, /BOARD-V2-QUEST-REVIEW-02/i);
  assert.doesNotMatch(sw, /BOARD-V2-QUEST-REVIEW-02/i);
});
