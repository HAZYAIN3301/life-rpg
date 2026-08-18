'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
const GUIDE_CSS = CSS.slice(CSS.indexOf('Guide v3 — non-modal'));

function rule(selector) {
  const start = CSS.indexOf(selector);
  assert.notEqual(start, -1, `missing CSS selector: ${selector}`);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  assert.ok(open > start && close > open, `malformed CSS rule: ${selector}`);
  return CSS.slice(open + 1, close);
}

test('Guide bond contact is an expanded authored zone instead of the compact companion portrait', () => {
  const contact = rule('.comp-card .comp-art.guide-shadow-contact');
  assert.match(contact, /grid-template-rows:\s*128px\s+minmax\(var\(--touch-min\),\s*auto\)/);
  assert.match(contact, /min-inline-size:\s*128px/);
  assert.match(contact, /min-block-size:\s*128px/);
  assert.match(contact, /inline-size:\s*calc\(128px \+ var\(--sp-4\)\)/);
  assert.match(contact, /border:\s*2px solid var\(--today-kicker-fg,\s*var\(--accent-2\)\)/);

  const art = rule('.guide-shadow-contact > :is(.shadow-rig, .comp-video)');
  assert.match(art, /block-size:\s*128px/);
  assert.match(art, /min-block-size:\s*128px/);
});

test('Guide bond contact keeps a visible caption, canonical focus and motion-safe feedback', () => {
  const caption = rule('.guide-shadow-contact::after');
  assert.match(caption, /content:\s*attr\(aria-label\)/);
  assert.match(caption, /font-size:\s*var\(--type-control\)/);
  assert.match(caption, /min-block-size:\s*var\(--touch-min\)/);

  const focus = rule('.comp-card .comp-art.guide-shadow-contact:focus-visible');
  assert.match(focus, /box-shadow:\s*var\(--focus-ring\)/);

  assert.match(GUIDE_CSS, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.comp-card \.comp-art\.guide-shadow-contact:hover/);
  assert.match(GUIDE_CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.guide-shadow-contact[\s\S]*?animation:\s*none !important/);
});
