'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CANON_DOMAINS,
  autoCanon,
  canonById,
  canonOf,
} = require('../public/canon-domains.js');

test('keeps the canonical set bounded to ten domains', () => {
  assert.equal(CANON_DOMAINS.length, 10);
  assert.equal(new Set(CANON_DOMAINS.map((domain) => domain.id)).size, 10);
});

test('routes recovery language to rest instead of body', () => {
  for (const name of ['Сон', 'Выспаться', 'Дневной сон', 'Восстановление', 'Sleep', 'Nap']) {
    assert.equal(autoCanon(name), 'rest', name);
  }
});

test('does not confuse thinking with muscles', () => {
  assert.equal(autoCanon('Мышление'), 'growth');
  assert.equal(autoCanon('Критическое мышление'), 'growth');
  assert.equal(autoCanon('Развитие мышц'), 'body');
  assert.equal(autoCanon('Мускулатура'), 'body');
});

test('recognizes real body and combat-sport sphere names', () => {
  for (const name of ['Дзюдо', 'Растяжка', 'Единоборства', 'Плавание', 'Велоспорт']) {
    assert.equal(autoCanon(name), 'body', name);
  }
});

test('recognizes creative sphere names and mixed phrases', () => {
  for (const name of ['Косплей', 'Боевая каллиграфия', 'Рисование', 'Музыка']) {
    assert.equal(autoCanon(name), 'create', name);
  }
});

test('recognizes money and resources without collapsing them into work', () => {
  for (const name of ['Заработок', 'Деньги', 'Личные финансы', 'Ресурсы']) {
    assert.equal(autoCanon(name), 'money', name);
  }
  assert.equal(autoCanon('Карьера'), 'work');
});

test('preserves a valid manual override and ignores an invalid one', () => {
  assert.equal(canonOf({ name: 'Сон', canon: 'body' }), 'body');
  assert.equal(canonOf({ name: 'Сон', canon: 'not-a-domain' }), 'rest');
  assert.equal(canonById('body').name, 'Тело / Здоровье');
  assert.equal(canonById('not-a-domain'), null);
});

test('returns null for an unknown empty or arbitrary sphere', () => {
  assert.equal(autoCanon(''), null);
  assert.equal(autoCanon('Квантовый ананас'), null);
  assert.equal(canonOf(null), null);
});
