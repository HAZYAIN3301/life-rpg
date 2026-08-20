const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Session = require('../public/traveller-palette-session-v1.js');

function response(payload, overrides = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get() { return 'application/json; charset=utf-8'; } },
    async json() { return payload; },
    ...overrides,
  };
}

function harness(overrides = {}) {
  const events = [];
  const raw = { schema: 'runtime-approved-test' };
  const compiled = { id: 'compiled-manifest' };
  const runtime = {
    async resolve(base, look) { events.push(['resolve', base, look]); return { url: 'blob:resolved' }; },
    async prefetch(paths) { events.push(['prefetch', paths]); return { warmed: paths.length }; },
    clear() { events.push(['runtime-clear']); },
    dispose() { events.push(['runtime-dispose']); },
    stats() { return { size: 0 }; },
  };
  const broker = {
    async renderFrame() { return 'blob:worker'; },
    async whenReady() { events.push(['broker-ready']); return { ready: true }; },
    dispose() { events.push(['broker-dispose']); },
    stats() { return { ready: true }; },
  };
  const paletteApi = {
    compileManifest(value) {
      events.push(['compile', value]);
      if (value !== raw) throw Object.assign(new Error('candidate'), { code: 'manifest-not-approved' });
      return compiled;
    },
    createRuntime(options) {
      events.push(['runtime-create', options]);
      return runtime;
    },
  };
  const workerClientApi = {
    createRenderer(options) {
      events.push(['broker-create', options]);
      return broker;
    },
  };
  const lookApi = {
    validateCompiledManifest(value) {
      events.push(['look-validate', value]);
      assert.equal(value, compiled);
      return true;
    },
    catalog(value) {
      assert.equal(value, compiled);
      return { skin: ['original'] };
    },
  };
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push([url, options]);
    return response(raw);
  };
  const URLImpl = {
    createObjectURL() { return 'blob:url'; },
    revokeObjectURL(url) { events.push(['revoke', url]); },
  };
  const session = Session.createSession({
    paletteApi,
    workerClientApi,
    lookApi,
    fetchImpl,
    AbortControllerImpl: AbortController,
    URLImpl,
    ...overrides,
  });
  return { session, events, raw, compiled, runtime, broker, fetchCalls, paletteApi, workerClientApi, lookApi, URLImpl };
}

test('concurrent load shares one exact immutable manifest request and builds one runtime', async () => {
  const { session, events, raw, compiled, fetchCalls, broker } = harness();
  const first = session.load();
  const second = session.load();
  assert.equal(first, second);
  const status = await first;
  assert.equal(status.phase, 'ready');
  assert.equal(status.ready, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0][0], Session.MANIFEST_URL);
  assert.deepEqual({ ...fetchCalls[0][1], signal: undefined }, {
    cache: 'force-cache',
    credentials: 'same-origin',
    signal: undefined,
  });
  assert.ok(fetchCalls[0][1].signal instanceof AbortSignal);
  assert.deepEqual(events.slice(0, 5).map((event) => event[0]), [
    'compile', 'look-validate', 'broker-create', 'broker-ready', 'runtime-create',
  ]);
  const brokerOptions = events.find((event) => event[0] === 'broker-create')[1];
  const runtimeOptions = events.find((event) => event[0] === 'runtime-create')[1];
  assert.equal(brokerOptions.manifest, raw);
  assert.equal(runtimeOptions.manifest, compiled);
  assert.equal(runtimeOptions.renderFrame, broker.renderFrame);
});

test('ready session delegates resolve, prefetch, clear, catalog and manifest without exposing raw JSON', async () => {
  const { session, compiled, events } = harness();
  await session.load();
  assert.deepEqual(await session.resolve('/art/base.png', { morphology: 'male' }), { url: 'blob:resolved' });
  assert.deepEqual(await session.prefetch(['/art/a.png', '/art/b.png'], {}), { warmed: 2 });
  session.clear();
  assert.deepEqual(session.catalog(), { skin: ['original'] });
  assert.equal(session.manifest(), compiled);
  assert.deepEqual(events.slice(-3).map((event) => event[0]), ['resolve', 'prefetch', 'runtime-clear']);
});

test('operations fail closed before load and after dispose', async () => {
  const { session } = harness();
  await assert.rejects(session.resolve('/art/base.png', {}), (error) => error.code === 'not-ready');
  assert.throws(() => session.catalog(), (error) => error.code === 'not-ready');
  session.dispose();
  await assert.rejects(session.load(), (error) => error.code === 'disposed');
  await assert.rejects(session.resolve('/art/base.png', {}), (error) => error.code === 'disposed');
  assert.equal(session.status().phase, 'disposed');
});

test('candidate or malformed manifest stops before worker construction', async () => {
  const created = [];
  const { session } = harness({
    fetchImpl: async () => response({ schema: 'candidate' }),
    workerClientApi: { createRenderer() { created.push(true); throw new Error('not reached'); } },
  });
  await assert.rejects(session.load(), (error) => error.code === 'manifest-not-approved');
  assert.equal(created.length, 0);
  assert.equal(session.status().phase, 'error');
  await assert.rejects(session.load(), (error) => error.code === 'manifest-not-approved');
});

test('non-JSON and HTTP failures remain retryable only through explicit retry', async () => {
  let attempt = 0;
  const base = harness();
  const session = Session.createSession({
    paletteApi: base.paletteApi,
    workerClientApi: base.workerClientApi,
    lookApi: base.lookApi,
    AbortControllerImpl: AbortController,
    URLImpl: base.URLImpl,
    async fetchImpl() {
      attempt += 1;
      if (attempt === 1) {
        return response(base.raw, { headers: { get() { return 'text/html'; } } });
      }
      return response(base.raw);
    },
  });
  await assert.rejects(session.load(), (error) => error.code === 'manifest-load-failed');
  await assert.rejects(session.load(), (error) => error.code === 'manifest-load-failed');
  assert.equal(attempt, 1);
  assert.equal((await session.retry()).ready, true);
  assert.equal(attempt, 2);
});

test('runtime construction failure disposes the already-created worker broker', async () => {
  const base = harness();
  const events = [];
  const session = Session.createSession({
    paletteApi: {
      ...base.paletteApi,
      createRuntime() { throw Object.assign(new Error('bad runtime'), { code: 'runtime-failed' }); },
    },
    workerClientApi: {
      createRenderer() {
        return {
          renderFrame() {},
          async whenReady() {},
          dispose() { events.push('broker-dispose'); },
          stats() { return {}; },
        };
      },
    },
    lookApi: base.lookApi,
    fetchImpl: async () => response(base.raw),
    AbortControllerImpl: AbortController,
    URLImpl: base.URLImpl,
  });
  await assert.rejects(session.load(), (error) => error.code === 'runtime-failed');
  assert.deepEqual(events, ['broker-dispose']);
});

test('dispose during load aborts the request and cannot publish a late ready session', async () => {
  const base = harness();
  let seenSignal;
  const session = Session.createSession({
    paletteApi: base.paletteApi,
    workerClientApi: base.workerClientApi,
    lookApi: base.lookApi,
    AbortControllerImpl: AbortController,
    URLImpl: base.URLImpl,
    fetchImpl(url, options) {
      seenSignal = options.signal;
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      });
    },
  });
  const loading = session.load();
  session.dispose();
  await assert.rejects(loading, (error) => error.code === 'disposed');
  assert.equal(seenSignal.aborted, true);
  assert.equal(session.status().ready, false);
});

test('dispose while worker readiness is pending owns and terminates the initializing broker', async () => {
  const base = harness();
  let releaseReady;
  const readiness = new Promise((resolve) => { releaseReady = resolve; });
  let brokerDisposed = 0;
  const session = Session.createSession({
    paletteApi: base.paletteApi,
    workerClientApi: {
      createRenderer() {
        return {
          renderFrame() {},
          whenReady() { return readiness; },
          dispose() { brokerDisposed += 1; },
          stats() { return { ready: false }; },
        };
      },
    },
    lookApi: base.lookApi,
    fetchImpl: async () => response(base.raw),
    AbortControllerImpl: AbortController,
    URLImpl: base.URLImpl,
  });
  const loading = session.load();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(session.status().phase, 'loading');
  session.dispose();
  assert.equal(brokerDisposed, 1);
  releaseReady({ ready: true });
  await assert.rejects(loading, (error) => error.code === 'disposed');
  assert.equal(brokerDisposed, 1);
  assert.equal(session.status().phase, 'disposed');
});

test('dispose tears down cached object URLs before terminating the worker', async () => {
  const { session, events } = harness();
  await session.load();
  session.dispose();
  const teardown = events.filter((event) => event[0].includes('dispose')).map((event) => event[0]);
  assert.deepEqual(teardown, ['runtime-dispose', 'broker-dispose']);
  session.dispose();
  assert.deepEqual(events.filter((event) => event[0].includes('dispose')).map((event) => event[0]), teardown);
});

test('manifest route cannot be redirected to a remote or mutable location', () => {
  for (const manifestUrl of ['https://evil.test/manifest.json', '/manifest.json', Session.MANIFEST_URL + '?v=2']) {
    assert.throws(() => harness({ manifestUrl }), (error) => error.code === 'invalid-options');
  }
});

test('session adapter owns no DOM, State, Store or local persistence', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/traveller-palette-session-v1.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:document|window|State|Store|localStorage|sessionStorage)\b/);
  assert.match(source, /force-cache/);
  assert.match(source, /same-origin/);
  assert.match(source, /module\.exports/);
});
