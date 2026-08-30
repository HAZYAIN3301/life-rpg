'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('./core.js');

const T0 = Date.parse('2026-08-29T10:00:00.000Z');
const iso = (minutes = 0, seconds = 0) => new Date(T0 + minutes * 60_000 + seconds * 1000).toISOString();

function policy(overrides = {}) {
  return {
    id: 'site_tiktok',
    label: 'TikTok',
    hostname: 'tiktok.com',
    appKey: 'tiktok',
    enabled: true,
    dailyBudgetMinutes: 50,
    maxSessionsPerDay: 3,
    cooldownMinutes: 10,
    purposes: [{
      purpose: 'publish',
      mode: 'adaptive',
      defaultMinutes: 12,
      maxMinutes: 17,
      extensionsAllowed: 1,
      extensionMinutes: 5,
      expectedOutcome: 'video published or a clear stop reason',
    }],
    emergency: { passes: 1, perDays: 7, delaySeconds: 90, accessMinutes: 5 },
    ...overrides,
  };
}

function stateWithPolicy(overrides) {
  const result = Core.upsertPolicy(Core.emptyState(), policy(overrides));
  assert.equal(result.ok, true);
  return result.state;
}

function start(state = stateWithPolicy(), overrides = {}, at = iso()) {
  const result = Core.startSession(state, {
    id: 'session_1',
    policyId: 'site_tiktok',
    purpose: 'publish',
    minutes: 12,
    expectedOutcome: 'published',
    ...overrides,
  }, at);
  assert.equal(result.ok, true);
  return result;
}

test('host validation is narrow and keeps Satoru itself un-blockable', () => {
  assert.equal(Core.normalizeHostname('TikTok.com'), 'tiktok.com');
  assert.equal(Core.normalizeHostname('https://www.youtube.com/watch?v=x'), 'www.youtube.com');
  for (const bad of [
    '', 'localhost', '127.0.0.1', 'com', 'https://user:pass@example.com',
    'chrome://extensions', 'life-rpg-production-416a.up.railway.app', '*.example.com',
  ]) assert.equal(Core.normalizeHostname(bad), null, bad);
  assert.deepEqual(Core.hostPatterns('example.com'), ['*://example.com/*']);
});

test('normalization drops unknown browsing detail and duplicate hosts', () => {
  const rawPolicy = policy({ url: 'https://tiktok.com/private', query: 'secret', watched: ['x'] });
  const state = Core.normalizeState({
    version: 1,
    policies: [rawPolicy, { ...rawPolicy, id: 'duplicate' }],
    activeSession: null,
    episodes: [{
      id: 'episode_1', policyId: 'site_tiktok', appKey: 'tiktok', purpose: 'publish',
      startedAt: iso(), endedAt: iso(12), outcome: 'done', url: 'https://example.com/a', query: 'private',
    }],
  });
  assert.equal(state.policies.length, 1);
  assert.equal('url' in state.policies[0], false);
  assert.equal('query' in state.policies[0], false);
  assert.equal('watched' in state.policies[0], false);
  assert.equal('url' in state.episodes[0], false);
  assert.equal('query' in state.episodes[0], false);
});

test('a work session needs an explicit purpose, bounded time and outcome', () => {
  const state = stateWithPolicy();
  assert.equal(Core.canStart(state, { policyId: 'site_tiktok', purpose: 'watch', minutes: 12 }).error, 'purpose_unavailable');
  assert.equal(Core.canStart(state, { policyId: 'site_tiktok', purpose: 'publish', minutes: 18, expectedOutcome: 'x' }).error, 'duration_invalid');

  const noDefault = stateWithPolicy({ purposes: [{ purpose: 'publish', mode: 'adaptive', defaultMinutes: 12, maxMinutes: 17 }] });
  assert.equal(Core.canStart(noDefault, { policyId: 'site_tiktok', purpose: 'publish', minutes: 12 }).error, 'outcome_required');
  assert.equal(Core.canStart(state, { policyId: 'site_tiktok', purpose: 'publish', minutes: 12, expectedOutcome: 'published' }).ok, true);
});

test('saving a second purpose for one host preserves the first rule', () => {
  const first = stateWithPolicy();
  const second = Core.upsertPolicy(first, policy({
    purposes: [{
      purpose: 'research', mode: 'control', defaultMinutes: 10, maxMinutes: 10,
      expectedOutcome: 'three references', requiresTopic: true,
    }],
  }));
  assert.equal(second.ok, true);
  assert.deepEqual(second.policy.purposes.map((rule) => rule.purpose), ['publish', 'research']);
  assert.equal(second.policy.purposes[0].defaultMinutes, 12);
  assert.equal(second.policy.purposes[1].defaultMinutes, 10);
});

test('research needs a topic and control never opens with unsure purpose', () => {
  const research = stateWithPolicy({ purposes: [{ purpose: 'research', mode: 'control', defaultMinutes: 10, maxMinutes: 10, expectedOutcome: 'three references' }] });
  assert.equal(Core.canStart(research, { policyId: 'site_tiktok', purpose: 'research', minutes: 10 }).error, 'topic_required');
  assert.equal(Core.canStart(research, { policyId: 'site_tiktok', purpose: 'research', minutes: 10, topic: 'cuts' }).ok, true);

  const unsure = stateWithPolicy({ purposes: [{ purpose: 'unsure', mode: 'control', defaultMinutes: 5, maxMinutes: 5 }] });
  assert.equal(Core.canStart(unsure, { policyId: 'site_tiktok', purpose: 'unsure', minutes: 5 }).error, 'unsure_in_control');
});

test('only the configured site is allowed during its live session', () => {
  const opened = start();
  assert.equal(Core.accessDecision(opened.state, 'https://www.tiktok.com/feed', iso(1)).allowed, true);
  assert.equal(Core.accessDecision(opened.state, 'https://tiktok.com/feed', iso(12)).allowed, false);
  assert.equal(Core.accessDecision(opened.state, 'https://example.com/', iso(1)).reason, 'unmanaged');
  assert.equal(Core.startSession(opened.state, { id: 'two' }, iso(1)).error, 'session_open');
});

test('adaptive has exactly one bounded extension; control has none', () => {
  const opened = start();
  assert.equal(Core.extendSession(opened.state, iso(11)).error, 'boundary_not_reached');
  const extended = Core.extendSession(opened.state, iso(12));
  assert.equal(extended.ok, true);
  assert.equal(extended.session.deadlineAt, iso(17));
  assert.equal(Core.extendSession(extended.state, iso(17)).error, 'extension_unavailable');

  const controlState = stateWithPolicy({
    purposes: [{ purpose: 'publish', mode: 'control', defaultMinutes: 12, maxMinutes: 20, extensionsAllowed: 1, expectedOutcome: 'published' }],
  });
  const control = start(controlState);
  assert.equal(control.session.extensionsAllowed, 0);
  assert.equal(Core.extendSession(control.state, iso(12)).error, 'extension_unavailable');
});

test('control emergency is available during the contract and requires the full delay plus a reason', () => {
  const controlState = stateWithPolicy({
    purposes: [{ purpose: 'publish', mode: 'control', defaultMinutes: 12, maxMinutes: 12, expectedOutcome: 'published' }],
  });
  const opened = start(controlState);
  const requested = Core.requestEmergency(opened.state, iso(1));
  assert.equal(requested.ok, true);
  const early = Core.closeSession(opened.state, 'done', iso(1));
  assert.equal(early.ok, true, 'finishing early tightens the boundary and must remain possible in Control');
  assert.equal(Core.emergencyStatus(requested.state, iso(2)).remainingMs, 30_000);
  assert.equal(Core.grantEmergency(requested.state, 'call', iso(2)).error, 'emergency_delay');
  assert.equal(Core.grantEmergency(requested.state, '', iso(2, 30)).error, 'reason_required');
  const granted = Core.grantEmergency(requested.state, 'urgent call', iso(2, 30));
  assert.equal(granted.ok, true);
  assert.equal(granted.session.startedAt, iso(2, 30));
  assert.equal(granted.session.deadlineAt, iso(7, 30));
  assert.equal(granted.session.emergencyUsed, true);
  assert.equal(granted.session.emergencyAccess, true);
  assert.equal(granted.closedEpisode.id, 'session_1');
  assert.equal(granted.closedEpisode.outcome, 'unknown');
  assert.equal(granted.state.episodes.length, 1, 'the original contract is closed honestly before emergency access');
});

test('emergency budget is one pass per seven days across sessions and survives restart normalization', () => {
  const controlState = stateWithPolicy({
    purposes: [{ purpose: 'publish', mode: 'control', defaultMinutes: 12, maxMinutes: 12, expectedOutcome: 'published' }],
  });
  let first = start(controlState);
  first = Core.requestEmergency(first.state, iso(1));
  const granted = Core.grantEmergency(first.state, 'urgent call', iso(2, 30));
  const closed = Core.closeSession(granted.state, 'unknown', iso(14));
  const restarted = Core.normalizeState(JSON.parse(JSON.stringify(closed.state)));
  const second = start(restarted, { id: 'session_2' }, iso(60));
  assert.equal(Core.requestEmergency(second.state, iso(72)).error, 'emergency_budget_spent');
});

test('restart recovery preserves an active snapshot and an expired window stays blocked', () => {
  const opened = start();
  const restored = Core.normalizeState(JSON.parse(JSON.stringify(opened.state)));
  assert.equal(restored.activeSession.deadlineAt, iso(12));
  assert.equal(Core.accessDecision(restored, 'https://tiktok.com/', iso(11)).allowed, true);
  assert.equal(Core.accessDecision(restored, 'https://tiktok.com/', iso(13)).reason, 'boundary');
});

test('malformed storage normalizes to an inert fail-open state', () => {
  for (const malformed of [null, [], 'broken', { policies: 'wrong' }, { activeSession: { deadlineAt: 'never' } }]) {
    const state = Core.normalizeState(malformed);
    assert.deepEqual(state.policies, []);
    assert.equal(state.activeSession, null);
    assert.equal(Core.accessDecision(state, 'https://example.com/', iso()).reason, 'unmanaged');
  }
});

test('normalization quarantines an active session whose policy is missing or mismatched', () => {
  const opened = start();
  assert.equal(Core.normalizeState({ ...opened.state, policies: [] }).activeSession, null);
  const mismatched = {
    ...opened.state,
    activeSession: { ...opened.state.activeSession, hostname: 'example.com' },
  };
  assert.equal(Core.normalizeState(mismatched).activeSession, null);
});

test('clock rollback cannot reopen or prolong a managed site', () => {
  const opened = start();
  const observedLater = Core.touchClock(opened.state, iso(8));
  const rolledBack = new Date(T0 + 60_000).toISOString();
  assert.equal(Core.clockRolledBack(observedLater, rolledBack), true);
  assert.equal(Core.accessDecision(observedLater, 'https://tiktok.com/', rolledBack).reason, 'clock_rollback');
  assert.equal(Core.extendSession(observedLater, rolledBack).error, 'clock_rollback');
});

test('active control policy cannot be paused or rewritten through extension UI', () => {
  const controlState = stateWithPolicy({
    purposes: [{ purpose: 'publish', mode: 'control', defaultMinutes: 12, maxMinutes: 12, expectedOutcome: 'published' }],
  });
  const opened = start(controlState);
  assert.equal(Core.canEditPolicy(opened.state, 'site_tiktok'), false);
  assert.equal(Core.setPolicyEnabled(opened.state, 'site_tiktok', false).error, 'control_locked');
  assert.equal(Core.upsertPolicy(opened.state, policy({ label: 'Renamed' })).error, 'control_locked');
});

test('closing is neutral, local and never infers escaped from silence', () => {
  const opened = start();
  const closed = Core.closeSession(opened.state, 'anything-else', iso(30));
  assert.equal(closed.ok, true);
  assert.equal(closed.episode.outcome, 'unknown');
  assert.equal('expectedOutcome' in closed.episode, false);
  assert.equal('url' in closed.episode, false);
  assert.equal(closed.state.activeSession, null);
});

test('daily site budget, entry count and cooldown apply across different purposes', () => {
  const multi = stateWithPolicy({
    dailyBudgetMinutes: 20,
    maxSessionsPerDay: 2,
    cooldownMinutes: 10,
    purposes: [
      { purpose: 'publish', mode: 'control', defaultMinutes: 12, maxMinutes: 12, expectedOutcome: 'published' },
      { purpose: 'research', mode: 'control', defaultMinutes: 8, maxMinutes: 8, expectedOutcome: 'references', requiresTopic: true },
    ],
  });
  const first = start(multi);
  const closed = Core.closeSession(first.state, 'done', iso(4));
  assert.equal(Core.canStart(closed.state, {
    policyId: 'site_tiktok', purpose: 'research', minutes: 8, expectedOutcome: 'references', topic: 'lighting',
  }, iso(5)).error, 'cooldown_active');
  const second = Core.startSession(closed.state, {
    id: 'session_2', policyId: 'site_tiktok', purpose: 'research', minutes: 8,
    expectedOutcome: 'references', topic: 'lighting',
  }, iso(14));
  assert.equal(second.ok, true);
  const secondClosed = Core.closeSession(second.state, 'unfinished', iso(18));
  const quota = Core.quotaStatus(secondClosed.state, 'site_tiktok', iso(19));
  assert.equal(quota.sessionsUsed, 2);
  assert.equal(quota.remainingMinutes, 0);
  assert.equal(Core.canStart(secondClosed.state, {
    policyId: 'site_tiktok', purpose: 'publish', minutes: 1, expectedOutcome: 'x',
  }, iso(30)).error, 'daily_sessions_spent');
});

test('a concrete entry can be required without leaking it into the episode', () => {
  const guarded = stateWithPolicy({ purposes: [{
    purpose: 'publish', mode: 'control', defaultMinutes: 12, maxMinutes: 12,
    expectedOutcome: 'published', requiresDetail: true,
  }] });
  assert.equal(Core.canStart(guarded, {
    policyId: 'site_tiktok', purpose: 'publish', minutes: 12, expectedOutcome: 'published',
  }, iso()).error, 'detail_required');
  const opened = Core.startSession(guarded, {
    id: 'detail_session', policyId: 'site_tiktok', purpose: 'publish', minutes: 12,
    expectedOutcome: 'published', detail: 'Attention demo',
  }, iso());
  assert.equal(opened.session.detail, 'Attention demo');
  const closed = Core.closeSession(opened.state, 'done', iso(4));
  assert.equal('detail' in closed.episode, false);
});

test('Control loosening waits until the scheduled next day while tightening is immediate', () => {
  const original = stateWithPolicy();
  const looserDraft = policy({
    dailyBudgetMinutes: 80,
    purposes: [{ purpose: 'publish', mode: 'trust', defaultMinutes: 20, maxMinutes: 25, extensionsAllowed: 1, extensionMinutes: 5, expectedOutcome: 'published' }],
  });
  const queued = Core.upsertPolicy(original, looserDraft, {
    replacePurposes: true,
    deferLoosening: true,
    activatesAt: iso(24 * 60),
  });
  assert.equal(queued.pending, true);
  assert.equal(Core.policyById(queued.state, 'site_tiktok').dailyBudgetMinutes, 50);
  assert.equal(Core.activatePendingPolicies(queued.state, iso(23 * 60)).changed, false);
  const activated = Core.activatePendingPolicies(queued.state, iso(24 * 60));
  assert.equal(activated.changed, true);
  assert.equal(Core.policyById(activated.state, 'site_tiktok').dailyBudgetMinutes, 80);

  const tighter = Core.upsertPolicy(activated.state, policy({ dailyBudgetMinutes: 30 }), {
    replacePurposes: true,
    deferLoosening: true,
    activatesAt: iso(48 * 60),
  });
  assert.equal(tighter.pending, false);
  assert.equal(Core.policyById(tighter.state, 'site_tiktok').dailyBudgetMinutes, 30);
});

test('strict Satoru links only accept known actions and app identifiers', () => {
  assert.equal(Core.satoruDeepLink('destroy', 'tiktok'), null);
  assert.equal(Core.satoruDeepLink('gate', 'profile-x'), null);
  assert.equal(
    Core.satoruDeepLink('return', 'youtube'),
    'https://life-rpg-production-416a.up.railway.app/?do=return&app=youtube&source=extension',
  );
});

test('public bridge status reveals no policy, purpose, host or outcome', () => {
  const opened = start();
  const status = Core.publicStatus(opened.state, iso(1));
  assert.deepEqual(Object.keys(status).sort(), ['active', 'configuredSites', 'installed', 'version']);
  assert.deepEqual(Object.keys(status.active).sort(), ['app', 'mode', 'phase', 'remainingSeconds']);
  assert.equal(JSON.stringify(status).includes('hostname'), false);
  assert.equal(JSON.stringify(status).includes('expectedOutcome'), false);
});

test('the pure API exposes no destructive, account, reward or remote operation', () => {
  const surface = Object.keys(Core).join(' ').toLowerCase();
  for (const forbidden of [
    'delete', 'destroy', 'account', 'profile', 'admin', 'remote', 'sync', 'fetch',
    'xp', 'gold', 'reward', 'punish', 'penalty', 'streak',
  ]) assert.equal(surface.includes(forbidden), false, forbidden);
});
