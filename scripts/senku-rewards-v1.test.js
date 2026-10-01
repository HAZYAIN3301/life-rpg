'use strict';

/* Награды за Senku (фаза 2, решение владельца 01.10): сессия → выполненный квест в сфере колоды.
 * Чистый модуль: сферы по названиям, деление смешанной сессии, ключ одной награды, ответ ИИ. */

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/senku-rewards-v1.js');

const spheres = [
  { id: 's-study', name: 'Учёба', path: ['Учёба'] },
  { id: 's-spanish', name: 'Spanisch', path: ['Учёба', 'Spanisch'] },
  { id: 's-bio', name: 'Биология', path: ['Учёба', 'Биология'] },
  { id: 's-health', name: 'Здоровье', path: ['Здоровье'] },
];
const sitting = (over = {}) => Object.assign({
  key: 'visual|2026-10-01T10:22:00.000Z', kind: 'visual', startedAt: '2026-10-01T10:22:00.000Z',
  endedAt: '2026-10-01T10:42:00.000Z', open: false, cards: 22, minutes: 20,
  decks: [{ deck: 'd-es', name: 'Descubrimiento', folder: ['Cards', 'Spanisch'], cards: 22 }],
}, over);
let n = 0;
const base = (over = {}) => Object.assign({
  sphereFor: (deck) => ({ 'd-es': 's-spanish', 'd-bio': 's-bio' })[deck.deck] || 's-study',
  existingKeys: new Set(), newId: () => `id${++n}`, dateOf: (iso) => iso.slice(0, 10), nowIso: '2026-10-01T12:00:00.000Z',
}, over);

test('сфера по названию: папка или колода совпадает со сферой, глубже — лучше; иначе null', () => {
  assert.equal(R.guessByName({ name: 'Descubrimiento', folder: ['Cards', 'Spanisch'] }, spheres), 's-spanish');
  assert.equal(R.guessByName({ name: 'Биология клетки', folder: [] }, spheres), 's-bio');
  assert.equal(R.guessByName({ name: 'ёлка', folder: ['12.1'] }, spheres), null);
  assert.equal(R.guessByName({ name: null, folder: [] }, spheres), null);
  assert.equal(R.guessByName({ name: 'Учёба', folder: [] }, spheres), 's-study');
});

test('смешанная сессия делится по сферам пропорционально карточкам, не меньше минуты', () => {
  const parts = R.splitSitting(sitting({ cards: 30, minutes: 30, decks: [
    { deck: 'd-es', name: 'Descubrimiento', cards: 20 }, { deck: 'd-bio', name: 'Клетка', cards: 9 }, { deck: 'd-x', name: 'Прочее', cards: 1 },
  ] }), base().sphereFor);
  assert.deepEqual(parts.map((p) => [p.skillId, p.cards, p.minutes]), [['s-spanish', 20, 20], ['s-bio', 9, 9], ['s-study', 1, 1]]);
  const tiny = R.splitSitting(sitting({ minutes: 0 }), base().sphereFor);
  assert.equal(tiny[0].minutes, 1);
});

test('план: каждая законченная сессия — выполненный квест с ключом; повтор и открытая — без второго квеста', () => {
  const done = sitting();
  const open = sitting({ key: 'visual|2026-10-01T11:00:00.000Z', startedAt: '2026-10-01T11:00:00.000Z', endedAt: null, open: true });
  const already = sitting({ key: 'voice|2026-10-01T07:00:00.000Z', kind: 'voice', startedAt: '2026-10-01T07:00:00.000Z', endedAt: '2026-10-01T07:30:00.000Z' });
  const bad = sitting({ key: 'telepathy|now' });
  const result = R.plan([done, open, already, bad], base({ existingKeys: new Set([already.key]) }));
  assert.deepEqual(result.keys, [done.key, already.key], 'уже созданный квест только отмечается заново');
  assert.equal(result.drafts.length, 1);
  const task = result.drafts[0];
  assert.deepEqual([task.skillId, task.estimateMin, task.actualMin, task.done, task.date, task.completedAt, task.source, task.senkuKey, task.senkuCards, task.difficulty],
    ['s-spanish', 20, 20, true, '2026-10-01', '2026-10-01T10:42:00.000Z', 'senku', done.key, 22, 'normal']);
  assert.deepEqual(task.senkuDecks, ['Descubrimiento']);
  assert.equal('xpAwarded' in task, false, 'награду считает приложение своей обычной формулой');
});

test('ИИ видит только колоды и сферы; ответ принимается только с известными id', () => {
  const ask = R.aiRequest([{ deck: 'd-es', name: 'Descubrimiento', folder: ['Cards'] }], spheres);
  assert.match(ask.prompt, /Descubrimiento/);
  assert.match(ask.prompt, /s-spanish/);
  assert.match(ask.system, /JSON only/);
  const text = 'Вот ответ: {"assign":[{"deck":"d-es","sphere":"s-spanish"},{"deck":"d-es2","sphere":"s-bio"},{"deck":"d-bio","sphere":"s-hacked"},{"deck":"d-bio","sphere":null}]}';
  assert.deepEqual(R.parseAi(text, ['d-es', 'd-bio'], spheres.map((s) => s.id)), { 'd-es': 's-spanish' });
  assert.deepEqual(R.parseAi('не JSON', ['d-es'], ['s-spanish']), {});
  const many = Array.from({ length: 60 }, (_, i) => ({ deck: `d${i}`, name: `Deck ${i}` }));
  assert.equal(R.aiRequest(many, spheres).prompt.split('\n').filter((line) => line.startsWith('{"deck"')).length, R.MAX_AI_DECKS);
});
