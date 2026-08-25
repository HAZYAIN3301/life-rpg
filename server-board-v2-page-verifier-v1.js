'use strict';

/* Board v2 direct-page verifier (dormant server foundation).
 *
 * Brave results are only leads. This module resolves and pins a public HTTPS
 * address, revalidates every redirect, bounds the response, and accepts only
 * direct organizer/venue JSON-LD. Extracted copy can never change the checked
 * URL, source kind or evidence timestamp.
 */

const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');

const VERSION = '1.0.0';
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 2;
const TIMEOUT_MS = 8000;
const ACCEPTED_TYPES = Object.freeze(['text/html', 'application/xhtml+xml']);
const BLOCKED_HOST_SUFFIXES = Object.freeze([
  '.internal', '.invalid', '.local', '.localhost', '.test', '.example',
]);
const DIRECT_FIELDS = Object.freeze([
  'title', 'address', 'startsAt', 'price', 'actionUrl', 'availability',
]);

class PageVerifierError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PageVerifierError';
    this.code = code;
  }
}

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value, max) {
  const out = typeof value === 'string' ? value.trim() : '';
  return out && out.length <= max ? out : '';
}
function normalizedHost(value) {
  return String(value || '').toLowerCase().replace(/\.$/, '');
}
function safeOfficialUrl(value) {
  const source = text(value, 1200);
  if (!source || /[\u0000-\u001f\u007f]/.test(source)) return '';
  try {
    const url = new URL(source);
    const host = normalizedHost(url.hostname);
    if (url.protocol !== 'https:' || !host || url.username || url.password) return '';
    if (url.port && url.port !== '443') return '';
    if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function ipv4Number(value) {
  const parts = String(value).split('.');
  if (parts.length !== 4) return null;
  let number = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    number = (number * 256) + Number(part);
  }
  return number >>> 0;
}
function inV4Range(number, base, bits) {
  const shift = 32 - bits;
  return (number >>> shift) === (ipv4Number(base) >>> shift);
}
function publicIpv4(value) {
  const number = ipv4Number(value);
  if (number == null) return false;
  const blocked = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
    ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
  ];
  return !blocked.some(([base, bits]) => inV4Range(number, base, bits));
}
function ipv6BigInt(value) {
  let source = String(value).toLowerCase().split('%')[0];
  if (source.startsWith('::ffff:') && net.isIP(source.slice(7)) === 4) {
    return { mappedV4: source.slice(7) };
  }
  if (net.isIP(source) !== 6) return null;
  const halves = source.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const words = left.concat(Array(missing).fill('0'), right);
  let out = 0n;
  for (const word of words) out = (out << 16n) | BigInt(parseInt(word || '0', 16));
  return { value: out };
}
function inV6Range(number, base, bits) {
  const shift = 128n - BigInt(bits);
  return (number >> shift) === (base >> shift);
}
function publicIpv6(value) {
  const parsed = ipv6BigInt(value);
  if (!parsed) return false;
  if (parsed.mappedV4) return publicIpv4(parsed.mappedV4);
  const blocked = [
    [0n, 128], [1n, 128],
    [0xfc00n << 112n, 7], [0xfe80n << 112n, 10], [0xff00n << 112n, 8],
    [0x20010db8n << 96n, 32],
  ];
  return !blocked.some(([base, bits]) => inV6Range(parsed.value, base, bits));
}
function isPublicIp(value) {
  const family = net.isIP(String(value));
  if (family === 4) return publicIpv4(value);
  if (family === 6) return publicIpv6(value);
  return false;
}

async function defaultResolveHost(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

function normalizeAddresses(rows) {
  const output = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const address = text(row && row.address, 80);
    const family = Number(row && row.family) || net.isIP(address);
    if (!address || ![4, 6].includes(family)) continue;
    if (!output.some((item) => item.address === address)) output.push({ address, family });
  }
  return output;
}

function defaultRequestPage(input) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (input.signal) input.signal.removeEventListener('abort', onAbort);
      if (error) reject(error); else resolve(value);
    };
    const onAbort = () => {
      if (request) request.destroy(new PageVerifierError('aborted'));
      finish(new PageVerifierError('aborted'));
    };
    request = https.request(input.url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Satoru-Board-SourceVerifier/1.0',
      },
      agent: false,
      lookup(hostname, options, callback) {
        if (options && options.all) callback(null, [{ address: input.address, family: input.family }]);
        else callback(null, input.address, input.family);
      },
    }, (response) => {
      const chunks = [];
      let size = 0;
      const contentLength = Number(response.headers['content-length']);
      if (Number.isFinite(contentLength) && contentLength > input.maxBytes) {
        response.destroy();
        finish(new PageVerifierError('page-too-large'));
        return;
      }
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > input.maxBytes) {
          response.destroy();
          finish(new PageVerifierError('page-too-large'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => finish(null, {
        status: Number(response.statusCode),
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
      response.on('error', (error) => finish(error));
    });
    request.setTimeout(input.timeoutMs, () => request.destroy(new PageVerifierError('page-timeout')));
    request.on('error', (error) => finish(error));
    if (input.signal) {
      if (input.signal.aborted) onAbort();
      else input.signal.addEventListener('abort', onAbort, { once: true });
    }
    if (!settled) request.end();
  });
}

function header(headers, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(plain(headers) ? headers : {})) {
    if (key.toLowerCase() !== wanted) continue;
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }
  return '';
}

function createFetcher(options) {
  const settings = plain(options) ? options : {};
  const resolveHost = typeof settings.resolveHost === 'function' ? settings.resolveHost : defaultResolveHost;
  const requestPage = typeof settings.requestPage === 'function' ? settings.requestPage : defaultRequestPage;
  const maxBytes = Number(settings.maxBytes) > 0 ? Math.min(Number(settings.maxBytes), MAX_BYTES) : MAX_BYTES;
  const timeoutMs = Number(settings.timeoutMs) > 0 ? Math.min(Number(settings.timeoutMs), TIMEOUT_MS) : TIMEOUT_MS;

  async function fetchPage(rawUrl, runOptions) {
    const signal = plain(runOptions) ? runOptions.signal : undefined;
    let current = safeOfficialUrl(rawUrl);
    if (!current) throw new PageVerifierError('unsafe-url');
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      if (signal && signal.aborted) throw new PageVerifierError('aborted');
      const url = new URL(current);
      const addresses = normalizeAddresses(await resolveHost(url.hostname));
      if (!addresses.length || addresses.some((row) => !isPublicIp(row.address))) {
        throw new PageVerifierError('non-public-address');
      }
      const response = await requestPage({
        url: current,
        address: addresses[0].address,
        family: addresses[0].family,
        signal,
        maxBytes,
        timeoutMs,
      });
      if (!plain(response)) throw new PageVerifierError('invalid-response');
      const status = Number(response.status);
      if ([301, 302, 303, 307, 308].includes(status)) {
        if (redirects >= MAX_REDIRECTS) throw new PageVerifierError('too-many-redirects');
        const location = header(response.headers, 'location');
        current = safeOfficialUrl(new URL(location, current).href);
        if (!current) throw new PageVerifierError('unsafe-redirect');
        continue;
      }
      if (status !== 200) throw new PageVerifierError('page-http-error');
      const type = header(response.headers, 'content-type').split(';')[0].trim().toLowerCase();
      if (!ACCEPTED_TYPES.includes(type)) throw new PageVerifierError('unsupported-content-type');
      const body = typeof response.body === 'string' ? response.body : '';
      if (!body || Buffer.byteLength(body) > maxBytes) throw new PageVerifierError('page-too-large');
      return Object.freeze({ url: current, status, contentType: type, body });
    }
    throw new PageVerifierError('too-many-redirects');
  }
  return Object.freeze({ fetchPage });
}

function jsonLdDocuments(html) {
  const documents = [];
  const pattern = /<script\b[^>]*type\s*=\s*(?:["']application\/ld\+json["']|application\/ld\+json)[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = pattern.exec(html)) && documents.length < 32) {
    const source = match[1].trim();
    if (!source || source.length > 256 * 1024) continue;
    try { documents.push(JSON.parse(source)); } catch { /* Invalid markup is not evidence. */ }
  }
  return documents;
}
function flattenLd(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) flattenLd(item, out);
    return;
  }
  if (!plain(value)) return;
  if (Array.isArray(value['@graph'])) flattenLd(value['@graph'], out);
  else out.push(value);
}
function types(node) {
  return (Array.isArray(node && node['@type']) ? node['@type'] : [node && node['@type']])
    .map((value) => text(value, 80).toLowerCase()).filter(Boolean);
}
function sameHost(rawUrl, pageUrl) {
  const target = safeOfficialUrl(rawUrl);
  return !!target && normalizedHost(new URL(target).hostname) === normalizedHost(new URL(pageUrl).hostname);
}
function addressFrom(value) {
  if (typeof value === 'string') return text(value, 220);
  if (!plain(value)) return '';
  return [value.streetAddress, value.postalCode, value.addressLocality, value.addressRegion, value.addressCountry]
    .map((part) => text(part, 100)).filter(Boolean).join(', ').slice(0, 220);
}
function locationFrom(node) {
  const location = Array.isArray(node.location) ? node.location[0] : node.location;
  if (!plain(location)) return { address: '', url: '' };
  return { address: addressFrom(location.address), url: safeOfficialUrl(location.url) };
}
function organizerFrom(node) {
  const organizer = Array.isArray(node.organizer) ? node.organizer[0] : node.organizer;
  return plain(organizer) ? safeOfficialUrl(organizer.url) : '';
}
function offerFrom(node) {
  const rows = Array.isArray(node.offers) ? node.offers : [node.offers];
  return rows.find((row) => plain(row)) || null;
}
function priceFrom(node, offer) {
  const free = node.isAccessibleForFree === true || Number(offer && offer.price) === 0;
  if (free) return { type: 'free', label: 'Бесплатно' };
  const amount = Number(offer && offer.price);
  const currency = text(offer && offer.priceCurrency, 3).toUpperCase();
  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return null;
  return { type: 'fixed', amount, currency, label: `${amount} ${currency}` };
}
function offerAvailable(offer) {
  const value = text(offer && offer.availability, 300).toLowerCase();
  return !!offer && !/(soldout|discontinued|outofstock)/.test(value);
}
function stableCandidateId(pageUrl, title) {
  const prefix = String(title).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'local-option';
  return `${prefix}-${crypto.createHash('sha256').update(`${pageUrl}\n${title}`).digest('hex').slice(0, 12)}`;
}

function extractDirectCandidate(input) {
  const pageUrl = safeOfficialUrl(input && input.url);
  const checkedAt = text(input && input.checkedAt, 40);
  const request = plain(input && input.request) ? input.request : {};
  if (!pageUrl || !Number.isFinite(Date.parse(checkedAt))) return null;
  const nodes = [];
  for (const document of jsonLdDocuments(String(input.html || ''))) flattenLd(document, nodes);
  for (const node of nodes) {
    const nodeTypes = types(node);
    const isEvent = nodeTypes.some((type) => type === 'event' || type.endsWith('event') || type === 'courseinstance');
    const isPlace = nodeTypes.some((type) => ['place', 'localbusiness', 'sportsactivitylocation', 'restaurant', 'library'].includes(type));
    if ((request.intent === 'class' || request.intent === 'event') && !isEvent) continue;
    if (request.intent === 'place' && !isPlace) continue;
    if (request.intent === 'route') continue;
    const title = text(node.name, 180);
    const location = locationFrom(node);
    const nodeUrl = safeOfficialUrl(node.url);
    const organizerUrl = organizerFrom(node);
    let sourceKind = '';
    if (isEvent && organizerUrl && sameHost(organizerUrl, pageUrl)) sourceKind = 'organizer';
    else if (isEvent && location.url && sameHost(location.url, pageUrl)) sourceKind = 'venue';
    else if (isPlace && nodeUrl && sameHost(nodeUrl, pageUrl)) sourceKind = 'venue';
    if (!sourceKind || !title || !location.address) continue;
    const offer = offerFrom(node);
    const startsAt = isEvent ? text(node.startDate, 40) : '';
    const price = isEvent ? priceFrom(node, offer) : null;
    const actionUrl = safeOfficialUrl((offer && offer.url) || nodeUrl || pageUrl);
    if (!actionUrl) continue;
    if (isEvent && (!Number.isFinite(Date.parse(startsAt)) || !price || !offerAvailable(offer))) continue;
    const fields = isEvent ? DIRECT_FIELDS.slice() : ['title', 'address', 'actionUrl', 'availability'];
    return {
      candidateId: stableCandidateId(pageUrl, title),
      title,
      address: location.address,
      startsAt: startsAt || undefined,
      price,
      availability: 'confirmed',
      action: { label: 'Открыть официальный источник', url: actionUrl },
      relevance: 0.8,
      checkedAt,
      sources: [{ kind: sourceKind, url: pageUrl, fields, checkedAt }],
    };
  }
  return null;
}

function createPageVerifier(options) {
  const fetcher = createFetcher(options);
  return Object.freeze({
    async verifyOfficialPage(input) {
      if (!plain(input) || !plain(input.request)) return null;
      try {
        const page = await fetcher.fetchPage(input.url, { signal: input.signal });
        return extractDirectCandidate({
          request: input.request,
          url: page.url,
          html: page.body,
          checkedAt: input.checkedAt,
        });
      } catch {
        return null;
      }
    },
  });
}

module.exports = Object.freeze({
  VERSION,
  MAX_BYTES,
  MAX_REDIRECTS,
  TIMEOUT_MS,
  PageVerifierError,
  safeOfficialUrl,
  isPublicIp,
  jsonLdDocuments,
  extractDirectCandidate,
  createFetcher,
  createPageVerifier,
});
