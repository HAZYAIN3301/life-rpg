'use strict';

// Native browser authorization. No account discovery or linking by email.
// Credentials stay server-side; the app receives a short-lived, PKCE-bound ticket.
const crypto = require('node:crypto');
const PROVIDERS = Object.freeze({
  google: { issuer: ['https://accounts.google.com', 'accounts.google.com'], authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', keys: 'https://www.googleapis.com/oauth2/v3/certs' },
  apple: { issuer: ['https://appleid.apple.com'], authorize: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', keys: 'https://appleid.apple.com/auth/keys' },
});
const random = () => crypto.randomBytes(32).toString('base64url');
const hash = value => crypto.createHash('sha256').update(value).digest('base64url');
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }

function verifyIdentity(token, jwks, { provider, audience, nonce, now = Date.now() }) {
  if (typeof token !== 'string' || token.length > 20000) fail('invalid_identity');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) fail('invalid_identity');
  let header, claims;
  try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); claims = JSON.parse(Buffer.from(parts[1], 'base64url')); }
  catch { fail('invalid_identity'); }
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit) fail('invalid_identity');
  const keys = Array.isArray(jwks?.keys) ? jwks.keys.filter(k => k.kid === header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256')) : [];
  if (keys.length !== 1) fail('invalid_identity');
  let valid = false;
  try { valid = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: keys[0], format: 'jwk' }), Buffer.from(parts[2], 'base64url')); }
  catch { fail('invalid_identity'); }
  const seconds = Math.floor(now / 1000);
  if (!valid || !PROVIDERS[provider]?.issuer.includes(claims.iss) || claims.aud !== audience ||
      (claims.azp && claims.azp !== audience) || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
      !Number.isFinite(claims.exp) || claims.exp <= seconds || !Number.isFinite(claims.iat) || claims.iat > seconds + 60 ||
      claims.iat < seconds - 600 || (claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > seconds + 60)) ||
      !equal(claims.nonce, nonce)) fail('invalid_identity');
  return { subject: claims.sub, issuer: PROVIDERS[provider].issuer[0] };
}

function create({ env = process.env, secret, now = Date.now, fetcher = fetch }) {
  let origin = '';
  try { const url = new URL(env.OAUTH_PUBLIC_ORIGIN || ''); if (url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password) origin = url.origin; } catch {}
  const pending = new Map(), states = new Map(), tickets = new Map(), keyCache = new Map();
  function config(provider) {
    if (!origin || !PROVIDERS[provider]) return null;
    if (provider === 'google' && env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET)
      return { id: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET };
    if (provider === 'apple' && env.APPLE_OAUTH_CLIENT_ID && env.APPLE_OAUTH_KEY_ID && env.APPLE_OAUTH_TEAM_ID && env.APPLE_OAUTH_PRIVATE_KEY)
      return { id: env.APPLE_OAUTH_CLIENT_ID };
    return null;
  }
  function clientSecret(provider) {
    const cfg = config(provider); if (!cfg) fail('provider_unavailable');
    if (provider === 'google') return cfg.clientSecret;
    const seconds = Math.floor(now() / 1000);
    const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = enc({ alg: 'ES256', kid: env.APPLE_OAUTH_KEY_ID }) + '.' + enc({ iss: env.APPLE_OAUTH_TEAM_ID, iat: seconds, exp: seconds + 300, aud: 'https://appleid.apple.com', sub: cfg.id });
    return input + '.' + crypto.sign('sha256', Buffer.from(input), { key: env.APPLE_OAUTH_PRIVATE_KEY.replace(/\\n/g, '\n'), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  }
  function clean() { for (const map of [pending, states, tickets]) for (const [key, item] of map) if (item.expires <= now()) map.delete(key); }
  function put(map, value, ttl) { clean(); if (map.size >= 2000) fail('busy'); const key = random(); map.set(key, { ...value, expires: now() + ttl }); return key; }
  function take(map, key) { const item = map.get(key); map.delete(key); if (!item || item.expires <= now()) fail('expired_request'); return item; }
  const callback = provider => origin + '/oauth/callback/' + provider;
  async function jsonRequest(url, options = {}) {
    const response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) fail('provider_unavailable');
    const text = await response.text(); if (text.length > 100000) fail('provider_unavailable');
    try { return JSON.parse(text); } catch { fail('provider_unavailable'); }
  }
  async function keys(provider) {
    const cached = keyCache.get(provider);
    if (cached && cached.expires > now()) return cached.value;
    const value = await jsonRequest(PROVIDERS[provider].keys);
    keyCache.set(provider, { value, expires: now() + 300000 }); return value;
  }
  function seal(value) {
    const iv = crypto.randomBytes(12), key = crypto.createHash('sha256').update('satoru.oauth.tokens.' + secret()).digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
  }
  function unseal(value) {
    const parts = value.split('.').map(p => Buffer.from(p, 'base64url'));
    const key = crypto.createHash('sha256').update('satoru.oauth.tokens.' + secret()).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, parts[0]); decipher.setAuthTag(parts[1]);
    return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString('utf8');
  }
  return {
    available: () => Object.keys(PROVIDERS).filter(p => config(p)),
    prepare(provider, challenge, link = null) {
      if (!config(provider)) fail('provider_unavailable');
      if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) fail('invalid_challenge');
      const request = put(pending, { provider, challenge, link }, 300000);
      return { url: origin + '/oauth/authorize?request=' + request };
    },
    authorize(request) {
      const item = take(pending, request), browser = random(), verifier = random(), nonce = random();
      const state = put(states, { ...item, browser, verifier, nonce }, 300000);
      const cfg = config(item.provider); if (!cfg) fail('provider_unavailable');
      const url = new URL(PROVIDERS[item.provider].authorize);
      const params = { client_id: cfg.id, redirect_uri: callback(item.provider), response_type: 'code', scope: 'openid email', state, nonce };
      if (item.provider === 'google') Object.assign(params, { code_challenge: hash(verifier), code_challenge_method: 'S256', prompt: 'select_account' });
      else { params.scope = 'email'; params.response_mode = 'form_post'; }
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return { url: url.href, browser, state };
    },
    async finish(provider, input, browser) {
      const item = take(states, input.state);
      if (item.provider !== provider || !equal(item.browser, browser)) fail('invalid_state');
      if (input.error || typeof input.code !== 'string' || !input.code || input.code.length > 4096) fail('authorization_cancelled');
      const cfg = config(provider); if (!cfg) fail('provider_unavailable');
      const params = { client_id: cfg.id, client_secret: clientSecret(provider), code: input.code, grant_type: 'authorization_code', redirect_uri: callback(provider) };
      if (provider === 'google') params.code_verifier = item.verifier;
      const tokens = await jsonRequest(PROVIDERS[provider].token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
      const identity = verifyIdentity(tokens.id_token, await keys(provider), { provider, audience: cfg.id, nonce: item.nonce, now: now() });
      if (provider === 'apple' && (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || tokens.refresh_token.length > 10000)) fail('invalid_identity');
      return { ...identity, provider, challenge: item.challenge, link: item.link,
        ...(provider === 'apple' ? { refresh: seal(tokens.refresh_token) } : {}) };
    },
    issueTicket(uid, version, challenge) { return put(tickets, { uid, version, challenge }, 60000); },
    redeem(ticket, verifier) {
      if (typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) fail('invalid_challenge');
      const item = tickets.get(ticket);
      if (!item || item.expires <= now() || !equal(item.challenge, hash(verifier))) fail('expired_request');
      return take(tickets, ticket);
    },
    async revokeApple(identity) {
      if (!identity?.refresh) return;
      const cfg = config('apple'); if (!cfg) fail('provider_unavailable');
      const response = await fetcher('https://appleid.apple.com/auth/revoke', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cfg.id, client_secret: clientSecret('apple'), token: unseal(identity.refresh), token_type_hint: 'refresh_token' }).toString() });
      if (!response.ok) fail('provider_unavailable');
    },
  };
}
module.exports = { create, verifyIdentity, hash };
