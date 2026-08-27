'use strict';

/* founder-pass-v1 — Фаза 0: замер готовности платить без приёма денег.
 *
 * Проверяется не «работает ли функция», а три обещания, нарушение которых
 * обесценивает весь замер: отбор реальных пользователей, честный счётчик и
 * сохранение цены, которую человек видел в момент ответа.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const F = require('../public/founder-pass-v1.js');

const entry = (userId, answer, extra) => Object.assign({ userId, answer, at: '2026-08-27T10:00:00.000Z' }, extra || {});
const storeOf = (...entries) => ({ version: 1, capacity: F.CAPACITY, entries });

test('предложение стоит столько, сколько решено, и обещает только выполнимое', () => {
  assert.strictEqual(F.OFFER.priceCents, 1999);
  assert.strictEqual(F.OFFER.currency, 'EUR');
  assert.strictEqual(F.OFFER.proMonths, 12);
  // €19.99 за 12 месяцев против €39.99 за год — ровно половина, честная скидка
  // основателя. Если цена уедет, это перестанет сходиться, и тест напомнит.
  assert.ok(F.OFFER.priceCents * 2 === 3998, 'Founder Pass — половина годовой цены');
});

test('🔴 предложение не показывается тому, кто ничего не делал', () => {
  // Ответ человека, который завёл аккаунт и ушёл, не сообщает ничего ни в «да»,
  // ни в «нет». Записка: «первых 50–100 ПОДХОДЯЩИХ альфа-пользователей».
  assert.strictEqual(F.eligibility({ activeDays: 0, doneTasks: 0 }).eligible, false);
  assert.strictEqual(F.eligibility({ activeDays: 1, doneTasks: 9 }).eligible, false, 'один день — ещё не возврат');
  assert.strictEqual(F.eligibility({ activeDays: 9, doneTasks: 2 }).eligible, false, 'заходил, но не делал');
  assert.strictEqual(F.eligibility({ activeDays: 2, doneTasks: 3 }).eligible, true);
  assert.strictEqual(F.eligibility(null).eligible, false);
  assert.strictEqual(F.eligibility({ activeDays: 'много', doneTasks: NaN }).eligible, false);
});

test('отказ объясняет, чего именно не хватает — но это для воронки, не для экрана', () => {
  const r = F.eligibility({ activeDays: 1, doneTasks: 1 });
  assert.strictEqual(r.reason, 'not_enough_use');
  assert.strictEqual(r.needDays, 1);
  assert.strictEqual(r.needTasks, 2);
});

test('🔴 счётчик мест честный и не выдумывает дефицит', () => {
  assert.strictEqual(F.slotsLeft(0), 100);
  assert.strictEqual(F.slotsLeft(37), 63);
  assert.strictEqual(F.slotsLeft(100), 0);
  assert.strictEqual(F.slotsLeft(150), 0, 'ниже нуля счётчик не уходит');
  assert.strictEqual(F.slotsLeft(-5), 100, 'мусор не создаёт занятых мест');
});

test('место занимает только «беру»', () => {
  const store = storeOf(
    entry('a', 'interested'), entry('b', 'too_expensive'),
    entry('c', 'not_now'), entry('d', 'interested'),
  );
  const s = F.summarize(store);
  assert.strictEqual(s.answered, 4);
  assert.strictEqual(s.interested, 2);
  assert.strictEqual(s.tooExpensive, 1);
  assert.strictEqual(s.notNow, 1);
  assert.strictEqual(s.taken, 2, '«дорого» и «пока нет» мест не занимают');
  assert.strictEqual(s.left, 98);
  assert.strictEqual(s.full, false);
});

test('«дорого» — полноправный ответ, а не отказ от опроса', () => {
  // Качественные возражения записка просит собирать наравне с согласиями.
  assert.deepStrictEqual([...F.ANSWERS].sort(), ['interested', 'not_now', 'too_expensive']);
  const saved = F.sanitizeEntry(entry('x', 'too_expensive', { note: 'дорого для школьника' }));
  assert.strictEqual(saved.answer, 'too_expensive');
  assert.strictEqual(saved.note, 'дорого для школьника');
});

test('🔴 цена сохраняется та, которую человек видел', () => {
  // Иначе смена цены задним числом обесценит уже собранные ответы.
  const old = F.sanitizeEntry(entry('x', 'interested', { priceCents: 999, currency: 'UAH' }));
  assert.strictEqual(old.priceCents, 999);
  assert.strictEqual(old.currency, 'UAH');
  // Без явной цены подставляется текущая, а не ноль.
  assert.strictEqual(F.sanitizeEntry(entry('y', 'interested')).priceCents, F.OFFER.priceCents);
  assert.strictEqual(F.sanitizeEntry(entry('z', 'interested', { currency: 'евро' })).currency, 'EUR');
});

test('невалидная запись не сохраняется', () => {
  assert.strictEqual(F.sanitizeEntry(null), null);
  assert.strictEqual(F.sanitizeEntry({ userId: 'a' }), null, 'нет ответа');
  assert.strictEqual(F.sanitizeEntry({ answer: 'interested' }), null, 'нет пользователя');
  assert.strictEqual(F.sanitizeEntry(entry('a', 'куплю')), null, 'ответ вне списка');
  const long = F.sanitizeEntry(entry('a', 'not_now', { note: 'я'.repeat(900) }));
  assert.ok(long.note.length <= F.MAX_NOTE);
});

test('человек может передумать — это правка ответа, а не вторая запись', () => {
  let store = F.upsert(F.emptyStore(), entry('a', 'too_expensive', { note: 'дорого' }));
  store = F.upsert(store, entry('a', 'interested', { at: '2026-09-03T10:00:00.000Z' }));
  assert.strictEqual(store.entries.length, 1);
  assert.strictEqual(store.entries[0].answer, 'interested');
  assert.strictEqual(store.entries[0].note, '', 'новый ответ не тащит старую заметку');
  assert.strictEqual(F.summarize(store).taken, 1);
});

test('🔴 повреждённый файл не притворяется пустым списком', () => {
  // Пустой список здесь означал бы «сто мест свободно, никто не записался» и
  // разрешил бы затереть настоящие ответы следующей записью.
  assert.strictEqual(F.sanitizeStore(null), null);
  assert.strictEqual(F.sanitizeStore({ version: 2, entries: [] }), null);
  assert.strictEqual(F.sanitizeStore({ version: 1, entries: 'нет' }), null);
  assert.strictEqual(F.sanitizeStore({ version: 1, entries: [{ userId: 'a' }] }), null, 'битая строка => файл не доверенный');
  assert.strictEqual(
    F.sanitizeStore({ version: 1, entries: [entry('a', 'interested'), entry('a', 'not_now')] }),
    null, 'дубль пользователя => файл не доверенный',
  );
  const ok = F.sanitizeStore(storeOf(entry('a', 'interested')));
  assert.strictEqual(ok.entries.length, 1);
  assert.strictEqual(ok.capacity, 100);
});

test('пустой стор читается как сто свободных мест', () => {
  const s = F.summarize(F.emptyStore());
  assert.strictEqual(s.answered, 0);
  assert.strictEqual(s.taken, 0);
  assert.strictEqual(s.left, 100);
  assert.strictEqual(s.full, false);
});

test('заполненный список закрывается честно', () => {
  const entries = [];
  for (let i = 0; i < 100; i += 1) entries.push(entry('u' + i, 'interested'));
  const s = F.summarize(storeOf(...entries));
  assert.strictEqual(s.left, 0);
  assert.strictEqual(s.full, true);
});

test('свой ответ находится, чужой не подставляется', () => {
  const store = storeOf(entry('a', 'interested'), entry('b', 'not_now'));
  assert.strictEqual(F.entryFor(store, 'a').answer, 'interested');
  assert.strictEqual(F.entryFor(store, 'b').answer, 'not_now');
  assert.strictEqual(F.entryFor(store, 'c'), null);
  assert.strictEqual(F.entryFor(store, ''), null);
});

test('модуль не читает State и DOM и не зовёт переводчик', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/founder-pass-v1.js'), 'utf8');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/']) {
    assert.equal(src.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  assert.equal(/[^a-zA-Z_$.]t\(/.test(code), false, 'модуль зовёт переводчик');
});

test('🔴 в модуле нет ничего платёжного — Фаза 0 денег не берёт', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/founder-pass-v1.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const bad of ['paddle', 'stripe', 'lemonsqueezy', 'checkout', 'card', 'iban', 'payout']) {
    assert.equal(code.toLowerCase().includes(bad), false, `платёжная сущность в Фазе 0: «${bad}»`);
  }
});
