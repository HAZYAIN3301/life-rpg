'use strict';
// Shared display, never an inventory transfer or a second economy owner.
const Catalog = require('./public/shop-catalog-v1.js');
const slots = ['wall', 'seat', 'surface', 'comfort', 'light', 'keepsake', 'floor'];
const item = id => Catalog.DEN_ITEMS.find(row => row.id === id && row.access !== 'pro');
const record = x => x && typeof x === 'object' && !Array.isArray(x);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const empty = () => ({ version: 1, revision: 0, placements: [], receipts: [] });
function validate(value) {
  if (value === undefined) return empty();
  if (!record(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !Array.isArray(value.placements) || value.placements.length > 7
    || !Array.isArray(value.receipts) || value.receipts.length > 100
    || new Set(value.placements.map(p => p?.slot)).size !== value.placements.length
    || value.placements.some(p => !record(p) || !slots.includes(p.slot) || item(p.itemId)?.slot !== p.slot
      || typeof p.actor !== 'string' || !p.actor || !Number.isFinite(Date.parse(p.at)))
    || value.receipts.some(r => !record(r) || typeof r.id !== 'string' || typeof r.actor !== 'string' || typeof r.fingerprint !== 'string'))
    fail('room_unreadable');
  return value;
}
function view(value, members) {
  const room = validate(value);
  return { version: 1, revision: room.revision, placements: room.placements.filter(p => members.includes(p.actor)).map(p => ({ ...p })) };
}
function depart(value, actors) {
  if (value === undefined) return undefined;
  const room = structuredClone(validate(value));
  room.placements = room.placements.filter(p => !actors.includes(p.actor));
  room.receipts = room.receipts.filter(r => !actors.includes(r.actor));
  room.revision++;
  return room;
}
function change(value, input, context) {
  if (!record(input) || Object.keys(input).sort().join('|') !== 'itemId|operationId|partyId|revision|share|slot'
    || typeof input.operationId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.operationId) || typeof input.partyId !== 'string' || !slots.includes(input.slot)
    || !Number.isSafeInteger(input.revision) || input.revision < 0
    || (input.itemId !== null && typeof input.itemId !== 'string')) fail('invalid_room_request');
  if (input.partyId !== context.partyId) fail('room_conflict');
  if (input.share !== true) fail('room_consent_required');
  const room = structuredClone(validate(value));
  const fingerprint = JSON.stringify([input.partyId, input.revision, input.slot, input.itemId]);
  const old = room.receipts.find(r => r.id === input.operationId && r.actor === context.actor);
  if (old) {
    if (old.fingerprint !== fingerprint) fail('room_operation_conflict');
    return { room, replay: true };
  }
  if (room.revision !== input.revision) fail('room_conflict');
  const previous = room.placements.find(p => p.slot === input.slot);
  if (previous && previous.actor !== context.actor) fail('room_slot_occupied');
  if (input.itemId !== null) {
    const entry = item(input.itemId);
    if (!entry || entry.slot !== input.slot) fail('invalid_room_item');
    if (entry.access !== 'starter' && !context.owned.includes(entry.id)) fail('room_item_not_owned');
  }
  room.placements = room.placements.filter(p => p.slot !== input.slot);
  if (input.itemId !== null) room.placements.push({ slot: input.slot, itemId: input.itemId, actor: context.actor, at: context.now });
  room.revision++;
  room.receipts.push({ id: input.operationId, actor: context.actor, fingerprint });
  room.receipts = room.receipts.slice(-100);
  return { room, replay: false };
}
module.exports = { slots, validate, view, depart, change };
