/* Browser coordinator. The policy, projection, receipt transport and view remain separate. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryNextMovesRuntimeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  function create(env) {
    const accountId = String(env.account());
    const key = 'satoru.secretary.next.' + accountId;
    let clientId;
    try { clientId = env.storage.getItem(key + '.client'); } catch {}
    if (!clientId) { clientId = 'tab-' + env.id(); try { env.storage.setItem(key + '.client', clientId); } catch {} }
    let timer = null, heldTimer = null, decisionTimer = null, decisionAt = null, disposed = false;
    let projectionError = null, lastDay = null, deferred = null, lastSignal = null;
    try { const saved = JSON.parse(env.storage.getItem(key + '.open') || 'null'); if (root.SecretaryNextMovesClientV1.validAcceptedReceipt(saved)) deferred = saved; } catch {}
    const sameAccount = () => !disposed && String(env.account()) === accountId;
    const visible = () => !env.visible || env.visible();
    const client = root.SecretaryNextMovesClientV1.create({
      accountId, clientId, requestId: () => 'req-' + env.id(), currentAccount: () => sameAccount() ? env.account() : null,
      readPending: () => JSON.parse(env.storage.getItem(key + '.pending') || 'null'),
      writePending: value => value ? env.storage.setItem(key + '.pending', JSON.stringify(value)) : env.storage.removeItem(key + '.pending'),
      rpc: async body => {
        if (['decide', 'claim'].includes(body.op) && !visible()) throw Object.assign(new Error('held'), { code: 'held' });
        const snapshot = env.snapshot();
        const response = await env.fetch('/api/secretary/next-moves', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Local-Day': snapshot.today, 'X-Tz-Offset': String(snapshot.utcOffsetMinutes) },
          body: JSON.stringify(body),
        });
        if (response.status === 401) { if (sameAccount()) env.expired(); throw new Error('session_expired'); }
        const data = await response.json().catch(() => null);
        if (!response.ok) throw Object.assign(new Error(data?.error || 'network'), { code: data?.error || 'network', status: response.status, recheckAt: data?.recheckAt });
        return data;
      },
      changed: state => {
        clearTimeout(timer); timer = null;
        clearTimeout(heldTimer); heldTimer = null;
        if (state.phase === 'silence' && state.silence?.recheckAt) heldTimer = setTimeout(() => {
          heldTimer = null;
          if (sameAccount() && visible()) { client.invalidate(); load(); }
        }, Math.max(1, Math.min(2147483000, Date.parse(state.silence.recheckAt) - Date.now() + 10)));
        if (state.phase === 'offered' && state.offer) timer = setTimeout(() => {
          if (sameAccount()) client.outcome('expired');
        }, Math.max(0, Math.min(2147483000, Date.parse(state.offer.expiresAt) - Date.now() + 10)));
        env.changed();
      },
    });
    function state() { return projectionError || deferred ? { ...client.state(), error: projectionError || 'opening_deferred', phase: 'error' } : client.state(); }
    function scheduleDecision(projected, snapshot) {
      const at = projected.nextDecisionAt || null;
      if (at === decisionAt) return;
      clearTimeout(decisionTimer); decisionTimer = null; decisionAt = at;
      if (!at || !Number.isFinite(Date.parse(at))) return;
      decisionTimer = setTimeout(() => {
        decisionTimer = null; decisionAt = null;
        if (sameAccount() && visible()) { client.invalidate(); load(); }
      }, Math.max(1, Math.min(2147483000, Date.parse(at) - Date.parse(snapshot.now) + 10)));
    }
    function blocked(context, action) { return context.activeSession.active || context.guide.active || context.firstValue.pending
      || (action?.type === 'evening_transition_open' && Date.parse(context.tonightSchedule?.busyUntilAt) > Date.parse(env.snapshot().now))
      || (env.snapshot().dayClosed && action?.type !== 'evening_transition_open'); }
    function openConfirmed(receipt) {
      if (!sameAccount()) return false;
      const snapshot = env.snapshot();
      if (receipt.action.args.day !== snapshot.today) {
        deferred = null; projectionError = 'stale_target';
        try { env.storage.removeItem(key + '.open'); } catch {}
        env.changed(); return false;
      }
      const current = root.SecretaryNextMovesProducerV1.build(snapshot);
      if (receipt.action.type === 'evening_transition_open' && current.ok
        && (!current.context.eveningContract?.dailyReminder || current.context.eveningContract.eveningTimeLocal !== receipt.action.args.boundaryLocal)) {
        deferred = null; projectionError = 'stale_evening';
        try { env.storage.removeItem(key + '.open'); } catch {}
        env.changed(); return false;
      }
      if (!visible() || !current.ok || blocked(current.context, receipt.action)) {
        deferred = receipt;
        try { env.storage.setItem(key + '.open', JSON.stringify(receipt)); } catch {}
        env.changed(); return false;
      }
      deferred = null; projectionError = null;
      try { env.storage.removeItem(key + '.open'); } catch {}
      if (env.open(receipt.action) === false) { projectionError = 'stale_target'; env.changed(); return false; }
      return true;
    }
    async function load(force = false) {
      if (!sameAccount() || !visible()) return false;
      if (deferred) return false;
      const snapshot = env.snapshot();
      const changedDay = lastDay && snapshot.today !== lastDay;
      lastDay = snapshot.today;
      if (changedDay) client.invalidate();
      const projected = root.SecretaryNextMovesProducerV1.build(snapshot);
      if (!projected.ok) { const changed = projectionError !== projected.error; projectionError = projected.error; if (changed) env.changed(); return false; }
      const clearedError = !!projectionError; projectionError = null;
      const { lapse, plannedStart, eveningContract, tonightSchedule, activeSession, guide, firstValue } = projected.context;
      const signal = JSON.stringify([snapshot.today, snapshot.dayClosed, lapse?.eventKey, lapse?.originalRef, lapse?.originalStillActionable,
        plannedStart?.taskRef, plannedStart?.plannedAtLocal, plannedStart?.startedToday, plannedStart?.doneToday,
        eveningContract?.eveningTimeLocal, eveningContract?.dailyReminder, tonightSchedule?.busyUntilAt,
        activeSession.active, guide.active, firstValue.pending]);
      const changedSignal = signal !== lastSignal;
      lastSignal = signal;
      scheduleDecision(projected, snapshot);
      if (changedSignal) client.invalidate();
      else if (clearedError) env.changed();
      await client.load({ lapse, activeSession, guide, firstValue }, force);
      const current = state();
      // Existing morning flow runs only after an explicit, healthy no-offer decision.
      return current.phase === 'silence' && current.silence?.reason === 'nothing_eligible' && !lapse;
    }
    async function respond(outcome) {
      if (!sameAccount()) return false;
      const pending = client.pending();
      const projected = root.SecretaryNextMovesProducerV1.build(env.snapshot());
      if (!projected.ok) { projectionError = projected.error; env.changed(); return false; }
      const { lapse, activeSession, guide, firstValue } = projected.context;
      const action = client.state().offer?.primary?.action;
      if ((pending?.outcome || outcome) === 'accepted' && blocked(projected.context, action)) { projectionError = 'context_blocked'; env.changed(); return false; }
      projectionError = null;
      const receipt = await client.outcome(pending?.outcome || outcome, pending?.actionId || 'primary', { lapse, activeSession, guide, firstValue });
      if (!receipt || !sameAccount()) return false;
      if (receipt.outcome === 'accepted') return openConfirmed(receipt);
      return true;
    }
    async function retry() {
      if (deferred) return openConfirmed(deferred);
      if (client.pending()) return respond(client.pending().outcome);
      return load(true);
    }
    function invalidate() { projectionError = null; client.invalidate(); }
    function wake() { if (sameAccount() && visible()) { client.invalidate(); load(); } }
    root.document?.addEventListener('visibilitychange', wake);
    root.addEventListener?.('focus', wake);
    function dispose() {
      disposed = true; clearTimeout(timer); clearTimeout(heldTimer); clearTimeout(decisionTimer);
      root.document?.removeEventListener('visibilitychange', wake);
      root.removeEventListener?.('focus', wake);
    }
    return Object.freeze({ state, load, respond, retry, invalidate, wake, dispose });
  }
  return Object.freeze({ create });
});
