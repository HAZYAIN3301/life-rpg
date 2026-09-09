'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Guide = require('../public/guide-v3');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const source = app.slice(app.indexOf('const guideV3PurchaseAttempts ='), app.indexOf('let _guideV3SurfaceKey ='));
const copy = x => JSON.parse(JSON.stringify(x));
function harness(write = async () => true) {
  let at = 100;
  const calls = [], effects = [], metrics = [];
  const context = { window: { GuideV3: Guide }, structuredClone, console,
    Date: { now: () => ++at }, _guideV3WriteEpoch: 1,
    State: { me: { id: 'a' }, settings: { lang: 'ru', guideV3: Guide.normalize({ enabled: true,
      currentChapter: 'rewards', currentStep: 'engage', completedChapters: [Guide.FIRST_CHAPTER],
      chapterMeta: { rewards: { candidateId: 'reward-1' } } }) }, purchases: [] },
    Store: { _writeEpoch: 2, runExclusive: () => { throw Error('nested legacy Store lock'); } },
    pwaWriteAllowed: () => true,
    economyCommit: async data => { calls.push({ data, before: copy(data) }); return write(data, calls.length); },
    track: value => metrics.push(value) };
  context.guideV3Exclusive = op => op({ epoch: context._guideV3WriteEpoch, accountId: context.State.me.id });
  context.guideV3ContextActive = (chapter, completion) => context.State.settings.guideV3.currentChapter === chapter
    && context.State.settings.guideV3.currentStep === 'engage' && completion === 'purchase-persisted';
  vm.createContext(context); vm.runInContext(source, context);
  const candidate = [{ id: 'purchase-1', rewardId: 'reward-1', cost: 10, at: '2026-09-09T10:00:00Z' }];
  const call = (target = 'reward-1') => context.guideV3FeatureCommit('rewards', 'purchase-persisted', 'purchase-1', { purchases: candidate }, data => {
    effects.push(copy(data)); context.State.purchases = data.purchases;
  }, target);
  return { context, calls, effects, metrics, candidate, call };
}
test('Guide purchase retries the original reducer result and economy candidate, with no optimistic completion', async () => {
  const h = harness(async (_data, n) => n !== 1);
  const initial = copy(h.context.State.settings);
  assert.equal(await h.call(), false);
  assert.deepEqual(copy(h.context.State.settings), initial);
  assert.equal(h.effects.length, 0); assert.equal(h.metrics.length, 0);
  assert.equal(h.context.State._guideV3Error, 'persist');
  assert.equal(await h.call(), true);
  assert.equal(h.calls[0].data, h.calls[1].data, 'same object preserves economyCommit frozen request');
  assert.deepEqual(h.calls[0].before, h.calls[1].before, 'persistedAt does not change on retry');
  assert.equal(h.context.State.settings.guideV3.currentStep, 'complete');
  assert.equal(h.context.State.purchases.length, 1);
  assert.deepEqual(h.metrics, ['guide:rewards_completed_action']);
  assert.equal(await h.call(), false, 'completed Guide cannot spend again');
  assert.equal(h.calls.length, 2);
});
test('Guide purchase binds candidate, target, account and write epoch; a failed attempt cannot become a new gesture', async () => {
  const wrong = harness(); assert.equal(await wrong.call('other-reward'), false); assert.equal(wrong.calls.length, 0);
  for (const field of ['account', 'guideEpoch', 'storeEpoch', 'target']) {
    const h = harness(async () => false); await h.call();
    if (field === 'account') h.context.State.me.id = 'b';
    if (field === 'guideEpoch') h.context._guideV3WriteEpoch++;
    if (field === 'storeEpoch') h.context.Store._writeEpoch++;
    assert.equal(await h.call(field === 'target' ? 'other-reward' : 'reward-1'), false);
    assert.equal(h.calls.length, 1); assert.equal(h.effects.length, 0);
  }
  const h = harness(async () => false); await h.call(); h.candidate[0].cost = 999;
  await h.call(); assert.equal(h.calls[1].before.purchases[0].cost, 10, 'frozen candidate cannot be edited on retry');
});
test('Guide purchase waits for actual receipt and discards delayed success after account switch', async () => {
  let release; const h = harness(() => new Promise(r => { release = r; }));
  const pending = h.call(); assert.equal(h.effects.length, 0);
  assert.equal(h.context.State.settings.guideV3.currentStep, 'engage');
  h.context.State.me.id = 'b'; release(true);
  assert.equal(await pending, false); assert.equal(h.effects.length, 0); assert.equal(h.metrics.length, 0);
});
test('Guide purchase rechecks identity after an asynchronous UI adapter too', async () => {
  const h = harness(); let release, entered;
  const ready = new Promise(r => { entered = r; }), held = new Promise(r => { release = r; });
  const pending = h.context.guideV3FeatureCommit('rewards', 'purchase-persisted', 'purchase-1', { purchases: h.candidate }, async () => { entered(); await held; }, 'reward-1');
  await ready; h.context.State.me.id = 'b'; h.context.State.settings = { lang: 'de' };
  release(); assert.equal(await pending, false);
  assert.deepEqual(h.context.State.settings, { lang: 'de' }); assert.equal(h.metrics.length, 0);
});
