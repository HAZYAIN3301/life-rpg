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

// Владелец 03.10: «у нас же есть ИИ — пусть исправит». Правило «ничего не угадывать» смягчено ровно
// настолько: догадка модели принимается, только если она заполняет дыры «�» и не трогает больше
// ни одного символа, человек видит «было → стало» до записи, а сервер проверяет каждую замену снова.
test('восстановление может только заполнить дыры: остальной текст символ в символ', () => {
  const damaged = 'не ух��дя в слив';
  assert.equal(D.restorationValid(damaged, 'не уходя в слив'), true);
  assert.equal(D.restorationValid(damaged, 'не уходя в сливы'), false, 'добавить слово нельзя');
  assert.equal(D.restorationValid(damaged, 'Не уходя в слив'), false, 'поменять регистр нельзя');
  assert.equal(D.restorationValid(damaged, 'не ухдя в слив'), false, 'дыру нельзя оставить пустой');
  assert.equal(D.restorationValid(damaged, 'не ухоооодя в слив'), false, 'дыра из двух знаков — не больше двух символов');
  assert.equal(D.restorationValid(damaged, 'не ух�дя в слив'), false, 'знак порчи не может остаться');
  assert.equal(D.restorationValid('без порчи', 'без порчи'), false, 'целую строку «чинить» нечего');
  assert.equal(D.restorationValid('С��да (как) [и] $1 вебшутеры.*', 'Сюда (как) [и] $1 вебшутеры.*'), true, 'спецсимволы регулярных выражений — просто текст');
});

test('наружу уходят только фрагменты вокруг дыр, и они собираются обратно', () => {
  const text = 'А'.repeat(300) + ' ух��дя ' + 'Б'.repeat(300) + ' С��да ' + 'В'.repeat(10) + ' ��ичная';
  const wins = D.windows(text, 20);
  assert.equal(wins.length, 2, 'близкие дыры сливаются в один фрагмент');
  assert.ok(wins.every((w) => w.text.length < 80));
  const fixed = wins.map((w) => w.text.replace('ух��дя', 'уходя').replace('С��да', 'Сюда').replace('��ичная', 'личная'));
  const whole = D.spliceWindows(text, wins, fixed);
  assert.equal(whole, text.replace('ух��дя', 'уходя').replace('С��да', 'Сюда').replace('��ичная', 'личная'));
  assert.equal(D.spliceWindows(text, wins, [fixed[0], fixed[1] + '!']), null, 'один нечестный фрагмент — строка не меняется');
});

test('план из восстановлений: только та же строка на том же месте', () => {
  const current = { skills: [{ id: 's1', name: 'Учёба', note: 'не ух��дя в слив' }] };
  const ok = { path: '.skills[0].note', from: 'не ух��дя в слив', to: 'не уходя в слив' };
  assert.equal(D.planFromRestorations(current, [ok]).length, 1);
  assert.equal(D.planFromRestorations(current, [{ ...ok, from: 'другое ух��дя' }]).length, 0, 'строка уже другая');
  assert.equal(D.planFromRestorations(current, [{ ...ok, path: '.skills[0].name' }]).length, 0, 'чужое место');
  assert.equal(D.planFromRestorations(current, [{ ...ok, to: 'совсем другой текст' }]).length, 0, 'не только дыры');
  const applied = D.applyRepair(current, D.planFromRestorations(current, [ok]));
  assert.equal(applied.value.skills[0].note, 'не уходя в слив');
});
