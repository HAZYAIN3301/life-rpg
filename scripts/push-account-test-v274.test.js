'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
const card = app.slice(app.indexOf('function pwaCard() {'), app.indexOf('async function pushEnable()'));
test('account push test remains reachable without enrolling this browser', () => {
  for (const [supported, permission, pushOn] of [[false, 'default', false], [true, 'default', false], [true, 'denied', false], [true, 'granted', true]]) {
    const context = { State: { pushOn, apkAvailable: false }, navigator: supported ? { serviceWorker: {} } : {},
      window: supported ? { PushManager: {}, Notification: {} } : {}, Notification: { permission },
      ensurePushState() {}, ensureApkState() {}, t: x => x,
      _pwaRegistration: 'ready', _deferredInstall: null, _pwaInstallBusy: false, _pushBusy: false };
    vm.createContext(context); vm.runInContext(card, context);
    assert.equal((context.pwaCard().match(/data-action="push-test"/g) || []).length, 1);
    context._pushBusy = true;
    assert.match(context.pwaCard(), /data-action="push-test" disabled/);
  }
});
test('testing an existing account subscription sends once and never subscribes this browser', async () => {
  const code = app.slice(app.indexOf('async function pushTest() {'), app.indexOf('// PWA: сервис-воркер'));
  const calls = []; let release;
  const context = { _pushBusy: false, render() {}, toast() {}, t: x => x,
    fetch: async (url, options) => { calls.push([url, options.method]); await new Promise(resolve => { release = resolve; }); return { ok: true, json: async () => ({status: 201}) }; } };
  vm.createContext(context); vm.runInContext(code, context);
  const first = context.pushTest(); await context.pushTest(); release(); await first;
  assert.deepEqual(calls, [['/api/push/test', 'POST']]);
  assert.equal(context._pushBusy, false);
});
