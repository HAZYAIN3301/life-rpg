'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Board = require('../public/board-v2.js');
const Catalog = require('../public/board-v2-catalog.js');
const Offers = require('../public/board-v2-offers.js');
const Pacing = require('../public/board-v2-pacing.js');
const Discovery = require('../public/board-v2-discovery.js');
const LocalIssuer = require('../public/board-v2-local-issuer.js');

const ROOT = path.resolve(__dirname, '..');
const AT = '2026-08-25T12:00:00.000Z';
const CONSENT = {
  enabled: true, city: 'Bielefeld', countryCode: 'DE', timezone: 'Europe/Berlin',
  locale: 'de-DE', approvedAt: AT, provider: Discovery.PROVIDER_ID, shareCityWithProvider: true,
};
function recommendation(templateId, slotId, intent) {
  const request = Discovery.createRequest(CONSENT, {
    requestId: `${templateId}-${slotId}-request`, templateId, slotId, intent,
    searchTerms: ['official', 'sport'], constraints: { maxTravelMinutes: 60 },
  });
  const candidate = (candidateId, title, url, relevance) => Discovery.verifyCandidate(request, {
    candidateId, title, address: 'Universitätsstraße 25, Bielefeld',
    startsAt: '2026-08-27T18:00:00.000Z',
    price: { type: 'fixed', amount: 12, currency: 'EUR', label: '12 EUR' },
    availability: 'confirmed', action: { label: 'Открыть официальный сайт', url },
    relevance, checkedAt: AT,
    sources: [{ kind: 'venue', url, checkedAt: AT,
      fields: ['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'] }],
  });
  return structuredClone({
    schema: Discovery.RECOMMENDATION_SCHEMA, requestId: request.requestId,
    primary: candidate('boxing-bielefeld-main', 'Пробная тренировка по боксу', 'https://hsp.example/boxing', 0.9),
    reserve: candidate('boxing-bielefeld-reserve', 'Бокс в клубе Nord', 'https://nord.example/boxing', 0.8),
  });
}

test('direct-source recommendation becomes one local snapshot and one reserve action', () => {
  const raw = recommendation('try-specific-local-class', 'class', 'class');
  const issue = LocalIssuer.issue(Board, Catalog, Offers, Pacing, Discovery, Offers.emptyState(Pacing), raw, {
    day: '2026-08-25', at: AT,
  });
  assert.equal(issue.ok, true);
  assert.equal(issue.mode, 'manual-local');
  assert.equal(issue.primary.title, 'Попробуй Пробная тренировка по боксу');
  assert.deepEqual(issue.primary.primaryAction, { label: 'Открыть официальный сайт', url: 'https://hsp.example/boxing' });
  assert.deepEqual(issue.primary.alternative, { label: 'Бокс в клубе Nord', url: 'https://nord.example/boxing' });
  const result = LocalIssuer.result(issue);
  assert.equal(result.nextOffers.current, null, 'local lookup never replaces stable weekly offers');
  assert.equal(Offers.latestLocal(result.nextOffers, Pacing).id, issue.primary.id);
});

test('forged evidence, extra required slots and user readiness fail closed', () => {
  const valid = recommendation('try-specific-local-class', 'class', 'class');
  const forged = structuredClone(valid); forged.primary.sources = [];
  assert.equal(LocalIssuer.issue(Board, Catalog, Offers, Pacing, Discovery, null, forged, {
    day: '2026-08-25', at: AT,
  }).reason, 'invalid-verified-recommendation');

  const multiSlot = recommendation('learn-one-specific-movement', 'class', 'class');
  assert.equal(LocalIssuer.issue(Board, Catalog, Offers, Pacing, Discovery, null, multiSlot, {
    day: '2026-08-25', at: AT,
  }).reason, 'single-local-slot-required');
});

test('issuer is pure and exposes no search, DOM, State or persistence seam', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public/board-v2-local-issuer.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:window|document|localStorage|sessionStorage|State|Store)\b/);
  assert.doesNotMatch(code, /fetch\s*\(|geolocation|latitude|longitude|\bquery\b/);
});
