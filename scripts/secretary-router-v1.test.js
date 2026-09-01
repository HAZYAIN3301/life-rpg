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

const base = (over) => Object.assign({ invocation: 'app_open', now: morning, today: DAY, tzOffsetMinutes: 0, events: logWith(escapedYday), ledger: R.emptyLedger() }, over || {});

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
  const ev = E.normalize({ type: E.TYPES.ATTENTION_OVERRAN, day: DAY, at: `${DAY}T21:00:00.000Z`, ref: 'tiktok', url: 'https://x/secret', query: 'что-то личное', plannedMinutes: 10, actualMinutes: 90 });
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
  assert.strictEqual(offer.capability, 'morning-recovery', 'имя не лжёт: ход бывает не только после overrun');
  assert.strictEqual(offer.action, R.ACTIONS.RECOVERY_DAY);
  assert.strictEqual(offer.reason, 'escaped');
  assert.strictEqual(offer.askOnly, false);
  // Ровно одна поверхность (дефект №10). Раньше ход уходил как ['card','push'],
  // и обе считали себя вправе показать его — человек получал одно и то же дважды.
  assert.strictEqual(offer.channel, 'card');
  assert.deepStrictEqual([...offer.channels], ['card'], 'старое поле держит один элемент');
});

test('🔴 ход авторизован для одной спросившей поверхности', () => {
  assert.strictEqual(R.next(base({ channel: 'push' })).channel, 'push');
  assert.strictEqual(R.next(base({ channel: 'card' })).channel, 'card');
  assert.strictEqual(R.next(base()).channel, 'card', 'по умолчанию — карточка');
  // Канал, о котором арбитр не знает, — это канал, способный показать второй ход.
  for (const bad of ['смс', 'email', '', null, 42]) {
    assert.strictEqual(R.next(base({ channel: bad })), null, `обслужен неизвестный канал: ${bad}`);
  }
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
  const offer = R.next({ invocation: 'app_open', now: `${nextDay}T09:00:00.000Z`, today: nextDay, tzOffsetMinutes: 0, events, ledger });
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

/* ---- Дефекты контракта §12 --------------------------------------------- */

test('🔴 невозможная дата не считается днём (дефект №2)', () => {
  // Регулярку «2026-02-31» проходит, а арифметика дат потом тихо уезжает.
  for (const bad of ['2026-02-31', '2026-13-01', '2026-00-10', '2026-04-31']) {
    assert.strictEqual(R.next(base({ today: bad })), null, `принята несуществующая дата: ${bad}`);
  }
  assert.ok(R.next(base({ today: DAY })), 'настоящая дата работает');
});

test('🔴 неверное время не подменяется показанием часов (дефект №8)', () => {
  const offer = R.next(base());
  for (const bad of [null, undefined, '', 'вчера', 42]) {
    const led = R.mark(R.emptyLedger(), offer, 'offered', bad);
    assert.deepStrictEqual(led, R.emptyLedger(), `часы подставлены вместо ${bad}`);
  }
  // Верное время отмечается как обычно.
  assert.notDeepStrictEqual(R.mark(R.emptyLedger(), offer, 'offered', morning), R.emptyLedger());
});

test('🔴 закрытый день гасит ход (дефект №9)', () => {
  // Человек уже закрыл день сам — предлагать ему День восстановления значит
  // спорить с его собственным выводом.
  assert.ok(R.next(base({ dayClosed: false })), 'незакрытый день — ход есть');
  assert.strictEqual(R.next(base({ dayClosed: true })), null);
});

test('🔴 Router не читает часы, State, DOM и сеть (дефект №17)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/secretary-router-v1.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', '/api/', 'Date.now', 'localStorage']) {
    assert.strictEqual(code.includes(bad), false, `Router вышел за свою роль: «${bad}»`);
  }
  assert.strictEqual(/new Date\(\s*\)/.test(code), false, 'голый new Date() — это чтение часов');
});

test('🔴 чтение файла не обнуляет поля события (дефект №1)', () => {
  // Самая дорогая из найденных ошибок: `sanitizeLog` прогонял записи с диска через
  // разбор входа с провода. Там поля лежат на верхнем уровне, а в сохранённом
  // событии — в `data`, поэтому 60 и 300 минут превращались в 0, а `capability` — в
  // пустую строку. При КАЖДОМ чтении файла сервером.
  const written = E.append(E.emptyLog(), {
    type: E.TYPES.ATTENTION_OVERRAN, day: YDAY, at: `${YDAY}T22:00:00.000Z`,
    ref: 'tiktok', plannedMinutes: 60, actualMinutes: 300,
  }).log;
  const fromDisk = E.sanitizeLog(JSON.parse(JSON.stringify(written)));
  assert.deepStrictEqual(fromDisk.events[0].data, { plannedMinutes: 60, actualMinutes: 300 });

  const late = E.append(E.emptyLog(), {
    type: E.TYPES.EVENING_LATE, day: YDAY, at: `${YDAY}T23:30:00.000Z`, minutesPast: 90,
  }).log;
  assert.strictEqual(E.sanitizeLog(JSON.parse(JSON.stringify(late))).events[0].data.minutesPast, 90);

  // Многократный круг ничего не размывает — файл читается при каждом запросе.
  let log = written;
  for (let i = 0; i < 5; i += 1) log = E.sanitizeLog(JSON.parse(JSON.stringify(log)));
  assert.deepStrictEqual(log.events[0].data, { plannedMinutes: 60, actualMinutes: 300 });
});

test('🔴 разбор входа и разбор диска — разные функции', () => {
  // Они читают поля из разных мест, и слияние их в одну было причиной дефекта №1.
  const wire = { type: E.TYPES.EVENING_LATE, day: YDAY, at: `${YDAY}T23:30:00.000Z`, minutesPast: 90 };
  const ingress = E.normalizeIngress(wire);
  assert.strictEqual(ingress.data.minutesPast, 90);
  // Вход с провода не понимает вложенный `data` — и не должен.
  assert.strictEqual(E.normalizeIngress({ type: wire.type, day: YDAY, at: wire.at, data: { minutesPast: 90 } }).data.minutesPast, 0);
  // Разбор диска не понимает верхний уровень — и тоже не должен.
  assert.strictEqual(E.sanitizeEvent(ingress).data.minutesPast, 90);
  assert.strictEqual(E.sanitizeEvent({ type: wire.type, day: YDAY, at: wire.at, minutesPast: 90 }).data.minutesPast, 0);
});

test('🔴 момент без времени отвергается, а не назначается на полдень (дефект №4)', () => {
  // «Меня унесло в 23:50» и «меня унесло в полдень» — разные утверждения о человеке,
  // и второе система придумывала сама.
  for (const type of E.POINT_TYPES) {
    assert.strictEqual(E.normalizeIngress({ type, day: YDAY }), null, `выдумано время для ${type}`);
    assert.strictEqual(E.normalizeIngress({ type, day: YDAY, at: 'вчера' }), null, type);
    assert.ok(E.normalizeIngress({ type, day: YDAY, at: `${YDAY}T23:50:00.000Z` }), type);
  }
  // События про день целиком времени не имеют — у них отметка дня, и это не выдумка.
  const silent = E.normalizeIngress({ type: E.TYPES.DAY_SILENT, day: YDAY, silentDays: 2 });
  assert.ok(silent);
  assert.strictEqual(silent.at, `${YDAY}T12:00:00.000Z`);
});

test('🔴 запись поверх повреждённого журнала не проходит (дефект №3)', () => {
  // Иначе повреждение закрепляется следующим же сохранением.
  const broken = { version: 1, events: [{ type: 'выдуманный', day: YDAY }] };
  const r = E.append(broken, { type: E.TYPES.DAY_CLOSED, day: YDAY });
  assert.strictEqual(r.added, false);
  assert.strictEqual(r.log, null, 'вызывающему нечего сохранять');
  assert.strictEqual(r.error, 'invalid_log');

  // Отсутствующий журнал — это первая запись, а не повреждение.
  for (const empty of [null, undefined]) {
    const first = E.append(empty, { type: E.TYPES.DAY_CLOSED, day: YDAY });
    assert.strictEqual(first.added, true, `${empty} должен быть первой записью`);
  }
});

test('🔴 Router не срабатывает без явного повода вызова (дефект №14)', () => {
  // Иначе число показов зависит от того, сколько раз перерисовался экран, а не от
  // того, что случилось с человеком.
  assert.ok(R.next(base({ invocation: 'app_open' })));
  assert.ok(R.next(base({ invocation: 'scheduler' })));
  for (const bad of [undefined, null, '', 'render', 'tick', 42]) {
    assert.strictEqual(R.next(base({ invocation: bad })), null, `сработал на «${bad}»`);
  }
});

test('🔴 закрытый день из журнала событий тоже гасит ход (дефект №12)', () => {
  // `day.closed` был объявлен и никем не читался. Теперь он потребляется — и это
  // единственный честный способ не хранить мёртвую схему.
  const events = logWith(escapedYday, { type: E.TYPES.DAY_CLOSED, day: DAY });
  assert.strictEqual(R.next(base({ events })), null);
  assert.ok(R.next(base({ events: logWith(escapedYday) })), 'без закрытия ход есть');
});

test('🔴 выведенные типы не принимаются молча (дефект №12)', () => {
  for (const type of E.RETIRED_TYPES) {
    const r = E.append(E.emptyLog(), { type, day: YDAY, at: `${YDAY}T09:00:00.000Z` });
    assert.strictEqual(r.added, false, type);
    assert.strictEqual(r.error, 'retired_type', `клиент должен узнать, что его не слышат: ${type}`);
  }
  // Старый файл с выведенным типом остаётся исправным: превратить его в
  // «повреждённый» значило бы отобрать у человека и настоящие события заодно.
  const old = { version: 1, events: [
    { type: 'morning.open', day: YDAY, at: `${YDAY}T07:00:00.000Z`, source: 'client', ref: '', data: {} },
  ] };
  assert.ok(E.sanitizeLog(old), 'старый файл читается');
});
