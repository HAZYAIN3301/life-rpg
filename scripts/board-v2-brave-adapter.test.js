'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BraveAdapter = require('../server-board-v2-discovery-v1.js');

const ROOT = path.join(__dirname, '..');
const NOW = '2026-08-25T14:00:00.000Z';
const DIRECT_FIELDS = ['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'];

function consent() {
  return {
    enabled: true,
    city: 'Bielefeld',
    countryCode: 'DE',
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    approvedAt: '2026-08-25T13:00:00.000Z',
    latitude: 52.0302,
    longitude: 8.5325,
  };
}

function spec(overrides) {
  return Object.assign({
    requestId: 'bielefeld-sport-01',
    templateId: 'try-local-class',
    slotId: 'class',
    intent: 'class',
    searchTerms: ['trial-class', 'boxing'],
    interests: ['combat-sport'],
    constraints: { budgetTier: 'low', maxTravelMinutes: 45 },
    freeText: 'personal diary text must not leave the account',
  }, overrides || {});
}

function bravePayload(rows) {
  return { web: { results: rows || [
    {
      title: 'Boxen — Universität Bielefeld Hochschulsport',
      url: 'https://hsp.sport.uni-bielefeld.de/cgi/webpage.cgi?kursinfo=A34EE5B2DC',
      description: 'provider snippet must remain transient',
      id: 'temporary-provider-id',
    },
  ] } };
}

function verifiedClass(input, overrides) {
  return Object.assign({
    candidateId: 'uni-bielefeld-boxing',
    title: 'Пробное занятие по боксу в Universität Bielefeld',
    address: 'Universitätsstraße 25, Bielefeld',
    startsAt: '2026-08-26T17:30:00.000Z',
    price: { type: 'fixed', amount: 5, currency: 'EUR', label: '5 €' },
    availability: 'confirmed',
    action: { label: 'Открыть занятие', url: input.url },
    travelMinutes: 12,
    relevance: 0.9,
    checkedAt: input.checkedAt,
    sources: [{ kind: 'organizer', url: input.url, fields: DIRECT_FIELDS, checkedAt: input.checkedAt }],
  }, overrides || {});
}

test('без server key адаптер спит и не делает сетевой вызов', async () => {
  let calls = 0;
  const adapter = BraveAdapter.createAdapter({
    requestJson: async () => { calls += 1; },
    verifyOfficialPage: async () => null,
  });
  assert.equal(adapter.available, false);
  assert.deepEqual(await adapter.resolve(consent(), spec()), {
    ok: false, reason: 'provider-unavailable', billing: { searchRequests: 0, estimatedUsd: 0 },
  });
  assert.equal(calls, 0);
});

test('Brave query содержит authored terms + city/country, но не GPS/free text/interests', async () => {
  let captured;
  const adapter = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async (call) => { captured = call; return { status: 200, json: bravePayload([]) }; },
    verifyOfficialPage: async () => null,
    clock: () => NOW,
  });
  const result = await adapter.resolve(consent(), spec());
  assert.equal(result.reason, 'no-verified-candidate');
  const url = new URL(captured.url);
  assert.equal(url.origin + url.pathname, BraveAdapter.ENDPOINT);
  assert.equal(url.searchParams.get('q'), 'trial class boxing Bielefeld DE');
  assert.equal(url.searchParams.get('country'), 'DE');
  assert.equal(url.searchParams.get('search_lang'), 'de');
  assert.equal(url.searchParams.get('count'), '8');
  assert.equal(captured.headers['X-Subscription-Token'], 'private-brave-key');
  const serialized = JSON.stringify(captured);
  assert.doesNotMatch(serialized, /52\.0302|8\.5325|personal diary|combat-sport/);
});

test('Bielefeld fixture становится рекомендацией только после direct organizer verification', async () => {
  const adapter = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async () => ({ status: 200, json: bravePayload() }),
    verifyOfficialPage: async (input) => verifiedClass(input),
    clock: () => NOW,
  });
  const result = await adapter.resolve(consent(), spec());
  assert.equal(result.ok, true);
  assert.equal(result.recommendation.primary.candidateId, 'uni-bielefeld-boxing');
  assert.equal(result.recommendation.reserve, null);
  assert.equal(result.billing.searchRequests, 1);
  assert.equal(result.billing.estimatedUsd, 0.005);
  assert.deepEqual(result.audit, {
    provider: 'brave-web-v1', searched: true, leadsChecked: 1,
    verifiedCandidates: 1, rawProviderPayloadStored: false,
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /provider snippet|temporary-provider-id|private-brave-key/);
});

test('aggregator claim и malformed extractor output отбрасываются без vague fallback', async () => {
  const adapter = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async () => ({ status: 200, json: bravePayload() }),
    verifyOfficialPage: async (input) => verifiedClass(input, {
      sources: [{
        kind: 'aggregator', url: input.url, fields: DIRECT_FIELDS, checkedAt: input.checkedAt,
      }],
    }),
    clock: () => NOW,
  });
  assert.deepEqual(await adapter.resolve(consent(), spec()), {
    ok: false, reason: 'no-verified-candidate',
    billing: { searchRequests: 1, estimatedUsd: 0.005 },
  });
});

test('adapter проверяет максимум четыре уникальных HTTPS lead и возвращает primary + reserve', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    title: `Class ${index}`,
    url: `https://official-${index}.example.test/class`,
  }));
  rows.splice(1, 0, rows[0]);
  rows.splice(2, 0, { title: 'bad', url: 'http://bad.example.test' });
  let checks = 0;
  const adapter = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async () => ({ status: 200, json: bravePayload(rows) }),
    verifyOfficialPage: async (input) => {
      checks += 1;
      return verifiedClass(input, {
        candidateId: `candidate-${checks}`,
        title: `Class ${checks}`,
        relevance: 1 - checks / 10,
      });
    },
    clock: () => NOW,
  });
  const result = await adapter.resolve(consent(), spec());
  assert.equal(checks, 4);
  assert.equal(result.audit.leadsChecked, 4);
  assert.equal(result.recommendation.primary.candidateId, 'candidate-1');
  assert.equal(result.recommendation.reserve.candidateId, 'candidate-2');
  assert.equal('alternatives' in result.recommendation, false);
});

test('provider HTTP/network error не утаскивает response detail наружу', async () => {
  const http = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async () => ({ status: 429, json: { error: 'secret provider diagnostic' } }),
    verifyOfficialPage: async () => null,
  });
  assert.deepEqual(await http.resolve(consent(), spec()), {
    ok: false, reason: 'provider-error', status: 429,
    billing: { searchRequests: 1, estimatedUsd: 0.005 },
  });
  const network = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async () => { throw new Error('network secret'); },
    verifyOfficialPage: async () => null,
  });
  assert.deepEqual(await network.resolve(consent(), spec()), {
    ok: false, reason: 'provider-error', billing: { searchRequests: 1, estimatedUsd: 0.005 },
  });
});

test('abort до поиска не тратит запрос, abort после ответа не запускает verifier', async () => {
  let searchCalls = 0;
  let verifyCalls = 0;
  const adapter = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async () => { searchCalls += 1; return { status: 200, json: bravePayload() }; },
    verifyOfficialPage: async () => { verifyCalls += 1; return null; },
    clock: () => NOW,
  });
  assert.deepEqual(await adapter.resolve(consent(), spec(), { signal: { aborted: true } }), {
    ok: false, reason: 'aborted', billing: { searchRequests: 0, estimatedUsd: 0 },
  });
  assert.equal(searchCalls, 0);

  const controller = new AbortController();
  const midflight = BraveAdapter.createAdapter({
    apiKey: 'private-brave-key',
    requestJson: async () => {
      searchCalls += 1;
      controller.abort();
      return { status: 200, json: bravePayload() };
    },
    verifyOfficialPage: async () => { verifyCalls += 1; return null; },
    clock: () => NOW,
  });
  assert.deepEqual(await midflight.resolve(consent(), spec(), { signal: controller.signal }), {
    ok: false, reason: 'aborted', billing: { searchRequests: 1, estimatedUsd: 0.005 },
  });
  assert.equal(verifyCalls, 0);
});

test('adapter dormant: server.js его ещё не вызывает до endpoint/account cache change-set', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(server, /server-board-v2-discovery-v1/);
  assert.doesNotMatch(index, /board-v2-discovery/);
  assert.doesNotMatch(sw, /board-v2-discovery/);
});
