'use strict';

/* Board v2 Brave adapter (dormant server foundation).
 *
 * The adapter owns one transient search call and delegates direct-page
 * extraction to an injected verifier. Search snippets/ids never leave this
 * module. BoardV2Discovery remains the authority that can turn verified facts
 * into a recommendation.
 */

const BoardDiscovery = require('./public/board-v2-discovery.js');

const VERSION = '1.0.0';
const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const MAX_SEARCH_RESULTS = 8;
const MAX_VERIFICATIONS = 4;
const ESTIMATED_SEARCH_USD = 0.005;

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value, max) {
  const out = typeof value === 'string' ? value.trim() : '';
  return out && out.length <= max ? out : '';
}
function safeHttps(value) {
  const source = text(value, 600);
  if (!source) return '';
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}
function language(locale) {
  const code = text(locale, 12).split('-')[0].toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : 'en';
}
function country(value) {
  const code = text(value, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : '';
}
function queryTerm(value) {
  return text(value, 48).replace(/-/g, ' ');
}
function billing(searchRequests) {
  const requests = Math.max(0, Math.floor(Number(searchRequests) || 0));
  return { searchRequests: requests, estimatedUsd: Number((requests * ESTIMATED_SEARCH_USD).toFixed(6)) };
}
function aborted(signal) {
  return !!(signal && signal.aborted === true);
}

function buildSearchCall(request, apiKey) {
  if (!plain(request) || request.schema !== BoardDiscovery.REQUEST_SCHEMA) throw new Error('invalid-discovery-request');
  const city = text(request.city, 100);
  const countryCode = country(request.countryCode);
  const terms = (Array.isArray(request.searchTerms) ? request.searchTerms : []).map(queryTerm).filter(Boolean);
  if (!city || !countryCode || !terms.length) throw new Error('incomplete-discovery-request');
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', `${terms.join(' ')} ${city} ${countryCode}`);
  url.searchParams.set('country', countryCode);
  url.searchParams.set('search_lang', language(request.locale));
  url.searchParams.set('ui_lang', text(request.locale, 12) || 'en-US');
  url.searchParams.set('count', String(MAX_SEARCH_RESULTS));
  url.searchParams.set('safesearch', 'strict');
  url.searchParams.set('spellcheck', 'true');
  return {
    url: url.href,
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  };
}

function transientLeads(payload) {
  const web = plain(payload) && plain(payload.web) ? payload.web : {};
  const rows = Array.isArray(web.results) ? web.results : [];
  const leads = [];
  const urls = new Set();
  for (const row of rows) {
    if (!plain(row)) continue;
    const url = safeHttps(row.url);
    if (!url || urls.has(url)) continue;
    urls.add(url);
    leads.push({ url, title: text(row.title, 180) });
    if (leads.length >= MAX_SEARCH_RESULTS) break;
  }
  return leads;
}

function createAdapter(options) {
  const settings = plain(options) ? options : {};
  const apiKey = text(settings.apiKey, 500);
  const requestJson = typeof settings.requestJson === 'function' ? settings.requestJson : null;
  const verifyOfficialPage = typeof settings.verifyOfficialPage === 'function' ? settings.verifyOfficialPage : null;
  const clock = typeof settings.clock === 'function' ? settings.clock : () => new Date().toISOString();

  async function resolve(rawConsent, rawSpec, runOptions) {
    let request;
    try {
      request = BoardDiscovery.createRequest(rawConsent, rawSpec);
    } catch (error) {
      return { ok: false, reason: error && error.code ? error.code : 'invalid-request', billing: billing(0) };
    }
    if (!apiKey || !requestJson || !verifyOfficialPage) {
      return { ok: false, reason: 'provider-unavailable', billing: billing(0) };
    }
    const signal = plain(runOptions) ? runOptions.signal : undefined;
    if (aborted(signal)) return { ok: false, reason: 'aborted', billing: billing(0) };
    const call = buildSearchCall(request, apiKey);
    let response;
    try {
      response = await requestJson({ url: call.url, headers: call.headers, signal });
    } catch {
      if (aborted(signal)) return { ok: false, reason: 'aborted', billing: billing(1) };
      return { ok: false, reason: 'provider-error', billing: billing(1) };
    }
    if (aborted(signal)) return { ok: false, reason: 'aborted', billing: billing(1) };
    if (!plain(response) || Number(response.status) !== 200 || !plain(response.json)) {
      const status = Number(response && response.status);
      return {
        ok: false,
        reason: 'provider-error',
        status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : null,
        billing: billing(1),
      };
    }

    const checkedAt = clock();
    const verified = [];
    const leads = transientLeads(response.json).slice(0, MAX_VERIFICATIONS);
    for (const lead of leads) {
      if (aborted(signal)) return { ok: false, reason: 'aborted', billing: billing(1) };
      let rawCandidate;
      try {
        rawCandidate = await verifyOfficialPage({
          request,
          url: lead.url,
          titleHint: lead.title,
          checkedAt,
          signal,
        });
      } catch {
        if (aborted(signal)) return { ok: false, reason: 'aborted', billing: billing(1) };
        continue;
      }
      if (aborted(signal)) return { ok: false, reason: 'aborted', billing: billing(1) };
      if (!rawCandidate) continue;
      try {
        verified.push(BoardDiscovery.verifyCandidate(request, rawCandidate));
      } catch {
        // Search rank or an extractor claim is never enough to bypass source gates.
      }
    }
    const selected = BoardDiscovery.recommend(request, verified, checkedAt);
    if (!selected.ok) return { ok: false, reason: selected.reason, billing: billing(1) };
    return {
      ok: true,
      recommendation: selected.recommendation,
      billing: billing(1),
      audit: {
        provider: BoardDiscovery.PROVIDER_ID,
        searched: true,
        leadsChecked: leads.length,
        verifiedCandidates: verified.length,
        rawProviderPayloadStored: false,
      },
    };
  }

  return Object.freeze({
    VERSION,
    available: !!(apiKey && requestJson && verifyOfficialPage),
    resolve,
  });
}

module.exports = Object.freeze({
  VERSION,
  ENDPOINT,
  MAX_SEARCH_RESULTS,
  MAX_VERIFICATIONS,
  ESTIMATED_SEARCH_USD,
  createAdapter,
});
