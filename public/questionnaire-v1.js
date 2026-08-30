(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QuestionnaireV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const MAX_RAW = 4000;
  const MAX_TITLE = 160;
  const MAX_WHY = 800;
  const MAX_SPHERES = 3;
  const STATUSES = new Set(['draft', 'analyzing', 'review', 'committing', 'materialized', 'deferred']);
  const SOURCES = new Set(['user_explicit', 'ai_suggested', 'user_confirmed_suggestion', 'import_confirmed']);

  function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
  function token(prefix) {
    const bytes = new Uint8Array(12);
    try { crypto.getRandomValues(bytes); }
    catch { for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256); }
    return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  function empty(locale) {
    const draftId = token('qd');
    return {
      version: VERSION,
      status: 'draft',
      draftId,
      originAnswerId: token('qa'),
      idempotencyKey: token('qi'),
      sourceLocale: text(locale || 'en', 5),
      rawAnswer: '',
      recognitionPhrase: '',
      seeds: { goals: [], firstSteps: [], spheres: [] },
      consents: { sendRawTextToAiProvider: false, retainRawAnswer: false, useConfirmedFactsForAssistant: false, useRecognitionInGuide: false },
      materialized: { goalIds: [], taskIds: [], sphereIds: [] },
      revision: 1,
      confirmedAt: null,
      materializedAt: null,
    };
  }
  function normalize(value, locale) {
    const base = empty(locale);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
    const status = STATUSES.has(value.status) ? value.status : 'draft';
    const seeds = value.seeds && typeof value.seeds === 'object' ? value.seeds : {};
    const goal = Array.isArray(seeds.goals) ? seeds.goals.slice(0, 1).map((row) => ({
      localId: text(row && row.localId, 80) || token('qg'),
      title: text(row && row.title, MAX_TITLE),
      why: text(row && row.why, MAX_WHY),
      outcome: text(row && row.outcome, MAX_TITLE),
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(row && row.deadline || '')) ? row.deadline : null,
      sphereRefs: Array.isArray(row && row.sphereRefs) ? row.sphereRefs.map((id) => text(id, 80)).filter(Boolean).slice(0, MAX_SPHERES) : [],
      source: SOURCES.has(row && row.source) ? row.source : 'user_explicit',
    })) : [];
    const step = Array.isArray(seeds.firstSteps) ? seeds.firstSteps.slice(0, 1).map((row) => ({
      localId: text(row && row.localId, 80) || token('qt'),
      title: text(row && row.title, MAX_TITLE),
      estimateMin: Math.max(5, Math.min(60, Math.round(Number(row && row.estimateMin) || 15))),
      goalRef: text(row && row.goalRef, 80) || (goal[0] && goal[0].localId) || '',
      sphereRefs: Array.isArray(row && row.sphereRefs) ? row.sphereRefs.map((id) => text(id, 80)).filter(Boolean).slice(0, MAX_SPHERES) : [],
      source: SOURCES.has(row && row.source) ? row.source : 'user_explicit',
    })) : [];
    const seen = new Set();
    const spheres = (Array.isArray(seeds.spheres) ? seeds.spheres : []).map((row) => ({
      localId: text(row && row.localId, 80) || token('qs'),
      title: text(row && row.title, 80),
      color: /^#[0-9a-f]{6}$/i.test(String(row && row.color || '')) ? row.color : '#6c8cff',
      role: row && row.role === 'background' ? 'background' : 'primary',
      source: SOURCES.has(row && row.source) ? row.source : 'ai_suggested',
    })).filter((row) => row.title && !seen.has(row.title.toLocaleLowerCase()) && (seen.add(row.title.toLocaleLowerCase()), true)).slice(0, MAX_SPHERES);
    return {
      ...base,
      ...value,
      version: VERSION,
      status,
      draftId: text(value.draftId, 80) || base.draftId,
      originAnswerId: text(value.originAnswerId, 80) || base.originAnswerId,
      idempotencyKey: text(value.idempotencyKey, 100) || base.idempotencyKey,
      sourceLocale: text(value.sourceLocale || locale || 'en', 5),
      rawAnswer: text(value.rawAnswer, MAX_RAW),
      recognitionPhrase: text(value.recognitionPhrase, 160),
      seeds: { goals: goal, firstSteps: step, spheres },
      consents: { ...base.consents, ...(value.consents || {}) },
      materialized: { ...base.materialized, ...(value.materialized || {}) },
      revision: Math.max(1, Math.round(Number(value.revision) || 1)),
    };
  }
  function manualReview(current, fields) {
    const state = normalize(current, current && current.sourceLocale);
    const goalId = state.seeds.goals[0] && state.seeds.goals[0].localId || token('qg');
    const taskId = state.seeds.firstSteps[0] && state.seeds.firstSteps[0].localId || token('qt');
    const title = text(fields && fields.result, MAX_TITLE);
    const step = text(fields && fields.step, MAX_TITLE);
    const sphereTitle = text(fields && fields.sphere, 40);
    const existingSphere = state.seeds.spheres[0];
    const sphere = existingSphere || (sphereTitle ? {
      localId: token('qs'), title: sphereTitle, color: '#6c8cff', role: 'primary', source: 'user_explicit',
    } : null);
    if (!title || !step || !sphere) return { ok: false, error: 'required' };
    const sphereRefs = [sphere.localId];
    return { ok: true, value: normalize({
      ...state,
      status: 'review',
      rawAnswer: text(fields && fields.rawAnswer, MAX_RAW) || state.rawAnswer,
      recognitionPhrase: title,
      seeds: {
        goals: [{ localId: goalId, title, why: text(fields && fields.why, MAX_WHY), outcome: title, deadline: null, sphereRefs, source: 'user_explicit' }],
        firstSteps: [{ localId: taskId, title: step, estimateMin: Math.max(5, Math.min(60, Math.round(Number(fields && fields.estimateMin) || 15))), goalRef: goalId, sphereRefs, source: 'user_explicit' }],
        spheres: [sphere],
      },
    }, state.sourceLocale) };
  }
  function validReview(value) {
    const state = normalize(value, value && value.sourceLocale);
    return state.status === 'review' && state.seeds.goals.length === 1 && !!state.seeds.goals[0].title
      && state.seeds.firstSteps.length === 1 && !!state.seeds.firstSteps[0].title
      && state.seeds.spheres.length >= 1 && state.seeds.spheres.length <= MAX_SPHERES;
  }
  return Object.freeze({ VERSION, MAX_RAW, MAX_SPHERES, empty, normalize, manualReview, validReview });
});
