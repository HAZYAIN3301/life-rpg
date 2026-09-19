'use strict';

// The account host supplies the current settings AFTER reading the request and
// commits this proposal through its existing settings/tasks WAL. No file IO or
// success receipt lives here. This owner never replaces unrelated settings.
const Profile = require('./public/inspiration-profile-v1.js');
const Media = require('./public/inspiration-media-v1.js');

const MAX_BYTES = 256 * 1024;
const MAX_FINDS = 120;
const LOCALES = Object.freeze(['ru', 'en', 'de', 'uk', 'es']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (plain(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const equal = (a, b) => canonical(a) === canonical(b);
const text = (value, max) => typeof value === 'string'
  ? value.slice(0, max * 4).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
function words(values, limit) {
  return [...new Set((Array.isArray(values) ? values.slice(0, limit * 2) : []).map(value => text(value, 64)).filter(Boolean))].slice(0, limit);
}
function localized(raw, max) {
  if (!plain(raw)) return null;
  const output = {};
  for (const locale of LOCALES) {
    const value = text(raw[locale], max); if (value) output[locale] = value;
  }
  return output.ru ? output : null;
}
function checkedAt(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10) ? date.toISOString() : null;
}

// Client metadata is display material, never proof of playback, availability,
// authorship, duration, rights to copy, or a path to fetch arbitrary resources.
function cleanFind(raw) {
  if (!plain(raw) || !plain(raw.delivery)) return null;
  const source = Media.parseSource(raw.delivery.sourceUrl);
  if (!source || !Media.isAllowedEmbed(raw.delivery.embedUrl, source)) return null;
  const id = `${source.provider}-${source.id}`;
  if (raw.id !== id) return null;
  const title = localized(raw.title, 180), body = localized(raw.body, 1600);
  const at = checkedAt(raw.lastCheckedAt);
  if (!title || !body || !at) return null;
  const item = {
    id, source: source.provider, externalId: source.id, format: source.format,
    lang: 'unknown',
    languageVerified: false, titleLanguage: 'unknown', durationSec: null,
    interestIds: words(raw.interestIds, 16), tags: words(raw.tags, 32), keywords: words(raw.keywords, 32),
    title, body, creator: null, attributionRole: source.authorHandle ? 'poster' : 'platform',
    rights: { kind: 'official-source', holder: source.authorHandle ? `TikTok @${source.authorHandle}` : 'Pinterest',
      url: source.provider === 'pinterest' ? 'https://help.pinterest.com/en/business/article/build-a-website-widget' : 'https://developers.tiktok.com/doc/embed-player/',
      embedAllowed: true, downloadAllowed: false },
    delivery: { policy: 'embed', sourceUrl: source.url, embedUrl: Media.buildEmbed(source) },
    lastCheckedAt: at, checkMethod: 'metadata', available: 'unknown', availabilityReason: 'not_checked',
    playbackVerified: false, imageViewed: false,
  };
  const image = Media.safeImage(raw.imageUrl, source.provider);
  if (image) {
    item.imageUrl = image;
    for (const key of ['imageWidth', 'imageHeight']) {
      if (Number.isInteger(raw[key]) && raw[key] > 0 && raw[key] <= 16384) item[key] = raw[key];
    }
  }
  if (['image', 'video', 'unknown'].includes(raw.mediaType)) item.mediaType = raw.mediaType;
  const authorName = text(raw.authorName, 120);
  if (authorName) item.authorName = authorName;
  if (source.provider === 'pinterest' && raw.attributionRole === 'pinner') item.attributionRole = 'pinner';
  if (plain(raw.discovery) && raw.discovery.provider === 'brave') item.discovery = {
    provider: 'brave', method: source.provider === 'pinterest' ? 'image-search' : 'web-search',
  };
  return item;
}
function normalizedProfile(value, nullable) {
  if (nullable && value === null) return Profile.emptyProfile();
  if (!plain(value)) return null;
  const normalized = Profile.normalize(value);
  return equal(value, normalized) ? normalized : null;
}
function failure(error, status = 400) { return { ok: false, status, error }; }

function prepareCommit(currentSettings, payload) {
  if (!plain(currentSettings)) return failure('inspiration_settings_corrupt', 409);
  if (!plain(payload) || !own(payload, 'base') || !own(payload, 'profile') || !Array.isArray(payload.finds)
    || payload.finds.length > 3 || Object.keys(payload).some(key => !['base', 'profile', 'finds', 'baseDraft'].includes(key))) {
    return failure('invalid_inspiration_profile');
  }
  let size;
  try { size = Buffer.byteLength(JSON.stringify(payload)); } catch { return failure('invalid_inspiration_profile'); }
  if (size > MAX_BYTES) return failure('inspiration_profile_too_large', 413);
  const base = normalizedProfile(payload.base, true), target = normalizedProfile(payload.profile, false);
  if (!base || !target || own(payload, 'baseDraft') && payload.baseDraft !== null && !plain(payload.baseDraft)) {
    return failure('invalid_inspiration_profile');
  }
  const incoming = payload.finds.map(cleanFind);
  if (incoming.some(row => !row)) return failure('invalid_inspiration_find');
  const actual = Profile.normalize(currentSettings.inspiration);
  const currentDraft = own(currentSettings, 'inspirationDraft') ? currentSettings.inspirationDraft : null;
  const deletesDraft = own(payload, 'baseDraft');
  const existing = (Array.isArray(currentSettings.inspirationFinds) ? currentSettings.inspirationFinds.slice(-MAX_FINDS * 2) : [])
    .map(cleanFind).filter(Boolean);
  const byId = new Map();
  for (const row of existing) if (!byId.has(row.id)) byId.set(row.id, row);
  // Fresh metadata may refresh a rediscovered identity after its cooldown. An
  // old retry cannot roll it back, and an equal timestamp is no proof that two
  // different metadata payloads are the same committed operation.
  const findsApplied = incoming.every(row => {
    const stored = byId.get(row.id);
    return stored && (stored.lastCheckedAt > row.lastCheckedAt || equal(stored, row));
  });
  if (equal(actual, target) && findsApplied && (!deletesDraft || currentDraft === null)) {
    return { ok: true, replay: true, settings: clone(currentSettings) };
  }
  if (!equal(actual, base)) return failure('inspiration_revision_conflict', 409);
  if (deletesDraft && !equal(currentDraft, payload.baseDraft)) return failure('inspiration_draft_conflict', 409);
  for (const row of incoming) {
    const stored = byId.get(row.id);
    if (stored && stored.lastCheckedAt === row.lastCheckedAt && !equal(stored, row)) {
      return failure('inspiration_find_conflict', 409);
    }
    if (!stored || row.lastCheckedAt > stored.lastCheckedAt) byId.set(row.id, row);
  }
  const settings = clone(currentSettings);
  settings.inspiration = target;
  if (incoming.length) settings.inspirationFinds = [...byId.values()].slice(-MAX_FINDS);
  if (deletesDraft) delete settings.inspirationDraft;
  return { ok: true, replay: false, settings };
}

module.exports = Object.freeze({ VERSION: 1, MAX_BYTES, MAX_FINDS, cleanFind, prepareCommit });
