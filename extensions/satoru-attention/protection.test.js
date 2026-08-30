'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Protection = require('./protection.js');
const Catalog = require('./protection-catalog.js');

function settings(overrides = {}) {
  return Protection.normalizeSettings({
    enabled: true,
    categories: { social: true },
    denylist: ['example.com'],
    allowlist: [],
    blockBypass: true,
    ...overrides,
  });
}

test('domain normalization is strict and keeps Satoru un-blockable', () => {
  assert.equal(Protection.normalizeDomain('*.Example.com'), 'example.com');
  assert.equal(Protection.normalizeDomain('https://sub.example.com/a'), 'sub.example.com');
  for (const value of ['', 'localhost', '127.0.0.1', 'com', 'chrome://settings',
    'life-rpg-production-416a.up.railway.app', 'https://user:pass@example.com']) {
    assert.equal(Protection.normalizeDomain(value), null, value);
  }
});

test('catalog is broad, local and based on distinct protection families', () => {
  assert.ok(Catalog.social.length >= 200);
  assert.ok(Catalog.piracy.length >= 3000);
  assert.ok(Catalog.bypass.length >= 700);
  assert.ok(Catalog.social.includes('tiktok.com'));
  assert.ok(Catalog.video.includes('youtube.com'));
  assert.ok(Catalog.bypass.includes('dns.google'));
  for (const domains of Object.values(Catalog)) assert.equal(domains.length, new Set(domains).size);
});

test('denylist and category cover subdomains while allowlist wins', () => {
  const base = settings({ allowlist: ['help.example.com'] });
  assert.equal(Protection.decision(base, Catalog, 'https://example.com/a').blocked, true);
  assert.equal(Protection.decision(base, Catalog, 'https://img.example.com/a').blocked, true);
  assert.equal(Protection.decision(base, Catalog, 'https://help.example.com/a').blocked, false);
  assert.equal(Protection.decision(base, Catalog, 'https://deep.help.example.com/a').blocked, false);
  assert.equal(Protection.decision(base, Catalog, 'https://www.tiktok.com/').blocked, true);
  assert.equal(Protection.decision(base, Catalog, 'https://unlisted.example.net/').blocked, false);
});

test('recreation time crosses midnight without weakening bypass protection', () => {
  const base = settings({ recreation: { enabled: true, days: [6], start: '22:00', end: '02:00' } });
  const saturday = new Date('2026-08-29T23:00:00');
  const sunday = new Date('2026-08-30T01:00:00');
  const later = new Date('2026-08-30T02:01:00');
  assert.equal(Protection.recreationActive(base, saturday), true);
  assert.equal(Protection.recreationActive(base, sunday), true);
  assert.equal(Protection.recreationActive(base, later), false);
  assert.equal(Protection.decision(base, Catalog, 'https://www.tiktok.com/', saturday).reason, 'recreation');
  assert.equal(Protection.decision(base, Catalog, 'https://dns.google/', saturday).blocked, true);
  assert.ok(Protection.nextScheduleBoundary(base, saturday));
});

test('DNR plan gives allowlist precedence and separates page redirects from subresource blocks', () => {
  const rules = Protection.buildRules(settings({
    allowlist: ['help.example.com'], safeSearch: true, youtubeRestricted: true,
  }), Catalog, new Date('2026-08-30T12:00:00'), {
    baseId: 30_000,
    blockUrl: 'chrome-extension://abcdefghijklmnop/block.html',
  });
  assert.ok(rules.length > 8);
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
  assert.ok(rules.some((rule) => rule.priority === 10_000 && rule.action.type === 'allowAllRequests'));
  assert.ok(rules.some((rule) => rule.priority === 9_000 && rule.action.type === 'redirect'
    && rule.condition.resourceTypes.includes('main_frame')));
  assert.ok(rules.some((rule) => rule.priority === 8_000 && rule.action.type === 'block'
    && !rule.condition.resourceTypes.includes('main_frame')));
  assert.ok(rules.some((rule) => rule.action.type === 'modifyHeaders'
    && rule.action.requestHeaders[0].header === 'YouTube-Restrict'));
  assert.equal(rules.filter((rule) => rule.action.type === 'redirect'
    && rule.action.redirect.transform?.queryTransform).length, 3);
  assert.equal(rules.find((rule) => rule.condition.requestDomains?.includes('duckduckgo.com'))
    .condition.urlFilter, 'q=');
});

test('normalization deduplicates lists, removes deny/allow conflicts and bounds state', () => {
  const normalized = Protection.normalizeSettings({
    enabled: true,
    denylist: ['example.com', 'EXAMPLE.com', 'safe.example.com'],
    allowlist: ['safe.example.com', 'safe.example.com'],
    categories: { social: 1, video: true, unknown: true },
  });
  assert.deepEqual(normalized.denylist, ['example.com']);
  assert.deepEqual(normalized.allowlist, ['safe.example.com']);
  assert.equal(normalized.categories.social, false);
  assert.equal(normalized.categories.video, true);
  assert.equal('unknown' in normalized.categories, false);
});
