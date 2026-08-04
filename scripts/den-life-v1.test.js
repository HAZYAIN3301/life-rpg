'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const life = require('../public/den-life-v1.js');
const controller = read('public/den-life-v1.js');

assert.equal(life.VERSION, '1.0.0');
assert.equal(life.modeFor({ focusRunning: true, focusCanon: 'body' }), 'body-focus');
assert.equal(life.modeFor({ focusRunning: false, focusCanon: 'body' }), 'ambient');
assert.equal(life.modeFor({ focusRunning: true, focusCanon: 'money' }), 'ambient');
assert.equal(life.AMBIENT_ACTIONS.length, 3);
assert.deepEqual(life.AMBIENT_ACTIONS.map((action) => action.id), ['observe', 'brace', 'settle']);
for (const action of life.AMBIENT_ACTIONS) {
  assert.ok(action.duration >= 2000 && action.duration <= 3000);
  assert.ok(action.gap >= 12000, `${action.id} must leave a calm interval`);
}
assert.equal(life.nextAmbient(0).id, 'observe');
assert.equal(life.nextAmbient(3).id, 'observe');
assert.ok(controller.indexOf('if (played)') < controller.indexOf('completedFocusSessions.add'), 'failed pair attempts must remain retryable');

const app = read('public/app.js');
const css = read('public/styles.css');
const index = read('public/index.html');
const sw = read('public/sw.js');

assert.match(app, /function denLifeContext\(/);
assert.match(app, /focusRunning: Boolean\(timer && timer\.running\)/);
assert.match(app, /focusCanon === 'body'/);
assert.match(app, /DenLifeV1\.start/);
assert.match(app, /onPair: \(mode, options\) => playBodyToadScene/);
assert.match(app, /querySelector\('\.modal-overlay, \.tut-bubble'\)/);
assert.match(app, /syncDenLife\(\)/);
assert.match(css, /data-ambient="observe"/);
assert.match(css, /@keyframes denToadBrace/);
assert.match(css, /prefers-reduced-motion: reduce[\s\S]*is-den-ambient/);
assert.ok(index.indexOf('den-stage-v1.js') < index.indexOf('den-life-v1.js'));
assert.ok(index.indexOf('den-life-v1.js') < index.indexOf('app.js'));
assert.match(index, /20260804-den-life-v1/);
assert.match(sw, /satoru-v93/);
assert.match(sw, /'den-life-v1\.js'/);

console.log('den-life-v1: ok');
