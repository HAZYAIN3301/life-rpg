'use strict';

/* Secretary Events + Router Lite.
 *
 * Проверяется не «функция считает», а обещания, нарушение которых делает секретаря
 * вредным: один ход вместо нескольких, молчание как законный исход, тишина не
 * превращается в обвинение, отклонённое не возвращается, повтор факта не рождает
 * второе предложение, и слова человека не выдумываются.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const E = require('../public/secretary-events-v1.js');
const R = require('../public/secretary-router-v1.js');

const DAY = '2026-09-02';
const YDAY = '2026-09-01';
const morning = `${DAY}T08:30:00.000Z`;
const night = `${DAY}T23:30:00.000Z`;

const logWith = (...raws) => raws.reduce((acc, r) => E.append(acc, r).log, E.emptyLog());
const escapedYday = { type: E.TYPES.ATTENTION_ESCAPED, day: YDAY, at: `${YDAY}T23:50:00.000Z`, ref: 'tiktok' };
const overranYday = { type: E.TYPES.ATTENTION_OVERRAN, day: YDAY, at: `${YDAY}T22:00:00.000Z`, ref: 'game', plannedMinutes: 60, actualMinutes: 300 };
const silentYday = { type: E.TYPES.DAY_SILENT, day: YDAY, at: `${YDAY}T20:00:00.000Z`, silentDays: 2 };

const base = (over) => Object.assign({ now: morning, today: DAY, tzOffsetMinutes: 0, events: logWith(escapedYday), ledger: R.emptyLedger() }, over || {});

// ── события ────────────────────────────────────────────────────────────────────

test('событие без известного типа или дня не принимается', () => {
  assert.strictEqual(E.normalize(null), null);
  assert.strictEqual(E.normalize({ type: 'что-то', day: DAY }), null);
  assert.strictEqual(E.normalize({ type: E.TYPES.DAY_SILENT }), null, 'без дня — не событие');
  assert.ok(E.normalize({ type: E.TYPES.DAY_SILENT, day: DAY }));
});

test('🔴 один факт с двух устройств — одно событие', () => {
  // Повтор при retry или со второго устройства не должен родить второй повод.
  let log = E.emptyLog();
  const first = E.append(log, Object.assign({}, escapedYday, { source: 'client' }));
  const second = E.append(first.log, Object.assign({}, escapedYday, { source: 'server', at: `${YDAY}T23:55:00.000Z` }));
  assert.strictEqual(first.added, true);
  assert.strictEqual(second.added, false, 'дубль не добавляется');
  assert.strictEqual(second.log.events.length, 1);
});

test('событие не переносит содержимое экрана', () => {
  const ev = E.normalize({ type: E.TYPES.ATTENTION_OVERRAN, day: DAY, ref: 'tiktok', url: 'https://x/secret', query: 'что-то личное', plannedMinutes: 10, actualMinutes: 90 });
  assert.deepStrictEqual(Object.keys(ev.data).sort(), ['actualMinutes', 'plannedMinutes']);
  assert.strictEqual(JSON.stringify(ev).includes('secret'), false);
  assert.strictEqual(JSON.stringify(ev).includes('личное'), false);
});

test('🔴 повреждённый журнал не читается как пустой', () => {
  // Пустой журнал означал бы «ничего не случилось» и разрешил бы затереть события.
  assert.strictEqual(E.sanitizeLog(null), null);
  assert.strictEqual(E.sanitizeLog({ version: 2, events: [] }), null);
  assert.strictEqual(E.sanitizeLog({ version: 1, events: [{ type: 'мусор', day: DAY }] }), null);
  assert.ok(E.sanitizeLog({ version: 1, events: [escapedYday] }));
});

test('старые события выпадают из окна', () => {
  const old = { type: E.TYPES.DAY_SILENT, day: '2026-08-01', at: '2026-08-01T10:00:00.000Z' };
  const log = logWith(old, escapedYday);
  assert.strictEqual(E.prune(log, DAY).events.length, 1);
});

// ── router: базовый выбор ──────────────────────────────────────────────────────

test('утром после «меня унесло» появляется ровно один ход', () => {
  const offer = R.next(base());
  assert.ok(offer, 'ход должен быть');
  assert.strictEqual(offer.capability, 'morning-after-overrun');
  assert.strictEqual(offer.action, R.ACTIONS.RECOVERY_DAY);
  assert.strictEqual(offer.reason, 'escaped');
  assert.strictEqual(offer.askOnly, false);
  assert.deepStrictEqual([...offer.channels], ['card', 'push']);
});

test('🔴 без вчерашнего повода Router молчит', () => {
  // День восстановления без причины — это объявление дня плохим.
  assert.strictEqual(R.next(base({ events: E.emptyLog() })), null);
});

test('🔴 вечером утренний перехват не срабатывает', () => {
  // Точка вмешательства выбрана именно утром: вечером ресурса уже нет.
  assert.strictEqual(R.next(base({ now: night })), null);
  assert.strictEqual(R.next(base({ now: `${DAY}T04:00:00.000Z` })), null, 'до пяти утра — ещё ночь');
  assert.ok(R.next(base({ now: `${DAY}T12:59:00.000Z` })), 'до 13:00 — ещё утро');
});

test('утро считается по местному времени, а не по UTC', () => {
  // 06:30 по Берлину зимой — это 05:30 UTC.
  const utcNight = `${DAY}T05:30:00.000Z`;
  assert.ok(R.next(base({ now: utcNight, tzOffsetMinutes: 60 })), 'локально это утро');
  assert.strictEqual(R.next(base({ now: `${DAY}T03:30:00.000Z`, tzOffsetMinutes: 60 })), null, 'локально ещё ночь');
});

// ── router: честность ──────────────────────────────────────────────────────────

test('🔴 тишина даёт вопрос, а не вывод', () => {
  // Молчание может означать отдых, болезнь, школу или поездку. Система не решает.
  const offer = R.next(base({ events: logWith(silentYday) }));
  assert.ok(offer);
  assert.strictEqual(offer.reason, 'silent');
  assert.ok(offer.confidence < R.ASK_BELOW, 'уверенность ниже порога');
  assert.strictEqual(offer.askOnly, true);
  assert.strictEqual(offer.action, R.ACTIONS.ASK_ONE, 'один вопрос вместо плана');
});

test('измеренное превышение границы говорит увереннее тишины', () => {
  const over = R.next(base({ events: logWith(overranYday) }));
  const silent = R.next(base({ events: logWith(silentYday) }));
  assert.ok(over.confidence > silent.confidence);
  assert.strictEqual(over.askOnly, false);
});

test('🔴 Router нигде не называет это срывом и не считает очки', () => {
  const offer = R.next(base());
  const asText = JSON.stringify(offer).toLowerCase();
  for (const bad of ['срыв', 'провал', 'xp', 'gold', 'золот', 'streak', 'серия', 'штраф', 'наказ']) {
    assert.strictEqual(asText.includes(bad), false, `Router выносит оценку: «${bad}»`);
  }
});

// ── router: слова человека ─────────────────────────────────────────────────────

test('🔴 цитата берётся из уговоров и не выдумывается', () => {
  assert.strictEqual(R.next(base()).quote, null, 'уговоров нет — цитаты нет');
  const commitments = { items: [
    { id: 'c1', kind: 'care', title: 'Гулять после обеда', win: 'голова свежее', archived: false },
    { id: 'c2', kind: 'anchor', title: 'Подъём в 7:00', win: 'успеваю до школы', archived: false },
  ] };
  const offer = R.next(base({ commitments }));
  assert.strictEqual(offer.quote.id, 'c2', 'якорь подъёма ближе всего к утреннему разговору');
  assert.strictEqual(offer.quote.title, 'Подъём в 7:00');
  assert.strictEqual(offer.quote.win, 'успеваю до школы');
});

test('архивные уговоры не цитируются', () => {
  const commitments = { items: [{ id: 'c1', kind: 'anchor', title: 'Старое', win: 'x', archived: true }] };
  assert.strictEqual(R.next(base({ commitments })).quote, null);
});

// ── router: повторы ────────────────────────────────────────────────────────────

test('🔴 отклонённое не возвращается в тот же день', () => {
  const first = R.next(base());
  const ledger = R.mark(R.emptyLedger(), first, 'dismissed', morning);
  assert.strictEqual(R.next(base({ ledger })), null, 'повтор внутри cooldown запрещён');
});

test('принятое тоже закрывает cooldown — второй раз не предлагаем', () => {
  const first = R.next(base());
  const ledger = R.mark(R.emptyLedger(), first, 'accepted', morning);
  assert.strictEqual(R.next(base({ ledger })), null);
});

test('на следующий день с новым поводом ход возможен снова', () => {
  const first = R.next(base());
  const ledger = R.mark(R.emptyLedger(), first, 'dismissed', morning);
  const nextDay = '2026-09-03';
  const events = logWith(Object.assign({}, escapedYday, { day: DAY, at: `${DAY}T23:00:00.000Z` }));
  const offer = R.next({ now: `${nextDay}T09:00:00.000Z`, today: nextDay, tzOffsetMinutes: 0, events, ledger });
  assert.ok(offer, 'cooldown привязан к дню, а не навсегда');
});

test('🔴 один и тот же повод не рождает два разных предложения', () => {
  const a = R.next(base());
  const b = R.next(base());
  assert.strictEqual(a.offerId, b.offerId, 'offerId детерминирован');
  assert.ok(a.offerId.includes(a.about.eventKey), 'ключ повода входит в offerId');
});

test('повреждённый ledger не открывает повтор молча', () => {
  assert.strictEqual(R.sanitizeLedger({ version: 1, delivered: { x: { state: 'offered' } } }), null, 'без времени — не запись');
  assert.strictEqual(R.sanitizeLedger({ version: 2, delivered: {} }), null);
  assert.ok(R.sanitizeLedger(R.emptyLedger()));
});

test('mark ничего не мутирует и игнорирует чужой статус', () => {
  const led = R.emptyLedger();
  const offer = R.next(base());
  const marked = R.mark(led, offer, 'dismissed', morning);
  assert.strictEqual(Object.keys(led.delivered).length, 0, 'исходный ledger не тронут');
  assert.strictEqual(Object.keys(marked.delivered).length, 1);
  assert.strictEqual(Object.keys(R.mark(led, offer, 'придумал', morning).delivered).length, 0);
});

// ── словарь действий ───────────────────────────────────────────────────────────

test('🔴 в словаре действий нет ничего разрушительного', () => {
  const banned = ['delete', 'remove', 'purge', 'pay', 'charge', 'publish', 'post', 'share', 'grant', 'password'];
  for (const a of R.ACTION_LIST) {
    for (const bad of banned) {
      assert.strictEqual(a.toLowerCase().includes(bad), false, `опасное действие в словаре: ${a}`);
    }
  }
  assert.strictEqual(R.ACTION_LIST.length, 4, 'словарь остаётся закрытым и коротким');
});

test('модули не читают State, DOM и часы сами', () => {
  for (const f of ['public/secretary-events-v1.js', 'public/secretary-router-v1.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/']) {
      assert.strictEqual(src.includes(bad), false, `${f} вышел за свою роль: «${bad}»`);
    }
  }
  const router = fs.readFileSync(path.join(__dirname, '..', 'public/secretary-router-v1.js'), 'utf8');
  const code = router.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  assert.strictEqual(/Date\.now\(\)/.test(code), false, 'router обязан получать «сейчас» параметром');
});

/* ---- Цитата человека: уговоры v2 ------------------------------------------ */

const V2 = require('../public/commitment-v2.js');

function commitments(...drafts) {
  return drafts.reduce((s, d) => {
    const r = V2.add(s, d);
    assert.ok(r.ok, `фикстура невалидна: ${JSON.stringify(d)}`);
    return r.state;
  }, V2.emptyState());
}

const ANCHOR = { id: 'c1', kind: 'anchor', title: 'Подъём в 7:00', win: 'успеваю до школы' };
const A_TIKTOK = { id: 'a1', kind: 'attention', title: 'TikTok — только выложить, двенадцать минут', win: 'вечер остаётся мой', target: 'tiktok', edge: { kind: 'duration', minutes: 12 } };
const A_GAME = { id: 'a2', kind: 'attention', title: 'Игры не после 22:00', win: 'высыпаюсь', target: 'game' };

test('🔴 архивный уговор не цитируется как действующее решение', () => {
  // Регрессия: фильтр проверял несуществующее поле `archived` вместо `archivedAt`
  // и не отсеивал ничего. Предъявлять человеку то, от чего он отказался, — прямой
  // способ обесценить весь механизм «это твои собственные слова».
  let s = commitments(ANCHOR);
  assert.ok(R.ownWords(s), 'живой уговор цитируется');
  s = V2.archive(s, 'c1', YDAY);
  assert.strictEqual(R.ownWords(s), null, 'от этого уговора человек отказался');
});

test('🔴 цитируется уговор про то самое занятие, а не любой', () => {
  const s = commitments(ANCHOR, A_GAME, A_TIKTOK);
  assert.strictEqual(R.ownWords(s, 'tiktok').id, 'a1');
  assert.strictEqual(R.ownWords(s, 'TikTok').id, 'a1', 'регистр ярлыка не важен');
  assert.strictEqual(R.ownWords(s, 'game').id, 'a2');
});

test('нет уговора про это занятие — берётся ближайший по смыслу, а не молчание', () => {
  const s = commitments(ANCHOR, A_TIKTOK);
  assert.strictEqual(R.ownWords(s, 'ютуб').id, 'a1', 'любой уговор про внимание ближе якоря');
  assert.strictEqual(R.ownWords(commitments(ANCHOR), 'ютуб').id, 'c1');
  assert.strictEqual(R.ownWords(commitments(ANCHOR)).id, 'c1', 'без ярлыка тоже работает');
});

test('🔴 ход про TikTok цитирует решение человека про TikTok', () => {
  // Сквозная проверка: ref события доходит до цитаты, а не теряется по дороге.
  const offer = R.next(base({ commitments: commitments(ANCHOR, A_TIKTOK) }));
  assert.ok(offer, 'утро после срыва — повод есть');
  assert.strictEqual(offer.quote.id, 'a1');
  assert.strictEqual(offer.quote.win, 'вечер остаётся мой');
});

test('🔴 уговоров нет — ход остаётся, цитата отсутствует, ничего не выдумано', () => {
  const offer = R.next(base({ commitments: V2.emptyState() }));
  assert.ok(offer, 'отсутствие цитаты — не повод молчать');
  assert.strictEqual(offer.quote, null, 'выдумывать «твоё решение» запрещено');
});

test('состояние уговоров v1 читается роутером без миграции', () => {
  // Сервер мигрирует при чтении, но роутер обязан пережить и старую форму:
  // порядок выката не гарантирован, а падать на утреннем ходе он не имеет права.
  const V1 = require('../public/commitment-v1.js');
  const v1 = V1.add(V1.emptyState(), ANCHOR).state;
  assert.strictEqual(R.ownWords(v1, 'tiktok').id, 'c1');
});

test('🔴 не действующий сегодня уговор не цитируется', () => {
  // Дефект №7 контракта целиком: не только архивные, но и «ещё не начал» и «чужой
  // режим дня». «В каникулы» не является решением человека про учебное утро.
  const future = { id: 'f1', kind: 'anchor', title: 'Подъём в 6:00', win: 'успеваю', decidedOn: '2026-12-01' };
  const holidays = { id: 'h1', kind: 'attention', title: 'Игры до полуночи', win: 'отдыхаю', target: 'tiktok', modes: ['каникулы'] };

  const s = commitments(future, holidays, ANCHOR);
  assert.strictEqual(R.ownWords(s, 'tiktok', DAY, 'школа').id, 'c1', 'взят действующий, а не будущий и не каникулярный');
  assert.strictEqual(R.ownWords(s, 'tiktok', DAY, 'каникулы').id, 'h1', 'в своём режиме — цитируется');

  // Без дня фильтр по режиму не применяется: вызывающий не сообщил контекст, и
  // додумывать его за него нельзя.
  assert.ok(R.ownWords(s, 'tiktok'), 'без дня цитата всё равно находится');
});

test('🔴 утренний ход не цитирует уговор чужого режима', () => {
  const holidays = { id: 'h1', kind: 'attention', title: 'Игры до полуночи', win: 'отдыхаю', target: 'tiktok', modes: ['каникулы'] };
  const offer = R.next(base({ commitments: commitments(holidays), mode: 'школа' }));
  assert.ok(offer, 'повод есть');
  assert.strictEqual(offer.quote, null, 'лучше без цитаты, чем с неподходящей');
});
