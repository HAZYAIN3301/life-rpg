const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

function block(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing ${startMarker}`);
  assert.ok(end > start, `missing ${endMarker}`);
  return app.slice(start, end);
}

test('settings load uses checked recovery and a final write fence', () => {
  const validate = block('function validateSettingsPayload', '\nfunction settingsWriteAllowed');
  assert.match(validate, /Array\.isArray\(value\)/);
  assert.match(validate, /value\.skills/);
  const fence = block('function settingsWriteAllowed', '\nconst Store =');
  assert.match(fence, /State\._settingsLoadError/);
  assert.match(fence, /clearTimeout\(Store\._timers\.settings\)/);
  const store = block('const Store =', '\n//');
  assert.match(store, /name === 'settings' && !settingsWriteAllowed\('save', true\)/);
  assert.match(store, /name === 'settings' && !settingsWriteAllowed\('saveNow', true\)/);
  assert.match(store, /name === 'settings' && !settingsWriteAllowed\('_put', true\)/);
  const init = block('async function initApp()', '\n  State\.settings\.appName');
  assert.match(init, /Store\.loadChecked\('settings', freshOnboardingSettings\(\[\], State\.me && State\.me\.lang\), validateSettingsPayload\)/);
  assert.match(init, /State\._settingsLoadError = settingsLoad\.error/);
  assert.match(init, /State\.settingsSection = 'data'/);
});

test('ordinary Settings changes serialize through awaited saveNow and expose Retry', () => {
  const controller = block('const SettingsAutosave =', '\nfunction saveSettingsFromForm');
  assert.match(controller, /revision/);
  assert.match(controller, /durableRevision/);
  assert.match(controller, /await Store\.saveNow\('settings', State\.settings\)/);
  assert.match(controller, /await Store\.saveNow\('habits', State\.habits\)/);
  assert.match(controller, /if \(this\.durableRevision < this\.revision && !this\.failed\)/);
  assert.match(controller, /data-action="retry-settings-save"/);
  assert.match(app, /action === 'retry-settings-save'[\s\S]*SettingsAutosave\.flush\(\)/);
  assert.match(app, /function saveSettingsFromForm\(\) \{ return SettingsAutosave\.queue\(\{ immediate: true, includeTree: true \}\); \}/);
  assert.doesNotMatch(functionBody('renderSettings'), /data-action="save-settings"/);
});

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

test('path confirmation is awaited and rolls state back before reopening its dialog', () => {
  const confirm = block('async function confirmPathChoice', '\n// Единственная точка мутации пути');
  const choose = block('async function choosePath', '\n// Настройки остаются постоянной точкой обзора');
  assert.match(confirm, /const ok = await choosePath\(id\)/);
  assert.match(confirm, /showPathChoiceModal\(\{ pendingPath: id, source, returnFocus \}\)/);
  assert.match(choose, /const before = structuredClone\(s\)/);
  assert.match(choose, /await Store\.saveNow\('settings', State\.settings\)/);
  assert.match(choose, /State\.settings = before/);
});
