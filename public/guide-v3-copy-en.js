/* Satoru Guide v3 — English runtime copy.
 *
 * Translated from the Albert-approved Russian source (guide-v3-copy-ru.js,
 * VERSION 1.0.0/runtime-approved) after the RU tone gate closed. Mirrors its
 * exact key set and every {placeholder} — see scripts/guide-v3-copy-locales-v1.test.js,
 * which enforces both. Terminology (Den, Tribe, Pets, Hero, Skills, Progress,
 * Assistant, Spark/Spirit/Guardian/Keeper, etc.) matches the existing I18N_EN /
 * per-key {en,de,uk,es} tables in app.js — cross-checked before writing, not guessed.
 *
 * context.rewards.choose nods at Fullmetal Alchemist's law of equivalent exchange
 * (Albert's explicit choice: attribute rather than hide it) but does NOT reproduce
 * the exact well-known English dub line — that specific wording is the most
 * recognizable, most copyright-sensitive form of the quote. Paraphrased instead,
 * same idea, same self-aware nod.
 *
 * Pure UMD module: no DOM, State, storage, network, or translator access.
 * Callers must escape user-provided substitutions before inserting formatted
 * text into HTML. format() intentionally performs text substitution only.
 */
(function exposeGuideV3CopyEn(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuideV3CopyEn = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuideV3CopyEn() {
  'use strict';

  const VERSION = '0.2.0';
  const LOCALE = 'en';
  const STATUS = 'translated';

  const CONTEXTUAL_STATUS = Object.freeze({
    habits: 'runtime-approved',
    goals: 'deferred-questionnaire',
    calendar: 'draft-ready',
    notes: 'draft-ready',
    voice: 'draft-ready',
    jarvis: 'draft-ready',
    systemTheme: 'draft-ready',
    rewards: 'draft-ready',
    hero: 'draft-ready',
    den: 'draft-ready',
    pets: 'draft-ready',
    tree: 'draft-ready',
    stats: 'draft-ready',
    tribe: 'draft-ready',
  });

  const COPY = Object.freeze({
    "chapter.first.title": "First Journey",
    "chapter.habits.title": "Habits",
    "chapter.goals.title": "Goals",
    "chapter.calendar.title": "Calendar",
    "chapter.notes.title": "Notes",
    "chapter.voice.title": "Shadow's Voice",
    "chapter.jarvis.title": "Personal Assistant",
    "chapter.system_theme.title": "System Theme",
    "chapter.rewards.title": "Rewards",
    "chapter.hero.title": "Hero",
    "chapter.den.title": "Den",
    "chapter.pets.title": "Pets",
    "chapter.tree.title": "Skill Tree",
    "chapter.stats.title": "Stats",
    "chapter.tribe.title": "Tribe",

    "system.action.start": "Start",
    "system.action.later": "Later",
    "system.action.next": "Next",
    "system.action.back": "Back",
    "system.action.close": "Close",
    "system.action.skip_chapter": "Skip chapter",
    "system.action.disable_prompts": "Don't show tips",
    "system.action.enable_prompts": "Turn tips back on",
    "system.action.resume": "Continue",
    "system.action.replay": "Go through it again",
    "system.action.retry": "Try again",
    "system.action.save": "Save",
    "system.action.show": "Show",
    "system.action.not_now": "Not now",
    "system.action.understood": "Got it",
    "system.action.okay": "Okay",
    "system.action.speak": "Read aloud",
    "system.action.stop_voice": "Stop voice",
    "system.action.replay_voice": "Replay this line",
    "system.action.my_step": "This is my step",
    "system.action.choose_other": "Choose another",
    "system.action.run_focus": "Start",
    "system.action.without_timer": "I'll do it without a timer",
    "system.action.stay_today": "Stay on Today",
    "system.action.whats_next": "What's next?",
    "system.action.touch_shadow": "Touch Shadow",
    "system.progress": "Step {current} of {total}",
    "system.saving": "Saving…",
    "system.saved": "Saved",
    "system.save_failed": "Couldn't save. Nothing changed — try again.",
    "system.offline": "No connection right now. The guide will save your place and continue once the app can write the result again.",
    "system.voice_unavailable": "Voice is unavailable right now. The line stays on screen.",
    "system.target_unavailable": "That element isn't available right now. Close the open window or come back to this step later.",
    "system.chapter_complete": "Chapter complete",
    "system.chapter_snoozed": "Okay. We'll come back to this later.",
    "system.replay_no_reward": "Replaying helps you remember how it works, but it won't pay out XP, gold, or bond again.",
    "system.global_disable_confirm": "Turn off all new tips? Chapters you've finished and the library stay available.",

    "first.episode.meeting.title": "Meeting",
    "first.episode.recognition.title": "Your first step",
    "first.episode.selection.title": "Choice",
    "first.episode.start.title": "Get started",
    "first.episode.wait.title": "The real thing",
    "first.episode.victory.title": "First win",
    "first.episode.level.title": "Level and Form",
    "first.episode.bond.title": "Meeting Shadow",
    "first.episode.release.title": "On your own from here",
    "first.meeting": "Welcome, player! I'm Shadow, your guide. For now I'll just show you what's actually useful — we'll get to the rest when you're ready. I'm always around.",
    "first.recognition.seed": "You said {goalOrSphere} matters to you. Here's the first step that came out of it: “{firstQuest}”. Not an abstract plan — something you can actually do.",
    "first.recognition.seed_neutral": "Here's the first step that came out of your setup: “{firstQuest}”. Not an abstract plan — something you can actually do.",
    "first.recognition.create": "Let's start with one step. Not a whole new life — just something you can genuinely do today.",
    "first.create.label": "One thing for today",
    "first.create.placeholder": "For example: go for a ten-minute walk",
    "first.create.sphere_label": "Sphere for this step",
    "first.selection": "This will be your next step. If now isn't the time — that's fine, it'll stay here, and you can come back when you're ready.",
    "first.start": "When it's hard to get into something, hit ▶. Satoru will hold the time and a single focus for you, so you don't have to keep them in your head.",
    "first.wait": "Alright, now — the actual thing! Yeah, right now. You didn't download Brawl Stars — this is productivity, growth, all that. So go do it, I'll wait. Mark it done only when it's actually done, and we'll move on.",
    "first.wait.resume": "You're back. Our step is still here. If it's already done, mark it honestly; if not, keep going at your own pace.",
    "first.victory": "Now that's growth: XP into your sphere, gold toward rewards, the finished task into your history. Not for a promise. For what you actually did.",
    "first.level_form": "Think of it like this: Level is like a belt in martial arts — once earned, nobody can take it away, and proven mastery doesn't burn out from a pause. But go too long without practicing and your skills get rusty: that's your Form fading.",
    "first.bond": "Yo! Fist bump!",
    "first.bond.complete": "Good. We're acquainted now.",
    "first.release": "That's it, champ! Time for a break today. When a new part of Satoru is actually useful, I'll show it to you separately. You can find these and other “lessons” under How to Play. Now it's your move. Have a great, productive day!",
    "first.teaser": "Next up: habits, goals, and your Hero. Later — the Den, pets, skills, and your Tribe. Not all at once: let today's step become yours first.",
    "first.skip": "Okay. Your day stays yours. If you want, you can continue getting to know Satoru in the guide library anytime.",

    "context.habits.prompt": "One task helps today. A repeated one changes who you're becoming. Want to turn a step you already know into a habit, together?",
    "context.habits.choose": "Pick a step you genuinely want to repeat. You don't have to come up with a new one.",
    "context.habits.schedule": "Mark the days this rhythm is realistic for. You can change the schedule later.",
    "context.habits.two_minute": "Add a two-minute version — the smallest honest way into the habit on a hard day.",
    "context.habits.complete": "Done. A streak shows rhythm — it doesn't create debt. Miss one, and we just pick up next time.",

    "context.calendar.prompt": "This task now has its own time. Want to put it on the calendar so it doesn't compete with today's step?",
    "context.calendar.guide": "Pick a real task, a date, and a time if you need one. We're only changing its place in the plan.",
    "context.calendar.complete": "Done. The task is still yours — we just found it a place.",

    "context.notes.prompt": "Not every thought needs to become a task right away. Want to save one without deciding right now?",
    "context.notes.capture": "Write the thought down as it is. Later you can leave it as a note or turn it into a real step.",
    "context.notes.complete": "Saved. You don't have to hold onto that thought anymore.",

    "context.voice.prompt": "I can read my lines out loud in a steady voice. The text stays on screen either way. Want to try it?",
    "context.voice.complete": "You can stop, replay, or fully turn off the voice in settings.",

    "context.jarvis.prompt": "If it's hard to tell what matters right now, you can ask me about your day. I'll look at what's available and suggest one next step.",
    "context.jarvis.complete": "This is a conversation, not a command. You can accept the answer, change it, or leave it alone.",

    "context.system_theme.prompt": "Satoru can follow your device's light or dark theme. This only changes the look.",
    "context.system_theme.complete": "Done. You can switch the theme anytime.",

    "context.rewards.prompt": "You've already earned some gold. Want to trade it for one reward you picked out for yourself?",
    "context.rewards.choose": "Nothing worth having comes without giving something up first — yeah, that's basically the Fullmetal Alchemist rule, but it's true either way.",
    "context.rewards.complete": "Reward bought. Now the real job is actually using it.",

    "context.hero.prompt": "Your Hero reflects proven progress in your spheres. There's no separate power level to grind just for the picture.",
    "context.hero.complete": "The look changes along with your path, but progress you've already earned never disappears.",

    "context.den.prompt": "The Den is where Shadow, your Hero, and your pets live. It opens up gradually as your story does.",
    "context.den.complete": "Take your time looking around. Come back here when you want to see your world, not just check off a list.",

    "context.pets.prompt": "Your pets reflect your main life spheres. Their state reflects the time you've actually spent on each one. Neglect a sphere for a while and its pet starts going hungry; do nothing but that one thing and it overeats and can end up bloated. So you can use them to keep your spheres in balance and avoid burning out on what matters to you — try to keep them somewhere in the middle. This is a compass, not a scolding or a punishment. With AI and your feedback, I'll be able to tune your own personal “balance wheel.”",
    "context.pets.complete": "Pick one pet and see which sphere it's tied to. You don't have to fix everything at once.",

    "context.tree.prompt": "You've earned a skill point. In the Tree it unlocks a real step on that sphere's actual path, not a random bonus.",
    "context.tree.complete": "Done. The next nodes will show up once you've earned the progress for them.",

    "context.stats.prompt": "There are enough days now to see a real pattern, not a guess. Want to see one?",
    "context.stats.complete": "Stats show an observation, not a judgment of you. The decision is still yours.",

    "context.tribe.prompt": "Tribe unlocks playing together. Nothing gets published or compared without your separate consent.",
    "context.tribe.complete": "You choose whether to take part in Tribe at all, and which social features to turn on.",

    "library.title": "How to Play",
    "library.subtitle": "Short chapters show up when they can actually help. You can skip them and come back later.",
    "library.continue": "Continue getting to know it",
    "library.available": "Available now",
    "library.completed": "Completed",
    "library.locked": "Coming later",
    "library.locked_condition": "Unlocks: {condition}",
    "library.replay_note": "Replaying doesn't change your data or pay out rewards again.",
    "library.search.label": "Search the library",
    "library.search.placeholder": "Find a feature or mechanic",
    "library.empty_search": "Nothing found. Try a different word.",
    "library.overview.title": "What makes Satoru different",
    "library.overview.body": "Satoru (Japanese for “awakening”) isn't “just another productivity app.” It's a life tracker and personal secretary, available 24/7. With built-in AI, it helps you not just get things done, but avoid burning out — reminding you about balance across your spheres, rest, and adventure, and suggesting options tailored to you.",
    "library.goals.deferred": "The Goals chapter will show up once the new mechanic and its link to the upcoming questionnaire are approved.",
    "library.disable_prompts.note": "This turns off new contextual tips. The library and chapters you've finished stay available.",

    "a11y.guide_dialog": "Satoru Guide",
    "a11y.guide_status": "Shadow's line",
    "a11y.spotlight_target": "The element Shadow is talking about right now",
    "a11y.shadow_visual": "Shadow · {form}",
    "a11y.shadow_alt": "Shadow, {form} form: {state}",
    "a11y.form.spark": "Spark",
    "a11y.form.spirit": "Spirit",
    "a11y.form.guardian": "Guardian",
    "a11y.form.keeper": "Keeper",
    "a11y.state.arrive": "appears nearby",
    "a11y.state.close_speak": "speaks with the user",
    "a11y.state.listen": "listens",
    "a11y.state.direct": "directs attention",
    "a11y.state.recognize": "recognizes a familiar goal",
    "a11y.state.celebrate": "celebrates a finished task",
    "a11y.state.wait": "waits quietly",
    "a11y.state.return": "greets you after you return"
  });

  function has(key) {
    return Object.prototype.hasOwnProperty.call(COPY, key);
  }

  function get(key) {
    return has(key) ? COPY[key] : null;
  }

  function format(key, variables) {
    const source = get(key);
    if (source == null) return null;
    const values = variables && typeof variables === 'object' ? variables : {};
    return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
    ));
  }

  function entries() {
    return Object.entries(COPY);
  }

  return Object.freeze({
    VERSION,
    LOCALE,
    STATUS,
    COPY,
    CONTEXTUAL_STATUS,
    has,
    get,
    format,
    entries,
  });
});
