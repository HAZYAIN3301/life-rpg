'use strict';

/* Резолвер целей: фраза человека → точные id до того, как что-то произойдёт.
 *
 * Главное, что проверяется, — асимметрия цены ошибки. Лишний кандидат в списке
 * стоит человеку двух секунд, а тихо задетая не та цель стоит потери из виду.
 * Поэтому слабые совпадения показываются, но никогда не отмечаются заранее, а
 * отсутствие уверенных совпадений обязано быть видно вызывающему.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const G = require('../public/goal-resolve-v1.js');

const goals = [
  { id: 'g1', title: 'Пробежать полумарафон', group: 'Бег' },
  { id: 'g2', title: 'Jugend Forscht — биосенсор', project: 'JuFo' },
  { id: 'g3', title: 'Jugend-Forscht: подготовить стенд' },
  { id: 'g4', title: 'Немецкий C1' },
  { id: 'g5', title: 'Бегать три раза в неделю', sphere: 'Спорт' },
];

test('🔴 морфология не мешает: «бег» находит «пробежать» и «бегать»', () => {
  const r = G.resolve('всё про бег', goals);
  const ids = r.strong.map((c) => c.id);
  assert.ok(ids.includes('g1'), 'пробежать/Бег');
  assert.ok(ids.includes('g5'), 'бегать');
  assert.ok(!ids.includes('g4'), 'немецкий не про бег');
});

test('🔴 дефис не мешает: «Jugend Forscht» находит и «Jugend-Forscht»', () => {
  const r = G.resolve('убери все цели Jugend Forscht', goals);
  const ids = r.strong.map((c) => c.id);
  assert.ok(ids.includes('g2'));
  assert.ok(ids.includes('g3'), 'дефис — разделитель, а не буква');
  assert.ok(!ids.includes('g4'));
});

test('поиск идёт и по группе, и по проекту, и по сфере', () => {
  assert.ok(G.resolve('спорт', goals).strong.map((c) => c.id).includes('g5'), 'сфера');
  assert.ok(G.resolve('JuFo', goals).strong.map((c) => c.id).includes('g2'), 'проект');
});

test('🔴 слабые совпадения показываются, но не отмечаются заранее', () => {
  const r = G.resolve('бег', goals);
  const pre = G.preselectIds(r);
  for (const w of r.weak) {
    assert.strictEqual(pre.includes(w.id), false, `слабый кандидат отмечен заранее: ${w.id}`);
  }
  for (const s of r.strong) assert.ok(pre.includes(s.id));
});

test('🔴 отсутствие уверенных совпадений видно вызывающему', () => {
  const r = G.resolve('квантовая хромодинамика', goals);
  assert.strictEqual(r.ambiguous, true, 'вызывающий обязан спросить, а не действовать');
  assert.strictEqual(r.strong.length, 0);
});

test('пустой запрос и пустой список не выдают кандидатов', () => {
  assert.strictEqual(G.resolve('', goals).strong.length, 0);
  assert.strictEqual(G.resolve('бег', []).strong.length, 0);
  assert.strictEqual(G.resolve(null, null).ambiguous, true);
});

test('служебные слова не делают совпадением всё подряд', () => {
  // «все цели про» есть в любом запросе и не должны ничего находить сами по себе.
  const r = G.resolve('все цели про', goals);
  assert.strictEqual(r.tokens.length, 0, 'стоп-слова отброшены');
  assert.strictEqual(r.strong.length, 0);
});

test('короткие токены не участвуют — они совпадают со всем', () => {
  assert.deepStrictEqual(G.tokens('в на до и'), []);
  assert.ok(G.tokens('бег немецкий').length === 2);
});

test('🔴 порядок выдачи стабилен между показом и подтверждением', () => {
  const a = G.resolve('jugend forscht', goals);
  const b = G.resolve('jugend forscht', goals);
  assert.deepStrictEqual(a.strong.map((c) => c.id), b.strong.map((c) => c.id));
  // и сортировка по уверенности, а не по порядку в массиве
  const scores = a.strong.map((c) => c.score);
  assert.deepStrictEqual(scores, scores.slice().sort((x, y) => y - x));
});

test('регистр и ё не мешают', () => {
  assert.strictEqual(G.normalize('Ёлка-Приключение'), 'елка приключение');
  assert.ok(G.resolve('JUGEND FORSCHT', goals).strong.length >= 2);
});

test('архивные цели видны в кандидатах с пометкой', () => {
  const withArchived = goals.concat([{ id: 'g6', title: 'Бег по утрам', archived: true }]);
  const r = G.resolve('бег', withArchived);
  const found = r.strong.concat(r.weak).find((c) => c.id === 'g6');
  assert.ok(found, 'архивная цель не исчезает из выдачи');
  assert.strictEqual(found.archived, true, 'но человек видит, что она в архиве');
});

test('цель без id не попадает в выдачу', () => {
  const r = G.resolve('бег', [{ title: 'Бег без id' }]);
  assert.strictEqual(r.strong.length + r.weak.length, 0);
});

test('🔴 длинное название не проигрывает короткому за многословность', () => {
  const pair = [
    { id: 'short', title: 'Бег' },
    { id: 'long', title: 'Бег как способ восстановления после учебной недели' },
  ];
  const r = G.resolve('бег', pair);
  assert.strictEqual(r.strong.length, 2, 'оба уверенные');
});

test('🔴 в модуле нет ASCII-границы слова — она молча не работает на кириллице', () => {
  // Этот баг в проекте ловили дважды. Здесь границы слов не используются вовсе.
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/goal-resolve-v1.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  assert.strictEqual(code.includes('\\b'), false, 'граница слова в коде резолвера');
});

test('модуль не читает State, DOM и сеть', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/goal-resolve-v1.js'), 'utf8');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/', 'openai', 'embedding']) {
    assert.strictEqual(src.toLowerCase().includes(bad.toLowerCase()), false, `модуль вышел за свою роль: «${bad}»`);
  }
});
