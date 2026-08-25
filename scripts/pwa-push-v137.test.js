'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

function sourceOf(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} is present`);
  assert.notEqual(end, -1, `${nextName} follows ${name}`);
  return app.slice(start, end);
}

test('PWA v137 asks for notification permission only from explicit notification choices', () => {
  const focus = sourceOf('startFocus', 'pauseFocus');
  assert.doesNotMatch(focus, /Notification\.requestPermission/);
  assert.match(sourceOf('pushEnable', 'pushDisable'), /await Notification\.requestPermission\(\)/);
  assert.match(sourceOf('toggleReminders', 'isStandalone'), /Notification\.requestPermission\(\)/);
  assert.match(app, /Notification permission запрашивается только после явного нажатия человека/);
});

test('PWA v137 keeps installation outcomes and offline readiness honest', () => {
  const install = sourceOf('requestInstall', 'initPWA');
  assert.match(install, /await _deferredInstall\.prompt\(\)/);
  assert.match(install, /await _deferredInstall\.userChoice/);
  assert.match(install, /choice\.outcome !== 'accepted'/);
  assert.match(install, /Установка отменена — Satoru остаётся доступен в браузере\./);
  const init = sourceOf('initPWA', 'init');
  assert.match(init, /_pwaRegistration = 'ready'/);
  assert.match(init, /_pwaRegistration = 'failed'/);
  assert.match(app, /Офлайн-режим готов\./);
  assert.match(app, /Офлайн-режим пока недоступен в этом браузере\./);
});

test('PWA v137 serializes push controls and never claims a failed disable left state unchanged', () => {
  const enable = sourceOf('pushEnable', 'pushDisable');
  const disable = sourceOf('pushDisable', 'pushTest');
  const probe = sourceOf('pushTest', 'requestInstall');
  for (const code of [enable, disable, probe]) {
    assert.match(code, /if \(_pushBusy\) return;/);
    assert.match(code, /_pushBusy = true; render\(\);/);
    assert.match(code, /finally \{ _pushBusy = false; render\(\); \}/);
  }
  assert.match(disable, /const sub = await reg\.pushManager\.getSubscription\(\)/);
  assert.match(disable, /if \(sub && !await sub\.unsubscribe\(\)\) throw new Error\('browser'\)/);
  assert.match(disable, /Не удалось полностью выключить уведомления\. Повтори попытку\./);
  assert.doesNotMatch(disable, /Подписка не изменена/);
});

test('PWA v137 is localized, accessible while busy, and ships a fresh offline shell', () => {
  for (const key of ['Установка отменена — Satoru остаётся доступен в браузере.', 'Не удалось открыть установку. Попробуй из меню браузера.', 'Установка и уведомления включаются отдельно.', 'Установи Satoru как приложение: иконка на телефоне и офлайн-режим. Уведомления — только по отдельному согласию ниже.', 'Офлайн-режим готов.', 'Офлайн-режим пока недоступен в этом браузере.', 'Не удалось полностью выключить уведомления. Повтори попытку.']) {
    assert.match(app, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:\\s*\\{ en:[\\s\\S]{0,700}de:[\\s\\S]{0,700}uk:[\\s\\S]{0,700}es:`));
  }
  assert.match(app, /class="card pwa-card" aria-busy="\$\{_pwaInstallBusy \|\| _pushBusy\}"/);
  assert.match(css, /\.pwa-card\[aria-busy="true"\] \.pwa-row/);
  assert.match(sw, /const CACHE = 'satoru-v170'/);
});
