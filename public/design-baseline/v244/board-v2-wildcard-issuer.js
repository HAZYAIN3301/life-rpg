/* Satoru Board v2 — manual Wildcard issuer.
 *
 * A manual request is still not permission to show an unresolved idea. This
 * issuer accepts only reviewed, fully user-resolved packs and hands the
 * resulting quests to the shared pacing/snapshot engine. Pure module: no DOM,
 * clock, State, fetch, geolocation or persistence.
 */
(function exposeBoardV2WildcardIssuer(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2WildcardIssuer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2WildcardIssuer() {
  'use strict';

  const VERSION = '1.1.0';
  const SETUP_SCHEMA = 'satoru.board-wildcard-setup/3';
  const SUPPORTED_TEMPLATE_IDS = Object.freeze([
    'forty-eight-hour-film-challenge',
    'delete-social-apps-thirty-days',
    'rearrange-room-approved-layout',
    'minecraft-server-thirty-days',
    'make-favorite-character-cosplay',
    'run-three-session-mini-campaign',
  ]);
  const issued = new WeakMap();

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function cleanText(value, max) {
    const out = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (!out || out.length > max || /[\u0000-\u001f{}<>]/.test(out)) return '';
    return out;
  }
  function day(value) {
    const out = cleanText(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) return '';
    const parsed = new Date(`${out}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === out ? out : '';
  }
  function dateLabel(value) {
    const iso = day(value);
    if (!iso) return '';
    const [year, month, date] = iso.split('-').map(Number);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${date} ${months[month - 1]} ${year}`;
  }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function dependencies(boardApi, catalogApi, offersApi, pacingApi) {
    return !!(boardApi && typeof boardApi.compileTemplate === 'function' && typeof boardApi.instantiate === 'function'
      && catalogApi && Array.isArray(catalogApi.ENTRIES) && typeof catalogApi.compileCatalog === 'function'
      && offersApi && typeof offersApi.planUnexpected === 'function' && typeof offersApi.recordUnexpectedDisplayed === 'function'
      && pacingApi && typeof pacingApi.planUnexpected === 'function');
  }
  function normalizeSetup(raw) {
    const source = plain(raw) ? raw : {};
    const film = plain(source.film) && source.film.enabled === true ? {
      enabled: true,
      theme: cleanText(source.film.theme, 100),
      deadline: cleanText(source.film.deadline, 100),
      filmingOptIn: source.film.filmingOptIn === true,
    } : { enabled: false, theme: '', deadline: '', filmingOptIn: false };
    const offline = plain(source.offline) && source.offline.enabled === true ? {
      enabled: true, apps: cleanText(source.offline.apps, 120),
    } : { enabled: false, apps: '' };
    const room = plain(source.room) && source.room.enabled === true ? {
      enabled: true,
      room: cleanText(source.room.room, 80),
      goal: cleanText(source.room.goal, 120),
      layout: cleanText(source.room.layout, 160),
      equipmentReady: source.room.equipmentReady === true,
      safeContext: source.room.safeContext === true,
    } : { enabled: false, room: '', goal: '', layout: '', equipmentReady: false, safeContext: false };
    const minecraft = plain(source.minecraft) && source.minecraft.enabled === true ? {
      enabled: true,
      name: cleanText(source.minecraft.name, 80),
      players: cleanText(source.minecraft.players, 120),
      goal: cleanText(source.minecraft.goal, 160),
      socialReady: source.minecraft.socialReady === true,
    } : { enabled: false, name: '', players: '', goal: '', socialReady: false };
    const cosplay = plain(source.cosplay) && source.cosplay.enabled === true ? {
      enabled: true,
      character: cleanText(source.cosplay.character, 100),
      date: day(source.cosplay.date),
      piece: cleanText(source.cosplay.piece, 120),
      budgetConfirmed: source.cosplay.budgetConfirmed === true,
    } : { enabled: false, character: '', date: '', piece: '', budgetConfirmed: false };
    const dungeonMaster = plain(source.dungeonMaster) && source.dungeonMaster.enabled === true ? {
      enabled: true,
      game: cleanText(source.dungeonMaster.game, 100),
      players: cleanText(source.dungeonMaster.players, 120),
      module: cleanText(source.dungeonMaster.module, 160),
      socialReady: source.dungeonMaster.socialReady === true,
    } : { enabled: false, game: '', players: '', module: '', socialReady: false };
    return deepFreeze({ schema: SETUP_SCHEMA, film, offline, room, minecraft, cosplay, dungeonMaster });
  }
  function entryIndex(catalogApi, templateId) {
    return catalogApi.ENTRIES.findIndex((entry) => entry && entry.template && entry.template.id === templateId);
  }
  function buildInstance(boardApi, compiled, catalogApi, templateId, resolution) {
    const index = entryIndex(catalogApi, templateId);
    if (index < 0 || !compiled.templates[index]) return null;
    const built = boardApi.instantiate(compiled.templates[index], resolution);
    return built && built.ok ? built.quest : null;
  }
  function resolvedInstances(boardApi, catalogApi, rawSetup) {
    const setup = normalizeSetup(rawSetup);
    let compiled;
    try { compiled = catalogApi.compileCatalog(boardApi); } catch { return []; }
    const quests = [];
    if (setup.film.enabled && setup.film.filmingOptIn && setup.film.theme && setup.film.deadline) {
      const quest = buildInstance(boardApi, compiled, catalogApi, 'forty-eight-hour-film-challenge', {
        slots: { theme: setup.film.theme, deadline: setup.film.deadline },
        fit: { confidence: 1, interest: 0.5 },
      });
      if (quest) quests.push(quest);
    }
    if (setup.offline.enabled && setup.offline.apps) {
      const quest = buildInstance(boardApi, compiled, catalogApi, 'delete-social-apps-thirty-days', {
        slots: { apps: setup.offline.apps }, fit: { confidence: 1, interest: 0.5 },
      });
      if (quest) quests.push(quest);
    }
    if (setup.room.enabled && setup.room.room && setup.room.goal && setup.room.layout
      && setup.room.equipmentReady && setup.room.safeContext) {
      const quest = buildInstance(boardApi, compiled, catalogApi, 'rearrange-room-approved-layout', {
        slots: { room: setup.room.room, goal: setup.room.goal, layout: setup.room.layout },
        readinessFlags: ['equipment-ready'], fit: { confidence: 1, interest: 0.5 },
      });
      if (quest) quests.push(quest);
    }
    if (setup.minecraft.enabled && setup.minecraft.name && setup.minecraft.players
      && setup.minecraft.goal && setup.minecraft.socialReady) {
      const quest = buildInstance(boardApi, compiled, catalogApi, 'minecraft-server-thirty-days', {
        slots: { name: setup.minecraft.name, players: setup.minecraft.players, goal: setup.minecraft.goal },
        fit: { confidence: 1, interest: 0.5 },
      });
      if (quest) quests.push(quest);
    }
    if (setup.cosplay.enabled && setup.cosplay.character && setup.cosplay.date
      && setup.cosplay.piece && setup.cosplay.budgetConfirmed) {
      const quest = buildInstance(boardApi, compiled, catalogApi, 'make-favorite-character-cosplay', {
        slots: { character: setup.cosplay.character, date: dateLabel(setup.cosplay.date), piece: setup.cosplay.piece },
        readinessFlags: ['budget-confirmed'], fit: { confidence: 1, interest: 0.5 },
      });
      if (quest) quests.push(quest);
    }
    if (setup.dungeonMaster.enabled && setup.dungeonMaster.game && setup.dungeonMaster.players
      && setup.dungeonMaster.module && setup.dungeonMaster.socialReady) {
      const quest = buildInstance(boardApi, compiled, catalogApi, 'run-three-session-mini-campaign', {
        slots: { game: setup.dungeonMaster.game, players: setup.dungeonMaster.players, module: setup.dungeonMaster.module },
        fit: { confidence: 1, interest: 0.5 },
      });
      if (quest) quests.push(quest);
    }
    return quests;
  }
  function issueManual(boardApi, catalogApi, offersApi, pacingApi, rawProfile, rawState, rawSetup, context) {
    if (!dependencies(boardApi, catalogApi, offersApi, pacingApi)) return { ok: false, reason: 'dependencies-unavailable' };
    const source = plain(context) ? context : {}, currentDay = day(source.day);
    if (!currentDay) return { ok: false, reason: 'invalid-day' };
    const instances = resolvedInstances(boardApi, catalogApi, rawSetup);
    if (!instances.length) return { ok: false, reason: 'no-complete-option' };
    const planned = offersApi.planUnexpected(boardApi, pacingApi, instances, plain(rawProfile) ? rawProfile : {}, rawState, {
      mode: 'manual-unexpected', day: currentDay, seed: cleanText(source.seed, 160) || `manual:${currentDay}`,
    });
    if (!planned.ok) return planned;
    const nextOffers = offersApi.recordUnexpectedDisplayed(rawState, planned, pacingApi);
    const handle = deepFreeze({ ok: true, changed: true, primary: planned.snapshot, mode: 'manual-unexpected' });
    issued.set(handle, deepFreeze({ nextOffers, setup: normalizeSetup(rawSetup), candidateIds: instances.map((quest) => quest.templateId) }));
    return handle;
  }
  function result(handle) { return issued.get(handle) || null; }

  return deepFreeze({
    VERSION, SETUP_SCHEMA, SUPPORTED_TEMPLATE_IDS,
    normalizeSetup, resolvedInstances, issueManual, result,
  });
});
