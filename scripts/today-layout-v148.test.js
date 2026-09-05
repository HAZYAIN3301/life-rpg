const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Today tabs occupy their own full grid row', () => {
  const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
  assert.match(app, /<div class="today-shell">\$\{tabs\}<section id="today-panel-board" role="tabpanel" aria-labelledby="today-tab-board" hidden><\/section>/);
  assert.match(app, /\$\{browserCompanionLaunchHTML\(\)\}\s*<div id="today-panel-day" class="today-work" role="tabpanel" aria-labelledby="today-tab-day">/);
  assert.match(css, /\.today-tabs\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
});

test('Today layout restoration advances the PWA shell', () => {
  const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE = 'satoru-v243'/);
});
