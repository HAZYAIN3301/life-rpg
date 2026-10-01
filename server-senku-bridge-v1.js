'use strict';

// Senku bridge v1: Satoru pulls card-review facts from Senku (GET /api/bridge/facts, Bearer key).
// Phase 1 shows them; phase 2 (owner 01.10) turns every closed sitting after the connection into
// a completed quest with the ordinary reward. The server never mints XP or gold itself: it only
// lists sittings that still await a reward and remembers which ones were claimed, so a sitting is
// rewarded once even across devices, reloads and a deleted quest.
// Contract: ~/Projects/senku/bridge/SATORU-BRIDGE.md.
//
// The key is a secret: it lives only in data/users/<id>/senku-bridge.json, which the generic
// /api/data route refuses, the account export skips and no response or log line contains.
// Deck and folder names are the person's content: they go to this person's own screen only.
const crypto = require('node:crypto');
const dns = require('node:dns');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');

const FILE = 'senku-bridge';
const DEFAULT_BASE_URL = 'https://senku-production.up.railway.app';
const SYNC_INTERVAL_MS = 3 * 60 * 1000;         // contract: not more than once every few minutes
const MANUAL_SYNC_INTERVAL_MS = 30 * 1000;      // «Обновить» still cannot hammer Senku
const BACKOFF_BASE_MS = SYNC_INTERVAL_MS;         // after a failure: 3, 6, 12 … 60 minutes
const BACKOFF_MAX_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10 * 1000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_RIDES_PER_RESPONSE = 20000;
const KEEP_DAYS = 120;
const MAX_STORED_RIDES = 6000;
const MAX_TRUSTED_DURATION_MS = 6 * 60 * 60 * 1000; // contract: longer than 6 h — do not trust duration
const MAX_DAY_SPAN_MS = 48 * 60 * 60 * 1000;
const MAX_PENDING = 300;
const SITTING_KEY = /^(voice|visual)\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const RIDE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const KEY = /^[\x21-\x7e]{16,512}$/;
const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home.arpa', '.intranet', '.corp'];

class BridgeError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status || 400; }
}

function isoOrNull(value) {
  return typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value)) ? new Date(Date.parse(value)).toISOString() : null;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return text || null;
}

// ---- Address safety: only a public https host, checked again at connect time (no DNS rebinding) ----

function privateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return privateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower) || lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8');
  }
  return true;
}

function safeLookup(hostname, options, callback) {
  const opts = typeof options === 'object' && options ? options : {};
  dns.lookup(hostname, { family: opts.family || 0, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = Array.isArray(addresses) ? addresses : [];
    if (!list.length || list.some((item) => privateAddress(item.address))) {
      const blocked = new Error('senku_address_blocked'); blocked.code = 'SENKU_ADDRESS_BLOCKED';
      return callback(blocked);
    }
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

// Returns the normalized origin or throws. Test origins (fake Senku on 127.0.0.1) are allowed
// only when the server was started with them explicitly.
function normalizeBaseUrl(input, testOrigins = []) {
  const raw = typeof input === 'string' && input.trim() ? input.trim() : DEFAULT_BASE_URL;
  if (raw.length > 300) throw new BridgeError('senku_address_invalid');
  let url; try { url = new URL(raw); } catch { throw new BridgeError('senku_address_invalid'); }
  if (testOrigins.includes(url.origin) && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash) return url.origin;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) throw new BridgeError('senku_address_invalid');
  if (url.pathname !== '/' && url.pathname !== '') throw new BridgeError('senku_address_invalid');
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || net.isIP(host.replace(/^\[|\]$/g, '')) || host === 'localhost'
    || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw new BridgeError('senku_address_invalid');
  return url.origin;
}

function defaultRequest(urlString, { headers, timeoutMs, maxBytes, testOrigins }) {
  return new Promise((resolve) => {
    const url = new URL(urlString);
    const local = testOrigins.includes(url.origin);
    const lib = url.protocol === 'http:' && local ? http : https;
    let done = false;
    const finish = (value) => { if (done) return; done = true; clearTimeout(deadline); resolve(value); };
    const req = lib.request(url, {
      method: 'GET', headers, timeout: timeoutMs,
      lookup: local ? undefined : safeLookup,
    }, (res) => {
      const chunks = []; let bytes = 0;
      res.on('data', (chunk) => {
        if (done) return;
        bytes += chunk.length;
        if (bytes > maxBytes) { finish({ status: 0, error: 'too_large' }); req.destroy(); return; }
        chunks.push(chunk);
      });
      res.on('end', () => finish({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', () => finish({ status: 0, error: 'network' }));
    });
    // Socket idle timeout plus a whole-request deadline: a slow drip cannot hold the request open.
    const deadline = setTimeout(() => { finish({ status: 0, error: 'timeout' }); req.destroy(); }, timeoutMs * 2);
    req.on('timeout', () => { finish({ status: 0, error: 'timeout' }); req.destroy(); });
    req.on('error', (error) => finish({ status: 0, error: error && error.code === 'SENKU_ADDRESS_BLOCKED' ? 'address_blocked' : 'network' }));
    req.end();
  });
}

// ---- Contract validation: the envelope must be exactly v1; a single odd ride is skipped, not fatal ----

function normalizeRide(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.id !== 'string' || !RIDE_ID.test(raw.id)) return null;
  if (raw.kind !== 'voice' && raw.kind !== 'visual') return null;
  const startedAt = isoOrNull(raw.startedAt); const changedAt = isoOrNull(raw.changedAt);
  if (!startedAt || !changedAt) return null;
  const endedAt = raw.endedAt === null ? null : isoOrNull(raw.endedAt);
  if (raw.endedAt !== null && !endedAt) return null;
  if (endedAt && Date.parse(endedAt) < Date.parse(startedAt)) return null;
  if (!Number.isInteger(raw.cards) || raw.cards < 0 || raw.cards > 100000) return null;
  if (typeof raw.finished !== 'boolean') return null;
  if (raw.durationMs !== null && !(Number.isInteger(raw.durationMs) && raw.durationMs >= 0)) return null;
  if (raw.folder !== undefined && !Array.isArray(raw.folder)) return null;
  return {
    id: raw.id, kind: raw.kind,
    deck: cleanText(raw.deck, 128), deckName: cleanText(raw.deckName, 160),
    folder: (raw.folder || []).slice(0, 12).map((name) => cleanText(name, 120)).filter(Boolean),
    startedAt, endedAt, finished: raw.finished, cards: raw.cards,
    durationMs: endedAt ? Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) : null,
    changedAt,
  };
}

function parseFacts(body) {
  let json; try { json = JSON.parse(body); } catch { return { ok: false }; }
  if (!json || json.ok !== true || json.source !== 'senku' || json.version !== 1 || !Array.isArray(json.rides)) return { ok: false };
  const nextSince = isoOrNull(json.nextSince);
  if (!nextSince || json.rides.length > MAX_RIDES_PER_RESPONSE) return { ok: false };
  const rides = []; let skipped = 0;
  for (const raw of json.rides) { const ride = normalizeRide(raw); if (ride) rides.push(ride); else skipped += 1; }
  return { ok: true, rides, skipped, nextSince, revision: Number.isInteger(json.revision) ? json.revision : null };
}

// ---- Sittings: one group per sitting; minutes are the union of time, not a sum of records ----
// A ride through a folder of three decks arrives as three records with the same start and end,
// so each record's durationMs is the whole ride. Summing them would triple the minutes.
// A sitting is keyed by kind + start: `voice|2026-09-28T06:52:00.000Z`.

function sittingKey(ride) { return `${ride.kind}|${ride.startedAt}`; }

function groupSittings(rides) {
  const groups = new Map();
  for (const ride of rides) {
    if (ride.cards <= 0) continue; // cards = 0 is not a session
    const key = sittingKey(ride);
    const group = groups.get(key) || { key, kind: ride.kind, startedAt: ride.startedAt, endedAt: ride.endedAt, open: false, finished: true, cards: 0, decks: [] };
    if (!ride.endedAt) group.open = true;
    else if (group.endedAt && Date.parse(ride.endedAt) > Date.parse(group.endedAt)) group.endedAt = ride.endedAt;
    group.finished = group.finished && ride.finished;
    group.cards += ride.cards;
    group.decks.push({ deck: ride.deck, name: ride.deckName, folder: ride.folder, cards: ride.cards });
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const endedAt = group.open ? null : group.endedAt;
    const spanMs = endedAt ? Date.parse(endedAt) - Date.parse(group.startedAt) : null;
    const durationTrusted = spanMs !== null && spanMs <= MAX_TRUSTED_DURATION_MS;
    return {
      key: group.key, kind: group.kind, startedAt: group.startedAt, endedAt, open: group.open, finished: !group.open && group.finished,
      cards: group.cards, minutes: durationTrusted ? Math.round(spanMs / 60000) : null, durationTrusted,
      decks: group.decks.sort((a, b) => b.cards - a.cards),
    };
  }).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

// Rewardable: closed, trusted duration, started at or after the connection (history before the
// connection is display-only — owner 01.10). Open sittings wait until Senku closes them.
function rewardable(sitting, rewardsFromMs) {
  return !sitting.open && sitting.durationTrusted && Date.parse(sitting.startedAt) >= rewardsFromMs;
}

function dayView(rides, fromMs, toMs, options = {}) {
  const claimed = options.claimed || {};
  const rewardsFromMs = Number.isFinite(options.rewardsFromMs) ? options.rewardsFromMs : Infinity;
  const sessions = groupSittings(rides).filter((one) => {
    const start = Date.parse(one.startedAt);
    return start >= fromMs && start < toMs;
  }).map((one) => Object.assign(one, { rewardable: rewardable(one, rewardsFromMs), claimed: Object.hasOwn(claimed, one.key) }));
  const intervals = sessions.filter((one) => one.durationTrusted)
    .map((one) => [Date.parse(one.startedAt), Date.parse(one.endedAt)]).sort((a, b) => a[0] - b[0]);
  let covered = 0; let cursorStart = null; let cursorEnd = null;
  for (const [start, end] of intervals) {
    if (cursorEnd === null || start > cursorEnd) { if (cursorEnd !== null) covered += cursorEnd - cursorStart; cursorStart = start; cursorEnd = end; }
    else if (end > cursorEnd) cursorEnd = end;
  }
  if (cursorEnd !== null) covered += cursorEnd - cursorStart;
  return {
    cards: sessions.reduce((sum, one) => sum + one.cards, 0),
    minutes: Math.round(covered / 60000),
    voiceCards: sessions.filter((one) => one.kind === 'voice').reduce((sum, one) => sum + one.cards, 0),
    sessions,
  };
}

function pendingSittings(rides, rewardsFromMs, claimed) {
  return groupSittings(rides).filter((one) => rewardable(one, rewardsFromMs) && !Object.hasOwn(claimed || {}, one.key)).slice(0, MAX_PENDING);
}

function deckList(rides) {
  const decks = new Map();
  for (const ride of rides) {
    if (!ride.deck || ride.cards <= 0) continue;
    const known = decks.get(ride.deck);
    if (!known || Date.parse(ride.startedAt) > Date.parse(known.lastAt)) {
      decks.set(ride.deck, { deck: ride.deck, name: ride.deckName, folder: ride.folder, lastAt: ride.startedAt, cards: (known ? known.cards : 0) + ride.cards });
    } else known.cards += ride.cards;
  }
  return [...decks.values()].sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

function maskKey(key) {
  return typeof key === 'string' && key.length >= 8 ? `••••${key.slice(-4)}` : '••••';
}

function create(options = {}) {
  const userDataDir = options.userDataDir;
  if (typeof userDataDir !== 'function') throw new Error('senku_bridge_needs_user_data_dir');
  const now = options.now || (() => Date.now());
  const request = options.request || defaultRequest;
  const testOrigins = Array.isArray(options.testOrigins) ? options.testOrigins.filter(Boolean) : [];
  const log = options.log || (() => {});
  const inFlight = new Map();

  const fileFor = (uid) => path.join(userDataDir(uid), `${FILE}.json`);

  function load(uid) {
    let raw;
    try { raw = fs.readFileSync(fileFor(uid), 'utf8'); } catch (error) { if (error && error.code === 'ENOENT') return null; throw error; }
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !value.connection || typeof value.connection.id !== 'string') throw new Error('senku_bridge_file_invalid');
    if (!value.rides || typeof value.rides !== 'object') value.rides = {};
    if (!value.claimed || typeof value.claimed !== 'object' || Array.isArray(value.claimed)) value.claimed = {};
    return value;
  }

  function save(uid, value) {
    const file = fileFor(uid); const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    let fd;
    try {
      fd = fs.openSync(tmp, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify(value));
      fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(tmp, file);
    } catch (error) {
      if (fd !== undefined) { try { fs.closeSync(fd); } catch {} }
      try { fs.unlinkSync(tmp); } catch {}
      throw error;
    }
  }

  function prune(rides) {
    const floor = now() - KEEP_DAYS * 86400000;
    const kept = Object.entries(rides).filter(([, ride]) => Date.parse(ride.startedAt) >= floor)
      .sort((a, b) => Date.parse(b[1].startedAt) - Date.parse(a[1].startedAt)).slice(0, MAX_STORED_RIDES);
    return Object.fromEntries(kept);
  }

  function merge(state, rides) {
    const next = Object.assign({}, state.rides);
    for (const ride of rides) next[`senku:${state.connection.id}:${ride.id}`] = ride; // merge by id, never append
    return prune(next);
  }

  function pruneClaimed(claimed) {
    const floor = now() - KEEP_DAYS * 86400000;
    return Object.fromEntries(Object.entries(claimed || {}).filter(([key]) => Date.parse(key.split('|')[1]) >= floor));
  }

  const rewardsFrom = (state) => Date.parse(state.connection.connectedAt);

  async function fetchFacts(baseUrl, key, since) {
    const url = new URL('/api/bridge/facts', baseUrl);
    if (since) url.searchParams.set('since', since);
    const response = await request(url.href, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'User-Agent': 'Satoru-Senku-Bridge/1' },
      timeoutMs: FETCH_TIMEOUT_MS, maxBytes: MAX_BODY_BYTES, testOrigins,
    });
    if (response.status === 200) {
      const facts = parseFacts(response.body);
      return facts.ok ? { kind: 'ok', facts } : { kind: 'invalid_response' };
    }
    if (response.status === 401) return { kind: 'invalid_token' };
    if (response.error === 'address_blocked') return { kind: 'address_blocked' };
    if (response.status >= 300 && response.status < 400) return { kind: 'invalid_response' };
    return { kind: response.status >= 500 ? 'server' : response.status ? 'invalid_response' : 'network' };
  }

  function publicStatus(state) {
    if (!state) return { connected: false, defaultBaseUrl: DEFAULT_BASE_URL };
    const c = state.connection;
    return {
      connected: true, defaultBaseUrl: DEFAULT_BASE_URL,
      state: c.status === 'reconnect' ? 'reconnect' : 'ok',
      baseUrl: c.baseUrl, keyMask: c.keyMask || '••••',
      connectedAt: c.connectedAt, rewardsFrom: c.connectedAt, lastExchangeAt: c.lastExchangeAt || null,
      lastError: c.lastError || null, retryAt: c.backoffUntil || null,
    };
  }

  function status(uid) { return publicStatus(load(uid)); }

  async function connect(uid, input) {
    const baseUrl = normalizeBaseUrl(input && input.baseUrl, testOrigins);
    const key = typeof (input && input.key) === 'string' ? input.key.trim() : '';
    if (!KEY.test(key)) throw new BridgeError('senku_key_invalid');
    const result = await fetchFacts(baseUrl, key, null); // the first request is the check
    if (result.kind === 'invalid_token') throw new BridgeError('senku_invalid_token', 400);
    if (result.kind === 'address_blocked') throw new BridgeError('senku_address_invalid', 400);
    if (result.kind !== 'ok') throw new BridgeError(result.kind === 'invalid_response' ? 'senku_invalid_response' : 'senku_unreachable', 502);
    const stamp = new Date(now()).toISOString();
    const state = {
      version: 1,
      connection: {
        id: crypto.randomBytes(6).toString('hex'), baseUrl, key, keyMask: maskKey(key),
        connectedAt: stamp, status: 'ok', lastExchangeAt: stamp, lastAttemptAt: stamp, lastError: null,
        nextSince: null, failures: 0, backoffUntil: null, revision: result.facts.revision,
      },
      rides: {},
      claimed: {},
    };
    state.rides = merge(state, result.facts.rides);
    state.connection.nextSince = result.facts.nextSince; // same atomic write as the rides: the cursor never outruns them
    save(uid, state);
    log('connect', { rides: result.facts.rides.length, skipped: result.facts.skipped });
    return publicStatus(state);
  }

  function disconnect(uid) {
    try { fs.unlinkSync(fileFor(uid)); } catch (error) { if (!error || error.code !== 'ENOENT') throw error; }
    return { connected: false, defaultBaseUrl: DEFAULT_BASE_URL };
  }

  async function runSync(uid) {
    const state = load(uid);
    if (!state || state.connection.status === 'reconnect' || !state.connection.key) return;
    const c = state.connection;
    const attemptAt = new Date(now()).toISOString();
    const result = await fetchFacts(c.baseUrl, c.key, c.nextSince);
    // The person may have disconnected or reconnected while we waited: never resurrect old state.
    const current = load(uid);
    if (!current || current.connection.id !== c.id) return;
    const cc = current.connection;
    cc.lastAttemptAt = attemptAt;
    if (result.kind === 'ok') {
      current.rides = merge(current, result.facts.rides);
      current.claimed = pruneClaimed(current.claimed);
      Object.assign(cc, { nextSince: result.facts.nextSince, lastExchangeAt: new Date(now()).toISOString(), lastError: null,
        failures: 0, backoffUntil: null, revision: result.facts.revision });
      save(uid, current);
      if (result.facts.skipped) log('skipped', { skipped: result.facts.skipped });
      return;
    }
    if (result.kind === 'invalid_token') {
      // Revoked or reissued in Senku: stop polling, drop the dead key, ask to reconnect.
      Object.assign(cc, { status: 'reconnect', key: null, lastError: 'invalid_token', backoffUntil: null });
      save(uid, current); log('invalid_token', {});
      return;
    }
    const failures = (Number(cc.failures) || 0) + 1;
    const pause = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
    Object.assign(cc, { failures, lastError: result.kind, backoffUntil: new Date(now() + pause).toISOString() }); // nextSince stays
    save(uid, current); log('retry_later', { reason: result.kind, failures });
  }

  function due(state, force) {
    if (!state || state.connection.status === 'reconnect' || !state.connection.key) return false;
    const c = state.connection; const t = now();
    if (c.backoffUntil) return Date.parse(c.backoffUntil) <= t; // the growing pause decides, not the button
    const last = Date.parse(c.lastAttemptAt || c.lastExchangeAt || 0) || 0;
    return t - last >= (force ? MANUAL_SYNC_INTERVAL_MS : SYNC_INTERVAL_MS);
  }

  async function syncIfDue(uid, { force = false } = {}) {
    if (inFlight.has(uid)) return inFlight.get(uid);
    let state; try { state = load(uid); } catch { return; }
    if (!due(state, force)) return;
    const job = runSync(uid).catch((error) => log('sync_failed', { reason: error && error.code ? error.code : 'error' }))
      .finally(() => inFlight.delete(uid));
    inFlight.set(uid, job);
    return job;
  }

  async function day(uid, { from, to, force = false } = {}) {
    const fromIso = isoOrNull(from); const toIso = isoOrNull(to);
    if (!fromIso || !toIso) throw new BridgeError('senku_day_invalid');
    const fromMs = Date.parse(fromIso); const toMs = Date.parse(toIso);
    if (!(toMs > fromMs) || toMs - fromMs > MAX_DAY_SPAN_MS) throw new BridgeError('senku_day_invalid');
    await syncIfDue(uid, { force });
    const state = load(uid);
    if (!state) return { connected: false, defaultBaseUrl: DEFAULT_BASE_URL };
    return Object.assign(publicStatus(state), {
      day: dayView(Object.values(state.rides), fromMs, toMs, { claimed: state.claimed, rewardsFromMs: rewardsFrom(state) }),
    });
  }

  // Sittings that still await their one reward (oldest first). The client turns them into
  // completed quests through its ordinary durable task write, then claims them here.
  async function pending(uid, { force = false } = {}) {
    await syncIfDue(uid, { force });
    const state = load(uid);
    if (!state) return { connected: false, defaultBaseUrl: DEFAULT_BASE_URL };
    return Object.assign(publicStatus(state), { sittings: pendingSittings(Object.values(state.rides), rewardsFrom(state), state.claimed) });
  }

  // Marks sittings as rewarded. Only existing, rewardable sittings are recorded; repeating a
  // claim is harmless. Written atomically with the rides so a disconnect wipes both together.
  function claim(uid, keys) {
    if (!Array.isArray(keys) || !keys.length || keys.length > MAX_PENDING || !keys.every((key) => typeof key === 'string' && SITTING_KEY.test(key))) {
      throw new BridgeError('senku_claim_invalid');
    }
    const state = load(uid);
    if (!state) throw new BridgeError('senku_not_connected', 409);
    const known = new Map(groupSittings(Object.values(state.rides)).map((one) => [one.key, one]));
    const stamp = new Date(now()).toISOString();
    let added = 0; let ignored = 0;
    for (const key of new Set(keys)) {
      const sitting = known.get(key);
      // A sitting that is gone (pruned, other connection) or not rewardable is skipped, never fatal:
      // one stale key must not make the client retry the whole batch forever.
      if (!sitting || !rewardable(sitting, rewardsFrom(state))) { ignored += 1; continue; }
      if (!Object.hasOwn(state.claimed, key)) { state.claimed[key] = stamp; added += 1; }
    }
    if (added) { state.claimed = pruneClaimed(state.claimed); save(uid, state); }
    return { ok: true, claimed: added, ignored };
  }

  function decks(uid) {
    const state = load(uid);
    if (!state) return { connected: false, defaultBaseUrl: DEFAULT_BASE_URL };
    return Object.assign(publicStatus(state), { decks: deckList(Object.values(state.rides)) });
  }

  return { FILE, DEFAULT_BASE_URL, status, connect, disconnect, day, pending, claim, decks, syncIfDue };
}

module.exports = {
  FILE, DEFAULT_BASE_URL, SYNC_INTERVAL_MS, MANUAL_SYNC_INTERVAL_MS, MAX_TRUSTED_DURATION_MS,
  BridgeError, create, normalizeBaseUrl, parseFacts, normalizeRide, dayView, groupSittings, pendingSittings, deckList, sittingKey,
  maskKey, privateAddress, safeLookup, defaultRequest,
};
