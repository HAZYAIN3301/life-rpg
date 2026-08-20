const test = require('node:test');
const assert = require('node:assert/strict');

const WorkerRuntime = require('../public/traveller-palette-worker-v1.js');
const WorkerClient = require('../public/traveller-palette-worker-client-v1.js');

const PROTOCOL = 'satoru.traveller-palette-worker/1';

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function fakePaletteApi() {
  return {
    compileManifest(manifest) {
      if (manifest?.approved !== true) {
        const error = new Error('not approved');
        error.code = 'manifest-not-approved';
        throw error;
      }
      return Object.freeze({ id: 'compiled' });
    },
  };
}

test('worker protocol compiles once and serializes render results', async () => {
  const emitted = [];
  const protocol = WorkerRuntime.createProtocol({
    emit(message) { emitted.push(message); },
    paletteApi: fakePaletteApi(),
    async renderJob(job, state) {
      assert.equal(state.manifest.id, 'compiled');
      assert.equal(job.exactBasePath, '/art/base.png');
      return { type: 'image/png', marker: 'result' };
    },
  });
  await protocol.handleMessage({ data: { protocol: PROTOCOL, type: 'init', manifest: { approved: true } } });
  assert.deepEqual(emitted.shift(), { protocol: PROTOCOL, type: 'ready' });
  await protocol.handleMessage({
    data: {
      protocol: PROTOCOL,
      type: 'render',
      jobId: 'job-1',
      exactBasePath: '/art/base.png',
      look: { morphology: 'male-v1' },
    },
  });
  assert.equal(emitted[0].type, 'result');
  assert.equal(emitted[0].jobId, 'job-1');
  assert.equal(emitted[0].blob.marker, 'result');
});

test('worker protocol fails closed for candidate manifests and invalid job ids', async () => {
  const emitted = [];
  const protocol = WorkerRuntime.createProtocol({
    emit(message) { emitted.push(message); },
    paletteApi: fakePaletteApi(),
    async renderJob() { return { type: 'image/png' }; },
  });
  await protocol.handleMessage({ data: { protocol: PROTOCOL, type: 'init', manifest: { approved: false } } });
  assert.equal(emitted[0].type, 'fatal');
  assert.equal(emitted[0].error.code, 'manifest-not-approved');

  const emitted2 = [];
  const protocol2 = WorkerRuntime.createProtocol({
    emit(message) { emitted2.push(message); },
    paletteApi: fakePaletteApi(),
    async renderJob() { return { type: 'image/png' }; },
  });
  await protocol2.handleMessage({ data: { protocol: PROTOCOL, type: 'init', manifest: { approved: true } } });
  await protocol2.handleMessage({ data: { protocol: PROTOCOL, type: 'render', jobId: '../bad' } });
  assert.equal(emitted2[1].type, 'error');
  assert.equal(emitted2[1].error.code, 'invalid-job');
});

test('default worker protocol fails initialization when worker graphics APIs are missing', async () => {
  const emitted = [];
  const protocol = WorkerRuntime.createProtocol({
    emit(message) { emitted.push(message); },
    paletteApi: fakePaletteApi(),
  });
  await protocol.handleMessage({ data: { protocol: PROTOCOL, type: 'init', manifest: { approved: true } } });
  assert.equal(emitted[0].type, 'fatal');
  assert.equal(emitted[0].error.code, 'runtime-unavailable');
});

test('default worker renderer verifies both assets, uses raw mask decode, and closes bitmaps', async () => {
  const digest = '00'.repeat(32);
  const closed = [];
  const bitmapOptions = [];
  const descriptor = {
    canvas: [1, 1],
    base: { path: '/art/base.png', sha256: digest, canvas: [1, 1] },
    mask: { path: '/art/mask.png', sha256: digest, canvas: [1, 1] },
  };
  const manifest = {
    defaultPalette: { skin: 'original', hair: 'original', eyes: 'original' },
  };
  const paletteApi = {
    resolveFrameDescriptor() {
      return {
        descriptor,
        manifest,
        look: { palette: { skin: 'skin-warm', hair: 'original', eyes: 'original' } },
      };
    },
    recolorPixels({ basePixels, maskPixels }) {
      assert.equal(basePixels.length, 4);
      assert.equal(maskPixels.length, 4);
      return new Uint8ClampedArray([10, 20, 30, 255]);
    },
  };
  class FakeBlob {
    constructor(parts, options) { this.parts = parts; this.type = options.type; }
  }
  class FakeCanvas {
    constructor() {
      this.context = {
        clearRect() {},
        drawImage() {},
        getImageData() { return { data: new Uint8ClampedArray([1, 2, 3, 255]) }; },
        createImageData() { return { data: new Uint8ClampedArray(4) }; },
        putImageData() {},
      };
    }
    getContext() { return this.context; }
    async convertToBlob() { return { type: 'image/png' }; }
  }
  const environment = {
    paletteApi,
    async fetchImpl(path) {
      return {
        ok: true,
        headers: { get() { return 'image/png'; } },
        async arrayBuffer() { return new Uint8Array([path.length]).buffer; },
      };
    },
    cryptoImpl: { subtle: { async digest() { return new Uint8Array(32).buffer; } } },
    BlobImpl: FakeBlob,
    async createImageBitmapImpl(blob, options) {
      bitmapOptions.push(options || null);
      const id = bitmapOptions.length;
      return { width: 1, height: 1, close() { closed.push(id); } };
    },
    OffscreenCanvasImpl: FakeCanvas,
  };
  const blob = await WorkerRuntime.renderJob(
    { exactBasePath: '/art/base.png', look: { morphology: 'male-v1' } },
    { manifest },
    environment,
  );
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(closed.sort(), [1, 2]);
  assert.equal(bitmapOptions[0], null);
  assert.deepEqual(bitmapOptions[1], { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
});

test('default worker renderer closes the fulfilled peer when the other asset fails', async () => {
  const digest = '00'.repeat(32);
  let closed = 0;
  const descriptor = {
    canvas: [1, 1],
    base: { path: '/art/base.png', sha256: digest, canvas: [1, 1] },
    mask: { path: '/art/mask.png', sha256: digest, canvas: [1, 1] },
  };
  const paletteApi = {
    resolveFrameDescriptor() {
      return {
        descriptor,
        manifest: { defaultPalette: { skin: 'original', hair: 'original', eyes: 'original' } },
        look: { palette: { skin: 'skin-warm', hair: 'original', eyes: 'original' } },
      };
    },
    recolorPixels() { throw new Error('not reached'); },
  };
  await assert.rejects(WorkerRuntime.renderJob(
    { exactBasePath: '/art/base.png', look: {} },
    { manifest: {} },
    {
      paletteApi,
      async fetchImpl(path) {
        if (path.includes('mask')) return { ok: false, status: 500 };
        return {
          ok: true,
          headers: { get() { return 'image/png'; } },
          async arrayBuffer() { return new Uint8Array([1]).buffer; },
        };
      },
      cryptoImpl: { subtle: { async digest() { return new Uint8Array(32).buffer; } } },
      BlobImpl: class { constructor() { this.type = 'image/png'; } },
      async createImageBitmapImpl() {
        return { width: 1, height: 1, close() { closed += 1; } };
      },
      OffscreenCanvasImpl: class {},
    },
  ), (error) => error.code === 'asset-failed');
  assert.equal(closed, 1);
});

class FakeWorker {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.messages = [];
    this.terminated = false;
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    this.messages.push(message);
    if (message.type === 'init') {
      queueMicrotask(() => this.onmessage?.({ data: { protocol: PROTOCOL, type: 'ready' } }));
    }
  }

  result(jobId, marker = jobId) {
    this.onmessage?.({ data: { protocol: PROTOCOL, type: 'result', jobId, blob: { marker, type: 'image/png' } } });
  }

  fatal(code = 'bad-manifest') {
    this.onmessage?.({ data: { protocol: PROTOCOL, type: 'fatal', error: { code, message: code } } });
  }

  terminate() { this.terminated = true; }
}

function clientHarness(overrides = {}) {
  FakeWorker.instances = [];
  const revoked = [];
  const client = WorkerClient.createRenderer({
    manifest: { schema: 'approved-test' },
    WorkerImpl: FakeWorker,
    URLImpl: {
      createObjectURL(blob) { return 'blob:' + blob.marker; },
      revokeObjectURL(url) { revoked.push(url); },
    },
    initTimeoutMs: 5000,
    jobTimeoutMs: 5000,
    ...overrides,
  });
  return { client, revoked };
}

function renderContext(signal) {
  return {
    descriptor: { base: { path: '/art/base.png' } },
    look: { morphology: 'male-v1', identityId: 'male-v1', palette: { skin: 'skin-warm' } },
    signal,
  };
}

test('client sends one render at a time and returns worker blobs as object URLs', async () => {
  const { client } = clientHarness();
  assert.deepEqual(await client.whenReady(), { ready: true, generation: 1 });
  const first = client.renderFrame(renderContext());
  const second = client.renderFrame(renderContext());
  await tick();
  const worker = FakeWorker.instances[0];
  const renders = () => worker.messages.filter((message) => message.type === 'render');
  assert.equal(renders().length, 1);
  worker.result(renders()[0].jobId, 'one');
  assert.equal(await first, 'blob:one');
  assert.equal(renders().length, 2);
  worker.result(renders()[1].jobId, 'two');
  assert.equal(await second, 'blob:two');
  assert.deepEqual(client.stats(), {
    disposed: false,
    fatal: null,
    ready: true,
    generation: 1,
    queued: 0,
    active: null,
  });
  client.dispose();
});

test('queued abort does not kill the active worker', async () => {
  const { client } = clientHarness();
  const first = client.renderFrame(renderContext());
  const controller = new AbortController();
  const second = client.renderFrame(renderContext(controller.signal));
  await tick();
  const worker = FakeWorker.instances[0];
  controller.abort();
  await assert.rejects(second, (error) => error.name === 'AbortError');
  assert.equal(worker.terminated, false);
  const render = worker.messages.find((message) => message.type === 'render');
  worker.result(render.jobId, 'active');
  assert.equal(await first, 'blob:active');
  client.dispose();
});

test('active abort terminates the worker and resumes queued work on a fresh generation', async () => {
  const { client } = clientHarness();
  const controller = new AbortController();
  const first = client.renderFrame(renderContext(controller.signal));
  const second = client.renderFrame(renderContext());
  await tick();
  const oldWorker = FakeWorker.instances[0];
  const staleHandler = oldWorker.onmessage;
  controller.abort();
  await assert.rejects(first, (error) => error.name === 'AbortError');
  assert.equal(oldWorker.terminated, true);
  await tick();
  assert.equal(FakeWorker.instances.length, 2);
  const freshWorker = FakeWorker.instances[1];
  const render = freshWorker.messages.find((message) => message.type === 'render');
  assert.ok(render);
  staleHandler?.({ data: { protocol: PROTOCOL, type: 'result', jobId: render.jobId, blob: { marker: 'stale' } } });
  freshWorker.result(render.jobId, 'fresh');
  assert.equal(await second, 'blob:fresh');
  client.dispose();
});

test('fatal initialization rejects queued jobs and remains fail closed', async () => {
  const { client } = clientHarness();
  const pending = client.renderFrame(renderContext());
  const worker = FakeWorker.instances[0];
  worker.fatal('manifest-not-approved');
  await assert.rejects(client.whenReady(), (error) => error.code === 'manifest-not-approved');
  await assert.rejects(pending, (error) => error.code === 'manifest-not-approved');
  await assert.rejects(client.renderFrame(renderContext()), (error) => error.code === 'manifest-not-approved');
  assert.equal(FakeWorker.instances.length, 1);
});

test('client snapshots the manifest and fails closed when the worker crashes before ready', async () => {
  FakeWorker.instances = [];
  const manifest = { schema: 'approved-test', nested: { revision: 1 } };
  const client = WorkerClient.createRenderer({
    manifest,
    WorkerImpl: FakeWorker,
    URLImpl: { createObjectURL() { return 'blob:x'; } },
    initTimeoutMs: 5000,
    jobTimeoutMs: 5000,
  });
  manifest.nested.revision = 2;
  const worker = FakeWorker.instances[0];
  const init = worker.messages.find((message) => message.type === 'init');
  assert.equal(init.manifest.nested.revision, 1);
  const pending = client.renderFrame(renderContext());
  worker.onerror?.(new Error('boom'));
  await assert.rejects(pending, (error) => error.code === 'runtime-unavailable');
  assert.equal(FakeWorker.instances.length, 1);
});

test('dispose terminates the worker and rejects active and queued jobs', async () => {
  const { client } = clientHarness();
  const first = client.renderFrame(renderContext());
  const second = client.renderFrame(renderContext());
  await tick();
  const worker = FakeWorker.instances[0];
  client.dispose();
  await assert.rejects(first, (error) => error.code === 'disposed');
  await assert.rejects(second, (error) => error.code === 'disposed');
  assert.equal(worker.terminated, true);
  assert.equal(client.stats().disposed, true);
});

test('dispose before worker readiness rejects the readiness contract without restart', async () => {
  FakeWorker.instances = [];
  class NeverReadyWorker extends FakeWorker {
    postMessage(message) { this.messages.push(message); }
  }
  const client = WorkerClient.createRenderer({
    manifest: { schema: 'approved-test' },
    WorkerImpl: NeverReadyWorker,
    URLImpl: { createObjectURL() { return 'blob:x'; } },
    initTimeoutMs: 5000,
    jobTimeoutMs: 5000,
  });
  client.dispose();
  await assert.rejects(client.whenReady(), (error) => error.code === 'disposed');
  assert.equal(FakeWorker.instances.length, 1);
  assert.equal(FakeWorker.instances[0].terminated, true);
});

test('client rejects cross-origin and traversal worker URLs', () => {
  for (const workerUrl of ['https://evil.test/worker.js', '/../worker.js', '/worker.js?x=<bad>', '//worker.js']) {
    assert.throws(() => clientHarness({ workerUrl }), (error) => error.code === 'invalid-options');
  }
});
