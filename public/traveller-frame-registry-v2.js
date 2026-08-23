(function initTravellerFrameRegistryV2(root, factory) {
  const commonJs = typeof module === 'object' && module.exports;
  const lookApi = commonJs ? require('./traveller-look-v2.js') : root?.TravellerLookV2;
  const api = factory(root, lookApi);
  if (commonJs) module.exports = api;
  else root.TravellerFrameRegistryV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function travellerFrameRegistryFactory(root, lookApi) {
  'use strict';

  const VERSION = '2.1.0';
  const MAX_PATHS = 92;
  const CHANNELS = Object.freeze(['skin', 'hair', 'eyes']);

  function registryError(code, message, details) {
    const error = new Error(message);
    error.name = 'TravellerFrameRegistryError';
    error.code = code;
    if (details !== undefined) error.details = details;
    return error;
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function artPath(value) {
    return typeof value === 'string'
      && value.length <= 512
      && /^\/art\/[a-z0-9][a-z0-9/_-]*\.png$/.test(value)
      && !value.includes('//')
      && !value.split('/').includes('..');
  }

  function paths(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PATHS) {
      throw registryError('invalid-paths', 'Traveller frame paths must be a bounded array');
    }
    const result = [];
    const seen = new Set();
    for (const path of value) {
      if (!artPath(path) || seen.has(path)) {
        throw registryError('invalid-paths', 'Traveller frame paths must be unique immutable art PNGs');
      }
      seen.add(path);
      result.push(path);
    }
    return Object.freeze(result);
  }

  function look(value) {
    if (!isRecord(value) || !isRecord(value.palette)) {
      throw registryError('invalid-look', 'Traveller frame registry requires an exact look');
    }
    const morphology = value.morphology;
    const identityId = value.identityId;
    if (
      !lookApi?.GENDERS?.includes?.(morphology)
      || identityId !== lookApi?.IDENTITY_BY_GENDER?.[morphology]
    ) {
      throw registryError('invalid-look', 'Traveller frame look has no authored morphology identity');
    }
    if (Object.keys(value.palette).some((channel) => !CHANNELS.includes(channel))) {
      throw registryError('invalid-look', 'Traveller frame look contains an unknown semantic channel');
    }
    const palette = {};
    for (const channel of CHANNELS) {
      const id = value.palette[channel];
      if (typeof id !== 'string' || !lookApi?.PALETTE_IDS?.[channel]?.includes?.(id)) {
        throw registryError('invalid-look', 'Traveller frame look contains an unauthorised semantic palette');
      }
      palette[channel] = id;
    }
    return Object.freeze({ morphology, identityId, palette: Object.freeze(palette) });
  }

  function lookKey(value) {
    return [
      value.morphology,
      value.identityId,
      `skin:${value.palette.skin}`,
      `hair:${value.palette.hair}`,
      `eyes:${value.palette.eyes}`,
    ].join('|');
  }

  function isOriginal(value) {
    return CHANNELS.every((channel) => value.palette[channel] === 'original');
  }

  function abortError() {
    return registryError('aborted', 'Traveller frame acquisition was aborted');
  }

  function ensureNotAborted(signal) {
    if (signal?.aborted) throw abortError();
  }

  function createRegistry(options = {}) {
    const session = options.session;
    const AbortControllerImpl = options.AbortControllerImpl || root?.AbortController;
    if (
      !session?.load
      || !session?.resolve
      || typeof AbortControllerImpl !== 'function'
      || !lookApi?.IDENTITY_BY_GENDER
      || !lookApi?.PALETTE_IDS
    ) {
      throw registryError('runtime-unavailable', 'Traveller frame registry dependencies are unavailable');
    }

    const lifetimeAbort = new AbortControllerImpl();
    const knownHandles = new WeakSet();
    const releasedHandles = new WeakSet();
    const stageDisposers = new Map();
    let disposed = false;
    let active = null;
    let generation = 0;
    let committingStage = null;
    const stages = new Set();
    const leases = new Set();

    function safeRelease(handle) {
      if (!handle || (typeof handle !== 'object' && typeof handle !== 'function')) return;
      if (releasedHandles.has(handle)) return;
      releasedHandles.add(handle);
      try { handle.release?.(); } catch {}
    }

    function claimHandle(handle) {
      if (!handle || (typeof handle !== 'object' && typeof handle !== 'function')) return true;
      if (knownHandles.has(handle)) return false;
      knownHandles.add(handle);
      return true;
    }

    function resourceSet(entries, exactLook) {
      let released = false;
      const byPath = new Map(entries.map((entry) => [entry.path, entry.handle]));
      return Object.freeze({
        look: exactLook,
        key: lookKey(exactLook),
        byPath,
        urlFor(path) {
          if (released) throw registryError('released', 'Traveller frame resource has been released');
          return byPath.get(path)?.url || null;
        },
        release() {
          if (released) return;
          released = true;
          for (const handle of byPath.values()) safeRelease(handle);
        },
        get released() { return released; },
        get size() { return byPath.size; },
      });
    }

    function combinedSignal(externalSignal) {
      const controller = new AbortControllerImpl();
      const sources = [lifetimeAbort.signal, externalSignal].filter(Boolean);
      const onAbort = () => controller.abort();
      for (const signal of sources) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener?.('abort', onAbort, { once: true });
      }
      return Object.freeze({
        signal: controller.signal,
        cleanup() {
          for (const signal of sources) signal.removeEventListener?.('abort', onAbort);
        },
      });
    }

    function abortable(promise, signal) {
      if (signal?.aborted) return Promise.reject(abortError());
      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (method, value) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener?.('abort', onAbort);
          method(value);
        };
        const onAbort = () => finish(reject, abortError());
        signal?.addEventListener?.('abort', onAbort, { once: true });
        Promise.resolve(promise).then(
          (value) => finish(resolve, value),
          (error) => finish(reject, error),
        );
      });
    }

    function resolveAbortable(path, exactLook, signal) {
      if (signal?.aborted) return Promise.reject(abortError());
      return new Promise((resolve, reject) => {
        let settled = false;
        let abortWon = false;
        const cleanup = () => signal?.removeEventListener?.('abort', onAbort);
        const onAbort = () => {
          if (settled) return;
          settled = true;
          abortWon = true;
          cleanup();
          reject(abortError());
        };
        signal?.addEventListener?.('abort', onAbort, { once: true });
        Promise.resolve().then(() => {
          if (signal?.aborted) throw abortError();
          return session.resolve(path, exactLook, { signal });
        }).then((handle) => {
          if (abortWon || signal?.aborted) {
            if (claimHandle(handle)) safeRelease(handle);
            return;
          }
          if (settled) return;
          settled = true;
          cleanup();
          resolve(handle);
        }, (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        });
      });
    }

    function validateHandle(handle, path, exactLook) {
      const defaultPalette = isOriginal(exactLook);
      if (
        !isRecord(handle)
        || handle.basePath !== path
        || handle.morphology !== exactLook.morphology
        || handle.identityId !== exactLook.identityId
        || handle.lookKey !== lookKey(exactLook)
        || typeof handle.key !== 'string'
        || handle.key.length === 0
        || typeof handle.release !== 'function'
        || typeof handle.url !== 'string'
        || handle.bypass !== defaultPalette
        || (defaultPalette ? handle.url !== path : !handle.url.startsWith('blob:'))
      ) {
        throw registryError('invalid-handle', 'Traveller palette runtime returned a mismatched frame handle');
      }
      return handle;
    }

    async function acquire(exactPaths, exactLook, signal) {
      if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
      ensureNotAborted(signal);
      await abortable(Promise.resolve().then(() => session.load()), signal);
      ensureNotAborted(signal);

      const peerAbort = new AbortControllerImpl();
      const forwardAbort = () => peerAbort.abort();
      if (signal?.aborted) peerAbort.abort();
      else signal?.addEventListener?.('abort', forwardAbort, { once: true });
      let firstFailure = null;
      const tasks = exactPaths.map((path) => (
        resolveAbortable(path, exactLook, peerAbort.signal).then((handle) => {
          if (!claimHandle(handle)) {
            throw registryError('invalid-handle', 'Traveller palette runtime reused an owned frame handle');
          }
          try { validateHandle(handle, path, exactLook); }
          catch (error) {
            safeRelease(handle);
            throw error;
          }
          return Object.freeze({ path, handle });
        }).catch((error) => {
          if (!firstFailure) firstFailure = error;
          peerAbort.abort();
          throw error;
        })
      ));
      let settled;
      try { settled = await Promise.allSettled(tasks); }
      finally { signal?.removeEventListener?.('abort', forwardAbort); }

      const acquired = settled
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      const seenHandles = new Set();
      const seenKeys = new Set();
      for (const entry of acquired) {
        if (seenHandles.has(entry.handle) || seenKeys.has(entry.handle.key)) {
          firstFailure ||= registryError('invalid-handle', 'Traveller palette runtime reused a frame handle');
        }
        seenHandles.add(entry.handle);
        seenKeys.add(entry.handle.key);
      }
      if (firstFailure || signal?.aborted || disposed) {
        for (const entry of acquired) safeRelease(entry.handle);
        if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
        if (signal?.aborted) throw abortError();
        throw firstFailure;
      }
      return resourceSet(acquired, exactLook);
    }

    async function acquireFor(pathValues, lookValue, externalSignal) {
      if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
      const exactPaths = paths(pathValues);
      const exactLook = look(lookValue);
      const operation = combinedSignal(externalSignal);
      let resources;
      try {
        resources = await acquire(exactPaths, exactLook, operation.signal);
        ensureNotAborted(operation.signal);
        if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
        return Object.freeze({ exactLook, resources });
      } catch (error) {
        resources?.release();
        if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
        throw error;
      } finally {
        operation.cleanup();
      }
    }

    async function prepare(pathValues, lookValue, prepareOptions = {}) {
      const acquired = await acquireFor(pathValues, lookValue, prepareOptions.signal);
      const { exactLook, resources } = acquired;
      let stageState = 'prepared';
      let previous = null;
      let stageGeneration = null;
      let stage;

      function ensureReadable() {
        if (['rolled-back', 'aborted', 'disposed'].includes(stageState) || resources.released) {
          throw registryError('invalid-stage', 'Traveller frame stage no longer owns readable resources');
        }
      }

      function disposeStage() {
        if (stageState === 'disposed') return;
        const prior = previous;
        previous = null;
        stageState = 'disposed';
        if (committingStage === stage) committingStage = null;
        stages.delete(stage);
        stageDisposers.delete(stage);
        resources.release();
        prior?.release();
      }

      stage = Object.freeze({
        get state() { return stageState; },
        get generation() { return stageGeneration; },
        get look() { return exactLook; },
        get size() { return resources.size; },
        urlFor(path) {
          ensureReadable();
          if (!artPath(path) || !resources.byPath.has(path)) {
            throw registryError('unknown-frame', 'Traveller frame is not part of this prepared stage');
          }
          return resources.urlFor(path);
        },
        commit() {
          if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
          if (stageState !== 'prepared') throw registryError('invalid-stage', 'Traveller frame stage cannot be committed twice');
          if (committingStage) throw registryError('stage-in-progress', 'Another Traveller frame stage is awaiting finalization');
          previous = active;
          active = resources;
          generation += 1;
          stageGeneration = generation;
          committingStage = stage;
          stageState = 'committed';
          return generation;
        },
        finalize() {
          if (stageState !== 'committed' || active !== resources) {
            throw registryError('invalid-stage', 'Only the active committed Traveller frame stage can finalize');
          }
          const prior = previous;
          previous = null;
          stageState = 'finalized';
          committingStage = null;
          stages.delete(stage);
          stageDisposers.delete(stage);
          prior?.release();
        },
        rollback() {
          if (stageState === 'prepared') {
            stageState = 'rolled-back';
            stages.delete(stage);
            stageDisposers.delete(stage);
            resources.release();
            return;
          }
          if (stageState !== 'committed' || active !== resources) {
            throw registryError('invalid-stage', 'Traveller frame stage is no longer rollback-safe');
          }
          const prior = previous;
          previous = null;
          active = prior;
          generation += 1;
          stageState = 'rolled-back';
          committingStage = null;
          stages.delete(stage);
          stageDisposers.delete(stage);
          resources.release();
        },
        abort() {
          if (stageState !== 'prepared') throw registryError('invalid-stage', 'Only a prepared Traveller frame stage can abort');
          stageState = 'aborted';
          stages.delete(stage);
          stageDisposers.delete(stage);
          resources.release();
        },
      });
      stages.add(stage);
      stageDisposers.set(stage, disposeStage);
      return stage;
    }

    async function lease(pathValues, lookValue, leaseOptions = {}) {
      const acquired = await acquireFor(pathValues, lookValue, leaseOptions.signal);
      const { exactLook, resources } = acquired;
      let released = false;
      let leaseHandle;
      leaseHandle = Object.freeze({
        look: exactLook,
        size: resources.size,
        urlFor(path) {
          if (released || resources.released) {
            throw registryError('released', 'Traveller frame lease has been released');
          }
          if (!artPath(path) || !resources.byPath.has(path)) {
            throw registryError('unknown-frame', 'Traveller frame is not part of this lease');
          }
          return resources.urlFor(path);
        },
        release() {
          if (released) return;
          released = true;
          leases.delete(leaseHandle);
          resources.release();
        },
      });
      if (disposed) {
        resources.release();
        throw registryError('disposed', 'Traveller frame registry is disposed');
      }
      leases.add(leaseHandle);
      return leaseHandle;
    }

    function activeUrl(path) {
      if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
      if (!artPath(path)) throw registryError('invalid-paths', 'Traveller frame path is invalid');
      return active?.urlFor(path) || null;
    }

    function activeLook() {
      if (disposed) throw registryError('disposed', 'Traveller frame registry is disposed');
      return active?.look || null;
    }

    function status() {
      return Object.freeze({
        disposed,
        generation,
        active: Boolean(active),
        activeFrames: active?.size || 0,
        preparedStages: stages.size,
        leases: leases.size,
      });
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      lifetimeAbort.abort();
      const current = active;
      active = null;
      committingStage = null;
      const disposers = Array.from(stageDisposers.values());
      const liveLeases = Array.from(leases);
      stages.clear();
      stageDisposers.clear();
      leases.clear();
      current?.release();
      for (const disposeStage of disposers) disposeStage();
      for (const leaseHandle of liveLeases) leaseHandle.release();
    }

    return Object.freeze({ prepare, lease, activeUrl, activeLook, status, dispose });
  }

  return Object.freeze({ VERSION, MAX_PATHS, createRegistry });
});
