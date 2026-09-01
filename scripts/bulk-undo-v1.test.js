'use strict';

/* Массовая операция как обратимая транзакция.
 *
 * Проверяется то, из-за чего массовые действия и были запрещены раньше: что
 * предпросмотр точен, что откат возвращает прошлые значения, а не «наоборот»,
 * что повтор не удваивает, и что просроченный откат отказывает вслух.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const B = require('../public/bulk-undo-v1.js');

const NOW = '2026-09-02T10:00:00.000Z';
const later = (ms) => new Date(Date.parse(NOW) + ms).toISOString();

const goals = () => ([
  { id: 'g1', title: 'Бег 10 км', archived: false, paused: false },
  { id: 'g2', title: 'Jugend Forscht', archived: true, paused: false },
  { id: 'g3', title: 'Немецкий C1', archived: false, paused: true },
]);

test('неизвестная операция и пустой список не планируются', () => {
  assert.strictEqual(B.plan(null), null);
  assert.strictEqual(B.plan({ op: 'уничтожить', ids: ['g1'], items: goals() }), null);
  assert.strictEqual(B.plan({ op: 'archive', ids: [], items: goals() }), null);
  assert.strictEqual(B.plan({ op: 'archive', ids: ['g1'], items: null }), null);
});

test('🔴 предпросмотр отделяет изменяемое от уже готового и от несуществующего', () => {
  const p = B.plan({ op: 'archive', ids: ['g1', 'g2', 'нет-такого'], items: goals() });
  assert.deepStrictEqual(p.affected.map((a) => a.id), ['g1'], 'g2 уже в архиве');
  assert.deepStrictEqual(p.skipped.map((a) => a.id), ['g2']);
  assert.deepStrictEqual(p.missing, ['нет-такого'], 'чужой id виден человеку, а не проглатывается');
  assert.strictEqual(p.affected[0].from, false);
  assert.strictEqual(p.affected[0].to, true);
  assert.strictEqual(p.affected[0].title, 'Бег 10 км', 'в предпросмотре есть чем опознать объект');
});

test('предпросмотр ничего не меняет', () => {
  const items = goals();
  const snapshot = JSON.stringify(items);
  B.plan({ op: 'archive', ids: ['g1'], items });
  assert.strictEqual(JSON.stringify(items), snapshot);
});

test('дубль id в запросе не трогает объект дважды', () => {
  const p = B.plan({ op: 'archive', ids: ['g1', 'g1', 'g1'], items: goals() });
  assert.strictEqual(p.affected.length, 1);
});

test('пачка ограничена — нечитаемый список не является предпросмотром', () => {
  const many = Array.from({ length: B.MAX_ITEMS + 1 }, (_, i) => 'x' + i);
  assert.strictEqual(B.plan({ op: 'archive', ids: many, items: goals() }), null);
});

test('применение меняет только запланированное', () => {
  const items = goals();
  const p = B.plan({ op: 'archive', ids: ['g1', 'g2'], items });
  const r = B.apply(items, p, NOW, []);
  assert.strictEqual(r.applied, true);
  assert.strictEqual(r.items.find((x) => x.id === 'g1').archived, true);
  assert.strictEqual(r.items.find((x) => x.id === 'g3').archived, false, 'непричастное не тронуто');
  assert.strictEqual(r.items.find((x) => x.id === 'g3').paused, true, 'чужие поля не тронуты');
  assert.strictEqual(items.find((x) => x.id === 'g1').archived, false, 'исходный массив не мутирован');
});

test('🔴 повтор той же транзакции не удваивает', () => {
  const items = goals();
  const p = B.plan({ op: 'archive', ids: ['g1'], items });
  const first = B.apply(items, p, NOW, []);
  const second = B.apply(first.items, p, NOW, [p.planId]);
  assert.strictEqual(second.applied, false);
  assert.strictEqual(second.reason, 'already_applied');
  assert.strictEqual(second.undo, null, 'повтор не выдаёт второй токен отката');
});

test('planId детерминирован — то же намерение даёт тот же id', () => {
  const a = B.plan({ op: 'archive', ids: ['g1', 'g3'], items: goals() });
  const b = B.plan({ op: 'archive', ids: ['g3', 'g1'], items: goals() });
  assert.strictEqual(a.planId, b.planId, 'порядок в запросе не создаёт новую транзакцию');
});

test('нечего менять — честный отказ, а не пустой успех', () => {
  const items = goals();
  const p = B.plan({ op: 'archive', ids: ['g2'], items });
  const r = B.apply(items, p, NOW, []);
  assert.strictEqual(r.applied, false);
  assert.strictEqual(r.reason, 'nothing_to_do');
});

test('🔴 откат возвращает ПРОШЛЫЕ значения, а не противоположные', () => {
  // Ключевое: у g1 было false, у g3 было true. «Сделать наоборот» сломало бы g3.
  const items = goals();
  const p = B.plan({ op: 'pause', ids: ['g1', 'g3'], items });
  assert.deepStrictEqual(p.affected.map((a) => a.id), ['g1'], 'g3 уже на паузе и не участвует');
  const r = B.apply(items, p, NOW, []);
  assert.strictEqual(r.items.find((x) => x.id === 'g1').paused, true);

  const back = B.undo(r.items, r.undo, r.undo.token, later(1000));
  assert.strictEqual(back.undone, true);
  assert.strictEqual(back.items.find((x) => x.id === 'g1').paused, false, 'вернулось прежнее');
  assert.strictEqual(back.items.find((x) => x.id === 'g3').paused, true, 'не участвовавший не тронут откатом');
});

test('🔴 просроченный откат отказывает вслух', () => {
  const items = goals();
  const p = B.plan({ op: 'archive', ids: ['g1'], items });
  const r = B.apply(items, p, NOW, []);
  const late = B.undo(r.items, r.undo, r.undo.token, later(B.UNDO_TTL_MS + 1000));
  assert.strictEqual(late.undone, false);
  assert.strictEqual(late.reason, 'expired', 'молчаливое «ничего не произошло» оставило бы ложную уверенность');
  assert.strictEqual(late.items.find((x) => x.id === 'g1').archived, true, 'состояние не изменилось');
});

test('чужой токен не откатывает', () => {
  const items = goals();
  const p = B.plan({ op: 'archive', ids: ['g1'], items });
  const r = B.apply(items, p, NOW, []);
  const bad = B.undo(r.items, r.undo, 'подделка', later(1000));
  assert.strictEqual(bad.undone, false);
  assert.strictEqual(bad.reason, 'bad_token');
  assert.strictEqual(B.undo(r.items, null, 'x', later(1000)).reason, 'no_record');
});

test('откат сам по себе идемпотентен по состоянию', () => {
  const items = goals();
  const p = B.plan({ op: 'archive', ids: ['g1'], items });
  const r = B.apply(items, p, NOW, []);
  const once = B.undo(r.items, r.undo, r.undo.token, later(1000));
  const twice = B.undo(once.items, r.undo, r.undo.token, later(2000));
  assert.strictEqual(twice.items.find((x) => x.id === 'g1').archived, false, 'повторный откат не переворачивает обратно');
});

test('🔴 ни одна операция ничего не уничтожает', () => {
  const items = goals();
  for (const op of B.OP_LIST) {
    const p = B.plan({ op, ids: ['g1', 'g2', 'g3'], items });
    if (!p || !p.affected.length) continue;
    const r = B.apply(items, p, NOW, []);
    assert.strictEqual(r.items.length, items.length, `${op} изменил количество объектов`);
    for (const before of items) {
      assert.ok(r.items.some((x) => x.id === before.id), `${op} потерял объект ${before.id}`);
    }
  }
  // И в самом словаре нет разрушительных глаголов.
  for (const op of B.OP_LIST) {
    for (const bad of ['delete', 'remove', 'destroy', 'purge', 'wipe']) {
      assert.strictEqual(op.toLowerCase().includes(bad), false, `разрушительная операция: ${op}`);
    }
  }
});

test('журнал пишет что произошло, но не копирует содержимое объектов', () => {
  const items = goals();
  const p = B.plan({ op: 'archive', ids: ['g1', 'g2', 'нет'], items });
  const r = B.apply(items, p, NOW, []);
  const e = B.auditEntry(p, r, NOW);
  assert.strictEqual(e.op, 'archive');
  assert.strictEqual(e.applied, true);
  assert.strictEqual(e.affected, 1);
  assert.strictEqual(e.skipped, 1);
  assert.strictEqual(e.missing, 1);
  assert.strictEqual(JSON.stringify(e).includes('Jugend'), false, 'заголовки в аудит не копируются');
});

test('модуль не читает State, DOM и часы сам', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/bulk-undo-v1.js'), 'utf8');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/']) {
    assert.strictEqual(src.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  assert.strictEqual(/Date\.now\(\)/.test(code), false, 'время приходит параметром');
});
