'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/attention-controller-v1.js');
const P = require('../public/attention-policy-v1.js');
const S = require('../public/attention-session-v1.js');
const E = require('../public/attention-episode-v1.js');

const NOW = '2026-08-25T10:00:00.000Z';

test('strict validators reject corrupt rows and duplicate ids instead of normalizing to empty', () => {
  assert.equal(C.validatePolicies(P.emptyState()), true);
  assert.equal(C.validateSessions(S.emptyState()), true);
  assert.equal(C.validateEpisodes(E.emptyState()), true);
  assert.equal(C.validatePolicies({ version: 1, policies: [{}] }), false);
  assert.equal(C.validateSessions({ version: 1, sessions: [{ id: 'x' }, { id: 'x' }] }), false);
  assert.equal(C.validateEpisodes({ version: 1, episodes: 'bad' }), false);
});

test('one checked envelope preserves local-only consent and rejects unknown sync modes', () => {
  const empty = C.emptyBundle();
  const local = C.toEnvelope({ ...empty, mode: 'local' });
  assert.deepEqual(local, { version: 1, mode: 'local', policies: [], sessions: [], episodes: [] });
  assert.equal(C.validateEnvelope(local), true);
  assert.equal(C.validateEnvelope({ ...local, mode: 'aggregates' }), false, 'R1 must not promise aggregate sync before the server projects aggregates');
  assert.equal(C.validateEnvelope({ ...local, policies: [{}] }), false);
  const split = C.fromEnvelope(local);
  assert.equal(split.mode, 'local');
  assert.deepEqual(split.policies, empty.policies);
});

test('setup creates one canonical purpose without trusting a freeform purpose id', () => {
  const good = C.upsertPolicy(P.emptyState(), {
    targetLabel: 'TikTok', purpose: 'publish', minutes: 12, mode: 'control', outcome: 'ролик опубликован',
  }, 'tiktok');
  assert.equal(good.ok, true);
  const policy = P.policyById(good.state, 'tiktok');
  assert.equal(policy.purposes.length, 1);
  assert.equal(policy.purposes[0].extensions, 0);
  assert.equal(policy.sync, false);
  assert.equal(C.upsertPolicy(P.emptyState(), { targetLabel: 'TikTok', purpose: 'scroll', minutes: 10 }, 'tt').error, 'invalid');
});

test('work setup and start require a concrete outcome; research also requires a topic', () => {
  assert.equal(C.upsertPolicy(P.emptyState(), { targetLabel: 'TikTok', purpose: 'publish', minutes: 10 }, 'tt').error, 'outcome_required');
  const made = C.upsertPolicy(P.emptyState(), {
    targetLabel: 'TikTok', purpose: 'research', minutes: 10, mode: 'control', outcome: 'до трёх референсов',
  }, 'tt');
  const bundle = { ...C.emptyBundle(), policies: made.state };
  assert.equal(C.startSession(bundle, { id: 's1', policyId: 'tt', purpose: 'research' }, NOW).error, 'topic_required');
  assert.equal(C.startSession(bundle, { id: 's1', policyId: 'tt', purpose: 'research', topic: 'монтажные переходы' }, NOW).ok, true);
});

test('close returns both complete states and retry overwrites the same episode id', () => {
  const made = C.upsertPolicy(P.emptyState(), {
    targetLabel: 'YouTube', purpose: 'watch', minutes: 20, mode: 'adaptive', outcome: 'одна заметка',
  }, 'yt');
  let bundle = { ...C.emptyBundle(), policies: made.state };
  const started = C.startSession(bundle, { id: 's1', policyId: 'yt', purpose: 'watch' }, NOW);
  bundle = { ...bundle, sessions: started.sessions };
  const closed = C.closeSession(bundle, 's1', 'escaped', '2026-08-25T10:25:00.000Z', 'shortcut');
  assert.equal(closed.ok, true);
  assert.equal(S.byId(closed.sessions, 's1').outcome, 'escaped');
  assert.equal(E.byId(closed.episodes, 's1').source, 'shortcut');
  assert.equal(E.normalize(closed.episodes).episodes.length, 1);
});

test('controller exposes honest calibration only after the engine threshold', () => {
  let episodes = E.emptyState();
  for (let i = 0; i < 5; i++) {
    episodes = E.record(episodes, {
      id: `e${i}`, sourcePolicyId: 'tt', declaredPurpose: 'research', startedAt: `2026-08-${20 + i}T10:00:00.000Z`,
      outcome: i < 4 ? 'escaped' : 'done',
    }).state;
  }
  assert.deepEqual(C.calibrationFor(episodes, 'tt', 'research', NOW), { recorded: 5, started: 5, outsidePlan: 4 });
  assert.equal(C.calibrationFor(E.emptyState(), 'tt', 'research', NOW), null);
});

test('no controller API can mutate rewards or apply policy suggestions', () => {
  const surface = Object.keys(C).join(' ').toLowerCase();
  for (const forbidden of ['xp', 'gold', 'reward', 'tighten', 'autoapply']) assert.equal(surface.includes(forbidden), false);
});
