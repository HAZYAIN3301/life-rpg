/* Satoru Board v2 — completion/follow-up presentation model.
 *
 * Pure UI contracts only. The browser adapter owns DOM, files and fetch;
 * BoardV2Completion remains the authority for proof and intervention state.
 */
(function exposeBoardV2CompletionUI(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2CompletionUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2CompletionUI() {
  'use strict';

  const VERSION = '1.0.0';
  const TEXT_MODES = Object.freeze(['result', 'reflection', 'story']);
  const MODE_ROWS = Object.freeze({
    checkin: Object.freeze({ id: 'checkin', kind: 'checkin', label: 'Просто подтвердить', description: 'Без фото и дополнительного текста.' }),
    result: Object.freeze({ id: 'result', kind: 'text', label: 'Зафиксировать результат', description: 'Одной конкретной фразой: что получилось.' }),
    reflection: Object.freeze({ id: 'reflection', kind: 'text', label: 'Ответить по итогу', description: 'Короткий ответ останется только в твоём аккаунте.' }),
    story: Object.freeze({ id: 'story', kind: 'text', label: 'Сохранить историю', description: 'Чем всё закончилось — без обязательной публикации.' }),
    photo: Object.freeze({ id: 'photo', kind: 'photo', label: 'Добавить приватное фото', description: 'Фото останется в личном путевом журнале.' }),
    video: Object.freeze({ id: 'video', kind: 'unavailable', label: 'Добавить приватное видео', description: 'Отдельное видеохранилище ещё не подключено.' }),
  });
  const OUTCOME_ROWS = Object.freeze([
    Object.freeze({ id: 'helped', label: 'Да, помогло' }),
    Object.freeze({ id: 'neutral', label: 'Не уверен' }),
    Object.freeze({ id: 'did-not-help', label: 'Нет, не помогло' }),
  ]);

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    return out && out.length <= max && !/[\u0000-\u001f<>]/.test(out) ? out : '';
  }
  function completionView(snapshot, completionApi) {
    if (!plain(snapshot) || !completionApi || typeof completionApi.proofPlan !== 'function') return null;
    const plan = completionApi.proofPlan(snapshot);
    if (!Array.isArray(plan.modes) || !plan.modes.length) return null;
    const modes = plan.modes.map((mode) => MODE_ROWS[mode]).filter(Boolean);
    const available = modes.filter((mode) => mode.kind !== 'unavailable');
    if (plan.required && !available.length) return null;
    return {
      snapshotId: text(snapshot.id, 120), title: text(snapshot.title, 180),
      required: plan.required === true, canSkip: plan.required !== true,
      modes, defaultMode: plan.required ? available[0].id : 'none',
      reward: {
        xp: Math.max(0, Math.round(Number(snapshot.reward && snapshot.reward.xp) || 0)),
        gold: Math.max(0, Math.round((Number(snapshot.reward && snapshot.reward.xp) || 0) * .35)),
        title: text(snapshot.reward && snapshot.reward.title, 80) || null,
      },
    };
  }
  function proofDraft(view, raw) {
    const source = plain(raw) ? raw : {}, mode = text(source.mode, 32);
    if (!view || !Array.isArray(view.modes)) return { ok: false, reason: 'completion-view-required' };
    if (mode === 'none') return view.canSkip ? { ok: true, proof: null } : { ok: false, reason: 'proof-required' };
    const row = view.modes.find((item) => item.id === mode);
    if (!row || row.kind === 'unavailable') return { ok: false, reason: 'unsupported-proof' };
    if (row.kind === 'checkin') return { ok: true, proof: { mode } };
    if (row.kind === 'text') {
      const result = text(source.result, 280);
      return result ? { ok: true, proof: { mode, result } } : { ok: false, reason: 'result-required' };
    }
    const referenceId = text(source.referenceId, 120);
    return referenceId ? { ok: true, proof: { mode, referenceId } } : { ok: false, reason: 'media-reference-required' };
  }
  function pendingFollowUp(rawState) {
    if (!plain(rawState) || !Array.isArray(rawState.pending) || !rawState.pending.length) return null;
    const source = rawState.pending[rawState.pending.length - 1];
    if (!plain(source)) return null;
    const snapshotId = text(source.snapshotId, 120), question = text(source.question, 220);
    return snapshotId && question ? { snapshotId, question, outcomes: OUTCOME_ROWS } : null;
  }
  function receipt(snapshot, effects) {
    if (!plain(snapshot)) return null;
    const title = text(snapshot.title, 180), xp = Math.max(0, Math.round(Number(snapshot.reward && snapshot.reward.xp) || 0));
    if (!title || !xp) return null;
    const unlock = plain(effects && effects.unlock) && effects.unlock.type === 'title'
      ? text(effects.unlock.id, 80) : '';
    return { snapshotId: text(snapshot.id, 120), title, xp, gold: Math.round(xp * .35), unlock: unlock || null };
  }

  return Object.freeze({
    VERSION, TEXT_MODES, MODE_ROWS, OUTCOME_ROWS,
    completionView, proofDraft, pendingFollowUp, receipt,
  });
});
