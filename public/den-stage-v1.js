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

  const VERSION = '1.12.0';
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

  // Pair scenes no longer assume that every guardian lives to the right of
  // Traveller.  These are authored host sizes; their anchor is calculated
  // from the actors that are actually in the room at interaction time.
  const MEETING_PROFILES = Object.freeze({
    body: Object.freeze({ actorSelector: '.den-body-toad', motionSelector: '[data-body-toad]', pairSelector: '.body-pair-v2', pairWidth: 38, pairFootprint: 31, gap: 4, approachMs: 1800, returnMs: 1800 }),
    recovery: Object.freeze({ actorSelector: '.den-recovery-slug', motionSelector: '[data-recovery-slug]', pairSelector: '.recovery-pair-v2', pairWidth: 46, pairFootprint: 43.5, gap: 4, approachMs: 2600, returnMs: 2800 }),
    resources: Object.freeze({ actorSelector: '.den-resources-penguin', motionSelector: '[data-resources-penguin]', pairSelector: '.resources-pair-v1', pairWidth: 43, pairFootprint: 40, gap: 4, approachMs: 2200, returnMs: 2200 }),
    shadow: Object.freeze({ actorSelector: '.den-companion[data-shadow-den]', motionSelector: '[data-shadow-den]', pairSelector: '.shadow-den-pair-v1', pairWidth: 0, pairFootprint: 0, gap: 3, approachMs: 1800, returnMs: 1800 }),
  });
  const SPECTATOR_ANCHORS = Object.freeze([8, 16, 28, 42, 58, 74, 89, 94.5]);

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

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function directionBetween(from, to, fallback) {
    if (Number(to) < Number(from) - 0.01) return 'left';
    if (Number(to) > Number(from) + 0.01) return 'right';
    return fallback === 'left' ? 'left' : 'right';
  }

  function actorSnapshot(value, fallbackId) {
    const source = value || {};
    return Object.freeze({
      id: String(source.id || fallbackId || 'actor'),
      anchorX: Number(source.anchorX) || 0,
      width: Math.max(0.1, Number(source.width) || Number(source.footprint) || 1),
      footprint: Math.max(0.1, Number(source.footprint) || Number(source.width) || 1),
      species: source.species || 'default',
    });
  }

  function translateFor(from, to, width) {
    return ((Number(to) - Number(from)) / Math.max(0.1, Number(width) || 1)) * 100;
  }

  function planMeeting(input) {
    const config = input || {};
    const profile = MEETING_PROFILES[config.kind] || MEETING_PROFILES.body;
    const avatar = actorSnapshot(config.avatar, 'traveller');
    const actor = actorSnapshot(config.actor, config.kind || 'guardian');
    const pairWidth = Math.max(0, Number(config.pairWidth) || profile.pairWidth);
    const pairFootprint = Math.max(0, Number(config.pairFootprint) || profile.pairFootprint);
    const minAnchor = pairWidth ? pairWidth / 2 + 1 : 4;
    const maxAnchor = pairWidth ? 99 - pairWidth / 2 : 96;
    const anchorX = clamp((avatar.anchorX + actor.anchorX) / 2, minAnchor, maxAnchor);
    const actorOnLeft = actor.anchorX < avatar.anchorX;
    const avatarTarget = anchorX + (actorOnLeft ? profile.gap : -profile.gap);
    const actorTarget = anchorX + (actorOnLeft ? -profile.gap : profile.gap);
    const meetingReservation = { id: 'meeting', anchorX, footprint: pairFootprint };
    const spectators = Array.isArray(config.spectators)
      ? config.spectators.map((entry, index) => actorSnapshot(entry, `spectator-${index}`))
      : [];
    const stable = spectators.filter((entry) => !pairFootprint || !overlaps(entry, meetingReservation));
    const displaced = spectators.filter((entry) => pairFootprint && overlaps(entry, meetingReservation));
    const reserved = pairFootprint ? [meetingReservation, ...stable] : stable.slice();
    const spectatorTargets = displaced.map((entry) => {
      const viable = SPECTATOR_ANCHORS.filter((candidate) => {
        const footprint = { anchorX: candidate, footprint: entry.footprint };
        const left = candidate - entry.footprint / 2;
        const right = candidate + entry.footprint / 2;
        return left >= 0 && right <= 100 && reserved.every((taken) => !overlaps(footprint, taken));
      }).sort((a, b) => Math.abs(a - entry.anchorX) - Math.abs(b - entry.anchorX));
      const targetAnchor = viable.length ? viable[0] : entry.anchorX;
      const result = Object.freeze({
        ...entry,
        targetAnchor,
        direction: directionBetween(entry.anchorX, targetAnchor, 'left'),
        translate: translateFor(entry.anchorX, targetAnchor, entry.width),
      });
      reserved.push({ anchorX: targetAnchor, footprint: entry.footprint });
      return result;
    });
    return Object.freeze({
      kind: config.kind || 'body',
      anchorX,
      actorOnLeft,
      pairWidth,
      pairFootprint,
      pairLeft: pairWidth ? anchorX - pairWidth / 2 : 0,
      avatar: Object.freeze({ ...avatar, targetAnchor: avatarTarget, direction: directionBetween(avatar.anchorX, avatarTarget, actorOnLeft ? 'left' : 'right'), translate: translateFor(avatar.anchorX, avatarTarget, avatar.width) }),
      actor: Object.freeze({ ...actor, targetAnchor: actorTarget, direction: directionBetween(actor.anchorX, actorTarget, actorOnLeft ? 'right' : 'left'), translate: translateFor(actor.anchorX, actorTarget, actor.width) }),
      spectatorTargets: Object.freeze(spectatorTargets),
    });
  }

  function speciesForElement(element) {
    if (!element || !element.matches) return 'default';
    if (element.matches('.den-body-toad')) return 'bodyToad';
    if (element.matches('.den-recovery-slug')) return 'recoverySlug';
    if (element.matches('.den-resources-penguin')) return 'resourcesPenguin';
    return 'default';
  }

  function measureElement(scene, element, id, species) {
    if (!scene || !element || typeof element.getBoundingClientRect !== 'function') return null;
    const sceneRect = scene.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (!sceneRect.width || !rect.width) return null;
    const width = rect.width / sceneRect.width * 100;
    return {
      id,
      species: species || speciesForElement(element),
      anchorX: (rect.left + rect.width / 2 - sceneRect.left) / sceneRect.width * 100,
      width,
      footprint: width * 0.82,
    };
  }

  function prepareMeeting(scope, kind) {
    const profile = MEETING_PROFILES[kind];
    const scene = scope && scope.querySelector && scope.querySelector('.den-scene');
    const avatarElement = scope && scope.querySelector && scope.querySelector('.den-avatar-core');
    const actorElement = scope && scope.querySelector && scope.querySelector(profile && profile.actorSelector);
    if (!profile || !scene || !avatarElement || !actorElement) return null;
    const avatar = measureElement(scene, avatarElement, 'traveller', 'traveller');
    const actor = measureElement(scene, actorElement, kind, kind);
    if (!avatar || !actor) return null;
    const spectatorElements = [...scene.querySelectorAll('.den-pet[data-den-slot]')].filter((element) => element !== actorElement);
    const spectatorSnapshots = spectatorElements.map((element, index) => measureElement(scene, element, `spectator-${index}`, speciesForElement(element))).filter(Boolean);
    const planned = planMeeting({ kind, avatar, actor, spectators: spectatorSnapshots });
    const spectatorTargets = planned.spectatorTargets.map((target) => {
      const index = Number(target.id.replace('spectator-', ''));
      return { ...target, element: spectatorElements[index] || null };
    }).filter((target) => target.element);
    scope.dataset.denMeeting = kind;
    scope.style.setProperty('--den-meeting-pair-left', `${planned.pairLeft.toFixed(4)}%`);
    scope.style.setProperty('--den-meeting-pair-width', `${planned.pairWidth.toFixed(4)}%`);
    scope.style.setProperty('--den-meeting-avatar-shift', `${planned.avatar.translate.toFixed(4)}%`);
    scope.style.setProperty('--den-meeting-actor-shift', `${planned.actor.translate.toFixed(4)}%`);
    spectatorTargets.forEach((target) => target.element.style.setProperty('--den-spectator-shift', `${target.translate.toFixed(4)}%`));
    return {
      ...planned,
      scope,
      avatarElement,
      actorElement,
      actorMotionElement: actorElement.matches(profile.motionSelector) ? actorElement : actorElement.querySelector(profile.motionSelector),
      spectatorTargets,
    };
  }

  function clearMeetingPlan(scope, plan) {
    const current = plan || {};
    const targets = current.spectatorTargets || [...(scope && scope.querySelectorAll ? scope.querySelectorAll('.is-den-spectator-reflow, .is-den-spectator-returning') : [])].map((element) => ({ element }));
    targets.forEach(({ element }) => {
      if (!element) return;
      element.classList.remove('is-den-spectator-reflow', 'is-den-spectator-returning');
      element.style.removeProperty('--den-spectator-shift');
    });
    if (!scope) return;
    delete scope.dataset.denMeeting;
    scope.style.removeProperty('--den-meeting-pair-left');
    scope.style.removeProperty('--den-meeting-pair-width');
    scope.style.removeProperty('--den-meeting-avatar-shift');
    scope.style.removeProperty('--den-meeting-actor-shift');
  }

  function nextFrame() {
    return new Promise((resolve) => {
      const raf = root.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
      raf(() => raf(resolve));
    });
  }

  // A scene owner can revoke its turn when the Den leaves the viewport or a
  // controller aborts. The stage never resumes an old route after that point:
  // a stale continuation is worse than a skipped decorative beat because it
  // can reintroduce an actor after a newer home snapshot has rendered.
  function actionCurrent(scope, config) {
    return Boolean(scope && scope.isConnected && (!config || typeof config.isCurrent !== 'function' || config.isCurrent() !== false));
  }

  function nextActionFrame(scope, config) {
    return nextFrame().then(() => actionCurrent(scope, config));
  }

  function waitForAction(scope, config, ms) {
    if (!actionCurrent(scope, config)) return Promise.resolve(false);
    const raf = root.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };
      const poll = () => {
        if (done) return;
        if (!actionCurrent(scope, config)) return finish(false);
        raf(poll);
      };
      const timer = setTimeout(() => finish(actionCurrent(scope, config)), ms);
      poll();
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

  async function legacyApproachBodyPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    if (!actionCurrent(scope, config)) return false;
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
    if (!actionCurrent(scope, config)) return false;
    scope.classList.add('is-body-pair-approaching');
    if (!(await nextActionFrame(scope, config)) || !(await waitForAction(scope, config, approachMs))) return false;
    if (!actionCurrent(scope, config)) {
      clearMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (toad && toadMotion && toadMotion.clearHopFrames) toadMotion.clearHopFrames(toad).catch(() => {});
      return false;
    }
    scope.classList.remove('is-body-pair-approaching');
    scope.classList.add('is-body-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (toad && toadMotion && toadMotion.clearHopFrames) await toadMotion.clearHopFrames(toad);
    if (!actionCurrent(scope, config)) return false;
    const played = await play();
    if (!actionCurrent(scope, config) || !played) {
      clearMeetingClasses(scope);
      return false;
    }
    scope.classList.add('is-body-pair-settling');
    if (!(await waitForAction(scope, config, contactMs + 80))) return false;
    if (!actionCurrent(scope, config)) {
      clearMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-body-pair-settling');
    scope.classList.add('is-body-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (toad && toadMotion && toadMotion.installHopFrames) await toadMotion.installHopFrames(toad, 'home');
    if (!actionCurrent(scope, config)) return false;
    if (!(await nextActionFrame(scope, config))) return false;
    scope.classList.remove('is-body-pair-at-meeting');
    if (!(await waitForAction(scope, config, returnMs))) return false;
    if (!actionCurrent(scope, config)) return false;
    scope.classList.remove('is-body-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (toad && toadMotion && toadMotion.clearHopFrames) await toadMotion.clearHopFrames(toad);
    return true;
  }

  async function legacyApproachRecoveryPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    if (!actionCurrent(scope, config)) return false;
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
    if (!actionCurrent(scope, config)) return false;
    scope.classList.add('is-recovery-pair-approaching');
    if (!(await nextActionFrame(scope, config)) || !(await waitForAction(scope, config, approachMs))) return false;
    if (!actionCurrent(scope, config)) {
      clearRecoveryMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (slug && slugMotion && slugMotion.clearGlideFrames) slugMotion.clearGlideFrames(slug).catch(() => {});
      return false;
    }
    scope.classList.remove('is-recovery-pair-approaching');
    scope.classList.add('is-recovery-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (slug && slugMotion && slugMotion.clearGlideFrames) await slugMotion.clearGlideFrames(slug);
    if (!actionCurrent(scope, config)) return false;
    const played = await play();
    if (!actionCurrent(scope, config) || !played) {
      clearRecoveryMeetingClasses(scope);
      return false;
    }
    scope.classList.add('is-recovery-pair-settling');
    if (!(await waitForAction(scope, config, contactMs + 100))) return false;
    if (!actionCurrent(scope, config)) {
      clearRecoveryMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-recovery-pair-settling');
    scope.classList.add('is-recovery-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (slug && slugMotion && slugMotion.installGlideFrames) await slugMotion.installGlideFrames(slug, 'home');
    if (!actionCurrent(scope, config)) return false;
    if (!(await nextActionFrame(scope, config))) return false;
    scope.classList.remove('is-recovery-pair-at-meeting');
    if (!(await waitForAction(scope, config, returnMs))) return false;
    if (!actionCurrent(scope, config)) return false;
    scope.classList.remove('is-recovery-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (slug && slugMotion && slugMotion.clearGlideFrames) await slugMotion.clearGlideFrames(slug);
    return true;
  }

  async function legacyApproachResourcesPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    if (!actionCurrent(scope, config)) return false;
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
    if (!actionCurrent(scope, config)) return false;
    scope.classList.add('is-resources-pair-approaching');
    if (!(await nextActionFrame(scope, config)) || !(await waitForAction(scope, config, approachMs))) return false;
    if (!actionCurrent(scope, config)) {
      clearResourcesMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (penguin && penguinMotion && penguinMotion.clearWaddleFrames) penguinMotion.clearWaddleFrames(penguin).catch(() => {});
      return false;
    }
    scope.classList.remove('is-resources-pair-approaching');
    scope.classList.add('is-resources-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (penguin && penguinMotion && penguinMotion.clearWaddleFrames) await penguinMotion.clearWaddleFrames(penguin);
    if (!actionCurrent(scope, config)) return false;
    const played = await play();
    if (!actionCurrent(scope, config) || !played) {
      clearResourcesMeetingClasses(scope);
      return false;
    }
    scope.classList.add('is-resources-pair-settling');
    if (!(await waitForAction(scope, config, contactMs + 100))) return false;
    if (!actionCurrent(scope, config)) {
      clearResourcesMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-resources-pair-settling');
    scope.classList.add('is-resources-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (penguin && penguinMotion && penguinMotion.installWaddleFrames) await penguinMotion.installWaddleFrames(penguin, 'home');
    if (!actionCurrent(scope, config)) return false;
    if (!(await nextActionFrame(scope, config))) return false;
    scope.classList.remove('is-resources-pair-at-meeting');
    if (!(await waitForAction(scope, config, returnMs))) return false;
    if (!actionCurrent(scope, config)) return false;
    scope.classList.remove('is-resources-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (penguin && penguinMotion && penguinMotion.clearWaddleFrames) await penguinMotion.clearWaddleFrames(penguin);
    return true;
  }

  async function legacyApproachShadowPair(scope, play, options) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    if (!actionCurrent(scope, config)) return false;
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
    if (!actionCurrent(scope, config)) return false;
    scope.classList.add('is-shadow-pair-approaching');
    if (!(await nextActionFrame(scope, config)) || !(await waitForAction(scope, config, approachMs))) return false;
    if (!actionCurrent(scope, config)) {
      clearShadowMeetingClasses(scope);
      if (avatar && motion) motion.clearWalkFrames(avatar);
      if (rig && shadowRig) shadowRig.setState(rig, restoreState);
      return false;
    }
    scope.classList.remove('is-shadow-pair-approaching');
    scope.classList.add('is-shadow-pair-at-meeting');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (!actionCurrent(scope, config)) return false;
    const played = await play();
    if (!actionCurrent(scope, config) || !played) {
      clearShadowMeetingClasses(scope);
      if (rig && shadowRig) shadowRig.setState(rig, restoreState);
      return false;
    }
    scope.classList.add('is-shadow-pair-settling');
    if (!(await waitForAction(scope, config, contactMs + 100))) return false;
    if (!actionCurrent(scope, config)) {
      clearShadowMeetingClasses(scope);
      return true;
    }
    scope.classList.remove('is-shadow-pair-settling');
    scope.classList.add('is-shadow-pair-returning');
    if (avatar && motion) motion.installWalkFrames(avatar, 'left');
    if (rig && shadowRig) shadowRig.setState(rig, 'caring');
    if (!actionCurrent(scope, config)) return false;
    if (!(await nextActionFrame(scope, config))) return false;
    scope.classList.remove('is-shadow-pair-at-meeting');
    if (!(await waitForAction(scope, config, returnMs))) return false;
    if (!actionCurrent(scope, config)) return false;
    scope.classList.remove('is-shadow-pair-returning');
    if (avatar && motion) motion.clearWalkFrames(avatar);
    if (rig && shadowRig) shadowRig.setState(rig, restoreState);
    return true;
  }

  const PHASE_PREFIX = Object.freeze({ body: 'body', recovery: 'recovery', resources: 'resources', shadow: 'shadow' });

  function phaseClasses(kind) {
    const prefix = PHASE_PREFIX[kind] || kind;
    return {
      approaching: `is-${prefix}-pair-approaching`,
      meeting: `is-${prefix}-pair-at-meeting`,
      settling: `is-${prefix}-pair-settling`,
      returning: `is-${prefix}-pair-returning`,
    };
  }

  function clearPairPhaseClasses(scope, kind) {
    if (!scope || !scope.classList) return;
    const phases = phaseClasses(kind);
    scope.classList.remove(phases.approaching, phases.meeting, phases.settling, phases.returning);
  }

  function reverseDirection(direction) { return direction === 'left' ? 'right' : 'left'; }

  async function installActorMotion(plan, returning) {
    if (!plan) return false;
    const direction = returning ? directionBetween(plan.actor.targetAnchor, plan.actor.anchorX, reverseDirection(plan.actor.direction)) : plan.actor.direction;
    const element = plan.actorMotionElement;
    if (plan.kind === 'body' && element && root.BodyToadV1 && root.BodyToadV1.installHopFrames) {
      await root.BodyToadV1.installHopFrames(element, direction === 'left' ? 'home' : 'meeting');
      plan.actorElement.dataset.toadDirection = direction;
      return true;
    }
    if (plan.kind === 'recovery' && element && root.RecoverySlugV1 && root.RecoverySlugV1.installGlideFrames) {
      await root.RecoverySlugV1.installGlideFrames(element, direction === 'right' ? 'home' : 'meeting');
      plan.actorElement.dataset.slugDirection = direction;
      return true;
    }
    if (plan.kind === 'resources' && element && root.ResourcesPenguinV1 && root.ResourcesPenguinV1.installWaddleFrames) {
      const logical = direction === 'left' ? 'meeting' : 'home';
      await root.ResourcesPenguinV1.installWaddleFrames(element, logical);
      plan.actorElement.dataset.resourcesDirection = logical;
      return true;
    }
    if (plan.kind === 'shadow' && plan.actorElement) {
      plan.actorElement.dataset.shadowFlight = direction;
      return true;
    }
    return false;
  }

  async function clearActorMotion(plan) {
    if (!plan) return false;
    const element = plan.actorMotionElement;
    delete plan.actorElement.dataset.toadDirection;
    delete plan.actorElement.dataset.slugDirection;
    delete plan.actorElement.dataset.resourcesDirection;
    delete plan.actorElement.dataset.shadowFlight;
    if (plan.kind === 'body' && element && root.BodyToadV1 && root.BodyToadV1.clearHopFrames) return root.BodyToadV1.clearHopFrames(element);
    if (plan.kind === 'recovery' && element && root.RecoverySlugV1 && root.RecoverySlugV1.clearGlideFrames) return root.RecoverySlugV1.clearGlideFrames(element);
    if (plan.kind === 'resources' && element && root.ResourcesPenguinV1 && root.ResourcesPenguinV1.clearWaddleFrames) return root.ResourcesPenguinV1.clearWaddleFrames(element);
    return true;
  }

  async function installSpectatorMotion(target, returning) {
    if (!target || !target.element) return false;
    const direction = returning ? reverseDirection(target.direction) : target.direction;
    const host = target.element;
    if (target.species === 'bodyToad' && root.BodyToadV1 && root.BodyToadV1.installHopFrames) {
      const inner = host.matches('[data-body-toad]') ? host : host.querySelector('[data-body-toad]');
      if (!inner) return false;
      await root.BodyToadV1.installHopFrames(inner, direction === 'left' ? 'home' : 'meeting');
      host.dataset.toadDirection = direction;
      return true;
    }
    if (target.species === 'recoverySlug' && root.RecoverySlugV1 && root.RecoverySlugV1.installGlideFrames) {
      const inner = host.matches('[data-recovery-slug]') ? host : host.querySelector('[data-recovery-slug]');
      if (!inner) return false;
      await root.RecoverySlugV1.installGlideFrames(inner, direction === 'right' ? 'home' : 'meeting');
      host.dataset.slugDirection = direction;
      return true;
    }
    if (target.species === 'resourcesPenguin' && root.ResourcesPenguinV1 && root.ResourcesPenguinV1.installWaddleFrames) {
      const inner = host.matches('[data-resources-penguin]') ? host : host.querySelector('[data-resources-penguin]');
      if (!inner) return false;
      const logical = direction === 'left' ? 'meeting' : 'home';
      await root.ResourcesPenguinV1.installWaddleFrames(inner, logical);
      host.dataset.resourcesDirection = logical;
      return true;
    }
    return false;
  }

  async function clearSpectatorMotion(target) {
    if (!target || !target.element) return false;
    const host = target.element;
    delete host.dataset.toadDirection;
    delete host.dataset.slugDirection;
    delete host.dataset.resourcesDirection;
    if (target.species === 'bodyToad' && root.BodyToadV1 && root.BodyToadV1.clearHopFrames) {
      const inner = host.matches('[data-body-toad]') ? host : host.querySelector('[data-body-toad]');
      return inner ? root.BodyToadV1.clearHopFrames(inner) : false;
    }
    if (target.species === 'recoverySlug' && root.RecoverySlugV1 && root.RecoverySlugV1.clearGlideFrames) {
      const inner = host.matches('[data-recovery-slug]') ? host : host.querySelector('[data-recovery-slug]');
      return inner ? root.RecoverySlugV1.clearGlideFrames(inner) : false;
    }
    if (target.species === 'resourcesPenguin' && root.ResourcesPenguinV1 && root.ResourcesPenguinV1.clearWaddleFrames) {
      const inner = host.matches('[data-resources-penguin]') ? host : host.querySelector('[data-resources-penguin]');
      return inner ? root.ResourcesPenguinV1.clearWaddleFrames(inner) : false;
    }
    return true;
  }

  async function startSpectatorMoves(plan, returning) {
    const targets = plan && plan.spectatorTargets ? plan.spectatorTargets : [];
    await Promise.allSettled(targets.map((target) => installSpectatorMotion(target, returning)));
    targets.forEach((target) => {
      target.element.classList.add('is-den-spectator-reflow');
      target.element.classList.toggle('is-den-spectator-returning', Boolean(returning));
    });
  }

  function stopSpectatorMoves(plan) {
    const targets = plan && plan.spectatorTargets ? plan.spectatorTargets : [];
    return Promise.allSettled(targets.map(clearSpectatorMotion));
  }

  async function approachPair(scope, play, options, kind) {
    if (!scope || typeof play !== 'function') return false;
    const config = options || {};
    const profile = MEETING_PROFILES[kind];
    if (!profile || !actionCurrent(scope, config)) return false;
    const plan = prepareMeeting(scope, kind);
    if (!plan) {
      const legacy = {
        body: legacyApproachBodyPair,
        recovery: legacyApproachRecoveryPair,
        resources: legacyApproachResourcesPair,
        shadow: legacyApproachShadowPair,
      }[kind];
      return legacy ? legacy(scope, play, config) : false;
    }
    const phases = phaseClasses(kind);
    const motion = root.TravellerMotionV3;
    const approachMs = Math.max(700, Number(config.approachMs) || profile.approachMs || APPROACH_MS);
    const returnMs = Math.max(700, Number(config.returnMs) || profile.returnMs || RETURN_MS);
    const contactMs = Math.max(400, Number(config.duration) || 3000);
    clearPairPhaseClasses(scope, kind);
    try {
      if (motion) motion.installWalkFrames(plan.avatarElement, plan.avatar.direction);
      await Promise.allSettled([installActorMotion(plan, false), startSpectatorMoves(plan, false)]);
      if (!actionCurrent(scope, config)) return false;
      scope.classList.add(phases.approaching);
      if (!(await nextActionFrame(scope, config)) || !(await waitForAction(scope, config, approachMs))) return false;
      scope.classList.remove(phases.approaching);
      scope.classList.add(phases.meeting);
      if (motion) motion.clearWalkFrames(plan.avatarElement);
      await Promise.allSettled([clearActorMotion(plan), stopSpectatorMoves(plan)]);
      if (!actionCurrent(scope, config)) return false;
      const played = await play();
      if (!actionCurrent(scope, config) || !played) return false;
      scope.classList.add(phases.settling);
      if (!(await waitForAction(scope, config, contactMs + 100))) return false;
      if (!actionCurrent(scope, config)) return true;
      scope.classList.remove(phases.settling);
      const avatarReturn = directionBetween(plan.avatar.targetAnchor, plan.avatar.anchorX, reverseDirection(plan.avatar.direction));
      if (motion) motion.installWalkFrames(plan.avatarElement, avatarReturn);
      await Promise.allSettled([installActorMotion(plan, true), startSpectatorMoves(plan, true)]);
      if (!actionCurrent(scope, config)) return false;
      scope.classList.add(phases.returning);
      if (!(await nextActionFrame(scope, config))) return false;
      scope.classList.remove(phases.meeting);
      if (!(await waitForAction(scope, config, returnMs))) return false;
      return actionCurrent(scope, config);
    } finally {
      clearPairPhaseClasses(scope, kind);
      if (motion) motion.clearWalkFrames(plan.avatarElement);
      await Promise.allSettled([clearActorMotion(plan), stopSpectatorMoves(plan)]);
      clearMeetingPlan(scope, plan);
    }
  }

  function approachBodyPair(scope, play, options) { return approachPair(scope, play, options, 'body'); }
  function approachRecoveryPair(scope, play, options) { return approachPair(scope, play, options, 'recovery'); }
  function approachResourcesPair(scope, play, options) { return approachPair(scope, play, options, 'resources'); }
  function approachShadowPair(scope, play, options) { return approachPair(scope, play, options, 'shadow'); }

  const laneControllers = new WeakMap();

  function laneActors(scope) {
    if (!scope || !scope.querySelector) return {};
    return {
      slug: scope.querySelector('[data-recovery-slug]'),
      shadow: scope.querySelector('[data-shadow-den]'),
    };
  }

  async function startLaneMotion(scope, route) {
    if (!scope || !scope.isConnected) return false;
    const prior = laneControllers.get(scope);
    if (prior && prior.timer) clearTimeout(prior.timer);
    const direction = route === 'home' ? 'right' : 'left';
    const { slug, shadow } = laneActors(scope);
    scope.dataset.denLaneMotion = route === 'home' ? 'home' : 'away';
    if (shadow) shadow.dataset.shadowFlight = direction;
    const tasks = [];
    if (slug && root.RecoverySlugV1 && root.RecoverySlugV1.installGlideFrames) {
      tasks.push(root.RecoverySlugV1.installGlideFrames(slug, route === 'home' ? 'home' : 'meeting'));
    }
    laneControllers.set(scope, { route, timer: 0 });
    await Promise.allSettled(tasks);
    return true;
  }

  async function finishLaneMotion(scope, destination) {
    if (!scope) return false;
    const current = laneControllers.get(scope);
    if (current && current.timer) clearTimeout(current.timer);
    const { slug, shadow } = laneActors(scope);
    if (shadow) delete shadow.dataset.shadowFlight;
    if (slug && root.RecoverySlugV1 && root.RecoverySlugV1.clearGlideFrames) {
      await root.RecoverySlugV1.clearGlideFrames(slug, slug.dataset.state);
    }
    if (destination === 'home' || destination === 'reset') delete scope.dataset.denLaneMotion;
    laneControllers.delete(scope);
    return true;
  }

  function onTravellerMotion(event) {
    const host = event && event.target && event.target.closest ? event.target.closest('.den-avatar-core') : null;
    const scope = host && host.closest ? host.closest('.den-shell') : null;
    const detail = event && event.detail ? event.detail : {};
    if (!scope) return;
    if (detail.phase === 'depart') {
      startLaneMotion(scope, detail.destination === 'home' ? 'home' : 'away').catch(() => false);
      return;
    }
    if (detail.phase === 'arrive') {
      finishLaneMotion(scope, detail.destination).catch(() => false);
      return;
    }
    if (detail.phase === 'reset') finishLaneMotion(scope, 'reset').catch(() => false);
  }

  if (root.document && typeof root.document.addEventListener === 'function') {
    root.document.addEventListener('satoru:den-traveller-motion', onTravellerMotion);
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
    MEETING_PROFILES,
    profileFor,
    layoutPets,
    styleVars,
    overlaps,
    directionBetween,
    planMeeting,
    prepareMeeting,
    clearMeetingPlan,
    startLaneMotion,
    finishLaneMotion,
    onTravellerMotion,
    approachBodyPair,
    approachRecoveryPair,
    approachResourcesPair,
    approachShadowPair,
  });
});
