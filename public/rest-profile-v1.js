/* Satoru Rest Profile v1 — рецепты отдыха с дешёвым входом (SECRETARY-OS-PAIN-MAP BH-02).
 *
 * Разбор 01.09 переформулировал задачу. Владелец пишет «я не знаю, как отдыхать»,
 * и это выглядит как проблема выбора — значит, дать меню. Но меню предполагает, что
 * навык уже есть. Если бы прогулка надёжно давала то же, что игра, он бы уже гулял.
 *
 * Игра выигрывает не по предпочтению, а по двум измеримым свойствам: **нулевая
 * энергия входа** и **гарантированная отдача**. У прогулки вход дорогой (одеться,
 * решить маршрут, выйти), а отдача неизвестна. В момент нулевого ресурса это не
 * соревнование, и никакой список вариантов его не выравнивает.
 *
 * Поэтому модуль устроен не как каталог, а как **машина снижения энергии входа**:
 *
 *  — у рецепта есть `setup` — что должно быть готово ЗАРАНЕЕ, чтобы вход стал дешёвым
 *    (плейлист открыт, одежда у двери, маршрут выбран). Это и есть работа, которую
 *    делает ресурсный человек за истощённого;
 *  — `steps` — не больше трёх, первый обязан быть выполним за минуту;
 *  — при истощении отдаётся ОДИН рецепт, а не список: стоимость выбора и есть та
 *    самая связанность рук, о которой писал владелец.
 *
 * ⚠️ Что модуль НЕ делает:
 *  — не объявляет цифровой отдых плохим. Игра и фильм — законные рецепты; значение
 *    имеет конечность и то, что было после, а не носитель;
 *  — не заставляет заслуживать отдых. Право на базовый отдых не зависит от сделанного
 *    (гейт против «Лотереи мёда» в текущем виде);
 *  — не считает XP, золото и серию. Здесь нет функции, к которой это подключается;
 *  — не решает, отдохнул ли человек. Он отвечает сам, и ответ разделён на четыре
 *    независимых вопроса — «вовремя закончил» не равно «восстановился».
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State/времени сам.
 */
(function exposeRestProfile(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RestProfileV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildRestProfile() {
  'use strict';

  const VERSION = '1.0.0';

  // Больше пяти — снова каталог и снова стоимость выбора. Меньше трёх — нечего
  // чередовать, и единственный рецепт быстро приедается.
  const MAX_RECIPES = 5;
  const MAX_STEPS = 3;
  const MAX_TEXT = 90;
  const MIN_MINUTES = 5;
  const MAX_MINUTES = 240;

  /* Носитель. Не оценка, а факт: от него зависит, нужна ли граница и какой канал
   * её исполнит. Цифровой отдых требует внешнего исполнителя (расширение, таймер),
   * офлайновый обходится сигналом. */
  const MODES = Object.freeze(['offline', 'device', 'mixed']);

  /* Четыре независимых исхода. Разделены намеренно: «закончил вовремя» и
   * «восстановился» — разные вещи, и смешивать их значит потерять весь замер. */
  const OUTCOME_FIELDS = Object.freeze(['ended', 'pleasant', 'effect', 'regret']);
  const ENDED = Object.freeze(['at_boundary', 'extended_once', 'overran', 'unknown']);
  const PLEASANT = Object.freeze(['yes', 'partly', 'no', 'unknown']);
  const EFFECT = Object.freeze(['better', 'same', 'worse', 'unknown']);
  const REGRET = Object.freeze(['none', 'some', 'strong', 'unknown']);

  function text(v, max) {
    const raw = typeof v === 'string' ? v : '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, max === undefined ? MAX_TEXT : max);
  }
  function minutes(v, fallback) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n));
  }
  function pick(list, v) { return list.indexOf(String(v)) >= 0 ? String(v) : list[list.length - 1]; }

  /**
   * Рецепт. `setup` — самое важное поле и единственная причина, по которой этот
   * модуль вообще существует: без подготовки заранее дешёвого входа не бывает.
   */
  function sanitizeRecipe(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = text(raw.id, 40);
    const title = text(raw.title, 60);
    if (!id || !title) return null;
    const steps = (Array.isArray(raw.steps) ? raw.steps : [])
      .map((s) => text(s)).filter(Boolean).slice(0, MAX_STEPS);
    return {
      id,
      title,
      mode: pick(MODES, raw.mode) === MODES[MODES.length - 1] && MODES.indexOf(String(raw.mode)) < 0 ? 'offline' : String(raw.mode),
      defaultMinutes: minutes(raw.defaultMinutes, 30),
      // Что должно быть готово заранее. Пусто — значит вход дорогой, и модуль это видит.
      setup: text(raw.setup, MAX_TEXT),
      steps,
      // Сколько раз рецепт реально сработал. Только для порядка выдачи, не для оценки.
      worked: Math.max(0, Math.min(999, Math.round(Number(raw.worked)) || 0)),
      tried: Math.max(0, Math.min(999, Math.round(Number(raw.tried)) || 0)),
      archived: !!raw.archived,
    };
  }

  function emptyProfile() { return { version: 1, recipes: [] }; }

  function sanitizeProfile(raw) {
    if (!raw || typeof raw !== 'object' || Number(raw.version) !== 1) return null;
    if (!Array.isArray(raw.recipes)) return null;
    const recipes = [];
    const seen = new Set();
    for (let i = 0; i < raw.recipes.length; i += 1) {
      const r = sanitizeRecipe(raw.recipes[i]);
      if (!r) return null;
      if (seen.has(r.id)) return null;
      seen.add(r.id);
      recipes.push(r);
    }
    return { version: 1, recipes };
  }

  function live(profile) {
    const base = sanitizeProfile(profile) || emptyProfile();
    return base.recipes.filter((r) => !r.archived);
  }

  function add(profile, raw) {
    const base = sanitizeProfile(profile) || emptyProfile();
    const r = sanitizeRecipe(raw);
    if (!r) return null;
    if (base.recipes.some((x) => x.id === r.id)) return null;
    if (live(base).length >= MAX_RECIPES) return null;
    return { version: 1, recipes: base.recipes.concat([r]) };
  }

  /**
   * Насколько дёшев вход. Это и есть та величина, ради которой модуль написан:
   * при истощении выигрывает не любимый рецепт, а самый дешёвый.
   *
   * Считается из подготовки, длины первого шага и носителя — а НЕ из того, как
   * часто рецепт «работал». Популярность здесь ничего не значит: игра популярна
   * именно потому, что дешева, и оптимизировать по популярности значит вернуться
   * к тому же кругу.
   *
   * @returns {number} 0..1, больше — дешевле вход
   */
  function entryEase(recipe) {
    const r = sanitizeRecipe(recipe);
    if (!r) return 0;
    let score = 0.2;
    // Подготовлено заранее — главный вклад.
    if (r.setup) score += 0.4;
    // Один короткий шаг вместо трёх.
    if (r.steps.length <= 1) score += 0.2;
    else if (r.steps.length === 2) score += 0.1;
    // Короткое окно проще начать, чем длинное.
    if (r.defaultMinutes <= 20) score += 0.2;
    else if (r.defaultMinutes <= 45) score += 0.1;
    return Math.min(1, Math.round(score * 100) / 100);
  }

  /**
   * Один рецепт для момента истощения. Не список.
   *
   * `avoidId` — то, чем человек уже занимался прямо сейчас: предлагать то же самое
   * бессмысленно. `preferOffline` включается, когда носитель уже был экраном.
   *
   * Возвращает null, если рецептов нет — и это честно: выдумывать отдых за человека
   * модуль не станет, вызывающий предложит настроить один рецепт за две минуты.
   */
  function pickForLowResource(profile, options) {
    const opts = options || {};
    let pool = live(profile);
    if (opts.avoidId) pool = pool.filter((r) => r.id !== opts.avoidId);
    if (opts.preferOffline) {
      const offline = pool.filter((r) => r.mode === 'offline');
      if (offline.length) pool = offline;
    }
    if (!pool.length) return null;
    // Порядок: дешевле вход → короче окно → стабильный id, чтобы выдача не скакала
    // между рендерами и не «меняла совет» на глазах у человека.
    const sorted = pool.slice().sort((a, b) => {
      const d = entryEase(b) - entryEase(a);
      if (d) return d;
      const m = a.defaultMinutes - b.defaultMinutes;
      if (m) return m;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return sorted[0];
  }

  /** Рецепты без подготовки — те, у которых вход дорогой. Материал для спокойной правки. */
  function needSetup(profile) {
    return live(profile).filter((r) => !r.setup);
  }

  function sanitizeOutcome(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const recipeId = text(raw.recipeId, 40);
    if (!recipeId) return null;
    return {
      recipeId,
      at: typeof raw.at === 'string' && !isNaN(Date.parse(raw.at)) ? raw.at : new Date(0).toISOString(),
      ended: pick(ENDED, raw.ended),
      pleasant: pick(PLEASANT, raw.pleasant),
      effect: pick(EFFECT, raw.effect),
      regret: pick(REGRET, raw.regret),
      note: text(raw.note, MAX_TEXT),
    };
  }

  /**
   * Сводка по рецепту. Отдаёт сырые числа со знаменателем — как во всех модулях
   * проекта: «3 из 4 записанных» показывается целиком, иначе цифра врёт.
   *
   * `unknown` не входит в знаменатель: неотмеченный отдых не является неудачным.
   */
  function summarize(outcomes, recipeId) {
    const list = (Array.isArray(outcomes) ? outcomes : [])
      .map(sanitizeOutcome).filter((o) => o && (!recipeId || o.recipeId === recipeId));
    const count = (field, value) => list.filter((o) => o[field] === value).length;
    const known = (field) => list.filter((o) => o[field] !== 'unknown').length;
    return {
      recorded: list.length,
      endedAtBoundary: count('ended', 'at_boundary'),
      endedKnown: known('ended'),
      pleasantYes: count('pleasant', 'yes'),
      pleasantKnown: known('pleasant'),
      effectBetter: count('effect', 'better'),
      effectKnown: known('effect'),
      regretNone: count('regret', 'none'),
      regretKnown: known('regret'),
    };
  }

  return Object.freeze({
    VERSION, MAX_RECIPES, MAX_STEPS, MAX_TEXT, MIN_MINUTES, MAX_MINUTES,
    MODES, OUTCOME_FIELDS, ENDED, PLEASANT, EFFECT, REGRET,
    emptyProfile, sanitizeRecipe, sanitizeProfile, sanitizeOutcome,
    live, add, entryEase, pickForLowResource, needSetup, summarize,
  });
});
