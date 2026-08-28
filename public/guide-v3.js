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
  const HABITS_CHAPTER = 'habits';
  const FIRST_STEPS = Object.freeze([
    'welcome', 'recognize', 'choose', 'start', 'wait',
    'victory', 'mastery', 'bond', 'release',
  ]);
  const HABITS_STEPS = Object.freeze(['intro', 'compose', 'complete']);
  const FORMS = Object.freeze(['spark', 'spirit', 'guardian', 'keeper']);
  const CHAPTERS = Object.freeze([
    FIRST_CHAPTER, 'habits', 'goals', 'calendar', 'notes', 'voice', 'jarvis',
    'rewards', 'hero', 'den', 'pets', 'tree', 'stats', 'tribe',
  ]);
  const LEGACY_PROMPT_MAP = Object.freeze({
    d_habits: 'habits@1', d_den: 'den@1', d_tree: 'tree@1',
    d_rewards: 'rewards@1', d_stats: 'stats@1', d_helper: 'jarvis@1',
  });

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

  function positiveIntegerOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function cleanChapterMeta(value) {
    const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = {};
    for (const chapter of CHAPTERS) {
      const meta = src[chapter];
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;
      try { out[chapter] = structuredClone(meta); } catch { out[chapter] = {}; }
    }
    return out;
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
    const requestedChapter = cleanNullableString(src.currentChapter);
    out.currentChapter = CHAPTERS.includes(requestedChapter) ? requestedChapter : null;
    out.currentStep = cleanNullableString(src.currentStep);
    out.completedSteps = uniqStrings(src.completedSteps);
    out.completedChapters = uniqStrings(src.completedChapters).filter((id) => CHAPTERS.includes(id));
    out.skippedChapters = uniqStrings(src.skippedChapters)
      .filter((id) => CHAPTERS.includes(id) && !out.completedChapters.includes(id));
    out.seenPrompts = uniqStrings(src.seenPrompts);
    out.snoozedUntil = Number.isFinite(Number(src.snoozedUntil)) && Number(src.snoozedUntil) > 0
      ? Number(src.snoozedUntil) : null;
    out.lastPromptAt = Number.isFinite(Number(src.lastPromptAt)) && Number(src.lastPromptAt) > 0
      ? Number(src.lastPromptAt) : null;
    out.firstRunForm = FORMS.includes(src.firstRunForm) ? src.firstRunForm : 'spark';
    out.voiceConsent = typeof src.voiceConsent === 'boolean' ? src.voiceConsent : null;
    out.questionnaireVersion = positiveIntegerOrNull(src.questionnaireVersion);
    out.selectedTaskId = cleanNullableString(src.selectedTaskId);
    out.waitingFor = cleanNullableString(src.waitingFor);
    out.chapterMeta = cleanChapterMeta(src.chapterMeta);

    // A chapter cannot be both active and resolved unless this is an explicit presentation-only replay.
    const activeReplay = out.currentChapter && out.chapterMeta[out.currentChapter] && out.chapterMeta[out.currentChapter].replay === true;
    if (out.currentChapter && chapterResolved(out, out.currentChapter) && !activeReplay) {
      out.currentChapter = null; out.currentStep = null; out.waitingFor = null;
    }
    if (!out.currentChapter) {
      out.currentStep = null; out.waitingFor = null;
    } else if (out.currentChapter === FIRST_CHAPTER) {
      if (!FIRST_STEPS.includes(out.currentStep)) out.currentStep = 'welcome';
      if (!activeReplay && ['start', 'wait', 'victory', 'mastery', 'bond', 'release'].includes(out.currentStep) && !out.selectedTaskId) {
        out.currentStep = 'choose'; out.waitingFor = null;
      } else if (!activeReplay && out.currentStep === 'wait') out.waitingFor = 'task:completed';
      else out.waitingFor = null;
    } else if (out.currentChapter === HABITS_CHAPTER && !activeReplay) {
      if (!HABITS_STEPS.includes(out.currentStep)) out.currentStep = HABITS_STEPS[0];
      out.waitingFor = out.currentStep === 'compose' ? 'habit-persisted' : null;
    } else {
      out.currentStep = 'intro'; out.waitingFor = null;
    }
    return out;
  }

  function migrate(rawGuide, legacyTutorial) {
    if (rawGuide && Number(rawGuide.version) === VERSION) return normalize(rawGuide);
    const out = normalize(rawGuide);
    const legacy = legacyTutorial && typeof legacyTutorial === 'object' ? legacyTutorial : {};
    const seenDrips = uniqStrings(legacy.seenDrips).map((id) => LEGACY_PROMPT_MAP[id] || `legacy:${id}`);
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
      // The five legacy positions describe a different tour. Mapping their index into the
      // nine-step real-action journey can strand a user in `wait` without a selected task.
      out.currentStep = 'welcome'; out.selectedTaskId = null; out.waitingFor = null;
      out.chapterMeta[FIRST_CHAPTER] = { ...(out.chapterMeta[FIRST_CHAPTER] || {}), migrated: 'active-restart' };
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
    const validId = (value) => typeof value === 'string' && value.trim().length > 0;
    const tasks = (Array.isArray(src.tasks) ? src.tasks : [])
      .filter((task) => task && typeof task === 'object' && validId(task.id) && !task.done);
    const dated = tasks.filter((task) => !task.date || task.date === today);
    const ordered = (dated.length ? dated : tasks).slice().sort((a, b) => {
      const ac = String(a.createdAt || ''), bc = String(b.createdAt || '');
      if (ac !== bc) return ac < bc ? -1 : 1;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    const task = ordered[0] || null;
    const skills = (Array.isArray(src.skills) ? src.skills : [])
      .filter((item) => item && typeof item === 'object' && validId(item.id));
    const goals = (Array.isArray(src.goals) ? src.goals : [])
      .filter((item) => item && typeof item === 'object' && validId(item.id));
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
    const value = {
      version: 1, prerequisites: [], target: null, action: null, completion: null,
      pose: 'guide-close-speak', voiceContext: 'guide', rewardPolicy: 'none',
      cooldown: 0, once: true, replayPolicy: 'manual-no-reward', fallback: 'safe-bubble',
      ...entry,
    };
    value.prerequisites = Object.freeze([...(Array.isArray(value.prerequisites) ? value.prerequisites : [])]);
    return Object.freeze(value);
  }

  const REGISTRY = Object.freeze([
    registryEntry({ id: FIRST_CHAPTER, chapter: FIRST_CHAPTER, copyKey: 'guide.first', target: 'today', action: 'real-task-loop', completion: 'real-task-completed', pose: 'guide-arrive' }),
    registryEntry({ id: 'habits', version: 2, chapter: 'habits', prerequisites: [FIRST_CHAPTER], copyKey: 'guide.habits', target: 'habits', action: 'confirm-habit', completion: 'habit-persisted', cooldown: 86400000 }),
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

  function entryForChapter(chapter) { return REGISTRY.find((entry) => entry.chapter === chapter) || null; }
  function promptKey(entry) { return entry ? `${entry.id}@${entry.version}` : ''; }

  function prerequisitesMet(entry, state) {
    return entry.prerequisites.every((id) => chapterResolved(state, id));
  }

  function entryEligible(entry, state, context) {
    const s = normalize(state), c = context || {};
    if (!s.enabled || chapterResolved(s, entry.chapter) || !prerequisitesMet(entry, s)) return false;
    const now = Number(c.now || Date.now()), key = promptKey(entry);
    if (s.snoozedUntil && now < s.snoozedUntil) return false;
    if (entry.id !== FIRST_CHAPTER && c.sessionPrompted) return false;
    if (entry.once && s.seenPrompts.includes(key)) return false;
    const promptedAt = Number(s.chapterMeta[entry.chapter]?.lastPromptAt || 0);
    if (entry.cooldown > 0 && promptedAt > 0 && now - promptedAt < entry.cooldown) return false;
    switch (entry.id) {
      case FIRST_CHAPTER: return !!c.seedApplied && c.view === 'today';
      case 'habits': return Number(c.completedTasks) >= 2 || Number(c.activeDays) >= 2;
      case 'goals': return !!c.questionnaireReady && !!c.hasGoalSeed && !!c.returnedAfterFirst;
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

  function reconcile(rawState, context) {
    const state = normalize(rawState), before = JSON.stringify(state), c = context || {};
    const replay = !!state.chapterMeta[state.currentChapter]?.replay;
    if (state.currentChapter === FIRST_CHAPTER && !replay && Array.isArray(c.tasks)
      && state.selectedTaskId && ['start', 'wait'].includes(state.currentStep)) {
      const selected = c.tasks.find((task) => task && String(task.id || '') === state.selectedTaskId);
      if (!selected) {
        state.selectedTaskId = null; state.currentStep = 'choose'; state.waitingFor = null;
      } else if (selected.done === true) {
        state.completedSteps = uniqStrings([
          ...state.completedSteps,
          stepKey(FIRST_CHAPTER, 'start'), stepKey(FIRST_CHAPTER, 'wait'),
        ]);
        state.currentStep = 'victory'; state.waitingFor = null;
      }
    }
    const next = normalize(state);
    return { state: next, changed: before !== JSON.stringify(next) };
  }

  function accepted(state, metric, effects) {
    const next = normalize(state);
    return {
      state: next, accepted: true, reason: null, metric: metric || null, effects: effects || [],
      replay: !!next.currentChapter && next.chapterMeta[next.currentChapter]?.replay === true,
    };
  }
  function rejected(state, reason) {
    return { state: normalize(state), accepted: false, reason: reason || 'invalid-event', metric: null, effects: [], replay: false };
  }

  function reduce(rawState, event) {
    const state = normalize(rawState), ev = event && typeof event === 'object' ? event : {};
    const type = String(ev.type || '');
    if (!type) return rejected(state, 'missing-event');

    if (type === 'guide:disable') {
      // Глобальное отключение скрывает подсказки, но не превращает незавершённую
      // главу в сироту. После повторного включения человек может осознанно Resume.
      state.enabled = false;
      return accepted(state, 'guide:disable');
    }
    if (type === 'guide:enable') { state.enabled = true; return accepted(state, 'guide:enable'); }
    if (type === 'guide:voice-consent') {
      if (typeof ev.value !== 'boolean') return rejected(state, 'invalid-voice-consent');
      state.voiceConsent = ev.value;
      return accepted(state, 'guide:voice_choice');
    }
    if (type === 'guide:snooze') {
      const until = Number(ev.until); if (!Number.isFinite(until) || until <= Number(ev.now || 0)) return rejected(state, 'invalid-snooze');
      state.snoozedUntil = until; return accepted(state, 'guide:snooze');
    }
    if (type === 'guide:prompt-seen') {
      const entry = REGISTRY.find((item) => promptKey(item) === String(ev.promptId || '') || item.id === String(ev.promptId || ''));
      if (!entry) return rejected(state, 'unknown-prompt');
      const at = Number(ev.at) || null;
      state.seenPrompts = uniqStrings([...state.seenPrompts, promptKey(entry)]);
      state.lastPromptAt = at || state.lastPromptAt;
      state.chapterMeta[entry.chapter] = { ...(state.chapterMeta[entry.chapter] || {}), lastPromptAt: at };
      return accepted(state, 'guide:step_view');
    }
    if (type === 'guide:replay') {
      const chapter = String(ev.chapter || FIRST_CHAPTER);
      if (!CHAPTERS.includes(chapter)) return rejected(state, 'unknown-chapter');
      if (state.currentChapter) return rejected(state, 'chapter-active');
      if (!chapterResolved(state, chapter)) return rejected(state, 'chapter-not-resolved');
      state.enabled = true; state.currentChapter = chapter;
      state.currentStep = chapter === FIRST_CHAPTER ? FIRST_STEPS[0] : 'intro';
      state.waitingFor = null; state.snoozedUntil = null;
      state.chapterMeta[chapter] = { ...(state.chapterMeta[chapter] || {}), replay: true, replayStartedAt: Number(ev.at) || null };
      return accepted(state, 'guide:replay');
    }
    if (type === 'guide:start') {
      const chapter = String(ev.chapter || FIRST_CHAPTER);
      if (!CHAPTERS.includes(chapter)) return rejected(state, 'unknown-chapter');
      if (ev.replay) return rejected(state, 'use-guide-replay');
      if (!state.enabled) return rejected(state, 'disabled');
      if (state.currentChapter) return rejected(state, 'chapter-active');
      if (chapterResolved(state, chapter)) return rejected(state, 'chapter-resolved');
      state.currentChapter = chapter;
      state.currentStep = chapter === FIRST_CHAPTER ? FIRST_STEPS[0] : 'intro';
      state.waitingFor = null; state.snoozedUntil = null;
      return accepted(state, 'guide:start');
    }
    if (type === 'guide:skip') {
      const chapter = String(ev.chapter || state.currentChapter || ''); if (!chapter) return rejected(state, 'missing-chapter');
      if (!CHAPTERS.includes(chapter)) return rejected(state, 'unknown-chapter');
      if (state.currentChapter && state.currentChapter !== chapter) return rejected(state, 'different-active-chapter');
      const replay = state.currentChapter === chapter && state.chapterMeta[chapter]?.replay === true;
      if (replay) {
        state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
        state.chapterMeta[chapter] = { ...(state.chapterMeta[chapter] || {}), replay: false, lastReplayAbandonedAt: Number(ev.at) || null };
        return accepted(state, 'guide:replay_abandoned');
      }
      if (state.completedChapters.includes(chapter)) return rejected(state, 'chapter-completed');
      state.skippedChapters = uniqStrings([...state.skippedChapters, chapter]);
      state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
      state.chapterMeta[chapter] = { ...(state.chapterMeta[chapter] || {}), skippedAt: Number(ev.at) || null };
      return accepted(state, 'guide:skip');
    }

    if (state.currentChapter && state.currentChapter !== FIRST_CHAPTER) {
      const entry = entryForChapter(state.currentChapter);
      const replay = state.chapterMeta[state.currentChapter]?.replay === true;
      if (replay && type === 'guide:next') {
        state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
        state.chapterMeta[entry.chapter] = { ...(state.chapterMeta[entry.chapter] || {}), replay: false, lastReplayedAt: Number(ev.at) || null };
        return accepted(state, 'guide:replay_complete');
      }
      if (replay) return rejected(state, 'replay-presentation-only');
      if (entry?.chapter === HABITS_CHAPTER && !replay) {
        if (type === 'guide:context-next') {
          if (state.currentStep !== 'intro') return rejected(state, 'wrong-step');
          state.completedSteps = uniqStrings([...state.completedSteps, stepKey(HABITS_CHAPTER, 'intro')]);
          state.currentStep = 'compose'; state.waitingFor = 'habit-persisted';
          return accepted(state, 'guide:context_open');
        }
        if (type === 'guide:context-complete') {
          if (state.currentStep !== 'compose' || state.waitingFor !== 'habit-persisted') return rejected(state, 'wrong-step');
          if (!ev.persisted) return rejected(state, 'not-persisted');
          if (String(ev.completion || '') !== entry.completion) return rejected(state, 'wrong-completion');
          if (!cleanNullableString(ev.itemId)) return rejected(state, 'missing-item');
          state.completedSteps = uniqStrings([...state.completedSteps, stepKey(HABITS_CHAPTER, 'compose')]);
          state.currentStep = 'complete'; state.waitingFor = null;
          state.chapterMeta[HABITS_CHAPTER] = {
            ...(state.chapterMeta[HABITS_CHAPTER] || {}),
            itemId: String(ev.itemId), persistedAt: Number(ev.at) || null,
          };
          return accepted(state, 'guide:habit_persisted');
        }
        if (type === 'guide:context-finish') {
          if (state.currentStep !== 'complete') return rejected(state, 'wrong-step');
          state.completedSteps = uniqStrings([...state.completedSteps, stepKey(HABITS_CHAPTER, 'complete')]);
          state.completedChapters = uniqStrings([...state.completedChapters, HABITS_CHAPTER]);
          state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
          state.chapterMeta[HABITS_CHAPTER] = {
            ...(state.chapterMeta[HABITS_CHAPTER] || {}), completedAt: Number(ev.at) || null,
          };
          return accepted(state, 'guide:chapter_complete');
        }
        return rejected(state, 'context-completion-required');
      }
      if (type !== 'guide:context-complete') return rejected(state, 'context-completion-required');
      if (!ev.persisted) return rejected(state, 'not-persisted');
      if (!entry || String(ev.completion || '') !== entry.completion) return rejected(state, 'wrong-completion');
      state.completedChapters = uniqStrings([...state.completedChapters, entry.chapter]);
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(entry.chapter, 'intro')]);
      state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
      state.chapterMeta[entry.chapter] = { ...(state.chapterMeta[entry.chapter] || {}), completedAt: Number(ev.at) || null };
      return accepted(state, 'guide:chapter_complete');
    }
    if (state.currentChapter !== FIRST_CHAPTER) return rejected(state, 'first-journey-not-active');
    const step = state.currentStep;
    if (type === 'guide:next') {
      const replay = state.chapterMeta[FIRST_CHAPTER]?.replay === true;
      const next = (replay
        ? { welcome: 'recognize', recognize: 'choose', choose: 'start', start: 'wait', wait: 'victory', victory: 'mastery', mastery: 'bond', bond: 'release' }
        : { welcome: 'recognize', victory: 'mastery', mastery: 'bond' })[step];
      if (!next) return rejected(state, 'next-not-allowed');
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.currentStep = next;
      return accepted(state, replay ? 'guide:replay_step' : 'guide:action');
    }
    if (type === 'guide:recognize-task') {
      if (step !== 'recognize') return rejected(state, 'wrong-step');
      if (!ev.persisted) return rejected(state, 'not-persisted');
      if (!ev.taskId) return rejected(state, 'missing-task');
      state.chapterMeta[FIRST_CHAPTER] = { ...(state.chapterMeta[FIRST_CHAPTER] || {}), candidateTaskId: String(ev.taskId) };
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      state.currentStep = 'choose';
      return accepted(state, 'guide:first_task_recognized');
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
      const replay = state.chapterMeta[FIRST_CHAPTER]?.replay === true;
      state.completedSteps = uniqStrings([...state.completedSteps, stepKey(FIRST_CHAPTER, step)]);
      if (!replay) state.completedChapters = uniqStrings([...state.completedChapters, FIRST_CHAPTER]);
      state.currentChapter = null; state.currentStep = null; state.waitingFor = null;
      const oldMeta = state.chapterMeta[FIRST_CHAPTER] || {};
      state.chapterMeta[FIRST_CHAPTER] = replay
        ? { ...oldMeta, replay: false, lastReplayedAt: Number(ev.at) || null }
        : { ...oldMeta, completedAt: oldMeta.completedAt || Number(ev.at) || null, replay: false };
      return accepted(state, replay ? 'guide:replay_complete' : 'guide:chapter_complete');
    }
    return rejected(state, 'unsupported-event');
  }

  return {
    VERSION, FIRST_CHAPTER, HABITS_CHAPTER, FIRST_STEPS, HABITS_STEPS, FORMS, CHAPTERS, REGISTRY,
    defaultState, normalize, migrate, chapterResolved, guideSeed,
    prerequisitesMet, entryEligible, nextContextual, promptKey, reconcile, reduce,
  };
});
