/* Satoru After Lapse v1 (DISCIPLINE-ARENA-PLAN §12) — обычный день после срыва.
 *
 * «И по идее именно сейчас, когда я нахожусь в такой жопе, я должен
 * мобилизировать все свои силы, чтобы как можно быстрее из этой жопы выбраться.»
 *
 * После провала люди планируют компенсирующее перевыполнение — и именно это
 * производит американские горки, от которых они хотят уйти. Правильный ответ
 * на потерянный день скучный: обычный день, не компенсационный.
 *
 * Модуль отвечает ровно на один вопрос: сегодня заведено заметно больше
 * обычного сразу после потерянного дня — да или нет.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ блокирует и не даёт ничего, чем можно заблокировать. Гейт §12: взрослый
 *    имеет право на героический день. Здесь только наблюдение;
 *  — НЕ говорит дважды. Повтор превращает наблюдение в нытьё, поэтому есть и
 *    проверка «сегодня уже сказали», и COOLDOWN_DAYS между высказываниями;
 *  — НЕ решает сам, был ли вчерашний день потерян. Это знает вызывающий
 *    (`failure-context-v1` или собственный сигнал) — иначе два модуля начали бы
 *    независимо классифицировать дни и однажды разошлись бы в ответах;
 *  — НЕ возвращает готовых фраз, только сырые числа.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeAfterLapse(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AfterLapseV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAfterLapse() {
  'use strict';

  const VERSION = '1.0.0';

  // «Заметно больше» — обе проверки обязательны. Доля ловит рост на любой
  // личной норме, абсолютный минимум не даёт сработать на 2 против 3, где
  // разговор о перевыполнении просто смешон.
  const OVERSHOOT = 1.5;
  const MIN_EXCESS = 2;

  // Минимум наблюдений, чтобы у «обычной нормы» был смысл.
  const MIN_HISTORY = 4;

  // Молчание между высказываниями. Гейт §12 «сказать один раз» относится к
  // эпизоду, а не ко всей жизни: через неделю новый срыв — новый разговор.
  // Но три дня подряд одно и то же — это и есть нытьё, от которого гейт защищает.
  const COOLDOWN_DAYS = 3;

  // Ядро дня — 1–3 дела (та же граница, что предлагает паттерн `noend`).
  const CORE_MIN = 1;
  const CORE_MAX = 3;

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }

  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return 0;
    const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }

  /**
   * Обычная норма — медиана собственных непустых дней. Та же величина и по той
   * же причине, что в `failure-context-v1`: «много дел» у каждого своё, и
   * фиксированное число соврало бы обоим.
   *
   * @returns {number|null}
   */
  function typicalPlanned(history) {
    const counts = (Array.isArray(history) ? history : [])
      .map((d) => num(d && d.planned))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    if (counts.length < MIN_HISTORY) return null;
    return counts[Math.floor((counts.length - 1) / 2)];
  }

  /**
   * Стоит ли сказать про героический день — или null.
   *
   * null во всех случаях, когда говорить не о чем: вчера не было срыва, нормы
   * ещё нет, план в пределах нормы, уже говорили сегодня или недавно.
   *
   * @param {object} input
   * @param {string} input.today — YYYY-MM-DD
   * @param {boolean} input.yesterdayLost — решает вызывающий
   * @param {number} input.todayPlanned — сколько дел заведено на сегодня
   * @param {Array<{date:string, planned:number}>} input.history
   * @param {string[]} [input.saidOn] — дни, когда уже говорили
   * @returns {{todayPlanned:number, typical:number, excess:number, suggestedCore:number}|null}
   */
  function afterLapseNudge(input) {
    const inp = input || {};
    const today = inp.today;
    if (!isDay(today) || !inp.yesterdayLost) return null;

    const planned = num(inp.todayPlanned);
    if (!planned) return null;

    const typical = typicalPlanned(inp.history);
    if (typical == null) return null;

    if (planned < typical * OVERSHOOT) return null;
    if (planned - typical < MIN_EXCESS) return null;

    // Недавнее высказывание закрывает тему — включая сегодняшнее.
    for (const d of Array.isArray(inp.saidOn) ? inp.saidOn : []) {
      if (!isDay(d) || d > today) continue;
      if (daysBetween(d, today) < COOLDOWN_DAYS) return null;
    }

    return {
      todayPlanned: planned,
      typical,
      excess: planned - typical,
      // Предложение свернуть до ядра — не до нуля и не до «обычной нормы»,
      // а до 1–3 дел: столько же, сколько предлагает граница «работа без конца».
      suggestedCore: Math.min(CORE_MAX, Math.max(CORE_MIN, typical)),
    };
  }

  /** Записать, что сказали. Иммутабельно; дубликаты не копятся. */
  function noteSpoken(saidOn, day) {
    const list = (Array.isArray(saidOn) ? saidOn : []).filter(isDay);
    if (!isDay(day) || list.includes(day)) return list.slice();
    return list.concat([day]).sort();
  }

  return {
    VERSION, OVERSHOOT, MIN_EXCESS, MIN_HISTORY, COOLDOWN_DAYS, CORE_MIN, CORE_MAX,
    typicalPlanned, afterLapseNudge, noteSpoken, daysBetween,
  };
});
