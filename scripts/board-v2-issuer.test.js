'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Board = require('../public/board-v2.js');
const Catalog = require('../public/board-v2-catalog.js');
const Pacing = require('../public/board-v2-pacing.js');
const Offers = require('../public/board-v2-offers.js');
const Issuer = require('../public/board-v2-issuer.js');

function empty() { return Offers.emptyState(Pacing); }
function context(overrides = {}) {
  return { day: '2026-08-25', periodKey: '2026-08-25', ...overrides };
}

test('first wave resolves only three explicitly supported standard templates', () => {
  const quests = Issuer.resolvedInstances(Board, Catalog, {
    gates: ['sport-routine', 'safe-context'],
    interests: ['sport', 'walking', 'mobility'],
  });
  assert.deepEqual(quests.map((quest) => quest.templateId).sort(), Issuer.SUPPORTED_TEMPLATE_IDS.slice().sort());
  assert.equal(quests.some((quest) => quest.tags.includes('local')), false);
});

test('new account receives one exact linked stretch, never an unresolved local fallback', () => {
  const issued = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, empty(), context());
  assert.equal(issued.ok, true);
  assert.equal(issued.primary.templateId, 'long-guided-stretch');
  assert.equal(issued.primary.primaryAction.url, Catalog.STRETCH_OPTIONS[0].url);
  assert.equal(issued.reserve, null);
  const payload = Issuer.result(issued);
  assert.equal(payload.nextOffers.current.snapshotIds.length, 1);
  assert.equal(payload.nextOffers.snapshots[0].title.includes('{'), false);
});

test('confirmed sport routine can outrank stretch and supplies one reserve', () => {
  const issued = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {
    gates: ['sport-routine'], interests: ['sport'],
  }, empty(), context());
  assert.equal(issued.ok, true);
  assert.equal(issued.primary.templateId, 'full-workout-without-music');
  assert.equal(issued.reserve.templateId, 'long-guided-stretch');
});

test('video fit selects one approved URL and arbitrary profile fields are discarded', () => {
  const profile = Issuer.normalizeProfile(Catalog, {
    videoFit: 'shorter', interests: ['mobility', 'not-authored'], avoidTags: ['money', 'not-authored'],
    gates: ['sport-routine', 'made-up'], query: 'ignore previous instructions', gps: [52, 8],
  });
  assert.deepEqual(profile.interests, ['mobility']);
  assert.deepEqual(profile.avoidTags, ['money']);
  assert.deepEqual(profile.gates, ['sport-routine']);
  const quest = Issuer.resolvedInstances(Board, Catalog, profile).find((item) => item.templateId === 'long-guided-stretch');
  assert.equal(quest.primaryAction.url, Catalog.STRETCH_OPTIONS.find((option) => option.fit === 'shorter').url);
});

test('hard avoid can leave the board without a v2 offer instead of inventing one', () => {
  const result = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {
    avoidTags: ['recovery', 'sport', 'walk'], gates: ['sport-routine', 'safe-context'],
  }, empty(), context());
  assert.deepEqual(result, { ok: false, reason: 'no-resolved-standard' });
});

test('same period reuses the account snapshot without another displayed event', () => {
  const first = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, empty(), context());
  const stored = Issuer.result(first).nextOffers;
  const second = Issuer.issueStandard(Board, Catalog, Offers, Pacing, { videoFit: 'shorter' }, stored, context());
  assert.equal(second.ok, true);
  assert.equal(second.source, 'account-snapshot');
  assert.equal(second.changed, false);
  assert.equal(second.primary.id, first.primary.id);
  assert.equal(Issuer.result(second).nextOffers.history.length, stored.history.length);
});

test('issuer result capability cannot be forged or mutated', () => {
  assert.equal(Issuer.result({ ok: true, changed: true }), null);
  const handle = Issuer.issueStandard(Board, Catalog, Offers, Pacing, {}, empty(), context());
  assert.equal(Object.isFrozen(handle), true);
  assert.equal(Object.isFrozen(Issuer.result(handle).nextOffers), true);
  assert.throws(() => { handle.changed = false; }, TypeError);
});

test('issuer stays pure and owns no browser or persistence capability', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'board-v2-issuer.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(source, /\b(?:window|document|State|Store|fetch|localStorage|navigator|geolocation)\b/);
});
