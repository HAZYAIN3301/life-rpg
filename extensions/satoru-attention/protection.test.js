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

test('0.7.0 adult list: default category, exact ruleset choice and honest counts', () => {
  // A setup that never stored categories starts with adult checked; saved choices stay exact.
  assert.equal(Protection.emptySettings().categories.adult, true);
  assert.equal(Protection.normalizeSettings({}).categories.adult, true);
  assert.equal(Protection.normalizeSettings({ categories: { social: true } }).categories.adult, false);
  assert.equal(Protection.normalizeSettings({ categories: { adult: false } }).categories.adult, false);
  const on = Protection.normalizeSettings({ enabled: true, categories: { adult: true } });
  assert.deepEqual(Protection.adultRulesets(on, new Date(), { canRedirect: true }), ['adult_block', 'adult_redirect']);
  assert.deepEqual(Protection.adultRulesets(on, new Date(), { canRedirect: false }), ['adult_block']);
  assert.deepEqual(Protection.adultRulesets({ ...on, enabled: false }), []);
  assert.deepEqual(Protection.adultRulesets({ ...on, categories: { adult: false } }), []);
  const saturday = new Date('2026-09-12T19:00:00');
  const recreation = { ...on, recreation: { enabled: true, days: [6], start: '18:00', end: '20:00' } };
  assert.deepEqual(Protection.adultRulesets(recreation, saturday, { canRedirect: true }), [], 'recreation pauses the list');
  const list = { source: 'OISD NSFW', version: '202609261407', domains: 505602 };
  const counted = Protection.summary(on, Catalog, new Date(), list);
  assert.equal(counted.blockedDomains, Protection.blockedDomains(on, Catalog).length + 505602);
  assert.deepEqual(counted.adultList, { ...list, active: true });
  assert.equal(Protection.summary({ ...on, categories: { adult: false } }, Catalog, new Date(), list).adultList.active, false);
});

test('bundled rulesets (0.7.0+): manifest, rule shape, allowlist precedence and metadata agree', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '0.8.0');
  assert.deepEqual(manifest.declarative_net_request.rule_resources, [
    { id: 'adult_redirect', enabled: false, path: 'rules/adult-redirect.json' },
    { id: 'adult_block', enabled: false, path: 'rules/adult-block.json' },
  ]);
  const meta = require('./adult-list.js');
  const redirect = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules/adult-redirect.json'), 'utf8'));
  const block = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules/adult-block.json'), 'utf8'));
  assert.deepEqual(meta.sources.map((source) => [source.name, source.license]), [
    ['OISD NSFW', 'GPL-3.0'], ['HaGeZi NSFW', 'GPL-3.0'], ['StevenBlack porn-only', 'MIT'], ['Satoru supplement', 'Satoru']]);
  for (const source of meta.sources) assert.match(source.sha256, /^[0-9a-f]{64}$/);
  assert.ok(fs.readFileSync(path.join(__dirname, 'rules/LICENSE-GPL-3.0.txt'), 'utf8').includes('GNU GENERAL PUBLIC LICENSE'));
  assert.ok(fs.readFileSync(path.join(__dirname, 'rules/LICENSE-MIT-StevenBlack.txt'), 'utf8').includes('The MIT License'));
  assert.equal(redirect.length, meta.rules); assert.equal(block.length, meta.rules);
  const domains = new Set();
  for (const [index, rule] of block.entries()) {
    assert.equal(rule.id, index + 1);
    assert.deepEqual(rule.action, { type: 'block' });
    assert.deepEqual(rule.condition.resourceTypes, ['main_frame', 'sub_frame']);
    assert.ok(rule.priority < 10_000, 'the dynamic allowlist (10 000) must win');
    assert.deepEqual(redirect[index].condition.requestDomains, rule.condition.requestDomains);
    for (const domain of rule.condition.requestDomains) {
      assert.equal(Protection.normalizeDomain(domain), domain, domain);
      assert.ok(!domains.has(domain), domain); domains.add(domain);
    }
  }
  assert.equal(domains.size, meta.domains);
  assert.ok(meta.domains > 100_000);
  for (const kept of ['satoruapp.com', 'life-rpg-production-416a.up.railway.app', 'reddit.com', 'redd.it', 'tumblr.com', 'imgur.com', 'itch.io', 'blogspot.com', 'x.com'])
    assert.equal(domains.has(kept), false, kept);
  for (const popular of ['pornhub.com', 'spankbang.com', 'eporner.com', 'beeg.com', 'xhamster.desi', 'redgifs.com',
    // 0.8.0: sites the owner reported as still reachable with 0.7.0
    'playbun.com', 'igenfun.com', 'dieboerse.de', 'viraly.wtf', 'furaffinity.net', 'kemono.cr', 'candy.ai', 'joyreactor.cc']) assert.ok(domains.has(popular), popular);
  for (const rule of redirect) {
    assert.deepEqual(rule.action, { type: 'redirect', redirect: { extensionPath: '/block.html' } });
    assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
    assert.ok(rule.priority > block[0].priority && rule.priority < 10_000);
  }
  assert.ok(manifest.web_accessible_resources.some((entry) => entry.resources.includes('block.html')));
  const worker = fs.readFileSync(path.join(__dirname, 'service-worker.js'), 'utf8');
  assert.match(worker, /importScripts\('core\.js', 'protection\.js', 'protection-catalog\.js', 'adult-list\.js', 'health\.js'\);/);
  assert.match(worker, /chrome\.declarativeNetRequest\.updateEnabledRulesets\(\{\s*enableRulesetIds: wanted, disableRulesetIds:/);
  assert.match(worker, /getEnabledRulesets\(\)\)\.slice\(\)\.sort\(\);[\s\S]*JSON\.stringify\(rulesets\) === JSON\.stringify\(await expectedRulesets\(protection, at\)\)/);
});

test('0.8.0 Reddit guard: follows the adult category, registered only with all-site access, verified by health', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const on = Protection.normalizeSettings({ enabled: true, categories: { adult: true } });
  assert.equal(Protection.redditGuardActive(on), true);
  assert.equal(Protection.redditGuardActive({ ...on, categories: { adult: false } }), false);
  assert.equal(Protection.redditGuardActive({ ...on, enabled: false }), false);
  const worker = fs.readFileSync(path.join(__dirname, 'service-worker.js'), 'utf8');
  assert.match(worker, /if \(!Protection\.redditGuardActive\(protectionSettings, new Date\(at\)\) \|\| !\(await broadProtectionPermission\(\)\)\) return \[\];/);
  assert.match(worker, /matches: \['\*:\/\/\*\.reddit\.com\/\*'\], js: \['reddit-guard\.js'\], css: \['reddit-guard\.css'\]/);
  assert.match(worker, /Health\.sameScripts\(guards, await expectedGuardScripts\(protection, at\)\)/);
  const guard = fs.readFileSync(path.join(__dirname, 'reddit-guard.js'), 'utf8');
  // Only Reddit's own same-origin metadata is read; unknown answers fail open; verdicts stay local.
  assert.match(guard, /\/r\/\$\{item\.name\}\/about\.json\?raw_json=1/);
  assert.match(guard, /data\.over18 === true/);
  assert.match(guard, /data\.subreddit\.over_18 === true/);
  assert.match(guard, /const REVEAL_AFTER_MS = 4000;/);
  assert.doesNotMatch(guard, /https?:\/\/(?!www\.reddit\.com|old\.reddit\.com)[a-z0-9.-]+\//i);
  assert.match(fs.readFileSync(path.join(__dirname, 'reddit-guard.css'), 'utf8'), /shreddit-post\[nsfw\], shreddit-post\[is-nsfw\], \.thing\.over18/);
});
