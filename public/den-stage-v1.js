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

  const VERSION = '1.9.0';
  const WORLD = Object.freeze({ width: 1536, height: 864 });
  const APPROACH_MS = 1800;
  const RETURN_MS = 1800;

  // Anchors are measured at the actor's ground contact, not at its image box.
  // The east lane also reserves the Traveller's home silhouette
  // (38.2813..65.7813%): pets must not merely avoid one another.
  const PET_SLOTS = Object.freeze([
    Object.freeze({ id: 'west', x: 28.0, groundY: 96.2, depth: 0.98, z: 8 }),
    Object.freeze({ id: 'east', x: 89.0, groundY: 96.0, depth: 0.97, z: 7 }),
    Object.freeze({ id: 'mid-east', x: 74.0, groundY: 96.0, depth: 0.96, z: 8 }),
  ]);
  const SEATED_PET_SLOTS = Object.freeze([
    Object.freeze({ id: 'west', x: 28.0, groundY: 96.2, depth: 0.98, z: 8 }),
    Object.freeze({ id: 'east', x: 93.25, groundY: 96.0, depth: 0.88, z: 7 }),
    Object.freeze({ id: 'mid-east', x: 56.5, groundY: 96.0, depth: 0.96, z: 8 }),
  ]);
  const PET_LAYOUTS = Object.freeze({ home: PET_SLOTS, seated: SEATED_PET_SLOTS });

  const PROFILES = Object.freeze({
    bodyToad: Object.freeze({ width: 19.2, aspect: 1, footprint: 15.7, preferred: 'west' }),
    resourcesPenguin: Object.freeze({ width: 12.8, aspect: 1, footprint: 10.8, preferred: 'east' }),
    recoverySlug: Object.freeze({ width: 14.6, aspect: 1, footprint: 12.2, preferred: 'mid-east' }),
    fortune: Object.freeze({ width: 8.9, aspect: 1, footprint: 8.0, preferred: 'east' }),
    default: Object.freeze({ width: 6.7, aspect: 120 / 132, footprint: 6.2, preferred: 'mid-east' }),
  });

  function profileFor(species) {
    return PROFILES[species] || PROFILES.default;
  }

  function orderedSlots(entity, occupied, slots) {
    const profile = profileFor(entity.species);
    const preferred = slots.find((slot) => slot.id === profile.preferred);
    const rest = slots.filter((slot) => !preferred || slot.id !== preferred.id);
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

  function layoutPets(entities, options) {
    const source = Array.isArray(entities) ? entities.filter((entry) => entry && entry.id) : [];
    const posture = options && options.posture === 'seated' ? 'seated' : 'home';
    const slots = PET_LAYOUTS[posture];
    // Reserve canonical guardians first; generic sphere pets fill the remaining
    // authored slots without ever competing for the same footprint.
    const priority = (species) => species === 'bodyToad' ? 3 : species === 'resourcesPenguin' ? 2 : species === 'recoverySlug' ? 1 : 0;
    const sorted = source.map((entry, index) => ({ ...entry, _index: index }))
      .sort((a, b) => priority(b.species) - priority(a.species));
    const occupied = new Set();
    const result = [];
    for (const entity of sorted) {
      const slot = orderedSlots(entity, occupied, slots)[0];
      if (!slot) continue;
      occupied.add(slot.id);
      result.push({ ...placementFor(entity, slot), _index: entity._index });
    }
    result.sort((a, b) => a._index - b._index);
    return result.map(({ _index, ...placement }) => Object.freeze(placement));
  }

  function styleVars(placement, options) {
    if (!placement) return '';
    const prefix = options && options.prefix ? `${String(options.prefix)}-` : '';
    return [
      `--den-stage-${prefix}center:${placement.anchorX.toFixed(4)}%`,
      `--den-stage-${prefix}left:${placement.left.toFixed(4)}%`,
      `--den-stage-${prefix}bottom:${placement.bottom.toFixed(4)}%`,
      `--den-stage-${prefix}width:${placement.width.toFixed(4)}%`,
      `--den-stage-${prefix}depth:${placement.depth.toFixed(4)}`,
      `--den-stage-${prefix}z:${placement.z}`,
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

  function clearRecoveryMeetingClasses(scope) {
    scope.classList.remove('is-recovery-pair-approaching', 'is-recovery-pair-at-meeting', 'is-recovery-pair-returning', 'is-recovery-pair-settling');
  }

  function clearResourcesMeetingClasses(scope) {
    scope.classList.remove('is-resources-pair-approaching', 'is-resources-pair-at-meeting', 'is-resources-pair-returning', 'is-resources-pair-settling');
  }

  function clearShadowMeetingClasses(scope) {
    scope.classList.remove('is-shadow-pair-approaching', 'is-shadow-pair-at-meeting', 'is-shadow-pair-returning', 'is-shadow-pair-settling');
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
    scope.classList.remove('is-body-pair-at-meeting');
    await wait(returnMs);
    scope.classList.remove('is-body-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (toad && toadMotion && toadMotion.clearHopFrames) await toadMotion.clearHopFrames(toad);
    return true;
  }

  async function approachRecoveryPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    const avatar = scope.querySelector && scope.querySelector('.den-avatar-core');
    const slug = scope.querySelector && scope.querySelector('[data-recovery-slug]');
    const motion = root.TravellerMotionV3;
    const slugMotion = root.RecoverySlugV1;
    const approachMs = Math.max(1200, Number(config.approachMs) || 2600);
    const returnMs = Math.max(1200, Number(config.returnMs) || 2800);
    const contactMs = Math.max(800, Number(config.duration) || 6800);
    clearRecoveryMeetingClasses(scope);
    if (avatar && motion) motion.installWalkFrames(avatar, 'right');
    if (slug && slugMotion && slugMotion.installGlideFrames) await slugMotion.installGlideFrames(slug, 'meeting');
    scope.classList.add('is-recovery-pair-approaching');
    await nextFrame();
    await wait(approachMs);
    if (!scope.isConnected) {
      clearRecoveryMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (slug && slugMotion && slugMotion.clearGlideFrames) slugMotion.clearGlideFrames(slug).catch(() => {});
      return false;
    }
    scope.classList.remove('is-recovery-pair-approaching');
    scope.classList.add('is-recovery-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (slug && slugMotion && slugMotion.clearGlideFrames) await slugMotion.clearGlideFrames(slug);
    const played = await play();
    if (!played) {
      clearRecoveryMeetingClasses(scope);
      return false;
    }
    scope.classList.add('is-recovery-pair-settling');
    await wait(contactMs + 100);
    if (!scope.isConnected) {
      clearRecoveryMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-recovery-pair-settling');
    scope.classList.add('is-recovery-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (slug && slugMotion && slugMotion.installGlideFrames) await slugMotion.installGlideFrames(slug, 'home');
    await nextFrame();
    scope.classList.remove('is-recovery-pair-at-meeting');
    await wait(returnMs);
    scope.classList.remove('is-recovery-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (slug && slugMotion && slugMotion.clearGlideFrames) await slugMotion.clearGlideFrames(slug);
    return true;
  }

  async function approachResourcesPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    const avatar = scope.querySelector && scope.querySelector('.den-avatar-core');
    const penguin = scope.querySelector && scope.querySelector('[data-resources-penguin]');
    const motion = root.TravellerMotionV3;
    const penguinMotion = root.ResourcesPenguinV1;
    const approachMs = Math.max(1200, Number(config.approachMs) || 2200);
    const returnMs = Math.max(1200, Number(config.returnMs) || 2200);
    const contactMs = Math.max(900, Number(config.duration) || 7200);
    clearResourcesMeetingClasses(scope);
    if (avatar && motion) motion.installWalkFrames(avatar, 'right');
    if (penguin && penguinMotion && penguinMotion.installWaddleFrames) await penguinMotion.installWaddleFrames(penguin, 'meeting');
    scope.classList.add('is-resources-pair-approaching');
    await nextFrame();
    await wait(approachMs);
    if (!scope.isConnected) {
      clearResourcesMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (penguin && penguinMotion && penguinMotion.clearWaddleFrames) penguinMotion.clearWaddleFrames(penguin).catch(() => {});
      return false;
    }
    scope.classList.remove('is-resources-pair-approaching');
    scope.classList.add('is-resources-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (penguin && penguinMotion && penguinMotion.clearWaddleFrames) await penguinMotion.clearWaddleFrames(penguin);
    const played = await play();
    if (!played) {
      clearResourcesMeetingClasses(scope);
      return false;
    }
    scope.classList.add('is-resources-pair-settling');
    await wait(contactMs + 100);
    if (!scope.isConnected) {
      clearResourcesMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-resources-pair-settling');
    scope.classList.add('is-resources-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (penguin && penguinMotion && penguinMotion.installWaddleFrames) await penguinMotion.installWaddleFrames(penguin, 'home');
    await nextFrame();
    scope.classList.remove('is-resources-pair-at-meeting');
    await wait(returnMs);
    scope.classList.remove('is-resources-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (penguin && penguinMotion && penguinMotion.clearWaddleFrames) await penguinMotion.clearWaddleFrames(penguin);
    return true;
  }

  async function approachShadowPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    const avatar = scope.querySelector && scope.querySelector('.den-avatar-core');
    const companion = scope.querySelector && scope.querySelector('.den-companion');
    const rig = companion && companion.querySelector('[data-shadow-rig]');
    const motion = root.TravellerMotionV3;
    const shadowRig = root.ShadowRig;
    const restoreState = rig ? String(rig.dataset.shadowState || 'calm') : 'calm';
    const approachMs = Math.max(900, Number(config.approachMs) || 1800);
    const returnMs = Math.max(900, Number(config.returnMs) || 1800);
    const contactMs = Math.max(900, Number(config.duration) || 7600);
    clearShadowMeetingClasses(scope);
    if (avatar && motion) motion.installWalkFrames(avatar, 'right');
    if (rig && shadowRig) shadowRig.setState(rig, 'listening');
    scope.classList.add('is-shadow-pair-approaching');
    await nextFrame();
    await wait(approachMs);
    if (!scope.isConnected) {
      clearShadowMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (rig && shadowRig) shadowRig.setState(rig, restoreState);
      return false;
    }
    scope.classList.remove('is-shadow-pair-approaching');
    scope.classList.add('is-shadow-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    const played = await play();
    if (!played) {
      clearShadowMeetingClasses(scope);
      if (rig && shadowRig) shadowRig.setState(rig, restoreState);
      return false;
    }
    scope.classList.add('is-shadow-pair-settling');
    await wait(contactMs + 100);
    if (!scope.isConnected) {
      clearShadowMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-shadow-pair-settling');
    scope.classList.add('is-shadow-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (rig && shadowRig) shadowRig.setState(rig, 'caring');
    await nextFrame();
    scope.classList.remove('is-shadow-pair-at-meeting');
    await wait(returnMs);
    scope.classList.remove('is-shadow-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (rig && shadowRig) shadowRig.setState(rig, restoreState);
    return true;
  }

  return Object.freeze({
    VERSION,
    WORLD,
    APPROACH_MS,
    RETURN_MS,
    PET_SLOTS,
    SEATED_PET_SLOTS,
    PET_LAYOUTS,
    PROFILES,
    profileFor,
    layoutPets,
    styleVars,
    overlaps,
    approachBodyPair,
    approachRecoveryPair,
    approachResourcesPair,
    approachShadowPair,
  });
});
