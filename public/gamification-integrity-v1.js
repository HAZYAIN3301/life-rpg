/* Satoru Gamification Integrity v1.
 *
 * Pure migrations and read-only projections used by the Actionable Gamification
 * v214 cleanup. This module deliberately has no resource-award or punishment
 * operation: it can rename persisted data, identify historical synthetic ledger
 * rows, describe overdue work, and move legacy oaths into CommitmentV1.
 */
(function exposeGamificationIntegrity(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GamificationIntegrityV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGamificationIntegrity() {
  'use strict';

  const VERSION = '1.0.0';
  const LEGACY_REWARD_KIND = 'lootLuck';
  const REWARD_KIND = 'dailyRewardGoldPct';
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const LEGACY_RECKON_ID = /^reckon_(\d{4}-\d{2}-\d{2})$/;
  const LEGACY_OATH_ID = /^oath_.+$/;
  const REVIEW_ACTIONS = Object.freeze(['revise', 'reschedule', 'release']);

  function isRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  // A completed legacy oath, or an active oath beyond CommitmentV1's live cap,
  // still belongs in history. Append it only inside this migration candidate and
  // close it immediately, so the returned state never exceeds the active cap.
  function appendForImmediateClose(state, draft, CommitmentV1) {
    const expanded = CommitmentV1.normalize({
      ...state,
      items: (Array.isArray(state.items) ? state.items : []).concat([draft]),
    });
    const matches = expanded.items.filter((item) => item.id === draft.id);
    return matches.length === 1 ? expanded : null;
  }

  function clone(value, seen) {
    if (value == null || typeof value !== 'object') return value;
    const memo = seen || new WeakMap();
    if (memo.has(value)) return memo.get(value);
    if (Array.isArray(value)) {
      const out = [];
      memo.set(value, out);
      for (const item of value) out.push(clone(item, memo));
      return out;
    }
    const out = {};
    memo.set(value, out);
    for (const key of Object.keys(value)) out[key] = clone(value[key], memo);
    return out;
  }

  function isDay(value) {
    if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function dayFrom(value, fallback) {
    if (typeof value === 'string') {
      const candidate = value.slice(0, 10);
      if (isDay(candidate)) return candidate;
    }
    return fallback;
  }

  function treeList(root) {
    if (!isRecord(root)) return null;
    if (Object.prototype.hasOwnProperty.call(root, 'nodes')) return Array.isArray(root.nodes) ? [root] : null;
    const values = Object.values(root);
    if (!values.length) return [];
    if (values.some((tree) => !isRecord(tree) || !Array.isArray(tree.nodes))) return null;
    return values;
  }

  function validTreeState(root) {
    const trees = treeList(root);
    if (!trees) return false;
    return trees.every((tree) => tree.nodes.every((node) => {
      if (!isRecord(node)) return false;
      return node.perks == null || (Array.isArray(node.perks) && node.perks.every(isRecord));
    }));
  }

  /**
   * Rename the misleading chance-like reward perk throughout one tree or a map of
   * trees. If canonical and legacy entries coexist in a node, the first canonical
   * entry is retained and every legacy/duplicate target entry is removed. Values
   * are never added together.
   */
  function migrateRewardPerks(treeState) {
    const state = clone(treeState);
    if (!validTreeState(state)) {
      return { ok: false, error: 'invalid_tree_state', changed: false, state, migrated: 0, removedDuplicates: 0 };
    }
    let changed = false;
    let migrated = 0;
    let removedDuplicates = 0;
    for (const tree of treeList(state)) {
      for (const node of tree.nodes) {
        if (!Array.isArray(node.perks) || !node.perks.length) continue;
        const canonicalIndex = node.perks.findIndex((perk) => perk.kind === REWARD_KIND);
        const legacyIndex = node.perks.findIndex((perk) => perk.kind === LEGACY_REWARD_KIND);
        if (canonicalIndex < 0 && legacyIndex < 0) continue;
        const winnerIndex = canonicalIndex >= 0 ? canonicalIndex : legacyIndex;
        const targetCount = node.perks.filter((perk) => perk.kind === REWARD_KIND || perk.kind === LEGACY_REWARD_KIND).length;
        const next = [];
        node.perks.forEach((perk, index) => {
          const target = perk.kind === REWARD_KIND || perk.kind === LEGACY_REWARD_KIND;
          if (!target) {
            next.push(perk);
            return;
          }
          if (index !== winnerIndex) return;
          next.push(perk.kind === REWARD_KIND ? perk : { ...perk, kind: REWARD_KIND });
        });
        const legacyCount = node.perks.filter((perk) => perk.kind === LEGACY_REWARD_KIND).length;
        if (legacyCount > 0 || targetCount > 1) {
          node.perks = next;
          changed = true;
          migrated += legacyCount;
          removedDuplicates += Math.max(0, targetCount - 1);
        }
      }
    }
    return { ok: true, changed, state, migrated, removedDuplicates };
  }

  /** Classifies only the historical ledger rows created by Control v1. */
  function legacyPenaltyPurchase(purchase) {
    if (!isRecord(purchase)) return false;
    const id = typeof purchase.id === 'string' ? purchase.id : '';
    const reckonMatch = id.match(LEGACY_RECKON_ID);
    if ((reckonMatch && isDay(reckonMatch[1])) || LEGACY_OATH_ID.test(id)) return true;
    if (purchase.source === 'legacy-control-v1' && (purchase.type === 'reckoning' || purchase.type === 'oath-burn')) return true;
    return purchase.type === 'legacy-control-reckoning' || purchase.type === 'legacy-oath-burn';
  }

  /** Returns the amount an ordinary purchase contributes to spent balance. */
  function spendablePurchaseCost(purchase) {
    if (!isRecord(purchase) || legacyPenaltyPurchase(purchase)) return 0;
    const raw = purchase.cost;
    const numeric = typeof raw === 'number'
      ? raw
      : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > Number.MAX_SAFE_INTEGER) return 0;
    return numeric;
  }

  function dayDistance(from, to) {
    return Math.round((Date.parse(to + 'T00:00:00.000Z') - Date.parse(from + 'T00:00:00.000Z')) / 86400000);
  }

  /**
   * A read-only Control review. It describes overdue work and reversible choices;
   * it does not update the tasks and has no access to any resource ledger.
   */
  function controlReview(tasks, day) {
    if (!Array.isArray(tasks) || !isDay(day)) return Object.freeze([]);
    const rows = [];
    tasks.forEach((task, index) => {
      if (!isRecord(task) || task.done === true || task.archived === true || task.deletedAt) return;
      if (!isDay(task.date) || task.date >= day) return;
      if (typeof task.id !== 'string' && typeof task.id !== 'number') return;
      rows.push(Object.freeze({
        taskId: String(task.id),
        title: typeof task.title === 'string' ? task.title : '',
        date: task.date,
        daysOverdue: dayDistance(task.date, day),
        actions: REVIEW_ACTIONS,
        _order: index,
      }));
    });
    rows.sort((a, b) => a.date.localeCompare(b.date) || a._order - b._order);
    const clean = rows.map((row) => Object.freeze({
      taskId: row.taskId,
      title: row.title,
      date: row.date,
      daysOverdue: row.daysOverdue,
      actions: row.actions,
    }));
    return Object.freeze(clean);
  }

  function validCommitmentApi(api) {
    return isRecord(api) && ['normalize', 'add', 'mark', 'archive', 'release'].every((name) => typeof api[name] === 'function');
  }

  function oathOutcome(task, oath) {
    if (oath.missed === true || oath.burned === true) return 'miss';
    if (oath.kept === true || task.done === true) return 'win';
    return null;
  }

  function commitmentDraft(task, oath, id, day) {
    const title = typeof task.title === 'string' && task.title.trim() ? task.title.trim() : 'Квест';
    const plannedDay = isDay(task.date) ? task.date : day;
    return {
      id,
      kind: 'step',
      title,
      win: 'Завершить выбранный квест без ставки ресурсами',
      edge: { kind: 'trigger', on: 'до ' + plannedDay },
      core: task.core === true,
      modes: [],
      decidedOn: dayFrom(oath.at, day),
    };
  }

  /**
   * Move legacy q.oath records into CommitmentV1. Migration is per-task fail
   * closed: an oath is removed only after its target commitment exists. Completed
   * outcomes are recorded and archived; an active one remains live and linked.
   */
  function migrateLegacyOaths(tasks, commitmentState, CommitmentV1, day) {
    const clonedTasks = clone(tasks);
    if (!Array.isArray(clonedTasks) || !isDay(day) || !validCommitmentApi(CommitmentV1)) {
      return {
        ok: false,
        error: 'invalid_input',
        tasks: Array.isArray(clonedTasks) ? clonedTasks : [],
        commitmentState: validCommitmentApi(CommitmentV1) ? CommitmentV1.normalize(commitmentState) : clone(commitmentState),
        migrated: 0,
        linked: 0,
        archived: 0,
        errors: [],
      };
    }

    const originalTasks = clone(clonedTasks);
    const originalState = CommitmentV1.normalize(commitmentState);
    let state = originalState;
    let migrated = 0;
    let linked = 0;
    let archived = 0;
    const errors = [];

    for (const task of clonedTasks) {
      if (!isRecord(task) || !Object.prototype.hasOwnProperty.call(task, 'oath')) continue;
      if (!isRecord(task.oath)) {
        errors.push({ taskId: isRecord(task) && task.id != null ? String(task.id) : null, error: 'invalid_oath' });
        continue;
      }
      if ((typeof task.id !== 'string' && typeof task.id !== 'number') || String(task.id) === '') {
        errors.push({ taskId: null, error: 'missing_task_id' });
        continue;
      }
      const taskId = String(task.id);
      const commitmentId = 'quest:' + taskId;
      const outcome = oathOutcome(task, task.oath);
      let overflowRelease = false;
      let existing = Array.isArray(state.items) ? state.items.find((item) => item.id === commitmentId) : null;

      if (existing && existing.kind !== 'step') {
        errors.push({ taskId, error: 'commitment_id_collision' });
        continue;
      }
      if (existing && existing.archivedAt && !outcome) {
        errors.push({ taskId, error: 'archived_commitment_collision' });
        continue;
      }
      if (!existing) {
        const added = CommitmentV1.add(state, commitmentDraft(task, task.oath, commitmentId, day));
        if (added && added.ok === true && added.state) {
          state = added.state;
          existing = state.items.find((item) => item.id === commitmentId);
        } else if (added && added.error === 'limit') {
          const expanded = appendForImmediateClose(
            state, commitmentDraft(task, task.oath, commitmentId, day), CommitmentV1,
          );
          if (!expanded) {
            errors.push({ taskId, error: 'commitment_overflow_archive_failed' });
            continue;
          }
          state = expanded;
          existing = state.items.find((item) => item.id === commitmentId);
          overflowRelease = !outcome;
        } else {
          errors.push({ taskId, error: added && added.error ? added.error : 'commitment_add_failed' });
          continue;
        }
      }

      task.commitmentId = commitmentId;
      delete task.oath;
      migrated += 1;
      linked += 1;

      if (outcome) {
        const outcomeDay = outcome === 'win'
          ? dayFrom(task.completedAt, isDay(task.date) ? task.date : day)
          : (isDay(task.date) ? task.date : day);
        state = CommitmentV1.mark(state, commitmentId, outcomeDay, outcome);
        existing = state.items.find((item) => item.id === commitmentId);
        if (!existing || !existing.archivedAt) state = CommitmentV1.archive(state, commitmentId, outcomeDay);
        archived += 1;
      } else if (overflowRelease) {
        const released = CommitmentV1.release(state, commitmentId, day);
        if (!released || released.ok !== true || !released.state) {
          errors.push({ taskId, error: 'commitment_overflow_archive_failed' });
          continue;
        }
        state = released.state;
        archived += 1;
      }
    }

    // One malformed/colliding row invalidates the whole migration candidate.
    // The caller can surface recovery without ever persisting a partial cleanup.
    if (errors.length) {
      return {
        ok: false,
        tasks: originalTasks,
        commitmentState: originalState,
        migrated: 0,
        linked: 0,
        archived: 0,
        errors,
      };
    }

    return {
      ok: true,
      tasks: clonedTasks,
      commitmentState: state,
      migrated,
      linked,
      archived,
      errors,
    };
  }

  return Object.freeze({
    VERSION,
    LEGACY_REWARD_KIND,
    REWARD_KIND,
    REVIEW_ACTIONS,
    migrateRewardPerks,
    legacyPenaltyPurchase,
    spendablePurchaseCost,
    controlReview,
    migrateLegacyOaths,
  });
});
