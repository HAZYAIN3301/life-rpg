/* Satoru Goal Step → Quest v1
 *
 * Один и тот же шаг цели человек до сих пор писал дважды: сначала как пункт
 * чек-листа («Первый шаг» в форме цели), потом заново руками в поле «Квест на
 * сегодня». День при этом про цели не знал ничего и здоровался с пустым
 * экраном. Здесь живёт мост между этими двумя записями одного факта.
 *
 * Модуль чистый: без DOM, State, сети и чтения часов. Дата и идентификатор
 * приходят параметрами, поэтому одну и ту же логику можно проверить тестом и
 * при необходимости выполнить на сервере.
 */
(function exposeGoalStepQuest(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GoalStepQuestV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGoalStepQuest() {
  'use strict';

  // Квест из шага собирается ровно теми же значениями, что и квест из формы
  // «Квест на сегодня». Два пути к одной записи не имеют права давать разные
  // квесты — иначе счёт дня зависел бы от того, каким путём человек шёл.
  const QUEST_ESTIMATE_MIN = 30;
  const QUEST_DIFFICULTY = 'normal';
  const TITLE_MAX = 160;

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

  function stepsOf(goal) { return isObject(goal) && Array.isArray(goal.steps) ? goal.steps : []; }

  function stepById(goal, stepId) {
    if (!nonEmptyString(stepId)) return null;
    return stepsOf(goal).find((step) => isObject(step) && String(step.id) === String(stepId)) || null;
  }

  /** Первый невыполненный пункт чек-листа — то, что цель показывает как «Следующий шаг». */
  function openStepOf(goal) {
    return stepsOf(goal).find((step) => isObject(step) && nonEmptyString(step.title) && !step.done) || null;
  }

  /** Связь квеста с шагом. Обе половины обязательны: без цели шаг не адресуется. */
  function stepLinkOf(task) {
    if (!isObject(task)) return null;
    if (!nonEmptyString(task.goalId) || !nonEmptyString(task.stepSourceId)) return null;
    return { goalId: String(task.goalId), stepId: String(task.stepSourceId) };
  }

  /**
   * Незакрытый квест этого шага, если он уже есть в списке. Совпадение ищется
   * только среди невыполненных: закрытый квест — это сделанное действие, а не
   * занятое место в дне, и повтор шага после него законен.
   */
  function questForStep(tasks, goalId, stepId) {
    if (!Array.isArray(tasks) || !nonEmptyString(goalId) || !nonEmptyString(stepId)) return null;
    return tasks.find((task) => {
      const link = stepLinkOf(task);
      return link && !task.done && link.goalId === String(goalId) && link.stepId === String(stepId);
    }) || null;
  }

  /**
   * Что произойдёт, если взять шаг в день.
   *
   * `exists` — квест уже стоит в дне, второй создавать нельзя.
   * `create` — вернётся готовая запись квеста; её остаётся дописать в список.
   * Остальные статусы означают, что делать нечего, и причина названа явно:
   * молчаливый отказ здесь неотличим от сломанной кнопки.
   */
  function planStepQuest(input) {
    const options = isObject(input) ? input : {};
    const goal = options.goal;
    if (!isObject(goal) || !nonEmptyString(goal.id)) return { status: 'invalid', reason: 'goal_missing' };
    if (goal.archived) return { status: 'invalid', reason: 'goal_archived' };
    if (!validDate(options.today)) return { status: 'invalid', reason: 'invalid_date' };
    if (!nonEmptyString(options.id)) return { status: 'invalid', reason: 'id_missing' };

    const step = stepById(goal, options.stepId);
    if (!step) return { status: 'step_missing' };
    if (!nonEmptyString(step.title)) return { status: 'step_missing' };
    if (step.done) return { status: 'step_done' };

    const tasks = Array.isArray(options.tasks) ? options.tasks : [];
    const existing = questForStep(tasks, goal.id, step.id);
    if (existing) return { status: 'exists', taskId: String(existing.id), task: existing };

    const skillIds = Array.isArray(options.skillIds) ? options.skillIds.filter(nonEmptyString) : [];
    const layers = Array.isArray(options.layers) ? options.layers.filter(nonEmptyString) : [];
    const skillId = nonEmptyString(options.skillId) ? options.skillId : (skillIds[0] || null);
    const task = {
      id: String(options.id),
      title: step.title.trim().slice(0, TITLE_MAX),
      goalId: String(goal.id),
      stepSourceId: String(step.id),
      skillId,
      skillIds,
      layers,
      estimateMin: QUEST_ESTIMATE_MIN,
      difficulty: QUEST_DIFFICULTY,
      date: options.today,
      done: false,
      completedAt: null,
      xpAwarded: 0,
      goldAwarded: 0,
      actualMin: null,
      startTime: null,
      createdAt: nonEmptyString(options.createdAt) ? options.createdAt : '',
    };
    return { status: 'create', taskId: task.id, task };
  }

  /**
   * Обратный ход: закрытый квест отмечает свой шаг, отменённый — снимает отметку.
   *
   * Снимается только та отметка, которую поставил сам квест (`stepTicked`).
   * Галочку, поставленную человеком руками, откат квеста не трогает: машина не
   * имеет права отменять решение, которого не принимала.
   */
  function applyStepOutcome(goals, task, done) {
    const source = Array.isArray(goals) ? goals : [];
    const unchanged = { changed: false, goals: source, taskPatch: null };
    const link = stepLinkOf(task);
    if (!link) return unchanged;

    const index = source.findIndex((goal) => isObject(goal) && String(goal.id) === link.goalId);
    if (index < 0) return unchanged;
    const step = stepById(source[index], link.stepId);
    if (!step) return unchanged;

    const wanted = !!done;
    if (wanted) {
      if (step.done) return unchanged;               // уже отмечен — не наша отметка, снимать нечего
    } else if (!step.done || task.stepTicked !== true) {
      return unchanged;                              // отмечал не квест: откат квеста это не отменяет
    }

    const nextGoal = { ...source[index], steps: stepsOf(source[index]).map((item) => (
      isObject(item) && String(item.id) === link.stepId ? { ...item, done: wanted } : item
    )) };
    const nextGoals = source.slice();
    nextGoals[index] = nextGoal;
    return { changed: true, goals: nextGoals, taskPatch: { stepTicked: wanted } };
  }

  return Object.freeze({
    QUEST_ESTIMATE_MIN, QUEST_DIFFICULTY,
    openStepOf, stepLinkOf, questForStep, planStepQuest, applyStepOutcome,
  });
});
