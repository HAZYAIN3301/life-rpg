'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Board = require('../public/board-v2.js');
const Catalog = require('../public/board-v2-wildcard-catalog.js');
const Pacing = require('../public/board-v2-pacing.js');
const Offers = require('../public/board-v2-offers.js');
const Issuer = require('../public/board-v2-wildcard-issuer.js');

const DAY = '2026-08-25';
const full = {
  film: { enabled: true, filmingOptIn: true, theme: 'один звонок меняет маршрут', deadline: '27 августа, 19:00' },
  offline: { enabled: true, apps: 'TikTok и Instagram' },
  room: { enabled: true, room: 'рабочую комнату', goal: 'освободить место для тренировок', layout: 'стол к окну, диван к дальней стене', equipmentReady: true, safeContext: true },
};

test('only three owner-approved manual packs can resolve', () => {
  const quests = Issuer.resolvedInstances(Board, Catalog, full);
  assert.deepEqual(quests.map((quest) => quest.templateId).sort(), Issuer.SUPPORTED_TEMPLATE_IDS.slice().sort());
  assert.match(quests.find((quest) => quest.templateId.includes('film')).details, /27 августа, 19:00/);
  assert.match(quests.find((quest) => quest.templateId.includes('social')).title, /TikTok и Instagram/);
  assert.match(quests.find((quest) => quest.templateId.includes('room')).details, /освободить место/);
});

test('partial, unsafe and non-consensual packs fail closed instead of becoming vague quests', () => {
  assert.deepEqual(Issuer.resolvedInstances(Board, Catalog, {
    film: { enabled: true, theme: 'ночной город', deadline: 'завтра' },
    offline: { enabled: true, apps: '' },
    room: { enabled: true, room: 'комнату', goal: 'больше воздуха', layout: 'стол к окну', equipmentReady: true },
  }), []);
  assert.equal(Issuer.normalizeSetup({ offline: { enabled: true, apps: '<script>' } }).offline.apps, '');
});

test('manual request picks one exact snapshot, persists pacing and cannot be forged', () => {
  const state = Offers.emptyState(Pacing);
  const issue = Issuer.issueManual(Board, Catalog, Offers, Pacing, {}, state, full, { day: DAY, seed: 'account-42' });
  assert.equal(issue.ok, true); assert.equal(issue.mode, 'manual-unexpected');
  const result = Issuer.result(issue);
  assert.equal(result.nextOffers.snapshots.length, 1);
  assert.equal(result.nextOffers.history.at(-1).outcome, 'displayed');
  assert.equal(result.nextOffers.pacing.offers.at(-1).mode, 'manual-unexpected');
  assert.equal(Issuer.result({ ...issue }), null);
});

test('rejection cooldown remains authoritative for another manual request', () => {
  const first = Issuer.issueManual(Board, Catalog, Offers, Pacing, {}, Offers.emptyState(Pacing), {
    offline: full.offline,
  }, { day: DAY, seed: 'same' });
  const displayed = Issuer.result(first).nextOffers;
  const rejected = Offers.recordOutcome(displayed, first.primary.id, 'rejected', DAY, Pacing);
  const second = Issuer.issueManual(Board, Catalog, Offers, Pacing, {}, rejected, {
    offline: full.offline,
  }, { day: '2026-09-10', seed: 'same' });
  assert.equal(second.ok, false); assert.equal(second.reason, 'no-eligible-quest');
});

test('issuer is pure and owns no discovery or persistence capability', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'board-v2-wildcard-issuer.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:window|document|navigator|geolocation|State|Store|localStorage)\b/);
  assert.doesNotMatch(code, /fetch\s*\(/);
});
