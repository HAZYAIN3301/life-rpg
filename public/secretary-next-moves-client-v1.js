/* One card, durable claim and outcome. Dependencies are injected for browser/Node QA. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryNextMovesClientV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && iso(value + 'T00:00:00.000Z');
  const SUPPORTED_CAPABILITIES = Object.freeze(['after-lapse-return', 'planned-start', 'evening-close']);
  const stable = value => JSON.stringify(value, Object.keys(value || {}).sort());
  const sameAction = (left, right) => left?.type === right?.type && stable(left?.args) === stable(right?.args);
  const actionTypes = ['task_open_prepared', 'rest_start_prepared', 'ask_one_question', 'evening_transition_open'];
  function validAction(action) {
    if (!object(action) || !actionTypes.includes(action.type) || !object(action.args) || !day(action.args.day)) return false;
    if (action.type === 'task_open_prepared') return /^(quest|habit):[A-Za-z0-9_-]{1,74}$/.test(action.args.targetRef || '') && ['minimum', 'planned'].includes(action.args.size);
    if (action.type === 'ask_one_question') return ['return_next_smallest', 'after-lapse-return_confirm'].includes(action.args.questionId);
    if (action.type === 'evening_transition_open') return /^([01]\d|2[0-3]):[0-5]\d$/.test(action.args.boundaryLocal || '');
    return false; // Enable each executor only with its verified vertical slice.
  }
  function validOffer(offer) {
    const planned = offer?.capabilityId === 'planned-start';
    const evening = offer?.capabilityId === 'evening-close';
    return object(offer) && offer.version === 2 && SUPPORTED_CAPABILITIES.includes(offer.capabilityId)
      && typeof offer.offerId === 'string' && offer.offerId.length > 0 && offer.channel === 'card'
      && iso(offer.expiresAt) && object(offer.copy) && object(offer.primary)
      && (planned ? offer.copy.titleKey === 'secretary.v2.planned_start.title'
        && offer.primary.action?.type === 'task_open_prepared' && offer.primary.action.args?.size === 'planned'
        && /^quest:/.test(offer.primary.action.args?.targetRef || '')
        : evening ? offer.copy.titleKey === 'secretary.v2.evening.title' && offer.primary.action?.type === 'evening_transition_open'
        : ['secretary.v2.return.title.minimum', 'secretary.v2.return.title.ask'].includes(offer.copy.titleKey))
      && validAction(offer.primary.action) && Array.isArray(offer.alternatives)
      && offer.alternatives.every(item => object(item) && validAction(item.action));
  }
  function validAcceptedReceipt(receipt) {
    return object(receipt) && receipt.ok === true && receipt.outcome === 'accepted' && iso(receipt.persistedAt) && validAction(receipt.action);
  }
  function create({ accountId, clientId, requestId, rpc, currentAccount, changed = () => {}, readPending = () => null, writePending = () => {} }) {
    let state = { phase: 'idle', offer: null, token: null, error: null, busy: false, silence: null };
    let pending = null;
    try {
      const saved = readPending();
      if (saved && validOffer(saved.offer) && saved.pending?.clientId === clientId && saved.pending.offerId === saved.offer.offerId) {
        pending = saved.pending;
        state = { ...state, phase: 'error', offer: saved.offer, token: pending.token, error: 'unconfirmed' };
      }
    } catch { /* A fresh server decision remains available when storage cannot be read. */ }
    const sameAccount = () => String(currentAccount()) === String(accountId);
    const publish = patch => { if (sameAccount()) { state = { ...state, ...patch }; changed(state); } };
    const fail = error => {
      const code = error?.code || error?.message || 'network';
      if (['stale_target', 'offer_expired', 'terminal_outcome', 'offer_not_found'].includes(code)) {
        pending = null; try { writePending(null); } catch {}
        publish({ offer: null, token: null });
      }
      if (code === 'held') {
        if (error.recheckAt != null && !iso(error.recheckAt)) { publish({ phase: 'error', error: 'invalid_response', busy: false }); return; }
        publish({ phase: 'silence', offer: null, token: null, error: null, busy: false,
          silence: { reason: 'held', ...(error.recheckAt ? { recheckAt: error.recheckAt } : {}) } }); return;
      }
      publish({ phase: 'error', error: code, busy: false });
    };
    async function call(payload) {
      const data = await rpc({ clientId, requestId: requestId(), ...payload });
      if (!sameAccount()) throw Object.assign(new Error('account_changed'), { code: 'account_changed' });
      if (!object(data) || data.ok !== true) throw Object.assign(new Error('invalid_response'), { code: 'invalid_response' });
      return data;
    }
    async function load(context, force = false) {
      if (!sameAccount() || state.busy || (!force && state.phase !== 'idle')) return false;
      publish({ busy: true, error: null });
      try {
        const data = await call({ op: 'decide', invocation: 'app_open', supportedCapabilities: SUPPORTED_CAPABILITIES, context });
        let claim = data.resume;
        if (!claim && data.offer === null && object(data.silence)) {
          if (data.silence.recheckAt != null && !iso(data.silence.recheckAt)) throw new Error('invalid_response');
          publish({ phase: 'silence', offer: null, token: null, silence: data.silence, busy: false }); return true;
        }
        if (!claim) {
          if (!validOffer(data.offer)) throw new Error('invalid_response');
          claim = await call({ op: 'claim', offerId: data.offer.offerId, supportedCapabilities: SUPPORTED_CAPABILITIES, context });
        }
        if (!validOffer(claim.offer) || typeof claim.token !== 'string' || !claim.token || !iso(claim.persistedAt)
          || (!data.resume && claim.offer.offerId !== data.offer.offerId)) throw new Error('invalid_response');
        publish({ phase: 'offered', offer: claim.offer, token: claim.token, error: null, silence: null, busy: false });
        return true;
      } catch (error) { fail(error); return false; }
    }
    async function outcome(outcome, actionId = 'primary', context) {
      if (!sameAccount() || state.busy || !state.offer || !['accepted', 'dismissed', 'expired'].includes(outcome)) return null;
      // A retry is the same user intent. Keep its ID even if the response was lost.
      if (pending && (pending.outcome !== outcome || pending.actionId !== actionId)) return null;
      pending ||= { op: 'outcome', clientId, requestId: requestId(), offerId: state.offer.offerId, token: state.token, outcome, actionId, ...(context ? { context } : {}) };
      try { writePending({ offer: state.offer, pending }); } catch { fail(new Error('local_storage')); return null; }
      publish({ busy: true, error: null });
      try {
        const data = await call(pending);
        const selected = [state.offer.primary, ...state.offer.alternatives].find(item => item.id === actionId);
        if (data.outcome !== outcome || !iso(data.persistedAt) || (outcome === 'accepted'
          && (!validAction(data.action) || !selected || !sameAction(data.action, selected.action)))) throw new Error('invalid_response');
        pending = null;
        try { writePending(null); } catch { /* Server receipt is authoritative; replay is idempotent. */ }
        publish({ phase: 'silence', offer: null, token: null, error: null, busy: false, silence: { reason: outcome } });
        return data;
      } catch (error) { fail(error); return null; }
    }
    function invalidate() { if (!state.busy && !state.offer && !pending) publish({ phase: 'idle', error: null, silence: null }); }
    return Object.freeze({ state: () => state, load, outcome, invalidate, pending: () => pending });
  }
  return Object.freeze({ SUPPORTED_CAPABILITIES, create, validAction, validOffer, validAcceptedReceipt });
});
