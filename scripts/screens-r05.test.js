'use strict';
// R05: оставшиеся экраны — иконки только из реестра, состояние не красит текст, тач-цели ≥44px.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const NEXT = fs.readFileSync(path.join(root, 'public/design-next-v1.css'), 'utf8');

function registry() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/art/icons/icon-registry.js'), 'utf8'), sandbox);
  return sandbox.window.SatoruIconRegistry;
}

test('every literal icon id used by the app exists, so no fallback emoji is shown silently', () => {
  const R = registry();
  const ids = [...new Set([...APP.matchAll(/satoruIconHTML\('([a-z]+\.[a-z0-9_.-]+)'/g)].map((m) => m[1]))];
  assert.ok(ids.length > 40, 'icon usage was found');
  const conditional = [...APP.matchAll(/satoruIconHTML\([^)]*\? '([a-z]+\.[a-z0-9_.-]+)' : '([a-z]+\.[a-z0-9_.-]+)'/g)].flatMap((m) => [m[1], m[2]]);
  const missing = [...ids, ...conditional].filter((id) => !R[id]);
  assert.deepEqual(missing, []);
});

test('pet state badges carry colour on the frame, not on the text', () => {
  assert.doesNotMatch(APP, /class="pet-badge" style="[^"]*;color:/);
  assert.match(APP, /class="pet-badge" style="--badge-color:/);
  assert.match(NEXT, /\.pet-badge\{color:var\(--text\)/);
});

test('week task checks keep a 44px touch target and day counts use on-accent text', () => {
  assert.match(NEXT, /@media \(max-width:600px\),\(pointer:coarse\)\{\n :root\[data-design=next\] \.week-work \.wk-task-check\{[^}]*width:44px;height:44px/);
  assert.match(NEXT, /\.calv-day \.cd-dot:not\(:empty\)\{color:var\(--on-accent\)/);
});

test('translated labels drop system emoji through one helper instead of new duplicate keys', () => {
  const at = APP.indexOf('function emojiFree(');
  const helper = new Function(`${APP.slice(at, APP.indexOf('\nfunction sphereNameText', at))}\nreturn emojiFree;`)();
  assert.equal(helper('🔑 Вход и восстановление'), 'Вход и восстановление');
  assert.equal(helper('⚠️ Данные и приватность'), 'Данные и приватность');
  assert.equal(helper('Спасибо за поддержку 💛'), 'Спасибо за поддержку');
  assert.equal(helper('Без эмодзи'), 'Без эмодзи');
  for (const key of ['🔑 Вход и восстановление', '⚠️ Данные и приватность', '💎 Оформить Pro', '⏱ Версия 2 минут']) {
    assert.match(APP, new RegExp(`emojiFree\\(t\\('${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)\\)`), key);
  }
});
