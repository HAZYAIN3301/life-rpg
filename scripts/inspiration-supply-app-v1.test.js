'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');
const Profile = require('../public/inspiration-profile-v1.js');
const Catalog = require('../public/inspiration-catalog-v1.js');
const Supply = require('../public/inspiration-supply-runtime-v1.js');
const Copy = require('../public/inspiration-supply-ui-v1.js');
const UI = require('../public/return-shelf-ui-v1.js');
const Shelf = require('../public/return-shelf-v1.js');
const Commit = require('../public/commitment-store-v1.js');
const Media = require('../public/inspiration-media-v1.js');
const APP = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const DAY = '2026-09-11', NOW = DAY + 'T12:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
function between(start, end) {
  const a = APP.indexOf(start), b = APP.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return APP.slice(a, b);
}
// App top-level declarations start at column zero; nested function declarations
// do not. Evaluate the actual function bodies, not rewritten controller doubles.
function functionSource(name) {
  const hit = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(APP);
  assert.ok(hit, name);
  const end = /^(?:(?:async )?function |const |let )/gm;
  end.lastIndex = hit.index + hit[0].length;
  return APP.slice(hit.index, end.exec(APP)?.index || APP.length);
}
function profile() {
  return Profile.configure({ interests: ['creative', 'learning', 'rest'].map(id => ({ id, label: id })), formats: ['quote'] });
}
function harness({ paired = false, modes = [] } = {}) {
  const events = [], requests = [], toasts = [], sounds = [], renders = [];
  const initial = Profile.recordShown(Supply.ensureDigest({ profile: profile(), day: DAY, now: NOW, locale: 'en' }).profile, DAY);
  const State = { me: { id: 'owner-a' }, view: 'shelf', settings: { inspiration: initial, unrelated: { keep: 1 } }, tasks: [],
    shelf: { version: 1, items: [] }, _shelfBusy: '', _shelfError: '', _inspirationFeedbackDraft: null };
  if (paired) State.settings.commitmentsV1 = { version: 2, mode: 'normal', items: [], log: {} };
  const server = { settings: clone(State.settings), tasks: [] };
  const queue = modes.slice();
  const ctx = vm.createContext({ State, URL, Response, AbortController, structuredClone, clearTimeout, setTimeout,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } },
    window: { InspirationProfileV1: Profile, InspirationCatalogV1: Catalog, InspirationSupplyRuntimeV1: Supply,
      InspirationSupplyUIV1: Copy, ReturnShelfUIV1: UI, ReturnShelfV1: Shelf, CommitmentStoreV1: Commit, InspirationMediaV1: Media },
    CSS: { escape: String }, console: { error() {}, warn() {} },
    lang: () => 'en', todayStr: () => DAY, t: text => text, esc: String,
    render: () => renders.push(clone(State)), toast: text => toasts.push(text),
    sfx: key => sounds.push(key), track: event => events.push(event),
    rememberInspirationLocalDraft: () => {},
    shelfState: () => State.shelf, shelfEngine: () => Shelf,
    inspirationImportSuggestions: () => [], inspirationImportDevice: () => 'desktop', shelfLinkLabel: () => '',
    inspirationInterestLabel: id => id, INSPIRATION_INTEREST_LABELS: {},
    inspirationDraftFromSetupForm: form => clone(form), enrichInspirationVideoReferences: async draft => draft,
    shelfFormStatus: text => toasts.push(text), _inspirationDraftSaveTimer: null,
    _inspirationGeneration: 0, _inspirationSetupGeneration: 0, _inspirationPrepareWork: null, _inspirationMetadataWork: null,
    attentionPolicyForTarget: () => null, openAttentionSetup: () => events.push('attention:setup'),
    openAttentionEntry: () => events.push('attention:entry'), ttsSpeak: () => events.push('speech'),
    document: { querySelector() { events.push('dom:query'); return null; }, querySelectorAll: () => [] },
    validateSettingsPayload: value => !!value && typeof value === 'object' && !Array.isArray(value),
    validateTasksPayload: Array.isArray, reportCommitmentConflict: async () => {},
    pwaWriteAllowed: () => true, accountDataWriteAllowed: () => true, accountDataPayloadAllowed: () => true,
    settingsWriteAllowed: () => true, taskWriteAllowed: () => true,
    handleAccountSessionExpired: () => events.push('session:expired'),
    fetch: async (url, options = {}) => {
      if (!options.method) return new Response(JSON.stringify(server[url.endsWith('/tasks') ? 'tasks' : 'settings']));
      const payload = JSON.parse(options.body);
      requests.push({ url, payload });
      const mode = queue.shift();
      if (typeof mode === 'function') await mode();
      if (mode === 'network-fail') throw new Error('offline before write');
      if (mode === '503') return new Response('', { status: 503 });
      if (mode === '401') return new Response('', { status: 401 });
      if (mode === 'corrupt') return new Response(JSON.stringify({ error: 'commitment_data_corrupt' }), { status: 409 });
      if (mode === 'html') return new Response('<!doctype html><html>login</html>');
      if (mode === 'empty-json') return new Response('{}');
      if (url === '/api/inspiration/discovery') {
        return new Response(JSON.stringify({ providerAvailable: false, status: 'unconfigured', dayKey: DAY, candidates: [] }));
      }
      if (url === '/api/inspiration/profile') {
        const replay = isDeepStrictEqual(payload.profile, server.settings.inspiration);
        if (!replay && !isDeepStrictEqual(payload.base, Profile.normalize(server.settings.inspiration))) {
          return new Response(JSON.stringify({ error: 'inspiration_revision_conflict' }), { status: 409 });
        }
        server.settings.inspiration = clone(payload.profile);
        if (Object.hasOwn(payload, 'baseDraft')) delete server.settings.inspirationDraft;
        if (mode === 'lost-reply') throw new Error('server wrote, reply lost');
        return new Response(JSON.stringify({ ok: true, kind: 'inspiration-profile', version: 1, replay,
          snapshots: { settings: { exists: true, value: server.settings }, tasks: { exists: true, value: server.tasks } } }));
      }
      if (url === '/api/commitments/commit') {
        assert.ok(Commit.validateCommitPayload(payload), 'real paired validator must accept the sent candidate');
        if (!isDeepStrictEqual(payload.base.settings.value, server.settings)) {
          return new Response(JSON.stringify({ error: 'commitment_revision_conflict' }), { status: 409 });
        }
        server.settings = clone(payload.data.settings); server.tasks = clone(payload.data.tasks);
      } else {
        assert.equal(url, '/api/data/settings'); server.settings = clone(payload);
      }
      if (mode === 'lost-reply') throw new Error('server wrote, reply lost');
      return new Response('{}');
    },
  });
  const names = ['commitmentGraphProtected', 'commitmentWriteBase', 'commitmentWriteData', 'commitmentBoundaryInfo',
    'commitmentBoundaryCode', 'refreshCommitmentWriteBase', 'commitmentBoundaryRejected', 'rememberDedicatedCommitSlots',
    'inspirationProfileEngine', 'inspirationCatalogEngine', 'inspirationCatalog', 'inspirationSupply', 'inspirationSupplyCopy',
    'inspirationProfileState', 'inspirationYoutubeEmbed', 'inspirationFormatFromContent', 'shelfViewModel',
    'inspirationVisualCopy', 'inspirationProfileEqual', 'inspirationProfileReceipt', 'inspirationDailyReceipt',
    'inspirationJSON', 'enrichInspirationFinds', 'cancelInspirationWork', 'prepareInspirationDigest', 'inspirationPersonalMedia',
    'persistInspirationProfile', 'saveInspirationSetup', 'inspirationActionItem', 'markInspirationDone', 'recordInspirationFeedback',
    'inspirationEmbedAllowed', 'playInspirationEmbed', 'listenInspiration', 'shelfSourceTarget', 'openProtectedInspirationSource',
    'openShelfSource', 'openInspirationSource', 'openInspirationRights'];
  vm.runInContext(names.map(functionSource).join('\n') + '\n' + between('const Store = {', '// Dedicated multi-file endpoints')
    + '\n globalThis.Store = Store;', ctx);
  ctx.Store._persisted.settings = { exists: true, value: clone(State.settings) };
  ctx.Store._persisted.tasks = { exists: true, value: [] };
  return { ctx, State, server, queue, events, requests, toasts, sounds, renders, id: initial.digest.ids[0] };
}

for (const paired of [false, true]) {
  const path = paired ? 'paired settings/tasks' : 'plain settings';
  test(`${path}: failed feedback leaves settings unchanged, reason visible, then retries once`, async () => {
    const h = harness({ paired, modes: ['503'] }), before = clone(h.State.settings);
    await h.ctx.recordInspirationFeedback(h.id, 'not_for_me', 'Too intense <today>');
    assert.deepEqual(h.State.settings, before);
    assert.deepEqual(h.server.settings, before);
    assert.equal(h.State._inspirationFeedbackDraft.reason, 'Too intense <today>');
    assert.equal(h.State._shelfBusy, '');
    assert.equal(h.State._shelfError, Copy.copy('save_error', 'en'));
    assert.deepEqual(h.events, []); assert.deepEqual(h.sounds, []);
    const html = UI.render(h.ctx.shelfViewModel());
    assert.match(html, /role="alert"/);
    assert.match(html, /Too intense &lt;today&gt;/);
    await h.ctx.recordInspirationFeedback(h.id, 'not_for_me', h.State._inspirationFeedbackDraft.reason);
    assert.equal(h.State.settings.inspiration.feedback.length, 1);
    assert.equal(h.server.settings.inspiration.feedback.length, 1);
    assert.deepEqual(h.State.settings.inspiration.digest.ids, before.inspiration.digest.ids);
    assert.equal(h.State.settings.inspiration.digest.doneIds.filter(id => id === h.id).length, 1);
    assert.equal(h.State._inspirationFeedbackDraft, null);
    assert.deepEqual(h.events, ['inspiration:feedback:not_for_me']);
    assert.deepEqual(h.State.settings.unrelated, { keep: 1 });
  });
  test(`${path}: lost reply is uncertain, same action converges to one feedback and completion`, async () => {
    const h = harness({ paired, modes: ['lost-reply'] }), ids = clone(h.State.settings.inspiration.digest.ids);
    await h.ctx.recordInspirationFeedback(h.id, 'more', 'Useful rhythm');
    assert.equal(h.server.settings.inspiration.feedback.length, 1);
    assert.equal(h.State.settings.inspiration.feedback.length, 0);
    assert.deepEqual(h.events, []); assert.deepEqual(h.sounds, []);
    assert.ok(h.toasts.includes(Copy.copy('save_error', 'en')));
    await h.ctx.recordInspirationFeedback(h.id, 'more', h.State._inspirationFeedbackDraft.reason);
    assert.equal(h.server.settings.inspiration.feedback.length, 1);
    assert.equal(h.State.settings.inspiration.feedback.length, 1);
    assert.deepEqual(h.State.settings.inspiration.digest.ids, ids);
    assert.deepEqual(h.State.settings.inspiration.digest.doneIds, [h.id]);
    assert.equal(h.events.length, 1);
    // The dedicated owner accepts the exact target as an idempotent replay.
    assert.equal(h.requests.length, 2);
    h.State.settings = clone(h.server.settings); // Reload after confirmed retry.
    assert.equal(h.ctx.shelfViewModel().items.find(item => item.id === h.id).feedbackVerdict, 'more');
  });
  test(`${path}: Done has no optimistic success after failure and no duplicate done id after retry`, async () => {
    const h = harness({ paired, modes: ['network-fail'] });
    await h.ctx.markInspirationDone(h.id);
    assert.deepEqual(h.State.settings.inspiration.digest.doneIds, []);
    assert.deepEqual(h.events, []);
    await h.ctx.markInspirationDone(h.id);
    assert.deepEqual(h.State.settings.inspiration.digest.doneIds, [h.id]);
    assert.deepEqual(h.events, ['inspiration:done']);
    await h.ctx.markInspirationDone(h.id);
    assert.equal(h.requests.length, 2, 'repeated confirmed Done is a no-op');
    assert.deepEqual(h.events, ['inspiration:done']);
  });
  test(`${path}: double click during pending write sends one operation`, async () => {
    let release, entered;
    const pending = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const h = harness({ paired, modes: [() => { entered(); return pending; }] });
    const first = h.ctx.recordInspirationFeedback(h.id, 'more', 'Keep this reason');
    await started;
    await h.ctx.recordInspirationFeedback(h.id, 'not_for_me', 'Second click');
    await h.ctx.markInspirationDone(h.id);
    assert.equal(h.requests.length, 1);
    assert.equal(h.State._inspirationFeedbackDraft.reason, 'Keep this reason');
    assert.deepEqual(h.events, []);
    release(); await first;
    assert.equal(h.State.settings.inspiration.feedback[0].verdict, 'more');
    assert.equal(h.events.length, 1);
  });
  test(`${path}: account switch while response is pending cannot apply or clear the new account UI`, async () => {
    let release, entered;
    const pending = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const h = harness({ paired, modes: [() => { entered(); return pending; }] });
    const action = h.ctx.recordInspirationFeedback(h.id, 'more', 'Old account');
    await started;
    h.ctx.Store.cancelPending(); h.State.me = { id: 'owner-b' };
    h.State.settings = { anotherAccount: true }; h.State._shelfBusy = 'new-account-operation';
    h.State._inspirationFeedbackDraft = { itemId: 'new', verdict: 'more', reason: 'New account' };
    release(); await action;
    assert.deepEqual(h.State.settings, { anotherAccount: true });
    assert.equal(h.State._shelfBusy, 'new-account-operation');
    assert.equal(h.State._inspirationFeedbackDraft.reason, 'New account');
    assert.deepEqual(h.events, []); assert.deepEqual(h.sounds, []);
  });
}
test('confirmed server refusal is visible and never becomes success', async () => {
  const h = harness({ paired: true, modes: ['corrupt'] });
  await h.ctx.markInspirationDone(h.id);
  assert.deepEqual(h.State.settings.inspiration.digest.doneIds, []);
  assert.equal(h.State._shelfError, Copy.copy('save_error', 'en'));
  assert.deepEqual(h.events, []);
});
test('failed setup retains its draft and setup surface until successful retry', async () => {
  const h = harness({ paired: true, modes: ['503'] });
  const draft = { ...profile(), videoReferences: [] };
  h.State._inspirationSetupOpen = true; h.State._inspirationDraft = clone(draft);
  await h.ctx.saveInspirationSetup(draft);
  assert.equal(h.State._inspirationSetupOpen, true);
  assert.ok(h.State._inspirationDraft);
  assert.match(UI.render(h.ctx.shelfViewModel()), /role="alert"/);
  assert.deepEqual(h.events, []);
  await h.ctx.saveInspirationSetup(draft);
  assert.equal(h.State._inspirationSetupOpen, false);
  assert.equal(h.State._inspirationDraft, null);
  assert.deepEqual(h.events, ['inspiration:configured']);
});
test('reference enrichment finishing after account switch cannot save the old setup', async () => {
  const h = harness(); let release;
  h.ctx.enrichInspirationVideoReferences = draft => new Promise(resolve => { release = () => resolve(draft); });
  const action = h.ctx.saveInspirationSetup({ ...profile(), videoReferences: [{ url: 'https://example.invalid/video' }] });
  h.ctx.Store.cancelPending(); h.State.me = { id: 'owner-b' };
  release(); await action;
  assert.equal(h.requests.length, 0); assert.deepEqual(h.events, []);
});
test('missing supply engine produces a load error, never an empty profile write', async () => {
  const h = harness(); delete h.ctx.window.InspirationSupplyRuntimeV1;
  assert.equal(h.ctx.shelfViewModel().state, 'error');
  await h.ctx.saveInspirationSetup({ ...profile(), videoReferences: [] });
  assert.equal(h.requests.length, 0); assert.deepEqual(h.events, []);
  assert.ok(h.toasts.includes(Copy.copy('module_error', 'en')));
});
test('an admitted item outside the fixed digest cannot produce a false Done receipt', async () => {
  const h = harness();
  const other = h.ctx.inspirationCatalog().find(item => !h.State.settings.inspiration.digest.ids.includes(item.id));
  assert.ok(other);
  await h.ctx.markInspirationDone(other.id);
  assert.equal(h.requests.length, 0); assert.deepEqual(h.events, []);
});
test('saved denied catalogId preserves personal content but cannot restore external playback or source', () => {
  const h = harness();
  const saved = { id: 'saved-trailer', catalogId: 'spiderverse-official-trailer', title: 'My memory',
    note: 'A personal <note>', why: 'Keep this', kind: 'energy', format: 'edit', addedOn: DAY,
    url: 'https://www.youtube.com/watch?v=g4Hbz2jLxvQ', embedUrl: 'https://www.youtube-nocookie.com/embed/g4Hbz2jLxvQ' };
  h.State.shelf.items.push(saved); h.State._inspirationSection = 'saved';
  const view = h.ctx.shelfViewModel(), entry = view.saved[0];
  assert.equal(entry.supplyUnavailable, true); assert.equal(entry.embedUrl, '');
  const html = UI.render(view);
  assert.match(html, /My memory/); assert.match(html, /A personal &lt;note&gt;/);
  assert.match(html, /data-action="shelf-archive"/);
  assert.doesNotMatch(html, /data-action="(?:inspiration-play|shelf-open-source)|<iframe|<img/);
  h.ctx.playInspirationEmbed(saved.id); h.ctx.openShelfSource(saved.id);
  h.ctx.openInspirationSource(saved.id); h.ctx.openInspirationRights(saved.id); h.ctx.listenInspiration(saved.id);
  assert.deepEqual(h.events, []);
  assert.equal(h.State._shelfPendingSource, undefined);
  assert.equal(h.State.shelf.items[0], saved, 'read-only resolution must not rewrite the saved entry');
});
test('approved saved source resolves the current manifest URL; rights navigation keeps its selected target', () => {
  const h = harness();
  const source = { id: 'approved', title: 'Approved material', sourceUrl: 'https://source.invalid/current',
    rightsUrl: 'https://source.invalid/rights', mediaPolicy: 'link' };
  h.ctx.window.InspirationSupplyRuntimeV1 = { ...Supply, ensureDigest: () => ({ ok: true, catalog: [source] }) };
  h.State.shelf.items.push({ id: 'saved-approved', catalogId: 'approved', url: 'https://old.invalid/stale', note: 'Keep', title: 'Saved' });
  h.ctx.openShelfSource('saved-approved');
  assert.equal(h.State._shelfPendingSource.url, source.sourceUrl);
  h.ctx.openInspirationRights('saved-approved');
  assert.equal(h.State._shelfPendingSource.url, source.rightsUrl);
  assert.equal(h.ctx.inspirationActionItem('saved-approved').note, 'Keep');
});
test('an independently saved personal URL still uses the existing attention decision', () => {
  const h = harness();
  h.State.shelf.items.push({ id: 'personal', title: 'My own link', url: 'https://www.youtube.com/watch?v=g4Hbz2jLxvQ' });
  assert.match(h.ctx.inspirationActionItem('personal').embedUrl, /youtube-nocookie/);
  h.ctx.openShelfSource('personal');
  assert.deepEqual(h.events, ['attention:setup']);
  assert.equal(h.State._shelfPendingSource.id, 'personal');
});
test('all five locales distinguish missing language, empty supply, pending review, and save failure', () => {
  for (const locale of Copy.LOCALES) {
    assert.equal(new Set(Object.values(Copy.COPY[locale])).size, Object.keys(Copy.COPY[locale]).length);
    for (const key of ['language_gap', 'no_matching_material', 'supply_unverified', 'temporarily_exhausted', 'profile_filters']) {
      const html = UI.render({ profile: profile(), items: [], supplyLocale: locale, supplyReport: { status: 'empty', emptyReason: key } });
      assert.ok(html.includes(Copy.copy(key, locale)), `${locale}:${key}`);
      assert.match(html, /role="status"/); assert.doesNotMatch(html, /inspiration-play|<iframe/);
    }
    assert.ok(Object.values(Copy.COPY[locale]).every(value => typeof value === 'string' && value.length > 10));
  }
});
test('fixed denied entries and shortage have visible notices without replacement or false completion', () => {
  const h = harness();
  h.State.settings.inspiration.digest = { day: DAY, ids: ['spiderverse-official-trailer', h.id], doneIds: [] };
  h.State.settings.inspiration = Profile.recordShown(h.State.settings.inspiration, DAY);
  const view = h.ctx.shelfViewModel();
  assert.deepEqual(clone(view.unavailableIds), ['spiderverse-official-trailer']);
  assert.deepEqual(view.items.map(item => item.id), [h.id]);
  const html = UI.render(view);
  assert.ok(html.includes(Copy.copy('fixed_unavailable', 'en')));
  assert.doesNotMatch(html, /inspiration-terminal/);
  assert.deepEqual(h.State.settings.inspiration.digest.ids, ['spiderverse-official-trailer', h.id]);
});
test('pending write disables profile mutation controls but retains feedback input', () => {
  const h = harness(); h.State._shelfBusy = 'profile';
  h.State._inspirationFeedbackDraft = { itemId: h.id, verdict: 'more', reason: 'Pending reason' };
  const html = UI.render(h.ctx.shelfViewModel());
  for (const action of ['inspiration-done', 'inspiration-save', 'inspiration-feedback-open', 'inspiration-feedback-save', 'inspiration-feedback-skip']) {
    assert.match(html, new RegExp(`<button[^>]*data-action="${action}"[^>]*disabled`), action);
  }
  assert.match(html, /Pending reason/);
});
test('index loads supply dependencies before the renderer and SW caches the complete chain', () => {
  const index = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  const sw = fs.readFileSync(require.resolve('../public/sw.js'), 'utf8');
  const chain = ['inspiration-profile-v1.js', 'inspiration-catalog-v1.js', 'inspiration-supply-policy-v1.js',
    'inspiration-supply-batch-v1.js', 'inspiration-supply-runtime-v1.js', 'inspiration-supply-ui-v1.js', 'return-shelf-ui-v1.js'];
  let previous = -1;
  for (const script of chain) {
    const at = index.indexOf(script); assert.ok(at > previous, script); previous = at;
    assert.ok(sw.includes(`'${script}'`), script);
  }
  const section = between('function inspirationCatalog()', 'async function completeShelfItem(');
  assert.doesNotMatch(section, /P\.ensureDigest\(/);
  assert.match(section, /now: new Date\(\)\.toISOString\(\)/);
});

function newDay(h, { discoveryEnabled = false, empty = false } = {}) {
  h.State.settings.inspiration = Profile.configure({ ...profile(), discoveryEnabled,
    ...(empty ? { formats: ['podcast'] } : {}) });
  h.server.settings = clone(h.State.settings);
}
test('new day stays hidden until the owner confirms shown history; render performs no fetch', async () => {
  const h = harness(); newDay(h);
  const before = clone(h.State.settings), view = h.ctx.shelfViewModel();
  assert.equal(view.digestPending, 'loading'); assert.deepEqual(clone(view.items), []);
  assert.deepEqual(h.State.settings, before); assert.equal(h.requests.length, 0);
  await h.ctx.prepareInspirationDigest();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].url, '/api/inspiration/profile');
  assert.deepEqual(h.requests[0].payload.finds, []);
  assert.equal(h.ctx.inspirationDailyReceipt(), true);
  assert.ok(h.State.settings.inspiration.shownHistory.length);
  assert.ok(h.ctx.shelfViewModel().items.length); assert.equal(h.ctx.shelfViewModel().digestPending, '');
  await h.ctx.prepareInspirationDigest(); assert.equal(h.requests.length, 1);
});
test('empty day is a durable receipt and never loops/refills', async () => {
  const h = harness(); newDay(h, { empty: true });
  await h.ctx.prepareInspirationDigest();
  assert.deepEqual(clone(h.State.settings.inspiration.digest), { day: DAY, ids: [], doneIds: [] });
  assert.equal(h.ctx.inspirationDailyReceipt(), true);
  await h.ctx.prepareInspirationDigest(); await h.ctx.prepareInspirationDigest({ retry: true });
  assert.equal(h.requests.length, 1); assert.equal(h.ctx.shelfViewModel().digestPending, '');
});
test('explicit discovery opt-in sends only day and unconfigured provider has honest finite fallback', async () => {
  const h = harness(); newDay(h, { discoveryEnabled: true });
  await h.ctx.prepareInspirationDigest();
  assert.deepEqual(h.requests.map(row => row.url), ['/api/inspiration/discovery', '/api/inspiration/profile']);
  assert.deepEqual(h.requests[0].payload, { dayKey: DAY });
  assert.equal(h.State._inspirationDiscoveryAvailable, false);
  assert.equal(h.State._inspirationDiscoveryStatus, 'unconfigured');
  await h.ctx.prepareInspirationDigest(); assert.equal(h.requests.length, 2);
});
test('configured provider error hides new deck and requires explicit retry', async () => {
  const h = harness(); newDay(h, { discoveryEnabled: true });
  const original = h.ctx.fetch;
  h.ctx.fetch = async (url, options) => url === '/api/inspiration/discovery'
    ? new Response(JSON.stringify({ providerAvailable: true, status: 'provider_rate_limited', dayKey: DAY, candidates: [] }))
    : original(url, options);
  await h.ctx.prepareInspirationDigest();
  assert.equal(h.ctx._inspirationPrepareWork, null);
  assert.equal(h.State._inspirationDigestPending, 'error'); assert.equal(h.State.settings.inspiration.digest, null);
  assert.deepEqual(clone(h.ctx.shelfViewModel().items), []); assert.equal(h.requests.length, 0);
  h.ctx.fetch = original;
  await h.ctx.prepareInspirationDigest(); assert.equal(h.requests.length, 0);
  await h.ctx.prepareInspirationDigest({ retry: true }); assert.equal(h.ctx.inspirationDailyReceipt(), true);
});
test('daily lost reply retains exact candidate and retry does not search or refill', async () => {
  const h = harness({ modes: [undefined, 'lost-reply'] }); newDay(h, { discoveryEnabled: true });
  await h.ctx.prepareInspirationDigest();
  assert.equal(h.State.settings.inspiration.digest, null); assert.equal(h.State._inspirationDigestPending, 'error');
  const proposed = clone(h.requests[1].payload);
  await h.ctx.prepareInspirationDigest({ retry: true });
  assert.equal(h.requests.length, 3); assert.deepEqual(h.requests[2].payload, proposed);
  assert.equal(h.ctx.inspirationDailyReceipt(), true); assert.equal(h.State._inspirationDailyAttempt, null);
});
for (const bad of ['html', 'empty-json']) test(`${bad} HTTP 200 cannot confirm profile or update Store snapshots`, async () => {
  const h = harness({ modes: [bad] }); const before = clone(h.State.settings), snapshots = clone(h.ctx.Store._persisted);
  await h.ctx.recordInspirationFeedback(h.id, 'more', 'Keep my reason');
  assert.deepEqual(h.State.settings, before); assert.deepEqual(clone(h.ctx.Store._persisted), snapshots);
  assert.equal(h.State._inspirationFeedbackDraft.reason, 'Keep my reason'); assert.deepEqual(h.events, []);
});
test('wrong profile and malformed tasks receipt cannot cross the durable boundary', async () => {
  for (const kind of ['profile', 'tasks', 'kind', 'version', 'replay', 'exists']) {
    const h = harness(), before = clone(h.State.settings), snapshots = clone(h.ctx.Store._persisted), original = h.ctx.fetch;
    h.ctx.fetch = async (...args) => {
      const response = await original(...args), data = await response.json();
      if (kind === 'profile') data.snapshots.settings.value.inspiration.visualTaste = 'not this request';
      if (kind === 'tasks') data.snapshots.tasks.value = {};
      if (kind === 'kind') data.kind = 'generic';
      if (kind === 'version') data.version = 2;
      if (kind === 'replay') delete data.replay;
      if (kind === 'exists') data.snapshots.tasks.exists = 'true';
      return new Response(JSON.stringify(data));
    };
    await h.ctx.markInspirationDone(h.id);
    assert.deepEqual(h.State.settings, before, kind); assert.deepEqual(clone(h.ctx.Store._persisted), snapshots, kind);
    assert.deepEqual(h.events, [], kind);
  }
});
for (const change of ['account', 'epoch', 'navigation', 'taste', 'optout']) test(`late discovery after ${change} cannot save, reveal, or retain the preparing lock`, async () => {
  let release, entered;
  const pending = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  const h = harness({ modes: [() => { entered(); return pending; }] }); newDay(h, { discoveryEnabled: true });
  const task = h.ctx.prepareInspirationDigest(); await started;
  if (change === 'account') h.State.me = { id: 'other' };
  if (change === 'epoch') h.ctx.Store._writeEpoch++;
  if (change === 'navigation') { h.State.view = 'today'; h.ctx.cancelInspirationWork(); }
  if (change === 'taste') h.State.settings.inspiration.visualTaste = 'Newer taste';
  if (change === 'optout') h.State.settings.inspiration.discoveryEnabled = false;
  release(); await task;
  assert.equal(h.requests.length, 1); assert.equal(h.State.settings.inspiration.digest, null);
  assert.equal(h.ctx._inspirationPrepareWork, null); assert.notEqual(h.State._inspirationDigestPending, 'loading');
});
test('queued stale taste is rejected inside the Store lock before sending', async () => {
  const h = harness(); let release;
  h.ctx.Store._writes.settings = new Promise(resolve => { release = resolve; });
  const pending = h.ctx.markInspirationDone(h.id);
  h.State.settings.inspiration.visualTaste = 'A newer choice';
  release(); await pending;
  assert.equal(h.requests.length, 0); assert.deepEqual(h.events, []);
  assert.equal(h.State.settings.inspiration.visualTaste, 'A newer choice');
});
test('current personal Pinterest and TikTok URLs use validated provider embeds, denied catalog entries remain denied', () => {
  const h = harness();
  h.State.shelf.items.push({ id: 'pin', url: 'https://www.pinterest.com/pin/974818281863152085/' },
    { id: 'edit', url: 'https://www.tiktok.com/@example/video/7647936071673629973' });
  assert.equal(h.ctx.inspirationFormatFromContent(h.State.shelf.items[0].url), 'image');
  assert.match(h.ctx.inspirationActionItem('pin').embedUrl, /assets.pinterest.com/);
  assert.match(h.ctx.inspirationActionItem('edit').embedUrl, /autoplay=0/);
  assert.equal(h.ctx.inspirationEmbedAllowed(Media.buildEmbed(h.State.shelf.items[1].url), h.State.shelf.items[0].url), false);
});
test('setup reads explicit visual taste, opt-in and title while preserving metadata only for the unchanged URL', () => {
  const h = harness(), url = 'https://www.pinterest.com/pin/974818281863152085/';
  h.State._inspirationDraft = Profile.normalize({ ...profile(), videoReferences: [{ url, title: 'Old title', why: 'Old why',
    imageUrl: 'https://i.pinimg.com/564x/b3/6e/78/b36e78c729e4291048afa0720c13428e.jpg', mediaFormat: 'image', authorName: 'A pinner' }] });
  vm.runInContext(functionSource('inspirationDraftFromSetupForm'), h.ctx);
  h.ctx.inspirationSemanticIds = value => value ? ['creative'] : [];
  let referenceUrl = url;
  const row = { querySelector: selector => ({ value: selector.includes('referenceUrl') ? referenceUrl : selector.includes('referenceTitle') ? 'My title' : 'Soft light' }) };
  const form = { elements: { visualTaste: { value: 'Quiet greens and soft light' }, discoveryEnabled: { checked: true } },
    querySelectorAll: selector => selector.includes('interest') ? [{ value: 'creative', dataset: {} }] : selector.includes('format') ? [{ value: 'image' }] : [row] };
  let draft = h.ctx.inspirationDraftFromSetupForm(form);
  assert.equal(draft.visualTaste, 'Quiet greens and soft light'); assert.equal(draft.discoveryEnabled, true);
  assert.equal(draft.videoReferences[0].title, 'My title'); assert.equal(draft.videoReferences[0].authorName, 'A pinner');
  referenceUrl = 'https://www.pinterest.com/pin/974818281863152086/';
  draft = h.ctx.inspirationDraftFromSetupForm(form); assert.equal(!!draft.videoReferences[0].imageUrl, false);
  form.elements.discoveryEnabled.checked = false; assert.equal(h.ctx.inspirationDraftFromSetupForm(form).discoveryEnabled, false);
});
test('reference metadata requests are bounded to two concurrent requests and stop between chunks after cancellation', async () => {
  const h = harness(); vm.runInContext(functionSource('enrichInspirationVideoReferences'), h.ctx);
  h.ctx.inspirationSemanticIds = () => ['creative'];
  const references = Array.from({ length: 10 }, (_, i) => ({ url: `https://www.pinterest.com/pin/97481828186315208${i}/`, title: `Mine ${i}`, why: 'Soft light' }));
  let inFlight = 0, maximum = 0, calls = 0, active = true;
  const controller = new AbortController();
  h.ctx.fetch = async (_url, options) => {
    inFlight++; calls++; maximum = Math.max(maximum, inFlight);
    await new Promise(resolve => setImmediate(resolve));
    inFlight--;
    if (calls === 2) active = false;
    return new Response(JSON.stringify({ status: 'resolved', source: Media.parseSource(JSON.parse(options.body).url), title: 'Provider title' }));
  };
  const result = await h.ctx.enrichInspirationVideoReferences({ videoReferences: references }, { signal: controller.signal, active: () => active });
  assert.equal(result, null); assert.equal(calls, 2); assert.equal(maximum, 2);
});
test('metadata keeps personal reference title and unknown Pinterest media may supply a safe preview', async () => {
  const h = harness(); vm.runInContext(functionSource('enrichInspirationVideoReferences'), h.ctx);
  h.ctx.inspirationSemanticIds = () => ['creative'];
  const url = 'https://www.pinterest.com/pin/974818281863152085/';
  const thumbnailUrl = 'https://i.pinimg.com/564x/b3/6e/78/b36e78c729e4291048afa0720c13428e.jpg';
  h.ctx.fetch = async () => new Response(JSON.stringify({ status: 'resolved', source: Media.parseSource(url), title: 'Provider title',
    thumbnailUrl, mediaType: 'unknown', authorName: 'Pinner', checkedAt: NOW }));
  const result = await h.ctx.enrichInspirationVideoReferences({ ...profile(), videoReferences: [{ url, title: 'My words', why: 'Soft light' }] });
  assert.equal(result.videoReferences[0].title, 'My words'); assert.equal(result.videoReferences[0].imageUrl, thumbnailUrl);
  assert.equal(result.videoReferences[0].authorName, 'Pinner'); assert.notEqual(result.videoReferences[0].mediaFormat, 'image');
});
test('fresh edit metadata supplies a safe poster while preserving search title and query keywords', async () => {
  const h = harness(), sourceUrl = 'https://www.tiktok.com/@example/video/7647936071673629973';
  const imageUrl = 'https://p16.muscdn.com/obj/tos-maliva-p-0068/abcdefghi';
  h.ctx.fetch = async () => new Response(JSON.stringify({ status: 'resolved', source: Media.parseSource(sourceUrl), title: 'Provider title',
    thumbnailUrl: imageUrl, thumbnailWidth: 640, thumbnailHeight: 960, authorName: 'Poster', attributionKind: 'poster', mediaType: 'video' }));
  const candidate = { title: { en: 'Search title' }, keywords: ['gentle', 'rhythm'], delivery: { sourceUrl } };
  const result = await h.ctx.enrichInspirationFinds([candidate], { signal: new AbortController().signal, active: () => true });
  assert.deepEqual(result[0].title, candidate.title); assert.deepEqual(result[0].keywords, candidate.keywords);
  assert.equal(result[0].imageUrl, imageUrl); assert.equal(result[0].imageWidth, 640); assert.equal(result[0].authorName, 'Poster');
  assert.equal(result[0].playbackVerified, undefined);
});
test('stored normalized findings reconstruct delivery URLs and combine with visual candidates without mutation', () => {
  const h = harness(), sourceUrl = 'https://www.tiktok.com/@example/video/7647936071673629973';
  const find = { id: 'find', delivery: { policy: 'embed' }, sourceUrl, embedUrl: Media.buildEmbed(sourceUrl) };
  h.State.settings.inspirationFinds = [find]; h.ctx.window.InspirationVisualBatchV1 = { CANDIDATES: [{ id: 'visual' }] };
  let options;
  h.ctx.window.InspirationSupplyRuntimeV1 = { ...Supply, ensureDigest: input => { options = input; return { ok: true }; } };
  h.ctx.inspirationSupply();
  const raw = options.candidates.find(item => item.id === 'find');
  assert.equal(raw.delivery.sourceUrl, sourceUrl); assert.equal(raw.delivery.embedUrl, find.embedUrl);
  assert.equal(options.ctx.maxSharePerSource, 1); assert.ok(options.candidates.some(item => item.id === 'visual'));
  assert.deepEqual(find.delivery, { policy: 'embed' });
});
test('insufficient discovery taste gets a truthful catalog fallback rather than an endless retry error', async () => {
  const h = harness(); newDay(h, { discoveryEnabled: true }); const original = h.ctx.fetch;
  h.ctx.fetch = async (url, options) => url === '/api/inspiration/discovery'
    ? new Response(JSON.stringify({ providerAvailable: true, status: 'needs_taste', dayKey: DAY, candidates: [] })) : original(url, options);
  await h.ctx.prepareInspirationDigest();
  assert.equal(h.State._inspirationDiscoveryStatus, 'needs_taste'); assert.equal(h.State._inspirationDigestPending, '');
  assert.equal(h.ctx.inspirationDailyReceipt(), true);
});
for (const change of ['taste', 'optout', 'shown']) test(`setup enrichment cannot overwrite newer persisted ${change}`, async () => {
  const h = harness(); let release;
  h.State.settings.inspiration.discoveryEnabled = true;
  h.ctx.enrichInspirationVideoReferences = draft => new Promise(resolve => { release = () => resolve(draft); });
  const draft = { ...profile(), discoveryEnabled: true, videoReferences: [{ url: 'https://www.pinterest.com/pin/974818281863152085/' }] };
  h.State._inspirationSetupOpen = true;
  const action = h.ctx.saveInspirationSetup(draft);
  if (change === 'taste') h.State.settings.inspiration.visualTaste = 'Newer style';
  if (change === 'optout') h.State.settings.inspiration.discoveryEnabled = false;
  if (change === 'shown') h.State.settings.inspiration.shownHistory.push({ id: 'new-receipt', day: DAY });
  const current = clone(h.State.settings);
  release(); await action;
  assert.equal(h.requests.length, 0); assert.deepEqual(h.State.settings, current); assert.deepEqual(h.events, []);
  assert.equal(h.State._inspirationSetupResolving, false); assert.ok(h.State._inspirationDraft);
});
test('setup lost response retries the exact enriched profile without refreshing metadataAt', async () => {
  const h = harness({ modes: ['lost-reply'] }); let resolutions = 0;
  h.ctx.enrichInspirationVideoReferences = async draft => {
    resolutions++;
    return Profile.normalize({ ...draft, videoReferences: draft.videoReferences.map(reference => ({ ...reference,
      title: 'Official caption', metadataAt: `2026-09-11T12:00:0${resolutions}.000Z` })) });
  };
  const draft = { ...profile(), videoReferences: [{ url: 'https://www.pinterest.com/pin/974818281863152085/' }] };
  h.State._inspirationSetupOpen = true;
  await h.ctx.saveInspirationSetup(draft);
  assert.equal(h.State._inspirationSetupOpen, true); assert.equal(resolutions, 1); assert.equal(h.events.length, 0);
  const sent = clone(h.requests[0].payload);
  await h.ctx.saveInspirationSetup(draft);
  assert.equal(resolutions, 1); assert.deepEqual(h.requests[1].payload, sent);
  assert.equal(h.State._inspirationSetupOpen, false); assert.equal(h.State._inspirationSetupResolving, false);
  assert.equal(h.State._inspirationSetupAttempt, null); assert.deepEqual(h.events, ['inspiration:configured']);
});
