'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const P = require('../server-adventure-policy-v1.js');
const S = require('../server-adventure-store-v1.js');
const first = '2026-09-28T10:00:00.000Z';
function fixture(storage) {
  let now = first, partyId = 'party-a', members = ['alice', 'bob'], memory = null, writes = 0, reads = 0;
  const tasks = new Map();
  const deps = { read: () => memory, write: value => { writes++; memory = structuredClone(value); }, ...storage,
    context: actor => ({ actor, partyId, memberIds: [...members], now }),
    readTask: (actor, taskId) => { reads++; return tasks.get(JSON.stringify([actor, taskId])) || null; } };
  let service = S.createService(deps);
  return {
    get service() { return service; }, deps, get state() { return structuredClone(deps.read()); },
    get writes() { return writes; }, get reads() { return reads; },
    restart() { service = S.createService(deps); },
    at(value) { now = value; }, party(value) { partyId = value; }, members(value) { members = value; },
    task(actor, taskId, extra = {}) { tasks.set(JSON.stringify([actor, taskId]), { id: taskId, done: true, completedAt: now, title: 'PRIVATE_DIARY', ...extra }); },
    join(actor) { return service.join(actor, { shareProgress: true }); },
    add(actor, taskId) { return service.contribute(actor, { taskId, revision: service.view(actor).revision }); },
  };
}
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

test('chapter requires individual consent and actual membership; no implicit enrolment', () => {
  const f = fixture();
  rejects(() => f.service.join('alice', { shareProgress: false }), 'consent_required');
  rejects(() => f.service.join('mallory', { shareProgress: true }), 'not_party_member');
  f.join('alice'); assert.equal(f.service.view('bob'), null);
  rejects(() => f.service.contribute('bob', { taskId: 'one', revision: 2 }), 'consent_required');
  assert.equal(f.reads, 0);
  const before = f.writes; assert.equal(f.join('alice').replay, true); assert.equal(f.writes, before);
});

test('two people, four confirmed steps, frozen target; no gold/XP payout', () => {
  const f = fixture(); f.join('alice'); f.join('bob');
  for (let day = 28; day <= 29; day++) {
    f.at(`2026-09-${day}T11:00:00.000Z`);
    for (const actor of ['alice', 'bob']) { f.task(actor, 'task-' + day); f.add(actor, 'task-' + day); }
  }
  assert.equal(f.service.view('bob').progress, 4);
  assert.equal(f.service.view('bob').phase, 'ready_for_choice');
  assert.equal(f.service.view('bob').rewardsGranted, false);
  f.members(['alice', 'bob', 'claire']); f.join('claire');
  assert.equal(f.service.view('claire').target, 4);
  f.task('claire', 'late'); rejects(() => f.add('claire', 'late'), 'chapter_ready');
});

test('completion is read from the actor account; client amounts, timestamps and identity rejected', () => {
  const f = fixture(); f.join('alice'); f.join('bob'); f.task('bob', 'private');
  rejects(() => f.add('alice', 'private'), 'task_not_saved');
  const request = { taskId: 'one', revision: f.service.view('alice').revision };
  for (const extra of [{ actor: 'bob' }, { gold: 1000 }, { completedAt: first }, { amount: 9 }])
    rejects(() => f.service.contribute('alice', { ...request, ...extra }), 'invalid_contribution');
  for (const extra of [{ done: false }, { completedAt: 'bad' }, { completedAt: '2026-09-29T11:00:00.000Z' },
    { completedAt: '2026-09-27T11:00:00.000Z' }, { id: 'different' }]) {
    f.task('alice', 'one', extra); rejects(() => f.add('alice', 'one'), 'task_not_saved');
  }
  assert.equal(f.service.view('alice').progress, 0);
});

test('retry after undo or task removal returns the same receipt; other chapter cannot reuse source', () => {
  const f = fixture(); f.join('alice'); f.task('alice', 'one');
  const input = { taskId: 'one', revision: f.service.view('alice').revision };
  f.service.contribute('alice', input); const writes = f.writes, reads = f.reads;
  f.task('alice', 'one', { done: false });
  assert.equal(f.service.contribute('alice', input).replay, true);
  assert.equal(f.writes, writes); assert.equal(f.reads, reads);
  f.party('party-b'); f.join('alice'); f.task('alice', 'one');
  rejects(() => f.add('alice', 'one'), 'source_already_used');
});

test('one daily UTC contribution; personal clock payload cannot override it', () => {
  const f = fixture(); f.join('alice'); f.task('alice', 'one'); f.add('alice', 'one');
  f.at('2026-09-28T23:59:59.999Z'); f.task('alice', 'two');
  rejects(() => f.add('alice', 'two'), 'daily_limit');
  f.at('2026-09-29T00:00:00.000Z'); f.task('alice', 'two'); f.add('alice', 'two');
  assert.equal(f.service.view('alice').progress, 2);
  assert.equal(f.service.view('alice').dayBoundary, 'UTC');
});

test('solo cannot fill the last slot and prevent another participant from finishing', () => {
  const f = fixture(); f.join('alice'); f.join('bob');
  for (let day = 28; day <= 30; day++) {
    f.at(`2026-09-${day}T11:00:00.000Z`); f.task('alice', 'task-' + day); f.add('alice', 'task-' + day);
  }
  f.at('2026-10-01T11:00:00.000Z'); f.task('alice', 'four');
  rejects(() => f.add('alice', 'four'), 'partner_required');
  f.task('bob', 'last'); assert.equal(f.add('bob', 'last').chapter.phase, 'ready_for_choice');
});

test('stale base does not consume the task or read private content; refreshed request succeeds', () => {
  const f = fixture(); f.join('alice'); f.join('bob');
  const revision = f.service.view('alice').revision;
  f.task('alice', 'one'); f.task('bob', 'two'); f.add('alice', 'one');
  const reads = f.reads;
  rejects(() => f.service.contribute('bob', { taskId: 'two', revision }), 'chapter_conflict');
  assert.equal(f.reads, reads); assert.equal(f.add('bob', 'two').chapter.progress, 2);
});

test('withdraw/rejoin retains progress and cannot renew the daily limit or used action', () => {
  const f = fixture(); f.join('alice'); f.join('bob'); f.task('alice', 'one'); f.add('alice', 'one');
  f.service.withdraw('alice', 'party-a'); assert.equal(f.service.view('alice'), null);
  assert.equal(f.service.view('bob').progress, 1);
  rejects(() => f.service.contribute('alice', { taskId: 'one', revision: 1 }), 'consent_required');
  f.at('2026-09-28T12:00:00.000Z'); f.join('alice');
  assert.equal(f.add('alice', 'one').replay, true);
  f.task('alice', 'two'); rejects(() => f.add('alice', 'two'), 'daily_limit');
  f.members(['bob']); rejects(() => f.service.view('alice'), 'not_party_member');
});

test('account erasure anonymizes progress and receipts, preserves other participants and is repeatable', () => {
  const f = fixture(); f.join('alice'); f.join('bob');
  f.task('alice', 'one'); f.add('alice', 'one');
  f.task('bob', 'two'); f.add('bob', 'two');
  const oldSource = f.state.used.find(x => x.actor === 'alice').source;
  f.service.eraseAccount('alice');
  assert.equal(JSON.stringify(f.state).includes('alice'), false);
  assert.equal(JSON.stringify(f.state).includes(oldSource), false);
  assert.equal(f.service.view('bob').progress, 2);
  assert.equal(f.service.eraseAccount('alice').replay, true);
  P.validate(f.state);
});

test('chapter views never disclose another player task IDs, hashes, dates or title', () => {
  const f = fixture(); f.join('alice'); f.join('bob'); f.task('alice', 'private-task'); f.add('alice', 'private-task');
  const view = JSON.stringify(f.service.view('bob'));
  for (const secret of ['PRIVATE_DIARY', 'private-task', 'alice', first, f.state.used[0].source]) assert.equal(view.includes(secret), false);
  assert.equal(JSON.stringify(f.state).includes('PRIVATE_DIARY'), false);
  assert.equal(JSON.stringify(f.state).includes('private-task'), false);
});

test('policy leaves the input ledger unchanged, including rejected decisions', () => {
  const s = P.empty(), ctx = { actor: 'alice', partyId: 'p', memberIds: ['alice'], now: first };
  const before = JSON.stringify(s); P.join(s, ctx, { shareProgress: true }); assert.equal(JSON.stringify(s), before);
  rejects(() => P.contribute(s, ctx, { taskId: 'one', revision: 1 }, {}), 'consent_required');
  assert.equal(JSON.stringify(s), before);
});

test('corrupt ledger, duplicate receipts, unsupported versions and extra fields fail closed', () => {
  const f = fixture(); f.join('alice'); f.task('alice', 'one'); f.add('alice', 'one');
  const mutations = [s => { s.version = 2; }, s => { s.used.push(s.used[0]); },
    s => { s.used = []; }, s => { s.chapters[0].rules = 'changed'; },
    s => { s.chapters[0].contributions[0].source = 'broken'; }, s => { s.gold = 999; },
    s => { s.chapters[0].members.push(s.chapters[0].members[0]); },
    s => { s.chapters[0].contributions[0].at = 42; },
    s => { s.chapters[0].anonymousContributions = 1; }];
  for (const mutate of mutations) { const s = f.state; mutate(s); rejects(() => P.validate(s), 'adventure_data_invalid'); }
  for (const value of [null, [], 1, {}, { ...P.empty(), revision: Infinity }]) rejects(() => P.validate(value), 'adventure_data_invalid');
});

test('server context mismatch and asynchronous dependencies cannot produce success', () => {
  const f = fixture();
  const forged = S.createService({ ...f.deps, context: () => ({ actor: 'bob' }) });
  assert.throws(() => forged.join('alice', { shareProgress: true }), /actor_mismatch/);
  const asyncRead = S.createService({ ...f.deps, read: () => Promise.resolve(null) });
  assert.throws(() => asyncRead.join('alice', { shareProgress: true }), /async_dependency/);
  assert.equal(f.writes, 0);
});

test('durable storage survives service recreation; malformed JSON is not overwritten', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-adventure-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const f = fixture(S.fileStorage(dir)); f.join('alice'); f.task('alice', 'one'); f.add('alice', 'one'); f.restart();
  assert.equal(f.service.view('alice').progress, 1); assert.equal(f.add('alice', 'one').replay, true);
  const file = path.join(dir, S.FILE); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  fs.writeFileSync(file, '{broken'); assert.throws(() => f.join('bob'));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

for (const boundary of ['before_rename', 'after_rename', 'directory_fsync']) test(`durable failure ${boundary}: retry grants at most once`, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-adventure-fault-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let failing = false; const directoryFds = new Set();
  const io = { ...fs,
    openSync(file, ...args) { const fd = fs.openSync(file, ...args); if (file === dir) directoryFds.add(fd); return fd; },
    closeSync(fd) { directoryFds.delete(fd); return fs.closeSync(fd); },
    fsyncSync(fd) { if (failing && boundary === 'directory_fsync' && directoryFds.has(fd)) throw new Error('fault'); return fs.fsyncSync(fd); },
    renameSync(a, b) {
      if (failing && boundary === 'before_rename') throw new Error('fault');
      fs.renameSync(a, b);
      if (failing && boundary === 'after_rename') throw new Error('fault');
    } };
  const f = fixture(S.fileStorage(dir, io)); f.join('alice'); f.task('alice', 'one');
  const input = { taskId: 'one', revision: f.service.view('alice').revision };
  failing = true; assert.throws(() => f.service.contribute('alice', input), /fault/);
  failing = false; f.restart(); const result = f.service.contribute('alice', input);
  assert.equal(result.chapter.progress, 1); assert.equal(result.replay, boundary !== 'before_rename');
  assert.equal(f.state.used.length, 1); assert.equal(fs.readdirSync(dir).length, 1);
});

test('replay does not report success while durability confirmation still fails', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-adventure-confirm-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const storage = S.fileStorage(dir); let fail = false;
  const f = fixture({ ...storage, confirm() { if (fail) throw new Error('still unavailable'); storage.confirm(); } });
  f.join('alice'); f.task('alice', 'one'); f.add('alice', 'one'); fail = true;
  assert.throws(() => f.add('alice', 'one'), /still unavailable/);
  fail = false; assert.equal(f.add('alice', 'one').replay, true);
  assert.equal(f.state.used.length, 1);
});

test('chapter stays complete after erasing a contributor and privacy hooks preserve aggregates', () => {
  const f = fixture(); f.join('alice'); f.join('bob');
  for (let day = 28; day <= 29; day++) {
    f.at(`2026-09-${day}T11:00:00.000Z`);
    for (const actor of ['alice', 'bob']) { f.task(actor, String(day)); f.add(actor, String(day)); }
  }
  f.service.eraseAccount('alice'); assert.equal(f.service.view('bob').phase, 'ready_for_choice');
  f.service.eraseAccount('bob'); assert.equal(f.state.chapters[0].anonymousContributions, 4);
  assert.equal(f.state.chapters[0].anonymousContributors, 2); P.validate(f.state);
});

test('privacy no-op on an unused account does not create or require storage', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-adventure-empty-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const f = fixture(S.fileStorage(dir));
  assert.equal(f.service.eraseAccount('alice').replay, true);
  assert.equal(f.service.withdraw('alice', 'party-a').replay, true);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('a new Node process recovers the contribution without rereading a deleted task', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-adventure-process-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const f = fixture(S.fileStorage(dir)); f.join('alice'); f.task('alice', 'one'); f.add('alice', 'one');
  const output = require('node:child_process').execFileSync(process.execPath, ['-e', `
    const S = require(process.argv[1]);
    const service = S.createService({ ...S.fileStorage(process.argv[2]),
      context: actor => ({actor, partyId: 'party-a', memberIds: ['alice', 'bob'], now: '${first}'}),
      readTask() { throw new Error('Must replay without the original task'); } });
    process.stdout.write(JSON.stringify(service.contribute('alice', {taskId: 'one', revision: 1})));
  `, require.resolve('../server-adventure-store-v1.js'), dir], { encoding: 'utf8' });
  const result = JSON.parse(output); assert.equal(result.replay, true); assert.equal(result.chapter.progress, 1);
});
