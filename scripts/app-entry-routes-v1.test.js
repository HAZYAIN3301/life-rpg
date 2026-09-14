'use strict';
/* Контракт входа: один разбор для ярлыка, расширения, Universal Link, App Intent,
 * виджета и действия в уведомлении (APPLE-PRE-PAYMENT-PLAN-2026-09.md §B3).
 *
 * Проверяется не «парсится ли строка», а четыре обещания:
 *  🧭 намерение переживает холодный старт и вход — раньше оно молча терялось,
 *     если человек был разлогинен или сессия истекла;
 *  🔁 намерение срабатывает ровно один раз: перезагрузка его не повторяет;
 *  ⏳ припаркованное намерение истекает — вкладка, восстановленная завтра,
 *     не открывает вчерашний заход;
 *  🚪 словарь закрыт: неизвестный глагол и чужой источник поглощаются и
 *     называются отказом, а не догадываются.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EntryRoutes = require('../public/app-entry-routes-v1.js');

const VIEWS = ['today', 'notes', 'goals', 'den', 'settings'];
const resolveExtensionTarget = (raw) => (raw === 'tiktok' ? { id: 'tiktok', label: 'TikTok' } : null);
const parse = (search) => EntryRoutes.parse(search, { views: VIEWS, resolveExtensionTarget });

// ============================================================
//  Словарь
// ============================================================

test('ярлыки фокуса дают намерение без цели', () => {
  for (const verb of EntryRoutes.FOCUS_VERBS) {
    const plan = parse(`?do=${verb}`);
    assert.equal(plan.intent.action, verb);
    assert.equal(plan.intent.source, 'shortcut');
    assert.equal(plan.refusal, '');
  }
});

test('неизвестный глагол поглощается и называется отказом', () => {
  const plan = parse('?do=delete-everything&app=x&keep=1');
  assert.equal(plan.intent, null);
  assert.equal(plan.refusal, 'unknown_verb');
  // Главное: параметр НЕ остаётся в адресной строке ждать, пока следующий релиз
  // научит этот глагол что-то значить.
  assert.equal(plan.cleanedSearch, 'keep=1');
});

test('глагол нечувствителен к регистру и пробелам, но не к смыслу', () => {
  assert.equal(parse('?do=%20GATE%20').intent.action, 'gate');
  assert.equal(parse('?do=gates').refusal, 'unknown_verb');
});

test('чужой источник отклоняется целиком', () => {
  const plan = parse('?do=gate&app=tiktok&source=widget');
  assert.equal(plan.intent, null);
  assert.equal(plan.refusal, 'unknown_source');
  assert.equal(plan.cleanedSearch, '');
});

test('расширению доступны только gate и return', () => {
  assert.equal(parse('?do=finish&app=tiktok&source=extension').refusal, 'verb_not_allowed_for_source');
  assert.equal(parse('?do=gate&app=tiktok&source=extension').intent.action, 'gate');
  assert.equal(parse('?do=return&app=tiktok&source=extension').intent.action, 'return');
  // Ярлык сам по себе finish прислать может: это не источник расширения.
  assert.equal(parse('?do=finish').intent.action, 'finish');
});

test('суффикс известного сайта не проходит как известная цель', () => {
  // `tiktok.com.evil` — чужой домен, а не TikTok. Он не должен доехать до диалога.
  const plan = parse('?do=gate&app=tiktok.com.evil&source=extension');
  assert.equal(plan.intent, null);
  assert.equal(plan.refusal, 'unknown_target');
});

test('цель от расширения берётся из резолвера, а не из URL', () => {
  const plan = parse('?do=gate&app=tiktok&source=extension');
  assert.equal(plan.intent.targetId, 'tiktok');
  assert.equal(plan.intent.target, 'TikTok');
});

test('ярлык без источника доносит написанное человеком имя как есть', () => {
  const plan = parse('?do=gate&app=YouTube');
  assert.equal(plan.intent.source, 'shortcut');
  assert.equal(plan.intent.target, 'YouTube');
  assert.equal(plan.intent.targetId, '');
});

test('длина цели ограничена', () => {
  const plan = parse('?do=gate&app=' + 'a'.repeat(500));
  assert.equal(plan.intent.target.length, 80);
});

// ============================================================
//  Адресная строка
// ============================================================

test('вид и цель остаются в адресе, действие — нет', () => {
  // Вид описывает, где человек находится: перезагрузка ссылки `view=today`
  // обязана снова открыть «Сегодня». Действие описывает, что он попросил
  // сделать, и повториться не должно.
  const plan = parse('?view=goals&goal=g1&do=capture&utm=x');
  assert.equal(plan.view, 'goals');
  assert.equal(plan.goalId, 'g1');
  assert.equal(plan.intent.action, 'capture');
  assert.equal(plan.cleanedSearch, 'view=goals&goal=g1&utm=x');
});

test('неизвестный вид игнорируется, но приложение всё равно открывается', () => {
  // Ярлык прошлого релиза, называющий исчезнувший экран, не должен быть ошибкой.
  const plan = parse('?view=atlantis');
  assert.equal(plan.view, null);
  assert.equal(plan.refusal, '');
});

test('все собственные параметры уходят вместе с действием', () => {
  const plan = parse('?do=return&source=extension&app=tiktok&userId=u1&outcome=done&session=s1&permission=granted&redirect=/x&keep=2');
  assert.equal(plan.cleanedSearch, 'keep=2');
});

test('чужие параметры не трогаются, если действия нет', () => {
  assert.equal(parse('?utm_source=post&ref=a').cleanedSearch, 'utm_source=post&ref=a');
});

test('кодирование переживает круг', () => {
  const plan = parse('?do=gate&app=' + encodeURIComponent('Моё видео') + '&note=' + encodeURIComponent('a b&c'));
  assert.equal(plan.intent.target, 'Моё видео');
  assert.equal(plan.cleanedSearch, 'note=a%20b%26c');
});

test('пустая и мусорная строка не ломаются', () => {
  for (const search of ['', '?', '???', '&&&', '?=', '?do=']) {
    const plan = parse(search);
    assert.equal(plan.intent, null);
  }
  assert.equal(parse('?' + 'a=b&'.repeat(2000)).intent, null);
});

// ============================================================
//  Парковка: холодный старт, вход, перезагрузка, истечение
// ============================================================

test('намерение переживает вход: припарковали разлогиненным — применили после', () => {
  const plan = parse('?do=return&app=YouTube');
  const record = EntryRoutes.park(plan, 1_000_000);
  // Человек видит экран входа, вводит пароль, приложение загружается.
  const back = EntryRoutes.unpark(record, 1_000_000 + 45_000);
  assert.equal(back.reason, '');
  assert.equal(back.plan.intent.action, 'return');
  assert.equal(back.plan.intent.target, 'YouTube');
});

test('пустой вход не паркуется', () => {
  assert.equal(EntryRoutes.park(parse('?utm=1'), 0), null);
  assert.equal(EntryRoutes.worthParking(parse('')), false);
  // Отказ тоже не паркуется: нечего применять.
  assert.equal(EntryRoutes.park(parse('?do=nonsense'), 0), null);
});

test('вид паркуется сам по себе', () => {
  const record = EntryRoutes.park(parse('?view=den'), 5);
  assert.equal(EntryRoutes.unpark(record, 10).plan.view, 'den');
});

test('припаркованное истекает', () => {
  const record = EntryRoutes.park(parse('?do=gate&app=TikTok'), 0);
  assert.equal(EntryRoutes.unpark(record, EntryRoutes.MAX_AGE_MS - 1).reason, '');
  assert.equal(EntryRoutes.unpark(record, EntryRoutes.MAX_AGE_MS + 1).reason, 'expired');
  assert.equal(EntryRoutes.unpark(record, EntryRoutes.MAX_AGE_MS + 1).plan, null);
});

test('часы, ушедшие назад, не делают намерение вечным', () => {
  // Смена таймзоны, DST или устройство, потерявшее батарею.
  const record = EntryRoutes.park(parse('?do=gate'), 10_000_000);
  assert.equal(EntryRoutes.unpark(record, 9_000_000).reason, 'expired');
});

test('чужая и битая запись не применяются', () => {
  assert.equal(EntryRoutes.unpark(null, 1).reason, 'absent');
  assert.equal(EntryRoutes.unpark('строка', 1).reason, 'absent');
  assert.equal(EntryRoutes.unpark([], 1).reason, 'absent');
  assert.equal(EntryRoutes.unpark({ v: 99, at: 0, intent: { action: 'gate' } }, 1).reason, 'version');
  assert.equal(EntryRoutes.unpark({ v: 1, at: 'вчера', intent: { action: 'gate' } }, 1).reason, 'malformed');
  // Глагол, подставленный в хранилище руками, не становится действием.
  assert.equal(EntryRoutes.unpark({ v: 1, at: 0, intent: { action: 'wipe' } }, 1).reason, 'malformed');
  assert.equal(EntryRoutes.unpark({ v: 1, at: 0 }, 1).reason, 'empty');
});

test('распарковка не доверяет полям записи', () => {
  const back = EntryRoutes.unpark({ v: 1, at: 0, view: 7, goalId: {}, intent: { action: 'gate', source: 42 } }, 1);
  assert.equal(back.plan.view, null);
  assert.equal(back.plan.goalId, null);
  assert.equal(back.plan.intent.source, 'shortcut');
});

test('запись не делится ссылкой с планом', () => {
  const plan = parse('?do=gate&app=TikTok');
  const record = EntryRoutes.park(plan, 0);
  plan.intent.action = 'finish';
  assert.equal(record.intent.action, 'gate');
});

test('модуль остаётся чистым', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app-entry-routes-v1.js'), 'utf8');
  // Комментарии как раз и объясняют, чего модуль не делает, поэтому проверяем код.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['location', 'sessionStorage', 'localStorage', 'history.', 'document', 'Date.now', 'State.', 'require(']) {
    assert.equal(code.includes(forbidden), false, `модуль не должен трогать ${forbidden}`);
  }
});
