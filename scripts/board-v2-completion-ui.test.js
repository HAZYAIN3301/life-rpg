'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Completion = require('../public/board-v2-completion.js');
const UI = require('../public/board-v2-completion-ui.js');

const ROOT = path.resolve(__dirname, '..');
function snapshot(overrides) {
  return Object.assign({
    id: 'quest@1.local', title: 'Сходи на пробное занятие',
    completion: { proofModes: ['checkin', 'photo', 'reflection', 'video'], proofRequired: false, share: 'optional' },
    reward: { xp: 120, title: 'Первый выход' },
  }, overrides || {});
}

test('completion view keeps authored modes and marks video honestly unavailable', () => {
  const view = UI.completionView(snapshot(), Completion);
  assert.equal(view.canSkip, true); assert.equal(view.defaultMode, 'none');
  assert.deepEqual(view.modes.map((row) => [row.id, row.kind]), [
    ['checkin', 'checkin'], ['photo', 'photo'], ['reflection', 'text'], ['video', 'unavailable'],
  ]);
  assert.deepEqual(view.reward, { xp: 120, gold: 42, title: 'Первый выход' });
});

test('required proof selects a real available mode and cannot be skipped', () => {
  const view = UI.completionView(snapshot({ completion: { proofModes: ['video', 'result'], proofRequired: true } }), Completion);
  assert.equal(view.defaultMode, 'result');
  assert.equal(UI.proofDraft(view, { mode: 'none' }).reason, 'proof-required');
  assert.equal(UI.proofDraft(view, { mode: 'video' }).reason, 'unsupported-proof');
});

test('text, checkin and photo drafts are bounded and contain no raw media', () => {
  const view = UI.completionView(snapshot(), Completion);
  assert.deepEqual(UI.proofDraft(view, { mode: 'checkin' }), { ok: true, proof: { mode: 'checkin' } });
  assert.deepEqual(UI.proofDraft(view, { mode: 'reflection', result: '  Стало легче.  ' }), {
    ok: true, proof: { mode: 'reflection', result: 'Стало легче.' },
  });
  assert.deepEqual(UI.proofDraft(view, { mode: 'photo', referenceId: 'boardmedia:quest@1.local', raw: 'data:image/png;base64,secret' }), {
    ok: true, proof: { mode: 'photo', referenceId: 'boardmedia:quest@1.local' },
  });
});

test('latest pending Shadow question exposes only three authored outcomes', () => {
  const pending = UI.pendingFollowUp({ pending: [{ snapshotId: 'old', question: 'Старый?' }, { snapshotId: 'new', question: 'Помогло?' }] });
  assert.equal(pending.snapshotId, 'new'); assert.equal(pending.question, 'Помогло?');
  assert.deepEqual(pending.outcomes.map((row) => row.id), Completion.OUTCOMES);
});

test('receipt exposes only authored reward and title effect', () => {
  assert.deepEqual(UI.receipt(snapshot(), { unlock: { type: 'title', id: 'Первый выход' }, attack: 'drop' }), {
    snapshotId: 'quest@1.local', title: 'Сходи на пробное занятие', xp: 120, gold: 42, unlock: 'Первый выход',
  });
});

test('completion UI module is pure and owns no DOM, files, State or persistence', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public/board-v2-completion-ui.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b(?:window|document|FileReader|FormData|State|Store|fetch|localStorage)\b/);
});
