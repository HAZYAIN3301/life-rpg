'use strict';

/* Home-screen app on a notched iPhone (status bar black-translucent): the phone header
 * must clear the clock, Wi-Fi and battery (22.10 feedback). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'design-next-v1.css'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('the app draws under a translucent status bar, so the phone header pads by the safe area', () => {
  assert.match(HTML, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(HTML, /viewport-fit=cover/);
  const phone = CSS.slice(CSS.indexOf('@media(max-width:760px){'));
  const header = phone.match(/:root\[data-design=next\] #topbar\{[^}]*\}/);
  assert.ok(header, 'phone header rule');
  assert.match(header[0], /padding:max\(12px,env\(safe-area-inset-top\)\) 16px 12px/);
});

test('scrolled content does not show through the clock band', () => {
  const band = CSS.match(/:root\[data-design=next\] body::before\{[^}]*\}/);
  assert.ok(band, 'status-bar band');
  assert.match(band[0], /height:env\(safe-area-inset-top,0px\)/);
  assert.match(band[0], /background:var\(--bg\)/);
  assert.match(band[0], /pointer-events:none/);
});
