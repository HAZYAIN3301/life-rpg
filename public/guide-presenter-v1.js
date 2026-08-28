/* Satoru Guide Presenter v1 — pure Guide v3 view-model builder.
 *
 * Input is an explicit snapshot: { state, seed, tasks, chapter, copy }.
 * Output contains presentation data only. Persistence, selectors containing
 * user/task ids, and application events are owned by the app adapter.
 */
(function exposeGuidePresenterV1(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuidePresenterV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuidePresenterV1() {
  'use strict';

  const VERSION = '1.2.0';
  const FIRST_CHAPTER = 'first-journey';
  const HABITS_CHAPTER = 'habits';
  const FIRST_STEPS = Object.freeze([
    'welcome', 'recognize', 'choose', 'start', 'wait',
    'victory', 'mastery', 'bond', 'release',
  ]);
  const HABITS_STEPS = Object.freeze(['intro', 'compose', 'complete']);
  const CONTEXT_STEPS = Object.freeze(['intro', 'engage', 'complete']);

  const STEP_TITLES = Object.freeze({
    welcome: 'first.episode.meeting.title',
    recognize: 'first.episode.recognition.title',
    choose: 'first.episode.selection.title',
    start: 'first.episode.start.title',
    wait: 'first.episode.wait.title',
    victory: 'first.episode.victory.title',
    mastery: 'first.episode.level.title',
    bond: 'first.episode.bond.title',
    release: 'first.episode.release.title',
  });

  const STEP_TRANSCRIPTS = Object.freeze({
    welcome: 'first.meeting',
    choose: 'first.selection',
    start: 'first.start',
    wait: 'first.wait',
    victory: 'first.victory',
    mastery: 'first.level_form',
    bond: 'first.bond',
    release: 'first.release',
  });

  const CHAPTER_COPY_IDS = Object.freeze({
    [FIRST_CHAPTER]: 'first',
    habits: 'habits', goals: 'goals', calendar: 'calendar', notes: 'notes',
    voice: 'voice', jarvis: 'jarvis', rewards: 'rewards', hero: 'hero', den: 'den',
    pets: 'pets', tree: 'tree', stats: 'stats', tribe: 'tribe',
  });

  const CONTEXT_SPECS = Object.freeze({
    habits: Object.freeze({ steps: HABITS_STEPS, active: 'compose', middle: ['context.habits.choose', 'context.habits.schedule', 'context.habits.two_minute'], targets: ['habits-nav', 'habit-create', 'habit-created'] }),
    calendar: Object.freeze({ middle: ['context.calendar.guide'], targets: ['plan-nav', 'calendar-task', 'calendar-scheduled'] }),
    notes: Object.freeze({ middle: ['context.notes.capture'], targets: ['notes-nav', 'note-capture', 'note-created'] }),
    voice: Object.freeze({ middle: ['context.voice.prompt'], targets: ['speaker', 'speaker', 'speaker'] }),
    jarvis: Object.freeze({ middle: ['context.jarvis.prompt'], targets: ['helper', 'helper-input', 'helper-response'] }),
    rewards: Object.freeze({ middle: ['context.rewards.choose'], targets: ['rewards-nav', 'reward-buy', 'reward-purchase'] }),
    hero: Object.freeze({ middle: ['context.hero.prompt'], targets: ['hero-nav', 'hero-overview', 'hero-overview'] }),
    den: Object.freeze({ middle: ['context.den.prompt'], targets: ['hero-nav', 'den-overview', 'den-overview'] }),
    pets: Object.freeze({ middle: ['context.pets.prompt'], targets: ['hero-nav', 'pet-sphere', 'pet-sphere'] }),
    tree: Object.freeze({ middle: ['context.tree.prompt'], targets: ['hero-nav', 'tree-node', 'tree-node'] }),
    stats: Object.freeze({ middle: ['context.stats.prompt'], targets: ['hero-nav', 'stats-overview', 'stats-overview'] }),
    tribe: Object.freeze({ middle: ['context.tribe.prompt'], targets: ['tribe-nav', 'tribe-privacy', 'tribe-privacy'] }),
  });

  function copySource(copy, key) {
    if (!copy || typeof key !== 'string') return null;
    if (typeof copy.get === 'function') return copy.get(key);
    const table = copy.COPY && typeof copy.COPY === 'object' ? copy.COPY : copy;
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
  }

  function text(copy, key, variables) {
    if (copy && typeof copy.format === 'function') {
      const formatted = copy.format(key, variables);
      return formatted == null ? '' : String(formatted);
    }
    const source = copySource(copy, key);
    if (source == null) return '';
    const values = variables && typeof variables === 'object' ? variables : {};
    return String(source).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
    ));
  }

  function stringId(value) {
    return typeof value === 'string' && value ? value : null;
  }

  function chapterId(chapter, state) {
    if (typeof chapter === 'string') return chapter;
    if (chapter && typeof chapter === 'object') return stringId(chapter.id || chapter.chapter);
    return stringId(state && state.currentChapter) || FIRST_CHAPTER;
  }

  function replaying(state, id) {
    const meta = state && state.chapterMeta && state.chapterMeta[id];
    return !!(meta && meta.replay === true);
  }

  function staticSelector(targetKey) {
    if (!/^[a-z0-9_-]+$/.test(String(targetKey || ''))) return null;
    return `[data-guide-target="${targetKey}"]`;
  }

  function taskList(tasks) {
    const out = [], seen = new Set();
    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task || typeof task !== 'object' || task.done === true) continue;
      const id = stringId(task.id); if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        title: typeof task.title === 'string' ? task.title : '',
        skillId: stringId(task.skillId),
        goalId: stringId(task.goalId),
      });
    }
    return out;
  }

  function taskById(tasks, id) {
    return id ? tasks.find((task) => task.id === id) || null : null;
  }

  function recognition(seed, candidate) {
    const source = seed && typeof seed === 'object' ? seed : {};
    const branch = ['task', 'sphere', 'blank'].includes(source.branch) ? source.branch : 'blank';
    const taskTitle = typeof source.taskTitle === 'string' && source.taskTitle
      ? source.taskTitle : candidate && candidate.title ? candidate.title : '';
    const goalOrSphere = typeof source.goalTitle === 'string' && source.goalTitle
      ? source.goalTitle : typeof source.skillName === 'string' ? source.skillName : '';
    if (branch !== 'task' || !taskTitle) return { branch, key: 'first.recognition.create', variables: {} };
    if (goalOrSphere) return {
      branch, key: 'first.recognition.seed',
      variables: { goalOrSphere, firstQuest: taskTitle },
    };
    return { branch, key: 'first.recognition.seed_neutral', variables: { firstQuest: taskTitle } };
  }

  function action(copy, id, labelKey, event, extra) {
    return Object.freeze({
      id,
      labelKey: labelKey || null,
      label: labelKey ? text(copy, labelKey) : null,
      event: event || null,
      ...(extra || {}),
    });
  }

  function secondaryActions(copy, options) {
    const opts = options || {}, out = [];
    if (opts.later !== false) out.push(action(copy, 'later', 'system.action.later', 'guide:snooze', { adapterSuppliesUntil: true }));
    if (opts.speaker !== false) out.push(action(copy, 'speaker', 'system.action.speak', 'guide:speak', { presentationOnly: true }));
    if (opts.skip !== false) out.push(action(copy, 'skip', 'system.action.skip_chapter', 'guide:skip'));
    return out;
  }

  function replayActions(copy, step) {
    if (step === 'release') {
      return [
        action(copy, 'finish-replay', 'system.action.stay_today', 'guide:finish', { presentationOnly: true }),
        action(copy, 'speaker', 'system.action.speak', 'guide:speak', { presentationOnly: true }),
        action(copy, 'skip-replay', 'system.action.close', 'guide:skip', { presentationOnly: true }),
      ];
    }
    return [
      action(copy, 'replay-next', 'system.action.next', 'guide:next', {
        presentationOnly: true,
        automatic: step === 'wait',
      }),
      ...(step === 'wait' ? [] : [
        action(copy, 'speaker', 'system.action.speak', 'guide:speak', { presentationOnly: true }),
        action(copy, 'skip-replay', 'system.action.close', 'guide:skip', { presentationOnly: true }),
      ]),
    ];
  }

  function liveActions(copy, step, branch, candidateTaskId, selectedTaskId) {
    if (step === 'welcome') return [
      action(copy, 'start', 'system.action.start', 'guide:next'),
      ...secondaryActions(copy),
    ];
    if (step === 'recognize') {
      const primary = branch === 'task' && candidateTaskId
        ? action(copy, 'recognize-task', 'system.action.next', 'guide:recognize-task', { taskId: candidateTaskId, persistedRequired: true })
        : action(copy, 'save-task', 'system.action.save', 'guide:recognize-task', { formAction: true, persistedRequired: true });
      return [primary, ...secondaryActions(copy)];
    }
    if (step === 'choose') return [
      action(copy, 'select-task', 'system.action.my_step', 'guide:select-task', { taskId: candidateTaskId, persistedRequired: true }),
      action(copy, 'choose-other', 'system.action.choose_other', null, { localControl: 'choices' }),
      ...secondaryActions(copy),
    ];
    if (step === 'start') return [
      action(copy, 'start-focus', 'system.action.run_focus', 'guide:started', { taskId: selectedTaskId, focus: true, persistedRequired: true }),
      action(copy, 'without-timer', 'system.action.without_timer', 'guide:started', { taskId: selectedTaskId, focus: false }),
      ...secondaryActions(copy),
    ];
    if (step === 'wait') return [];
    if (step === 'victory') return [
      action(copy, 'next', 'system.action.next', 'guide:next'),
      ...secondaryActions(copy, { later: false }),
    ];
    if (step === 'mastery') return [
      action(copy, 'understood', 'system.action.understood', 'guide:next'),
      ...secondaryActions(copy, { later: false }),
    ];
    if (step === 'bond') return [
      action(copy, 'contact-shadow', null, 'guide:bond', { targetOnly: true, persistedRequired: true }),
      ...secondaryActions(copy),
    ];
    if (step === 'release') return [
      action(copy, 'finish', 'system.action.stay_today', 'guide:finish'),
      action(copy, 'show-teaser', 'system.action.whats_next', null, { localControl: 'teaser' }),
      action(copy, 'speaker', 'system.action.speak', 'guide:speak', { presentationOnly: true }),
    ];
    return [];
  }

  function targetFor(step, branch, candidateTaskId, selectedTaskId) {
    if (step === 'wait') return { targetKey: null, taskId: selectedTaskId, targetSelector: null };
    if (step === 'recognize' && branch !== 'task') return { targetKey: 'quick-add', taskId: null, targetSelector: staticSelector('quick-add') };
    if (step === 'recognize' || step === 'choose') {
      return { targetKey: 'task', taskId: candidateTaskId, targetSelector: candidateTaskId ? null : staticSelector('quick-add') };
    }
    if (step === 'start') return { targetKey: 'task-start', taskId: selectedTaskId, targetSelector: null };
    const keys = {
      welcome: 'today', victory: 'quest-reward', mastery: 'level',
      bond: 'shadow-contact', release: 'guide-library',
    };
    const targetKey = keys[step] || null;
    return { targetKey, taskId: null, targetSelector: targetKey ? staticSelector(targetKey) : null };
  }

  function choicesFor(tasks, candidateTaskId, selectedTaskId, replay) {
    if (replay) return [];
    const preferred = candidateTaskId || selectedTaskId;
    return tasks.slice().sort((a, b) => {
      if (a.id === preferred) return -1;
      if (b.id === preferred) return 1;
      return 0;
    }).map((task) => ({ ...task, selected: task.id === selectedTaskId, candidate: task.id === candidateTaskId }));
  }

  function formHintFor(copy, branch, seed, replay) {
    if (replay || branch === 'task') return null;
    const source = seed && typeof seed === 'object' ? seed : {};
    return Object.freeze({
      mode: 'create-task',
      branch,
      labelKey: 'first.create.label',
      label: text(copy, 'first.create.label'),
      placeholderKey: 'first.create.placeholder',
      placeholder: text(copy, 'first.create.placeholder'),
      sphereLabelKey: 'first.create.sphere_label',
      sphereLabel: text(copy, 'first.create.sphere_label'),
      defaultSphereId: stringId(source.skillId),
      defaultSphereName: typeof source.skillName === 'string' ? source.skillName : '',
      requiresSphereChoice: branch === 'blank',
    });
  }

  function firstJourney(input) {
    const src = input && typeof input === 'object' ? input : {};
    const state = src.state && typeof src.state === 'object' ? src.state : {};
    const id = chapterId(src.chapter, state);
    if (id !== FIRST_CHAPTER) return null;
    const step = FIRST_STEPS.includes(state.currentStep) ? state.currentStep : FIRST_STEPS[0];
    const copy = src.copy;
    const tasks = taskList(src.tasks);
    const seed = src.seed && typeof src.seed === 'object' ? src.seed : {};
    const meta = state.chapterMeta && state.chapterMeta[FIRST_CHAPTER] && typeof state.chapterMeta[FIRST_CHAPTER] === 'object'
      ? state.chapterMeta[FIRST_CHAPTER] : {};
    const replay = replaying(state, FIRST_CHAPTER);
    const selectedTaskId = stringId(state.selectedTaskId);
    const candidateTaskId = stringId(meta.candidateTaskId) || stringId(seed.taskId) || selectedTaskId;
    const candidate = taskById(tasks, candidateTaskId);
    const recognized = recognition(seed, candidate);
    const transcriptKey = step === 'recognize' ? recognized.key : STEP_TRANSCRIPTS[step];
    const titleKey = STEP_TITLES[step];
    const index = FIRST_STEPS.indexOf(step) + 1;
    const target = targetFor(step, recognized.branch, candidateTaskId, selectedTaskId);
    const hidden = step === 'wait';

    return Object.freeze({
      chapter: FIRST_CHAPTER,
      step,
      replay,
      presentationOnly: replay,
      hidden,
      textOnlyArt: true,
      chapterTitleKey: 'chapter.first.title',
      chapterTitle: text(copy, 'chapter.first.title'),
      titleKey,
      title: text(copy, titleKey),
      progress: text(copy, 'system.progress', { current: index, total: FIRST_STEPS.length }),
      progressIndex: index,
      progressTotal: FIRST_STEPS.length,
      transcriptKey,
      transcript: text(copy, transcriptKey, recognized.variables),
      teaserKey: step === 'release' ? 'first.teaser' : null,
      teaser: step === 'release' ? text(copy, 'first.teaser') : '',
      targetKey: target.targetKey,
      taskId: target.taskId,
      targetSelector: target.targetSelector,
      fallback: 'safe-bubble',
      actions: replay ? replayActions(copy, step) : liveActions(copy, step, recognized.branch, candidateTaskId, selectedTaskId),
      choices: choicesFor(tasks, candidateTaskId, selectedTaskId, replay),
      formHint: step === 'recognize' ? formHintFor(copy, recognized.branch, seed, replay) : null,
      branch: recognized.branch,
      candidateTaskId,
      selectedTaskId,
    });
  }

  function contextActions(copy, step, replay, chapter) {
    if (replay) return [
      action(copy, 'context-replay-finish', 'system.action.okay', 'guide:next', { presentationOnly: true }),
      action(copy, 'speaker', 'system.action.speak', 'guide:speak', { presentationOnly: true }),
      action(copy, 'skip-replay', 'system.action.close', 'guide:skip', { presentationOnly: true }),
    ];
    if (step === 'intro') return [
      action(copy, 'context-open', 'system.action.show', 'guide:context-next'),
      action(copy, 'later', 'system.action.not_now', 'guide:snooze', { adapterSuppliesUntil: true }),
      action(copy, 'speaker', 'system.action.speak', 'guide:speak', { presentationOnly: true }),
      action(copy, 'skip', 'system.action.skip_chapter', 'guide:skip'),
    ];
    if (step === 'compose') return secondaryActions(copy);
    if (step === 'engage') {
      if (chapter === 'voice') return [
        action(copy, 'context-voice-preview', 'system.action.speak', 'guide:voice-preview'),
        ...secondaryActions(copy, { speaker: false }),
      ];
      if (['hero', 'den', 'stats'].includes(chapter)) return [
        action(copy, 'context-viewed', 'system.action.understood', 'guide:context-viewed'),
        ...secondaryActions(copy),
      ];
      return secondaryActions(copy);
    }
    if (step === 'complete') return [
      action(copy, 'context-finish', 'system.action.okay', 'guide:context-finish'),
      action(copy, 'speaker', 'system.action.speak', 'guide:speak', { presentationOnly: true }),
    ];
    return [];
  }

  function contextualChapter(input) {
    const src = input && typeof input === 'object' ? input : {};
    const state = src.state && typeof src.state === 'object' ? src.state : {};
    const id = chapterId(src.chapter, state);
    const spec = CONTEXT_SPECS[id];
    if (!spec) return null;
    const copy = src.copy;
    const steps = spec.steps || CONTEXT_STEPS;
    const activeStep = spec.active || 'engage';
    const replay = replaying(state, id);
    const step = replay ? 'intro' : (steps.includes(state.currentStep) ? state.currentStep : steps[0]);
    const meta = state.chapterMeta && state.chapterMeta[id] && typeof state.chapterMeta[id] === 'object'
      ? state.chapterMeta[id] : {};
    const promptKey = `context.${id}.prompt`, completeKey = `context.${id}.complete`;
    const transcriptKeys = replay
      ? [promptKey, ...spec.middle, completeKey]
      : step === 'intro' ? [promptKey]
        : step === activeStep ? spec.middle
          : [completeKey];
    const index = replay ? 1 : steps.indexOf(step) + 1;
    const targetIndex = replay ? 0 : Math.max(0, steps.indexOf(step));
    const targetKey = spec.targets[targetIndex] || spec.targets[0];
    return Object.freeze({
      chapter: id,
      step,
      replay,
      presentationOnly: replay,
      hidden: false,
      textOnlyArt: true,
      chapterTitleKey: `chapter.${CHAPTER_COPY_IDS[id]}.title`,
      chapterTitle: text(copy, `chapter.${CHAPTER_COPY_IDS[id]}.title`),
      titleKey: null,
      title: null,
      progress: text(copy, 'system.progress', { current: index, total: replay ? 1 : steps.length }),
      progressIndex: index,
      progressTotal: replay ? 1 : steps.length,
      transcriptKey: transcriptKeys.join('+'),
      transcript: transcriptKeys.map((key) => text(copy, key)).filter(Boolean).join('\n\n'),
      teaserKey: null,
      teaser: '',
      targetKey,
      targetSelector: staticSelector(targetKey),
      fallback: 'safe-bubble',
      actions: contextActions(copy, step, replay, id),
      choices: [],
      formHint: null,
      itemId: stringId(meta.itemId),
      habitId: id === HABITS_CHAPTER ? stringId(meta.itemId) : null,
    });
  }

  function habitsChapter(input) {
    const src = input && typeof input === 'object' ? input : {};
    const id = chapterId(src.chapter, src.state);
    return id === HABITS_CHAPTER ? contextualChapter(src) : null;
  }

  function present(input) {
    const src = input && typeof input === 'object' ? input : {};
    const id = chapterId(src.chapter, src.state);
    if (id === FIRST_CHAPTER) return firstJourney(src);
    return contextualChapter(src);
  }

  function collectionHas(collection, id) {
    if (collection instanceof Set) return collection.has(id);
    if (Array.isArray(collection)) return collection.includes(id);
    return !!(collection && typeof collection === 'object' && collection[id] === true);
  }

  function chapterAvailable(entry, state, context) {
    const c = context && typeof context === 'object' ? context : {};
    if (collectionHas(c.availableChapters, entry.chapter) || collectionHas(c.availableChapters, entry.id)) return true;
    if (collectionHas(c.availability, entry.chapter) || collectionHas(c.availability, entry.id)) return true;
    if (typeof c.isAvailable === 'function') {
      try { return c.isAvailable(entry, state, c) === true; } catch { return false; }
    }
    if (typeof entry.eligibility === 'function') {
      try { return entry.eligibility(state, c) === true; } catch { return false; }
    }
    return false;
  }

  function libraryCards(stateInput, contextInput, registryInput, copy) {
    const state = stateInput && typeof stateInput === 'object' ? stateInput : {};
    const context = contextInput && typeof contextInput === 'object' ? contextInput : {};
    const registry = Array.isArray(registryInput) ? registryInput : [];
    const completed = new Set(Array.isArray(state.completedChapters) ? state.completedChapters : []);
    const skipped = new Set(Array.isArray(state.skippedChapters) ? state.skippedChapters : []);
    const current = stringId(state.currentChapter);
    const seen = new Set();
    const cards = [];

    for (const entry of registry) {
      if (!entry || typeof entry !== 'object') continue;
      const id = stringId(entry.chapter || entry.id);
      if (!id || seen.has(id) || !CHAPTER_COPY_IDS[id]) continue;
      seen.add(id);
      const deferred = id === 'goals' || collectionHas(context.deferredChapters, id) || entry.deferred === true;
      let status = 'locked';
      if (deferred) status = 'deferred';
      else if (current === id) status = 'current';
      else if (completed.has(id)) status = 'completed';
      else if (skipped.has(id) || chapterAvailable(entry, state, context)) status = 'available';

      const statusKeys = {
        current: 'library.continue', completed: 'library.completed', available: 'library.available',
        locked: 'library.locked', deferred: 'library.locked',
      };
      const actionKeys = {
        current: 'system.action.resume', completed: 'system.action.replay',
        available: skipped.has(id) ? 'system.action.replay' : 'system.action.start',
      };
      const titleKey = `chapter.${CHAPTER_COPY_IDS[id]}.title`;
      const actionKey = actionKeys[status] || null;
      const descriptionKey = id === 'goals' ? 'library.goals.deferred' : null;
      cards.push(Object.freeze({
        id,
        status,
        titleKey,
        title: text(copy, titleKey),
        statusKey: statusKeys[status],
        statusLabel: text(copy, statusKeys[status]),
        actionKey,
        actionLabel: actionKey ? text(copy, actionKey) : null,
        descriptionKey,
        description: descriptionKey ? text(copy, descriptionKey) : '',
        completed: status === 'completed',
        current: status === 'current',
        available: status === 'available',
        locked: status === 'locked',
        deferred: status === 'deferred',
        replay: replaying(state, id) || status === 'completed' || skipped.has(id),
      }));
    }
    return Object.freeze(cards);
  }

  return Object.freeze({
    VERSION,
    FIRST_CHAPTER,
    HABITS_CHAPTER,
    FIRST_STEPS,
    HABITS_STEPS,
    CONTEXT_STEPS,
    firstJourney,
    habitsChapter,
    contextualChapter,
    present,
    libraryCards,
  });
});
