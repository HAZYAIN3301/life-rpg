'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const Guide = require('../public/guide-v3.js');
const Presenter = require('../public/guide-presenter-v1.js');
const Ru = require('../public/guide-v3-copy-ru.js');
const APP = read('public/app.js');
const INDEX = read('public/index.html');
const SW = read('public/sw.js');
const CSS = read('public/styles.css');

const CHAPTER = 'systemTheme';
const COMPLETION = 'system-theme-persisted';

function completedFirst() {
  const state = Guide.defaultState();
  state.completedChapters = [Guide.FIRST_CHAPTER];
  state.chapterMeta[Guide.FIRST_CHAPTER] = { completedAt: 1 };
  return state;
}

test('v205 System Theme is manual-only but available from the Guide library', () => {
  const entry = Guide.REGISTRY.find((item) => item.chapter === CHAPTER);
  assert.ok(entry);
  assert.equal(entry.version, 2);
  assert.equal(entry.completion, COMPLETION);
  assert.equal(entry.manualOnly, true);
  const state = completedFirst();
  assert.equal(Guide.entryEligible(entry, state, { level: 2, now: 10 }), true);
  assert.equal(Guide.nextContextual(state, { level: 2, now: 10 }, [entry]), null,
    'a theme preference never interrupts Today as an automatic lesson');
  const card = Presenter.libraryCards(state, { availableChapters: [CHAPTER] }, Guide.REGISTRY, Ru)
    .find((item) => item.id === CHAPTER);
  assert.equal(card.available, true);
  assert.equal(card.title, Ru.get('chapter.system_theme.title'));
});

test('System Theme completes only after the exact persisted theme receipt', () => {
  let state = completedFirst();
  let result = Guide.reduce(state, { type: 'guide:start', chapter: CHAPTER, at: 10 });
  assert.equal(result.accepted, true); state = result.state;
  result = Guide.reduce(state, { type: 'guide:context-next', at: 11 });
  assert.equal(result.accepted, true); state = result.state;
  assert.equal(state.waitingFor, COMPLETION);
  assert.equal(Guide.reduce(state, { type: 'guide:context-complete', completion: COMPLETION, persisted: false, at: 12 }).accepted, false);
  assert.equal(Guide.reduce(state, { type: 'guide:context-complete', completion: 'theme-seen', persisted: true, at: 12 }).accepted, false);
  result = Guide.reduce(state, { type: 'guide:context-complete', completion: COMPLETION, persisted: true, at: 13 });
  assert.equal(result.accepted, true); state = result.state;
  assert.equal(state.currentStep, 'complete');
  result = Guide.reduce(state, { type: 'guide:context-finish', at: 14 });
  assert.equal(result.accepted, true);
  assert.ok(result.state.completedChapters.includes(CHAPTER));
});

test('presenter sends System Theme to real Settings controls in all three steps', () => {
  const make = (step) => Presenter.present({
    chapter: CHAPTER,
    copy: Ru,
    state: {
      ...completedFirst(), currentChapter: CHAPTER, currentStep: step,
      chapterMeta: { [Guide.FIRST_CHAPTER]: { completedAt: 1 }, [CHAPTER]: {} },
    },
  });
  assert.equal(make('intro').targetSelector, '[data-guide-target="settings-nav"]');
  assert.equal(make('engage').targetSelector, '[data-guide-target="system-theme-choice"]');
  assert.equal(make('complete').targetSelector, '[data-guide-target="system-theme-choice"]');
  assert.equal(make('engage').transcript, Ru.get('context.system_theme.prompt'));
  assert.equal(make('complete').transcript, Ru.get('context.system_theme.complete'));
});

test('all five released locale manifests approve System Theme at the v205 versions', () => {
  const expected = { ru: '1.4.0', en: '0.5.0', de: '0.5.0', uk: '0.5.0', es: '0.5.0' };
  for (const [locale, version] of Object.entries(expected)) {
    const copy = require(`../public/guide-v3-copy-${locale}.js`);
    assert.equal(copy.VERSION, version);
    assert.equal(copy.CONTEXTUAL_STATUS.systemTheme, 'runtime-approved');
    assert.ok(copy.get('chapter.system_theme.title'));
    assert.ok(copy.get('context.system_theme.prompt'));
    assert.ok(copy.get('context.system_theme.complete'));
  }
});

test('theme choice is awaited, follows the device, and advances Guide only inside the committed settings write', () => {
  assert.match(APP, /data-theme="system"[^>]*data-guide-target="system-theme-choice"/);
  assert.match(APP, /function applyTheme\(\)[\s\S]{0,900}prefers-color-scheme: light[\s\S]{0,500}s\.theme === 'system'/);
  assert.match(APP, /function initSystemThemeListener\(\)[\s\S]{0,700}addEventListener\('change', repaint\)/);
  assert.match(APP, /async function persistThemeChoice[\s\S]{0,2400}Store\.updateNow\('settings'[\s\S]{0,1200}system-theme-persisted[\s\S]{0,1200}State\.settings = committed/);
  assert.match(APP, /persistThemeChoice\(rawChoice\)[\s\S]{0,200}!\['dark', 'light', 'system'\]\.includes\(rawChoice\)\) return false/,
    'an unknown UI value must fail closed instead of silently becoming Dark');
  assert.match(APP, /if \(action === 'set-theme'\) \{ await persistThemeChoice\(el\.dataset\.theme\); return; \}/);
  assert.match(APP, /systemTheme: 'settings'/);
  assert.match(APP, /systemTheme: guideV3ReleasedChapter\('system-theme-persisted'\)/);
  assert.match(CSS, /\.theme-opt\s*\{\s*min-height:\s*var\(--touch-min\)/,
    'the real System Theme control keeps the product touch-target floor');
});

test('v205 Guide assets remain pinned while v206 advances the application shell', () => {
  assert.match(SW, /const CACHE = 'satoru-v206'/);
  for (const file of ['guide-v3.js', 'guide-presenter-v1.js', 'guide-v3-copy-ru.js', 'guide-v3-copy-en.js', 'guide-v3-copy-de.js', 'guide-v3-copy-uk.js', 'guide-v3-copy-es.js']) {
    assert.match(INDEX, new RegExp(`${file.replace('.', '\\.')}\\?v=[^"']*v205`));
  }
  for (const file of ['app.js', 'styles.css']) {
    assert.match(INDEX, new RegExp(`${file.replace('.', '\\.')}\\?v=[^"']*v206`));
  }
});
