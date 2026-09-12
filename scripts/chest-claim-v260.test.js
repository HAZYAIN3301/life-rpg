'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Claim = require('../public/chest-claim-v1');
const Policy = require('../public/chest-reward-policy-v1');
const Issuer = require('../server-chest-rewards-v1');
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(Claim.canonical(value)).digest('hex');
const now = '2026-09-12T12:00:00.000Z', day = '2026-09-12';
const owner = (extra = {}) => ({ settings: { locale: 'ru' }, tasks: Array.from({ length: 5 }, (_, i) => ({ id: 'task-' + i, done: true, date: day })), habitlog: {}, skilltree: {}, ...extra });
function memory(initial = owner()) {
  const actual = Object.fromEntries([...Claim.FILES, Issuer.LEDGER_FILE].map(name => [name,
    Object.hasOwn(initial, name) ? { exists: true, value: clone(initial[name]) } : { exists: false, value: null }]));
  let entropyCalls = 0, commitCalls = 0, operation = 0;
  const requests = () => Object.fromEntries(Claim.FILES.map(name => [name, clone(actual[name])]));
  const request = (extra = {}) => ({ version: 1, requestId: 'chest_request_' + String(++operation).padStart(6, '0'), timeZone: 'Europe/Berlin', base: requests(), ...extra });
  const run = (payload, options = {}) => Issuer.issue({ payload, actual, now: options.now || now, hash,
    entropy() { entropyCalls++; return options.entropy || [0, 0, 0]; },
    commit(data) {
      commitCalls++;
      if (options.failBeforeWrite) throw new Error('injected_write_failure');
      // Mirror only the storage contract: the common WAL writes this atomic
      // set and materializes its required pair. Filesystem crash proof is in
      // the root's separate HTTP/SIGKILL suite, not this in-memory fixture.
      for (const name of ['settings', 'tasks']) if (!actual[name].exists)
        actual[name] = { exists: true, value: name === 'tasks' ? [] : {} };
      for (const [name, value] of Object.entries(data)) actual[name] = { exists: true, value: clone(value) };
      if (options.failAfterWrite) throw new Error('injected_lost_response');
    },
  });
  return { actual, request, run, snapshots: requests, stats: () => ({ entropyCalls, commitCalls }) };
}
function error(fn, message, status) {
  assert.throws(fn, caught => caught.message === message && (status === undefined || caught.status === status));
}

test('issuer returns exact gold receipt only after committing prize and private cursor together', () => {
  const db = memory(), request = db.request(), receipt = db.run(request);
  assert.equal(Claim.receiptValid(receipt, request), true);
  assert.deepEqual(receipt.prize, { type: 'gold', rarity: 'common', amount: 40 });
  assert.equal(receipt.at, now); assert.equal(receipt.day, day); assert.equal(receipt.remaining, 2);
  assert.equal(receipt.cursor, null); assert.equal(receipt.replayed, false);
  assert.deepEqual(receipt.snapshots, db.snapshots());
  assert.deepEqual(db.actual[Issuer.LEDGER_FILE].value.cursor, { day, opened: 1, carry: 0 });
  assert.equal(db.actual.lootbox.value.history[0].requestId, request.requestId);
  assert.equal(db.actual[Issuer.LEDGER_FILE].value.receipts[0].afterHash, hash(receipt.snapshots));
  assert.deepEqual(db.stats(), { entropyCalls: 1, commitCalls: 1 });
});

test('all actual reward kinds produce strict receipts and exact changes to affected snapshots', () => {
  for (const [entropy, type] of [[[0, 0, 0], 'gold'], [[.7, .7, 0], 'cosmetic_capsule'], [[.99, .99, 0], 'reward_voucher']]) {
    const db = memory(), request = db.request(), receipt = db.run(request, { entropy });
    assert.equal(receipt.prize.type, type); assert.equal(Claim.receiptValid(receipt, request), true);
    assert.deepEqual(Object.keys(receipt.data).sort(), type === 'cosmetic_capsule' ? ['lootbox', 'settings'] : ['lootbox']);
    for (const name of ['tasks', 'habitlog', 'skilltree']) assert.deepEqual(receipt.snapshots[name], request.base[name]);
    assert.equal(Issuer.ledgerValid(db.actual[Issuer.LEDGER_FILE].value), true);
  }
});

test('missing settings/tasks pair is materialized consistently with the common WAL receipt', () => {
  const db = memory({ habitlog: { [day]: { one: { xp: 1 } } } }), request = db.request(), receipt = db.run(request);
  assert.equal(Claim.receiptValid(receipt, request), true);
  assert.deepEqual(receipt.snapshots.settings, { exists: true, value: {} });
  assert.deepEqual(receipt.snapshots.tasks, { exists: true, value: [] });
  assert.deepEqual(receipt.snapshots.skilltree, { exists: false, value: null });
  assert.deepEqual(receipt.snapshots, db.snapshots());
});

test('caller cannot nominate a prize, entropy, next data, actor or altered protocol field', () => {
  for (const extra of [{ prize: { type: 'gold', rarity: 'legendary', amount: 999999 } },
    { entropy: [0, 0, 0] }, { data: { lootbox: { goldWon: 999999 } } }, { uid: 'other-account' }, { version: 2 }]) {
    const db = memory(), request = db.request(extra), before = clone(db.actual);
    error(() => db.run(request), 'invalid_chest_request', 400);
    assert.deepEqual(db.actual, before); assert.deepEqual(db.stats(), { entropyCalls: 0, commitCalls: 0 });
  }
});

test('invalid request IDs, zones and base shapes are refused before entropy/commit', () => {
  for (const extra of [{ requestId: 'short' }, { requestId: '../wrong_request' }, { requestId: 'x'.repeat(129) },
    { timeZone: 'Mars/Olympus' }, { timeZone: {} }, { base: {} }]) {
    const db = memory(); error(() => db.run(db.request(extra)), 'invalid_chest_request', 400);
    assert.equal(db.stats().entropyCalls, 0);
  }
  const db = memory(), req = db.request(); req.base.settings.extra = true;
  error(() => db.run(req), 'invalid_chest_request', 400);
});

test('stale snapshot in any of five owner files fails before draw', () => {
  for (const name of Claim.FILES) {
    const db = memory(), request = db.request(), before = clone(db.actual);
    request.base[name] = { exists: true, value: name === 'tasks' ? [] : { stale: true } };
    error(() => db.run(request), 'chest_revision_conflict', 409);
    assert.deepEqual(db.actual, before); assert.deepEqual(db.stats(), { entropyCalls: 0, commitCalls: 0 });
  }
});

test('canonical ordering permits equivalent request and snapshots without false conflict', () => {
  const db = memory(), request = db.request();
  const reordered = { base: Object.fromEntries(Object.entries(request.base).reverse().map(([name, value]) => [name, { value: value.value, exists: value.exists }])),
    timeZone: request.timeZone, requestId: request.requestId, version: 1 };
  const first = db.run(reordered), retry = db.run(request);
  assert.deepEqual(retry, { ...first, replayed: true });
  assert.deepEqual(db.stats(), { entropyCalls: 1, commitCalls: 1 });
});

test('lost response after durable write replays the original exact prize without drawing again', () => {
  const db = memory(), request = db.request();
  error(() => db.run(request, { entropy: [.99, .7, .5], failAfterWrite: true }), 'injected_lost_response');
  const saved = clone(db.actual), receipt = db.run(request, { entropy: [0, 0, 0] });
  assert.equal(receipt.replayed, true); assert.equal(Claim.receiptValid(receipt, request), true);
  assert.equal(receipt.prize.type, 'cosmetic_capsule'); assert.equal(receipt.prize.rarity, 'legendary');
  assert.deepEqual(db.actual, saved); assert.deepEqual(db.stats(), { entropyCalls: 1, commitCalls: 1 });
});

test('failed write returns no receipt and leaves no grant or private receipt', () => {
  const db = memory(), request = db.request(), before = clone(db.actual);
  error(() => db.run(request, { failBeforeWrite: true }), 'injected_write_failure');
  assert.deepEqual(db.actual, before);
  const retry = db.run(request); assert.equal(Claim.receiptValid(retry, request), true);
  assert.equal(retry.data.lootbox.opened, 1); assert.equal(db.actual[Issuer.LEDGER_FILE].value.receipts.length, 1);
});

test('same request ID with changed payload conflicts even if new base is current', () => {
  const db = memory(), request = db.request(); db.run(request);
  const altered = db.request({ requestId: request.requestId });
  error(() => db.run(altered), 'chest_request_conflict', 409);
  assert.deepEqual(db.stats(), { entropyCalls: 1, commitCalls: 1 });
});

test('retry after any later owner revision is conflict, never rollback or a new grant', () => {
  for (const name of Claim.FILES) {
    const db = memory(), request = db.request(); db.run(request);
    if (name === 'tasks') db.actual.tasks.value.push({ id: 'new', date: day, done: false });
    else db.actual[name] = { exists: true, value: { ...(db.actual[name].value || {}), laterOwnerChange: true } };
    const before = clone(db.actual);
    error(() => db.run(request), 'chest_receipt_state_changed', 409);
    assert.deepEqual(db.actual, before); assert.deepEqual(db.stats(), { entropyCalls: 1, commitCalls: 1 });
  }
});

test('new independent request consumes next ticket; consumed daily tickets cannot be drawn again', () => {
  const db = memory();
  for (const expected of [2, 1, 0]) {
    const request = db.request(), receipt = db.run(request);
    assert.equal(receipt.remaining, expected); assert.equal(Claim.receiptValid(receipt, request), true);
  }
  error(() => db.run(db.request()), 'chest_unavailable', 409);
  assert.equal(db.actual.lootbox.value.opened, 3); assert.equal(db.actual.lootbox.value.goldWon, 120);
  assert.equal(db.actual[Issuer.LEDGER_FILE].value.receipts.length, 3);
});

test('private cursor prevents imported older opening counters from recreating daily tickets', () => {
  const db = memory(), oldLootbox = { day, carry: 0, opened: 0, goldWon: 15, history: [] };
  for (let i = 0; i < 3; i++) db.run(db.request());
  db.actual.lootbox = { exists: true, value: clone(oldLootbox) };
  const imported = clone(db.actual);
  error(() => db.run(db.request()), 'chest_unavailable', 409);
  assert.deepEqual(db.actual, imported, 'imported personal gold remains untouched by a rejected claim');
  assert.equal(db.actual.lootbox.value.goldWon, 15);
});

test('private cursor also protects after lootbox removal, inflated carry and backward timezone', () => {
  const db = memory(); for (let i = 0; i < 3; i++) db.run(db.request());
  db.actual.lootbox = { exists: false, value: null };
  error(() => db.run(db.request()), 'chest_unavailable', 409);
  db.actual.lootbox = { exists: true, value: { day, carry: 5, opened: 0, goldWon: 300 } };
  error(() => db.run(db.request()), 'chest_unavailable', 409);
  error(() => db.run(db.request({ timeZone: 'Pacific/Honolulu' }), { now: '2026-09-12T00:30:00.000Z' }), 'chest_future_day', 409);
});

test('cursor rolls forward from actually earned prior-day tickets while preserving imported gold', () => {
  const db = memory(); db.run(db.request());
  db.actual.lootbox = { exists: true, value: { day: '2026-01-01', carry: 5, opened: 0, goldWon: 700, history: [] } };
  const request = db.request(), receipt = db.run(request, { now: '2026-09-13T12:00:00.000Z' });
  assert.equal(Claim.receiptValid(receipt, request), true);
  assert.equal(receipt.data.lootbox.carry, 2); assert.equal(receipt.data.lootbox.opened, 1);
  assert.equal(receipt.data.lootbox.goldWon, 740); assert.equal(receipt.remaining, 1);
});

test('receipt shape and grant verification reject injected snapshots, cosmetics and altered fields', () => {
  const db = memory(), request = db.request(), receipt = db.run(request);
  for (const change of [
    x => { x.ok = false; }, x => { x.version = 2; }, x => { x.requestId = 'other_request_000001'; },
    x => { x.timeZone = 'UTC'; }, x => { x.at = '2026-09-12T12:00:00Z'; },
    x => { x.day = '2026-09-13'; }, x => { x.remaining++; }, x => { x.replayed = 1; },
    x => { x.prize.amount = 52; }, x => { x.prize.label = 'forged'; },
    x => { x.data.settings = { cosmetics: ['fr_gold'] }; }, x => { x.data.lootbox.goldWon++; },
    x => { x.snapshots.settings.value.cosmetics = ['fr_gold']; }, x => { delete x.snapshots.habitlog; },
    x => { x.snapshots.rewards = { exists: true, value: [] }; }, x => { x.snapshots.tasks.value.push({ done: true, date: day }); },
    x => { x.data.lootbox.history[0].requestId = 'different_history_001'; }, x => { x.extra = true; },
  ]) { const tampered = clone(receipt); change(tampered); assert.equal(Claim.receiptValid(tampered, request), false); }
});

test('corrupted receipt ledger, bounds, hashes, duplicate request IDs or cursor fail closed', () => {
  const seeded = memory(); seeded.run(seeded.request());
  const valid = clone(seeded.actual[Issuer.LEDGER_FILE].value);
  for (const change of [
    x => { x.version = 2; }, x => { x.extra = true; }, x => { x.cursor.day = '2026-02-30'; },
    x => { x.cursor = null; }, x => { x.cursor.day = '2026-09-13'; },
    x => { x.cursor.opened = 9; }, x => { x.cursor.carry = 6; }, x => { x.cursor.opened = -1; },
    x => { x.receipts[0].afterHash = 'not-a-hash'; }, x => { x.receipts[0].requestHash = 'f'.repeat(63); },
    x => { x.receipts[0].prize.amount = 5000; }, x => { x.receipts[0].remaining = 8; },
    x => { x.receipts[0].at = 'invalid'; }, x => { x.receipts[0].timeZone = ''; },
    x => { x.receipts[0].timeZone = 'Mars/Olympus'; }, x => { x.receipts.push(clone(x.receipts[0])); },
    x => { x.receipts = new Array(Issuer.MAX_RECEIPTS + 1).fill(clone(x.receipts[0])); },
  ]) {
    const db = memory(), corrupt = clone(valid); change(corrupt);
    assert.equal(Issuer.ledgerValid(corrupt), false);
    db.actual[Issuer.LEDGER_FILE] = { exists: true, value: corrupt };
    error(() => db.run(db.request()), 'chest_receipts_corrupt', 503);
    assert.deepEqual(db.stats(), { entropyCalls: 0, commitCalls: 0 });
  }
});

test('receipt ledger pruning stays bounded while cursor survives and old daily grants stay spent', () => {
  const db = memory(); const start = Date.parse(now);
  let last;
  for (let index = 0; index < Issuer.MAX_RECEIPTS + 3; index++) {
    const instant = new Date(start + index * 86400000).toISOString(), civil = instant.slice(0, 10);
    db.actual.tasks = { exists: true, value: [{ id: 'day-' + index, done: true, date: civil }] };
    last = db.run(db.request(), { now: instant });
  }
  const ledger = db.actual[Issuer.LEDGER_FILE].value;
  assert.equal(ledger.receipts.length, Issuer.MAX_RECEIPTS); assert.equal(Issuer.ledgerValid(ledger), true);
  assert.equal(ledger.cursor.day, last.day); assert.equal(ledger.cursor.opened, 1);
  assert.equal(db.actual.lootbox.value.history.length, Policy.HISTORY_LIMIT);
  const originalGold = db.actual.lootbox.value.goldWon;
  db.actual.lootbox.value.opened = 0;
  error(() => db.run(db.request(), { now: last.at }), 'chest_unavailable', 409);
  assert.equal(db.actual.lootbox.value.goldWon, originalGold);
});
