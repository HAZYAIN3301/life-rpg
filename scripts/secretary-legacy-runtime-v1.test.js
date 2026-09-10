'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const from = app.indexOf('async function loadLegacySecretaryOffer()');
const until = app.indexOf('async function settleSecretaryClaim(', from);
assert.ok(from >= 0 && until > from, 'extract the actual legacy loader, not a copied implementation');
const source = app.slice(from, until);
const rawOffer = { offerId: 'morning-recovery|2026-09-10|known' };
const view = { offerId: rawOffer.offerId, title: 'Prepared morning card' };
const response = (status, data, json) => ({ status, ok: status >= 200 && status < 300, json: json || (async () => data) });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

function harness(responses) {
  const State = { me: { id: 'alice' }, secretaryOffer: undefined, _secretaryOfferBusy: false };
  const calls = [], settled = [], errors = [];
  let renders = 0, expired = 0;
  const sandbox = vm.createContext({ State, Date,
    window: { SecretaryOfferViewV1: { presentOffer: raw => raw?.offerId === rawOffer.offerId ? view : null } },
    todayStr: () => '2026-09-10',
    fetch: async (route, options) => {
      calls.push({ route, options });
      assert.ok(responses.length, `unexpected request ${route}`);
      const next = responses.shift(); if (next instanceof Error) throw next; return await next;
    },
    render: () => { renders += 1; }, handleAccountSessionExpired: () => { expired += 1; },
    settleSecretaryClaim: (...args) => settled.push(args), console: { error: (...args) => errors.push(args) },
  });
  vm.runInContext(source, sandbox);
  return { State, calls, settled, errors, load: () => sandbox.loadLegacySecretaryOffer(), renders: () => renders, expired: () => expired,
    switchAccount: () => { State.me = { id: 'bob' }; State.secretaryOffer = undefined; State._secretaryOfferBusy = false; } };
}

test('legacy null offer is healthy silence, while 422/500/offline/invalid JSON are visible failures', async () => {
  const quiet = harness([response(200, { offer: null })]);
  await quiet.load(); assert.equal(quiet.State.secretaryOffer, null); assert.equal(quiet.calls.length, 1);
  assert.equal(quiet.State._secretaryOfferBusy, false); assert.equal(quiet.settled.length, 0);
  for (const [reply, expected] of [
    [response(422, { error: 'invalid_secretary_state' }), 'invalid_secretary_state'],
    [response(500, { error: 'save_failed' }), 'network'],
    [new Error('offline'), 'offline'],
    [response(200, null, async () => { throw new Error('bad json'); }), 'bad json'],
    [response(200, {}), 'invalid_response'], [response(200, { offer: {} }), 'invalid_response'],
  ]) {
    const h = harness([reply]); await h.load();
    assert.equal(h.State.secretaryOffer.error, expected);
    assert.equal(h.State._secretaryOfferBusy, false); assert.equal(h.calls.length, 1);
    assert.equal(h.settled.length, 0); assert.ok(h.renders() > 0, 'failure is published for the existing error/retry UI');
  }
});

test('legacy claim 409 is quiet arbitration; 500/422/malformed success are honest errors', async () => {
  for (const [reply, expected] of [
    [response(409, { error: 'held' }), null], [response(500, { error: 'save_failed' }), 'network'],
    [response(422, { error: 'invalid_secretary_state' }), 'invalid_secretary_state'],
    [response(200, {}), 'invalid_response'], [response(200, { token: '' }), 'invalid_response'],
    [response(200, { token: 123 }), 'invalid_response'],
    [response(200, null, async () => { throw new Error('body lost'); }), 'invalid_response'],
  ]) {
    const h = harness([response(200, { offer: rawOffer }), reply]); await h.load();
    if (expected === null) assert.equal(h.State.secretaryOffer, null);
    else assert.equal(h.State.secretaryOffer.error, expected);
    assert.equal(h.calls.length, 2); assert.equal(h.settled.length, 0); assert.equal(h.State._secretaryOfferBusy, false);
  }
});

test('legacy card stays absent until durable claim, then settles exactly the received token', async () => {
  const pending = deferred();
  const h = harness([response(200, { offer: rawOffer }), pending.promise]);
  const loading = h.load(); await tick();
  assert.equal(h.calls[1].route, '/api/secretary/claim'); assert.equal(h.State.secretaryOffer, undefined);
  assert.equal(h.State._secretaryOfferBusy, true); assert.equal(h.settled.length, 0);
  await h.load(); assert.equal(h.calls.length, 2, 'busy render cannot send another claim');
  pending.resolve(response(200, { token: 'durable-token' })); await loading;
  assert.equal(h.State.secretaryOffer.view, view); assert.equal(h.State.secretaryOffer.token, 'durable-token');
  assert.deepEqual(h.settled, [[view.offerId, 'durable-token', 'delivered']]);
  await h.load(); assert.equal(h.calls.length, 2, 'an already shown offer is not fetched again');
});

test('legacy failure can be retried after the UI resets its error state', async () => {
  const h = harness([response(422, {}), response(200, { offer: null })]);
  await h.load(); assert.equal(h.State.secretaryOffer.error, 'invalid_secretary_state');
  h.State.secretaryOffer = undefined;
  await h.load(); assert.equal(h.State.secretaryOffer, null); assert.equal(h.calls.length, 2);
});

test('late GET body and claim response cannot populate the next account', async () => {
  const body = deferred();
  const get = harness([response(200, null, () => body.promise)]);
  const getWork = get.load(); await tick(); get.switchAccount(); body.resolve({ offer: rawOffer }); await getWork;
  assert.equal(get.State.secretaryOffer, undefined); assert.equal(get.calls.length, 1); assert.equal(get.renders(), 0);
  const claim = deferred();
  const h = harness([response(200, { offer: rawOffer }), claim.promise]);
  const work = h.load(); await tick(); h.switchAccount(); claim.resolve(response(200, { token: 'old-token' })); await work;
  assert.equal(h.State.secretaryOffer, undefined); assert.equal(h.settled.length, 0); assert.equal(h.renders(), 0);
});

test('account switch during claim JSON consumption cannot show or settle the previous offer', async () => {
  const body = deferred();
  const h = harness([response(200, { offer: rawOffer }), response(200, null, () => body.promise)]);
  const work = h.load(); await tick(); h.switchAccount(); body.resolve({ token: 'old-token' }); await work;
  assert.equal(h.State.secretaryOffer, undefined); assert.equal(h.settled.length, 0); assert.equal(h.renders(), 0);
});

test('late 401 for the previous account cannot expire the new account session', async () => {
  const pending = deferred(), h = harness([pending.promise]);
  const work = h.load(); h.switchAccount(); pending.resolve(response(401, { error: 'not logged in' })); await work;
  assert.equal(h.expired(), 0); assert.equal(h.State.secretaryOffer, undefined); assert.equal(h.renders(), 0);
  const current = harness([response(401, {})]); await current.load(); assert.equal(current.expired(), 1);
});
