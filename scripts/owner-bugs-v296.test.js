'use strict';
// v296: owner reports — the extension ZIP rendered as text inside the Mac app, and a goal
// import rejected because of an old quest; the client now names the failed link.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const fnSource = (name) => { const at = APP.search(new RegExp(`(?:async )?function ${name}\\(`)); assert.ok(at >= 0, name); return APP.slice(at, APP.indexOf('\n}', at) + 2); };
const i18n = () => {
  const lines = APP.split('\n');
  const start = lines.findIndex((l) => l.startsWith('const I18N_EN = {'));
  const end = lines.findIndex((l) => l.startsWith('for (const ru in I18N_EXTRA)'));
  const ctx = vm.createContext({});
  vm.runInContext(`${lines.slice(start, end + 1).join('\n')}\nthis.I18N = I18N;`, ctx);
  return ctx.I18N;
};

test('inside the app shell the extension package opens in the default browser instead of the web view', () => {
  const installer = fnSource('openBrowserCompanionInstaller');
  assert.match(installer, /const downloadLink = inAppShell\(\)/);
  const shellLink = installer.slice(installer.indexOf('? `<a class="btn" href="${esc(appShellExternalUrl(BROWSER_COMPANION_DOWNLOAD))}"'), installer.indexOf(': `<a class="btn" href="${BROWSER_COMPANION_DOWNLOAD}" download>'));
  assert.ok(shellLink.length > 20, 'shell branch links to the other host');
  assert.doesNotMatch(shellLink, /\sdownload[\s>]|target=/, 'a plain link to another host is what the native shell sends to the system browser');
  assert.match(installer, /<li><span>1<\/span><div><b>\$\{t\('Скачать пакет'\)\}<\/b>\$\{downloadLink\}<\/div><\/li>/);
  const I18N = i18n();
  for (const l of ['en', 'de', 'uk', 'es']) assert.ok(I18N[l]['Откроется в браузере по умолчанию — там же устанавливается расширение.'], l);
});

test('v298: every same-origin download in the app shell is rewritten to the other host before navigation', () => {
  const src = ['inAppShell', 'appShellExternalUrl', 'appShellDownloadLink'].map(fnSource).join('\n');
  const lines = APP.split('\n'); const hosts = lines.find((l) => l.startsWith('const APP_SHELL_HOSTS ='));
  class Element {}
  const make = (origin) => new Function('Element', 'location', 'window', `${hosts}\n${src}\nreturn { appShellExternalUrl, appShellDownloadLink };`)(Element, { href: origin + '/', origin }, {});
  const onMain = make('https://satoruapp.com');
  assert.equal(onMain.appShellExternalUrl('downloads/satoru-attention-chromium-v297.zip'),
    'https://life-rpg-production-416a.up.railway.app/downloads/satoru-attention-chromium-v297.zip');
  assert.equal(make('https://life-rpg-production-416a.up.railway.app').appShellExternalUrl('/downloads/a.zip'), 'https://satoruapp.com/downloads/a.zip');
  const link = (href, attrs = {}) => {
    const a = Object.assign(new Element(), { attrs: { href, ...attrs }, getAttribute(k) { return this.attrs[k] ?? null; },
      hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; } });
    Object.defineProperty(a, 'href', { set(v) { this.attrs.href = v; } });
    return a;
  };
  const click = (a) => onMain.appShellDownloadLink({ isTrusted: true, target: Object.assign(new Element(), { closest: () => a }) });
  const zip = link('downloads/x.zip', { download: '', target: '_blank' }); click(zip);
  assert.deepEqual(zip.attrs, { href: 'https://life-rpg-production-416a.up.railway.app/downloads/x.zip' });
  const page = link('settings.html'); click(page); assert.deepEqual(page.attrs, { href: 'settings.html' }, 'ordinary links untouched');
  const external = link('https://example.com/file.zip', { download: '' }); click(external); assert.equal(external.attrs.href, 'https://example.com/file.zip');
  assert.match(fnSource('init'), /if \(inAppShell\(\)\) document\.addEventListener\('click', appShellDownloadLink, true\);/);
});

test('a rejected proposal commit says which link failed', () => {
  const commit = fnSource('proposalDataCommit');
  assert.match(commit, /const reason = typeof body\.reason === 'string' \? body\.reason : '';/);
  assert.match(commit, /\['goal_sphere', 'task_sphere'\]\.includes\(reason\)\s*\? 'Цель или квест ссылается на сферу, которой нет в аккаунте/);
  assert.match(commit, /reason === 'goal_parent'\s*\? 'Родительская цель из JSON не найдена/);
  const I18N = i18n();
  for (const key of ['Цель или квест ссылается на сферу, которой нет в аккаунте. Проверь названия сфер в JSON и разбери его снова.',
    'Родительская цель из JSON не найдена. Проверь поле parent — оно должно совпадать с названием существующей или новой цели.']) {
    for (const l of ['en', 'de', 'uk', 'es']) assert.ok(I18N[l][key], `${key} → ${l}`);
  }
});
