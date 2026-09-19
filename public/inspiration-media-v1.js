/* Satoru Inspiration media v1 — specific public posts, never a provider feed.
 * This module validates URLs/messages; it does not fetch, prove availability,
 * inject provider scripts, grant rights, or mark a material as watched.
 */
(function exposeInspirationMedia(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationMediaV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildInspirationMedia() {
  'use strict';

  const VERSION = '1.0.0';
  const TIKTOK_ORIGIN = 'https://www.tiktok.com';
  const PINTEREST_ORIGIN = 'https://assets.pinterest.com';
  const MAX_URL_LENGTH = 4096;
  const PIN_HOSTS = new Set([
    'pinterest.com', 'www.pinterest.com', 'm.pinterest.com',
    'ar.pinterest.com', 'au.pinterest.com', 'br.pinterest.com', 'ca.pinterest.com',
    'de.pinterest.com', 'es.pinterest.com', 'fr.pinterest.com', 'id.pinterest.com',
    'in.pinterest.com', 'it.pinterest.com', 'jp.pinterest.com', 'ru.pinterest.com',
    'uk.pinterest.com',
  ]);
  const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
  // rel=0 STILL offers the author's other posts. The host must remove the
  // iframe on the validated ended event; this query is not a no-feed promise.
  const TIKTOK_PARAMS = Object.freeze({
    autoplay: '0', loop: '0', rel: '0', controls: '1',
    music_info: '1', description: '1', closed_caption: '1',
    native_context_menu: '0',
  });

  function httpsUrl(value) {
    if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH
      || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      return url;
    } catch (_) { return null; }
  }

  function parseSource(value) {
    const url = httpsUrl(typeof value === 'string' ? value.trim() : value && value.url);
    if (!url) return null;
    if (PIN_HOSTS.has(url.hostname)) {
      const match = url.pathname.match(/^\/pin\/(?:[a-z0-9._~%-]{1,240}--)?([1-9]\d{5,21})\/?$/i);
      if (!match) return null;
      return { provider: 'pinterest', id: match[1], url: `https://www.pinterest.com/pin/${match[1]}/`, format: 'image', authorHandle: '' };
    }
    if (TIKTOK_HOSTS.has(url.hostname)) {
      const match = url.pathname.match(/^\/@([a-z0-9_.]{1,32})\/video\/([1-9]\d{14,21})\/?$/i);
      if (!match) return null;
      return { provider: 'tiktok', id: match[2], url: `${TIKTOK_ORIGIN}/@${match[1]}/video/${match[2]}`, format: 'edit', authorHandle: match[1] };
    }
    return null;
  }

  function buildEmbed(sourceOrUrl) {
    const source = parseSource(sourceOrUrl);
    if (!source) return '';
    if (source.provider === 'pinterest') return `${PINTEREST_ORIGIN}/ext/embed.html?id=${source.id}`;
    const url = new URL(`${TIKTOK_ORIGIN}/player/v1/${source.id}`);
    for (const [key, value] of Object.entries(TIKTOK_PARAMS)) url.searchParams.set(key, value);
    return url.href;
  }

  function embedSource(value) {
    const url = httpsUrl(value);
    if (!url || url.hash) return null;
    if (url.origin === PINTEREST_ORIGIN && url.pathname === '/ext/embed.html') {
      const entries = Array.from(url.searchParams.entries());
      if (entries.length !== 1 || entries[0][0] !== 'id' || !/^[1-9]\d{5,21}$/.test(entries[0][1])) return null;
      return { provider: 'pinterest', id: entries[0][1] };
    }
    if (url.origin === TIKTOK_ORIGIN) {
      const match = url.pathname.match(/^\/player\/v1\/([1-9]\d{14,21})$/);
      if (!match) return null;
      const entries = Array.from(url.searchParams.entries());
      if (entries.length !== Object.keys(TIKTOK_PARAMS).length) return null;
      for (const [key, value] of Object.entries(TIKTOK_PARAMS)) {
        if (url.searchParams.getAll(key).length !== 1 || url.searchParams.get(key) !== value) return null;
      }
      return { provider: 'tiktok', id: match[1] };
    }
    return null;
  }

  function isAllowedEmbed(value, expectedSource) {
    const embedded = embedSource(value);
    if (!embedded) return false;
    if (expectedSource === undefined) return true;
    const expected = parseSource(expectedSource);
    return !!expected && expected.provider === embedded.provider && expected.id === embedded.id;
  }

  function safeImage(value, provider) {
    const url = httpsUrl(value);
    if (!url || url.hash) return '';
    // Concrete Pinterest image sizes; no animations, HTML, or arbitrary hosts.
    if ((!provider || provider === 'pinterest') && url.hostname === 'i.pinimg.com'
      && /^\/(?:originals|\d{2,4}x)\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{20,64}\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)
      && !url.search) return url.href;
    // The thumbnail origin in TikTok's official oEmbed response example.
    // Other CDN origins require a reviewed addition, never arbitrary oEmbed HTML.
    if ((!provider || provider === 'tiktok') && url.hostname === 'p16.muscdn.com'
      && /^\/obj\/tos-[a-z0-9-]+\/[a-z0-9_-]{8,200}$/i.test(url.pathname)) return url.href;
    // Returned by the official TikTok oEmbed endpoint in the 2026-09-13 review.
    // Preserve its expiring signature; never turn the poster into a video URL.
    if ((!provider || provider === 'tiktok') && url.hostname === 'p16-common-sign.tiktokcdn-eu.com'
      && /^\/tos-[a-z0-9-]+\/[a-z0-9_~!.-]{8,240}\.(?:image|jpg|jpeg|png|webp)$/i.test(url.pathname)) return url.href;
    return '';
  }

  function parsePlayerEvent(event, expectedWindow, expectedSource) {
    if (!event || !expectedWindow || event.source !== expectedWindow || event.origin !== TIKTOK_ORIGIN) return null;
    if (expectedSource !== undefined) {
      const expected = parseSource(expectedSource);
      if (!expected || expected.provider !== 'tiktok') return null;
    }
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data) || data['x-tiktok-player'] !== true) return null;
    if (data.type === 'onPlayerReady') return { type: 'ready' };
    if (data.type === 'onStateChange') {
      const types = { '-1': 'init', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering' };
      return Number.isInteger(data.value) && Object.hasOwn(types, data.value) ? { type: types[data.value] } : null;
    }
    if (data.type === 'onCurrentTime') {
      const value = data.value;
      if (!value || typeof value !== 'object' || !Number.isFinite(value.currentTime)
        || !Number.isFinite(value.duration) || value.duration <= 0 || value.duration > 86400
        || value.currentTime < 0 || value.currentTime > value.duration + 1) return null;
      return { type: 'time', currentTime: value.currentTime, duration: value.duration };
    }
    if (data.type === 'onPlayerError') {
      const code = data.value && data.value.errorCode;
      if (!Number.isInteger(code) || code < 1000 || code > 3999) return null;
      return { type: 'error', code };
    }
    if (data.type === 'onError' && Number.isInteger(data.value) && data.value >= 1 && data.value <= 4) {
      return { type: 'error', code: data.value };
    }
    return null;
  }

  return Object.freeze({ VERSION, TIKTOK_ORIGIN, PINTEREST_ORIGIN, parseSource, buildEmbed, isAllowedEmbed, safeImage, parsePlayerEvent });
});
