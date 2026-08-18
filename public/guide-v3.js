/* Satoru Guide v3 — pure state, registry and event contracts.
 *
 * This module deliberately knows nothing about DOM, State, Store or copy. The UI adapts
 * real application events into `reduce()`, and only commits the returned guide state after
 * the underlying user action has actually persisted. This prevents the tutorial from
 * granting progress for a demo click or from mutating tasks/goals itself.
 */
(function exposeGuideV3(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuideV3 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuideV3() {
  'use strict';

  const VERSION = 3;
  const FIRST_CHAPTER = 'first-journey';
  const FIRST_STEPS = Object.freeze([
    'welcome', 'recognize', 'choose', 'start', 'wait',
    'victory', 'mastery', 'bond', 'release',
  ]);
  const FORMS = Object.freeze(['spark', 'spirit', 'guardian', 'keeper']);

  function uniqStrings(value) {
    const out = [], seen = new Set();
    for (const item of Array.isArray(value) ? value : []) {
      if (typeof item !== 'string' || !item || seen.has(item)) continue;
      seen.add(item); out.push(item);
    }
    return out;
  }

  function cleanNullableString(value) {
    return typeof value === 'string' && value ? value : null;
  }

  function defaultState() {
    return {
      version: VERSION,
      enabled: true,
      currentChapter: null,
      currentStep: null,
      completedSteps: [],
      completedChapters: [],
      skippedChapters: [],
      seenPrompts: [],
      snoozedUntil: null,
      lastPromptAt: null,
      firstRunForm: 'spark',
      voiceConsent: null,
      questionnaireVersion: null,
      selectedTaskId: null,
      waitingFor: null,
      chapterMeta: {},
    };
  }

  function normalize(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = defaultState();
    out.enabled = src.enabled !== false;
    out.currentChapter = cleanNullableString(src.currentChapter);
    out.currentStep = cleanNullableString(src.currentStep);
    out.completedSteps = uniqStrings(src.completedSteps);
    out.completedChapters = uniqStrings(src.completedChapters);
    out.skippedChapters = uniqStrings(src.skippedChapters);
    out.seenPrompts = uniqStrings(src.seenPrompts);
    out.snoozedUntil = Number.isFinite(Number(src.snoozedUntil)) && Number(src.snoozedUntil) > 0
      ? Number(src.snoozedUntil) : null;
    out.lastPromptAt = Number.isFinite(Number(src.lastPromptAt)) && Number(src.lastPromptAt) > 0
      ? Number(src.lastPromptAt) : null;
    out.firstRunForm = FORMS.includes(src.firstRunForm) ? src.firstRunForm : 'spark';
    out.voiceConsent = typeof src.voiceConsent === 'boolean' ? src.voiceConsent : null;
    out.questionnaireVersion = Number.isFinite(Number(src.questionnaireVersion))
      ? Number(src.questionnaireVersion) : null;
    out.selectedTaskId = cleanNullableString(src.selectedTaskId);
    out.waitingFor = cleanNullableString(src.waitingFor);
    out.chapterMeta = src.chapterMeta && typeof src.chapterMeta === 'object' && !Array.isArray(src.chapterMeta)
      ? structuredClone(src.chapterMeta) : {};

    // A chapter cannot be both actively running and already resolved. Corrupt legacy state
    // is made safe in memory; startup never writes until the caller explicitly persists it.
    const activeReplay = out.currentChapter && out.chapterMeta[out.currentChapter] && out.chapterMeta[out.currentChapter].replay === true;
    if (out.currentChapter && chapterResolved(out, out.currentChapter) && !activeReplay) {
      out.currentChapter = null; out.currentStep = null; out.waitingFor = null;
    }
    if (!out.currentChapter) { out.currentStep = null; out.waitingFor = null; }
    return out;
  }

  function migrate(rawGuide, legacyTutorial) {
    if (rawGuide && Number(rawGuide.version) === VERSION) return normalize(rawGuide);
    const out = normalize(rawGuide);
    const legacy = legacyTutorial && typeof legacyTutorial === 'object' ? legacyTutorial : {};
    const seenDrips = uniqStrings(legacy.seenDrips).map((id) => `legacy:${id}`);
    out.seenPrompts = uniqStrings([...out.seenPrompts, ...seenDrips]);

    if (legacy.done) {
      out.completedSteps = uniqStrings([...out.completedSteps, ...FIRST_STEPS.map((id) => `${FIRST_CHAPTER}:${id}`)]);
      out.completedChapters = uniqStrings([...out.completedChapters, FIRST_CHAPTER]);
      out.chapterMeta[FIRST_CHAPTER] = { ...(out.chapterMeta[FIRST_CHAPTER] || {}), migrated: 'done' };
    } else if (legacy.skipped) {
      out.skippedChapters = uniqStrings([...out.skippedChapters, FIRST_CHAPTER]);
      out.chapterMeta[FIRST_CHAPTER] = { ...(out.chapterMeta[FIRST_CHAPTER] || {}), migrated: 'skipped' };
    } else if (legacy.active && legacy.mode !== 'drip') {
      out.currentChapter = FIRST_CHAPTER;
      out.currentStep = FIRST_STEPS[Math.max(0, Math.min(FIRST_STEPS.length - 1, Number(legacy.i) || 0))];
    }
    out.version = VERSION;
    return normalize(out);
  }

  function chapterResolved(state, chapter) {
    const s = state || {};
    return (s.completedChapters || []).includes(chapter) || (s.skippedChapters || []).includes(chapter);
  }

  function stepKey(chapter, step) { return `${chapter}:${step}`; }

  function guideSeed(input) {
    const src = input || {}, today = typeof src.today === 'string' ? src.today : '';
    const tasks = (Array.isArray(src.tasks) ? src.tasks : []).filter((task) => task && !task.done);
    const dated = tasks.filter((task) => !task.date || task.date === today);
    const ordered = (dated.length ? dated : tasks).slice().sort((a, b) => {
      const ac = String(a.createdAt || ''), bc = String(b.createdAt || '');
      if (ac !== bc) return ac < bc ? -1 : 1;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    const task = ordered[0] || null;
    const skills = Array.isArray(src.skills) ? src.skills : [];
    const goals = Array.isArray(src.goals) ? src.goals : [];
    if (task) {
      const skill = skills.find((item) => item && item.id === task.skillId) || null;
      const goal = goals.find((item) => item && item.id === task.goalId) || null;
      return {
        branch: 'task', taskId: String(task.id), taskTitle: String(task.title || ''),
        skillId: skill ? String(skill.id) : null, skillName: skill ? String(skill.name || '') : '',
        goalId: goal ? String(goal.id) : null, goalTitle: goal ? String(goal.title || '') : '',
      };
    }
    if (skills.length) {
      const skill = skills.find((item) => item && !item.parentId) || skills.find(Boolean);
      return { branch: 'sphere', taskId: null, taskTitle: '', skillId: String(skill.id), skillName: String(skill.name || ''), goalId: null, goalTitle: '' };
    }
    return { branch: 'blank', taskId: null, taskTitle: '', skillId: null, skillName: '', goalId: null, goalTitle: '' };
  }

  function registryEntry(entry) {
    return Object.freeze({
      version: 1, prerequisites: [], target: null, action: null, completion: null,
      pose: 'guide-close-speak', voiceContext: 'guide', rewardPolicy: 'none',
      cooldown: 0, once: true, replayPolicy: 'manual-no-reward', fallback: 'safe-bubble',
      ...entry,
    });
  }

  const REGISTRY = Object.freeze([
    registryEntry({ id: FIRST_CHAPTER, chapter: FIRST_CHAPTER, copyKey: 'guide.first', target: 'today', action: 'real-task-loop', completion: 'real-task-completed', pose: 'guide-arrive' }),
    registryEntry({ id: 'habits', chapter: 'habits', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.habits', target: 'habits', action: 'confirm-habit', completion: 'habit-persisted', cooldown: 86400000 }),
    registryEntry({ id: 'goals', chapter: 'goals', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.goals', target: 'goals', action: 'open-linked-goal', completion: 'goal-link-seen', cooldown: 86400000 }),
    registryEntry({ id: 'calendar', chapter: 'calendar', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.calendar', target: 'calendar', action: 'schedule-real-task', completion: 'task-date-persisted', cooldown: 86400000 }),
    registryEntry({ id: 'notes', chapter: 'notes', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.notes', target: 'notes', action: 'capture-real-note', completion: 'note-persisted', cooldown: 86400000 }),
    registryEntry({ id: 'voice', chapter: 'voice', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.voice', target: 'speaker', action: 'voice-consent', completion: 'voice-choice-persisted', cooldown: 86400000 }),
    registryEntry({ id: 'jarvis', chapter: 'jarvis', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.jarvis', target: 'helper', action: 'ask-one-question', completion: 'helper-response-seen', cooldown: 86400000 }),
    registryEntry({ id: 'rewards', chapter: 'rewards', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.rewards', target: 'rewards', action: 'buy-real-reward', completion: 'purchase-persisted', cooldown: 86400000 }),
    registryEntry({ id: 'hero', chapter: 'hero', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.hero', target: 'character', action: 'open-hero', completion: 'hero-seen', cooldown: 86400000 }),
    registryEntry({ id: 'den', chapter: 'den', prerequisites: ['hero'], copyKey: 'guide.den', target: 'den', action: 'open-den', completion: 'den-seen', cooldown: 86400000 }),
    registryEntry({ id: 'pets', chapter: 'pets', prerequisites: ['den'], copyKey: 'guide.pets', target: 'pets', action: 'open-pets', completion: 'pets-seen', cooldown: 86400000 }),
    registryEntry({ id: 'tree', chapter: 'tree', prerequisites: ['hero'], copyKey: 'guide.tree', target: 'tree', action: 'open-tree-with-point', completion: 'tree-seen', cooldown: 86400000 }),
    registryEntry({ id: 'stats', chapter: 'stats', prerequisites: ['hero'], copyKey: 'guide.stats', target: 'stats', action: 'open-stats', completion: 'stats-seen', cooldown: 86400000 }),
    registryEntry({ id: 'tribe', chapter: 'tribe', prerequisites: ['hero'], copyKey: 'guide.tribe', target: 'party', action: 'review-social-consent', completion: 'social-choice-made', cooldown: 86400000 }),
  ]);

  function prerequisitesMet(entry, state) {
    return entry.prerequisites.every((id) => chapterResolved(state, id));
  }

  function entryEligible(entry, state, context) {
    const s = normalize(state), c = context || {};
    if (!s.enabled || chapterResolved(s, entry.chapter) || !prerequisitesMet(entry, s)) return false;
    if (s.snoozedUntil && Number(c.now || Date.now()) < s.snoozedUntil) return false;
    switch (entry.id) {
      case FIRST_CHAPTER: return !!c.seedApplied && c.view === 'today';
      case 'habits': return Number(c.completedTasks) >= 2 || Number(c.activeDays) >= 2;
      case 'goals': return !!c.hasGoalSeed && !!c.returnedAfterFirst;
      case 'calendar': return Number(c.futureTasks) >= 3 || !!c.hasDeadline;
      case 'notes': return !!c.hasLooseNote || (Number(c.completedTasks) >= 4 && Number(c.inboxCount) === 0);
      case 'voice': return Number(c.level) >= 2 && !!c.ttsReady;
      case 'jarvis': return Number(c.level) >= 2 && !!c.aiReady;
      case 'rewards': return Number(c.gold) >= Number(c.rewardThreshold || 1);
      case 'hero': return Number(c.level) >= 3;
      case 'den': return Number(c.level) >= 3 && !!c.newSessionAfterHero;
      case 'pets': return Number(c.level) >= 3 && !!c.meaningfulSphereData;
      case 'tree': return Number(c.level) >= 3 && Number(c.treePoints) > 0;
      case 'stats': return Number(c.level) >= 3 && Number(c.dataDays) >= 7;
      case 'tribe': return Number(c.level) >= 3 && !!c.socialIntroAllowed;
      default: return false;
    }
  }

  function nextContextual(state, context, registry) {
    const list = Array.isArray(registry) ? registry : REGISTRY;
    const current = normalize(state);
    if (current.currentChapter) return null;
    return list.find((entry) => entry.id !== FIRST_CHAPTER && entryEligible(entry, current, context)) || null;
  }

  function accepted(state, metric, effects) {
    return { state: normalize(state), accepted: true, reason: null, metric: metric || null, effects: effects || [] };
  }
  function rejected(state, reason) {
    return { state: normalize(state), accepted: false, reason: reason || 'invalid-event', metric: null, effects: [] };
  }

  function reduce(rawState, event) {
    const state = normalize(rawState), ev = event && typeof event === 'object' ? event : {};
    const type = String(ev.type || '');
    if (!type) return rejected(state, 'missing-event');

    if (type === 'guide:disable') {
      state.enabled = false; state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
      return accepted(state, 'guide:disable');
    }
    if (type === 'guide:enable') { state.enabled = true; return accepted(state, 'guide:enable'); }
    if (type === 'guide:snooze') {
      const until = Number(ev.until); if (!Number.isFinite(until) || until <= Number(ev.now || 0)) return rejected(state, 'invalid-snooze');
      state.snoozedUntil = until; return accepted(state, 'guide:snooze');
    }
    if (type === 'guide:prompt-seen') {
      if (!ev.promptId) return rejected(state, 'missing-prompt');
      state.seenPrompts = uniqStrings([...state.seenPrompts, String(ev.promptId)]);
      state.lastPromptAt = Number(ev.at) || state.lastPromptAt;
      return accepted(state, 'guide:step_view');
    }
    if (type === 'guide:replay') {
      const chapter = String(ev.chapter || FIRST_CHAPTER);
      state.enabled = true; state.currentChapter = chapter;
      state.currentStep = chapter === FIRST_CHAPTER ? FIRST_STEPS[0] : 'intro';
      state.waitingFor = null; state.snoozedUntil = null;
      state.chapterMeta[chapter] = { ...(state.chapterMeta[chapter] || {}), replay: true };
      return accepted(state, 'guide:replay');
    }
    if (type === 'guide:start') {
      const chapter = String(ev.chapter || FIRST_CHAPTER);
      if (!state.enabled) return rejected(state, 'disabled');
      if (chapterResolved(state, chapter) && !ev.replay) return rejected(state, 'chapter-resolved');
      state.currentChapter = chapter;
      state.currentStep = chapter === FIRST_CHAPTER ? FIRST_STEPS[0] : 'intro';
      state.waitingFor = null; state.snoozedUntil = null;
      return accepted(state, 'guide:start');
    }
    if (type === 'guide:skip') {
      const chapter = String(ev.chapter || state.currentChapter || ''); if (!chapter) return rejected(state, 'missing-chapter');
      state.skippedChapters = uniqStrings([...state.skippedChapters, chapter]);
      state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
      state.chapterMeta[chapter] = { ...(state.chapterMeta[chapter] || {}), skippedAt: Number(ev.at) || null };
      return accepted(state, 'guide:skip');
    }

    if (state.currentChapter !== FIRST_CHAPTER) return rejected(state, 'first-journey-not-active');
    const step = state.currentStep;
    if (type === 'guide:next') {
      const next = { welcome: 'recognize', recognize: 'choose', victory: 'mastery', mastery: 'bond' }[step];
      if (!next) return rejected(state, 'next-not-allowed');
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.currentStep = next;
      return accepted(state, 'guide:action');
    }
    if (type === 'guide:select-task') {
      if (step !== 'choose') return rejected(state, 'wrong-step');
      if (!ev.persisted) return rejected(state, 'not-persisted');
      if (!ev.taskId) return rejected(state, 'missing-task');
      state.selectedTaskId = String(ev.taskId);
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.currentStep = 'start';
      return accepted(state, 'guide:first_step_selected');
    }
    if (type === 'guide:started') {
      if (step !== 'start') return rejected(state, 'wrong-step');
      if (ev.focus && !ev.persisted) return rejected(state, 'not-persisted');
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.currentStep = 'wait'; state.waitingFor = 'task:completed';
      return accepted(state, ev.focus ? 'guide:first_focus_started' : 'guide:action');
    }
    if (type === 'task:completed') {
      if (step !== 'wait' || state.waitingFor !== 'task:completed') return rejected(state, 'not-waiting');
      if (!ev.persisted) return rejected(state, 'not-persisted');
      if (!state.selectedTaskId || String(ev.taskId || '') !== state.selectedTaskId) return rejected(state, 'different-task');
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.currentStep = 'victory'; state.waitingFor = null;
      return accepted(state, 'guide:first_real_completion');
    }
    if (type === 'guide:bond') {
      if (step !== 'bond') return rejected(state, 'wrong-step');
      if (!ev.persisted) return rejected(state, 'not-persisted');
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.currentStep = 'release';
      return accepted(state, 'guide:action');
    }
    if (type === 'guide:finish') {
      if (step !== 'release') return rejected(state, 'wrong-step');
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.completedChapters = uniqStrings([...state.completedChapters, FIRST_CHAPTER]);
      state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
      state.chapterMeta[FIRST_CHAPTER] = { ...(state.chapterMeta[FIRST_CHAPTER] || {}), completedAt: Number(ev.at) || null, replay: false };
      return accepted(state, 'guide:chapter_complete');
    }
    return rejected(state, 'unsupported-event');
  }

  return {
    VERSION, FIRST_CHAPTER, FIRST_STEPS, FORMS, REGISTRY,
    defaultState, normalize, migrate, chapterResolved, guideSeed,
    prerequisitesMet, entryEligible, nextContextual, reduce,
  };
});
