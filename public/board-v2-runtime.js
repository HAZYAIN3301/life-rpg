/* Satoru Board v2 — account transaction bridge.
 *
 * Converts a pure take/return/complete result into the one payload accepted by
 * `/api/board/commit`. It owns no DOM, fetch, State or persistence. The browser
 * persists first and publishes `result(transaction)` only after HTTP success.
 */
(function exposeBoardV2Runtime(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2Runtime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2Runtime() {
  'use strict';

  const VERSION = '1.0.0';
  const ACTIONS = Object.freeze(['take', 'return', 'complete']);
  const MAX_TITLES = 50;
  const issued = new WeakSet();

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && out.length <= max ? out : '';
  }
  function clone(value) { return structuredClone(value); }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function dependencies(source) {
    if (!plain(source) || !source.boardApi || !source.offersApi || !source.completionApi) return null;
    if (typeof source.boardApi.normalize !== 'function' || typeof source.offersApi.normalizeState !== 'function'
      || typeof source.completionApi.normalizeState !== 'function') return null;
    return source;
  }
  function preserveCustom(nextBoard, previousBoard) {
    const next = clone(nextBoard), custom = plain(previousBoard) && Array.isArray(previousBoard.custom) ? clone(previousBoard.custom) : [];
    if (custom.length) next.custom = custom;
    return next;
  }
  function titles(value) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      const id = text(item, 80); if (id && !out.includes(id)) out.push(id);
    }
    return out.slice(-MAX_TITLES);
  }
  function prepare(raw) {
    const source = dependencies(raw), action = text(raw && raw.action, 16);
    if (!source || !ACTIONS.includes(action) || !plain(source.settings) || !Array.isArray(source.tasks)) {
      return { ok: false, reason: 'invalid-runtime-context' };
    }
    const common = {
      boardApi: source.boardApi, offersApi: source.offersApi, pacingApi: source.pacingApi,
      board: source.settings.board, offers: source.settings.boardV2Offers,
      completion: source.settings.boardV2Completion, snapshotId: source.snapshotId,
      today: source.today,
    };
    let prepared;
    if (action === 'take') prepared = source.completionApi.prepareTake(common);
    else if (action === 'return') prepared = source.completionApi.prepareReturn(common);
    else {
      if (source.tasks.some((task) => task && (task.id === source.taskId
        || (task.fromBoardV2 === true && task.boardSnapshotId === source.snapshotId)))) {
        return { ok: false, reason: 'already-completed' };
      }
      prepared = source.completionApi.prepareCompletion({
        ...common, taskId: source.taskId, completedAt: source.completedAt,
        skillId: source.skillId, proof: source.proof,
      });
    }
    if (!prepared || prepared.ok !== true) return prepared || { ok: false, reason: 'prepare-failed' };

    const settings = clone(source.settings);
    settings.board = preserveCustom(prepared.board, source.settings.board);
    settings.boardV2Offers = clone(prepared.offers);
    settings.boardV2Completion = clone(prepared.completion || source.completionApi.normalizeState(source.settings.boardV2Completion));
    settings.boardV2Titles = titles(settings.boardV2Titles);
    if (prepared.unlock && prepared.unlock.type === 'title') {
      settings.boardV2Titles = titles(settings.boardV2Titles.concat(prepared.unlock.id));
    }
    const tasks = clone(source.tasks);
    if (action === 'complete') {
      const task = clone(prepared.task);
      if (prepared.proof) task.boardProof = clone(prepared.proof);
      tasks.push(task);
    }
    const data = { settings };
    if (action === 'complete') data.tasks = tasks;
    const transaction = deepFreeze({
      schema: 'satoru.board-runtime-transaction/2', action, snapshotId: prepared.snapshot.id,
      data, next: { settings, tasks: action === 'complete' ? tasks : null },
      effects: { unlock: prepared.unlock || null, proofPlan: prepared.proofPlan || null },
    });
    issued.add(transaction);
    return { ok: true, transaction };
  }
  function payload(transaction) {
    return issued.has(transaction) ? { data: clone(transaction.data) } : null;
  }
  function result(transaction) {
    return issued.has(transaction) ? clone(transaction.next) : null;
  }
  function effects(transaction) {
    return issued.has(transaction) ? clone(transaction.effects) : null;
  }

  return Object.freeze({ VERSION, ACTIONS, MAX_TITLES, prepare, payload, result, effects });
});
