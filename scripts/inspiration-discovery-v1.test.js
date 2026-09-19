'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Discovery = require('../server-inspiration-discovery-v1.js');
const Media = require('../public/inspiration-media-v1.js');

const DAY = '2026-09-13';
const NOW = `${DAY}T12:00:00.000Z`;
const PIN_IMAGE = 'https://i.pinimg.com/736x/ab/cd/ef/abcdef0123456789abcdef0123456789ab.jpg';
const pin = id => `https://www.pinterest.com/pin/${id}/`;
const clip = id => `https://www.tiktok.com/@sample.editor/video/${id}`;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const taste = overrides => ({ discoveryEnabled: true, visualTaste: 'rainy neon alleys cyan amber reflections cinematic grain',
  customInterests: 'night street photography', interests: ['photography', 'travel'], formats: ['image', 'edit'],
  videoReferences: [{ url: pin('974818281863152085'), title: 'Quiet blue streets', why: 'low angle reflections and amber windows', interestIds: ['photography'] }],
  ...overrides });
const imageRow = (id, extras = {}) => ({ type: 'image_result', url: pin(id), title: `A real indexed title ${id}`, properties: { url: PIN_IMAGE }, ...extras });
const clipRow = (id, extras = {}) => ({ url: clip(id), title: `An indexed edit ${id}`, ...extras });

function harness(overrides = {}) {
  const records = new Map(), calls = [], writes = [];
  const options = {
    apiKey: 'test-only-key', now: () => NOW,
    readAccount: async id => clone(records.get(id) ?? null),
    writeAccount: async (id, value) => { records.set(id, clone(value)); writes.push({ id, value: clone(value) }); return { ok: true }; },
    requestJson: async input => {
      calls.push(input);
      return new URL(input.url).pathname.includes('/images/') ? { status: 200, json: { results: [
        imageRow('111111111111111111'), imageRow('222222222222222222'), imageRow('333333333333333333'),
      ] } } : { status: 200, json: { web: { results: [clipRow('7111111111111111111'), clipRow('7222222222222222222')] } } };
    }, ...overrides,
  };
  return { records, calls, writes, options, service: Discovery.createInspirationDiscoveryService(options) };
}

test('disabled, unconfigured and missing durable storage never call search or storage', async () => {
  let touched = 0;
  const io = { requestJson: () => { touched++; }, readAccount: () => { touched++; }, writeAccount: () => { touched++; } };
  const disabled = Discovery.createService({ ...io, apiKey: 'key', now: () => NOW });
  assert.equal((await disabled.daily({ accountId: 'one', profile: taste({ discoveryEnabled: false }) })).status, 'disabled');
  assert.equal((await Discovery.createService({ ...io, now: () => NOW }).daily({ accountId: 'one', profile: taste() })).status, 'unconfigured');
  assert.equal((await Discovery.createService({ apiKey: 'key', requestJson: io.requestJson, now: () => NOW }).daily({ accountId: 'one', profile: taste() })).status, 'storage_unavailable');
  assert.equal(disabled.status({ profile: taste() }).providerAvailable, true);
  assert.equal(Discovery.createService().providerAvailable, false);
  assert.equal(touched, 0);
});

test('only explicit visual taste and reference wording shape two distinct bounded queries', () => {
  const first = taste({ goals: ['SECRET_GOAL'], notes: 'SECRET_DIARY', name: 'SECRET_NAME', city: 'SECRET_CITY', history: 'SECRET_HISTORY',
    visualTaste: 'silver monochrome brutalist concrete quiet angular shadows',
    videoReferences: [{ url: pin('974818281863152085'), title: 'Red architectural void', why: 'framing sculptural geometry', interestIds: ['architecture'] }] });
  const second = taste({ visualTaste: 'golden dawn forest watercolor soft pastel mist', videoReferences: [] });
  const a = Discovery.buildQueries(first, DAY), b = Discovery.buildQueries(second, DAY);
  assert.equal(a.length, 2);
  assert.notEqual(a[0].q, a[1].q);
  assert.notEqual(a[0].q, b[0].q);
  assert.match(a[0].q, /sculptural geometry/);
  assert.match(a[0].q, /architectural/);
  assert.doesNotMatch(a[0].q, /monochrome|brutalist|concrete/, 'a reference query stays coherent instead of mixing a second theme');
  assert.match(b[0].q, /forest|watercolor|pastel/);
  for (const query of a) {
    assert.ok(query.q.length <= 400);
    assert.ok(query.keywords.length <= 12);
    assert.doesNotMatch(query.q, /SECRET|974818281863152085|https:/);
    const call = Discovery.buildSearchCall(query, 'key');
    const url = new URL(call.url);
    assert.equal(url.hostname, 'api.search.brave.com');
    assert.equal(url.searchParams.get('safesearch'), 'strict');
    assert.equal(url.searchParams.get('count'), '20');
    assert.equal(url.searchParams.get('freshness'), query.provider === 'tiktok' ? 'py' : null);
    assert.deepEqual(Object.keys(call.headers).sort(), ['Accept', 'X-Subscription-Token']);
  }
});

test('no generic discovery from broad categories, empty formats or bare reference URLs', async () => {
  const h = harness();
  for (const profile of [taste({ visualTaste: '', customInterests: '', videoReferences: [], interests: ['sport'] }),
    taste({ formats: [] }), taste({ visualTaste: '', customInterests: '', videoReferences: [{ url: pin('974818281863152085') }] })]) {
    assert.equal((await h.service.daily({ accountId: 'one', profile })).status, 'needs_taste');
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.writes.length, 0);
});

test('URLs, email, query operators and private fields are not sent as user context', () => {
  const queries = Discovery.buildQueries(taste({ visualTaste: 'blue rain https://private.example/SECRET_EMAIL user@example.com site:evil.test',
    accountId: 'SECRET_ACCOUNT', location: 'SECRET_HOME', feedback: [{ reason: 'SECRET_FEEDBACK' }] }), DAY);
  for (const query of queries) {
    assert.doesNotMatch(query.q, /SECRET|user@|https:|private\.example|site:evil/);
    assert.equal((query.q.match(/site:/g) || []).length, 1);
  }
});

test('only actual exact provider result page URLs can become candidates', () => {
  const query = Discovery.buildQueries(taste(), DAY)[0];
  const invalid = ['https://www.pinterest.com/search/pins/?q=city', 'https://www.pinterest.com/person/board/',
    'https://www.pinterest.com.evil.test/pin/111111111111111111/', 'https://evil.test/?url=' + pin('111111111111111111'),
    'http://www.pinterest.com/pin/111111111111111111/', 'https://name:password@www.pinterest.com/pin/111111111111111111/',
    'https://www.pinterest.com:8443/pin/111111111111111111/', clip('7111111111111111111')];
  const payload = { results: invalid.map(url => imageRow('111111111111111111', { url, title: pin('222222222222222222') }))
    .concat(imageRow('333333333333333333'), imageRow('333333333333333333', { url: pin('333333333333333333') + '?tracking=yes' })) };
  const rows = Discovery.candidatesFromResponse(payload, query, NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'pinterest-333333333333333333');
  assert.equal(rows[0].delivery.sourceUrl, pin('333333333333333333'));
  assert.ok(Media.isAllowedEmbed(rows[0].delivery.embedUrl, rows[0].delivery.sourceUrl));
});

test('real response pinimg URL is retained; proxies, invented CDN URLs and unsafe extensions are omitted', () => {
  const query = Discovery.buildQueries(taste(), DAY)[0];
  const candidates = Discovery.candidatesFromResponse({ results: [imageRow('111111111111111111'),
    imageRow('222222222222222222', { properties: { url: 'https://cdn.search.brave.com/proxy?url=' + encodeURIComponent(PIN_IMAGE) } }),
    imageRow('333333333333333333', { properties: { url: PIN_IMAGE.replace('.jpg', '.svg') } }),
    imageRow('444444444444444444', { properties: {}, thumbnail: { src: PIN_IMAGE } }),
    imageRow('555555555555555555', { properties: { url: PIN_IMAGE + '?tracking=1' } }),
  ] }, query, NOW);
  assert.equal(candidates[0].imageUrl, PIN_IMAGE);
  assert.equal(candidates[1].imageUrl, undefined);
  assert.equal(candidates[2].imageUrl, undefined);
  assert.equal(candidates[3].imageUrl, PIN_IMAGE);
  assert.equal(candidates[4].imageUrl, undefined);
});

test('search metadata never invents creator, image inspection, language, duration or playback', () => {
  const queries = Discovery.buildQueries(taste(), DAY);
  const photo = Discovery.candidatesFromResponse({ results: [imageRow('111111111111111111', { title: 'Liam Wong / Harajuku Rain', author: 'Liam Wong' })] }, queries[0], NOW)[0];
  const edit = Discovery.candidatesFromResponse({ web: { results: [clipRow('7111111111111111111', { language: 'ru', duration: 17, author: 'Famous Director', thumbnail: { src: PIN_IMAGE } })] } }, queries[1], NOW)[0];
  for (const row of [photo, edit]) {
    assert.equal(row.creator, null);
    assert.equal(row.available, 'unknown');
    assert.equal(row.checkMethod, 'metadata');
    assert.equal(row.durationSec, null);
    assert.equal(row.playbackVerified, false);
    assert.equal(row.imageViewed, false);
    assert.equal(row.rights.downloadAllowed, false);
    assert.equal(row.lastCheckedAt, NOW);
    assert.ok(Media.isAllowedEmbed(row.delivery.embedUrl, row.delivery.sourceUrl));
    assert.match(row.body.en, /Found for your taste/);
    assert.equal(row.lang, 'unknown', 'metadata does not prove even an image contains no words');
  }
  assert.equal(photo.rights.holder, 'Pinterest');
  assert.equal(photo.attributionRole, 'platform');
  assert.equal(edit.rights.holder, 'TikTok @sample.editor');
  assert.equal(edit.attributionRole, 'poster');
  assert.equal(edit.lang, 'unknown');
  assert.equal(edit.imageUrl, undefined);
});

test('reserves quota durably before network and persists finite diverse results before success', async () => {
  const h = harness();
  const original = h.options.requestJson;
  h.options.requestJson = async input => {
    const state = h.records.get('one');
    assert.equal(state.quota.attempts, 2);
    assert.equal(state.day.status, 'pending');
    assert.deepEqual(state.day.candidates, []);
    assert.equal(state.day.profileFingerprint.length, 64);
    return original(input);
  };
  const result = await Discovery.createService(h.options).daily({ accountId: 'one', profile: taste() });
  assert.equal(result.status, 'ready');
  assert.equal(h.calls.length, 2);
  assert.equal(h.writes.length, 2);
  assert.equal(result.candidates.length, 3);
  assert.deepEqual(result.candidates.map(row => row.source), ['pinterest', 'tiktok', 'pinterest']);
  assert.deepEqual(h.records.get('one').day.candidates, result.candidates);
  assert.doesNotMatch(JSON.stringify(h.records.get('one')), /test-only-key|974818281863152085|videoReferences|visualTaste/);
});

test('same daily batch survives reload and restart, even with today shown receipts', async () => {
  const h = harness();
  const first = await h.service.daily({ accountId: 'one', profile: taste() });
  const again = await Discovery.createService(h.options).daily({ accountId: 'one', profile: taste({ shownHistory: first.candidates.map(row => ({ id: row.id, day: DAY })) }) });
  assert.equal(again.cached, true);
  assert.deepEqual(again.candidates, first.candidates);
  assert.equal(h.calls.length, 2);
});

test('own examples and items shown within 45 days are excluded by source identity', async () => {
  const h = harness();
  const result = await h.service.daily({ accountId: 'one', profile: taste({ videoReferences: [{ url: pin('111111111111111111') + '?ref=abc', title: 'Quiet neon', why: 'deep amber lights' }],
    shownHistory: [{ id: 'tiktok-7111111111111111111', day: '2026-07-30' }, { id: 'pinterest-222222222222222222', day: '2026-07-29' }] }) });
  assert.ok(!result.candidates.some(row => row.id === 'pinterest-111111111111111111'));
  assert.ok(!result.candidates.some(row => row.id === 'tiktok-7111111111111111111'));
  assert.ok(result.candidates.some(row => row.id === 'pinterest-222222222222222222'));
});

test('new day searches exclude previously issued candidates; no filler or endless second batch', async () => {
  let now = NOW;
  const h = harness({ now: () => now });
  const first = await h.service.daily({ accountId: 'one', profile: taste() });
  now = '2026-09-14T12:00:00.000Z';
  const second = await h.service.daily({ accountId: 'one', profile: taste() });
  assert.equal(second.candidates.length, 2);
  assert.ok(second.candidates.every(row => !first.candidates.some(previous => previous.id === row.id)));
  assert.equal(h.calls.length, 4);
  const repeat = await h.service.daily({ accountId: 'one', profile: taste() });
  assert.deepEqual(repeat.candidates, second.candidates);
  assert.equal(h.calls.length, 4);
});

test('concurrent requests serialize per account and re-read the same durable batch', async () => {
  const h = harness();
  const results = await Promise.all(Array.from({ length: 12 }, () => h.service.daily({ accountId: 'one', profile: taste() })));
  assert.equal(h.calls.length, 2);
  assert.equal(h.writes.length, 2);
  assert.equal(results.filter(row => !row.cached).length, 1);
  assert.ok(results.every(row => JSON.stringify(row.candidates) === JSON.stringify(results[0].candidates)));
});

test('accounts have independent quota and never share cached candidate data', async () => {
  const h = harness();
  await Promise.all(['one', 'two'].map(accountId => h.service.daily({ accountId, profile: taste() })));
  assert.equal(h.calls.length, 4);
  assert.equal(h.records.size, 2);
  h.records.get('one').day.candidates[0].title.ru = 'one-account-only';
  const two = await h.service.daily({ accountId: 'two', profile: taste() });
  assert.notEqual(two.candidates[0].title.ru, 'one-account-only');
});

test('reservation write rejection means zero search calls and zero successful candidates', async () => {
  for (const receipt of [undefined, false, {}, { ok: false }]) {
    const h = harness({ writeAccount: async () => receipt });
    const result = await h.service.daily({ accountId: 'one', profile: taste() });
    assert.equal(result.status, 'storage_error');
    assert.deepEqual(result.candidates, []);
    assert.equal(h.calls.length, 0);
  }
});

test('final save failure returns no early success and persisted reservation blocks retries', async () => {
  const h = harness();
  const original = h.options.writeAccount;
  h.options.writeAccount = async (id, state) => state.day.status === 'pending' ? original(id, state) : Promise.reject(new Error('disk unavailable'));
  const service = Discovery.createService(h.options);
  const result = await service.daily({ accountId: 'one', profile: taste() });
  assert.equal(result.status, 'storage_error');
  assert.deepEqual(result.candidates, []);
  const retry = await Discovery.createService(h.options).daily({ accountId: 'one', profile: taste() });
  assert.equal(retry.status, 'daily_limit');
  assert.equal(retry.attempts, 2);
  assert.equal(h.calls.length, 2);
});

test('ambiguous final save may be recovered only by a later durable read', async () => {
  const h = harness();
  const original = h.options.writeAccount;
  h.options.writeAccount = async (id, state) => {
    await original(id, state);
    if (state.day.status !== 'pending') throw new Error('receipt lost');
    return { ok: true };
  };
  const first = await Discovery.createService(h.options).daily({ accountId: 'one', profile: taste() });
  assert.equal(first.status, 'storage_error');
  assert.deepEqual(first.candidates, []);
  const recovered = await Discovery.createService(h.options).daily({ accountId: 'one', profile: taste() });
  assert.equal(recovered.status, 'ready');
  assert.equal(recovered.cached, true);
  assert.equal(recovered.candidates.length, 3);
  assert.equal(h.calls.length, 2);
});

test('provider auth and rate failures are honest terminal cached states, not availability claims', async () => {
  for (const [status, expected] of [[401, 'provider_auth'], [403, 'provider_auth'], [429, 'provider_rate_limited']]) {
    let calls = 0;
    const h = harness({ requestJson: async () => { calls++; return { status, json: { secret: 'must not leak' } }; } });
    const first = await h.service.daily({ accountId: 'one', profile: taste() });
    const again = await h.service.daily({ accountId: 'one', profile: taste() });
    assert.equal(first.status, expected);
    assert.equal(again.status, expected);
    assert.equal(first.providerAvailable, true); // configured transport, not a successful search
    assert.deepEqual(first.candidates, []);
    assert.doesNotMatch(JSON.stringify(first), /must not leak/);
    assert.equal(calls, 1);
  }
});

test('partial provider failure saves usable metadata candidates; thrown transport errors exhaust finite budget', async () => {
  const h = harness();
  const original = h.options.requestJson;
  h.options.requestJson = async input => new URL(input.url).pathname.includes('/images/') ? original(input) : { status: 503, json: null };
  const partial = await Discovery.createService(h.options).daily({ accountId: 'one', profile: taste() });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.candidates.length, 3);
  let calls = 0;
  const broken = harness({ requestJson: async () => { calls++; throw new Error('provider-error with private body'); } });
  const result = await broken.service.daily({ accountId: 'one', profile: taste() });
  assert.equal(result.status, 'provider_error');
  assert.equal(calls, 2);
  assert.equal((await broken.service.daily({ accountId: 'one', profile: taste() })).cached, true);
  assert.equal(calls, 2);
});

test('empty search or malformed response never produces fallback examples and cannot trigger more searches', async () => {
  for (const valid of [true, false]) {
    let calls = 0;
    const h = harness({ requestJson: async input => { calls++; return { status: 200, json: valid
      ? new URL(input.url).pathname.includes('/images/') ? { results: [] } : { web: { results: [] } }
      : { html: '<script>not an API result</script>' } }; } });
    const result = await h.service.daily({ accountId: 'one', profile: taste() });
    assert.equal(result.status, valid ? 'empty' : 'provider_error');
    assert.deepEqual(result.candidates, []);
    await h.service.daily({ accountId: 'one', profile: taste() });
    assert.equal(calls, 2);
  }
});

test('corrupt storage and read failure fail closed without resetting the account quota', async () => {
  for (const raw of [{}, [], { version: 2 }, { version: 1, day: null, history: [], quota: { dayKey: DAY, attempts: -1 } }]) {
    const h = harness({ readAccount: async () => raw });
    assert.equal((await h.service.daily({ accountId: 'one', profile: taste() })).status, 'storage_error');
    assert.equal(h.calls.length, 0);
  }
  const failed = harness({ readAccount: async () => { throw new Error('disk failure'); } });
  assert.equal((await failed.service.daily({ accountId: 'one', profile: taste() })).status, 'storage_error');
  assert.equal(failed.calls.length, 0);
});

test('local day is supported but switching days cannot bypass the UTC request quota', async () => {
  let now = '2026-09-13T22:30:00.000Z';
  const h = harness({ now: () => now });
  const one = await h.service.daily({ accountId: 'one', profile: taste(), dayKey: '2026-09-13' });
  assert.equal(one.dayKey, '2026-09-13');
  const nextLocal = await h.service.daily({ accountId: 'one', profile: taste(), dayKey: '2026-09-14' });
  assert.equal(nextLocal.status, 'daily_limit');
  assert.equal(nextLocal.quotaDayKey, '2026-09-13');
  assert.equal(h.calls.length, 2);
  now = '2026-09-14T00:15:00.000Z';
  const next = await h.service.daily({ accountId: 'one', profile: taste(), dayKey: '2026-09-14' });
  assert.equal(next.status, 'ready');
  assert.equal(h.calls.length, 4);
  const rollback = await h.service.daily({ accountId: 'one', profile: taste(), dayKey: '2026-09-13' });
  assert.equal(rollback.status, 'storage_error');
  assert.equal(h.calls.length, 4);
});

test('UTC rollover does not reshuffle an already issued local-day batch', async () => {
  let now = '2026-09-13T22:30:00.000Z';
  const h = harness({ now: () => now });
  const first = await h.service.daily({ accountId: 'one', profile: taste(), dayKey: '2026-09-14' });
  now = '2026-09-14T00:15:00.000Z';
  const second = await h.service.daily({ accountId: 'one', profile: taste(), dayKey: '2026-09-14' });
  assert.equal(second.cached, true);
  assert.deepEqual(second.candidates, first.candidates);
  assert.equal(h.calls.length, 2);
});

test('unreal or distant client days and invalid account identifiers do not make network calls', async () => {
  const h = harness();
  for (const dayKey of ['2026-02-30', '2026-09-20', 'invalid', null]) {
    assert.equal((await h.service.daily({ accountId: 'one', profile: taste(), dayKey })).status, 'invalid_day');
  }
  for (const accountId of ['', '  one ', null, '../two', 'one/two', 'one@example.com']) {
    assert.equal((await h.service.daily({ accountId, profile: taste() })).status, 'invalid_account');
  }
  assert.equal(h.calls.length, 0);
  assert.equal((await h.service.daily(null)).status, 'invalid_account');
});

test('stored state is bounded and cache reconstruction rejects claimed playback, arbitrary embeds and author fields', async () => {
  const h = harness();
  await h.service.daily({ accountId: 'one', profile: taste() });
  const state = h.records.get('one');
  state.history = Array.from({ length: 500 }, (_, i) => ({ id: `pinterest-${100000000000000000n + BigInt(i)}`, day: DAY, secret: 'discard' }));
  state.day.candidates[0].available = true;
  state.day.candidates[0].checkMethod = 'playback';
  state.day.candidates[0].creator = 'FAKE_CREATOR';
  state.day.candidates[0].delivery.embedUrl = 'https://evil.test/';
  state.day.candidates[0].imageUrl = 'https://evil.test/image.jpg';
  state.day.candidates[0].secret = 'discard';
  const normalized = Discovery.normalizeAccount(state, DAY);
  assert.equal(normalized.history.length, 180);
  assert.doesNotMatch(JSON.stringify(normalized), /discard|FAKE_CREATOR|evil\.test/);
  const row = normalized.day.candidates[0];
  assert.equal(row.available, 'unknown');
  assert.equal(row.checkMethod, 'metadata');
  assert.equal(row.creator, null);
  assert.ok(Media.isAllowedEmbed(row.delivery.embedUrl));
});

test('changing taste can hide a newly adopted reference but cannot buy a new daily batch', async () => {
  const h = harness();
  const first = await h.service.daily({ accountId: 'one', profile: taste() });
  const hidden = first.candidates[0];
  const next = await h.service.daily({ accountId: 'one', profile: taste({ visualTaste: 'totally different pastel watercolor',
    videoReferences: [{ url: hidden.delivery.sourceUrl, title: 'my example', why: 'composition' }] }) });
  assert.equal(next.cached, true);
  assert.ok(next.candidates.every(row => row.id !== hidden.id));
  assert.equal(h.calls.length, 2);
});

test('provider response processing is finite and strips unsafe title markup', () => {
  const query = Discovery.buildQueries(taste(), DAY)[0];
  const payload = { results: Array.from({ length: 100 }, (_, i) => imageRow(String(100000000000000000n + BigInt(i)), { title: '<script>x</script>' + 'a'.repeat(10000) })) };
  const rows = Discovery.candidatesFromResponse(payload, query, NOW);
  assert.equal(rows.length, 20);
  assert.ok(rows.every(row => row.title.ru.length <= 180 && !row.title.ru.includes('<')));
  assert.deepEqual(Discovery.candidatesFromResponse({ ...payload, extra: { might_be_offensive: true } }, query, NOW), []);
});

test('incomplete failed discovery does not label an empty first source as an overall successful empty search', async () => {
  const h = harness({ requestJson: async input => new URL(input.url).pathname.includes('/images/')
    ? { status: 200, json: { results: [] } } : { status: 429, json: {} } });
  const result = await h.service.daily({ accountId: 'one', profile: taste() });
  assert.equal(result.status, 'provider_rate_limited');
  assert.deepEqual(result.candidates, []);
});

test('timeout aborts transport and late provider completion cannot mutate the fixed result', async () => {
  const pending = [];
  const h = harness({ timeoutMs: 5, requestJson: input => new Promise(resolve => pending.push({ input, resolve })) });
  const result = await h.service.daily({ accountId: 'one', profile: taste() });
  assert.equal(result.status, 'provider_error');
  assert.equal(pending.length, 2);
  assert.ok(pending.every(row => row.input.signal.aborted));
  for (const row of pending) row.resolve({ status: 200, json: { results: [imageRow('111111111111111111')] } });
  await Promise.resolve();
  assert.deepEqual(h.records.get('one').day.candidates, []);
  assert.deepEqual(result.candidates, []);
});

test('unconfirmed save cannot return candidates while final durable receipt is still pending', async () => {
  const h = harness();
  const original = h.options.writeAccount;
  let release;
  h.options.writeAccount = (id, state) => state.day.status === 'pending' ? original(id, state)
    : new Promise(resolve => { release = async () => resolve(await original(id, state)); });
  let completed = false;
  const promise = Discovery.createService(h.options).daily({ accountId: 'one', profile: taste() }).then(value => { completed = true; return value; });
  for (let i = 0; i < 40 && !release; i++) await Promise.resolve();
  assert.equal(typeof release, 'function');
  assert.equal(completed, false);
  assert.equal(h.records.get('one').day.status, 'pending');
  await release();
  assert.equal((await promise).status, 'ready');
});
