(function initTravellerPaletteWorkerV1(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.TravellerPaletteWorkerV1 = api;
  if (typeof root.importScripts === 'function') {
    if (!root.TravellerPaletteV1) root.importScripts('/traveller-palette-v1.js');
    api.install(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function travellerPaletteWorkerFactory() {
  'use strict';

  const VERSION = '1.0.0';
  const PROTOCOL = 'satoru.traveller-palette-worker/1';
  const CHANNELS = Object.freeze(['skin', 'hair', 'eyes']);
  const SAFE_JOB_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

  function workerError(code, message, details) {
    const error = new Error(message);
    error.name = 'TravellerPaletteWorkerError';
    error.code = code;
    if (details !== undefined) error.details = details;
    return error;
  }

  function serializeError(error) {
    return Object.freeze({
      code: typeof error?.code === 'string' ? error.code : 'worker-failed',
      message: typeof error?.message === 'string' ? error.message : 'Traveller palette worker failed',
    });
  }

  function validJobId(value) {
    return typeof value === 'string' && SAFE_JOB_ID.test(value);
  }

  function isDefaultPalette(look, manifest) {
    return CHANNELS.every((channel) => look.palette[channel] === manifest.defaultPalette[channel]);
  }

  async function sha256Hex(buffer, cryptoImpl) {
    if (!cryptoImpl?.subtle?.digest) {
      throw workerError('integrity-unavailable', 'SHA-256 is unavailable in the palette worker');
    }
    let digest;
    try {
      digest = await cryptoImpl.subtle.digest('SHA-256', buffer);
    } catch (error) {
      throw workerError('integrity-unavailable', 'SHA-256 failed in the palette worker', { cause: error });
    }
    const bytes = new Uint8Array(digest);
    if (bytes.length !== 32) {
      throw workerError('integrity-unavailable', 'SHA-256 returned an invalid digest');
    }
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function fetchVerifiedBitmap(asset, environment, bitmapOptions) {
    let response;
    try {
      response = await environment.fetchImpl(asset.path, { cache: 'force-cache' });
    } catch (error) {
      throw workerError('asset-failed', 'Could not fetch ' + asset.path, { cause: error });
    }
    if (!response?.ok || typeof response.arrayBuffer !== 'function') {
      throw workerError('asset-failed', 'Could not fetch ' + asset.path + ': HTTP ' + (response?.status || 0));
    }
    const buffer = await response.arrayBuffer();
    const digest = await sha256Hex(buffer, environment.cryptoImpl);
    if (digest !== asset.sha256) {
      throw workerError('integrity-mismatch', 'SHA-256 mismatch for ' + asset.path);
    }
    let bitmap;
    try {
      const blob = new environment.BlobImpl([buffer], {
        type: response.headers?.get?.('content-type') || 'image/png',
      });
      bitmap = bitmapOptions
        ? await environment.createImageBitmapImpl(blob, bitmapOptions)
        : await environment.createImageBitmapImpl(blob);
    } catch (error) {
      throw workerError('asset-failed', 'Could not decode ' + asset.path, { cause: error });
    }
    if (bitmap.width !== asset.canvas[0] || bitmap.height !== asset.canvas[1]) {
      bitmap.close?.();
      throw workerError('canvas-mismatch', 'Decoded canvas does not match manifest for ' + asset.path);
    }
    return bitmap;
  }

  function readPixels(environment, bitmap, width, height, label) {
    const canvas = new environment.OffscreenCanvasImpl(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw workerError('canvas-unavailable', '2D canvas is unavailable for ' + label);
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0);
    try {
      return context.getImageData(0, 0, width, height).data;
    } catch (error) {
      throw workerError('canvas-unavailable', 'Could not read ' + label + ' pixels', { cause: error });
    }
  }

  async function renderJobDefault(job, state, environment) {
    const paletteApi = environment.paletteApi;
    const authored = paletteApi.resolveFrameDescriptor(
      state.manifest,
      job.look,
      job.exactBasePath,
    );
    const { descriptor, look, manifest } = authored;
    if (isDefaultPalette(look, manifest)) {
      throw workerError('default-palette-bypass', 'Default Traveller palette must bypass the worker');
    }
    const [width, height] = descriptor.canvas;
    let baseBitmap = null;
    let maskBitmap = null;
    let firstError = null;
    const guarded = (promise) => promise.catch((error) => {
      if (!firstError) firstError = error;
      throw error;
    });
    try {
      const decoded = await Promise.allSettled([
        guarded(fetchVerifiedBitmap(descriptor.base, environment)),
        guarded(fetchVerifiedBitmap(
          descriptor.mask,
          environment,
          Object.freeze({ colorSpaceConversion: 'none', premultiplyAlpha: 'none' }),
        )),
      ]);
      baseBitmap = decoded[0].status === 'fulfilled' ? decoded[0].value : null;
      maskBitmap = decoded[1].status === 'fulfilled' ? decoded[1].value : null;
      if (decoded.some((result) => result.status === 'rejected')) {
        throw firstError || decoded.find((result) => result.status === 'rejected').reason;
      }
      const basePixels = readPixels(environment, baseBitmap, width, height, 'base');
      const maskPixels = readPixels(environment, maskBitmap, width, height, 'mask');
      const pixels = paletteApi.recolorPixels({
        basePixels,
        maskPixels,
        width,
        height,
        palette: look.palette,
        defaultPalette: manifest.defaultPalette,
        catalog: manifest,
      });
      const output = new environment.OffscreenCanvasImpl(width, height);
      const context = output.getContext('2d');
      if (!context) throw workerError('canvas-unavailable', 'Output 2D canvas is unavailable');
      const image = context.createImageData(width, height);
      image.data.set(pixels);
      context.putImageData(image, 0, 0);
      const blob = await output.convertToBlob({ type: 'image/png' });
      if (!blob || blob.type !== 'image/png') {
        throw workerError('canvas-unavailable', 'Worker PNG encoding failed');
      }
      return blob;
    } finally {
      baseBitmap?.close?.();
      maskBitmap?.close?.();
    }
  }

  function createProtocol(options = {}) {
    const emit = options.emit;
    const paletteApi = options.paletteApi;
    const renderJob = options.renderJob || renderJobDefault;
    const usesDefaultRenderer = renderJob === renderJobDefault;
    if (typeof emit !== 'function') throw workerError('invalid-options', 'Worker protocol requires emit');
    if (!paletteApi || typeof paletteApi.compileManifest !== 'function') {
      throw workerError('runtime-unavailable', 'TravellerPaletteV1 is unavailable in the worker');
    }
    const environment = Object.freeze({
      paletteApi,
      fetchImpl: options.fetchImpl,
      cryptoImpl: options.cryptoImpl,
      BlobImpl: options.BlobImpl,
      createImageBitmapImpl: options.createImageBitmapImpl,
      OffscreenCanvasImpl: options.OffscreenCanvasImpl,
    });
    let state = null;
    let disposed = false;
    let active = false;

    async function handleMessage(event) {
      const message = event?.data;
      if (disposed || !message || message.protocol !== PROTOCOL) return;
      if (message.type === 'dispose') {
        disposed = true;
        state = null;
        return;
      }
      if (message.type === 'init') {
        if (active || state) {
          emit({ protocol: PROTOCOL, type: 'fatal', error: serializeError(
            workerError('invalid-state', 'Palette worker can only be initialized once'),
          ) });
          return;
        }
        try {
          if (usesDefaultRenderer && (
            typeof environment.fetchImpl !== 'function'
            || !environment.cryptoImpl?.subtle?.digest
            || typeof environment.BlobImpl !== 'function'
            || typeof environment.createImageBitmapImpl !== 'function'
            || typeof environment.OffscreenCanvasImpl !== 'function'
          )) {
            throw workerError('runtime-unavailable', 'Required palette worker graphics APIs are unavailable');
          }
          state = Object.freeze({ manifest: paletteApi.compileManifest(message.manifest) });
          emit({ protocol: PROTOCOL, type: 'ready' });
        } catch (error) {
          emit({ protocol: PROTOCOL, type: 'fatal', error: serializeError(error) });
        }
        return;
      }
      if (message.type !== 'render') return;
      if (!state) {
        emit({ protocol: PROTOCOL, type: 'fatal', error: serializeError(
          workerError('not-initialized', 'Palette worker is not initialized'),
        ) });
        return;
      }
      if (active || !validJobId(message.jobId)) {
        emit({
          protocol: PROTOCOL,
          type: 'error',
          jobId: validJobId(message.jobId) ? message.jobId : null,
          error: serializeError(workerError('invalid-job', 'Palette worker received an invalid or concurrent job')),
        });
        return;
      }
      active = true;
      try {
        const blob = await renderJob(Object.freeze({
          exactBasePath: message.exactBasePath,
          look: message.look,
        }), state, environment);
        emit({ protocol: PROTOCOL, type: 'result', jobId: message.jobId, blob });
      } catch (error) {
        emit({ protocol: PROTOCOL, type: 'error', jobId: message.jobId, error: serializeError(error) });
      } finally {
        active = false;
      }
    }

    return Object.freeze({ handleMessage });
  }

  function install(workerRoot) {
    const protocol = createProtocol({
      emit(message) { workerRoot.postMessage(message); },
      paletteApi: workerRoot.TravellerPaletteV1,
      fetchImpl: workerRoot.fetch?.bind(workerRoot),
      cryptoImpl: workerRoot.crypto,
      BlobImpl: workerRoot.Blob,
      createImageBitmapImpl: workerRoot.createImageBitmap?.bind(workerRoot),
      OffscreenCanvasImpl: workerRoot.OffscreenCanvas,
    });
    workerRoot.addEventListener('message', protocol.handleMessage);
    return protocol;
  }

  return Object.freeze({
    VERSION,
    PROTOCOL,
    createProtocol,
    install,
    renderJob: renderJobDefault,
  });
});
