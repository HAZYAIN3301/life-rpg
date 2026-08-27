/* Satoru Founder Pass v1 — Фаза 0 из MONETIZATION-VALIDATION-BRIEF.
 *
 * Отвечает на один вопрос: **захочет ли кто-нибудь платить**, и отвечает на него
 * БЕЗ платёжного провайдера, счёта и фискального потока. Записка прямо разрешает
 * такой ход: «лендинг, лист ожидания, демо и трекинг событий; на этой фазе не
 * нужен ни платёжный провайдер, ни фискальный поток».
 *
 * Главное правило, из-за которого модуль вообще устроен так, а не иначе:
 *
 *   «Платная кнопка должна либо принимать реальную оплату, либо прямо говорить,
 *    что это опрос интереса к цене и деньги не будут списаны.»
 *
 * Поэтому здесь НЕТ ничего, что имитирует checkout. Это опрос с ценой на экране,
 * и цена показывается настоящая — та, по которой предложение потом и откроется.
 *
 * ⚠️ Три решения, которые легко испортить при доработке:
 *
 * 1. **Отбор.** Предложение видят не все. Человек, который завёл аккаунт и ничего
 *    не сделал, о готовности платить не сообщает ничего — его «да» и его «нет»
 *    одинаково бессодержательны. Записка: «первых 50–100 ПОДХОДЯЩИХ альфа-
 *    пользователей». Отсюда `eligibility()`: нужны реальные дни и реальные дела.
 *
 * 2. **Честный счётчик.** `slotsLeft()` возвращает настоящий остаток. Никаких
 *    таймеров, «осталось 3 места» при сотне свободных и «сейчас смотрят 12 человек».
 *    Продукт построен на отсутствии вины и давления; фальшивый дефицит в нём —
 *    не приём, а противоречие самому себе.
 *
 * 3. **Три ответа, а не один.** «Дорого» информативнее молчания, и записка просит
 *    именно качественные возражения. Кнопка «нет» здесь такая же полноправная,
 *    как «да», и ни на что не жалуется в ответ.
 *
 * ⚠️ Чего модуль НЕ делает: не берёт денег, не обещает сроков, не хранит ничего
 * платёжного и не назначает A/B-варианты цены. Последнее намеренно: на когорте
 * в 50–100 человек сплит даёт по 25–50 на ветку, а записка прямо запрещает
 * «дробить маленькую когорту на множество экспериментов».
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 * Подключается и на сервере — валидация записи должна быть одна на обе стороны.
 */
(function exposeFounderPass(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FounderPassV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildFounderPass() {
  'use strict';

  const VERSION = '1.0.0';

  // Верхняя граница из записки. Смысл числа не в дефиците, а в честности обещания:
  // столько людей я реально смогу впустить в закрытую бету и обслужить руками.
  const CAPACITY = 100;

  // Одна цена, не две. Обоснование — в шапке.
  const OFFER = Object.freeze({
    priceCents: 1999,
    currency: 'EUR',
    proMonths: 12,
    // Только то, что продукт действительно может выполнить (гейт записки).
    perks: Object.freeze(['closed-beta', 'founder-badge', 'cosmetic-set', 'roadmap-vote', 'pro-12m']),
  });

  const ANSWERS = Object.freeze(['interested', 'too_expensive', 'not_now']);
  // Место занимает только «беру». «Дорого» и «пока нет» — тоже ценные ответы,
  // но они не бронируют доступ, иначе счётчик перестанет значить хоть что-то.
  const HOLDS_SLOT = 'interested';

  const MAX_NOTE = 280;
  // Два дня и три дела — не «активность», а минимум, при котором ответ про деньги
  // вообще о чём-то говорит. Порог намеренно низкий: это не награда за лояльность,
  // а отсечка бессодержательных ответов.
  const MIN_ACTIVE_DAYS = 2;
  const MIN_DONE_TASKS = 3;

  function intOf(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function text(value, max) {
    const raw = typeof value === 'string' ? value : '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, max);
  }

  /**
   * Показывать ли предложение этому человеку.
   *
   * Возвращает и причину отказа, и чего не хватает — вызывающий код НЕ обязан
   * это показывать, и по умолчанию не показывает: «сделай ещё два дела, и мы
   * предложим тебе заплатить» превращает продукт в кассу. Причина существует
   * для админской воронки, чтобы отличать «не подошёл» от «не увидел».
   *
   * @param {{activeDays?:number, doneTasks?:number}} signals
   * @returns {{eligible:boolean, reason:string, needDays:number, needTasks:number}}
   */
  function eligibility(signals) {
    const activeDays = intOf(signals && signals.activeDays);
    const doneTasks = intOf(signals && signals.doneTasks);
    const needDays = Math.max(0, MIN_ACTIVE_DAYS - activeDays);
    const needTasks = Math.max(0, MIN_DONE_TASKS - doneTasks);
    if (needDays || needTasks) {
      return { eligible: false, reason: 'not_enough_use', needDays, needTasks };
    }
    return { eligible: true, reason: '', needDays: 0, needTasks: 0 };
  }

  /**
   * Честный остаток мест. Никогда не выдумывает дефицит и не уходит ниже нуля.
   * @param {number} taken — сколько мест реально занято
   * @param {number} [capacity]
   */
  function slotsLeft(taken, capacity) {
    const cap = capacity === undefined ? CAPACITY : intOf(capacity);
    return Math.max(0, cap - intOf(taken));
  }

  /**
   * Проверка одной записи. Одна и та же на клиенте и на сервере: сервер не должен
   * доверять клиенту, а клиент не должен показывать то, что сервер отвергнет.
   *
   * Цена пишется в запись, а не берётся из `OFFER` при чтении: если завтра цена
   * изменится, ответы, собранные по старой цене, обязаны остаться привязанными
   * к той цене, которую человек видел. Иначе весь замер обесценится задним числом.
   *
   * @param {object} raw
   * @returns {object|null} null = запись невалидна и не должна сохраняться
   */
  function sanitizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const userId = text(raw.userId, 64);
    if (!userId) return null;
    const answer = ANSWERS.indexOf(String(raw.answer || '')) >= 0 ? String(raw.answer) : '';
    if (!answer) return null;
    const at = typeof raw.at === 'string' && !isNaN(Date.parse(raw.at)) ? raw.at : new Date().toISOString();
    const priceCents = intOf(raw.priceCents) || OFFER.priceCents;
    const currency = /^[A-Z]{3}$/.test(String(raw.currency || '')) ? String(raw.currency) : OFFER.currency;
    return { userId, answer, at, priceCents, currency, note: text(raw.note, MAX_NOTE) };
  }

  function emptyStore() {
    return { version: 1, capacity: CAPACITY, entries: [] };
  }

  /**
   * Проверка всего файла. Возвращает null, если файл повреждён — вызывающий код
   * обязан ответить ошибкой, а не пустым списком: пустой список здесь означал бы
   * «мест сто, никто не записался» и разрешил бы затереть настоящие ответы.
   */
  function sanitizeStore(raw) {
    if (!raw || typeof raw !== 'object' || Number(raw.version) !== 1) return null;
    if (!Array.isArray(raw.entries)) return null;
    const entries = [];
    const seen = new Set();
    for (let i = 0; i < raw.entries.length; i += 1) {
      const entry = sanitizeEntry(raw.entries[i]);
      if (!entry) return null;               // одна битая строка => файл не доверенный
      if (seen.has(entry.userId)) return null; // дубль пользователя => файл не доверенный
      seen.add(entry.userId);
      entries.push(entry);
    }
    const capacity = intOf(raw.capacity) || CAPACITY;
    return { version: 1, capacity, entries };
  }

  /**
   * Ответ одного человека можно менять: «дорого» сегодня и «беру» через неделю —
   * это законное изменение мнения, а не вторая запись. Поэтому upsert по userId.
   */
  function upsert(store, entry) {
    const base = store && Array.isArray(store.entries) ? store : emptyStore();
    const clean = sanitizeEntry(entry);
    if (!clean) return null;
    const entries = base.entries.filter((x) => x.userId !== clean.userId);
    entries.push(clean);
    return { version: 1, capacity: base.capacity || CAPACITY, entries };
  }

  /**
   * Сводка для воронки. Сырые числа, без собранных фраз — по той же причине, что
   * и в остальных модулях: число внутри предложения не ловится переводом.
   */
  function summarize(store) {
    const base = store && Array.isArray(store.entries) ? store : emptyStore();
    const capacity = intOf(base.capacity) || CAPACITY;
    const counts = { interested: 0, too_expensive: 0, not_now: 0 };
    for (let i = 0; i < base.entries.length; i += 1) {
      const answer = base.entries[i].answer;
      if (counts[answer] !== undefined) counts[answer] += 1;
    }
    const taken = counts[HOLDS_SLOT];
    return {
      capacity,
      answered: base.entries.length,
      interested: counts.interested,
      tooExpensive: counts.too_expensive,
      notNow: counts.not_now,
      taken,
      left: slotsLeft(taken, capacity),
      full: slotsLeft(taken, capacity) === 0,
    };
  }

  function entryFor(store, userId) {
    const base = store && Array.isArray(store.entries) ? store : emptyStore();
    const key = text(userId, 64);
    return base.entries.find((x) => x.userId === key) || null;
  }

  return {
    VERSION, CAPACITY, OFFER, ANSWERS, HOLDS_SLOT, MAX_NOTE,
    MIN_ACTIVE_DAYS, MIN_DONE_TASKS,
    eligibility, slotsLeft, sanitizeEntry, sanitizeStore, emptyStore, upsert, summarize, entryFor,
  };
});
