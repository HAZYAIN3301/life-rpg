const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

function frozenJsonConstant(name) {
  const marker = `const ${name} = Object.freeze(`;
  const markerIndex = app.indexOf(marker);
  assert.ok(markerIndex >= 0, `${name} marker must exist`);
  const objectStart = app.indexOf('{', markerIndex + marker.length);
  assert.ok(objectStart >= 0, `${name} object must exist`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = objectStart; index < app.length; index += 1) {
    const char = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(app.slice(objectStart, index + 1));
    }
  }
  assert.fail(`${name} object is not closed`);
}

test('normal Tree nodes select a semantic detail before any spend', () => {
  assert.match(app, /<button type="button" class="tree-node[\s\S]{0,900}data-action="\$\{edit \? 'tree-sel-node' : 'tree-select-node'\}"/);
  const detail = app.slice(app.indexOf('function treeNodeDetailPanel'), app.indexOf('\n// Компактный чип перка', app.indexOf('function treeNodeDetailPanel')));
  assert.match(detail, /id="tree-node-detail"/);
  assert.match(detail, /data-action="unlock-node"/);
  assert.match(app, /action === 'tree-select-node'[\s\S]{0,260}State\.treeSelNode = nodeId/);
  assert.match(app, /aria-pressed="\$\{sel\}"/);
  assert.match(app, /treeNodeLockReason\(id, node\)/);
});

test('real editor construction finds free positions for forty nodes', () => {
  const constants = app.match(/const TREE_SX = 194, TREE_SY = 112, TREE_NW = 168, TREE_NH = 96;\nconst TREE_GRID_COLS = 5;/);
  assert.ok(constants, 'Tree geometry constants must stay synchronized with CSS');
  const start = app.indexOf('function treeNodeRectOverlap');
  const end = app.indexOf('\nfunction treeOverlapCount', start);
  assert.ok(start > 0 && end > start, 'pure placement helpers must exist');
  const source = `${constants[0]}\n${app.slice(start, end)}\nreturn { treeNodeRectOverlap, nextTreeNodePosition };`;
  const { treeNodeRectOverlap, nextTreeNodePosition } = Function(source)();
  const tree = { nodes: [] };
  for (let index = 0; index < 40; index++) {
    const pos = nextTreeNodePosition(tree);
    assert.equal(tree.nodes.some((node) => treeNodeRectOverlap(pos, node)), false, `node ${index + 1} overlaps`);
    tree.nodes.push({ id: `n${index}`, ...pos });
  }
  assert.equal(tree.nodes.length, 40);
  const addHandler = app.match(/action === 'tree-add-node'[\s\S]*?action === 'tree-arrange-overlaps'/);
  assert.ok(addHandler);
  assert.match(addHandler[0], /nextTreeNodePosition\(t\)/);
  assert.doesNotMatch(addHandler[0], /%\s*4/);
});

test('Tree editor has touch-safe keyboard movement and guarded destructive actions', () => {
  for (const action of ['tree-nudge-node', 'tree-arrange-overlaps', 'tree-del-node']) assert.match(app, new RegExp(`data-action="${action}"`));
  assert.match(app, /treePositionOpen\(tree, x, y, node\.id\)/);
  assert.match(app, /confirm\(`\$\{t\('Удалить узел'\)\}/);
  assert.match(app, /pointercancel/);
  assert.match(app, /setPointerCapture/);
  assert.match(app, /matchMedia\('\(pointer: coarse\)'\)/);
});

test('Tree dialogs and milestone commit revalidate semantics and focus', () => {
  assert.match(app, /function mountTreeDialog\(/);
  assert.match(app, /aria-modal/);
  assert.match(app, /handleTreeDialogKeydown\(e\)/);
  assert.match(app, /treeNodeKind\(node\) !== 'capability' \|\| !nodeUnlockable\(sid, node\)/);
  assert.ok(app.indexOf("await Store.saveNow('skilltree', State.tree)") < app.indexOf("closeTreeDialog('ms-claim')", app.indexOf("action === 'ms-claim-yes'")), 'claim must be durable before its dialog closes');
  assert.match(app, /closeTreeDialog\('ms-claim'\)/);
  assert.match(app, /_treeFocusAfterCommit/);
  assert.match(app, /querySelector\('\.tree-node\.recommend'\) \|\|[\s\S]{0,120}querySelector\('\.tree-node\.available'\) \|\|[\s\S]{0,120}querySelector\('\.tree-node\.unlocked'\)/);
});

test('corrupt Tree data is surfaced and never silently overwritten', () => {
  const start = app.indexOf('function isPlainRecord');
  const end = app.indexOf('\nasync function retrySkillTreeLoad', start);
  assert.ok(start > 0 && end > start);
  const validateSkillTreePayload = Function(`${app.slice(start, end)}\nreturn validateSkillTreePayload;`)();
  const valid = { s1: { nodes: [{ id: 'n1', title: 'One', desc: '', requires: [], perks: [], x: 0, y: 0 }] } };
  assert.equal(validateSkillTreePayload(valid), true);
  assert.equal(validateSkillTreePayload([]), false);
  assert.equal(validateSkillTreePayload({ s1: { nodes: 'bad' } }), false);
  assert.equal(validateSkillTreePayload({ s1: { nodes: [{ id: 'n1', title: 'One', x: 0, y: 0 }, { id: 'n1', title: 'Two', x: 1, y: 1 }] } }), false);
  assert.equal(validateSkillTreePayload({ s1: { nodes: [{ id: 'n1', title: 'One', x: 'nope' }] } }), false);
  assert.equal(validateSkillTreePayload({ s1: { nodes: [{ id: 'n1', titleKey: 'tree.template.body.n1.title', x: 0, y: 0 }] } }), false);
  assert.equal(validateSkillTreePayload({ s1: { nodes: [{ id: 'n1', title: 'One', x: 0, y: 0, perks: [null] }] } }), false);
  assert.match(app, /Store\.loadChecked\('skilltree', \{\}, validateSkillTreePayload\)/);
  assert.match(app, /error\.message === 'invalid data' \|\| error\.name === 'SyntaxError'/);
  assert.match(app, /function ensureTrees\(\{ persist = true \} = \{\}\) \{\s*if \(State\._treeLoadError\) return;/);
  assert.match(app, /if \(persist && treeDataChanged\) Store\.save\('skilltree', State\.tree\)/,
    'ordinary Tree maintenance no longer persists by default');
  assert.match(app, /function treeLoadErrorHTML\([\s\S]*?data-action="tree-retry-load"[\s\S]*?data-action="tree-reset-load"/);
  assert.match(app, /Создать новую карту\? Повреждённый файл будет заменён стартовыми деревьями/);
});

test('Tree state, touch, light contrast, and reduced motion have scoped contracts', () => {
  assert.match(css, /Skill Tree craft v115/);
  assert.match(css, /\.tree-node\.locked[\s\S]{0,240}border-style:\s*dashed/);
  assert.match(css, /\.tree-node\.capstone\.unlocked[\s\S]{0,220}var\(--glow-legendary\)/);
  assert.match(css, /\.tree-node\.capstone:not\(\.unlocked\)[\s\S]{0,180}box-shadow:\s*none/);
  assert.doesNotMatch(css, /#main:has\(\.tree-shell\) ~ #ai-fab[^}]*display:\s*none/);
  assert.match(css, /\.tree-active \.ta-label,[\s\S]{0,100}\.perk-active[\s\S]{0,180}flex:\s*0 0 auto[\s\S]{0,180}white-space:\s*nowrap/);
  assert.match(css, /:root\[data-theme="light"\][\s\S]*--tree-available-fg:/);
  assert.match(css, /@media \(pointer: coarse\), \(max-width: 600px\)[\s\S]*\.tree-tab[\s\S]*var\(--touch-min\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.tree-node\.recommend[\s\S]*animation:\s*none/);
});

test('authored Tree copy has stable complete five-locale catalogs', () => {
  const locales = ['de', 'en', 'es', 'ru', 'uk'];
  const template = frozenJsonConstant('TREE_AUTHORED_COPY');
  assert.equal(template.version, 1);
  assert.equal(Object.keys(template.archetypeByIcon).length, 11);
  assert.equal(Object.keys(template.rows).length, 77);
  let templateFields = 0;
  for (const row of Object.values(template.rows)) {
    for (const field of ['title', 'desc']) {
      assert.deepEqual(Object.keys(row[field]).sort(), locales);
      for (const value of Object.values(row[field])) assert.ok(String(value).trim());
      templateFields += 1;
    }
  }
  assert.equal(templateFields, 154);

  const ladder = frozenJsonConstant('LADDER_AUTHORED_COPY');
  assert.equal(ladder.version, 1);
  assert.equal(Object.keys(ladder.aliasToId).length, 56);
  assert.equal(Object.keys(ladder.variants).length, 43);
  let ladderFields = 0;
  for (const variant of Object.values(ladder.variants)) {
    assert.deepEqual(Object.keys(variant.hint).sort(), locales);
    ladderFields += 1;
    for (const tier of variant.tiers) {
      assert.deepEqual(Object.keys(tier).sort(), locales);
      for (const value of Object.values(tier)) assert.ok(String(value).trim());
      ladderFields += 1;
    }
  }
  assert.equal(ladderFields, 261);
  assert.match(app, /TREE_TEMPLATE_COPY_KEY_RE = \/\^tree\\\.template/);
  assert.match(app, /TREE_LADDER_COPY_KEY_RE = \/\^tree\\\.ladder/);
  assert.match(app, /document\.documentElement\.lang = lang\(\)/);

  const perkStart = app.indexOf('const PERK_TEXT = Object.freeze(');
  const perkEnd = app.indexOf('\nconst PERK_KINDS = {', perkStart);
  assert.ok(perkStart >= 0 && perkEnd > perkStart, 'localized perk contract must exist');
  const makePerkText = Function('lang', `${app.slice(perkStart, perkEnd)}\nreturn { PERK_TEXT, perkText };`);
  for (const locale of ['ru', 'en', 'de', 'uk', 'es']) {
    const { PERK_TEXT, perkText } = makePerkText(() => locale);
    assert.equal(Object.keys(PERK_TEXT).length, 8);
    for (const kind of Object.keys(PERK_TEXT)) {
      const value = perkText(kind, kind === 'title' ? 0 : 2);
      assert.ok(value.trim(), `${kind}.${locale} must not be empty`);
      if (['en', 'de', 'es'].includes(locale)) assert.doesNotMatch(value, /[А-Яа-яЁёІіЇїЄє]/, `${kind}.${locale} leaks Cyrillic`);
    }
  }
  assert.equal((app.match(/^  "Заблокировано":/gm) || []).length, 1);
});

test('v115 remains offline-upgrade safe', () => {
  const cache = Number((sw.match(/const CACHE = 'satoru-v(\d+)'/) || [])[1]);
  assert.ok(cache >= 115, `expected SW cache >=115, got ${cache}`);
  for (const file of ['day-observation-v1.js', 'den-stage-v1.js', 'avatar-forge-v1.html']) assert.match(sw, new RegExp(file.replaceAll('.', '\\.')));
});
