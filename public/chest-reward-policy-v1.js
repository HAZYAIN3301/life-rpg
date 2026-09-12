/* Pure daily chest policy. All owner collections are SAVED state supplied by the
 * caller. The server supplies clock, IANA zone and entropy; this module performs
 * no I/O and never reads State, Date.now(), crypto or Math.random(). The existing
 * account WAL and private receipt owner, outside this module, own durable replay. */
(function(root, factory) {
  const api = typeof module === 'object' && module.exports
    ? factory(require('./shop-catalog-v1'), require('./reward-catalog-v1'))
    : factory(root.ShopCatalogV1, root.RewardCatalogV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChestRewardPolicyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Shop, Rewards) {
  'use strict';
  const RARITY_WEIGHTS = Object.freeze({ common: 60, rare: 28, epic: 10, legendary: 2 });
  const TYPE_WEIGHTS = Object.freeze({ gold: 55, cosmetic: 30, voucher: 15 });
  const GOLD_BY_RARITY = Object.freeze({ common: 40, rare: 80, epic: 150, legendary: 300 });
  const THRESHOLDS = Object.freeze([1, 3, 5]), CARRY_CAP = 5, HISTORY_LIMIT = 40;
  const COLLECTION_LIMIT = 100000, WORK_LIMIT = 1000000, DEPTH_LIMIT = 64;
  const MAX = Number.MAX_SAFE_INTEGER;
  const COSMETICS = Shop.FRAMES.concat(Shop.BACKGROUNDS);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.prototype.toString.call(value) === '[object Object]';
  const fail = reason => { throw { chestPolicyError: reason }; };
  function result(operation) {
    try { return operation(); }
    catch (error) { return { ok: false, reason: error?.chestPolicyError || 'chest_invalid_context' }; }
  }
  function exact(value, keys) {
    return record(value) && Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
  }
  function object(value) {
    if (!record(value)) fail('chest_invalid_context');
    for (const key in value) if (!own(value, key)) fail('chest_invalid_context');
    return value;
  }
  function array(value) {
    if (!Array.isArray(value)) fail('chest_invalid_context');
    if (value.length > COLLECTION_LIMIT) fail('chest_capacity');
    return value;
  }
  // Clone only bounded JSON. Keep unknown legacy properties/tokens by value,
  // including __proto__ as an ordinary own key, without executing accessors.
  function jsonCopy(value) {
    const visiting = new Set(); let work = 0;
    function copy(item, depth) {
      if (++work > WORK_LIMIT || depth > DEPTH_LIMIT) fail('chest_capacity');
      if (item === null || typeof item === 'boolean') return item;
      if (typeof item === 'number') {
        if (!Number.isFinite(item)) fail('chest_invalid_context');
        return item;
      }
      if (typeof item === 'string') {
        if (item.length > WORK_LIMIT) fail('chest_capacity');
        return item;
      }
      if (!record(item) && !Array.isArray(item)) fail('chest_invalid_context');
      if (visiting.has(item)) fail('chest_invalid_context');
      visiting.add(item);
      if (Array.isArray(item)) array(item); else object(item);
      const out = Array.isArray(item) ? [] : {};
      for (const key of Object.keys(item)) {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !own(descriptor, 'value')) fail('chest_invalid_context');
        Object.defineProperty(out, key, { value: copy(descriptor.value, depth + 1), enumerable: true, configurable: true, writable: true });
      }
      if (Array.isArray(item) && Object.keys(out).length !== item.length) fail('chest_invalid_context');
      visiting.delete(item);
      return out;
    }
    return copy(value, 0);
  }
  function numeric(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'number' && typeof value !== 'string') fail('chest_invalid_context');
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number) > MAX) fail('chest_invalid_context');
    return number;
  }
  function count(value) {
    const number = numeric(value);
    if (!Number.isSafeInteger(number)) fail('chest_invalid_context');
    return Math.max(0, number);
  }
  function civilDateValid(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false;
    const stamp = Date.parse(value + 'T00:00:00.000Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
  }
  function stamp(value) {
    if (typeof value === 'number') return Number.isSafeInteger(value) ? value : NaN;
    if (typeof value !== 'string' || value.length > 64 || !civilDateValid(value.slice(0, 10))) return NaN;
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return NaN;
    return Date.parse(value);
  }
  function clock(options) {
    if (!record(options)) fail('chest_invalid_time');
    const instant = stamp(options.now);
    if (!Number.isFinite(instant) || !Number.isFinite(new Date(instant).getTime())) fail('chest_invalid_time');
    const zone = options.timeZone;
    if (typeof zone !== 'string' || zone.length > 128 || !/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(zone)) fail('chest_invalid_timezone');
    let formatter;
    try { formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch { fail('chest_invalid_timezone'); }
    const dayAt = value => {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return null;
      const parts = formatter.formatToParts(date);
      const part = kind => parts.find(row => row.type === kind)?.value;
      const day = String(part('year')).padStart(4, '0') + '-' + part('month') + '-' + part('day');
      return civilDateValid(day) ? day : null;
    };
    const day = dayAt(instant);
    if (!day) fail('chest_invalid_time');
    return { day, at: new Date(instant).toISOString(), dayAt };
  }
  function taskDay(task, timer) {
    if (!task.completedAt) return civilDateValid(task.date) ? task.date : null;
    // Old imports also contain date-only completion dates and local ISO times.
    // A date-only Date is UTC, matching dayOf; a local ISO is a civil time in the
    // supplied zone, never the host process's local timezone.
    if (civilDateValid(task.completedAt)) return timer.dayAt(Date.parse(task.completedAt + 'T00:00:00.000Z'));
    if (typeof task.completedAt === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(task.completedAt)) {
      const day = task.completedAt.slice(0, 10);
      return civilDateValid(day) ? day : null;
    }
    const instant = stamp(task.completedAt);
    return Number.isFinite(instant) ? timer.dayAt(instant) : null;
  }
  function activityCount(context, day, timer) {
    let count = 0;
    for (const task of context.tasks) if (task.done && !task.entry && taskDay(task, timer) === day) count++;
    const logged = own(context.habitlog, day) ? context.habitlog[day] : null;
    // Preserve the existing fact model: a present habitlog key is a check-in,
    // even if a legacy entry's payload is 0/false. Do not invent habit rewards.
    if (logged != null) count += Object.keys(object(logged)).length;
    return count;
  }
  function goldBonus(context) {
    let total = 0;
    for (const tree of Object.values(context.skilltree)) {
      let area = 0;
      for (const node of (tree.nodes || [])) {
        const kind = node.kind === 'practice' || node.kind === 'capability' ? node.kind : node.milestone === true ? 'capability' : 'practice';
        if (!node.unlocked || kind !== 'practice') continue;
        for (const perk of (node.perks || [])) {
          if (perk.kind !== 'dailyRewardGoldPct') continue;
          area += numeric(perk.val);
          if (!Number.isFinite(area) || Math.abs(area) > MAX) fail('chest_invalid_context');
        }
      }
      // Existing skillPerks caps each area first; negative legacy values are
      // retained in the sum before the final global 0..30 cap.
      total += Math.min(30, area);
      if (!Number.isFinite(total) || Math.abs(total) > MAX) fail('chest_invalid_context');
    }
    return Math.min(30, Math.max(0, total));
  }
  function prepare(context, options) {
    object(context);
    const owner = {};
    for (const name of ['settings', 'tasks', 'habitlog', 'skilltree', 'lootbox']) {
      if (context[name] !== undefined) owner[name] = context[name];
    }
    const saved = jsonCopy(owner), timer = clock(options);
    saved.settings = saved.settings === undefined ? {} : object(saved.settings);
    saved.tasks = saved.tasks === undefined ? [] : array(saved.tasks);
    saved.habitlog = saved.habitlog === undefined ? {} : object(saved.habitlog);
    saved.skilltree = saved.skilltree === undefined ? {} : object(saved.skilltree);
    for (const task of saved.tasks) object(task);
    for (const tree of Object.values(saved.skilltree)) {
      object(tree);
      if (tree.nodes !== undefined) for (const node of array(tree.nodes)) {
        object(node);
        if (node.perks !== undefined) for (const perk of array(node.perks)) object(perk);
      }
    }
    if (saved.settings.cosmetics != null) array(saved.settings.cosmetics);
    const lb = saved.lootbox === undefined
      ? { day: timer.day, opened: 0, goldWon: 0, boost: null, titles: [], equipped: null, history: [], carry: 0 }
      : object(saved.lootbox);
    lb.carry = Math.min(CARRY_CAP, count(lb.carry));
    lb.opened = count(lb.opened);
    lb.goldWon = numeric(lb.goldWon);
    if (lb.cosmeticsWon !== undefined) lb.cosmeticsWon = count(lb.cosmeticsWon);
    if (!Array.isArray(lb.vouchers)) {
      const legacy = Math.max(0, Math.floor(numeric(lb.vouchers)));
      if (legacy > COLLECTION_LIMIT) fail('chest_capacity');
      lb.vouchers = Array.from({ length: legacy }, () => 'common');
    } else array(lb.vouchers);
    if (lb.history == null) lb.history = [];
    else array(lb.history);
    if (!lb.economyV124) { delete lb.customWeights; lb.economyV124 = true; }
    const validPrevious = civilDateValid(lb.day);
    if (validPrevious && lb.day > timer.day) fail('chest_future_day');
    if (lb.day !== timer.day) {
      const previousEarned = validPrevious ? THRESHOLDS.filter(threshold => activityCount(saved, lb.day, timer) >= threshold).length : 0;
      lb.carry = Math.min(CARRY_CAP, Math.max(0, previousEarned + lb.carry - lb.opened));
      lb.day = timer.day; lb.opened = 0;
    }
    const activity = activityCount(saved, timer.day, timer);
    const earned = THRESHOLDS.filter(threshold => activity >= threshold).length;
    return { saved, timer, lootbox: lb, day: timer.day, activity, earned,
      available: Math.max(0, earned + lb.carry - lb.opened), bonusPct: goldBonus(saved) };
  }
  function publicState(state) {
    return { ok: true, lootbox: state.lootbox, day: state.day, activity: state.activity,
      earned: state.earned, available: state.available, bonusPct: state.bonusPct };
  }
  function normalize(context, options) { return result(() => publicState(prepare(context, options))); }
  function typesFor(state, rarity) {
    const owned = state.saved.settings.cosmetics || [];
    const cosmetics = COSMETICS.filter(item => item.rarity === rarity && !owned.includes(item.id));
    const rewards = Rewards.byRarity(rarity);
    const types = ['gold'];
    if (cosmetics.length) types.push('cosmetic');
    if (rewards.length) types.push('voucher');
    return { cosmetics, rewards, types };
  }
  function odds(context, options) {
    return result(() => {
      const state = prepare(context, options);
      return { ok: true, rows: Rewards.RARITY_ORDER.map(rarity => {
        const pool = typesFor(state, rarity), total = pool.types.reduce((sum, kind) => sum + TYPE_WEIGHTS[kind], 0);
        return { rarity, pct: RARITY_WEIGHTS[rarity],
          types: pool.types.map(kind => ({ kind, pct: TYPE_WEIGHTS[kind] / total * 100 })),
          cosmetics: pool.cosmetics.length, rewards: pool.rewards.length, gold: GOLD_BY_RARITY[rarity] };
      }) };
    });
  }
  function pick(values, weights, unit) {
    const total = values.reduce((sum, value) => sum + weights[value], 0);
    let cursor = unit * 100;
    // Preserve the original normalized percentages and inclusive boundary,
    // including their floating-point behavior at exactly 0.55/0.85.
    for (const value of values) { cursor -= weights[value] / total * 100; if (cursor <= 0) return value; }
    return values[values.length - 1];
  }
  function drawnPrize(state, entropy) {
    if (!Array.isArray(entropy) || entropy.length !== 3 || Object.keys(entropy).join(',') !== '0,1,2'
      || entropy.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1)) fail('chest_invalid_entropy');
    const rarity = pick(Rewards.RARITY_ORDER, RARITY_WEIGHTS, entropy[0]);
    const pool = typesFor(state, rarity), kind = pick(pool.types, TYPE_WEIGHTS, entropy[1]);
    if (kind === 'cosmetic') return { type: 'cosmetic_capsule', rarity, cosmeticId: pool.cosmetics[Math.floor(entropy[2] * pool.cosmetics.length)].id };
    if (kind === 'voucher') return { type: 'reward_voucher', rarity, rewardName: pool.rewards[Math.floor(entropy[2] * pool.rewards.length)].name };
    return { type: 'gold', rarity, amount: Math.round(GOLD_BY_RARITY[rarity] * (1 + state.bonusPct / 100)) };
  }
  function draw(context, options) {
    return result(() => {
      const state = prepare(context, options);
      if (!state.available) fail('chest_unavailable');
      return { ...publicState(state), prize: drawnPrize(state, options.entropy) };
    });
  }
  function prizeValid(prize) {
    if (!record(prize) || !Rewards.RARITY_ORDER.includes(prize.rarity)) return false;
    if (prize.type === 'gold') return exact(prize, ['type', 'rarity', 'amount'])
      && Number.isSafeInteger(prize.amount) && prize.amount >= GOLD_BY_RARITY[prize.rarity]
      && prize.amount <= Math.round(GOLD_BY_RARITY[prize.rarity] * 1.3);
    if (prize.type === 'cosmetic_capsule') return exact(prize, ['type', 'rarity', 'cosmeticId'])
      && COSMETICS.some(item => item.id === prize.cosmeticId && item.rarity === prize.rarity);
    if (prize.type === 'reward_voucher') return exact(prize, ['type', 'rarity', 'rewardName'])
      && Rewards.byRarity(prize.rarity).some(item => item.name === prize.rewardName);
    return false;
  }
  function requestIdValid(value) { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value); }
  function applyPrize(state, options, prize) {
    if (!requestIdValid(options.requestId)) fail('chest_invalid_request_id');
    if (!state.available) fail('chest_unavailable');
    if (!prizeValid(prize)) fail('chest_invalid_prize');
    const next = state.lootbox;
    if (next.history.some(row => record(row) && row.requestId === options.requestId)) fail('chest_request_already_applied');
    const data = { lootbox: next };
    if (prize.type === 'gold') {
      const amount = Math.round(GOLD_BY_RARITY[prize.rarity] * (1 + state.bonusPct / 100));
      if (prize.amount !== amount) fail('chest_invalid_prize');
      const value = next.goldWon + amount;
      if (!Number.isFinite(value) || Math.abs(value) > MAX || value - next.goldWon !== amount) fail('chest_capacity');
      next.goldWon = value;
    } else if (prize.type === 'reward_voucher') {
      if (next.vouchers.length >= COLLECTION_LIMIT) fail('chest_capacity');
      next.vouchers.push(prize.rarity);
    } else {
      const settings = state.saved.settings;
      if ((settings.cosmetics || []).includes(prize.cosmeticId)) fail('chest_invalid_prize');
      if ((settings.cosmetics || []).length >= COLLECTION_LIMIT) fail('chest_capacity');
      settings.cosmetics = [...(settings.cosmetics || []), prize.cosmeticId];
      next.cosmeticsWon = count(next.cosmeticsWon) + 1;
      if (!Number.isSafeInteger(next.cosmeticsWon)) fail('chest_capacity');
      data.settings = settings;
    }
    next.opened++;
    if (!Number.isSafeInteger(next.opened)) fail('chest_capacity');
    // Keep history readable in old clients. Numbers and catalogue names do not
    // contain server-selected locale; current clients localize the neutral prize.
    const label = prize.type === 'gold' ? '+' + prize.amount : prize.type === 'reward_voucher' ? prize.rewardName
      : COSMETICS.find(item => item.id === prize.cosmeticId).name;
    const historyEntry = { requestId: options.requestId, at: state.timer.at, prize: { ...prize },
      label, rarity: prize.rarity, deterministic: false, cosmeticId: prize.cosmeticId || null };
    next.history = [historyEntry, ...next.history].slice(0, HISTORY_LIMIT);
    return { ok: true, prize: { ...prize }, historyEntry, data, day: state.day,
      available: state.available, remaining: state.available - 1 };
  }
  function grant(context, options) {
    return result(() => {
      const state = prepare(context, options);
      if (!state.available) fail('chest_unavailable');
      if (own(options, 'prize') && own(options, 'entropy')) fail('chest_invalid_entropy');
      return applyPrize(state, options, own(options, 'prize') ? jsonCopy(options.prize) : drawnPrize(state, options.entropy));
    });
  }
  // Receipt validation cannot reproduce server entropy. It can and must verify
  // the exact allowed transition for the disclosed prize from the saved base.
  function transition(context, options, prize) {
    return result(() => applyPrize(prepare(context, options), options, jsonCopy(prize)));
  }
  function same(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
    return ak.length === bk.length && ak.every((key, index) => key === bk[index] && same(a[key], b[key]));
  }
  function grantValid(context, options, candidate) {
    return result(() => {
      const safe = jsonCopy(candidate);
      const expected = transition(context, options, safe.prize);
      if (!expected.ok) return { ok: true, valid: false };
      const projection = exact(safe, ['prize', 'at', 'day', 'remaining', 'data']);
      const comparison = projection ? { prize: expected.prize, at: expected.historyEntry.at,
        day: expected.day, remaining: expected.remaining, data: expected.data } : expected;
      return { ok: true, valid: same(safe, comparison) };
    }).valid === true;
  }
  return Object.freeze({ RARITY_WEIGHTS, TYPE_WEIGHTS, GOLD_BY_RARITY, THRESHOLDS, CARRY_CAP, HISTORY_LIMIT,
    COLLECTION_LIMIT, civilDateValid, requestIdValid, normalize, odds, draw, grant, transition, prizeValid, grantValid });
});
