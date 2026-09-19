'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Media = require('../public/inspiration-media-v1.js');

const PIN = 'https://www.pinterest.com/pin/974818281863152085/';
const TIKTOK = 'https://www.tiktok.com/@kingston.b0/video/7647936071673629973';
const PIN_IMAGE = 'https://i.pinimg.com/736x/b3/6e/78/b36e78c729e4291048afa0720c13428e.jpg';

test('public pin and specific TikTok posts become stable sources without tracking query', () => {
  assert.deepEqual(Media.parseSource(`${PIN}?utm_source=share#content`), {
    provider: 'pinterest', id: '974818281863152085', url: PIN, format: 'image', authorHandle: '',
  });
  assert.deepEqual(Media.parseSource('https://m.tiktok.com/@kingston.b0/video/7647936071673629973/?is_from_webapp=1'), {
    provider: 'tiktok', id: '7647936071673629973', url: TIKTOK, format: 'edit', authorHandle: 'kingston.b0',
  });
  assert.equal(Media.parseSource('https://de.pinterest.com/pin/mood-board--974818281863152085/').url, PIN);
  assert.equal(Media.parseSource(`  ${PIN}  `).url, PIN);
  assert.equal(Media.parseSource(Media.parseSource(TIKTOK)).url, TIKTOK);
});

test('source validation excludes profiles, boards, shorteners, redirects and URL ambiguity', () => {
  const rejected = [
    'https://www.pinterest.com/person/board/', 'https://www.pinterest.com/search/pins/?q=art',
    'https://pin.it/abc123', 'https://vm.tiktok.com/ZTest42/', 'https://www.tiktok.com/@kingston.b0',
    'https://www.tiktok.com/@kingston.b0/video/1', 'https://www.pinterest.com/pin/1/',
    'http://www.pinterest.com/pin/974818281863152085/',
    'https://www.pinterest.com.evil.example/pin/974818281863152085/',
    'https://www.pinterest.com@evil.example/pin/974818281863152085/',
    'https://owner:secret@www.pinterest.com/pin/974818281863152085/',
    'https://www.pinterest.com:8443/pin/974818281863152085/',
    'https://www.pinterest.com\\@evil.example/pin/974818281863152085/',
    'https://www.pin\nterest.com/pin/974818281863152085/',
    '//www.pinterest.com/pin/974818281863152085/',
    'javascript:alert(1)', 'data:text/html,<h1>hello</h1>', '', null, {},
  ];
  for (const input of rejected) {
    assert.equal(Media.parseSource(input), null, String(input));
    assert.equal(Media.buildEmbed(input), '', String(input));
  }
  assert.equal(Media.parseSource(`${PIN}?${'x'.repeat(4096)}`), null);
});

test('single-post embeds preserve source identity and explicit finite player configuration', () => {
  assert.equal(Media.buildEmbed(PIN), 'https://assets.pinterest.com/ext/embed.html?id=974818281863152085');
  const embed = Media.buildEmbed(TIKTOK);
  const url = new URL(embed);
  assert.equal(url.origin, 'https://www.tiktok.com');
  assert.equal(url.pathname, '/player/v1/7647936071673629973');
  assert.equal(url.searchParams.get('autoplay'), '0');
  assert.equal(url.searchParams.get('loop'), '0');
  assert.equal(url.searchParams.get('rel'), '0');
  assert.equal(url.searchParams.get('controls'), '1');
  assert.equal(url.searchParams.get('description'), '1');
  assert.ok(Media.isAllowedEmbed(embed, TIKTOK));
  assert.ok(Media.isAllowedEmbed(Media.buildEmbed(PIN), Media.parseSource(PIN)));
  assert.equal(Media.isAllowedEmbed(embed, PIN), false);
  assert.equal(Media.isAllowedEmbed(embed, TIKTOK.replace('7647936071673629973', '7524174950018698509')), false);
  assert.equal(Media.isAllowedEmbed(embed, null), false);
});

test('embed validation prevents provider feed, extra query, autoplay and duplicate parameter tricks', () => {
  const pin = Media.buildEmbed(PIN);
  const tiktok = Media.buildEmbed(TIKTOK);
  const rejected = [
    PIN, TIKTOK, 'https://assets.pinterest.com/ext/embed.html?grid=person',
    `${pin}&grid=person`, `${pin}&id=1128433250417695713`, `${pin}#fragment`,
    pin.replace('assets.pinterest.com', 'assets.pinterest.com.evil.example'),
    pin.replace('/ext/embed.html', '/js/pinit.js'),
    tiktok.replace('autoplay=0', 'autoplay=1'), tiktok.replace('loop=0', 'loop=1'),
    tiktok.replace('rel=0', 'rel=1'), `${tiktok}&autoplay=1`, `${tiktok}&redirect=https://example.com`,
    tiktok.replace('&controls=1', ''), tiktok.replace('player/v1', 'embed/v2'),
    tiktok.replace('https:', 'http:'), tiktok.replace('www.tiktok.com', 'www.tiktok.com:8443'),
    tiktok.replace('www.tiktok.com', 'name:password@www.tiktok.com'),
  ];
  for (const input of rejected) assert.equal(Media.isAllowedEmbed(input), false, input);
  const reordered = new URL(tiktok);
  reordered.searchParams.sort();
  assert.ok(Media.isAllowedEmbed(reordered.href));
});

test('remote preview images are provider-bound, and never HTML/data/GIF or arbitrary domains', () => {
  assert.equal(Media.safeImage(PIN_IMAGE), PIN_IMAGE);
  assert.equal(Media.safeImage(PIN_IMAGE, 'pinterest'), PIN_IMAGE);
  assert.equal(Media.safeImage(PIN_IMAGE, 'tiktok'), '');
  const tikTokDocumentedPoster = 'https://p16.muscdn.com/obj/tos-maliva-p-0068/06kv6rfcesljdjr45ukb0000d844090v0200010605';
  assert.equal(Media.safeImage(tikTokDocumentedPoster, 'tiktok'), tikTokDocumentedPoster);
  assert.equal(Media.safeImage(tikTokDocumentedPoster, 'pinterest'), '');
  const reviewedPoster = 'https://p16-common-sign.tiktokcdn-eu.com/tos-alisg-p-0037/realPostId~tplv-tiktokx-origin.image?x-expires=1789470000&x-signature=test';
  assert.equal(Media.safeImage(reviewedPoster, 'tiktok'), reviewedPoster);
  assert.equal(Media.safeImage(reviewedPoster, 'pinterest'), '');
  const rejected = [
    PIN_IMAGE.replace('.jpg', '.gif'), PIN_IMAGE.replace('.jpg', '.svg'),
    PIN_IMAGE.replace('i.pinimg.com', 'i.pinimg.com.evil.example'),
    PIN_IMAGE.replace('i.pinimg.com', 'evil.example'), `${PIN_IMAGE}?redirect=https://example.com`,
    `${PIN_IMAGE}#fragment`, PIN_IMAGE.replace('/736x/', '/html/'),
    PIN_IMAGE.replace('https:', 'http:'), PIN_IMAGE.replace('i.pinimg.com', 'user@i.pinimg.com'),
    'data:image/png;base64,xxx', 'blob:https://satoru.example/image',
    'https://p16.muscdn.com/example.html',
    reviewedPoster.replace('p16-common-sign.tiktokcdn-eu.com', 'p16-common-sign.tiktokcdn-eu.com.evil.example'),
    reviewedPoster.replace('.image', '.mp4'),
  ];
  for (const input of rejected) assert.equal(Media.safeImage(input), '', input);
});

const playerWindow = {};
function playerEvent(type, value, changes = {}) {
  return { source: playerWindow, origin: 'https://www.tiktok.com', data: { 'x-tiktok-player': true, type, value }, ...changes };
}

test('player events distinguish ready/playback/end/error without inventing viewing completion', () => {
  assert.deepEqual(Media.parsePlayerEvent(playerEvent('onPlayerReady'), playerWindow, TIKTOK), { type: 'ready' });
  for (const [value, type] of [[-1, 'init'], [0, 'ended'], [1, 'playing'], [2, 'paused'], [3, 'buffering']]) {
    assert.deepEqual(Media.parsePlayerEvent(playerEvent('onStateChange', value), playerWindow, TIKTOK), { type });
  }
  assert.deepEqual(Media.parsePlayerEvent(playerEvent('onCurrentTime', { currentTime: 13, duration: 24.5 }), playerWindow), {
    type: 'time', currentTime: 13, duration: 24.5,
  });
  assert.deepEqual(Media.parsePlayerEvent(playerEvent('onPlayerError', { errorCode: 1001, errorType: '<script>evil()</script>' }), playerWindow), {
    type: 'error', code: 1001,
  });
  assert.deepEqual(Media.parsePlayerEvent(playerEvent('onError', 2), playerWindow), { type: 'error', code: 2 });
});

test('spoofed/late iframe messages cannot close a different media card', () => {
  const ended = playerEvent('onStateChange', 0);
  for (const event of [
    { ...ended, source: {} }, { ...ended, source: null },
    { ...ended, origin: 'null' }, { ...ended, origin: 'https://www.tiktok.com.evil.example' },
    { ...ended, origin: 'https://assets.pinterest.com' }, { ...ended, origin: 'http://www.tiktok.com' },
    { ...ended, data: JSON.stringify(ended.data) },
    { ...ended, data: { ...ended.data, 'x-tiktok-player': 'true' } },
    { ...ended, data: { ...ended.data, value: '0' } },
    { ...ended, data: { ...ended.data, value: 99 } },
  ]) assert.equal(Media.parsePlayerEvent(event, playerWindow, TIKTOK), null);
  assert.equal(Media.parsePlayerEvent(ended, undefined), null);
  assert.equal(Media.parsePlayerEvent(ended, playerWindow, PIN), null);
  assert.equal(Media.parsePlayerEvent(ended, playerWindow, 'https://example.com'), null);
});

test('malformed time/error messages are rejected rather than propagated into the UI', () => {
  for (const value of [null, {}, { currentTime: '1', duration: 24 }, { currentTime: -1, duration: 24 },
    { currentTime: Infinity, duration: 24 }, { currentTime: 99, duration: 24 },
    { currentTime: 0, duration: 0 }, { currentTime: 0, duration: 1e9 }]) {
    assert.equal(Media.parsePlayerEvent(playerEvent('onCurrentTime', value), playerWindow), null);
  }
  for (const value of [null, {}, { errorCode: '1001' }, { errorCode: 999 }, { errorCode: 4000 }]) {
    assert.equal(Media.parsePlayerEvent(playerEvent('onPlayerError', value), playerWindow), null);
  }
  assert.equal(Media.parsePlayerEvent(playerEvent('navigateTo', 2), playerWindow), null);
  assert.equal(Media.parsePlayerEvent(playerEvent('onImageChange', 2), playerWindow), null);
});

test('browser module exposes the same pure adapter without network, DOM or timers', () => {
  const context = vm.createContext({ URL });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/inspiration-media-v1.js'), 'utf8'), context);
  assert.equal(context.InspirationMediaV1.buildEmbed(PIN), Media.buildEmbed(PIN));
  assert.equal(context.InspirationMediaV1.safeImage(PIN_IMAGE), PIN_IMAGE);
  assert.ok(Object.isFrozen(context.InspirationMediaV1));
});
