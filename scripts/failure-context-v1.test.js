'use strict';

const assert = require('node:assert/strict');
const FC = require('../public/failure-context-v1.js');

assert.equal(FC.VERSION, '1.0.0');
assert.equal(FC.WINDOW_DAYS, 30);
assert.equal(FC.MIN_OBSERVED, 7);

// Последовательность из N дней, заканчивающаяся `last` (включительно).
function daysUpTo(last, n) {
  const out = [];
  const end = Date.parse(last + 'T00:00:00Z');
  for (let i = n - 1; i >= 0; i--) out.push(new Date(end - i * 86400000).toISOString().slice(0, 10));
  return out;
}

// ── typicalDone: медиана собственных непустых дней ───────────────────────────
assert.equal(FC.typicalDone([]), null);
assert.equal(FC.typicalDone([{ doneCount: 3 }, { doneCount: 4 }, { doneCount: 5 }]), null, 'три наблюдения — гадание, а не медиана');
assert.equal(FC.typicalDone([{ doneCount: 1 }, { doneCount: 2 }, { doneCount: 3 }, { doneCount: 9 }]), 2);
// Пустые дни в медиану не входят: иначе неделя простоя занизит «типичное» и
// объявит хорошими совершенно рядовые дни.
assert.equal(FC.typicalDone([{ doneCount: 0 }, { doneCount: 0 }, { doneCount: 4 }, { doneCount: 4 }, { doneCount: 4 }, { doneCount: 4 }]), 4);

// ── classifyDay ──────────────────────────────────────────────────────────────
assert.equal(FC.classifyDay({ doneCount: 0 }, 3), 'bad');
assert.equal(FC.classifyDay({ doneCount: 3 }, 3), 'normal', 'ровно типичный день — обычный, а не хороший');
assert.equal(FC.classifyDay({ doneCount: 4 }, 3), 'good');
assert.equal(FC.classifyDay({ doneCount: 9 }, null), 'normal', 'без медианы «хороших» не бывает');

// Закрытое ядро — хороший день независимо от объёма. Механика ядра обещает
// «закрыл ядро — день засчитан»; считать такой день обычным значит отменить
// обещание задним числом.
assert.equal(FC.classifyDay({ doneCount: 1, coreTotal: 1, coreDone: 1 }, 5), 'good');
assert.equal(FC.classifyDay({ doneCount: 1, coreTotal: 3, coreDone: 2 }, 5), 'normal', 'ядро закрыто не полностью');
// Ядро без единого сделанного дела всё равно плохой день: нечего было закрывать.
assert.equal(FC.classifyDay({ doneCount: 0, coreTotal: 3, coreDone: 0 }, 5), 'bad');

// ── Пример из плана целиком: «За 30 дней: 22 обычных, 5 хороших, 3 таких.
//    Это третий.» Ради этой строки фича и существует. ─────────────────────────
{
  const T = '2026-08-10';
  const bad = new Set(['2026-07-20', '2026-07-30', T]);
  const good = new Set(['2026-07-13', '2026-07-18', '2026-07-25', '2026-08-03', '2026-08-07']);
  const days = daysUpTo(T, 30).map((date) => ({
    date,
    doneCount: bad.has(date) ? 0 : good.has(date) ? 8 : 3,
  }));

  const ctx = FC.failureContext(days, T);
  assert.deepEqual(
    { normal: ctx.normal, good: ctx.good, bad: ctx.bad, todayRank: ctx.todayRank },
    { normal: 22, good: 5, bad: 3, todayRank: 3 },
  );
  assert.equal(ctx.observed, 30);
  assert.equal(ctx.sinceLastBad, 11, 'прошлый такой был 11 дней назад');
}

// ── Молчание: три случая, и все намеренные ───────────────────────────────────
{
  const T = '2026-08-10';
  const ok = daysUpTo(T, 10).map((date) => ({ date, doneCount: 3 }));

  // 1. Сегодня не плохой день — в хорошие и обычные дни это был бы шум
  assert.equal(FC.failureContext(ok, T), null);

  // 2. Данных мало: «за 30 дней это первый такой» на четвёртый день жизни в
  //    приложении — не факт, а выдуманная статистика
  const few = daysUpTo(T, 5).map((date, i) => ({ date, doneCount: i === 4 ? 0 : 3 }));
  assert.equal(FC.failureContext(few, T), null);
  assert.notEqual(FC.failureContext(few, T, { minObserved: 5 }), null, 'порог настраиваем');

  // 3. Сегодняшнего дня в данных нет — говорить не о чем
  const withoutToday = daysUpTo('2026-08-09', 10).map((date) => ({ date, doneCount: 0 }));
  assert.equal(FC.failureContext(withoutToday, T), null);

  assert.equal(FC.failureContext(ok, 'сегодня'), null);
  assert.equal(FC.failureContext(null, T), null);
}

// ── Окно: старое отсекается, будущее игнорируется, дубли не раздувают счёт ───
{
  const T = '2026-08-10';
  const days = daysUpTo(T, 40).map((date) => ({ date, doneCount: date === T ? 0 : 3 }));
  days.push({ date: '2026-09-01', doneCount: 99 });         // будущее
  days.push({ date: T, doneCount: 0 });                      // дубль сегодняшнего
  const ctx = FC.failureContext(days, T);
  assert.equal(ctx.observed, 30, 'ровно окно, без старого, будущего и дублей');
  assert.equal(ctx.bad, 1);
  assert.equal(ctx.sinceLastBad, null, 'единственный плохой день — предыдущего нет');
  assert.equal(ctx.todayRank, 1);
}

// Размер окна настраивается и отражается в ответе
{
  const T = '2026-08-10';
  const days = daysUpTo(T, 30).map((date) => ({ date, doneCount: date === T ? 0 : 3 }));
  const ctx = FC.failureContext(days, T, { windowDays: 14 });
  assert.equal(ctx.windowDays, 14);
  assert.equal(ctx.observed, 14);
}

// ── Никаких утешений в выдаче: только числа ──────────────────────────────────
// Если кто-то добавит сюда готовую фразу, гейт §4 («арифметика, а не утешение»)
// перестанет держаться, и этот тест должен сломаться.
{
  const T = '2026-08-10';
  const days = daysUpTo(T, 30).map((date) => ({ date, doneCount: date === T ? 0 : 3 }));
  const ctx = FC.failureContext(days, T);
  for (const [key, value] of Object.entries(ctx)) {
    assert.ok(value === null || typeof value === 'number', `${key} — не число: фраза собирается снаружи`);
  }
}

console.log('failure-context-v1: все проверки прошли');
