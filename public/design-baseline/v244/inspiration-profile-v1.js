/* Satoru Inspiration Profile v1 — explicit taste, finite daily digest.
 *
 * This module deliberately separates personalization from engagement ranking.
 * The person confirms interests and formats. A digest is then fixed for the day,
 * contains at most three items, and never changes on reload or by pressing a
 * hidden "more" control. Feedback only changes later digests.
 *
 * Pure module: no DOM, storage, network, popularity signals or randomness.
 */
(function exposeInspirationProfile(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationProfileV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildInspirationProfile() {
  'use strict';

  const VERSION = '1.2.0';
  const FORMATS = Object.freeze(['edit', 'video', 'image', 'quote', 'podcast']);
  const VERDICTS = Object.freeze(['more', 'not_for_me']);
  const MAX_INTERESTS = 16;
  const MAX_BLOCKED = 12;
  const MAX_FEEDBACK = 120;
  const MAX_SIGNALS = 64;
  const MAX_IMPORTS = 8;
  const MAX_VIDEO_REFERENCES = 10;
  const MAX_REASON = 320;
  const MAX_CUSTOM_INTEREST_TEXT = 300;
  const DIGEST_SIZE = 3;
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

  const text = (value, max) => {
    const out = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    return out ? out.slice(0, max) : '';
  };
  const slug = (value) => text(value, 80).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яёіїєґ]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48);

  // Human wording must resolve to the stable semantic ids used by the curated
  // catalog. Otherwise a perfectly reasonable entry such as “Spider-Verse” or
  // “Re:Zero” saves successfully but can never match a single material.
  const INTEREST_ALIASES = Object.freeze([
    [/spider[\s:-]*verse|человек[\s-]*паук|супергер|superhero|marvel/i, 'superhero'],
    [/re[\s:-]*zero|аниме|anime|manga|манга/i, 'anime'],
    [/minecraft/i, 'minecraft'],
    [/бег|біг|running?|jog|laufen|correr/i, 'running'],
    [/йог|yoga/i, 'yoga'],
    [/спорт|sport|deporte|\bbody\b|тело|тіло|körper/i, 'sport'],
    [/фитнес|fitness|gym/i, 'fitness'],
    [/движ|рух|movement|bewegung|movimiento|mobility/i, 'movement'],
    [/восстанов|віднов|recovery|recover|erholung|recuperaci/i, 'recovery'],
    [/отдых|відпоч|rest|ruhe|descanso/i, 'rest'],
    [/здоров|health|gesund|salud/i, 'health'],
    [/анимац|анімац|animation|animaci|blender/i, 'animation'],
    [/монтаж|видео|video|youtube|tiktok|reels?/i, 'video'],
    [/контент|content/i, 'content'],
    [/твор|creative|kreativ|creativ|созидан|creativity/i, 'creative'],
    [/дизайн|design|diseñ/i, 'design'],
    [/искусств|мистец|kunst|arte|\bart\b/i, 'art'],
    [/музык|музик|music|musik|música/i, 'music'],
    [/космос|space|weltraum|espacio/i, 'space'],
    [/наук|науч|science|wissenschaft|ciencia|research/i, 'science'],
    [/технолог|technology|technologie|tecnolog|\btech\b|программ|\bcode\b|robot/i, 'technology'],
    [/обуч|навчан|learning|lernen|aprendiz|learn/i, 'learning'],
    [/уч[её]б|навч|study|studium|estudio/i, 'study'],
    [/книг|чтен|чит|reading?|lesen|lectura/i, 'reading'],
    [/философ|філософ|philosophy|philosophie|filosof/i, 'philosophy'],
    [/путеш|подорож|travel|reisen|viaj/i, 'travel'],
    [/поход|похід|hiking|wandern|senderismo/i, 'hiking'],
    [/гор[ыа]?|mountain|berge?|montañ/i, 'mountains'],
    [/природ|nature|natur|naturaleza/i, 'nature'],
    [/игр|ігр|games?|gaming|spiele?|juego/i, 'games'],
    [/бизнес|бізнес|business|negocio|карьер|кар'єр|работ|робот|\bдело\b/i, 'business'],
    [/продукт|product|produkt|producto|startup|стартап/i, 'product'],
    [/финанс|фінанс|finance|finanz/i, 'finance'],
    [/своими руками|\bdiy\b|craft/i, 'diy'],
    [/люди|общени|спілку|social|soziale?|personas?|gente/i, 'social'],
    [/концентрац|зосеред|focus|fokus|enfoque/i, 'focus'],
    [/пространств|простір|дом|дім|home|zuhause|casa/i, 'home'],
  ]);
  function semanticInterestId(value) {
    const raw = text(value, 120);
    if (!raw) return '';
    const stable = slug(raw);
    const known = new Set(INTEREST_ALIASES.map((entry) => entry[1]));
    if (known.has(stable)) return stable;
    const found = INTEREST_ALIASES.find(([pattern]) => pattern.test(raw));
    return found ? found[1] : '';
  }

  function semanticInterestIds(value) {
    const raw = text(value, 1200), out = [];
    if (!raw) return out;
    for (const [pattern, id] of INTEREST_ALIASES) {
      if (pattern.test(raw) && !out.includes(id)) out.push(id);
    }
    return out.slice(0, 12);
  }

  function cleanInterest(raw) {
    if (typeof raw === 'string') raw = { label: raw };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const label = text(raw.label, 64);
    const id = semanticInterestId(raw.id) || semanticInterestId(label) || slug(raw.id || label);
    if (!id || !label) return null;
    const out = { id, label };
    const source = text(raw.source, 80); if (source) out.source = source;
    return out;
  }

  function uniqueInterests(rows, max = MAX_INTERESTS) {
    const out = [], ids = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      const item = cleanInterest(row);
      if (!item || ids.has(item.id)) continue;
      ids.add(item.id); out.push(item);
      if (out.length >= max) break;
    }
    return out;
  }

  function cleanWords(rows, max) {
    const out = [], seen = new Set();
    const source = Array.isArray(rows) ? rows : String(rows || '').split(/[,;\n]/);
    for (const row of source) {
      const value = text(row, 60);
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key); out.push(value);
      if (out.length >= max) break;
    }
    return out;
  }

  function cleanFeedback(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const itemId = text(raw.itemId, 64);
    if (!itemId || !VERDICTS.includes(raw.verdict) || !ISO_DAY.test(String(raw.day || ''))) return null;
    const reason = text(raw.reason, MAX_REASON);
    const reasonInterestIds = cleanWords(raw.reasonInterestIds, 12).map(slug).filter(Boolean);
    for (const id of semanticInterestIds(reason)) if (!reasonInterestIds.includes(id)) reasonInterestIds.push(id);
    const out = {
      itemId,
      verdict: raw.verdict,
      day: raw.day,
      interestIds: cleanWords(raw.interestIds, 12).map(slug).filter(Boolean),
      format: FORMATS.includes(raw.format) ? raw.format : null,
    };
    if (reason) out.reason = reason;
    if (reasonInterestIds.length) out.reasonInterestIds = reasonInterestIds.slice(0, 12);
    return out;
  }

  function cleanSignal(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const label = text(raw.label, 180), id = slug(raw.id || label);
    if (!id || !label) return null;
    return {
      id, label,
      score: Math.max(0, Math.min(100000, Math.round(Number(raw.score) || 0))),
      count: Math.max(1, Math.min(100000, Math.round(Number(raw.count) || 1))),
      sources: cleanWords(raw.sources, 8).map(slug).filter(Boolean),
    };
  }

  function cleanImport(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = text(raw.id, 64), source = text(raw.source, 40), importedOn = text(raw.importedOn, 10);
    if (!id || !source || !ISO_DAY.test(importedOn)) return null;
    const integer = (value) => Math.max(0, Math.min(1000000, Math.round(Number(value) || 0)));
    return {
      id, source, importedOn,
      signals: integer(raw.signals), searches: integer(raw.searches), hashtags: integer(raw.hashtags),
      videos: integer(raw.videos), explicitInterests: integer(raw.explicitInterests),
    };
  }

  function cleanVideoReference(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    let url;
    try {
      const parsed = new URL(text(raw.url, 1000));
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      url = parsed.href.slice(0, 1000);
    } catch { return null; }
    const why = text(raw.why, MAX_REASON), title = text(raw.title, 180);
    const interestIds = cleanWords(raw.interestIds, 12).map(slug).filter(Boolean);
    for (const id of semanticInterestIds(`${title} ${why}`)) if (!interestIds.includes(id)) interestIds.push(id);
    const out = { id: text(raw.id, 64) || `video-${stableHash(url).toString(36)}`, url };
    if (why) out.why = why;
    if (title) out.title = title;
    if (interestIds.length) out.interestIds = interestIds.slice(0, 12);
    return out;
  }

  function emptyProfile() {
    return {
      version: 1,
      configured: false,
      interests: [],
      customInterests: '',
      formats: FORMATS.slice(),
      blocked: [],
      feedback: [],
      signals: [],
      imports: [],
      videoReferences: [],
      digest: null,
    };
  }

  function normalize(raw) {
    const out = emptyProfile();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    out.interests = uniqueInterests(raw.interests);
    out.customInterests = text(raw.customInterests, MAX_CUSTOM_INTEREST_TEXT);
    const formats = cleanWords(raw.formats, FORMATS.length).filter((value) => FORMATS.includes(value));
    // Missing means the first-use default (all formats); an explicit empty
    // array means the person unchecked everything and must not be overwritten.
    if (Object.prototype.hasOwnProperty.call(raw, 'formats')) out.formats = formats;
    out.blocked = cleanWords(raw.blocked, MAX_BLOCKED);
    out.feedback = (Array.isArray(raw.feedback) ? raw.feedback : []).map(cleanFeedback).filter(Boolean).slice(-MAX_FEEDBACK);
    out.signals = (Array.isArray(raw.signals) ? raw.signals : []).map(cleanSignal).filter(Boolean).slice(0, MAX_SIGNALS);
    out.imports = (Array.isArray(raw.imports) ? raw.imports : []).map(cleanImport).filter(Boolean).slice(-MAX_IMPORTS);
    const referenceUrls = new Set();
    out.videoReferences = (Array.isArray(raw.videoReferences) ? raw.videoReferences : []).map(cleanVideoReference).filter((item) => {
      if (!item || referenceUrls.has(item.url)) return false;
      referenceUrls.add(item.url); return true;
    }).slice(0, MAX_VIDEO_REFERENCES);
    out.configured = raw.configured === true && out.interests.length > 0 && out.formats.length > 0;
    const digest = raw.digest;
    if (digest && typeof digest === 'object' && !Array.isArray(digest) && ISO_DAY.test(String(digest.day || ''))) {
      const ids = cleanWords(digest.ids, DIGEST_SIZE);
      const doneIds = cleanWords(digest.doneIds, DIGEST_SIZE).filter((id) => ids.includes(id));
      if (ids.length) out.digest = { day: digest.day, ids, doneIds };
    }
    return out;
  }

  function configure(raw) {
    const out = normalize(Object.assign({}, raw, { configured: true, digest: null }));
    out.configured = out.interests.length > 0 && out.formats.length > 0;
    return out;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value || '')) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function catalogRow(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = text(raw.id, 64);
    if (!id || !FORMATS.includes(raw.format)) return null;
    const interestIds = cleanWords(raw.interestIds, 16).map(slug).filter(Boolean);
    const title = text(raw.title, 140), body = text(raw.body, 1600);
    if (!title || !body || !interestIds.length) return null;
    return Object.assign({}, raw, { id, title, body, interestIds, format: raw.format });
  }

  function feedbackWeights(profile) {
    const weights = new Map();
    const p = normalize(profile);
    for (const row of p.feedback) {
      const delta = row.verdict === 'more' ? 2 : -3;
      for (const id of row.interestIds) weights.set(id, (weights.get(id) || 0) + delta);
      for (const id of row.reasonInterestIds || []) weights.set(id, (weights.get(id) || 0) + delta * 2);
    }
    for (const row of p.videoReferences) for (const id of row.interestIds || []) weights.set(id, (weights.get(id) || 0) + 4);
    return weights;
  }

  const TERM_STOP = new Set('that this with from your have just very more less because what when where then about into only also like does did the and для как что это этот эта просто очень потому если когда где тогда чтобы или либо мне меня тебе тебя такое такой такая есть был была были und der die das ein eine mit für von ist ich du weil aber oder dass sehr auch nur wenn dann warum und para que por una uno con del los las muy porque pero como donde cuando solo auch це цей ця просто дуже тому якщо коли де тоді щоб або мені тебе con porque pero como muy solo'.split(/\s+/));
  function meaningfulTerms(value) {
    const out = [], seen = new Set();
    for (const word of String(value || '').toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []) {
      if (TERM_STOP.has(word) || seen.has(word)) continue;
      seen.add(word); out.push(word);
      if (out.length >= 12) break;
    }
    return out;
  }

  function explanationScore(item, profile) {
    const p = normalize(profile), haystack = `${item.title} ${item.body} ${(item.interestIds || []).join(' ')}`.toLocaleLowerCase();
    let value = 0;
    for (const row of p.feedback) {
      const hits = meaningfulTerms(row.reason).filter((term) => haystack.includes(term)).length;
      value += hits * (row.verdict === 'more' ? 1.5 : -2);
    }
    for (const row of p.videoReferences) {
      const hits = meaningfulTerms(`${row.title || ''} ${row.why || ''}`).filter((term) => haystack.includes(term)).length;
      value += hits * 2;
    }
    return value;
  }

  function blocked(item, profile) {
    const haystack = `${item.title} ${item.body} ${(item.interestIds || []).join(' ')}`.toLocaleLowerCase();
    return normalize(profile).blocked.some((term) => haystack.includes(term.toLocaleLowerCase()));
  }

  function score(item, profile, day) {
    const p = normalize(profile);
    const wanted = new Set(p.interests.map((interest) => interest.id));
    const weights = feedbackWeights(p);
    const matches = item.interestIds.filter((id) => wanted.has(id));
    const learned = item.interestIds.reduce((sum, id) => sum + (weights.get(id) || 0), 0);
    return matches.length * 20 + learned + explanationScore(item, p) + (p.formats.includes(item.format) ? 4 : 0)
      + (stableHash(`${day}:${item.id}`) % 1000) / 1000;
  }

  function choose(catalog, profile, day, size = DIGEST_SIZE) {
    const p = normalize(profile);
    if (!p.configured || !ISO_DAY.test(String(day || ''))) return [];
    const limit = Math.max(1, Math.min(DIGEST_SIZE, Math.floor(Number(size)) || DIGEST_SIZE));
    const wanted = new Set(p.interests.map((interest) => interest.id));
    const hidden = new Set(p.feedback.filter((row) => row.verdict === 'not_for_me').map((row) => row.itemId));
    const rows = (Array.isArray(catalog) ? catalog : []).map(catalogRow).filter(Boolean)
      // Never fill the screen with merely available material. Every row must
      // match an interest the person explicitly confirmed; “not for me” hides
      // the exact item from later digests without mutating today's fixed deck.
      .filter((item) => p.formats.includes(item.format) && !hidden.has(item.id)
        && item.interestIds.some((id) => wanted.has(id)) && !blocked(item, p))
      .sort((a, b) => score(b, p, day) - score(a, p, day) || a.id.localeCompare(b.id));
    const selected = [], formats = new Set();
    for (const row of rows) {
      if (formats.has(row.format)) continue;
      selected.push(row); formats.add(row.format);
      if (selected.length >= limit) return selected;
    }
    for (const row of rows) {
      if (selected.some((item) => item.id === row.id)) continue;
      selected.push(row);
      if (selected.length >= limit) break;
    }
    return selected;
  }

  function ensureDigest(rawProfile, catalog, day) {
    const profile = normalize(rawProfile);
    const byId = new Map((Array.isArray(catalog) ? catalog : []).map(catalogRow).filter(Boolean).map((item) => [item.id, item]));
    if (profile.digest && profile.digest.day === day) {
      const items = profile.digest.ids.map((id) => byId.get(id)).filter(Boolean);
      if (items.length === profile.digest.ids.length) return { profile, items };
    }
    const items = choose(catalog, profile, day, DIGEST_SIZE);
    profile.digest = items.length ? { day, ids: items.map((item) => item.id), doneIds: [] } : null;
    return { profile, items };
  }

  function markDone(rawProfile, itemId) {
    const profile = normalize(rawProfile);
    if (!profile.digest || !profile.digest.ids.includes(String(itemId))) return profile;
    if (!profile.digest.doneIds.includes(String(itemId))) profile.digest.doneIds.push(String(itemId));
    return profile;
  }

  function recordFeedback(rawProfile, rawItem, verdict, day, reason = '') {
    const item = catalogRow(rawItem);
    let profile = markDone(rawProfile, item && item.id);
    if (!item || !VERDICTS.includes(verdict) || !ISO_DAY.test(String(day || ''))) return profile;
    profile.feedback = profile.feedback.filter((row) => row.itemId !== item.id);
    profile.feedback.push(cleanFeedback({ itemId: item.id, verdict, day, interestIds: item.interestIds.slice(0, 12), format: item.format, reason }));
    profile.feedback = profile.feedback.slice(-MAX_FEEDBACK);
    return profile;
  }

  function isDigestDone(profile) {
    const p = normalize(profile);
    return !!(p.digest && p.digest.ids.length && p.digest.ids.every((id) => p.digest.doneIds.includes(id)));
  }

  function reason(item, profile) {
    const p = normalize(profile), labels = new Map(p.interests.map((interest) => [interest.id, interest.label]));
    return (item && Array.isArray(item.interestIds) ? item.interestIds : [])
      .map((id) => labels.get(slug(id))).filter(Boolean).slice(0, 2);
  }

  return Object.freeze({
    VERSION, FORMATS, VERDICTS, MAX_INTERESTS, MAX_BLOCKED, MAX_FEEDBACK, MAX_SIGNALS, MAX_IMPORTS, MAX_VIDEO_REFERENCES, MAX_REASON, MAX_CUSTOM_INTEREST_TEXT, DIGEST_SIZE,
    emptyProfile, normalize, configure, cleanInterest, uniqueInterests, semanticInterestId, semanticInterestIds, cleanSignal, cleanImport, cleanVideoReference,
    choose, ensureDigest, markDone, recordFeedback, isDigestDone, reason, stableHash,
  });
});
