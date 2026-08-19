const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function pngSize(file) {
  const data = fs.readFileSync(path.join(ROOT, file));
  assert.equal(data.toString('ascii', 1, 4), 'PNG');
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

const base = 'public/art/avatars/traveller-core-v1/male/room-actions-v4';
const manifest = JSON.parse(read(`${base}/manifest.json`));
assert.equal(manifest.id, 'traveller-room-actions-v4');
assert.equal(manifest.layout, 'workshop-v5');
assert.deepEqual(manifest.anchor, { leftPct: 65, bottomPct: 10.9, widthPct: 21.75 });
for (const file of ['bench-rest.png', 'bench-read-a.png', 'bench-read-b.png', 'bench-portal-reach.png']) {
  assert.deepEqual(pngSize(`${base}/${file}`), [640, 900], `${file} must use the shared stage`);
}

const controller = read('public/traveller-room-v4.js');
assert.match(controller, /bench-rest/);
assert.match(controller, /bench-read/);
assert.match(controller, /TravellerMotionV3\.cancel/);
assert.match(controller, /is-body-pair-active/);
assert.match(controller, /localStorage/);
assert.match(controller, /function restore\(/);
assert.match(controller, /scene\.dataset\.denRenderer !== 'v5'/);
assert.match(controller, /scene\.dataset\.denTheme !== 'workshop'/);

const persisted = new Map();
const localStorage = {
  getItem(key) { return persisted.has(key) ? persisted.get(key) : null; },
  setItem(key, value) { persisted.set(key, String(value)); },
  removeItem(key) { persisted.delete(key); },
};
class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
  }

  set src(value) {
    this._src = value;
    this.complete = true;
    this.naturalWidth = 1;
  }

  get src() { return this._src; }
}
const roomContext = {
  clearTimeout,
  console,
  document: { querySelector: () => null },
  Image: FakeImage,
  localStorage,
  setTimeout,
};
roomContext.window = roomContext;
vm.runInNewContext(controller, roomContext, { filename: 'traveller-room-v4.js' });
const room = roomContext.TravellerRoomV4;
assert.equal(room.VERSION, '4.3.0');
assert.equal(room.DEFAULT_GENDER, 'male');
assert.deepEqual([...room.GENDERS], ['male', 'female']);
assert.equal(room.BASE, '/art/avatars/traveller-core-v1/male/room-actions-v4');
assert.equal(room.BASES.female, '/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4');
assert.equal(room.frameSrc('bench-portal-reach.png'), '/art/avatars/traveller-core-v1/male/room-actions-v4/bench-portal-reach.png');
assert.equal(room.frameSrc('bench-portal-reach.png', 'female'), '/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-portal-reach.png');
assert.equal(room.frameSrc('bench-portal-reach.png', { gender: 'female' }), '/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-portal-reach.png');
assert.equal(room.frameSrc('bench-portal-reach.png', 'unknown'), null, 'an explicit unknown gender must never fall back to male');
assert.equal(room.frameSrc('../male/bench-portal-reach.png', 'female'), null, 'frame paths must be safe basenames');
assert.equal(room.frameSrc('nested/bench-portal-reach.png', 'female'), null, 'nested frame paths must be rejected');
assert.equal(room.frameSrc('bench-portal-reach.svg', 'female'), null, 'room plates must stay normalized PNG files');
assert.equal(room.actionFor('bench-rest').frames[0], '/art/avatars/traveller-core-v1/male/room-actions-v4/bench-rest.png');
assert.equal(room.actionFor('bench-rest', 'female').frames[0], '/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-rest.png');
assert.equal(room.actionFor('bench-read', { gender: 'female' }).frames[1], '/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4/bench-read-b.png');
assert.equal(room.actionFor('bench-read', 'unknown'), null, 'an explicit unknown gender must never fall back to male');
assert.match(room.markup({ gender: 'female' }), /data-traveller-gender="female"/);
assert.match(room.markup({ gender: 'female' }), /traveller-core-v1\/female\/f2-v1\/room-actions-v4\/bench-rest\.png/);
assert.equal(room.markup({ gender: 'unknown' }), '');

function fakeClassList() {
  const names = new Set();
  return {
    add(...values) { values.forEach((value) => names.add(value)); },
    remove(...values) { values.forEach((value) => names.delete(value)); },
    contains(value) { return names.has(value); },
  };
}

function fakeShell(gender) {
  const frames = [{ src: '' }, { src: '' }];
  const attributes = {};
  const layer = {
    classList: fakeClassList(),
    dataset: {},
    querySelectorAll(selector) { return selector === '.traveller-room-v4__frame' ? frames : []; },
    setAttribute(name, value) { attributes[name] = String(value); },
  };
  const stack = { dataset: { avatarCoreGender: gender } };
  const scene = { dataset: { denRenderer: 'v5', denTheme: 'workshop' } };
  const shell = {
    classList: fakeClassList(),
    dataset: {},
    isConnected: true,
    matches(selector) { return selector === '.den-shell'; },
    querySelector(selector) {
      if (selector === '.avatar-core-stack') return stack;
      if (selector === '.den-scene') return scene;
      if (selector === '[data-traveller-room-v4]') return layer;
      if (selector === '.den-avatar-core') return null;
      return null;
    },
  };
  return { attributes, frames, layer, shell, stack };
}

const STORAGE_KEY = 'satoru.traveller-room-v4.active';
const future = () => Date.now() + 60000;
const femaleShell = fakeShell('female');
localStorage.setItem(STORAGE_KEY, JSON.stringify({ actionId: 'bench-rest', expiresAt: future(), id: 'legacy-male' }));
assert.equal(room.restore(femaleShell.shell), false, 'a legacy record is male and must not restore into a female shell');
assert.equal(localStorage.getItem(STORAGE_KEY), null, 'a restore mismatch must clear the stale record');
assert.equal(femaleShell.attributes['aria-hidden'], 'true');

const maleShell = fakeShell('male');
localStorage.setItem(STORAGE_KEY, JSON.stringify({ actionId: 'bench-rest', expiresAt: future(), id: 'legacy-male-ok' }));
assert.equal(room.restore(maleShell.shell), true, 'a legacy record remains compatible with the male runtime');
assert.match(maleShell.frames[0].src, /traveller-core-v1\/male\/room-actions-v4\/bench-rest\.png/);
assert.equal(maleShell.layer.dataset.travellerGender, 'male');
assert.equal(room.cancel(maleShell.shell), true);

localStorage.setItem(STORAGE_KEY, JSON.stringify({ actionId: 'bench-read', gender: 'female', expiresAt: future(), id: 'female-ok' }));
assert.equal(room.restore(femaleShell.shell), true);
assert.match(femaleShell.frames[0].src, /traveller-core-v1\/female\/f2-v1\/room-actions-v4\/bench-read-a\.png/);
assert.match(femaleShell.frames[1].src, /traveller-core-v1\/female\/f2-v1\/room-actions-v4\/bench-read-b\.png/);
assert.equal(femaleShell.layer.dataset.travellerGender, 'female');
assert.equal(room.cancel(femaleShell.shell), true);

localStorage.setItem(STORAGE_KEY, JSON.stringify({ actionId: 'bench-rest', gender: 'robot', expiresAt: future(), id: 'invalid-gender' }));
assert.equal(room.restore(maleShell.shell), false);
assert.equal(localStorage.getItem(STORAGE_KEY), null, 'an invalid persisted gender must be rejected and cleared');

localStorage.setItem(STORAGE_KEY, JSON.stringify({ actionId: 'bench-rest', gender: null, expiresAt: future(), id: 'null-gender' }));
assert.equal(room.restore(maleShell.shell), false);
assert.equal(localStorage.getItem(STORAGE_KEY), null, 'an explicit null gender is not a legacy record and must never fall back to male');

const app = read('public/app.js');
assert.match(app, /TravellerRoomV4\.markup/);
assert.match(app, /cancelDenRoomAction\(false\)/);
assert.match(app, /data-room-action="bench-rest"/);
assert.match(app, /data-room-action="bench-read"/);
assert.match(app, /TravellerRoomV4\.restore/);
assert.match(app, /TravellerMotionV3\.walkTo\(host, 'bench'/);
assert.match(app, /data-den-prop-portal/);

const css = read('public/styles.css');
assert.match(css, /left: 65%;/);
assert.match(css, /bottom: 10\.9%;/);
assert.match(css, /steps\(1,end\)/);
assert.match(css, /prefers-reduced-motion: reduce/);

const html = read('public/index.html');
assert.ok(html.indexOf('traveller-motion-v3.js') < html.indexOf('traveller-room-v4.js'));
assert.ok(html.indexOf('traveller-room-v4.js') < html.indexOf('app.js'));

const sw = read('public/sw.js');
const swCache = sw.match(/const CACHE = 'satoru-v(\d+)'/);
assert.ok(swCache, 'service-worker cache version must be declared');
assert.ok(Number(swCache[1]) >= 105, 'Traveller room v4 requires cache v105 or newer');
assert.match(sw, /room-actions-v4\/bench-read-b\.png/);
assert.match(sw, /prop-portal-core\.png/);
assert.match(app, /bench-portal-reach\.png/);

console.log('Traveller room actions v4: runtime contract checks passed');
