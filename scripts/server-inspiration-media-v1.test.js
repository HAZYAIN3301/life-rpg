'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMetadataResolver } = require('../server-inspiration-media-v1.js');

const PIN = 'https://www.pinterest.com/pin/974818281863152085/';
const TIKTOK = 'https://www.tiktok.com/@kingston.b0/video/7647936071673629973';
const IMAGE = 'https://i.pinimg.com/564x/75/67/ae/7567aeed89a0652cdd453a335ab6d590.jpg';
const POSTER = 'https://p16-common-sign.tiktokcdn-eu.com/tos-alisg-p-0037/ocOBErQAAX8BTFyxAAAIGxfYCPAii7i1wEcIzN~tplv-tiktokx-origin.image?x-expires=1789470000&x-signature=test';
const now = () => Date.parse('2026-09-13T12:00:00Z');
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function pinBody(changes = {}) {
  return { status: 'success', data: [{
    id: '974818281863152085', description: '   ', is_video: false, story_pin_data: null,
    images: { '564x': { url: IMAGE, width: 564, height: 559 } },
    native_creator: { full_name: '&#3898; CLAY&#128139;', profile_url: 'https://www.pinterest.com/Uranium007/', about: 'Ignored personal biography' },
    ...changes,
  }] };
}

function tikTokBody(changes = {}) {
  return {
    provider_name: 'TikTok', provider_url: 'https://www.tiktok.com', type: 'video',
    embed_product_id: '7647936071673629973', author_url: 'https://www.tiktok.com/@kingston.b0',
    title: 'Gojo &amp; One Piece — masking edit #animeedit', author_name: 'KINGSTON',
    thumbnail_url: POSTER, thumbnail_width: 1024, thumbnail_height: 576,
    html: '<script>privateSpoof()</script>', ...changes,
  };
}

test('a public Pinterest reference resolves through its fixed official widget endpoint', async () => {
  const requests = [];
  const resolver = createMetadataResolver({ now, fetchImpl: async (...args) => { requests.push(args); return json(pinBody()); } });
  const result = await resolver.resolve(`${PIN}?tracking=private#fragment`);
  const [url, options] = requests[0];
  assert.equal(url, 'https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=974818281863152085&sub=www&base_scheme=https');
  assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.deepEqual(options.headers, { Accept: 'application/json' });
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(result.status, 'resolved');
  assert.equal(result.title, '');
  assert.equal(result.description, '');
  assert.equal(result.authorName, '༺ CLAY💋');
  assert.equal(result.authorUrl, 'https://www.pinterest.com/Uranium007/');
  assert.equal(result.attributionKind, 'creator');
  assert.equal(result.mediaType, 'image');
  assert.equal(result.thumbnailUrl, IMAGE);
  assert.equal(result.thumbnailWidth, 564);
  assert.equal(result.checkedAt, '2026-09-13T12:00:00.000Z');
  assert.equal(result.source.url, PIN);
  assert.equal(result.embedUrl, 'https://assets.pinterest.com/ext/embed.html?id=974818281863152085');
  assert.doesNotMatch(JSON.stringify(result), /biography|tracking|private|playback|available|repin_count/);
});

test('TikTok oEmbed returns selected title and the signed real poster, never its HTML', async () => {
  let requested;
  const resolver = createMetadataResolver({ now, fetchImpl: async (url) => { requested = new URL(url); return json(tikTokBody()); } });
  const result = await resolver.resolve(TIKTOK);
  assert.equal(requested.origin, 'https://www.tiktok.com');
  assert.equal(requested.pathname, '/oembed');
  assert.equal(requested.searchParams.get('url'), TIKTOK);
  assert.equal(result.status, 'resolved');
  assert.equal(result.title, 'Gojo & One Piece — masking edit #animeedit');
  assert.equal(result.thumbnailUrl, POSTER);
  assert.equal(result.thumbnailHeight, 576);
  assert.equal(result.mediaType, 'video');
  assert.equal(Object.hasOwn(result, 'html'), false);
  assert.doesNotMatch(JSON.stringify(result), /privateSpoof|<script>/);
});

test('no arbitrary URL, shortener or private/internal endpoint is ever fetched', async () => {
  let count = 0;
  const resolver = createMetadataResolver({ fetchImpl: async () => { count++; return json(pinBody()); } });
  for (const input of [
    'https://example.com/image.jpg', 'http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data/',
    'https://api.pinadmin.com/internal/pins/info/?pin_ids=974818281863152085',
    'https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=974818281863152085',
    'https://pin.it/shortener', 'https://vm.tiktok.com/Zabc123/',
    'https://www.pinterest.com/person/board/', 'https://www.tiktok.com/@creator',
    PIN.replace('www.pinterest.com', 'user:pass@www.pinterest.com'), '', null,
  ]) assert.equal((await resolver.resolve(input)).status, 'invalid', String(input));
  assert.equal(count, 0);
});

test('redirects and login/HTML responses stay unavailable without follow-up requests', async () => {
  const variants = [
    async () => new Response('', { status: 302, headers: { location: 'https://127.0.0.1/' } }),
    async () => new Response('<h1>Login</h1>', { status: 200, headers: { 'content-type': 'text/html' } }),
    async () => ({ ok: true, redirected: true, url: 'https://login.example', headers: new Headers(), body: null }),
    async () => ({ ok: true, redirected: false, url: 'https://evil.example', headers: new Headers(), body: null }),
  ];
  for (const fetchImpl of variants) {
    const result = await createMetadataResolver({ fetchImpl }).resolve(PIN);
    assert.equal(result.status, 'unavailable');
    assert.equal(Object.hasOwn(result, 'thumbnailUrl'), false);
  }
});

test('missing and malformed provider data do not manufacture a title or working media', async () => {
  for (const [body, url] of [
    [{ status: 'failure', data: [] }, PIN], [pinBody({ id: '1128433250417695713' }), PIN],
    [pinBody({ error: 'not found' }), PIN],
    [tikTokBody({ embed_product_id: '7524174950018698509' }), TIKTOK],
    [tikTokBody({ author_url: 'https://www.tiktok.com/@someoneelse' }), TIKTOK],
    [tikTokBody({ provider_name: 'Other' }), TIKTOK],
    [tikTokBody({ provider_url: 'https://evil.example' }), TIKTOK],
  ]) assert.equal((await createMetadataResolver({ fetchImpl: async () => json(body) }).resolve(url)).status, 'unavailable');
  for (const status of [404, 410, 429, 503]) {
    const result = await createMetadataResolver({ fetchImpl: async () => json({}, status) }).resolve(PIN);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, status < 429 ? 'not_found' : 'provider_unavailable');
  }
});

test('Pinterest video or story metadata cannot be mistaken for an auto-show static photo', async () => {
  for (const [changes, expected] of [
    [{ is_video: true }, 'video'], [{ videos: { video_list: { video: {} } } }, 'video'],
    [{ story_pin_data: { metadata: { pin_title: 'One story' } } }, 'unknown'],
    [{ is_video: undefined }, 'unknown'],
  ]) {
    const result = await createMetadataResolver({ fetchImpl: async () => json(pinBody(changes)) }).resolve(PIN);
    assert.equal(result.status, 'resolved');
    assert.equal(result.mediaType, expected);
  }
});

test('a pinner is attributed as a pinner and arbitrary source/profile URLs are excluded', async () => {
  const result = await createMetadataResolver({ fetchImpl: async () => json(pinBody({
    native_creator: null, pinner: { full_name: 'Curator', profile_url: 'https://evil.example/user' },
    title: 'A specific composition', description: 'real description', link: 'https://evil.example/image',
  })) }).resolve(PIN);
  assert.equal(result.attributionKind, 'pinner');
  assert.equal(result.authorName, 'Curator');
  assert.equal(result.authorUrl, '');
  assert.equal(result.title, 'A specific composition');
  assert.equal(result.description, 'real description');
  assert.equal(Object.hasOwn(result, 'link'), false);
});

test('unknown thumbnail domains remain absent while safe title metadata survives', async () => {
  const tikTokResult = await createMetadataResolver({ fetchImpl: async () => json(tikTokBody({ thumbnail_url: 'https://evil.example/poster.png' })) }).resolve(TIKTOK);
  assert.equal(tikTokResult.status, 'resolved');
  assert.equal(tikTokResult.thumbnailUrl, '');
  const pinResult = await createMetadataResolver({ fetchImpl: async () => json(pinBody({
    images: { malicious: { url: 'https://evil.example/image.jpg', width: 2000, height: 2000 }, safe: { url: IMAGE, width: 564, height: 559 } },
  })) }).resolve(PIN);
  assert.equal(pinResult.thumbnailUrl, IMAGE);
});

test('declared and streamed oversized JSON are stopped within the byte budget', async () => {
  const declared = await createMetadataResolver({ maxBytes: 1024, fetchImpl: async () => json({}, 200, { 'content-length': '99999' }) }).resolve(PIN);
  assert.equal(declared.reason, 'response_too_large');
  let cancelled = false;
  const streamed = await createMetadataResolver({ maxBytes: 1024, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1025)); }, cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'application/json' } }) }).resolve(PIN);
  assert.equal(streamed.reason, 'response_too_large');
  assert.ok(cancelled);
  const jsonp = await createMetadataResolver({ fetchImpl: async () => new Response('callback({"status":"success"})', { headers: { 'content-type': 'application/json' } }) }).resolve(PIN);
  assert.equal(jsonp.reason, 'invalid_json');
});

test('deadline covers both fetch and body and aborts the actual network signal', async () => {
  let capturedSignal;
  const pending = createMetadataResolver({ timeoutMs: 15, fetchImpl: async (_url, options) => {
    capturedSignal = options.signal;
    return new Promise(() => {});
  } });
  assert.equal((await pending.resolve(PIN)).reason, 'timeout');
  assert.ok(capturedSignal.aborted);
  const stalledBody = createMetadataResolver({ timeoutMs: 15, fetchImpl: async (_url, options) => {
    capturedSignal = options.signal;
    return new Response(new ReadableStream(), { headers: { 'content-type': 'application/json' } });
  } });
  assert.equal((await stalledBody.resolve(PIN)).reason, 'timeout');
  assert.ok(capturedSignal.aborted);
});

test('caller cancellation is respected before and during work without exposing errors', async () => {
  const controller = new AbortController();
  let calls = 0;
  const resolver = createMetadataResolver({ fetchImpl: async () => { calls++; return new Promise(() => {}); } });
  const pending = resolver.resolve(PIN, { signal: controller.signal });
  controller.abort();
  assert.equal((await pending).reason, 'cancelled');
  assert.equal((await resolver.resolve(PIN, { signal: controller.signal })).reason, 'cancelled');
  assert.equal(calls, 1);
  const badNetwork = createMetadataResolver({ fetchImpl: async () => { throw new Error('credential=private-secret'); } });
  const result = await badNetwork.resolve(PIN);
  assert.equal(result.reason, 'network');
  assert.doesNotMatch(JSON.stringify(result), /secret|credential/);
});

test('concurrency is bounded and released after completion or failure', async () => {
  let finish;
  let calls = 0;
  const resolver = createMetadataResolver({ maxConcurrent: 1, fetchImpl: async () => {
    calls++;
    return new Promise((resolve) => { finish = resolve; });
  } });
  const first = resolver.resolve(PIN);
  assert.equal((await resolver.resolve(TIKTOK)).status, 'busy');
  assert.equal(calls, 1);
  finish(json(pinBody()));
  assert.equal((await first).status, 'resolved');
  const second = resolver.resolve(PIN);
  finish(json({}, 503));
  assert.equal((await second).status, 'unavailable');
  assert.equal(calls, 2);
});
