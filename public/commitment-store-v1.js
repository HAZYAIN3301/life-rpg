/* Satoru Commitment Store v1.
 *
 * Strict, pure validation for the atomic settings + tasks persistence boundary.
 * CommitmentV1 is intentionally forgiving while reading old/local data; this
 * server boundary is intentionally not. A malformed candidate must be rejected
 * before either account file is written.
 */
(function exposeCommitmentStore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CommitmentStoreV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCommitmentStore() {
  'use strict';

  const VERSION = '1.0.0';
  const MAX_COMMIT_BYTES = 4 * 1024 * 1024;
  const MAX_ACTIVE_ITEMS = 12;
  const MAX_STORED_ITEMS = 1000;
  const MAX_TITLE = 80;
  const MAX_WIN = 120;
  const MAX_ID = 200;
  const MAX_MODE = 24;
  const MAX_HISTORY = 30;
  const MAX_LOG_DAYS = 3660;
  const KINDS = new Set(['step', 'edge', 'moment', 'anchor', 'care']);
  const BASE_KEYS = new Set(['exists', 'value']);
  const STATE_KEYS = new Set(['version', 'mode', 'items', 'log']);
  const ITEM_KEYS = new Set([
    'id', 'kind', 'title', 'win', 'edge', 'core', 'modes', 'history',
    'decidedOn', 'revisedOn', 'budget', 'archivedAt',
  ]);
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

  function isRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  function boundedOpaqueId(value, max) {
    return typeof value === 'string' && value.length > 0 && value.length <= max
      && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function exactKeys(value, allowed, required) {
    if (!isRecord(value)) return false;
    const keys = Object.keys(value);
    if (keys.some((key) => !allowed.has(key))) return false;
    return required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
  }

  function isDay(value) {
    if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function boundedText(value, max) {
    return typeof value === 'string' && value.length > 0 && value.length <= max
      && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function edgeValid(edge) {
    if (!isRecord(edge) || typeof edge.kind !== 'string') return false;
    if (edge.kind === 'none') return exactKeys(edge, new Set(['kind']), ['kind']);
    if (edge.kind === 'time') {
      return exactKeys(edge, new Set(['kind', 'at']), ['kind', 'at']) && typeof edge.at === 'string' && HHMM.test(edge.at);
    }
    if (edge.kind === 'window') {
      return exactKeys(edge, new Set(['kind', 'from', 'to']), ['kind', 'from', 'to'])
        && typeof edge.from === 'string' && HHMM.test(edge.from)
        && typeof edge.to === 'string' && HHMM.test(edge.to);
    }
    if (edge.kind === 'trigger') {
      return exactKeys(edge, new Set(['kind', 'on']), ['kind', 'on']) && boundedText(edge.on, 40);
    }
    return false;
  }

  function budgetValid(budget) {
    return exactKeys(budget, new Set(['misses', 'perDays']), ['misses', 'perDays'])
      && Number.isInteger(budget.misses) && budget.misses >= 1 && budget.misses <= 7
      && Number.isInteger(budget.perDays) && budget.perDays >= 2 && budget.perDays <= 60;
  }

  function historyEntryValid(entry) {
    if (!isRecord(entry) || !isDay(entry.day)) return false;
    if (entry.type === 'released') {
      return exactKeys(entry, new Set(['type', 'day']), ['type', 'day']);
    }
    if (entry.type === 'revised') {
      return exactKeys(entry, new Set(['type', 'day', 'from', 'to']), ['type', 'day', 'from', 'to'])
        && edgeValid(entry.from) && edgeValid(entry.to);
    }
    return false;
  }

  function itemValid(item) {
    if (!exactKeys(item, ITEM_KEYS, ['id', 'kind', 'title', 'win', 'edge', 'core', 'modes', 'history'])) return false;
    if (!boundedOpaqueId(item.id, MAX_ID) || !KINDS.has(item.kind)) return false;
    if (!boundedText(item.title, MAX_TITLE) || !boundedText(item.win, MAX_WIN)) return false;
    if (!edgeValid(item.edge) || typeof item.core !== 'boolean') return false;
    if (!Array.isArray(item.modes) || item.modes.length > 24) return false;
    const modes = new Set();
    for (const mode of item.modes) {
      if (!boundedText(mode, MAX_MODE) || modes.has(mode)) return false;
      modes.add(mode);
    }
    if (!Array.isArray(item.history) || item.history.length > MAX_HISTORY || !item.history.every(historyEntryValid)) return false;
    for (const key of ['decidedOn', 'revisedOn', 'archivedAt']) {
      if (item[key] != null && !isDay(item[key])) return false;
    }
    if (item.budget != null && !budgetValid(item.budget)) return false;
    return true;
  }

  function validateCommitmentState(value) {
    if (!exactKeys(value, STATE_KEYS, ['version', 'mode', 'items', 'log'])) return false;
    if (value.version !== 1 || !boundedText(value.mode, MAX_MODE)) return false;
    if (!Array.isArray(value.items) || value.items.length > MAX_STORED_ITEMS) return false;
    const ids = new Set();
    for (const item of value.items) {
      if (!itemValid(item) || ids.has(item.id)) return false;
      ids.add(item.id);
    }
    if (value.items.filter((item) => !item.archivedAt).length > MAX_ACTIVE_ITEMS) return false;
    if (!isRecord(value.log) || Object.keys(value.log).length > MAX_LOG_DAYS) return false;
    for (const [day, row] of Object.entries(value.log)) {
      if (!isDay(day) || !isRecord(row)) return false;
      const resultIds = Object.keys(row);
      if (resultIds.length > MAX_STORED_ITEMS) return false;
      for (const id of resultIds) {
        if (!ids.has(id) || (row[id] !== 'win' && row[id] !== 'miss')) return false;
      }
    }
    return true;
  }

  function validateTaskGraph(tasks, commitmentState) {
    if (!Array.isArray(tasks) || tasks.length > 10000 || !validateCommitmentState(commitmentState)) return false;
    const taskIds = new Set();
    const linkedCommitments = new Set();
    const commitmentIds = new Set(commitmentState.items.map((item) => item.id));
    for (const task of tasks) {
      if (!isRecord(task) || !boundedOpaqueId(task.id, 180) || taskIds.has(task.id)) return false;
      taskIds.add(task.id);
      if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 1000) return false;
      if (Object.prototype.hasOwnProperty.call(task, 'oath')) return false;
      if (task.commitmentId == null) continue;
      if (typeof task.commitmentId !== 'string' || task.commitmentId !== 'quest:' + task.id) return false;
      if (!commitmentIds.has(task.commitmentId) || linkedCommitments.has(task.commitmentId)) return false;
      linkedCommitments.add(task.commitmentId);
    }
    for (const item of commitmentState.items) {
      if (!item.id.startsWith('quest:')) continue;
      if (item.kind !== 'step' || (!item.archivedAt && !linkedCommitments.has(item.id))) return false;
    }
    return true;
  }

  function baseSnapshotValid(snapshot, expected) {
    if (!exactKeys(snapshot, BASE_KEYS, ['exists', 'value']) || typeof snapshot.exists !== 'boolean') return false;
    if (!snapshot.exists) return snapshot.value === null;
    return expected === 'array' ? Array.isArray(snapshot.value) : isRecord(snapshot.value);
  }

  function validateCommitPayload(payload) {
    if (!exactKeys(payload, new Set(['base', 'data']), ['base', 'data'])) return false;
    if (!exactKeys(payload.base, new Set(['settings', 'tasks']), ['settings', 'tasks'])) return false;
    if (!baseSnapshotValid(payload.base.settings, 'object') || !baseSnapshotValid(payload.base.tasks, 'array')) return false;
    const data = payload.data;
    if (!exactKeys(data, new Set(['settings', 'tasks']), ['settings', 'tasks'])) return false;
    if (!isRecord(data.settings) || !Object.prototype.hasOwnProperty.call(data.settings, 'commitmentsV1')) return false;
    if (!validateCommitmentState(data.settings.commitmentsV1)) return false;
    return validateTaskGraph(data.tasks, data.settings.commitmentsV1);
  }

  return Object.freeze({
    VERSION,
    MAX_COMMIT_BYTES,
    MAX_ACTIVE_ITEMS,
    MAX_STORED_ITEMS,
    validateCommitmentState,
    validateTaskGraph,
    validateCommitPayload,
  });
});
