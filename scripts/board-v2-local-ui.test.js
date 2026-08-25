'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const UI = require('../public/board-v2-local-ui.js');

const ROOT = path.resolve(__dirname, '..');
function status(overrides) {
  return Object.assign({
    schema: UI.STATUS_SCHEMA,
    consent: { enabled: true, city: 'Bielefeld', countryCode: 'DE', provider: 'brave-web-v1', shareCityWithProvider: true },
    providerAvailable: true,
    options: [{ id: 'trial-class', label: 'Пробное занятие', description: 'Конкретное время и запись.',
      templateId: 'try-specific-local-class', slotId: 'class', interests: [{ id: 'boxing', label: 'Бокс' }] }],
    cache: { freshCandidates: 0 }, billing: { searches: 1, limit: 10 },
  }, overrides || {});
}

test('status and consent normalize without GPS or free query fields', () => {
  const normalized = UI.normalizeStatus(status({ latitude: 52.03, query: 'diary' }));
  assert.equal(normalized.consent.city, 'Bielefeld');
  assert.doesNotMatch(JSON.stringify(normalized), /latitude|52\.03|query|diary/);
  assert.deepEqual(UI.consentPayload({
    accepted: true, providerConfirmed: true, city: ' Bielefeld ', countryCode: 'de', timezone: 'Europe/Berlin', locale: 'de-DE', latitude: 1,
  }), { enabled: true, city: 'Bielefeld', countryCode: 'DE', timezone: 'Europe/Berlin', locale: 'de-DE',
    provider: 'brave-web-v1', shareCityWithProvider: true });
  assert.equal(UI.consentPayload({ accepted: false, city: 'Bielefeld', countryCode: 'DE', timezone: 'Europe/Berlin', locale: 'de-DE' }), null);
  assert.equal(UI.consentPayload({ accepted: true, providerConfirmed: true, city: 'Reykjavík', countryCode: 'IS', timezone: 'UTC', locale: 'en-US' }).timezone, 'UTC');
});

test('resolve body can only be selected from server-owned option and interest', () => {
  assert.deepEqual(UI.resolvePayload(status(), { optionId: 'trial-class', interestId: 'boxing', query: 'attack' }), {
    templateId: 'try-specific-local-class', slotId: 'class', interestId: 'boxing',
  });
  assert.equal(UI.resolvePayload(status(), { optionId: 'trial-class', interestId: 'invented' }), null);
  assert.equal(UI.resolvePayload(status({ providerAvailable: false }), { optionId: 'trial-class', interestId: 'boxing' }), null);
});

test('feedback targets only canonical local snapshots and completed task history', () => {
  const snapshot = {
    schema: 'satoru.board-offer-snapshot/2', id: 'local@1.a', mode: 'manual-local', tags: ['local'],
    primaryAction: { url: 'https://venue.example/class' },
  };
  const offers = { snapshots: [snapshot], history: [{ snapshotId: snapshot.id, outcome: 'displayed' }] };
  assert.deepEqual(UI.feedbackTarget(offers, []), { snapshotId: snapshot.id, completed: false });
  offers.history.push({ snapshotId: snapshot.id, outcome: 'completed' });
  assert.equal(UI.feedbackTarget(offers, []), null);
  assert.deepEqual(UI.feedbackTarget(offers, [{ done: true, fromBoardV2: true, boardSnapshotId: snapshot.id }]), {
    snapshotId: snapshot.id, completed: true,
  });
});

test('community copy is structured, bounded and k-anonymous', () => {
  assert.deepEqual(UI.normalizeCommunity({ ok: true, summary: null, canMark: true, alreadyMarked: false }), {
    summary: null, canMark: true, alreadyMarked: false,
  });
  assert.equal(UI.normalizeCommunity({ ok: true, summary: { reports: 2, status: 'recently-matched' } }), null);
  assert.equal(UI.summaryMessage({ reports: 4, status: 'details-may-have-changed' }), '4 человек проверили место; часть деталей могла измениться.');
});

test('module is pure and cannot access search/network/browser state', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public/board-v2-local-ui.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:window|document|localStorage|sessionStorage|State|Store|fetch|geolocation)\b/);
});
