/* Satoru Goals Initiatives v1
 *
 * Pure data layer for the calm Goals screen. Initiatives are deliberately
 * separate from parentId: parentId explains why one goal depends on another,
 * while groupId says which real-life project/context the goal belongs to.
 * No DOM, State or network access lives here so the same contract can be
 * validated by the browser, server and tests.
 */
(function exposeGoalsInitiatives(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GoalsInitiativesV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGoalsInitiatives() {
  'use strict';

  const GROUP_STATUSES = new Set(['active', 'paused', 'archived']);
  const FOCUS_TYPES = new Set(['short', 'recurring', 'mid', 'long']);

  function validateGroups(value) {
    if (!Array.isArray(value)) return false;
    const ids = new Set();
    return value.every((group) => group && typeof group === 'object' && !Array.isArray(group)
      && typeof group.id === 'string' && !!group.id.trim() && !ids.has(group.id) && (ids.add(group.id), true)
      && typeof group.title === 'string' && !!group.title.trim()
      && (group.status == null || GROUP_STATUSES.has(group.status))
      && (group.createdAt == null || typeof group.createdAt === 'string'));
  }

  function normalizeGroups(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.filter((group) => group && typeof group === 'object' && !Array.isArray(group)
      && typeof group.id === 'string' && group.id.trim() && !seen.has(group.id) && (seen.add(group.id), true)
      && typeof group.title === 'string' && group.title.trim())
      .map((group) => ({
        ...group,
        id: group.id.trim(),
        title: group.title.trim().slice(0, 80),
        status: GROUP_STATUSES.has(group.status) ? group.status : 'active',
        createdAt: typeof group.createdAt === 'string' ? group.createdAt : '',
      }));
  }

  function reconcileGoalLinks(goals, groups) {
    const ids = new Set(normalizeGroups(groups).map((group) => group.id));
    for (const goal of Array.isArray(goals) ? goals : []) {
      if (goal.groupId != null && (typeof goal.groupId !== 'string' || !ids.has(goal.groupId))) goal.groupId = null;
    }
    return goals;
  }

  function focusEligible(goal) {
    return !!goal && !goal.archived && !goal.completedAt && (!goal.status || goal.status === 'active')
      && FOCUS_TYPES.has(goal.type || 'mid');
  }

  function rankGoals(goals, { today = '', nextAction = () => null } = {}) {
    const typeRank = { short: 0, recurring: 1, mid: 2, long: 3 };
    return (Array.isArray(goals) ? goals : []).filter(focusEligible).sort((a, b) => {
      const ao = a.targetDate && today && a.targetDate < today ? 0 : 1;
      const bo = b.targetDate && today && b.targetDate < today ? 0 : 1;
      const an = nextAction(a) ? 0 : 1;
      const bn = nextAction(b) ? 0 : 1;
      const ad = a.targetDate || '9999-12-31';
      const bd = b.targetDate || '9999-12-31';
      return ao - bo || an - bn || String(ad).localeCompare(String(bd))
        || (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9)
        || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
  }

  function focusModel({ goals = [], groups = [], today = '', nextAction = () => null, maxInitiatives = 3, maxUngrouped = 3 } = {}) {
    const normalized = normalizeGroups(groups);
    const activeGroups = normalized.filter((group) => group.status === 'active');
    const initiatives = [];
    for (const group of activeGroups) {
      const candidates = rankGoals(goals.filter((goal) => goal.groupId === group.id), { today, nextAction });
      if (!candidates.length) continue;
      initiatives.push({ group, goal: candidates[0], total: candidates.length, hasNextAction: !!nextAction(candidates[0]) });
    }
    initiatives.sort((a, b) => Number(b.hasNextAction) - Number(a.hasNextAction)
      || String(a.group.createdAt || '').localeCompare(String(b.group.createdAt || ''))
      || a.group.title.localeCompare(b.group.title));
    const ungrouped = rankGoals(goals.filter((goal) => !goal.groupId), { today, nextAction }).slice(0, maxUngrouped);
    return {
      initiatives: initiatives.slice(0, maxInitiatives),
      hiddenInitiatives: Math.max(0, initiatives.length - maxInitiatives),
      ungrouped,
    };
  }

  return Object.freeze({ validateGroups, normalizeGroups, reconcileGoalLinks, focusEligible, rankGoals, focusModel });
});
