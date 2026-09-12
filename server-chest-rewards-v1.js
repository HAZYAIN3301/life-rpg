'use strict';
// Synchronous account service. The caller owns authentication and the existing
// shared WAL. A private cursor protects issued tickets across portable imports.
const Policy = require('./public/chest-reward-policy-v1');
const Claim = require('./public/chest-claim-v1');
const LEDGER_FILE = 'chest-receipts';
const MAX_RECEIPTS = 128;
const clone = x => JSON.parse(JSON.stringify(x));
const fail = (code, status = 409) => { const error = new Error(code); error.status = status; throw error; };
const hashValid = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
function ledgerValid(value) {
  if (!value || value.version !== 1 || Object.keys(value).sort().join(',') !== 'cursor,receipts,version'
    || !Claim.cursorValid(value.cursor) || !Array.isArray(value.receipts) || value.receipts.length > MAX_RECEIPTS) return false;
  if (value.receipts.length && (!value.cursor || value.cursor.day !== value.receipts[value.receipts.length - 1]?.day)) return false;
  const ids = new Set();
  return value.receipts.every(row => {
    if (!row || Object.keys(row).sort().join(',') !== 'afterHash,at,cursor,day,prize,remaining,requestHash,requestId,settingsChanged,timeZone'
      || !Claim.requestIdValid(row.requestId) || ids.has(row.requestId) || !hashValid(row.requestHash) || !hashValid(row.afterHash)
      || !Claim.timestampValid(row.at) || !Claim.cursorValid(row.cursor) || !Policy.prizeValid(row.prize)
      || typeof row.settingsChanged !== 'boolean' || typeof row.timeZone !== 'string' || !row.timeZone || row.timeZone.length > 100
      || !Number.isSafeInteger(row.remaining) || row.remaining < 0 || row.remaining > 7
      || !Claim.cursorValid({ day: row.day, opened: 1, carry: 0 })) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: row.timeZone }); } catch { return false; }
    ids.add(row.requestId); return true;
  });
}
function issue({ payload, actual, hash, entropy, now, commit }) {
  if (!Claim.requestValid(payload)) fail('invalid_chest_request', 400);
  const snapshots = Object.fromEntries(Claim.FILES.map(n => [n, actual[n]]));
  if (!Claim.snapshotsValid(snapshots)) fail('chest_state_not_supported', 422);
  const saved = actual[LEDGER_FILE];
  const ledger = saved.exists ? saved.value : { version: 1, cursor: null, receipts: [] };
  if (!ledgerValid(ledger)) fail('chest_receipts_corrupt', 503);
  const requestHash = hash(payload), prior = ledger.receipts.find(row => row.requestId === payload.requestId);
  const buildReceipt = (row, data, state, replayed) => ({ ok: true, version: 1, requestId: row.requestId,
    timeZone: row.timeZone, prize: row.prize, at: row.at, day: row.day, remaining: row.remaining,
    cursor: row.cursor, data, snapshots: state, replayed });
  if (prior) {
    if (prior.requestHash !== requestHash) fail('chest_request_conflict');
    if (prior.afterHash !== hash(snapshots)) fail('chest_receipt_state_changed');
    return buildReceipt(prior, Object.fromEntries(['lootbox', ...(prior.settingsChanged ? ['settings'] : [])]
      .map(n => [n, snapshots[n].value])), snapshots, true);
  }
  if (!Claim.equal(payload.base, snapshots)) fail('chest_revision_conflict');
  const result = Policy.grant(Claim.context(snapshots, ledger.cursor), {
    now, timeZone: payload.timeZone, requestId: payload.requestId, entropy: entropy(),
  });
  if (!result.ok) fail(result.error || result.reason || 'chest_not_available');
  const after = clone(snapshots);
  for (const n of ['settings', 'tasks']) if (!after[n].exists)
    after[n] = { exists: true, value: n === 'tasks' ? [] : {} };
  for (const [name, value] of Object.entries(result.data)) after[name] = { exists: true, value };
  const row = { requestId: payload.requestId, requestHash, afterHash: hash(after),
    at: result.historyEntry.at, prize: result.prize, day: result.day, remaining: result.remaining,
    cursor: clone(ledger.cursor), timeZone: payload.timeZone, settingsChanged: Object.hasOwn(result.data, 'settings') };
  const nextLedger = { version: 1,
    cursor: { day: result.data.lootbox.day, opened: result.data.lootbox.opened, carry: result.data.lootbox.carry },
    receipts: [...ledger.receipts, row].slice(-MAX_RECEIPTS) };
  if (!ledgerValid(nextLedger)) fail('chest_receipt_invalid', 500);
  const receipt = buildReceipt(row, result.data, after, false);
  if (!Claim.receiptValid(receipt, payload)) fail('chest_receipt_invalid', 500);
  commit({ ...result.data, [LEDGER_FILE]: nextLedger });
  return receipt;
}
module.exports = Object.freeze({ LEDGER_FILE, MAX_RECEIPTS, ledgerValid, issue });
