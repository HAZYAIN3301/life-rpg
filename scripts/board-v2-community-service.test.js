'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Community = require('../server-board-v2-community-v1.js');

const NOW = '2026-08-25T18:00:00.000Z';

function snapshot(id, url, extra) {
  return Object.assign({
    schema: 'satoru.board-offer-snapshot/2', id, templateId: 'try-specific-local-class',
    tags: ['sport', 'local'], primaryAction: { label: 'Открыть занятие', url },
  }, extra || {});
}
function fixture(options) {
  const settings = options || {};
  const accounts = new Map(), snapshots = new Map(), completed = new Set();
  let aggregate = null;
  const service = Community.createService({
    clock: () => NOW,
    readAccount: (uid) => accounts.get(uid) || null,
    writeAccount: (uid, value) => {
      if (settings.failAccountWrite) throw new Error('disk-full');
      accounts.set(uid, structuredClone(value));
    },
    readAggregate: () => aggregate,
    writeAggregate: (value) => { aggregate = structuredClone(value); },
    findSnapshot: (uid, id) => snapshots.get(`${uid}:${id}`) || null,
    isCompleted: (uid, id) => completed.has(`${uid}:${id}`),
  });
  function add(uid, id, url) {
    snapshots.set(`${uid}:${id}`, snapshot(id, url));
    return { complete() { completed.add(`${uid}:${id}`); } };
  }
  return { service, accounts, snapshots, completed, add, aggregate: () => aggregate };
}

test('only a genuinely completed local snapshot may contribute', async () => {
  const f = fixture();
  f.add('alpha', 'snapshot-a', 'https://hsp.sport.uni-bielefeld.de/boxing');
  assert.deepEqual(await f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' }), {
    ok: false, reason: 'completed-snapshot-required',
  });
  f.completed.add('alpha:snapshot-a');
  const accepted = await f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.summary, null, 'one report is private under the k-anonymity floor');
});

test('non-local snapshot or missing canonical HTTPS action fails closed', async () => {
  const f = fixture();
  for (const [id, value] of [
    ['non-local', snapshot('non-local', 'https://example.test/quest', { tags: ['solo'] })],
    ['http', snapshot('http', 'http://example.test/quest')],
    ['credentials', snapshot('credentials', 'https://user:pass@example.test/quest')],
  ]) {
    f.snapshots.set(`alpha:${id}`, value); f.completed.add(`alpha:${id}`);
    assert.equal((await f.service.mark('alpha', { snapshotId: id, signal: 'matched' })).reason, 'local-snapshot-required');
  }
});

test('client cannot send URL, text, media, GPS or foreign identity', async () => {
  const f = fixture(); f.add('alpha', 'snapshot-a', 'https://example.test/class').complete();
  for (const key of ['url', 'hint', 'freeText', 'media', 'latitude', 'longitude', 'userId']) {
    const result = await f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched', [key]: 'attack' });
    assert.deepEqual(result, { ok: false, reason: 'invalid-community-mark' });
  }
  assert.deepEqual(Community.ALLOWED_INPUT, ['snapshotId', 'signal']);
});

test('one account can affect one subject only once even through another snapshot', async () => {
  const f = fixture();
  f.add('alpha', 'snapshot-a', 'https://example.test/class?utm_source=tiktok').complete();
  f.add('alpha', 'snapshot-b', 'https://example.test/class').complete();
  assert.equal((await f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' })).ok, true);
  assert.deepEqual(await f.service.mark('alpha', { snapshotId: 'snapshot-b', signal: 'closed' }), { ok: false, reason: 'already-marked' });
  assert.equal(f.aggregate().subjects[0].matched, 1);
  assert.equal(f.aggregate().subjects[0].closed, 0);
});

test('three distinct accounts unlock only a structured aggregate, never identities', async () => {
  const f = fixture();
  for (const [uid, signal] of [['alpha', 'matched'], ['beta', 'matched'], ['gamma', 'changed']]) {
    f.add(uid, `snapshot-${uid}`, 'https://example.test/class').complete();
    await f.service.mark(uid, { snapshotId: `snapshot-${uid}`, signal });
  }
  const summary = f.service.summary('alpha', 'snapshot-alpha');
  assert.equal(summary.ok, true);
  assert.deepEqual(summary.summary, {
    reports: 3, status: 'details-may-have-changed', matched: 2, changed: 1, closed: 0, updatedAt: NOW,
  });
  const serialized = JSON.stringify(f.aggregate());
  assert.doesNotMatch(serialized, /alpha|beta|gamma|snapshot|example\.test|https/);
});

test('community signal exposes only structured availability evidence', () => {
  assert.deepEqual(Community.SIGNALS, ['matched', 'changed', 'closed']);
  const summary = Community.publicSummary({ matched: 2, changed: 1, closed: 0, updatedAt: NOW });
  assert.deepEqual(Object.keys(summary).sort(), ['changed', 'closed', 'matched', 'reports', 'status', 'updatedAt']);
  assert.equal(Object.values(summary).some((value) => value && typeof value === 'object'), false);
});

test('parallel marks from one account serialize and cannot double count', async () => {
  const f = fixture(); f.add('alpha', 'snapshot-a', 'https://example.test/class').complete();
  const [left, right] = await Promise.all([
    f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' }),
    f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' }),
  ]);
  assert.equal([left, right].filter((item) => item.ok).length, 1);
  assert.equal([left, right].filter((item) => item.reason === 'already-marked').length, 1);
  assert.equal(f.aggregate().subjects[0].matched, 1);
});

test('account write failure rolls the shared aggregate back', async () => {
  const f = fixture({ failAccountWrite: true });
  f.add('alpha', 'snapshot-a', 'https://example.test/class').complete();
  await assert.rejects(() => f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' }), /disk-full/);
  assert.deepEqual(f.aggregate(), Community.normalizeAggregate(null));
});

test('daily mark limit is fail-closed even across different subjects', async () => {
  const f = fixture();
  f.accounts.set('alpha', {
    schema: Community.ACCOUNT_SCHEMA, marks: [], ledger: { day: '2026-08-25', marks: Community.DAILY_MARK_LIMIT },
  });
  f.add('alpha', 'snapshot-a', 'https://example.test/class-a').complete();
  assert.deepEqual(await f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' }), { ok: false, reason: 'daily-mark-limit' });
  assert.equal(f.aggregate(), null);
});

test('bounded audit history does not forget that this account already marked a subject', async () => {
  const f = fixture();
  const subjectKey = 'f'.repeat(32);
  f.accounts.set('alpha', {
    schema: Community.ACCOUNT_SCHEMA,
    marks: Array.from({ length: Community.MAX_ACCOUNT_MARKS }, (_, index) => ({
      subjectKey: index.toString(16).padStart(32, '0'), snapshotId: `snapshot-${index}`,
      templateId: 'other-template', signal: 'matched', at: NOW,
    })),
    subjectKeys: [subjectKey], ledger: { day: '2026-08-24', marks: 0 },
  });
  const entry = snapshot('snapshot-a', 'https://example.test/class');
  entry.templateId = 'remembered-template';
  f.snapshots.set('alpha:snapshot-a', entry); f.completed.add('alpha:snapshot-a');
  const expected = Community.subjectFor(entry).key;
  f.accounts.get('alpha').subjectKeys = [expected];
  assert.deepEqual(await f.service.mark('alpha', { snapshotId: 'snapshot-a', signal: 'matched' }), { ok: false, reason: 'already-marked' });
});

test('corrupt account and aggregate state normalize bounded and fail closed', () => {
  const marks = Array.from({ length: 140 }, (_, index) => ({
    subjectKey: index.toString(16).padStart(32, '0'), snapshotId: `snapshot-${index}`,
    templateId: 'template', signal: 'matched', at: NOW,
  }));
  const account = Community.normalizeAccount({ schema: Community.ACCOUNT_SCHEMA, marks, ledger: { day: 'bad', marks: -5 } }, NOW);
  assert.equal(account.marks.length, Community.MAX_ACCOUNT_MARKS);
  assert.equal(account.subjectKeys.length, 140);
  assert.deepEqual(account.ledger, { day: '2026-08-25', marks: 0 });
  assert.deepEqual(Community.normalizeAggregate({ schema: 'attacker', subjects: [{}] }), { schema: Community.AGGREGATE_SCHEMA, subjects: [] });
  assert.equal(Community.publicSummary({ matched: 2, changed: 0, closed: 0, updatedAt: NOW }), null);
});
