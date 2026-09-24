'use strict';
/* Ремонт порчи от разрыва многобайтовых символов. Главное правило: НИЧЕГО НЕ УГАДЫВАТЬ.
 * Потерянные байты не восстановимы, поэтому чинить можно только тем, что реально лежит
 * в бэкапе. Место без целого источника остаётся как есть — с видимой дыркой, а не с
 * правдоподобной выдумкой.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../public/damage-repair-v1.js');

const dmg = '��чета за месяц';

test('не подставляет текст другой записи по совпавшему индексу', () => {
  const current = [{ id: 'new', title: dmg }];
  const plan = D.planRepair(current, [{ value: [{ id: 'old', title: 'Чужая запись' }] }]);
  assert.equal(plan.repairable, 0);
  assert.deepEqual(D.applyRepair(current, plan.plan).value, current);
});

test('сводка считает поля, различает повреждённый текст и не считает emoji порчей', () => {
  const a = D.summary({ notes: [{ id: 'a', text: '���' }, { id: 'b', text: 'Україна, Köln, 日本 🐈' }] });
  assert.equal(a.rows[0].count, 1);
  assert.notEqual(a.signature, D.summary({ notes: [{ id: 'a', text: '��X' }] }).signature);
  assert.deepEqual(D.summary({ text: 'Україна, Köln, 日本 🐈' }).rows, []);
});

test('квитанция ремонта требует согласованных количеств, а не одного ok', () => {
  const receipt = { ok: true, apply: true, total: 2, fixable: 1, done: 1,
    report: [{ file: 'inbox', spots: 2, repairable: 1, applied: 1 }] };
  assert.equal(D.validReceipt(receipt), true);
  assert.equal(D.validReceipt({ ...receipt, done: 2 }), false);
  assert.equal(D.validReceipt({ ok: true }), false);
});

test('находит порчу и запоминает, чья это запись', () => {
  const spots = D.findDamage({ tasks: [{ id: 'a', title: 'целый' }, { id: 'b', title: dmg }] });
  assert.equal(spots.length, 1);
  assert.equal(spots[0].carrier, 'b', 'нужен id носителя: индекс в массиве мог сдвинуться');
  assert.equal(spots[0].key, 'title');
  assert.equal(spots[0].marks, 2);
});

test('чинит по id даже когда порядок в массиве изменился', () => {
  const current = { tasks: [{ id: 'x', title: 'ок' }, { id: 'b', title: dmg }] };
  const backup = { label: 'вчера', value: { tasks: [{ id: 'b', title: 'счета за месяц' }, { id: 'x', title: 'ок' }] } };
  const plan = D.planRepair(current, [backup]);
  assert.equal(plan.spots, 1);
  assert.equal(plan.repairable, 1);
  assert.equal(plan.plan[0].clean, 'счета за месяц');
  assert.equal(plan.plan[0].source, 'вчера');
  const applied = D.applyRepair(current, plan.plan);
  assert.equal(applied.applied, 1);
  assert.equal(applied.value.tasks[1].title, 'счета за месяц');
});

test('🔴 без целого источника место остаётся нетронутым', () => {
  const current = { tasks: [{ id: 'b', title: dmg }] };
  const plan = D.planRepair(current, [{ label: 'старый', value: { tasks: [{ id: 'b', title: 'тоже �порча' }] } }]);
  assert.equal(plan.repairable, 0, 'испорченный бэкап не источник');
  assert.equal(plan.plan[0].clean, null);
  const applied = D.applyRepair(current, plan.plan);
  assert.equal(applied.applied, 0);
  assert.equal(applied.value.tasks[0].title, dmg, 'дырку видно — выдумывать нельзя');
});

test('берёт первый по свежести бэкап, где строка цела', () => {
  const current = { tasks: [{ id: 'b', title: dmg }] };
  const plan = D.planRepair(current, [
    { label: 'свежий-но-битый', value: { tasks: [{ id: 'b', title: '�чета' }] } },
    { label: 'постарше-целый', value: { tasks: [{ id: 'b', title: 'счета за месяц' }] } },
    { label: 'совсем-старый', value: { tasks: [{ id: 'b', title: 'счета' }] } },
  ]);
  assert.equal(plan.plan[0].clean, 'счета за месяц');
  assert.equal(plan.plan[0].source, 'постарше-целый');
});

test('чинит и вложенные поля без id — по пути', () => {
  const current = { settings: { profile: { note: dmg } } };
  const plan = D.planRepair(current, [{ label: 'b', value: { settings: { profile: { note: 'счета за месяц' } } } }]);
  assert.equal(plan.repairable, 1);
  assert.equal(D.applyRepair(current, plan.plan).value.settings.profile.note, 'счета за месяц');
});

test('исходный объект не мутируется', () => {
  const current = { tasks: [{ id: 'b', title: dmg }] };
  const plan = D.planRepair(current, [{ label: 'b', value: { tasks: [{ id: 'b', title: 'счета' }] } }]);
  D.applyRepair(current, plan.plan);
  assert.equal(current.tasks[0].title, dmg, 'план не должен править вход на месте');
});
