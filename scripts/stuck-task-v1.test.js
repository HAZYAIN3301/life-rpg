'use strict';

const assert = require('node:assert/strict');
const st = require('../public/stuck-task-v1.js');

assert.equal(st.VERSION, '1.0.0');
assert.equal(st.ASK_AFTER, 3);

// ── daysBetween: явная UTC-полночь, чтобы результат не зависел ни от часового
// пояса, ни от того, как движок разобрал строку.
assert.equal(st.daysBetween('2026-08-01', '2026-08-10'), 9);
assert.equal(st.daysBetween('2026-08-10', '2026-08-10'), 0);
// Интервал через переход на летнее время (29.03.2026). Здесь он проходит и без
// UTC — Date.parse для формата YYYY-MM-DD и так разбирает как UTC, а Math.round
// вытянул бы остаток в 30.958…; проверка держит границу на будущее.
assert.equal(st.daysBetween('2026-03-01', '2026-04-01'), 31);
assert.equal(st.daysBetween('мусор', '2026-08-10'), 0);

// ── notePostpone: обычный перенос просроченного дела вперёд ───────────────────
{
  const task = { date: '2026-08-05' };
  const patch = st.notePostpone(task, '2026-08-06', '2026-08-05');
  assert.deepEqual(patch, { postponedCount: 1, firstDate: '2026-08-05' });
}

// ── Повторный перенос: счётчик растёт, исходная дата НЕ переписывается.
// Это и есть то, чего не было в приложении: после второго переноса «откуда
// поехало» узнать неоткуда, если firstDate затирается вместе с date.
{
  const task = { date: '2026-08-07', postponedCount: 1, firstDate: '2026-08-05' };
  const patch = st.notePostpone(task, '2026-08-08', '2026-08-07');
  assert.deepEqual(patch, { postponedCount: 2, firstDate: '2026-08-05' });
}

// ── Не считаем: перенос назад, на ту же дату, и правку будущего дела.
// Планирование будущего — не избегание, и путать их нельзя: иначе человек,
// аккуратно раскладывающий календарь на неделю вперёд, получит вопрос
// «ты не знаешь, как это делать?» — то есть ровно упрёк за хорошую привычку.
assert.equal(st.notePostpone({ date: '2026-08-07' }, '2026-08-06', '2026-08-07'), null);
assert.equal(st.notePostpone({ date: '2026-08-07' }, '2026-08-07', '2026-08-07'), null);
assert.equal(st.notePostpone({ date: '2026-08-20' }, '2026-08-25', '2026-08-10'), null);

// ── Мусор на входе не роняет и не считает
assert.equal(st.notePostpone(null, '2026-08-06', '2026-08-05'), null);
assert.equal(st.notePostpone({ date: 'вчера' }, '2026-08-06', '2026-08-05'), null);
assert.equal(st.notePostpone({ date: '2026-08-05' }, '', '2026-08-05'), null);

// ── isStuck: порог, и всё, что вопрос отменяет ────────────────────────────────
const T = '2026-08-10';
assert.equal(st.isStuck({ date: T, postponedCount: 2 }, T), false, 'ниже порога — молчим');
assert.equal(st.isStuck({ date: T, postponedCount: 3 }, T), true);
assert.equal(st.isStuck({ date: T, postponedCount: 9, done: true }, T), false);
assert.equal(st.isStuck({ date: T, postponedCount: 9, amnesty: true }, T), false);

// Главный гейт ARENA §7: «без единой минуты работы». Дело, над которым уже
// сидели, — большая задача, а не избегание; спрашивать про неё «не знаешь как?»
// и неверно, и обидно.
assert.equal(st.isStuck({ date: T, postponedCount: 5, actualMin: 25 }, T), false);
assert.equal(st.isStuck({ date: T, postponedCount: 5, startTime: '09:00' }, T), false);

// ── stuckPick: одно дело за раз, детерминированно ─────────────────────────────
assert.equal(st.stuckPick([], T), null);
assert.equal(st.stuckPick(null, T), null);
assert.equal(st.stuckPick([{ id: 'a', date: T, postponedCount: 1 }], T), null);

// Больше переносов побеждает
{
  const picked = st.stuckPick([
    { id: 'a', date: T, postponedCount: 3, firstDate: '2026-08-01' },
    { id: 'b', date: T, postponedCount: 6, firstDate: '2026-08-04' },
  ], T);
  assert.equal(picked.id, 'b');
  assert.equal(picked.count, 6);
  assert.equal(picked.firstDate, '2026-08-04');
  assert.equal(picked.daysStuck, 6);
}

// При равных счётчиках — то, что стоит дольше
{
  const picked = st.stuckPick([
    { id: 'a', date: T, postponedCount: 3, firstDate: '2026-08-04' },
    { id: 'b', date: T, postponedCount: 3, firstDate: '2026-08-01' },
  ], T);
  assert.equal(picked.id, 'b');
  assert.equal(picked.daysStuck, 9);
}

// При полном равенстве — по id. Без этого ключа выбор скакал бы между
// рендерами, и вопрос менял бы дело прямо на глазах у человека.
{
  const tasks = [
    { id: 'z', date: T, postponedCount: 3, firstDate: '2026-08-01' },
    { id: 'a', date: T, postponedCount: 3, firstDate: '2026-08-01' },
  ];
  assert.equal(st.stuckPick(tasks, T).id, 'a');
  assert.equal(st.stuckPick(tasks.slice().reverse(), T).id, 'a', 'порядок входа не влияет');
}

// Дело без firstDate (перенесено кодом старой версии) не роняет расчёт
{
  const picked = st.stuckPick([{ id: 'a', date: '2026-08-08', postponedCount: 4 }], T);
  assert.equal(picked.firstDate, '2026-08-08');
  assert.equal(picked.daysStuck, 2);
}

// Отрицательного «стоит N дней» не бывает даже при кривых данных
{
  const picked = st.stuckPick([{ id: 'a', date: T, postponedCount: 3, firstDate: '2026-09-01' }], T);
  assert.equal(picked.daysStuck, 0);
}

console.log('stuck-task-v1: все проверки прошли');
