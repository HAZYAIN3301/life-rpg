'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const shop = require('../public/shop-catalog-v1');
const copy = value => JSON.parse(JSON.stringify(value));
function between(a, b) { const i = app.indexOf(a), j = app.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, a); return app.slice(i, j); }
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { resolve, promise }; }
function appearanceHarness() {
  const State = { me: { id: 'one' }, settings: { avatarAppearance: { look: 'old' }, avatarForge: { look: 'old' } } };
  const pending = [], calls = [], events = [];
  const c = vm.createContext({ State, Store: { _writeEpoch: 1 }, structuredClone,
    normalizeAvatarAppearance: copy, CHARACTER_WARDROBE_V1_ITEM_IDS: new Set(['headwear:hat']),
    characterWardrobeV1Seen: () => new Set(), characterWardrobeV1Owned: () => new Set(['headwear:hat']),
    economyCommit: data => { calls.push(data); const wait = deferred(); pending.push(wait); return wait.promise; },
    economySaveUnconfirmed: () => 'retry', toast: text => events.push(text), t: x => x,
    preloadAvatarAppearance: async () => {}, document: { querySelectorAll: () => [] }, render: () => events.push('render') });
  vm.runInContext(between('let avatarAppearanceAttempt =', 'function nextAvatarAppearance(')
    + 'let _avatarAppearanceRenderToken = 0;'
    + between('async function queueAvatarAppearanceRender(', 'function avatarArtHTML('), c);
  return { c, State, calls, pending, events };
}
const turn = () => new Promise(r => setImmediate(r));
test('wardrobe waits for the receipt; refusal preserves look and seen; retry freezes candidate', async () => {
  const h = appearanceHarness(), before = copy(h.State.settings);
  const run = () => h.c.queueAvatarAppearanceRender({ look: 'new' }, { itemId: 'headwear:hat' });
  const first = run(); await turn();
  assert.deepEqual(h.State.settings, before); assert.deepEqual(h.events, []);
  h.pending[0].resolve(false); assert.equal(await first, false);
  assert.deepEqual(h.State.settings, before); assert.deepEqual(h.events, ['retry']);
  const second = run(); await turn(); assert.equal(h.calls[0], h.calls[1]);
  h.pending[1].resolve(true); assert.deepEqual(copy(await second), { look: 'new' });
  assert.deepEqual(copy(h.State.settings.avatarForge), { look: 'new' });
  assert.deepEqual(copy(h.State.settings.avatarWardrobeV1), { schemaVersion: 1, owned: ['headwear:hat'], seen: ['headwear:hat'] });
  assert.deepEqual(h.events, ['retry', 'render']);
});
test('wardrobe coalesces clicks without allowing a second candidate in flight', async () => {
  const h = appearanceHarness(); const first = h.c.queueAvatarAppearanceRender({ look: 'a' }); await turn();
  assert.equal(await h.c.queueAvatarAppearanceRender({ look: 'b' }), false); assert.equal(h.calls.length, 1);
  h.pending[0].resolve(true); await first; assert.equal(h.State.settings.avatarForge.look, 'a');
});
for (const scope of ['account', 'epoch']) test(`wardrobe ignores receipt and feedback after ${scope} changes`, async () => {
  const h = appearanceHarness(); const first = h.c.queueAvatarAppearanceRender({ look: 'a' }); await turn();
  if (scope === 'account') h.State.me.id = 'two'; else h.c.Store._writeEpoch++;
  h.State.settings = { other: true }; h.pending[0].resolve(true);
  assert.equal(await first, false); assert.deepEqual(h.State.settings, { other: true }); assert.deepEqual(h.events, []);
});
test('wardrobe does not save after an account changes during image loading', async () => {
  const h = appearanceHarness(), image = deferred(); h.c.preloadAvatarAppearance = () => image.promise;
  const first = h.c.queueAvatarAppearanceRender({ look: 'a' }); h.State.me.id = 'two'; image.resolve();
  assert.equal(await first, false); assert.equal(h.calls.length, 0); assert.deepEqual(h.events, []);
});
function renderHarness() {
  const c = vm.createContext({ window: { ShopCatalogV1: shop }, State: { settings: {} }, isPro: () => false,
    Date, Map, structuredClone, esc: x => String(x).replaceAll('"', '&quot;'), t: x => x,
    avatarCorePoseHTML: () => '<span>Traveller</span>', frameById: id => shop.FRAMES.find(f => f.id === id),
    equippedCosmeticsOpts: () => ({ frame: shop.FRAMES[0], bg: '#23402f' }),
    cosmeticById: id => [...shop.FRAMES, ...shop.BACKGROUNDS].find(x => x.id === id),
    cosmeticType: id => id.startsWith('fr_') ? 'frame' : 'background' });
  vm.runInContext(fs.readFileSync(require.resolve('../public/den-scene-v4'), 'utf8'), c);
  vm.runInContext(between('function avatarPortraitHTML(', 'function avatarFigureHTML(')
    + between('const DEN_THEMES = window.ShopCatalogV1.DEN_THEMES;', 'function preloadDenMaster(')
    + between('function denSceneSVG(', 'function denLegacyRoomFixturesHTML(')
    + between('function denLegacyRoomFixturesHTML(', 'function syncDenAmbientVisual(')
    + between('function economyPreviewHTML(', 'function showEconomyConfirm('), c);
  c.ensureDen(); return c;
}
test('portrait consumes equipped cosmetics and preview override without changing ownership', () => {
  const c = renderHarness(), before = copy(c.State);
  const first = c.avatarPortraitHTML(), second = c.avatarPortraitHTML({ frame: shop.FRAMES[8], bg: '#160f2e' });
  assert.notEqual(first, second); assert.match(first, /fr_bronze/); assert.match(second, /fr_phoenix/);
  assert.match(second, /--portrait-bg:#160f2e/); assert.deepEqual(copy(c.State), before);
  assert.doesNotMatch(c.avatarPortraitHTML({ bg: 'red;position:fixed', frame: { id: 'invented', ring: 'red' } }), /position:fixed|invented/);
});
test('preview renders every paid furniture item without granting, spending or altering installed furniture', () => {
  const c = renderHarness(), before = copy(c.State);
  for (const item of shop.DEN_ITEMS.filter(x => x.access === 'level')) {
    const html = c.economyPreviewHTML({ kind: 'den-item', id: item.id });
    assert.ok(html.includes(`data-den-id="${item.id}"`), item.id);
    assert.ok(html.includes('--den-x:'), 'preview uses room world coordinates');
    const placement = c.window.DenSceneV4.item(item.id);
    assert.equal(placement.slot, item.slot); assert.ok(Object.isFrozen(placement));
    assert.ok(placement.x >= 0 && placement.x + placement.w <= 1536);
    assert.ok(placement.y >= 0 && placement.y + placement.h <= 864);
    assert.deepEqual(copy(c.State), before, item.id);
  }
  const theme = c.economyPreviewHTML({ kind: 'den-theme', id: 'moon-tower' });
  assert.match(theme, /data-den-theme="moon-tower"/); assert.match(theme, /--den-room-wall:#30395c/);
  assert.deepEqual(copy(c.State), before);
});
