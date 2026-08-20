const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Controller = require('../public/traveller-appearance-controller-v2.js');
const Look = require('../public/traveller-look-v2.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(overrides = {}) {
  const events = [];
  let account = {
    lang: 'de',
    avatarCoreGender: 'male',
    avatarCorePalette: { schemaVersion: 1, skin: 'original', hair: 'original', eyes: 'original' },
    avatarAppearance: { presetId: 'traveller', slots: { hair: 'legacy' } },
    avatarForge: { presetId: 'scholar', slots: { hair: 'forge' } },
    nested: { preserved: true },
  };
  const manifest = { id: 'compiled-test' };
  const session = {
    async load() { events.push(['session-load']); return { ready: true }; },
    manifest() { events.push(['session-manifest']); return manifest; },
    async prefetch(paths, look, options) {
      events.push(['prefetch', [...paths], look, options]);
      return { warmed: paths.length };
    },
  };
  const persistResults = [];
  const visual = {
    async apply(context) { events.push(['visual-apply', context.transactionId]); },
    async rollback(context) { events.push(['visual-rollback', context.transactionId]); },
    release(outcome, context) { events.push(['visual-release', outcome, context?.transactionId]); },
  };
  const options = {
    lookApi: Look,
    session,
    readSettings() { events.push(['settings-read']); return account; },
    async persistSettings(settings, context) {
      events.push(['settings-persist', settings, context]);
      return persistResults.length ? persistResults.shift() : true;
    },
    publishSettings(settings, context) {
      events.push(['settings-publish', settings, context]);
      account = settings;
    },
    requiredBasePaths(context) {
      events.push(['required-paths', context]);
      return ['/art/avatars/traveller-core-v1/male/poses/idle.png'];
    },
    async prepareVisual(context) { events.push(['visual-prepare', context]); return visual; },
    async cancelScene(context) { events.push(['scene-cancel', context.transactionId]); },
    AbortControllerImpl: AbortController,
    ...overrides,
  };
  const controller = Controller.createController(options);
  return {
    controller,
    events,
    session,
    visual,
    manifest,
    persistResults,
    account() { return account; },
  };
}

test('one appearance change is prepared, persisted and applied in an exact durable order', async () => {
  const h = harness();
  const result = await h.controller.change({ palette: { hair: 'hair-auburn' } });
  assert.equal(result.changed, true);
  assert.equal(result.after.palette.hair, 'hair-auburn');
  assert.equal(h.account().avatarCorePalette.hair, 'hair-auburn');
  assert.equal(h.account().lang, 'de');
  assert.deepEqual(h.account().avatarAppearance, { presetId: 'traveller', slots: { hair: 'legacy' } });
  assert.deepEqual(h.account().avatarForge, { presetId: 'scholar', slots: { hair: 'forge' } });
  assert.deepEqual(h.events.map((event) => event[0]), [
    'settings-read',
    'session-load',
    'session-manifest',
    'required-paths',
    'prefetch',
    'visual-prepare',
    'scene-cancel',
    'settings-persist',
    'settings-publish',
    'visual-apply',
    'visual-release',
  ]);
  assert.equal(h.events.at(-1)[1], 'committed');
  result.settings.nested.preserved = false;
  assert.equal(h.account().nested.preserved, true);
  assert.equal(Object.isFrozen(result.settings.nested), true);
  assert.deepEqual(h.controller.status(), {
    phase: 'idle', busy: false, disposed: false, transactionId: null, error: null,
  });
});

test('an exact no-op never loads art, stops a scene or writes settings', async () => {
  const h = harness();
  const result = await h.controller.change({ gender: 'male', palette: { hair: 'original' } });
  assert.equal(result.changed, false);
  assert.deepEqual(h.events.map((event) => event[0]), ['settings-read']);
});

test('rapid changes serialize and the second request reads the first durable result', async () => {
  const gate = deferred();
  let saves = 0;
  const h = harness({
    async persistSettings(settings, context) {
      h.events.push(['settings-persist', settings, context]);
      saves += 1;
      if (saves === 1) await gate.promise;
      return true;
    },
    publishSettings(settings, context) {
      h.events.push(['settings-publish', settings, context]);
      h.accountValue = settings;
    },
    readSettings() {
      h.events.push(['settings-read']);
      return h.accountValue || h.account();
    },
  });
  const first = h.controller.change({ palette: { hair: 'hair-chestnut' } });
  const mutableSecond = { palette: { eyes: 'eyes-jade' } };
  const second = h.controller.change(mutableSecond);
  mutableSecond.palette.eyes = 'eyes-violet';
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saves, 1);
  gate.resolve();
  await first;
  const final = await second;
  assert.equal(final.after.palette.hair, 'hair-chestnut');
  assert.equal(final.after.palette.eyes, 'eyes-jade');
  assert.equal(saves, 2);
  const applies = h.events.filter((event) => event[0] === 'visual-apply').map((event) => event[1]);
  assert.deepEqual(applies, [1, 2]);
});

test('a failed save never publishes or applies the prepared look', async () => {
  const h = harness();
  h.persistResults.push(false);
  await assert.rejects(
    h.controller.change({ palette: { skin: 'skin-deep' } }),
    (error) => error.code === 'save-failed',
  );
  assert.equal(h.account().avatarCorePalette.skin, 'original');
  assert.equal(h.events.some((event) => event[0] === 'settings-publish'), false);
  assert.equal(h.events.some((event) => event[0] === 'visual-apply'), false);
  assert.deepEqual(h.events.find((event) => event[0] === 'visual-release').slice(1), ['aborted', 1]);
  assert.equal(h.controller.status().phase, 'error');
});

test('a visual apply failure restores durable settings and the previous visual', async () => {
  const h = harness({
    async prepareVisual() {
      return {
        async apply() { h.events.push(['visual-apply']); throw new Error('DOM swap failed'); },
        async rollback() { h.events.push(['visual-rollback']); },
        release(outcome) { h.events.push(['visual-release', outcome]); },
      };
    },
  });
  await assert.rejects(
    h.controller.change({ gender: 'female', palette: { eyes: 'eyes-ocean' } }),
    (error) => error.code === 'change-failed',
  );
  const persists = h.events.filter((event) => event[0] === 'settings-persist');
  assert.equal(persists.length, 2);
  assert.equal(persists[0][1].avatarCoreGender, 'female');
  assert.equal(persists[1][1].avatarCoreGender, 'male');
  assert.equal(persists[1][2].rollback, true);
  assert.equal(h.account().avatarCoreGender, 'male');
  assert.equal(h.events.some((event) => event[0] === 'visual-rollback'), true);
  assert.deepEqual(h.events.find((event) => event[0] === 'visual-release').slice(1), ['rolled-back']);
});

test('a failed durable rollback is reported as recovery-required, never as success', async () => {
  const h = harness({
    async prepareVisual() {
      return {
        async apply() { throw new Error('swap'); },
        release(outcome) { h.events.push(['visual-release', outcome]); },
      };
    },
  });
  h.persistResults.push(true, false);
  await assert.rejects(
    h.controller.change({ palette: { hair: 'hair-violet' } }),
    (error) => error.code === 'rollback-failed',
  );
  assert.equal(h.account().avatarCorePalette.hair, 'hair-violet');
  assert.equal(h.controller.status().phase, 'recovery-required');
  assert.deepEqual(h.events.find((event) => event[0] === 'visual-release').slice(1), ['recovery-required']);
});

test('recovery-required permanently fences already queued and future changes', async () => {
  const h = harness({
    async prepareVisual() {
      return { async apply() { throw new Error('swap'); } };
    },
  });
  h.persistResults.push(true, false);
  const first = h.controller.change({ palette: { hair: 'hair-violet' } });
  const queued = h.controller.change({ palette: { hair: 'hair-honey' } });
  await assert.rejects(first, (error) => error.code === 'rollback-failed');
  await assert.rejects(queued, (error) => error.code === 'recovery-required');
  await assert.rejects(
    h.controller.change({ palette: { eyes: 'eyes-jade' } }),
    (error) => error.code === 'recovery-required',
  );
  assert.equal(h.events.filter((event) => event[0] === 'settings-persist').length, 2);
  assert.equal(h.controller.status().phase, 'recovery-required');
});

test('adapter contexts are deeply isolated from live account settings', async () => {
  const h = harness({
    requiredBasePaths(context) {
      assert.equal(Object.isFrozen(context.beforeSettings.nested), true);
      context.beforeSettings.nested.preserved = false;
      context.nextSettings.nested.preserved = false;
      return ['/art/a.png'];
    },
  });
  h.persistResults.push(false);
  await assert.rejects(h.controller.change({ palette: { skin: 'skin-warm' } }), (error) => error.code === 'save-failed');
  assert.equal(h.account().nested.preserved, true);
});

test('a cleanup exception cannot replace the transaction error or leave a busy phase', async () => {
  const h = harness({
    async prepareVisual() {
      return { release() { throw new Error('release exploded'); } };
    },
  });
  h.persistResults.push(false);
  await assert.rejects(h.controller.change({ palette: { eyes: 'eyes-ocean' } }), (error) => error.code === 'save-failed');
  assert.equal(h.controller.status().phase, 'error');
  assert.equal(h.controller.status().busy, false);
});

test('rollback never mutates a frozen causal Error and still publishes recovery-required', async () => {
  const frozen = Object.freeze(Object.assign(new Error('frozen visual error'), { code: 'visual-frozen' }));
  let writes = 0;
  const h = harness({
    async persistSettings() {
      writes += 1;
      if (writes === 2) throw new Error('rollback transport failed');
      return true;
    },
    async prepareVisual() {
      return { async apply() { throw frozen; } };
    },
  });
  await assert.rejects(h.controller.change({ palette: { skin: 'skin-umber' } }), (error) => error.code === 'rollback-failed');
  assert.equal(writes, 2);
  assert.equal(h.controller.status().phase, 'recovery-required');
  assert.equal(h.controller.status().busy, false);
});

test('invalid, duplicate or mutable preflight routes fail before palette work and persistence', async () => {
  for (const paths of [
    ['https://evil.test/a.png'],
    ['/art/a.png?mutable=1'],
    ['/art/a.png', '/art/a.png'],
    Array.from({ length: 93 }, (_, index) => `/art/f${index}.png`),
  ]) {
    const h = harness({ requiredBasePaths() { return paths; } });
    await assert.rejects(
      h.controller.change({ palette: { eyes: 'eyes-amber' } }),
      (error) => error.code === 'invalid-preflight',
    );
    assert.equal(h.events.some((event) => event[0] === 'prefetch'), false);
    assert.equal(h.events.some((event) => event[0] === 'settings-persist'), false);
  }
});

test('disposing an active preflight aborts it and queued work cannot begin', async () => {
  let prefetchCalls = 0;
  const h = harness({
    session: {
      async load() {},
      manifest() { return {}; },
      prefetch(paths, look, options) {
        prefetchCalls += 1;
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
        });
      },
    },
  });
  const first = h.controller.change({ palette: { hair: 'hair-ash' } });
  const second = h.controller.change({ palette: { hair: 'hair-honey' } });
  await new Promise((resolve) => setImmediate(resolve));
  h.controller.dispose();
  await assert.rejects(first, (error) => error.code === 'disposed');
  await assert.rejects(second, (error) => error.code === 'disposed');
  assert.equal(prefetchCalls, 1);
  assert.equal(h.events.some((event) => event[0] === 'settings-persist'), false);
  assert.equal(h.controller.status().phase, 'disposed');
});

test('dispose triggered from the preparing phase cannot be overwritten by a no-op', async () => {
  const h = harness();
  h.controller.subscribe((status) => {
    if (status.phase === 'preparing') h.controller.dispose();
  });
  await assert.rejects(
    h.controller.change({ gender: 'male', palette: { hair: 'original' } }),
    (error) => error.code === 'disposed',
  );
  assert.equal(h.controller.status().phase, 'disposed');
  assert.equal(h.controller.status().disposed, true);
});

test('dispose releases the queue even when the shared session load never settles', async () => {
  const never = new Promise(() => {});
  const h = harness({
    session: { load() { return never; }, manifest() { return {}; }, prefetch() {} },
  });
  const changing = h.controller.change({ palette: { hair: 'hair-ash' } });
  await new Promise((resolve) => setImmediate(resolve));
  h.controller.dispose();
  const result = await Promise.race([
    changing.then(() => 'fulfilled', (error) => error.code),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
  ]);
  assert.equal(result, 'disposed');
  assert.equal(h.controller.status().phase, 'disposed');
});

test('dispose abort-races every safe pre-persistence hook that ignores its signal', async () => {
  const cases = [
    {
      name: 'required paths',
      overrides: { requiredBasePaths() { return new Promise(() => {}); } },
    },
    {
      name: 'prefetch',
      overrides: {
        session: { async load() {}, manifest() { return {}; }, prefetch() { return new Promise(() => {}); } },
      },
    },
    {
      name: 'visual prepare',
      overrides: { prepareVisual() { return new Promise(() => {}); } },
    },
    {
      name: 'scene stop',
      overrides: { cancelScene() { return new Promise(() => {}); } },
    },
  ];
  for (const entry of cases) {
    const h = harness(entry.overrides);
    const changing = h.controller.change({ palette: { hair: 'hair-ash' } });
    await new Promise((resolve) => setImmediate(resolve));
    h.controller.dispose();
    const result = await Promise.race([
      changing.then(() => 'fulfilled', (error) => error.code),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ]);
    assert.equal(result, 'disposed', entry.name);
    assert.equal(h.events.some((event) => event[0] === 'settings-persist'), false, entry.name);
  }
});

test('a visual transaction that arrives after abort is released exactly once', async () => {
  const gate = deferred();
  const releases = [];
  const h = harness({
    async prepareVisual() {
      await gate.promise;
      return { release(outcome) { releases.push(outcome); } };
    },
  });
  const changing = h.controller.change({ palette: { eyes: 'eyes-violet' } });
  while (!h.events.some((event) => event[0] === 'prefetch')) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await new Promise((resolve) => setImmediate(resolve));
  h.controller.dispose();
  await assert.rejects(changing, (error) => error.code === 'disposed');
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(releases, ['aborted']);
});

test('disposing after persistence rolls the account back and still ends disposed', async () => {
  const applying = deferred();
  const h = harness({
    async prepareVisual() {
      return {
        async apply() { await applying.promise; },
        async rollback() { h.events.push(['visual-rollback']); },
        release(outcome) { h.events.push(['visual-release', outcome]); },
      };
    },
  });
  const changing = h.controller.change({ palette: { skin: 'skin-bronze' } });
  while (!h.events.some((event) => event[0] === 'settings-publish')) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  h.controller.dispose();
  applying.resolve();
  await assert.rejects(changing, (error) => error.code === 'disposed');
  assert.equal(h.account().avatarCorePalette.skin, 'original');
  assert.equal(h.events.filter((event) => event[0] === 'settings-persist').length, 2);
  assert.equal(h.events.some((event) => event[0] === 'visual-rollback'), true);
  assert.equal(h.controller.status().phase, 'disposed');
});

test('status listeners receive ordered busy phases and cannot break a transaction', async () => {
  const h = harness();
  const phases = [];
  const unsubscribe = h.controller.subscribe((status) => {
    phases.push(status.phase);
    if (status.phase === 'persisting') throw new Error('listener failure');
  });
  await h.controller.change({ palette: { eyes: 'eyes-ink' } });
  unsubscribe();
  assert.deepEqual(phases, ['idle', 'preparing', 'stopping-scene', 'persisting', 'applying', 'idle']);
  assert.throws(() => h.controller.subscribe(null), (error) => error.code === 'invalid-listener');
});

test('controller is a pure UMD coordinator with no account globals, DOM or persistence shortcut', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/traveller-appearance-controller-v2.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:document|window|State|Store|localStorage|sessionStorage|autosaveSettings)\b/);
  assert.match(source, /persistSettings/);
  assert.match(source, /publishSettings/);
  assert.match(source, /module\.exports/);
  assert.equal(Controller.MAX_PREFLIGHT_PATHS, 92);
});
