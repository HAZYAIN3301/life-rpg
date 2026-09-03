'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

const localeKeys = [
  'Соберём первый квест на сегодня.',
  'Следующий ход уже выбран.',
  'День почти собран.',
  'На сегодня привычек нет.',
  'Итог дня',
  'Утренний чек-ин',
  'Вечерний чек-ин',
  'Веха доступна',
  'Веха закрыта',
  'Эмбиент-звук',
  'Прослушать Тень',
  'Красивая карточка итогов недели — поделись или сохрани PNG.',
  'Обсидиан и золото',
  'занятие по настроению',
  'без экипировки',
  'Настроить облик',
  'Музыка',
  'Оружие',
  'Броня',
  'Амулет',
  'Реликвии (сфера-привязка)',
  'Кинжал Наживы',
  'Мантия Потока',
  'Кулон Испытаний',
  'Клинок Рассветной Клятвы',
  'Доспех Несгибаемого',
  'Сердце Десятиборца',
];

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('v138 locale rows cover every confirmed authored leak in four non-Russian locales', () => {
  for (const key of localeKeys) {
    assert.match(app, new RegExp(`'${escaped(key)}'\\s*:\\s*\\{ en:[\\s\\S]{0,900}de:[\\s\\S]{0,900}uk:[\\s\\S]{0,900}es:`), key);
  }
});

test('v138 renders authored Today, Notes, Pets, Rewards, Stats and Settings copy through i18n', () => {
  for (const source of [
    "t('Соберём первый квест на сегодня.')",
    "t('Итог дня')",
    "t('Что считается результатом')",
    "t('Эмбиент-звук')",
    "t('Прослушать Тень')",
    "t('Твоя неделя')",
    "esc(t(it.name))",
    "t(s.label)",
    "t('Реликвии (сфера-привязка)')",
    "t18('Утренний чек-ин')",
  ]) assert.ok(app.includes(source), source);
  assert.match(app, /return `\$\{t\(skin\.name\)\} · \$\{propName\} · \$\{equipment\}`/);
});

test('v138 does not add duplicate locale rows and ships a fresh shell', () => {
  const marker = app.indexOf('// ── Product-wide locale gate v138');
  const end = app.indexOf('\n};', marker);
  const block = app.slice(marker, end);
  const keys = [...block.matchAll(/^  '((?:\\'|[^'])+)':/gm)].map((match) => match[1]);
  assert.equal(keys.length, new Set(keys).size);
  assert.match(sw, /const CACHE = 'satoru-v232'/);
});
