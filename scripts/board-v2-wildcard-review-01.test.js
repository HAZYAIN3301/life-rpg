'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BoardV2 = require('../public/board-v2.js');

const ROOT = path.join(__dirname, '..');
const FILE = 'BOARD-V2-WILDCARD-REVIEW-01.md';
const review = fs.readFileSync(path.join(ROOT, FILE), 'utf8');

test('wildcard review содержит ровно 45 последовательных предложений', () => {
  const headings = [...review.matchAll(/^### (\d+)\. /gm)].map((match) => Number(match[1]));
  assert.deepEqual(headings, Array.from({ length: 45 }, (_, index) => index + 1));
});

test('review остаётся обсуждением и не подключается в runtime shell', () => {
  assert.match(review, /текст для обсуждения, не runtime-copy/i);
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(index, new RegExp(FILE, 'i'));
  assert.doesNotMatch(sw, new RegExp(FILE, 'i'));
});

test('в review присутствуют все идеи владельца, а не только безопасные бытовые задачи', () => {
  for (const pattern of [
    /Zugspitze/,
    /рыбу-меч/,
    /косплей/,
    /Переставь комнату/,
    /сальто/,
    /пятиметровой вышки/,
    /сёрфинга/,
    /погружение/,
    /сноуборде/,
    /чудес света/,
    /социальные сети на 30 дней/,
    /Minecraft-сервер/,
    /одной книге в месяц/,
    /рыбалку/,
    /барахолке/,
    /день в библиотеке/,
    /£1,000/,
    /марафон/,
    /конец радуги/,
  ]) assert.match(review, pattern);
});

test('высокорисковые идеи требуют профессионального и разрешённого контекста', () => {
  assert.match(review, /опасность не рандомизируется/i);
  assert.match(review, /оборудованный зал, тренер/i);
  assert.match(review, /только разрешённая вышка/i);
  assert.match(review, /сертифицированный центр, инструктор/i);
  assert.match(review, /официальный маршрут, гид/i);
  assert.doesNotMatch(review, /самостоятельно научись делать сальто/i);
  assert.doesNotMatch(review, /прыгни с (?:любой|ближайшей) скалы/i);
});

test('большие эксперименты не обещают гарантированный финансовый или природный результат', () => {
  assert.match(review, /никаких гарантий, ставок, кредитов, пирамид/i);
  assert.match(review, /явление не гарантируется/i);
  assert.match(review, /не обещание буквального “конца”/i);
});

test('случайность выбирает только среди заранее проверенных вариантов', () => {
  assert.match(review, /случайность выбирает только среди трёх уже безопасных и подходящих вариантов/i);
});

test('draft copy не содержит ранее отклонённые ИИ-формулировки', () => {
  for (const line of review.split('\n').filter((value) => value.startsWith('**Текст'))) {
    assert.deepEqual(BoardV2.lintCopy(line), [], line);
  }
});

test('публикация не превращается в обязательное условие каждого приключения', () => {
  assert.match(review, /публикация всегда отдельная опция/i);
  assert.doesNotMatch(review, /публикация обязательна/i);
});
