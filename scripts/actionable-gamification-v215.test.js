'use strict';

/* Actionable Gamification v215 — release source contract.
 *
 * This suite deliberately checks the assembled browser shell, not only the pure
 * modules.  The failures are phrased as release defects so a green unit test for
 * an unconnected module cannot be mistaken for a shipped feature.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const INDEX = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const SW = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const INTEGRITY_PATH = path.join(PUBLIC, 'gamification-integrity-v1.js');

function integritySource() {
  assert.ok(
    fs.existsSync(INTEGRITY_PATH),
    'public/gamification-integrity-v1.js must ship; a migration described only in app.js is not an auditable contract'
  );
  return fs.readFileSync(INTEGRITY_PATH, 'utf8');
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function integrityApi() {
  integritySource();
  delete require.cache[require.resolve(INTEGRITY_PATH)];
  return require(INTEGRITY_PATH);
}

function scriptTag(file) {
  const match = INDEX.match(new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escapeRe(file)}[^"']*["'][^>]*>`, 'i'));
  assert.ok(match, `index.html does not load ${file}`);
  return match[0];
}

function semanticExport(api, probe, description) {
  for (const [name, candidate] of Object.entries(api || {})) {
    if (typeof candidate !== 'function') continue;
    try { if (probe(candidate)) return { name, fn: candidate }; } catch { /* unrelated export */ }
  }
  assert.fail(description);
}

function segment(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

function functionSource(source, name) {
  const marker = new RegExp(`(?:async\\s+)?function\\s+${escapeRe(name)}\\s*\\(`);
  const found = marker.exec(source);
  assert.ok(found, `${name} must exist`);
  const brace = source.indexOf('{', found.index + found[0].length);
  assert.notEqual(brace, -1, `${name} must have a body`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
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
    else if (char === '}' && --depth === 0) return source.slice(found.index, index + 1);
  }
  assert.fail(`${name} body is not closed`);
}

function dataActions(source) {
  return [...source.matchAll(/data-action=["']([^"']+)["']/g)].map((match) => match[1]);
}

function semanticAction(source, patterns, label) {
  const found = dataActions(source).find((action) => patterns.some((pattern) => pattern.test(action)));
  assert.ok(found, `quest UI has no ${label} action (aliases are allowed)`);
  return found;
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('v215 integrity modules remain ordered while v216 advances the app shell', () => {
  const commitment = INDEX.indexOf('commitment-v1.js');
  const integrity = INDEX.indexOf('gamification-integrity-v1.js');
  const app = INDEX.indexOf('app.js');
  assert.ok(commitment >= 0, 'index.html does not load commitment-v1.js');
  assert.ok(integrity >= 0, 'index.html does not load gamification-integrity-v1.js');
  assert.ok(commitment < app, 'commitment-v1.js must load before app.js');
  assert.ok(integrity < app, 'gamification-integrity-v1.js must load before app.js');
  assert.match(SW, /const CACHE = ['"]satoru-v219['"]/, 'service-worker cache must be bumped to satoru-v219');
  assert.match(SW, /['"]commitment-v1\.js['"]/, 'commitment-v1.js is missing from the offline shell');
  assert.match(SW, /['"]gamification-integrity-v1\.js['"]/, 'gamification-integrity-v1.js is missing from the offline shell');
  assert.match(APP, /const PWA_CACHE_VERSION = ['"]satoru-v219['"]/, 'app and service worker disagree on the v216 cache');
  for (const file of ['commitment-v1.js', 'gamification-integrity-v1.js', 'app.js']) {
    assert.match(
      scriptTag(file),
      /[?&](?:v|build)=[^"']*v215(?:[-_.][^"']*)?["']/i,
      `${file} query does not identify the v215 release`
    );
  }
});

test('live product copy no longer promises Hype or resource-loss discipline', () => {
  // Translation catalogs retain historical keys for safe data/import fallback.
  // They are not live copy by themselves, so inspect the runtime render/controller
  // half where a key, label or tooltip can actually be selected for display.
  const runtimeStart = APP.indexOf('const DEFAULT_SETTINGS =');
  assert.ok(runtimeStart >= 0, 'cannot identify the live runtime section of app.js');
  const live = withoutComments(APP.slice(runtimeStart));
  for (const stale of [
    /активирует\s+Хайп/i,
    /activates?\s+(?:the\s+)?Hype/i,
    /triggers?\s+(?:the\s+)?Hype/i,
    /Объясни энергию и Хайп/i,
    /class=["']hype-chip["']/i,
    /Пропуск бьёт по энергии/i,
    /Просроченный дедлайн:\s*−5 энергии/i,
    /Клятва Кремню:\s*×1[,.]5 золота/i,
    /Провалишь\s*[—-]\s*сгорит/i,
  ]) assert.doesNotMatch(live, stale, `stale live promise remains: ${stale}`);

  const pathCopy = segment(APP, 'const PATHS =', '\n// Поведенческий дефолт');
  assert.doesNotMatch(
    pathCopy,
    /(?:штраф|потер|сгор|бьёт).{0,80}(?:энерг|золот|🪙)|(?:энерг|золот).{0,80}(?:штраф|потер|сгор|бьёт)|×\s*1[,.]5/is,
    'Trust/Control copy must differ by support style, not by threatened resource loss or a payout multiplier'
  );
});

test('daily reward bonus has a truthful canonical name and an explicit legacy migration', () => {
  const integrity = integritySource();
  const api = integrityApi();
  const live = withoutComments(APP);
  const perkText = segment(APP, 'const PERK_TEXT', '\nfunction perkText');
  const perkKinds = segment(APP, 'const PERK_KINDS', '\nfunction nodePerks');
  const templates = segment(APP, 'const TREE_TEMPLATES =', '\nconst TREE_AUTHORED_COPY');
  const dailyBonus = functionSource(APP, 'dailyRewardGoldBonusPct');

  assert.doesNotMatch(live, /\blootLuck\b/, 'app.js still treats the deterministic bonus as luck; keep lootLuck only inside the migration module');
  for (const [label, source] of [['PERK_TEXT', perkText], ['PERK_KINDS', perkKinds], ['TREE_TEMPLATES', templates], ['dailyRewardGoldBonusPct', dailyBonus]]) {
    assert.match(source, /dailyRewardGoldPct/, `${label} does not use the canonical dailyRewardGoldPct key`);
  }
  assert.match(integrity, /lootLuck/, 'migration module does not recognise the legacy lootLuck key');
  assert.match(integrity, /dailyRewardGoldPct/, 'migration module does not emit the canonical dailyRewardGoldPct key');
  const migration = semanticExport(api, (candidate) => {
    const input = { study: { nodes: [{ id: 'n1', perks: [{ kind: 'lootLuck', val: 12 }] }] } };
    const output = candidate(input);
    const state = output && (output.state || output.value || output.treeState || output);
    const perks = state && state.study && state.study.nodes && state.study.nodes[0] && state.study.nodes[0].perks;
    return Array.isArray(perks) && perks.some((perk) => perk.kind === 'dailyRewardGoldPct')
      && perks.every((perk) => perk.kind !== 'lootLuck');
  }, 'no exported integrity function semantically migrates lootLuck to dailyRewardGoldPct');
  assert.match(APP, new RegExp(`\\.${escapeRe(migration.name)}\\s*\\(`),
    `app.js never invokes the detected legacy perk migration (${migration.name})`);
});

test('old synthetic Control/Oath purchases are history, never spendable gold', () => {
  integritySource();
  const api = integrityApi();
  const spent = functionSource(APP, 'goldSpent');
  const policy = semanticExport(api, (candidate) => (
    candidate({ id: 'shop-real', cost: 17 }) === 17
    && candidate({ id: 'reckon_2026-09-01', cost: 15 }) === 0
    && candidate({ id: 'oath_quest-1', cost: 25 }) === 0
  ), 'no exported integrity function counts a real purchase while excluding both legacy synthetic penalty id families');
  assert.match(spent, new RegExp(`\\.${escapeRe(policy.name)}\\s*\\(`),
    `goldSpent must route purchases through the detected legacy-penalty policy (${policy.name})`);
  assert.doesNotMatch(spent, /\+\s*\(p\.cost\s*\|\|\s*0\)/,
    'goldSpent still subtracts every historical purchase, including synthetic penalties');
});

test('Control reckoning creates a review, never a purchase or an automatic loss', () => {
  const reckoning = functionSource(APP, 'pathReckoning');
  assert.doesNotMatch(reckoning, /State\.purchases|Store\.save\(['"]purchases['"]|\bcost\s*:|\.oath\b|oath_/,
    'pathReckoning still mutates purchases/tasks instead of producing a reversible review');
  assert.doesNotMatch(reckoning, /goldPenalty|energyPenalty|oathGold/,
    'pathReckoning still depends on a resource-loss constant');
  assert.match(reckoning, /(?:review|GamificationIntegrityV1|commitment)/i,
    'Control reckoning has no visible/reversible review path after penalties were removed');
  assert.doesNotMatch(APP, /const CONTROL\s*=\s*\{[^}]*?(?:goldPenalty|energyPenalty|oathGold)/s,
    'the live Control contract still exposes penalty/stake constants');
});

test('the old Oath wager is replaced by take, revise and release commitment actions', () => {
  const complete = functionSource(APP, 'completeTask');
  const row = functionSource(APP, 'questRow');
  assert.doesNotMatch(complete, /\.oath\b|oathKept|\*\s*1\.5/,
    'completeTask still pays the removed Oath multiplier');
  assert.match(complete, /commitment/i, 'quest completion does not settle its commitment');
  assert.doesNotMatch(APP, /data-action=["']quest-oath["']|action === ["']quest-oath["']/,
    'the irreversible wager action quest-oath is still reachable');

  const actions = [
    semanticAction(row, [/^commitment[-_:](?:take|create|add)$/i, /^(?:take|create|add)[-_:]commitment$/i], 'take commitment'),
    semanticAction(row, [/^commitment[-_:](?:revise|edit|update)$/i, /^(?:revise|edit|update)[-_:]commitment$/i], 'revise commitment'),
    semanticAction(row, [/^commitment[-_:](?:release|remove|archive)$/i, /^(?:release|remove|archive)[-_:]commitment$/i], 'release commitment'),
  ];
  for (const action of actions) {
    assert.match(APP, new RegExp(`action\\s*===\\s*["']${escapeRe(action)}["']`), `click controller does not handle ${action}`);
  }
  for (const semantic of [
    /(?:window\.)?CommitmentV1\.(?:add|create)\s*\(|(?:take|create|add)\w*Commitment\s*\(/i,
    /(?:window\.)?CommitmentV1\.(?:revise|edit|update)\s*\(|(?:revise|edit|update)\w*Commitment\s*\(/i,
    /(?:window\.)?CommitmentV1\.(?:release|archive|remove)\s*\(|(?:release|archive|remove)\w*Commitment\s*\(/i,
    /(?:window\.)?CommitmentV1\.(?:mark|settle)\s*\(|(?:mark|settle)\w*Commitment\s*\(/i,
  ]) assert.match(APP, semantic, `missing commitment behavior: ${semantic}`);
});

test('a commitment is available directly on an unfinished quest scheduled for today', () => {
  const row = functionSource(APP, 'questRow');
  const take = semanticAction(row, [/^commitment[-_:](?:take|create|add)$/i, /^(?:take|create|add)[-_:]commitment$/i], 'take commitment');
  const actionIndex = row.indexOf(`data-action="${take}"`) >= 0
    ? row.indexOf(`data-action="${take}"`)
    : row.indexOf(`data-action='${take}'`);
  const unfinishedIndex = row.lastIndexOf('!q.done', actionIndex);
  const todayIndex = row.lastIndexOf('q.date === todayStr()', actionIndex);
  assert.match(row, /q\.date\s*===\s*todayStr\(\)/, 'questRow does not distinguish today from arbitrary dates');
  assert.ok(unfinishedIndex >= 0 && actionIndex - unfinishedIndex < 1400,
    `${take} is not guarded by an unfinished-quest condition close to the control`);
  assert.ok(todayIndex >= 0 && actionIndex - todayIndex < 1400,
    `${take} is not guarded by today's date close to the control`);
  const actionWindow = row.slice(Math.max(0, actionIndex - 320), actionIndex + 320);
  assert.doesNotMatch(actionWindow, /goldBalance\(/,
    'taking a commitment must not be gated by the user gold balance');
});

test('difficulty is one fixed 1 / 1.5 / 1.75 contract and settings expose it read-only', () => {
  const defaults = segment(APP, 'const DEFAULT_SETTINGS =', '\nfunction freshOnboardingSettings');
  const runtime = segment(APP, 'const ECONOMY_DIFFICULTY =', '\nfunction economyDifficultyMultiplier');
  const multiplier = functionSource(APP, 'economyDifficultyMultiplier');
  const settings = functionSource(APP, 'renderSettings');
  const capture = functionSource(APP, 'captureSettingsForm');
  const init = functionSource(APP, 'initApp');
  const expected = Object.freeze({ easy: 1, normal: 1.5, hard: 1.75 });
  const assertTriplet = (source, label) => {
    for (const [key, value] of Object.entries(expected)) {
      assert.match(source, new RegExp(`\\b${key}\\s*:\\s*${String(value).replace('.', '\\.') }\\b`),
        `${label} does not define ${key} as ${value}`);
    }
  };

  assert.match(runtime, /Object\.freeze\s*\(/, 'canonical difficulty values are mutable');
  assertTriplet(runtime, 'ECONOMY_DIFFICULTY');
  assertTriplet(defaults, 'DEFAULT_SETTINGS');
  assertTriplet(SERVER.match(/XP_DIFF\s*=\s*\{[^}]*\}/s)?.[0] || '', 'server XP_DIFF');
  assert.match(multiplier, /ECONOMY_DIFFICULTY\s*\[/, 'payout does not read the fixed canonical contract');
  assert.doesNotMatch(multiplier, /State\.settings|Math\.min|MAX/i,
    'payout still clamps or reads a user-defined difficulty value instead of the fixed contract');
  assert.doesNotMatch(APP, /ECONOMY_DIFFICULTY_MAX/, 'the removed MAX/clamp contract was reintroduced');

  for (const [key, value, label] of [['easy', 1, 'Лёгкая'], ['normal', 1.5, 'Обычная'], ['hard', 1.75, 'Сложная']]) {
    const marker = `t('${label}')`;
    let cursor = 0;
    let field = '';
    while (cursor < settings.length) {
      const markerIndex = settings.indexOf(marker, cursor);
      if (markerIndex < 0) break;
      const candidate = settings.slice(markerIndex, markerIndex + 420).match(/<input\b[^>]*>/)?.[0] || '';
      if (/\breadonly(?:\s|=|>)/.test(candidate)) { field = candidate; break; }
      cursor = markerIndex + marker.length;
    }
    assert.ok(field, `settings do not disclose a read-only ${key} difficulty row`);
    assert.match(field, new RegExp(`\\bvalue=["']${String(value).replace('.', '\\.')}["']`),
      `settings display a different ${key} multiplier`);
    assert.match(field, /\breadonly(?:\s|=|>)/, `${key} difficulty remains editable`);
    assert.match(field, /\baria-readonly=["']true["']/, `${key} fixed value is not exposed as read-only to assistive technology`);
  }

  assert.match(capture, /s\.xp\.difficulty\s*=\s*\{\s*\.\.\.ECONOMY_DIFFICULTY\s*\}/,
    'settings persistence does not overwrite stale/custom multipliers with the canonical contract');
  assert.doesNotMatch(capture, /getElementById\(['"]k-(?:easy|normal|hard)['"]\)/,
    'settings still read editable difficulty controls');
  assert.match(init, /State\.settings\.xp\.difficulty\s*=\s*\{\s*\.\.\.ECONOMY_DIFFICULTY\s*\}/,
    'existing profiles are not migrated to the fixed difficulty contract');
  assert.doesNotMatch(defaults + '\n' + runtime + '\n' + SERVER, /hard\s*:\s*2\.2\b/,
    'the silent 2.2/1.75 split still exists in a live payout contract');
});
