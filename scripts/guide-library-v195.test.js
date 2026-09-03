'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const APP = read('public/app.js');
const INDEX = read('public/index.html');
const SW = read('public/sw.js');

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source range: ${start}`);
  return source.slice(from, to);
}

test('manual Guide library does not reuse contextual prompt eligibility', () => {
  const library = between(APP, 'function guideV3AvailableChapters()', '\nfunction showGuide()');
  assert.doesNotMatch(library, /entryEligible\s*\(/,
    'manual discovery must not wait for an unsolicited-prompt trigger');
  assert.match(library, /firstJourneyResolved/,
    'First Journey remains the one deliberate onboarding boundary');
  assert.match(library, /guideV3ChapterDataReady\(entry\.chapter\)/);
  assert.match(library, /guideV3ContextRuntimeAllowed\(entry\.chapter\)/);
  assert.match(library, /calendar[^\n]*calendarTaskId/);
  assert.match(library, /rewards[^\n]*rewardId/);
  assert.match(library, /tree[^\n]*treeNodeId/);
  assert.match(library, /jarvis[^\n]*aiReady/);
});

test('automatic Guide prompts keep the contextual pacing contract', () => {
  const automatic = between(APP, 'function guideV3MaybeStart()', '\nasync function guideV3Snooze');
  assert.match(automatic, /nextContextual\(state,\s*guideV3Context\(\),\s*releasedRegistry\)/);
});

test('v195 ships the manual-library fix through a fresh offline cache', () => {
  assert.match(SW, /const CACHE = 'satoru-v229'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v229'/);
  for (const file of ['guide-v3.js', 'guide-presenter-v1.js', 'guide-v3-copy-ru.js', 'guide-v3-copy-en.js', 'guide-v3-copy-de.js', 'guide-v3-copy-uk.js', 'guide-v3-copy-es.js']) {
    assert.match(INDEX, new RegExp(`${file.replace('.', '\\.')}\\?v=[^"']*v205`));
  }
  assert.match(INDEX, /app\.js\?v=[^"']*v215/);
  assert.match(INDEX, /styles\.css\?v=[^"']*v215/);
});
