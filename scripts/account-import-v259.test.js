'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../public/account-import-v1'), J = require('../public/commitment-journal-v1');
const crypto = require('node:crypto');
const clone = x => JSON.parse(JSON.stringify(x));
const snapshot = value => ({ exists: true, value });
const data = { tasks: [{ id: 'one', title: 'Imported' }], days: { today: { text: 'hello' } } };
const ticket = () => ({ version: 1, requestId: 'import_one', requestHash: 'a'.repeat(64), signature: 'b'.repeat(64),
  revisions: Object.fromEntries(A.namesFor(data).map(name => [name, 'c'.repeat(64)])) });

test('portable allowlist joins the existing WAL; secrets and server ledgers never do', () => {
  assert.equal(A.FILES.length, 21);
  assert.deepEqual([...J.FILES].sort(), [...A.FILES].sort());
  const values = Object.fromEntries(A.FILES.map(name => [name, A.TYPES[name] === 'array' ? [] : {}]));
  const prepared = J.prepare({ txId: 'import:all-files', createdAt: '2026-09-12T20:00:00.000Z',
    base: Object.fromEntries(A.FILES.map(name => [name, { exists: false, value: null }])), data: values });
  assert.equal(prepared.ok, true);
  assert.equal(J.recoveryPlan(prepared.journal).actions.length, 21);
  assert.ok(J.recoveryPlan(prepared.journal).actions.every(row => row.op === 'remove'));
  const committed = J.markCommitted(prepared.journal, '2026-09-12T20:00:01.000Z');
  assert.equal(committed.ok, true);
  assert.ok(J.recoveryPlan(committed.journal).actions.every(row => row.op === 'write'));
  for (const name of ['ai-keys', 'strava', 'push', 'party-rewards', 'secretary', '../settings', '__proto__']) {
    assert.equal(A.dataValid(JSON.parse('{"' + name + '":{}}')), false, name);
    assert.equal(J.prepare({ txId: 'import:invalid-files', createdAt: '2026-09-12T20:00:00.000Z',
      base: { settings: snapshot({}), tasks: snapshot([]), [name]: snapshot({}) },
      data: { settings: {}, tasks: [], [name]: {} } }).ok, false, name);
  }
});
test('preview matches the selected archive request and exact affected files', () => {
  const result = { ok: true, files: Object.keys(data), ticket: ticket() };
  assert.equal(A.previewValid(result, 'import_one', data), true);
  for (const mutate of [r => r.ok = 'yes', r => r.ticket.requestId = 'other_import',
    r => r.files.push('settings'), r => r.files.push('tasks'), r => delete r.ticket.revisions.days,
    r => r.ticket.revisions.profile = 'd'.repeat(64), r => r.ticket.signature = '', r => r.ticket.extra = true]) {
    const bad = clone(result); mutate(bad); assert.equal(A.previewValid(bad, 'import_one', data), false);
  }
});
test('receipt requires the exact ticket, file set and true boolean success', () => {
  const t = ticket(), good = { ok: true, writeVersion: 2, requestId: t.requestId, requestHash: t.requestHash,
    files: Object.keys(data), replay: false };
  assert.equal(A.receiptValid(good, t, data), true);
  assert.equal(A.receiptValid({ ...good, replay: true }, t, data), true);
  for (const mutate of [r => r.ok = 1, r => delete r.replay, r => r.replay = 'true', r => r.requestId = 'import_other',
    r => r.requestHash = 'f'.repeat(64), r => r.files.pop(), r => r.files.push('days'), r => r.files.push('profile'),
    r => r.writeVersion = 1]) {
    const bad = clone(good); mutate(bad); assert.equal(A.receiptValid(bad, t, data), false);
  }
  assert.equal(A.receiptValid({ ok: true }, t, data), false);
});
test('canonical fingerprints preserve Unicode and property order independence', () => {
  const hash = data => crypto.createHash('sha256').update(A.canonical(data)).digest('hex');
  assert.equal(hash({ z: 'Тень 🫶', a: [1, 2] }), hash({ a: [1, 2], z: 'Тень 🫶' }));
  assert.notEqual(hash({ tasks: [1, 2] }), hash({ tasks: [2, 1] }));
  assert.notEqual(hash({ exists: false, value: null }), hash({ exists: true, value: {} }));
});
test('all import error states have five distinct nonempty localizations', () => {
  for (const key of ['checking', 'preparingFailed', 'saving', 'unconfirmed', 'conflict', 'invalid', 'capacity', 'unsupported', 'retryCheck']) {
    const copy = ['ru', 'en', 'de', 'uk', 'es'].map(locale => A.text(key, locale));
    assert.equal(new Set(copy).size, 5, key); assert.ok(copy.every(s => s.length > 5), key);
  }
});
