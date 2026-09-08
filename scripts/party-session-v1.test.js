'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const M = require('../public/party-session-v1.js');
const NOW = Date.parse('2026-09-08T12:00:00Z');
const input = { id: 'session1', actor: 'a', to: 'b', taskId: 'task-a', publicLabel: 'A public step', minutes: 25,
  share: true, now: NOW, memberIds: ['a', 'b', 'c'], taskAvailable: true };
function make(overrides = {}) { const result = M.create({ ...input, ...overrides }); assert.equal(result.ok, true); return result.session; }
function step(s, op, actor, extra = {}) { return M.transition(s, { actor, op, eventId: `${actor}_${op}_${s.revision}`, now: NOW, ...extra }); }
function ready() { const s = make(); return step(s, 'accept', 'b', { taskId: 'task-b', publicLabel: 'B public step', share: true, taskAvailable: true }).session; }
function running() { return step(step(ready(), 'ready', 'a').session, 'ready', 'b').session; }
test('duo: explicit selective sharing, own task ID only, outsiders see nothing', () => {
  assert.equal(M.create({ ...input, share: false }).error, 'sharing_required');
  const s = make(); assert.equal(M.view(s, 'c', NOW), null);
  const v = M.view(s, 'b', NOW); assert.equal('taskId' in v.members[0], false); assert.equal(v.members[0].label, 'A public step');
  assert.equal(step(s, 'accept', 'c').error, 'not_member');
  assert.equal(step(s, 'accept', 'b', { taskId: 'task-b', publicLabel: 'B', taskAvailable: true }).error, 'sharing_required');
});
test('duo: duration, schedule, limits and muting are decisions, not UI hints', () => {
  for (const minutes of [0, 4, 121, 5.5, '25']) assert.equal(M.create({ ...input, minutes }).error, 'invalid_duration');
  assert.equal(M.create({ ...input, scheduledAt: new Date(NOW + 8 * 86400000).toISOString() }).error, 'invalid_schedule');
  assert.equal(M.create({ ...input, mutedIds: ['b'] }).error, 'invites_muted');
  assert.equal(M.create({ ...input, taskAvailable: false }).error, 'task_unavailable');
  assert.equal(M.create({ ...input, id: 'second', sessions: [make()] }).error, 'session_busy');
  const past = ['x', 'y', 'z'].map((id) => ({ ...make({ id }), status: 'declined' }));
  assert.equal(M.create({ ...input, sessions: past }).error, 'invite_limit');
});
test('duo: server clock, two explicit readiness receipts, expiration and no automatic completion', () => {
  const s = ready(), first = step(s, 'ready', 'a').session;
  assert.equal(first.startedAt, null);
  const stale = step(first, 'ready', 'b', { now: NOW + M.READY_MS }).session;
  assert.equal(stale.startedAt, null);
  const started = step(stale, 'ready', 'a', { now: NOW + M.READY_MS + 1 }).session;
  assert.equal(M.status(started, NOW + M.READY_MS + 2), 'running');
  assert.equal(M.status(started, NOW + 26 * 60000 + M.READY_MS), 'review');
  assert.equal(started.members.some((m) => m.outcome), false);
  const future = make({ scheduledAt: new Date(NOW + 60000).toISOString() });
  const accepted = step(future, 'accept', 'b', { taskId: 'btask', publicLabel: 'B', share: true, taskAvailable: true }).session;
  assert.equal(step(accepted, 'ready', 'a').error, 'too_early');
});
test('duo: immutable, idempotent, no repeated effects; retry after save retains receipt', () => {
  const s = ready(), before = JSON.stringify(s), payload = { actor: 'a', op: 'ready', eventId: 'gesture', now: NOW };
  const first = M.transition(s, payload); assert.equal(JSON.stringify(s), before);
  assert.deepEqual(M.transition(first.session, payload).session, first.session);
  assert.equal(M.transition(first.session, { ...payload, op: 'withdraw' }).error, 'id_conflict');
  assert.equal(M.create({ ...input, sessions: [make()], taskAvailable: false }).duplicate, true);
});
test('duo: done needs saved task, partial and stopped never pretend completion', () => {
  const s = running(); assert.equal(step(s, 'finish', 'a', { outcome: 'done' }).error, 'task_not_saved');
  const a = step(s, 'finish', 'a', { outcome: 'partial' }).session;
  const b = step(a, 'finish', 'b', { outcome: 'stopped' }).session;
  assert.equal(M.status(b, NOW), 'finished'); assert.deepEqual(b.members.map((m) => m.outcome), ['partial', 'stopped']);
  assert.equal('gold' in b, false); assert.equal('xp' in b, false);
  assert.equal(M.view(b, 'a', NOW).actions.includes('finish'), false);
});
test('duo: withdrawal erases text from receipts too; closed sessions never resurrect', () => {
  const s = running(); const removed = step(s, 'withdraw', 'b').session;
  assert.equal(M.status(removed, NOW), 'cancelled');
  assert.equal(JSON.stringify(removed).includes('B public step'), false);
  assert.equal(JSON.stringify(removed).includes('task-b'), false);
  const finished = step(step(s, 'finish', 'a', { outcome: 'done', taskDone: true }).session, 'finish', 'b', { outcome: 'partial' }).session;
  const withdrawn = step(finished, 'withdraw', 'b').session;
  assert.equal(M.status(withdrawn, NOW), 'finished');
  assert.deepEqual(M.prune([s], NOW, ['a', 'c']), []);
  assert.deepEqual(M.prune([s], NOW + M.RETENTION_MS, ['a', 'b']), []);
});
