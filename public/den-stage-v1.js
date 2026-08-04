/* Satoru Den Stage v1.
 *
 * A deterministic 2.5D layout contract for the coherent 1536x864 Den.
 * It deliberately uses authored slots and footprints instead of a physics
 * engine: the room is a calm, scripted home, not a free-roaming platformer.
 */
(function exposeDenStage(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DenStageV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDenStage(root) {
  'use strict';

  const VERSION = '1.0.0';
  const WORLD = Object.freeze({ width: 1536, height: 864 });
  const APPROACH_MS = 820;

  // Anchors are measured at the actor's ground contact, not at its image box.
  // Their footprints never overlap, including the largest BODY guardian.
  const PET_SLOTS = Object.freeze([
    Object.freeze({ id: 'west', x: 23.5, groundY: 96.2, depth: 0.98, z: 7 }),
    Object.freeze({ id: 'east', x: 85.0, groundY: 96.0, depth: 0.97, z: 7 }),
    Object.freeze({ id: 'mid-east', x: 65.5, groundY: 96.0, depth: 0.96, z: 8 }),
  ]);

  const PROFILES = Object.freeze({
    bodyToad: Object.freeze({ width: 16.0, aspect: 1, footprint: 13.2, preferred: 'mid-east' }),
    fortune: Object.freeze({ width: 8.9, aspect: 1, footprint: 8.0, preferred: 'west' }),
    default: Object.freeze({ width: 6.7, aspect: 120 / 132, footprint: 6.2, preferred: 'east' }),
  });

  function profileFor(species) {
    return PROFILES[species] || PROFILES.default;
  }

  function orderedSlots(entity, occupied) {
    const profile = profileFor(entity.species);
    const preferred = PET_SLOTS.find((slot) => slot.id === profile.preferred);
    const rest = PET_SLOTS.filter((slot) => !preferred || slot.id !== preferred.id);
    return (preferred ? [preferred, ...rest] : rest).filter((slot) => !occupied.has(slot.id));
  }

  function placementFor(entity, slot) {
    const profile = profileFor(entity.species);
    const width = profile.width * slot.depth;
    const heightPct = width * (WORLD.width / WORLD.height) / profile.aspect;
    const bottom = 100 - slot.groundY;
    return Object.freeze({
      id: String(entity.id),
      species: entity.species || 'default',
      slot: slot.id,
      anchorX: slot.x,
      groundY: slot.groundY,
      left: slot.x - width / 2,
      bottom,
      width,
      heightPct,
      footprint: profile.footprint * slot.depth,
      depth: slot.depth,
      z: slot.z,
    });
  }

  function layoutPets(entities) {
    const source = Array.isArray(entities) ? entities.filter((entry) => entry && entry.id) : [];
    // Reserve the BODY guardian first because its footprint is the largest.
    const sorted = source.map((entry, index) => ({ ...entry, _index: index }))
      .sort((a, b) => Number(b.species === 'bodyToad') - Number(a.species === 'bodyToad'));
    const occupied = new Set();
    const result = [];
    for (const entity of sorted) {
      const slot = orderedSlots(entity, occupied)[0];
      if (!slot) continue;
      occupied.add(slot.id);
      result.push({ ...placementFor(entity, slot), _index: entity._index });
    }
    result.sort((a, b) => a._index - b._index);
    return result.map(({ _index, ...placement }) => Object.freeze(placement));
  }

  function styleVars(placement) {
    if (!placement) return '';
    return [
      `--den-stage-left:${placement.left.toFixed(4)}%`,
      `--den-stage-bottom:${placement.bottom.toFixed(4)}%`,
      `--den-stage-width:${placement.width.toFixed(4)}%`,
      `--den-stage-depth:${placement.depth.toFixed(4)}`,
      `--den-stage-z:${placement.z}`,
    ].join(';');
  }

  function overlaps(a, b) {
    if (!a || !b) return false;
    const a0 = a.anchorX - a.footprint / 2;
    const a1 = a.anchorX + a.footprint / 2;
    const b0 = b.anchorX - b.footprint / 2;
    const b1 = b.anchorX + b.footprint / 2;
    return Math.max(a0, b0) < Math.min(a1, b1);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function approachBodyPair(scope, play) {
    if (!scope || typeof play !== 'function') return false;
    scope.classList.remove('is-body-pair-settling');
    scope.classList.add('is-body-pair-approaching');
    await wait(APPROACH_MS);
    if (!scope.isConnected) {
      scope.classList.remove('is-body-pair-approaching');
      return false;
    }
    const played = await play();
    scope.classList.remove('is-body-pair-approaching');
    if (!played) return false;
    scope.classList.add('is-body-pair-settling');
    const pair = scope.querySelector && scope.querySelector('[data-body-pair-v2]');
    const mode = pair && pair.dataset ? pair.dataset.mode : 'greet';
    const durations = { greet: 1500, train: 2800, rest: 3000 };
    setTimeout(() => scope.classList.remove('is-body-pair-settling'), (durations[mode] || 3000) + 260);
    return true;
  }

  return Object.freeze({
    VERSION,
    WORLD,
    APPROACH_MS,
    PET_SLOTS,
    PROFILES,
    profileFor,
    layoutPets,
    styleVars,
    overlaps,
    approachBodyPair,
  });
});
