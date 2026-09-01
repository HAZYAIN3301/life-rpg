'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const Guide = require('../public/guide-v3.js');
const Presenter = require('../public/guide-presenter-v1.js');
const copies = Object.fromEntries(['ru', 'en', 'de', 'uk', 'es']
  .map((locale) => [locale, require(`../public/guide-v3-copy-${locale}.js`)]));
const APP = read('public/app.js');
const INDEX = read('public/index.html');
const SW = read('public/sw.js');

function section(start, end) {
  const from = APP.indexOf(start), to = APP.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source section: ${start}`);
  return APP.slice(from, to);
}

test('Tree Guide v3 is a real-path chapter and no longer waits for a game point', () => {
  const entry = Guide.REGISTRY.find((item) => item.chapter === 'tree');
  assert.equal(entry.version, 3);
  assert.equal(entry.action, 'inspect-real-path');
  assert.equal(entry.completion, 'tree-seen');
  const state = Guide.defaultState();
  state.completedChapters = [Guide.FIRST_CHAPTER, 'hero'];
  assert.equal(Guide.entryEligible(entry, state, { level: 3, treePoints: 99, treeNodeId: '', sessionPrompted: false }), false,
    'bonus points alone must not start the new chapter');
  assert.equal(Guide.entryEligible(entry, state, { level: 3, treePoints: 0, treeNodeId: 'cap-1', sessionPrompted: false }), true,
    'one available real capability is enough even with zero bonus points');
});

test('presenter moves the spotlight from the sphere to the nearest real milestone', () => {
  let state = Guide.reduce(Guide.defaultState(), { type: 'guide:start', chapter: 'tree', at: 1 }).state;
  state = Guide.reduce(state, { type: 'guide:context-next', itemId: 'cap-1', at: 2 }).state;
  let vm = Presenter.present({ state, chapter: 'tree', copy: copies.ru });
  assert.equal(vm.step, 'engage');
  assert.equal(vm.targetKey, 'tree-skill');
  state = Guide.reduce(state, { type: 'guide:context-complete', completion: 'tree-seen', itemId: 'cap-1', persisted: true, at: 3 }).state;
  vm = Presenter.present({ state, chapter: 'tree', copy: copies.ru });
  assert.equal(vm.step, 'complete');
  assert.equal(vm.targetKey, 'tree-v4-next');
});

test('all five locales explain Path, criteria and separate game bonuses', () => {
  const expectedVersions = { ru: '1.4.0', en: '0.5.0', de: '0.5.0', uk: '0.5.0', es: '0.5.0' };
  for (const [locale, copy] of Object.entries(copies)) {
    assert.equal(copy.VERSION, expectedVersions[locale]);
    assert.ok(copy.get('chapter.tree.title'));
    const text = `${copy.get('context.tree.prompt')} ${copy.get('context.tree.complete')}`;
    assert.doesNotMatch(text, /skill point|Skillpunkt|очко навич|очко навыка|punto de habilidad/i);
    assert.match(text, /Путь|Path|Weg|Шлях|Camino/);
    assert.match(text, /критер|criterion|Kriterium|criterio/i);
    assert.match(text, /бонус|bonus|boni/i);
  }
});

test('runtime selects an available capability, opens Path and completes on the exact sphere only', () => {
  const context = section('function guideV3Context(', '\nfunction guideV3ChapterDataReady');
  assert.match(context, /treeCapabilityPath\(State\.tree\?\.\[skill\.id\]\)/);
  assert.match(context, /!node\.unlocked && nodeUnlockable\(skill\.id, node\)/);
  assert.doesNotMatch(context, /available > 0 \? \(State\.tree/);

  const open = section('async function guideV3OpenContextChapter()', '\nasync function guideV3OpenHabitsChapter');
  assert.match(open, /State\.treeLayer = 'path'/);
  assert.doesNotMatch(open, /State\.treeLayer = 'practices'/);

  const selector = section('function guideV3TargetSelector', '\nfunction guideV3RevealTarget');
  assert.match(selector, /data-guide-target="tree-v4-next"/);
  assert.match(selector, /data-action="select-tree"/);

  const select = section("action === 'select-tree'", "action === 'tree-layer'");
  assert.match(select, /candidateId[\s\S]*treeNodeKind\(candidate\) === 'capability'/);
  assert.match(select, /!candidate\.unlocked && nodeUnlockable\(sid, candidate\)/);
  assert.match(select, /guideV3CompleteContext\('tree', 'tree-seen', candidateId/);

  const node = section("action === 'tree-select-node'", "action === 'unlock-node'");
  assert.doesNotMatch(node, /guideV3CompleteContext\('tree'/,
    'opening a game-bonus node must never satisfy the real-path chapter');
  assert.match(APP, /class="tree-v4-next" data-guide-target="tree-v4-next" data-node="\$\{esc\(next\.id\)\}"/);
});

test('v205 Guide assets remain pinned while v210 advances the app shell', () => {
  assert.match(SW, /const CACHE = 'satoru-v214'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v214'/);
  for (const file of ['guide-v3.js', 'guide-v3-copy-ru.js', 'guide-v3-copy-en.js', 'guide-v3-copy-de.js', 'guide-v3-copy-uk.js', 'guide-v3-copy-es.js', 'guide-presenter-v1.js']) {
    assert.match(INDEX, new RegExp(`${file.replace('.', '\\.')}\\?v=20260830-guide-tree-v205-1`));
  }
  for (const file of ['app.js', 'styles.css']) {
    assert.match(INDEX, new RegExp(`${file.replace('.', '\\.')}\\?v=20260901-browser-companion-v213-1`));
  }
});
