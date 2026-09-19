'use strict';

/* Finite, opt-in Inspiration discovery through the official Brave Search API.
 *
 * createInspirationDiscoveryService({ apiKey, requestJson, readAccount,
 *   writeAccount, now }).daily({ accountId, profile, shown, dayKey })
 *
 * requestJson({ url, headers, signal, maxBytes }) -> { status, json }.
 * readAccount(accountId) -> this module's dedicated JSON state, or null if new.
 * writeAccount(accountId, state) -> { ok: true } ONLY after durable persistence.
 * The host owns authentication and its storage/transaction lock. Use one service
 * instance per process; multiple processes need the host's cross-process lock.
 * An optional local dayKey must be within one UTC day. The immutable batch uses
 * that local day, while a separate quota allows at most two attempts per UTC day.
 * No profile, goals, history, account identifier or reference URL is sent to the
 * provider. Only bounded words from explicitly saved taste fields leave here.
 * Search metadata never proves playback, authorship, duration or image loading.
 *
 * Provider docs (read 2026-09-13):
 * https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
 * https://api-dashboard.search.brave.com/api-reference/images/image_search
 * A configured BRAVE_SEARCH_API_KEY with search access is required. No fallback
 * scraper, anonymous provider, invented media or live-provider claim is included.
 */

const Media = require('./public/inspiration-media-v1.js');
const { createHash } = require('node:crypto');

const VERSION = '1.0.0';
const MAX_QUERIES = 2;
const MAX_CANDIDATES = 3;
const MAX_RESULTS = 20;
const MAX_HISTORY = 180;
const COOLDOWN_DAYS = 45;
const TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const DAY_MS = 86400000;
const ENDPOINTS = Object.freeze({
  image: 'https://api.search.brave.com/res/v1/images/search',
  web: 'https://api.search.brave.com/res/v1/web/search',
});
const LOCALES = ['ru', 'en', 'de', 'uk', 'es'];
const FINAL_STATUSES = new Set(['ready', 'partial', 'empty', 'provider_error', 'provider_auth', 'provider_rate_limited']);
const STOP_WORDS = new Set(('the and with this that from for into just like want more very about my me a an of to on in is ' +
  'это этот эта эти как что для мне меня мой моя мои хочу нравится очень еще ещё чтобы такой такая такое ' +
  'pinterest tiktok photo photos image images video videos inspiration фотография фотографии фото картинки видео вдохновение').split(' '));

function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value, max) {
  return typeof value === 'string' ? value.slice(0, max * 4).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
function words(value, max = 24) {
  const clean = text(value, 1200).replace(/https?:\/\/\S+|www\.\S+|\S+@\S+/gi, ' ');
  return [...new Set((clean.toLowerCase().match(/[\p{L}\p{N}]{2,36}/gu) || []).filter(word => !STOP_WORDS.has(word)))].slice(0, max);
}
function stringList(values, limit, max = 48) {
  return [...new Set((Array.isArray(values) ? values.slice(0, limit * 2) : []).map(value => text(value, max)).filter(Boolean))].slice(0, limit);
}
function interestList(values, limit) {
  return stringList((Array.isArray(values) ? values.slice(0, limit * 2) : []).map(value => plain(value) ? value.id : value), limit);
}
function realDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function dayNumber(value) { return Date.parse(value + 'T00:00:00.000Z') / DAY_MS; }
function dateValue(value) {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function mediaKey(source) { return source ? `${source.provider}-${source.id}` : ''; }
function itemKey(value) {
  const direct = typeof value === 'string' ? value : plain(value) ? value.id || value.url || value.sourceUrl : '';
  const parsed = Media.parseSource(direct);
  if (parsed) return mediaKey(parsed);
  const match = typeof direct === 'string' && direct.match(/^(?:discovery-)?(pinterest|tiktok)[:-]([1-9]\d{5,21})$/);
  return match ? `${match[1]}-${match[2]}` : '';
}
function rotate(values, offset, count) {
  if (!values.length) return [];
  const start = ((offset % values.length) + values.length) % values.length;
  return values.slice(start).concat(values.slice(0, start)).slice(0, count);
}

function explicitTaste(raw) {
  const profile = plain(raw) ? raw : {};
  const references = [];
  const seen = new Set();
  for (const row of Array.isArray(profile.videoReferences) ? profile.videoReferences.slice(0, 10) : []) {
    if (!plain(row)) continue;
    const source = Media.parseSource(row.url);
    // Unsupported links can still provide explicitly entered taste words. They
    // are never fetched, placed in a query, or returned as discovered material.
    const key = mediaKey(source);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    references.push({ key, provider: source && source.provider, title: words(text(row.title, 180), 8),
      why: words(text(row.why, 320), 12), interests: stringList(row.interestIds, 12) });
  }
  const formats = Object.hasOwn(profile, 'formats') ? stringList(profile.formats, 5) : ['image', 'edit'];
  return {
    enabled: profile.discoveryEnabled === true,
    style: words(text(profile.visualTaste, 600), 48),
    custom: words(text(profile.customInterests, 300), 24),
    interests: interestList(profile.interests, 16),
    references,
    ownKeys: new Set(references.map(row => row.key).filter(Boolean)),
    formats,
  };
}

function buildQueries(rawProfile, dayKey) {
  if (!realDay(dayKey)) return [];
  const taste = explicitTaste(rawProfile);
  if (!taste.enabled) return [];
  const specific = new Set(taste.style.concat(taste.custom, ...taste.references.map(ref => ref.title.concat(ref.why))));
  // An empty profile or a broad category alone is not a personal visual style.
  if (specific.size < 2) return [];
  const providers = [];
  if (taste.formats.includes('image')) providers.push('pinterest');
  if (taste.formats.includes('edit') || taste.formats.includes('video')) providers.push('tiktok');
  if (!providers.length) return [];
  const day = dayNumber(dayKey);
  return Array.from({ length: MAX_QUERIES }, (_, index) => {
    const provider = providers[index % providers.length];
    const compatible = taste.references.filter(ref => !ref.provider || ref.provider === provider);
    const pool = compatible.length ? compatible : taste.references;
    const reference = pool.length ? pool[(day + index) % pool.length] : null;
    const interests = rotate(reference && reference.interests.length ? reference.interests : taste.interests, day + index, 2);
    const terms = [...new Set([
      ...rotate(taste.style, day + index * 6, 6),
      ...(reference ? reference.title.slice(0, 4).concat(reference.why.slice(0, 6)) : []),
      ...rotate(taste.custom, day + index * 4, 4),
      ...interests.flatMap(value => words(value, 2)),
    ])].slice(0, 20);
    const intent = provider === 'tiktok' ? 'short edit -trailer -compilation' : index % 2 ? 'visual composition' : 'photography aesthetic';
    const joined = terms.join(' ');
    const termText = joined.length <= 280 ? joined : joined.slice(0, 280).replace(/\s+\S*$/, '');
    return {
      kind: provider === 'pinterest' ? 'image' : 'web', provider,
      q: `site:${provider === 'pinterest' ? 'pinterest.com/pin/' : 'tiktok.com/@'} ${termText} ${intent}`,
      interestIds: interests,
      keywords: terms.slice(0, 12),
    };
  });
}

function buildSearchCall(query, apiKey) {
  const url = new URL(ENDPOINTS[query.kind]);
  url.searchParams.set('q', query.q);
  url.searchParams.set('count', String(MAX_RESULTS));
  url.searchParams.set('safesearch', 'strict');
  url.searchParams.set('spellcheck', 'false');
  // Recent indexed pages are a search preference, never proof of the video's
  // publication date. Image composition does not depend on publication age.
  if (query.provider === 'tiktok') url.searchParams.set('freshness', 'py');
  // No user IP, location, account id, cookies or profile locale is forwarded.
  return { url: url.href, headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey }, maxBytes: MAX_RESPONSE_BYTES };
}

function localized(value) { return Object.fromEntries(LOCALES.map(locale => [locale, value])); }
function metadataBody(source) {
  const label = source.provider === 'pinterest' ? 'Pinterest' : 'TikTok';
  return {
    ru: `Найдено в ${label} по твоему визуальному вкусу. Содержимое и доступность ещё не проверены.`,
    en: `Found on ${label} from your visual taste. Content and availability have not been verified.`,
    de: `Auf ${label} nach deinem visuellen Geschmack gefunden. Inhalt und Verfügbarkeit sind noch ungeprüft.`,
    uk: `Знайдено в ${label} за твоїм візуальним смаком. Вміст і доступність ще не перевірені.`,
    es: `Encontrado en ${label} según tu gusto visual. El contenido y la disponibilidad aún no se han verificado.`,
  };
}

function candidateFromRow(row, query, checkedAt) {
  if (!plain(row) || row.family_friendly === false) return null;
  // Only the response's actual original page URL selects an exact public post.
  // Titles, snippets, redirects, thumbnail URLs and metadata hints cannot do it.
  const source = Media.parseSource(row.url);
  if (!source || source.provider !== query.provider) return null;
  const title = text(row.title, 180);
  if (!title) return null;
  const candidate = {
    id: mediaKey(source), source: source.provider, externalId: source.id,
    format: source.format, lang: source.provider === 'pinterest' ? 'none' : 'unknown',
    languageVerified: false, titleLanguage: 'unknown', durationSec: null,
    interestIds: stringList(query.interestIds, 4), tags: stringList(query.interestIds, 4),
    keywords: stringList(query.keywords, 12, 36),
    title: localized(title), body: metadataBody(source),
    creator: null, attributionRole: source.authorHandle ? 'poster' : 'platform',
    rights: {
      kind: 'official-source', holder: source.authorHandle ? `TikTok @${source.authorHandle}` : 'Pinterest',
      url: source.provider === 'pinterest' ? 'https://help.pinterest.com/en/business/article/build-a-website-widget' : 'https://developers.tiktok.com/doc/embed-player/',
      embedAllowed: true, downloadAllowed: false,
    },
    delivery: { policy: 'embed', sourceUrl: source.url, embedUrl: Media.buildEmbed(source.url) },
    lastCheckedAt: checkedAt, checkMethod: 'metadata', available: 'unknown',
    availabilityReason: 'not_checked', playbackVerified: false, imageViewed: false,
    discovery: { provider: 'brave', method: query.kind === 'image' ? 'image-search' : 'web-search' },
  };
  // properties.url is the original image URL in Brave Image Search's schema.
  // The proxy thumbnail is not rewritten into a guessed Pinterest CDN URL.
  if (source.provider === 'pinterest') {
    const imageUrl = Media.safeImage(plain(row.properties) ? row.properties.url : '', 'pinterest')
      || Media.safeImage(plain(row.thumbnail) ? row.thumbnail.src : '', 'pinterest');
    if (imageUrl) candidate.imageUrl = imageUrl;
  }
  return candidate;
}

function candidatesFromResponse(payload, query, checkedAt) {
  if (!plain(payload) || (plain(payload.extra) && payload.extra.might_be_offensive === true)) return [];
  const rows = query.kind === 'image' ? payload.results : plain(payload.web) ? payload.web.results : null;
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows.slice(0, MAX_RESULTS).map(row => candidateFromRow(row, query, checkedAt)).filter(row => {
    if (!row || seen.has(row.id)) return false;
    seen.add(row.id); return true;
  });
}

function cleanHistory(raw, dayKey) {
  const byKey = new Map();
  for (const row of Array.isArray(raw) ? raw.slice(-MAX_HISTORY * 2) : []) {
    if (!plain(row) || !realDay(row.day)) continue;
    const id = itemKey(row.id);
    const age = dayNumber(dayKey) - dayNumber(row.day);
    if (!id || age < 0 || age > COOLDOWN_DAYS) continue;
    const previous = byKey.get(id);
    if (!previous || row.day > previous.day) byKey.set(id, { id, day: row.day });
  }
  return [...byKey.values()].sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id)).slice(-MAX_HISTORY);
}

function restoreCandidate(row) {
  if (!plain(row) || !plain(row.delivery) || !plain(row.title)) return null;
  const source = Media.parseSource(row.delivery.sourceUrl);
  if (!source || row.id !== mediaKey(source) || !dateValue(row.lastCheckedAt)) return null;
  // Rebuild a bounded, safe metadata-only candidate rather than trusting stored
  // availability, author, embed HTML, rights, paths or arbitrary extra fields.
  return candidateFromRow({ url: source.url, title: row.title.ru,
    properties: { url: row.imageUrl } }, { provider: source.provider,
    kind: source.provider === 'pinterest' ? 'image' : 'web',
    interestIds: row.interestIds, keywords: row.keywords }, new Date(row.lastCheckedAt).toISOString());
}

function normalizeAccount(raw, dayKey, utcDayKey = dayKey) {
  if (raw === null || raw === undefined) return { version: 1, day: null, quota: { dayKey: utcDayKey, attempts: 0 }, history: [] };
  if (!plain(raw) || raw.version !== 1 || !Array.isArray(raw.history) || (raw.day !== null && !plain(raw.day))
    || !plain(raw.quota) || !realDay(raw.quota.dayKey) || !Number.isInteger(raw.quota.attempts)
    || raw.quota.attempts < 0 || raw.quota.attempts > MAX_QUERIES || raw.quota.dayKey > utcDayKey) throw new Error('corrupt-discovery-state');
  let day = null;
  if (raw.day) {
    if (!realDay(raw.day.dayKey) || !Number.isInteger(raw.day.attempts) || raw.day.attempts < 0 || raw.day.attempts > MAX_QUERIES
      || (!FINAL_STATUSES.has(raw.day.status) && raw.day.status !== 'pending')) throw new Error('corrupt-discovery-state');
    if (raw.day.dayKey > dayKey) throw new Error('future-discovery-state');
    if (raw.day.dayKey === dayKey) day = {
      dayKey, attempts: raw.day.attempts, status: raw.day.status,
      candidates: (Array.isArray(raw.day.candidates) ? raw.day.candidates.slice(0, MAX_CANDIDATES) : []).map(restoreCandidate).filter(Boolean),
      completedAt: dateValue(raw.day.completedAt) ? new Date(raw.day.completedAt).toISOString() : null,
      profileFingerprint: /^[a-f0-9]{64}$/.test(raw.day.profileFingerprint || '') ? raw.day.profileFingerprint : '',
    };
  }
  return { version: 1, day, quota: { dayKey: utcDayKey, attempts: raw.quota.dayKey === utcDayKey ? raw.quota.attempts : 0 },
    history: cleanHistory(raw.history, dayKey) };
}

function finiteSelection(groups, excluded) {
  const output = [], seen = new Set(excluded);
  // Alternate the two specific searches; one prolific result set cannot drown
  // out the other medium or reference. No popularity metrics are consulted.
  for (let index = 0; index < MAX_RESULTS && output.length < MAX_CANDIDATES; index++) {
    for (const group of groups) {
      const row = group[index];
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id); output.push(row);
      if (output.length === MAX_CANDIDATES) break;
    }
  }
  return output;
}

function createInspirationDiscoveryService(rawOptions = {}) {
  const options = plain(rawOptions) ? rawOptions : {};
  const apiKey = text(options.apiKey, 500);
  const requestJson = typeof options.requestJson === 'function' ? options.requestJson : null;
  const readAccount = typeof options.readAccount === 'function' ? options.readAccount : null;
  const writeAccount = typeof options.writeAccount === 'function' ? options.writeAccount : null;
  const now = typeof options.now === 'function' ? options.now : () => new Date();
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
    ? Math.min(options.timeoutMs, TIMEOUT_MS) : TIMEOUT_MS;
  const providerAvailable = !!(apiKey && requestJson);
  const locks = new Map();

  function status({ profile } = {}) {
    const enabled = plain(profile) && profile.discoveryEnabled === true;
    return { provider: 'brave', providerAvailable, enabled,
      status: !enabled ? 'disabled' : !providerAvailable ? 'unconfigured' : !readAccount || !writeAccount ? 'storage_unavailable' : 'ready',
      limit: MAX_QUERIES, batchSize: MAX_CANDIDATES };
  }

  function result(state, statusCode, dayKey, cached = false, candidates = []) {
    return { provider: 'brave', providerAvailable, status: statusCode, dayKey, cached,
      candidates, attempts: state && state.quota ? state.quota.attempts : 0,
      quotaDayKey: state && state.quota ? state.quota.dayKey : null,
      limit: MAX_QUERIES, batchSize: MAX_CANDIDATES };
  }

  async function persist(accountId, state) {
    const receipt = await writeAccount(accountId, JSON.parse(JSON.stringify(state)));
    if (!plain(receipt) || receipt.ok !== true) throw new Error('discovery-save-unconfirmed');
  }

  async function search(query) {
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => { controller.abort(); resolve({ status: 0, json: null }); }, timeoutMs);
      });
      return await Promise.race([Promise.resolve().then(() => requestJson({
        ...buildSearchCall(query, apiKey), signal: controller.signal,
      })).catch(() => ({ status: 0, json: null })), timeout]);
    } finally { clearTimeout(timer); }
  }

  async function run(input) {
    const at = dateValue(now());
    if (!at) return result(null, 'invalid_time', null);
    const utcDayKey = at.toISOString().slice(0, 10);
    const dayKey = input.dayKey === undefined ? utcDayKey : input.dayKey;
    if (!realDay(dayKey) || Math.abs(dayNumber(dayKey) - dayNumber(utcDayKey)) > 1) return result(null, 'invalid_day', null);
    const accountId = input.accountId, profile = input.profile;
    let state;
    try { state = normalizeAccount(await readAccount(accountId), dayKey, utcDayKey); }
    catch { return result(null, 'storage_error', dayKey); }
    const taste = explicitTaste(profile);
    if (state.day && FINAL_STATUSES.has(state.day.status)) {
      // A changed preference can remove a cached card but cannot create a second
      // batch. Today's shown receipt must not erase the batch on a reload.
      const cached = state.day.candidates.filter(row => !taste.ownKeys.has(row.id)
        && (taste.formats.includes(row.format) || row.format === 'edit' && taste.formats.includes('video')));
      return result(state, state.day.status, dayKey, true, cached);
    }
    if (state.day && state.day.attempts > 0 || state.quota.attempts > 0) return result(state, 'daily_limit', dayKey, true);
    const queries = buildQueries(profile, dayKey);
    if (!queries.length) return result(state, 'needs_taste', dayKey);
    const shown = cleanHistory([...(plain(profile) && Array.isArray(profile.shownHistory) ? profile.shownHistory.slice(-MAX_HISTORY) : []),
      ...(Array.isArray(input.shown) ? input.shown.slice(-MAX_HISTORY) : [])], dayKey);
    const excluded = new Set([...taste.ownKeys, ...state.history.map(row => row.id), ...shown.map(row => row.id)]);
    // Reserve the entire bounded attempt budget BEFORE any network call. A
    // crash or ambiguous final save cannot make a reload buy another search.
    const profileFingerprint = createHash('sha256').update(JSON.stringify({
      style: taste.style, custom: taste.custom, interests: taste.interests,
      references: taste.references, formats: taste.formats,
    })).digest('hex');
    state.day = { dayKey, attempts: queries.length, status: 'pending', candidates: [], completedAt: null, profileFingerprint };
    state.quota = { dayKey: utcDayKey, attempts: queries.length };
    try { await persist(accountId, state); }
    catch { return result(state, 'storage_error', dayKey); }
    const groups = [];
    let successes = 0, failure = 'provider_error';
    for (const query of queries) {
      const response = await search(query);
      const code = Number(response && response.status);
      const payload = response && response.json;
      const rows = query.kind === 'image' ? plain(payload) && payload.results : plain(payload) && plain(payload.web) && payload.web.results;
      if (code !== 200 || !Array.isArray(rows)) {
        if (code === 401 || code === 403) { failure = 'provider_auth'; break; }
        if (code === 429) { failure = 'provider_rate_limited'; break; }
        groups.push([]); continue;
      }
      successes++;
      const checkedAt = dateValue(now());
      groups.push(candidatesFromResponse(payload, query, (checkedAt || at).toISOString()));
    }
    const candidates = finiteSelection(groups, excluded);
    const statusCode = successes === queries.length ? candidates.length ? 'ready' : 'empty' : candidates.length ? 'partial' : failure;
    state.day = { ...state.day, status: statusCode, candidates,
      completedAt: (dateValue(now()) || at).toISOString() };
    state.history = cleanHistory(state.history.concat(candidates.map(row => ({ id: row.id, day: dayKey }))), dayKey);
    try { await persist(accountId, state); }
    catch { return result({ quota: state.quota }, 'storage_error', dayKey); }
    return result(state, statusCode, dayKey, false, candidates);
  }

  async function daily(input = {}) {
    const at = dateValue(now());
    const dayKey = at ? at.toISOString().slice(0, 10) : null;
    if (!dayKey) return result(null, 'invalid_time', null);
    if (!plain(input)) return result(null, 'invalid_account', dayKey);
    const accountId = text(input.accountId, 120);
    if (!accountId || accountId !== input.accountId || !/^[a-z0-9_-]+$/i.test(accountId)) return result(null, 'invalid_account', dayKey);
    const setup = status({ profile: input.profile });
    if (setup.status !== 'ready') return result(null, setup.status, dayKey);
    // Queue per account and re-read the durable state inside the lock. Different
    // accounts may proceed independently; no cache data is shared between them.
    const previous = locks.get(accountId) || Promise.resolve();
    const pending = previous.catch(() => {}).then(() => run(input));
    locks.set(accountId, pending);
    try { return await pending; }
    finally { if (locks.get(accountId) === pending) locks.delete(accountId); }
  }

  return Object.freeze({ VERSION, providerAvailable, status, daily });
}

module.exports = Object.freeze({ VERSION, MAX_QUERIES, MAX_CANDIDATES, MAX_HISTORY, COOLDOWN_DAYS,
  ENDPOINTS, buildQueries, buildSearchCall, candidatesFromResponse, normalizeAccount,
  createInspirationDiscoveryService, createService: createInspirationDiscoveryService });
