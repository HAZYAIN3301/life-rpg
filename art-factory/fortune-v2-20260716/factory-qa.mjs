import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'art-manifest.json'), 'utf8'));
const source = path.resolve(root, manifest.geometryReference);
const outputs = path.join(root, manifest.outputRoot);
const previews = path.join(root, 'previews');
const canvas = manifest.canvas[0];
await mkdir(previews, { recursive: true });

const ordered = [...manifest.layers['obsidian-gold']].sort((a, b) => a.z - b.z);

async function exists(file) {
  try { await sharp(file).metadata(); return true; } catch { return false; }
}

async function assembled({ face, skinDir, extra = [], background = '#f4eee4' } = {}) {
  const layers = [];
  for (const layer of ordered) {
    let file = path.join(source, `${layer.id}.png`);
    if (layer.id === 'pet-face' && face) file = face;
    if (skinDir && manifest.layers['ivory-vermilion'].includes(layer.id)) {
      const candidate = path.join(skinDir, `${layer.id}.png`);
      if (await exists(candidate)) file = candidate;
    }
    layers.push({ input: file, left: 0, top: 0, z: layer.z });
  }
  layers.push(...extra.map((item) => typeof item === 'string'
    ? { input: item, left: 0, top: 0, z: 100 }
    : { input: item.input, left: 0, top: 0, z: item.z ?? 100 }));
  layers.sort((a, b) => a.z - b.z);
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background },
  }).composite(layers.map(({ z, ...layer }) => layer)).png().toBuffer();
}

async function label(text, width, height) {
  const safe = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="18" fill="#171c2e"/><text x="24" y="44" fill="#f4eee4" font-family="system-ui,sans-serif" font-size="24" font-weight="700">${safe}</text></svg>`);
}

async function contactSheet(cells, outFile, columns = 2) {
  const tile = 512, header = 64;
  const rows = Math.ceil(cells.length / columns);
  const composites = [];
  for (let i = 0; i < cells.length; i++) {
    const x = (i % columns) * tile, y = Math.floor(i / columns) * (tile + header);
    const thumb = await sharp(cells[i].image).resize(tile, tile, { fit: 'contain' }).png().toBuffer();
    composites.push({ input: await label(cells[i].label, tile, header), left: x, top: y });
    composites.push({ input: thumb, left: x, top: y + header });
  }
  await sharp({
    create: { width: columns * tile, height: rows * (tile + header), channels: 4, background: '#0f1320' },
  }).composite(composites).png().toFile(outFile);
}

async function validate(file) {
  const image = sharp(file).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let nonzero = 0, fringe = 0, minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, a = data[i + 3];
    if (!a) continue;
    nonzero++;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if (data[i + 1] > Math.max(data[i], data[i + 2]) + 32 && data[i + 1] > 92) fringe++;
  }
  return {
    file: path.relative(root, file),
    size: [info.width, info.height],
    alpha: info.channels === 4,
    transparentCorners: [[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]].every(([x,y]) => alphaAt(x,y) === 0),
    coverage: Number((nonzero / (info.width * info.height)).toFixed(6)),
    bbox: nonzero ? [minX, minY, maxX + 1, maxY + 1] : null,
    chromaFringePixels: fringe,
  };
}

async function exactAlphaMatch(file, reference) {
  const [candidate, approved] = await Promise.all([
    sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer(),
    sharp(reference).ensureAlpha().extractChannel(3).raw().toBuffer(),
  ]);
  return candidate.equals(approved);
}

async function isolatedPreview(file, { height } = {}) {
  let layer;
  if (height) layer = await sharp(file).resize({ height, fit: 'contain' }).png().toBuffer();
  else layer = await sharp(file).png().toBuffer();
  const metadata = await sharp(layer).metadata();
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: '#f4eee4' },
  }).composite([{
    input: layer,
    left: Math.round((canvas - metadata.width) / 2),
    top: Math.round((canvas - metadata.height) / 2),
  }]).png().toBuffer();
}

const stateFaces = {
  hungry: path.join(outputs, 'states/pet-face-hungry.png'),
  thriving: path.join(source, 'pet-face.png'),
  full: path.join(outputs, 'states/pet-face-full.png'),
  overfed: path.join(outputs, 'states/pet-face-overfed.png'),
};
if ((await Promise.all(Object.values(stateFaces).map(exists))).every(Boolean)) {
  const cells = [];
  for (const [id, face] of Object.entries(stateFaces)) {
    const image = await assembled({ face });
    await sharp(image).toFile(path.join(previews, `obsidian-gold-${id}.png`));
    cells.push({ label: id, image });
  }
  await contactSheet(cells, path.join(previews, 'batch-a-states-contact-sheet.png'));
}

const skinDir = path.join(outputs, 'skins/ivory-vermilion');
const skinFiles = manifest.layers['ivory-vermilion'].map((id) => path.join(skinDir, `${id}.png`));
if ((await Promise.all(skinFiles.map(exists))).every(Boolean)) {
  const ivory = await assembled({ skinDir });
  await sharp(ivory).toFile(path.join(previews, 'ivory-vermilion-thriving.png'));
  const obsidian = await assembled();
  await contactSheet([
    { label: 'obsidian-gold', image: obsidian },
    { label: 'ivory-vermilion', image: ivory },
  ], path.join(previews, 'batch-b-skins-comparison.png'), 2);
  const cells = [];
  for (let i = 0; i < skinFiles.length; i++) {
    const image = await sharp({ create: { width: canvas, height: canvas, channels: 4, background: '#f4eee4' } })
      .composite([{ input: skinFiles[i], left: 0, top: 0 }]).png().toBuffer();
    cells.push({ label: manifest.layers['ivory-vermilion'][i], image });
  }
  await contactSheet(cells, path.join(previews, 'batch-b-ivory-layers-contact-sheet.png'), 4);
}

const props = [
  { id: 'prop-counting-coins', z: 100 },
  { id: 'prop-stash-bag', z: 25 },
  { id: 'prop-ledger-glasses', z: 100 },
];
const propFiles = props.map((p) => path.join(outputs, `props/${p.id}.png`));
if ((await Promise.all(propFiles.map(exists))).every(Boolean)) {
  const cells = [];
  for (let i = 0; i < props.length; i++) {
    const image = await assembled({ extra: [{ input: propFiles[i], z: props[i].z }] });
    await sharp(image).toFile(path.join(previews, `${props[i].id}-assembled.png`));
    cells.push({ label: props[i].id, image });
  }
  await contactSheet(cells, path.join(previews, 'batch-c-props-contact-sheet.png'), 3);
}

const wearables = [
  { id: 'head-luck-crown', slot: 'head', z: 95 },
  { id: 'head-accountant-glasses', slot: 'head', z: 100 },
  { id: 'neck-ceremonial-bow', slot: 'neck', z: 75 },
  { id: 'neck-jade-amulet', slot: 'neck', z: 75 },
  { id: 'back-merchant-scroll', slot: 'back', z: 25 },
  { id: 'back-festival-cloak', slot: 'back', z: 25 },
];
const wearableFiles = wearables.map((item) => path.join(outputs, `wearables/${item.slot}/${item.id}.png`));
if ((await Promise.all(wearableFiles.map(exists))).every(Boolean)) {
  const cells = [];
  for (let i = 0; i < wearables.length; i++) {
    const item = wearables[i];
    const image = await assembled({ extra: [{ input: wearableFiles[i], z: item.z }] });
    await sharp(image).toFile(path.join(previews, `${item.id}-assembled.png`));
    cells.push({ label: `${item.slot}: ${item.id}`, image });
  }
  await contactSheet(cells, path.join(previews, 'batch-d-wearables-contact-sheet.png'), 3);
}

const shadowFile = path.join(outputs, 'shadow/shadow-spirit-calm.png');
const currentShadow = path.resolve(root, '../../public/assets/shadow/shadow_2.png');
if (await exists(shadowFile) && await exists(currentShadow)) {
  const current = await isolatedPreview(currentShadow, { height: 570 });
  const spiritCalm = await isolatedPreview(shadowFile);
  await sharp(spiritCalm).toFile(path.join(previews, 'shadow-spirit-calm.png'));
  await contactSheet([
    { label: 'current shadow identity', image: current },
    { label: 'style check: spirit + calm', image: spiritCalm },
  ], path.join(previews, 'batch-e-shadow-spirit-calm.png'), 2);
}

const candidates = [];
async function walk(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(file);
    else if (ent.name.endsWith('.png')) candidates.push(file);
  }
}
await walk(outputs);
const report = await Promise.all(candidates.sort().map(validate));
const approvedFaceGeometry = await validate(path.join(source, 'pet-face.png'));
for (const asset of report) {
  const skinMatch = asset.file.match(/^outputs\/skins\/ivory-vermilion\/(.+)\.png$/);
  const stateMatch = asset.file.match(/^outputs\/states\/(.+)\.png$/);
  if (skinMatch) {
    asset.geometryMode = 'exact-alpha';
    asset.geometryMatch = await exactAlphaMatch(path.join(root, asset.file), path.join(source, `${skinMatch[1]}.png`));
  }
  if (stateMatch) {
    asset.geometryMode = 'exact-master-bbox';
    asset.geometryMatch = JSON.stringify(asset.bbox) === JSON.stringify(approvedFaceGeometry.bbox);
  }
  asset.pass = asset.size[0] === canvas && asset.size[1] === canvas && asset.alpha && asset.transparentCorners
    && asset.coverage > 0 && asset.chromaFringePixels <= 512 && asset.geometryMatch !== false;
}
const qa = {
  generatedAt: new Date().toISOString(),
  assetCount: report.length,
  passed: report.filter((asset) => asset.pass).length,
  failed: report.filter((asset) => !asset.pass).length,
  assets: report,
};
await writeFile(path.join(root, 'qa-report.json'), `${JSON.stringify(qa, null, 2)}\n`);
const md = [
  '# Fortune Cat v2 factory QA',
  '',
  `- Assets: ${qa.assetCount}`,
  `- Passed: ${qa.passed}`,
  `- Failed: ${qa.failed}`,
  '- Contract: 1024×1024 RGBA, transparent corners, non-empty alpha, no material chroma fringe.',
  '- Recolored skin/state layers additionally require pixel-identical approved alpha geometry.',
  '',
  '| asset | bbox | coverage | chroma fringe | geometry | result |',
  '|---|---:|---:|---:|---:|---:|',
  ...report.map((asset) => `| ${asset.file} | ${asset.bbox?.join(', ') ?? 'empty'} | ${asset.coverage} | ${asset.chromaFringePixels} | ${asset.geometryMatch === undefined ? 'n/a' : asset.geometryMatch ? asset.geometryMode : 'FAIL'} | ${asset.pass ? 'PASS' : 'FAIL'} |`),
  '',
];
await writeFile(path.join(root, 'qa-report.md'), `${md.join('\n')}\n`);

const overviewSources = [
  ['A · state faces', 'batch-a-states-contact-sheet.png'],
  ['B · skin variant', 'batch-b-skins-comparison.png'],
  ['C · props', 'batch-c-props-contact-sheet.png'],
  ['D · wearables', 'batch-d-wearables-contact-sheet.png'],
  ['E · shadow style check', 'batch-e-shadow-spirit-calm.png'],
].map(([label, file]) => ({ label, file: path.join(previews, file) }));
if ((await Promise.all(overviewSources.map(({ file }) => exists(file)))).every(Boolean)) {
  await contactSheet(overviewSources.map(({ label, file }) => ({ label, image: file })), path.join(previews, 'factory-overview.png'), 2);
}
console.log(`QA: ${report.length} assets; previews: ${previews}`);
