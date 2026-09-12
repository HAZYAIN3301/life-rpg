'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const Progress = require('../public/personal-progress-v1.js');
const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const MODULE = fs.readFileSync(path.join(__dirname, '../public/personal-progress-v1.js'), 'utf8');
const clone = value => structuredClone(value);

// Execute the actual app's contribution functions and loading normalization.
// levelInfo remains the oracle even once charLevel delegates to the new module:
// comparing two calls to the new module would conceal a changed level curve.
function appFunction(name) {
  const start = APP.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'actual app function exists: ' + name);
  const lineEnd = APP.indexOf('\n', start), first = APP.slice(start, lineEnd);
  let end;
  try { new vm.Script(first); end = lineEnd; }
  catch { end = APP.indexOf('\n}', start) + 2; }
  assert.ok(end > start, 'actual app function boundary: ' + name);
  return APP.slice(start, end);
}
function appConstant(name) {
  const start = APP.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'actual app constant exists: ' + name);
  return APP.slice(start, APP.indexOf(';', start) + 1);
}
const defaultStart = APP.indexOf('const DEFAULT_SETTINGS =');
const defaults = APP.slice(defaultStart, APP.indexOf('\n};', defaultStart) + 3);
const normalize = ['skills', 'curve', 'imported'].map(key => {
  const statement = APP.match(new RegExp('^  State\\.settings\\.' + key + ' = (?:Object\\.assign|State\\.settings\\.)[^\\n]+;', 'm'));
  assert.ok(statement, 'actual app settings normalization: ' + key);
  return statement[0];
}).join('\n');
const ORACLE = [
  defaults,
  ...['GOAL_XP', 'GOAL_BONUS', 'LAYER_SHARE', 'LAYER_MAX', 'EPISODE_XP_PER_DAY', 'EPISODE_XP_DAY_CAP', 'EPISODE_MAX_DAYS'].map(appConstant),
  ...['pad2', 'fmtDate', 'parseDate', 'addDays', 'skillById', 'habitById', 'dayOf', 'uniqueSkillIds',
    'taskSkills', 'taskLayers', 'shareInt', 'goalSkillIds', 'normalizeLoadedGoals', 'episodeDays',
    'episodePerDayXp', 'xpEvents', 'totalImportedXp', 'earnedXp', 'overallXp', 'needForLevel', 'levelInfo'].map(appFunction),
  `State.settings = State.settings || {};
  ${normalize}
  State.tasks = State.tasks || []; State.habits = State.habits || [];
  State.habitlog = State.habitlog || {}; State.episodes = State.episodes || [];
  State.goals = normalizeLoadedGoals(State.goals);
  result = {ok: true, earnedXp: earnedXp(), importedXp: totalImportedXp(), overallXp: overallXp(),
    ...levelInfo(overallXp(), State.settings.curve.base, State.settings.curve.growth),
    curve: {base: State.settings.curve.base, growth: State.settings.curve.growth}};`,
].join('\n');
function oracle(input) {
  const context = { State: clone(input), result: null };
  vm.runInNewContext(ORACLE, context, { timeout: 1000 });
  return JSON.parse(JSON.stringify(context.result));
}
function parity(input) {
  const before = clone(input), actual = Progress.snapshot(input);
  assert.equal(actual.ok, true, JSON.stringify(actual));
  assert.deepEqual(actual, oracle(input));
  assert.deepEqual(input, before, 'snapshot never normalizes owner data in place');
  return actual;
}
function state(extra = {}) {
  return { settings: { skills: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id })) }, ...extra };
}
function reject(input, error) {
  const actual = Progress.snapshot(input);
  assert.equal(actual.ok, false, JSON.stringify(input));
  assert.equal(typeof actual.error, 'string');
  assert.equal('level' in actual, false, 'failure cannot become a level-1 entitlement decision');
  assert.equal('overallXp' in actual, false, 'failure cannot look like zero earned XP');
  if (error) assert.equal(actual.error, error);
}

test('Node and browser exports share a pure snapshot; a new account is level 1', () => {
  const browser = {};
  vm.runInNewContext(MODULE, browser);
  assert.equal(typeof browser.PersonalProgressV1.snapshot, 'function');
  assert.deepEqual(JSON.parse(JSON.stringify(browser.PersonalProgressV1.snapshot({}))), Progress.snapshot({}));
  assert.equal(Object.isFrozen(Progress), true);
  assert.deepEqual(Progress.snapshot(), {
    ok: true, earnedXp: 0, importedXp: 0, overallXp: 0, level: 1, into: 0, need: 100, pct: 0,
    curve: { base: 100, growth: 1.3 },
  });
  parity({});
  parity({ settings: { curve: null, imported: null, skills: null } });
});

test('all personal contributors retain their existing order and stored rewards', () => {
  const result = parity(state({
    tasks: [{ done: true, xpAwarded: 101, skillIds: ['a', 'b'], layers: ['a', 'c', 'missing', 'd', 'e', 'b'] },
      { done: false, xpAwarded: 900 }, { done: true, xpAwarded: 0, layers: ['b'] }],
    habits: [{ id: 'h', skillId: 'a' }],
    habitlog: { '2026-09-12': { h: { xp: 11 }, deleted: { xp: 13 }, unchecked: {} } },
    goals: [{ id: 'g', type: 'short', completedAt: '2026-09-12T12:00:00Z', skillIds: ['a', 'b'], backgroundSkillIds: ['c'] }],
    episodes: [{ from: '2026-09-10', to: '2026-09-12', profile: [{ skillId: 'unknown', intensity: 2 }] }],
  }));
  assert.equal(result.earnedXp, 101 + 60 + 1 + 24 + 75 + 54);
});

test('task multi-main splitting, duplicate background layers and zero XP remain compatible', () => {
  for (const xpAwarded of [0, 1, 7, 11, 5.5, 0.1]) {
    for (const skillIds of [[], ['a'], ['a', 'b', 'a'], ['unknown', 'a']]) {
      parity(state({ tasks: [{ done: true, xpAwarded, skillIds, skillId: 'a', layers: ['a', 'b', 'b', 'missing', 'c', 'd'] }] }));
    }
  }
  assert.equal(parity(state({ tasks: [{ done: true, xpAwarded: 0, layers: ['b', 'b', 'b', 'c'] }] })).earnedXp, 3);
  assert.equal(parity(state({ tasks: [{ done: true, xpAwarded: 5.5, skillIds: ['a', 'b'] }] })).earnedXp, 6);
  assert.equal(parity(state({ tasks: [{ done: true, xpAwarded: 5.5, skillId: 'a' }] })).earnedXp, 5.5);
  parity({ settings: { skills: [{ id: 'a', missing: true }, { id: 'a' }, { id: 'b' }] }, tasks: [{ done: true, layers: ['a', 'b'] }] });
});

test('raw and normalized goals agree for every horizon, absent/null/zero rewards and fallback skills', () => {
  for (const type of [undefined, '', 'mission', 'vision', 'path', 'long', 'mid', 'short', 'recurring', 'legacy']) {
    for (const xpReward of [undefined, null, 0, 5.5, 101]) {
      const input = state({ goals: [{ id: 'g', type, xpReward, completedAt: '2026-09-12', skillIds: ['b', 'b', 'missing', 'a'], backgroundSkillIds: ['c', 'd'] }] });
      const actual = parity(input);
      const normalized = { State: clone(input), result: null };
      vm.runInNewContext(ORACLE, normalized, { timeout: 1000 });
      assert.deepEqual(Progress.snapshot(normalized.State), actual, 'server raw and app normalized snapshots agree');
    }
  }
  assert.equal(parity(state({ goals: [{ completedAt: '2026-09-12' }] })).earnedXp, 300);
  assert.equal(parity(state({ goals: [{ completedAt: '2026-09-12', xpReward: null }] })).earnedXp, 60);
  parity(state({ goals: [{ completedAt: '2026-09-12', skillIds: ['missing'], skillId: 'a', xpReward: 5.5 }] }));
  parity(state({ goals: [{ completedAt: '', xpReward: 90 }, { status: 'done', xpReward: 90 }] }));
});

test('habit records and imported XP count after their original definitions disappear', () => {
  const result = parity({
    settings: { imported: { deleted: { xp: 250.5 }, a: { xp: 0 }, empty: {}, nullable: { xp: null } } },
    habitlog: { '2026-01-01': { missing: { xp: 0.1 }, deleted: { xp: 0.2 }, empty: {} } },
    tasks: [{ done: true, xpAwarded: 0.3 }],
  });
  assert.equal(result.importedXp, 250.5);
  assert.equal(result.overallXp, result.earnedXp + result.importedXp);
  assert.equal(result.level, 3);
});

test('life episodes clamp intensities and scale each row; attention-like rows add no XP', () => {
  const input = state({ episodes: [
    { from: '2026-09-12', to: '2026-09-12', profile: [0, 1, 2, 3, 4, 5, 6, -2, 1.5, '2'].map(intensity => ({ skillId: 'deleted', intensity })) },
    { id: 'attention', outcome: 'escaped', startedAt: '2026-09-12T00:00:00Z', endedAt: '2026-09-12T00:10:00Z' },
    { from: '2026-09-12', to: '2026-09-11', profile: [{ skillId: 'a', intensity: 5 }] },
    { from: null, to: null, profile: null },
  ] });
  parity(input);
  assert.equal(parity(state({ episodes: [{ from: '2026-09-12', to: '2026-09-12', profile: Array.from({ length: 4 }, () => ({ skillId: 'a', intensity: 5 })) }] })).earnedXp, 252);
  const sixty = parity(state({ episodes: [{ from: '2026-01-01', to: '2026-12-31', profile: [{ skillId: 'a', intensity: 5 }] }] }));
  assert.equal(sixty.earnedXp, 60 * 72);
});

test('episode civil-day count matches the real app across leap days and both DST transitions', () => {
  for (const zone of ['Europe/Berlin', 'America/New_York', 'UTC']) {
    const input = state({ episodes: [
      { from: '2024-02-28', to: '2024-03-01', profile: [{ skillId: 'a', intensity: 1 }] },
      { from: '2026-03-01', to: '2026-04-05', profile: [{ skillId: 'a', intensity: 2 }] },
      { from: '2026-10-01', to: '2026-11-10', profile: [{ skillId: 'b', intensity: 3 }] },
    ] });
    const script = `const vm=require('node:vm');const context={State:${JSON.stringify(input)}};vm.runInNewContext(${JSON.stringify(ORACLE)},context);process.stdout.write(JSON.stringify(context.result));`;
    const child = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { ...process.env, TZ: zone }, timeout: 10000 });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(Progress.snapshot(input), JSON.parse(child.stdout), zone);
    assert.equal(Progress.snapshot(input).earnedXp, 3 * 8 + 36 * 18 + 41 * 32);
  }
});

test('default, partial, fractional, constant and decreasing safe curves match levelInfo', () => {
  for (const curve of [{}, { base: 37 }, { growth: 1.5 }, { base: 0.5, growth: 1.3 },
    { base: 17.5, growth: 1.1 }, { base: 100, growth: 1 }, { base: 100, growth: 0.99 }]) {
    for (const amount of [0, 1, 99, 100, 230, 500.5, 999]) parity({ settings: { curve, imported: { source: { xp: amount } } } });
  }
  for (const amount of [99.9, 100, 229.9, 230, 398.9, 399]) parity({ settings: { imported: { source: { xp: amount } } } });
  const large = Progress.snapshot({ settings: { curve: { base: 1, growth: 1 }, imported: { source: { xp: 1000000000000 } } } });
  assert.equal(large.ok, true);
  assert.equal(large.level, 1000000000001);
  assert.equal(large.into, 0);
});

test('deterministic mixed owner snapshots preserve parity through accumulated fractional XP', () => {
  let seed = 1287;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  for (let run = 0; run < 40; run++) {
    const input = state({ tasks: [], goals: [], habitlog: {}, episodes: [] });
    input.settings.curve = { base: 35 + run, growth: 1.05 + random() };
    input.settings.imported = { old: { xp: random() * 500 } };
    for (let i = 0; i < 12; i++) {
      input.tasks.push({ done: random() > 0.2, xpAwarded: random() * 100, skillIds: random() > 0.5 ? ['a', 'b', 'b'] : [], layers: ['b', 'c', 'missing', 'd'] });
      input.goals.push({ id: String(i), completedAt: i % 2 ? '2026-09-12' : null, type: 'recurring', xpReward: random() * 40, skillIds: ['a', 'b', 'missing'] });
      input.habitlog['2026-09-' + String(i + 1).padStart(2, '0')] = { old: { xp: random() * 20 } };
    }
    input.episodes.push({ from: '2026-09-01', to: '2026-09-12', profile: [{ skillId: 'a', intensity: random() * 5 }, { skillId: 'gone', intensity: random() * 5 }] });
    parity(input);
  }
});

test('malformed collections and calculation fields fail without a fake level', () => {
  for (const key of ['settings', 'tasks', 'habits', 'habitlog', 'goals', 'episodes']) reject({ [key]: null });
  for (const input of [null, [], 12, { settings: [] }, { tasks: {} }, { tasks: [null] },
    { habits: 'bad' }, { habits: [false] }, { goals: [null] }, { episodes: [null] },
    { habitlog: [] }, { habitlog: { day: [] } }, { habitlog: { day: { h: null } } },
    { settings: { skills: {} } }, { settings: { skills: [null] } },
    { settings: { imported: [] } }, { settings: { imported: { a: null } } },
    { tasks: [{ done: 'true' }] }, { tasks: [{ skillIds: 'a' }] }, { tasks: [{ layers: {} }] },
    { goals: [{ skillIds: [4] }] }, { goals: [{ completedAt: true }] }, { goals: [{ type: 'constructor', completedAt: '2026-09-12' }] },
    { episodes: [{ profile: {} }] }, { episodes: [{ profile: [null] }] },
    { episodes: [{ profile: [{ skillId: 'a', intensity: 'broken' }] }] },
    { episodes: [{ profile: [{ skillId: 'a', intensity: true }] }] },
    { episodes: [{ from: '2026-02-29', to: '2026-03-01' }] },
    { episodes: [{ from: '2026-2-01', to: '2026-03-01' }] }]) reject(input);
  const inherited = Object.create({ extra: { xp: 900 } });
  reject({ settings: { imported: inherited } });
});

test('nonfinite, negative and nonnumeric stored XP never create entitlement evidence', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, '100', true, {}, Number.MAX_SAFE_INTEGER + 1]) {
    reject({ tasks: [{ done: true, xpAwarded: value }] });
    reject({ habitlog: { day: { h: { xp: value } } } });
    reject({ goals: [{ completedAt: '2026-09-12', xpReward: value }] });
    reject({ settings: { imported: { a: { xp: value } } } });
  }
  for (const value of [NaN, Infinity, -Infinity]) reject({ episodes: [{ profile: [{ skillId: 'a', intensity: value }] }] });
  reject({ tasks: [{ done: true, xpAwarded: Number.MAX_SAFE_INTEGER }, { done: true, xpAwarded: 1 }] }, 'unsafe_xp');
});

test('explicit zero/null, nonfinite or exhausted curves fail closed in bounded time', () => {
  for (const curve of [[], { base: 0 }, { base: null }, { base: 0.1 }, { base: -100 },
    { base: Infinity }, { growth: 0 }, { growth: null }, { growth: NaN }, { growth: -1 },
    { base: '100' }, { growth: '1.3' }, { base: Number.MAX_SAFE_INTEGER + 1 }]) reject({ settings: { curve } });
  reject({ settings: { curve: { base: 1, growth: 0.1 }, imported: { a: { xp: 1 } } } }, 'unsafe_curve');
  reject({ settings: { curve: { base: 100, growth: Number.MAX_VALUE }, imported: { a: { xp: 100 } } } }, 'unsafe_curve');
  reject({ settings: { curve: { base: 1, growth: 1.00000000001 }, imported: { a: { xp: 100001 } } } }, 'curve_limit');
  reject({ settings: { curve: { base: 1, growth: 1 }, imported: { a: { xp: Number.MAX_SAFE_INTEGER } } } }, 'unsafe_curve');
});

test('bounded episode work cannot return a partial total or mutate saved rights', () => {
  const input = { settings: { purchases: ['already-owned'], imported: { source: { xp: 1000 } } },
    episodes: [{ from: '2026-01-01', to: '2026-12-31', profile: Array.from({ length: 17000 }, () => ({ skillId: 'a', intensity: 1 })) }] };
  const before = clone(input);
  reject(input, 'work_limit');
  assert.deepEqual(input, before);
});
