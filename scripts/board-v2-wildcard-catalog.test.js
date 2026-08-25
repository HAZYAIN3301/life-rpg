'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BoardV2 = require('../public/board-v2.js');
const Catalog = require('../public/board-v2-wildcard-catalog.js');

const ROOT = path.join(__dirname, '..');

function resolutionFor(template) {
  const slots = {};
  let needsAction = false;
  for (const descriptor of template.slots) {
    if (descriptor.type === 'local-class' || descriptor.type === 'local-event') {
      slots[descriptor.id] = {
        label: `resolved ${descriptor.id}`,
        address: 'Teststraße 1, Bielefeld',
        startsAt: '2026-09-15T18:30:00+02:00',
        url: 'https://example.test/action',
      };
      needsAction = true;
    } else if (descriptor.type === 'local-place') {
      slots[descriptor.id] = { label: `resolved ${descriptor.id}`, address: 'Teststraße 1, Bielefeld', url: 'https://example.test/place' };
      needsAction = true;
    } else if (descriptor.type === 'local-route') {
      slots[descriptor.id] = { label: `resolved ${descriptor.id}`, url: 'https://example.test/route', distanceKm: 14.8, difficulty: 'средняя' };
      needsAction = true;
    } else if (descriptor.type === 'video') {
      slots[descriptor.id] = { label: `resolved ${descriptor.id}`, url: 'https://example.test/video' };
      needsAction = true;
    } else {
      slots[descriptor.id] = `resolved ${descriptor.id}`;
    }
  }
  return {
    slots,
    primaryAction: needsAction ? { label: 'Открыть', url: 'https://example.test/action' } : undefined,
    readinessFlags: template.adventure.requiredFlags,
    fit: { confidence: 0.8, interest: 1, distanceKm: needsAction ? 5 : null },
  };
}

test('Wildcard machine catalog содержит 45 последовательных approved entries', () => {
  assert.equal(Catalog.CONTENT_STATUS, 'approved-ru-source');
  assert.equal(Catalog.ENTRIES.length, 45);
  assert.deepEqual(Catalog.ENTRIES.map((entry) => entry.reviewId), Array.from({ length: 45 }, (_, index) => index + 1));
  assert.equal(new Set(Catalog.ENTRIES.map((entry) => entry.template.id)).size, 45);
});

test('все 45 templates компилируются и разрешаются только с полным контекстом', () => {
  const catalog = Catalog.compileCatalog(BoardV2);
  assert.equal(catalog.templates.length, 45);
  for (const template of catalog.templates) {
    const result = BoardV2.instantiate(template, resolutionFor(template));
    assert.equal(result.ok, true, `${template.id}: ${result.error || 'unknown'}`);
    assert.ok(['wildcard', 'legendary'].includes(result.quest.adventure.class));
  }
});

test('опасные действия всегда требуют professional supervision и permitted venue', () => {
  for (const id of [
    'zugspitze-guided-ascent', 'first-surf-lesson', 'first-instructor-dive',
    'first-ski-or-snowboard-lesson', 'five-meter-pool-jump', 'guided-via-ferrata',
    'tandem-paragliding-flight', 'first-sailing-lesson', 'learn-flip-with-coach',
    'master-hard-movement-month',
  ]) {
    const template = Catalog.entryByTemplateId(id).template;
    assert.equal(template.adventure.safetyTier, 'professional-supervision', id);
    assert.ok(template.adventure.requiredFlags.includes('professional-supervision'), id);
    assert.ok(template.adventure.requiredFlags.includes('permitted-venue'), id);
  }
});

test('Legendary зарезервирован для настоящих arc и получает 700–1000 XP', () => {
  const legendary = Catalog.compileCatalog(BoardV2).templates.filter((template) => template.adventure.class === 'legendary');
  assert.deepEqual(legendary.map((template) => template.id), [
    'zugspitze-guided-ascent', 'visit-world-wonder', 'northern-lights-expedition',
    'train-for-official-marathon', 'earn-one-thousand-from-zero',
  ]);
  assert.equal(legendary.every((template) => template.scale === 'arc'), true);
  assert.equal(legendary.every((template) => template.reward.xp >= 700 && template.reward.xp <= 1000), true);
});

test('рандомные выходные выбирают только три заранее разрешённых варианта', () => {
  const resolver = Catalog.entryByTemplateId('random-weekend-from-three-safe-options').resolver;
  assert.equal(resolver.optionPolicy, 'randomize-only-three-fully-resolved-options');
  assert.ok(resolver.gates.includes('budget-check'));
  assert.ok(resolver.gates.includes('travel-check'));
});

test('все Wildcard gates принадлежат закрытым словарям, copy проходит tone gate', () => {
  for (const entry of Catalog.ENTRIES) {
    assert.ok(entry.resolver.sources.every((source) => Catalog.SOURCES.includes(source)), entry.template.id);
    assert.ok(entry.resolver.gates.every((gate) => Catalog.GATES.includes(gate)), entry.template.id);
    assert.deepEqual(BoardV2.lintCopy(`${entry.template.copy.title}\n${entry.template.copy.details}`), [], entry.template.id);
  }
});

test('Wildcard catalog immutable и остаётся dormant до UI integration', () => {
  assert.equal(Object.isFrozen(Catalog.ENTRIES), true);
  assert.equal(Object.isFrozen(Catalog.ENTRIES[0].template), true);
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(index, /board-v2-wildcard-catalog\.js/);
  assert.doesNotMatch(sw, /board-v2-wildcard-catalog\.js/);
});
