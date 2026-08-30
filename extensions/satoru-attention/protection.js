/* Satoru Browser Protection v1 — pure local filtering policy and DNR compiler. */
(function exposeSatoruProtection(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SatoruProtection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSatoruProtection() {
  'use strict';

  const VERSION = 1;
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

  function emptySettings() {
    return {
      version: VERSION,
      enabled: false,
      categories: Object.fromEntries(CATEGORY_KEYS.map((key) => [key, false])),
      denylist: [],
      allowlist: [],
      recreation: normalizeSchedule(null),
      safeSearch: false,
      youtubeRestricted: false,
      blockBypass: false,
    };
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const categories = Object.fromEntries(CATEGORY_KEYS.map((key) => [key, source.categories?.[key] === true]));
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

  function summary(settings, catalog, at = new Date()) {
    const current = normalizeSettings(settings);
    return {
      enabled: current.enabled,
      blockedDomains: blockedDomains(current, catalog, at).length,
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
    VERSION, MAX_LIST_ITEMS, CATEGORY_KEYS, RESERVED_DOMAINS, RESOURCE_TYPES,
    SEARCH_DOMAINS, YOUTUBE_RESTRICT_DOMAINS, emptySettings, normalizeSettings,
    normalizeDomain, uniqueDomains, normalizeSchedule, recreationActive,
    nextScheduleBoundary, blockedDomains, decision, buildRules, summary,
  });
});
