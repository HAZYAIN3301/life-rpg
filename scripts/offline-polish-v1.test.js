'use strict';
// Ночная ветка 21.10 (OFFLINE-CHECK.md): без сети ошибка называет причину; черновик заметки не теряется.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');

test('без сети сообщение о сохранении называет причину на всех языках', () => {
  const at = APP.indexOf('function economySaveUnconfirmed(data) {'); const body = APP.slice(at, APP.indexOf('\nasync function economyCommit', at));
  assert.match(body, /navigator\.onLine === false/);
  for (const l of ["ru: 'Нет соединения", "en: 'No connection", "de: 'Keine Verbindung", "uk: 'Немає з’єднання", "es: 'Sin conexión"]) assert.ok(body.includes(l), l);
});

test('черновик заметки: по аккаунту, пустой удаляется, без аккаунта не пишется', () => {
  const code = APP.slice(APP.indexOf('function captureDraftKey()'), APP.indexOf('function captureBar(options = {}) {'));
  const store = new Map();
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const ctx = { State: { me: { id: 'u1' } }, localStorage, String }; vm.createContext(ctx); vm.runInContext(code, ctx);
  ctx.captureDraftSet('мысль'); assert.equal(store.get('satoru:capture-draft:u1'), 'мысль'); assert.equal(ctx.captureDraftGet(), 'мысль');
  ctx.State.me = { id: 'u2' }; assert.equal(ctx.captureDraftGet(), '', 'другой аккаунт черновик не видит');
  ctx.State.me = { id: 'u1' }; ctx.captureDraftSet('   '); assert.equal(store.has('satoru:capture-draft:u1'), false, 'пустой черновик удаляется');
  ctx.State.me = null; ctx.captureDraftSet('x'); assert.equal(store.size, 0, 'без аккаунта ничего не пишется');
});

test('черновик подставляется в поле, очищается при сохранении и выходе', () => {
  assert.match(APP, /<input id="capture-text" name="text" maxlength="1000" value="\$\{esc\(captureDraftGet\(\)\)\}"/);
  assert.match(APP, /document\.addEventListener\('input', \(e\) => \{ if \(e\.target && e\.target\.id === 'capture-text'\) captureDraftSet\(e\.target\.value\); \}\);/);
  assert.match(APP, /captureDraftSet\(''\);\n    f\.dataset\.persisted = 'true';/);
  assert.match(APP, /if \(!response\.ok\) \{ toast\(accountError\(data, 'Сетевая ошибка'\)\); return; \}\n      captureDraftSet\(''\);/);
});
