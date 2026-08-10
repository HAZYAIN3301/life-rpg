/* Satoru Stuck Task v1 (DISCIPLINE-ARENA-PLAN §7 + память о переносах).
 *
 * Приложение обещает в рекламе, что заметит застрявшее дело. Оно не может:
 * перенос в обоих местах записи просто перезаписывает `task.date`, и задача,
 * которую двигали шесть раз, отличается от созданной сегодня ровно одним полем
 * `createdAt`. Числа «шестой раз» не существует нигде — значит, сказать его
 * невозможно. Этот модуль заводит память о переносе и на её основе выбирает
 * ОДНО дело, про которое стоит спросить.
 *
 * Развилка §7: «не хочу» ≠ «не знаю как». Первое лечится уменьшением входа
 * («Заход» уже построен), второе — прояснением первого шага, и это разные
 * лекарства. Один вопрос из двух вариантов меняет весь дальнейший маршрут —
 * и снимает стыд: «не знаю как» не про характер.
 *
 * Условие «без единой минуты работы» (ARENA §7) здесь обязательно: дело, над
 * которым человек три раза сидел и не закончил, — это большая задача, а не
 * избегание. Спрашивать про неё «не знаешь как?» — оскорбительно и неверно.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — не штрафует и не считает перенос провалом (ALTERNEYT: перенос — данные);
 *  — не возвращает готовых предложений: только сырые значения, фразу на
 *    конкретном языке собирает вызывающий код (RU/EN/DE/UK/ES);
 *  — не выбирает больше одного дела за раз (гейт BOUNDARIES §5: назвать
 *    человеку три его проблемы — способ не починить ни одной).
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeStuckTask(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StuckTaskV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildStuckTask() {
  'use strict';

  const VERSION = '1.0.0';

  // Порог намеренно консервативный — тот же принцип, что у BOUNDARY_PATTERNS:
  // ложное срабатывание раздражает сильнее, чем молчание. На 3 переносах фраза
  // читается как «переезжает четвёртый раз», и это уже трудно списать на случай.
  const ASK_AFTER = 3;

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }

  // Разница в днях по UTC-полуночи: перевод часов не должен давать ±1 день.
  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return 0;
    const a = Date.parse(from + 'T00:00:00Z');
    const b = Date.parse(to + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  function countOf(task) {
    const n = Number(task && task.postponedCount);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  // Исходная дата дела: первая, с которой его начали двигать. До первого
  // переноса её ещё нет — тогда текущая дата и есть исходная.
  function firstDateOf(task) {
    if (!task) return null;
    if (isDay(task.firstDate)) return task.firstDate;
    return isDay(task.date) ? task.date : null;
  }

  /**
   * Патч счётчиков для переносимого дела. Вызывающий код делает
   * Object.assign(task, notePostpone(...)) — модуль ничего не мутирует сам,
   * чтобы перенос оставался одной транзакцией с сохранением (в app.js откат
   * при неудачной записи уже реализован через снимок `before`).
   *
   * Считается только настоящий перенос: дело УЖЕ должно было быть сделано
   * (date <= today) и уезжает ВПЕРЁД (nextDate > date). Правка расписания
   * будущего дела и перенос назад — не избегание, и счётчик не трогают.
   *
   * @param {{date?: string, postponedCount?: number, firstDate?: string}} task
   * @param {string} nextDate — YYYY-MM-DD, куда переносим
   * @param {string} today — YYYY-MM-DD
   * @returns {{postponedCount: number, firstDate: string}|null} null = не считаем
   */
  function notePostpone(task, nextDate, today) {
    if (!task || !isDay(task.date) || !isDay(nextDate) || !isDay(today)) return null;
    if (nextDate <= task.date) return null;   // назад или на месте — не перенос
    if (task.date > today) return null;       // будущее дело: это планирование, не избегание
    return {
      postponedCount: countOf(task) + 1,
      firstDate: firstDateOf(task) || task.date,
    };
  }

  /**
   * Годится ли дело для вопроса. Отдельно от выбора — чтобы UI мог, например,
   * тихо подсветить такие дела, не задавая вопрос.
   *
   * `actualMin`/`startTime` — то самое «без единой минуты работы» из ARENA §7.
   * Если человек уже начинал, диагноз другой (большое дело), и вопрос неуместен.
   */
  function isStuck(task, today) {
    if (!task || task.done || task.amnesty) return false;
    if (!isDay(task.date) || !isDay(today)) return false;
    if (Number(task.actualMin) > 0) return false;
    if (task.startTime) return false;
    return countOf(task) >= ASK_AFTER;
  }

  /**
   * Одно дело, про которое стоит спросить, или null.
   *
   * Порядок: больше переносов → раньше заведено → id. Последний ключ нужен для
   * детерминизма: без него при равных счётчиках выбор скакал бы между рендерами
   * и вопрос «менял» бы дело на глазах у человека.
   *
   * Возвращает СЫРЫЕ значения, а не собранную фразу — по той же причине, что и
   * day-observation-v1: число внутри предложения не ловится словарным переводом.
   *
   * @param {Array} tasks
   * @param {string} today — YYYY-MM-DD
   * @returns {{id:*, count:number, firstDate:(string|null), daysStuck:number}|null}
   */
  function stuckPick(tasks, today) {
    const list = (Array.isArray(tasks) ? tasks : []).filter((t) => isStuck(t, today));
    if (!list.length) return null;
    list.sort((a, b) => {
      const d = countOf(b) - countOf(a);
      if (d) return d;
      const fa = firstDateOf(a) || '', fb = firstDateOf(b) || '';
      if (fa !== fb) return fa < fb ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    });
    const top = list[0];
    const first = firstDateOf(top);
    return {
      id: top.id,
      count: countOf(top),
      firstDate: first,
      daysStuck: first ? Math.max(0, daysBetween(first, today)) : 0,
    };
  }

  return { VERSION, ASK_AFTER, notePostpone, isStuck, stuckPick, daysBetween };
});
