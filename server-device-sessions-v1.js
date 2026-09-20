'use strict';

// Named, revocable device sessions next to the cookie (DEVICE-SESSIONS-V264.md).
//
// A native app, a widget, an App Intent or a Screen Time extension cannot see the
// HttpOnly cookie, so each registered device gets a short access token and a
// refresh credential that rotates on every use. The cookie path is not weakened:
// registration requires it, and a device can never mint another device.
//
// This file is decision logic over injected storage, clock and crypto. The server
// supplies fs and HMAC; tests supply fakes, so the whole negative matrix runs
// without a process. A device file that cannot be read is a fence, not an empty
// list: every operation on it fails closed instead of writing over it.
(function init(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ServerDeviceSessionsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  const SCHEMA = 'satoru.device-sessions/1';
  const ACCESS_PREFIX = 'dat1';
  const REFRESH_PREFIX = 'drt1';
  const ACCESS_TTL_MS = 15 * 60 * 1000;
  const WEB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  // A phone on a bicycle loses responses. Presenting the credential that was
  // just replaced, within this window, is a retry and rotates again; later it is
  // reuse of a copy and revokes the device.
  const REFRESH_RETRY_GRACE_MS = 60 * 1000;
  const MAX_ACTIVE_DEVICES = 20;
  const MAX_RECORDS = 60;
  const MAX_USED_HASHES = 8;
  const NAME_MAX = 64;
  const PLATFORMS = Object.freeze(['ios', 'ipados', 'macos', 'android', 'windows', 'linux', 'extension', 'other']);
  const REVOKE_REASONS = Object.freeze(['user', 'all', 'refresh_reused']);
  const UID_RE = /^[a-z0-9_-]{1,32}$/;
  const DEVICE_ID_RE = /^[a-f0-9]{32}$/;
  const HEX64_RE = /^[a-f0-9]{64}$/;
  const SECRET_RE = /^[A-Za-z0-9_-]{43}$/;
  const EXP_RE = /^\d{13}$/;
  // Control, zero-width and bidi characters, as code point ranges rather than
  // escapes in a regex literal, so no tool can turn them into invisible bytes.
  const HIDDEN_RANGES = Object.freeze([
    [0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x2069], [0xfeff, 0xfeff],
  ]);
  const isHidden = (code) => HIDDEN_RANGES.some(([from, to]) => code >= from && code <= to);

  const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  const isoOrNull = (value) => value === null
    || (typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)));
  const fail = (error, extra) => Object.assign({ ok: false, error }, extra || {});

  function validDevice(device) {
    return record(device)
      && DEVICE_ID_RE.test(device.id)
      && typeof device.name === 'string' && device.name.length > 0 && device.name.length <= NAME_MAX * 4
      && PLATFORMS.includes(device.platform)
      && typeof device.createdAt === 'string' && isoOrNull(device.createdAt)
      && isoOrNull(device.lastUsedAt)
      && typeof device.sessionVersion === 'string' && device.sessionVersion.length > 0
      && device.sessionVersion.length <= 256
      && HEX64_RE.test(device.refreshHash)
      && (device.prevRefreshHash === null || HEX64_RE.test(device.prevRefreshHash))
      && isoOrNull(device.rotatedAt)
      && Array.isArray(device.usedRefreshHashes) && device.usedRefreshHashes.length <= MAX_USED_HASHES
      && device.usedRefreshHashes.every((hash) => HEX64_RE.test(hash))
      && isoOrNull(device.revokedAt)
      && (device.revokedReason === null || REVOKE_REASONS.includes(device.revokedReason))
      && isoOrNull(device.noticeAckAt);
  }

  function parseStore(text) {
    if (text === null) return { ok: true, store: { schema: SCHEMA, devices: [] } };
    if (typeof text !== 'string') return { ok: false };
    let value;
    try { value = JSON.parse(text); } catch { return { ok: false }; }
    if (!record(value) || value.schema !== SCHEMA || !Array.isArray(value.devices)
      || value.devices.length > MAX_RECORDS || !value.devices.every(validDevice)) return { ok: false };
    if (new Set(value.devices.map((device) => device.id)).size !== value.devices.length) return { ok: false };
    return { ok: true, store: value };
  }

  /** A device name is shown to the owner as a security signal, so nothing in it may hide. */
  function cleanName(value) {
    if (typeof value !== 'string') return '';
    let text = '';
    for (const char of value) text += isHidden(char.codePointAt(0)) ? ' ' : char;
    text = text.replace(/\s+/g, ' ').trim();
    return Array.from(text).slice(0, NAME_MAX).join('');
  }

  function statusOf(device, user) {
    if (device.revokedAt) return { active: false, reason: device.revokedReason || 'user' };
    // Password, PIN, reset and "sign out everywhere" rotate the session version.
    // Binding the device to it makes all of them revoke devices without touching
    // each of those routes.
    if (!user || !user.sessionVersion || device.sessionVersion !== user.sessionVersion) {
      return { active: false, reason: 'session_rotated' };
    }
    return { active: true, reason: null };
  }

  function create(deps) {
    for (const name of ['read', 'write', 'sign', 'randomHex', 'randomSecret', 'now', 'equal']) {
      if (!deps || typeof deps[name] !== 'function') throw new TypeError(`device sessions need deps.${name}`);
    }

    const nowIso = () => new Date(deps.now()).toISOString();

    function load(uid) {
      let text;
      try { text = deps.read(uid); } catch { return { ok: false }; }
      return parseStore(text);
    }

    function persist(uid, devices) {
      try { deps.write(uid, { schema: SCHEMA, devices }); return true; } catch { return false; }
    }

    const accessPayload = (uid, deviceId, expRaw, web = false) =>
      `satoru.device-${web ? 'web' : 'access'}/1\n${uid}\n${deviceId}\n${expRaw}`;

    function issueAccess(uid, deviceId, web = false) {
      const expRaw = String(deps.now() + (web ? WEB_TTL_MS : ACCESS_TTL_MS));
      const sig = deps.sign(accessPayload(uid, deviceId, expRaw, web));
      return {
        token: `${web ? 'dws1' : ACCESS_PREFIX}.${uid}.${deviceId}.${expRaw}.${sig}`,
        expiresAt: new Date(Number(expRaw)).toISOString(),
      };
    }

    function parseAccess(token, web = false) {
      if (typeof token !== 'string' || token.length > 200) return null;
      const parts = token.split('.');
      if (parts.length !== 5 || parts[0] !== (web ? 'dws1' : ACCESS_PREFIX)) return null;
      const [, uid, deviceId, expRaw, sig] = parts;
      if (!UID_RE.test(uid) || !DEVICE_ID_RE.test(deviceId) || !EXP_RE.test(expRaw) || !HEX64_RE.test(sig)) return null;
      return { uid, deviceId, expRaw, sig };
    }

    const refreshHash = (token) => deps.sign(`satoru.device-refresh/1\n${token}`);

    function issueRefresh(uid, deviceId) {
      const token = `${REFRESH_PREFIX}.${uid}.${deviceId}.${deps.randomSecret()}`;
      return { token, hash: refreshHash(token) };
    }

    function parseRefresh(token) {
      if (typeof token !== 'string' || token.length > 200) return null;
      const parts = token.split('.');
      if (parts.length !== 4 || parts[0] !== REFRESH_PREFIX) return null;
      const [, uid, deviceId, secret] = parts;
      if (!UID_RE.test(uid) || !DEVICE_ID_RE.test(deviceId) || !SECRET_RE.test(secret)) return null;
      return { uid, deviceId };
    }

    function publicDevice(device, user, currentDeviceId) {
      const status = statusOf(device, user);
      return {
        id: device.id,
        name: device.name,
        platform: device.platform,
        createdAt: device.createdAt,
        lastUsedAt: device.lastUsedAt,
        active: status.active,
        revokedAt: device.revokedAt,
        revokedReason: status.reason,
        current: device.id === currentDeviceId,
        needsAck: status.active && !device.noticeAckAt,
      };
    }

    /** Oldest inactive records go first; an active device is never dropped to make room. */
    function prune(devices, user) {
      if (devices.length <= MAX_RECORDS) return devices;
      const inactive = devices
        .filter((device) => !statusOf(device, user).active)
        .sort((a, b) => Date.parse(a.revokedAt || a.createdAt) - Date.parse(b.revokedAt || b.createdAt));
      const drop = new Set(inactive.slice(0, devices.length - MAX_RECORDS).map((device) => device.id));
      return devices.filter((device) => !drop.has(device.id));
    }

    const bounded = (hashes) => hashes.slice(-MAX_USED_HASHES);

    function register(user, input) {
      if (!user || !UID_RE.test(user.id) || !user.sessionVersion) return fail('not_authorized');
      const body = record(input) ? input : {};
      // "Remember this device" is an explicit act; a login alone never mints a token.
      if (body.remember !== true) return fail('confirmation_required');
      const name = cleanName(body.name);
      if (!name) return fail('name_required');
      const platform = PLATFORMS.includes(body.platform) ? body.platform : 'other';
      const loaded = load(user.id);
      if (!loaded.ok) return fail('devices_unreadable');
      const devices = loaded.store.devices;
      if (devices.filter((device) => statusOf(device, user).active).length >= MAX_ACTIVE_DEVICES) {
        return fail('too_many_devices');
      }
      let id = deps.randomHex(16);
      while (devices.some((device) => device.id === id)) id = deps.randomHex(16);
      const refresh = issueRefresh(user.id, id);
      const stamp = nowIso();
      const device = {
        id, name, platform,
        createdAt: stamp, lastUsedAt: stamp,
        sessionVersion: user.sessionVersion,
        refreshHash: refresh.hash, prevRefreshHash: null, rotatedAt: null, usedRefreshHashes: [],
        revokedAt: null, revokedReason: null,
        // Shown to the owner on his other sessions until he confirms it was him.
        noticeAckAt: null,
      };
      if (!persist(user.id, prune([...devices, device], user))) return fail('write_failed');
      const access = issueAccess(user.id, id);
      return {
        ok: true,
        device: publicDevice(device, user, id),
        refreshToken: refresh.token,
        accessToken: access.token,
        accessExpiresAt: access.expiresAt,
      };
    }

    function refresh(token, getUser) {
      const parsed = parseRefresh(token);
      if (!parsed) return fail('invalid_token');
      const user = getUser(parsed.uid);
      if (!user) return fail('invalid_token');
      const loaded = load(parsed.uid);
      if (!loaded.ok) return fail('devices_unreadable');
      const devices = loaded.store.devices;
      const index = devices.findIndex((device) => device.id === parsed.deviceId);
      if (index < 0) return fail('invalid_token');
      const device = devices[index];
      const status = statusOf(device, user);
      if (!status.active) return fail('device_revoked', { reason: status.reason });

      const hash = refreshHash(token);
      const now = deps.now();
      const stamp = new Date(now).toISOString();

      const commit = (updated, fresh) => {
        const next = devices.slice();
        next[index] = updated;
        // Tokens are handed out only after the new hash is on disk; otherwise the
        // client would hold a credential the server has never heard of.
        if (!persist(parsed.uid, next)) return fail('write_failed');
        const access = issueAccess(parsed.uid, device.id);
        return {
          ok: true,
          device: publicDevice(updated, user, device.id),
          refreshToken: fresh.token,
          accessToken: access.token,
          accessExpiresAt: access.expiresAt,
        };
      };

      const revokeForReuse = () => {
        const next = devices.slice();
        next[index] = { ...device, revokedAt: stamp, revokedReason: 'refresh_reused' };
        const persisted = persist(parsed.uid, next);
        return fail('device_revoked', { reason: 'refresh_reused', persisted });
      };

      if (deps.equal(hash, device.refreshHash)) {
        const fresh = issueRefresh(parsed.uid, device.id);
        return commit({
          ...device,
          usedRefreshHashes: bounded(device.prevRefreshHash
            ? [...device.usedRefreshHashes, device.prevRefreshHash]
            : device.usedRefreshHashes),
          prevRefreshHash: device.refreshHash,
          refreshHash: fresh.hash,
          rotatedAt: stamp,
          lastUsedAt: stamp,
        }, fresh);
      }

      if (device.prevRefreshHash && deps.equal(hash, device.prevRefreshHash)) {
        const since = now - Date.parse(device.rotatedAt);
        if (Number.isFinite(since) && since >= 0 && since <= REFRESH_RETRY_GRACE_MS) {
          // The response carrying the new credential was lost. Rotate again and bury
          // the unseen one, so a copy of it cannot be used later either. The window
          // stays anchored to the first rotation and never extends itself.
          const fresh = issueRefresh(parsed.uid, device.id);
          return commit({
            ...device,
            usedRefreshHashes: bounded([...device.usedRefreshHashes, device.refreshHash]),
            refreshHash: fresh.hash,
            lastUsedAt: stamp,
          }, fresh);
        }
        return revokeForReuse();
      }

      if (device.usedRefreshHashes.some((used) => deps.equal(hash, used))) return revokeForReuse();
      // An unknown credential for a real device id is noise, not proof of theft.
      // Revoking on it would let anyone who saw a device id sign that device out.
      return fail('invalid_token');
    }

    function verifyAccess(token, getUser, web = false) {
      const parsed = parseAccess(token, web);
      if (!parsed) return null;
      if (!deps.equal(parsed.sig, deps.sign(accessPayload(parsed.uid, parsed.deviceId, parsed.expRaw, web)))) return null;
      const exp = Number(parsed.expRaw);
      const now = deps.now();
      if (!(exp > now) || exp - now > (web ? WEB_TTL_MS : ACCESS_TTL_MS)) return null;
      const user = getUser(parsed.uid);
      if (!user) return null;
      // Checked on every request, so revocation is immediate instead of waiting
      // for the access token to expire.
      const loaded = load(parsed.uid);
      if (!loaded.ok) return null;
      const device = loaded.store.devices.find((item) => item.id === parsed.deviceId);
      if (!device || !statusOf(device, user).active) return null;
      return { uid: parsed.uid, deviceId: parsed.deviceId };
    }

    // A separate credential namespace: never a full login cookie or refresh key.
    // Every web request still checks the same device record and sessionVersion.
    function issueWebSession(token, getUser) {
      const access = verifyAccess(token, getUser);
      if (!access) return fail('invalid_token');
      const web = issueAccess(access.uid, access.deviceId, true);
      return { ok: true, webSessionToken: web.token, expiresAt: web.expiresAt };
    }
    const verifyWebSession = (token, getUser) => verifyAccess(token, getUser, true);

    function list(user, currentDeviceId) {
      if (!user || !UID_RE.test(user.id)) return fail('not_authorized');
      const loaded = load(user.id);
      if (!loaded.ok) return fail('devices_unreadable');
      const devices = loaded.store.devices
        .map((device) => publicDevice(device, user, currentDeviceId || null))
        .sort((a, b) => (Number(b.active) - Number(a.active)) || (Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      return { ok: true, devices };
    }

    function mutate(user, change) {
      if (!user || !UID_RE.test(user.id)) return fail('not_authorized');
      const loaded = load(user.id);
      if (!loaded.ok) return fail('devices_unreadable');
      const outcome = change(loaded.store.devices);
      if (!outcome.ok) return outcome;
      if (outcome.devices && !persist(user.id, outcome.devices)) return fail('write_failed');
      return { ok: true, changed: Boolean(outcome.devices) };
    }

    function revoke(user, deviceId, options) {
      const actorDeviceId = options && options.actorDeviceId ? options.actorDeviceId : null;
      // A device may sign itself out; signing out another device needs the cookie session.
      if (actorDeviceId && actorDeviceId !== deviceId) return fail('forbidden');
      if (typeof deviceId !== 'string' || !DEVICE_ID_RE.test(deviceId)) return fail('not_found');
      return mutate(user, (devices) => {
        const index = devices.findIndex((device) => device.id === deviceId);
        if (index < 0) return fail('not_found');
        if (devices[index].revokedAt) return { ok: true };
        const next = devices.slice();
        next[index] = { ...devices[index], revokedAt: nowIso(), revokedReason: 'user' };
        return { ok: true, devices: next };
      });
    }

    function revokeAll(user) {
      return mutate(user, (devices) => {
        const stamp = nowIso();
        let changed = false;
        const next = devices.map((device) => {
          if (!statusOf(device, user).active) return device;
          changed = true;
          return { ...device, revokedAt: stamp, revokedReason: 'all' };
        });
        return changed ? { ok: true, devices: next } : { ok: true };
      });
    }

    function acknowledge(user, deviceId) {
      if (typeof deviceId !== 'string' || !DEVICE_ID_RE.test(deviceId)) return fail('not_found');
      return mutate(user, (devices) => {
        const index = devices.findIndex((device) => device.id === deviceId);
        if (index < 0) return fail('not_found');
        if (devices[index].noticeAckAt) return { ok: true };
        const next = devices.slice();
        next[index] = { ...devices[index], noticeAckAt: nowIso() };
        return { ok: true, devices: next };
      });
    }

    return Object.freeze({ register, refresh, verifyAccess, issueWebSession, verifyWebSession, list, revoke, revokeAll, acknowledge });
  }

  return Object.freeze({
    SCHEMA, ACCESS_TTL_MS, WEB_TTL_MS, REFRESH_RETRY_GRACE_MS, MAX_ACTIVE_DEVICES, MAX_RECORDS, MAX_USED_HASHES,
    NAME_MAX, PLATFORMS, REVOKE_REASONS,
    cleanName, parseStore, statusOf, create,
  });
});
