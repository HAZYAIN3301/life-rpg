'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/morning-outcome-v1.js');
const Router = require('../public/secretary-router-v1.js');
const day = '2026-09-13', at = day + 'T08:00:00.000Z';
const body = { version: 1, accountId: 'alice', offerId: 'morning-recovery|' + day + '|known',
  cooldownKey: 'morning-recovery|' + day, token: 'claim-token', state: 'accepted' };
const offer = { token: body.token, view: { ...body, domAction: 'attention-open-return' } };
const receipt = (patch = {}) => ({ ...body, ok: true, repeat: false, persistedAt: at, ...patch });
const response = (status, data, json) => ({ status, ok: status === 200, json: json || (async () => data) });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; return { promise: new Promise(r => { resolve = r; }), resolve: value => resolve(value) }; }
function harness(replies = [], data = new Map()) {
  const scope = { accountId: 'alice', epoch: 1 }, calls = [], opened = [];
  let committed = 0, expired = 0, changes = 0, blocked = false, today = day, failWrite = 0, failRead = false;
  const env = { scope: () => ({ ...scope }), today: () => today, canOpen: () => !blocked,
    fetch: async (url, options) => { calls.push({ url, ...options }); const value = replies.shift(); if (value instanceof Error) throw value; return await value; },
    changed: () => { changes += 1; }, committed: () => { committed += 1; }, expired: () => { expired += 1; }, open: value => opened.push(value),
    storage: { getItem: key => { if (failRead) throw new Error('read failed'); return data.get(key) ?? null; },
      setItem: (key, value) => { if (failWrite > 0 && --failWrite === 0) throw new Error('quota'); data.set(key, value); },
      removeItem: key => data.delete(key) },
  };
  const runtime = M.create(env);
  return { runtime, data, calls, opened, scope, env, replies, committed: () => committed, expired: () => expired, changes: () => changes,
    block: value => { blocked = value; }, nextDay: () => { today = '2026-09-14'; }, failWrite: value => { failWrite = value; }, failRead: value => { failRead = value; } };
}

test('receipt must match every frozen field and an exact saved timestamp', () => {
  assert.equal(M.validBody(body), true); assert.equal(M.validReceipt(receipt(), body), true);
  for (const patch of [{ state: 'dismissed' }, { token: 'other' }, { accountId: 'bob' }, { offerId: 'other' },
    { cooldownKey: 'morning-recovery|2026-09-14' }, { ok: false }, { version: 2 }, { repeat: 'yes' },
    { persistedAt: '2026-02-31T08:00:00Z' }, { persistedAt: null }]) assert.equal(M.validReceipt(receipt(patch), body), false);
  for (const patch of [{ version: 2 }, { state: 'offered' }, { extra: true }, { token: '' }, { cooldownKey: 'morning-recovery|2026-02-31' }]) {
    assert.equal(M.validBody({ ...body, ...patch }), false);
  }
});
test('terminal receipt survives router roundtrip, unrelated marks and a delayed offered push', () => {
  const claims = { claims: { [body.offerId]: { token: body.token, channel: 'card' } } };
  const result = M.prepare(Router.emptyLedger(), claims, body, 'alice', at);
  assert.equal(result.status, 200); assert.deepEqual(Router.sanitizeLedger(result.ledger), result.ledger);
  const marked = Router.mark(result.ledger, { cooldownKey: body.cooldownKey }, 'offered', '2026-09-14T08:00:00.000Z');
  assert.deepEqual(marked, result.ledger);
  const more = Router.mark(marked, { cooldownKey: 'morning-recovery|2026-09-14' }, 'offered', at);
  assert.deepEqual(more.delivered[body.cooldownKey], result.ledger.delivered[body.cooldownKey]);
  assert.equal(M.prepare(marked, null, body, 'alice', at).body.repeat, true);
  assert.equal(M.prepare(marked, null, { ...body, state: 'dismissed' }, 'alice', at).status, 409);
  const corrupt = structuredClone(marked); corrupt.delivered[body.cooldownKey].receipt.persistedAt = 'broken';
  assert.equal(Router.sanitizeLedger(corrupt), null);
});
test('lost successful response + reload repeats identical bytes and opens only after receipt', async () => {
  const h = harness([new Error('response lost')]);
  assert.equal(await h.runtime.respond('accepted', offer), false);
  assert.equal(h.committed(), 0); assert.equal(h.opened.length, 0); assert.equal(h.runtime.state().pending, true);
  const first = h.calls[0].body; h.runtime.dispose();
  const reload = harness([response(200, receipt({ repeat: true }))], h.data);
  assert.equal(reload.runtime.state().error, 'morning_unconfirmed');
  assert.equal(reload.calls.length, 0, 'restoration never posts or opens automatically');
  assert.equal(await reload.runtime.retry(), true);
  assert.equal(reload.calls[0].body, first); assert.equal(reload.committed(), 1);
  assert.deepEqual(reload.opened, ['attention-open-return']); assert.equal(reload.data.size, 0);
});
test('in-flight double answer cannot replace the intention or open the surface early', async () => {
  const d = deferred(), h = harness([d.promise]);
  const first = h.runtime.respond('accepted', offer); await tick();
  assert.equal(h.runtime.state().busy, true); assert.equal(h.opened.length, 0); assert.equal(h.committed(), 0);
  assert.equal(await h.runtime.respond('dismissed', offer), false); assert.equal(h.calls.length, 1);
  d.resolve(response(200, receipt())); assert.equal(await first, true); assert.equal(h.opened.length, 1);
});
test('dismiss waits for the exact receipt and never opens a surface', async () => {
  const h = harness([response(500, {}), response(200, receipt({ state: 'dismissed' }))]);
  assert.equal(await h.runtime.respond('dismissed', offer), false); assert.equal(h.committed(), 0);
  assert.equal(await h.runtime.respond('accepted', offer), true);
  assert.equal(h.calls[0].body, h.calls[1].body); assert.equal(h.committed(), 1); assert.equal(h.opened.length, 0);
});
test('offline, 500, 422, malformed success and mismatched receipt preserve the retry', async () => {
  for (const reply of [new Error('offline'), response(500, { error: 'save_failed' }), response(422, { error: 'invalid_secretary_state' }),
    response(200, { ok: true }), response(200, null, async () => { throw new Error('lost body'); }), response(200, receipt({ token: 'other' }))]) {
    const h = harness([reply]); await h.runtime.respond('accepted', offer);
    assert.equal(h.runtime.state().pending, true); assert.ok(h.runtime.state().error); assert.equal(h.committed(), 0); assert.equal(h.opened.length, 0);
  }
});
test('quota before POST sends nothing, and quota while saving receipt does not report success', async () => {
  const h = harness([response(200, receipt())]); h.failWrite(1);
  await h.runtime.respond('accepted', offer); assert.equal(h.calls.length, 0); assert.equal(h.runtime.state().pending, true);
  assert.equal(await h.runtime.retry(), true); assert.equal(h.calls.length, 1);
  const k = harness([response(200, receipt()), response(200, receipt({ repeat: true }))]); k.failWrite(2);
  await k.runtime.respond('accepted', offer); assert.equal(k.committed(), 0); assert.equal(k.runtime.state().pending, true);
  assert.equal(await k.runtime.retry(), true); assert.equal(k.calls[0].body, k.calls[1].body);
});
test('account, epoch, disposal and body-await guards suppress late receipt, errors and 401', async () => {
  for (const phase of ['headers', 'body']) for (const change of ['account', 'epoch', 'dispose']) {
    const d = deferred();
    const h = harness([phase === 'headers' ? d.promise : response(200, null, () => d.promise)]);
    const work = h.runtime.respond('accepted', offer); await tick(); const before = h.changes();
    if (change === 'account') h.scope.accountId = 'bob'; else if (change === 'epoch') h.scope.epoch += 1; else h.runtime.dispose();
    d.resolve(phase === 'headers' ? response(401, {}) : receipt()); await work;
    assert.equal(h.committed(), 0); assert.equal(h.opened.length, 0); assert.equal(h.expired(), 0); assert.equal(h.changes(), before);
  }
  const h = harness([response(401, {})]); await h.runtime.respond('accepted', offer);
  assert.equal(h.expired(), 1); assert.equal(h.runtime.state().pending, true);
});
test('session/Guide/visibility blocker after receipt keeps a confirmed opening across reload', async () => {
  const h = harness([response(200, receipt())]); h.block(true);
  await h.runtime.respond('accepted', offer);
  assert.equal(h.runtime.state().confirmed, true); assert.equal(h.committed(), 0); assert.equal(h.opened.length, 0);
  h.runtime.dispose(); const reload = harness([], h.data);
  assert.equal(await reload.runtime.retry(), true); assert.equal(reload.calls.length, 0); assert.equal(reload.opened.length, 1);
});
test('yesterday accepted receipt never opens today; definite stale/conflicting outcome clears only on server evidence', async () => {
  const h = harness([response(200, receipt())]); h.nextDay(); await h.runtime.respond('accepted', offer);
  assert.equal(h.runtime.state().error, 'morning_stale'); assert.equal(h.runtime.state().pending, false); assert.equal(h.opened.length, 0);
  await h.runtime.retry(); assert.equal(h.runtime.state().error, '');
  for (const error of ['terminal_outcome', 'offer_not_found']) {
    const k = harness([response(409, { error })]); await k.runtime.respond('accepted', offer);
    assert.equal(k.runtime.state().error, 'morning_terminal'); assert.equal(k.runtime.state().pending, false); assert.equal(k.opened.length, 0);
  }
});
test('corrupt tab record stays visible without HTTP; repaired storage permits explicit retry', async () => {
  const data = new Map([['satoru.secretary.morning.alice', '{broken']]);
  const h = harness([], data); assert.equal(h.runtime.state().error, 'morning_storage');
  await h.runtime.retry(); assert.equal(h.calls.length, 0); assert.equal(data.size, 1);
  data.clear(); await h.runtime.retry(); assert.equal(h.runtime.state().error, '');
});

test('hung response body times out, retains identical replay, and cannot apply a late success', async () => {
  const d = deferred(), h = harness([response(200, null, () => d.promise), response(200, receipt())]);
  h.runtime.dispose(); h.env.timeoutMs = 5; const runtime = M.create(h.env);
  await runtime.respond('accepted', offer);
  assert.equal(runtime.state().busy, false); assert.equal(runtime.state().pending, true); assert.equal(h.opened.length, 0);
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(await runtime.retry(), true); d.resolve(receipt()); await tick();
  assert.equal(h.opened.length, 1); assert.equal(h.calls[0].body, h.calls[1].body);
});

test('explicit skip releases an unreadable morning recovery without discarding a valid intention', async () => {
  const data = new Map([['satoru.secretary.morning.alice', '{broken'], ['other-domain', 'keep']]);
  const h = harness([], data);
  assert.equal(h.runtime.state().canSkip, true); assert.equal(h.runtime.skipUnreadable(), true);
  assert.equal(h.runtime.state().error, ''); assert.equal(h.runtime.state().pending, false);
  assert.equal(h.runtime.state().unavailable, true); assert.equal(data.get('other-domain'), 'keep');
  assert.equal(h.committed(), 0); assert.equal(await h.runtime.respond('accepted', offer), false); assert.equal(h.calls.length, 0);
  const valid = harness([new Error('lost')]); await valid.runtime.respond('accepted', offer);
  assert.equal(valid.runtime.state().canSkip, false); assert.equal(valid.runtime.skipUnreadable(), false);
  assert.equal(valid.runtime.state().pending, true);
});

test('refused synchronous dialog opening preserves confirmed receipt for explicit retry', async () => {
  const h = harness([response(200, receipt())]); h.env.open = () => null;
  await h.runtime.respond('accepted', offer); assert.equal(h.runtime.state().confirmed, true);
  assert.equal(h.runtime.state().error, 'opening_deferred');
  h.env.open = () => h.opened.push('return'); await h.runtime.retry();
  assert.equal(h.calls.length, 1); assert.equal(h.opened.length, 1);
});

test('actual app click adapter gates the existing CTA and error retry on the receipt', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const extract = (start, end) => { const from = source.indexOf(start), until = source.indexOf(end, from); assert.ok(from >= 0 && until > from); return source.slice(from, until); };
  const runtimeSource = extract('let _morningOutcome =', 'function secretaryNextSnapshot()');
  const reportSource = extract('async function reportSecretaryOutcome(', 'function secretaryOfferHTML(');
  const clickSource = extract('async function onClick(e)', "  if (action === 'first-value-choose-route')") + "return 'unsafe-fallthrough'; }";
  const pending = deferred(), data = new Map(), calls = [], opened = [];
  const State = { me: { id: 'alice' }, phase: 'app', view: 'today', secretaryOffer: { ...offer, accountId: 'alice', epoch: 1 } };
  const Store = { _writeEpoch: 1 };
  const sandbox = vm.createContext({ State, Store, JSON, window: { MorningOutcomeV1: M },
    document: { hidden: false, querySelectorAll: () => [] }, todayStr: () => day, guideV3State: () => null,
    secretaryNextSnapshot: () => ({ dayClosed: false, activeSession: false, guideActive: false }),
    sessionStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) },
    fetch: async (url, options) => { calls.push(options.body); return calls.length === 1 ? await pending.promise : response(200, receipt({ repeat: true })); },
    render: () => {}, handleAccountSessionExpired: () => assert.fail('unexpected expiry'), openAttentionReturn: () => opened.push('return'),
  });
  vm.runInContext(runtimeSource + reportSource + clickSource, sandbox);
  const click = (action, accept = '') => {
    const el = { dataset: { action, secretaryAccept: accept }, closest: selector => selector === '[data-action]' ? el : null };
    return sandbox.onClick({ target: el });
  };
  const work = click('attention-open-return', '1'); await tick();
  assert.equal(opened.length, 0); assert.ok(State.secretaryOffer?.view);
  pending.resolve(response(500, { error: 'save_failed' })); assert.equal(await work, undefined);
  assert.ok(State.secretaryOffer?.view); assert.equal(opened.length, 0);
  assert.equal(await click('secretary-next-retry'), undefined);
  assert.equal(State.secretaryOffer, null); assert.deepEqual(opened, ['return']); assert.equal(calls[0], calls[1]);
  State.secretaryOffer = { ...offer, accountId: 'alice', epoch: 1 }; Store._writeEpoch = 2;
  assert.equal(await sandbox.reportSecretaryOutcome('accepted'), false); assert.equal(calls.length, 2, 'old visible offer cannot cross a write epoch');
});
