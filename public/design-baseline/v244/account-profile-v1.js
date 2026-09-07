'use strict';

// AccountProfileV1 owns the small, explicitly shareable identity surface.
// It never accepts goals, tasks, habits, notes or assistant memory: those belong
// to private account data and cannot leak through a future profile UI by accident.
(function init(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AccountProfileV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  const VERSION = '1.0.0';
  const MAX_BIO = 180;
  const MAX_LINKS = 6;
  const HANDLES = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;
  const AUDIENCES = Object.freeze(['private', 'tribe', 'satoru']);
  const LAYOUTS = Object.freeze(['journey', 'character', 'creator']);
  const COVERS = Object.freeze(['void', 'aurora', 'ember', 'paper']);
  const PLATFORMS = Object.freeze([
    { id: 'instagram', label: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'], base: 'https://instagram.com/' },
    { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com'], base: 'https://www.tiktok.com/@' },
    { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be'], base: 'https://youtube.com/@' },
    { id: 'github', label: 'GitHub', hosts: ['github.com', 'www.github.com'], base: 'https://github.com/' },
    { id: 'telegram', label: 'Telegram', hosts: ['t.me', 'telegram.me'], base: 'https://t.me/' },
    { id: 'x', label: 'X', hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'], base: 'https://x.com/' },
    { id: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com', 'www.linkedin.com'], base: '' },
    { id: 'website', label: 'Сайт', hosts: [], base: '' },
  ]);
  const PLATFORM_MAP = new Map(PLATFORMS.map((item) => [item.id, item]));

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
  function handle(value) { return text(value, 32).replace(/^@+/, '').toLowerCase(); }
  function validHandle(value) { const normalized = handle(value); return !normalized || HANDLES.test(normalized); }
  function privateHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.local')) return true;
    if (/^(?:127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(host)) return true;
    const match = host.match(/^172\.(\d+)\./); if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
    return false;
  }
  function fromHandle(platform, raw) {
    const value = text(raw, 240);
    if (!platform.base || !value || /^https?:\/\//i.test(value)) return value;
    const short = value.replace(/^@+/, '').replace(/^\/+|\/+$/g, '');
    if (!/^[a-z0-9._-]{1,80}$/i.test(short)) return value;
    return platform.base + short;
  }
  function normalizeLink(raw) {
    if (!plain(raw)) return null;
    const platform = PLATFORM_MAP.get(text(raw.platform, 20)); if (!platform) return null;
    const input = fromHandle(platform, raw.url);
    let url;
    try { url = new URL(input); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || privateHost(url.hostname)) return null;
    const hostname = url.hostname.toLowerCase();
    if (platform.hosts.length && !platform.hosts.includes(hostname)) return null;
    url.hash = '';
    return Object.freeze({ platform: platform.id, url: url.toString().slice(0, 300) });
  }
  function normalizeLinks(value) {
    const result = [], seen = new Set();
    for (const raw of Array.isArray(value) ? value : []) {
      const link = normalizeLink(raw); if (!link) continue;
      const key = link.platform === 'website' ? link.url : link.platform;
      if (seen.has(key)) continue;
      seen.add(key); result.push(link);
      if (result.length >= MAX_LINKS) break;
    }
    return result;
  }
  function empty() {
    return { version: 1, handle: '', bio: '', audience: 'private', layout: 'journey', cover: 'void', links: [], updatedAt: null };
  }
  function normalize(value) {
    const source = plain(value) ? value : {};
    return {
      version: 1,
      handle: validHandle(source.handle) ? handle(source.handle) : '',
      bio: text(source.bio, MAX_BIO),
      audience: AUDIENCES.includes(source.audience) ? source.audience : 'private',
      layout: LAYOUTS.includes(source.layout) ? source.layout : 'journey',
      cover: COVERS.includes(source.cover) ? source.cover : 'void',
      links: normalizeLinks(source.links),
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt.slice(0, 40) : null,
    };
  }
  function validate(value) {
    if (!plain(value)) return { ok: false, error: 'bad_profile' };
    const allowed = new Set(['version', 'handle', 'bio', 'audience', 'layout', 'cover', 'links', 'updatedAt']);
    if (Object.keys(value).some((key) => !allowed.has(key))) return { ok: false, error: 'unknown_profile_field' };
    if (!validHandle(value.handle)) return { ok: false, error: 'bad_handle' };
    if (value.bio != null && typeof value.bio !== 'string') return { ok: false, error: 'bad_bio' };
    if (value.audience != null && !AUDIENCES.includes(value.audience)) return { ok: false, error: 'bad_audience' };
    if (value.layout != null && !LAYOUTS.includes(value.layout)) return { ok: false, error: 'bad_layout' };
    if (value.cover != null && !COVERS.includes(value.cover)) return { ok: false, error: 'bad_cover' };
    if (value.links != null && !Array.isArray(value.links)) return { ok: false, error: 'bad_links' };
    const inputLinks = Array.isArray(value.links) ? value.links : [];
    if (inputLinks.length > MAX_LINKS || inputLinks.some((item) => !normalizeLink(item))) return { ok: false, error: 'bad_link' };
    return { ok: true, profile: normalize(value) };
  }
  function visibleTo(profile, relation) {
    const safe = normalize(profile);
    if (relation === 'self') return true;
    if (safe.audience === 'satoru') return relation === 'member' || relation === 'tribe';
    if (safe.audience === 'tribe') return relation === 'tribe';
    return false;
  }
  function platform(id) { return PLATFORM_MAP.get(id) || PLATFORM_MAP.get('website'); }

  return Object.freeze({ VERSION, MAX_BIO, MAX_LINKS, AUDIENCES, LAYOUTS, COVERS, PLATFORMS, empty, handle, validHandle, normalizeLink, normalize, validate, visibleTo, platform });
});
