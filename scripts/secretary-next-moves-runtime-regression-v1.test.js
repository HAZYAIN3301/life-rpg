'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Policy = require('../public/secretary-next-moves-v2.js');
const Producer = require('../public/secretary-next-moves-producer-v1.js');
const Client = require('../public/secretary-next-moves-client-v1.js');
const NOW = '2026-09-10T12:00:00.000Z';
const DAY = '2026-09-10';
const copy = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
const error = code => Object.assign(new Error(code), { code });

function snapshot(extra = {}) {
  return { now: NOW, today: DAY, utcOffsetMinutes: 0, dayClosed: false, tasks: [{ id: 'q1', title: 'Saved task', done: false, date: DAY }],
    habits: [], habitlog: {}, settings: {}, guideActive: false, activeSession: false, firstValueStatus: null,
    lapse: { confirmed: true, source: 'user_confirmed', eventKey: 'attention:episode1', day: DAY,
      endedAt: '2026-09-10T11:58:00.000Z', observedAt: NOW, originalRef: 'quest:q1' }, ...extra };
}
function offer(extra = {}) {
  const s = snapshot(extra), projected = Producer.build(s); assert.equal(projected.ok, true);
  return Policy.decide({ ...projected.context, now: NOW, today: DAY, utcOffsetMinutes: 0, invocation: 'app_open',
    availableChannels: ['card'], enabledCapabilities: ['after-lapse-return'], ledger: Policy.emptyLedger() }).offer;
}
const claimReceipt = o => ({ ok: true, offer: o, token: 'claim-token', persistedAt: NOW });
const outcomeReceipt = (o, outcome = 'accepted') => ({ ok: true, outcome, action: outcome === 'accepted' ? o.primary.action : null, persistedAt: NOW });

function clientHarness(rpc, storage = { value: null }, extras = {}) {
  let seq = 0;
  const client = Client.create({ accountId: 'a', clientId: 'tab_a', requestId: () => 'r' + ++seq, currentAccount: () => 'a', rpc,
    readPending: () => copy(storage.value), writePending: value => { storage.value = copy(value); }, ...extras });
  return { client, storage };
}
async function loadClient(h, o = offer()) { assert.equal(await h.client.load({ local: 'context' }), true); assert.equal(h.client.state().offer.offerId, o.offerId); }

function runtimeHarness({ storage = new Map(), current = snapshot(), onRequest, onChanged = () => {}, open = () => true } = {}) {
  let account = 'a', id = 0, runtime, changes = 0;
  const calls = [], opened = [], timers = new Map();
  const sandbox = vm.createContext({ console, Date, JSON, Promise, SecretaryNextMovesProducerV1: Producer,
    setTimeout: fn => { const handle = ++id; timers.set(handle, fn); return handle; }, clearTimeout: handle => timers.delete(handle) });
  for (const name of ['client', 'runtime']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', `secretary-next-moves-${name}-v1.js`), 'utf8'), sandbox);
  }
  const env = {
    account: () => account, snapshot: () => copy(current), id: () => String(++id),
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (route, init) => {
      assert.equal(route, '/api/secretary/next-moves');
      const body = JSON.parse(init.body); calls.push(copy(body));
      const data = onRequest ? await onRequest(body) : body.op === 'decide' ? { ok: true, offer: offer() }
        : body.op === 'claim' ? claimReceipt(offer()) : outcomeReceipt(offer(), body.outcome);
      return { ok: true, status: 200, json: async () => data };
    },
    changed: () => { changes += 1; onChanged(runtime, changes); }, expired: () => { throw new Error('unexpected expiry'); },
    open: action => { opened.push(copy(action)); return open(action); },
  };
  runtime = sandbox.SecretaryNextMovesRuntimeV1.create(env);
  return { runtime, env, calls, opened, storage, timers, current,
    changes: () => changes, switchAccount: value => { account = value; },
    reload: () => { runtime.dispose(); runtime = sandbox.SecretaryNextMovesRuntimeV1.create(env); return runtime; } };
}

test('outcome storage survives reload with the original request, context, action and token', async () => {
  const o = offer(), sent = [], storage = { value: null };
  const a = clientHarness(async body => {
    if (body.op === 'decide') return { ok: true, offer: o };
    if (body.op === 'claim') return claimReceipt(o);
    sent.push(copy(body)); throw error('network');
  }, storage);
  await loadClient(a, o);
  assert.equal(await a.client.outcome('accepted', 'primary', { generation: 1, activeSession: { active: false } }), null);
  const durableIntent = copy(storage.value.pending);
  const b = clientHarness(async body => { sent.push(copy(body)); return outcomeReceipt(o); }, storage);
  assert.equal(b.client.state().error, 'unconfirmed');
  assert.equal(await b.client.outcome('dismissed', 'primary'), null, 'a different outcome cannot replace uncertain acceptance');
  assert.ok(await b.client.outcome('accepted', 'primary', { generation: 2, activeSession: { active: true } }));
  assert.deepEqual(sent[0], durableIntent); assert.deepEqual(sent[1], durableIntent);
  assert.equal(storage.value, null);
});

test('a terminal 409 after reload clears persisted intent and allows a fresh decision', async () => {
  const o = offer();
  for (const code of ['stale_target', 'offer_expired', 'terminal_outcome', 'offer_not_found']) {
    const storage = { value: { offer: o, pending: { op: 'outcome', clientId: 'tab_a', requestId: 'old-intent',
      offerId: o.offerId, token: 'claim-token', outcome: 'accepted', actionId: 'primary' } } };
    let fail = true;
    const h = clientHarness(async () => { if (fail) throw error(code); return { ok: true, offer: null, silence: { reason: 'nothing_eligible' } }; }, storage);
    assert.equal(await h.client.outcome('accepted'), null);
    assert.equal(h.client.state().error, code); assert.equal(h.client.state().offer, null);
    assert.equal(h.client.pending(), null); assert.equal(storage.value, null);
    fail = false;
    assert.equal(await h.client.load({}, true), true); assert.equal(h.client.state().phase, 'silence');
  }
});

test('malformed receipt timestamps never produce an offer or acknowledge an outcome', async () => {
  const o = offer();
  for (const bad of [null, 0, 'today', '2026-09-10T12:00:00', '2026-02-30T12:00:00.000Z']) {
    assert.equal(Client.validOffer({ ...o, expiresAt: bad }), false);
    const h = clientHarness(async body => body.op === 'decide' ? { ok: true, offer: o } : { ...claimReceipt(o), persistedAt: bad });
    assert.equal(await h.client.load({}), false); assert.equal(h.client.state().offer, null);
    const accepted = clientHarness(async body => body.op === 'decide' ? { ok: true, offer: o }
      : body.op === 'claim' ? claimReceipt(o) : { ...outcomeReceipt(o), persistedAt: bad });
    await loadClient(accepted, o);
    assert.equal(await accepted.client.outcome('accepted'), null);
    assert.equal(accepted.client.state().error, 'invalid_response'); assert.ok(accepted.client.pending());
  }
});

test('accepted action must equal the selected action including target, size and day', async () => {
  const o = offer();
  const altered = [
    { ...o.primary.action, args: { ...o.primary.action.args, targetRef: 'quest:q2' } },
    { ...o.primary.action, args: { ...o.primary.action.args, size: 'planned' } },
    { ...o.primary.action, args: { ...o.primary.action.args, day: '2026-09-11' } },
    { type: 'ask_one_question', args: { day: DAY, questionId: 'return_next_smallest' } },
  ];
  for (const action of altered) {
    const h = clientHarness(async body => body.op === 'decide' ? { ok: true, offer: o }
      : body.op === 'claim' ? claimReceipt(o) : { ...outcomeReceipt(o), action });
    await loadClient(h, o); assert.equal(await h.client.outcome('accepted'), null); assert.ok(h.client.pending());
  }
  const reordered = clientHarness(async body => body.op === 'decide' ? { ok: true, offer: o } : body.op === 'claim' ? claimReceipt(o)
    : { ...outcomeReceipt(o), action: { type: 'task_open_prepared', args: { day: DAY, size: 'minimum', targetRef: 'quest:q1' } } });
  await loadClient(reordered, o); assert.ok(await reordered.client.outcome('accepted'), 'JSON property order is not action identity');
});

test('real policy question offers pass the client executor gate', async () => {
  const o = offer({ tasks: [] });
  assert.equal(o.primary.action.type, 'ask_one_question');
  assert.equal(Client.validOffer(o), true, `policy question ${o.primary.action.args.questionId} must be executable`);
  const h = clientHarness(async body => body.op === 'decide' ? { ok: true, offer: o }
    : body.op === 'claim' ? claimReceipt(o) : outcomeReceipt(o));
  await loadClient(h, o); assert.ok(await h.client.outcome('accepted'));
});

test('a session appearing during accepted RPC defers opening, survives reload and opens once on retry', async () => {
  let release;
  const response = new Promise(resolve => { release = resolve; });
  const h = runtimeHarness({ onRequest: body => body.op === 'decide' ? { ok: true, offer: offer() }
    : body.op === 'claim' ? claimReceipt(offer()) : response });
  await h.runtime.load();
  const accepting = h.runtime.respond('accepted'); await turn();
  h.current.activeSession = true; release(outcomeReceipt(offer()));
  assert.equal(await accepting, false); assert.equal(h.opened.length, 0);
  assert.equal(h.runtime.state().error, 'context_blocked');
  assert.ok(h.storage.get('satoru.secretary.next.a.open'));
  const reloaded = h.reload();
  assert.equal(await reloaded.retry(), false); assert.equal(h.opened.length, 0);
  h.current.activeSession = false;
  assert.equal(await reloaded.retry(), true); assert.equal(h.opened.length, 1);
  assert.equal(h.storage.has('satoru.secretary.next.a.open'), false);
  assert.equal(h.calls.filter(body => body.op === 'outcome').length, 1, 'retry opens the confirmed action without another accepted mutation');
  reloaded.dispose();
});

test('deferred retry cannot open an action in a different account', async () => {
  const storage = new Map([['satoru.secretary.next.a.open', JSON.stringify(outcomeReceipt(offer()))]]);
  const h = runtimeHarness({ storage }); h.switchAccount('b');
  assert.equal(await h.runtime.retry(), false); assert.equal(h.opened.length, 0);
  assert.equal(h.calls.length, 0); h.runtime.dispose();
});

test('deferred storage without a durable accepted receipt cannot authorize an open', async () => {
  for (const bad of [{ action: offer().primary.action }, { ...outcomeReceipt(offer()), persistedAt: 'bad' },
    { ...outcomeReceipt(offer()), outcome: 'dismissed' }, { ...outcomeReceipt(offer()), ok: false }]) {
    const storage = new Map([['satoru.secretary.next.a.open', JSON.stringify(bad)]]);
    const h = runtimeHarness({ storage, onRequest: () => ({ ok: true, offer: null, silence: { reason: 'nothing_eligible' } }) });
    await h.runtime.retry(); assert.equal(h.opened.length, 0);
    assert.equal(h.calls[0]?.op, 'decide', 'invalid deferred storage returns to server authority');
    h.runtime.dispose();
  }
});

test('healthy silence is reused until flags or the lapse signal change', async () => {
  const h = runtimeHarness({ current: snapshot({ lapse: null }), onRequest: () => ({ ok: true, offer: null, silence: { reason: 'nothing_eligible' } }) });
  assert.equal(await h.runtime.load(), true);
  await h.runtime.load(); assert.equal(h.calls.length, 1, 'healthy unchanged render does not re-decide');
  for (const mutate of [() => { h.current.activeSession = true; }, () => { h.current.activeSession = false; },
    () => { h.current.guideActive = true; }, () => { h.current.firstValueStatus = 'action_ready'; },
    () => { h.current.lapse = snapshot().lapse; }, () => { h.current.lapse.originalRef = 'quest:q2'; }]) {
    const before = h.calls.length; mutate(); await h.runtime.load(); assert.equal(h.calls.length, before + 1);
  }
  h.runtime.dispose();
});

test('render-triggered load during invalidation cannot recursively publish or duplicate decide', async () => {
  const inner = [];
  const h = runtimeHarness({ current: snapshot({ lapse: null }), onRequest: () => ({ ok: true, offer: null, silence: { reason: 'nothing_eligible' } }),
    onChanged: (runtime, changes) => { assert.ok(changes < 25, 'bounded publication during synchronous render reentrancy'); if (runtime) inner.push(runtime.load()); } });
  await h.runtime.load(); await turn(); await Promise.all(inner);
  assert.equal(h.calls.length, 1);
  h.current.activeSession = true;
  await h.runtime.load(); await turn(); await Promise.all(inner);
  assert.equal(h.calls.length, 2, 'one new decision for a changed signal');
  assert.ok(h.changes() < 15); h.runtime.dispose();
});

test('invalid projection publishes one stable error under synchronous render reentrancy, then recovers', async () => {
  const inner = [];
  const h = runtimeHarness({ current: snapshot({ lapse: null, settings: null }),
    onRequest: () => ({ ok: true, offer: null, silence: { reason: 'nothing_eligible' } }),
    onChanged: (runtime, changes) => { assert.ok(changes < 20, 'invalid snapshot must not recursively republish the same error'); if (runtime) inner.push(runtime.load()); } });
  assert.equal(await h.runtime.load(), false); await turn(); await Promise.all(inner);
  const invalid = h.runtime.state().error;
  assert.equal(invalid, 'invalid_owner_snapshot');
  assert.equal(h.runtime.state().phase, 'error'); assert.equal(h.calls.length, 0); assert.equal(h.changes(), 1);
  for (let i = 0; i < 5; i += 1) assert.equal(await h.runtime.load(), false);
  assert.equal(h.changes(), 1, 'unchanged invalid data has no new publication'); assert.equal(h.calls.length, 0);
  h.current.settings = {};
  await h.runtime.load(); await turn(); await Promise.all(inner);
  assert.equal(h.runtime.state().error, null); assert.equal(h.runtime.state().phase, 'silence'); assert.equal(h.calls.length, 1);
  h.current.settings = null;
  await h.runtime.load(); await turn(); await Promise.all(inner);
  assert.equal(h.runtime.state().error, invalid); assert.equal(h.calls.length, 1);
  const beforeRecovery = h.changes();
  h.current.settings = {};
  await h.runtime.load(); await turn(); await Promise.all(inner);
  assert.equal(h.runtime.state().error, null); assert.equal(h.runtime.state().phase, 'silence');
  assert.ok(h.changes() > beforeRecovery, 'clearing a displayed error must repaint even when the healthy signal is unchanged');
  h.runtime.dispose();
});
