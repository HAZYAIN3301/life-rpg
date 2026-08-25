'use strict';

/* Board v2 server-owned discovery registry.
 *
 * The client may select an approved template, local slot and a bounded profile
 * interest. It cannot supply a query, URL or search terms. Every provider term
 * is derived here from immutable catalog content.
 */

const StandardCatalog = require('./public/board-v2-catalog.js');
const WildcardCatalog = require('./public/board-v2-wildcard-catalog.js');

const VERSION = '1.0.0';
const LOCAL_SLOT_INTENTS = Object.freeze({
  'local-place': 'place',
  'local-class': 'class',
  'local-event': 'event',
  'local-route': 'route',
});
const SLOT_TERMS = Object.freeze({
  'local-place': 'official-place',
  'local-class': 'trial-class',
  'local-event': 'official-event',
  'local-route': 'official-route',
});
const INTEREST_TAXONOMY = Object.freeze({
  boxing: ['sport'], 'martial-arts': ['sport'], climbing: ['sport', 'climbing'], bouldering: ['sport', 'climbing'],
  swimming: ['sport', 'swimming'], running: ['sport', 'running'], cycling: ['sport', 'cycling'],
  yoga: ['sport', 'yoga', 'mobility'], dance: ['sport', 'movement'], hiking: ['hiking', 'walking'],
  surfing: ['surfing', 'water-sports'], diving: ['diving', 'water-sports'], ski: ['ski'], snowboard: ['snowboard'],
  sailing: ['sailing', 'water-sports'], fishing: ['fishing'], 'board-games': ['board-games', 'games'],
  minecraft: ['minecraft', 'games'], games: ['games'], art: ['art'], culture: ['culture'], music: ['music'],
  film: ['film'], anime: ['anime'], cooking: ['cooking'], food: ['food'], travel: ['travel'],
  language: ['language'], reading: ['reading'], learning: ['learning'], volunteering: ['volunteering'],
  diy: ['diy'], creative: ['creative'],
});
const ALLOWED_INPUT = Object.freeze(['templateId', 'slotId', 'interestId']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}
function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function id(value, max) {
  const out = typeof value === 'string' ? value.trim() : '';
  return out && out.length <= max && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(out) ? out : '';
}
function unique(values, max) {
  const generic = new Set(['local', 'novelty', 'outside']);
  const out = [];
  for (const value of values) {
    const clean = id(value, 48);
    if (clean && !generic.has(clean) && !out.includes(clean)) out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}
function compactTemplateTerm(templateId) {
  const stop = new Set(['a', 'an', 'and', 'at', 'for', 'from', 'in', 'into', 'local', 'one', 'or', 'specific', 'the', 'to', 'with']);
  return templateId.split('-').filter((part) => !stop.has(part)).slice(0, 6).join('-').slice(0, 48);
}

const entries = [...StandardCatalog.ENTRIES, ...WildcardCatalog.ENTRIES];
const entryIndex = new Map();
for (const entry of entries) {
  const templateId = entry && entry.template && entry.template.id;
  if (!id(templateId, 80) || entryIndex.has(templateId)) throw new Error('invalid-board-catalog-index');
  entryIndex.set(templateId, entry);
}

function entryById(templateId) {
  return entryIndex.get(id(templateId, 80)) || null;
}
function localSlots(templateId) {
  const entry = entryById(templateId);
  if (!entry) return [];
  return entry.template.slots
    .filter((slot) => plain(slot) && LOCAL_SLOT_INTENTS[slot.type])
    .map((slot) => deepFreeze({ id: slot.id, type: slot.type, intent: LOCAL_SLOT_INTENTS[slot.type] }));
}
function interestAllowed(entry, interestId) {
  if (!interestId) return true;
  const parents = INTEREST_TAXONOMY[interestId];
  const authored = Array.isArray(entry.template.interests) ? entry.template.interests : [];
  return Array.isArray(parents) && (authored.includes(interestId) || parents.some((parent) => authored.includes(parent)));
}
function createSpec(raw, requestId) {
  if (!plain(raw) || Object.keys(raw).some((key) => !ALLOWED_INPUT.includes(key))) throw new Error('unsupported-resolve-field');
  const templateId = id(raw.templateId, 80);
  const slotId = id(raw.slotId, 48);
  const interestId = raw.interestId == null || raw.interestId === '' ? '' : id(raw.interestId, 48);
  const safeRequestId = id(requestId, 100);
  const entry = entryById(templateId);
  if (!entry || !slotId || !safeRequestId) throw new Error('unknown-board-template');
  const slot = entry.template.slots.find((candidate) => candidate.id === slotId && LOCAL_SLOT_INTENTS[candidate.type]);
  if (!slot) throw new Error('unknown-local-slot');
  if (raw.interestId != null && !interestId) throw new Error('unknown-profile-interest');
  if (!interestAllowed(entry, interestId)) throw new Error('incompatible-profile-interest');
  const defaultInterest = (entry.template.interests || []).find((value) => id(value, 48)) || '';
  const searchTerms = unique([
    SLOT_TERMS[slot.type],
    compactTemplateTerm(templateId),
    ...(entry.template.tags || []),
    interestId || defaultInterest,
  ], 8);
  return deepFreeze({
    requestId: safeRequestId,
    templateId,
    slotId,
    intent: LOCAL_SLOT_INTENTS[slot.type],
    searchTerms,
    interests: interestId ? [interestId] : [],
    constraints: {
      budgetTier: 'open',
      maxTravelMinutes: ['expedition', 'arc'].includes(entry.template.scale) ? 360 : 60,
      accessibility: [],
      avoidTags: [],
    },
  });
}

module.exports = deepFreeze({
  VERSION,
  LOCAL_SLOT_INTENTS,
  INTEREST_TAXONOMY,
  ALLOWED_INPUT,
  entryById,
  localSlots,
  createSpec,
});
