/* Pure builder for the two platform association documents that a native app needs
 * from this origin: Apple's `apple-app-site-association` and Android's
 * `assetlinks.json`. The module performs no I/O, reads no environment of its own
 * and knows nothing about HTTP — the caller hands it configuration strings and
 * receives either a validated document or a named refusal.
 *
 * Why validation is strict rather than permissive: both files are fetched and
 * cached by a platform CDN outside our control. A malformed document that is
 * served with status 200 is worse than no document at all, because the platform
 * caches the broken answer and stops asking. So an unparsable configuration
 * produces `null` here and an honest 404 at the edge, never a partial file.
 *
 * Nothing in here decides product policy. It decides document shape. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NativeAssociationV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // An Apple application identifier is `<Team ID>.<bundle ID>`. Team IDs are ten
  // alphanumeric characters; bundle IDs are reverse-DNS labels of alphanumerics
  // and hyphens. Both halves are checked, because a typo in either produces a
  // file Apple accepts and a link that silently never opens the app.
  const TEAM_ID_RE = /^[A-Z0-9]{10}$/;
  const BUNDLE_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
  const ANDROID_LABEL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const FINGERPRINT_RE = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;

  const MAX_APP_IDS = 10;
  const MAX_FINGERPRINTS = 10;
  const MAX_PATHS = 50;
  const MAX_FIELD = 4000;

  const DEFAULT_COMPONENTS = Object.freeze([Object.freeze({ '/': '/*' })]);

  function str(value) {
    return typeof value === 'string' ? value : '';
  }

  // Configuration arrives as one environment string. Commas, spaces and newlines
  // all separate, because a value pasted into a hosting dashboard picks up
  // whitespace that the person pasting it cannot see.
  function splitList(value) {
    const text = str(value);
    if (!text || text.length > MAX_FIELD) return [];
    return text.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
  }

  function bundleIdValid(value) {
    const labels = str(value).split('.');
    if (labels.length < 2) return false;
    return labels.every((label) => BUNDLE_LABEL_RE.test(label));
  }

  function appleAppId(value) {
    const text = str(value).trim();
    if (!text || text.length > 200) return null;
    const dot = text.indexOf('.');
    if (dot < 0) return null;
    const team = text.slice(0, dot);
    const bundle = text.slice(dot + 1);
    if (!TEAM_ID_RE.test(team)) return null;
    if (!bundleIdValid(bundle)) return null;
    return `${team}.${bundle}`;
  }

  function androidPackage(value) {
    const text = str(value).trim();
    if (!text || text.length > 200) return null;
    const labels = text.split('.');
    if (labels.length < 2) return null;
    return labels.every((label) => ANDROID_LABEL_RE.test(label)) ? text : null;
  }

  // Google's tooling prints fingerprints uppercase with colons, `keytool` prints
  // them however the local locale feels like, and people paste both. Accept the
  // digits, reject anything that is not exactly 32 bytes.
  function certFingerprint(value) {
    const text = str(value).trim().toUpperCase();
    if (!text || text.length > 200) return null;
    const normalized = text.includes(':') ? text : (text.match(/.{1,2}/g) || []).join(':');
    return FINGERPRINT_RE.test(normalized) ? normalized : null;
  }

  // A path component filters which URLs open the app. `/*` — everything on this
  // origin — is the correct default here: the whole product is one SPA and every
  // entry route already lives behind the same document.
  function pathComponents(value) {
    const parts = splitList(value).slice(0, MAX_PATHS);
    if (!parts.length) return DEFAULT_COMPONENTS.map((item) => Object.assign({}, item));
    const out = [];
    for (const part of parts) {
      if (!part.startsWith('/') || part.length > 200) return null;
      out.push({ '/': part });
    }
    return out;
  }

  function uniqueList(list) {
    const seen = new Set(); const out = [];
    for (const item of list) { if (!seen.has(item)) { seen.add(item); out.push(item); } }
    return out;
  }

  /* Apple configuration → document, or a named refusal.
   * `appIds` is required; everything else has a working default. */
  function appleConfig(input) {
    const source = input && typeof input === 'object' ? input : {};
    const raw = splitList(source.appIds);
    if (!raw.length) return { ok: false, reason: 'not_configured', appIds: [], components: [] };
    if (raw.length > MAX_APP_IDS) return { ok: false, reason: 'too_many_app_ids', appIds: [], components: [] };
    const appIds = [];
    for (const item of raw) {
      const id = appleAppId(item);
      if (!id) return { ok: false, reason: 'invalid_app_id', appIds: [], components: [] };
      appIds.push(id);
    }
    const components = pathComponents(source.paths);
    if (!components) return { ok: false, reason: 'invalid_path', appIds: [], components: [] };
    return { ok: true, reason: '', appIds: uniqueList(appIds), components };
  }

  /* The modern `applinks` shape: `details` carries `components`, and the legacy
   * top-level `apps` key is gone. `webcredentials` is included with the same
   * identifiers so password autofill and passkeys associate with this origin
   * without a second file and a second deploy. */
  function appleDocument(config) {
    const parsed = config && config.ok === true ? config : appleConfig(config);
    if (!parsed.ok) return null;
    return {
      applinks: {
        details: parsed.appIds.map((appId) => ({
          appIDs: [appId],
          components: parsed.components.map((item) => Object.assign({}, item)),
        })),
      },
      webcredentials: { apps: parsed.appIds.slice() },
    };
  }

  /* Android configuration → document, or a named refusal. A package with no
   * signing fingerprint is refused rather than published empty: an assetlinks
   * file that lists no certificate verifies nothing and quietly disables the
   * app link it was meant to prove. */
  function androidConfig(input) {
    const source = input && typeof input === 'object' ? input : {};
    const pkg = str(source.packageName).trim();
    const rawPrints = splitList(source.fingerprints);
    if (!pkg && !rawPrints.length) return { ok: false, reason: 'not_configured', packageName: '', fingerprints: [] };
    const name = androidPackage(pkg);
    if (!name) return { ok: false, reason: 'invalid_package', packageName: '', fingerprints: [] };
    if (!rawPrints.length) return { ok: false, reason: 'missing_fingerprint', packageName: '', fingerprints: [] };
    if (rawPrints.length > MAX_FINGERPRINTS) return { ok: false, reason: 'too_many_fingerprints', packageName: '', fingerprints: [] };
    const fingerprints = [];
    for (const item of rawPrints) {
      const print = certFingerprint(item);
      if (!print) return { ok: false, reason: 'invalid_fingerprint', packageName: '', fingerprints: [] };
      fingerprints.push(print);
    }
    return { ok: true, reason: '', packageName: name, fingerprints: uniqueList(fingerprints) };
  }

  function androidDocument(config) {
    const parsed = config && config.ok === true ? config : androidConfig(config);
    if (!parsed.ok) return null;
    return [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: parsed.packageName,
        sha256_cert_fingerprints: parsed.fingerprints.slice(),
      },
    }];
  }

  /* Both platforms fetch these as plain JSON and both reject a signed or
   * otherwise decorated body, so serialization stays deliberately boring. */
  function serialize(document) {
    return document === null || document === undefined ? '' : JSON.stringify(document);
  }

  return Object.freeze({
    TEAM_ID_RE, FINGERPRINT_RE, MAX_APP_IDS, MAX_FINGERPRINTS, MAX_PATHS,
    DEFAULT_COMPONENTS,
    appleAppId, androidPackage, certFingerprint, bundleIdValid, pathComponents,
    appleConfig, appleDocument, androidConfig, androidDocument, serialize,
  });
});
