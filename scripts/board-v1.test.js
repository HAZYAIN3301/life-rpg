'use strict';

const assert = require('node:assert/strict');
const B = require('../public/board-v1.js');

assert.equal(B.VERSION, '1.0.0');
assert.equal(B.BOARD_PERSONAL, 3);
assert.equal(B.BOARD_SEASONAL, 1);
assert.equal(B.MAX_ACTIVE, 3);

const T = '2026-08-10';
const order = (id, extra) => Object.assign({ id, sphereId: 'craft' }, extra || {});
const pool = [
  order('p1'), order('p2'), order('p3'), order('p4'), order('p5'),
  order('s1', { seasonal: true, seasons: ['summer'], sphereId: null }),
  order('s2', { seasonal: true, seasons: ['winter'], sphereId: null }),
];

// ── Сезоны (§7): календарные границы ─────────────────────────────────────────
assert.equal(B.seasonOf('2026-12-01'), 'winter');
assert.equal(B.seasonOf('2026-01-31'), 'winter');
assert.equal(B.seasonOf('2026-02-28'), 'winter');
assert.equal(B.seasonOf('2026-03-01'), 'spring');
assert.equal(B.seasonOf('2026-05-31'), 'spring');
assert.equal(B.seasonOf('2026-06-01'), 'summer');
assert.equal(B.seasonOf('2026-08-31'), 'summer');
assert.equal(B.seasonOf('2026-09-01'), 'autumn');
assert.equal(B.seasonOf('2026-11-30'), 'autumn');
assert.equal(B.seasonOf('когда-то'), null);

// ── Доска стабильна всю неделю и меняется на следующей ───────────────────────
// Если состав меняется на каждом рендере, человек не успевает решиться, а
// заказ, который он присмотрел утром, к вечеру исчезает.
{
  const sameWeek = ['2026-08-11', '2026-08-12', '2026-08-13'].find((d) => B.periodKey(d) === B.periodKey(T));
  assert.ok(sameWeek, 'нужна вторая дата в той же неделе');
  const a = B.board(pool, {}, B.emptyState(), T);
  const b = B.board(pool, {}, B.emptyState(), sameWeek);
  assert.deepEqual(a.personal.map((o) => o.id), b.personal.map((o) => o.id));

  // Порядок пула не влияет — иначе доска «дрожала» бы от порядка хранения
  const shuffled = B.board(pool.slice().reverse(), {}, B.emptyState(), T);
  assert.deepEqual(shuffled.personal.map((o) => o.id), a.personal.map((o) => o.id));

  assert.equal(B.periodKey('2026-08-13') - B.periodKey('2026-08-06'), 1);
}

// ── Состав доски: 3 личных + 1 сезонный, сезонный по текущему сезону ─────────
{
  const view = B.board(pool, {}, B.emptyState(), T);
  assert.equal(view.season, 'summer');
  assert.equal(view.personal.length, 3);
  assert.equal(view.seasonal.id, 's1', 'зимний заказ летом на доску не попадает');
  assert.ok(view.personal.every((o) => !o.seasonal));

  const winter = B.board(pool, {}, B.emptyState(), '2026-01-15');
  assert.equal(winter.seasonal.id, 's2');
}

// ── Приоритет запущенным сферам (§3: заказ в пустую сферу = напоминание) ────
{
  const mixed = [
    order('body1', { sphereId: 'body' }), order('body2', { sphereId: 'body' }),
    order('craft1', { sphereId: 'craft' }), order('craft2', { sphereId: 'craft' }),
    order('alien1', { sphereId: 'unknown-sphere' }),
  ];
  const view = B.board(mixed, { neglectedSpheres: ['body'], activeSpheres: ['body', 'craft'] }, B.emptyState(), T);
  const ids = view.personal.map((o) => o.id);
  assert.ok(ids.includes('body1') && ids.includes('body2'), 'обе запущенные сферы впереди');
  assert.ok(!ids.includes('alien1'), 'чужая сфера уступает своим');
}

// ── Взятый заказ уходит с доски ──────────────────────────────────────────────
{
  const taken = B.takeOrder(B.emptyState(), order('p1'), T);
  assert.equal(taken.ok, true);
  const view = B.board(pool, {}, taken.state, T);
  assert.ok(!view.personal.some((o) => o.id === 'p1'), 'сорванный заказ на доске не висит');
  assert.deepEqual(B.activeOrders(taken.state).map((a) => a.orderId), ['p1']);
}

// ── takeOrder: потолок и повторы ─────────────────────────────────────────────
{
  let s = B.emptyState();
  for (const id of ['p1', 'p2', 'p3']) s = B.takeOrder(s, order(id), T).state;
  assert.deepEqual(B.takeOrder(s, order('p4'), T), { ok: false, error: 'limit' });
  assert.deepEqual(B.takeOrder(s, order('p1'), T), { ok: false, error: 'already' });
  assert.deepEqual(B.takeOrder(B.emptyState(), null, T), { ok: false, error: 'invalid' });
  assert.deepEqual(B.takeOrder(B.emptyState(), order('p1'), 'завтра'), { ok: false, error: 'invalid' });
}

// ── completeOrder: сфера отдаётся наружу (§11 в.6 решает вызывающий) ────────
{
  const taken = B.takeOrder(B.emptyState(), order('p1', { sphereId: 'body' }), T).state;
  const done = B.completeOrder(taken, 'p1', T);
  assert.equal(done.ok, true);
  assert.equal(done.sphereId, 'body');
  assert.deepEqual(B.activeOrders(done.state), []);

  // Выполненный не возвращается на доску сразу
  assert.ok(!B.board(pool, {}, done.state, T).personal.some((o) => o.id === 'p1'));
  const later = new Date(Date.parse(T + 'T00:00:00Z') + (B.DONE_COOLDOWN_DAYS + 1) * 86400000).toISOString().slice(0, 10);
  assert.ok(B.board(pool, {}, done.state, later).personal.some((o) => o.id === 'p1'), 'через отдых возвращается');

  assert.equal(B.completeOrder(B.emptyState(), 'p1', T).ok, false, 'нельзя закрыть невзятое');
}

// ── returnOrder: гейт §3 — без всяких последствий ────────────────────────────
{
  const taken = B.takeOrder(B.emptyState(), order('p1'), T).state;
  const back = B.returnOrder(taken, 'p1', T);
  assert.deepEqual(B.activeOrders(back), [], 'заказ снят');
  assert.deepEqual(back.done, [], 'возврат не считается выполнением');

  // Ненадолго уходит с доски — это отдых, а не наказание
  assert.ok(!B.board(pool, {}, back, T).personal.some((o) => o.id === 'p1'));
  const later = new Date(Date.parse(T + 'T00:00:00Z') + (B.RETURN_REST_DAYS + 1) * 86400000).toISOString().slice(0, 10);
  assert.ok(B.board(pool, {}, back, later).personal.some((o) => o.id === 'p1'));

  // Повторный возврат НЕ накапливается: если бы отметки копились, из них
  // немедленно посчитали бы «сколько раз ты бросал» — то есть вину.
  let s = back;
  for (let i = 0; i < 5; i++) {
    s = B.takeOrder(s, order('p1'), T).state;
    s = B.returnOrder(s, 'p1', T);
  }
  assert.equal(s.rested.filter((r) => r.orderId === 'p1').length, 1);

  assert.deepEqual(B.returnOrder(B.emptyState(), 'нет такого', T).active, [], 'возврат невзятого — не ошибка');
}

// ── normalize: терпит мусор ──────────────────────────────────────────────────
assert.deepEqual(B.normalize(null), B.emptyState());
assert.deepEqual(B.normalize({ active: 'нет', done: 7, rested: null }), B.emptyState());
assert.equal(B.normalize({ active: [{ orderId: 'a', takenAt: 'вчера' }] }).active.length, 0);
assert.equal(B.normalize({ active: [{ orderId: 'a', takenAt: T }, { orderId: 'a', takenAt: T }] }).active.length, 1);
// Повторное выполнение одного заказа хранит последнюю дату, а не плодит записи
{
  const s = B.normalize({ done: [{ orderId: 'a', doneAt: '2026-01-01' }, { orderId: 'a', doneAt: '2026-06-01' }] });
  assert.equal(s.done.length, 1);
  assert.equal(s.done[0].doneAt, '2026-06-01');
}

// ── Иммутабельность ──────────────────────────────────────────────────────────
{
  const base = B.takeOrder(B.emptyState(), order('p1'), T).state;
  const snapshot = JSON.stringify(base);
  B.completeOrder(base, 'p1', T);
  B.returnOrder(base, 'p1', T);
  assert.equal(JSON.stringify(base), snapshot);
}

// ── Сезонные живут до конца сезона, личные не истекают (решение 10.08) ──────
{
  const seasonalOrder = order('s1', { seasonal: true, seasons: ['summer'], sphereId: null });
  const taken = B.takeOrder(B.emptyState(), seasonalOrder, T).state;

  assert.equal(B.isExpired(taken.active[0], '2026-08-31'), false, 'лето ещё идёт');
  assert.equal(B.isExpired(taken.active[0], '2026-09-01'), true, 'сезон сменился');
  // Страховка от «взят летом 2026, сегодня лето 2027»: сезон тот же, но год другой
  assert.equal(B.isExpired(taken.active[0], '2027-07-01'), true);

  // Личный не истекает никогда
  const personal = B.takeOrder(B.emptyState(), order('p1'), T).state;
  assert.equal(B.isExpired(personal.active[0], '2030-01-01'), false);

  // Уборка истёкших не оставляет следа: посчитать «сколько не успел» негде
  const swept = B.sweepExpired(taken, '2026-09-01');
  assert.deepEqual(swept.expired, ['s1']);
  assert.deepEqual(B.activeOrders(swept.state), []);
  assert.deepEqual(swept.state.done, [], 'истечение — не выполнение');
  assert.deepEqual(swept.state.rested, [], 'истечение — не возврат и не отметка о брошенном');

  assert.deepEqual(B.sweepExpired(personal, '2026-09-01').expired, [], 'личных не трогает');
}

// ── Залежавшийся личный заказ: спросить один раз, не чаще ───────────────────
{
  const taken = B.takeOrder(B.emptyState(), order('p1'), T).state;
  const soon = '2026-08-20';   // 10 дней
  const late = '2026-09-05';   // 26 дней

  assert.equal(B.staleAsk(taken, soon), null, 'три недели ещё не прошли');
  const ask = B.staleAsk(taken, late);
  assert.equal(ask.orderId, 'p1');
  assert.equal(ask.heldDays, 26);

  // Спросили — и замолчали на три недели
  const asked = B.noteAsked(taken, 'p1', late);
  assert.equal(B.staleAsk(asked, late), null);
  assert.equal(B.staleAsk(asked, '2026-09-10'), null, 'через пять дней не переспрашиваем');
  assert.notEqual(B.staleAsk(asked, '2026-09-30'), null, 'через три недели можно снова');

  // Сезонные сюда не попадают — у них есть свой конец
  const seasonal = B.takeOrder(B.emptyState(), order('s1', { seasonal: true, seasons: ['summer'] }), T).state;
  assert.equal(B.staleAsk(seasonal, late), null);

  // Один за раз, и первым — тот, что висит дольше
  let many = B.takeOrder(B.emptyState(), order('p1'), '2026-07-01').state;
  many = B.takeOrder(many, order('p2'), '2026-07-10').state;
  assert.equal(B.staleAsk(many, T).orderId, 'p1');
}

// ── Гейт §5: доска не превращается в ленту ───────────────────────────────────
// Мы строим приложение против доомскролла и не можем добавить в него ленту.
// Если в API появится feed/like/follow/rank/popular/trending — тест сломается.
assert.deepEqual(
  Object.keys(B).filter((k) => /feed|like|follow|rank|popular|trending|score|leaderboard/i.test(k)),
  [],
);
// И ни одного счётчика брошенных заказов: считать возвраты — значит делать из
// доски приключений источник вины.
assert.deepEqual(
  Object.keys(B).filter((k) => /abandon|fail|miss|quit|penalt/i.test(k)),
  [],
);

console.log('board-v1: все проверки прошли');
