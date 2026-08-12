'use strict';
/* Поиск сферы по дереву (fb_msi16wnqpyrs — «неудобно искать, когда их много»;
 * fb_mqdgi36249e4 — «не могу выбрать учеба > школа > математика»). */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/sphere-search-v1.js');

const TREE = [
  { id: 'study', name: 'Учёба' },
  { id: 'school', name: 'Школа', parentId: 'study' },
  { id: 'math', name: 'Математика', parentId: 'school' },
  { id: 'bio', name: 'Биология', parentId: 'school' },
  { id: 'uni', name: 'Университет', parentId: 'study' },
  { id: 'unimath', name: 'Математика', parentId: 'uni' },
  { id: 'health', name: 'Здоровье' },
  { id: 'recovery', name: 'Восстановление', parentId: 'health' },
  { id: 'people', name: 'Отношения' },
];

test('третий уровень достижим — это и был баг', () => {
  const hit = S.search(TREE, 'математика').find((r) => r.id === 'math');
  assert.ok(hit, 'лист третьего уровня не найден');
  assert.deepEqual(hit.path, ['Учёба', 'Школа', 'Математика']);
  assert.equal(hit.depth, 2);
});

test('одноимённые сферы различимы по пути', () => {
  // Без пути «Математика» из Школы и из Университета неразличимы, и человек
  // выбирает наугад — то есть меняет одну неудобную форму на другую.
  const rows = S.search(TREE, 'математика').filter((r) => r.name === 'Математика');
  assert.equal(rows.length, 2);
  const labels = rows.map((r) => r.label).sort();
  assert.deepEqual(labels, ['Учёба › Университет › Математика', 'Учёба › Школа › Математика']);
});

test('порядок совпадений идёт за ожиданием человека', () => {
  // Точное имя → начало → вхождение → совпал предок.
  const rows = S.search(TREE, 'школа');
  assert.equal(rows[0].id, 'school', 'сама «Школа» должна быть первой');
  const inside = rows.findIndex((r) => r.id === 'math');
  assert.ok(inside > 0, 'вложенные показываются, но ниже самой Школы');
});

test('начало слова находится внутри названия', () => {
  const rows = S.search([{ id: 'hm', name: 'Высшая математика' }], 'мат');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'hm');
});

test('ё и регистр не мешают', () => {
  for (const q of ['учеба', 'Учёба', 'УЧЕБА', '  учёба  ']) {
    assert.ok(S.search(TREE, q).some((r) => r.id === 'study'), `не найдено по «${q}»`);
  }
});

test('столбы остаются выбираемыми, но leavesOnly работает', () => {
  assert.ok(S.search(TREE, 'здоровье').some((r) => r.id === 'health'));
  const leaves = S.search(TREE, '', { leavesOnly: true, limit: 50 });
  assert.ok(!leaves.some((r) => r.id === 'study'), 'столб не должен попасть в leavesOnly');
  assert.ok(leaves.some((r) => r.id === 'people'), 'сфера без детей — лист');
});

test('пустой запрос отдаёт список, а не пустоту', () => {
  const rows = S.search(TREE, '', { limit: 5 });
  assert.equal(rows.length, 5);
});

test('порядок детерминирован — выбор не скачет между рендерами', () => {
  const a = S.search(TREE, 'математика').map((r) => r.id);
  const b = S.search([...TREE].reverse(), 'математика').map((r) => r.id);
  assert.deepEqual(a, b, 'результат зависит от порядка входа');
});

test('петля в данных не вешает построение пути', () => {
  const loop = [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }];
  const rows = S.search(loop, 'a');
  assert.ok(rows.length >= 1);
  assert.ok(rows[0].path.length <= S.MAX_DEPTH);
});

test('терпимость к мусору', () => {
  assert.deepEqual(S.search(null, 'x'), []);
  assert.deepEqual(S.search([null, undefined, {}], 'x'), []);
  assert.equal(S.search([{ id: 'n' }], '', { limit: 5 })[0].name, '');
});

test('модуль не назначает сферу и не переводит имена', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/sphere-search-v1.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const bad of ['guessCategory', 'i18n']) {
    assert.ok(!src.includes(bad), `модуль вышел за свою роль: «${bad}»`);
  }
  // Функция перевода — именно `t(`, а не хвост чужого имени: голая подстрока
  // ловила `.test(` и падала на исправном коде.
  assert.equal(/\bt\(/.test(src), false, 'модуль зовёт переводчик — имена сфер это слова пользователя');
});
