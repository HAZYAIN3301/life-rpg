'use strict';

const assert = require('node:assert/strict');
const AA = require('../public/arena-audit-v1.js');

assert.equal(AA.VERSION, '1.0.0');
assert.equal(AA.MIN_HISTORY_POINTS, 2);
// Порядок = порядок достройки: без мишени нечего мерить, назначать и ставить.
assert.deepEqual(AA.ELEMENTS, ['target', 'scoreboard', 'schedule', 'stake']);

const T = '2026-08-10';
const full = {
  id: 'gym', target: 'Обогнать Марка в жиме', metricHistory: [150, 160, 170],
  dueDate: '2026-09-01', stake: 'Позориться перед своей же табличкой',
};
const audit = (over) => AA.auditSphere(Object.assign({}, full, over || {}), T);

// ── Собраны все четыре ───────────────────────────────────────────────────────
{
  const a = audit();
  assert.equal(a.status, 'audited');
  assert.deepEqual(a.elements, { target: true, scoreboard: true, schedule: true, stake: true });
  assert.equal(a.present, 4);
  assert.deepEqual(a.missing, []);
  assert.equal(a.nextGap, null);
}

// ── Аргумент §5 целиком: зал работает, учёба нет — и видно, почему ──────────
{
  const study = AA.auditSphere({ id: 'study' }, T);
  assert.equal(study.present, 0);
  assert.deepEqual(study.missing, AA.ELEMENTS);
  assert.equal(study.nextGap, 'target', 'сначала мишень — остальное описывает отношение к ней');
}

// ── Табло — это число С ИСТОРИЕЙ. Одна точка не табло ───────────────────────
// По одной точке не видно движения, а движение (150 → 170) и производит драйв.
assert.equal(audit({ metricHistory: [150] }).elements.scoreboard, false);
assert.equal(audit({ metricHistory: [150, 170] }).elements.scoreboard, true);
assert.equal(audit({ metricHistory: [] }).elements.scoreboard, false);
assert.equal(audit({ metricHistory: null }).elements.scoreboard, false);
// Точки принимаются и числами, и записями {date, value}; мусор отсеивается
assert.equal(audit({ metricHistory: [{ date: '2026-07-01', value: 150 }, { date: '2026-08-01', value: 170 }] }).elements.scoreboard, true);
assert.equal(audit({ metricHistory: [{ value: 150 }, { value: 'много' }] }).elements.scoreboard, false);
assert.equal(audit({ metricHistory: [150, null, undefined] }).elements.scoreboard, false);
assert.equal(audit({ metricHistory: [0, 0] }).elements.scoreboard, true, 'ноль — законное значение');

// ── Расписание: будущее считается, прошедшее отмечается отдельно ────────────
assert.equal(audit({ dueDate: '2026-09-01' }).elements.schedule, true);
assert.equal(audit({ dueDate: T }).elements.schedule, true, 'сегодняшняя встреча ещё не прошла');
{
  // Прошедшая дата — не расписание, а пропущенная встреча. Подсказка «дата
  // прошла, назначь новую» точнее, чем «нет даты» тому, кто её ставил.
  const past = audit({ dueDate: '2026-08-01' });
  assert.equal(past.elements.schedule, false);
  assert.equal(past.scheduleExpired, true);
  assert.equal(past.nextGap, 'schedule');
}
assert.equal(audit({ dueDate: 'скоро' }).elements.schedule, false);
assert.equal(audit({ dueDate: 'скоро' }).scheduleExpired, false, 'кривая дата — не «истекла»');
assert.equal(audit({ dueDate: undefined }).scheduleExpired, false);

// ── Мишень и ставка: пробелы не считаются заполнением ───────────────────────
assert.equal(audit({ target: '   ' }).elements.target, false);
assert.equal(audit({ stake: '' }).elements.stake, false);
assert.equal(audit({ target: 42 }).elements.target, false, 'не строка — не мишень');

// ── nextGap идёт по порядку достройки, а не по порядку обнаружения ──────────
assert.equal(audit({ target: '', stake: '' }).nextGap, 'target');
assert.equal(audit({ metricHistory: [1], stake: '' }).nextGap, 'scoreboard');
assert.equal(audit({ stake: '' }).nextGap, 'stake');

// ── Отказ от соревнования — решение, а не пробел (BOARD §9: «не всем нужно») ─
{
  const skipped = AA.auditSphere({ id: 'rest', arena: false }, T);
  assert.equal(skipped.status, 'skipped');
  assert.deepEqual(skipped.missing, []);
  assert.equal(skipped.nextGap, null);
}

// ── arenaIndex: skipped в знаменатель не входит ─────────────────────────────
{
  const audits = [
    audit(),                                         // 4/4
    AA.auditSphere({ id: 'study' }, T),              // 0/4
    AA.auditSphere({ id: 'rest', arena: false }, T), // не считается
  ];
  const idx = AA.arenaIndex(audits);
  assert.deepEqual([idx.complete, idx.counted], [1, 2]);
  assert.equal(idx.index, 0.5);

  assert.equal(AA.arenaIndex([]).index, null, 'без сфер индекса нет, а не ноль');
  assert.equal(AA.arenaIndex([AA.auditSphere({ id: 'x', arena: false }, T)]).index, null);
}

// ── mostIncomplete: один сигнал за раз, детерминированно ────────────────────
{
  assert.equal(AA.mostIncomplete([]), null);
  assert.equal(AA.mostIncomplete([audit()]), null, 'всё собрано — молчим');
  assert.equal(AA.mostIncomplete([AA.auditSphere({ id: 'x', arena: false }, T)]), null);

  // Меньше собрано — вперёд
  const worse = AA.mostIncomplete([
    audit({ stake: '' }),                    // 3/4
    AA.auditSphere({ id: 'study' }, T),      // 0/4
  ]);
  assert.equal(worse.sphereId, 'study');

  // При равном счёте вперёд идёт та, где не хватает самого фундамента:
  // один ответ «кто на ступень выше?» сдвигает больше, чем выбор ставки.
  const deeper = AA.mostIncomplete([
    audit({ id: 'a', stake: '' }),           // не хватает ставки
    audit({ id: 'b', target: '' }),          // не хватает мишени
  ]);
  assert.equal(deeper.sphereId, 'b');

  // При полном равенстве — по id, и порядок входа не влияет
  const tie = [audit({ id: 'z', stake: '' }), audit({ id: 'a', stake: '' })];
  assert.equal(AA.mostIncomplete(tie).sphereId, 'a');
  assert.equal(AA.mostIncomplete(tie.slice().reverse()).sphereId, 'a');
}

// ── Мусор на входе не роняет ────────────────────────────────────────────────
assert.equal(AA.auditSphere(null, T).present, 0);
assert.equal(AA.auditSphere(undefined, 'сегодня').status, 'audited');
assert.equal(AA.arenaIndex(null).index, null);
assert.equal(AA.mostIncomplete(null), null);

// ── Никакого сравнения между людьми ─────────────────────────────────────────
// Гейт §5 и уже принятое решение убрать глобальный лидерборд. Если в API
// появится что-то вроде rank/percentile/others/compare — тест должен сломаться.
assert.deepEqual(
  Object.keys(AA).filter((k) => /rank|percentile|others|compare|leaderboard|peer/i.test(k)),
  [],
);
assert.deepEqual(
  Object.keys(audit()).filter((k) => /rank|percentile|others|compare|peer/i.test(k)),
  [],
);

console.log('arena-audit-v1: все проверки прошли');
