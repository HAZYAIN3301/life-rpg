'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const POOL = require('../public/board-pool-v1.js');
const BOARD_SCREEN_START = APP.indexOf('function boardScreenHTML()');
const BOARD_SCREEN = APP.slice(BOARD_SCREEN_START, APP.indexOf('// ── Схватки', BOARD_SCREEN_START));
const BOARD_DONE = APP.slice(APP.indexOf('function boardDoneHTML(st)'), APP.indexOf('function tasteRead()'));

test('Board v149 keeps one board, one reading rail and a bounded private journal', () => {
  assert.match(APP, /class="board-frame"/);
  assert.match(APP, /class="board-wall"/);
  assert.match(APP, /class="board-detail"/);
  assert.match(APP, /slice\(0, 8\)/);
  assert.doesNotMatch(APP, /board-(?:feed|like|follow(?:["'\s>]|$)|ranking)/);
  assert.match(APP, /Общий для всех заказ\. Твоё выполнение и фото остаются приватными\./);
});

test('Board papers are buttons with a default selected contract, not a broken tablist', () => {
  assert.match(BOARD_SCREEN, /const selOrder = requested \|\| activeOrders\[0\] \|\| exactOffers\[0\] \|\| view\.seasonal \|\| view\.personal\[0\]/);
  assert.match(BOARD_SCREEN, /type="button" aria-pressed="\$\{selected\}"/);
  assert.doesNotMatch(BOARD_SCREEN, /role="tablist"/);
  assert.doesNotMatch(BOARD_SCREEN, /role="tab"/);
});

test('Private journal is validated, awaitable and refuses unsupported video', () => {
  assert.match(APP, /Store\.loadChecked\('boardmedia', \{\}, validateBoardMediaPayload\)/);
  assert.match(APP, /await Store\.saveNow\('boardmedia', all\)/);
  assert.match(APP, /entry\.dataUrl\.startsWith\('data:image\/'\)/);
  assert.match(BOARD_DONE, /type="file" accept="image\/\*"/);
  assert.doesNotMatch(BOARD_DONE, /accept="image\/\*,video\/\*"/);
});

test('Taking and completing a contract use one rollback-capable board commit', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(APP, /fetch\('\/api\/board\/commit'/);
  assert.match(APP, /const nextTasks = State\.tasks\.concat/);
  assert.match(APP, /title: boardOrderTitle\(order\)/);
  assert.match(server, /function commitBoardData\(uid, payload\)/);
  assert.match(server, /board_commit_failed_no_changes_lost/);
  assert.match(server, /for \(const name of written\)[\s\S]*restoreSnapshot/);
});

test('every authored order has a complete stable-id locale row', () => {
  // Число не фиксируем: пул растёт по мере авторской работы, и тест, который падает от
  // добавления заказа, учит только одному — не добавлять заказы. Стережём инвариант:
  // у КАЖДОГО заказа есть все локали, и ни одна не пустая.
  assert.ok(POOL.ALL.length >= 31, `пул усох до ${POOL.ALL.length}`);
  assert.equal(Object.keys(POOL.TITLES).length, POOL.ALL.length);
  for (const order of POOL.ALL) {
    assert.deepEqual(Object.keys(POOL.TITLES[order.id] || {}).sort(), ['de', 'en', 'es', 'uk']);
    for (const locale of ['de', 'en', 'es', 'uk']) assert.ok(POOL.titleFor(order, locale).trim());
    assert.equal(POOL.titleFor(order, 'ru'), order.title);
  }
});

test('Board v149 has scoped mobile, pointer and reduced-motion contracts', () => {
  assert.match(CSS, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.board-screen \.bsheet:hover/);
  assert.match(CSS, /@media \(max-width: 600px\), \(pointer: coarse\)[\s\S]*min-height: var\(--touch-min\)/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.board-screen \.bsheet[\s\S]*transform: none/);
  assert.doesNotMatch(CSS, /body:has\(\.board-screen\) #ai-fab[^}]*display:\s*none/);
});
