/* Satoru Secretary Next Moves v2 — три полезных хода вместо одного.
 *
 * Что это. Additive policy поверх замороженного контракта v212. Он НЕ заменяет
 * `secretary-router-v1.js` и не переключает production engine: это отдельный чистый
 * модуль, который отвечает на тот же вопрос («какой ровно один ход уместен сейчас»)
 * для трёх новых оснований, и делает это в терминах v212 offer shape.
 *
 * Почему отдельный файл, а не правка router-а. `SECRETARY-ROUTER-V212-INTEGRATION.md`
 * объявлен FROZEN, а `secretary-router-v1.js` принадлежит владельцу движка и на v250
 * как раз получил серию исправлений. Дописывать в него три новых основания в этот
 * момент — гарантированный конфликт. Поэтому v2 существует рядом, отдаёт
 * v212-совместимую форму и умеет честно сказать, какой из его ходов текущий рантайм
 * доставить НЕ может (`toLegacyOfferV1`).
 *
 * Три хода (SECRETARY-OS-PAIN-MAP §5: BH-01, BH-04, BH-06):
 *
 *  1. `planned-start`       — начать заранее сохранённый вход в работу. Не «поработай
 *                             над проектом»: без конкретной сохранённой записи ход не
 *                             существует, даже когда дедлайн известен и близок.
 *  2. `evening-close`       — подойти к своей же вечерней границе и задать ОДИН вопрос
 *                             о контексте. Он не закрывает день и не планирует завтра.
 *  3. `after-lapse-return`  — вернуться после ПОДТВЕРЖДЁННОГО выпадения: минимум по
 *                             исходному делу либо конечный отдых. Никакого диагноза.
 *
 * ⚠️ Инварианты, без которых модуль становится вредным (каждый закрыт тестом):
 *
 *  — **Один победитель или молчание.** `decide()` возвращает максимум один offer.
 *    `trace` намеренно не содержит ни текста, ни action — его нечем отрисовать.
 *  — **Право молчать.** `silence.reason` из закрытого списка приходит чаще хода.
 *  — **Основания, а не догадки.** У каждого хода объявлены точные producers, срок
 *    свежести и scopes. Просроченная проекция = `unknown` и отказ, а не «плана нет».
 *  — **Никакого произвольного чтения чужого плана.** Eligibility видит только те
 *    поля входа, которые перечислены в `scopes` capability (`scopeInput`). Чужой
 *    документ, заметка или AI-текст физически не доезжают до выбора хода.
 *  — **AI ничего не решает.** `aiAvailable` не входит в scopes ни одного хода;
 *    решение при включённом и выключенном ИИ обязано совпадать байт в байт.
 *  — **Ни диагноза, ни экономики.** В выдаче нет XP, золота, серии, редкости и слов
 *    про зависимость/лень/депрессию. Выпадение — событие, а не свойство человека.
 *  — **Часы приходят параметром.** Ни `Date.now()`, ни `new Date()`, ни DOM, ни сеть.
 *    Календарь считается своей арифметикой, поэтому `2026-02-30` отвергается, а не
 *    молча превращается в март (дефект §12.2 контракта v212).
 *
 * Чего здесь нет и не появится: записи в сторы, второго плана/календаря/трекера,
 * своей валюты, копирайтинга (наружу идут только locale keys) и доставки.
 */
(function exposeSecretaryNextMovesV2(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryNextMovesV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSecretaryNextMovesV2() {
  'use strict';

  const VERSION = '2.0.0-policy';

  /* ── Словарь действий ────────────────────────────────────────────────────────
   * Три из четырёх переиспользованы из замороженного v212. Ровно одно предложено
   * дополнительно, и это ОТКРЫТОЕ РЕШЕНИЕ ВЛАДЕЛЬЦА, а не факт: без него «начать
   * заранее сохранённый вход» нечем выразить — `recovery_day_open` означает другое.
   * Тест проверяет, что новых действий ровно одно и что оно обратимо-открывающее. */
  const ACTIONS = Object.freeze({
    REST_START: 'rest_start_prepared',        // v212, без изменений
    EVENING_TRANSITION: 'evening_transition_open', // v212, без изменений
    ASK_ONE: 'ask_one_question',              // v212, без изменений
    TASK_OPEN: 'task_open_prepared',          // ПРЕДЛОЖЕНО v2 — требует решения владельца
  });
  const V212_ACTIONS = Object.freeze(['recovery_day_open', 'rest_start_prepared', 'evening_transition_open', 'ask_one_question']);
  const PROPOSED_ACTIONS = Object.freeze([ACTIONS.TASK_OPEN]);
  const ACTION_LIST = Object.freeze(Object.keys(ACTIONS).map((k) => ACTIONS[k]));

  const CHANNEL_ORDER = Object.freeze(['card', 'push', 'extension', 'voice']);
  // Совпадают дословно с `SecretaryRouterV1.INVOCATIONS` из рантайма v250: если бы
  // они разошлись, адаптеру пришлось бы переводить контракт вызова, а перевод —
  // это место, где однажды появится четвёртое значение «на всякий случай».
  const INVOCATIONS = Object.freeze(['app_open', 'scheduler', 'manual']);
  const OUTCOMES = Object.freeze(['offered', 'accepted', 'dismissed', 'expired']);

  const ERRORS = Object.freeze({
    TIME: 'invalid_time',
    DAY: 'invalid_day',
    OFFSET: 'invalid_offset',
    LEDGER: 'invalid_ledger',
    CHANNELS: 'invalid_channels',
    INVOCATION: 'invalid_invocation',
    DAY_STATE: 'invalid_day_state',
    FLAG: 'invalid_flag',
  });

  /* Закрытый список причин молчания. Молчание обязано быть объяснимым в логах и
   * при этом невидимым для человека: пользователю не показывается «я промолчал». */
  const SILENCE = Object.freeze({
    DAY_CLOSED: 'day_closed',
    SESSION_ACTIVE: 'session_active',
    GUIDE_ACTIVE: 'guide_active',
    FIRST_VALUE_PENDING: 'first_value_pending',
    ALL_SUPPRESSED: 'all_suppressed',
    NOTHING_ELIGIBLE: 'nothing_eligible',
  });

  /* Коды отказа отдельной capability. Живут только в `trace`, наружу не рендерятся. */
  const REJECT = Object.freeze({
    COOLDOWN: 'cooldown_taken',
    SUPPRESSED: 'suppressed',
    STALE: 'stale_input',
    MISSING: 'missing_input',
    OUTSIDE_WINDOW: 'outside_window',
    NO_SAVED_ENTRY: 'no_saved_entry',
    NOT_CONFIRMED: 'not_confirmed',
    ALREADY_STARTED: 'already_started',
    NO_CHANNEL: 'no_channel',
    BUSY_UNTIL_KNOWN_COMMITMENT: 'busy_until_known_commitment',
    DEFERRED_TO_EVENING: 'deferred_to_evening',
    LOST_PRIORITY: 'lost_priority',
    NOT_CONFIGURED: 'not_configured',
    NOT_USER_SCHEDULED: 'not_user_scheduled',
  });

  /* Scopes. Единственный способ, которым eligibility получает данные: всё, что не
   * перечислено, отрезается `scopeInput` до вызова. Это и есть техническая гарантия
   * «никакого произвольного чтения чужого плана». */
  const SCOPES = Object.freeze({
    QUESTS: 'quests:read',
    COMMITMENTS: 'commitments:read',
    HABITS: 'habits:read',
    ATTENTION: 'attention:read',
    EVENING: 'evening:read',
    REST: 'rest:read',
    SCHEDULE: 'schedule:read',
    DEADLINE: 'deadline:read',
  });
  const SCOPE_INPUTS = Object.freeze({
    'quests:read': Object.freeze(['plannedStart', 'todayProgress']),
    'commitments:read': Object.freeze(['commitmentItems']),
    'habits:read': Object.freeze(['habitMinimum']),
    'attention:read': Object.freeze(['lapse']),
    'evening:read': Object.freeze(['eveningContract']),
    'rest:read': Object.freeze(['restMenu']),
    'schedule:read': Object.freeze(['tonightSchedule']),
    'deadline:read': Object.freeze(['externalDeadline']),
  });
  // Поля, которые видит любая capability: время, канал, и жёсткие блокировки.
  const BASE_INPUTS = Object.freeze([
    'now', 'nowMs', 'today', 'utcOffsetMinutes', 'invocation',
    'dayClosed', 'localMinutes', 'localDay',
  ]);

  // Ниже этого порога ход обязан быть вопросом об одном факте, а не планом.
  const ASK_BELOW = 0.6;
  // Сколько подряд отказов/молчаний превращают ход в надолго неуместный.
  const DISMISS_STREAK_LIMIT = 3;
  const DISMISS_SUPPRESS_DAYS = 14;
  const IGNORE_STREAK_LIMIT = 3;
  const IGNORE_SUPPRESS_DAYS = 7;

  /* ── Календарь без Date ──────────────────────────────────────────────────────
   * Своя арифметика по двум причинам: (1) контракт v212 §12.2/§12.8 прямо требует
   * календарной round-trip проверки и запрета системных часов; (2) `Date.parse`
   * принимает мусор вроде `2026-02-30` и молча сдвигает его. */

  function daysFromCivil(y, m, d) {
    const yy = y - (m <= 2 ? 1 : 0);
    const era = Math.floor(yy / 400);
    const yoe = yy - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function civilFromDays(z0) {
    const z = z0 + 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const y = yoe + era * 400;
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    return { y: y + (m <= 2 ? 1 : 0), m, d };
  }

  const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
  const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const DAY_MS = 86400000;

  /** Календарный день с round-trip проверкой: `2026-02-30` и `2026-99-99` отвергаются. */
  function isDay(v) {
    const m = typeof v === 'string' ? DAY_RE.exec(v) : null;
    if (!m) return false;
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1970 || y > 2999) return false;
    const back = civilFromDays(daysFromCivil(y, mo, d));
    return back.y === y && back.m === mo && back.d === d;
  }

  function dayToEpoch(day) {
    const m = DAY_RE.exec(day);
    return daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3])) * DAY_MS;
  }
  function addDays(day, n) {
    if (!isDay(day) || !Number.isInteger(n)) return null;
    const c = civilFromDays(Math.floor(dayToEpoch(day) / DAY_MS) + n);
    return `${pad(c.y, 4)}-${pad(c.m, 2)}-${pad(c.d, 2)}`;
  }
  function pad(n, width) { return String(n).padStart(width, '0'); }

  /** Строгий ISO → epoch ms, либо null. Полдень «на всякий случай» не выдумывается. */
  function parseIso(v) {
    const m = typeof v === 'string' ? ISO_RE.exec(v) : null;
    if (!m) return null;
    const dayPart = `${m[1]}-${m[2]}-${m[3]}`;
    if (!isDay(dayPart)) return null;
    const hh = Number(m[4]); const mi = Number(m[5]); const ss = Number(m[6]);
    if (hh > 23 || mi > 59 || ss > 59) return null;
    const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
    let epoch = dayToEpoch(dayPart) + hh * 3600000 + mi * 60000 + ss * 1000 + ms;
    if (m[8] !== 'Z') {
      const sign = m[8][0] === '-' ? -1 : 1;
      const oh = Number(m[8].slice(1, 3)); const om = Number(m[8].slice(4, 6));
      if (oh > 23 || om > 59) return null;
      epoch -= sign * (oh * 60 + om) * 60000;
    }
    return epoch;
  }

  function isoFromEpoch(ms) {
    const dayIndex = Math.floor(ms / DAY_MS);
    const c = civilFromDays(dayIndex);
    const rest = ms - dayIndex * DAY_MS;
    const hh = Math.floor(rest / 3600000);
    const mi = Math.floor((rest % 3600000) / 60000);
    const ss = Math.floor((rest % 60000) / 1000);
    const msPart = rest % 1000;
    return `${pad(c.y, 4)}-${pad(c.m, 2)}-${pad(c.d, 2)}T${pad(hh, 2)}:${pad(mi, 2)}:${pad(ss, 2)}.${pad(msPart, 3)}Z`;
  }

  /** `local = UTC + utcOffsetMinutes` — та же семантика, что в §4.3 контракта v212. */
  function localParts(nowMs, offsetMinutes) {
    const shifted = nowMs + offsetMinutes * 60000;
    const dayIndex = Math.floor(shifted / DAY_MS);
    const c = civilFromDays(dayIndex);
    return {
      day: `${pad(c.y, 4)}-${pad(c.m, 2)}-${pad(c.d, 2)}`,
      minutes: Math.floor((shifted - dayIndex * DAY_MS) / 60000),
    };
  }
  function hhmmToMinutes(v) {
    const m = typeof v === 'string' ? HHMM_RE.exec(v) : null;
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function minutesToHhmm(total) {
    const t = ((total % 1440) + 1440) % 1440;
    return `${pad(Math.floor(t / 60), 2)}:${pad(t % 60, 2)}`;
  }

  /* ── Реестр возможностей ─────────────────────────────────────────────────────
   * Машиночитаемый и закрытый (SECRETARY-OS-PAIN-MAP §7). `producers` — точные
   * источники: адаптер обязан их построить, иначе capability просто не срабатывает.
   * `maxStalenessMinutes` — срок годности проекции; просрочка = отказ, не догадка. */
  const CAPABILITIES = Object.freeze([
    Object.freeze({
      id: 'after-lapse-return',
      pain: 'BH-04',
      priority: 100,
      // Действие выбирается веткой: минимум по исходному делу / конечный отдых / вопрос.
      actions: Object.freeze([ACTIONS.TASK_OPEN, ACTIONS.REST_START, ACTIONS.ASK_ONE]),
      allowedChannels: Object.freeze(['card', 'push']),
      safetyTier: 'reversible_open',
      entryCost: 'one_tap',
      cooldown: 'once_per_local_day',
      windowMinutes: 180,
      maxStalenessMinutes: 240,
      scopes: Object.freeze([SCOPES.ATTENTION, SCOPES.HABITS, SCOPES.QUESTS, SCOPES.REST, SCOPES.COMMITMENTS, SCOPES.EVENING]),
      producers: Object.freeze([
        'lapse ← AttentionEpisodeV1 (outcome==="escaped", endedAt) или SecretaryEventsV1 attention.escaped',
        'habitMinimum ← habit.atomic.twoMin владельца привычек',
        'plannedStart.taskRef ← Quests/Days, если исходное дело — задача',
        'restMenu ← RestProfileV1.pickForLowResource',
        'commitmentItems ← CommitmentV1.dueOn(state, today, mode)',
        'eveningContract ← settings.secretary — только чтобы НЕ звать в работу после своей же границы',
      ]),
    }),
    Object.freeze({
      id: 'planned-start',
      pain: 'BH-01',
      priority: 90,
      actions: Object.freeze([ACTIONS.TASK_OPEN, ACTIONS.ASK_ONE]),
      // Только card: neutral push про начало работы возможен, но он либо назовёт
      // дело (утечка), либо станет бессмысленным. Решение владельца, см. README §7.
      allowedChannels: Object.freeze(['card']),
      safetyTier: 'reversible_open',
      entryCost: 'one_tap',
      cooldown: 'once_per_local_day',
      windowMinutes: 45,
      maxStalenessMinutes: 180,
      scopes: Object.freeze([SCOPES.QUESTS, SCOPES.COMMITMENTS, SCOPES.HABITS, SCOPES.DEADLINE]),
      producers: Object.freeze([
        'plannedStart ← сохранённый quest/day-entry с plannedAtLocal (HH:MM) и taskRef',
        'commitmentItems ← CommitmentV1.dueOn(...) — уговор kind:"step" как маленький вход',
        'habitMinimum ← habit.atomic.twoMin — альтернатива «сделать минимум»',
        'externalDeadline ← подтверждённый пользователем дедлайн (source:"user_confirmed")',
      ]),
    }),
    Object.freeze({
      id: 'evening-close',
      pain: 'BH-06',
      priority: 80,
      // Это НЕ совет секретаря, а напоминание о границе, которую человек назначил сам.
      // Поэтому оно не выключается серией отказов и молчаний: иначе проигнорированный
      // совет отменил бы собственную настройку пользователя. Дневной cooldown остаётся.
      userScheduled: true,
      actions: Object.freeze([ACTIONS.EVENING_TRANSITION]),
      allowedChannels: Object.freeze(['card', 'push']),
      safetyTier: 'reversible_open',
      entryCost: 'one_tap',
      cooldown: 'once_per_local_day',
      windowMinutes: 120,
      maxStalenessMinutes: 240,
      scopes: Object.freeze([SCOPES.EVENING, SCOPES.SCHEDULE, SCOPES.REST]),
      producers: Object.freeze([
        'eveningContract ← settings.secretary {eveningTime, configured} — только configured:true',
        'tonightSchedule ← подтверждённое занятие вечером (busyUntilLocal), например тренировка',
        'restMenu ← RestProfileV1 для альтернативы «конечный отдых»',
      ]),
    }),
  ]);
  const CAPABILITY_IDS = Object.freeze(CAPABILITIES.map((c) => c.id));
  function capabilityById(id) { return CAPABILITIES.find((c) => c.id === id) || null; }

  /* ── Ledger ──────────────────────────────────────────────────────────────────
   * Проекция серверной записи выдачи. Чистый модуль её только читает и возвращает
   * новую версию из `mark()`; писать обязан владелец (server secretary ledger). */
  function emptyLedger() {
    return { version: 2, offers: {}, capabilities: {} };
  }

  function sanitizeLedger(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (Number(raw.version) !== 2) return null;
    if (!raw.offers || typeof raw.offers !== 'object' || Array.isArray(raw.offers)) return null;
    if (!raw.capabilities || typeof raw.capabilities !== 'object' || Array.isArray(raw.capabilities)) return null;
    const offers = {};
    for (const key of Object.keys(raw.offers)) {
      const row = raw.offers[key];
      if (!row || typeof row !== 'object') return null;
      const at = parseIso(row.at) === null ? '' : row.at;
      const state = OUTCOMES.indexOf(String(row.state)) >= 0 ? String(row.state) : '';
      const offerId = typeof row.offerId === 'string' && row.offerId ? row.offerId.slice(0, 200) : '';
      if (!at || !state || !offerId) return null;
      offers[String(key).slice(0, 160)] = { offerId, at, state };
    }
    const capabilities = {};
    for (const id of Object.keys(raw.capabilities)) {
      const row = raw.capabilities[id];
      if (!row || typeof row !== 'object') return null;
      if (CAPABILITY_IDS.indexOf(String(id)) < 0) return null;
      const dismissedInARow = intIn(row.dismissedInARow, 0, 999);
      const ignoredInARow = intIn(row.ignoredInARow, 0, 999);
      if (dismissedInARow === null || ignoredInARow === null) return null;
      const suppressedUntil = row.suppressedUntil == null ? null : (isDay(row.suppressedUntil) ? row.suppressedUntil : undefined);
      if (suppressedUntil === undefined) return null;
      const suppressReason = typeof row.suppressReason === 'string' ? row.suppressReason.slice(0, 40) : '';
      capabilities[String(id)] = { dismissedInARow, ignoredInARow, suppressedUntil, suppressReason };
    }
    return { version: 2, offers, capabilities };
  }

  function intIn(v, min, max) {
    if (v == null) return 0;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) return null;
    return n;
  }

  function capRow(ledger, id) {
    const row = ledger.capabilities[id];
    return row || { dismissedInARow: 0, ignoredInARow: 0, suppressedUntil: null, suppressReason: '' };
  }

  function cooldownKeyOf(capabilityId, today) { return `${capabilityId}|${today}`; }

  /**
   * Действует ли долгая пауза по этому ходу. Отдельно от дневного cooldown:
   * cooldown — «сегодня уже говорили», suppression — «этот ход человеку не нужен».
   */
  function suppressionFor(ledger, capabilityId, today) {
    const cap = capabilityById(capabilityId);
    // Назначенное пользователем напоминание нельзя заглушить накопленным молчанием.
    if (cap && cap.userScheduled) return { suppressed: false, until: null, reason: '' };
    const base = sanitizeLedger(ledger) || emptyLedger();
    const row = capRow(base, capabilityId);
    if (!row.suppressedUntil || !isDay(today)) return { suppressed: false, until: null, reason: '' };
    const active = dayToEpoch(row.suppressedUntil) >= dayToEpoch(today);
    return { suppressed: active, until: active ? row.suppressedUntil : null, reason: active ? row.suppressReason : '' };
  }

  /**
   * Отметить исход. Возвращает новый ledger — модуль ничего не мутирует и не пишет.
   * `expired` — это «ход показали, но ответа не было»: отдельная серия, отдельная пауза.
   */
  function mark(ledger, offer, outcome, nowIso) {
    const base = sanitizeLedger(ledger);
    if (base === null) return { ok: false, error: ERRORS.LEDGER };
    if (!offer || typeof offer !== 'object' || !offer.cooldownKey || !offer.capabilityId) {
      return { ok: false, error: 'invalid_offer' };
    }
    if (OUTCOMES.indexOf(String(outcome)) < 0) return { ok: false, error: 'invalid_outcome' };
    if (parseIso(nowIso) === null) return { ok: false, error: ERRORS.TIME };
    const cap = capabilityById(offer.capabilityId);
    if (!cap) return { ok: false, error: 'unknown_capability' };

    const existing = base.offers[offer.cooldownKey];
    // Терминальные исходы не перезаписывают друг друга (v212 §7.3.6): повтор идемпотентен.
    if (existing && existing.offerId === offer.offerId && existing.state === String(outcome)) {
      return { ok: true, ledger: base, changed: false };
    }
    if (existing && existing.offerId !== offer.offerId) {
      // Один cooldownKey не занимается вторым offerId в тот же день (v212 §7.3.7).
      return { ok: false, error: 'cooldown_taken' };
    }
    if (existing && existing.state !== 'offered' && String(outcome) !== existing.state) {
      return { ok: false, error: 'terminal_state' };
    }

    const offers = Object.assign({}, base.offers);
    offers[offer.cooldownKey] = { offerId: offer.offerId, at: nowIso, state: String(outcome) };

    const row = Object.assign({}, capRow(base, cap.id));
    const day = offer.about && isDay(offer.about.day) ? offer.about.day : localParts(parseIso(nowIso), 0).day;
    if (cap.userScheduled) {
      // Исход записывается ради cooldown и честной истории, но серии не растут:
      // подавлять собственную настройку человека нечем.
      const capabilities = Object.assign({}, base.capabilities);
      capabilities[cap.id] = row;
      return { ok: true, ledger: { version: 2, offers, capabilities }, changed: true };
    }
    if (outcome === 'accepted') {
      row.dismissedInARow = 0; row.ignoredInARow = 0;
      row.suppressedUntil = null; row.suppressReason = '';
    } else if (outcome === 'dismissed') {
      row.dismissedInARow += 1; row.ignoredInARow = 0;
      if (row.dismissedInARow >= DISMISS_STREAK_LIMIT) {
        row.suppressedUntil = addDays(day, DISMISS_SUPPRESS_DAYS);
        row.suppressReason = 'repeatedly_not_useful';
      }
    } else if (outcome === 'expired') {
      row.ignoredInARow += 1;
      if (row.ignoredInARow >= IGNORE_STREAK_LIMIT) {
        row.suppressedUntil = addDays(day, IGNORE_SUPPRESS_DAYS);
        row.suppressReason = 'never_answered';
      }
    }
    const capabilities = Object.assign({}, base.capabilities);
    capabilities[cap.id] = row;
    return { ok: true, ledger: { version: 2, offers, capabilities }, changed: true };
  }

  /* ── Scope gate ──────────────────────────────────────────────────────────────
   * Единственная дверь между входом и логикой хода. Всё, что не объявлено в
   * `cap.scopes`, физически отсутствует внутри eligibility — включая `aiAvailable`,
   * чужие документы, заметки и данные другого пользователя. */
  function scopeInput(cap, input) {
    const out = {};
    for (const key of BASE_INPUTS) {
      if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
    }
    for (const scope of cap.scopes) {
      const keys = SCOPE_INPUTS[scope] || [];
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
      }
    }
    return out;
  }

  /** Проекция считается пригодной, только если она свежая. Иначе — `unknown`. */
  function fresh(projection, nowMs, maxStalenessMinutes) {
    if (!projection || typeof projection !== 'object') return false;
    const at = parseIso(projection.observedAt);
    if (at === null) return false;
    if (at > nowMs + 60000) return false;                       // из будущего — не данные
    return nowMs - at <= maxStalenessMinutes * 60000;
  }

  function refOf(v) {
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null;
  }

  /* ── Ход 1: запланированное начало работы ────────────────────────────────────
   * Ловит не «пора бы поработать», а конкретную сохранённую запись в её окне.
   * Известная срочность повышает уверенность, но НЕ создаёт ход из ничего: без
   * сохранённой записи ответ — молчание, а не «займись проектом». */
  function evalPlannedStart(cap, inp) {
    const plan = inp.plannedStart;
    if (!plan || typeof plan !== 'object') return { ok: false, code: REJECT.NO_SAVED_ENTRY };
    if (!fresh(plan, inp.nowMs, cap.maxStalenessMinutes)) return { ok: false, code: REJECT.STALE };
    const targetRef = refOf(plan.taskRef);
    if (!targetRef) return { ok: false, code: REJECT.NO_SAVED_ENTRY };
    if (plan.startedToday === true || plan.doneToday === true) return { ok: false, code: REJECT.ALREADY_STARTED };

    const plannedAt = hhmmToMinutes(plan.plannedAtLocal);
    if (plannedAt === null) return { ok: false, code: REJECT.MISSING };
    const delta = inp.localMinutes - plannedAt;
    if (delta < -10 || delta > cap.windowMinutes) return { ok: false, code: REJECT.OUTSIDE_WINDOW };

    // Точность источника — это и есть уверенность. Точное сохранённое время — факт;
    // «этот день недели» — только повод спросить, начинается ли работа сейчас.
    const exact = plan.precision === 'exact_time';
    let confidence = exact ? 0.8 : 0.5;
    const deadline = inp.externalDeadline;
    const urgent = !!deadline && fresh(deadline, inp.nowMs, cap.maxStalenessMinutes)
      && deadline.source === 'user_confirmed' && isDay(deadline.day)
      && dayToEpoch(deadline.day) <= dayToEpoch(inp.localDay);
    if (urgent && exact) confidence = 0.9;

    const minimum = minimumRef(inp);
    return {
      ok: true,
      basisKey: `plan|${targetRef}|${inp.localDay}`,
      confidence,
      reasonCode: urgent ? 'planned_start_due_soon' : 'planned_start_window',
      about: { day: inp.localDay, targetRef },
      action: { type: ACTIONS.TASK_OPEN, args: { targetRef, size: 'planned', day: inp.localDay } },
      copy: {
        eyebrowKey: 'secretary.v2.planned_start.eyebrow',
        titleKey: 'secretary.v2.planned_start.title',
        bodyKey: urgent ? 'secretary.v2.planned_start.body.due_soon' : 'secretary.v2.planned_start.body.window',
        reasonKey: `secretary.v2.reason.${urgent ? 'planned_start_due_soon' : 'planned_start_window'}`,
      },
      primaryLabelKey: 'secretary.v2.planned_start.open',
      questionKey: 'secretary.v2.planned_start.question',
      alternatives: minimum
        ? [{
          id: 'minimum',
          labelKey: 'secretary.v2.common.do_minimum',
          action: { type: ACTIONS.TASK_OPEN, args: { targetRef: minimum.ref, size: 'minimum', day: inp.localDay } },
        }]
        : [],
      quote: quoteFromCommitments(inp.commitmentItems, ['step', 'edge']),
    };
  }

  /* ── Ход 2: завершение вечера ────────────────────────────────────────────────
   * Подводит к границе, которую человек выбрал сам, и задаёт ОДИН вопрос о
   * контексте. Он не закрывает день (`closesDay:false` — инвариант, тест) и не
   * планирует завтра: планирование завтра — другая работа и другой релиз (S4). */
  function evalEveningClose(cap, inp) {
    const cfg = inp.eveningContract;
    if (!cfg || typeof cfg !== 'object') return { ok: false, code: REJECT.MISSING };
    if (!fresh(cfg, inp.nowMs, cap.maxStalenessMinutes)) return { ok: false, code: REJECT.STALE };
    // Граница берётся только из подтверждённой настройки. Угадывать вечер человека
    // по активности — ровно тот вывод без данных, который запрещён.
    if (cfg.configured !== true) return { ok: false, code: REJECT.NOT_CONFIGURED };
    const boundary = hhmmToMinutes(cfg.eveningTimeLocal);
    if (boundary === null) return { ok: false, code: REJECT.NOT_CONFIGURED };

    // Известное вечернее занятие (тренировка, смена, встреча) сдвигает разговор:
    // звать «завершать вечер» посреди подтверждённой тренировки — не забота.
    const sched = inp.tonightSchedule;
    if (sched && fresh(sched, inp.nowMs, cap.maxStalenessMinutes)) {
      const busyUntil = hhmmToMinutes(sched.busyUntilLocal);
      if (busyUntil !== null && inp.localMinutes < busyUntil) {
        return { ok: false, code: REJECT.BUSY_UNTIL_KNOWN_COMMITMENT };
      }
    }

    const delta = inp.localMinutes - boundary;
    if (delta < 0 || delta > cap.windowMinutes) return { ok: false, code: REJECT.OUTSIDE_WINDOW };

    const rest = restRef(inp);
    return {
      ok: true,
      basisKey: `evening|${inp.localDay}|${cfg.eveningTimeLocal}`,
      confidence: 0.85,
      reasonCode: 'evening_boundary_reached',
      about: { day: inp.localDay, targetRef: null },
      action: { type: ACTIONS.EVENING_TRANSITION, args: { day: inp.localDay, boundaryLocal: cfg.eveningTimeLocal } },
      copy: {
        eyebrowKey: 'secretary.v2.evening.eyebrow',
        titleKey: 'secretary.v2.evening.title',
        bodyKey: 'secretary.v2.evening.body',
        reasonKey: 'secretary.v2.reason.evening_boundary_reached',
      },
      primaryLabelKey: 'secretary.v2.evening.open_transition',
      // Один вопрос о контексте, а не анкета и не оценка дня.
      contextQuestionKey: 'secretary.v2.evening.context_question',
      boundary: { atLocal: cfg.eveningTimeLocal },
      alternatives: rest
        ? [{
          id: 'finite-rest',
          labelKey: 'secretary.v2.common.finite_rest',
          action: { type: ACTIONS.REST_START, args: { activityRef: rest.ref, minutes: rest.minutes, day: inp.localDay } },
        }]
        : [],
      quote: null,
    };
  }

  /* ── Ход 3: возвращение после подтверждённого выпадения ──────────────────────
   * Срабатывает ТОЛЬКО на подтверждённое событие: собственная отметка человека или
   * измеренная граница. Тишина, отсутствие телеметрии и «давно не заходил» сюда не
   * попадают ни при каких условиях.
   *
   * Событие остаётся событием. Никакого «ты зависим», «ты выгорел», «опять» —
   * ни в reasonCode, ни в ключах копии. Из двух веток выбирается ровно одна:
   * минимум по ИСХОДНОМУ делу, если оно ещё живое, иначе конечный отдых. */
  function evalAfterLapseReturn(cap, inp) {
    const lapse = inp.lapse;
    if (!lapse || typeof lapse !== 'object') return { ok: false, code: REJECT.MISSING };
    if (!fresh(lapse, inp.nowMs, cap.maxStalenessMinutes)) return { ok: false, code: REJECT.STALE };
    if (lapse.confirmed !== true) return { ok: false, code: REJECT.NOT_CONFIRMED };
    const source = String(lapse.source || '');
    if (source !== 'user_confirmed' && source !== 'boundary_measured') return { ok: false, code: REJECT.NOT_CONFIRMED };
    const basisKey = refOf(lapse.eventKey);
    if (!basisKey || !isDay(lapse.day)) return { ok: false, code: REJECT.MISSING };

    const endedAt = parseIso(lapse.endedAt);
    if (endedAt === null) return { ok: false, code: REJECT.MISSING };
    if (inp.nowMs < endedAt) return { ok: false, code: REJECT.OUTSIDE_WINDOW };
    if (inp.nowMs - endedAt > cap.windowMinutes * 60000) return { ok: false, code: REJECT.OUTSIDE_WINDOW };

    const baseConfidence = source === 'user_confirmed' ? 0.9 : 0.8;
    // Минимум по исходному делу: сначала явная ссылка на дело, потом двухминутная
    // версия привычки (`habit.atomic.twoMin`), потом уговор-«шаг».
    const minimum = originalMinimumRef(inp, lapse);
    const rest = restRef(inp, { preferOffline: lapse.screenEpisode === true });

    // Если человек уже за своей собственной вечерней границей, звать обратно в дело
    // нельзя даже минимумом: сон важнее новой сессии. Граница берётся только из его
    // подтверждённой настройки — своего «позднего часа» модуль не выдумывает.
    const cfg = inp.eveningContract;
    let pastOwnEvening = false;
    if (cfg && typeof cfg === 'object' && fresh(cfg, inp.nowMs, cap.maxStalenessMinutes) && cfg.configured === true) {
      const boundary = hhmmToMinutes(cfg.eveningTimeLocal);
      if (boundary !== null && inp.localMinutes >= boundary) pastOwnEvening = true;
    }

    if (minimum && !pastOwnEvening) {
      return {
        ok: true,
        basisKey,
        confidence: baseConfidence,
        reasonCode: source === 'user_confirmed' ? 'return_after_confirmed_escape' : 'return_after_measured_boundary',
        about: { day: inp.localDay, targetRef: minimum.ref, basisDay: lapse.day },
        action: { type: ACTIONS.TASK_OPEN, args: { targetRef: minimum.ref, size: 'minimum', day: inp.localDay } },
        copy: {
          eyebrowKey: 'secretary.v2.return.eyebrow',
          titleKey: 'secretary.v2.return.title.minimum',
          bodyKey: 'secretary.v2.return.body.minimum',
          reasonKey: 'secretary.v2.reason.return_after_confirmed',
        },
        primaryLabelKey: 'secretary.v2.return.start_minimum',
        questionKey: 'secretary.v2.return.question',
        alternatives: rest
          ? [{
            id: 'finite-rest',
            labelKey: 'secretary.v2.common.finite_rest',
            action: { type: ACTIONS.REST_START, args: { activityRef: rest.ref, minutes: rest.minutes, day: inp.localDay } },
          }]
          : [],
        quote: quoteFromCommitments(inp.commitmentItems, ['step', 'care', 'anchor']),
      };
    }

    if (rest) {
      return {
        ok: true,
        basisKey,
        confidence: baseConfidence,
        reasonCode: source === 'user_confirmed' ? 'return_after_confirmed_escape' : 'return_after_measured_boundary',
        about: { day: inp.localDay, targetRef: rest.ref, basisDay: lapse.day },
        action: { type: ACTIONS.REST_START, args: { activityRef: rest.ref, minutes: rest.minutes, day: inp.localDay } },
        copy: {
          eyebrowKey: 'secretary.v2.return.eyebrow',
          titleKey: 'secretary.v2.return.title.rest',
          bodyKey: 'secretary.v2.return.body.rest',
          reasonKey: 'secretary.v2.reason.return_after_confirmed',
        },
        primaryLabelKey: 'secretary.v2.return.start_rest',
        questionKey: 'secretary.v2.return.question',
        // Отдых конечен по построению: у него есть минуты и посчитанный конец.
        finite: { minutes: rest.minutes, endsAtLocal: minutesToHhmm(inp.localMinutes + rest.minutes) },
        alternatives: [],
        quote: null,
      };
    }

    // Ни живого дела, ни рецепта отдыха — значит данных на ход нет. Тогда один
    // фактический вопрос, а не придуманное занятие и не вывод о человеке.
    return {
      ok: true,
      basisKey,
      confidence: 0.5,
      reasonCode: 'return_needs_one_answer',
      about: { day: inp.localDay, targetRef: null, basisDay: lapse.day },
      action: { type: ACTIONS.ASK_ONE, args: { day: inp.localDay, questionId: 'return_next_smallest' } },
      copy: {
        eyebrowKey: 'secretary.v2.return.eyebrow',
        titleKey: 'secretary.v2.return.title.ask',
        bodyKey: null,
        reasonKey: 'secretary.v2.reason.return_needs_one_answer',
      },
      primaryLabelKey: 'secretary.v2.return.answer',
      questionKey: 'secretary.v2.return.question',
      alternatives: [],
      quote: null,
    };
  }

  /** Минимум по исходному делу выпадения. Порядок: явное дело → привычка → уговор-шаг. */
  function originalMinimumRef(inp, lapse) {
    const explicit = refOf(lapse.originalRef);
    if (explicit && lapse.originalStillActionable === true) return { ref: explicit, from: 'lapse.originalRef' };
    return minimumRef(inp);
  }

  function minimumRef(inp) {
    const habit = inp.habitMinimum;
    if (habit && typeof habit === 'object' && fresh(habit, inp.nowMs, 24 * 60)) {
      const ref = refOf(habit.habitRef);
      // Двухминутная версия обязана существовать: «минимум» без записанного минимума
      // — это снова просьба придумать его в худший момент.
      if (ref && typeof habit.twoMin === 'string' && habit.twoMin.trim()) {
        return { ref, from: 'habit.atomic.twoMin' };
      }
    }
    const items = Array.isArray(inp.commitmentItems) ? inp.commitmentItems : [];
    const step = items.find((i) => i && i.kind === 'step' && refOf(i.id));
    if (step) return { ref: refOf(step.id), from: 'commitment.step' };
    const plan = inp.plannedStart;
    if (plan && typeof plan === 'object' && refOf(plan.minimumRef)) {
      return { ref: refOf(plan.minimumRef), from: 'plannedStart.minimumRef' };
    }
    return null;
  }

  /** Конечный отдых из подтверждённого личного меню. Пустое меню = null, не выдумка. */
  function restRef(inp, opts) {
    const menu = inp.restMenu;
    if (!menu || typeof menu !== 'object') return null;
    if (!fresh(menu, inp.nowMs, 24 * 60)) return null;
    const ref = refOf(menu.recipeRef);
    if (!ref) return null;
    const minutes = Number(menu.minutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) return null;
    if (opts && opts.preferOffline && menu.screenMode === 'screen') return null;
    return { ref, minutes };
  }

  /**
   * Слова самого человека. Только из его собственных живых уговоров — они account-owned
   * и написаны им. Ничего из заметок, документов, AI и чужого текста сюда не попадает.
   */
  function quoteFromCommitments(items, kinds) {
    if (!Array.isArray(items)) return null;
    for (const kind of kinds) {
      const hit = items.find((i) => i && i.kind === kind && typeof i.title === 'string' && i.title.trim() && refOf(i.id));
      if (hit) {
        return {
          id: refOf(hit.id),
          title: String(hit.title).slice(0, 80),
          win: typeof hit.win === 'string' ? String(hit.win).slice(0, 120) : '',
          source: 'own_commitment',
        };
      }
    }
    return null;
  }

  const EVALUATORS = Object.freeze({
    'planned-start': evalPlannedStart,
    'evening-close': evalEveningClose,
    'after-lapse-return': evalAfterLapseReturn,
  });

  function pickChannel(cap, available, preferred) {
    const pool = Array.isArray(available) ? available.filter((c) => CHANNEL_ORDER.indexOf(c) >= 0) : [];
    const allowed = pool.filter((c) => cap.allowedChannels.indexOf(c) >= 0);
    if (!allowed.length) return null;
    if (preferred && allowed.indexOf(preferred) >= 0) return preferred;
    for (const c of CHANNEL_ORDER) if (allowed.indexOf(c) >= 0) return c;
    return null;
  }

  /** Строгое чтение флага-блокировки: true/false, либо null = вход неисправен. */
  function strictFlag(container, key) {
    if (container == null) return false;
    if (typeof container !== 'object' || Array.isArray(container)) return null;
    if (!Object.prototype.hasOwnProperty.call(container, key)) return false;
    if (typeof container[key] !== 'boolean') return null;
    return container[key];
  }

  function band(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= ASK_BELOW) return 'medium';
    return 'low';
  }

  /**
   * Выбор одного хода.
   *
   * @param {object} input — см. README §2. Всё время приходит параметром.
   * @returns {{ok:true, offer:object|null, silence:object|null, trace:Array}|{ok:false,error:string}}
   */
  function decide(input) {
    const inp = input && typeof input === 'object' ? input : {};

    const nowMs = parseIso(inp.now);
    if (nowMs === null) return { ok: false, error: ERRORS.TIME };
    const offset = Number(inp.utcOffsetMinutes);
    if (!Number.isInteger(offset) || offset < -840 || offset > 840) return { ok: false, error: ERRORS.OFFSET };
    if (INVOCATIONS.indexOf(String(inp.invocation)) < 0) return { ok: false, error: ERRORS.INVOCATION };

    const local = localParts(nowMs, offset);
    // `today` обязателен и обязан совпасть с локальным днём: расхождение означает,
    // что адаптер посчитал день иначе, и молча выбирать чей-то вариант нельзя.
    if (!isDay(inp.today)) return { ok: false, error: ERRORS.DAY };
    if (inp.today !== local.day) return { ok: false, error: ERRORS.DAY };

    const ledger = sanitizeLedger(inp.ledger);
    if (ledger === null) return { ok: false, error: ERRORS.LEDGER };

    // Runtime rollout may enable one complete capability without losing the
    // evening projection that protects sleep inside after-lapse-return.
    const enabled = inp.enabledCapabilities === undefined ? CAPABILITY_IDS : inp.enabledCapabilities;
    if (!Array.isArray(enabled) || enabled.some((id) => CAPABILITY_IDS.indexOf(id) < 0)
      || new Set(enabled).size !== enabled.length) return { ok: false, error: 'invalid_capabilities' };

    const available = Array.isArray(inp.availableChannels) ? inp.availableChannels : [];
    if (!available.length) return { ok: false, error: ERRORS.CHANNELS };

    if (inp.dayClosed !== undefined && typeof inp.dayClosed !== 'boolean') return { ok: false, error: ERRORS.DAY_STATE };

    const trace = [];
    const silence = (reason) => ({ ok: true, offer: null, silence: { reason }, trace: Object.freeze(trace) });

    // Жёсткие блокировки. Они выше любого приоритета: пока идёт сессия, ведёт Гайд
    // или человек ещё не получил первую ценность, второй голос — это помеха.
    // Нечёткий флаг («yes», 1, «false») — это ошибка адаптера, а не «блокировки нет»:
    // молча считать его отсутствием значило бы заговорить поверх активной сессии.
    const session = strictFlag(inp.activeSession, 'active');
    const guide = strictFlag(inp.guide, 'active');
    const firstValue = strictFlag(inp.firstValue, 'pending');
    if (session === null || guide === null || firstValue === null) return { ok: false, error: ERRORS.FLAG };
    // Гайд и первая ценность — короткие обучающие контуры; их перебивать нечем и незачем.
    if (guide) return silence(SILENCE.GUIDE_ACTIVE);
    if (firstValue) return silence(SILENCE.FIRST_VALUE_PENDING);

    /* Активная сессия и закрытый день глушат СОВЕТЫ секретаря, но не назначенное
     * человеком напоминание. «День уже закрыл, а работаю дальше» — это ровно тот
     * случай, ради которого вечерняя граница и существует; молчать в нём значит
     * отменить его собственную настройку в самый нужный момент.
     *
     * Но и перебивать работу нельзя: пока идёт сессия, ход не прерывает её, а ждёт
     * её конца (`interrupt:false`, `deferUntil:'session_end'`). Доставку выбирает UI. */
    const scheduledOnly = session || inp.dayClosed === true;
    const blockedReason = session ? SILENCE.SESSION_ACTIVE : SILENCE.DAY_CLOSED;

    const enriched = Object.assign({}, inp, { nowMs, localMinutes: local.minutes, localDay: local.day });

    const winners = [];
    let anySuppressed = false;
    for (const cap of CAPABILITIES) {
      if (enabled.indexOf(cap.id) < 0) continue;
      if (scheduledOnly && !cap.userScheduled) {
        trace.push(Object.freeze({ capabilityId: cap.id, decision: 'rejected', code: REJECT.NOT_USER_SCHEDULED }));
        continue;
      }
      const cooldownKey = cooldownKeyOf(cap.id, local.day);
      if (ledger.offers[cooldownKey]) {
        trace.push(Object.freeze({ capabilityId: cap.id, decision: 'rejected', code: REJECT.COOLDOWN }));
        continue;
      }
      const supp = suppressionFor(ledger, cap.id, local.day);
      if (supp.suppressed) {
        anySuppressed = true;
        trace.push(Object.freeze({ capabilityId: cap.id, decision: 'rejected', code: REJECT.SUPPRESSED }));
        continue;
      }
      const channel = pickChannel(cap, available, inp.preferredChannel);
      if (!channel) {
        trace.push(Object.freeze({ capabilityId: cap.id, decision: 'rejected', code: REJECT.NO_CHANNEL }));
        continue;
      }
      const scoped = scopeInput(cap, enriched);
      const res = EVALUATORS[cap.id](cap, scoped);
      if (!res.ok) {
        trace.push(Object.freeze({ capabilityId: cap.id, decision: 'rejected', code: res.code }));
        continue;
      }
      winners.push({ cap, channel, res });
    }

    if (!winners.length) {
      if (scheduledOnly) return silence(blockedReason);
      return silence(anySuppressed ? SILENCE.ALL_SUPPRESSED : SILENCE.NOTHING_ELIGIBLE);
    }

    // Разрешение конфликта. Правило имени, а не только числа: если человек уже у
    // своей вечерней границы, возвращение в дело уступает — сон важнее новой сессии.
    const evening = winners.find((w) => w.cap.id === 'evening-close');
    let pool = winners;
    if (evening && winners.length > 1) {
      pool = [evening];
      for (const w of winners) {
        if (w.cap.id !== 'evening-close') {
          trace.push(Object.freeze({ capabilityId: w.cap.id, decision: 'rejected', code: REJECT.DEFERRED_TO_EVENING }));
        }
      }
    }
    pool = pool.slice().sort((a, b) => (b.cap.priority - a.cap.priority) || (a.cap.id < b.cap.id ? -1 : 1));
    const win = pool[0];
    for (let i = 1; i < pool.length; i += 1) {
      trace.push(Object.freeze({ capabilityId: pool[i].cap.id, decision: 'rejected', code: REJECT.LOST_PRIORITY }));
    }

    return { ok: true, offer: buildOffer(win, enriched, local, { session }), silence: null, trace: Object.freeze(trace) };
  }

  function buildOffer(win, inp, local, state) {
    const { cap, channel, res } = win;
    const sessionActive = !!(state && state.session);
    const ask = res.confidence < ASK_BELOW;
    const action = ask
      ? { type: ACTIONS.ASK_ONE, args: { day: local.day, questionId: `${cap.id}_confirm` } }
      : res.action;
    const offerId = `${cap.id}|${local.day}|${res.basisKey}`;
    // Альтернатива не должна повторять primary. Сравнивается не только тип действия:
    // «открыть дело» и «открыть его минимум» — один тип, но разные ходы.
    const sameAsPrimary = (a) => a.action.type === action.type
      && JSON.stringify(a.action.args || null) === JSON.stringify(action.args || null);
    const alternatives = (res.alternatives || [])
      .filter((a) => a && a.action && !sameAsPrimary(a))
      .slice(0, 2)
      .map((a) => Object.freeze({ id: a.id, labelKey: a.labelKey, action: Object.freeze(a.action), disclosure: true }));

    return Object.freeze({
      version: 2,
      offerId,
      capabilityId: cap.id,
      pain: cap.pain,
      action: Object.freeze(action),
      channel,
      mode: ask ? 'ask' : 'offer',
      confidence: res.confidence,
      confidenceBand: band(res.confidence),
      reasonCode: res.reasonCode,
      about: Object.freeze(Object.assign({ basisKey: res.basisKey }, res.about)),
      quote: res.quote ? Object.freeze(res.quote) : null,
      copy: Object.freeze({
        eyebrowKey: res.copy.eyebrowKey,
        titleKey: res.copy.titleKey,
        bodyKey: ask ? null : (res.copy.bodyKey || null),
        questionKey: ask ? (res.questionKey || null) : (res.contextQuestionKey || null),
        reasonKey: res.copy.reasonKey,
      }),
      primary: Object.freeze({
        id: 'primary',
        labelKey: ask ? 'secretary.v2.common.answer_one' : res.primaryLabelKey,
        action: Object.freeze(action),
      }),
      alternatives: Object.freeze(alternatives),
      dismiss: Object.freeze({
        id: 'dismiss',
        labelKey: 'common.not_now',
        action: Object.freeze({ type: 'secretary_offer_dismiss', args: Object.freeze({ offerId }) }),
      }),
      boundary: res.boundary ? Object.freeze(res.boundary) : null,
      finite: res.finite ? Object.freeze(res.finite) : null,
      // Ход никогда не закрывает день сам и не планирует завтра: это другая работа.
      closesDay: false,
      plansTomorrow: false,
      // Пока идёт сессия, ход существует, но не перебивает её.
      interrupt: !sessionActive,
      deferUntil: sessionActive ? 'session_end' : null,
      safetyTier: cap.safetyTier,
      scopes: cap.scopes,
      cooldownKey: cooldownKeyOf(cap.id, local.day),
      expiresAt: isoFromEpoch(inp.nowMs + cap.windowMinutes * 60000),
    });
  }

  /**
   * Совместимость с тем, что реально задеплоено. Возвращает offer в форме черновика
   * `secretary-router-v1.js` — либо честный отказ, если действие в v1 не существует.
   * Это исполняемая часть таблицы совместимости из README §6.
   */
  function toLegacyOfferV1(offer) {
    if (!offer || typeof offer !== 'object' || Number(offer.version) !== 2) {
      return { ok: false, error: 'invalid_offer' };
    }
    if (V212_ACTIONS.indexOf(offer.action.type) < 0) {
      return { ok: false, error: 'action_not_in_v1', action: offer.action.type };
    }
    return {
      ok: true,
      offer: Object.freeze({
        offerId: offer.offerId,
        capability: offer.capabilityId,
        action: offer.action.type,
        channels: Object.freeze([offer.channel]),
        confidence: offer.confidence,
        askOnly: offer.mode === 'ask',
        reason: offer.reasonCode,
        about: Object.freeze({ day: offer.about.day, eventKey: offer.about.basisKey }),
        quote: offer.quote ? Object.freeze({ id: offer.quote.id, title: offer.quote.title, win: offer.quote.win }) : null,
        cooldownKey: offer.cooldownKey,
      }),
    };
  }

  return Object.freeze({
    VERSION,
    ACTIONS, ACTION_LIST, V212_ACTIONS, PROPOSED_ACTIONS,
    CHANNEL_ORDER, INVOCATIONS, OUTCOMES,
    ERRORS, SILENCE, REJECT, SCOPES, SCOPE_INPUTS, BASE_INPUTS,
    CAPABILITIES, CAPABILITY_IDS, capabilityById,
    ASK_BELOW, DISMISS_STREAK_LIMIT, DISMISS_SUPPRESS_DAYS, IGNORE_STREAK_LIMIT, IGNORE_SUPPRESS_DAYS,
    isDay, addDays, parseIso, isoFromEpoch, localParts, hhmmToMinutes, minutesToHhmm,
    emptyLedger, sanitizeLedger, suppressionFor, cooldownKeyOf, mark,
    scopeInput, decide, toLegacyOfferV1,
  });
});
