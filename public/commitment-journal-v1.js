/* Satoru Commitment Journal v1.
 *
 * Pure write-ahead-log contract for an allowlisted account-graph transaction.
 * This module does not touch fs, State, DOM, or the network. It creates and
 * validates durable journal values and returns deterministic recovery plans;
 * server.js owns fsync/rename/write execution.
 *
 * Protocol:
 *   1. persist + fsync `prepare(base, data)` before any account-file write;
 *   2. write every declared account file;
 *   3. persist + fsync `markCommitted(journal)`;
 *   4. remove the journal.
 * Recovery rolls a prepared transaction back to `before`. A committed journal
 * rolls forward to `after`. The journal is removed only after every planned
 * action succeeds, so replay remains idempotent across repeated crashes.
 */
(function exposeCommitmentJournal(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CommitmentJournalV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCommitmentJournal() {
  'use strict';

  const VERSION = 1;
  const SCHEMA = 'satoru.commitment-journal/1';
  const PHASE_PREPARED = 'prepared';
  const PHASE_COMMITTED = 'committed';
  // settings + tasks are the indivisible commitment pair. Goals, initiatives
  // and the skill tree may join the same transaction for proposal import, but
  // arbitrary account files can never be smuggled into recovery by a journal.
  const REQUIRED_FILES = Object.freeze(['settings', 'tasks']);
  const OPTIONAL_FILES = Object.freeze(['goals', 'goal-groups', 'skilltree']);
  const FILES = Object.freeze([...REQUIRED_FILES, ...OPTIONAL_FILES]);
  const MAX_SERIALIZED_BYTES = 16 * 1024 * 1024;
  const MAX_DEPTH = 80;
  const MAX_NODES = 250000;
  const JOURNAL_KEYS = new Set(['schema', 'version', 'txId', 'phase', 'createdAt', 'committedAt', 'files', 'checksum']);
  const FILE_KEYS = new Set(['before', 'after']);
  const SNAPSHOT_KEYS = new Set(['exists', 'value']);
  const TX_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

  function isRecord(value) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function exactKeys(value, allowed, required) {
    if (!isRecord(value)) return false;
    const keys = Object.keys(value);
    return keys.every((key) => allowed.has(key))
      && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
  }

  function isTimestamp(value) {
    if (typeof value !== 'string' || value.length < 20 || value.length > 35) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  }

  function jsonValueValid(root) {
    let nodes = 0;
    const seen = new Set();
    const visit = (value, depth) => {
      nodes += 1;
      if (nodes > MAX_NODES || depth > MAX_DEPTH) return false;
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
      if (typeof value === 'number') return Number.isFinite(value);
      if (typeof value !== 'object' || seen.has(value)) return false;
      seen.add(value);
      let ok;
      if (Array.isArray(value)) ok = value.every((item) => visit(item, depth + 1));
      else if (isRecord(value)) ok = Object.keys(value).every((key) => key.length <= 1000 && visit(value[key], depth + 1));
      else ok = false;
      seen.delete(value);
      return ok;
    };
    return visit(root, 0);
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map((key) => (
      JSON.stringify(key) + ':' + stableStringify(value[key])
    )).join(',') + '}';
  }

  // Corruption checksum, not an authentication primitive. The journal lives in
  // the same owner-only data directory as the files it protects.
  function checksumOf(value) {
    const input = stableStringify(value);
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i);
      a ^= code; a = Math.imul(a, 0x01000193) >>> 0;
      b ^= code + i; b = Math.imul(b, 0x85ebca6b) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  function utf8ByteLength(value) {
    let bytes = 0;
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length
        && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) {
        bytes += 4; i += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function fileType(name) {
    return ['tasks', 'goals', 'goal-groups'].includes(name) ? 'array' : 'object';
  }

  function snapshotValid(snapshot, name) {
    if (!exactKeys(snapshot, SNAPSHOT_KEYS, ['exists', 'value']) || typeof snapshot.exists !== 'boolean') return false;
    if (!snapshot.exists) return snapshot.value === null;
    return fileType(name) === 'object' ? isRecord(snapshot.value) && jsonValueValid(snapshot.value)
      : Array.isArray(snapshot.value) && jsonValueValid(snapshot.value);
  }

  function afterValid(value, name) {
    return fileType(name) === 'object' ? isRecord(value) && jsonValueValid(value)
      : Array.isArray(value) && jsonValueValid(value);
  }

  function declaredFiles(value) {
    if (!isRecord(value)) return null;
    const names = Object.keys(value);
    if (!REQUIRED_FILES.every((name) => names.includes(name))
      || names.some((name) => !FILES.includes(name))) return null;
    return FILES.filter((name) => names.includes(name));
  }

  function bodyWithoutChecksum(journal) {
    const out = {
      schema: journal.schema,
      version: journal.version,
      txId: journal.txId,
      phase: journal.phase,
      createdAt: journal.createdAt,
      files: journal.files,
    };
    if (journal.committedAt !== undefined) out.committedAt = journal.committedAt;
    return out;
  }

  function journalValid(journal) {
    if (!exactKeys(journal, JOURNAL_KEYS,
      ['schema', 'version', 'txId', 'phase', 'createdAt', 'files', 'checksum'])) return false;
    if (journal.schema !== SCHEMA || journal.version !== VERSION || !TX_ID.test(journal.txId)) return false;
    if (!isTimestamp(journal.createdAt) || ![PHASE_PREPARED, PHASE_COMMITTED].includes(journal.phase)) return false;
    if (journal.phase === PHASE_PREPARED && journal.committedAt !== undefined) return false;
    if (journal.phase === PHASE_COMMITTED && (!isTimestamp(journal.committedAt)
      || Date.parse(journal.committedAt) < Date.parse(journal.createdAt))) return false;
    const names = declaredFiles(journal.files);
    if (!names || !exactKeys(journal.files, new Set(names), names)) return false;
    for (const name of names) {
      const row = journal.files[name];
      if (!exactKeys(row, FILE_KEYS, ['before', 'after'])
        || !snapshotValid(row.before, name) || !afterValid(row.after, name)) return false;
    }
    if (typeof journal.checksum !== 'string' || !/^[0-9a-f]{16}$/.test(journal.checksum)) return false;
    let serialized;
    try { serialized = stableStringify(journal); } catch { return false; }
    if (utf8ByteLength(serialized) > MAX_SERIALIZED_BYTES) return false;
    return checksumOf(bodyWithoutChecksum(journal)) === journal.checksum;
  }

  function prepare(input) {
    if (!isRecord(input) || !exactKeys(input, new Set(['txId', 'createdAt', 'base', 'data']),
      ['txId', 'createdAt', 'base', 'data'])) return { ok: false, error: 'invalid_prepare' };
    if (!TX_ID.test(input.txId) || !isTimestamp(input.createdAt)) return { ok: false, error: 'invalid_prepare' };
    const baseNames = declaredFiles(input.base), dataNames = declaredFiles(input.data);
    if (!baseNames || !dataNames || baseNames.join(',') !== dataNames.join(',')
      || !exactKeys(input.base, new Set(baseNames), baseNames)
      || !exactKeys(input.data, new Set(dataNames), dataNames)) return { ok: false, error: 'invalid_prepare' };
    for (const name of dataNames) {
      if (!snapshotValid(input.base[name], name) || !afterValid(input.data[name], name)) {
        return { ok: false, error: 'invalid_prepare' };
      }
    }
    const journal = {
      schema: SCHEMA,
      version: VERSION,
      txId: input.txId,
      phase: PHASE_PREPARED,
      createdAt: input.createdAt,
      files: Object.fromEntries(dataNames.map((name) => [name, {
        before: clone(input.base[name]), after: clone(input.data[name]),
      }])),
    };
    journal.checksum = checksumOf(bodyWithoutChecksum(journal));
    if (!journalValid(journal)) return { ok: false, error: 'invalid_prepare' };
    return { ok: true, journal };
  }

  function markCommitted(raw, committedAt) {
    if (!journalValid(raw)) return { ok: false, error: 'invalid_journal' };
    if (raw.phase === PHASE_COMMITTED) return { ok: true, journal: clone(raw), changed: false };
    if (!isTimestamp(committedAt) || Date.parse(committedAt) < Date.parse(raw.createdAt)) {
      return { ok: false, error: 'invalid_commit_time' };
    }
    const journal = clone(raw);
    journal.phase = PHASE_COMMITTED;
    journal.committedAt = committedAt;
    journal.checksum = checksumOf(bodyWithoutChecksum(journal));
    return journalValid(journal) ? { ok: true, journal, changed: true }
      : { ok: false, error: 'invalid_journal' };
  }

  function recoveryPlan(raw) {
    if (!journalValid(raw)) return { ok: false, error: 'invalid_journal', actions: [] };
    const rollback = raw.phase === PHASE_PREPARED;
    const declared = FILES.filter((name) => Object.prototype.hasOwnProperty.call(raw.files, name));
    const names = rollback ? [...declared].reverse() : declared;
    const actions = names.map((name) => {
      if (!rollback) return Object.freeze({ op: 'write', name, value: clone(raw.files[name].after) });
      const snapshot = raw.files[name].before;
      return snapshot.exists
        ? Object.freeze({ op: 'write', name, value: clone(snapshot.value) })
        : Object.freeze({ op: 'remove', name });
    });
    return Object.freeze({
      ok: true,
      txId: raw.txId,
      mode: rollback ? 'rollback' : 'rollforward',
      actions: Object.freeze(actions),
      removeJournalAfterSuccess: true,
    });
  }

  return Object.freeze({
    VERSION,
    SCHEMA,
    PHASE_PREPARED,
    PHASE_COMMITTED,
    FILES,
    prepare,
    markCommitted,
    validate: journalValid,
    recoveryPlan,
  });
});
