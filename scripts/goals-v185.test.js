'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

test('every visible goal has a direct, atomic achieved toggle', () => {
  const item = APP.slice(APP.indexOf('function goalItem'), APP.indexOf('function goalTreeHTML'));
  assert.match(item, /class="goal-quick-complete"/);
  assert.match(item, /data-action="goal-toggle-complete"/);
  assert.match(item, /aria-pressed="\$\{done \? 'true' : 'false'\}"/);
  const action = APP.slice(APP.indexOf("action === 'goal-toggle-complete'"), APP.indexOf("action === 'delete-step'"));
  assert.match(action, /manualComplete = true/);
  assert.match(action, /commitGoalMutation\(`complete:/);
  assert.match(action, /publishLeaderboard\(\)/);
  assert.match(CSS, /\.goal-quick-complete/);
});

test('goal detail prioritizes description and outcome before disclosed plan/context', () => {
  const detail = APP.slice(APP.indexOf('function goalDetailContentHTML'), APP.indexOf('function goalCreateFormHTML'));
  assert.ok(detail.indexOf('goal-detail-description') < detail.indexOf('goal-next-card'));
  assert.ok(detail.indexOf('goal-next-card') < detail.indexOf("t('План цели')"));
  assert.match(detail, /goal-detail-complete/);
  assert.match(detail, /goal-task-form goal-next-inline/);
  assert.match(detail, /Конкретное действие, с которого начнёшь/);
  assert.match(CSS, /\.goal-next-inline/);
  assert.doesNotMatch(detail.slice(detail.indexOf("t('Контекст цели')"), detail.indexOf('goal-detail-more')), /goal-desc/);
});

test('AI goal import creates a usable graph instead of empty cards', () => {
  for (const field of ['steps', 'nextAction', 'project', 'spheres', 'backgroundSpheres']) {
    assert.match(SERVER, new RegExp(field));
    assert.match(APP, new RegExp(field));
  }
  const apply = APP.slice(APP.indexOf('function applyProposals'), APP.indexOf('// ---- ИИ тех-поддержка'));
  assert.match(apply, /steps = metric \? \[\]/);
  assert.match(apply, /goalId: g\.id/);
  assert.match(apply, /State\.goalGroups\.push\(group\)/);
  assert.doesNotMatch(apply, /Store\.(?:save|saveNow|updateNow)\(/);
  assert.match(apply, /ensureTrees\(\{ persist: false \}\)/);
  const accepted = APP.slice(APP.indexOf('async function applyAcceptedProposals'), APP.indexOf('function applyProposals'));
  for (const slot of ['settings', 'tasks', 'goals', 'goalGroups', 'tree']) assert.match(accepted, new RegExp(`structuredClone\\(State\\.${slot}`));
  assert.match(accepted, /await proposalDataCommit\(data\)/);
  assert.match(accepted, /groups: draft\.goalGroups, skilltree: draft\.tree/);
  assert.ok(accepted.indexOf('Object.assign(State, live)') < accepted.indexOf('await proposalDataCommit(data)'),
    'unconfirmed draft remains exposed during persistence');
});

test('sphere picker exposes hierarchy, per-sphere color, multiple primary and background roles', () => {
  const picker = APP.slice(APP.indexOf('function sphereChoiceRowHTML'), APP.indexOf('// Опции <select>'));
  assert.match(picker, /--sphere-depth/);
  assert.match(picker, /--sphere-color/);
  assert.match(picker, /data-action="sphere-pick"/);
  assert.match(picker, /data-action="sphere-background-pick"/);
  assert.match(picker, /name="skillIds"/);
  assert.match(picker, /data-background-name/);
  assert.match(CSS, /\.sphere-choice-row/);
  assert.match(CSS, /color-mix\(in srgb, var\(--sphere-color\)/);
  assert.doesNotMatch(CSS.slice(CSS.indexOf('.sphere-choice-row'), CSS.indexOf('.sphere-empty')), /background:\s*var\(--accent\)/);
});

test('projects and map use understandable, collapsible progressive disclosure', () => {
  assert.match(APP, /t\('\+ Проект'\)/);
  assert.match(APP, /t\('Без проекта'\)/);
  assert.match(APP, /class="goal-map-section"/);
  assert.match(APP, /<details class="goals-group-section/);
  assert.match(CSS, /\.goal-map-section/);
  assert.match(CSS, /\.goals-group-section > summary/);
});
