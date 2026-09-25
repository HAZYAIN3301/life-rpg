'use strict';
// R12: экраны входа и первый запуск — подписи связаны с полями, анкета переведена, без системных эмодзи.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const NEXT = fs.readFileSync(path.join(__dirname, '../public/design-next-v1.css'), 'utf8');
const fnSource = (name) => { const at = APP.search(new RegExp(`(?:async )?function ${name}\\(`)); assert.ok(at >= 0, name); return APP.slice(at, APP.indexOf('\n}', at) + 2); };

test('auth screens link each visible label to its field and name fields without one', () => {
  const helper = fnSource('linkAuthFormLabels');
  const doc = { forms: [] };
  // Minimal DOM double: label → input pairs and one input without a label.
  const mk = (tag, extra = {}) => ({ tagName: tag, id: '', htmlFor: '', labels: [], attrs: {}, querySelector: () => null, getAttribute(k) { return this.attrs[k] || null; }, setAttribute(k, v) { this.attrs[k] = v; }, ...extra });
  const label = mk('LABEL'); const email = mk('INPUT', { name: 'email', previousElementSibling: label, placeholder: 'you@mail.com' });
  const pass2 = mk('INPUT', { name: 'password2', previousElementSibling: mk('INPUT'), placeholder: 'Повтори пароль' });
  const form = { id: 'register-form', querySelectorAll: () => [email, pass2] };
  const linkAuthFormLabels = new Function(`${helper}\nreturn linkAuthFormLabels;`)();
  linkAuthFormLabels({ querySelectorAll: () => [form] });
  assert.equal(email.id, 'register-form-email');
  assert.equal(label.htmlFor, 'register-form-email');
  assert.equal(pass2.attrs['aria-label'], 'Повтори пароль');
  assert.match(fnSource('showAuthScreen'), /if \(State\.phase !== 'onboarding'\) linkAuthFormLabels\(document\.getElementById\('app'\)\)/);
  void doc;
});

test('sign-in pitch and onboarding use registry icons and translated copy', () => {
  for (const raw of ["<span>🧭 ${t(", "<span>🕯 ${t(", "<span>🛡 ${t(", "${t('⚡ Начать — создать аккаунт')}", "`🎤 ${t('Ответить голосом')}`", ">🎤 ${t('Ответить голосом')}<", "`■ ${t('Остановить запись')}`"]) {
    assert.ok(!APP.includes(raw), raw);
  }
  const lines = APP.split('\n');
  const start = lines.findIndex((l) => l.startsWith('const I18N_EN = {'));
  const end = lines.findIndex((l) => l.startsWith('for (const ru in I18N_EXTRA)'));
  const ctx = vm.createContext({});
  vm.runInContext(`${lines.slice(start, end + 1).join('\n')}\nthis.I18N = I18N;`, ctx);
  for (const key of ['ИИ сейчас не подключён — ручной путь работает полностью.', 'Проверяю подключение ИИ…', 'Предложено как основная сфера', 'Предложено как фон']) {
    for (const l of ['en', 'de', 'uk', 'es']) assert.ok(ctx.I18N[l][key], `${key} → ${l}`);
  }
  assert.match(NEXT, /:root\[data-design=next\] :is\(\.ap-alpha,\.privacy-note\)\{font-size:var\(--type-micro\)\}/);
  assert.match(NEXT, /:root\[data-design=next\] \.auth-links \.link-btn\{min-height:44px/);
});
