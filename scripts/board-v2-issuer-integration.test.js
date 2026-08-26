'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');

test('production shell loads standard, local and Wildcard issuers before runtime', () => {
  const files = ['board-v2.js', 'board-v2-catalog.js', 'board-v2-pacing.js', 'board-v2-offers.js', 'board-v2-completion.js', 'board-v2-issuer.js', 'board-v2-discovery.js', 'board-v2-local-issuer.js', 'board-v2-local-ui.js', 'board-v2-wildcard-catalog.js', 'board-v2-wildcard-issuer.js', 'board-v2-runtime.js', 'app.js'];
  const positions = files.map((file) => index.indexOf(file));
  assert.equal(positions.every((position) => position >= 0), true);
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
  for (const file of files.slice(0, -1)) {
    assert.equal((sw.match(new RegExp(`'${file.replaceAll('.', '\\.')} '`.replace(' ', ''), 'g')) || []).length, 1);
  }
  assert.match(sw, /const CACHE = 'satoru-v180';/);
});

test('issuer profile consumes structured taste, spheres and recent sport completion only', () => {
  const start = app.indexOf('function boardV2IssuerProfile()');
  const end = app.indexOf('\nasync function boardV2IssueStandardOffers', start);
  const source = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(source, /BoardTasteV1\.tagWeights/);
  assert.match(source, /State\.settings\.skills/);
  assert.match(source, /State\.tasks\.some/);
  assert.doesNotMatch(source, /State\.profile|profile\.text|navigator|geolocation|fetch/);
});

test('opening Board persists the issued snapshot before selecting it', () => {
  const start = app.indexOf('async function boardV2IssueStandardOffers()');
  const end = app.indexOf('\nfunction prepareBoardV2Action', start);
  const source = app.slice(start, end);
  assert.match(source, /lang\(\) !== 'ru'/);
  assert.match(source, /I\.issueStandard/);
  assert.match(source, /R\.prepareIssue/);
  assert.match(source, /await commitBoardV2Transaction/);
  assert.ok(source.indexOf('await commitBoardV2Transaction') < source.indexOf('State._boardSel = issue.primary.id'));
  assert.match(app, /State\._todayTab === 'board' && await boardV2IssueStandardOffers\(\)/);
});

test('automatic issue never calls discovery or consumes location implicitly', () => {
  const start = app.indexOf('async function boardV2IssueStandardOffers()');
  const end = app.indexOf('\nasync function boardV2IssueUnexpected', start);
  const source = app.slice(start, end);
  assert.doesNotMatch(source, /board-v2\/discovery|navigator|geolocation|Brave|latitude|longitude/);
  assert.match(index, /board-v2-discovery\.js/);
});
