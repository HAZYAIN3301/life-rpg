'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const life = require('../public/den-life-v1.js');

assert.equal(life.VERSION, '2.5.0');
assert.deepEqual(life.AMBIENT_SEQUENCE.map((action) => action.id), [
  'toad-blink', 'recovery-stretch', 'window-visit', 'bench-read', 'recovery-glide-tour', 'toad-stretch',
  'recovery-helpers', 'toad-hop-tour', 'bench-rest', 'recovery-cushion-nap', 'resources-ledger',
  'resources-stash', 'toad-bench-nap', 'resources-rest',
]);
assert.deepEqual(life.BODY_FOCUS_SEQUENCE.map((action) => action.id), ['whistle', 'pushup', 'stretch', 'train', 'rest']);
assert.deepEqual(life.MONEY_FOCUS_SEQUENCE.map((action) => action.id), ['budget', 'count', 'focus', 'reserve', 'close']);
assert.equal(life.modeFor({ focusRunning: true, focusCanon: 'money' }), 'money-focus');
assert.equal(life.BODY_FOCUS_SEQUENCE[0].duration, 12000);
assert.ok(life.AMBIENT_SEQUENCE.every((action) => action.gap >= 14000));

const app = read('public/app.js');
const css = read('public/styles.css');
assert.match(app, /'toad-hop-tour': 'hop-tour'/);
assert.match(app, /'toad-bench-nap': 'bench-nap'/);
assert.match(app, /is-toad-ambient-active/);
assert.match(app, /is-recovery-ambient-active/);
assert.match(app, /is-resources-ambient-active/);
assert.match(app, /'recovery-glide-tour': 'glide-tour'/);
assert.match(app, /bench-portal-reach\.png/);
assert.match(app, /prop-portal-core\.png/);
assert.match(css, /bodyPairWhistle4D/);
assert.match(css, /denPropPortalCoreFlow/);
assert.match(css, /denPropReachV4/);
assert.match(read('public/index.html'), /20260807-den-life-v2-5/);
assert.match(read('public/sw.js'), /motion-v4\/bench-sleep\.png/);

console.log('den-life-v2.5: ok');
