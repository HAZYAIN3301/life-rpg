'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const stage = require('../public/den-stage-v1.js');

const traveller = { id: 'traveller', anchorX: 52.03, width: 27.5, footprint: 27.5 };
const residents = {
  body: { id: 'body', species: 'bodyToad', anchorX: 28, width: 19.2, footprint: 15.7 },
  recovery: { id: 'recovery', species: 'recoverySlug', anchorX: 74, width: 14.6, footprint: 12.2 },
  resources: { id: 'resources', species: 'resourcesPenguin', anchorX: 89, width: 12.8, footprint: 10.8 },
};

function reservation(plan) { return { anchorX: plan.anchorX, footprint: plan.pairFootprint }; }

test('guardian and Traveller face their measured destination instead of a hard-coded side', () => {
  assert.equal(stage.VERSION, '1.12.0');
  const body = stage.planMeeting({
    kind: 'body', avatar: traveller, actor: residents.body,
    spectators: [residents.recovery, residents.resources],
  });
  assert.equal(body.avatar.direction, 'left', 'Traveller must walk toward a guardian on his left');
  assert.equal(body.actor.direction, 'right', 'Gamabunta must hop toward Traveller');
  assert.ok(body.avatar.translate < 0);
  assert.ok(body.actor.translate > 0);

  const resources = stage.planMeeting({
    kind: 'resources', avatar: traveller, actor: residents.resources,
    spectators: [residents.body, residents.recovery],
  });
  assert.equal(resources.avatar.direction, 'right');
  assert.equal(resources.actor.direction, 'left');
});

test('spectators stay present and only move when the authored pair footprint needs their place', () => {
  const body = stage.planMeeting({
    kind: 'body', avatar: traveller, actor: residents.body,
    spectators: [residents.recovery, residents.resources],
  });
  assert.deepEqual(body.spectatorTargets, [], 'east residents already clear the body meeting');

  const resources = stage.planMeeting({
    kind: 'resources', avatar: traveller, actor: residents.resources,
    spectators: [residents.body, residents.recovery],
  });
  assert.equal(resources.spectatorTargets.length, 1);
  assert.equal(resources.spectatorTargets[0].id, 'recovery');
  assert.equal(resources.spectatorTargets[0].targetAnchor, 42);
  const recoveryTarget = { ...resources.spectatorTargets[0], anchorX: resources.spectatorTargets[0].targetAnchor };
  assert.equal(stage.overlaps(recoveryTarget, reservation(resources)), false);
  assert.equal(stage.overlaps(recoveryTarget, residents.body), false);

  const recovery = stage.planMeeting({
    kind: 'recovery', avatar: traveller, actor: residents.recovery,
    spectators: [residents.body, residents.resources],
  });
  assert.equal(recovery.spectatorTargets.length, 1);
  assert.equal(recovery.spectatorTargets[0].id, 'resources');
  assert.equal(recovery.spectatorTargets[0].targetAnchor, 94.5);
  const resourcesTarget = { ...recovery.spectatorTargets[0], anchorX: recovery.spectatorTargets[0].targetAnchor };
  assert.equal(stage.overlaps(resourcesTarget, reservation(recovery)), false);
});

test('runtime contract keeps witnesses visible and binds movement to director variables', () => {
  const css = read('public/styles.css');
  const source = read('public/den-stage-v1.js');
  assert.match(css, /Den spatial director v1\.12/);
  assert.match(css, /--den-meeting-avatar-shift/);
  assert.match(css, /--den-meeting-actor-shift/);
  assert.match(css, /is-den-spectator-reflow/);
  assert.match(css, /is-body-pair-active \.den-scene > \.den-pet:not\(\.den-body-toad\)[\s\S]{0,420}opacity: 1 !important/);
  assert.match(source, /installSpectatorMotion/);
  assert.match(source, /data\.shadowFlight|dataset\.shadowFlight/);
  assert.equal(typeof stage.prepareMeeting, 'function');
  assert.equal(typeof stage.clearMeetingPlan, 'function');
});
