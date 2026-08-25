'use strict';

/* Board v2 structured community evidence.
 *
 * This is deliberately not a social feed. A signed-in account may submit one
 * structured status for a local subject only after completing the exact Board
 * snapshot. Aggregates expose no identity, text, media, likes or ranking and
 * stay hidden until three distinct accounts contributed.
 */

const crypto = require('node:crypto');

const VERSION = '1.0.0';
const ACCOUNT_SCHEMA = 'satoru.board-community-account/1';
const AGGREGATE_SCHEMA = 'satoru.board-community-aggregate/1';
const SIGNALS = Object.freeze(['matched', 'changed', 'closed']);
const MIN_PUBLIC_REPORTS = 3;
const MAX_ACCOUNT_MARKS = 100;
const MAX_ACCOUNT_SUBJECTS = 5000;
const MAX_SUBJECTS = 5000;
const DAILY_MARK_LIMIT = 10;
const ALLOWED_INPUT = Object.freeze(['snapshotId', 'signal']);

function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value, max) {
  const out = typeof value === 'string' ? value.trim() : '';
  return out && out.length <= max ? out : '';
}
function day(value) {
  const out = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(out) && Number.isFinite(Date.parse(`${out}T00:00:00Z`)) ? out : '';
}
function instant(value) {
  const out = text(value, 40);
  return out && Number.isFinite(Date.parse(out)) ? new Date(out).toISOString() : '';
}
function canonicalActionUrl(value) {
  const source = text(value, 500);
  if (!source) return '';
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) return '';
    url.hostname = url.hostname.toLowerCase();
    url.port = url.port === '443' ? '' : url.port;
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return ''; }
}
function subjectFor(snapshot) {
  if (!plain(snapshot) || snapshot.schema !== 'satoru.board-offer-snapshot/2') return null;
  const templateId = text(snapshot.templateId, 80);
  const actionUrl = canonicalActionUrl(snapshot.primaryAction && snapshot.primaryAction.url);
  if (!templateId || !actionUrl || !Array.isArray(snapshot.tags) || !snapshot.tags.includes('local')) return null;
  const key = crypto.createHash('sha256').update(`${templateId}\n${actionUrl}`).digest('hex').slice(0, 32);
  return { key, templateId };
}
function normalizeLedger(value, currentDay) {
  const source = plain(value) && value.day === currentDay ? value : {};
  const marks = Number(source.marks);
  return { day: currentDay, marks: Number.isSafeInteger(marks) && marks >= 0 ? marks : 0 };
}
function normalizeAccount(value, now) {
  const source = plain(value) && value.schema === ACCOUNT_SCHEMA ? value : {};
  const marks = [], subjects = new Set();
  for (const key of Array.isArray(source.subjectKeys) ? source.subjectKeys : []) {
    const clean = text(key, 32); if (/^[a-f0-9]{32}$/.test(clean)) subjects.add(clean);
  }
  for (const item of Array.isArray(source.marks) ? source.marks : []) {
    if (!plain(item)) continue;
    const subjectKey = text(item.subjectKey, 32), snapshotId = text(item.snapshotId, 120);
    const templateId = text(item.templateId, 80), signal = text(item.signal, 16), at = instant(item.at);
    if (!/^[a-f0-9]{32}$/.test(subjectKey) || !snapshotId || !templateId || !SIGNALS.includes(signal) || !at) continue;
    subjects.add(subjectKey); marks.push({ subjectKey, snapshotId, templateId, signal, at });
  }
  return {
    schema: ACCOUNT_SCHEMA,
    marks: marks.slice(-MAX_ACCOUNT_MARKS),
    subjectKeys: [...subjects].slice(-MAX_ACCOUNT_SUBJECTS),
    ledger: normalizeLedger(source.ledger, now.slice(0, 10)),
  };
}
function normalizeAggregate(value) {
  const source = plain(value) && value.schema === AGGREGATE_SCHEMA ? value : {};
  const subjects = [], seen = new Set();
  for (const item of Array.isArray(source.subjects) ? source.subjects : []) {
    if (!plain(item)) continue;
    const key = text(item.key, 32), templateId = text(item.templateId, 80), updatedAt = instant(item.updatedAt);
    const matched = Number(item.matched), changed = Number(item.changed), closed = Number(item.closed);
    if (!/^[a-f0-9]{32}$/.test(key) || seen.has(key) || !templateId || !updatedAt
      || ![matched, changed, closed].every((count) => Number.isSafeInteger(count) && count >= 0)) continue;
    seen.add(key); subjects.push({ key, templateId, matched, changed, closed, updatedAt });
  }
  return { schema: AGGREGATE_SCHEMA, subjects: subjects.slice(-MAX_SUBJECTS) };
}
function publicSummary(subject) {
  const total = subject ? subject.matched + subject.changed + subject.closed : 0;
  if (!subject || total < MIN_PUBLIC_REPORTS) return null;
  return {
    reports: total,
    status: subject.closed > subject.matched ? 'likely-unavailable'
      : subject.changed > 0 ? 'details-may-have-changed' : 'recently-matched',
    matched: subject.matched,
    changed: subject.changed,
    closed: subject.closed,
    updatedAt: subject.updatedAt,
  };
}
function inputRecord(value) {
  if (!plain(value) || Object.keys(value).some((key) => !ALLOWED_INPUT.includes(key))) return null;
  const snapshotId = text(value.snapshotId, 120), signal = text(value.signal, 16);
  return snapshotId && SIGNALS.includes(signal) ? { snapshotId, signal } : null;
}

function createService(options) {
  const settings = plain(options) ? options : {};
  const clock = typeof settings.clock === 'function' ? settings.clock : () => new Date().toISOString();
  const readAccount = typeof settings.readAccount === 'function' ? settings.readAccount : () => null;
  const writeAccount = typeof settings.writeAccount === 'function' ? settings.writeAccount : () => { throw new Error('account-writer-required'); };
  const readAggregate = typeof settings.readAggregate === 'function' ? settings.readAggregate : () => null;
  const writeAggregate = typeof settings.writeAggregate === 'function' ? settings.writeAggregate : () => { throw new Error('aggregate-writer-required'); };
  const findSnapshot = typeof settings.findSnapshot === 'function' ? settings.findSnapshot : () => null;
  const isCompleted = typeof settings.isCompleted === 'function' ? settings.isCompleted : () => false;
  let queue = Promise.resolve();

  function now() {
    const value = instant(clock()); if (!value) throw new Error('invalid-clock');
    return value;
  }
  function locked(operation) {
    const current = queue.catch(() => {}).then(operation);
    queue = current.catch(() => {});
    return current;
  }
  function lookup(uid, snapshotId, requireCompletion) {
    const snapshot = findSnapshot(uid, snapshotId);
    const subject = subjectFor(snapshot);
    if (!snapshot || !subject) return { ok: false, reason: 'local-snapshot-required' };
    if (requireCompletion && !isCompleted(uid, snapshotId)) return { ok: false, reason: 'completed-snapshot-required' };
    return { ok: true, snapshot, subject };
  }
  function summary(uid, snapshotId) {
    const found = lookup(uid, text(snapshotId, 120), false);
    if (!found.ok) return found;
    const at = now();
    const account = normalizeAccount(readAccount(uid), at);
    const alreadyMarked = account.subjectKeys.includes(found.subject.key);
    const completed = isCompleted(uid, snapshotId);
    const aggregate = normalizeAggregate(readAggregate());
    const subject = aggregate.subjects.find((item) => item.key === found.subject.key);
    return {
      ok: true, summary: publicSummary(subject),
      canMark: completed && !alreadyMarked,
      alreadyMarked,
    };
  }
  function mark(uid, raw) {
    return locked(async () => {
      const input = inputRecord(raw); if (!input) return { ok: false, reason: 'invalid-community-mark' };
      const found = lookup(uid, input.snapshotId, true); if (!found.ok) return found;
      const at = now(), accountBefore = normalizeAccount(readAccount(uid), at);
      if (accountBefore.subjectKeys.includes(found.subject.key)) return { ok: false, reason: 'already-marked' };
      if (accountBefore.ledger.marks >= DAILY_MARK_LIMIT) return { ok: false, reason: 'daily-mark-limit' };
      const aggregateBefore = normalizeAggregate(readAggregate());
      const aggregate = structuredClone(aggregateBefore);
      let subject = aggregate.subjects.find((item) => item.key === found.subject.key);
      if (!subject) {
        subject = { key: found.subject.key, templateId: found.subject.templateId, matched: 0, changed: 0, closed: 0, updatedAt: at };
        aggregate.subjects.push(subject);
        if (aggregate.subjects.length > MAX_SUBJECTS) aggregate.subjects = aggregate.subjects.slice(-MAX_SUBJECTS);
      }
      subject[input.signal] += 1; subject.updatedAt = at;
      const account = structuredClone(accountBefore);
      account.marks.push({ subjectKey: found.subject.key, snapshotId: input.snapshotId, templateId: found.subject.templateId, signal: input.signal, at });
      account.marks = account.marks.slice(-MAX_ACCOUNT_MARKS);
      account.subjectKeys = account.subjectKeys.filter((key) => key !== found.subject.key).concat(found.subject.key).slice(-MAX_ACCOUNT_SUBJECTS);
      account.ledger.marks += 1;
      try {
        writeAggregate(aggregate);
        writeAccount(uid, account);
      } catch (error) {
        try { writeAggregate(aggregateBefore); } catch {}
        throw error;
      }
      return {
        ok: true, accepted: input.signal, summary: publicSummary(subject),
        canMark: false, alreadyMarked: true,
      };
    });
  }
  return Object.freeze({ VERSION, summary, mark });
}

module.exports = Object.freeze({
  VERSION, ACCOUNT_SCHEMA, AGGREGATE_SCHEMA, SIGNALS, MIN_PUBLIC_REPORTS,
  MAX_ACCOUNT_MARKS, MAX_ACCOUNT_SUBJECTS, MAX_SUBJECTS, DAILY_MARK_LIMIT, ALLOWED_INPUT,
  canonicalActionUrl, subjectFor, normalizeAccount, normalizeAggregate, publicSummary, inputRecord, createService,
});
