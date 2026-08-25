'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BoardV2 = require('../public/board-v2.js');
const Catalog = require('../public/board-v2-catalog.js');

const ROOT = path.join(__dirname, '..');

function resolutionFor(template) {
  const slots = {};
  let needsAction = false;
  for (const descriptor of template.slots) {
    if (descriptor.type === 'local-class' || descriptor.type === 'local-event') {
      slots[descriptor.id] = {
        label: `resolved ${descriptor.id}`,
        address: 'Teststraße 1, Bielefeld',
        startsAt: '2026-08-27T18:30:00+02:00',
        url: 'https://example.test/action',
      };
      needsAction = true;
    } else if (descriptor.type === 'local-place') {
      slots[descriptor.id] = {
        label: `resolved ${descriptor.id}`,
        address: 'Teststraße 1, Bielefeld',
        url: 'https://example.test/action',
      };
      needsAction = true;
    } else if (descriptor.type === 'local-route') {
      slots[descriptor.id] = {
        label: `resolved ${descriptor.id}`,
        url: 'https://example.test/route',
        distanceKm: 12.4,
        difficulty: 'средняя',
      };
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

test('машинный каталог содержит ровно 36 утверждённых source templates', () => {
  assert.equal(Catalog.CATALOG_SCHEMA, 'satoru.board-catalog/2');
  assert.equal(Catalog.CONTENT_STATUS, 'approved-ru-source');
  assert.equal(Catalog.ENTRIES.length, 36);
  assert.deepEqual(Catalog.ENTRIES.map((entry) => entry.reviewId), Array.from({ length: 36 }, (_, index) => index + 1));
  assert.equal(new Set(Catalog.ENTRIES.map((entry) => entry.template.id)).size, 36);
});

test('каждый каталоговый template компилируется и реально разрешается без vague fallback', () => {
  const catalog = Catalog.compileCatalog(BoardV2);
  assert.equal(catalog.templates.length, 36);
  for (const template of catalog.templates) {
    const result = BoardV2.instantiate(template, resolutionFor(template));
    assert.equal(result.ok, true, `${template.id}: ${result.error || 'unknown'}`);
    assert.doesNotMatch(`${result.quest.title}\n${result.quest.details}`, /\{[a-z][a-z0-9-]*\}/);
  }
});

test('каталог immutable и не позволяет переписать одобренный текст после импорта', () => {
  assert.equal(Object.isFrozen(Catalog.ENTRIES), true);
  assert.equal(Object.isFrozen(Catalog.ENTRIES[0].template.copy), true);
  const before = Catalog.ENTRIES[0].template.copy.title;
  assert.throws(() => { Catalog.ENTRIES[0].template.copy.title = 'Попробуй что-нибудь'; }, TypeError);
  assert.equal(Catalog.ENTRIES[0].template.copy.title, before);
});

test('все resolver sources и eligibility gates принадлежат закрытым словарям', () => {
  for (const entry of Catalog.ENTRIES) {
    assert.ok(entry.resolver.sources.length > 0, entry.template.id);
    assert.ok(entry.resolver.sources.every((source) => Catalog.RESOLVER_SOURCES.includes(source)), entry.template.id);
    assert.ok(entry.resolver.gates.every((gate) => Catalog.ELIGIBILITY_GATES.includes(gate)), entry.template.id);
    assert.equal(entry.resolver.recommendationLimit, 1);
    assert.equal(entry.resolver.alternativeLimit, 1);
  }
});

test('вся RU source-copy проходит утверждённый anti-cringe tone gate', () => {
  for (const entry of Catalog.ENTRIES) {
    const copy = `${entry.template.copy.title}\n${entry.template.copy.details}`;
    assert.deepEqual(BoardV2.lintCopy(copy), [], `${entry.reviewId}: ${copy}`);
  }
});

test('растяжка хранит три проверяемые ссылки, но resolver обязан выбрать одну', () => {
  assert.equal(Catalog.STRETCH_OPTIONS.length, 3);
  assert.equal(Catalog.STRETCH_OPTIONS.every((option) => new URL(option.url).protocol === 'https:'), true);
  const entry = Catalog.entryByTemplateId('long-guided-stretch');
  assert.equal(entry.resolver.optionPolicy, 'select-exactly-one');
  assert.equal(entry.resolver.approvedOptions, Catalog.STRETCH_OPTIONS);
});

test('локальные квесты не превращаются в абстрактную copy без resolver', () => {
  const catalog = Catalog.compileCatalog(BoardV2);
  const localTemplates = catalog.templates.filter((template) => template.slots.some((slot) => slot.type.startsWith('local-')));
  assert.ok(localTemplates.length >= 12);
  for (const template of localTemplates) {
    const result = BoardV2.instantiate(template, {});
    assert.equal(result.ok, false, template.id);
    assert.equal(result.error, 'unresolved-slot', template.id);
  }
});

test('особые согласия не растворены в тексте и остаются machine gates', () => {
  assert.deepEqual(Catalog.entryByTemplateId('finish-and-publish-one-work').resolver.gates, [
    'existing-project', 'publishing-opt-in',
  ]);
  assert.deepEqual(Catalog.entryByTemplateId('film-completed-adventure-story').resolver.gates, ['filming-opt-in']);
  assert.deepEqual(Catalog.entryByTemplateId('cancel-unused-subscription').resolver.gates, [
    'subscription-selected', 'finance-source-opt-in',
  ]);
});

test('catalog остаётся dormant и не загружается app shell до отдельной интеграции', () => {
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(index, /board-v2-catalog\.js/);
  assert.doesNotMatch(sw, /board-v2-catalog\.js/);
});
