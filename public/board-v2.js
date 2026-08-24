/* Satoru Board v2 — concrete quest resolver (dormant foundation).
 *
 * A Board v2 template is not user-facing copy by itself. It becomes a quest
 * only after every required local/profile slot has been resolved. There is no
 * vague fallback: if we cannot name the class, place, time or action, the
 * contract stays off the board.
 *
 * Pure module: no DOM, State, fetch, geolocation or persistence.
 */
(function exposeBoardV2(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2() {
  'use strict';

  const VERSION = '2.0.0';
  const TEMPLATE_SCHEMA = 'satoru.board-template/2';
  const MEMORY_SCHEMA = 'satoru.board-outcome-memory/1';
  const KINDS = Object.freeze(['experience', 'challenge', 'social', 'creation', 'expedition', 'recovery']);
  const SCALES = Object.freeze(['micro', 'session', 'expedition', 'arc']);
  const SLOT_TYPES = Object.freeze(['local-place', 'local-event', 'local-class', 'person', 'recipe', 'content', 'custom']);
  const PROOF_MODES = Object.freeze(['photo', 'video', 'result', 'checkin', 'story', 'reflection', 'none']);
  const OUTCOMES = Object.freeze(['helped', 'neutral', 'did-not-help']);
  const compiledTemplates = new WeakSet();
  const resolvedQuests = new WeakSet();

  const FORBIDDEN_COPY = Object.freeze([
    ['physical-artifact', /физическ[а-яё]*\s+артефакт/i],
    ['automatic-sweetener', /не\s+на\s+автомат/i],
    ['compare-feelings', /сравни\s+ощущени/i],
    ['academic-feed', /алгоритмическ[а-яё]*\s+лент/i],
    ['map-point', /точк[а-яё]*\s+на\s+карт/i],
    ['summit-timer', /проведи\s+там\s+[^\s]*\s*(минут|час)/i],
    ['write-result', /запиши\s+результат/i],
  ]);

  class BoardV2Error extends Error {
    constructor(code, detail) {
      super(detail ? `${code}: ${detail}` : code);
      this.name = 'BoardV2Error';
      this.code = code;
      if (detail) this.detail = detail;
    }
  }

  function plain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && out.length <= max ? out : '';
  }
  function uniqueStrings(value, allowed) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      const clean = text(item, 64);
      if (!clean || (allowed && !allowed.includes(clean)) || out.includes(clean)) continue;
      out.push(clean);
    }
    return out;
  }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }

  function lintCopy(value) {
    const source = String(value || '');
    const issues = [];
    for (const [id, pattern] of FORBIDDEN_COPY) if (pattern.test(source)) issues.push(id);
    return issues;
  }

  function rewardFor(scale) {
    if (scale === 'micro') return { tier: 1, xp: 30, titleEligible: false };
    if (scale === 'session') return { tier: 2, xp: 80, titleEligible: false };
    if (scale === 'expedition') return { tier: 3, xp: 220, titleEligible: true };
    if (scale === 'arc') return { tier: 4, xp: 500, titleEligible: true };
    throw new BoardV2Error('invalid-scale');
  }

  function compileTemplate(raw) {
    if (!plain(raw) || raw.schema !== TEMPLATE_SCHEMA) throw new BoardV2Error('invalid-schema');
    const id = text(raw.id, 80);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new BoardV2Error('invalid-id');
    const kind = text(raw.kind, 32), scale = text(raw.scale, 32);
    if (kind === 'routine') throw new BoardV2Error('routine-not-a-board-quest');
    if (!KINDS.includes(kind)) throw new BoardV2Error('invalid-kind');
    if (!SCALES.includes(scale)) throw new BoardV2Error('invalid-scale');

    const copy = plain(raw.copy) ? raw.copy : {};
    const title = text(copy.title, 180), details = text(copy.details, 360);
    if (!title) throw new BoardV2Error('missing-title');
    const copyIssues = lintCopy(`${title}\n${details}`);
    if (copyIssues.length) throw new BoardV2Error('copy-contract', copyIssues.join(','));

    const slotIds = new Set();
    const slots = (Array.isArray(raw.slots) ? raw.slots : []).map((slot) => {
      if (!plain(slot)) throw new BoardV2Error('invalid-slot');
      const slotId = text(slot.id, 48), type = text(slot.type, 32);
      if (!/^[a-z][a-z0-9-]*$/.test(slotId) || slotIds.has(slotId)) throw new BoardV2Error('invalid-slot-id');
      if (!SLOT_TYPES.includes(type)) throw new BoardV2Error('invalid-slot-type');
      slotIds.add(slotId);
      return { id: slotId, type, required: slot.required !== false };
    });
    const placeholders = [...`${title}\n${details}`.matchAll(/\{([a-z][a-z0-9-]*)\}/g)].map((m) => m[1]);
    for (const placeholder of placeholders) if (!slotIds.has(placeholder)) throw new BoardV2Error('unknown-placeholder', placeholder);

    const completion = plain(raw.completion) ? raw.completion : {};
    const proofModes = uniqueStrings(completion.proofModes, PROOF_MODES);
    if (!proofModes.length) throw new BoardV2Error('missing-proof-mode');
    const share = completion.share == null ? 'optional' : text(completion.share, 16);
    if (!['none', 'optional'].includes(share)) throw new BoardV2Error('sharing-must-be-optional');

    let followUp = null;
    if (raw.followUp != null) {
      if (!plain(raw.followUp)) throw new BoardV2Error('invalid-follow-up');
      const interventionId = text(raw.followUp.interventionId, 80);
      const question = text(raw.followUp.question, 220);
      const contextTags = uniqueStrings(raw.followUp.contextTags);
      if (!interventionId || !question || !contextTags.length) throw new BoardV2Error('invalid-follow-up');
      followUp = { interventionId, question, contextTags };
    }

    const baseReward = rewardFor(scale);
    const reward = Object.assign({}, baseReward);
    const titleReward = text(raw.reward && raw.reward.title, 80);
    if (titleReward && !baseReward.titleEligible) throw new BoardV2Error('title-requires-large-quest');
    if (titleReward) reward.title = titleReward;

    const compiled = {
      schema: TEMPLATE_SCHEMA,
      id,
      revision: Math.max(1, Math.floor(Number(raw.revision) || 1)),
      kind,
      scale,
      tags: uniqueStrings(raw.tags),
      interests: uniqueStrings(raw.interests),
      slots,
      copy: { title, details },
      completion: { proofModes, proofRequired: completion.proofRequired === true, share },
      followUp,
      reward,
    };
    deepFreeze(compiled);
    compiledTemplates.add(compiled);
    return compiled;
  }

  function slotLabel(value) {
    if (typeof value === 'string') return text(value, 160);
    if (!plain(value)) return '';
    return text(value.label, 160) || text(value.name, 160) || text(value.title, 160);
  }
  function safeHttps(value) {
    const source = text(value, 500);
    if (!source) return false;
    try {
      const url = new URL(source);
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  function concreteStart(value) {
    const source = text(value, 80);
    if (!source) return false;
    const timestamp = Date.parse(source);
    return Number.isFinite(timestamp) && /[T ]\d{2}:\d{2}/.test(source);
  }
  function validLocalResolution(value, type) {
    if (!['local-place', 'local-event', 'local-class'].includes(type)) return !!slotLabel(value);
    if (!plain(value) || !slotLabel(value)) return false;
    const hasWhere = !!(text(value.address, 220) || safeHttps(value.url));
    const hasWhen = concreteStart(value.startsAt);
    if (type === 'local-class' || type === 'local-event') return hasWhere && hasWhen;
    return hasWhere;
  }
  function cleanSlotResolution(value) {
    if (typeof value === 'string') return text(value, 160);
    if (!plain(value)) return null;
    const out = {};
    for (const key of ['label', 'name', 'title', 'address', 'startsAt', 'price', 'sourceId', 'source']) {
      const clean = text(value[key], key === 'address' ? 220 : 160);
      if (clean) out[key] = clean;
    }
    if (safeHttps(value.url)) out.url = text(value.url, 500);
    for (const key of ['distanceKm', 'communityScore']) {
      const number = Number(value[key]);
      if (Number.isFinite(number)) out[key] = number;
    }
    return out;
  }
  function renderCopy(source, values) {
    return source.replace(/\{([a-z][a-z0-9-]*)\}/g, (_, id) => slotLabel(values[id]));
  }

  function instantiate(template, resolution) {
    if (!compiledTemplates.has(template)) return { ok: false, error: 'uncompiled-template' };
    const source = plain(resolution) ? resolution : {};
    const suppliedValues = plain(source.slots) ? source.slots : {};
    const values = {};
    for (const slot of template.slots) {
      const value = cleanSlotResolution(suppliedValues[slot.id]);
      values[slot.id] = value;
      if (slot.required && !validLocalResolution(value, slot.type)) {
        return { ok: false, error: 'unresolved-slot', slot: slot.id };
      }
    }
    const title = renderCopy(template.copy.title, values);
    const details = renderCopy(template.copy.details, values);
    if (/\{[a-z][a-z0-9-]*\}/.test(`${title}\n${details}`)) return { ok: false, error: 'unresolved-copy' };
    const issues = lintCopy(`${title}\n${details}`);
    if (issues.length) return { ok: false, error: 'copy-contract', issues };

    const primaryAction = plain(source.primaryAction) ? source.primaryAction : {};
    const actionLabel = text(primaryAction.label, 80);
    const actionUrl = text(primaryAction.url, 500);
    if (template.slots.some((slot) => slot.type.startsWith('local-')) && (!actionLabel || !safeHttps(actionUrl))) {
      return { ok: false, error: 'missing-primary-action' };
    }
    const alternatives = (Array.isArray(source.alternatives) ? source.alternatives : [])
      .map(cleanSlotResolution)
      .filter(Boolean);
    if (alternatives.length > 1) return { ok: false, error: 'choice-overload' };
    if (alternatives.length && (!slotLabel(alternatives[0]) || !safeHttps(alternatives[0].url))) {
      return { ok: false, error: 'invalid-alternative' };
    }

    const instance = deepFreeze({
      schema: 'satoru.board-quest/2',
      id: `${template.id}@${template.revision}`,
      templateId: template.id,
      kind: template.kind,
      scale: template.scale,
      tags: template.tags.slice(),
      title,
      details,
      resolvedSlots: Object.fromEntries(template.slots.map((slot) => [slot.id, values[slot.id] || null])),
      primaryAction: actionLabel ? { label: actionLabel, url: actionUrl } : null,
      alternative: alternatives[0] || null,
      completion: template.completion,
      followUp: template.followUp,
      reward: template.reward,
      fit: plain(source.fit) ? {
        interest: Number(source.fit.interest) || 0,
        distanceKm: Number.isFinite(Number(source.fit.distanceKm)) ? Math.max(0, Number(source.fit.distanceKm)) : null,
        confidence: Math.max(0, Math.min(1, Number(source.fit.confidence) || 0)),
      } : { interest: 0, distanceKm: null, confidence: 0 },
    });
    resolvedQuests.add(instance);
    return { ok: true, quest: instance };
  }

  function questScore(quest, profile) {
    if (!resolvedQuests.has(quest)) return -Infinity;
    const p = plain(profile) ? profile : {};
    const likes = new Set(uniqueStrings(p.interests));
    const avoids = new Set(uniqueStrings(p.avoidTags));
    let score = quest.fit.confidence * 5 + quest.fit.interest * 3;
    for (const tag of quest.tags) {
      if (likes.has(tag)) score += 2;
      if (avoids.has(tag)) score -= 6;
    }
    if (quest.fit.distanceKm != null) score -= Math.min(4, quest.fit.distanceKm / 10);
    return score;
  }

  function select(instances, profile, options) {
    const opts = plain(options) ? options : {};
    const hidden = new Set(uniqueStrings(opts.hiddenTemplateIds));
    const ranked = (Array.isArray(instances) ? instances : [])
      .filter((quest) => resolvedQuests.has(quest) && !hidden.has(quest.templateId))
      .slice()
      .sort((a, b) => {
        const delta = questScore(b, profile) - questScore(a, profile);
        return Math.abs(delta) > 1e-9 ? delta : a.id.localeCompare(b.id);
      });
    const primary = ranked[0] || null;
    const reserveLimit = Math.min(2, Math.max(0, Math.floor(Number(opts.reserveLimit) || 0)));
    return { primary, reserves: ranked.slice(1, 1 + reserveLimit) };
  }

  function emptyMemory() {
    return { schema: MEMORY_SCHEMA, records: [] };
  }
  function normalizeMemory(raw) {
    const records = [];
    for (const record of plain(raw) && Array.isArray(raw.records) ? raw.records : []) {
      if (!plain(record) || !OUTCOMES.includes(record.outcome)) continue;
      const interventionId = text(record.interventionId, 80);
      const at = text(record.at, 10);
      const contextTags = uniqueStrings(record.contextTags);
      if (!interventionId || !/^\d{4}-\d{2}-\d{2}$/.test(at) || !contextTags.length) continue;
      records.push({ interventionId, outcome: record.outcome, contextTags, at });
    }
    return { schema: MEMORY_SCHEMA, records: records.slice(-100) };
  }
  function recordOutcome(memory, quest, outcome, today) {
    const state = normalizeMemory(memory);
    if (!resolvedQuests.has(quest) || !quest.followUp) return state;
    if (!OUTCOMES.includes(outcome) || !/^\d{4}-\d{2}-\d{2}$/.test(String(today))) return state;
    const record = {
      interventionId: quest.followUp.interventionId,
      outcome,
      contextTags: quest.followUp.contextTags.slice(),
      at: String(today),
    };
    return { schema: MEMORY_SCHEMA, records: state.records.concat([record]).slice(-100) };
  }
  function knownHelp(memory, contextTags) {
    const wanted = new Set(uniqueStrings(contextTags));
    const scores = new Map();
    for (const record of normalizeMemory(memory).records) {
      const overlap = record.contextTags.filter((tag) => wanted.has(tag)).length;
      if (!overlap) continue;
      const value = record.outcome === 'helped' ? 2 : record.outcome === 'neutral' ? 0 : -2;
      scores.set(record.interventionId, (scores.get(record.interventionId) || 0) + value * overlap);
    }
    return [...scores.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([interventionId, score]) => ({ interventionId, score }));
  }

  return {
    VERSION,
    TEMPLATE_SCHEMA,
    MEMORY_SCHEMA,
    KINDS,
    SCALES,
    SLOT_TYPES,
    PROOF_MODES,
    OUTCOMES,
    BoardV2Error,
    lintCopy,
    rewardFor,
    compileTemplate,
    instantiate,
    questScore,
    select,
    emptyMemory,
    normalizeMemory,
    recordOutcome,
    knownHelp,
  };
});
