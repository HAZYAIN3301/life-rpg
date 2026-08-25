'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Discovery = require('../public/board-v2-discovery.js');

const ROOT = path.join(__dirname, '..');
const NOW = '2026-08-25T12:00:00.000Z';

function consent(overrides) {
  return Object.assign({
    enabled: true,
    city: 'Bielefeld',
    countryCode: 'DE',
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    approvedAt: '2026-08-25T10:00:00.000Z',
    latitude: 52.0302,
    longitude: 8.5325,
    exactAddress: 'private',
  }, overrides || {});
}

function request(overrides) {
  return Discovery.createRequest(consent(), Object.assign({
    requestId: 'request-climbing-01',
    templateId: 'try-local-class',
    slotId: 'class',
    intent: 'class',
    searchTerms: ['trial-class', 'bouldering'],
    interests: ['climbing', 'sport'],
    constraints: { maxTravelMinutes: 45, budgetTier: 'low' },
    freeText: 'do not retain this',
    latitude: 52.0302,
  }, overrides || {}));
}

function source(fields, overrides) {
  return Object.assign({
    kind: 'organizer',
    url: 'https://hochschulsport.example.test/bouldering',
    fields,
    checkedAt: NOW,
  }, overrides || {});
}

function candidate(intent, overrides, requestOverrides) {
  const req = request(Object.assign({ intent: intent || 'class' }, requestOverrides || {}));
  const required = intent === 'route'
    ? ['title', 'address', 'route', 'actionUrl', 'availability']
    : intent === 'place'
      ? ['title', 'address', 'actionUrl', 'availability']
      : ['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'];
  const raw = Object.assign({
    candidateId: `candidate-${intent || 'class'}-01`,
    title: 'Пробное занятие по боулдерингу',
    address: 'Universitätsstraße 25, Bielefeld',
    startsAt: '2026-08-26T17:30:00.000Z',
    price: { type: 'fixed', amount: 5, currency: 'EUR', label: '5 €' },
    route: { distanceKm: 14.78, difficulty: 'средняя' },
    availability: 'confirmed',
    action: { label: 'Записаться', url: 'https://hochschulsport.example.test/bouldering/book' },
    travelMinutes: 12,
    relevance: 0.9,
    checkedAt: NOW,
    sources: [source(required)],
    providerId: 'ephemeral-8-hour-id',
    providerSnippet: 'raw search output',
    latitude: 52.0302,
    longitude: 8.5325,
  }, overrides || {});
  return { req, verified: Discovery.verifyCandidate(req, raw) };
}

test('city-level consent хранит город, но выкидывает точные координаты и адрес', () => {
  const normalized = Discovery.normalizeConsent(consent());
  assert.deepEqual(normalized, {
    schema: Discovery.CONSENT_SCHEMA,
    enabled: true,
    city: 'Bielefeld',
    countryCode: 'DE',
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    approvedAt: '2026-08-25T10:00:00.000Z',
  });
  assert.equal('latitude' in normalized, false);
  assert.equal('exactAddress' in normalized, false);
});

test('без явного полноценного согласия локальный discovery выключен', () => {
  for (const raw of [{}, consent({ enabled: false }), consent({ city: '' }), consent({ approvedAt: '' })]) {
    assert.deepEqual(Discovery.normalizeConsent(raw), { schema: Discovery.CONSENT_SCHEMA, enabled: false });
  }
  assert.throws(() => Discovery.createRequest({}, {}), { code: 'city-consent-required' });
});

test('request содержит только authored tags и city-level context, не free text/GPS', () => {
  const req = request();
  assert.equal(req.provider, 'brave-web-v1');
  assert.deepEqual(req.searchTerms, ['trial-class', 'bouldering']);
  assert.equal('freeText' in req, false);
  assert.equal('latitude' in req, false);
  assert.equal('longitude' in req, false);
  assert.equal('exactAddress' in req, false);
  assert.equal(Object.isFrozen(req.constraints), true);
});

test('поисковый запрос обязан быть собран из authored terms, а не произвольной фразы', () => {
  assert.throws(() => request({ searchTerms: ['bouldering class near me'] }), {
    code: 'authored-search-terms-required',
  });
  assert.throws(() => request({ searchTerms: [] }), { code: 'authored-search-terms-required' });
});

test('provider result сам по себе не является доказательством', () => {
  const req = request();
  assert.throws(() => Discovery.verifyCandidate(req, {
    candidateId: 'aggregator-only',
    title: 'Bouldering',
    address: 'Bielefeld',
    startsAt: '2026-08-26T17:30:00.000Z',
    price: { type: 'fixed', amount: 5, currency: 'EUR', label: '5 €' },
    availability: 'confirmed',
    action: { label: 'Открыть', url: 'https://search.example.test/result' },
    checkedAt: NOW,
    sources: [source(['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'], {
      kind: 'aggregator', url: 'https://search.example.test/result',
    })],
  }), { code: 'direct-source-required' });
});

test('старый source нельзя выдать за только что перепроверенный', () => {
  const req = request();
  assert.throws(() => Discovery.verifyCandidate(req, {
    candidateId: 'stale-evidence', title: 'Bouldering', address: 'Bielefeld',
    startsAt: '2026-08-26T17:30:00.000Z',
    price: { type: 'free', label: 'Бесплатно' }, availability: 'confirmed',
    action: { label: 'Открыть', url: 'https://official.example.test/book' }, checkedAt: NOW,
    sources: [source(['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'], {
      checkedAt: '2026-08-24T12:00:00.000Z',
    })],
  }), { code: 'source-check-time-mismatch' });
});

test('class/event fail-closed без будущего времени, цены или подтверждённой доступности', () => {
  const req = request();
  const base = {
    candidateId: 'class-invalid', title: 'Занятие', address: 'Bielefeld',
    startsAt: '2026-08-26T17:30:00.000Z',
    price: { type: 'fixed', amount: 5, currency: 'EUR', label: '5 €' },
    availability: 'confirmed', action: { label: 'Записаться', url: 'https://official.example.test/book' },
    checkedAt: NOW,
    sources: [source(['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'], {
      url: 'https://official.example.test/book',
    })],
  };
  assert.throws(() => Discovery.verifyCandidate(req, Object.assign({}, base, { startsAt: NOW })), {
    code: 'future-start-required',
  });
  assert.throws(() => Discovery.verifyCandidate(req, Object.assign({}, base, { price: null })), {
    code: 'verified-price-required',
  });
  assert.throws(() => Discovery.verifyCandidate(req, Object.assign({}, base, { availability: 'maybe' })), {
    code: 'availability-not-confirmed',
  });
});

test('verified candidate не удерживает provider ID, snippet или координаты', () => {
  const { verified } = candidate('class');
  assert.equal(verified.provider, Discovery.PROVIDER_ID);
  assert.equal('providerId' in verified, false);
  assert.equal('providerSnippet' in verified, false);
  assert.equal('latitude' in verified, false);
  assert.equal('longitude' in verified, false);
  assert.deepEqual(verified.storage, {
    providerPayloadStored: false,
    providerSnippetStored: false,
    ephemeralProviderIdStored: false,
    exactCoordinatesStored: false,
  });
});

test('HTTPS source/action не принимают credentials, http, data или javascript', () => {
  for (const url of [
    'http://official.example.test',
    'https://user:pass@official.example.test',
    'data:text/html,bad',
    'javascript:alert(1)',
  ]) {
    const req = request();
    assert.throws(() => Discovery.verifyCandidate(req, {
      candidateId: 'bad-url', title: 'Занятие', address: 'Bielefeld',
      startsAt: '2026-08-26T17:30:00.000Z',
      price: { type: 'free', label: 'Бесплатно' }, availability: 'confirmed',
      action: { label: 'Открыть', url }, checkedAt: NOW,
      sources: [source(['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'])],
    }));
  }
});

test('TTL зависит от типа, а stale result больше не может стать квестом', () => {
  const localClass = candidate('class').verified;
  const place = candidate('place', { startsAt: null, price: null }).verified;
  const route = candidate('route', { startsAt: null, price: null }).verified;
  assert.equal(Date.parse(localClass.expiresAt) - Date.parse(NOW), Discovery.TTL_MS.class);
  assert.equal(Date.parse(place.expiresAt) - Date.parse(NOW), Discovery.TTL_MS.place);
  assert.equal(Date.parse(route.expiresAt) - Date.parse(NOW), Discovery.TTL_MS.route);
  assert.equal(Discovery.isFresh(localClass, '2026-08-25T23:59:59.000Z'), true);
  assert.equal(Discovery.isFresh(localClass, '2026-08-26T00:00:00.000Z'), false);
});

test('event expiry никогда не живёт дольше начала события', () => {
  const { verified } = candidate('event', { startsAt: '2026-08-25T14:00:00.000Z' });
  assert.equal(verified.expiresAt, '2026-08-25T14:00:00.000Z');
  assert.equal(Discovery.isFresh(verified, verified.expiresAt), false);
});

test('travel constraint отклоняет красивый вариант, который фактически слишком далеко', () => {
  const req = request({ constraints: { maxTravelMinutes: 20, budgetTier: 'low' } });
  assert.throws(() => Discovery.verifyCandidate(req, {
    candidateId: 'too-far', title: 'Занятие', address: 'Gütersloh',
    startsAt: '2026-08-26T17:30:00.000Z', travelMinutes: 45,
    price: { type: 'free', label: 'Бесплатно' }, availability: 'confirmed',
    action: { label: 'Открыть', url: 'https://official.example.test/book' }, checkedAt: NOW,
    sources: [source(['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'])],
  }), { code: 'travel-limit-exceeded' });
});

test('recommendation возвращает ровно primary + максимум один reserve', () => {
  const req = request();
  const make = (candidateId, relevance, travelMinutes) => Discovery.verifyCandidate(req, {
    candidateId, title: candidateId, address: 'Bielefeld',
    startsAt: '2026-08-26T17:30:00.000Z',
    price: { type: 'free', label: 'Бесплатно' }, availability: 'confirmed',
    action: { label: 'Открыть', url: `https://official.example.test/${candidateId}` },
    checkedAt: NOW, relevance, travelMinutes,
    sources: [source(['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'])],
  });
  const result = Discovery.recommend(req, [
    make('candidate-a', 0.7, 10),
    make('candidate-b', 0.9, 30),
    make('candidate-c', 0.8, 5),
  ], NOW);
  assert.equal(result.ok, true);
  assert.equal(result.recommendation.primary.candidateId, 'candidate-b');
  assert.equal(result.recommendation.reserve.candidateId, 'candidate-c');
  assert.equal('alternatives' in result.recommendation, false);
});

test('без свежего verified candidate нет расплывчатого fallback', () => {
  const req = request();
  assert.deepEqual(Discovery.recommend(req, [], NOW), { ok: false, reason: 'no-verified-candidate' });
  const { verified } = candidate('class', null, { requestId: 'other-request-01' });
  assert.deepEqual(Discovery.recommend(req, [verified], NOW), {
    ok: false, reason: 'no-verified-candidate',
  }, 'candidate from another request must not cross contexts');
});

test('cache round-trip восстанавливает только свежие нормализованные факты', () => {
  const fresh = candidate('place', { startsAt: null, price: null }).verified;
  const cache = Discovery.buildCache([fresh], NOW);
  const json = JSON.parse(JSON.stringify(cache));
  json.entries[0].providerSnippet = 'must disappear';
  json.entries[0].latitude = 52.0302;
  const hydrated = Discovery.hydrateCache(json, '2026-08-25T20:00:00.000Z');
  assert.equal(hydrated.length, 1);
  assert.equal('providerSnippet' in hydrated[0], false);
  assert.equal('latitude' in hydrated[0], false);
  assert.equal(Discovery.hydrateCache(json, '2026-08-26T12:00:00.000Z').length, 0);
});

test('поддельная expiry не продлевает cache', () => {
  const fresh = candidate('place', { startsAt: null, price: null }).verified;
  const json = JSON.parse(JSON.stringify(Discovery.buildCache([fresh], NOW)));
  json.entries[0].expiresAt = '2036-01-01T00:00:00.000Z';
  assert.deepEqual(Discovery.hydrateCache(json, NOW), []);
});

test('Brave policy запрещает raw result persistence без storage rights', () => {
  assert.deepEqual(Discovery.providerPolicy(), {
    id: 'brave-web-v1',
    rawSearchPersistence: 'forbidden-without-storage-rights',
    snippetsInAccount: false,
    ephemeralPlaceIdsInAccount: false,
    exactCoordinatesInAccount: false,
    persistentCandidateSource: 'direct-source-verification-only',
  });
});

test('discovery остаётся dormant и не загружается app shell', () => {
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(index, /board-v2-discovery\.js/);
  assert.doesNotMatch(sw, /board-v2-discovery\.js/);
});
