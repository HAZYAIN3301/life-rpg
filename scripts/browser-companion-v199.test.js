'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const APP = read('public/app.js');
const CSS = read('public/styles.css');

function between(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `missing section ${from}`);
  return source.slice(start, end);
}

test('browser companion status parser accepts only the bounded read-only schema', () => {
  const source = between(APP, 'const BROWSER_COMPANION_TARGETS', 'function browserCompanionRequestId');
  const context = { Date, Set, Object };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.target = browserCompanionTarget; this.parse = browserCompanionStatusFromMessage;`, context);

  assert.deepEqual({ ...context.target('tiktok') }, { id: 'tiktok', label: 'TikTok' });
  assert.equal(context.target('tiktok.com.evil'), null);
  const valid = context.parse({
    source: 'satoru-attention-extension', type: 'SATORU_ATTENTION_STATUS_RESPONSE',
    status: { installed: true, version: '0.1.0', configuredSites: 2,
      active: { app: 'youtube', phase: 'active', remainingSeconds: 90, mode: 'control' } },
  });
  assert.equal(valid.installed, true);
  assert.deepEqual({ ...valid.active }, { app: 'youtube', phase: 'active', remainingSeconds: 90, mode: 'control' });
  assert.equal(context.parse({ source: 'satoru-attention-extension', type: 'SATORU_ATTENTION_STATUS_RESPONSE', status: {
    installed: true, version: '0.1.0', configuredSites: 1,
    active: { app: 'tiktok.com.evil', phase: 'active', remainingSeconds: 90, mode: 'control' },
  } }), null);
  assert.equal(context.parse({ source: 'satoru-attention-extension', type: 'SATORU_ATTENTION_STATUS_RESPONSE', status: {
    installed: true, version: '0.1.0', configuredSites: 1, active: null, history: ['private'],
  } }).installed, true, 'unknown fields are never copied into the sanitized projection');
});

test('page bridge is exact-origin, request-correlated and cannot mutate attention data', () => {
  const bridge = between(APP, 'const BROWSER_COMPANION_ORIGIN', 'function browserCompanionSettingsHTML');
  assert.match(bridge, /https:\/\/life-rpg-production-416a\.up\.railway\.app/);
  assert.match(bridge, /event\.origin !== BROWSER_COMPANION_ORIGIN \|\| event\.source !== window/);
  assert.match(bridge, /message\.requestId !== State\._browserCompanionRequestId/);
  assert.match(bridge, /SATORU_ATTENTION_STATUS_REQUEST/);
  assert.match(bridge, /SATORU_ATTENTION_OPEN_OPTIONS/);
  assert.doesNotMatch(bridge, /Store\.save|fetch\(|goalDataCommit|habitDataCommit|completeTask/);
  const summary = between(APP, 'function assistantBrowserCompanionSummary', '// «Состояние сейчас»');
  assert.doesNotMatch(summary, /history|url|title|purpose|page|userId/i);
});

test('status response patches only companion surfaces and preserves Settings drafts/focus', () => {
  const bridge = between(APP, 'function browserCompanionFocusKey', 'function browserCompanionSettingsHTML');
  assert.match(bridge, /replaceBrowserCompanionSurface/);
  assert.match(bridge, /requestAnimationFrame[\s\S]*focus\(\{ preventScroll: true \}\)/);
  assert.match(bridge, /document\.querySelector\('\[data-browser-companion\]'\)/);
  assert.match(bridge, /document\.querySelector\('\[data-secretary-control\]'\)/);
  assert.doesNotMatch(bridge, /\brender\s*\(/,
    'a status heartbeat must never remount the whole Settings/Today view');
  assert.doesNotMatch(bridge, /input\.value|textarea\.value|contenteditable/,
    'the bridge must not read or rewrite unrelated drafts');
  assert.match(APP, /BROWSER_COMPANION_STATUS_TTL_MS = 25000/);
  assert.match(APP, /remainingSeconds - Math\.floor\(elapsedMs \/ 1000\)/,
    'the displayed countdown must advance locally between extension heartbeats');
  assert.match(APP, /setInterval[\s\S]*requestBrowserCompanionStatus\(\)[\s\S]*}, 10000\)/,
    'visible Today/Settings must refresh bounded status and expire a disabled extension');
});

test('extension deep links have a closed source, action and app vocabulary', () => {
  const routing = between(APP, '// Ярлыки-действия', '// Возврат с OAuth Strava');
  assert.match(routing, /source === 'extension'/);
  assert.match(routing, /\(act === 'gate' \|\| act === 'return'\)/);
  assert.doesNotMatch(routing, /source === 'extension'[\s\S]{0,180}act === 'finish'/);
  assert.match(routing, /browserCompanionTarget\(rawTarget\)/);
  for (const forbidden of ['userId', 'outcome', 'session', 'permission', 'redirect']) {
    assert.match(routing, new RegExp(`'${forbidden}'`), `${forbidden} must be consumed, never trusted`);
  }
  assert.match(routing, /history\.replaceState/);
});

test('companion stays a single progressive Settings row, not another Today panel', () => {
  const settings = between(APP, 'function attentionSettingsCard', 'async function retryAttentionLoad');
  const today = between(APP, 'function attentionTodayControlHTML', 'function attentionPolicyId');
  assert.match(settings, /browserCompanionSettingsHTML\(\)/);
  assert.match(APP, /<details class="browser-companion"/);
  assert.match(today, /browserCompanionCurrentStatus\(\)\?\.active/,
    'the existing Shadow control may project the current boundary');
  assert.doesNotMatch(today, /browserCompanionSettingsHTML|class="card[^\n]*browser-companion|Контроль сайтов в Brave/,
    'Today must not gain a setup/status card of its own');
  assert.match(CSS, /\.browser-companion > summary/);
  assert.match(CSS, /\.browser-companion-actions > :is\(a, button\) \{ min-height: var\(--touch-min\)/);
  assert.match(CSS, /prefers-reduced-motion: reduce[\s\S]*\.browser-companion > summary > span:last-child \{ transition: none/);
});

test('all new visible copy has complete EN DE UK ES rows', () => {
  const keys = [
    'Контроль сайтов в Brave', 'Расширение не обнаружено', 'Расширение подключено',
    'Подключено сайтов: {count}', 'Установить расширение', 'Проверить связь',
    'Открыть настройки расширения', 'Сейчас ограничено: {app}',
    'До границы: {minutes} мин', 'Граница уже достигнута',
    'Подробности остаются внутри расширения. Satoru видит только число настроенных сайтов и состояние текущей границы.',
  ];
  for (const key of keys) {
    const encoded = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = APP.match(new RegExp(`^\\s*'${encoded}':\\s*\\{[^\\n]*en:\\s*'[^']+'[^\\n]*de:\\s*'[^']+'[^\\n]*uk:\\s*'[^']+'[^\\n]*es:\\s*'[^']+'`, 'gm')) || [];
    assert.equal(rows.length, 1, `${key}: missing or duplicate locale row`);
  }
});
