'use strict';

const assert = require('node:assert/strict');
const obs = require('../public/day-observation-v1.js');

assert.equal(obs.VERSION, '1.0.0');
assert.equal(obs.LATE_START_HOUR, 12);
assert.equal(obs.QUIET_DAY_HOUR, 19);

const at = (h, m) => { const d = new Date(); d.setHours(h, m || 0, 0, 0); return d.toISOString(); };
const names = { sport: 'Спорт', study: 'Учёба' };

// ── Ничего не запланировано, ничего не сделано → тишина, не наблюдение в никуда
assert.equal(obs.observeDay({ tasks: [], skillNames: names, now: new Date(2026, 0, 1, 20, 0), hasPlan: false }), null);

// ── Обычный день: первое дело утром, ни одна сфера не доминирует → нет наблюдения
{
  const tasks = [
    { done: true, completedAt: at(9, 0), skillId: 'sport', minutes: 20 },
    { done: true, completedAt: at(11, 0), skillId: 'study', minutes: 25 },
  ];
  assert.equal(obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 14, 0) }), null);
}

// ── Кандидат 1: поздний старт — возвращает СЫРОЙ час, не готовую фразу
{
  const tasks = [
    { done: true, completedAt: at(13, 30), skillId: 'sport', minutes: 20 },
    { done: true, completedAt: at(15, 0), skillId: 'study', minutes: 15 },
  ];
  const o = obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 16, 0) });
  assert.deepEqual(o, { id: 'late-start', hour: 13 }, 'берётся САМОЕ раннее дело, не любое');
}
// Ровно на границе (12:00) — тоже считается поздним (>=, не >)
{
  const tasks = [{ done: true, completedAt: at(12, 0), skillId: 'sport', minutes: 30 }];
  assert.deepEqual(obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 14, 0) }), { id: 'late-start', hour: 12 });
}
// Дело без completedAt (не выполнено) не считается точкой отсчёта
{
  const tasks = [
    { done: false, completedAt: null, skillId: 'sport', minutes: 20 },
    { done: true, completedAt: at(9, 0), skillId: 'study', minutes: 20 },
  ];
  assert.equal(obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 14, 0) }), null);
}

// ── Кандидат 2: одна сфера съела почти всё время (порог по доле И по абсолютным минутам)
{
  const tasks = [
    { done: true, completedAt: at(9, 0), skillId: 'study', minutes: 90 },
    { done: true, completedAt: at(9, 30), skillId: 'sport', minutes: 10 },
  ];
  const o = obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 14, 0) });
  assert.deepEqual(o, { id: 'sphere-dominant', sphereName: 'Учёба', pct: 90 });
}
// Доля высокая, но абсолютных минут мало (10 мин) — шум, не наблюдение
{
  const tasks = [{ done: true, completedAt: at(9, 0), skillId: 'study', minutes: 10 }];
  assert.equal(obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 14, 0) }), null);
}
// Неизвестный id сферы → показываем сам id, не роняем функцию
{
  const tasks = [{ done: true, completedAt: at(9, 0), skillId: 'ghost', minutes: 90 }];
  assert.equal(obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 14, 0) }).sphereName, 'ghost');
}

// ── Кандидат 3: тихий день — план был, час поздний, ничего не сделано
{
  const tasks = [{ done: false, completedAt: null, skillId: 'sport', minutes: 20 }];
  const o = obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 19, 0) });
  assert.deepEqual(o, { id: 'quiet-day' });
}
// Тот же день, но ещё не вечер — рано делать вывод
{
  const tasks = [{ done: false, completedAt: null, skillId: 'sport', minutes: 20 }];
  assert.equal(obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 18, 59) }), null);
}

// ── Приоритет: если день одновременно «поздний старт» И «доминирующая сфера»,
// побеждает то, что стоит раньше в порядке кандидатов (late-start).
{
  const tasks = [
    { done: true, completedAt: at(13, 0), skillId: 'study', minutes: 90 },
    { done: true, completedAt: at(14, 0), skillId: 'study', minutes: 10 },
  ];
  assert.equal(obs.observeDay({ tasks, skillNames: names, now: new Date(2026, 0, 1, 15, 0) }).id, 'late-start');
}

console.log('day-observation-v1: все проверки прошли');
