const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Registry = require('../public/traveller-frame-registry-v2.js');

const MALE_ORIGINAL = Object.freeze({
  morphology: 'male',
  identityId: 'male-v1',
  palette: Object.freeze({ skin: 'original', hair: 'original', eyes: 'original' }),
});
const FEMALE_VIOLET = Object.freeze({
  morphology: 'female',
  identityId: 'female-f2-v1',
  palette: Object.freeze({ skin: 'skin-warm', hair: 'hair-violet', eyes: 'eyes-jade' }),
});

function lookKey(value) {
  return [
    value.morphology,
    value.identityId,
    `skin:${value.palette.skin}`,
    `hair:${value.palette.hair}`,
    `eyes:${value.palette.eyes}`,
  ].join('|');
}

function runtimeHandle(basePath, look, overrides = {}) {
  const original = ['skin', 'hair', 'eyes'].every((channel) => look.palette[channel] === 'original');
  return {
    url: original ? basePath : 'blob:frame',
    bypass: original,
    key: `runtime|${basePath}|${lookKey(look)}`,
    lookKey: lookKey(look),
    basePath,
    morphology: look.morphology,
    identityId: look.identityId,
    release() {},
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(overrides = {}) {
  const events = [];
  const releases = new Map();
  let nextHandle = 1;
  const session = {
    async load() { events.push(['load']); },
    async resolve(basePath, look, options) {
      events.push(['resolve', basePath, look, options]);
      const id = nextHandle++;
      return runtimeHandle(basePath, look, {
        url: look.palette.hair === 'original' ? basePath : `blob:frame-${id}`,
        release() {
          releases.set(id, (releases.get(id) || 0) + 1);
          events.push(['release', id, basePath]);
        },
      });
    },
    ...overrides.session,
  };
  const registry = Registry.createRegistry({ session });
  return { registry, session, events, releases };
}

test('a prepared frame set is invisible until commit and releases the previous generation only on finalize', async () => {
  const h = harness();
  const malePath = '/art/avatars/male/idle.png';
  const femalePath = '/art/avatars/female/idle.png';
  const first = await h.registry.prepare([malePath], MALE_ORIGINAL);
  assert.equal(h.registry.activeUrl(malePath), null);
  assert.equal(first.urlFor(malePath), malePath);
  assert.equal(first.commit(), 1);
  assert.equal(h.registry.activeUrl(malePath), malePath);
  first.finalize();
  assert.equal(h.events.filter((event) => event[0] === 'release').length, 0);

  const second = await h.registry.prepare([femalePath], FEMALE_VIOLET);
  assert.match(second.urlFor(femalePath), /^blob:frame-/);
  assert.equal(second.commit(), 2);
  assert.equal(h.registry.activeUrl(femalePath), second.urlFor(femalePath));
  assert.equal(h.events.filter((event) => event[0] === 'release').length, 0);
  second.finalize();
  assert.equal(h.events.filter((event) => event[0] === 'release').length, 1);
  assert.equal(h.registry.status().activeFrames, 1);
});

test('rollback after commit restores the prior generation without revoking it', async () => {
  const h = harness();
  const firstPath = '/art/a/idle.png';
  const secondPath = '/art/b/idle.png';
  const first = await h.registry.prepare([firstPath], MALE_ORIGINAL);
  first.commit();
  first.finalize();
  const second = await h.registry.prepare([secondPath], FEMALE_VIOLET);
  second.commit();
  second.rollback();
  assert.equal(h.registry.activeUrl(firstPath), firstPath);
  assert.equal(h.registry.activeUrl(secondPath), null);
  assert.equal(h.events.filter((event) => event[0] === 'release').length, 1);
  assert.equal(h.registry.status().generation, 3);
});

test('only one committed stage may await finalization', async () => {
  const h = harness();
  const first = await h.registry.prepare(['/art/a.png'], MALE_ORIGINAL);
  const second = await h.registry.prepare(['/art/b.png'], MALE_ORIGINAL);
  first.commit();
  assert.throws(() => second.commit(), (error) => error.code === 'stage-in-progress');
  first.finalize();
  second.commit();
  second.finalize();
  assert.equal(h.registry.status().generation, 2);
});

test('a partial resolve failure releases every fulfilled handle and publishes no stage', async () => {
  let call = 0;
  const h = harness({
    session: {
      async resolve(basePath, look) {
        call += 1;
        if (call === 2) throw Object.assign(new Error('mask missing'), { code: 'asset-failed' });
        return runtimeHandle(basePath, look, {
          release() { h.events.push(['partial-release']); },
        });
      },
    },
  });
  await assert.rejects(
    h.registry.prepare(['/art/a.png', '/art/b.png'], MALE_ORIGINAL),
    (error) => error.code === 'asset-failed',
  );
  assert.equal(h.events.filter((event) => event[0] === 'partial-release').length, 1);
  assert.equal(h.registry.status().preparedStages, 0);
  assert.equal(h.registry.status().active, false);
});

test('mismatched morphology, path or remote handle URLs fail closed and release the bad handle', async () => {
  for (const mutation of [
    { morphology: 'female' },
    { basePath: '/art/other.png' },
    { url: 'https://evil.test/frame.png' },
  ]) {
    let released = 0;
    const h = harness({
      session: {
        async resolve(basePath, exactLook) {
          return runtimeHandle(basePath, exactLook, {
            release() { released += 1; },
            ...mutation,
          });
        },
      },
    });
    await assert.rejects(h.registry.prepare(['/art/a.png'], MALE_ORIGINAL), (error) => error.code === 'invalid-handle');
    assert.equal(released, 1);
  }
});

test('an abort after a late resolve releases the completed handle instead of caching it', async () => {
  const gate = deferred();
  let released = 0;
  const h = harness({
    session: {
      async resolve(basePath, exactLook) {
        await gate.promise;
        return runtimeHandle(basePath, exactLook, {
          url: 'blob:late', bypass: false,
          release() { released += 1; },
        });
      },
    },
  });
  const controller = new AbortController();
  const pending = h.registry.prepare(['/art/a.png'], MALE_ORIGINAL, { signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  gate.resolve();
  await assert.rejects(pending, (error) => error.code === 'aborted');
  assert.equal(released, 1);
  assert.equal(h.registry.status().activeFrames, 0);
});

test('registry dispose releases callers from never-settling load and resolve work', async () => {
  const neverLoad = harness({ session: { load() { return new Promise(() => {}); } } });
  const loading = neverLoad.registry.prepare(['/art/a.png'], MALE_ORIGINAL);
  await new Promise((resolve) => setImmediate(resolve));
  neverLoad.registry.dispose();
  assert.equal(await Promise.race([
    loading.then(() => 'fulfilled', (error) => error.code),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
  ]), 'disposed');

  const gate = deferred();
  let lateReleases = 0;
  const neverResolve = harness({
    session: {
      async resolve(basePath, exactLook) {
        await gate.promise;
        return runtimeHandle(basePath, exactLook, {
          url: 'blob:late-dispose', bypass: false,
          release() { lateReleases += 1; },
        });
      },
    },
  });
  const resolving = neverResolve.registry.prepare(['/art/b.png'], MALE_ORIGINAL);
  await new Promise((resolve) => setImmediate(resolve));
  neverResolve.registry.dispose();
  assert.equal(await Promise.race([
    resolving.then(() => 'fulfilled', (error) => error.code),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
  ]), 'disposed');
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lateReleases, 1);
});

test('scene leases retain their own handles across an active generation replacement', async () => {
  const h = harness();
  const scenePath = '/art/pets/contact.png';
  const first = await h.registry.prepare(['/art/core/idle.png'], FEMALE_VIOLET);
  first.commit();
  first.finalize();
  const lease = await h.registry.lease([scenePath], FEMALE_VIOLET);
  const sceneUrl = lease.urlFor(scenePath);
  const second = await h.registry.prepare(['/art/core/idle-fresh.png'], MALE_ORIGINAL);
  second.commit();
  second.finalize();
  assert.equal(lease.urlFor(scenePath), sceneUrl);
  const releasesBeforeLease = h.events.filter((event) => event[0] === 'release').length;
  assert.equal(releasesBeforeLease, 1);
  lease.release();
  lease.release();
  assert.equal(h.events.filter((event) => event[0] === 'release').length, 2);
});

test('dispose releases active, prepared and leased resources exactly once', async () => {
  const h = harness();
  const active = await h.registry.prepare(['/art/active.png'], FEMALE_VIOLET);
  active.commit();
  active.finalize();
  await h.registry.prepare(['/art/prepared.png'], FEMALE_VIOLET);
  await h.registry.lease(['/art/lease.png'], FEMALE_VIOLET);
  h.registry.dispose();
  h.registry.dispose();
  assert.equal(h.events.filter((event) => event[0] === 'release').length, 3);
  assert.deepEqual(h.registry.status(), {
    disposed: true, generation: 1, active: false, activeFrames: 0, preparedStages: 0, leases: 0,
  });
  assert.throws(() => h.registry.activeUrl('/art/active.png'), (error) => error.code === 'disposed');
});

test('invalid and duplicate base paths are rejected before session load', async () => {
  for (const list of [
    [],
    ['https://evil.test/a.png'],
    ['/art/a.png?x=1'],
    ['/art/a.png', '/art/a.png'],
    Array.from({ length: 93 }, (_, index) => `/art/${index}.png`),
  ]) {
    const h = harness();
    await assert.rejects(h.registry.prepare(list, MALE_ORIGINAL), (error) => error.code === 'invalid-paths');
    assert.equal(h.events.length, 0);
  }
});

test('only authored morphology, identity and palette tuples reach the session', async () => {
  const invalidLooks = [
    { ...MALE_ORIGINAL, identityId: 'female-f2-v1' },
    { ...MALE_ORIGINAL, palette: { ...MALE_ORIGINAL.palette, skin: 'root' } },
    { ...MALE_ORIGINAL, palette: { ...MALE_ORIGINAL.palette, coat: 'teal' } },
  ];
  for (const invalidLook of invalidLooks) {
    const h = harness();
    await assert.rejects(
      h.registry.prepare(['/art/a.png'], invalidLook),
      (error) => error.code === 'invalid-look',
    );
    assert.equal(h.events.length, 0);
  }
});

test('handles must bind the exact look key and may bypass only the original palette', async () => {
  for (const [exactLook, mutation] of [
    [MALE_ORIGINAL, { lookKey: lookKey(FEMALE_VIOLET) }],
    [MALE_ORIGINAL, { url: 'blob:forged', bypass: false }],
    [FEMALE_VIOLET, { url: '/art/a.png', bypass: true }],
  ]) {
    let released = 0;
    const h = harness({
      session: {
        async resolve(basePath, requestedLook) {
          return runtimeHandle(basePath, requestedLook, {
            release() { released += 1; },
            ...mutation,
          });
        },
      },
    });
    await assert.rejects(
      h.registry.prepare(['/art/a.png'], exactLook),
      (error) => error.code === 'invalid-handle',
    );
    assert.equal(released, 1);
  }
});

test('terminal stages and released leases never return revoked URLs or expose an internal disposer', async () => {
  const h = harness();
  const stage = await h.registry.prepare(['/art/a.png'], MALE_ORIGINAL);
  assert.equal(Object.prototype.hasOwnProperty.call(stage, 'forceDispose'), false);
  stage.abort();
  assert.throws(() => stage.urlFor('/art/a.png'), (error) => error.code === 'invalid-stage');

  const lease = await h.registry.lease(['/art/b.png'], FEMALE_VIOLET);
  lease.release();
  assert.throws(() => lease.urlFor('/art/b.png'), (error) => error.code === 'released');
});

test('finalize transitions before releasing hostile previous resources', async () => {
  let call = 0;
  let secondStage;
  let reentryCode = null;
  const h = harness({
    session: {
      async resolve(basePath, requestedLook) {
        const id = ++call;
        return runtimeHandle(basePath, requestedLook, {
          url: id === 1 ? basePath : 'blob:second',
          bypass: id === 1,
          key: `runtime-${id}`,
          release() {
            if (id !== 1 || !secondStage) return;
            try { secondStage.rollback(); }
            catch (error) { reentryCode = error.code; }
          },
        });
      },
    },
  });
  const first = await h.registry.prepare(['/art/first.png'], MALE_ORIGINAL);
  first.commit();
  first.finalize();
  secondStage = await h.registry.prepare(['/art/second.png'], FEMALE_VIOLET);
  secondStage.commit();
  secondStage.finalize();
  assert.equal(reentryCode, 'invalid-stage');
  assert.equal(secondStage.state, 'finalized');
  assert.equal(h.registry.activeUrl('/art/second.png'), 'blob:second');
});

test('one hostile handle reused for multiple paths is released exactly once', async () => {
  let releases = 0;
  const shared = runtimeHandle('/art/a.png', MALE_ORIGINAL, {
    key: 'shared-runtime-key',
    release() { releases += 1; },
  });
  const h = harness({ session: { async resolve() { return shared; } } });
  await assert.rejects(
    h.registry.prepare(['/art/a.png', '/art/b.png'], MALE_ORIGINAL),
    (error) => error.code === 'invalid-handle',
  );
  assert.equal(releases, 1);
});

test('a handle object cannot be reused by a later acquisition while its first owner is active', async () => {
  let releases = 0;
  const shared = runtimeHandle('/art/a.png', MALE_ORIGINAL, {
    key: 'one-shot-runtime-key',
    release() { releases += 1; },
  });
  const h = harness({ session: { async resolve() { return shared; } } });
  const first = await h.registry.prepare(['/art/a.png'], MALE_ORIGINAL);
  first.commit();
  first.finalize();
  await assert.rejects(
    h.registry.prepare(['/art/a.png'], MALE_ORIGINAL),
    (error) => error.code === 'invalid-handle',
  );
  assert.equal(releases, 0);
  assert.equal(h.registry.activeUrl('/art/a.png'), '/art/a.png');
  h.registry.dispose();
  assert.equal(releases, 1);
});

test('an aborted retry cannot release a late handle that still belongs to the active generation', async () => {
  const gate = deferred();
  let calls = 0;
  let releases = 0;
  const shared = runtimeHandle('/art/a.png', MALE_ORIGINAL, {
    key: 'active-shared-key',
    release() { releases += 1; },
  });
  const h = harness({
    session: {
      async resolve() {
        calls += 1;
        if (calls > 1) await gate.promise;
        return shared;
      },
    },
  });
  const first = await h.registry.prepare(['/art/a.png'], MALE_ORIGINAL);
  first.commit();
  first.finalize();
  const controller = new AbortController();
  const retry = h.registry.prepare(['/art/a.png'], MALE_ORIGINAL, { signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(retry, (error) => error.code === 'aborted');
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(releases, 0);
  assert.equal(h.registry.activeUrl('/art/a.png'), '/art/a.png');
  h.registry.dispose();
  assert.equal(releases, 1);
});

test('a genuinely new late-abort handle is retired once and can never be accepted later', async () => {
  const gate = deferred();
  let calls = 0;
  let releases = 0;
  const late = runtimeHandle('/art/a.png', MALE_ORIGINAL, {
    key: 'late-one-shot-key',
    release() { releases += 1; },
  });
  const h = harness({
    session: {
      async resolve() {
        calls += 1;
        if (calls === 1) await gate.promise;
        return late;
      },
    },
  });
  const controller = new AbortController();
  const pending = h.registry.prepare(['/art/a.png'], MALE_ORIGINAL, { signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, (error) => error.code === 'aborted');
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(releases, 1);
  await assert.rejects(
    h.registry.prepare(['/art/a.png'], MALE_ORIGINAL),
    (error) => error.code === 'invalid-handle',
  );
  assert.equal(releases, 1);
});

test('abort and dispose in the post-resolve microtask cannot publish a stage or lease', async () => {
  const controller = new AbortController();
  let abortReleases = 0;
  const aborted = harness({
    session: {
      async resolve(basePath, requestedLook) {
        queueMicrotask(() => controller.abort());
        return runtimeHandle(basePath, requestedLook, { release() { abortReleases += 1; } });
      },
    },
  });
  await assert.rejects(
    aborted.registry.prepare(['/art/a.png'], MALE_ORIGINAL, { signal: controller.signal }),
    (error) => error.code === 'aborted',
  );
  assert.equal(abortReleases, 1);
  assert.equal(aborted.registry.status().preparedStages, 0);

  let disposed;
  let disposeReleases = 0;
  disposed = harness({
    session: {
      async resolve(basePath, requestedLook) {
        queueMicrotask(() => disposed.registry.dispose());
        return runtimeHandle(basePath, requestedLook, { release() { disposeReleases += 1; } });
      },
    },
  });
  await assert.rejects(
    disposed.registry.lease(['/art/b.png'], MALE_ORIGINAL),
    (error) => error.code === 'disposed',
  );
  assert.equal(disposeReleases, 1);
  assert.equal(disposed.registry.status().leases, 0);
});

test('a failed peer aborts another never-settling resolve instead of hanging acquisition', async () => {
  const h = harness({
    session: {
      resolve(basePath) {
        if (basePath === '/art/a.png') {
          return Promise.reject(Object.assign(new Error('missing mask'), { code: 'asset-failed' }));
        }
        return new Promise(() => {});
      },
    },
  });
  const outcome = await Promise.race([
    h.registry.prepare(['/art/a.png', '/art/b.png'], MALE_ORIGINAL)
      .then(() => 'fulfilled', (error) => error.code),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
  ]);
  assert.equal(outcome, 'asset-failed');
});

test('registry is a pure handle owner and never reaches into DOM, settings or persistence', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/traveller-frame-registry-v2.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:document|window|State|Store|localStorage|sessionStorage|fetch)\b/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /module\.exports/);
  assert.equal(Registry.MAX_PATHS, 92);
});
