'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Runtime = require('../public/chest-claim-runtime-v1');
const Claim = require('../public/chest-claim-v1');
const Issuer = require('../server-chest-rewards-v1');
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(Claim.canonical(value)).digest('hex');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const values = { settings: { locale: 'ru' }, tasks: [{ id: 'done', done: true, date: '2026-09-12' }], habitlog: {}, skilltree: {} };
  const saved = Object.fromEntries([...Claim.FILES, Issuer.LEDGER_FILE].map(name => [name,
    Object.hasOwn(values, name) ? { exists: true, value: clone(values[name]) } : { exists: false, value: null }]));
  const base = Object.fromEntries(Claim.FILES.map(name => [name, clone(saved[name])]));
  const stats = { calls: [], expired: 0, applied: [], boundaries: 0, requestIds: 0, bases: 0, draws: 0 };
  const holder = {}, session = { account: 'owner-a', epoch: 4 }, current = () => session.account === 'owner-a' && session.epoch === 4;
  const actualReceipt = body => Issuer.issue({ payload: JSON.parse(body), actual: saved, hash, now: '2026-09-12T12:00:00.000Z',
    entropy() { stats.draws++; return [0, 0, 0]; },
    commit(data) { for (const [name, value] of Object.entries(data)) saved[name] = { exists: true, value: clone(value) }; },
  });
  const response = (body, extra = {}) => {
    const receipt = actualReceipt(body);
    return { status: 200, ok: true, async json() { return clone(receipt); }, ...extra };
  };
  const adapter = {
    current,
    requestId() { stats.requestIds++; return 'chest_runtime_request_0001'; },
    timeZone() { return 'Europe/Berlin'; },
    base() { stats.bases++; return base; },
    async fetch(url, options) { stats.calls.push({ url, ...options }); return response(options.body); },
    expired() { stats.expired++; },
    async boundary() { stats.boundaries++; return false; },
    apply(receipt) { stats.applied.push(clone(receipt)); return true; },
  };
  return { adapter, holder, stats, session, base, saved, response, actualReceipt,
    run: () => Runtime.commit(holder, adapter) };
}

test('runtime sends only frozen protocol bytes and applies a fully verified real issuer receipt', async () => {
  const f = fixture(), receipt = await f.run();
  assert.equal(Claim.receiptValid(receipt, f.holder.request), true);
  assert.equal(f.stats.calls.length, 1); assert.equal(f.stats.applied.length, 1);
  assert.equal(f.stats.calls[0].url, '/api/rewards/chest'); assert.equal(f.stats.calls[0].method, 'POST');
  assert.deepEqual(Object.keys(JSON.parse(f.stats.calls[0].body)).sort(), ['base', 'requestId', 'timeZone', 'version']);
  assert.ok(f.stats.calls[0].signal instanceof AbortSignal);
  assert.equal(f.holder.error, '');
});

test('initialization exceptions, missing base and crypto failures return null without request/apply', async () => {
  for (const field of ['requestId', 'timeZone', 'base']) {
    const f = fixture(); f.adapter[field] = () => { throw new Error('initialization failed'); };
    assert.equal(await f.run(), null); assert.equal(f.holder.error, 'chest_state_not_supported');
    assert.equal(f.stats.calls.length, 0); assert.equal(f.stats.applied.length, 0);
    assert.equal(f.holder.request, undefined); assert.equal(f.holder.body, undefined);
  }
  const f = fixture(); f.adapter.base = () => null;
  assert.equal(await f.run(), null); assert.equal(f.holder.error, 'chest_state_not_supported');
  assert.equal(f.stats.calls.length, 0);
});

test('no optimistic effect while fetch or JSON decoding is unresolved', async () => {
  const f = fixture(), fetching = deferred(), parsing = deferred(), entered = deferred();
  f.adapter.fetch = () => fetching.promise;
  const pending = f.run(); assert.equal(f.stats.applied.length, 0);
  const receipt = f.actualReceipt(f.holder.body);
  fetching.resolve({ status: 200, ok: true, json() { entered.resolve(); return parsing.promise; } });
  await entered.promise; assert.equal(f.stats.applied.length, 0);
  parsing.resolve(receipt);
  assert.ok(await pending); assert.equal(f.stats.applied.length, 1);
});

test('lost response retries identical bytes and original prize even after adapter base changes', async () => {
  const f = fixture(); let calls = 0;
  f.adapter.fetch = async (url, options) => {
    f.stats.calls.push({ url, ...options }); const reply = f.response(options.body);
    if (++calls === 1) throw new TypeError('network lost after commit');
    return reply;
  };
  assert.equal(await f.run(), null); assert.equal(f.stats.applied.length, 0);
  assert.equal(f.holder.error, 'chest_save_unconfirmed');
  f.base.settings.value.locale = 'de'; f.base.tasks.value.push({ done: false, id: 'new-edit' });
  f.adapter.requestId = () => { throw new Error('must not create new request on retry'); };
  f.adapter.base = () => { throw new Error('must not refresh exact base on retry'); };
  const receipt = await f.run(); assert.equal(receipt.replayed, true);
  assert.equal(f.stats.calls[0].body, f.stats.calls[1].body); assert.equal(f.stats.draws, 1);
  assert.equal(f.stats.applied.length, 1); assert.equal(f.holder.request.base.settings.value.locale, 'ru');
});

test('account or epoch already changed prevents request initialization and all effects', async () => {
  for (const change of [f => { f.session.account = 'owner-b'; }, f => { f.session.epoch++; }]) {
    const f = fixture(); change(f); f.holder.error = 'current-session-feedback';
    assert.equal(await f.run(), null); assert.equal(f.stats.requestIds, 0);
    assert.equal(f.stats.calls.length, 0); assert.equal(f.holder.error, 'current-session-feedback');
  }
});

test('late success and 401 from former account/epoch cannot parse, expire or apply', async () => {
  for (const status of [200, 401]) for (const change of [f => { f.session.account = 'owner-b'; }, f => { f.session.epoch++; }]) {
    const f = fixture(), waiting = deferred(); let parses = 0;
    f.adapter.fetch = () => waiting.promise;
    const pending = f.run(); change(f); f.holder.error = 'replacement-session-feedback';
    waiting.resolve({ status, ok: status === 200, async json() { parses++; return {}; } });
    assert.equal(await pending, null); assert.equal(parses, 0); assert.equal(f.stats.expired, 0);
    assert.equal(f.stats.boundaries, 0); assert.equal(f.stats.applied.length, 0);
    assert.equal(f.holder.error, 'replacement-session-feedback');
  }
});

test('late fetch rejection does not replace feedback in another account/epoch', async () => {
  for (const change of [f => { f.session.account = 'owner-b'; }, f => { f.session.epoch++; }]) {
    const f = fixture(), waiting = deferred(); f.adapter.fetch = () => waiting.promise;
    const pending = f.run(); change(f); f.holder.error = 'replacement-session-feedback';
    waiting.reject(new Error('late network error'));
    assert.equal(await pending, null); assert.equal(f.holder.error, 'replacement-session-feedback');
    assert.equal(f.stats.applied.length, 0); assert.equal(f.stats.expired, 0);
  }
});

test('account/epoch changed during boundary parsing prevents response JSON and UI effects', async () => {
  const f = fixture(), boundary = deferred(), entered = deferred(); let parses = 0;
  f.adapter.boundary = () => { entered.resolve(); return boundary.promise; };
  f.adapter.fetch = async () => ({ status: 200, ok: true, async json() { parses++; return {}; } });
  const pending = f.run(); await entered.promise; f.session.epoch++; boundary.resolve(false);
  assert.equal(await pending, null); assert.equal(parses, 0); assert.equal(f.stats.applied.length, 0);
});

test('late successful or rejected JSON cannot apply or change replacement-session feedback', async () => {
  for (const reject of [false, true]) for (const status of [200, 409]) {
    const f = fixture(), parsing = deferred(), entered = deferred();
    f.adapter.fetch = async (url, options) => ({ status, ok: status === 200,
      json() { entered.resolve(); return parsing.promise; } });
    const pending = f.run(); await entered.promise; f.session.account = 'owner-b';
    f.holder.error = 'replacement-session-feedback';
    if (reject) parsing.reject(new SyntaxError('truncated response'));
    else parsing.resolve(status === 200 ? f.actualReceipt(f.holder.body) : { error: 'chest_revision_conflict' });
    assert.equal(await pending, null); assert.equal(f.stats.applied.length, 0);
    assert.equal(f.holder.error, 'replacement-session-feedback');
  }
});

test('current-session 401 expires exactly once and never parses/applies a result', async () => {
  const f = fixture(); let parsed = false;
  f.adapter.fetch = async () => ({ status: 401, ok: false, async json() { parsed = true; return {}; } });
  assert.equal(await f.run(), null); assert.equal(f.stats.expired, 1); assert.equal(parsed, false);
  assert.equal(f.stats.applied.length, 0); assert.equal(f.stats.boundaries, 0);
});

test('boundary rejection and rejected apply do not report a receipt as success', async () => {
  const f = fixture(); f.adapter.boundary = async () => true;
  assert.equal(await f.run(), null); assert.equal(f.stats.applied.length, 0);
  const other = fixture(); let applies = 0; other.adapter.apply = () => { applies++; return false; };
  assert.equal(await other.run(), null); assert.equal(applies, 1);
});

test('malformed, truncated, extra or forged receipts never produce a visible grant', async () => {
  for (const mutate of [x => null, x => ({ ok: true }), x => ({ ...x, extra: true }),
    x => ({ ...x, prize: { type: 'gold', rarity: 'legendary', amount: 300 } }),
    x => ({ ...x, snapshots: { lootbox: x.snapshots.lootbox } }),
    x => ({ ...x, data: { ...x.data, settings: { cosmetics: ['fr_gold'] } } }),
    x => { const changed = clone(x); changed.data.lootbox.history = []; return changed; }]) {
    const f = fixture(); f.adapter.fetch = async (url, opts) => ({ status: 200, ok: true, async json() { return mutate(f.actualReceipt(opts.body)); } });
    assert.equal(await f.run(), null); assert.equal(f.holder.error, 'chest_invalid_receipt'); assert.equal(f.stats.applied.length, 0);
  }
  const f = fixture(); f.adapter.fetch = async () => ({ status: 200, ok: true, async json() { throw new SyntaxError('truncated'); } });
  assert.equal(await f.run(), null); assert.equal(f.holder.error, 'chest_save_unconfirmed'); assert.equal(f.stats.applied.length, 0);
});

test('explicit server denial keeps precise code; a later ambiguous failure clears it for retry', async () => {
  const f = fixture();
  f.adapter.fetch = async () => ({ status: 409, ok: false, async json() { return { error: 'chest_unavailable' }; } });
  assert.equal(await f.run(), null); assert.equal(f.holder.error, 'chest_unavailable');
  f.adapter.fetch = async () => { throw new TypeError('network failed'); };
  assert.equal(await f.run(), null); assert.equal(f.holder.error, 'chest_save_unconfirmed');
  assert.equal(f.stats.applied.length, 0);
});

test('real chest-specific 409 responses bypass a broad account-conflict boundary and retain the exact reason', async () => {
  for (const code of ['chest_unavailable', 'chest_receipt_state_changed', 'invalid_chest_request']) {
    const f = fixture();
    f.adapter.fetch = async () => new Response(JSON.stringify({ error: code }), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
    // Mirrors the integration risk: the shared account boundary claims every
    // 409. Chest admission/retry errors belong to the chest dialog first.
    f.adapter.boundary = async () => { f.stats.boundaries++; return true; };
    assert.equal(await f.run(), null);
    assert.equal(f.holder.error, code); assert.equal(f.stats.boundaries, 0);
    assert.equal(f.stats.applied.length, 0); assert.equal(f.stats.expired, 0);
    if (code !== 'invalid_chest_request') {
      assert.notEqual(Runtime.errorText(f.holder.error, 'en'), Runtime.errorText('chest_save_unconfirmed', 'en'));
    }
  }
});

test('account or epoch changed during cloned denial JSON cannot alter feedback or enter the generic boundary', async () => {
  for (const change of [f => { f.session.account = 'owner-b'; }, f => { f.session.epoch++; }]) {
    for (const rejected of [false, true]) {
      const f = fixture(), parsedClone = deferred(), entered = deferred(); let originalReads = 0;
      f.adapter.fetch = async () => ({ status: 409, ok: false,
        clone() { return { json() { entered.resolve('entered'); return parsedClone.promise; } }; },
        async json() { originalReads++; return { error: 'chest_unavailable' }; },
      });
      f.adapter.boundary = async () => { f.stats.boundaries++; return true; };
      const pending = f.run();
      assert.equal(await Promise.race([entered.promise, pending.then(() => 'finished-before-inspection')]), 'entered');
      change(f); f.holder.error = 'replacement-session-feedback';
      if (rejected) parsedClone.reject(new SyntaxError('late truncated denial'));
      else parsedClone.resolve({ error: 'chest_receipt_state_changed' });
      assert.equal(await pending, null); assert.equal(f.holder.error, 'replacement-session-feedback');
      assert.equal(originalReads, 0); assert.equal(f.stats.boundaries, 0);
      assert.equal(f.stats.applied.length, 0); assert.equal(f.stats.expired, 0);
    }
  }
});

test('feedback covers actual unavailable code, legacy alias, conflict and future date in five languages', () => {
  for (const lang of ['ru', 'en', 'de', 'uk', 'es']) {
    const unknown = Runtime.errorText('unknown', lang), unavailable = Runtime.errorText('chest_unavailable', lang);
    assert.notEqual(unavailable, unknown); assert.equal(unavailable, Runtime.errorText('chest_not_available', lang));
    assert.notEqual(Runtime.errorText('chest_future_day', lang), unknown);
    const conflict = Runtime.errorText('chest_revision_conflict', lang);
    assert.notEqual(conflict, unknown); assert.equal(conflict, Runtime.errorText('chest_request_conflict', lang));
    assert.equal(conflict, Runtime.errorText('chest_receipt_state_changed', lang));
  }
  assert.equal(Runtime.errorText('unknown', 'unsupported'), Runtime.errorText('unknown', 'en'));
});
