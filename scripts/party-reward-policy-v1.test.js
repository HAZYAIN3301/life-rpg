'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../public/party-reward-policy-v1.js');
const S = require('../server-party-rewards-v1.js');
const input = { cycle: '2026-09-07', partyId: 'party-a', at: '2026-09-09T18:00:00.000Z', won: true };
test('reward: one weekly receipt, immutable retry across parties and a new cycle', () => {
  const first = P.grant(P.empty(), input);
  assert.equal(P.gold(first.ledger), 150);
  const retry = P.grant(first.ledger, { ...input, partyId: 'party-b', won: false, at: '2026-09-10T10:00:00Z' });
  assert.equal(retry.replay, true); assert.deepEqual(retry.receipt, first.receipt);
  const next = P.grant(retry.ledger, { ...input, cycle: '2026-09-14' });
  assert.equal(P.gold(next.ledger), 300); assert.equal(next.ledger.receipts.length, 2);
  assert.equal(P.isSuccessor(next.ledger, first.ledger), true);
  assert.equal(P.isSuccessor(first.ledger, next.ledger), false, 'a slow GET must not replace newer confirmed credits');
  assert.equal(P.isSuccessor(first.ledger, first.ledger), true);
  assert.throws(() => P.grant(P.empty(), { ...input, won: false }), /not_won/);
});
test('boost: starts at durable grant, expires exactly at six hours, never stacks or retroactively applies', () => {
  const { ledger } = P.grant(P.empty(), input);
  for (const [at, pct] of [['2026-09-09T17:59:59Z', 0], [input.at, 30], ['2026-09-09T23:59:59Z', 30], ['2026-09-10T00:00:00Z', 0], [null, 0], ['invalid', 0]]) assert.equal(P.boostPct(ledger, at), pct);
  const overlap = P.grant(ledger, { ...input, cycle: '2026-09-14' }).ledger;
  assert.equal(P.boostPct(overlap, input.at), 30);
});
test('legacy marker blocks new payout without inventing a previous gold payment or boost', () => {
  const first = P.grant(P.empty(), { ...input, legacy: true });
  assert.equal(P.gold(first.ledger), 0); assert.equal(P.boostPct(first.ledger, input.at), 0);
  assert.equal(P.grant(first.ledger, input).receipt.kind, 'legacy');
});
test('malformed ledger and impossible receipts fail closed', () => {
  const receipt = P.grant(P.empty(), input).receipt;
  for (const bad of [null, {}, [], { version: 1, receipts: [receipt, receipt] }, { version: 1, receipts: [{ ...receipt, gold: 300 }] }, { version: 1, receipts: [{ ...receipt, boost: { ...receipt.boost, until: '2040-01-01' } }] }]) assert.throws(() => P.validate(bad), /reward_ledger_invalid/);
  for (const cycle of ['2026-02-30', '2026-09-08', '', '__proto__']) assert.equal(P.cycleValid(cycle), false);
});
test('service: failure before write, ambiguous committed write, restart and duplicate requests', () => {
  const disk = new Map(); let mode = 'before', writes = 0;
  const deps = { read: (uid) => disk.has(uid) ? structuredClone(disk.get(uid)) : null, now: () => input.at,
    write: (uid, value) => { if (mode === 'before') throw new Error('EIO'); disk.set(uid, structuredClone(value)); writes++; if (mode === 'after') throw new Error('fsync ambiguous'); } };
  let service = S.createService(deps);
  assert.throws(() => service.claim('a', input), /EIO/); assert.equal(disk.size, 0);
  mode = 'after'; assert.throws(() => service.claim('a', input), /ambiguous/); assert.equal(writes, 1);
  service = S.createService(deps); const retry = service.claim('a', input);
  assert.equal(retry.replay, true); assert.equal(writes, 1); assert.equal(P.gold(retry.ledger), 150);
  mode = 'ok'; service.claim('a', input); service.claim('b', input); assert.equal(writes, 2);
  service.migrateLegacy([{ id: 'old', raid: { ws: input.cycle, claimed: ['a', 'c', 'deleted'] } }], (uid) => uid !== 'deleted');
  assert.equal(service.snapshot('a').receipts[0].kind, 'grant'); assert.equal(service.snapshot('c').receipts[0].kind, 'legacy'); assert.equal(disk.has('deleted'), false);
});
