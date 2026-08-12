/* Satoru Chart Labels v1 — подписи столбцов, которые не слипаются.
 *
 * fb_ms4m1ur2m1ip: «в „время по сферам" весь текст друг на друга под графиком
 * накладывается в одну линию и становится нечитаем». Это же и есть давний
 * fb_mqe84cmxnb8g / fb_mr3jl673mo9m («накладывается текст друг на друга»),
 * который висел в BACKLOG без репро — теперь место названо точно.
 *
 * Причина: `barChartSVG` рисует подпись под КАЖДЫМ столбцом в фиксированном
 * `viewBox` шириной 600. Для графика по дням подписи короткие («12.08»), а для
 * «Времени по сферам» это НАЗВАНИЯ СФЕР — «Восстановление», «Отношения». Чем
 * больше сфер, тем уже слот, и текст налезает на соседа.
 *
 * ⚠️ Ключевое решение: прореживать можно ДАТЫ, но не ИМЕНА.
 * Существующий `showEvery` выбрасывает каждую вторую подпись — для оси дат это
 * нормально (пропущенная дата восстанавливается по соседям), для имён сфер это
 * потеря данных: человек видит столбец и не знает, чей он. Поэтому `thinnable`
 * приходит снаружи и по умолчанию ВЫКЛЮЧЕН — молчаливая потеря имени хуже
 * наклонного текста.
 *
 * Чистый модуль: только числа на входе, ничего не измеряет в DOM.
 */
(function exposeChartLabels(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChartLabelsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildChartLabels() {
  'use strict';

  const VERSION = '1.0.0';

  // Средняя ширина знака относительно кегля. Кириллица в Podkova/системном
  // sans шире латиницы, поэтому коэффициент осторожный: лучше наклонить лишний
  // раз, чем оставить слипшийся текст.
  const CHAR_RATIO = 0.58;
  // Зазор между соседними подписями, чтобы «читаемо» не означало «впритык».
  const GAP = 4;
  const ANGLE = -35;
  const MIN_CHARS = 4; // короче обрезать бессмысленно — остаётся загадка, а не подпись

  function textWidth(str, fontSize) {
    return String(str == null ? '' : str).length * fontSize * CHAR_RATIO;
  }

  /**
   * Как рисовать подписи.
   *
   * @param {object} input
   * @param {string[]} input.labels
   * @param {number} input.width — ширина viewBox
   * @param {number} [input.pad]
   * @param {number} [input.fontSize]
   * @param {boolean} [input.thinnable] — можно ли выбрасывать часть подписей (даты — да, имена — нет)
   * @returns {{mode:'horizontal'|'angled'|'truncated', angle:number, every:number, maxChars:number|null, slot:number}}
   */
  function layout(input) {
    const inp = input || {};
    const labels = (Array.isArray(inp.labels) ? inp.labels : []).map((x) => String(x == null ? '' : x));
    const width = Math.max(1, Number(inp.width) || 600);
    const pad = Math.max(0, Number(inp.pad) || 26);
    const fontSize = Math.max(1, Number(inp.fontSize) || 9);
    const n = labels.length;
    const slot = n ? (width - pad * 2) / n : width;

    const base = { mode: 'horizontal', angle: 0, every: 1, maxChars: null, slot };
    if (!n) return base;

    const longest = labels.reduce((m, s) => Math.max(m, textWidth(s, fontSize)), 0);
    if (longest + GAP <= slot) return base;

    // Прореживание — только там, где пропуск восстанавливается по соседям.
    if (inp.thinnable) {
      const every = Math.ceil((longest + GAP) / slot);
      if (every > 1) return { ...base, mode: 'horizontal', every };
    }

    // Наклон: подпись перестаёт конкурировать с соседом за горизонталь.
    // По горизонтали ей теперь нужно примерно cos(35°) ≈ 0.82 своей длины,
    // а начинается она у своего столбца, поэтому в слот укладывается заметно
    // более длинный текст.
    const angledFootprint = longest * Math.cos((Math.abs(ANGLE) * Math.PI) / 180);
    if (angledFootprint + GAP <= slot * 2.2) return { ...base, mode: 'angled', angle: ANGLE };

    // Последнее средство — обрезка. Имя всё равно остаётся узнаваемым началом,
    // и это честнее, чем выбросить подпись целиком.
    const maxChars = Math.max(MIN_CHARS, Math.floor((slot * 2.2 - GAP) / (fontSize * CHAR_RATIO)));
    return { ...base, mode: 'truncated', angle: ANGLE, maxChars };
  }

  /** Обрезка с многоточием — ровно по решению layout(). */
  function clip(label, maxChars) {
    const s = String(label == null ? '' : label);
    const n = Number(maxChars);
    if (!Number.isFinite(n) || n <= 0 || s.length <= n) return s;
    return s.slice(0, Math.max(1, n - 1)) + '…';
  }

  return { VERSION, CHAR_RATIO, GAP, ANGLE, MIN_CHARS, textWidth, layout, clip };
});
