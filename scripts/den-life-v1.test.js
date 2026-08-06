'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const life = require('../public/den-life-v1.js');

assert.equal(life.VERSION, '2.2.0');
assert.deepEqual(life.AMBIENT_SEQUENCE.map((action) => action.id), [
  'toad-blink', 'toad-hop-tour', 'bench-rest', 'toad-stretch', 'window-visit', 'toad-bench-nap', 'bench-read',
]);
assert.deepEqual(life.BODY_FOCUS_SEQUENCE.map((action) => action.id), ['whistle', 'pushup', 'stretch', 'train']);
assert.equal(life.BODY_FOCUS_SEQUENCE[0].duration, 4200);

const app = read('public/app.js');
const css = read('public/styles.css');
assert.match(app, /'toad-hop-tour': 'hop-tour'/);
assert.match(app, /'toad-bench-nap': 'bench-nap'/);
assert.match(app, /is-toad-ambient-active/);
assert.match(app, /traveller-portal-reach\.png/);
assert.match(app, /prop-portal-core\.png/);
assert.match(css, /bodyPairWhistle4D/);
assert.match(css, /denPropPortalCoreFlow/);
assert.match(css, /denPropReachV4/);
assert.match(read('public/index.html'), /20260806-den-life-v2-2/);
assert.match(read('public/sw.js'), /motion-v4\/bench-sleep\.png/);

console.log('den-life-v2.2: ok');
