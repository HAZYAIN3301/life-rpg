const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = app.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < app.length; i += 1) {
    if (app[i] === '{') depth += 1;
    else if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`${name} must close`);
}

test('Settings is one h2 hub with six purpose groups and progressive disclosure', () => {
  const view = functionBody('renderSettings');
  const expected = ['account', 'experience', 'life', 'connections', 'progression', 'data'];
  for (const id of expected) {
    assert.match(view, new RegExp(`\\['${id}',`), `missing ${id} in canonical group order`);
    assert.match(view, new RegExp(`groupStart\\('${id}'`), `missing ${id} section`);
  }
  assert.match(view, /<h2 id="settings-title"/);
  assert.match(view, /class="settings-hub-nav" aria-label=/);
  assert.match(view, /data-action="set-settings-group"/);
  assert.match(view, /data-action="settings-section-step"/);
  assert.match(view, /data-settings-group="\$\{id\}" aria-labelledby=/);
  assert.match(view, /activeGroup === id \? '' : 'hidden'/);
  assert.doesNotMatch(view, /data-action="save-settings"/);
  assert.match(view, /\$\{pathCard\(\)\}/);
  assert.ok(view.indexOf("groupStart('life'") < view.indexOf('${pathCard()}'), 'path belongs to Life');
});

test('Settings direct entries and outline stay focused and semantic after commit', () => {
  assert.match(app, /action === 'goto-import'[\s\S]*State\.settingsSection = 'life'/);
  assert.match(app, /action === 'set-settings-group'[\s\S]*State\._settingsFocusAfterCommit/);
  const outline = functionBody('normalizeSettingsOutline');
  assert.match(outline, /\.settings-group > \.card h3/);
  assert.match(outline, /document\.createElement\('h4'\)/);
  assert.match(functionBody('afterMainCommit'), /normalizeSettingsOutline\(\)/);
  assert.match(functionBody('afterMainCommit'), /labelSettingsControls\(\)/);
  const labels = functionBody('labelSettingsControls');
  assert.match(labels, /input, select, textarea/);
  assert.match(labels, /aria-label/);
  assert.match(functionBody('afterMainCommit'), /State\._settingsFocusAfterCommit/);
});

test('Settings hub remains operable at a coarse mobile viewport', () => {
  assert.match(css, /\.settings-hub-item\s*\{[\s\S]*min-block-size:\s*var\(--touch-min\)/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.settings-mobile-step\s*\{\s*display:\s*grid/);
  assert.match(css, /\.settings-group\[hidden\]\s*\{\s*display:\s*none !important/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.settings-shell/);
});
