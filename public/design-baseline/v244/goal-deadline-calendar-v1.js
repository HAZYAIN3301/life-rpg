/* Satoru Goal deadlines on the calendar v1
 *
 * Дедлайн цели — это дата, которую человек назначил сам. Календарь — единственное
 * место в приложении, где живут даты, и он про эти даты не знал: `renderCalendarView`
 * не обращался к `State.goals` ни разу. Дата ставилась в цели и дальше существовала
 * только в памяти человека.
 *
 * Здесь считается, какие дедлайны падают на какой день. Ничего не выдумывается:
 * календарно невозможная дата (`2026-02-31`) днём не становится, цель без названия
 * не показывается, а архивные и уже достигнутые цели в план будущего не попадают —
 * тем же правилом, каким их отбирает контекст ассистента.
 *
 * Модуль чистый: без DOM, State, сети и чтения часов. «Сегодня» здесь не нужно:
 * ячейка календаря сама является датой, и просрочка на ней — не факт, а вывод.
 */
(function exposeGoalDeadlineCalendar(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GoalDeadlineCalendarV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGoalDeadlineCalendar() {
  'use strict';

  const TITLE_MAX = 80;
  const EMPTY = Object.freeze([]);

  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function nonEmptyString(value) { return typeof value === 'string' && !!value.trim(); }

  function validDate(raw) {
    if (typeof raw !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  /**
   * Попадает ли цель в план будущего. Архивная убрана из плана намеренно, достигнутая
   * уже позади: их даты — история, и в календаре они были бы шумом, а не сроком.
   */
  function plannedGoal(goal) {
    return isObject(goal)
      && nonEmptyString(goal.id)
      && nonEmptyString(goal.title)
      && !goal.archived
      && !goal.completedAt
      && validDate(goal.targetDate);
  }

  /** Индекс «дата → дедлайны этого дня». Строится один раз на отрисовку календаря. */
  function deadlinesByDate(goals) {
    const index = new Map();
    if (!Array.isArray(goals)) return index;
    const seen = new Set();
    for (const goal of goals) {
      if (!plannedGoal(goal) || seen.has(String(goal.id))) continue;
      seen.add(String(goal.id));
      const row = { goalId: String(goal.id), title: goal.title.trim().slice(0, TITLE_MAX) };
      const day = index.get(goal.targetDate);
      if (day) day.push(row); else index.set(goal.targetDate, [row]);
    }
    // Порядок не должен зависеть от того, в каком порядке цели легли в файл:
    // один и тот же день обязан рисоваться одинаково при каждой отрисовке.
    for (const rows of index.values()) {
      rows.sort((a, b) => a.title.localeCompare(b.title) || a.goalId.localeCompare(b.goalId));
    }
    return index;
  }

  /** Дедлайны конкретного дня. Пустой день отвечает одним и тем же пустым массивом. */
  function forDate(index, date) {
    if (!(index instanceof Map) || !validDate(date)) return EMPTY;
    return index.get(date) || EMPTY;
  }

  return Object.freeze({ deadlinesByDate, forDate });
});
