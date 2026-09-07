/* Satoru Failure Context v1 (DISCIPLINE-ARENA-PLAN §4).
 *
 * «Один плохой день намного хуже для менталки, чем несколько хороших и тем
 * более недели нормальных.» Негативное смещение: одиночный провал доминирует
 * над субъективной оценкой всего периода, и человек в момент провала честно
 * не помнит, что три недели были нормальными.
 *
 * У приложения эти данные уже есть. Вся фича — показать их ровно в момент
 * провала: «За 30 дней: 22 обычных, 5 хороших, 3 таких. Это третий.»
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ утешает. Гейт §4: это арифметика, а не утешение; никаких «не
 *    расстраивайся», только числа. Поэтому наружу выходят голые счётчики,
 *    и собрать из них сочувственную фразу — уже решение вызывающего кода;
 *  — НЕ отвечает ничем в хороший и обычный день (иначе превращается в шум);
 *  — НЕ сравнивает с другими людьми. Никогда, ни в каком виде — сравнение по
 *    чужим курируемым результатам это доомскролл с лишним шагом (§5);
 *  — НЕ говорит, пока данных мало: «за 30 дней: 1 такой» на четвёртый день
 *    жизни в приложении — не факт, а искажение. См. MIN_OBSERVED.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeFailureContext(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FailureContextV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildFailureContext() {
  'use strict';

  const VERSION = '1.0.0';

  const WINDOW_DAYS = 30;

  // Ниже этого числа наблюдённых дней модуль молчит. Утверждение «за 30 дней
  // это третий такой» требует, чтобы 30 дней действительно были прожиты в
  // приложении; иначе это не поддержка, а выдуманная статистика.
  const MIN_OBSERVED = 7;

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
   * Типичный непустой день человека — медиана СОБСТВЕННЫХ дел, а не абсолютное
   * число. Пять закрытых дел у одного — обычный вторник, у другого — лучший
   * день месяца; фиксированный порог соврал бы обоим.
   *
   * Медиана, а не верхний перцентиль: на распределении из примера плана
   * (22 дня по 3 дела и 5 дней по 8) семьдесят пятый перцентиль равен 3, и
   * «хорошими» стали бы все 27 непустых дней. Медиана даёт ровно 5 — потому
   * что хороший день определяется как «больше, чем обычно», а не как попадание
   * в заранее назначенную долю.
   *
   * При малой выборке возвращает null: делить дни на обычные и хорошие по трём
   * наблюдениям — гадание.
   *
   * @returns {number|null}
   */
  function typicalDone(days) {
    const counts = (Array.isArray(days) ? days : [])
      .map((d) => num(d && d.doneCount))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    if (counts.length < 4) return null;
    return counts[Math.floor((counts.length - 1) / 2)];
  }

  /**
   * Классификация дня. Порядок проверок значим.
   *
   * Закрытое ядро дня — «хороший» независимо от объёма: это ровно то, что
   * обещает сама механика ядра («закрыл ядро — день засчитан, остальное бонус»).
   * Считать такой день обычным значит отменить обещание задним числом.
   *
   * @param {{doneCount?:number, coreTotal?:number, coreDone?:number}} day
   * @param {number|null} typical — из typicalDone()
   * @returns {'bad'|'normal'|'good'}
   */
  function classifyDay(day, typical) {
    const d = day || {};
    const done = num(d.doneCount);
    if (done === 0) return 'bad';
    const coreTotal = num(d.coreTotal);
    if (coreTotal > 0 && num(d.coreDone) >= coreTotal) return 'good';
    if (typical != null && done > typical) return 'good';
    return 'normal';
  }

  /**
   * Числа для строки в момент провала — или null, если говорить не о чем.
   *
   * null возвращается в трёх случаях, и все три намеренные: сегодняшний день
   * не плохой; наблюдённых дней меньше MIN_OBSERVED; сегодня вообще нет в
   * данных. Молчание здесь — не сбой, а поведение по гейтам §4.
   *
   * Возвращает СЫРЫЕ значения, не собранную фразу: числа внутри предложения
   * не ловятся словарным переводом RU/EN/DE/UK/ES.
   *
   * @param {Array<{date:string, doneCount?:number, coreTotal?:number, coreDone?:number}>} days
   * @param {string} today — YYYY-MM-DD
   * @param {{windowDays?:number, minObserved?:number}} [opts]
   * @returns {{windowDays:number, observed:number, bad:number, normal:number,
   *            good:number, todayRank:number, sinceLastBad:(number|null)}|null}
   */
  function failureContext(days, today, opts) {
    const o = opts || {};
    const windowDays = num(o.windowDays) || WINDOW_DAYS;
    const minObserved = o.minObserved == null ? MIN_OBSERVED : num(o.minObserved);
    if (!isDay(today)) return null;

    const seen = new Set();
    const window = (Array.isArray(days) ? days : [])
      .filter((d) => {
        if (!d || !isDay(d.date) || d.date > today) return false;
        const age = daysBetween(d.date, today);
        if (age < 0 || age >= windowDays) return false;
        if (seen.has(d.date)) return false;   // дубли дат не раздувают счётчики
        seen.add(d.date);
        return true;
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    if (window.length < minObserved) return null;

    const typical = typicalDone(window);
    const kinds = window.map((d) => ({ date: d.date, kind: classifyDay(d, typical) }));

    const todayEntry = kinds[kinds.length - 1];
    if (!todayEntry || todayEntry.date !== today || todayEntry.kind !== 'bad') return null;

    let bad = 0, normal = 0, good = 0;
    for (const k of kinds) {
      if (k.kind === 'bad') bad += 1;
      else if (k.kind === 'good') good += 1;
      else normal += 1;
    }

    const badDays = kinds.filter((k) => k.kind === 'bad').map((k) => k.date);
    const prevBad = badDays.length > 1 ? badDays[badDays.length - 2] : null;

    return {
      windowDays,
      observed: window.length,
      bad,
      normal,
      good,
      todayRank: badDays.length,                                  // «это третий»
      sinceLastBad: prevBad ? daysBetween(prevBad, today) : null, // «прошлый был 11 дней назад»
    };
  }

  return { VERSION, WINDOW_DAYS, MIN_OBSERVED, typicalDone, classifyDay, failureContext, daysBetween };
});
