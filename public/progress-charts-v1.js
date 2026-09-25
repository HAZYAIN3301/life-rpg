/* Satoru Progress Charts v1 — модели плотных, читаемых графиков (R04B).
 *
 * Что было. `barChartSVG` рисовал столбцы в SVG с viewBox 600×190. На телефоне SVG
 * сжимался почти вдвое, и подписи 9–11px превращались в 5px. Число стояло над
 * каждым столбцом, «Время по сферам» показывало минуты без единицы («750»),
 * сферы без времени оставляли пустые места с подписью, а наклонные имена
 * обрезались краем карточки.
 *
 * Что здесь. Только числа: какие столбцы подписать (максимум и последний день),
 * как отсортировать сферы, какие сферы вынести одной строкой «без времени» и
 * итоги для подписи под графиком. Разметку и текст строит app.js, кегль задаёт
 * CSS — текст больше не масштабируется вместе с картинкой.
 *
 * Чистый модуль: ни DOM, ни State, ни переводчика.
 */
(function exposeProgressCharts(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProgressChartsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildProgressCharts() {
  'use strict';

  const VERSION = '1.0.0';

  function num(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : 0; }
  function pct(value, max) { return max > 0 ? Math.round((value / max) * 1000) / 10 : 0; }

  /**
   * Временной ряд (например, XP по дням). Подписываются значения только у
   * максимума и у последней точки — число над каждым столбцом никто не читает.
   *
   * @param {Array<{label:string, tick?:string, value:number}>} points — по порядку времени
   * @returns {{cols:Array, max:number, maxIndex:number, lastIndex:number, total:number,
   *   average:number, activeDays:number}}
   */
  function columns(points) {
    const list = Array.isArray(points) ? points : [];
    const values = list.map((point) => num(point && point.value));
    const max = values.length ? Math.max(0, ...values) : 0;
    // Первый максимум: при равенстве подписан самый ранний, а не случайный.
    const maxIndex = max > 0 ? values.indexOf(max) : -1;
    const lastIndex = list.length - 1;
    const total = values.reduce((sum, value) => sum + value, 0);
    const activeDays = values.filter((value) => value > 0).length;
    const cols = list.map((point, index) => ({
      label: String(point && point.label != null ? point.label : ''),
      tick: String(point && point.tick != null ? point.tick : (point && point.label != null ? point.label : '')),
      value: values[index],
      pct: pct(values[index], max),
      isMax: index === maxIndex,
      isLast: index === lastIndex,
      showValue: max > 0 && (index === maxIndex || (index === lastIndex && values[index] > 0)),
    }));
    return { cols, max, maxIndex, lastIndex, total, average: list.length ? Math.round(total / list.length) : 0, activeDays };
  }

  /**
   * Категории с длинными именами (время по сферам): горизонтальные полосы по
   * убыванию, ноль — одной строкой, а не пустым столбцом с подписью.
   *
   * @param {Array<{label:string, value:number, color?:string, id?:string}>} items
   */
  function bars(items) {
    const list = (Array.isArray(items) ? items : []).map((item, index) => ({
      id: item && item.id != null ? String(item.id) : String(index),
      label: String(item && item.label != null ? item.label : ''),
      value: num(item && item.value),
      color: item && item.color ? String(item.color) : '',
      order: index,
    }));
    const active = list.filter((item) => item.value > 0)
      .sort((a, b) => (b.value - a.value) || (a.order - b.order));
    const max = active.length ? active[0].value : 0;
    const total = active.reduce((sum, item) => sum + item.value, 0);
    return {
      rows: active.map((item) => ({ ...item, pct: pct(item.value, max), share: total ? Math.round((item.value / total) * 100) : 0 })),
      zero: list.filter((item) => item.value === 0),
      max,
      total,
    };
  }

  return { VERSION, columns, bars };
});
