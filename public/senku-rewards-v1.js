/* Satoru Senku Rewards v1 — Senku sittings become completed quests (owner decision 01.10).
 *
 * What the owner decided:
 *  — a review in Senku is work like any quest and earns the ordinary quest reward;
 *  — by eye counts the same as by voice; every shown card counts (repeats included);
 *  — sessions before the connection are not rewarded (the server lists only later ones);
 *  — Senku decks belong to different spheres (Spanish, biology, philosophy …), so each deck
 *    goes to its own sphere: remembered choice → AI suggestion (only with consent) → names.
 *
 * Pure module: data in, data out. No DOM, State, fetch or XP formula here — the app computes
 * the reward with its ordinary itemXp/itemGold and saves through its ordinary task write.
 * One sitting is keyed by kind + start (`voice|2026-09-28T06:52:00.000Z`); every quest made from
 * it carries that key, so a repeated import never creates a second reward. A session closed by
 * Senku's 30-minute timeout can reopen and grow: the server then offers only the difference, and
 * its quests carry `key#1`, `key#2` … Time per deck comes from Senku's `deckMs` when every deck
 * of the sitting has it (records from before 01.10 do not): then by the share of cards.
 */
(function exposeSenkuRewards(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SenkuRewardsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSenkuRewards() {
  'use strict';

  const VERSION = '1.0.0';
  const KEY = /^(voice|visual)\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const CLAIM_KEY = /^(voice|visual)\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z(#\d{1,4})?$/;
  const MAX_AI_DECKS = 40;

  function norm(value) {
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function words(value) { return norm(value).split(' ').filter((word) => word.length >= 3 && /\p{L}/u.test(word)); }

  // Deck and folder names against sphere names: exact name, one inside the other, shared words.
  // Deeper spheres win ties ("Учёба › Испанский" before "Учёба"). Returns null when nothing fits.
  function guessByName(deck, spheres) {
    const texts = [deck && deck.name, ...((deck && deck.folder) || [])].map(norm).filter((text) => /\p{L}{3}/u.test(text));
    if (!texts.length) return null;
    let best = null; let bestScore = 0;
    for (const sphere of spheres || []) {
      const name = norm(sphere.name);
      if (name.length < 3) continue;
      let score = 0;
      for (const text of texts) {
        if (text === name) score = Math.max(score, 4);
        else if ((text.includes(name) && name.length >= 4) || (name.includes(text) && text.length >= 4)) score = Math.max(score, 3);
        else {
          const shared = words(text).filter((word) => words(name).includes(word)).length;
          if (shared) score = Math.max(score, 1 + shared);
        }
      }
      const ranked = score + Math.min(0.5, ((sphere.path && sphere.path.length) || 1) * 0.01);
      if (score >= 2 && ranked > bestScore) { best = sphere; bestScore = ranked; }
    }
    return best ? best.id : null;
  }

  // One sitting → one part per sphere, at least one minute each, so a mixed oral-exam run gives
  // Spanish and Biology each their own honest piece: Senku's time per deck when every deck has it,
  // otherwise the sitting's minutes by the share of cards.
  function splitSitting(sitting, sphereFor) {
    const decks = sitting.decks || [];
    const timed = decks.length > 0 && decks.every((deck) => Number.isInteger(deck.ms));
    const parts = new Map();
    for (const deck of decks) {
      const skillId = sphereFor(deck);
      if (!skillId) continue;
      const part = parts.get(skillId) || { skillId, cards: 0, ms: 0, names: [] };
      part.cards += deck.cards;
      if (timed) part.ms += deck.ms;
      if (deck.name && !part.names.includes(deck.name)) part.names.push(deck.name);
      parts.set(skillId, part);
    }
    const total = [...parts.values()].reduce((sum, part) => sum + part.cards, 0);
    return [...parts.values()].sort((a, b) => b.cards - a.cards).map((part) => Object.assign(part, {
      minutes: Math.max(1, timed ? Math.round(part.ms / 60000) : Math.round((Number(sitting.minutes) || 0) * part.cards / Math.max(1, total))),
    }));
  }

  // Sittings → quest drafts (without title and reward, which the app adds) + claims to send.
  // A sitting already present in the tasks (`existingKeys`) is only claimed again.
  function plan(sittings, options) {
    const { sphereFor, existingKeys, newId, dateOf, nowIso } = options;
    const drafts = []; const claims = [];
    for (const sitting of sittings || []) {
      if (!sitting || !KEY.test(sitting.key) || sitting.open || !sitting.endedAt) continue;
      const claimKey = typeof sitting.claimKey === 'string' ? sitting.claimKey : sitting.key;
      const seq = Number.isInteger(sitting.seq) ? sitting.seq : 0;
      if (!CLAIM_KEY.test(claimKey) || !claimKey.startsWith(sitting.key)) continue;
      claims.push({ key: sitting.key, seq, totals: sitting.totals || null });
      if (existingKeys && existingKeys.has(claimKey)) continue;
      for (const part of splitSitting(sitting, sphereFor)) {
        drafts.push({
          id: newId(), skillId: part.skillId, skillIds: [part.skillId],
          estimateMin: part.minutes, actualMin: part.minutes, difficulty: 'normal',
          date: dateOf(sitting.startedAt), done: true, completedAt: sitting.endedAt, startTime: null,
          createdAt: nowIso, source: 'senku', senkuKey: claimKey, senkuKind: sitting.kind,
          senkuCards: part.cards, senkuDecks: part.names.slice(0, 6),
        });
      }
    }
    return { drafts, claims };
  }

  // The AI only ever sees deck/folder names when the person allowed it (settings switch).
  function aiRequest(decks, spheres) {
    const deckLines = (decks || []).slice(0, MAX_AI_DECKS).map((deck) => JSON.stringify({ deck: deck.deck, name: deck.name || '', folder: deck.folder || [] }));
    const sphereLines = (spheres || []).map((sphere) => JSON.stringify({ id: sphere.id, path: sphere.path || [sphere.name] }));
    return {
      system: 'You assign flash-card decks to the life areas ("spheres") of one person. Use only the given sphere ids. '
        + 'Prefer the most specific sphere that fits the subject of the deck (language, science, philosophy …). '
        + 'If nothing fits, use null. Answer with JSON only: {"assign":[{"deck":"<deck id>","sphere":"<sphere id or null>"}]}',
      prompt: `SPHERES:\n${sphereLines.join('\n')}\n\nDECKS:\n${deckLines.join('\n')}`,
    };
  }

  function parseAi(text, deckIds, sphereIds) {
    const decks = new Set(deckIds || []); const spheres = new Set(sphereIds || []);
    const raw = String(text || '');
    const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return {};
    let json; try { json = JSON.parse(raw.slice(start, end + 1)); } catch { return {}; }
    const out = {};
    for (const row of Array.isArray(json && json.assign) ? json.assign : []) {
      if (row && decks.has(row.deck) && spheres.has(row.sphere)) out[row.deck] = row.sphere;
    }
    return out;
  }

  return Object.freeze({ VERSION, KEY, CLAIM_KEY, MAX_AI_DECKS, norm, guessByName, splitSitting, plan, aiRequest, parseAi });
});
