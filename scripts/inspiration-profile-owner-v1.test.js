'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Owner = require('../server-inspiration-profile-v1');
const Profile = require('../public/inspiration-profile-v1');
const Media = require('../public/inspiration-media-v1');
const clone = value => JSON.parse(JSON.stringify(value));
const profile = (extra = {}) => Profile.configure({ interests: [{ id: 'anime', label: 'Anime' }], formats: ['image', 'edit'], visualTaste: 'Neon city collage', ...extra });
function find(id = '123456789') {
  const url = `https://www.pinterest.com/pin/${id}/`;
  return { id: `pinterest-${id}`, delivery: { sourceUrl: url, embedUrl: Media.buildEmbed(url) },
    title: { ru: 'Коллаж', en: 'Collage' }, body: { ru: 'Найдено', en: 'Found' },
    interestIds: ['anime'], lastCheckedAt: '2026-09-19T12:00:00.000Z' };
}
const request = (base, target, extra = {}) => ({ base, profile: target, finds: [], ...extra });

test('profile owner changes only its fields and never mutates current settings or request', () => {
  const before = { inspiration: profile(), inventory: [{ id: 'owned' }], goals: { a: 1 }, title: 'Keep', locale: 'de', nested: { x: ['untouched'] },
    inspirationDraft: { version: 1, savedAt: 'today', profile: profile({ visualTaste: 'draft' }) } };
  const target = profile({ discoveryEnabled: true }), payload = request(before.inspiration, target, { finds: [find()], baseDraft: before.inspirationDraft });
  const snapshots = clone({ before, payload }), result = Owner.prepareCommit(before, payload);
  assert.equal(result.ok, true); assert.equal(result.replay, false);
  assert.deepEqual(result.settings.inspiration, target); assert.equal('inspirationDraft' in result.settings, false);
  for (const key of ['inventory', 'goals', 'title', 'locale', 'nested']) assert.deepEqual(result.settings[key], before[key]);
  assert.deepEqual({ before, payload }, snapshots);
});

test('lost reply retries survive unrelated writes and preserve the first saved find metadata', () => {
  const target = profile(), payload = request(null, target, { finds: [find()], baseDraft: { version: 1, profile: target } });
  const first = Owner.prepareCommit({ inspirationDraft: payload.baseDraft }, payload);
  assert.equal(first.ok, true);
  first.settings.inventory = [{ id: 'new-own-item' }];
  const retry = Owner.prepareCommit(first.settings, payload);
  assert.equal(retry.ok, true); assert.equal(retry.replay, true); assert.deepEqual(retry.settings, first.settings);
  const newer = clone(first.settings); newer.inspirationFinds[0].title.ru = 'Новый заголовок';
  newer.inspirationFinds[0].lastCheckedAt = '2026-09-20T12:00:00.000Z';
  const newerResult = Owner.prepareCommit(newer, payload);
  assert.equal(newerResult.replay, true); assert.equal(newerResult.settings.inspirationFinds[0].title.ru, 'Новый заголовок');
});

test('rediscovered find refreshes old metadata after cooldown; delayed retry cannot roll the timestamp back', () => {
  const old = { ...find(), lastCheckedAt: '2026-07-01T12:00:00.000Z' };
  const fresh = { ...find(), title: { ru: 'Новая композиция', en: 'Fresh composition' } };
  const current = { inspiration: profile(), inspirationFinds: [Owner.cleanFind(old)] };
  const result = Owner.prepareCommit(current, request(current.inspiration, current.inspiration, { finds: [fresh] }));
  assert.equal(result.ok, true); assert.equal(result.replay, false);
  assert.equal(result.settings.inspirationFinds.length, 1);
  assert.equal(result.settings.inspirationFinds[0].lastCheckedAt, fresh.lastCheckedAt);
  assert.equal(result.settings.inspirationFinds[0].title.ru, fresh.title.ru);
  const older = Owner.prepareCommit(result.settings, request(current.inspiration, current.inspiration, { finds: [old] }));
  assert.equal(older.replay, true); assert.deepEqual(older.settings, result.settings);
  const mismatched = Owner.prepareCommit(result.settings, request(current.inspiration, current.inspiration, { finds: [find()] }));
  assert.equal(mismatched.ok, false); assert.equal(mismatched.status, 409);
});

test('stale taste, consent, history and drafts conflict without overwriting the current owner', () => {
  const old = profile({ discoveryEnabled: true }), target = profile({ visualTaste: 'Old request', discoveryEnabled: true });
  for (const actual of [profile({ visualTaste: 'New taste', discoveryEnabled: true }), profile({ discoveryEnabled: false }),
    Profile.normalize({ ...old, shownHistory: [{ id: 'pinterest-123456789', day: '2026-09-19' }] })]) {
    const current = { inspiration: actual, inventory: [42] }, before = clone(current);
    const result = Owner.prepareCommit(current, request(old, target));
    assert.deepEqual(result, { ok: false, status: 409, error: 'inspiration_revision_conflict' });
    assert.deepEqual(current, before);
  }
  const expectedDraft = { version: 1, profile: old }, newDraft = { version: 1, profile: profile({ visualTaste: 'new draft' }) };
  for (const actual of [old, target]) {
    const result = Owner.prepareCommit({ inspiration: actual, inspirationDraft: newDraft }, request(old, target, { baseDraft: expectedDraft }));
    assert.equal(result.ok, false); assert.equal(result.status, 409);
  }
  const keepDraft = Owner.prepareCommit({ inspiration: old, inspirationDraft: newDraft }, request(old, target));
  assert.deepEqual(keepDraft.settings.inspirationDraft, newDraft, 'draft deletion requires an explicit expected draft');
});

test('normalized base is mandatory; malformed/oversized or unrelated payloads cannot silently reset profile', () => {
  const good = request(null, profile());
  const invalid = [null, [], {}, { ...good, base: 'server' }, { ...good, profile: {} }, { ...good, base: {} },
    { ...good, profile: { ...good.profile, discoveryEnabled: 'true' } }, { ...good, settings: { inventory: [1] } },
    { ...good, baseDraft: [] }, { ...good, finds: [find(), find(), find(), find()] }];
  for (const payload of invalid) assert.equal(Owner.prepareCommit({}, payload).ok, false);
  assert.equal(Owner.prepareCommit({}, { ...good, finds: [{ ...find(), body: { ru: 'a'.repeat(300000) } }] }).status, 413);
  assert.equal(Owner.prepareCommit([], good).status, 409);
});

test('find sanitizer binds exact source/embed, bounds metadata and strips every claimed playback proof', () => {
  const candidate = { ...find(), imageUrl: 'https://evil.example/tracker.png',
    available: true, checkMethod: 'playback', playbackVerified: true, imageViewed: true, durationSec: 100, creator: 'forged',
    rights: { kind: 'licensed-direct', downloadAllowed: true }, evil: 'drop',
    title: { ru: '<b>' + 'я'.repeat(300) + '</b>', en: 'safe', xx: 'drop' },
    tags: Array.from({ length: 100 }, (_, n) => 'tag ' + n) };
  const result = Owner.prepareCommit({}, request(null, profile(), { finds: [candidate] }));
  const saved = result.settings.inspirationFinds[0];
  assert.equal(saved.available, 'unknown'); assert.equal(saved.checkMethod, 'metadata');
  assert.equal(saved.playbackVerified, false); assert.equal(saved.imageViewed, false);
  assert.equal(saved.durationSec, null); assert.equal(saved.creator, null); assert.equal(saved.rights.downloadAllowed, false);
  assert.equal(saved.imageUrl, undefined); assert.equal(saved.evil, undefined); assert.equal(saved.title.xx, undefined);
  assert.equal(saved.title.ru.length, 180); assert.equal(saved.tags.length, 32);
  const enriched = Owner.cleanFind({ ...candidate,
    imageUrl: 'https://i.pinimg.com/736x/ab/cd/ef/abcdef0123456789abcdef0123456789ab.jpg',
    imageWidth: 736, imageHeight: 90000, mediaType: 'image', authorName: 'Actual pinner', attributionRole: 'pinner' });
  assert.equal(enriched.imageWidth, 736); assert.equal(enriched.imageHeight, undefined);
  assert.equal(enriched.mediaType, 'image'); assert.equal(enriched.authorName, 'Actual pinner');
  assert.equal(enriched.attributionRole, 'pinner'); assert.equal(enriched.available, 'unknown');
  assert.equal(enriched.rights.holder, 'Pinterest', 'a pinner is not asserted to hold copyright');
  for (const bad of [{ ...candidate, id: 'forged' }, { ...candidate, delivery: { sourceUrl: 'https://evil.example/', embedUrl: candidate.delivery.embedUrl } },
    { ...candidate, delivery: { ...candidate.delivery, embedUrl: Media.buildEmbed('https://www.pinterest.com/pin/987654321/') } },
    { ...candidate, lastCheckedAt: '2026-02-30T12:00:00.000Z' }]) {
    assert.equal(Owner.prepareCommit({}, request(null, profile(), { finds: [bad] })).ok, false);
  }
});

test('find identities deduplicate and retention is bounded at 120', () => {
  const existing = Array.from({ length: 125 }, (_, n) => find(String(123456789 + n)));
  const candidate = find('234567891');
  const result = Owner.prepareCommit({ inspirationFinds: existing }, request(null, profile(), { finds: [candidate, candidate] }));
  assert.equal(result.settings.inspirationFinds.length, 120);
  assert.equal(result.settings.inspirationFinds.filter(row => row.id === candidate.id).length, 1);
});
