'use strict';

// Only the public data used by a specific official Pin widget/TikTok oEmbed.
// No search, cookies, arbitrary fetch URL, raw HTML, downloads, or playback proof.
const Media = require('./public/inspiration-media-v1.js');

const DEFAULT_TIMEOUT_MS = 6500;
const DEFAULT_MAX_BYTES = 128 * 1024;
const DEFAULT_MAX_CONCURRENT = 4;

class MetadataError extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}

function plainText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
    const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : '';
  }).replace(/&(amp|quot|apos|lt|gt|nbsp);/gi, (match, name) => ({
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  })[name.toLowerCase()]).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function positiveDimension(value) {
  return Number.isInteger(value) && value > 0 && value <= 16384 ? value : 0;
}

function pinterestAuthorUrl(value) {
  if (typeof value !== 'string') return '';
  const match = value.match(/^https:\/\/www\.pinterest\.com\/([a-z0-9_]{1,64})\/?$/i);
  return match ? `https://www.pinterest.com/${match[1]}/` : '';
}

function endpointFor(source) {
  if (source.provider === 'tiktok') {
    const url = new URL('https://www.tiktok.com/oembed');
    url.searchParams.set('url', source.url);
    return url.href;
  }
  const url = new URL('https://widgets.pinterest.com/v3/pidgets/pins/info/');
  url.searchParams.set('pin_ids', source.id);
  url.searchParams.set('sub', 'www');
  url.searchParams.set('base_scheme', 'https');
  return url.href;
}

function normalizePinterest(body, source) {
  if (!body || body.status !== 'success' || !Array.isArray(body.data)) throw new MetadataError('invalid_metadata');
  const pin = body.data.slice(0, 8).find((row) => row && String(row.id) === source.id);
  if (!pin || pin.error) throw new MetadataError('not_found');
  const images = Object.values(pin.images && typeof pin.images === 'object' ? pin.images : {}).slice(0, 16)
    .map((item) => item && ({ url: Media.safeImage(item.url, 'pinterest'), width: positiveDimension(item.width), height: positiveDimension(item.height) }))
    .filter((item) => item && item.url && item.width && item.height)
    .sort((a, b) => b.width - a.width);
  const preview = images[0] || {};
  const creator = pin.native_creator || pin.pinner || {};
  const description = plainText(pin.description, 800);
  const title = plainText(pin.title || (pin.rich_metadata || {}).title || ((pin.story_pin_data || {}).metadata || {}).pin_title, 240) || description.slice(0, 240);
  const mediaType = pin.is_video === true || (pin.videos && pin.videos.video_list)
    ? 'video' : pin.is_video === false && !pin.story_pin_data ? 'image' : 'unknown';
  return {
    title, description, authorName: plainText(creator.full_name, 100), authorUrl: pinterestAuthorUrl(creator.profile_url),
    attributionKind: pin.native_creator ? 'creator' : 'pinner',
    thumbnailUrl: preview.url || '', thumbnailWidth: preview.width || 0, thumbnailHeight: preview.height || 0,
    mediaType,
  };
}

function normalizeTikTok(body, source) {
  if (!body || typeof body !== 'object' || body.provider_name !== 'TikTok' || body.type !== 'video'
    || (body.embed_product_id && String(body.embed_product_id) !== source.id)) throw new MetadataError('invalid_metadata');
  const authorUrl = `${Media.TIKTOK_ORIGIN}/@${source.authorHandle}`;
  if (typeof body.author_url !== 'string' || body.author_url.replace(/\/$/, '').toLowerCase() !== authorUrl.toLowerCase()) {
    throw new MetadataError('invalid_metadata');
  }
  if (body.provider_url && body.provider_url !== Media.TIKTOK_ORIGIN) throw new MetadataError('invalid_metadata');
  return {
    title: plainText(body.title, 240), description: plainText(body.title, 800),
    authorName: plainText(body.author_name, 100), authorUrl, attributionKind: 'creator',
    thumbnailUrl: Media.safeImage(body.thumbnail_url, 'tiktok'),
    thumbnailWidth: positiveDimension(body.thumbnail_width), thumbnailHeight: positiveDimension(body.thumbnail_height),
    mediaType: 'video',
  };
}

async function boundedJson(response, maxBytes, signal) {
  if (!response || !response.ok) throw new MetadataError(response && [404, 410].includes(response.status) ? 'not_found' : 'provider_unavailable');
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json' && !/^application\/[a-z0-9.-]+\+json$/.test(type)) throw new MetadataError('invalid_response');
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new MetadataError('response_too_large');
  if (!response.body || typeof response.body.getReader !== 'function') throw new MetadataError('invalid_response');
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      if (signal.aborted) throw new MetadataError('cancelled');
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new MetadataError('response_too_large');
      chunks.push(Buffer.from(chunk.value));
    }
    try { return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8')); }
    catch (_) { throw new MetadataError('invalid_json'); }
  } finally {
    // Cancel instead of draining rejected bodies; cancellation itself is not a
    // reason to keep the API call open when a remote stream fails to cooperate.
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (_) {}
    try { reader.releaseLock(); } catch (_) {}
  }
}

function createMetadataResolver(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.min(15000, Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS));
  const maxBytes = Math.min(512 * 1024, Math.max(1024, Number(options.maxBytes) || DEFAULT_MAX_BYTES));
  const maxConcurrent = Math.min(8, Math.max(1, Math.floor(Number(options.maxConcurrent) || DEFAULT_MAX_CONCURRENT)));
  const now = options.now || Date.now;
  let active = 0;

  async function resolve(sourceOrUrl, requestOptions = {}) {
    const source = Media.parseSource(sourceOrUrl);
    if (!source) return { status: 'invalid', reason: 'unsupported_source', source: null };
    if (requestOptions.signal && requestOptions.signal.aborted) return { status: 'unavailable', reason: 'cancelled', source };
    if (active >= maxConcurrent) return { status: 'busy', reason: 'busy', source };
    active += 1;
    const controller = new AbortController();
    let timer;
    let cancel;
    try {
      const endpoint = endpointFor(source);
      const deadline = new Promise((_, reject) => {
        cancel = () => { controller.abort(); reject(new MetadataError('cancelled')); };
        timer = setTimeout(() => { controller.abort(); reject(new MetadataError('timeout')); }, timeoutMs);
        if (requestOptions.signal) requestOptions.signal.addEventListener('abort', cancel, { once: true });
      });
      const work = (async () => {
        const response = await fetchImpl(endpoint, {
          method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
          headers: { Accept: 'application/json' }, signal: controller.signal,
        });
        if (controller.signal.aborted) throw new MetadataError('cancelled');
        if (response && (response.redirected || (response.url && response.url !== endpoint))) throw new MetadataError('redirect_refused');
        const body = await boundedJson(response, maxBytes, controller.signal);
        return source.provider === 'pinterest' ? normalizePinterest(body, source) : normalizeTikTok(body, source);
      })();
      const metadata = await Promise.race([work, deadline]);
      return { status: 'resolved', source, ...metadata, embedUrl: Media.buildEmbed(source), checkedAt: new Date(now()).toISOString() };
    } catch (error) {
      controller.abort();
      return { status: 'unavailable', reason: error instanceof MetadataError ? error.reason : 'network', source };
    } finally {
      clearTimeout(timer);
      if (requestOptions.signal && cancel) requestOptions.signal.removeEventListener('abort', cancel);
      active -= 1;
    }
  }

  return Object.freeze({ resolve });
}

module.exports = Object.freeze({ createMetadataResolver });
