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

  const VERSION = '1.3.0';
  const WORLD = Object.freeze({ width: 1536, height: 864 });
  const APPROACH_MS = 2200;
  const RETURN_MS = 2200;

  // Anchors are measured at the actor's ground contact, not at its image box.
  // Their footprints never overlap, including the largest BODY guardian.
  const PET_SLOTS = Object.freeze([
    Object.freeze({ id: 'west', x: 23.5, groundY: 96.2, depth: 0.98, z: 7 }),
    Object.freeze({ id: 'east', x: 85.0, groundY: 96.0, depth: 0.97, z: 7 }),
    Object.freeze({ id: 'mid-east', x: 65.5, groundY: 96.0, depth: 0.96, z: 8 }),
  ]);

  const PROFILES = Object.freeze({
    bodyToad: Object.freeze({ width: 19.2, aspect: 1, footprint: 15.7, preferred: 'mid-east' }),
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

  function nextFrame() {
    return new Promise((resolve) => {
      const raf = root.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
      raf(() => raf(resolve));
    });
  }

  function clearMeetingClasses(scope) {
    scope.classList.remove('is-body-pair-approaching', 'is-body-pair-at-meeting', 'is-body-pair-returning', 'is-body-pair-settling');
  }

  async function approachBodyPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    const avatar = scope.querySelector && scope.querySelector('.den-avatar-core');
    const toad = scope.querySelector && scope.querySelector('[data-body-toad]');
    const motion = root.TravellerMotionV3;
    const toadMotion = root.BodyToadV1;
    const approachMs = Math.max(700, Number(config.approachMs) || APPROACH_MS);
    const returnMs = Math.max(700, Number(config.returnMs) || RETURN_MS);
    const contactMs = Math.max(400, Number(config.duration) || 3000);
    clearMeetingClasses(scope);
    if (avatar && motion) motion.installWalkFrames(avatar, 'right');
    if (toad && toadMotion && toadMotion.installHopFrames) await toadMotion.installHopFrames(toad, 'meeting');
    scope.classList.add('is-body-pair-approaching');
    await nextFrame();
    await wait(approachMs);
    if (!scope.isConnected) {
      clearMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (toad && toadMotion && toadMotion.clearHopFrames) toadMotion.clearHopFrames(toad).catch(() => {});
      return false;
    }
    scope.classList.remove('is-body-pair-approaching');
    scope.classList.add('is-body-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (toad && toadMotion && toadMotion.clearHopFrames) await toadMotion.clearHopFrames(toad);
    const played = await play();
    if (!played) {
      clearMeetingClasses(scope);
      return false;
    }
    scope.classList.add('is-body-pair-settling');
    await wait(contactMs + 80);
    if (!scope.isConnected) {
      clearMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-body-pair-settling');
    scope.classList.add('is-body-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (toad && toadMotion && toadMotion.installHopFrames) await toadMotion.installHopFrames(toad, 'home');
    await nextFrame();
    scope.classList.remove('is-body-pair-at-meeting', 'is-body-pair-returning');
    await wait(returnMs);
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (toad && toadMotion && toadMotion.clearHopFrames) await toadMotion.clearHopFrames(toad);
    return true;
  }

  return Object.freeze({
    VERSION,
    WORLD,
    APPROACH_MS,
    RETURN_MS,
    PET_SLOTS,
    PROFILES,
    profileFor,
    layoutPets,
    styleVars,
    overlaps,
    approachBodyPair,
  });
});
