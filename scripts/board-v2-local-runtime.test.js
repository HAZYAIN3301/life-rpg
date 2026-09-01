'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
const localUI = fs.readFileSync(path.join(ROOT, 'public/board-v2-local-ui.js'), 'utf8');
const serverRegistry = fs.readFileSync(path.join(ROOT, 'server-board-v2-registry-v1.js'), 'utf8');

test('v179 shell retains local Board contracts before runtime and caches each once', () => {
  const files = ['board-v2-discovery.js', 'board-v2-local-issuer.js', 'board-v2-local-ui.js', 'board-v2-runtime.js', 'app.js'];
  const positions = files.map((file) => index.indexOf(file));
  assert.equal(positions.every((position) => position >= 0), true);
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
  for (const file of files.slice(0, -1)) {
    assert.equal((sw.match(new RegExp(`'${file.replaceAll('.', '\\.')}''?`.replace("''", "'"), 'g')) || []).length, 1);
  }
  assert.match(sw, /const CACHE = 'satoru-v212';/);
  assert.match(index, /styles\.css\?v=20260901-secretary-recovery-v212-1/);
  assert.match(index, /app\.js\?v=20260901-secretary-recovery-v212-1/);
});

test('city discovery requires two explicit approvals and names Brave as recipient', () => {
  const start = app.indexOf('function boardV2LocalPanelHTML()');
  const end = app.indexOf('\nfunction boardV2CommunityHTML()', start);
  const panel = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(panel, /name="accepted" required/);
  assert.match(panel, /name="providerConfirmed" required/);
  assert.match(panel, /Brave Search/);
  assert.match(panel, /Координаты, домашний адрес, профиль, дневник и мои формулировки не передаются/);
  assert.match(app, /providerConfirmed: data\.has\('providerConfirmed'\)/);
  assert.match(localUI, /provider: 'brave-web-v1', shareCityWithProvider: true/);
});

test('client can request only a server-owned option and persists only verified recommendation', () => {
  const start = app.indexOf('async function boardV2ResolveLocal(payload)');
  const end = app.indexOf('\nasync function boardV2MarkCommunity', start);
  const adapter = app.slice(start, end);
  assert.match(app, /U\.resolvePayload\(session\.status/);
  assert.match(adapter, /fetch\('\/api\/board-v2\/discovery\/resolve'/);
  assert.match(adapter, /L\.issue\(/);
  assert.match(adapter, /R\.prepareIssue/);
  assert.ok(adapter.indexOf('await commitBoardV2Transaction') < adapter.indexOf('State._boardSel = issue.primary.id'));
  assert.doesNotMatch(adapter, /navigator|geolocation|latitude|longitude|rawProvider|query\s*:/);
  assert.match(serverRegistry, /ALLOWED_INPUT = Object\.freeze\(\['templateId', 'slotId', 'interestId'\]\)/);
  assert.doesNotMatch(serverRegistry, /raw\.query|raw\.url|raw\.latitude|raw\.longitude/);
});

test('local detail exposes verified source/reserve and completion opens structured community feedback', () => {
  assert.match(app, /mode === 'manual-local' \? 'ЛОКАЛЬНЫЙ'/);
  assert.match(app, /Проверено по официальному источнику/);
  assert.match(app, /class="bdetail-alternative"/);
  assert.match(app, /data-signal="matched"/);
  assert.match(app, /data-signal="changed"/);
  assert.match(app, /data-signal="closed"/);
  assert.match(app, /await boardV2LoadCommunity\(true\)/);
  const markStart = app.indexOf('async function boardV2MarkCommunity(signal)');
  const markEnd = app.indexOf('\nfunction boardV2CompletionStart', markStart);
  const mark = app.slice(markStart, markEnd);
  assert.match(mark, /JSON\.stringify\(\{ snapshotId: state\.snapshotId, signal \}\)/);
  assert.doesNotMatch(mark, /FormData|textarea|caption|photo|file|name:/);
});

test('local Board controls meet touch, focus and mobile layout contracts', () => {
  assert.match(styles, /\.board-local\s+:is\(\.btn,\.link-btn\)[\s\S]*min-height:\s*var\(--touch-min\)/);
  assert.match(styles, /\.board-screen :is\([^}]*select[^}]*\):focus-visible,[\s\S]*var\(--focus-ring\)/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.board-local-city-grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.board-local-options\s*\{[^}]*minmax\(0, 1fr\)/);
  assert.match(app, /aria-busy="true"/);
  assert.match(app, /role="alert"/);
  assert.match(app, /aria-expanded="\$\{boardV2LocalSession\(\)\.open/);
  const consentStart = app.indexOf("if (f.id === 'board-local-consent-form')");
  const consentEnd = app.indexOf("if (f.id === 'board-local-resolve-form')", consentStart);
  const consent = app.slice(consentStart, consentEnd);
  assert.match(consent, /State\._boardFocusAfterCommit = saved \? '#board-local-title' : '\.board-local-error';\s*render\(\)/);
  const revokeStart = app.indexOf("} else if (action === 'board-local-revoke')");
  const revokeEnd = app.indexOf("} else if (action === 'board-community-mark')", revokeStart);
  assert.match(app.slice(revokeStart, revokeEnd), /State\._boardFocusAfterCommit = '#board-local-title'; render\(\)/);
});
