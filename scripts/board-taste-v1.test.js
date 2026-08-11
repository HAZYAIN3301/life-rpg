'use strict';

const assert = require('node:assert/strict');
const T = require('../public/board-taste-v1.js');
const POOL = require('../public/board-pool-v1.js');

assert.equal(T.VERSION, '1.0.0');
assert.equal(T.CALIBRATION_SIZE, 10);

const DAY = '2026-08-11';
const pool = [
  { id: 'a', tags: ['outdoor', 'bold'], title: 'A' },
  { id: 'b', tags: ['indoor', 'quiet'], title: 'B' },
  { id: 'c', tags: ['outdoor', 'quiet'], title: 'C' },
  { id: 'd', tags: [], title: 'D' },
];

// ── Пул: у каждого заказа есть теги, иначе он невидим для подбора ────────────
assert.equal(POOL.ALL.filter((o) => !o.tags || !o.tags.length).length, 0);

// ── Запись вердикта ─────────────────────────────────────────────────────────
{
  let s = T.emptyState();
  assert.equal(T.verdictCount(s), 0);
  assert.equal(T.isCalibrated(s), false);

  s = T.recordVerdict(s, 'a', T.LIKE, '  люблю выходить  ', DAY);
  assert.deepEqual(s.verdicts.a, { v: 'like', note: 'люблю выходить', at: DAY });

  // Комментарий необязателен — калибровка не форма
  s = T.recordVerdict(s, 'b', T.SKIP, '', DAY);
  assert.deepEqual(s.verdicts.b, { v: 'skip', at: DAY });

  // Переголосовать можно: вкус меняется
  s = T.recordVerdict(s, 'b', T.LIKE, null, DAY);
  assert.equal(s.verdicts.b.v, 'like');

  // Мусор игнорируется, состояние не мутируется
  const before = JSON.stringify(s);
  assert.equal(JSON.stringify(T.recordVerdict(s, 'c', 'может быть', null, DAY)), before);
  assert.equal(JSON.stringify(s), before);

  s = T.clearVerdict(s, 'b');
  assert.equal(s.verdicts.b, undefined);
}

// ── normalize терпит мусор ──────────────────────────────────────────────────
assert.deepEqual(T.normalize(null), T.emptyState());
assert.deepEqual(T.normalize({ verdicts: { x: { v: 'нет' } } }).verdicts, {});
assert.equal(T.normalize({ verdicts: { x: { v: 'like', note: 'я'.repeat(500) } } }).verdicts.x.note.length, 280);

// ── Веса тегов: «моё» плюсует, «не моё» минусует ────────────────────────────
{
  let s = T.recordVerdict(T.emptyState(), 'a', T.LIKE, null, DAY);   // outdoor, bold
  s = T.recordVerdict(s, 'b', T.SKIP, null, DAY);                    // indoor, quiet
  const w = T.tagWeights(s, pool, DAY);
  assert.ok(w.outdoor > 0 && w.bold > 0);
  assert.ok(w.indoor < 0 && w.quiet < 0);

  // Оценка — СРЕДНЕЕ по тегам, а не сумма: иначе заказ с пятью тегами всегда
  // обгонял бы заказ с одним, независимо от вкуса.
  const many = { id: 'm', tags: ['outdoor', 'outdoor', 'outdoor', 'outdoor'] };
  const one = { id: 'o', tags: ['outdoor'] };
  assert.equal(T.scoreOrder(many, w), T.scoreOrder(one, w));

  // Заказ без тегов не получает ни бонуса, ни штрафа
  assert.equal(T.scoreOrder({ id: 'd', tags: [] }, w), 0);

  // Смешанный (outdoor+ / quiet−) слабее чистого «моего»
  assert.ok(T.scoreOrder(pool[2], w) < T.scoreOrder(pool[0], w));
}

// ── Свежий вердикт весит больше старого: профиль сам перекалибровывается ────
{
  const old = T.recordVerdict(T.emptyState(), 'a', T.LIKE, null, '2026-02-11'); // ~полгода назад
  const fresh = T.recordVerdict(T.emptyState(), 'a', T.LIKE, null, DAY);
  assert.ok(T.tagWeights(fresh, pool, DAY).outdoor > T.tagWeights(old, pool, DAY).outdoor);
  // Полураспад: через HALFLIFE_DAYS вес падает примерно вдвое
  const ratio = T.tagWeights(old, pool, DAY).outdoor / T.tagWeights(fresh, pool, DAY).outdoor;
  assert.ok(Math.abs(ratio - 0.5) < 0.06, `ожидали ~0.5, получили ${ratio}`);
}

// ── Калибровочный набор: РАЗНЫЕ заказы, а не первые попавшиеся ──────────────
{
  const set = T.calibrationSet(POOL.ALL, T.emptyState(), 10);
  assert.equal(set.length, 10);
  assert.equal(new Set(set.map((o) => o.id)).size, 10, 'без повторов');

  // Десять похожих не сказали бы о человеке ничего — набор обязан покрывать
  // заметно больше тегов, чем даёт случайная десятка.
  const covered = new Set(set.flatMap((o) => o.tags));
  assert.ok(covered.size >= 14, `покрыто тегов: ${covered.size}`);

  // Уже оценённые не повторяются
  const s = T.recordVerdict(T.emptyState(), set[0].id, T.LIKE, null, DAY);
  assert.ok(!T.calibrationSet(POOL.ALL, s, 10).some((o) => o.id === set[0].id));

  // Набор стабилен между вызовами — не прыгает под руками
  assert.deepEqual(T.calibrationSet(POOL.ALL, T.emptyState(), 10).map((o) => o.id), set.map((o) => o.id));
}

// ── Порог калибровки ────────────────────────────────────────────────────────
{
  let s = T.emptyState();
  POOL.ALL.slice(0, T.CALIBRATED_AT - 1).forEach((o) => { s = T.recordVerdict(s, o.id, T.LIKE, null, DAY); });
  assert.equal(T.isCalibrated(s), false);
  s = T.recordVerdict(s, POOL.ALL[T.CALIBRATED_AT - 1].id, T.SKIP, null, DAY);
  assert.equal(T.isCalibrated(s), true);
}

// ── Комментарии уходят наружу сырыми: модуль их не толкует ──────────────────
{
  let s = T.recordVerdict(T.emptyState(), 'a', T.LIKE, 'обожаю утро', DAY);
  s = T.recordVerdict(s, 'b', T.SKIP, null, DAY);
  const notes = T.notesForAi(s, pool);
  assert.equal(notes.length, 1, 'без комментария в выдачу не попадает');
  assert.deepEqual(notes[0], { title: 'A', verdict: 'like', note: 'обожаю утро' });
}

// ── Вкус приватен: сравнивать людей нечем ───────────────────────────────────
assert.deepEqual(
  Object.keys(T).filter((k) => /rank|percentile|compare|others|leaderboard|peer|share/i.test(k)),
  [],
);

console.log('board-taste-v1: все проверки прошли');
