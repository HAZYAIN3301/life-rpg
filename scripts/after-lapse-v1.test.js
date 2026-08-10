'use strict';

const assert = require('node:assert/strict');
const AL = require('../public/after-lapse-v1.js');

assert.equal(AL.VERSION, '1.0.0');
assert.equal(AL.OVERSHOOT, 1.5);
assert.equal(AL.MIN_EXCESS, 2);
assert.equal(AL.COOLDOWN_DAYS, 3);

const T = '2026-08-10';
const hist = (...counts) => counts.map((planned, i) => ({ date: `2026-07-${String(10 + i).padStart(2, '0')}`, planned }));
const nudge = (over) => AL.afterLapseNudge(Object.assign({
  today: T, yesterdayLost: true, todayPlanned: 6, history: hist(4, 4, 4, 4),
}, over || {}));

// ── typicalPlanned: медиана собственных непустых дней ────────────────────────
assert.equal(AL.typicalPlanned([]), null);
assert.equal(AL.typicalPlanned(hist(3, 4, 5)), null, 'три наблюдения — нормы ещё нет');
assert.equal(AL.typicalPlanned(hist(1, 2, 3, 9)), 2);
assert.equal(AL.typicalPlanned(hist(0, 0, 4, 4, 4, 4)), 4, 'пустые дни в норму не входят');

// ── Срабатывает: вчера потерян день, сегодня заведено заметно больше ─────────
{
  const v = nudge();
  assert.deepEqual(
    { todayPlanned: v.todayPlanned, typical: v.typical, excess: v.excess },
    { todayPlanned: 6, typical: 4, excess: 2 },
  );
  // Ядро — 1–3 дела, та же граница, что предлагает паттерн «работа без конца».
  assert.equal(v.suggestedCore, 3);
  assert.equal(nudge({ history: hist(2, 2, 2, 2), todayPlanned: 5 }).suggestedCore, 2);
}

// ── Молчит: вчера срыва не было ──────────────────────────────────────────────
assert.equal(nudge({ yesterdayLost: false }), null);

// ── Молчит: нормы ещё нет ────────────────────────────────────────────────────
assert.equal(nudge({ history: hist(4, 4, 4) }), null);
assert.equal(nudge({ history: [] }), null);

// ── Молчит: план в пределах нормы ────────────────────────────────────────────
assert.equal(nudge({ todayPlanned: 4 }), null);
assert.equal(nudge({ todayPlanned: 5 }), null, 'пять против четырёх — ещё не героизм');
assert.equal(nudge({ todayPlanned: 0 }), null, 'пустой день — точно не перевыполнение');

// ── Обе проверки обязательны: доля и абсолютный минимум ──────────────────────
// Три дела против двух проходят по доле (3 ≥ 2×1.5), но разговаривать про
// перевыполнение на разнице в одно дело — смешно. MIN_EXCESS это ловит.
assert.equal(nudge({ history: hist(2, 2, 2, 2), todayPlanned: 3 }), null);
assert.notEqual(nudge({ history: hist(2, 2, 2, 2), todayPlanned: 4 }), null);
// И наоборот: разница в два дела при большой норме не проходит по доле.
assert.equal(nudge({ history: hist(10, 10, 10, 10), todayPlanned: 12 }), null);

// ── Гейт §12: сказать один раз ───────────────────────────────────────────────
{
  assert.equal(nudge({ saidOn: [T] }), null, 'сегодня уже говорили');
  assert.equal(nudge({ saidOn: ['2026-08-09'] }), null, 'вчера говорили — молчим');
  assert.equal(nudge({ saidOn: ['2026-08-08'] }), null, 'два дня назад — ещё рано');
  assert.notEqual(nudge({ saidOn: ['2026-08-07'] }), null, 'три дня — тема закрыта, можно снова');
  assert.notEqual(nudge({ saidOn: ['2026-08-15'] }), null, 'будущие записи игнорируются');
  assert.notEqual(nudge({ saidOn: ['мусор', null] }), null);
}

// ── noteSpoken: иммутабельно, без дублей, отсортировано ──────────────────────
{
  const base = ['2026-08-07'];
  const next = AL.noteSpoken(base, T);
  assert.deepEqual(next, ['2026-08-07', T]);
  assert.deepEqual(base, ['2026-08-07'], 'исходный список не мутируется');
  assert.deepEqual(AL.noteSpoken(next, T), next, 'повторная запись не копится');
  assert.deepEqual(AL.noteSpoken(['2026-08-09', '2026-08-01'], T), ['2026-08-01', '2026-08-09', T]);
  assert.deepEqual(AL.noteSpoken(null, T), [T]);
  assert.deepEqual(AL.noteSpoken(['мусор'], 'тоже мусор'), []);
}

// ── Мусор на входе не роняет ─────────────────────────────────────────────────
assert.equal(AL.afterLapseNudge(null), null);
assert.equal(AL.afterLapseNudge({ today: 'сегодня', yesterdayLost: true, todayPlanned: 9, history: hist(1, 1, 1, 1) }), null);

// ── Ничего, чем можно заблокировать день ─────────────────────────────────────
// Гейт §12: взрослый имеет право на героический день. Если в ответе появится
// поле вида allow/block/cap/limit, этот тест должен сломаться.
{
  const v = nudge();
  assert.deepEqual(Object.keys(v).filter((k) => /allow|block|cap|limit|forbid|max/i.test(k)), []);
  for (const [key, value] of Object.entries(v)) {
    assert.equal(typeof value, 'number', `${key} — не число: фраза собирается снаружи`);
  }
}

console.log('after-lapse-v1: все проверки прошли');
