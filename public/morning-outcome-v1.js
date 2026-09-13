/* Legacy morning outcome: one frozen intention and its receipt, in the existing ledger. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MorningOutcomeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const fields = ['version', 'accountId', 'offerId', 'cooldownKey', 'token', 'state'];
  const actions = ['', 'attention-open-return', 'recovery-open', 'evening-open'];
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const string = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
  function day(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }
  function validBody(body) {
    return object(body) && Object.keys(body).length === fields.length && body.version === 1
      && string(body.accountId, 160) && string(body.token, 80) && string(body.offerId, 160)
      && typeof body.cooldownKey === 'string' && body.cooldownKey.startsWith('morning-recovery|')
      && day(body.cooldownKey.slice(17)) && body.offerId.startsWith(body.cooldownKey + '|')
      && ['accepted', 'dismissed'].includes(body.state);
  }
  function validReceipt(receipt, body) {
    return validBody(body) && object(receipt) && receipt.ok === true && typeof receipt.repeat === 'boolean'
      && fields.every(key => receipt[key] === body[key]) && typeof receipt.persistedAt === 'string'
      && Number.isFinite(Date.parse(receipt.persistedAt)) && new Date(receipt.persistedAt).toISOString() === receipt.persistedAt;
  }
  function storedReceipt(receipt, key, row) {
    if (!object(receipt)) return null;
    const body = Object.fromEntries(fields.map(field => [field, receipt[field]]));
    return validReceipt(receipt, body) && key === body.cooldownKey && row.state === body.state && row.at === receipt.persistedAt
      ? { ...body, ok: true, persistedAt: receipt.persistedAt, repeat: false } : null;
  }
  function prepare(ledger, claims, body, accountId, now) {
    if (!validBody(body)) return { status: 400, body: { error: 'bad_outcome' } };
    if (body.accountId !== accountId) return { status: 403, body: { error: 'account_changed' } };
    const row = ledger.delivered[body.cooldownKey];
    if (row?.receipt) {
      if (!fields.every(key => row.receipt[key] === body[key])) return { status: 409, body: { error: 'terminal_outcome' } };
      return { status: 200, body: { ...row.receipt, repeat: true } };
    }
    const claim = claims?.claims[body.offerId];
    if (!claim || claim.channel !== 'card' || claim.token !== body.token || claim.outcome === 'gone') {
      return { status: 409, body: { error: 'offer_not_found' } };
    }
    if (row && ['accepted', 'dismissed'].includes(row.state) && row.state !== body.state) {
      return { status: 409, body: { error: 'terminal_outcome' } };
    }
    const at = row?.state === body.state ? row.at : now;
    const receipt = { ...body, ok: true, persistedAt: at, repeat: false };
    if (!validReceipt(receipt, body)) return { status: 422, body: { error: 'invalid_secretary_state' } };
    return { status: 200, body: receipt, ledger: { ...ledger, delivered: {
      ...ledger.delivered, [body.cooldownKey]: { at, state: body.state, receipt },
    } } };
  }
  function pending(value, accountId) {
    if (!object(value) || value.version !== 1 || typeof value.bodyJSON !== 'string' || value.bodyJSON.length > 1500
      || !actions.includes(value.domAction)) return null;
    let body; try { body = JSON.parse(value.bodyJSON); } catch { return null; }
    if (!validBody(body) || body.accountId !== accountId || (value.receipt && !validReceipt(value.receipt, body))) return null;
    return { version: 1, bodyJSON: value.bodyJSON, domAction: value.domAction, receipt: value.receipt || null };
  }
  function create(env) {
    const scope = env.scope(), key = 'satoru.secretary.morning.' + scope.accountId;
    let disposed = false, busy = false, error = '', saved = null, readFailed = false, unavailable = false;
    const current = () => !disposed && !!scope.accountId && env.scope().accountId === scope.accountId && env.scope().epoch === scope.epoch;
    function restore() {
      try {
        const raw = env.storage.getItem(key);
        saved = raw === null ? null : pending(JSON.parse(raw), scope.accountId);
        if (raw !== null && !saved) throw new Error('invalid_pending');
        readFailed = false; error = '';
      } catch { readFailed = true; error = 'morning_storage'; }
    }
    restore();
    const state = () => ({ pending: !!saved, busy, error: error || (saved ? (saved.receipt ? 'opening_deferred' : 'morning_unconfirmed') : ''),
      confirmed: !!saved?.receipt, canSkip: readFailed && !saved, unavailable });
    const changed = () => { if (current()) env.changed(); };
    const persist = value => {
      if (value) env.storage.setItem(key, JSON.stringify(value)); else env.storage.removeItem(key);
      saved = value;
    };
    async function request(bodyJSON) {
      const controller = new AbortController();
      let timeout;
      try {
        return await Promise.race([
          (async () => {
            const response = await env.fetch('/api/secretary/offer', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyJSON, signal: controller.signal,
            });
            const receipt = response.status === 401 ? null : await response.json().catch(() => null);
            return { response, receipt };
          })(),
          new Promise((resolve, reject) => { timeout = setTimeout(() => {
            reject(new Error('network')); controller.abort();
          }, env.timeoutMs || 15000); }),
        ]);
      } finally { clearTimeout(timeout); }
    }
    async function respond(choice, offer) {
      if (!current() || busy || unavailable) return false;
      busy = true;
      try {
        if (readFailed) { restore(); if (readFailed) return false; }
        if (!saved) {
          if (!offer) { error = ''; return true; }
          const body = { version: 1, accountId: scope.accountId, offerId: offer?.view?.offerId,
            cooldownKey: offer?.view?.cooldownKey, token: offer?.token, state: choice };
          if (!validBody(body) || !actions.includes(offer?.view?.domAction)) throw new Error('invalid_response');
          // Keep the intention in memory if storage is temporarily full. It is
          // written successfully before any request, including the next retry.
          saved = { version: 1, bodyJSON: JSON.stringify(body), domAction: offer.view.domAction, receipt: null };
        }
        persist(saved);
        error = ''; changed();
        const attempt = saved, body = JSON.parse(attempt.bodyJSON);
        if (!attempt.receipt) {
          const { response, receipt } = await request(attempt.bodyJSON);
          if (!current()) return false;
          if (response.status === 401) { error = 'session_expired'; env.expired(); return false; }
          if (!response.ok) {
            if (response.status === 409 && ['terminal_outcome', 'offer_not_found'].includes(receipt?.error)) {
              persist(null); env.committed(); error = 'morning_terminal'; return false;
            }
            throw new Error(receipt?.error || 'network');
          }
          if (!validReceipt(receipt, body)) throw new Error('invalid_response');
          persist({ ...attempt, receipt });
        }
        if (!current()) return false;
        if (body.state === 'accepted' && body.cooldownKey.slice(17) !== env.today()) {
          persist(null); env.committed(); error = 'morning_stale'; return false;
        }
        if (body.state === 'accepted' && !env.canOpen()) throw new Error('context_blocked');
        const confirmed = saved;
        persist(null);
        env.committed();
        // Adapter contract: opening the existing dialog is synchronous. It does
        // not start a timer, write an owner record or return an async operation.
        try {
          if (body.state === 'accepted' && confirmed.domAction) {
            const opened = env.open(confirmed.domAction);
            if (opened === false || opened === null) throw new Error('opening_deferred');
          }
        }
        catch (failure) { persist(confirmed); throw failure; }
        error = ''; return true;
      } catch (failure) {
        if (current()) error = failure?.message || 'network';
        return false;
      } finally { busy = false; changed(); }
    }
    function skipUnreadable() {
      if (!current() || busy || saved || !readFailed) return false;
      // An unreadable local record cannot safely be replayed. Explicitly leave
      // this recovery in this tab; no outcome or server receipt is altered.
      try { env.storage.removeItem(key); } catch {}
      readFailed = false; error = ''; unavailable = true; env.skipped?.(); changed(); return true;
    }
    return Object.freeze({ state, respond, retry: () => respond(), skipUnreadable, dispose: () => { disposed = true; } });
  }
  return Object.freeze({ validBody, validReceipt, storedReceipt, prepare, pending, create });
});
