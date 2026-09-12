/* Personal XP only: the existing app's xpEvents/overallXp/levelInfo, without UI or
 * leaderboard rules. snapshot accepts raw owner collections (goals may already be
 * normalized). Missing collections are empty; explicit null owner slots are invalid.
 * settings.curve uses the app defaults (including the legacy nested null fallback).
 * Success is {ok:true, earnedXp, importedXp, overallXp, level, into, need, pct, curve}.
 * Malformed inputs, unsafe arithmetic and exhausted work bounds return {ok:false,error};
 * callers must keep previously owned entitlements and must NOT substitute level 1.
 * No mutation, clock, persistence, reward creation, attention episodes or network.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PersonalProgressV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT_CURVE = Object.freeze({ base: 100, growth: 1.3 });
  const GOAL_XP = Object.freeze({ mission: 40000, vision: 12000, path: 4000, long: 1200, mid: 300, short: 75, recurring: 15 });
  const EPISODE_XP = Object.freeze([0, 8, 18, 32, 50, 72]);
  const MAX = Number.MAX_SAFE_INTEGER;
  // Bounds protect synchronous browser/server callers; exhaustion never yields a
  // guessed level. Constant curves have an exact, non-iterative path below.
  const WORK_LIMIT = 1000000, LEVEL_LIMIT = 100000;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function fail(error) { throw { personalProgressError: error }; }
  function object(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.prototype.toString.call(value) !== '[object Object]') fail('invalid_' + name);
    // Owner snapshots are JSON records. Inherited enumerable data must not become XP.
    for (const key in value) if (!own(value, key)) fail('invalid_' + name);
    return value;
  }
  function array(value, name) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) fail('invalid_' + name);
    if (value.length > WORK_LIMIT) fail('work_limit');
    return value;
  }
  function id(value, name) {
    if (value != null && typeof value !== 'string') fail('invalid_' + name);
    return value;
  }
  function ids(value, name) {
    return array(value, name).map(value => id(value, name));
  }
  function xp(value, name, fallback = 0) {
    if (value == null) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX) fail('invalid_' + name);
    return value;
  }
  function civilDay(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('invalid_episode_date');
    const stamp = Date.parse(value + 'T00:00:00.000Z');
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value) fail('invalid_episode_date');
    return stamp / 86400000;
  }
  function intensity(value) {
    if (value == null || value === '') return 0;
    // The existing episode editor/import reads numeric strings with Number().
    if (typeof value !== 'number' && typeof value !== 'string') fail('invalid_episode_intensity');
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) fail('invalid_episode_intensity');
    return Math.max(0, Math.min(5, Math.round(numeric)));
  }
  function levelInfo(total, curve) {
    const { base, growth } = curve;
    if (typeof base !== 'number' || !Number.isFinite(base) || base <= 0
      || typeof growth !== 'number' || !Number.isFinite(growth) || growth <= 0) fail('invalid_curve');
    let level = 1, into = Math.floor(total), need;
    const nextNeed = () => {
      const value = Math.round(base * Math.pow(growth, level - 1));
      if (!Number.isSafeInteger(value) || value < 1) fail('unsafe_curve');
      return value;
    };
    need = nextNeed();
    if (growth === 1) {
      level += Math.floor(into / need);
      if (!Number.isSafeInteger(level)) fail('unsafe_curve');
      into %= need;
    } else {
      while (into >= need) {
        if (level >= LEVEL_LIMIT) fail('curve_limit');
        into -= need; level++; need = nextNeed();
      }
    }
    return { level, into, need, pct: Math.round((into / need) * 100) };
  }
  function snapshot(context = {}) {
    try {
      object(context, 'context');
      for (const key of ['settings', 'tasks', 'habits', 'habitlog', 'goals', 'episodes']) {
        if (context[key] === null) fail('invalid_' + key);
      }
      const settings = context.settings === undefined ? {} : object(context.settings, 'settings');
      const curveInput = settings.curve == null ? {} : object(settings.curve, 'curve');
      const merged = Object.assign({}, DEFAULT_CURVE, curveInput);
      const curve = { base: merged.base, growth: merged.growth };
      // Validate an unsafe initial requirement even for an empty account.
      levelInfo(0, curve);
      let work = 0, earnedXp = 0, importedXp = 0;
      function step(count = 1) { work += count; if (work > WORK_LIMIT) fail('work_limit'); }
      function sum(a, b) { const next = a + b; if (!Number.isFinite(next) || next > MAX) fail('unsafe_xp'); return next; }
      function earn(value) { step(); earnedXp = sum(earnedXp, value); }
      function share(total, count) {
        // Same order and individual allocation as shareInt + xpEvents.reduce.
        const base = Math.floor(total / count), remainder = total % count;
        for (let i = 0; i < count; i++) earn(base + (i < remainder ? 1 : 0));
      }
      const skills = array(settings.skills, 'skills');
      step(skills.length);
      const known = new Set(), layerSkills = new Map();
      for (const skill of skills) {
        object(skill, 'skill'); id(skill.id, 'skill_id');
        if (!skill.id) fail('invalid_skill_id');
        known.add(skill.id);
        // skillById uses the FIRST existing record, including its missing flag.
        if (!layerSkills.has(skill.id)) layerSkills.set(skill.id, !skill.missing);
      }
      const tasks = array(context.tasks, 'tasks'); step(tasks.length);
      for (const task of tasks) {
        object(task, 'task');
        if (task.done != null && typeof task.done !== 'boolean') fail('invalid_task_done');
        const primary = ids(task.skillIds, 'task_skills'); id(task.skillId, 'task_skill');
        const main = primary.length ? primary : task.skillId ? [task.skillId] : [];
        const layers = ids(task.layers, 'task_layers'); step(main.length + layers.length);
        const primarySet = new Set(main);
        const awarded = xp(task.xpAwarded, 'task_xp');
        if (!task.done) continue;
        if (main.length <= 1) earn(awarded); else share(awarded, main.length);
        let count = 0;
        for (const layer of layers) {
          if (!layer || primarySet.has(layer) || !layerSkills.get(layer)) continue;
          earn(Math.max(1, Math.round(awarded * 0.2)));
          if (++count === 3) break;
        }
      }
      // Habit definitions affect the event's sphere, never its total stored XP.
      const habits = array(context.habits, 'habits'); step(habits.length);
      for (const habit of habits) { object(habit, 'habit'); id(habit.id, 'habit_id'); }
      const log = context.habitlog == null ? {} : object(context.habitlog, 'habitlog');
      for (const date of Object.keys(log)) {
        step(); const records = object(log[date], 'habitlog_day');
        for (const hid of Object.keys(records)) {
          object(records[hid], 'habitlog_record');
          earn(xp(records[hid].xp, 'habitlog_xp'));
        }
      }
      const goals = array(context.goals, 'goals'); step(goals.length);
      for (const goal of goals) {
        object(goal, 'goal'); id(goal.type, 'goal_type'); id(goal.skillId, 'goal_skill');
        const skillIds = ids(goal.skillIds, 'goal_skills'); step(skillIds.length);
        if (goal.completedAt != null && typeof goal.completedAt !== 'string') fail('invalid_goal_completion');
        const type = goal.type || 'mid';
        if (goal.xpReward === undefined && type in GOAL_XP && !own(GOAL_XP, type)) fail('invalid_goal_type');
        const fallback = own(GOAL_XP, type) ? GOAL_XP[type] : 60;
        const reward = goal.xpReward === undefined ? fallback : xp(goal.xpReward, 'goal_xp', 60);
        if (!goal.completedAt) continue;
        // normalizeLoadedGoals first repairs raw main skills, then goalSkillIds
        // filters/deduplicates them again. A valid legacy skillId is its fallback.
        let main = [...new Set((skillIds.length ? skillIds : [goal.skillId]).filter(value => known.has(value)))];
        if (!main.length && known.has(goal.skillId)) main = [goal.skillId];
        share(reward, main.length || 1);
      }
      const episodes = array(context.episodes, 'episodes'); step(episodes.length);
      for (const episode of episodes) {
        object(episode, 'episode');
        const from = civilDay(episode.from), to = civilDay(episode.to);
        const profile = array(episode.profile, 'episode_profile'); step(profile.length);
        const rows = [];
        for (const entry of profile) {
          object(entry, 'episode_profile_row'); id(entry.skillId, 'episode_skill');
          const level = intensity(entry.intensity);
          if (entry.skillId && level > 0) rows.push(EPISODE_XP[level]);
        }
        if (from === null || to === null || to < from) continue;
        const days = Math.min(60, to - from + 1);
        const raw = rows.reduce((total, value) => total + value, 0);
        const scale = raw > 250 ? 250 / raw : 1;
        const perDay = rows.map(value => Math.max(1, Math.round(value * scale)));
        // Civil-day ordinals avoid elapsed-hour/DST errors. Keep the app's event
        // summation order and per-row rounding (the scaled total can exceed 250).
        step(days * perDay.length);
        for (let day = 0; day < days; day++) for (const value of perDay) earnedXp = sum(earnedXp, value);
      }
      const imported = settings.imported == null ? {} : object(settings.imported, 'imported');
      for (const key of Object.keys(imported)) {
        step(); object(imported[key], 'imported_record');
        importedXp = sum(importedXp, xp(imported[key].xp, 'imported_xp'));
      }
      const overallXp = sum(earnedXp, importedXp);
      return { ok: true, earnedXp, importedXp, overallXp, ...levelInfo(overallXp, curve), curve };
    } catch (error) {
      return { ok: false, error: error && error.personalProgressError || 'invalid_context' };
    }
  }
  return Object.freeze({ snapshot });
});
