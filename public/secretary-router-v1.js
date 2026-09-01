/* Satoru Secretary Router v1 (Lite) — один ход вместо восьми кнопок.
 *
 * SECRETARY-OS-PAIN-MAP §7 требует центр, который сам выбирает ОДИН уместный ход.
 * Это его первая, намеренно узкая версия: детерминированная, без ИИ, с одной
 * реально работающей capability — утренним перехватом.
 *
 * Почему именно утро. Разбор 01.09: в истории владельца два разных провала.
 * Вечерний (отдых без конца, финиш в три ночи) происходит при нулевом ресурсе и
 * почти недостижим. А утренний — это осознанное решение «день уже потерян, буду
 * играть весь день», принятое на свежую голову. Оно дороже: превращает одну плохую
 * ночь в два потерянных дня. И оно **достижимо**, потому что человек в этот момент
 * не спит, соображает и формулирует. Router начинается с него не по простоте,
 * а потому что это единственная точка с доказанной достижимостью.
 *
 * ⚠️ Правила, без которых Router становится вредным:
 *
 *  — **Максимум один победитель.** Второй по приоритету не показывается «заодно».
 *    Метрика продукта: параллельных предложений ≤1, поверхностей на Today ≤1.
 *  — **Молчание — законный исход.** `null` возвращается чаще, чем ход, и это норма.
 *  — **Низкая уверенность → вопрос, а не вывод.** Ход с `confidence < ASK_BELOW`
 *    обязан быть вопросом об одном факте, а не утверждением о человеке.
 *  — **Dismiss — это данные.** Отклонённое не повторяется внутри cooldown; повтор
 *    внутри cooldown — ноль по метрике.
 *  — **Идемпотентность.** Один и тот же повод не рождает два хода: ключ повода
 *    входит в `offerId`, а доставленные ключи хранятся в ledger.
 *  — **Никаких диагнозов, стыда и наказаний.** Router не называет день срывом, не
 *    считает XP и не трогает серию. Здесь нет функции, к которой это подключается.
 *  — **Router не исполняет.** Он выбирает и отдаёт карточку с `action` из закрытого
 *    словаря. Исполняет action engine, у которого свои гейты.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State/времени сам —
 * «сейчас» всегда приходит параметром, иначе тесты и сервер разъедутся с клиентом.
 */
(function exposeSecretaryRouter(root, factory) {
  const Events = root && root.SecretaryEventsV1
    ? root.SecretaryEventsV1
    : (typeof require === 'function' ? require('./secretary-events-v1.js') : null);
  const api = factory(Events);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryRouterV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSecretaryRouter(Events) {
  'use strict';

  const VERSION = '1.0.0';

  /* Закрытый словарь действий. Router может предложить только то, что здесь.
   * Всё разрушительное, платёжное, социальное и публикационное отсутствует
   * намеренно и не добавляется «на время». */
  const ACTIONS = Object.freeze({
    RECOVERY_DAY: 'recovery_day_open',       // открыть День восстановления
    REST_START: 'rest_start_prepared',       // запустить заранее подготовленный отдых
    EVENING_START: 'evening_transition_open', // начать вечерний переход
    ASK_ONE: 'ask_one_question',             // задать ровно один вопрос
  });
  const ACTION_LIST = Object.freeze(Object.keys(ACTIONS).map((k) => ACTIONS[k]));

  const CHANNELS = Object.freeze(['card', 'push', 'extension', 'voice']);

  // Исходы предложения. Вынесены в контракт: сервер обязан проверять статус тем же
  // списком, что и модуль, иначе появится второй источник правды и они разойдутся.
  const OFFER_STATES = Object.freeze(['offered', 'accepted', 'dismissed']);

  // Ниже этого порога ход обязан быть вопросом, а не утверждением.
  const ASK_BELOW = 0.6;
  // Утро: окно, в котором перехват вообще уместен. Позже человек уже внутри дня.
  const MORNING_FROM = 5;
  const MORNING_TO = 13;

  function isDay(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
  function prevDay(day) {
    const ms = Date.parse(`${day}T00:00:00Z`);
    return new Date(ms - 86400000).toISOString().slice(0, 10);
  }
  function hourOf(nowIso, tzOffsetMinutes) {
    const ms = Date.parse(nowIso);
    if (!Number.isFinite(ms)) return -1;
    const shifted = ms + (Number(tzOffsetMinutes) || 0) * 60000;
    return new Date(shifted).getUTCHours();
  }

  /* ── Реестр capability ───────────────────────────────────────────────────────
   * Машиночитаемый, как требует §7. Каждая запись отвечает на: когда срабатывает,
   * что ей нужно, что предлагает, как часто может повторяться. */
  const CAPABILITIES = Object.freeze([
    Object.freeze({
      id: 'morning-after-overrun',
      priority: 100,
      cooldown: 'once_per_local_day',
      action: ACTIONS.RECOVERY_DAY,
      channels: Object.freeze(['card', 'push']),
      // Нужен вчерашний повод и утро сегодня. Без повода не срабатывает никогда:
      // предлагать День восстановления просто так — значит объявить день плохим.
      needs: Object.freeze(['yesterdayTrouble', 'morningWindow']),
    }),
  ]);

  function emptyLedger() { return { version: 1, delivered: {} }; }

  function sanitizeLedger(raw) {
    if (!raw || typeof raw !== 'object' || Number(raw.version) !== 1) return null;
    if (!raw.delivered || typeof raw.delivered !== 'object' || Array.isArray(raw.delivered)) return null;
    const delivered = {};
    for (const k in raw.delivered) {
      const row = raw.delivered[k];
      if (!row || typeof row !== 'object') return null;
      const at = typeof row.at === 'string' && !isNaN(Date.parse(row.at)) ? row.at : '';
      const state = OFFER_STATES.indexOf(String(row.state)) >= 0 ? String(row.state) : '';
      if (!at || !state) return null;
      delivered[String(k).slice(0, 160)] = { at, state };
    }
    return { version: 1, delivered };
  }

  /**
   * Вчерашний повод. Возвращает сам повод и уверенность, а не «был срыв» —
   * слово «срыв» здесь не появляется намеренно: система не ставит диагноз.
   *
   * Уверенность разная по природе сигнала. Явное «меня унесло» сказал человек —
   * это факт о нём, уверенность высокая. Превышение границы измерено — тоже высокая.
   * Тишина не значит ничего сама по себе, поэтому её уверенность ниже порога вопроса.
   */
  function yesterdayTrouble(log, today) {
    if (!Events || !isDay(today)) return null;
    const day = prevDay(today);
    const events = Events.onDay(log, day);
    const pick = (type) => events.find((e) => e.type === type) || null;

    const escaped = pick(Events.TYPES.ATTENTION_ESCAPED);
    if (escaped) return { day, reason: 'escaped', confidence: 0.9, event: escaped };

    const overran = pick(Events.TYPES.ATTENTION_OVERRAN);
    if (overran) return { day, reason: 'overran', confidence: 0.8, event: overran };

    const late = pick(Events.TYPES.EVENING_LATE);
    if (late) return { day, reason: 'late', confidence: 0.7, event: late };

    const silent = pick(Events.TYPES.DAY_SILENT);
    // Тишина — повод спросить, а не вывод. Ниже ASK_BELOW осознанно.
    if (silent) return { day, reason: 'silent', confidence: 0.4, event: silent };

    return null;
  }

  function inMorning(nowIso, tzOffsetMinutes) {
    const h = hourOf(nowIso, tzOffsetMinutes);
    return h >= MORNING_FROM && h < MORNING_TO;
  }

  /**
   * Слова самого человека для этого хода. Берутся из уговоров (`commitment-v1`) и
   * НЕ выдумываются: если подходящего уговора нет, возвращается null, и вызывающий
   * обязан показать вариант без цитаты.
   *
   * Смысл в том, что власть над человеком имеет его собственное решение, принятое
   * в ресурсном состоянии, а не совет приложения.
   */
  function ownWords(commitments) {
    if (!commitments || !Array.isArray(commitments.items)) return null;
    const live = commitments.items.filter((i) => i && !i.archived && i.title);
    if (!live.length) return null;
    // Уговор про подъём/вечер ближе всего к утреннему разговору; иначе любой живой.
    const anchor = live.find((i) => i.kind === 'anchor') || live.find((i) => i.kind === 'edge') || live[0];
    return { id: anchor.id, title: String(anchor.title), win: anchor.win ? String(anchor.win) : '' };
  }

  function cooldownKey(capabilityId, today) { return `${capabilityId}|${today}`; }

  function isCoolingDown(ledger, capabilityId, today) {
    const base = ledger && ledger.delivered ? ledger : emptyLedger();
    return !!base.delivered[cooldownKey(capabilityId, today)];
  }

  /**
   * Выбор одного хода. Возвращает карточку или null.
   *
   * @param {object} input
   *  - now: ISO, обязателен (модуль не читает часы сам)
   *  - today: YYYY-MM-DD в локальном дне пользователя
   *  - tzOffsetMinutes: сдвиг локального времени от UTC
   *  - events: журнал событий
   *  - ledger: что уже доставлено
   *  - commitments: состояние `commitment-v1` (может отсутствовать)
   *  - dayClosed: закрыт ли сегодняшний день
   * @returns {object|null}
   */
  function next(input) {
    const inp = input || {};
    if (!isDay(inp.today) || typeof inp.now !== 'string') return null;
    const ledger = sanitizeLedger(inp.ledger) || emptyLedger();

    for (let i = 0; i < CAPABILITIES.length; i += 1) {
      const cap = CAPABILITIES[i];
      if (isCoolingDown(ledger, cap.id, inp.today)) continue;

      if (cap.id === 'morning-after-overrun') {
        if (!inMorning(inp.now, inp.tzOffsetMinutes)) continue;
        const trouble = yesterdayTrouble(inp.events, inp.today);
        if (!trouble) continue;
        const quote = ownWords(inp.commitments);
        const askOnly = trouble.confidence < ASK_BELOW;
        return Object.freeze({
          offerId: `${cap.id}|${inp.today}|${trouble.event.key}`,
          capability: cap.id,
          // Ниже порога уверенности предлагаем не план, а один вопрос.
          action: askOnly ? ACTIONS.ASK_ONE : cap.action,
          channels: cap.channels,
          confidence: trouble.confidence,
          askOnly,
          reason: trouble.reason,
          about: { day: trouble.day, eventKey: trouble.event.key },
          // Цитата опциональна. Её отсутствие — не повод молчать и не повод выдумывать.
          quote,
          cooldownKey: cooldownKey(cap.id, inp.today),
        });
      }
    }
    return null;
  }

  /** Отметить доставку/исход. Возвращает новый ledger — модуль ничего не мутирует. */
  function mark(ledger, offer, state, nowIso) {
    const base = sanitizeLedger(ledger) || emptyLedger();
    if (!offer || !offer.cooldownKey) return base;
    if (OFFER_STATES.indexOf(String(state)) < 0) return base;
    const at = typeof nowIso === 'string' && !isNaN(Date.parse(nowIso)) ? nowIso : new Date().toISOString();
    const delivered = Object.assign({}, base.delivered);
    delivered[offer.cooldownKey] = { at, state: String(state) };
    return { version: 1, delivered };
  }

  return Object.freeze({
    VERSION, ACTIONS, ACTION_LIST, CHANNELS, OFFER_STATES, CAPABILITIES,
    ASK_BELOW, MORNING_FROM, MORNING_TO,
    emptyLedger, sanitizeLedger, yesterdayTrouble, ownWords,
    isCoolingDown, next, mark,
  });
});
