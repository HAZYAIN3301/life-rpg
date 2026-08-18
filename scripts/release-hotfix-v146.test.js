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
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end}`);
  return source.slice(from, to);
}

test('v146 localizes dynamic day counts instead of emitting a Russian suffix in another locale', () => {
  const helper = between(APP, 'function localizedDayCount', '\nfunction i18nNote');
  assert.match(helper, /lang\(\) === 'ru'/);
  assert.match(helper, /i18nDay\(count, lang\(\)\)/);
  assert.match(APP, /'Pro-триал': \{ en: 'Pro trial', de: 'Pro-Testphase', uk: 'Pro-пробний період', es: 'Prueba Pro' \}/);
  assert.match(APP, /title="\$\{t\('Pro-триал'\)\}"/);
  assert.match(APP, /localizedDayCount\(trialDaysLeft\(\), true\)/);
  assert.doesNotMatch(APP, /trialDaysLeft\(\)\}д/);
});

test('v146 More sheet has a focus fallback inside its modal', () => {
  const helper = between(APP, 'function focusMobileNavInitialTarget', '\nfunction handleMobileNavSheetKeydown');
  const sheet = between(APP, 'function showMobileNavSheet()', '\nconst ACCENTS');
  assert.match(helper, /mobile-sheet-close/);
  assert.match(helper, /overlay\.contains\(document\.activeElement\)/);
  assert.match(sheet, /focusMobileNavInitialTarget\(overlay\);/);
  assert.match(sheet, /requestAnimationFrame\(\(\) => focusMobileNavInitialTarget\(overlay\)\)/);
  assert.match(sheet, /setTimeout\(\(\) => focusMobileNavInitialTarget\(overlay\), 190\)/);
});

test('v146 keeps advisory drips out of mobile work and off the desktop quest board', () => {
  const check = between(APP, 'function dripCheck()', '\nfunction dripStart');
  const paint = between(APP, 'function tutorialPaint()', '\nfunction tutMascotHTML');
  assert.match(check, /window\.matchMedia\('\(max-width: 760px\)'\)\.matches/);
  assert.match(paint, /State\.view !== 'today'/);
  assert.match(paint, /window\.matchMedia\('\(max-width: 760px\)'\)\.matches/);
  assert.match(CSS, /@media \(min-width: 761px\)/);
  assert.match(CSS, /\.tut-bubble\.tut-drip \{ left: auto; right: max\(24px, calc\(\(100vw - 1040px\) \/ 2\)\)/);
  assert.match(CSS, /tut-drip-rise/);
});

test('v146 invalidates the PWA shell', () => {
  assert.match(SW, /const CACHE = 'satoru-v161';/);
});
