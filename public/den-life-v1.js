/* Satoru Den Life v2.
 *
 * A persistent director for authored full-frame Den actions. It survives DOM
 * rebinds, never treats a CSS scale as acting, and keeps BODY focus active for
 * the whole session instead of firing one greeting at the start.
 */
(function exposeDenLife(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DenLifeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDenLife(root) {
  'use strict';

  const VERSION = '2.5.0';
  const FIRST_AMBIENT_MS = 8000;
  const FIRST_FOCUS_MS = 3200;
  const RETRY_MS = 3000;
  const AMBIENT_SEQUENCE = Object.freeze([
    Object.freeze({ id: 'toad-blink', kind: 'toad', gap: 14000 }),
    Object.freeze({ id: 'recovery-stretch', kind: 'recovery', gap: 22000 }),
    Object.freeze({ id: 'window-visit', kind: 'window', gap: 24000 }),
    Object.freeze({ id: 'bench-read', kind: 'room', gap: 30000 }),
    Object.freeze({ id: 'recovery-glide-tour', kind: 'recovery', gap: 28000 }),
    Object.freeze({ id: 'toad-stretch', kind: 'toad', gap: 22000 }),
    Object.freeze({ id: 'recovery-helpers', kind: 'recovery', gap: 26000 }),
    Object.freeze({ id: 'toad-hop-tour', kind: 'toad', gap: 26000 }),
    Object.freeze({ id: 'bench-rest', kind: 'room', gap: 26000 }),
    Object.freeze({ id: 'recovery-cushion-nap', kind: 'recovery', gap: 34000 }),
    Object.freeze({ id: 'resources-ledger', kind: 'resources', gap: 30000 }),
    Object.freeze({ id: 'resources-stash', kind: 'resources', gap: 32000 }),
    Object.freeze({ id: 'toad-bench-nap', kind: 'toad', gap: 32000 }),
    Object.freeze({ id: 'resources-rest', kind: 'resources', gap: 36000 }),
  ]);
  const BODY_FOCUS_SEQUENCE = Object.freeze([
    Object.freeze({ id: 'whistle', kind: 'pair', duration: 12000, gap: 5000 }),
    Object.freeze({ id: 'pushup', kind: 'pair', duration: 14000, gap: 6000 }),
    Object.freeze({ id: 'stretch', kind: 'pair', duration: 14000, gap: 7000 }),
    Object.freeze({ id: 'train', kind: 'pair', duration: 12000, gap: 6000 }),
    Object.freeze({ id: 'rest', kind: 'pair', duration: 10000, gap: 10000 }),
  ]);
  const MONEY_FOCUS_SEQUENCE = Object.freeze([
    Object.freeze({ id: 'budget', kind: 'resources-pair', duration: 15000, gap: 8000 }),
    Object.freeze({ id: 'count', kind: 'resources-pair', duration: 16000, gap: 9000 }),
    Object.freeze({ id: 'focus', kind: 'resources-pair', duration: 32000, gap: 12000 }),
    Object.freeze({ id: 'reserve', kind: 'resources-pair', duration: 15000, gap: 10000 }),
    Object.freeze({ id: 'close', kind: 'resources-pair', duration: 9000, gap: 16000 }),
  ]);

  let director = null;
  let sequenceSeed = 0;

  function normalizeContext(value) {
    const input = value || {};
    return Object.freeze({
      focusCanon: String(input.focusCanon || ''),
      focusRunning: input.focusRunning === true,
      focusSession: String(input.focusSession || ''),
    });
  }

  function modeFor(context) {
    const safe = normalizeContext(context);
    if (safe.focusRunning && safe.focusCanon === 'body') return 'body-focus';
    if (safe.focusRunning && safe.focusCanon === 'money') return 'money-focus';
    return 'ambient';
  }

  function contextKey(context) {
    const safe = normalizeContext(context);
    return `${modeFor(safe)}:${safe.focusSession}:${safe.focusCanon}`;
  }

  function sequenceFor(context) {
    const mode = modeFor(context);
    if (mode === 'body-focus') return BODY_FOCUS_SEQUENCE;
    if (mode === 'money-focus') return MONEY_FOCUS_SEQUENCE;
    return AMBIENT_SEQUENCE;
  }

  function canAct(state) {
    if (!state || typeof state.canAct !== 'function') return true;
    try { return state.canAct() !== false; } catch { return false; }
  }

  function clearTimer(state) {
    if (state && state.timer) clearTimeout(state.timer);
    if (state) state.timer = 0;
  }

  function schedule(state, delay) {
    if (!state || director !== state) return;
    clearTimer(state);
    state.nextAt = Math.max(
      Date.now() + Math.max(0, Number(delay) || 0),
      Number(state.holdUntil) || 0,
    );
    state.timer = setTimeout(tick, Math.max(0, state.nextAt - Date.now()));
  }

  function callbackFor(state, action) {
    if (action.kind === 'pair') return state.onPair && state.onPair(action.id, { automatic: true, duration: action.duration });
    if (action.kind === 'room') return state.onRoomAction && state.onRoomAction(action.id, { automatic: true });
    if (action.kind === 'window') return state.onWindowVisit && state.onWindowVisit({ automatic: true });
    if (action.kind === 'toad') return state.onToadBeat && state.onToadBeat(action.id, { automatic: true });
    if (action.kind === 'recovery') return state.onRecoveryBeat && state.onRecoveryBeat(action.id, { automatic: true });
    if (action.kind === 'resources') return state.onResourcesBeat && state.onResourcesBeat(action.id, { automatic: true });
    if (action.kind === 'resources-pair') return state.onResourcesPair && state.onResourcesPair(action.id, { automatic: true, duration: action.duration });
    return false;
  }

  function tick() {
    const state = director;
    if (!state || state.busy) return;
    if (Number(state.holdUntil) > Date.now()) {
      schedule(state, state.holdUntil - Date.now());
      return;
    }
    const scope = state.scope;
    if (!scope || !scope.isConnected || !canAct(state)) {
      schedule(state, RETRY_MS);
      return;
    }
    const sequence = sequenceFor(state.context);
    const action = sequence[state.step % sequence.length];
    state.step += 1;
    state.busy = true;
    let result = false;
    try { result = callbackFor(state, action); } catch { result = false; }
    Promise.resolve(result).then((played) => {
      if (director !== state) return;
      state.busy = false;
      schedule(state, played === false ? RETRY_MS : action.gap);
    }).catch(() => {
      if (director !== state) return;
      state.busy = false;
      schedule(state, RETRY_MS);
    });
  }

  function stop() {
    if (!director) return false;
    clearTimer(director);
    director = null;
    return true;
  }

  function start(target, options) {
    const scope = target;
    const config = options || {};
    if (!scope || !scope.querySelector || (!scope.querySelector('[data-body-toad]') && !scope.querySelector('[data-recovery-slug]') && !scope.querySelector('[data-resources-penguin]'))) return false;
    const context = normalizeContext(config.context);
    const key = contextKey(context);
    if (director && director.key === key) {
      director.scope = scope;
      director.canAct = config.canAct;
      director.onPair = config.onPair;
      director.onRoomAction = config.onRoomAction;
      director.onRecoveryBeat = config.onRecoveryBeat;
      director.onResourcesBeat = config.onResourcesBeat;
      director.onResourcesPair = config.onResourcesPair;
      director.onWindowVisit = config.onWindowVisit;
      director.onToadBeat = config.onToadBeat;
      if (!director.busy && !director.timer) schedule(director, Math.max(0, director.nextAt - Date.now()));
      return true;
    }
    stop();
    director = {
      busy: false,
      canAct: config.canAct,
      context,
      key,
      holdUntil: 0,
      nextAt: 0,
      onPair: config.onPair,
      onRecoveryBeat: config.onRecoveryBeat,
      onResourcesBeat: config.onResourcesBeat,
      onResourcesPair: config.onResourcesPair,
      onRoomAction: config.onRoomAction,
      onToadBeat: config.onToadBeat,
      onWindowVisit: config.onWindowVisit,
      scope,
      step: sequenceSeed++,
      timer: 0,
    };
    schedule(director, modeFor(context) === 'ambient' ? FIRST_AMBIENT_MS : FIRST_FOCUS_MS);
    return true;
  }

  function postpone(target, delay) {
    const scope = target || (director && director.scope);
    if (!director || (scope && director.scope !== scope)) return false;
    director.holdUntil = Date.now() + Math.max(0, Number(delay) || 9000);
    if (!director.busy) schedule(director, director.holdUntil - Date.now());
    return true;
  }

  function inspect() {
    if (!director) return null;
    return Object.freeze({
      busy: director.busy,
      key: director.key,
      holdUntil: director.holdUntil,
      mode: modeFor(director.context),
      nextAt: director.nextAt,
      step: director.step,
    });
  }

  return Object.freeze({
    VERSION,
    FIRST_AMBIENT_MS,
    FIRST_FOCUS_MS,
    RETRY_MS,
    AMBIENT_SEQUENCE,
    BODY_FOCUS_SEQUENCE,
    MONEY_FOCUS_SEQUENCE,
    normalizeContext,
    modeFor,
    contextKey,
    sequenceFor,
    start,
    stop,
    postpone,
    inspect,
  });
});
