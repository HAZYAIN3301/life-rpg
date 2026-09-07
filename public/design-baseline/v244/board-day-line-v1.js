/* Satoru Board → day line v1
 *
 * Заказ с доски — это взятое на себя обязательство, и до сих пор день о нём не
 * знал. «Доска» живёт третьим уровнем внутри «Сегодня»: пока открыт «День»,
 * панель доски скрыта целиком, и увидеть взятое можно, только вспомнив, что
 * доска вообще есть. Ровно то, на что жаловался владелец: человек не помнит,
 * что где живёт.
 *
 * Здесь считается, что день должен сказать про взятое. Именно сказать, а не
 * завести второй квест: у заказа уже есть своя запись и свой жизненный цикл,
 * и вторая запись того же факта — та самая болезнь, от которой всё это лечится.
 * День показывает и уводит к заказу; отмечает выполнение по-прежнему доска.
 *
 * Модуль чистый: без DOM, State, сети и чтения часов.
 */
(function exposeBoardDayLine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardDayLineV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardDayLine() {
  'use strict';

  // Доска не даёт взять больше трёх; строка дня не имеет права показать больше,
  // чем доска вообще способна выдать.
  const MAX_SHOWN = 3;
  const TITLE_MAX = 80;
  const EMPTY = Object.freeze([]);

  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function nonEmptyString(value) { return typeof value === 'string' && !!value.trim(); }

  function isDay(raw) {
    if (typeof raw !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  /**
   * Что день скажет про взятое с доски.
   *
   * `active` — записи доски (`{ orderId, takenAt }`), `titleOf` — как назвать
   * заказ по его id. Заголовок приходит функцией, потому что у доски он
   * собирается из каталога, локали и пользовательских заказов: повторять эту
   * сборку здесь значило бы описать одно название двумя способами.
   */
  function takenFor(input) {
    const options = isObject(input) ? input : {};
    const active = Array.isArray(options.active) ? options.active : [];
    const titleOf = typeof options.titleOf === 'function' ? options.titleOf : null;
    if (!titleOf || !active.length) return EMPTY;

    const seen = new Set();
    const rows = [];
    for (const entry of active) {
      if (!isObject(entry) || !nonEmptyString(entry.orderId)) continue;
      const orderId = String(entry.orderId);
      if (seen.has(orderId)) continue;
      seen.add(orderId);
      // Заказа нет в каталоге — значит назвать его нечем. Показать пустую
      // строку хуже, чем не показать: она обещает заказ, которого не найти.
      const raw = titleOf(orderId);
      if (!nonEmptyString(raw)) continue;
      rows.push({
        orderId,
        title: raw.trim().slice(0, TITLE_MAX),
        takenAt: isDay(entry.takenAt) ? entry.takenAt : '',
      });
    }
    // Порядок — от раньше взятого к позже; без даты идут последними. Он не
    // должен зависеть от того, в каком порядке доска сложила записи в файл.
    rows.sort((a, b) => (a.takenAt || '9999-99-99').localeCompare(b.takenAt || '9999-99-99')
      || a.orderId.localeCompare(b.orderId));
    return rows.slice(0, MAX_SHOWN);
  }

  return Object.freeze({ MAX_SHOWN, takenFor });
});
