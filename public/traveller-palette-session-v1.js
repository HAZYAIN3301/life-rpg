(function initTravellerPaletteSessionV1(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TravellerPaletteSessionV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function travellerPaletteSessionFactory(root) {
  'use strict';

  const VERSION = '1.0.0';
  const MANIFEST_URL = '/art/avatars/traveller-appearance-v2/palette-masks-v1/manifest.json';

  function sessionError(code, message, details) {
    const error = new Error(message);
    error.name = 'TravellerPaletteSessionError';
    error.code = code;
    if (details !== undefined) error.details = details;
    return error;
  }

  function wrapError(error, fallbackCode, fallbackMessage) {
    if (error?.name === 'AbortError') return error;
    if (typeof error?.code === 'string') return error;
    return sessionError(fallbackCode, fallbackMessage, { cause: error });
  }

  function createSession(options = {}) {
    const paletteApi = options.paletteApi || root?.TravellerPaletteV1;
    const workerClientApi = options.workerClientApi || root?.TravellerPaletteWorkerClientV1;
    const lookApi = options.lookApi || root?.TravellerLookV2;
    const fetchImpl = options.fetchImpl || root?.fetch?.bind(root);
    const AbortControllerImpl = options.AbortControllerImpl || root?.AbortController;
    const URLImpl = options.URLImpl || root?.URL;
    const manifestUrl = options.manifestUrl || MANIFEST_URL;
    if (manifestUrl !== MANIFEST_URL) {
      throw sessionError('invalid-options', 'Traveller palette manifest URL is immutable and cannot be overridden');
    }
    if (
      !paletteApi?.compileManifest
      || !paletteApi?.createRuntime
      || !workerClientApi?.createRenderer
      || !lookApi?.validateCompiledManifest
      || !lookApi?.catalog
      || typeof fetchImpl !== 'function'
      || typeof AbortControllerImpl !== 'function'
      || typeof URLImpl?.revokeObjectURL !== 'function'
    ) {
      throw sessionError('runtime-unavailable', 'Traveller palette session dependencies are unavailable');
    }

    let phase = 'idle';
    let lastError = null;
    let generation = 0;
    let loading = null;
    let controller = null;
    let compiledManifest = null;
    let broker = null;
    let runtime = null;
    let buildingBroker = null;
    let buildingRuntime = null;
    let disposed = false;

    function snapshot() {
      return Object.freeze({
        phase,
        ready: phase === 'ready',
        disposed,
        error: lastError ? Object.freeze({ code: lastError.code || 'session-failed', message: lastError.message }) : null,
        worker: broker?.stats?.() || null,
        cache: runtime?.stats?.() || null,
      });
    }

    function cleanupLive() {
      const liveRuntime = runtime;
      const liveBroker = broker;
      const pendingRuntime = buildingRuntime;
      const pendingBroker = buildingBroker;
      runtime = null;
      broker = null;
      buildingRuntime = null;
      buildingBroker = null;
      compiledManifest = null;
      liveRuntime?.dispose?.();
      if (pendingRuntime && pendingRuntime !== liveRuntime) pendingRuntime.dispose?.();
      liveBroker?.dispose?.();
      if (pendingBroker && pendingBroker !== liveBroker) pendingBroker.dispose?.();
    }

    async function fetchApprovedManifest(signal) {
      let response;
      try {
        response = await fetchImpl(MANIFEST_URL, {
          cache: 'force-cache',
          credentials: 'same-origin',
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw sessionError('aborted', 'Traveller palette manifest load was aborted');
        throw wrapError(error, 'manifest-load-failed', 'Could not load Traveller palette manifest');
      }
      if (!response?.ok || typeof response.json !== 'function') {
        throw sessionError('manifest-load-failed', 'Could not load Traveller palette manifest: HTTP ' + (response?.status || 0));
      }
      const contentType = response.headers?.get?.('content-type') || '';
      if (!/^application\/json(?:;|$)/i.test(contentType)) {
        throw sessionError('manifest-load-failed', 'Traveller palette manifest response is not JSON');
      }
      try {
        return await response.json();
      } catch (error) {
        throw sessionError('manifest-load-failed', 'Traveller palette manifest JSON is invalid', { cause: error });
      }
    }

    async function build(currentGeneration) {
      controller = new AbortControllerImpl();
      let nextBroker = null;
      let nextRuntime = null;
      try {
        const rawManifest = await fetchApprovedManifest(controller.signal);
        if (disposed || currentGeneration !== generation) {
          throw sessionError('aborted', 'Traveller palette session load became stale');
        }
        const compiled = paletteApi.compileManifest(rawManifest);
        lookApi.validateCompiledManifest(compiled);
        nextBroker = workerClientApi.createRenderer({
          manifest: rawManifest,
          WorkerImpl: options.WorkerImpl,
          URLImpl,
          workerUrl: options.workerUrl,
          maxQueue: options.maxQueue,
          initTimeoutMs: options.initTimeoutMs,
          jobTimeoutMs: options.jobTimeoutMs,
        });
        buildingBroker = nextBroker;
        if (typeof nextBroker.whenReady !== 'function') {
          throw sessionError('runtime-unavailable', 'Traveller palette worker has no readiness contract');
        }
        await nextBroker.whenReady();
        if (disposed || currentGeneration !== generation) {
          throw sessionError('aborted', 'Traveller palette session load became stale');
        }
        nextRuntime = paletteApi.createRuntime({
          manifest: compiled,
          renderFrame: nextBroker.renderFrame,
          maxEntries: options.maxEntries,
          URLImpl,
          revokeObjectURL: URLImpl.revokeObjectURL.bind(URLImpl),
        });
        buildingRuntime = nextRuntime;
        if (disposed || currentGeneration !== generation) {
          throw sessionError('aborted', 'Traveller palette session load became stale');
        }
        compiledManifest = compiled;
        broker = nextBroker;
        runtime = nextRuntime;
        buildingBroker = null;
        buildingRuntime = null;
        nextBroker = null;
        nextRuntime = null;
        phase = 'ready';
        lastError = null;
        return snapshot();
      } catch (error) {
        if (buildingRuntime === nextRuntime) {
          buildingRuntime = null;
          nextRuntime?.dispose?.();
        }
        if (buildingBroker === nextBroker) {
          buildingBroker = null;
          nextBroker?.dispose?.();
        }
        if (!disposed && currentGeneration === generation) {
          phase = 'error';
          lastError = wrapError(error, 'session-failed', 'Traveller palette session failed');
        }
        throw disposed ? sessionError('disposed', 'Traveller palette session is disposed') : lastError || error;
      } finally {
        if (currentGeneration === generation) {
          controller = null;
          loading = null;
        }
      }
    }

    function load() {
      if (disposed) return Promise.reject(sessionError('disposed', 'Traveller palette session is disposed'));
      if (phase === 'ready') return Promise.resolve(snapshot());
      if (loading) return loading;
      if (phase === 'error') return Promise.reject(lastError);
      phase = 'loading';
      lastError = null;
      const currentGeneration = ++generation;
      loading = build(currentGeneration);
      return loading;
    }

    function retry() {
      if (disposed) return Promise.reject(sessionError('disposed', 'Traveller palette session is disposed'));
      if (phase === 'ready' || phase === 'loading') return load();
      cleanupLive();
      phase = 'idle';
      lastError = null;
      return load();
    }

    function requireReady() {
      if (disposed) throw sessionError('disposed', 'Traveller palette session is disposed');
      if (phase !== 'ready' || !runtime || !compiledManifest) {
        throw sessionError('not-ready', 'Traveller palette session is not ready');
      }
    }

    function resolve(exactBasePath, look, resolveOptions) {
      try {
        requireReady();
        return runtime.resolve(exactBasePath, look, resolveOptions);
      } catch (error) {
        return Promise.reject(error);
      }
    }

    function prefetch(exactBasePaths, look, prefetchOptions) {
      try {
        requireReady();
        return runtime.prefetch(exactBasePaths, look, prefetchOptions);
      } catch (error) {
        return Promise.reject(error);
      }
    }

    function clear() {
      requireReady();
      runtime.clear();
    }

    function catalog() {
      requireReady();
      return lookApi.catalog(compiledManifest);
    }

    function manifest() {
      requireReady();
      return compiledManifest;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      phase = 'disposed';
      generation += 1;
      controller?.abort?.();
      controller = null;
      loading = null;
      cleanupLive();
    }

    return Object.freeze({
      load,
      retry,
      resolve,
      prefetch,
      clear,
      catalog,
      manifest,
      status: snapshot,
      dispose,
    });
  }

  return Object.freeze({ VERSION, MANIFEST_URL, createSession });
});
