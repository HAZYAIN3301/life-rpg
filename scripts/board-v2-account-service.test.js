'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const BoardDiscovery = require('../public/board-v2-discovery.js');
const Registry = require('../server-board-v2-registry-v1.js');
const Service = require('../server-board-v2-service-v1.js');

const NOW = '2026-08-25T14:00:00.000Z';

function verifiedRecommendation(consent, spec) {
  const request = BoardDiscovery.createRequest(consent, spec);
  const checkedAt = NOW;
  const raw = {
    candidateId: 'uni-bielefeld-boxing', title: 'Boxtraining Anfänger',
    address: 'Universitätsstraße 25, 33615 Bielefeld', startsAt: '2026-08-26T17:30:00.000Z',
    price: { type: 'fixed', amount: 5, currency: 'EUR', label: '5 EUR' },
    availability: 'confirmed', action: { label: 'Открыть', url: 'https://hsp.sport.uni-bielefeld.de/boxing' },
    relevance: 0.9, checkedAt,
    sources: [{ kind: 'organizer', url: 'https://hsp.sport.uni-bielefeld.de/boxing', fields: ['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'], checkedAt }],
  };
  return BoardDiscovery.recommend(request, [BoardDiscovery.verifyCandidate(request, raw)], checkedAt).recommendation;
}

function memoryService(options) {
  const rows = new Map();
  let calls = 0;
  const adapter = {
    available: true,
    async resolve(consent, spec) {
      calls += 1;
      return {
        ok: true,
        recommendation: verifiedRecommendation(consent, spec),
        billing: { searchRequests: 1, estimatedUsd: 0.005 },
        audit: { provider: 'brave-web-v1', rawProviderPayloadStored: false },
      };
    },
  };
  const service = Service.createService({
    adapter,
    clock: () => NOW,
    dailyLimit: options && options.dailyLimit,
    readAccount: (uid) => rows.get(uid) || null,
    writeAccount: (uid, value) => rows.set(uid, structuredClone(value)),
  });
  return { service, rows, calls: () => calls };
}

function grant(service, uid, city) {
  return service.setConsent(uid, {
    enabled: true, city: city || 'Bielefeld', countryCode: 'DE', timezone: 'Europe/Berlin', locale: 'de-DE',
    provider: BoardDiscovery.PROVIDER_ID, shareCityWithProvider: true,
    latitude: 52.03, longitude: 8.53, address: 'private home',
  });
}

test('registry enumerates all approved catalogs but resolves only known local slots', () => {
  assert.equal(Registry.entryById('try-specific-local-class').template.id, 'try-specific-local-class');
  assert.equal(Registry.entryById('zugspitze-guided-ascent').template.id, 'zugspitze-guided-ascent');
  assert.deepEqual(Registry.localSlots('try-specific-local-class'), [{ id: 'class', type: 'local-class', intent: 'class' }]);
  assert.throws(() => Registry.createSpec({ templateId: 'write-letter-to-future-self', slotId: 'date' }, 'request-1'), /unknown-local-slot/);
  assert.throws(() => Registry.createSpec({ templateId: 'made-up', slotId: 'class' }, 'request-1'), /unknown-board-template/);
  const options = Registry.publicOptions();
  assert.equal(options.length, 4);
  assert.deepEqual(options.map((item) => item.id), ['trial-class', 'another-gym', 'exhibition', 'open-lecture']);
  assert.equal(options.every((item) => item.interests.length > 0), true);
  options[0].label = 'attacker';
  assert.equal(Registry.PUBLIC_OPTIONS[0].label, 'Пробное занятие');
});

test('client cannot submit query, URL, GPS, arbitrary text or foreign identity', () => {
  for (const key of ['query', 'url', 'searchTerms', 'freeText', 'latitude', 'longitude', 'userId']) {
    assert.throws(() => Registry.createSpec({ templateId: 'try-specific-local-class', slotId: 'class', [key]: 'attack' }, 'request-1'), /unsupported-resolve-field/);
  }
  const spec = Registry.createSpec({ templateId: 'try-specific-local-class', slotId: 'class', interestId: 'boxing' }, 'request-1');
  assert.deepEqual(spec.searchTerms, ['trial-class', 'try-class', 'sport', 'boxing']);
  assert.doesNotMatch(JSON.stringify(spec), /attack|userId|latitude|longitude/);
  assert.throws(() => Registry.createSpec({ templateId: 'cook-new-dish', slotId: 'dish', interestId: 'boxing' }, 'request-1'), /unknown-local-slot/);
  assert.equal(Registry.createSpec({ templateId: 'try-specific-local-class', slotId: 'class', interestId: 'yoga' }, 'request-2').searchTerms.includes('yoga'), true);
});

test('city consent is account-owned and strips GPS/home address', async () => {
  const { service, rows } = memoryService();
  await grant(service, 'alpha');
  await grant(service, 'beta', 'Berlin');
  assert.equal(service.status('alpha').consent.city, 'Bielefeld');
  assert.equal(service.status('beta').consent.city, 'Berlin');
  assert.equal(service.status('alpha').options.length, 4);
  const serialized = JSON.stringify(rows.get('alpha'));
  assert.doesNotMatch(serialized, /52\.03|8\.53|private home|latitude|longitude|address/);
});

test('first resolve spends once, second resolve uses account cache', async () => {
  const { service, calls } = memoryService();
  await grant(service, 'alpha');
  const input = { templateId: 'try-specific-local-class', slotId: 'class', interestId: 'boxing' };
  const first = await service.resolve('alpha', input);
  assert.equal(first.ok, true); assert.equal(first.source, 'live-direct-verification');
  const second = await service.resolve('alpha', input);
  assert.equal(second.ok, true); assert.equal(second.source, 'account-cache');
  assert.equal(second.billing.searchRequests, 0);
  assert.equal(calls(), 1);
  assert.equal(service.status('alpha').billing.searches, 1);
});

test('changing an approved interest cannot reuse another interest cache', async () => {
  const { service, calls } = memoryService();
  await grant(service, 'alpha');
  await service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class', interestId: 'boxing' });
  const next = await service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class', interestId: 'bouldering' });
  assert.equal(next.source, 'live-direct-verification');
  assert.equal(calls(), 2);
});

test('parallel tabs serialize and cannot double-spend an empty cache', async () => {
  const { service, calls } = memoryService();
  await grant(service, 'alpha');
  const input = { templateId: 'try-specific-local-class', slotId: 'class' };
  const [left, right] = await Promise.all([service.resolve('alpha', input), service.resolve('alpha', input)]);
  assert.equal(left.ok && right.ok, true);
  assert.deepEqual([left.source, right.source], ['live-direct-verification', 'account-cache']);
  assert.equal(calls(), 1);
});

test('revoking or changing city clears cache and blocks discovery', async () => {
  const { service, rows, calls } = memoryService();
  await grant(service, 'alpha');
  await service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class' });
  await service.setConsent('alpha', { enabled: false });
  assert.equal(rows.get('alpha').cache.entries.length, 0);
  assert.deepEqual(await service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class' }), { ok: false, reason: 'city-consent-required' });
  await grant(service, 'alpha', 'Berlin');
  await service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class' });
  assert.equal(calls(), 2);
});

test('daily cost cap is reserved before provider calls', async () => {
  const { service, rows, calls } = memoryService({ dailyLimit: 1 });
  await grant(service, 'alpha');
  rows.get('alpha').cache = { schema: BoardDiscovery.CACHE_SCHEMA, createdAt: NOW, entries: [] };
  const first = await service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class' });
  assert.equal(first.ok, true);
  rows.get('alpha').cache = { schema: BoardDiscovery.CACHE_SCHEMA, createdAt: NOW, entries: [] };
  assert.deepEqual(await service.resolve('alpha', { templateId: 'train-at-another-gym', slotId: 'gym' }), { ok: false, reason: 'daily-search-limit' });
  assert.equal(calls(), 1);
});

test('provider-disabled service persists consent but never reserves billing', async () => {
  const rows = new Map();
  const service = Service.createService({
    adapter: { available: false }, clock: () => NOW,
    readAccount: (uid) => rows.get(uid), writeAccount: (uid, value) => rows.set(uid, structuredClone(value)),
  });
  await grant(service, 'alpha');
  assert.deepEqual(await service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class' }), { ok: false, reason: 'provider-unavailable' });
  assert.equal(service.status('alpha').billing.searches, 0);
});

test('consent mutation waits for an active resolve and wins the final account state', async () => {
  const rows = new Map();
  let releaseProvider;
  const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
  const adapter = {
    available: true,
    async resolve(consent, spec) {
      await providerGate;
      return {
        ok: true,
        recommendation: verifiedRecommendation(consent, spec),
        billing: { searchRequests: 1, estimatedUsd: 0.005 },
        audit: { provider: 'brave-web-v1', rawProviderPayloadStored: false },
      };
    },
  };
  const service = Service.createService({
    adapter, clock: () => NOW,
    readAccount: (uid) => rows.get(uid), writeAccount: (uid, value) => rows.set(uid, structuredClone(value)),
  });
  await grant(service, 'alpha');
  const resolving = service.resolve('alpha', { templateId: 'try-specific-local-class', slotId: 'class' });
  await new Promise((resolve) => setImmediate(resolve));
  const revoking = service.setConsent('alpha', { enabled: false });
  releaseProvider();
  assert.equal((await resolving).ok, true);
  assert.equal((await revoking).consent.enabled, false);
  assert.equal(rows.get('alpha').consent.enabled, false);
  assert.equal(rows.get('alpha').cache.entries.length, 0);
});

test('corrupt account cache is bounded before hydration', () => {
  const source = {
    schema: Service.ACCOUNT_SCHEMA,
    consent: { enabled: false },
    cache: { schema: BoardDiscovery.CACHE_SCHEMA, createdAt: NOW, entries: Array.from({ length: 1000 }, () => ({})) },
  };
  assert.equal(Service.normalizeAccount(source, NOW).cache.entries.length, 2);
});
