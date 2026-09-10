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
    let timer = null, projectionError = null, lastDay = null, deferred = null, lastSignal = null;
    try { const saved = JSON.parse(env.storage.getItem(key + '.open') || 'null'); if (root.SecretaryNextMovesClientV1.validAcceptedReceipt(saved)) deferred = saved; } catch {}
    const sameAccount = () => String(env.account()) === accountId;
    const client = root.SecretaryNextMovesClientV1.create({
      accountId, clientId, requestId: () => 'req-' + env.id(), currentAccount: env.account,
      readPending: () => JSON.parse(env.storage.getItem(key + '.pending') || 'null'),
      writePending: value => value ? env.storage.setItem(key + '.pending', JSON.stringify(value)) : env.storage.removeItem(key + '.pending'),
      rpc: async body => {
        const snapshot = env.snapshot();
        const response = await env.fetch('/api/secretary/next-moves', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Local-Day': snapshot.today, 'X-Tz-Offset': String(snapshot.utcOffsetMinutes) },
          body: JSON.stringify(body),
        });
        if (response.status === 401) { if (sameAccount()) env.expired(); throw new Error('session_expired'); }
        const data = await response.json().catch(() => null);
        if (!response.ok) throw Object.assign(new Error(data?.error || 'network'), { code: data?.error || 'network', status: response.status });
        return data;
      },
      changed: state => {
        clearTimeout(timer); timer = null;
        if (state.phase === 'offered' && state.offer) timer = setTimeout(() => {
          if (sameAccount()) client.outcome('expired');
        }, Math.max(0, Math.min(2147483000, Date.parse(state.offer.expiresAt) - Date.now() + 10)));
        env.changed();
      },
    });
    function state() { return projectionError || deferred ? { ...client.state(), error: projectionError || 'context_blocked', phase: 'error' } : client.state(); }
    function blocked(context) { return context.activeSession.active || context.guide.active || context.firstValue.pending || env.snapshot().dayClosed; }
    function openConfirmed(receipt) {
      if (!sameAccount()) return false;
      const current = root.SecretaryNextMovesProducerV1.build(env.snapshot());
      if (!current.ok || blocked(current.context)) {
        deferred = receipt;
        try { env.storage.setItem(key + '.open', JSON.stringify(receipt)); } catch {}
        env.changed(); return false;
      }
      deferred = null; projectionError = null;
      try { env.storage.removeItem(key + '.open'); } catch {}
      env.open(receipt.action); return true;
    }
    async function load(force = false) {
      if (!sameAccount()) return false;
      if (deferred) return false;
      const snapshot = env.snapshot();
      const changedDay = lastDay && snapshot.today !== lastDay;
      lastDay = snapshot.today;
      if (changedDay) client.invalidate();
      const projected = root.SecretaryNextMovesProducerV1.build(snapshot);
      if (!projected.ok) { const changed = projectionError !== projected.error; projectionError = projected.error; if (changed) env.changed(); return false; }
      const clearedError = !!projectionError; projectionError = null;
      const { lapse, activeSession, guide, firstValue } = projected.context;
      const signal = JSON.stringify([snapshot.today, snapshot.dayClosed, lapse?.eventKey, lapse?.originalRef, lapse?.originalStillActionable, activeSession.active, guide.active, firstValue.pending]);
      const changedSignal = signal !== lastSignal;
      lastSignal = signal;
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
      if ((pending?.outcome || outcome) === 'accepted' && blocked(projected.context)) { projectionError = 'context_blocked'; env.changed(); return false; }
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
    function dispose() { clearTimeout(timer); }
    return Object.freeze({ state, load, respond, retry, invalidate, dispose });
  }
  return Object.freeze({ create });
});
