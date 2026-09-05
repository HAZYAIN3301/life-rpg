'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const APP = read('public/app.js');
const INDEX = read('public/index.html');
const SW = read('public/sw.js');
const CSS = read('public/styles.css');
const CommitmentV2 = require('../public/commitment-v2.js');
const CommitmentStoreV1 = require('../public/commitment-store-v1.js');
const AttentionPolicyV1 = require('../public/attention-policy-v1.js');

function functionSource(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} must exist`);
  const openParen = source.indexOf('(', match.index + match[0].length - 1);
  let parens = 0, paramsQuote = '', paramsEscaped = false, brace = -1;
  for (let index = openParen; index < source.length; index += 1) {
    const char = source[index];
    if (paramsQuote) {
      if (paramsEscaped) paramsEscaped = false;
      else if (char === '\\') paramsEscaped = true;
      else if (char === paramsQuote) paramsQuote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { paramsQuote = char; continue; }
    if (char === '(') parens += 1;
    else if (char === ')' && --parens === 0) { brace = source.indexOf('{', index + 1); break; }
  }
  assert.ok(brace >= 0, `${name} must have a body`);
  let depth = 0, quote = '', escaped = false, lineComment = false, blockComment = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail(`${name} body is not closed`);
}

function clientHarness() {
  const names = [
    'commitmentMigration', 'commitmentNormalize', 'commitmentTransition', 'commitmentEngine',
    'attentionCommitmentId', 'attentionMergedPolicyState', 'attentionCommitmentState',
  ];
  const context = {
    window: { CommitmentV2, AttentionPolicyV1 },
    State: { _commitmentMigrationDropped: [] },
    todayStr: () => '2026-09-06',
  };
  vm.createContext(context);
  vm.runInContext(`let _commitmentCompatEngine = null;\n${names.map((name) => functionSource(APP, name)).join('\n')}\nthis.client = { commitmentEngine, attentionMergedPolicyState, attentionCommitmentState };`, context);
  return context;
}

function legacyStep() {
  return {
    id: 'quest:q1', kind: 'step', title: 'Один шаг', win: 'Готово',
    edge: { kind: 'time', at: '18:00' }, core: true, modes: [], history: [], decidedOn: '2026-09-01',
  };
}

test('CommitmentV2 loads after untouched v1, before the store and app, and is cached offline', () => {
  const v1 = INDEX.indexOf('src="commitment-v1.js');
  const v2 = INDEX.indexOf('src="commitment-v2.js');
  const store = INDEX.indexOf('src="commitment-store-v1.js');
  const app = INDEX.indexOf('src="app.js');
  assert.ok(v1 >= 0 && v2 > v1 && store > v2 && app > store);
  assert.equal((SW.match(/'commitment-v2\.js'/g) || []).length, 1);
  assert.match(SW, /const CACHE = 'satoru-v244'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v244'/);
});

test('one Attention form writes an exact-label duration agreement and preserves legacy history', () => {
  const context = clientHarness();
  const raw = { version: 1, mode: 'default', items: [legacyStep()], log: { '2026-09-05': { 'quest:q1': 'win' } } };
  const built = context.client.attentionCommitmentState(raw, {
    targetLabel: 'TikTok', outcome: 'ролик опубликован', win: 'вечер остаётся мой', minutes: '12', purpose: 'publish',
  }, 'tiktok-policy');
  assert.equal(built.ok, true);
  assert.equal(built.state.version, 2);
  assert.equal(built.state.items.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(built.state.log)), raw.log);
  const attention = built.state.items.find((item) => item.kind === 'attention');
  assert.equal(attention.target, 'TikTok');
  assert.equal(attention.title, 'TikTok');
  assert.equal(attention.win, 'вечер остаётся мой');
  assert.deepEqual(JSON.parse(JSON.stringify(attention.edge)), { kind: 'duration', minutes: 12 });
  assert.equal(CommitmentStoreV1.validateCommitmentState(JSON.parse(JSON.stringify(built.state))), true);

  const revised = context.client.commitmentEngine().revise(built.state, 'quest:q1', { win: 'Новый финиш' }, '2026-09-06');
  assert.equal(revised.ok, true);
  assert.equal(revised.state.version, 2);
  assert.equal(revised.state.items.find((item) => item.kind === 'attention').target, 'TikTok');
  assert.equal(revised.state.items.find((item) => item.id === 'quest:q1').win, 'Новый финиш');
});

test('a distinct missing win and dropped migration rows fail closed and are visible in the UI contract', () => {
  const context = clientHarness();
  const noWin = context.client.attentionCommitmentState(undefined, {
    targetLabel: 'TikTok', outcome: 'ролик опубликован', win: '', minutes: '12',
  }, 'p1');
  assert.equal(noWin.ok, false);
  assert.equal(noWin.error, 'invalid');

  const broken = context.client.attentionCommitmentState({ version: 1, mode: 'default', items: [{ id: 'bad' }], log: {} }, {
    targetLabel: 'TikTok', outcome: 'ролик опубликован', win: 'вечер остаётся мой', minutes: '12',
  }, 'p1');
  assert.equal(broken.ok, false);
  assert.equal(broken.error, 'corrupt');
  assert.equal(context.State._commitmentMigrationDropped.length, 1);

  assert.match(APP, /win\.name = 'win'; win\.maxLength = 120; win\.required = true/);
  assert.match(APP, /mode: form\.mode\.value, outcome: form\.outcomeHint\.value,[\s\S]{0,100}namedItem\('win'\)/);
  assert.match(APP, /if \(!input\.win\)/);
  assert.match(APP, /currentMigration\.dropped\.length[\s\S]{0,260}Ничего не перезаписано/);
  assert.match(APP, /attention-commitment-warning[\s\S]{0,220}role="alert"/);
  assert.match(CSS, /\.attention-commitment-warning/);
});

test('Attention save is compensated when the agreement commit fails and adds no reward mechanic', () => {
  const save = functionSource(APP, 'saveAttentionSetup');
  assert.match(save, /AttentionStore\.save\(bundle\)[\s\S]*commitmentDataCommit/);
  assert.match(save, /if \(!commitmentSaved\)[\s\S]*AttentionStore\.save\(previousBundle\)/);
  assert.match(save, /targetLabel[\s\S]*attentionCommitmentState/);
  assert.doesNotMatch(save, /\b(?:xp|gold|streak|reward|loot|confetti)\b/i);
  assert.match(APP, /без URL и содержимого экрана/);
});

test('an existing Attention rule can be linked without deleting its other purposes', () => {
  const context = clientHarness();
  const current = {
    version: 1,
    policies: [{
      id: 'tiktok-policy', name: 'TikTok', sync: true, modes: ['focus'],
      emergency: { passes: 2, perDays: 7, delaySeconds: 60 },
      purposes: [
        { purpose: 'publish', defaultMinutes: 12, maxMinutes: 17, mode: 'adaptive', extensions: 1, extensionMinutes: 5, outcome: 'выложить ролик' },
        { purpose: 'reply', defaultMinutes: 8, maxMinutes: 8, mode: 'control', extensions: 0, extensionMinutes: 5, outcome: 'ответить людям' },
      ],
    }],
  };
  const replacement = AttentionPolicyV1.upsert(current, {
    id: 'tiktok-policy', name: 'TikTok creator', sync: false, modes: [],
    emergency: AttentionPolicyV1.DEFAULT_EMERGENCY,
    purposes: [{ purpose: 'publish', defaultMinutes: 15, maxMinutes: 20, mode: 'adaptive', extensions: 1, extensionMinutes: 5, outcome: 'вечер остаётся мой' }],
  });
  assert.equal(replacement.ok, true);
  const merged = context.client.attentionMergedPolicyState(current, replacement.state, 'tiktok-policy', 'publish');
  assert.equal(merged.ok, true);
  const policy = AttentionPolicyV1.policyById(JSON.parse(JSON.stringify(merged.state)), 'tiktok-policy');
  assert.equal(policy.name, 'TikTok creator');
  assert.equal(policy.sync, true);
  assert.deepEqual(policy.modes, ['focus']);
  assert.equal(policy.emergency.passes, 2);
  assert.equal(policy.purposes.length, 2);
  assert.equal(policy.purposes.find((rule) => rule.purpose === 'publish').defaultMinutes, 15);
  assert.equal(policy.purposes.find((rule) => rule.purpose === 'reply').outcome, 'ответить людям');
  assert.match(APP, /attention-edit-policy'[\s\S]{0,180}openAttentionPolicySetup/);
});

test('new Attention agreement copy is complete in every supported non-Russian locale', () => {
  const keys = [
    'Уговор связан с Тенью',
    'Уговор ещё не связан',
    'Изменить уговор',
    'Связать уговор',
    'Что эта граница сохраняет для тебя',
    'Например: вечер остаётся моим',
    'Сохранить правило и уговор',
    'Обязательно: назови, что эта граница сохраняет для тебя. Без выигрыша правило не создаётся.',
    'Часть уговоров не читается. Ничего не перезаписано — открой восстановление данных.',
    'История устройства остаётся локальной. Тень получает только названный тобой уговор, без URL и содержимого экрана.',
  ];
  for (const key of keys) {
    const marker = `'${key}': {`;
    assert.equal(APP.split(marker).length - 1, 1, `${key} must have one translation entry`);
    const translation = APP.slice(APP.indexOf(marker), APP.indexOf(marker) + 1200);
    const positions = [' en:', ' de:', ' uk:', ' es:'].map((locale) => translation.indexOf(locale));
    assert.ok(positions.every((position) => position >= 0), `${key} must cover en/de/uk/es`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${key} locales must keep canonical order`);
  }
});
