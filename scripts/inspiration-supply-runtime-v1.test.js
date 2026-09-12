'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const P = require('../public/inspiration-supply-policy-v1.js');
const R = require('../public/inspiration-supply-runtime-v1.js');
const Profile = require('../public/inspiration-profile-v1.js');
const Catalog = require('../public/inspiration-catalog-v1.js');
const Batch = require('../public/inspiration-supply-batch-v1.js');
const NOW = '2026-09-10T22:00:00.000Z', DAY = '2026-09-10';
const profile = (ids, formats = ['quote']) => Profile.configure({
  interests: ids.map((id) => ({ id, label: id })), formats,
});
const opts = (extra) => Object.assign({ now: NOW, day: DAY, locale: 'en', profile: profile(['creative', 'learning', 'rest']) }, extra);
const candidate = (id, extra) => Object.assign({}, Batch.CANDIDATES[0], { id, externalId: id, source: id }, extra);
const video = (extra) => candidate('clip', Object.assign({
  format: 'video', lang: 'en', durationSec: 30, interestIds: ['creative'],
  rights: { kind: 'official-source', holder: 'Source', url: 'https://source.invalid/rights', embedAllowed: true, downloadAllowed: false },
  delivery: { policy: 'embed', embedUrl: 'https://www.youtube-nocookie.com/embed/example', sourceUrl: 'https://source.invalid/clip' },
  lastCheckedAt: NOW, available: true, checkMethod: 'playback',
}, extra));

test('production batch admits nine real owned texts and preserves eight pending external records', () => {
  const raw = R.candidates(), out = R.prepare(opts());
  assert.equal(raw.length, 17);
  assert.equal(out.admission.items.length, 9);
  assert.equal(out.admission.rejected.length, 8);
  assert.equal(Catalog.CATALOG.length, 11);
  assert.ok(out.catalog.every((c) => c.mediaPolicy === 'text' && c.attribution === 'Satoru'));
  assert.ok(raw.some((c) => c.id === 'spiderverse-official-trailer'));
  assert.ok(raw.some((c) => c.id === 'rezero-official-pv'));
});
test('every original is complete, self-authored, translated, and renderable in all UI locales', () => {
  for (const locale of Catalog.LOCALES) {
    const out = R.prepare(opts({ locale }));
    assert.equal(out.admission.items.length, 9);
    assert.ok(out.poolRows.length > 0);
    assert.ok(!out.blocked.some((row) => row.code === P.BLOCK.LANGUAGE));
    for (const c of out.admission.items) {
      assert.ok(c.title[locale] && c.body[locale]);
      assert.equal(c.lang, 'ru'); // Translation is explicit; text is not wordless.
      assert.equal(c.contentLocales.length, 5);
    }
  }
});
test('own quotes migrate to text, visual and check method survive; embed rights are not inferred', () => {
  const quote = P.fromCatalogV1Row(Catalog.CATALOG.find((r) => r.id === 'control-circle'));
  assert.equal(quote.draft.delivery.policy, 'text');
  assert.equal(quote.draft.availabilityReason, '');
  const accepted = P.admit([quote.draft], { now: NOW });
  assert.equal(accepted.items.length, 1);
  assert.equal(P.toCatalogRows(accepted.items, 'en')[0].visual, 'ink');
  const old = P.fromCatalogV1Row(Catalog.CATALOG[0]);
  assert.equal(old.draft.rights.embedAllowed, false);
  const reviewed = P.fromCatalogV1Row(Catalog.CATALOG[0], { embedAllowed: true, lang: 'none', available: true, lastCheckedAt: NOW, checkMethod: 'head' });
  assert.equal(P.admit([reviewed.draft], { now: NOW }).rejected[0].code, P.REJECT.PLAYBACK_UNVERIFIED);
});
test('duration override and verified remote-image policy survive migration', () => {
  const row = Catalog.CATALOG.find((r) => r.id === 'blender-bunny');
  assert.equal(P.fromCatalogV1Row(row, { durationSec: 597 }).draft.durationSec, 597);
  const image = P.fromCatalogV1Row(Catalog.CATALOG.find((r) => r.id === 'nasa-pale-blue-dot'), {
    available: true, lastCheckedAt: NOW, checkMethod: 'manual',
  });
  const admitted = P.admit([image.draft], { now: NOW });
  assert.equal(admitted.items.length, 1);
  assert.equal(P.toCatalogRows(admitted.items, 'en')[0].mediaPolicy, 'remote-image');
});
test('missing runtime modules fail closed in a browser', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../public/inspiration-supply-runtime-v1.js'), 'utf8'), ctx);
  assert.equal(ctx.InspirationSupplyRuntimeV1.prepare(opts()).error, 'supply_not_loaded');
});
test('browser script order produces the same admitted pool as Node', () => {
  const ctx = vm.createContext({ URL });
  for (const file of ['inspiration-catalog-v1', 'inspiration-profile-v1', 'inspiration-supply-policy-v1', 'inspiration-supply-batch-v1', 'inspiration-supply-runtime-v1']) {
    vm.runInContext(fs.readFileSync(require.resolve(`../public/${file}.js`), 'utf8'), ctx);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.InspirationSupplyRuntimeV1.ensureDigest(opts()))), R.ensureDigest(opts()));
});
test('invalid call, date and time fail closed', () => {
  assert.equal(R.prepare(opts({ day: '2026-02-30' })).error, 'invalid_day');
  assert.equal(R.prepare(opts({ now: undefined })).error, 'invalid_time');
  assert.equal(R.prepare(opts({ candidates: {} })).error, 'invalid_context');
});
test('synthetic fixtures cannot become production supply', () => {
  const out = R.prepare(opts({ candidates: [candidate('fake', { synthetic: true }), candidate('unverified', { verified: false })] }));
  assert.equal(out.catalog.length, 0);
  assert.ok(out.admission.rejected.every((r) => r.code === 'unverified_fixture'));
});
test('language gap is relevant to this profile, not to unrelated blocked sources', () => {
  const foreign = candidate('foreign', { contentLocales: ['ru'], lang: 'ru', interestIds: ['business'] });
  const a = R.ensureDigest(opts({ candidates: [foreign], locale: 'de', profile: profile(['business']) }));
  const b = R.ensureDigest(opts({ candidates: [foreign], locale: 'de', profile: profile(['anime']) }));
  assert.equal(a.items.length, 0); assert.equal(a.report.emptyReason, 'language_gap');
  assert.equal(b.items.length, 0); assert.equal(b.report.emptyReason, 'no_matching_material');
});
test('localized descriptions never declare external spoken media readable', () => {
  const out = R.ensureDigest(opts({ candidates: [video({ contentLocales: ['de'] })], locale: 'de', profile: profile(['creative'], ['video']) }));
  assert.equal(out.items.length, 0); assert.equal(out.report.emptyReason, 'language_gap');
});
test('Japanese media remains Japanese, not wordless or incorrectly tagged English', () => {
  const row = video({ lang: 'ja' });
  assert.equal(P.admit([row], { now: NOW }).items[0].lang, 'ja');
  assert.equal(R.prepare(opts({ candidates: [row], profile: profile(['creative'], ['video']) })).report.emptyReason, 'language_gap');
});
test('pending source review has its own empty state', () => {
  const out = R.ensureDigest(opts({ profile: profile(['superhero'], ['edit']) }));
  assert.equal(out.report.emptyReason, 'supply_unverified');
  assert.equal(out.items.length, 0);
});
test('same-day digest keeps the thin-format explanation after a reload', () => {
  const input = opts({ profile: profile(['creative', 'learning', 'rest'], ['quote', 'video']) });
  const first = R.ensureDigest(input);
  assert.equal(first.report.status, 'thin_formats');
  const next = R.ensureDigest({ ...input, profile: first.profile });
  assert.deepEqual(next.profile.digest.ids, first.profile.digest.ids);
  assert.equal(next.report.status, 'thin_formats');
});
test('saved entry resolution is read-only and fails closed for a missing catalog', () => {
  const saved = { id: 'mine', catalogId: 'clip', note: 'My note', why: 'Personal reason', title: 'Saved title',
    url: 'https://old.invalid/source', embedUrl: 'https://www.youtube-nocookie.com/embed/old' };
  const before = structuredClone(saved);
  const denied = R.resolveSaved(saved, null);
  assert.equal(denied.supplyUnavailable, true);
  for (const key of ['url', 'embedUrl', 'sourceUrl', 'rightsUrl', 'imageUrl', 'assetPath']) assert.equal(denied[key], '');
  assert.equal(denied.note, saved.note); assert.equal(denied.title, saved.title);
  assert.deepEqual(saved, before);
  const source = { id: 'clip', title: 'Current title', sourceUrl: 'https://new.invalid/source', mediaPolicy: 'link' };
  const accepted = R.resolveSaved(saved, [source]);
  assert.equal(accepted.id, 'mine'); assert.equal(accepted.catalogId, 'clip');
  assert.equal(accepted.url, source.sourceUrl); assert.equal(accepted.note, saved.note);
  assert.equal(accepted.title, source.title); assert.equal(accepted.catalogItem, source);
  const own = { id: 'personal', url: 'https://mine.invalid' };
  assert.equal(R.resolveSaved(own, []), own);
});
test('shortage preserves interest and format boundaries for distinct real profiles', () => {
  const digests = [['running'], ['business'], ['reading']].map((ids) => {
    const out = R.ensureDigest(opts({ profile: profile(ids) }));
    assert.ok(out.items.length > 0 && out.items.length <= 3);
    assert.equal(out.report.fillerAllowed, false);
    assert.ok(out.items.every((c) => c.format === 'quote' && c.interestIds.some((id) => ids.includes(id))));
    return out.items.map((r) => r.id).join(',');
  });
  assert.equal(new Set(digests).size, 3);
  assert.equal(R.ensureDigest(opts({ profile: profile(['running'], ['video']) })).items.length, 0);
});
test('source quota is applied to relevant content before selection', () => {
  const rows = [candidate('a', { source: 'shared', interestIds: ['anime'] }), candidate('b', { source: 'shared', interestIds: ['business'] })];
  assert.equal(R.ensureDigest(opts({ candidates: rows, profile: profile(['business']) })).items[0].id, 'b');
});
test('blocked keywords and feedback are handled by the existing profile selector', () => {
  const row = candidate('match');
  const configured = profile(['rest']); configured.blocked = ['report'];
  const out = R.ensureDigest(opts({ candidates: [row], profile: configured }));
  assert.equal(out.items.length, 0); assert.equal(out.report.emptyReason, 'profile_filters');
});
test('known previous digest and feedback obey cooldown; explicit rerequest bypasses only cooldown', () => {
  const row = candidate('one');
  const configured = profile(['rest']);
  configured.digest = { day: '2026-09-09', ids: ['one'], doneIds: [] };
  const input = opts({ candidates: [row], profile: configured });
  assert.equal(R.ensureDigest(input).report.emptyReason, 'temporarily_exhausted');
  assert.equal(R.ensureDigest(Object.assign({}, input, { requestedIds: ['one'] })).items.length, 1);
  configured.feedback = [{ itemId: 'one', day: '2026-09-09', verdict: 'not_for_me', interestIds: ['rest'], format: 'quote' }];
  assert.equal(R.ensureDigest(Object.assign({}, input, { requestedIds: ['one'] })).items.length, 0);
});
test('same day keeps ids, completion and feedback visible instead of reshuffling', () => {
  const rows = [candidate('one'), candidate('two'), candidate('three')];
  const first = R.ensureDigest(opts({ candidates: rows, profile: profile(['rest']) }));
  const changed = Profile.recordFeedback(first.profile, first.items[0], 'not_for_me', DAY);
  const second = R.ensureDigest(opts({ candidates: rows.reverse(), profile: changed }));
  assert.deepEqual(second.items.map((r) => r.id), first.items.map((r) => r.id));
  assert.deepEqual(second.profile.digest, changed.digest);
});
test('expired or disappeared fixed media is removed without replacement or lost completion', () => {
  const first = R.ensureDigest(opts({ candidates: [video()], profile: profile(['creative'], ['video']) }));
  first.profile = Profile.markDone(first.profile, 'clip');
  const second = R.ensureDigest(opts({ candidates: [video({ available: false, availabilityReason: 'removed' }), video({ id: 'replacement', externalId: 'replacement' })], profile: first.profile }));
  assert.equal(second.items.length, 0);
  assert.deepEqual(second.unavailableIds, ['clip']);
  assert.deepEqual(second.profile.digest.doneIds, ['clip']);
  assert.deepEqual(R.ensureDigest(opts({ candidates: [], profile: second.profile })).items, []);
});
test('fixed digest still enforces the current playback gate', () => {
  const configured = profile(['creative'], ['video']); configured.digest = { day: DAY, ids: ['clip'], doneIds: [] };
  const out = R.ensureDigest(opts({ profile: configured, candidates: [video({ checkMethod: 'head' })] }));
  assert.equal(out.items.length, 0);
  assert.equal(out.admission.rejected[0].code, 'playback_unverified');
});
test('manual page review does not admit a video or podcast as playback', () => {
  for (const row of [video({ checkMethod: 'manual' }), video({ format: 'podcast', checkMethod: 'manual', rights: { kind: 'official-source', holder: 'Source', url: 'https://source.invalid/rights', embedAllowed: false }, delivery: { policy: 'link', sourceUrl: 'https://source.invalid/podcast' } })]) {
    assert.equal(P.admit([row], { now: NOW }).rejected[0].code, 'playback_unverified');
  }
});
test('review queue is finite, prioritizes unreviewed records, and never mutates receipts', () => {
  const raw = R.candidates(), before = JSON.stringify(raw);
  const out = R.reviewQueue(raw, { now: NOW, limit: 3 });
  assert.equal(out.items.length, 3); assert.equal(out.remaining, 5);
  assert.ok(out.items.every((c) => c.requiredCheck === 'playback_in_satoru'));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(R.reviewQueue([video({ lastCheckedAt: '2026-08-20T22:00:00.000Z' })], { now: NOW }).items.length, 0);
  assert.equal(R.reviewQueue([video({ lastCheckedAt: '2026-08-18T22:00:00.000Z' })], { now: NOW }).items.length, 1);
});
