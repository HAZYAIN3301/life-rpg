/* Satoru Board v2 — atomic take/complete/return transaction model (dormant).
 *
 * The browser adapter persists the returned settings + task in the existing
 * `/api/board/commit` transaction. This pure module ensures the legacy active
 * ledger and the exact v2 snapshot advance together, derives authored rewards,
 * describes natural proof/media, and queues one useful Shadow follow-up.
 */
(function exposeBoardV2Completion(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2Completion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2Completion() {
  'use strict';

  const VERSION = '1.1.0';
  const STATE_SCHEMA = 'satoru.board-completion/2';
  const MAX_PENDING = 20;
  const MAX_RECORDS = 100;
  const OUTCOMES = Object.freeze(['helped', 'neutral', 'did-not-help']);
  const MEDIA_PROOF = Object.freeze(['photo', 'video']);

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && out.length <= max ? out : '';
  }
  function day(value) {
    const out = text(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(out) && Number.isFinite(Date.parse(`${out}T00:00:00Z`)) ? out : '';
  }
  function instant(value) {
    const out = text(value, 40);
    return out && Number.isFinite(Date.parse(out)) ? new Date(out).toISOString() : '';
  }
  function unique(value, max) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      const clean = text(item, max || 80);
      if (clean && !out.includes(clean)) out.push(clean);
    }
    return out;
  }
  function normalizePending(value) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      if (!plain(item)) continue;
      const snapshotId = text(item.snapshotId, 120), interventionId = text(item.interventionId, 80);
      const question = text(item.question, 220), completedAt = day(item.completedAt), contextTags = unique(item.contextTags, 64);
      if (!snapshotId || !interventionId || !question || !completedAt || !contextTags.length) continue;
      out.push({ snapshotId, interventionId, question, contextTags: contextTags.slice(0, 12), completedAt });
    }
    return out.slice(-MAX_PENDING);
  }
  function normalizeRecords(value) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      if (!plain(item)) continue;
      const interventionId = text(item.interventionId, 80), outcome = text(item.outcome, 24), at = day(item.at);
      const contextTags = unique(item.contextTags, 64);
      if (!interventionId || !OUTCOMES.includes(outcome) || !at || !contextTags.length) continue;
      out.push({ interventionId, outcome, contextTags: contextTags.slice(0, 12), at });
    }
    return out.slice(-MAX_RECORDS);
  }
  function emptyState() { return { schema: STATE_SCHEMA, pending: [], records: [] }; }
  function normalizeState(raw) {
    const source = plain(raw) && raw.schema === STATE_SCHEMA ? raw : {};
    return { schema: STATE_SCHEMA, pending: normalizePending(source.pending), records: normalizeRecords(source.records) };
  }
  function dependencies(input) {
    const source = plain(input) ? input : {};
    if (!source.boardApi || typeof source.boardApi.takeOrder !== 'function' || typeof source.boardApi.completeOrder !== 'function') return null;
    if (!source.offersApi || typeof source.offersApi.snapshotById !== 'function' || typeof source.offersApi.recordOutcome !== 'function') return null;
    return source;
  }
  function snapshot(input) {
    const source = dependencies(input); if (!source) return null;
    return source.offersApi.snapshotById(source.offers, source.snapshotId, source.pacingApi);
  }
  function proofPlan(value) {
    const snapshotValue = plain(value) ? value : {};
    const modes = unique(snapshotValue.completion && snapshotValue.completion.proofModes, 32).slice(0, 5);
    return {
      modes,
      required: !!(snapshotValue.completion && snapshotValue.completion.proofRequired),
      mediaModes: modes.filter((mode) => MEDIA_PROOF.includes(mode)),
      shareOptional: !!(snapshotValue.completion && snapshotValue.completion.share === 'optional'),
    };
  }
  function normalizeProof(snapshotValue, value) {
    const plan = proofPlan(snapshotValue);
    if (value == null) return plan.required ? { ok: false, reason: 'proof-required', plan } : { ok: true, proof: null, plan };
    if (!plain(value)) return { ok: false, reason: 'invalid-proof', plan };
    const mode = text(value.mode, 32);
    if (!plan.modes.includes(mode)) return { ok: false, reason: 'unsupported-proof', plan };
    const proof = { mode };
    const referenceId = text(value.referenceId, 120);
    const result = text(value.result, 280);
    if (MEDIA_PROOF.includes(mode) && !referenceId) return { ok: false, reason: 'media-reference-required', plan };
    if (['result', 'reflection', 'story'].includes(mode) && !result) return { ok: false, reason: 'result-required', plan };
    if (referenceId) proof.referenceId = referenceId;
    if (result) proof.result = result;
    return { ok: true, proof, plan };
  }
  function prepareTake(input) {
    const source = dependencies(input); if (!source) return { ok: false, reason: 'dependencies-required' };
    const questSnapshot = snapshot(source), today = day(source.today);
    if (!questSnapshot || !today) return { ok: false, reason: 'snapshot-required' };
    const board = source.boardApi.normalize(source.board);
    if (board.done.some((entry) => entry.orderId === questSnapshot.id)) return { ok: false, reason: 'already-completed' };
    const taken = source.boardApi.takeOrder(board, { id: questSnapshot.id }, today);
    if (!taken.ok) return { ok: false, reason: taken.error };
    return {
      ok: true, snapshot: questSnapshot,
      board: taken.state,
      offers: source.offersApi.recordOutcome(source.offers, questSnapshot.id, 'taken', today, source.pacingApi),
    };
  }
  function prepareReturn(input) {
    const source = dependencies(input); if (!source) return { ok: false, reason: 'dependencies-required' };
    const questSnapshot = snapshot(source), today = day(source.today);
    if (!questSnapshot || !today) return { ok: false, reason: 'snapshot-required' };
    const active = source.boardApi.activeOrders(source.board).some((item) => item.orderId === questSnapshot.id);
    if (!active) return { ok: false, reason: 'not-active' };
    return {
      ok: true, snapshot: questSnapshot,
      board: source.boardApi.returnOrder(source.board, questSnapshot.id, today),
      offers: source.offersApi.recordOutcome(source.offers, questSnapshot.id, 'returned', today, source.pacingApi),
    };
  }
  function prepareCompletion(input) {
    const source = dependencies(input); if (!source) return { ok: false, reason: 'dependencies-required' };
    const questSnapshot = snapshot(source), today = day(source.today), completedAt = instant(source.completedAt);
    const taskId = text(source.taskId, 120);
    if (!questSnapshot || !today || !completedAt || !taskId) return { ok: false, reason: 'completion-context-required' };
    const checkedProof = normalizeProof(questSnapshot, source.proof);
    if (!checkedProof.ok) return checkedProof;
    const completed = source.boardApi.completeOrder(source.board, questSnapshot.id, today);
    if (!completed.ok) return { ok: false, reason: completed.error };
    const reward = questSnapshot.reward;
    const skillId = text(source.skillId, 80) || null;
    const task = {
      id: taskId, title: questSnapshot.title, skillId, skillIds: skillId ? [skillId] : [],
      estimateMin: 0, difficulty: 'normal', date: today, done: true, completedAt,
      xpAwarded: reward.xp, goldAwarded: Math.round(reward.xp * 0.35), actualMin: null, startTime: null,
      fromBoard: true, fromBoardV2: true, boardSnapshotId: questSnapshot.id, createdAt: completedAt,
    };
    const completion = normalizeState(source.completion);
    if (questSnapshot.followUp) {
      completion.pending = completion.pending.filter((item) => item.snapshotId !== questSnapshot.id).concat([{
        snapshotId: questSnapshot.id,
        interventionId: questSnapshot.followUp.interventionId,
        question: questSnapshot.followUp.question,
        contextTags: questSnapshot.followUp.contextTags.slice(),
        completedAt: today,
      }]).slice(-MAX_PENDING);
    }
    return {
      ok: true, snapshot: questSnapshot, board: completed.state,
      offers: source.offersApi.recordOutcome(source.offers, questSnapshot.id, 'completed', today, source.pacingApi),
      completion, task, proof: checkedProof.proof, proofPlan: checkedProof.plan,
      unlock: reward.title ? { type: 'title', id: reward.title } : null,
    };
  }
  function answerFollowUp(rawState, snapshotId, outcome, at) {
    const state = normalizeState(rawState), id = text(snapshotId, 120), answer = text(outcome, 24), today = day(at);
    if (!id || !OUTCOMES.includes(answer) || !today) return { ok: false, reason: 'invalid-answer', state };
    const pending = state.pending.find((item) => item.snapshotId === id);
    if (!pending) return { ok: false, reason: 'follow-up-not-pending', state };
    return {
      ok: true,
      state: normalizeState({
        schema: STATE_SCHEMA,
        pending: state.pending.filter((item) => item.snapshotId !== id),
        records: state.records.concat([{
          interventionId: pending.interventionId, outcome: answer,
          contextTags: pending.contextTags.slice(), at: today,
        }]),
      }),
    };
  }
  function knownHelp(rawState, contextTags) {
    const wanted = new Set(unique(contextTags, 64));
    const scores = new Map();
    for (const record of normalizeState(rawState).records) {
      const overlap = record.contextTags.filter((tag) => wanted.has(tag)).length;
      if (!overlap) continue;
      const value = record.outcome === 'helped' ? 2 : record.outcome === 'did-not-help' ? -2 : 0;
      scores.set(record.interventionId, (scores.get(record.interventionId) || 0) + value * overlap);
    }
    return [...scores.entries()].filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([interventionId, score]) => ({ interventionId, score }));
  }

  return Object.freeze({
    VERSION, STATE_SCHEMA, MAX_PENDING, MAX_RECORDS, OUTCOMES, MEDIA_PROOF,
    emptyState, normalizeState, proofPlan, normalizeProof,
    prepareTake, prepareReturn, prepareCompletion, answerFollowUp, knownHelp,
  });
});
