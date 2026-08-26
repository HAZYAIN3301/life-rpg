'use strict';

// Pure fail-closed boundary for the one file that owns every account. A corrupt
// registry must never look like an empty installation: registration would then
// overwrite the only index pointing at the existing per-user directories.
(function init(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ServerUserRegistryV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  const SCHEMA = 'satoru.user-registry/1';
  const MAX_USERS = 10000;
  const MAX_BYTES = 8 * 1024 * 1024;
  const ID_RE = /^[a-z0-9_-]{1,32}$/;

  function fail(reason, cause) {
    const error = new Error(`user registry rejected: ${reason}`);
    error.code = 'USERS_REGISTRY_CORRUPT';
    error.reason = reason;
    if (cause) error.cause = cause;
    throw error;
  }

  function optionalString(row, key, max) {
    return row[key] == null || (typeof row[key] === 'string' && row[key].length <= max);
  }

  function assertValid(value) {
    if (!Array.isArray(value)) fail('root-not-array');
    if (value.length > MAX_USERS) fail('too-many-users');
    const ids = new Set();
    for (let index = 0; index < value.length; index += 1) {
      const row = value[index];
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`row-${index}-not-object`);
      if (typeof row.id !== 'string' || !ID_RE.test(row.id)) fail(`row-${index}-bad-id`);
      if (ids.has(row.id)) fail(`row-${index}-duplicate-id`);
      if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 128) fail(`row-${index}-bad-name`);
      if (!optionalString(row, 'avatar', 32) || !optionalString(row, 'email', 320)
        || !optionalString(row, 'pinHash', 512) || !optionalString(row, 'pwHash', 512)
        || !optionalString(row, 'pwSalt', 256) || !optionalString(row, 'recoveryHash', 512)
        || !optionalString(row, 'resetHash', 512) || !optionalString(row, 'sessionVersion', 256)
        || !optionalString(row, 'createdAt', 64) || !optionalString(row, 'trialStartedAt', 64)
        || !optionalString(row, 'proUntil', 64) || !optionalString(row, 'calSecret', 256)) {
        fail(`row-${index}-bad-field`);
      }
      if (row.isAdmin != null && typeof row.isAdmin !== 'boolean') fail(`row-${index}-bad-admin`);
      if (row.plan != null && !['free', 'pro'].includes(row.plan)) fail(`row-${index}-bad-plan`);
      if (row.socialConsent != null && (!row.socialConsent || typeof row.socialConsent !== 'object' || Array.isArray(row.socialConsent))) {
        fail(`row-${index}-bad-consent`);
      }
      ids.add(row.id);
    }
    return value;
  }

  function parse(text) {
    if (typeof text !== 'string') fail('source-not-string');
    if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) fail('file-too-large');
    let value;
    try { value = JSON.parse(text); }
    catch (error) { fail('invalid-json', error); }
    return assertValid(value);
  }

  return Object.freeze({ SCHEMA, MAX_USERS, MAX_BYTES, assertValid, parse });
});
