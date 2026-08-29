'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');

function section(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `missing end token after ${startToken}: ${endToken}`);
  return source.slice(start, end);
}

function deliveryClassifier() {
  const source = section(SERVER, 'function pushDeliveryOutcome(', '\n// ---- Планировщик пушей:');
  const context = {};
  vm.runInNewContext(`${source}\nthis.pushDeliveryOutcome = pushDeliveryOutcome;`, context);
  return context.pushDeliveryOutcome;
}

test('only a 2xx response acknowledges push delivery', () => {
  const classify = deliveryClassifier();
  for (const status of [200, 201, 204, 299]) assert.equal(classify({ status }), 'delivered', String(status));
  for (const status of [0, 429, 500]) assert.equal(classify({ status }), 'retry', String(status));
  assert.equal(classify(undefined), 'retry', 'a thrown/absent result stays retryable');
});

test('404 and 410 are terminal subscription failures, not delivered pushes', () => {
  const classify = deliveryClassifier();
  assert.equal(classify({ status: 404 }), 'gone');
  assert.equal(classify({ status: 410 }), 'gone');
});

test('pushTick mutates delivery logs only after a successful classification', () => {
  const tick = section(SERVER, 'async function pushTick() {', '\n// ИИ BYOK:');
  const classifyAt = tick.indexOf('const outcome = pushDeliveryOutcome(result)');
  const retryAt = tick.indexOf("if (outcome !== 'delivered') continue;");
  const logAt = tick.indexOf('log[delivery.logKey] = true');
  assert.ok(classifyAt >= 0 && classifyAt < retryAt && retryAt < logAt,
    'transient failures must leave every delivery marker untouched');
  assert.match(tick, /if \(outcome === 'gone'\) \{ delete user\.push; changed = true; continue; \}/);
  assert.match(tick, /try \{ result = await sendWebPush\(user\.push, payload\); \} catch \{\}/,
    'a thrown transport failure must flow through the retry classifier');
  assert.doesNotMatch(tick.slice(0, classifyAt), /log\.(?:m|e|p|q)\s*=\s*true/,
    'no channel may be logged before the provider acknowledges it');
});

test('all scheduled push payloads carry the normalized user language', () => {
  const tick = section(SERVER, 'async function pushTick() {', '\n// ИИ BYOK:');
  assert.match(tick, /const lang = NudgeCopy\.normalizeLocale\(settings\.lang\)/);
  for (const tag of ['satoru-evening', 'satoru-checkin', 'satoru-pet', 'satoru-quiet']) {
    const at = tick.indexOf(`tag: '${tag}'`);
    assert.ok(at >= 0, `missing ${tag} payload`);
    assert.match(tick.slice(at, at + 80), /lang\s*\}/, `${tag} must carry normalized lang`);
  }
  assert.doesNotMatch(tick, /\$\{(?:name|pet)\} (?:ждёт тебя|заскучал)/,
    'localized notification chrome must not be hard-coded in Russian');
});

test('test notification uses the same normalized five-language contract', () => {
  const route = section(SERVER, "if (u === '/api/push/test'", '\n\n  // ---- Account data lifecycle:');
  assert.match(route, /NudgeCopy\.normalizeLocale/);
  assert.match(route, /PUSH_CHROME_COPY\[lang\]/);
  assert.match(route, /tag: 'satoru-test', lang/);
  assert.doesNotMatch(route, /Уведомления работают!/);
});

test('service worker accepts only the five product locales and falls back safely', async () => {
  const pushSource = section(SW, "const PUSH_LANGS", "\nself.addEventListener('notificationclick'");
  let handler = null;
  let shown = null;
  const self = {
    addEventListener(kind, callback) { if (kind === 'push') handler = callback; },
    registration: {
      showNotification(title, options) { shown = { title, options }; return Promise.resolve(); },
    },
  };
  vm.runInNewContext(pushSource, { self, Set });
  assert.equal(typeof handler, 'function');

  async function deliver(lang) {
    shown = null;
    let pending;
    handler({
      data: { json: () => ({ title: 'Satoru', body: 'body', lang }) },
      waitUntil(value) { pending = value; },
    });
    await pending;
    return shown.options.lang;
  }

  for (const lang of ['ru', 'en', 'de', 'uk', 'es']) assert.equal(await deliver(lang), lang);
  for (const invalid of ['fr', 'de-DE', '', null, { toString: () => 'en' }]) {
    assert.equal(await deliver(invalid), 'ru');
  }
});
