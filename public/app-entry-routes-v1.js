/* One contract for every way a person can arrive at Satoru with an intention
 * already formed: a manifest shortcut, a link from the browser companion, a
 * Universal Link, an App Intent, a widget tap, a notification action.
 *
 * The module is pure. It reads no `location`, writes no history, touches no
 * storage and knows nothing about views or goals beyond the names the caller
 * hands it. The caller parses the URL once at boot, parks the result, and applies
 * it when the app is actually able to act.
 *
 * Three things this fixes about doing it inline:
 *
 *  1. An intention used to die on a cold start. The old code read `location`
 *     deep inside the post-login load, so tapping "open the return screen"
 *     while logged out, or with an expired session, lost the intent entirely —
 *     the person logged in and landed on a default screen. Parking survives the
 *     login round-trip and a reload.
 *  2. An unknown verb used to fall through silently with its parameters still in
 *     the URL, so a reload could re-fire whatever the next release taught that
 *     verb to mean. Every recognized shape is now consumed exactly once and a
 *     refusal is named rather than implied.
 *  3. A parked intention has to expire. A tab restored tomorrow must not open an
 *     attention gate the person meant to open yesterday. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AppEntryRoutesV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // The closed vocabulary. A verb that is not here is consumed and refused, never
  // guessed at. `finish` is accepted from a shortcut but never from the extension:
  // the extension may ask to open a gate or a return, and nothing else.
  const FOCUS_VERBS = Object.freeze(['dayrec', 'capture']);
  const ATTENTION_VERBS = Object.freeze(['gate', 'return', 'finish']);
  const EXTENSION_VERBS = Object.freeze(['gate', 'return']);
  const VERBS = Object.freeze(FOCUS_VERBS.concat(ATTENTION_VERBS));

  // Parameters this contract owns. They are stripped from the address bar at
  // capture time so a reload cannot replay the intention and so nothing lands in
  // browser history or an outgoing Referer header.
  const OWNED_PARAMS = Object.freeze(['do', 'app', 'source', 'userId', 'outcome', 'session', 'permission', 'redirect']);
  // These describe where the person is, not what they asked to happen, so they
  // deliberately survive in the address bar: reloading a link that says `view=today`
  // should land on Today again. Only the action vocabulary above is consumed.
  const VIEW_PARAMS = Object.freeze(['view', 'goal']);

  const RECORD_VERSION = 1;
  // Long enough to survive a login, a password reset round-trip and a slow
  // network. Short enough that a restored tab does not open yesterday's gate.
  const MAX_AGE_MS = 30 * 60 * 1000;
  const MAX_TARGET = 80;
  const MAX_GOAL_ID = 120;
  const MAX_VIEW = 40;

  function str(value) {
    return typeof value === 'string' ? value : '';
  }

  function entries(search) {
    const text = str(search).replace(/^\?/, '');
    if (!text || text.length > 4000) return [];
    return text.split('&').filter(Boolean).map((pair) => {
      const at = pair.indexOf('=');
      const rawKey = at < 0 ? pair : pair.slice(0, at);
      const rawValue = at < 0 ? '' : pair.slice(at + 1);
      const decode = (part) => { try { return decodeURIComponent(part.replace(/\+/g, ' ')); } catch { return part; } };
      return [decode(rawKey), decode(rawValue)];
    });
  }

  function encode(list) {
    return list.map(([key, value]) => (
      value === '' ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )).join('&');
  }

  function pick(list, key) {
    for (const [k, v] of list) { if (k === key) return v; }
    return null;
  }

  function without(list, keys) {
    const drop = new Set(keys);
    return list.filter(([key]) => !drop.has(key));
  }

  /* Parse one entry URL into a plan.
   *
   * `options.views` — names the caller is willing to open. Unknown names are
   *   ignored rather than refused: a shortcut from an older release naming a view
   *   that no longer exists should open the app, not complain.
   * `options.resolveExtensionTarget` — turns an extension-supplied site label into
   *   a known target, or returns nothing. The extension vocabulary stays closed
   *   here exactly as it was: a suffix such as `tiktok.com.evil` resolves to
   *   nothing and never reaches a dialog or a write path.
   *
   * Returns `{ view, goalId, intent, cleanedSearch, refusal }`. `cleanedSearch`
   * is what should remain in the address bar; `refusal` names why an intent is
   * absent when the URL clearly meant to carry one. */
  function parse(search, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const views = Array.isArray(opts.views) ? opts.views
      : (opts.views && typeof opts.views === 'object' ? Object.keys(opts.views) : []);
    const resolve = typeof opts.resolveExtensionTarget === 'function' ? opts.resolveExtensionTarget : null;

    let list = entries(search);
    const result = { view: null, goalId: null, intent: null, cleanedSearch: '', refusal: '' };

    const rawView = str(pick(list, 'view')).slice(0, MAX_VIEW);
    if (rawView && views.indexOf(rawView) >= 0) result.view = rawView;
    const rawGoal = str(pick(list, 'goal')).slice(0, MAX_GOAL_ID);
    // Validity of the id cannot be decided here: the goals are not loaded yet at
    // capture time. The caller checks it when it applies the plan.
    if (rawGoal) result.goalId = rawGoal;

    const source = str(pick(list, 'source')).trim().toLowerCase();
    const rawTarget = str(pick(list, 'app')).slice(0, MAX_TARGET);
    const rawVerb = str(pick(list, 'do')).trim().toLowerCase();
    if (!rawVerb) {
      result.cleanedSearch = encode(list);
      return result;
    }

    // From here the URL claims to carry an intention, so the owned parameters are
    // consumed whatever the outcome. A refused verb must not stay in the address
    // bar waiting for a future release to give it a meaning.
    list = without(list, OWNED_PARAMS);
    result.cleanedSearch = encode(list);

    if (VERBS.indexOf(rawVerb) < 0) { result.refusal = 'unknown_verb'; return result; }

    if (FOCUS_VERBS.indexOf(rawVerb) >= 0) {
      result.intent = { action: rawVerb, source: 'shortcut', target: '', targetId: '' };
      return result;
    }

    if (!source) {
      result.intent = { action: rawVerb, source: 'shortcut', target: rawTarget, targetId: '' };
      return result;
    }
    if (source !== 'extension') { result.refusal = 'unknown_source'; return result; }
    if (EXTENSION_VERBS.indexOf(rawVerb) < 0) { result.refusal = 'verb_not_allowed_for_source'; return result; }
    const target = resolve ? resolve(rawTarget) : null;
    if (!target || !target.id) { result.refusal = 'unknown_target'; return result; }
    result.intent = {
      action: rawVerb, source: 'extension',
      target: str(target.label).slice(0, MAX_TARGET), targetId: str(target.id).slice(0, MAX_TARGET),
    };
    return result;
  }

  /* A plan worth parking: an intent, or a view the app could not open yet.
   * Nothing is parked when the URL carried no instruction. */
  function worthParking(plan) {
    if (!plan || typeof plan !== 'object') return false;
    return Boolean(plan.intent || plan.view || plan.goalId);
  }

  function park(plan, nowMs) {
    if (!worthParking(plan)) return null;
    const at = Number.isFinite(nowMs) ? Math.floor(nowMs) : 0;
    return {
      v: RECORD_VERSION, at,
      view: plan.view || null,
      goalId: plan.goalId || null,
      intent: plan.intent ? Object.assign({}, plan.intent) : null,
    };
  }

  /* Read a parked record back. Returns `{ plan, reason }`; `plan` is null when the
   * record is missing, from another version, or older than the window. An expired
   * record is reported rather than applied, so the caller can drop it and the
   * person is not surprised by yesterday's gate. */
  function unpark(record, nowMs, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const maxAge = Number.isFinite(opts.maxAgeMs) && opts.maxAgeMs > 0 ? opts.maxAgeMs : MAX_AGE_MS;
    if (!record || typeof record !== 'object' || Array.isArray(record)) return { plan: null, reason: 'absent' };
    if (record.v !== RECORD_VERSION) return { plan: null, reason: 'version' };
    const at = Number.isFinite(record.at) ? record.at : NaN;
    const now = Number.isFinite(nowMs) ? nowMs : NaN;
    if (!Number.isFinite(at) || !Number.isFinite(now)) return { plan: null, reason: 'malformed' };
    // A clock moved backwards (timezone edit, DST, a device that lost its battery)
    // must not turn into an intent that never expires.
    if (now < at) return { plan: null, reason: 'expired' };
    if (now - at > maxAge) return { plan: null, reason: 'expired' };
    const intent = record.intent && typeof record.intent === 'object' && !Array.isArray(record.intent)
      ? record.intent : null;
    if (intent && VERBS.indexOf(str(intent.action)) < 0) return { plan: null, reason: 'malformed' };
    const plan = {
      view: typeof record.view === 'string' && record.view ? record.view : null,
      goalId: typeof record.goalId === 'string' && record.goalId ? record.goalId : null,
      intent: intent ? {
        action: str(intent.action), source: str(intent.source) || 'shortcut',
        target: str(intent.target), targetId: str(intent.targetId),
      } : null,
      cleanedSearch: '', refusal: '',
    };
    if (!worthParking(plan)) return { plan: null, reason: 'empty' };
    return { plan, reason: '' };
  }

  return Object.freeze({
    VERBS, FOCUS_VERBS, ATTENTION_VERBS, EXTENSION_VERBS,
    OWNED_PARAMS, VIEW_PARAMS, RECORD_VERSION, MAX_AGE_MS,
    parse, park, unpark, worthParking,
  });
});
