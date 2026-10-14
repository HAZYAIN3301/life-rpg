'use strict';
// Ночная ветка 14.10: каждый скрипт и стиль в index.html — с меткой версии `?v=`. Cloudflare держит JS
// 4 часа; файл без метки после выката может приходить старым рядом с новым app.js.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const INDEX = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
test('все локальные скрипты и стили в index.html подключены с меткой версии', () => {
  const tags = [...INDEX.matchAll(/<script[^>]*\ssrc="([^"]+)"/g), ...INDEX.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const local = tags.filter((src) => !/^https?:/.test(src));
  assert.ok(local.length > 100);
  assert.deepEqual(local.filter((src) => !/[?&]v=/.test(src)), []);
});
