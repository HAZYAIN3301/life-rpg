(function initTravellerAppearanceControllerV2(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TravellerAppearanceControllerV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function travellerAppearanceControllerFactory(root) {
  'use strict';

  const VERSION = '2.0.0';
  const MAX_PREFLIGHT_PATHS = 92;
  const PHASES = Object.freeze([
    'idle',
    'preparing',
    'stopping-scene',
    'persisting',
    'applying',
    'rolling-back',
    'error',
    'recovery-required',
    'disposed',
  ]);

  function controllerError(code, message, details) {
    const error = new Error(message);
    error.name = 'TravellerAppearanceControllerError';
    error.code = code;
    if (details !== undefined) error.details = details;
    return error;
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function wrapError(error, fallbackCode, fallbackMessage) {
    if (typeof error?.code === 'string') return error;
    if (error?.name === 'AbortError') return controllerError('aborted', 'Traveller appearance change was aborted');
    return controllerError(fallbackCode, fallbackMessage, { cause: error });
  }

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    return Object.freeze(value);
  }

  function copySettings(value, cloneImpl) {
    if (!isRecord(value)) throw controllerError('invalid-settings', 'Traveller appearance requires account settings');
    let copy;
    try { copy = cloneImpl(value); }
    catch (error) {
      throw controllerError('invalid-settings', 'Traveller account settings are not cloneable', { cause: error });
    }
    if (!isRecord(copy)) throw controllerError('invalid-settings', 'Traveller appearance requires account settings');
    return copy;
  }

  function snapshotChange(value) {
    if (!isRecord(value)) throw controllerError('invalid-change', 'Traveller appearance change must be an object');
    const copy = { ...value };
    if (value.palette !== undefined) {
      if (!isRecord(value.palette)) throw controllerError('invalid-change', 'Traveller palette change must be an object');
      copy.palette = Object.freeze({ ...value.palette });
    }
    return Object.freeze(copy);
  }

  function canonicalArtPath(value) {
    return typeof value === 'string'
      && value.length <= 512
      && /^\/art\/[a-z0-9][a-z0-9/_-]*\.png$/.test(value)
      && !value.includes('//')
      && !value.split('/').includes('..');
  }

  function exactPaths(value) {
    if (!Array.isArray(value) || value.length > MAX_PREFLIGHT_PATHS) {
      throw controllerError('invalid-preflight', 'Traveller appearance preflight paths are invalid');
    }
    const paths = [];
    const seen = new Set();
    for (const path of value) {
      if (!canonicalArtPath(path) || seen.has(path)) {
        throw controllerError('invalid-preflight', 'Traveller appearance preflight paths must be unique immutable art PNGs');
      }
      seen.add(path);
      paths.push(path);
    }
    return Object.freeze(paths);
  }

  function normalizedVisual(value) {
    const visual = value === undefined || value === null ? {} : value;
    if (!isRecord(visual)) throw controllerError('invalid-visual', 'Traveller visual preflight returned an invalid transaction');
    for (const key of ['apply', 'rollback', 'release']) {
      if (visual[key] !== undefined && typeof visual[key] !== 'function') {
        throw controllerError('invalid-visual', 'Traveller visual transaction has an invalid ' + key + ' hook');
      }
    }
    let released = false;
    return Object.freeze({
      async apply(context) { return visual.apply?.(context); },
      async rollback(context) { return visual.rollback?.(context); },
      release(outcome, context) {
        if (released) return;
        released = true;
        try { visual.release?.(outcome, context); } catch {}
      },
    });
  }

  function abortable(promise, signal) {
    if (!signal) return Promise.resolve(promise);
    if (signal.aborted) return Promise.reject(controllerError('aborted', 'Traveller appearance change was aborted'));
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (method, value) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener?.('abort', onAbort);
        method(value);
      };
      const onAbort = () => finish(reject, controllerError('aborted', 'Traveller appearance change was aborted'));
      signal.addEventListener?.('abort', onAbort, { once: true });
      Promise.resolve(promise).then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
    });
  }

  function abortableVisual(factory, signal, context) {
    if (signal?.aborted) return Promise.reject(controllerError('aborted', 'Traveller appearance change was aborted'));
    return new Promise((resolve, reject) => {
      let settled = false;
      let abortWon = false;
      const cleanup = () => signal?.removeEventListener?.('abort', onAbort);
      const onAbort = () => {
        if (settled) return;
        settled = true;
        abortWon = true;
        cleanup();
        reject(controllerError('aborted', 'Traveller appearance change was aborted'));
      };
      signal?.addEventListener?.('abort', onAbort, { once: true });
      Promise.resolve().then(() => {
        if (signal?.aborted) throw controllerError('aborted', 'Traveller appearance change was aborted');
        return factory();
      }).then((value) => {
        let visual;
        try { visual = normalizedVisual(value); }
        catch (error) {
          if (!abortWon && !settled) {
            settled = true;
            cleanup();
            reject(error);
          }
          return;
        }
        if (abortWon || signal?.aborted) {
          visual.release('aborted', context);
          return;
        }
        if (settled) return;
        settled = true;
        cleanup();
        resolve(visual);
      }, (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
    });
  }

  function createController(options = {}) {
    const lookApi = options.lookApi || root?.TravellerLookV2;
    const session = options.session;
    const readSettings = options.readSettings;
    const persistSettings = options.persistSettings;
    const publishSettings = options.publishSettings;
    const requiredBasePaths = options.requiredBasePaths;
    const prepareVisual = options.prepareVisual;
    const cancelScene = options.cancelScene;
    const AbortControllerImpl = options.AbortControllerImpl || root?.AbortController;
    const structuredCloneImpl = options.structuredCloneImpl || root?.structuredClone;
    if (
      !lookApi?.request
      || !session?.load
      || !session?.manifest
      || !session?.prefetch
      || typeof readSettings !== 'function'
      || typeof persistSettings !== 'function'
      || typeof publishSettings !== 'function'
      || typeof requiredBasePaths !== 'function'
      || typeof prepareVisual !== 'function'
      || typeof cancelScene !== 'function'
      || typeof AbortControllerImpl !== 'function'
      || typeof structuredCloneImpl !== 'function'
    ) {
      throw controllerError('runtime-unavailable', 'Traveller appearance controller dependencies are unavailable');
    }

    let disposed = false;
    let nextTransactionId = 1;
    let activeAbort = null;
    let queueTail = Promise.resolve();
    let state = Object.freeze({
      phase: 'idle',
      busy: false,
      disposed: false,
      transactionId: null,
      error: null,
    });
    const listeners = new Set();

    function publishPhase(phase, transactionId = null, error = null) {
      if (!PHASES.includes(phase)) throw controllerError('invalid-phase', 'Unknown Traveller appearance controller phase');
      if (disposed && phase !== 'disposed' && phase !== 'recovery-required') return state;
      state = Object.freeze({
        phase,
        busy: !['idle', 'error', 'recovery-required', 'disposed'].includes(phase),
        disposed: disposed || phase === 'disposed',
        transactionId,
        error: error ? Object.freeze({ code: error.code || 'change-failed', message: error.message }) : null,
      });
      for (const listener of listeners) {
        try { listener(state); } catch {}
      }
      return state;
    }

    function ensureActive(signal, transactionId) {
      if (disposed) throw controllerError('disposed', 'Traveller appearance controller is disposed');
      if (signal?.aborted || activeAbort?.signal !== signal) {
        throw controllerError('aborted', 'Traveller appearance change was aborted', { transactionId });
      }
    }

    async function rollbackPersisted(context, visual, applyStarted, cause) {
      publishPhase('rolling-back', context.transactionId);
      let saved = false;
      let rollbackCause = null;
      try {
        saved = await persistSettings(context.beforeSettings, Object.freeze({ ...context, rollback: true, cause }));
      } catch (error) {
        rollbackCause = error;
      }
      if (saved !== true) {
        visual.release('recovery-required', context);
        const failure = controllerError(
          'rollback-failed',
          'Traveller appearance could not restore the previous account settings',
          { cause, rollbackCause },
        );
        publishPhase('recovery-required', context.transactionId, failure);
        throw failure;
      }
      try {
        publishSettings(
          copySettings(context.beforeSettings, structuredCloneImpl),
          Object.freeze({ ...context, rollback: true, cause }),
        );
        if (applyStarted) await visual.rollback(Object.freeze({ ...context, cause }));
      } catch (error) {
        visual.release('recovery-required', context);
        const failure = controllerError(
          'visual-rollback-failed',
          'Traveller appearance settings were restored but the visible character needs recovery',
          { cause: error },
        );
        publishPhase('recovery-required', context.transactionId, failure);
        throw failure;
      }
      visual.release('rolled-back', context);
    }

    async function execute(transactionId, requestedChange) {
      if (disposed) throw controllerError('disposed', 'Traveller appearance controller is disposed');
      if (state.phase === 'recovery-required') {
        throw controllerError('recovery-required', 'Traveller appearance requires recovery before another change');
      }
      const abort = new AbortControllerImpl();
      activeAbort = abort;
      let visual = normalizedVisual();
      let persisted = false;
      let applyStarted = false;
      let context = null;
      try {
        publishPhase('preparing', transactionId);
        const beforeSettings = copySettings(readSettings(), structuredCloneImpl);
        const request = lookApi.request(beforeSettings, requestedChange);
        ensureActive(abort.signal, transactionId);
        if (!request.changed) {
          publishPhase('idle');
          return Object.freeze({ changed: false, transactionId, look: request.look });
        }
        const nextSettings = deepFreeze({
          ...beforeSettings,
          ...request.patch,
          avatarCorePalette: { ...request.patch.avatarCorePalette },
        });
        context = Object.freeze({
          transactionId,
          signal: abort.signal,
          before: request.before,
          after: request.after,
          look: request.look,
          beforeSettings: deepFreeze(beforeSettings),
          nextSettings,
        });
        await abortable(session.load(), abort.signal);
        ensureActive(abort.signal, transactionId);
        const pathValues = await abortable(
          Promise.resolve().then(() => requiredBasePaths(Object.freeze({ ...context, manifest: session.manifest() }))),
          abort.signal,
        );
        const paths = exactPaths(pathValues);
        await abortable(
          Promise.resolve().then(() => session.prefetch(paths, request.look, { signal: abort.signal })),
          abort.signal,
        );
        ensureActive(abort.signal, transactionId);
        visual = await abortableVisual(
          () => prepareVisual(Object.freeze({ ...context, paths })),
          abort.signal,
          context,
        );
        ensureActive(abort.signal, transactionId);
        publishPhase('stopping-scene', transactionId);
        await abortable(Promise.resolve().then(() => cancelScene(context)), abort.signal);
        ensureActive(abort.signal, transactionId);
        publishPhase('persisting', transactionId);
        const saved = await persistSettings(nextSettings, Object.freeze({ ...context, rollback: false }));
        if (saved !== true) throw controllerError('save-failed', 'Traveller appearance settings were not saved');
        persisted = true;
        publishSettings(copySettings(nextSettings, structuredCloneImpl), Object.freeze({ ...context, rollback: false }));
        ensureActive(abort.signal, transactionId);
        publishPhase('applying', transactionId);
        applyStarted = true;
        await visual.apply(context);
        ensureActive(abort.signal, transactionId);
        visual.release('committed', context);
        publishPhase('idle');
        return Object.freeze({
          changed: true,
          transactionId,
          before: request.before,
          after: request.after,
          look: request.look,
          settings: deepFreeze(copySettings(nextSettings, structuredCloneImpl)),
        });
      } catch (rawError) {
        const error = wrapError(rawError, 'change-failed', 'Traveller appearance change failed');
        if (persisted && context) await rollbackPersisted(context, visual, applyStarted, error);
        else visual.release('aborted', context);
        if (disposed) {
          publishPhase('disposed');
          throw controllerError('disposed', 'Traveller appearance controller is disposed');
        }
        if (state.phase !== 'recovery-required') publishPhase('error', transactionId, error);
        throw error;
      } finally {
        if (activeAbort === abort) activeAbort = null;
      }
    }

    function change(value) {
      if (disposed) return Promise.reject(controllerError('disposed', 'Traveller appearance controller is disposed'));
      if (state.phase === 'recovery-required') {
        return Promise.reject(controllerError('recovery-required', 'Traveller appearance requires recovery before another change'));
      }
      let requestedChange;
      try { requestedChange = snapshotChange(value); }
      catch (error) { return Promise.reject(error); }
      const transactionId = nextTransactionId++;
      const result = queueTail.catch(() => {}).then(() => execute(transactionId, requestedChange));
      queueTail = result.catch(() => {});
      return result;
    }

    function status() {
      return state;
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') throw controllerError('invalid-listener', 'Traveller appearance listener must be a function');
      if (disposed) throw controllerError('disposed', 'Traveller appearance controller is disposed');
      listeners.add(listener);
      listener(state);
      let active = true;
      return function unsubscribe() {
        if (!active) return;
        active = false;
        listeners.delete(listener);
      };
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      activeAbort?.abort?.();
      activeAbort = null;
      publishPhase('disposed');
      listeners.clear();
    }

    return Object.freeze({ change, status, subscribe, dispose });
  }

  return Object.freeze({ VERSION, MAX_PREFLIGHT_PATHS, PHASES, createController });
});
