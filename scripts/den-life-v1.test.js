'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const life = require('../public/den-life-v1.js');
const controller = read('public/den-life-v1.js');

assert.equal(life.VERSION, '2.0.0');
assert.equal(life.modeFor({ focusRunning: true, focusCanon: 'body' }), 'body-focus');
assert.equal(life.modeFor({ focusRunning: false, focusCanon: 'body' }), 'ambient');
assert.equal(life.modeFor({ focusRunning: true, focusCanon: 'money' }), 'ambient');
assert.deepEqual(life.AMBIENT_SEQUENCE.map((action) => action.id), ['toad-blink', 'bench-rest', 'toad-look', 'window-visit', 'bench-read']);
assert.deepEqual(life.BODY_FOCUS_SEQUENCE.map((action) => action.id), ['coach', 'train']);
assert.equal(life.BODY_FOCUS_SEQUENCE[1].duration, 8400);
assert.match(life.contextKey({ focusRunning: true, focusCanon: 'body', focusSession: 'x' }), /^body-focus:x:body$/);
assert.doesNotMatch(controller, /completedFocusSessions/);
assert.match(controller, /director && director\.key === key/);
assert.match(controller, /onRoomAction/);
assert.match(controller, /onWindowVisit/);
assert.match(controller, /onToadBeat/);

const app = read('public/app.js');
const css = read('public/styles.css');
const index = read('public/index.html');
const sw = read('public/sw.js');

assert.match(app, /function denLifeContext\(/);
assert.match(app, /focusRunning: Boolean\(timer && timer\.running\)/);
assert.match(app, /focusCanon === 'body'/);
assert.match(app, /DenLifeV1\.start/);
assert.match(app, /onPair: \(mode, options\) => playBodyToadScene/);
assert.match(app, /onRoomAction:/);
assert.match(app, /onWindowVisit:/);
assert.match(app, /onToadBeat:/);
assert.match(app, /querySelector\('\.modal-overlay, \.tut-bubble'\)/);
assert.match(app, /syncDenLife\(\)/);
assert.match(css, /Scaling a complete PNG is not acting/);
assert.doesNotMatch(css, /@keyframes denToadObserve/);
assert.match(css, /bodyPairTrainA 1\.4s steps\(1,end\) infinite/);
assert.ok(index.indexOf('den-stage-v1.js') < index.indexOf('den-life-v1.js'));
assert.ok(index.indexOf('den-life-v1.js') < index.indexOf('app.js'));
assert.match(index, /20260804-den-life-v2/);
assert.match(sw, /satoru-v94/);
assert.match(sw, /'den-life-v1\.js'/);

console.log('den-life-v1: ok');
