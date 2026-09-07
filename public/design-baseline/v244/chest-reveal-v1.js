/* Satoru Chest Reveal v1 — честная лента открытия сундука.
 *
 * Решение Альберта 12.08: «мы возвращаем драму. Нам нужны hooking механизмы.
 * Просто мы их используем во благо.» Редизайн v124 снял тёмные паттерны, но
 * вместе с ними унёс церемонию, и сундук стал выдавать сухую строку. Возврат
 * драмы — продуктовое решение владельца; этот модуль существует, чтобы вернуть
 * её так, что вернуть заодно и манипуляцию стало ТРУДНО.
 *
 * ГРАНИЦА, ради которой модуль отдельный: театр против фабрикации.
 *
 *  МОЖНО (и здесь есть): лента прокручивается по реальному пулу и
 *  останавливается на реально выпавшем предмете; замедление к концу; звук;
 *  пропуск в любой момент; ограниченная длительность.
 *
 *  НЕЛЬЗЯ (и здесь этого нет ни в каком виде):
 *   — near-miss. Соседи победителя набираются тем же равномерным жребием, что и
 *     вся лента. Подкрутить их в сторону «почти легендарки» — значит подделать
 *     проигрыш, которого не было: человек не был близок к другому исходу, исход
 *     уже определён до первого кадра. `neighbourBias` не существует как
 *     параметр, и тест сверяет распределение соседей с распределением ленты;
 *   — растягивание ради томления. `MAX_DURATION_MS` держит потолок, а решение о
 *     длительности не зависит от редкости: «легендарку крутим дольше» — это
 *     плата вниманием за то, что уже произошло;
 *   — перекруты. Лента детерминирована по seed, поэтому повторный рендер даёт ту
 *     же ленту и тот же исход. Пересобрать её в надежде на другое нельзя.
 *
 * Исход НЕ вычисляется здесь. Он приходит готовым (`result`) — модуль только
 * показывает. Так его невозможно использовать, чтобы «доиграть» результат.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeChestReveal(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChestRevealV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildChestReveal() {
  'use strict';

  const VERSION = '1.0.0';

  // Длина ленты. Достаточно, чтобы прокрутка читалась как прокрутка, и мало,
  // чтобы не превращаться в ожидание.
  const STRIP_LENGTH = 28;
  // Победитель стоит НЕ в самом конце: за ним остаётся хвост, иначе лента
  // выглядит оборванной, а не остановившейся.
  const TAIL_AFTER_WINNER = 3;

  // Потолок церемонии. Всё, что дольше, — плата вниманием за уже случившееся.
  const MAX_DURATION_MS = 2000;
  const MIN_DURATION_MS = 600;
  const DEFAULT_DURATION_MS = 1400;

  /**
   * Детерминированный генератор (mulberry32). Нужен не ради скорости, а ради
   * свойства: одна и та же лента при каждом рендере. Иначе перерисовка экрана
   * во время анимации меняла бы картинку, а это уже перекрут.
   */
  function rng(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return function next() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Стабильный seed из строки — чтобы лента следовала за исходом, а не за часами. */
  function seedFrom(str) {
    let h = 2166136261;
    for (const ch of String(str == null ? '' : str)) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clampDuration(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return DEFAULT_DURATION_MS;
    return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(n)));
  }

  /**
   * Лента для показа.
   *
   * @param {object} input
   * @param {Array<object>} input.pool — реальный пул, из которого шёл розыгрыш
   * @param {object} input.result — уже определённый выигрыш (объект из пула)
   * @param {string|number} [input.seed] — обычно id открытия
   * @param {number} [input.length]
   * @param {number} [input.durationMs]
   * @returns {{strip:Array, winnerIndex:number, durationMs:number, skippable:true}|null}
   */
  function buildReel(input) {
    const inp = input || {};
    const pool = Array.isArray(inp.pool) ? inp.pool.filter(Boolean) : [];
    const result = inp.result;
    if (!result || typeof result !== 'object') return null;

    const length = Math.max(8, Math.min(64, Math.round(Number(inp.length) || STRIP_LENGTH)));
    const winnerIndex = Math.max(0, length - 1 - TAIL_AFTER_WINNER);
    const next = rng(seedFrom(inp.seed == null ? (result.id || '') : inp.seed));

    // Лента набирается РАВНОМЕРНО из пула — включая позиции рядом с победителем.
    // Никакого отдельного правила для соседей нет и не должно появиться.
    const strip = [];
    for (let i = 0; i < length; i++) {
      if (pool.length) strip.push(pool[Math.floor(next() * pool.length) % pool.length]);
      else strip.push(result);
    }
    // Победитель ставится последним действием: остальные позиции уже набраны и
    // о нём ничего не знают, поэтому подстроиться под него не могли.
    strip[winnerIndex] = result;

    return {
      strip,
      winnerIndex,
      durationMs: clampDuration(inp.durationMs == null ? DEFAULT_DURATION_MS : inp.durationMs),
      // Пропуск — часть контракта, а не любезность: церемония не может стать
      // условием получения того, что уже заработано.
      skippable: true,
    };
  }

  /**
   * Кривая замедления. Одна на все редкости — намеренно.
   * «Легендарку тормозим дольше» читалось бы как драма, но было бы платой
   * вниманием за исход, который уже случился.
   */
  function easing() { return 'cubic-bezier(.13,.72,.24,1)'; }

  return {
    VERSION, STRIP_LENGTH, TAIL_AFTER_WINNER,
    MAX_DURATION_MS, MIN_DURATION_MS, DEFAULT_DURATION_MS,
    seedFrom, clampDuration, buildReel, easing,
  };
});
