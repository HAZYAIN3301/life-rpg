/* Satoru Browser Protection v1 — pure local filtering policy and DNR compiler. */
(function exposeSatoruProtection(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SatoruProtection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSatoruProtection() {
  'use strict';

  const VERSION = 1;
  // 0.7.0: the adult category is backed by the bundled OISD NSFW rulesets (rules/adult-*.json).
  const ADULT_RULESETS = Object.freeze({ redirect: 'adult_redirect', block: 'adult_block' });
  // Owner decision 26.09: a fresh protection setup starts with the adult category checked.
  const DEFAULT_CATEGORIES = Object.freeze({ adult: true });
  // 0.9.0 lock (owner decision 26.09): 7/30/90 days, no early unlock, protection can only get
  // stricter. Lock time is counted from observations: each adds at most 12 h and a clock set
  // backwards adds nothing, so moving the system clock forward cannot end a lock quickly.
  const LOCK_DAYS = Object.freeze([7, 30, 90]);
  const LOCK_MAX_STEP_MS = 12 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MAX_LIST_ITEMS = 500;
  const CATEGORY_KEYS = Object.freeze(['social', 'video', 'gaming', 'dating', 'gambling', 'adult', 'piracy']);
  const RESERVED_DOMAINS = Object.freeze(['life-rpg-production-416a.up.railway.app']);
  const RESOURCE_TYPES = Object.freeze([
    'csp_report', 'font', 'image', 'media', 'object', 'other', 'ping', 'script',
    'stylesheet', 'sub_frame', 'webbundle', 'websocket', 'xmlhttprequest',
  ]);
  const SEARCH_DOMAINS = Object.freeze({
    google: ['google.com', 'google.de', 'google.co.uk', 'google.es', 'google.com.ua'],
    bing: ['bing.com'],
    duckduckgo: ['duckduckgo.com'],
  });
  const YOUTUBE_RESTRICT_DOMAINS = Object.freeze([
    'www.youtube.com', 'm.youtube.com', 'youtubei.googleapis.com',
    'youtube.googleapis.com', 'www.youtube-nocookie.com',
  ]);

  function normalizeDomain(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/^\*\./, '');
    if (!raw || /[\s@]/.test(raw)) return null;
    let parsed;
    try { parsed = new URL(raw.includes('://') ? raw : `https://${raw}`); }
    catch { return null; }
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.replace(/\.$/, '');
    if (!host || !host.includes('.') || host === 'localhost' || RESERVED_DOMAINS.includes(host)) return null;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null;
    const labels = host.split('.');
    if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
    return host;
  }

  function uniqueDomains(values, limit = MAX_LIST_ITEMS) {
    const result = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
      const domain = normalizeDomain(value);
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      result.push(domain);
      if (result.length >= limit) break;
    }
    return result.sort();
  }

  function validTime(value, fallback) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour < 24 && minute < 60 ? `${match[1]}:${match[2]}` : fallback;
  }

  function normalizeSchedule(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const days = [...new Set((Array.isArray(source.days) ? source.days : [0, 1, 2, 3, 4, 5, 6])
      .map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
    return {
      enabled: source.enabled === true,
      days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
      start: validTime(source.start, '18:00'),
      end: validTime(source.end, '20:00'),
    };
  }

  function isoOrNull(value) {
    const ms = Date.parse(value);
    return typeof value === 'string' && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }

  function normalizeLock(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const startedAt = isoOrNull(raw.startedAt);
    const observedAt = isoOrNull(raw.observedAt);
    const requiredMs = Number(raw.requiredMs);
    const elapsedMs = Number(raw.elapsedMs);
    if (!startedAt || !observedAt || !Number.isFinite(requiredMs) || requiredMs <= 0
      || requiredMs > 400 * DAY_MS || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
    return { startedAt, observedAt, requiredMs: Math.round(requiredMs), elapsedMs: Math.min(Math.round(elapsedMs), Math.round(requiredMs)) };
  }

  function lockRemainingMs(settings) {
    const lock = normalizeLock(settings && settings.lock);
    return lock ? Math.max(0, lock.requiredMs - lock.elapsedMs) : 0;
  }

  function lockActive(settings) { return lockRemainingMs(settings) > 0; }

  // Credits real time to the lock. Returns normalized settings; a finished lock is removed.
  function observeLock(settings, at = new Date()) {
    const current = normalizeSettings(settings);
    if (!current.lock) return current;
    const now = at instanceof Date ? at.getTime() : Date.parse(at);
    const last = Date.parse(current.lock.observedAt);
    if (!Number.isFinite(now)) return current;
    const delta = now - last;
    const lock = { ...current.lock };
    if (delta > 0) {
      lock.elapsedMs = Math.min(lock.requiredMs, lock.elapsedMs + Math.min(delta, LOCK_MAX_STEP_MS));
      lock.observedAt = new Date(now).toISOString();
    }
    return { ...current, lock: lock.elapsedMs >= lock.requiredMs ? null : lock };
  }

  // Starting or extending: only while protection is on; an existing lock never gets shorter.
  function startLock(settings, days, at = new Date()) {
    const current = observeLock(settings, at);
    if (!LOCK_DAYS.includes(Number(days))) return { ok: false, error: 'lock_days_invalid' };
    if (!current.enabled) return { ok: false, error: 'lock_requires_protection' };
    const now = at instanceof Date ? at.toISOString() : isoOrNull(at);
    if (!now) return { ok: false, error: 'lock_time_invalid' };
    const wanted = Number(days) * DAY_MS;
    const lock = current.lock
      ? { ...current.lock, requiredMs: current.lock.elapsedMs + Math.max(lockRemainingMs(current), wanted) }
      : { startedAt: now, observedAt: now, requiredMs: wanted, elapsedMs: 0 };
    return { ok: true, settings: { ...current, lock } };
  }

  // Anything that lets more through than before. Used to refuse edits while locked.
  function protectionLoosens(previous, next) {
    const before = normalizeSettings(previous);
    const after = normalizeSettings(next);
    if (before.enabled && !after.enabled) return true;
    if (CATEGORY_KEYS.some((key) => before.categories[key] && !after.categories[key])) return true;
    if (after.allowlist.some((domain) => !before.allowlist.includes(domain))) return true;
    if (before.denylist.some((domain) => !after.denylist.includes(domain))) return true;
    if (['safeSearch', 'youtubeRestricted', 'blockBypass'].some((key) => before[key] && !after[key])) return true;
    if (after.recreation.enabled && (!before.recreation.enabled
      || JSON.stringify(after.recreation) !== JSON.stringify(before.recreation))) return true;
    return false;
  }

  function emptySettings() {
    return {
      version: VERSION,
      enabled: false,
      categories: Object.fromEntries(CATEGORY_KEYS.map((key) => [key, DEFAULT_CATEGORIES[key] === true])),
      denylist: [],
      allowlist: [],
      recreation: normalizeSchedule(null),
      safeSearch: false,
      youtubeRestricted: false,
      blockBypass: false,
      lock: null,
    };
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    // Saved choices are kept exactly; only a setup that never stored categories gets the default.
    const saved = source.categories && typeof source.categories === 'object' && !Array.isArray(source.categories);
    const categories = Object.fromEntries(CATEGORY_KEYS.map((key) => [key,
      saved ? source.categories[key] === true : DEFAULT_CATEGORIES[key] === true]));
    const allowlist = uniqueDomains(source.allowlist);
    const allowed = new Set(allowlist);
    const denylist = uniqueDomains(source.denylist).filter((domain) => !allowed.has(domain));
    return {
      version: VERSION,
      enabled: source.enabled === true,
      categories,
      denylist,
      allowlist,
      recreation: normalizeSchedule(source.recreation),
      safeSearch: source.safeSearch === true,
      youtubeRestricted: source.youtubeRestricted === true,
      blockBypass: source.blockBypass === true,
      lock: normalizeLock(source.lock),
    };
  }

  function minuteOfDay(value) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  function recreationActive(settings, at = new Date()) {
    const current = normalizeSettings(settings);
    if (!current.enabled || !current.recreation.enabled) return false;
    const now = at instanceof Date ? new Date(at.getTime()) : new Date(at);
    if (Number.isNaN(now.getTime())) return false;
    const minute = now.getHours() * 60 + now.getMinutes();
    const start = minuteOfDay(current.recreation.start);
    const end = minuteOfDay(current.recreation.end);
    const today = now.getDay();
    const yesterday = (today + 6) % 7;
    if (start === end) return current.recreation.days.includes(today);
    if (start < end) return current.recreation.days.includes(today) && minute >= start && minute < end;
    return (current.recreation.days.includes(today) && minute >= start)
      || (current.recreation.days.includes(yesterday) && minute < end);
  }

  function nextScheduleBoundary(settings, at = new Date()) {
    const current = normalizeSettings(settings);
    if (!current.enabled || !current.recreation.enabled) return null;
    const start = at instanceof Date ? new Date(at.getTime()) : new Date(at);
    if (Number.isNaN(start.getTime())) return null;
    start.setSeconds(0, 0);
    const initial = recreationActive(current, start);
    for (let step = 1; step <= 8 * 24 * 60; step += 1) {
      const candidate = new Date(start.getTime() + step * 60_000);
      if (recreationActive(current, candidate) !== initial) return candidate.toISOString();
    }
    return null;
  }

  function coveredBy(hostname, domains) {
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }

  function enabledCategoryDomains(settings, catalog) {
    const current = normalizeSettings(settings);
    if (!current.enabled || recreationActive(current)) return [];
    const values = [];
    for (const key of CATEGORY_KEYS) {
      if (current.categories[key]) values.push(...(Array.isArray(catalog?.[key]) ? catalog[key] : []));
    }
    return uniqueDomains(values, 30_000);
  }

  function blockedDomains(settings, catalog, at = new Date()) {
    const current = normalizeSettings(settings);
    if (!current.enabled) return [];
    const values = [];
    if (!recreationActive(current, at)) {
      values.push(...current.denylist);
      for (const key of CATEGORY_KEYS) {
        if (current.categories[key]) values.push(...(Array.isArray(catalog?.[key]) ? catalog[key] : []));
      }
    }
    if (current.blockBypass) values.push(...(Array.isArray(catalog?.bypass) ? catalog.bypass : []));
    const allow = current.allowlist;
    return uniqueDomains(values, 30_000).filter((domain) => !coveredBy(domain, allow));
  }

  function decision(settings, catalog, value, at = new Date()) {
    const current = normalizeSettings(settings);
    let hostname;
    try { hostname = new URL(value).hostname.toLowerCase(); }
    catch { return { blocked: false, reason: 'unsupported' }; }
    if (!current.enabled || current.allowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return { blocked: false, reason: current.enabled ? 'allowlist' : 'disabled' };
    }
    if (coveredBy(hostname, blockedDomains(current, catalog, at))) return { blocked: true, reason: 'protection' };
    return { blocked: false, reason: recreationActive(current, at) ? 'recreation' : 'not_listed' };
  }

  function chunks(values, size = 700) {
    const result = [];
    for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
    return result;
  }

  function buildRules(settings, catalog, at = new Date(), options = {}) {
    const current = normalizeSettings(settings);
    if (!current.enabled) return [];
    const blockUrl = typeof options.blockUrl === 'string' && options.blockUrl.startsWith('chrome-extension://') ? options.blockUrl : '';
    let id = Number.isInteger(options.baseId) ? options.baseId : 30_000;
    const rules = [];
    for (const requestDomains of chunks(current.allowlist)) {
      rules.push({ id: id += 1, priority: 10_000, action: { type: 'allowAllRequests' },
        condition: { requestDomains, resourceTypes: ['main_frame', 'sub_frame'] } });
    }
    for (const requestDomains of chunks(blockedDomains(current, catalog, at))) {
      rules.push({ id: id += 1, priority: 9_000,
        action: blockUrl ? { type: 'redirect', redirect: { url: blockUrl } } : { type: 'block' },
        condition: { requestDomains, resourceTypes: ['main_frame'] } });
      rules.push({ id: id += 1, priority: 8_000, action: { type: 'block' },
        condition: { requestDomains, resourceTypes: [...RESOURCE_TYPES] } });
    }
    if (current.safeSearch) {
      const safeRules = [
        [SEARCH_DOMAINS.google, 'safe', 'active', '/search'],
        [SEARCH_DOMAINS.bing, 'adlt', 'strict', '/search'],
        [SEARCH_DOMAINS.duckduckgo, 'kp', '1', 'q='],
      ];
      for (const [requestDomains, key, value, urlFilter] of safeRules) {
        rules.push({ id: id += 1, priority: 7_000,
          action: { type: 'redirect', redirect: { transform: { queryTransform: { addOrReplaceParams: [{ key, value }] } } } },
          condition: { requestDomains, urlFilter, resourceTypes: ['main_frame'] } });
      }
    }
    if (current.youtubeRestricted) {
      rules.push({ id: id += 1, priority: 7_000,
        action: { type: 'modifyHeaders', requestHeaders: [{ header: 'YouTube-Restrict', operation: 'set', value: 'Strict' }] },
        condition: { requestDomains: [...YOUTUBE_RESTRICT_DOMAINS], resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other'] } });
    }
    return rules;
  }

  // 0.8.0: the Reddit NSFW guard follows the adult category exactly (reddit.com itself is never listed).
  function redditGuardActive(settings, at = new Date()) {
    return adultRulesets(settings, at).length > 0;
  }

  function defaultAdultList() {
    return typeof globalThis !== 'undefined' && globalThis.SatoruAdultList ? globalThis.SatoruAdultList : null;
  }

  // Static rulesets that must be enabled right now. The block set always runs for the adult
  // category (frames too, and main frames when host access is missing); the redirect set adds
  // the Satoru block page when all-site access exists. Allowlist and recreation still apply.
  function adultRulesets(settings, at = new Date(), options = {}) {
    const current = normalizeSettings(settings);
    // A locked adult list ignores the recreation pause: moving the clock into a recreation window
    // must not open it.
    if (!current.enabled || !current.categories.adult || (recreationActive(current, at) && !lockActive(current))) return [];
    return options.canRedirect ? [ADULT_RULESETS.block, ADULT_RULESETS.redirect] : [ADULT_RULESETS.block];
  }

  function summary(settings, catalog, at = new Date(), adultList = defaultAdultList()) {
    const current = normalizeSettings(settings);
    const listDomains = adultRulesets(current, at).length && adultList && Number.isInteger(adultList.domains) ? adultList.domains : 0;
    return {
      enabled: current.enabled,
      blockedDomains: blockedDomains(current, catalog, at).length + listDomains,
      adultList: adultList ? { source: adultList.source, version: adultList.version, domains: adultList.domains, active: listDomains > 0 } : null,
      allowlistedDomains: current.allowlist.length,
      denylistedDomains: current.denylist.length,
      activeCategories: CATEGORY_KEYS.filter((key) => current.categories[key]),
      recreationActive: recreationActive(current, at),
      nextBoundaryAt: nextScheduleBoundary(current, at),
      safeSearch: current.safeSearch,
      youtubeRestricted: current.youtubeRestricted,
      blockBypass: current.blockBypass,
    };
  }

  return Object.freeze({
    VERSION, MAX_LIST_ITEMS, CATEGORY_KEYS, RESERVED_DOMAINS, RESOURCE_TYPES, ADULT_RULESETS, adultRulesets, redditGuardActive,
    LOCK_DAYS, LOCK_MAX_STEP_MS, normalizeLock, lockRemainingMs, lockActive, observeLock, startLock, protectionLoosens,
    SEARCH_DOMAINS, YOUTUBE_RESTRICT_DOMAINS, emptySettings, normalizeSettings,
    normalizeDomain, uniqueDomains, normalizeSchedule, recreationActive,
    nextScheduleBoundary, blockedDomains, decision, buildRules, summary,
  });
});
