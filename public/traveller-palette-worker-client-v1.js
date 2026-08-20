(function initTravellerPaletteWorkerClientV1(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TravellerPaletteWorkerClientV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function travellerPaletteWorkerClientFactory(root) {
  'use strict';

  const VERSION = '1.0.0';
  const PROTOCOL = 'satoru.traveller-palette-worker/1';
  const DEFAULT_WORKER_URL = '/traveller-palette-worker-v1.js';

  function clientError(code, message, details) {
    const error = new Error(message);
    error.name = 'TravellerPaletteWorkerClientError';
    error.code = code;
    if (details !== undefined) error.details = details;
    return error;
  }

  function abortError() {
    const error = new Error('Traveller palette render was aborted');
    error.name = 'AbortError';
    error.code = 'aborted';
    return error;
  }

  function workerError(payload, fallbackCode) {
    return clientError(
      typeof payload?.code === 'string' ? payload.code : fallbackCode,
      typeof payload?.message === 'string' ? payload.message : 'Traveller palette worker failed',
    );
  }

  function safeWorkerUrl(value) {
    return typeof value === 'string'
      && /^\/[a-z0-9][a-z0-9/_-]*\.js(?:\?[a-z0-9._=-]+)?$/.test(value)
      && !value.includes('//')
      && !value.includes('..');
  }

  function createRenderer(options = {}) {
    const manifestSource = options.manifest;
    if (!manifestSource || typeof manifestSource !== 'object' || Array.isArray(manifestSource)) {
      throw clientError('invalid-options', 'Worker renderer requires the raw approved palette manifest');
    }
    const WorkerImpl = options.WorkerImpl || root?.Worker;
    const URLImpl = options.URLImpl || root?.URL;
    const workerUrl = options.workerUrl || DEFAULT_WORKER_URL;
    const maxQueue = options.maxQueue === undefined ? 24 : options.maxQueue;
    const initTimeoutMs = options.initTimeoutMs === undefined ? 10000 : options.initTimeoutMs;
    const jobTimeoutMs = options.jobTimeoutMs === undefined ? 45000 : options.jobTimeoutMs;
    const setTimer = options.setTimeoutImpl || root?.setTimeout?.bind(root);
    const clearTimer = options.clearTimeoutImpl || root?.clearTimeout?.bind(root);
    const clone = options.structuredCloneImpl || root?.structuredClone?.bind(root);
    if (typeof WorkerImpl !== 'function' || typeof URLImpl?.createObjectURL !== 'function') {
      throw clientError('runtime-unavailable', 'Worker or object URL support is unavailable');
    }
    if (!safeWorkerUrl(workerUrl)) throw clientError('invalid-options', 'Worker URL must be a canonical same-origin JS path');
    if (!Number.isInteger(maxQueue) || maxQueue < 1 || maxQueue > 128) {
      throw clientError('invalid-options', 'maxQueue must be an integer from 1 to 128');
    }
    if (!Number.isInteger(initTimeoutMs) || initTimeoutMs < 100 || initTimeoutMs > 60000) {
      throw clientError('invalid-options', 'initTimeoutMs must be an integer from 100 to 60000');
    }
    if (!Number.isInteger(jobTimeoutMs) || jobTimeoutMs < 100 || jobTimeoutMs > 180000) {
      throw clientError('invalid-options', 'jobTimeoutMs must be an integer from 100 to 180000');
    }
    if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
      throw clientError('runtime-unavailable', 'Timer support is unavailable');
    }
    let manifest;
    try {
      manifest = typeof clone === 'function'
        ? clone(manifestSource)
        : JSON.parse(JSON.stringify(manifestSource));
    } catch (error) {
      throw clientError('invalid-options', 'Palette manifest is not structured-cloneable', { cause: error });
    }

    let worker = null;
    let workerGeneration = 0;
    let ready = false;
    let disposed = false;
    let fatal = null;
    let active = null;
    let initTimer = null;
    let nextJobId = 1;
    const queue = [];
    let resolveReadiness;
    let rejectReadiness;
    let readinessSettled = false;
    const readiness = new Promise((resolve, reject) => {
      resolveReadiness = resolve;
      rejectReadiness = reject;
    });
    readiness.catch(() => {});

    function settleReadiness(method, value) {
      if (readinessSettled) return;
      readinessSettled = true;
      if (method === 'resolve') resolveReadiness(value);
      else rejectReadiness(value);
    }

    function clearInitTimer() {
      if (initTimer !== null) clearTimer(initTimer);
      initTimer = null;
    }

    function clearJob(job) {
      if (!job) return;
      if (job.timer !== null) clearTimer(job.timer);
      job.timer = null;
      job.signal?.removeEventListener?.('abort', job.onAbort);
    }

    function settle(job, method, value) {
      if (!job || job.settled) return;
      job.settled = true;
      clearJob(job);
      job[method](value);
    }

    function rejectQueue(error) {
      while (queue.length) settle(queue.shift(), 'reject', error);
    }

    function stopWorker() {
      clearInitTimer();
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
      }
      worker = null;
      ready = false;
    }

    function failFatal(error) {
      fatal = error;
      settleReadiness('reject', error);
      stopWorker();
      if (active) {
        const failed = active;
        active = null;
        settle(failed, 'reject', error);
      }
      rejectQueue(error);
    }

    function dispatch() {
      if (disposed || fatal || !ready || active || !worker) return;
      while (queue.length && queue[0].signal?.aborted) {
        settle(queue.shift(), 'reject', abortError());
      }
      const job = queue.shift();
      if (!job) return;
      active = job;
      job.timer = setTimer(() => {
        if (active !== job) return;
        active = null;
        settle(job, 'reject', clientError('worker-timeout', 'Traveller palette render timed out'));
        restartWorker();
      }, jobTimeoutMs);
      try {
        worker.postMessage({
          protocol: PROTOCOL,
          type: 'render',
          jobId: job.id,
          exactBasePath: job.exactBasePath,
          look: job.look,
        });
      } catch (error) {
        active = null;
        settle(job, 'reject', clientError('worker-failed', 'Could not send palette render job', { cause: error }));
        restartWorker();
      }
    }

    function handleMessage(generation, event) {
      if (disposed || generation !== workerGeneration) return;
      const message = event?.data;
      if (!message || message.protocol !== PROTOCOL) return;
      if (message.type === 'ready') {
        clearInitTimer();
        ready = true;
        settleReadiness('resolve', Object.freeze({ ready: true, generation }));
        dispatch();
        return;
      }
      if (message.type === 'fatal') {
        failFatal(workerError(message.error, 'worker-failed'));
        return;
      }
      if (!active || message.jobId !== active.id) return;
      const job = active;
      active = null;
      if (message.type === 'error') {
        settle(job, 'reject', workerError(message.error, 'render-failed'));
        dispatch();
        return;
      }
      if (message.type !== 'result' || !message.blob || message.blob.type !== 'image/png') {
        settle(job, 'reject', clientError('worker-protocol', 'Palette worker returned an invalid result'));
        restartWorker();
        return;
      }
      if (job.signal?.aborted) {
        settle(job, 'reject', abortError());
        dispatch();
        return;
      }
      try {
        const url = URLImpl.createObjectURL(message.blob);
        settle(job, 'resolve', url);
      } catch (error) {
        settle(job, 'reject', clientError('render-failed', 'Could not create palette object URL', { cause: error }));
      }
      dispatch();
    }

    function startWorker() {
      if (disposed || fatal || worker) return;
      const generation = ++workerGeneration;
      try {
        worker = new WorkerImpl(workerUrl, { name: 'traveller-palette-v1', type: 'classic' });
      } catch (error) {
        failFatal(clientError('runtime-unavailable', 'Could not create Traveller palette worker', { cause: error }));
        return;
      }
      worker.onmessage = (event) => handleMessage(generation, event);
      worker.onerror = () => {
        if (generation !== workerGeneration || disposed) return;
        if (!ready) {
          failFatal(clientError('runtime-unavailable', 'Traveller palette worker failed before initialization'));
          return;
        }
        const failed = active;
        active = null;
        if (failed) settle(failed, 'reject', clientError('worker-failed', 'Traveller palette worker crashed'));
        restartWorker();
      };
      initTimer = setTimer(() => {
        if (generation !== workerGeneration || ready || disposed) return;
        failFatal(clientError('worker-timeout', 'Traveller palette worker initialization timed out'));
      }, initTimeoutMs);
      try {
        worker.postMessage({ protocol: PROTOCOL, type: 'init', manifest });
      } catch (error) {
        failFatal(clientError('worker-failed', 'Could not initialize Traveller palette worker', { cause: error }));
      }
    }

    function restartWorker() {
      if (disposed || fatal) return;
      stopWorker();
      startWorker();
    }

    function abortJob(job) {
      if (job.settled) return;
      if (active === job) {
        active = null;
        settle(job, 'reject', abortError());
        restartWorker();
        return;
      }
      const index = queue.indexOf(job);
      if (index >= 0) queue.splice(index, 1);
      settle(job, 'reject', abortError());
    }

    function renderFrame(context = {}) {
      if (disposed) return Promise.reject(clientError('disposed', 'Traveller palette worker renderer is disposed'));
      if (fatal) return Promise.reject(fatal);
      if (typeof context.descriptor?.base?.path !== 'string' || !context.look) {
        return Promise.reject(clientError('invalid-job', 'Palette render context is incomplete'));
      }
      if (context.signal?.aborted) return Promise.reject(abortError());
      if (queue.length + (active ? 1 : 0) >= maxQueue) {
        return Promise.reject(clientError('queue-full', 'Traveller palette render queue is full'));
      }
      return new Promise((resolve, reject) => {
        const job = {
          id: 'job-' + nextJobId++,
          exactBasePath: context.descriptor.base.path,
          look: context.look,
          signal: context.signal,
          resolve,
          reject,
          settled: false,
          timer: null,
          onAbort: null,
        };
        job.onAbort = () => abortJob(job);
        job.signal?.addEventListener?.('abort', job.onAbort, { once: true });
        queue.push(job);
        startWorker();
        dispatch();
      });
    }

    function whenReady() {
      return readiness;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      const error = clientError('disposed', 'Traveller palette worker renderer is disposed');
      settleReadiness('reject', error);
      if (active) {
        const failed = active;
        active = null;
        settle(failed, 'reject', error);
      }
      rejectQueue(error);
      try {
        worker?.postMessage({ protocol: PROTOCOL, type: 'dispose' });
      } catch (_) {}
      stopWorker();
    }

    function stats() {
      return Object.freeze({
        disposed,
        fatal: fatal?.code || null,
        ready,
        generation: workerGeneration,
        queued: queue.length,
        active: active?.id || null,
      });
    }

    startWorker();
    return Object.freeze({ renderFrame, whenReady, dispose, stats });
  }

  return Object.freeze({ VERSION, PROTOCOL, DEFAULT_WORKER_URL, createRenderer });
});
