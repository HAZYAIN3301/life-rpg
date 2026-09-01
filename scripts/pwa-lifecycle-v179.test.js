'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PWA = require('../public/pwa-lifecycle-v1.js');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');

test('lifecycle reducer prioritizes offline, update and explicit reconnect recovery', () => {
  let state = PWA.create({ currentVersion: 'satoru-v190', online: true });
  state = PWA.reduce(state, { type: 'network:offline' });
  assert.equal(PWA.canWrite(state), false);
  assert.equal(PWA.surface(state).kind, 'offline');
  state = PWA.reduce(state, { type: 'worker:version', version: 'satoru-v196' });
  assert.equal(PWA.surface(state).kind, 'offline', 'offline warning stays the highest priority');
  state = PWA.reduce(state, { type: 'network:online' });
  assert.equal(PWA.surface(state).kind, 'update');
  state = PWA.reduce(state, { type: 'update:defer' });
  assert.equal(PWA.surface(state).kind, 'reconnected');
  state = PWA.reduce(state, { type: 'reconnect:dismiss' });
  assert.equal(PWA.surface(state), null);
});

test('invalid messages and forged cache versions fail closed without throwing', () => {
  const state = PWA.create({ currentVersion: 'satoru-v196' });
  for (const value of [null, [], 'satoru-v999', { type: 'worker:version', version: '../v180' }, { type: 'worker:version', version: 'https://x' }]) {
    assert.doesNotThrow(() => PWA.reduce(state, value));
    assert.equal(PWA.reduce(state, value).updateReady, false);
  }
  assert.equal(PWA.cacheVersion('satoru-v196'), 'satoru-v196');
  assert.equal(PWA.cacheVersion(' satoru-v196 '), 'satoru-v196');
});

test('same worker version is quiet and refresh cannot start offline', () => {
  let state = PWA.create({ currentVersion: 'satoru-v196', online: false });
  state = PWA.reduce(state, { type: 'worker:version', version: 'satoru-v196' });
  assert.equal(state.updateReady, false);
  assert.equal(PWA.reduce(state, { type: 'refresh:start' }).refreshing, false);
});

test('failed explicit refresh stays visible above a deferred update or reconnect notice', () => {
  let state = PWA.create({ currentVersion: 'satoru-v190', online: true });
  state = PWA.reduce(state, { type: 'worker:version', version: 'satoru-v196' });
  state = PWA.reduce(state, { type: 'refresh:start' });
  state = PWA.reduce(state, { type: 'refresh:failed', error: 'save' });
  assert.equal(PWA.surface(state).kind, 'refresh-error');
});

test('service worker install is fail-closed and activated version reaches every open client', () => {
  assert.match(SW, /const CACHE = 'satoru-v216'/);
  const install = SW.slice(SW.indexOf("self.addEventListener('install'"), SW.indexOf("self.addEventListener('activate'"));
  assert.match(install, /c\.addAll\(SHELL\)/);
  assert.doesNotMatch(install, /catch\s*\(/, 'failed addAll must reject installation instead of activating a partial shell');
  const activate = SW.slice(SW.indexOf("self.addEventListener('activate'"), SW.indexOf('const MEDIA_PATH_RE'));
  assert.match(activate, /clients\.claim\(\)/);
  assert.match(activate, /clients\.matchAll/);
  assert.match(activate, /satoru:worker-version/);
  assert.match(SW, /satoru:version-request/);
});

test('every service-worker shell entry resolves to a real production file', () => {
  const literal = SW.match(/const SHELL = (\[[\s\S]*?\]);/);
  assert.ok(literal, 'SHELL array must remain statically auditable');
  const shell = Array.from(vm.runInNewContext(literal[1], Object.create(null), { timeout: 1000 }));
  assert.ok(Array.isArray(shell) && shell.length > 100);
  const missing = shell.filter((entry) => entry !== './'
    && !fs.existsSync(path.join(ROOT, 'public', String(entry).split('?')[0])));
  assert.equal(missing.length, 0, `missing shell files: ${missing.join(', ')}`);
});

test('offline shell serves the exact version-pinned URLs requested by index', () => {
  const literal = SW.match(/const SHELL = (\[[\s\S]*?\]);/);
  assert.ok(literal, 'SHELL array must remain statically auditable');
  const shell = Array.from(vm.runInNewContext(literal[1], Object.create(null), { timeout: 1000 }));
  const pinned = [...INDEX.matchAll(/(?:src|href)="([^"#]+\?v=[^"]+)"/g)]
    .map((match) => match[1]).filter((url) => !/^https?:/i.test(url));
  const critical = pinned.filter((url) => /(?:styles\.css|app\.js|inspiration-(?:profile|catalog)-v1\.js|return-shelf-(?:v1|ui-v1)\.js)/.test(url));
  assert.ok(critical.length >= 6, 'v196 critical pins were not found in index.html');

  const exactPinsCached = critical.every((url) => shell.includes(url));
  const queryAgnosticFallback = /caches\.match\(req,\s*\{\s*ignoreSearch:\s*true\s*\}\)/.test(SW);
  assert.ok(exactPinsCached || queryAgnosticFallback,
    'SHELL caches unversioned files but offline requests include ?v=: cache exact pins or use an explicit ignoreSearch fallback');
});

test('runtime exposes an accessible update/offline surface and fences writes while offline', () => {
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v216'/);
  assert.match(APP, /window\.addEventListener\('offline'/);
  assert.match(APP, /window\.addEventListener\('online'/);
  assert.match(APP, /navigator\.serviceWorker\.addEventListener\('message'/);
  assert.match(APP, /function pwaWriteAllowed/);
  for (const name of ['save(name, obj)', 'async saveNow(name, obj', 'async _put(name, obj']) {
    const at = APP.indexOf(name);
    assert.notEqual(at, -1);
    assert.match(APP.slice(at, at + 320), /pwaWriteAllowed/);
  }
  assert.match(APP, /role="status"[\s\S]{0,500}aria-live="polite"/);
  assert.match(APP, /data-action="pwa-lifecycle-refresh"/);
  assert.match(APP, /data-action="pwa-lifecycle-later"/);
  assert.match(CSS, /\.pwa-lifecycle-surface/);
  assert.match(CSS, /\.pwa-lifecycle-action[^}]*min-height:\s*42px/);
  assert.match(CSS, /\.pwa-lifecycle-action:focus-visible/);
});

test('all onboarding exits await successful durable writes and retain a retry surface on failure', () => {
  for (const marker of ['async function applyProgramFresh', "if (action === 'ob-finish')"]) {
    const start = APP.indexOf(marker);
    assert.notEqual(start, -1, marker);
    const slice = APP.slice(start, start + 2600);
    assert.match(slice, /onboardingSave/);
    assert.match(slice, /if \(!(?:saved|result)\.ok\)/);
  }
  for (const [startMarker, endMarker, endpoint, status] of [
    ['async function questionnaireCommit()', '\nasync function questionnaireDefer()', 'commit', 'materialized'],
    ['async function questionnaireDefer()', '\nfunction questionnaireVoiceToggle()', 'defer', 'deferred'],
  ]) {
    const start = APP.indexOf(startMarker), end = APP.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `${startMarker} must remain auditable`);
    const flow = APP.slice(start, end);
    assert.match(flow, new RegExp(`await fetch\\('/api/questionnaire/${endpoint}'`));
    assert.match(flow, new RegExp(`data\\.questionnaire\\.status !== '${status}'`));
    assert.ok(flow.indexOf('await fetch(') < flow.indexOf("State.phase = 'app'"),
      `${endpoint} must persist before leaving onboarding`);
    assert.match(flow, /catch[\s\S]*State\._questionnaireError[\s\S]*renderOnboardingScreen\(\)/);
  }
  assert.match(APP, /id="questionnaire-error"[^>]*role="alert"/);
  assert.match(APP, /State\._onboardingSaveBusy/);
  assert.match(APP, /State\._onboardingSaveError/);
  assert.match(APP, /State\._questionnaireBusy/);
  assert.match(APP, /State\._questionnaireError/);
});

test('registration language survives a settings write failure and missing settings resumes onboarding', () => {
  const registerAt = APP.indexOf("if (f.id === 'register-form')");
  assert.match(APP.slice(registerAt, registerAt + 1800), /lang:\s*registrationLang\(\)/);
  assert.match(APP, /freshOnboardingSettings\(\[\],\s*State\.me\s*&&\s*State\.me\.lang\)/);
  assert.match(APP, /State\.settings\.skills\.length === 0[\s\S]{0,300}State\.phase = 'onboarding'/);
  assert.match(SERVER, /function publicUser\(user\)[\s\S]{0,500}lang/);
});

test('five-language lifecycle copy and current shell order are complete', () => {
  for (const key of ['Нет соединения', 'Связь восстановлена', 'Доступно обновление Satoru', 'Обновить данные', 'Позже', 'Не удалось сохранить старт. Ничего не потеряно — повтори попытку.']) {
    const at = APP.indexOf(`'${key}'`);
    assert.notEqual(at, -1, key);
    const row = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(row, new RegExp(locale));
  }
  const moduleAt = INDEX.indexOf('pwa-lifecycle-v1.js?v=20260826-launch-hardening-v180-1');
  const appAt = INDEX.indexOf('app.js?v=20260902-browser-protection-v215-1');
  assert.ok(moduleAt >= 0 && appAt > moduleAt);
  assert.match(INDEX, /styles\.css\?v=20260901-actionable-gamification-v215-1/);
  assert.match(SW, /'pwa-lifecycle-v1\.js'/);
});
