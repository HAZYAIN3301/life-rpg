/* Satoru Day Load v1 — «много ли сделано сегодня» вместо выдуманной шкалы энергии.
 *
 * Решение Альберта 17.08: энергию как отдельную концепцию убрать. Причина названа им же —
 * она ничего конкретного не мерила. Полоска на 100 единиц, тратящаяся по 6 за обычное дело
 * и растущая на 7 в час, — это не состояние человека, а число, которое приложение придумало
 * само. Без импорта чего-то настоящего (Garmin Body Battery, сон, пульс) честнее его не
 * показывать вовсе, чем показывать красиво и неправдиво.
 *
 * Что приходит на замену — две вещи, обе выведенные из реального поведения:
 *   1) СЕГОДНЯ — этот модуль: сколько закрыто сегодня против ОБЫЧНОГО дня самого человека;
 *   2) ПО СФЕРАМ — сытость питомцев (`petStats` в app.js), она уже считается из опыта сферы
 *      за 10 дней со спадом, и сложность в неё уже входит через множитель XP.
 *
 * Норма не задаётся константой: обычный день у каждого свой, и он меняется. Медиана
 * приезжает снаружи — из `FailureContextV1.typicalDone()`, того же источника, которым
 * пользуются контекст провала и подсказка после срыва. Второй расчёт «обычного дня» в
 * проекте появиться не должен: два модуля разошлись бы в ответе про один и тот же день.
 *
 * Чистый модуль: на вход числа, на выход данные. Ни DOM, ни State, ни переводчика.
 */
(function exposeDayLoad(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DayLoadV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDayLoad() {
  'use strict';

  const VERSION = '1.0.0';

  // Границы в долях от обычного дня. Не круглые «100%» намеренно: обычный день это медиана,
  // и колебание ±30% вокруг неё — это тот же самый обычный день, а не событие.
  const LIGHT = 0.5;   // ниже — день заметно легче обычного
  const HEAVY = 1.4;   // выше — заметно тяжелее
  const OVER = 2.2;    // выше — день, после которого стоит сказать «хватит»

  function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }

  /**
   * Нагрузка дня.
   *
   * @param {{done?:number, typical?:number|null}} input
   *   done    — сколько дел реально закрыто сегодня
   *   typical — медиана обычного дня; null, если наблюдений слишком мало
   * @returns {{state:string, done:number, typical:number|null, ratio:number|null, known:boolean}}
   *
   * `state === 'unknown'` — это НЕ ошибка и не ноль. Это единственный честный ответ, пока
   * человек не прожил в приложении достаточно дней: сравнивать сегодня не с чем. Вызывающий
   * код обязан в этом случае вести себя нейтрально, а не считать день лёгким.
   */
  function dayLoad(input) {
    const inp = input || {};
    const done = num(inp.done);
    const typical = inp.typical == null ? null : num(inp.typical);
    if (!typical) return { state: 'unknown', done, typical: null, ratio: null, known: false };
    const ratio = done / typical;
    const state = ratio >= OVER ? 'over' : ratio >= HEAVY ? 'heavy' : ratio <= LIGHT ? 'light' : 'normal';
    return { state, done, typical, ratio: Math.round(ratio * 100) / 100, known: true };
  }

  /**
   * Устал ли человек СЕГОДНЯ — единственный вопрос, на который отвечала старая шкала.
   *
   * Раньше «устал» означало «полоска ниже 30», то есть в том числе — «давно не заходил,
   * полоска не успела восстановиться». Человек мог ничего не делать неделю и получить
   * уставшего аватара. Теперь усталость наступает от СДЕЛАННОГО, а это ровно то, от чего
   * она наступает в жизни.
   */
  function isTired(load) { return !!load && (load.state === 'heavy' || load.state === 'over'); }

  /** Стоит ли предложить остановиться. Только явный перебор, не «чуть больше обычного». */
  function shouldSuggestStop(load) { return !!load && load.state === 'over'; }

  return { VERSION, LIGHT, HEAVY, OVER, dayLoad, isTired, shouldSuggestStop };
});
