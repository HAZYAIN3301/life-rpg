/* Satoru Habit two-minute version v1
 *
 * У каждой привычки человек однажды записал версию на две минуты — минимум,
 * с которого можно просто начать. Экран привычек прямо советует «возвращайся с
 * версии на две минуты» и до сих пор не показывал, какая версия записана: совет
 * отсылал к собственному ответу человека, которого нигде не видно.
 *
 * Здесь решается два вопроса: показывать ли этот выход и что записать, если им
 * воспользовались.
 *
 * Выход предлагается только когда серии нет — привычка либо новая, либо
 * прервалась. На идущей серии он не нужен и был бы лишней кнопкой в каждой
 * строке каждый день.
 *
 * Отметка засчитывает привычку целиком: показаться и есть смысл двухминутного
 * правила, а половинная отметка означала бы «ты сделал, но это не считается» —
 * то есть вину, которой в этом приложении не бывает. Честнее становится только
 * время: записываются две минуты, а не запланированные двадцать.
 *
 * Модуль чистый: без DOM, State, сети и чтения часов.
 */
(function exposeHabitTwoMinute(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HabitTwoMinuteV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildHabitTwoMinute() {
  'use strict';

  const MINUTES = 2;
  const TEXT_MAX = 200;

  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }

  function textOf(habit) {
    const atomic = isObject(habit) && isObject(habit.atomic) ? habit.atomic : null;
    const raw = atomic && typeof atomic.twoMin === 'string' ? atomic.twoMin.trim() : '';
    return raw ? raw.slice(0, TEXT_MAX) : '';
  }

  /**
   * Предлагать ли выход на две минуты. `null` — не предлагать, и это обычный ответ.
   *
   * @param {object} habit
   * @param {{done:boolean, streak:number}} state
   */
  function offerFor(habit, state) {
    const context = isObject(state) ? state : {};
    if (!isObject(habit) || context.done === true) return null;
    // Серия идёт — запасной вход не нужен: человек и так заходит.
    const streak = Number(context.streak);
    if (Number.isFinite(streak) && streak > 0) return null;
    const text = textOf(habit);
    return text ? { text, minutes: MINUTES } : null;
  }

  /**
   * Что записать в журнал. XP и золото приходят снаружи и не меняются: привычка
   * либо выполнена, либо нет, и меньшая версия не платит меньше — иначе выход,
   * придуманный против вины, сам бы её создавал.
   */
  function recordFor(input) {
    const options = isObject(input) ? input : {};
    const record = {
      xp: Number.isFinite(Number(options.xp)) ? Number(options.xp) : 0,
      gold: Number.isFinite(Number(options.gold)) ? Number(options.gold) : 0,
      min: MINUTES,
      // История обязана знать, какая версия была сделана: две минуты и двадцать —
      // разные факты о дне, даже когда отметка одна.
      twoMin: true,
    };
    if (typeof options.at === 'string' && options.at) record.at = options.at;
    return record;
  }

  return Object.freeze({ MINUTES, textOf, offerFor, recordFor });
});
