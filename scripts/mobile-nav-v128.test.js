'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing ${start}`); assert.ok(to > from, `missing ${end}`);
  return source.slice(from, to);
}
function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

test('Mobile navigation v128 preserves exactly four primary destinations plus labelled More', () => {
  assert.match(APP, /const MOBILE_PRIMARY_SECTION_IDS = Object\.freeze\(\['today', 'plan', 'habits', 'hero'\]\)/);
  assert.match(APP, /const MOBILE_MORE_SECTION_IDS = Object\.freeze\(\['library', 'rewards', 'tribe'\]\)/);
  const nav = between(APP, 'function renderNav()', '\nfunction mobileNavFocusable');
  assert.match(nav, /MOBILE_PRIMARY_SECTION_IDS\.includes\(s\.id\)/);
  assert.match(nav, /aria-haspopup="dialog" aria-expanded="false" aria-current=/);
  assert.match(nav, /aria-current', s\.id === cur \? 'page' : 'false'/);
  assert.match(nav, /MOBILE_MORE_SECTION_IDS\.includes\(cur\)/);
  assert.match(nav, /MOBILE_MORE_SECTION_IDS\.includes\(s\.id\)/);
});

test('More is purpose-grouped and exposes current states instead of one meaningless grid', () => {
  const sheet = between(APP, 'function showMobileNavSheet()', '\nconst ACCENTS');
  for (const group of ['Развитие', 'Сообщество', 'Поддержка', 'Аккаунт и доступ', 'Справка и сеанс']) assert.match(sheet, new RegExp(`group\\('[^']+', '${escaped(group)}'`));
  assert.match(sheet, /sectionEntry\('rewards'\)/);
  assert.match(sheet, /sectionEntry\('tribe'\)/);
  assert.match(sheet, /data-action="open-helper"/);
  assert.match(sheet, /data-action="mobile-go-settings"[^>]*aria-current=/);
  assert.match(sheet, /data-action="show-paywall" data-feature="Pro"/);
  assert.doesNotMatch(sheet, /mobile-sheet-grid/);
  assert.match(sheet, /aria-labelledby="mobile-nav-title"/);
  assert.match(sheet, /setAttribute\('aria-expanded', 'true'\)/);
  assert.match(sheet, /guideV3Close\(\{ restoreFocus: false \}\)/, 'advisory Guide is suppressed while the modal sheet owns interaction');
});

test('More sheet owns keyboard focus and never steals it after a navigation transition', () => {
  const close = between(APP, 'function closeMobileNavSheet', '\n\nfunction showMobileNavSheet');
  const keyboard = between(APP, 'function handleMobileNavSheetKeydown', '\nfunction closeMobileNavSheet');
  const click = between(APP, 'const secBtn = e.target.closest', '\n  if (action === \'focus-add-task\')');
  assert.match(keyboard, /event\.key === 'Escape'/);
  assert.match(keyboard, /event\.key !== 'Tab'/);
  assert.match(keyboard, /last\.focus\(\)/);
  assert.match(close, /restoreFocus = true, immediate = false/);
  assert.match(close, /appRoot\.inert = !!overlay\._mobileNavAppWasInert/);
  assert.match(close, /restoreFocus && returnFocus && returnFocus\.isConnected/);
  assert.match(click, /fromMobileSheet/);
  assert.match(click, /closeMobileNavSheet\(\{ restoreFocus: false \}\)/);
  assert.match(click, /State\._mobileNavFocusAfterCommit = '#main h2'/);
  assert.match(click, /State\._mobileNavFocusAfterCommit = '#settings-title, #main h2'/);
  const commit = between(APP, 'function afterMainCommit()', '\n  if (State._tasksFocusAfterCommit)');
  assert.match(commit, /State\._mobileNavFocusAfterCommit/);
  assert.match(commit, /focusPathChoiceTarget\(target\)/);
  const guide = between(APP, 'function guideV3Paint()', '\nfunction guideV3MaybeStart');
  assert.match(guide, /\.modal-overlay, #mobile-nav-sheet/);
});

test('More copy has complete locale rows and nav CSS stays DOM-ordered', () => {
  for (const key of ['Развитие', 'Сообщество', 'Поддержка', 'Аккаунт и доступ', 'Справка и сеанс']) {
    const row = APP.match(new RegExp(`'${escaped(key)}': \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`));
  }
  const style = CSS.slice(CSS.indexOf('/* Mobile navigation v128'));
  assert.ok(style.length > 0);
  assert.doesNotMatch(style, /(?:^|\n)\s*order\s*:/m);
  assert.match(style, /\.mobile-sheet-entry\[aria-current="page"\]/);
  assert.match(style, /\.mobile-nav-sheet :is\(button,\.mobile-sheet-entry\):focus-visible/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  const cache = SW.match(/const CACHE = 'satoru-v(\d+)'/);
  assert.ok(cache && Number(cache[1]) >= 128, 'v128 navigation remains covered after later shell upgrades');
});
