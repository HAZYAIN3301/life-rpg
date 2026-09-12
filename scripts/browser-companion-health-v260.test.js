'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Health = require('../extensions/satoru-attention/health.js');
const Core = require('../extensions/satoru-attention/core.js');
const Status = require('../public/browser-companion-status-v1.js');
const EXT = path.resolve(__dirname, '../extensions/satoru-attention');
const ORIGIN = Core.SATORU_ORIGIN;
const rootUrl = 'chrome-extension://test-extension/';
const policy = () => Core.cleanPolicy({ id: 'test-site', hostname: 'example.test', label: 'Test site', purposes: [{ purpose: 'watch', defaultMinutes: 1, mode: 'control' }] });
function harness(stored = {}) {
  let listener;
  let rules = [];
  let scripts = [];
  let permission = true;
  let failRead = false;
  let failWrite = false;
  const tabs = [];
  const event = () => ({ addListener() {} });
  const chrome = {
    runtime: { id: 'test-extension', getURL: value => rootUrl + value, openOptionsPage: async () => {}, onStartup: event(), onInstalled: event(), onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { get: async key => ({ [key]: structuredClone(stored[key]) }), set: async values => { if (failWrite) throw new Error('storage'); Object.assign(stored, structuredClone(values)); } } },
    permissions: { contains: async () => { if (failRead) throw new Error('permission'); return permission; }, onAdded: event(), onRemoved: event() },
    declarativeNetRequest: { getDynamicRules: async () => structuredClone(rules), updateDynamicRules: async input => { rules = input.addRules; } },
    scripting: { getRegisteredContentScripts: async () => structuredClone(scripts), unregisterContentScripts: async () => { scripts = []; }, registerContentScripts: async next => { scripts = next; } },
    alarms: { create: async () => {}, clear: async () => {}, onAlarm: event() },
    tabs: { create: async input => { const tab = { id: tabs.length + 1, ...input }; tabs.push(tab); return tab; }, query: async () => [], update: async (id, input) => { Object.assign(tabs.find(tab => tab.id === id), input); }, remove: async id => { const index = tabs.findIndex(tab => tab.id === id); if (index >= 0) tabs.splice(index, 1); } },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
  };
  const context = vm.createContext({ chrome, URL, Date, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto });
  context.self = context;
  context.importScripts = (...names) => names.forEach(name => vm.runInContext(fs.readFileSync(path.join(EXT, name), 'utf8'), context));
  vm.runInContext(fs.readFileSync(path.join(EXT, 'service-worker.js'), 'utf8'), context);
  const send = (message, sender = { id: chrome.runtime.id, url: rootUrl + 'options.html' }) => new Promise(resolve => listener(message, sender, result => resolve(JSON.parse(JSON.stringify(result)))));
  return { stored, tabs, send, context, ready: () => vm.runInContext('reconcileEnforcement(loadStatePlaceholder)', Object.assign(context, { loadStatePlaceholder: Core.normalizeState(stored.satoruAttentionStateV1) })), setPermission: value => { permission = value; }, failRead: () => { failRead = true; }, failWrite: value => { failWrite = value; }, clearRules: () => { rules = []; } };
}
const seeded = () => ({ satoruAttentionStateV1: { ...Core.emptyState(), policies: [policy()] } });

test('health reads actual browser state and distinguishes missing permission, drift and API failure', async () => {
  const h = harness(seeded()); await h.ready();
  const read = async () => (await h.send({ type: 'GET_HEALTH' })).status;
  assert.equal((await read()).enforcement.state, 'active');
  h.clearRules(); assert.equal((await read()).enforcement.state, 'unknown');
  h.setPermission(false); assert.equal((await read()).enforcement.state, 'permission_removed');
  h.failRead(); assert.equal((await read()).enforcement.state, 'unknown');
});
test('no policies and no protection means not configured', async () => {
  const h = harness(); await h.ready();
  assert.equal((await h.send({ type: 'GET_HEALTH' })).status.enforcement.state, 'not_configured');
});
test('native-navigation test needs a response from the exact new boundary tab before success', async () => {
  const h = harness(seeded()); await h.ready();
  assert.equal((await h.send({ type: 'START_BOUNDARY_TEST', policyId: 'test-site' })).ok, true);
  assert.equal(h.tabs[0].url, 'https://example.test/');
  assert.equal(h.stored.satoruBoundaryTestV1.state, 'pending');
  await h.send({ type: 'START_BOUNDARY_TEST' }); assert.equal(h.tabs.length, 1, 'repeat while pending does not open another tab');
  const gate = { id: 'test-extension', frameId: 0, tab: { id: 1, url: rootUrl + 'gate.html?site=test-site' } };
  assert.equal((await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, { ...gate, frameId: 1 })).confirmed, false, 'embedding the boundary in a site frame is not a successful navigation');
  assert.equal((await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, { ...gate, tab: { ...gate.tab, id: 999 } })).confirmed, false);
  assert.equal((await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, { id: 'test-extension', tab: { id: 1, url: rootUrl + 'options.html' } })).confirmed, false);
  assert.equal((await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, gate)).confirmed, true, 'Brave sender.tab.url accepted');
  assert.equal(h.stored.satoruBoundaryTestV1.state, 'passed');
  assert.equal((await h.send({ type: 'GET_HEALTH' })).status.selfTest.state, 'passed');
});
test('pending test survives worker replacement; timeout, changed rules and revoked access never become success', async () => {
  const h = harness(seeded()); await h.ready(); await h.send({ type: 'START_BOUNDARY_TEST' });
  const restarted = harness(h.stored); await restarted.ready();
  assert.equal((await restarted.send({ type: 'GET_HEALTH' })).status.selfTest.state, 'pending');
  h.stored.satoruBoundaryTestV1.startedAt = new Date(Date.now() - 61000).toISOString();
  assert.equal((await restarted.send({ type: 'GET_HEALTH' })).status.selfTest.state, 'failed');
  h.stored.satoruAttentionStateV1.policies[0].dailyBudgetMinutes = 30;
  assert.equal((await restarted.send({ type: 'GET_HEALTH' })).status.selfTest.state, 'outdated');
  restarted.setPermission(false);
  assert.equal((await restarted.send({ type: 'START_BOUNDARY_TEST' })).error, 'permission_required');
});
test('bridge remains read-only and exports no host, policy, tab, fingerprint or history', async () => {
  const h = harness(seeded()); await h.ready(); await h.send({ type: 'START_BOUNDARY_TEST' });
  const bridge = { id: 'test-extension', url: ORIGIN + '/browser-companion.html', tab: { id: 50 } };
  assert.equal((await h.send({ type: 'START_BOUNDARY_TEST' }, bridge)).error, 'bridge_message_denied');
  assert.equal((await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, bridge)).error, 'bridge_message_denied');
  const result = await h.send({ type: 'BRIDGE_STATUS' }, bridge);
  assert.ok(result.status.checkedAt);
  assert.doesNotMatch(JSON.stringify(result), /example\.test|policyId|fingerprint|tabId|hostname|episodes/);
});
test('an active time window is not silently changed for testing', async () => {
  const state = seeded();
  const started = Core.startSession(state.satoruAttentionStateV1, { id: 'session_test', policyId: 'test-site', purpose: 'watch', minutes: 1, expectedOutcome: 'test' }, new Date().toISOString());
  assert.equal(started.ok, true);
  state.satoruAttentionStateV1 = started.state;
  const h = harness(state); await h.ready();
  assert.equal((await h.send({ type: 'START_BOUNDARY_TEST' })).error, 'test_window_active');
  assert.equal(h.tabs.length, 0);
});
test('storage failure cannot produce a successful boundary receipt', async () => {
  const h = harness(seeded()); await h.ready(); await h.send({ type: 'START_BOUNDARY_TEST' }); h.failWrite(true);
  const result = await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, { id: 'test-extension', frameId: 0, tab: { id: 1, url: rootUrl + 'gate.html?site=test-site' } });
  assert.equal(result.ok, false); assert.equal(h.stored.satoruBoundaryTestV1.state, 'pending');
});
test('storage failure before navigation closes only the newly created blank test tab', async () => {
  const h = harness(seeded()); await h.ready(); h.failWrite(true);
  assert.equal((await h.send({ type: 'START_BOUNDARY_TEST' })).error, 'test_failed');
  assert.equal(h.tabs.length, 0);
  assert.equal(h.stored.satoruBoundaryTestV1, undefined);
});
test('protection redirect requires the matching top-level block page receipt', async () => {
  const stored = seeded(); stored.satoruProtectionStateV1 = { enabled: true, denylist: ['example.test'] };
  const h = harness(stored); await h.ready();
  assert.equal((await h.send({ type: 'START_BOUNDARY_TEST' })).ok, true);
  const sender = { id: 'test-extension', frameId: 0, tab: { id: 1, url: rootUrl + 'block.html' } };
  assert.equal((await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, { ...sender, tab: { id: 1, url: rootUrl + 'gate.html?site=test-site' } })).confirmed, false);
  assert.equal((await h.send({ type: 'CONFIRM_BOUNDARY_TEST' }, sender)).confirmed, true);
});
test('app health copy covers all five languages and both status lifecycles', () => {
  for (const language of ['ru', 'en', 'de', 'uk', 'es']) for (const key of ['title', 'active', 'permission_removed', 'not_configured', 'unknown', 'never', 'pending', 'passed', 'failed', 'outdated', 'freshness', 'stale', 'privacy', 'installedTestCopy', 'refresh', 'setup']) {
    const copy = Status.text(key, language, { seconds: 12 });
    assert.notEqual(copy, key); assert.doesNotMatch(copy, /\{seconds\}/);
  }
});
test('public status normalization bounds data and signal freshness including old extension versions', () => {
  const now = Date.now();
  const raw = { installed: true, version: '0.6.0', checkedAt: new Date(now).toISOString(), configuredSites: 999, hostname: 'private.test', enforcement: { state: 'active', enabledSites: 1, permittedSites: 1 }, selfTest: { state: 'passed', checkedAt: new Date(now).toISOString() } };
  assert.equal(Status.normalize(raw).configuredSites, 0);
  assert.equal(Status.normalize(raw).hostname, undefined);
  assert.equal(Status.view(raw, now, now).state, 'active');
  assert.equal(Status.view(raw, now, now + 90001).state, 'unknown');
  assert.equal(Status.view({ ...raw, checkedAt: new Date(now + 60000).toISOString() }, now, now).state, 'unknown');
  assert.equal(Status.view({ installed: true, version: '0.5.4' }, now, now).state, 'unknown');
  assert.equal(Status.normalize({ ...raw, version: '<script>' }), null);
  assert.equal(Health.sameRules([{ id: 1, action: { type: 'block' }, condition: { resourceTypes: ['main_frame'] } }], [{ priority: 1, id: 1, condition: { resourceTypes: ['main_frame'] }, action: { type: 'block' } }]), true);
});
