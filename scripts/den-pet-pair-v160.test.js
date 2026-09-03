'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const api = require('../public/den-pet-pair-v1.js');

test('the complete six-pair matrix is explicit while unavailable art cannot be substituted', () => {
  assert.equal(api.VERSION, '1.0.0');
  assert.deepEqual(Object.keys(api.SCENES), [
    'body-recovery', 'body-resources', 'recovery-resources',
    'shadow-body', 'shadow-recovery', 'shadow-resources',
  ]);
  assert.equal(api.SCENES['body-recovery'].ready, true);
  assert.equal(Object.values(api.SCENES).filter((scene) => scene.ready).length, 1);
  assert.equal(api.pickScene({ residents: ['body', 'recovery'], energyPct: 50, focusCanon: 'body' }).id, 'body-recovery');
  assert.equal(api.pickScene({ residents: ['shadow', 'resources'], energyPct: 80, focusCanon: 'money' }), null);
});
test('autonomy gates encode one late scene, long cooldown and no reward surface', () => {
  assert.equal(api.MIN_ENTRY_MS, 45_000);
  assert.equal(api.COOLDOWN_MIN_MS, 8 * 60_000);
  assert.equal(api.COOLDOWN_MAX_MS, 12 * 60_000);
  const source = read('public/den-pet-pair-v1.js');
  assert.match(source, /played: false/);
  assert.match(source, /ready: \(\) => Number\(window\.DenLifeV1\.inspect\(\)\?\.step \|\| 0\) >= 4|current\.ready\(\)/);
  assert.doesNotMatch(source, /State\.|Store\.|goldEarned|xpAwarded|bond\s*[+]=/);
});

test('body-recovery ships two normalized atomic frames and the runtime swaps participants only', () => {
  const report = JSON.parse(read('art-factory/den-pet-pairs-v1-20260815/qa-report.json'));
  assert.equal(report.pass, true);
  assert.equal(report.frames.length, 2);
  for (const frame of report.frames) {
    assert.equal(frame.pass, true);
    assert.deepEqual(frame.canvas, [1536, 1536]);
    assert.equal(frame.mode, 'RGBA');
    assert.equal(frame.edgeAlphaPixels, 0);
    const runtime = path.join(ROOT, 'public/art/pets/den-pet-pairs-v1/body-recovery', `${frame.id}.png`);
    assert.ok(fs.existsSync(runtime), runtime);
  }
  const css = read('public/styles.css');
  assert.match(css, /denPetRecoveryA/);
  assert.match(css, /denPetRecoveryB/);
  assert.match(css, /is-pet-pair-active \.den-body-toad[\s\S]{0,180}is-pet-pair-active \.den-recovery-slug/);
  assert.match(css, /is-pet-pair-active \.den-avatar-core[\s\S]{0,260}opacity: 1 !important/);
});

test('the shell loads and caches the module and every first-batch asset', () => {
  const index = read('public/index.html');
  const sw = read('public/sw.js');
  assert.match(index, /den-pet-pair-v1\.js\?v=20260815-shadow-pet-v160-1/);
  assert.match(sw, /const CACHE = 'satoru-v227'/);
  assert.match(sw, /den-pet-pair-v1\.js/);
  for (const frame of ['body-recovery-stretch-a', 'body-recovery-stretch-b']) {
    assert.match(sw, new RegExp(`den-pet-pairs-v1/body-recovery/${frame}\\.png`));
  }
  for (const form of ['spark', 'spirit', 'guardian', 'keeper']) {
    assert.match(sw, new RegExp(`shadow-den-v1/pair-v1/attune-${form}\\.png`));
  }
});

test('Shadow keeps exactly three permanent actions and internal phases stay hidden', () => {
  const app = read('public/app.js');
  const section = app.slice(app.indexOf('den-shadow-actions'), app.indexOf("if (bodyGuardian) guardianSections.push"));
  for (const label of ['Позвать Тень', 'Поговорить', 'Проверить курс']) assert.match(section, new RegExp(label));
  for (const label of ['Прислушаться', 'Подумать вместе', 'Свериться', 'Побыть рядом', 'Разделить тишину', 'Коснуться']) {
    assert.doesNotMatch(section, new RegExp(label));
  }
  assert.match(app, /data-action="shadow-den-pair" data-mode="attune"/);
  assert.match(app, /data-action="shadow-den-course"/);
});
