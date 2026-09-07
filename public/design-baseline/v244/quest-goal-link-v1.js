/* Satoru Quest → Goal link v1
 *
 * День знал, какой цели служит квест, и не говорил этого. Связь `task.goalId`
 * существовала с самого начала, но на экране жила только внутри меню «•••»
 * конкретного квеста: слово «цель» на «Сегодня» не появлялось ни разу.
 * Здесь считается, что именно можно честно сказать про эту связь.
 *
 * Правило одно: молчать там, где нечего утверждать. Квест без цели, квест с
 * оборванной ссылкой на удалённую цель и цель без названия — три разных факта,
 * и ни один из них не повод нарисовать значок цели.
 *
 * Модуль чистый: без DOM, State, сети и чтения часов.
 */
(function exposeQuestGoalLink(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QuestGoalLinkV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildQuestGoalLink() {
  'use strict';

  // Состояния перечислены в порядке проверки: архив сильнее завершения, завершение
  // сильнее статуса. Иначе закрытая и убранная в архив цель выглядела бы активной.
  const STATES = Object.freeze(['archived', 'completed', 'waiting', 'paused', 'active']);
  const TITLE_MAX = 80;

  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function nonEmptyString(value) { return typeof value === 'string' && !!value.trim(); }

  function stateOf(goal) {
    if (!isObject(goal)) return null;
    if (goal.archived) return 'archived';
    if (goal.completedAt) return 'completed';
    if (goal.status === 'waiting' || goal.status === 'paused') return goal.status;
    return 'active';
  }

  // Индекс целей по id. Строится один раз на отрисовку, а не на каждый квест.
  function indexGoals(goals) {
    const index = new Map();
    if (!Array.isArray(goals)) return index;
    for (const goal of goals) {
      if (!isObject(goal) || !nonEmptyString(goal.id)) continue;
      if (!index.has(String(goal.id))) index.set(String(goal.id), goal);
    }
    return index;
  }

  function linkFromIndex(task, index) {
    if (!isObject(task) || !nonEmptyString(task.goalId)) return null;
    const goal = index.get(String(task.goalId));
    if (!goal || !nonEmptyString(goal.title)) return null;
    return { goalId: String(goal.id), title: goal.title.trim().slice(0, TITLE_MAX), state: stateOf(goal) };
  }

  /** Что честно сказать про один квест. `null` — сказать нечего. */
  function linkFor(task, goals) {
    return linkFromIndex(task, indexGoals(goals));
  }

  /** То же самое для списка: один проход по целям вместо поиска на каждый квест. */
  function linksFor(tasks, goals) {
    const index = indexGoals(goals), links = new Map();
    if (!Array.isArray(tasks)) return links;
    for (const task of tasks) {
      if (!isObject(task) || !nonEmptyString(task.id)) continue;
      const link = linkFromIndex(task, index);
      if (link) links.set(String(task.id), link);
    }
    return links;
  }

  return Object.freeze({ STATES, stateOf, linkFor, linksFor });
});
