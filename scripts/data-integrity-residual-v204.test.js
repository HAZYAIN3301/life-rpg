'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function between(start, end) {
  const from = APP.indexOf(start);
  const to = APP.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source range: ${start}`);
  return APP.slice(from, to);
}

test('malformed successful social mutations reconcile with authoritative GET state', () => {
  assert.match(APP, /async function refreshSocialPrivacyAuthority\(\)[^]*fetch\('\/api\/social\/privacy'\)/);
  assert.match(APP, /async function refreshPartyAuthority\(\)[^]*fetch\('\/api\/party'\)/);

  const consent = between('async function setSocialConsent(', 'function renderParty(');
  assert.match(consent, /if \(!validSocialConsentRecord\(data\.consent\)\)[^]*await refreshSocialPrivacyAuthority\(\)/);

  const exit = between('async function commitPartyExit(', 'function securityCard(');
  assert.match(exit, /if \(data\.ok !== true\)[^]*await refreshPartyAuthority\(\)/);

  const partyForms = between("if (f.id === 'party-create')", "if (f.id === 'add-antihabit')");
  assert.equal((partyForms.match(/await refreshPartyAuthority\(\)/g) || []).length, 2);
});

test('note-to-quest reports durable partial success without creating a duplicate', () => {
  const note = between('async function noteToQuest(', 'function blobToDataUrl(');
  assert.match(note, /find\(\(item\) => item\.noteSourceId === id\)/);
  assert.match(note, /Квест сохранён, но заметка осталась/);
  assert.doesNotMatch(note, /Ничего не изменено/);
});

test('logout-all is gated by the shared accessible confirmation dialog', () => {
  assert.match(APP, /function showLogoutAllDialog\([^]*id = 'logout-all-modal'[^]*role="dialog" aria-modal="true"/);
  assert.match(APP, /mountAccountDialog\(overlay, \{ initial: '#logout-all-title'/);
  assert.match(APP, /data-action="confirm-logout-all"/);
  const action = between("if (action === 'logout-all')", '// --- Onboarding actions ---');
  assert.match(action, /showLogoutAllDialog\(el\)/);
  assert.match(action, /if \(action === 'confirm-logout-all'\) \{ commitLogoutAll/);
});
