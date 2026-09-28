'use strict';

// Private server policy. No client balance, clock, task title or reward writes.
const crypto = require('node:crypto');
const RULES = Object.freeze({ id: 'lighthouse-foundation-v1', target: 4, members: 6, daily: 1 });
const MAX_CHAPTERS = 1000;
const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
const record = x => !!x && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => record(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|');
const stamp = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
function fail(code) { throw Object.assign(new Error(code), { code }); }
function empty() { return { version: 1, revision: 0, chapters: [], used: [] }; }
function total(c) { return c.anonymousContributions + c.contributions.length; }
function contributors(c) { return c.anonymousContributors + new Set(c.contributions.map(x => x.actor)).size; }
function sourceKey(actor, taskId) {
  return crypto.createHash('sha256').update(JSON.stringify(['task', actor, taskId])).digest('hex');
}
function validate(s) {
  if (!exact(s, ['version', 'revision', 'chapters', 'used']) || s.version !== 1
    || !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.chapters)
    || s.chapters.length > MAX_CHAPTERS || !Array.isArray(s.used) || s.used.length > MAX_CHAPTERS * RULES.target)
    fail('adventure_data_invalid');
  const chapterIds = new Set(), expected = new Map();
  for (const c of s.chapters) {
    if (!exact(c, ['id', 'rules', 'createdAt', 'revision', 'members', 'contributions', 'anonymousContributions', 'anonymousContributors'])
      || !id(c.id) || chapterIds.has(c.id) || c.rules !== RULES.id || !stamp(c.createdAt)
      || !Number.isSafeInteger(c.revision) || c.revision < 1 || !Array.isArray(c.members)
      || c.members.length > RULES.members || !Array.isArray(c.contributions)
      || !Number.isInteger(c.anonymousContributions) || c.anonymousContributions < 0
      || !Number.isInteger(c.anonymousContributors) || c.anonymousContributors < 0
      || c.anonymousContributors > c.anonymousContributions
      || c.anonymousContributions > c.anonymousContributors * (RULES.target - 1) || total(c) > RULES.target)
      fail('adventure_data_invalid');
    chapterIds.add(c.id);
    const memberIds = new Set(), days = new Set();
    for (const m of c.members) {
      if (!exact(m, ['id', 'joinedAt', 'active']) || !id(m.id) || memberIds.has(m.id)
        || !stamp(m.joinedAt) || m.joinedAt < c.createdAt || typeof m.active !== 'boolean') fail('adventure_data_invalid');
      memberIds.add(m.id);
    }
    for (const r of c.contributions) {
      const dayKey = JSON.stringify([r?.actor, typeof r?.at === 'string' ? r.at.slice(0, 10) : null]);
      if (!exact(r, ['actor', 'source', 'at']) || !memberIds.has(r.actor) || !hash(r.source)
        || !stamp(r.at) || r.at < c.createdAt || expected.has(r.source) || days.has(dayKey)) fail('adventure_data_invalid');
      days.add(dayKey); expected.set(r.source, JSON.stringify([c.id, r.actor]));
    }
    if (total(c) === RULES.target && contributors(c) < 2) fail('adventure_data_invalid');
    for (const actor of memberIds) if (c.contributions.filter(x => x.actor === actor).length >= RULES.target) fail('adventure_data_invalid');
  }
  const seen = new Set();
  for (const u of s.used) {
    if (!exact(u, ['source', 'chapterId', 'actor']) || !hash(u.source) || seen.has(u.source)
      || expected.get(u.source) !== JSON.stringify([u.chapterId, u.actor])) fail('adventure_data_invalid');
    seen.add(u.source);
  }
  if (seen.size !== expected.size) fail('adventure_data_invalid');
  return s;
}
function context(ctx) {
  if (!record(ctx) || !id(ctx.actor) || !id(ctx.partyId) || !stamp(ctx.now)
    || !Array.isArray(ctx.memberIds) || ctx.memberIds.length > RULES.members
    || ctx.memberIds.some(x => !id(x)) || new Set(ctx.memberIds).size !== ctx.memberIds.length
    || !ctx.memberIds.includes(ctx.actor)) fail('not_party_member');
}
function view(s, ctx) {
  validate(s); context(ctx);
  const c = s.chapters.find(x => x.id === ctx.partyId);
  if (!c || !c.members.some(x => x.id === ctx.actor && x.active)) return null;
  // Aggregates only. No source hashes, task IDs, timestamps or other players' activity.
  return { chapterId: c.id, rules: c.rules, revision: c.revision, target: RULES.target,
    progress: total(c), phase: total(c) === RULES.target ? 'ready_for_choice' : 'collecting',
    ownContributions: c.contributions.filter(x => x.actor === ctx.actor).length,
    contributedToday: c.contributions.some(x => x.actor === ctx.actor && x.at.slice(0, 10) === ctx.now.slice(0, 10)),
    dailyLimit: RULES.daily, dayBoundary: 'UTC', rewardsGranted: false };
}
function commit(s, c) { s.revision++; c.revision++; validate(s); return { state: s, replay: false }; }
function join(state, ctx, input) {
  validate(state); context(ctx);
  if (!exact(input, ['shareProgress']) || input.shareProgress !== true) fail('consent_required');
  const s = structuredClone(state);
  let c = s.chapters.find(x => x.id === ctx.partyId);
  if (c && ctx.now < c.createdAt) fail('clock_before_chapter');
  if (!c) {
    if (s.chapters.length >= MAX_CHAPTERS) fail('adventure_capacity');
    c = { id: ctx.partyId, rules: RULES.id, createdAt: ctx.now, revision: 1, members: [],
      contributions: [], anonymousContributions: 0, anonymousContributors: 0 };
    s.chapters.push(c);
  }
  let member = c.members.find(x => x.id === ctx.actor);
  if (member?.active) return { state, replay: true };
  if (member) { member.active = true; member.joinedAt = ctx.now; }
  else {
    if (c.members.length >= RULES.members) fail('chapter_full');
    member = { id: ctx.actor, joinedAt: ctx.now, active: true }; c.members.push(member);
  }
  return commit(s, c);
}
function contribute(state, ctx, input, savedTask) {
  validate(state); context(ctx);
  if (!exact(input, ['taskId', 'revision']) || !id(input.taskId) || !Number.isSafeInteger(input.revision) || input.revision < 1)
    fail('invalid_contribution');
  const c = state.chapters.find(x => x.id === ctx.partyId);
  const member = c?.members.find(x => x.id === ctx.actor && x.active);
  if (!member) fail('consent_required');
  if (ctx.now < member.joinedAt) fail('clock_before_join');
  const key = sourceKey(ctx.actor, input.taskId), previous = state.used.find(x => x.source === key);
  // Response loss/undo/deletion of the source cannot mint the same contribution again.
  if (previous) {
    if (previous.chapterId !== ctx.partyId) fail('source_already_used');
    return { state, replay: true };
  }
  if (input.revision !== c.revision) fail('chapter_conflict');
  if (total(c) >= RULES.target) fail('chapter_ready');
  if (!record(savedTask) || savedTask.id !== input.taskId || savedTask.done !== true || !stamp(savedTask.completedAt)
    || savedTask.completedAt < member.joinedAt || savedTask.completedAt > ctx.now) fail('task_not_saved');
  if (c.contributions.some(x => x.actor === ctx.actor && x.at.slice(0, 10) === ctx.now.slice(0, 10))) fail('daily_limit');
  if (c.contributions.filter(x => x.actor === ctx.actor).length >= RULES.target - 1) fail('partner_required');
  const s = structuredClone(state), next = s.chapters.find(x => x.id === ctx.partyId);
  next.contributions.push({ actor: ctx.actor, source: key, at: ctx.now });
  s.used.push({ source: key, chapterId: ctx.partyId, actor: ctx.actor });
  return commit(s, next);
}
function withdraw(state, actor, partyId) {
  validate(state);
  if (!id(actor) || !id(partyId)) fail('invalid_membership');
  const c = state.chapters.find(x => x.id === partyId), member = c?.members.find(x => x.id === actor);
  if (!member?.active) return { state, replay: true };
  const s = structuredClone(state), next = s.chapters.find(x => x.id === partyId);
  next.members.find(x => x.id === actor).active = false;
  return commit(s, next);
}
function eraseAccount(state, actor) {
  validate(state); if (!id(actor)) fail('invalid_account');
  const s = structuredClone(state); let changed = false;
  for (const c of s.chapters) {
    if (!c.members.some(x => x.id === actor)) continue;
    const count = c.contributions.filter(x => x.actor === actor).length;
    c.anonymousContributions += count; c.anonymousContributors += Number(count > 0);
    c.contributions = c.contributions.filter(x => x.actor !== actor);
    c.members = c.members.filter(x => x.id !== actor); c.revision++; changed = true;
  }
  s.used = s.used.filter(x => x.actor !== actor);
  if (!changed) return { state, replay: true };
  s.revision++; validate(s); return { state: s, replay: false };
}
module.exports = Object.freeze({ RULES, MAX_CHAPTERS, empty, validate, view, join, contribute, withdraw, eraseAccount });
