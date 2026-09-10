'use strict';

/* Secretary Next Moves v2 — policy trois ходов.
 *
 * Проверяется не «функция считает», а обещания, нарушение которых делает секретаря
 * вредным: один ход или молчание, срочность не рождает общий совет, неподтверждённое
 * выпадение не выпадение, возврат ведёт к ТОМУ ЖЕ делу, вечер не закрывает день,
 * чужой текст не доезжает до выбора, а выключенный ИИ ничего не меняет.
 *
 * Набор кейсов лежит отдельно — `evals/secretary-next-moves-v2.json`. Он читается
 * этим файлом целиком: кейс без ассерта здесь не пройдёт мимо.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const M = require('../public/secretary-next-moves-v2.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'secretary-next-moves-v2.js'), 'utf8');
const EVALS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evals', 'secretary-next-moves-v2.json'), 'utf8'));
const README = fs.readFileSync(path.join(__dirname, '..', 'SECRETARY-NEXT-MOVES-V2.md'), 'utf8');

const merge = (over) => Object.assign({}, EVALS.base, over || {});
const decide = (over) => M.decide(merge(over));

const morningLapse = {
  confirmed: true,
  source: 'user_confirmed',
  eventKey: 'attention.escaped|2026-09-09|policy_4f',
  day: '2026-09-09',
  endedAt: '2026-09-09T06:40:00.000Z',
  originalRef: 'quest:a1f',
  originalStillActionable: true,
  observedAt: '2026-09-09T06:45:00.000Z',
};

test('runtime capability gate keeps the evening sleep boundary while enabling only return', () => {
  const at = '2026-09-09T22:10:00.000Z';
  const result = decide({ now: at, today: '2026-09-09', utcOffsetMinutes: 0,
    enabledCapabilities: ['after-lapse-return'],
    lapse: { ...morningLapse, endedAt: at, observedAt: at },
    eveningContract: { configured: true, eveningTimeLocal: '22:00', observedAt: at } });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.offer.capabilityId, 'after-lapse-return');
  assert.strictEqual(result.offer.action.type, 'ask_one_question');
  assert.strictEqual(decide({ enabledCapabilities: [] }).offer, null);
  assert.strictEqual(decide({ enabledCapabilities: ['unknown'] }).error, 'invalid_capabilities');
  assert.strictEqual(decide({ enabledCapabilities: ['after-lapse-return', 'after-lapse-return'] }).error, 'invalid_capabilities');
});

/* ── Календарь и время ──────────────────────────────────────────────────────── */

test('невозможные календарные даты отвергаются, а не сдвигаются', () => {
  assert.equal(M.isDay('2026-02-30'), false);
  assert.equal(M.isDay('2026-99-99'), false);
  assert.equal(M.isDay('2026-13-01'), false);
  assert.equal(M.isDay('2026-04-31'), false);
  assert.equal(M.isDay('2028-02-29'), true, 'високосный день существует');
  assert.equal(M.isDay('2026-02-29'), false, 'невисокосный — нет');
});

test('арифметика дней переходит через месяц и год без Date', () => {
  assert.equal(M.addDays('2026-09-09', 14), '2026-09-23');
  assert.equal(M.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(M.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(M.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(M.addDays('2026-02-30', 1), null);
});

test('ISO разбирается строго: без зоны, с мусором и с невозможной датой — null', () => {
  assert.equal(M.parseIso('2026-09-09T07:30:00.000'), null, 'без зоны');
  assert.equal(M.parseIso('2026-09-09 07:30:00Z'), null);
  assert.equal(M.parseIso('2026-02-30T07:30:00.000Z'), null);
  assert.equal(M.parseIso('2026-09-09T25:00:00.000Z'), null);
  assert.equal(M.parseIso('вчера вечером'), null);
  assert.equal(typeof M.parseIso('2026-09-09T07:30:00.000Z'), 'number');
  assert.equal(
    M.parseIso('2026-09-09T09:30:00.000+02:00'),
    M.parseIso('2026-09-09T07:30:00.000Z'),
    'сдвиг зоны учитывается',
  );
});

test('локальный день считается от переданного сдвига, а не от часов машины', () => {
  const east = M.localParts(M.parseIso('2026-09-09T23:30:00.000Z'), 120);
  assert.equal(east.day, '2026-09-10');
  assert.equal(east.minutes, 90);
  const west = M.localParts(M.parseIso('2026-09-09T02:30:00.000Z'), -300);
  assert.equal(west.day, '2026-09-08');
  assert.equal(west.minutes, 21 * 60 + 30);
});

/* ── Чистота модуля ─────────────────────────────────────────────────────────── */

test('модуль не читает часы, DOM, сеть и глобальное состояние', () => {
  const body = SRC.split('function buildSecretaryNextMovesV2()')[1] || '';
  const banned = [
    /Date\.now\s*\(/,
    /new\s+Date\s*\(\s*\)/,
    /\bfetch\s*\(/,
    /\bdocument\b/,
    /\blocalStorage\b/,
    /\bXMLHttpRequest\b/,
    /['"`]\/api\//,
    /\bState\./,
  ];
  for (const re of banned) {
    assert.ok(!re.test(body), `в теле модуля не должно быть ${re}`);
  }
  // `new Date(ms)` тоже не используется: календарь считается своей арифметикой.
  assert.ok(!/new\s+Date\s*\(/.test(body), 'Date вообще не используется');
});

test('пример вызова в README принимается самим модулем', () => {
  // Инструкция, которую движок отвергает, хуже отсутствующей: интегратор скопирует её
  // и получит invalid_invocation. Один раз так уже случилось.
  const example = README.slice(README.indexOf('M.decide({'));
  const invocation = /invocation:\s*'([a-z_]+)'/.exec(example);
  assert.ok(invocation, 'в README должен быть пример вызова с invocation');
  assert.ok(M.INVOCATIONS.includes(invocation[1]), `README предлагает '${invocation[1]}', модуль принимает ${M.INVOCATIONS.join(' | ')}`);

  const alternatives = /invocation:.*\/\/([^\n]*)/.exec(example);
  if (alternatives) {
    for (const token of alternatives[1].match(/'([a-z_]+)'/g) || []) {
      const value = token.replace(/'/g, '');
      assert.ok(M.INVOCATIONS.includes(value), `README называет '${value}' допустимым, а модуль — нет`);
    }
  }
});

/* ── Замороженный словарь ───────────────────────────────────────────────────── */

test('три действия v212 переиспользованы дословно, новое — ровно одно', () => {
  for (const a of ['rest_start_prepared', 'evening_transition_open', 'ask_one_question']) {
    assert.ok(M.ACTION_LIST.includes(a), `${a} обязан сохраниться как есть`);
  }
  assert.deepEqual(M.PROPOSED_ACTIONS, ['task_open_prepared']);
  const newOnes = M.ACTION_LIST.filter((a) => !M.V212_ACTIONS.includes(a));
  assert.deepEqual(newOnes, ['task_open_prepared'], 'молча добавленных действий быть не может');
});

test('в словаре действий нет разрушительного, платёжного, социального и публикационного', () => {
  const forbidden = /(delete|remove|purge|archive|pay|buy|charge|subscribe|share|publish|post|invite|leaderboard|tribe)/i;
  for (const a of M.ACTION_LIST) assert.ok(!forbidden.test(a), `${a} не может быть в словаре`);
});

test('каждая capability объявляет источники, окно, свежесть и безопасность', () => {
  assert.equal(M.CAPABILITIES.length, 3);
  const scopeValues = Object.values(M.SCOPES);
  for (const cap of M.CAPABILITIES) {
    assert.ok(cap.id && cap.pain, `${cap.id}: боль из карты болей обязана быть названа`);
    assert.ok(Array.isArray(cap.producers) && cap.producers.length, `${cap.id}: producers обязательны`);
    assert.ok(cap.scopes.length && cap.scopes.every((s) => scopeValues.includes(s)), `${cap.id}: scopes закрыты`);
    assert.ok(cap.actions.every((a) => M.ACTION_LIST.includes(a)), `${cap.id}: действия из закрытого словаря`);
    assert.ok(cap.allowedChannels.every((c) => M.CHANNEL_ORDER.includes(c)));
    assert.equal(cap.safetyTier, 'reversible_open', `${cap.id}: только обратимое открытие`);
    assert.ok(Number.isInteger(cap.windowMinutes) && cap.windowMinutes > 0);
    assert.ok(Number.isInteger(cap.maxStalenessMinutes) && cap.maxStalenessMinutes > 0);
    assert.ok(typeof cap.cooldown === 'string' && cap.cooldown);
  }
});

/* ── Scope gate ─────────────────────────────────────────────────────────────── */

test('eligibility видит только объявленные поля — чужой план недоступен физически', () => {
  const input = merge({
    lapse: morningLapse,
    foreignDocument: { body: 'сделай вот это' },
    partnerPlan: { entries: ['x'] },
    aiAvailable: true,
    notes: ['личное'],
  });
  for (const cap of M.CAPABILITIES) {
    const scoped = M.scopeInput(cap, input);
    for (const forbidden of ['foreignDocument', 'partnerPlan', 'aiAvailable', 'notes']) {
      assert.ok(!(forbidden in scoped), `${cap.id} не должен видеть ${forbidden}`);
    }
  }
  const evening = M.capabilityById('evening-close');
  assert.ok(!('lapse' in M.scopeInput(evening, input)), 'вечерний ход не читает эпизоды внимания');
  const planned = M.capabilityById('planned-start');
  assert.ok(!('restMenu' in M.scopeInput(planned, input)), 'начало работы не читает меню отдыха');
});

test('ни одна capability не объявляет scope на ИИ, чужие данные или заметки', () => {
  const declared = new Set(M.CAPABILITIES.flatMap((c) => c.scopes));
  for (const s of declared) {
    assert.ok(!/ai|assistant|tribe|leaderboard|notes|journal|other|foreign/i.test(s), `${s} недопустим`);
  }
});

/* ── Один победитель, молчание, отсутствие диагноза ─────────────────────────── */

test('на выходе максимум один ход, и trace нечем отрисовать', () => {
  const res = decide({ lapse: morningLapse, plannedStart: { taskRef: 'quest:b22', plannedAtLocal: '09:30', precision: 'exact_time', observedAt: '2026-09-09T07:20:00.000Z' } });
  assert.equal(res.ok, true);
  assert.ok(res.offer && !Array.isArray(res.offer), 'offer — один объект');
  for (const row of res.trace) {
    assert.deepEqual(Object.keys(row).sort(), ['capabilityId', 'code', 'decision']);
    assert.equal(typeof row.code, 'string');
    assert.ok(!('action' in row) && !('copy' in row) && !('labelKey' in row));
  }
});

test('в выдаче нет экономики, серий, редкости и диагнозов', () => {
  const forbidden = /(\bxp\b|gold|coin|streak|rarity|reward|level_?up|срыв|провал|амнист|amnesty|зависим|лен(ь|и)|депресс|diagnos)/i;
  for (const c of EVALS.cases) {
    const res = M.decide(merge(c.input));
    if (!res.ok || !res.offer) continue;
    const dump = JSON.stringify(res.offer);
    assert.ok(!forbidden.test(dump), `${c.id}: запрещённая лексика в выдаче`);
  }
});

test('ход никогда не закрывает день и не планирует завтра', () => {
  for (const c of EVALS.cases) {
    const res = M.decide(merge(c.input));
    if (!res.ok || !res.offer) continue;
    assert.equal(res.offer.closesDay, false, c.id);
    assert.equal(res.offer.plansTomorrow, false, c.id);
    assert.ok(!JSON.stringify(res.offer.action).includes('close'), c.id);
  }
});

test('альтернатив не больше двух, и они не повторяют primary', () => {
  for (const c of EVALS.cases) {
    const res = M.decide(merge(c.input));
    if (!res.ok || !res.offer) continue;
    const alts = res.offer.alternatives;
    assert.ok(alts.length <= 2, `${c.id}: альтернатив ${alts.length}`);
    for (const a of alts) {
      assert.equal(a.disclosure, true, `${c.id}: альтернатива обязана быть под раскрытием`);
      assert.notDeepEqual(a.action, res.offer.primary.action, `${c.id}: дубль primary`);
      assert.ok(M.ACTION_LIST.includes(a.action.type), `${c.id}: действие вне словаря`);
    }
  }
});

test('низкая уверенность всегда становится одним вопросом, а не планом', () => {
  for (const c of EVALS.cases) {
    const res = M.decide(merge(c.input));
    if (!res.ok || !res.offer) continue;
    if (res.offer.confidence < M.ASK_BELOW) {
      assert.equal(res.offer.mode, 'ask', `${c.id}`);
      assert.equal(res.offer.action.type, 'ask_one_question', `${c.id}`);
      assert.equal(res.offer.copy.bodyKey, null, `${c.id}: план при вопросе не показывается`);
      assert.ok(res.offer.copy.questionKey, `${c.id}: вопрос обязан быть`);
    } else {
      assert.equal(res.offer.mode, 'offer', `${c.id}`);
    }
  }
});

test('наружу идут только locale keys и непрозрачные ссылки — свободного текста нет', () => {
  for (const c of EVALS.cases) {
    const res = M.decide(merge(c.input));
    if (!res.ok || !res.offer) continue;
    const o = res.offer;
    for (const key of Object.values(o.copy)) {
      if (key === null) continue;
      assert.match(key, /^[a-z0-9_.]+$/, `${c.id}: ${key} не похож на locale key`);
    }
    assert.match(o.primary.labelKey, /^[a-z0-9_.]+$/, c.id);
    // Единственный допустимый свободный текст — собственный уговор человека.
    if (o.quote) assert.equal(o.quote.source, 'own_commitment', c.id);
  }
});

/* ── ИИ, повтор, устойчивость ───────────────────────────────────────────────── */

test('выключенный ИИ и связь ничего не меняют в выборе хода', () => {
  const withAi = decide({ lapse: morningLapse, aiAvailable: true, aiProvider: 'gemini' });
  const withoutAi = decide({ lapse: morningLapse, aiAvailable: false, offline: true });
  assert.deepEqual(withoutAi.offer, withAi.offer);
  assert.deepEqual(withoutAi.silence, withAi.silence);
});

test('повторный вызов на тех же данных даёт ту же квитанцию', () => {
  const a = decide({ lapse: morningLapse });
  const b = decide({ lapse: morningLapse });
  assert.equal(a.offer.offerId, b.offer.offerId);
  assert.deepEqual(a.offer, b.offer);
  assert.ok(a.offer.offerId.startsWith('after-lapse-return|2026-09-09|'));
});

test('повреждённый ledger не превращается в пустой', () => {
  for (const bad of [{ version: 1, delivered: {} }, { version: 2, offers: [] }, { version: 2, offers: {}, capabilities: { unknown: {} } }, 'nope', 42]) {
    const res = M.decide(merge({ ledger: bad, lapse: morningLapse }));
    assert.equal(res.ok, false, JSON.stringify(bad));
    assert.equal(res.error, M.ERRORS.LEDGER);
  }
  assert.equal(M.sanitizeLedger(M.emptyLedger()) !== null, true);
});

/* ── Ledger: cooldown, отказ, игнор ─────────────────────────────────────────── */

test('отказ копится, три подряд надолго выключают ход, принятие сбрасывает', () => {
  let ledger = M.emptyLedger();
  let day = '2026-09-09';
  for (let i = 1; i <= 3; i += 1) {
    const res = M.decide(merge({
      now: `${day}T07:30:00.000Z`,
      today: day,
      ledger,
      lapse: Object.assign({}, morningLapse, {
        day,
        eventKey: `attention.escaped|${day}|policy_4f`,
        endedAt: `${day}T06:40:00.000Z`,
        observedAt: `${day}T06:45:00.000Z`,
      }),
    }));
    assert.ok(res.offer, `день ${i}: ход обязан быть (${res.error || (res.silence && res.silence.reason)})`);
    const marked = M.mark(ledger, res.offer, 'dismissed', `${day}T07:35:00.000Z`);
    assert.equal(marked.ok, true);
    ledger = marked.ledger;
    day = M.addDays(day, 1);
    // Перенос ledger на следующий день: cooldown дневной, suppression — нет.
    ledger = { version: 2, offers: {}, capabilities: ledger.capabilities };
  }
  const supp = M.suppressionFor(ledger, 'after-lapse-return', '2026-09-12');
  assert.equal(supp.suppressed, true);
  assert.equal(supp.reason, 'repeatedly_not_useful');
  assert.equal(supp.until, '2026-09-25');

  const accepted = M.mark(ledger, { capabilityId: 'after-lapse-return', offerId: 'x', cooldownKey: 'after-lapse-return|2026-09-12', about: { day: '2026-09-12' } }, 'accepted', '2026-09-12T08:00:00.000Z');
  assert.equal(accepted.ok, true);
  assert.equal(M.suppressionFor(accepted.ledger, 'after-lapse-return', '2026-09-12').suppressed, false);
});

test('три показа без ответа — это отдельная серия и более короткая пауза', () => {
  let ledger = M.emptyLedger();
  let day = '2026-09-09';
  for (let i = 0; i < 3; i += 1) {
    const offer = { capabilityId: 'planned-start', offerId: `planned-start|${day}|p`, cooldownKey: `planned-start|${day}`, about: { day } };
    ledger = M.mark(ledger, offer, 'expired', `${day}T09:00:00.000Z`).ledger;
    day = M.addDays(day, 1);
    ledger = { version: 2, offers: {}, capabilities: ledger.capabilities };
  }
  const supp = M.suppressionFor(ledger, 'planned-start', '2026-09-12');
  assert.equal(supp.suppressed, true);
  assert.equal(supp.reason, 'never_answered');
  assert.equal(supp.until, '2026-09-18');
});

test('назначенное пользователем напоминание не глушится сессией и закрытым днём', () => {
  const evening = { configured: true, eveningTimeLocal: '22:00', observedAt: '2026-09-09T19:00:00.000Z' };
  const at2210 = { now: '2026-09-09T20:10:00.000Z', eveningContract: evening };

  const duringSession = decide(Object.assign({ activeSession: { active: true } }, at2210));
  assert.ok(duringSession.offer, 'граница обязана прийти даже во время сессии');
  assert.equal(duringSession.offer.interrupt, false, 'но она не перебивает работу');
  assert.equal(duringSession.offer.deferUntil, 'session_end');

  const afterClose = decide(Object.assign({ dayClosed: true }, at2210));
  assert.ok(afterClose.offer, '«день закрыл, а работаю дальше» — ровно этот случай');
  assert.equal(afterClose.offer.interrupt, true);

  // Но советы в обоих состояниях по-прежнему молчат.
  const plan = { taskRef: 'quest:a1f', plannedAtLocal: '09:30', precision: 'exact_time', observedAt: '2026-09-09T07:20:00.000Z' };
  for (const [over, reason] of [[{ activeSession: { active: true } }, 'session_active'], [{ dayClosed: true }, 'day_closed']]) {
    const res = decide(Object.assign({ plannedStart: plan }, over));
    assert.equal(res.offer, null);
    assert.equal(res.silence.reason, reason);
    assert.ok(res.trace.some((r) => r.capabilityId === 'planned-start' && r.code === M.REJECT.NOT_USER_SCHEDULED));
  }
});

test('назначенное пользователем напоминание не выключается серией отказов и молчаний', () => {
  // Вечерняя граница — это настройка человека, а не совет секретаря. Проигнорированный
  // совет не имеет права отменить то, что человек назначил себе сам.
  const evening = M.capabilityById('evening-close');
  assert.equal(evening.userScheduled, true);
  assert.ok(M.CAPABILITIES.filter((c) => c.userScheduled).length === 1, 'исключение ровно одно');

  let ledger = M.emptyLedger();
  let day = '2026-09-09';
  for (let i = 0; i < 5; i += 1) {
    const offer = { capabilityId: 'evening-close', offerId: `evening-close|${day}|e`, cooldownKey: `evening-close|${day}`, about: { day } };
    const res = M.mark(ledger, offer, i % 2 ? 'expired' : 'dismissed', `${day}T21:00:00.000Z`);
    assert.equal(res.ok, true);
    ledger = { version: 2, offers: {}, capabilities: res.ledger.capabilities };
    day = M.addDays(day, 1);
  }
  assert.equal(M.suppressionFor(ledger, 'evening-close', day).suppressed, false, 'граница обязана вернуться завтра');

  // И ход действительно приходит после пяти отказов подряд.
  const res = M.decide(merge({
    now: '2026-09-14T20:10:00.000Z', today: '2026-09-14', ledger,
    eveningContract: { configured: true, eveningTimeLocal: '22:00', observedAt: '2026-09-14T19:00:00.000Z' },
  }));
  assert.equal(res.ok, true);
  assert.ok(res.offer, `ожидался вечерний ход, пришло ${res.silence && res.silence.reason}`);
  assert.equal(res.offer.capabilityId, 'evening-close');
});

test('cooldownKey нельзя занять вторым предложением, а терминальный исход не переписывается', () => {
  const offer = { capabilityId: 'evening-close', offerId: 'evening-close|2026-09-09|a', cooldownKey: 'evening-close|2026-09-09', about: { day: '2026-09-09' } };
  const first = M.mark(M.emptyLedger(), offer, 'accepted', '2026-09-09T20:00:00.000Z');
  assert.equal(first.ok, true);

  const repeat = M.mark(first.ledger, offer, 'accepted', '2026-09-09T20:01:00.000Z');
  assert.equal(repeat.ok, true);
  assert.equal(repeat.changed, false, 'повтор идемпотентен');

  const other = Object.assign({}, offer, { offerId: 'evening-close|2026-09-09|b' });
  assert.equal(M.mark(first.ledger, other, 'accepted', '2026-09-09T20:02:00.000Z').error, 'cooldown_taken');
  assert.equal(M.mark(first.ledger, offer, 'dismissed', '2026-09-09T20:03:00.000Z').error, 'terminal_state');
  assert.equal(M.mark(first.ledger, offer, 'accepted', 'позже').error, M.ERRORS.TIME);
  assert.equal(M.mark(first.ledger, offer, 'ignored', '2026-09-09T20:03:00.000Z').error, 'invalid_outcome');
  assert.equal(M.mark(first.ledger, { capabilityId: 'nope', offerId: 'x', cooldownKey: 'y' }, 'accepted', '2026-09-09T20:03:00.000Z').error, 'unknown_capability');
});

/* ── Совместимость с тем, что реально задеплоено ────────────────────────────── */

test('адаптер к рантайму v1 честно отказывается от действия, которого там нет', () => {
  const withTask = decide({ lapse: morningLapse });
  assert.equal(withTask.offer.action.type, 'task_open_prepared');
  const legacy = M.toLegacyOfferV1(withTask.offer);
  assert.equal(legacy.ok, false);
  assert.equal(legacy.error, 'action_not_in_v1');
  assert.equal(legacy.action, 'task_open_prepared');
});

test('вечерний ход переводится в форму v1 без потери смысла', () => {
  const res = decide({
    now: '2026-09-09T20:10:00.000Z',
    eveningContract: { configured: true, eveningTimeLocal: '22:00', observedAt: '2026-09-09T19:00:00.000Z' },
  });
  const legacy = M.toLegacyOfferV1(res.offer);
  assert.equal(legacy.ok, true);
  assert.deepEqual(legacy.offer.channels, ['card'], 'v1 ждёт массив каналов');
  assert.equal(legacy.offer.capability, 'evening-close');
  assert.equal(legacy.offer.action, 'evening_transition_open');
  assert.equal(legacy.offer.askOnly, false);
  assert.equal(legacy.offer.cooldownKey, 'evening-close|2026-09-09');
  assert.equal(legacy.offer.about.eventKey, res.offer.about.basisKey);
});

/* ── Набор оценок ───────────────────────────────────────────────────────────── */

test('файл оценок содержательный и без дублей', () => {
  assert.ok(EVALS.cases.length >= 25, `кейсов ${EVALS.cases.length}, нужно >= 25`);
  const ids = EVALS.cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'id кейсов уникальны');
  for (const c of EVALS.cases) {
    assert.ok(c.why && c.why.length > 30, `${c.id}: нужно объяснение, зачем кейс`);
    assert.ok(c.expect && Object.keys(c.expect).length, `${c.id}: пустое ожидание`);
    assert.ok(c.group, `${c.id}: группа обязательна`);
  }
  const groups = new Set(EVALS.cases.map((c) => c.group));
  for (const g of ['planned-start', 'evening-close', 'after-lapse-return', 'conflict', 'safety', 'time']) {
    assert.ok(groups.has(g), `нет группы ${g}`);
  }
});

test('фикстуры синтетические: ни личной рефлексии, ни URL, ни заголовков материалов', () => {
  const dump = JSON.stringify(EVALS.cases);
  assert.ok(!/https?:\/\//.test(dump), 'URL в фикстурах не место');
  assert.ok(!/(tiktok|youtube|instagram|twitch)/i.test(dump), 'названия площадок не хранятся');
  for (const c of EVALS.cases) {
    const lapse = c.input && c.input.lapse;
    if (lapse && lapse.eventKey) {
      assert.match(lapse.eventKey, /^[a-z.]+\|\d{4}-\d{2}-\d{2}\|[a-z0-9_]+$/, `${c.id}: ref обязан быть непрозрачным`);
    }
  }
});

const byId = new Map(EVALS.cases.map((c) => [c.id, c]));

for (const c of EVALS.cases) {
  test(`eval: ${c.id} — ${c.why.slice(0, 90)}`, () => {
    const input = merge(c.input);
    const res = M.decide(input);
    const e = c.expect;

    if (e.ok === false) {
      assert.equal(res.ok, false, 'ожидалась явная ошибка');
      assert.equal(res.error, e.error);
      return;
    }
    assert.equal(res.ok, true, `неожиданная ошибка ${res.error}`);

    if (e.silence) {
      assert.equal(res.offer, null, `ожидалось молчание, пришёл ход ${res.offer && res.offer.capabilityId}`);
      assert.equal(res.silence.reason, e.silence);
    } else {
      assert.ok(res.offer, 'ожидался ход, пришло молчание');
      assert.equal(res.silence, null);
    }

    const o = res.offer;
    if (e.capabilityId) assert.equal(o.capabilityId, e.capabilityId);
    if (e.action) assert.equal(o.action.type, e.action);
    if (e.mode) assert.equal(o.mode, e.mode);
    if (e.channel) assert.equal(o.channel, e.channel);
    if (e.confidence !== undefined) assert.equal(o.confidence, e.confidence);
    if (e.reasonCode) assert.equal(o.reasonCode, e.reasonCode);
    if (e.basisKey) assert.equal(o.about.basisKey, e.basisKey);
    if (e.size) assert.equal(o.action.args.size, e.size);
    if (e.boundaryAtLocal) assert.equal(o.boundary.atLocal, e.boundaryAtLocal);
    if (e.finiteMinutes !== undefined) {
      assert.equal(o.finite.minutes, e.finiteMinutes);
      assert.match(o.finite.endsAtLocal, /^\d{2}:\d{2}$/, 'конечный отдых обязан иметь посчитанный конец');
    }
    if (e.targetRef) {
      const ref = o.action.args.targetRef || o.action.args.activityRef;
      assert.equal(ref, e.targetRef, 'ход обязан указывать на то же дело');
    }
    if (e.alternatives !== undefined) assert.equal(o.alternatives.length, e.alternatives);
    if (e.alternativeActions) assert.deepEqual(o.alternatives.map((a) => a.action.type), e.alternativeActions);
    if (e.hasQuestionKey !== undefined) assert.equal(!!o.copy.questionKey, e.hasQuestionKey);
    if (e.hasBodyKey !== undefined) assert.equal(!!o.copy.bodyKey, e.hasBodyKey);
    if (e.closesDay !== undefined) assert.equal(o.closesDay, e.closesDay);
    if (e.plansTomorrow !== undefined) assert.equal(o.plansTomorrow, e.plansTomorrow);
    if (e.interrupt !== undefined) assert.equal(o.interrupt, e.interrupt);
    if (e.deferUntil !== undefined) assert.equal(o.deferUntil, e.deferUntil);

    if (e.traceHas) {
      const seen = res.trace.map((r) => `${r.capabilityId}:${r.code}`);
      for (const want of e.traceHas) assert.ok(seen.includes(want), `в trace нет ${want} (есть: ${seen.join(', ')})`);
    }
    if (e.scopeExcludes) {
      const cap = M.capabilityById(e.capabilityId || 'after-lapse-return');
      const scoped = M.scopeInput(cap, input);
      for (const key of e.scopeExcludes) assert.ok(!(key in scoped), `${key} не должен доезжать до выбора`);
    }
    if (e.sameOfferAs) {
      const other = byId.get(e.sameOfferAs);
      assert.ok(other, `кейс ${e.sameOfferAs} не найден`);
      assert.deepEqual(o, M.decide(merge(other.input)).offer, 'решение обязано совпасть');
    }
  });
}
