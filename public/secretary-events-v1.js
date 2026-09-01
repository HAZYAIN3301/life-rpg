/* Satoru Secretary Events v1 — словарь того, что может случиться (SECRETARY-OS-PAIN-MAP §7).
 *
 * Это вход Router-а и единственное место, где сырые сигналы превращаются в события.
 * Модуль намеренно скучный: он ничего не решает и не интерпретирует. Он нормализует,
 * ограничивает и выдаёт ключ идемпотентности — всё остальное делает Router.
 *
 * Зачем отдельный словарь. Разбор 01.09 показал главную точку вмешательства: не вечер
 * (там ресурса уже нет), а **утро после срыва**, когда человек в ясном сознании решает
 * «день всё равно потерян». Чтобы это утро поймать, нужно знать, что было вчера —
 * а «вчера» собирается из четырёх разных доменов. Без общего словаря каждый детектор
 * читал бы чужие сторы по-своему, и появился бы пятый способ описать одно и то же
 * (ровно та болезнь, ради которой написан `commitment-v1`).
 *
 * ⚠️ Три правила, нарушение которых обесценивает всё остальное:
 *
 * 1. **Молчание — не событие.** Отсутствие данных не превращается в `escaped`,
 *    в «срыв» и в повод для вмешательства. Тишина порождает `day.silent` только
 *    при явном подтверждении, что день действительно был пустым, и остаётся
 *    поводом задать ОДИН вопрос, а не сделать вывод (§8 DISCIPLINE-ESCAPE-PLAN).
 *
 * 2. **Ключ идемпотентности обязателен.** Один и тот же факт, доставленный дважды
 *    (retry, второе устройство, переоткрытая вкладка), обязан дать один и тот же
 *    `key`. Метрика продукта требует нуля дубликатов push/эпизодов/действий.
 *
 * 3. **Событие не несёт содержимого экрана и URL.** Ни адресов, ни запросов, ни
 *    текста страниц — только факт, время и ограниченные поля (§14 плана приватности).
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeSecretaryEvents(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryEventsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSecretaryEvents() {
  'use strict';

  const VERSION = '1.0.0';
  const MAX_LABEL = 60;
  // Хвост событий держим коротким: Router смотрит на вчера и сегодня, а не на историю.
  // История живёт в своих доменах (эпизоды внимания, дни, привычки).
  const MAX_EVENTS = 200;
  const RETAIN_DAYS = 14;

  /* Закрытый словарь. Открытый превратил бы Router в свалку условий, а каждый тип
   * здесь отвечает конкретной точке вмешательства из разбора. */
  const TYPES = Object.freeze({
    // Окно внимания закончилось позже собственной границы. Факт, не оценка.
    ATTENTION_OVERRAN: 'attention.overran',
    // Человек сам отметил на выходе «меня унесло». Его слово, не вывод системы.
    ATTENTION_ESCAPED: 'attention.escaped',
    // Активность в приложении позже согласованного вечернего времени.
    EVENING_LATE: 'evening.late',
    // Подтверждённо пустой день. НЕ выводится из одной лишь тишины.
    DAY_SILENT: 'day.silent',
    // Первое открытие приложения в новый день — момент, когда утро достижимо.
    MORNING_OPEN: 'morning.open',
    // Человек закрыл день сам. Нужен, чтобы вечерние ходы замолчали.
    DAY_CLOSED: 'day.closed',
    // Предложение было отклонено. Это данные о неуместности, а не провал.
    OFFER_DISMISSED: 'offer.dismissed',
    // Предложение принято и действие выполнено.
    OFFER_ACCEPTED: 'offer.accepted',
  });
  const TYPE_LIST = Object.freeze(Object.keys(TYPES).map((k) => TYPES[k]));

  const SOURCES = Object.freeze(['client', 'server', 'extension', 'native']);

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

  function isDay(v) { return typeof v === 'string' && ISO_DAY.test(v); }
  function isIso(v) { return typeof v === 'string' && !isNaN(Date.parse(v)); }
  function label(v) {
    const raw = typeof v === 'string' ? v : '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
  }
  function intOf(v, max) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0) return 0;
    return max === undefined ? n : Math.min(max, n);
  }

  /**
   * Ключ идемпотентности. Один факт — один ключ, независимо от того, сколько раз и
   * с какого устройства он приехал. Намеренно НЕ включает время доставки и источник:
   * то же самое событие с телефона и с ноутбука обязано схлопнуться в одно.
   *
   * Гранулярность — день. Два разных превышения границы за один день по одной и той
   * же политике считаются одним поводом вмешаться: человеку нужен один разговор, а
   * не два одинаковых.
   */
  function keyOf(type, day, ref) {
    return `${type}|${day}|${label(ref) || '-'}`;
  }

  /**
   * Сырое → событие или null. Отвергает, а не чинит: событие с неизвестным типом
   * или без дня не должно попасть в Router «на всякий случай».
   *
   * @returns {{key,type,at,day,source,ref,data}|null}
   */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const type = TYPE_LIST.indexOf(String(raw.type)) >= 0 ? String(raw.type) : '';
    if (!type) return null;
    const day = isDay(raw.day) ? raw.day : '';
    if (!day) return null;
    const at = isIso(raw.at) ? raw.at : `${day}T12:00:00.000Z`;
    const source = SOURCES.indexOf(String(raw.source)) >= 0 ? String(raw.source) : 'client';
    const ref = label(raw.ref);
    const data = {};
    // Поля ограничены по типу. Никаких произвольных ключей: событие не транспорт
    // для чего угодно, иначе в него однажды приедет URL.
    if (type === TYPES.ATTENTION_OVERRAN) {
      data.plannedMinutes = intOf(raw.plannedMinutes, 24 * 60);
      data.actualMinutes = intOf(raw.actualMinutes, 24 * 60);
    }
    if (type === TYPES.EVENING_LATE) {
      data.minutesPast = intOf(raw.minutesPast, 12 * 60);
    }
    if (type === TYPES.DAY_SILENT) {
      data.silentDays = Math.max(1, intOf(raw.silentDays, 60));
    }
    if (type === TYPES.OFFER_DISMISSED || type === TYPES.OFFER_ACCEPTED) {
      data.capability = label(raw.capability);
    }
    return { key: keyOf(type, day, ref), type, at, day, source, ref, data };
  }

  function emptyLog() { return { version: 1, events: [] }; }

  /**
   * Добавление с дедупликацией по ключу. Повтор не создаёт вторую запись и не
   * сдвигает время первой — иначе retry выглядел бы как новое событие и Router
   * предложил бы то же самое дважды.
   *
   * @returns {{log, added: boolean}} added=false означает «уже знали»
   */
  function append(log, raw) {
    const base = log && Array.isArray(log.events) ? log : emptyLog();
    const ev = normalize(raw);
    if (!ev) return { log: base, added: false };
    if (base.events.some((x) => x.key === ev.key)) return { log: base, added: false };
    const events = base.events.concat([ev]);
    events.sort((a, b) => (Date.parse(a.at) - Date.parse(b.at)) || (a.key < b.key ? -1 : 1));
    return { log: { version: 1, events: events.slice(-MAX_EVENTS) }, added: true };
  }

  /** Обрезка по возрасту. Router смотрит на вчера; хранить больше двух недель незачем. */
  function prune(log, today) {
    const base = log && Array.isArray(log.events) ? log : emptyLog();
    if (!isDay(today)) return base;
    const edge = Date.parse(`${today}T00:00:00Z`) - RETAIN_DAYS * 86400000;
    return { version: 1, events: base.events.filter((e) => Date.parse(`${e.day}T00:00:00Z`) >= edge) };
  }

  /**
   * Проверка всего файла. null = файл повреждён, и вызывающий обязан ответить
   * ошибкой, а не пустым журналом: пустой журнал означал бы «ничего не случилось»
   * и разрешил бы затереть настоящие события.
   */
  function sanitizeLog(raw) {
    if (!raw || typeof raw !== 'object' || Number(raw.version) !== 1) return null;
    if (!Array.isArray(raw.events)) return null;
    const events = [];
    const seen = new Set();
    for (let i = 0; i < raw.events.length; i += 1) {
      const ev = normalize(raw.events[i]);
      if (!ev) return null;
      if (seen.has(ev.key)) return null;
      seen.add(ev.key);
      events.push(ev);
    }
    return { version: 1, events };
  }

  function onDay(log, day) {
    const base = log && Array.isArray(log.events) ? log : emptyLog();
    return base.events.filter((e) => e.day === day);
  }
  function hasOnDay(log, day, type) {
    return onDay(log, day).some((e) => e.type === type);
  }

  return Object.freeze({
    VERSION, TYPES, TYPE_LIST, SOURCES, MAX_EVENTS, RETAIN_DAYS, MAX_LABEL,
    keyOf, normalize, emptyLog, append, prune, sanitizeLog, onDay, hasOnDay,
  });
});
