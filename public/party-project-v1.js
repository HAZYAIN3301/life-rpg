(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PartyProjectV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const catalog = Object.freeze([{ id: 'hearth', target: 6 }, { id: 'garden', target: 8 }]);
  const record = x => x && typeof x === 'object' && !Array.isArray(x);
  const fail = code => { throw Object.assign(new Error(code), { code }); };
  const empty = () => ({ version: 1, revision: 0, chapters: [], receipts: [] });
  function validate(raw) {
    if (raw === undefined) return empty();
    if (!record(raw) || raw.version !== 1 || !Number.isSafeInteger(raw.revision) || raw.revision < 0
      || !Array.isArray(raw.chapters) || raw.chapters.length > catalog.length || !Array.isArray(raw.receipts) || raw.receipts.length > 64
      || new Set(raw.chapters.map(c => c?.id)).size !== raw.chapters.length
      || raw.chapters.filter(c => !c.completedAt).length > 1) fail('project_storage');
    for (const c of raw.chapters) {
      const spec = catalog.find(x => x.id === c?.id);
      if (!spec || !Number.isFinite(Date.parse(c.startedAt)) || !Array.isArray(c.steps) || c.steps.length > spec.target
        || !Number.isInteger(c.anonymousActors) || c.anonymousActors < 0
        || (c.completedAt !== null && (!Number.isFinite(Date.parse(c.completedAt)) || c.steps.length !== spec.target))
        || c.steps.some(s => !record(s) || !Number.isFinite(Date.parse(s.at))
          || !(s.actor === null && s.source === null || typeof s.actor === 'string' && /^[a-f0-9]{64}$/.test(s.actor) && typeof s.source === 'string' && /^[a-f0-9]{64}$/.test(s.source)))) fail('project_storage');
    }
    const sources = raw.chapters.flatMap(c => c.steps.map(s => s.source).filter(Boolean));
    if (new Set(sources).size !== sources.length || raw.receipts.some(r => !record(r) || typeof r.id !== 'string' || typeof r.actor !== 'string' || typeof r.fingerprint !== 'string')) fail('project_storage');
    return raw;
  }
  function view(raw) {
    const state = validate(raw);
    return { version: 1, revision: state.revision, chapters: state.chapters.map(c => ({ id: c.id, startedAt: c.startedAt, completedAt: c.completedAt,
      progress: c.steps.length, target: catalog.find(x => x.id === c.id).target,
      contributors: new Set(c.steps.map(s => s.actor).filter(Boolean)).size + c.anonymousActors })) };
  }
  function eligible(raw, task, source, now) {
    const state = validate(raw), active = state.chapters.find(c => !c.completedAt);
    return !!(active && task && typeof task.id === 'string' && task.done === true
      && Number.isFinite(Date.parse(task.completedAt)) && Date.parse(task.completedAt) >= Date.parse(active.startedAt)
      && Date.parse(task.completedAt) <= Date.parse(now)
      && !state.chapters.some(c => c.steps.some(s => s.source === source)));
  }
  function change(raw, input, ctx) {
    if (!record(input) || !['action|operationId|partyId|projectId|revision|share|taskId', 'action|operationId|partyId|projectId|revision|share|sourceType|taskId'].includes(Object.keys(input).sort().join('|'))
      || (input.sourceType !== undefined && !['task', 'habit', 'focus'].includes(input.sourceType))
      || !['start', 'contribute'].includes(input.action) || typeof input.operationId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.operationId)
      || !Number.isSafeInteger(input.revision) || input.revision < 0 || !catalog.some(x => x.id === input.projectId)
      || (input.action === 'start' ? input.taskId !== null : typeof input.taskId !== 'string' || !input.taskId || input.taskId.length > 200)) fail('project_request');
    if (input.share !== true) fail('project_consent');
    if (input.partyId !== ctx.partyId) fail('project_conflict');
    const state = structuredClone(validate(raw)), fingerprint = JSON.stringify([input.action, input.projectId, input.action === 'start' ? null : ctx.source, input.revision, input.partyId]);
    const receipt = state.receipts.find(r => r.id === input.operationId && r.actor === ctx.actor);
    if (receipt) { if (receipt.fingerprint !== fingerprint) fail('project_conflict'); return { state, replay: true }; }
    if (input.revision !== state.revision) fail('project_conflict');
    let chapter = state.chapters.find(c => c.id === input.projectId);
    if (input.action === 'start') {
      if (chapter || state.chapters.some(c => !c.completedAt)) fail('project_conflict');
      chapter = { id: input.projectId, startedAt: ctx.now, completedAt: null, anonymousActors: 0, steps: [] }; state.chapters.push(chapter);
    } else {
      if (!chapter || chapter.completedAt) fail('project_conflict');
      if (!eligible(state, ctx.task, ctx.source, ctx.now)) fail('project_task');
      const target = catalog.find(x => x.id === chapter.id).target;
      const actors = new Set([...chapter.steps.map(s => s.actor).filter(Boolean), ctx.actor]);
      if (chapter.steps.length + 1 === target && actors.size + chapter.anonymousActors < 2) fail('project_partner');
      chapter.steps.push({ actor: ctx.actor, source: ctx.source, at: ctx.now });
      if (chapter.steps.length === target) chapter.completedAt = ctx.now;
    }
    state.revision++;
    state.receipts.push({ id: input.operationId, actor: ctx.actor, fingerprint }); state.receipts = state.receipts.slice(-64);
    return { state, replay: false };
  }
  function forget(raw, actor) {
    if (raw === undefined) return undefined;
    const state = structuredClone(validate(raw));
    for (const c of state.chapters) if (c.steps.some(s => s.actor === actor)) {
      c.anonymousActors++;
      c.steps = c.steps.map(s => s.actor === actor ? { source: null, actor: null, at: s.at } : s);
    }
    state.receipts = state.receipts.filter(r => r.actor !== actor); state.revision++;
    return state;
  }
  return { catalog, validate, view, eligible, change, forget };
});
