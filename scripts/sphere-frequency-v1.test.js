'use strict';

const assert = require('node:assert/strict');
const SF = require('../public/sphere-frequency-v1.js');

assert.equal(SF.VERSION, '1.0.0');
assert.equal(SF.WINDOW_DAYS, 7);
assert.equal(SF.TOLERANCE, 1);

const T = '2026-08-10';
// N последовательных дней, заканчивая `last`
const back = (n, last) => {
  const end = Date.parse((last || T) + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => new Date(end - i * 86400000).toISOString().slice(0, 10));
};
const rhythm = (sphere, touches, opts) => SF.sphereRhythm(sphere, touches, T, opts);

// ── Правило ±1 (BOARD §9): сказал три раза — норма 2–4 ───────────────────────
{
  const s = { id: 'craft', targetPerWeek: 3 };
  assert.deepEqual([rhythm(s, back(3)).low, rhythm(s, back(3)).high], [2, 4]);
  assert.equal(rhythm(s, back(3)).status, 'ok');
  assert.equal(rhythm(s, back(2)).status, 'ok', 'нижняя граница окна — тоже норма');
  assert.equal(rhythm(s, back(4)).status, 'ok', 'верхняя граница окна — тоже норма');
  assert.equal(rhythm(s, back(1)).status, 'under');
  assert.equal(rhythm(s, back(5)).status, 'over');
}

// ── Ежедневная сфера ─────────────────────────────────────────────────────────
{
  const s = { id: 'body', targetPerWeek: 7 };
  assert.equal(rhythm(s, back(7)).status, 'ok');
  assert.equal(rhythm(s, back(6)).status, 'ok', 'один пропуск в неделю не провал');
  assert.equal(rhythm(s, back(5)).status, 'under');
}

// ── Сфера «раз в неделю»: ноль касаний — это НЕ норма ────────────────────────
// Голое t - 1 дало бы нижнюю границу 0, и полное отсутствие сферы считалось бы
// нормой. Окно свободы смягчает объявленную частоту, но не отменяет её.
{
  const s = { id: 'review', targetPerWeek: 1 };
  assert.equal(rhythm(s, []).low, 1);
  assert.equal(rhythm(s, []).status, 'under');
  assert.equal(rhythm(s, back(1)).status, 'ok');
  assert.equal(rhythm(s, back(2)).status, 'ok');
  assert.equal(rhythm(s, back(3)).status, 'over');
}

// ── Считаем ДНИ касания, а не события ────────────────────────────────────────
// Пять дел за один вечер не закрывают неделю: «три раза в неделю» — это три дня.
{
  const s = { id: 'craft', targetPerWeek: 3 };
  const sameDay = [T, T, T, T, T];
  assert.equal(rhythm(s, sameDay).actual, 1);
  assert.equal(rhythm(s, sameDay).status, 'under');
}

// ── Окно: старое и будущее не считаются ──────────────────────────────────────
{
  const s = { id: 'craft', targetPerWeek: 3 };
  const touches = back(3).concat(['2026-07-01', '2026-07-02', '2026-09-01']);
  assert.equal(rhythm(s, touches).actual, 3, 'вне недельного окна не в счёт');
  assert.equal(rhythm(s, touches, { windowDays: 60 }).actual, 5, 'будущее не считается даже в широком окне');
}

// ── daysSinceTouch ───────────────────────────────────────────────────────────
{
  const s = { id: 'craft', targetPerWeek: 3 };
  assert.equal(rhythm(s, ['2026-08-07']).daysSinceTouch, 3);
  assert.equal(rhythm(s, []).daysSinceTouch, null, 'ни разу не трогали — не ноль дней назад');
  // Последнее касание ищется по всей истории, даже за пределами окна: «не
  // трогали 40 дней» — самое ценное число, и терять его из-за окна нельзя.
  assert.equal(rhythm(s, ['2026-07-01']).daysSinceTouch, 40);
  assert.equal(rhythm(s, ['2026-07-01']).actual, 0);
}

// ── unset и paused: судим только объявленное ─────────────────────────────────
{
  assert.equal(rhythm({ id: 'x' }, back(3)).status, 'unset');
  assert.equal(rhythm({ id: 'x', targetPerWeek: 0 }, back(3)).status, 'unset');
  assert.equal(rhythm({ id: 'x', targetPerWeek: 'три' }, back(3)).status, 'unset');
  assert.equal(rhythm({ id: 'x' }, back(3)).target, null);

  // Пауза сохраняет реальные числа — сняв паузу, человек сразу видит картину,
  // а не ноль.
  const paused = rhythm({ id: 'x', targetPerWeek: 3, paused: true }, back(2));
  assert.equal(paused.status, 'paused');
  assert.equal(paused.actual, 2);
  assert.equal(paused.target, 3);
}

// ── balanceIndex: против частоты, а не против равномерности ──────────────────
// Ключевая проверка: сфера «раз в неделю», которую трогали один раз, и
// ежедневная, которую трогали семь раз, обе в норме — хотя по равномерности
// они отличаются в семь раз. Именно это старая модель считала дисбалансом.
{
  const rhythms = [
    rhythm({ id: 'body', targetPerWeek: 7 }, back(7)),
    rhythm({ id: 'review', targetPerWeek: 1 }, back(1)),
    rhythm({ id: 'craft', targetPerWeek: 3 }, back(3)),
  ];
  assert.deepEqual(SF.balanceIndex(rhythms), { index: 1, ok: 3, under: 0, over: 0, counted: 3 });
}

{
  const rhythms = [
    rhythm({ id: 'a', targetPerWeek: 3 }, back(3)),
    rhythm({ id: 'b', targetPerWeek: 3 }, []),
    rhythm({ id: 'c', targetPerWeek: 3 }, back(6)),
    rhythm({ id: 'd', targetPerWeek: 3, paused: true }, []),
    rhythm({ id: 'e' }, []),
  ];
  const bi = SF.balanceIndex(rhythms);
  assert.deepEqual([bi.ok, bi.under, bi.over, bi.counted], [1, 1, 1, 3]);
  assert.ok(Math.abs(bi.index - 1 / 3) < 1e-9);
  assert.equal(SF.balanceIndex([]).index, null, 'без объявленных сфер индекса нет, а не ноль');
  assert.equal(SF.balanceIndex([rhythm({ id: 'z' }, [])]).index, null);
}

// ── mostNeglected: один сигнал за раз, детерминированно ──────────────────────
{
  assert.equal(SF.mostNeglected([]), null);
  assert.equal(SF.mostNeglected([rhythm({ id: 'a', targetPerWeek: 3 }, back(3))]), null, 'все в норме — молчим');

  // Больше недобор побеждает
  const worse = SF.mostNeglected([
    rhythm({ id: 'a', targetPerWeek: 7 }, back(1)),   // недобор 5
    rhythm({ id: 'b', targetPerWeek: 3 }, back(1)),   // недобор 1
  ]);
  assert.equal(worse.sphereId, 'a');

  // При равном недоборе — та, которую дольше не трогали
  const older = SF.mostNeglected([
    rhythm({ id: 'a', targetPerWeek: 3 }, ['2026-08-09']),
    rhythm({ id: 'b', targetPerWeek: 3 }, ['2026-07-20']),
  ]);
  assert.equal(older.sphereId, 'b');

  // Ни разу не тронутая обгоняет тронутую давно
  const never = SF.mostNeglected([
    rhythm({ id: 'a', targetPerWeek: 3 }, ['2026-07-20']),
    rhythm({ id: 'b', targetPerWeek: 3 }, []),
  ]);
  assert.equal(never.sphereId, 'b');

  // При полном равенстве — по id, и порядок входа не влияет
  const tie = [
    rhythm({ id: 'z', targetPerWeek: 3 }, []),
    rhythm({ id: 'a', targetPerWeek: 3 }, []),
  ];
  assert.equal(SF.mostNeglected(tie).sphereId, 'a');
  assert.equal(SF.mostNeglected(tie.slice().reverse()).sphereId, 'a');
}

// ── Мусор на входе не роняет ─────────────────────────────────────────────────
assert.equal(SF.sphereRhythm(null, null, T).status, 'unset');
assert.equal(SF.sphereRhythm({ id: 'a', targetPerWeek: 3 }, ['вчера', null, 42], T).actual, 0);
assert.equal(SF.sphereRhythm({ id: 'a', targetPerWeek: 3 }, back(3), 'сегодня').actual, 0);

console.log('sphere-frequency-v1: все проверки прошли');
