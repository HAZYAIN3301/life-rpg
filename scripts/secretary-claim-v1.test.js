'use strict';

/* Арбитраж поверхностей: кто именно показывает утренний ход.
 *
 * Ход один, поверхностей две, живут они в разных процессах. Проверяется главное
 * обещание: человек не получает одно и то же обращение дважды — даже когда доставка
 * пуша закончилась неизвестно чем.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const C = require('../public/secretary-claim-v1.js');

const SRC = path.join(__dirname, '..', 'public/secretary-claim-v1.js');
const T0 = '2026-09-02T06:00:00.000Z';
const plus = (min) => new Date(Date.parse(T0) + min * 60000).toISOString();
const OFFER = 'morning-after-overrun|2026-09-02|attention.escaped|2026-09-01|tiktok';

test('🔴 две поверхности не могут показать один ход', () => {
  const first = C.claim(C.emptyClaims(), OFFER, 'push', T0);
  assert.strictEqual(first.ok, true);
  const second = C.claim(first.claims, OFFER, 'card', T0);
  assert.strictEqual(second.ok, false);
  assert.strictEqual(second.reason, 'held');
  assert.strictEqual(second.channel, 'push', 'вызывающему сказано, кто держит');
});

test('повтор той же поверхности — не конфликт', () => {
  const first = C.claim(C.emptyClaims(), OFFER, 'card', T0);
  const again = C.claim(first.claims, OFFER, 'card', plus(1));
  assert.strictEqual(again.ok, true);
  assert.strictEqual(again.repeat, true);
  assert.strictEqual(again.token, first.token, 'тот же токен, а не вторая заявка');
});

test('🔴 неопределённый провал доставки НЕ освобождает ход', () => {
  // Суть дефекта №18. 429/500/обрыв не означают «не доставлено»: пуш мог уйти.
  // Показать после них карточку — значит рискнуть вторым одинаковым обращением.
  const held = C.claim(C.emptyClaims(), OFFER, 'push', T0);
  const after = C.settle(held.claims, OFFER, held.token, 'retry', plus(1));
  assert.strictEqual(after.ok, true);
  assert.strictEqual(after.released, false, 'неизвестность — не разрешение показать снова');
  const card = C.claim(after.claims, OFFER, 'card', plus(2));
  assert.strictEqual(card.ok, false, 'карточка молчит, пока не истечёт срок');
  assert.strictEqual(card.reason, 'held');
});

test('🔴 определённый провал возвращает ход другой поверхности', () => {
  // 404/410 — подписки больше нет, доставки точно не было. Молчать незачем.
  const held = C.claim(C.emptyClaims(), OFFER, 'push', T0);
  const gone = C.settle(held.claims, OFFER, held.token, 'gone', plus(1));
  assert.strictEqual(gone.released, true);
  const card = C.claim(gone.claims, OFFER, 'card', plus(2));
  assert.strictEqual(card.ok, true, 'ход не потерян из-за мёртвой подписки');
});

test('доставленный и отклонённый ход закрыт для всех', () => {
  for (const outcome of ['delivered', 'dismissed']) {
    const held = C.claim(C.emptyClaims(), OFFER, 'push', T0);
    const done = C.settle(held.claims, OFFER, held.token, outcome, plus(1));
    assert.strictEqual(done.released, false, outcome);
    assert.strictEqual(C.claim(done.claims, OFFER, 'card', plus(2)).ok, false, `${outcome} → карточка молчит`);
    // И своя же поверхность тоже: показанное не показывается снова.
    const mine = C.claim(done.claims, OFFER, 'push', plus(2));
    assert.strictEqual(mine.ok, false, `${outcome} → пуш не повторяется`);
    assert.strictEqual(mine.reason, 'settled');
  }
});

test('🔴 зависшая заявка отпускает ход по истечении срока', () => {
  // Процесс мог умереть, не сообщив исход. Иначе одно утро съедало бы ход навсегда.
  const held = C.claim(C.emptyClaims(), OFFER, 'push', T0);
  const beforeExpiry = C.CLAIM_TTL_MS / 60000 - 1;
  assert.strictEqual(C.claim(held.claims, OFFER, 'card', plus(beforeExpiry)).ok, false);
  assert.strictEqual(C.claim(held.claims, OFFER, 'card', plus(beforeExpiry + 2)).ok, true, 'срок истёк');
});

test('разные ходы друг другу не мешают', () => {
  const a = C.claim(C.emptyClaims(), OFFER, 'push', T0);
  const b = C.claim(a.claims, 'morning-after-overrun|2026-09-03|x', 'card', T0);
  assert.strictEqual(b.ok, true);
});

test('🔴 чужой токен ничего не закрывает', () => {
  const held = C.claim(C.emptyClaims(), OFFER, 'push', T0);
  assert.strictEqual(C.settle(held.claims, OFFER, 'подделка', 'gone', plus(1)).reason, 'bad_token');
  assert.strictEqual(C.settle(held.claims, 'нет такого', held.token, 'gone', plus(1)).reason, 'not_found');
  // Заявка цела: чужой вызов не освободил ход.
  assert.ok(C.activeClaim(held.claims, OFFER, plus(1)));
});

test('неизвестный канал и исход не принимаются', () => {
  for (const bad of ['смс', 'email', '', null, 42]) {
    assert.strictEqual(C.claim(C.emptyClaims(), OFFER, bad, T0).ok, false, `канал ${bad}`);
  }
  const held = C.claim(C.emptyClaims(), OFFER, 'card', T0);
  for (const bad of ['ok', 'failed', '', null]) {
    assert.strictEqual(C.settle(held.claims, OFFER, held.token, bad, T0).reason, 'bad_outcome', `исход ${bad}`);
  }
});

test('🔴 повреждённый файл заявок — отказ, а не «ход свободен»', () => {
  // Пустые заявки означали бы, что показать можно, и вернули бы дубль.
  for (const junk of [null, 'строка', 42, [], { claims: 'нет' }, { claims: { o: { token: 'x' } } }]) {
    assert.strictEqual(C.sanitizeClaims(junk), null, JSON.stringify(junk));
    assert.strictEqual(C.claim(junk, OFFER, 'card', T0).ok, false);
  }
  assert.deepStrictEqual(C.sanitizeClaims(C.emptyClaims()), { version: 1, claims: {} });
});

test('время не берётся из воздуха', () => {
  for (const bad of [null, '', 'вчера', 42]) {
    assert.strictEqual(C.claim(C.emptyClaims(), OFFER, 'card', bad).reason, 'bad_now', `${bad}`);
  }
});

test('🔴 текст пуша не выносит наружу ничего личного', () => {
  // Пуш идёт через чужие серверы и лежит на экране блокировки.
  const copy = C.pushCopy();
  const all = `${copy.title} ${copy.body}`.toLowerCase();
  for (const leak of ['tiktok', 'youtube', 'игр', 'подъём', 'уговор', 'сорвал', 'срыв', 'вчера', 'опять', 'снова']) {
    assert.strictEqual(all.includes(leak), false, `в пуше утекло: «${leak}»`);
  }
  assert.ok(copy.body.length > 0 && copy.body.length < 80);
  // Один и тот же текст на любой повод: иначе сам текст выдаёт причину.
  assert.deepStrictEqual(C.pushCopy(), copy);
});

test('🔴 заявка не начисляет и не наказывает', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1').toLowerCase();
  for (const bad of ['xp', 'gold', 'streak', 'penalty']) {
    assert.strictEqual(new RegExp('(?<![a-z])' + bad + '(?![a-z])').test(code), false, bad);
  }
});

test('модуль не читает часы, State, DOM и сеть', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/', 'Date.now', 'localStorage']) {
    assert.strictEqual(code.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
  assert.strictEqual(/new Date\(\s*\)/.test(code), false, 'модуль читает часы вместо параметра');
  assert.strictEqual(code.includes('\\b'), false, 'ASCII-граница слова молча не работает на кириллице');
});
