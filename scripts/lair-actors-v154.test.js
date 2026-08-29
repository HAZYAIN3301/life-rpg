const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const body = require(path.join(ROOT, 'public/body-toad-v1.js'));
const recovery = require(path.join(ROOT, 'public/recovery-slug-v1.js'));
const resources = require(path.join(ROOT, 'public/resources-penguin-v1.js'));
const shadow = require(path.join(ROOT, 'public/shadow-den-v1.js'));
const life = require(path.join(ROOT, 'public/den-life-v1.js'));

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Dependency-free RGBA PNG reader for the exact actor-asset contract.  It is
// intentionally part of CI: canvas dimensions alone cannot detect an opaque
// GIF plate or a low-alpha rectangle covering an otherwise valid cutout.
function inspectPng(filename) {
  const input = fs.readFileSync(filename);
  assert.deepEqual([...input.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], filename);
  let offset = 8, width = 0, height = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  assert.equal(depth, 8, `${filename}: only authored 8-bit plates are accepted`);
  assert.equal(color, 6, `${filename}: runtime actor PNG must be RGBA`);
  assert.equal(interlace, 0, `${filename}: deterministic audit requires non-interlaced PNG`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  let minX = width, minY = height, maxX = -1, maxY = -1, alphaPixels = 0, edgeAlpha = 0;
  const edge = Math.max(4, Math.round(Math.min(width, height) * 0.006));
  // PNG filters operate independently per channel. Reconstruct only alpha:
  // this retains exact matte/bbox evidence while avoiding three unused RGB
  // passes over every 1024/1536px authored plate in the normal test suite.
  let source = 0;
  let previous = new Uint8Array(width);
  let current = new Uint8Array(width);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source++];
    for (let x = 0; x < width; x += 1) {
      const value = raw[source + x * 4 + 3];
      const left = x ? current[x - 1] : 0;
      const up = y ? previous[x] : 0;
      const upperLeft = y && x ? previous[x - 1] : 0;
      const alpha = (filter === 0 ? value
        : filter === 1 ? value + left
          : filter === 2 ? value + up
            : filter === 3 ? value + Math.floor((left + up) / 2)
              : filter === 4 ? value + paeth(left, up, upperLeft)
                : (() => { throw new Error(`${filename}: unsupported filter ${filter}`); })()) & 255;
      current[x] = alpha;
      if (!alpha) continue;
      alphaPixels += 1;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (x < edge || y < edge || x >= width - edge || y >= height - edge) edgeAlpha += 1;
    }
    source += stride;
    const swap = previous; previous = current; current = swap; current.fill(0);
  }
  return {
    width, height, alphaPixels, edgeAlpha,
    bbox: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, bottom: maxY },
  };
}

function inspectPngCached(filename) {
  const key = path.resolve(filename);
  if (!inspectPngCached.cache.has(key)) inspectPngCached.cache.set(key, inspectPng(key));
  return inspectPngCached.cache.get(key);
}
inspectPngCached.cache = new Map();

function assetPath(url) {
  const pathname = String(url).replace(/[?#].*$/, '').replace(/^\//, '');
  return path.normalize(path.join(ROOT, 'public', pathname));
}

function unique(values) { return [...new Set(values)]; }

function actorAssets() {
  const bodyAssets = body.STATES.map(body.stateSrc)
    .concat(Object.keys(body.MOTION_FRAMES).map(body.motionFrameSrc))
    .concat(Object.values(body.INTERACTIONS).flatMap((entry) => entry.pairFrames.map((frame) => body.pairFrameSrc(frame))));
  const recoveryAssets = recovery.STATES.map(recovery.stateSrc)
    .concat(Object.keys(recovery.MOTION_FRAMES).map(recovery.motionFrameSrc))
    .concat(Object.values(recovery.INTERACTIONS).flatMap((entry) => entry.pairFrames.map((frame) => recovery.pairFrameSrc(frame))));
  const resourceAssets = resources.STATES.map(resources.stateSrc)
    .concat(Object.values(resources.SOLO).flatMap((entry) => entry.frames.map(resources.assetSrc)))
    .concat(Object.values(resources.INTERACTIONS).flatMap((entry) => entry.frames.map((frame) => resources.pairSrc(frame))));
  return unique(bodyAssets.concat(recoveryAssets, resourceAssets)).map(assetPath);
}

test('runtime uses transparent normalized PNG plates, never the opaque idle GIFs', () => {
  const runtime = [
    read('public/body-toad-v1.js'), read('public/recovery-slug-v1.js'),
    read('public/index.html'), read('public/sw.js'),
  ].join('\n');
  assert.doesNotMatch(runtime, /motion-v4\/idle-breath\.gif|motion\/idle-softbody\.gif/);
  for (const filename of actorAssets()) {
    assert.equal(path.extname(filename), '.png', filename);
    const meta = inspectPngCached(filename);
    assert.ok(meta.alphaPixels > 500, `${filename}: empty actor plate`);
    // A few antialiased pixels may legitimately touch the technical crop.  A
    // matte is different: it occupies a meaningful share of the whole actor
    // plate (the rejected Katsuyu frame has thousands of edge pixels).
    assert.ok(meta.edgeAlpha <= 500 || meta.edgeAlpha / meta.alphaPixels < 0.001,
      `${filename}: alpha occupies the canvas edge (matte/crop risk)`);
  }
});

test('the defective Katsuyu matte is quarantined and its v155 sibling is alpha-safe', () => {
  assert.equal(recovery.VERSION, '2.6.1');
  assert.deepEqual(recovery.INTERACTIONS.stretch.pairFrames, ['stretch-a', 'stretch-soft-b']);
  const damaged = inspectPngCached(path.join(ROOT, 'public/art/pets/recovery-slug-v1/pair-v2/stretch-b.png'));
  assert.ok(damaged.edgeAlpha > 1000, 'fixture should prove why the rejected plate is unsafe');
  const safe = inspectPngCached(assetPath(recovery.pairFrameSrc('stretch-soft-b')));
  const frameA = inspectPngCached(assetPath(recovery.pairFrameSrc('stretch-a')));
  assert.equal(safe.width, 1536);
  assert.equal(safe.height, 1536);
  assert.ok(safe.edgeAlpha <= 500 || safe.edgeAlpha / safe.alphaPixels < 0.001,
    'replacement must not recreate the black/magenta edge matte');
  const extentRatio = Math.max(safe.bbox.width, safe.bbox.height) / Math.max(frameA.bbox.width, frameA.bbox.height);
  assert.ok(extentRatio >= .96 && extentRatio <= 1.08, `replacement extent drifted: ${extentRatio}`);
  assert.ok(extentRatio * .96 >= .98 && extentRatio * .96 <= 1.02,
    `displayed silhouette must remain stable after source calibration: ${extentRatio * .96}`);
  assert.match(read('public/styles.css'), /data-pair-frame="stretch-soft-b"[\s\S]{0,260}scale\(\.96\)/);
});

test('solo-frame calibration preserves apparent actor extent without changing outer room scale', () => {
  const check = (api, stateFile) => {
    const reference = inspectPngCached(assetPath(stateFile));
    const referenceExtent = Math.max(reference.bbox.width, reference.bbox.height);
    for (const [key, calibration] of Object.entries(api.FRAME_CALIBRATION)) {
      const frame = inspectPngCached(assetPath(api.motionFrameSrc(key)));
      const extent = Math.max(frame.bbox.width, frame.bbox.height) * calibration.scale;
      assert.ok(extent / referenceExtent >= 0.88 && extent / referenceExtent <= 1.15,
        `${key}: calibrated silhouette extent ${extent.toFixed(1)} vs ${referenceExtent}`);
      assert.ok(calibration.scale >= 0.85 && calibration.scale <= 1.15, `${key}: unsafe calibration scale`);
    }
  };
  check(body, body.stateSrc('calm'));
  check(recovery, recovery.stateSrc('calm'));
  const css = read('public/styles.css');
  assert.match(css, /transform: scale\(var\(--actor-frame-scale\)\) scaleX\(var\(--actor-facing\)\)/);
  assert.match(css, /den-body-toad\[data-toad-direction="left"\].*--actor-facing: -1/);
  assert.match(css, /den-recovery-slug\[data-slug-direction="left"\].*--actor-facing: -1/);
});

test('manual commands preempt decorative ambient instead of being ignored', () => {
  const app = read('public/app.js');
  assert.match(app, /options\.reveal === true && denSceneBusy\(shell\)[\s\S]*abortDenSceneAction\(shell, 'manual-preempt'\)/);
  assert.doesNotMatch(app, /action === 'den-room-action'[\s\S]{0,180}denSceneBusy/);
  assert.doesNotMatch(app, /action === 'shadow-den-pair'[\s\S]{0,220}denSceneBusy/);
});

test('first idle round gives every resident a legible, exclusive action', () => {
  assert.equal(life.VERSION, '2.8.0');
  assert.equal(life.FIRST_AMBIENT_MS, 2800);
  assert.deepEqual(life.AMBIENT_SEQUENCE.slice(0, 4).map((entry) => entry.kind),
    ['toad', 'shadow', 'resources', 'recovery']);
  assert.deepEqual(life.AMBIENT_SEQUENCE.slice(0, 4).map((entry) => entry.id),
    ['toad-stretch', 'shadow-greet', 'resources-jacket', 'recovery-stretch']);
  assert.ok(life.AMBIENT_SEQUENCE.slice(0, 4).every((entry) => entry.gap <= 4200));
});

test('Shadow meetings use a live approach and authored tier-specific contact frames', () => {
  const css = read('public/styles.css');
  const moduleSource = read('public/shadow-den-v1.js');
  assert.equal(shadow.VERSION, '1.5.0');
  assert.match(css, /\.shadow-den-pair-v1\.is-active \{ display: block; \}/);
  assert.match(css, /is-shadow-pair-approaching \.den-avatar-core[\s\S]*scale: 1/);
  assert.match(css, /is-shadow-pair-approaching \.den-companion\[data-shadow-den\][\s\S]{0,320}scale: 1/);
  assert.match(css, /shadowDenLiveFlight/);
  assert.deepEqual(shadow.pairStates('attune'), ['listening', 'caring', 'happy']);
  assert.deepEqual(shadow.pairStates('rest'), ['caring', 'sleepy', 'caring']);
  assert.deepEqual(shadow.pairStates('silence'), ['listening', 'thinking', 'calm']);
  assert.match(moduleSource, /scope\.dataset\.shadowPairPhase = String\(index \+ 1\)/);
  for (const phase of ['1', '2', '3']) assert.match(css, new RegExp(`data-shadow-pair-phase="${phase}"`));
  assert.match(moduleSource, /delete scope\.dataset\.shadowPairPhase/);
  assert.match(moduleSource, /function installPairImage/);
  assert.match(moduleSource, /root\.document\.createElement\('img'\)/);
  const tiers = [...css.matchAll(/data-shadow-tier="(\d)"\] \.shadow-rig \{ transform: scale\((\.[0-9]+|1)\)/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1])).map((match) => Number(match[2]));
  assert.deepEqual(tiers, [.72, .82, .91, 1]);
  assert.match(read('public/app.js'), /data-shadow-tier="\$\{ti\}"/);
  assert.doesNotMatch(read('public/app.js'), /den-companion-name/);
  assert.doesNotMatch(read('public/app.js'), /<p class="den-mood">/);
});

test('every resident interaction stays inside a bounded room-scale host', () => {
  const css = read('public/styles.css');
  // Pair art is allowed to be larger than one resident because it contains two
  // complete silhouettes. It is never allowed to become the full-room poster
  // that originally made the actors look like giants or swap sides.
  const widths = [];
  for (const selector of [
    /\.den-scene\[data-den-renderer="v5"\] \.body-pair-v2\s*\{[\s\S]*?width:\s*([\d.]+)%/,
    /\.resources-pair-v1\s*\{[\s\S]*?width:\s*([\d.]+)%/,
    /\.recovery-pair-v2\s*\{[\s\S]*?width:\s*([\d.]+)%/,
  ]) {
    const match = css.match(selector);
    assert.ok(match, `missing room-scale pair rule ${selector}`);
    widths.push(Number(match[1]));
  }
  assert.ok(widths.every((value) => value <= 48), `pair host escaped room scale: ${widths.join(', ')}`);
  assert.match(css, /is-shadow-pair-approaching \.den-avatar-core[\s\S]*?left:/);
  assert.match(css, /is-shadow-pair-approaching \.den-companion\[data-shadow-den\][\s\S]*?left:/);
});

test('frame switches have no empty interval and portal hands directly to reading', () => {
  const css = read('public/styles.css');
  const app = read('public/app.js');
  const room = read('public/traveller-room-v4.js');
  assert.match(css, /bodyToadStretchSide \{ 0%,47\.999%,84\.001%,100% \{ opacity: 1/);
  assert.match(css, /recoverySlugCompress \{ 0%,34\.999%,82\.001%,100% \{ opacity: 1/);
  assert.match(css, /recoveryPairStretchA \{ 0%,45\.999%,90\.001%,100% \{ opacity: 1/);
  assert.match(css, /resources-pair-v1\.is-active[\s\S]{0,120}transition: none/);
  assert.match(css, /body-pair-v2\.is-active[\s\S]{0,260}transition: transform \.24s/);
  assert.match(css, /recovery-pair-v2\.is-active[\s\S]{0,120}transition: none/);
  assert.match(room, /async function transition/);
  assert.match(app, /preload\('bench-read', \{ gender \}\)[\s\S]*onExtract: beginReading/);
  assert.match(css, /is-den-prop-portal-reaching:not\(\.is-den-prop-portal-extracting\) \.traveller-room-v4/);
  assert.match(css, /denPropPortalOpenV4 3\.7s/);
  assert.match(css, /30%,84% \{ opacity: 1; transform: scale\(1\); \}/);
  assert.match(css, /is-den-prop-portal-extracting \.den-prop-reach[\s\S]{0,120}visibility: hidden !important/);
});

test('room depth owns travel scale while in-place acting stays on a fixed host', () => {
  const css = read('public/styles.css');
  assert.match(css, /bodyToadTourAway[\s\S]*100% \{ translate: 76% 0; scale: \.88; \}/);
  assert.match(css, /bodyToadBenchAway[\s\S]*100% \{ translate: 272% -78%; scale: \.86; \}/);
  assert.match(css, /recoverySlugTourAway[\s\S]*translate: 0 -18%; scale: \.9/);
  assert.match(css, /den-companion\[data-shadow-den\]\s*\{[\s\S]*scale: 1/);
  assert.match(css, /den-companion\[data-shadow-den\]\s*\{[\s\S]{0,520}left \.82s cubic-bezier/);
  assert.match(css, /recovery-pair-v2\[data-mode="stretch"\][\s\S]*translateY\(11\.5%\)/);
});

test('v183 shell revision and cache-busting are coherent', () => {
  const index = read('public/index.html');
  const sw = read('public/sw.js');
  assert.match(sw, /const CACHE = 'satoru-v204'/);
  for (const script of ['resources-penguin-v1', 'traveller-room-v4']) {
    assert.match(index, new RegExp(`${script}\\.js\\?v=20260819-traveller-f2-runtime-v167-1`));
  }
  assert.match(index, /body-toad-v1\.js\?v=20260826-appearance-feedback-v183-1/);
  assert.match(index, /den-life-v1\.js\?v=20260815-den-life-v158-1/);
  assert.match(index, /den-stage-v1\.js\?v=20260815-den-life-v158-1/);
  assert.match(index, /recovery-slug-v1\.js\?v=20260826-appearance-feedback-v183-1/);
  assert.match(index, /shadow-den-v1\.js\?v=20260819-traveller-f2-runtime-v167-1/);
  assert.match(index, /den-pet-pair-v1\.js\?v=20260815-shadow-pet-v160-1/);
  assert.match(index, /styles\.css\?v=20260830-tree-v4-v204-1/);
  assert.match(index, /app\.js\?v=20260830-tree-v4-v204-1/);
  assert.doesNotMatch(sw, /recovery-slug-v1\/pair-v2\/stretch-b\.png/);
  assert.match(sw, /recovery-slug-v1\/pair-v3\/stretch-soft-b-v155\.png/);
  assert.match(sw, /recovery-slug-v1\/pair-v3\/female\/f2-v1\/stretch-soft-b-v183\.png/);
});
