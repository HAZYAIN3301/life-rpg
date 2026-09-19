'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Media = require('../public/inspiration-media-v1.js');
const Batch = require('../public/inspiration-visual-batch-v1.js');

test('visual fallback stock has unique specific source identities and safe matching media', () => {
  const ids = new Set(), sources = new Set();
  assert.ok(Batch.CANDIDATES.length >= 12 && Batch.CANDIDATES.length <= 24);
  for (const row of Batch.CANDIDATES) {
    assert.equal(ids.has(row.id), false, row.id);
    ids.add(row.id);
    const source = Media.parseSource(row.delivery.sourceUrl);
    assert.ok(source, row.id);
    assert.equal(source.provider, row.source);
    assert.equal(source.id, row.externalId);
    assert.equal(sources.has(`${source.provider}:${source.id}`), false, row.id);
    sources.add(`${source.provider}:${source.id}`);
    assert.ok(Media.isAllowedEmbed(row.delivery.embedUrl, source), row.id);
    assert.equal(Media.safeImage(row.imageUrl, row.source), row.imageUrl, row.id);
    assert.ok(row.imageWidth > 0 && row.imageHeight > 0);
    assert.equal(row.rights.downloadAllowed, false);
    assert.equal(row.rights.kind, 'official-source');
  }
});

test('metadata captions do not certify viewing, external audio language or unknown photo types', () => {
  for (const row of Batch.CANDIDATES) {
    if (row.checkMethod === 'metadata') {
      assert.equal(row.available, 'unknown', row.id);
      assert.equal(row.durationSec, null, row.id);
    }
    if (row.lang === 'none') assert.equal(row.mediaType, 'image', row.id);
    if (row.source === 'tiktok' && row.checkMethod === 'metadata') assert.equal(row.lang, 'unknown', row.id);
    assert.ok(Number.isFinite(Date.parse(row.lastCheckedAt)));
    assert.equal(Object.hasOwn(row, 'playbackVerified'), false);
    assert.equal(Object.hasOwn(row, 'html'), false);
    for (const locale of ['ru', 'en', 'de', 'uk', 'es']) {
      assert.ok(typeof row.title[locale] === 'string' && row.title[locale].trim(), `${row.id}:${locale}`);
      assert.ok(typeof row.body[locale] === 'string' && row.body[locale].trim(), `${row.id}:${locale}`);
    }
  }
});

test('personal examples retain their actual pin URLs and specific visual motifs', () => {
  const examples = new Set(['974818281863152085', '733523858101103384', '1128433250417695713', '1075375217279793808', '1096063628085416862']);
  for (const row of Batch.CANDIDATES) {
    assert.equal(row.referenceExample, examples.has(row.externalId), row.id);
    for (const field of ['keywords', 'tags']) {
      assert.ok(Array.isArray(row[field]) && row[field].length && row[field].length <= 32, row.id);
      assert.ok(row[field].every((value) => typeof value === 'string' && value.length <= 80), row.id);
    }
  }
  for (const id of examples) {
    const row = Batch.CANDIDATES.find((candidate) => candidate.externalId === id);
    assert.ok(row, id);
    assert.equal(row.delivery.sourceUrl, `https://www.pinterest.com/pin/${id}/`);
  }
  const altered = Batch.CANDIDATES.find((row) => row.externalId === '1096063628085416862');
  assert.ok(altered.tags.includes('ai-collage'));
  assert.match(altered.body.en, /AI-altered/);
  const umbrella = Batch.CANDIDATES.find((row) => row.externalId === '354658539408264219');
  assert.doesNotMatch(JSON.stringify(umbrella), /Liam|Wong|Лиам|Вонг/i);
});

test('browser fallback manifest has no network or script execution dependency', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/inspiration-visual-batch-v1.js'), 'utf8'), context);
  assert.equal(context.InspirationVisualBatchV1.ID, Batch.ID);
  assert.ok(Object.isFrozen(context.InspirationVisualBatchV1.CANDIDATES));
  assert.ok(context.InspirationVisualBatchV1.CANDIDATES.every((row) => Object.isFrozen(row) && Object.isFrozen(row.delivery)));
});
