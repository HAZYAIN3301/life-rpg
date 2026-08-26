'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const COPY = require('../public/guide-v3-copy-ru.js');

test('the Shadow assistant entry is global across every normal application view', () => {
  assert.match(APP, /<button id="ai-fab" data-action="open-helper"/);
  const hidden = [...CSS.matchAll(/([^{}]*#ai-fab[^{}]*)\{([^{}]*display:\s*none[^{}]*)\}/g)]
    .map((match) => match[1].trim())
    .filter((selector) => selector.split(',').some((part) => /#ai-fab\s*$/.test(part.trim())));
  assert.equal(hidden.length, 1);
  assert.match(hidden[0], /html\.is-capture #ai-fab/,
    'only the explicit screenshot/capture mode may hide the global assistant');
});

test('the approved Guide opens normally and feedback survives any locale fallback', () => {
  assert.equal(COPY.RUNTIME_APPROVED, true);
  assert.equal(COPY.STATUS, 'runtime-approved');
  assert.match(APP, /function feedbackPanelHTML\(\)[\s\S]*id="feedback-form"/);
  assert.match(APP, /function showGuideUnavailable\(\)[\s\S]{0,900}feedbackPanelHTML\(\)/);
  assert.equal((APP.match(/id="feedback-form"/g) || []).length, 1,
    'feedback form markup must have one shared source rather than drifting copies');
});
