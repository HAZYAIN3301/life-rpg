const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
