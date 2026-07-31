/* Satoru Den scene v4 geometry contract.
 *
 * Everything in the room is expressed in one immutable 1536 x 864 world.
 * Responsive code may scale or crop the whole world, but must not reposition
 * individual layers for a viewport breakpoint.
 */
(function denSceneV4Factory(global) {
  'use strict';

  const WORLD = {
    width: 1536,
    height: 864,
    aspectRatio: 16 / 9,
    coordinateSpace: 'world-px',
    background: '/art/den/v3/den-v3-runtime-1536x864.png',
  };

  const REGIONS = {
    backWall: {
      bounds: { x: 505, y: 103, w: 509, h: 438 },
      plane: 'back-wall',
    },
    window: {
      outerBounds: { x: 1024, y: 40, w: 432, h: 535 },
      glassBounds: { x: 1084, y: 93, w: 336, h: 416 },
      archMask: {
        units: 'world-px',
        svgPath: 'M1084 509V229C1084 139 1158 93 1252 93S1420 139 1420 229V509Z',
        crown: { x: 1252, y: 93 },
        springLineY: 229,
        sillY: 509,
      },
      birdPerch: { x1: 1112, y1: 510, x2: 1394, y2: 510 },
    },
    fireplace: {
      outerBounds: { x: 0, y: 91, w: 535, h: 632 },
      mantelBounds: { x: 74, y: 348, w: 450, h: 34 },
      mantelContact: { x1: 92, y1: 355, x2: 514, y2: 355 },
      hearthBounds: { x: 169, y: 431, w: 286, h: 239 },
      fireBedBounds: { x: 208, y: 596, w: 211, h: 67 },
      flameAnchor: { x: 313, y: 651 },
    },
    bench: {
      bounds: { x: 949, y: 493, w: 496, h: 150 },
      cushionContact: { x1: 986, y1: 585, x2: 1416, y2: 585 },
    },
    floor: {
      bounds: { x: 0, y: 590, w: 1536, h: 274 },
      backContactY: 615,
      centerContactY: 850,
      foregroundContactY: 838,
    },
    tableSurface: {
      // Available only while surface-crate is equipped.
      quad: [
        { x: 1134, y: 637 },
        { x: 1416, y: 637 },
        { x: 1394, y: 701 },
        { x: 1154, y: 701 },
      ],
      center: { x: 1275, y: 665 },
    },
  };

  const ITEMS = {
    'wall-map': {
      id: 'wall-map',
      slot: 'wall',
      file: '/art/den/v3/furniture/wall-map.png',
      naturalSize: { w: 1024, h: 688 },
      x: 545.28,
      y: 151.2,
      w: 391.68,
      h: 263.16,
      z: 2,
      pivot: { x: 0.5, y: 0.15, role: 'wall-hanger-center' },
      plane: 'back-wall',
      anchors: [
        { role: 'hook-left', x: 623.62, y: 151.2 },
        { role: 'hook-right', x: 858.62, y: 151.2 },
      ],
      transform: 'perspective(1600px) rotateY(-0.8deg) rotateZ(-0.12deg)',
      motion: { target: 'whole', kind: 'micro-drift', maxTranslateY: 1, maxRotateDeg: 0.2 },
    },
    'seat-cushion': {
      id: 'seat-cushion',
      slot: 'seat',
      file: '/art/den/v3/furniture/seat-cushion.png',
      naturalSize: { w: 1024, h: 199 },
      x: 986.11,
      y: 505.44,
      w: 430.08,
      h: 83.58,
      z: 4,
      pivot: { x: 0.5, y: 0.85, role: 'bench-contact' },
      plane: 'bench-seat',
      anchors: [
        { role: 'contact-left', x: 1001, y: 585 },
        { role: 'contact-right', x: 1401, y: 585 },
      ],
      transform: null,
      perspectiveBaked: true,
      motion: { target: 'fabric-only', kind: 'breathe', maxScaleY: 0.015 },
    },
    'surface-crate': {
      id: 'surface-crate',
      slot: 'surface',
      file: '/art/den/v3/furniture/surface-crate.png',
      naturalSize: { w: 1024, h: 704 },
      alphaBounds: { x: 32, y: 44, w: 960, h: 636 },
      x: 1121.28,
      y: 626.88,
      w: 307.2,
      h: 211.2,
      z: 4,
      pivot: { x: 0.5, y: 1, role: 'floor-contact' },
      plane: 'floor-foreground-right',
      anchors: [
        { role: 'foot-left', x: 1152, y: 831 },
        { role: 'foot-right', x: 1398, y: 831 },
        { role: 'surface-center', x: 1275, y: 665 },
      ],
      transform: null,
      perspectiveBaked: true,
      motion: { target: 'whole', kind: 'still' },
    },
    'comfort-bonsai': {
      id: 'comfort-bonsai',
      slot: 'comfort',
      file: '/art/den/v3/furniture/comfort-bonsai.png',
      naturalSize: { w: 848, h: 1024 },
      alphaBounds: { x: 35, y: 40, w: 778, h: 960 },
      x: 166,
      y: 199.23,
      w: 132.1,
      h: 159.51,
      z: 4,
      pivot: { x: 0.5, y: 0.9766, role: 'pot-contact' },
      plane: 'fireplace-mantel',
      anchors: [
        { role: 'pot-contact', x: 232.05, y: 355 },
      ],
      transform: null,
      perspectiveBaked: true,
      // The current raster is flattened. Never rotate the whole pot to fake leaves.
      motion: { target: 'none-until-foliage-split', kind: 'still' },
    },
    'light-lantern': {
      id: 'light-lantern',
      slot: 'light',
      file: '/art/den/v3/furniture/light-lantern.png',
      naturalSize: { w: 369, h: 1024 },
      x: 414.72,
      y: 56.16,
      w: 115.2,
      h: 319.69,
      z: 4,
      pivot: { x: 0.5, y: 0, role: 'ceiling-attachment-ring' },
      plane: 'ceiling-hanging',
      anchors: [
        { role: 'ceiling-attachment', x: 472.32, y: 56.16 },
      ],
      transform: 'rotate(-0.25deg)',
      motion: { target: 'whole', kind: 'pendulum', maxRotateDeg: 1.5 },
    },
    'keepsake-blades': {
      id: 'keepsake-blades',
      slot: 'keepsake',
      file: '/art/den/v3/furniture/keepsake-blades.png',
      naturalSize: { w: 640, h: 1024 },
      alphaBounds: { x: 37, y: 40, w: 565, h: 960 },
      x: 1336.32,
      y: 388.99,
      w: 199.68,
      h: 319.49,
      z: 4,
      pivot: { x: 0.5, y: 0.9766, role: 'rack-feet' },
      plane: 'floor-right-wall',
      anchors: [
        { role: 'foot-left', x: 1371, y: 701 },
        { role: 'foot-right', x: 1500, y: 701 },
      ],
      transform: null,
      perspectiveBaked: true,
      motion: { target: 'metal-highlights-only', kind: 'glint' },
    },
    'floor-traveller': {
      id: 'floor-traveller',
      slot: 'floor',
      file: '/art/den/v3/furniture/floor-traveller.png',
      naturalSize: { w: 1024, h: 445 },
      x: 476.16,
      y: 620.72,
      w: 583.68,
      h: 253.65,
      z: 1,
      pivot: { x: 0.5, y: 1, role: 'floor-plane' },
      plane: 'floor-center',
      anchors: [
        { role: 'center', x: 768, y: 747.55 },
        { role: 'foreground-contact', x: 768, y: 864 },
      ],
      transform: null,
      perspectiveBaked: true,
      runtimeScaleY: 1,
      motion: { target: 'whole', kind: 'still' },
    },
  };

  const ACTORS = {
    avatar: {
      id: 'avatar',
      x: 588,
      y: 332,
      w: 360,
      h: 540,
      z: 7,
      pivot: { x: 0.5, y: 1, role: 'feet-center' },
      plane: 'floor-center',
      anchors: [{ role: 'feet-center', x: 768, y: 850 }],
    },
    shadow: {
      id: 'shadow',
      x: 1063,
      y: 226,
      w: 174,
      h: 219,
      z: 6,
      pivot: { x: 0.5, y: 0.78, role: 'float-center' },
      plane: 'air-window-side',
      anchors: [{ role: 'float-center', x: 1150, y: 397 }],
    },
    pets: [
      {
        id: 'pet-left',
        x: 356,
        y: 748,
        w: 104,
        h: 104,
        z: 8,
        pivot: { x: 0.5, y: 1, role: 'feet-center' },
        plane: 'floor-left',
        anchors: [{ role: 'feet-center', x: 408, y: 850 }],
      },
      {
        id: 'pet-right-near',
        x: 963,
        y: 756,
        w: 94,
        h: 94,
        z: 8,
        pivot: { x: 0.5, y: 1, role: 'feet-center' },
        plane: 'floor-center-right',
        anchors: [{ role: 'feet-center', x: 1010, y: 850 }],
      },
      {
        id: 'pet-right-far',
        x: 1044,
        y: 763,
        w: 86,
        h: 86,
        z: 8,
        pivot: { x: 0.5, y: 1, role: 'feet-center' },
        plane: 'floor-right',
        anchors: [{ role: 'feet-center', x: 1087, y: 849 }],
      },
    ],
  };

  const PHASES = {
    morning: { id: 'morning', startHour: 6, endHour: 11 },
    day: { id: 'day', startHour: 11, endHour: 17 },
    sunset: { id: 'sunset', startHour: 17, endHour: 20 },
    night: { id: 'night', startHour: 20, endHour: 6 },
  };
  const LOCAL_BOUNDARY_HOURS = [6, 11, 17, 20];

  function localDate(value) {
    const date = value == null
      ? new Date()
      : value instanceof Date
        ? new Date(value.getTime())
        : new Date(value);
    if (Number.isNaN(date.getTime())) throw new TypeError('DenSceneV4: invalid date');
    return date;
  }

  function phaseAt(value) {
    const hour = localDate(value).getHours();
    if (hour >= 6 && hour < 11) return PHASES.morning;
    if (hour >= 11 && hour < 17) return PHASES.day;
    if (hour >= 17 && hour < 20) return PHASES.sunset;
    return PHASES.night;
  }

  function nextBoundaryAt(value) {
    const now = localDate(value);
    for (const hour of LOCAL_BOUNDARY_HOURS) {
      const candidate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour,
        0,
        0,
        0,
      );
      if (candidate.getTime() > now.getTime()) return candidate;
    }
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      LOCAL_BOUNDARY_HOURS[0],
      0,
      0,
      0,
    );
  }

  function millisecondsToNextBoundary(value) {
    const now = localDate(value);
    return nextBoundaryAt(now).getTime() - now.getTime();
  }

  function item(id) {
    return ITEMS[id] || null;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  global.DenSceneV4 = deepFreeze({
    version: '2026.07.30.1',
    world: WORLD,
    regions: REGIONS,
    items: ITEMS,
    actors: ACTORS,
    phases: PHASES,
    localBoundaryHours: LOCAL_BOUNDARY_HOURS,
    item,
    phaseAt,
    nextBoundaryAt,
    millisecondsToNextBoundary,
  });
})(window);
