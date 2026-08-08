'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stage = require('../public/den-stage-v1.js');

assert.equal(stage.VERSION, '1.8.0');
assert.equal(stage.PROFILES.bodyToad.width, 19.2);
assert.equal(stage.PROFILES.bodyToad.footprint, 15.7);
const mixed = stage.layoutPets([
  { id: 'body', species: 'bodyToad' },
  { id: 'recovery', species: 'recoverySlug' },
  { id: 'money', species: 'resourcesPenguin' },
]);
const seated = stage.layoutPets([
  { id: 'body', species: 'bodyToad' },
  { id: 'recovery', species: 'recoverySlug' },
  { id: 'money', species: 'resourcesPenguin' },
], { posture: 'seated' });
assert.equal(mixed.length, 3);
assert.equal(mixed.find((entry) => entry.id === 'body').slot, 'west');
assert.equal(mixed.find((entry) => entry.id === 'money').slot, 'east');
assert.equal(mixed.find((entry) => entry.id === 'recovery').slot, 'mid-east');
assert.equal(stage.PET_SLOTS.find((slot) => slot.id === 'mid-east').x, 74);
assert.equal(stage.PET_SLOTS.find((slot) => slot.id === 'east').x, 89);
assert.equal(stage.SEATED_PET_SLOTS.find((slot) => slot.id === 'mid-east').x, 56.5);
assert.equal(stage.SEATED_PET_SLOTS.find((slot) => slot.id === 'east').x, 93.25);
assert.equal(new Set(mixed.map((entry) => entry.slot)).size, 3);
for (let i = 0; i < mixed.length; i += 1) {
  for (let j = i + 1; j < mixed.length; j += 1) assert.equal(stage.overlaps(mixed[i], mixed[j]), false);
}
const homeAvatar = { anchorX: (38.2813 + 65.7813) / 2, footprint: 65.7813 - 38.2813 };
for (const entry of mixed) assert.equal(stage.overlaps(entry, homeAvatar), false, `${entry.id} overlaps the Traveller home footprint`);
const seatedActor = { anchorX: (65 + 86.75) / 2, footprint: 86.75 - 65 };
for (let i = 0; i < seated.length; i += 1) {
  assert.equal(stage.overlaps(seated[i], seatedActor), false, `${seated[i].id} overlaps the seated Traveller footprint`);
  for (let j = i + 1; j < seated.length; j += 1) assert.equal(stage.overlaps(seated[i], seated[j]), false);
}
assert.match(stage.styleVars(mixed[0]), /--den-stage-center:/);
assert.match(stage.styleVars(seated[0], { prefix: 'seated' }), /--den-stage-seated-center:/);

const canonical = [
  { id: 'body', species: 'bodyToad' },
  { id: 'recovery', species: 'recoverySlug' },
  { id: 'money', species: 'resourcesPenguin' },
];
const permutations = (items) => items.length < 2
  ? [items]
  : items.flatMap((item, index) => permutations(items.filter((_, itemIndex) => itemIndex !== index)).map((tail) => [item, ...tail]));
for (let size = 1; size <= canonical.length; size += 1) {
  for (const order of permutations(canonical).map((items) => items.slice(0, size))) {
    const unique = [...new Map(order.map((item) => [item.id, item])).values()];
    for (const posture of ['home', 'seated']) {
      const layout = stage.layoutPets(unique, { posture });
      for (let i = 0; i < layout.length; i += 1) {
        const actor = posture === 'seated' ? seatedActor : homeAvatar;
        assert.equal(stage.overlaps(layout[i], actor), false, `${posture}:${layout[i].id} overlaps the Traveller`);
        for (let j = i + 1; j < layout.length; j += 1) {
          assert.equal(stage.overlaps(layout[i], layout[j]), false, `${posture}:${layout[i].id}/${layout[j].id} overlap`);
        }
      }
    }
  }
}

const stageSource = read('public/den-stage-v1.js');
const css = read('public/styles.css');
assert.match(stageSource, /installHopFrames\(toad, 'meeting'\)/);
assert.match(stageSource, /installHopFrames\(toad, 'home'\)/);
assert.match(stageSource, /installGlideFrames\(slug, 'meeting'\)/);
assert.match(stageSource, /installGlideFrames\(slug, 'home'\)/);
assert.match(stageSource, /installWaddleFrames\(penguin, 'meeting'\)/);
assert.match(stageSource, /installWaddleFrames\(penguin, 'home'\)/);
assert.match(css, /is-body-pair-approaching \.den-avatar-core[\s\S]*translate: 24% 1%/);
assert.match(css, /bodyToadMeetingArc/);
assert.match(css, /bodyToadMeetingReturnArc/);
assert.match(css, /data-toad-direction="left"/);
assert.match(css, /recoverySlugTourAway[\s\S]*translate: 0 -18%/);
assert.match(css, /is-energy-tired\.is-energy-motion-active/);
assert.match(read('public/app.js'), /function syncDenViewportGate\(\)/);
assert.match(read('public/app.js'), /function pauseDenSceneForViewport\(shell\)/);
assert.match(read('public/app.js'), /function denLifeCanAct\(shell\)[\s\S]*energyPct\(\) <= 30/);
assert.match(read('public/app.js'), /options\.automatic && \(energyPct\(\) <= 30/);
assert.match(read('public/index.html'), /20260808-den-stage-v1-8/);
const swCache = read('public/sw.js').match(/const CACHE = 'satoru-v(\d+)'/);
assert.ok(swCache, 'service-worker cache version must be declared');
assert.ok(Number(swCache[1]) >= 105, 'den stage requires cache v105 or newer');

console.log('den-stage-v1.8: ok');
