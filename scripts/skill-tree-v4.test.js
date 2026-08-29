const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const app = read('public/app.js');
const css = read('public/styles.css');
const index = read('public/index.html');
const sw = read('public/sw.js');
const server = read('server.js');

function balanced(source, start, open = '{', close = '}') {
  assert.ok(start >= 0, 'balanced source start must exist');
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let at = start; at < source.length; at += 1) {
    const char = source[at];
    const next = source[at + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; at += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; at += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; at += 1; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, at + 1);
    }
  }
  assert.fail(`unclosed ${open}${close} block`);
}

function functionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = source.indexOf('{', start + marker.length);
  return source.slice(start, bodyStart) + balanced(source, bodyStart);
}

function actionSource(action, nextAction, source = app) {
  const start = source.indexOf(`action === '${action}'`);
  assert.ok(start >= 0, `${action} handler must exist`);
  const end = nextAction ? source.indexOf(`action === '${nextAction}'`, start + 1) : start + 2200;
  assert.ok(end > start, `${action} handler boundary must exist`);
  return source.slice(start, end);
}

function objectConstant(source, name) {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const objectStart = source.indexOf('{', start + marker.length);
  const objectText = balanced(source, objectStart);
  return Function(`return (${objectText});`)();
}

test('Path is the primary surface and game Practices explicitly disclaim mastery', () => {
  const render = functionSource(app, 'renderTree');
  const pathAt = Math.max(render.indexOf("t('Путь')"), render.indexOf("t('Реальный путь')"));
  const practicesAt = Math.max(render.indexOf("t('Игровые бонусы')"), render.indexOf("t('Игровая практика')"));
  assert.ok(pathAt >= 0, 'renderTree must visibly name the real Path');
  assert.ok(practicesAt >= 0, 'renderTree must visibly name the separate game Practices layer');
  const explicitDefault = /(?:treeLayer|treeView|treeMode)[^\n]{0,100}(?:\|\||\?)[^\n]{0,80}['"]path['"]/.test(render);
  assert.ok(explicitDefault || pathAt < practicesAt, 'Path must be selected or rendered first by default');
  const path = functionSource(app, 'treeCapabilityPath');
  const practices = functionSource(app, 'treePracticesHTML');
  assert.match(path, /treeNodeKind\([^)]*\)\s*===\s*['"]capability['"]/);
  assert.match(practices, /treeNodeKind\([^)]*\)\s*===\s*['"]practice['"]/);
  assert.match(practices, /t\('Эти узлы меняют Satoru, (?:а|но) не подтверждают [^']*мастерств[^']*\.'\)/);
});

test('Tree v4 semantic migration preserves legacy progress and is idempotent', () => {
  const constants = app.match(/const TREE_SCHEMA_VERSION = 4;\s*const TREE_NODE_KINDS = new Set\(\['capability', 'practice'\]\);/);
  assert.ok(constants, 'Tree v4 schema and semantic kinds must be explicit');
  const source = `${constants[0]}\n${functionSource(app, 'treeNodeKind')}\n${functionSource(app, 'backfillTreeV4Semantics')}\nreturn { treeNodeKind, backfillTreeV4Semantics };`;
  const { treeNodeKind, backfillTreeV4Semantics } = Function(source)();
  const legacy = {
    nodes: [
      { id: 'cap', title: 'First 10 km', milestone: true, unlocked: true, claimedAt: 'import', cost: '0', x: '12', y: '24', requires: [], perks: [] },
      { id: 'perk', title: 'XP helper', unlocked: true, cost: '2', x: 0, y: 0, requires: ['cap'], perks: [{ kind: 'xpPct', val: '5' }] },
    ],
  };
  assert.equal(backfillTreeV4Semantics(legacy), true);
  assert.equal(legacy.schemaVersion, 4);
  assert.equal(treeNodeKind(legacy.nodes[0]), 'capability');
  assert.equal(treeNodeKind(legacy.nodes[1]), 'practice');
  assert.equal(legacy.nodes[0].claimSource, 'import');
  assert.equal(legacy.nodes[0].unlocked, true);
  assert.equal(legacy.nodes[0].claimedAt, 'import');
  assert.deepEqual(legacy.nodes[1].requires, ['cap']);
  assert.equal(legacy.nodes[1].cost, 2);
  assert.equal(legacy.nodes[1].perks[0].val, 5);
  const once = structuredClone(legacy);
  assert.equal(backfillTreeV4Semantics(legacy), false, 'second migration pass must make no write-worthy change');
  assert.deepEqual(legacy, once, 'second migration pass must preserve the exact migrated payload');
});

test('milestone evidence is escaped and a claim is durable before the dialog closes', () => {
  const modal = functionSource(app, 'openMilestoneClaim');
  assert.match(modal, /esc\(displayTitle\)/);
  assert.match(modal, /esc\(criterion\)/);
  assert.match(modal, /id="ms-claim-proof"[\s\S]{0,180}maxlength="500"/);

  const claim = actionSource('ms-claim-yes', 'ms-claim-no');
  const mutationAt = claim.indexOf('node.unlocked = true');
  const saveAt = claim.indexOf("await Store.saveNow('skilltree', State.tree)");
  const closeAt = claim.indexOf("closeTreeDialog('ms-claim')", saveAt);
  assert.ok(mutationAt >= 0, 'claim must update the milestone only inside the confirmed branch');
  assert.match(claim, /ms-claim-proof/);
  assert.match(claim, /(?:proofNote|evidence)\s*=/);
  assert.match(claim, /claimSource\s*=\s*['"]self['"]/);
  assert.ok(saveAt > mutationAt, 'claim must await an immediate Tree save after mutation');
  assert.ok(closeAt > saveAt, 'success UI must close only after the durable save resolves');
  assert.match(claim.slice(saveAt, closeAt), /if\s*\(!\s*(?:saved|ok)\s*\)/, 'save failure must be handled before success UI');
  assert.match(app, /esc\((?:node|n|item)\.(?:proofNote|evidence)\)/, 'stored evidence must be escaped when rendered');
});

test('dependency edits cannot introduce cycles', () => {
  const wouldCycle = Function(`${functionSource(app, 'treeDependencyWouldCycle')}\nreturn treeDependencyWouldCycle;`)();
  const tree = { nodes: [
    { id: 'a', requires: [] },
    { id: 'b', requires: ['a'] },
    { id: 'c', requires: ['b'] },
  ] };
  assert.equal(wouldCycle(tree, 'a', 'c'), true);
  assert.equal(wouldCycle(tree, 'a', 'a'), true);
  assert.equal(wouldCycle(tree, 'c', 'a'), false);

  const change = app.slice(app.indexOf("if (a === 'tree-toggle-req')"), app.indexOf('\n  }\n}', app.indexOf("if (a === 'tree-toggle-req')")));
  const guardAt = change.indexOf('treeDependencyWouldCycle(');
  const pushAt = change.indexOf('n.requires.push(req)');
  assert.ok(guardAt >= 0 && pushAt > guardAt, 'cycle guard must run before a dependency is added');
  assert.match(change.slice(guardAt, pushAt), /return/);
});

test('confirmed capabilities are append-only in the editor', () => {
  const removal = actionSource('tree-del-node', 'tree-detail-close');
  const deleteAt = removal.indexOf('t.nodes = t.nodes.filter');
  assert.ok(deleteAt >= 0, 'editor deletion branch must remain explicit');
  const guard = removal.search(/(?:node\.unlocked[\s\S]{0,100}treeNodeKind\(node\)\s*===\s*['"]capability['"]|treeNodeKind\(node\)\s*===\s*['"]capability['"][\s\S]{0,100}node\.unlocked)/);
  assert.ok(guard >= 0 && guard < deleteAt, 'a confirmed real-world capability must be blocked before deletion');
  assert.match(removal.slice(guard, deleteAt), /return/);
});

test('all Store write paths fence corrupt or invalid Tree payloads', () => {
  const fence = functionSource(app, 'skillTreeWriteAllowed');
  assert.match(fence, /State\._treeLoadError/);
  assert.match(fence, /clearTimeout\(Store\._timers\.skilltree\)/);
  const storeStart = app.indexOf('const Store =');
  const storeEnd = app.indexOf('\n};', storeStart);
  assert.ok(storeStart >= 0 && storeEnd > storeStart, 'Store object must exist');
  const store = app.slice(storeStart, storeEnd);
  assert.match(store, /save\(name, obj\)[\s\S]{0,900}name === 'skilltree'[\s\S]{0,100}skillTreePayloadAllowed\(obj, 'save'/);
  assert.match(store, /saveNow\(name, obj[\s\S]{0,900}name === 'skilltree'[\s\S]{0,100}skillTreePayloadAllowed\(obj, 'saveNow'/);
  assert.match(store, /async _put\(name, obj[\s\S]{0,900}name === 'skilltree'[\s\S]{0,100}skillTreeWriteAllowed\('_put'/);
  assert.match(store, /name === 'skilltree'[\s\S]{0,100}skillTreePayloadAllowed\(value, '_put'/);
});

test('AI personal maps require title, criterion, and a concrete next action', () => {
  const promptStart = server.indexOf('const AI_TREEMAP_SYS =');
  const promptEndMarker = server.indexOf('`;', promptStart + 'const AI_TREEMAP_SYS = `'.length);
  const promptEnd = promptEndMarker + 2;
  assert.ok(promptStart >= 0 && promptEnd > promptStart, 'AI Tree prompt must exist');
  const prompt = server.slice(promptStart, promptEnd);
  assert.match(prompt, /"title"/);
  assert.match(prompt, /"criterion"/);
  assert.match(prompt, /"nextAction"/);
  assert.match(prompt, /criterion описывает наблюдаемый результат/);
  assert.match(prompt, /nextAction — конкретное действие/);
  assert.match(prompt, /Названия ≤ 60 знаков/);

  const run = functionSource(app, 'treeMapRun');
  for (const field of ['title', 'criterion', 'nextAction']) assert.match(run, new RegExp(`${field}:\\s*String\\(`));
  const limits = Object.fromEntries(['title', 'criterion', 'nextAction'].map((field) => {
    const match = run.match(new RegExp(`${field}:[^\\n]{0,180}slice\\(0,\\s*(\\d+)\\)`));
    assert.ok(match, `${field} must be normalized to a bounded string`);
    return [field, Number(match[1])];
  }));
  assert.ok(limits.title <= 80 && limits.criterion <= 240 && limits.nextAction <= 200, `unexpected AI field limits: ${JSON.stringify(limits)}`);
  const apply = functionSource(app, 'applyPersonalMap');
  assert.match(apply, /criterion/);
  assert.match(apply, /nextAction/);
  assert.match(apply, /kind:\s*['"]capability['"]/);
});

test('critical Tree v4 copy is complete in RU, EN, DE, UK, and ES', () => {
  const extra = objectConstant(app, 'I18N_EXTRA');
  const keys = new Set([
    'Путь',
    'Игровые бонусы',
    'Реальный путь',
    'Игровая практика',
    'Вехи фиксируют то, что ты реально умеешь. Бонусы меняют только Satoru.',
    'Что считается результатом',
    'Следующий шаг',
    'Эти узлы меняют Satoru, а не подтверждают реальное мастерство.',
    'Зафиксировать реальную веху',
    'Что подтверждает результат?',
    'Сохраняю веху…',
    'Не удалось сохранить веху. Ничего не изменено — попробуй снова.',
  ]);
  const treeUiSource = [
    'openMilestoneClaim', 'treeClaimTrace', 'treePathHTML', 'treePracticeNodesHTML',
    'treePracticesHTML', 'treeNodePanel', 'treeNodeDetailPanel', 'renderTree',
  ].map((name) => functionSource(app, name)).join('\n') + actionSource('ms-claim-yes', 'ms-claim-no');
  for (const match of treeUiSource.matchAll(/\bt(?:18)?\('([^']+)'\)/g)) keys.add(match[1]);

  const dictionaries = {
    en: objectConstant(app, 'I18N_EN'),
    de: objectConstant(app, 'I18N_DE'),
    uk: objectConstant(app, 'I18N_UK'),
    es: objectConstant(app, 'I18N_ES'),
  };
  for (const [key, row] of Object.entries(extra)) {
    for (const locale of Object.keys(dictionaries)) if (row[locale]) dictionaries[locale][key] = row[locale];
  }
  const missing = [], cyrillicLeaks = [];
  for (const key of keys) {
    assert.ok(String(key).trim(), 'Russian source key must be present');
    for (const [locale, dictionary] of Object.entries(dictionaries)) {
      const value = dictionary[key];
      if (!String(value || '').trim()) missing.push(`${locale}: ${key}`);
      else if (['en', 'de', 'es'].includes(locale) && /[А-Яа-яЁёІіЇїЄє]/.test(value)) cyrillicLeaks.push(`${locale}: ${key} -> ${value}`);
    }
  }
  assert.deepEqual(missing, [], `missing Tree v4 translations:\n${missing.join('\n')}`);
  assert.deepEqual(cyrillicLeaks, [], `Tree v4 translations leak Cyrillic:\n${cyrillicLeaks.join('\n')}`);
});

test('crash reproduction exports redact private Tree evidence and personal planning copy', () => {
  const crashStart = server.indexOf("u.match(/^\\/api\\/admin\\/crash-export");
  const crashEnd = server.indexOf('// GET /api/admin/userdata/', crashStart);
  assert.ok(crashStart >= 0 && crashEnd > crashStart, 'crash export route must exist');
  const crash = server.slice(crashStart, crashEnd);
  const redactor = server.match(/function\s+([A-Za-z0-9_]*(?:redact|sanitize)[A-Za-z0-9_]*(?:tree|skill)[A-Za-z0-9_]*|[A-Za-z0-9_]*(?:tree|skill)[A-Za-z0-9_]*(?:redact|sanitize)[A-Za-z0-9_]*)\s*\(/i);
  assert.ok(redactor, 'server must define a dedicated Tree crash-export redactor');
  assert.match(crash, new RegExp(`skilltree[\\s\\S]{0,220}${redactor[1]}|${redactor[1]}[\\s\\S]{0,220}skilltree`));
  const fieldsMatch = server.match(/const TREE_CRASH_PRIVATE_FIELDS = Object\.freeze\((\[[^\n]+\])\);/);
  assert.ok(fieldsMatch, 'private Tree fields must be an auditable allowlist');
  const privateFields = Function(`return ${fieldsMatch[1]};`)();
  assert.deepEqual(privateFields, ['criterion', 'nextAction', 'proofNote']);
  const redactorSource = functionSource(server, redactor[1]);
  assert.match(redactorSource, /TREE_CRASH_PRIVATE_FIELDS/);
  const redact = Function(`${fieldsMatch[0]}\n${redactorSource}\nreturn ${redactor[1]};`)();
  const privateTree = { s1: { schemaVersion: 4, nodes: [{
    id: 'n1', title: 'Mechanical title', criterion: 'private criterion', nextAction: 'private next action', proofNote: '<img src=x onerror=alert(1)>', unlocked: true,
  }] } };
  const redactedTree = redact(privateTree);
  assert.equal(redactedTree.s1.nodes[0].id, 'n1');
  assert.equal(redactedTree.s1.nodes[0].unlocked, true);
  for (const field of privateFields) {
    assert.equal(redactedTree.s1.nodes[0][field], '[скрыто]');
    assert.notEqual(redactedTree.s1.nodes[0][field], privateTree.s1.nodes[0][field]);
  }
  assert.equal(privateTree.s1.nodes[0].proofNote, '<img src=x onerror=alert(1)>', 'redaction must not mutate account data');
  assert.doesNotMatch(crash, /for \(const n of MECHANICS\) \{\s*try \{ files\[n\] = JSON\.parse/, 'crash route must not copy raw skilltree through the generic loop');
});

test('Tree v4 CSS distinguishes semantics and remains responsive and motion-safe', () => {
  const marker = css.search(/Skill Tree v4/i);
  assert.ok(marker >= 0, 'Tree v4 must have a final authoritative CSS layer');
  const v4 = css.slice(marker);
  assert.match(v4, /\.tree-v4-path\b/);
  assert.match(v4, /\.tree-v4-practices\b/);
  assert.match(v4, /\.tree-v4-practices\s*>\s*\.tree-v4-note/);
  assert.match(v4, /@media \(max-width: 600px\)[\s\S]{0,2600}(?:\.tree-v4-path|\.tree-v4-practices|\.tree-claim)/);
  assert.match(v4, /@media \(pointer: coarse\)[\s\S]{0,1800}(?:\.tree-v4-tab|\.tree-claim-box)/);
  assert.match(v4, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,900}\.tree-v4-path/);
});

test('Tree v4 release keeps app, service worker, and index pins synchronized', () => {
  const appVersion = (app.match(/const PWA_CACHE_VERSION = 'satoru-v(\d+)'/) || [])[1];
  const swVersion = (sw.match(/const CACHE = 'satoru-v(\d+)'/) || [])[1];
  assert.ok(appVersion && swVersion, 'app and service worker cache versions must be explicit');
  assert.equal(appVersion, swVersion, 'app and service worker cache versions must match exactly');
  const stylePin = (index.match(/styles\.css\?v=([^"']+)/) || [])[1];
  const appPin = (index.match(/app\.js\?v=([^"']+)/) || [])[1];
  assert.ok(stylePin && appPin, 'index must pin both app.js and styles.css');
  assert.equal(stylePin, appPin, 'index app/style release pins must match');
  const v4Ready = /Tree v4/i.test(css) && /await Store\.saveNow\('skilltree', State\.tree\)/.test(actionSource('ms-claim-yes', 'ms-claim-no'));
  if (v4Ready) {
    assert.ok(Number(appVersion) > 203, `Tree v4 must bump the PWA cache beyond v203, got v${appVersion}`);
    assert.doesNotMatch(appPin, /v203/i, 'Tree v4 index assets must not reuse the v203 pin');
  }
});
