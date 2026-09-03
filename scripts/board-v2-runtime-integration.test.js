'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const runtime = fs.readFileSync(path.join(ROOT, 'public', 'board-v2-runtime.js'), 'utf8');

test('Board v2 standard and Wildcard issuers load in dependency order', () => {
  const files = ['board-v2.js', 'board-v2-catalog.js', 'board-v2-pacing.js', 'board-v2-offers.js', 'board-v2-completion.js', 'board-v2-issuer.js', 'board-v2-wildcard-catalog.js', 'board-v2-wildcard-issuer.js', 'board-v2-runtime.js', 'app.js'];
  const positions = files.map((file) => index.indexOf(file));
  assert.equal(positions.every((position) => position >= 0), true);
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
  for (const file of files.slice(0, -1)) {
    assert.match(index, new RegExp(`${file.replaceAll('.', '\\.')}\\?v=20260825-board-v2-complete-v175-1`));
    assert.equal((sw.match(new RegExp(`'${file.replaceAll('.', '\\.')}'`, 'g')) || []).length, 1);
  }
  assert.match(index, /app\.js\?v=20260903-write-fence-v215-12/);
  assert.match(sw, /const CACHE = 'satoru-v236';/);
});

test('account defaults and hydration normalize offers, completion and titles', () => {
  assert.match(app, /boardV2Offers:\s*\{ schema: 'satoru\.board-offers\/2'/);
  assert.match(app, /boardV2Completion:\s*\{ schema: 'satoru\.board-completion\/2'/);
  assert.match(app, /boardV2Titles:\s*\[\]/);
  assert.match(app, /BoardV2Offers\.normalizeState\(State\.settings\.boardV2Offers, window\.BoardV2Pacing\)/);
  assert.match(app, /BoardV2Completion\.normalizeState\(State\.settings\.boardV2Completion\)/);
});

test('browser persists an issued transaction before publishing settings or tasks', () => {
  const start = app.indexOf('async function commitBoardV2Transaction');
  const end = app.indexOf('\nasync function commitBoardState', start);
  const source = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(source, /BoardV2Runtime.*payload\(transaction\)/);
  assert.match(source, /fetch\('\/api\/board\/commit'/);
  assert.ok(source.indexOf('if (!response.ok)') < source.indexOf('State.settings = next.settings'));
  assert.ok(source.indexOf('State.settings = next.settings') < source.indexOf('State.tasks = next.tasks'));
  assert.doesNotMatch(source, /Store\.(?:save|saveNow)/);
});

test('take, return and confirmed completion route exact v2 snapshots through the bridge', () => {
  for (const action of ['take', 'return']) {
    assert.match(app, new RegExp(`prepareBoardV2Action\\('${action}', id`));
  }
  assert.match(app, /prepareBoardV2Action\('complete', snapshotId/);
  assert.match(app, /if \(boardV2SnapshotById\(id\)\)/);
  assert.match(app, /commitBoardV2Transaction\(prepared\.transaction\)/);
  assert.match(runtime, /task\.boardProof = clone\(prepared\.proof\)/);
});

test('manual Wildcard has explicit setup, exact persistence and rejection instead of infinite rerolls', () => {
  assert.match(app, /Дай что-нибудь неожиданное/);
  assert.match(app, /id="board-wildcard-form"/);
  assert.match(app, /boardV2IssueUnexpected\(setup\)/);
  assert.match(app, /I\.issueManual/);
  assert.match(app, /R\.prepareIssue/);
  assert.match(app, /prepareBoardV2Action\('reject', id\)/);
  assert.match(app, /отклонённый тип не вернётся 30 дней/);
  for (const field of ['minecraftName', 'minecraftPlayers', 'minecraftGoal', 'cosplayCharacter', 'cosplayDate',
    'cosplayPiece', 'dmGame', 'dmPlayers', 'dmModule']) {
    assert.match(app, new RegExp(`name="${field}"`));
  }
  assert.match(app, /minecraftReady/); assert.match(app, /cosplayBudget/); assert.match(app, /dmReady/);
  assert.doesNotMatch(app.slice(app.indexOf('function boardV2WildcardPanelHTML'), app.indexOf('function prepareBoardV2Action')), /navigator|geolocation|fetch\(/);
});

test('exact offers are RU-gated and replace the rejected legacy wall when available', () => {
  assert.match(app, /const currentExact = lang\(\) === 'ru' \? boardV2CurrentOffers\(\)/);
  assert.match(app, /const completedIds = new Set\(st\.done\.map\(\(entry\) => entry\.orderId\)\)/);
  assert.match(app, /const exactOffers = currentExact\.filter\(\(order\) => !takenIds\.has\(order\.id\) && !completedIds\.has\(order\.id\)\)/);
  assert.match(app, /const exactBoard = exactOffers\.length > 0/);
  assert.match(app, /const offers = exactBoard \? exactOffers\s*: skyOffers\.concat\(view\.seasonal/s);
  assert.match(app, /const placeSheet = exactBoard \|\| boardPlace\(\) \? ''/);
  assert.match(app, /Один основной заказ и максимум один запасной\. Без стены вариантов\./);
  assert.match(index, /board-v1\.js/);
  assert.match(app, /const B = window\.BoardV1/);
});
