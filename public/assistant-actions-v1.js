/* Satoru Assistant Actions v1 — что ассистенту РАЗРЕШЕНО делать в приложении.
 *
 * Просьба Альберта: «чтобы он умел делать действия по запросу, но чтобы запрос типа
 * "уничтожь приложение" или "удали профиль пользователя X" он сделать не мог».
 *
 * Ключевое проектное решение, из которого следует всё остальное:
 *
 *   ⚠️ У АССИСТЕНТА НЕТ ГЛАГОЛА «УДАЛИТЬ». ВООБЩЕ.
 *
 * Не «удаление требует подтверждения», не «удаление запрещено промптом» — его просто
 * нет в языке, на котором ассистент разговаривает с приложением. Нельзя злоупотребить
 * командой, которой не существует. Всё, что ассистент умеет, либо создаёт новое, либо
 * обратимо меняет статус существующего; необратимое человек делает руками в интерфейсе.
 *
 * Почему именно так, а не «список запрещённых слов»:
 *  — системный промпт присылает КЛИЕНТ (`/api/ai/chat` принимает `b.system`), значит
 *    любые правила «не делай X», записанные в промпте, — это соглашение, а не защита;
 *  — модель можно уговорить, запутать или подставить ей чужой текст (юзер пересказывает
 *    статью, в статье инструкция). Blacklist проигрывает изобретательности, whitelist —
 *    нет: неизвестный вид действия просто не имеет исполнителя;
 *  — цена ошибки несимметрична. Лишний созданный квест человек удалит за две секунды;
 *    удалённая цель с историей не восстанавливается ничем.
 *
 * Второе решение: **действие обязано ссылаться на объект по id**, а не по описанию.
 * «Убери цели про Jugend Forscht» превращается в конкретные id ДО того, как что-то
 * произойдёт, и человек видит, что именно будет затронуто. Свободный текст в качестве
 * цели («все цели, где встречается X») не принимается: это тот самый способ случайно
 * задеть не то, и ровно от него страдает пример из просьбы Альберта.
 *
 * Третье: id проверяется по списку СВОИХ объектов, который передаёт вызывающий.
 * Ассистент физически не может адресовать чужое — чужих id в этом списке нет.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ исполняет действия: только проверяет и нормализует. Исполняет вызывающий;
 *  — НЕ применяет ничего сам и не «подтверждает за человека»: каждое действие
 *    показывается карточкой и ждёт нажатия (как уже работает сегодня);
 *  — НЕ содержит ни одного вида, который что-либо удаляет, сбрасывает или трогает
 *    аккаунт, ключи, пароли и настройки приватности.
 *
 * Чистый модуль: только данные на входе. Все операции иммутабельны.
 */
(function exposeAssistantActions(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AssistantActionsV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAssistantActions() {
  'use strict';

  const VERSION = '1.0.0';

  // Столько же, сколько принимал старый парсер: больше пяти карточек за ответ —
  // это уже не помощь, а список дел, который человек не прочитает.
  const MAX_ACTIONS = 5;
  const MAX_TITLE = 120;

  /**
   * Полный словарь. Всё, чего здесь нет, исполнить невозможно.
   *
   * `tier`:
   *   create — создаёт новое, ничего существующего не трогает;
   *   modify — обратимо меняет статус существующего объекта по id.
   *
   * Уровня «destructive» НЕ СУЩЕСТВУЕТ, и это не упущение — см. шапку.
   */
  const KINDS = Object.freeze({
    quest:            { tier: 'create' },
    habit:            { tier: 'create' },
    goal:             { tier: 'create' },
    goal_pause:       { tier: 'modify', target: 'goal' },
    goal_resume:      { tier: 'modify', target: 'goal' },
    goal_archive:     { tier: 'modify', target: 'goal' },   // обратимо: цель уходит из активных, история цела
    quest_reschedule: { tier: 'modify', target: 'quest' },
    quest_done:       { tier: 'modify', target: 'quest' },
    habit_pause:      { tier: 'modify', target: 'habit' },
    habit_resume:     { tier: 'modify', target: 'habit' },
  });

  const KIND_LIST = Object.freeze(Object.keys(KINDS));
  const DIFFICULTY = Object.freeze(['easy', 'normal', 'hard']);
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

  const isDay = (s) => typeof s === 'string' && ISO_DAY.test(s);
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const clampInt = (v, lo, hi, dflt) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };

  /**
   * Причины отказа. Возвращаются кодом, а не текстом: сообщение человеку собирает UI
   * на его языке. `refused_kind` намеренно отделён от `unknown_kind` — первое означает
   * «ассистент попросил то, чего ему не положено», и это стоит показать честно, а не
   * прятать: человек должен знать, что приложение отказало, а не «не поняло».
   */
  const REASONS = Object.freeze({
    NOT_OBJECT: 'not_object',
    UNKNOWN_KIND: 'unknown_kind',
    REFUSED_KIND: 'refused_kind',
    NO_TITLE: 'no_title',
    NO_TARGET: 'no_target',
    TARGET_NOT_FOUND: 'target_not_found',
    TARGET_WRONG_TYPE: 'target_wrong_type',
  });

  /**
   * Виды, которые ассистент может попытаться назвать, а мы обязаны узнать и отказать
   * ЯВНО. Это не механизм защиты — защита в том, что исполнителя нет ни для чего вне
   * `KINDS`. Это список для честного сообщения «я так не умею» вместо молчаливого
   * игнора, плюс сигнал в телеметрию, если модель начнёт такое предлагать.
   */
  const KNOWN_REFUSALS = Object.freeze([
    'delete', 'remove', 'destroy', 'wipe', 'reset', 'drop', 'purge',
    'delete_account', 'delete_user', 'delete_goal', 'delete_quest', 'delete_habit',
    'logout', 'export', 'share', 'publish',
    'set_password', 'change_password', 'set_key', 'api_key', 'grant_pro', 'admin',
    'set_privacy', 'leaderboard_publish', 'invite',
  ]);

  function looksRefused(kind) {
    const k = String(kind || '').toLowerCase();
    return KNOWN_REFUSALS.some((bad) => k === bad || k.startsWith(bad + '_') || k.endsWith('_' + bad));
  }

  /**
   * @param {object} raw            что предложил ассистент
   * @param {object} ctx
   * @param {Array}  ctx.goals      свои цели  [{id, title}]
   * @param {Array}  ctx.quests     свои квесты
   * @param {Array}  ctx.habits     свои привычки
   * @param {Array}  ctx.spheres    свои сферы [{id, name}]
   * @param {string} ctx.today      YYYY-MM-DD
   */
  function validate(raw, ctx) {
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: REASONS.NOT_OBJECT };

    const kind = String(raw.kind || '');
    if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) {
      return { ok: false, reason: looksRefused(kind) ? REASONS.REFUSED_KIND : REASONS.UNKNOWN_KIND, kind };
    }
    const spec = KINDS[kind];

    if (spec.tier === 'modify') {
      // Цель адресуется ТОЛЬКО по id из списка своих объектов. Свободный текст здесь
      // не принимается: именно так задевают не то, что имелось в виду.
      const id = str(raw.targetId, 40);
      if (!id) return { ok: false, reason: REASONS.NO_TARGET, kind };
      const pool = spec.target === 'goal' ? c.goals : spec.target === 'quest' ? c.quests : c.habits;
      const found = (Array.isArray(pool) ? pool : []).find((x) => x && String(x.id) === id);
      if (!found) {
        // Не найдено = либо чужое, либо выдумано. Различать незачем: и то и другое — отказ.
        const anywhere = [c.goals, c.quests, c.habits].some((p) => (Array.isArray(p) ? p : []).some((x) => x && String(x.id) === id));
        return { ok: false, reason: anywhere ? REASONS.TARGET_WRONG_TYPE : REASONS.TARGET_NOT_FOUND, kind, targetId: id };
      }
      const out = { kind, tier: spec.tier, targetId: id, targetKind: spec.target, targetTitle: str(found.title, MAX_TITLE) || '' };
      if (kind === 'quest_reschedule') {
        const date = isDay(raw.date) && isDay(c.today) && raw.date >= c.today ? raw.date : null;
        if (!date) return { ok: false, reason: REASONS.NO_TARGET, kind };
        out.date = date;
      }
      return { ok: true, action: out };
    }

    // create
    const title = str(raw.title, MAX_TITLE);
    if (!title) return { ok: false, reason: REASONS.NO_TITLE, kind };

    const spheres = Array.isArray(c.spheres) ? c.spheres : [];
    const named = str(raw.sphere, 60);
    const sphere = named
      ? spheres.find((s) => s && String(s.name).toLowerCase() === named.toLowerCase())
      : null;
    const fallback = spheres[0] || null;
    const picked = sphere || fallback;

    const out = {
      kind, tier: spec.tier, title,
      skillId: picked ? picked.id : null,
      sphereName: picked ? picked.name : '',
    };
    if (kind === 'quest') {
      out.date = isDay(raw.date) && isDay(c.today) && raw.date >= c.today ? raw.date : (c.today || null);
      out.estimateMin = clampInt(raw.estimateMin, 5, 600, 30);
      out.difficulty = DIFFICULTY.includes(raw.difficulty) ? raw.difficulty : 'normal';
    } else if (kind === 'habit') {
      out.estimateMin = clampInt(raw.estimateMin, 2, 240, 10);
      const days = Array.isArray(raw.days)
        ? [...new Set(raw.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
        : [];
      out.days = days.length ? days.sort() : [0, 1, 2, 3, 4, 5, 6];
    } else {
      out.deadline = isDay(raw.deadline) && isDay(c.today) && raw.deadline >= c.today ? raw.deadline : null;
    }
    return { ok: true, action: out };
  }

  /**
   * Разобрать пачку. Негодные отбрасываются поштучно и возвращаются в `refused` —
   * молчаливое проглатывание отказа скрыло бы от человека, что ассистент пытался
   * сделать больше, чем ему положено.
   */
  function validateAll(list, ctx) {
    const actions = [], refused = [];
    for (const raw of (Array.isArray(list) ? list : []).slice(0, MAX_ACTIONS)) {
      const r = validate(raw, ctx);
      if (r.ok) actions.push(r.action);
      else refused.push({ reason: r.reason, kind: r.kind || null, targetId: r.targetId || null });
    }
    return { actions, refused };
  }

  /**
   * Извлечь блок действий из ответа модели.
   *
   * Берётся ПЕРВЫЙ блок и только он. Ответ с двумя блоками — почти наверняка либо
   * сбой модели, либо пересказ чужого текста, в котором тоже оказался такой блок
   * (человек попросил разобрать статью, в статье инструкция). Второй блок не
   * исполняется никогда, и это фиксируется в `extraBlocks`.
   */
  function extract(text) {
    const src = typeof text === 'string' ? text : '';
    const re = /<<ACTIONS\s*([\s\S]*?)\s*ACTIONS>>/g;
    const hits = [];
    let m;
    while ((m = re.exec(src)) !== null) hits.push(m);
    if (!hits.length) return { clean: src, raw: [], extraBlocks: 0 };
    const first = hits[0];
    // Из текста убираются ВСЕ блоки: показывать человеку сырой JSON незачем.
    const clean = src.replace(re, '').replace(/\n{3,}/g, '\n\n').trim();
    let raw = [];
    try { raw = JSON.parse(first[1]); } catch { raw = []; }
    return { clean, raw: Array.isArray(raw) ? raw : [], extraBlocks: hits.length - 1 };
  }

  /** Полный путь: текст модели → готовые к показу действия. */
  function fromReply(text, ctx) {
    const { clean, raw, extraBlocks } = extract(text);
    const { actions, refused } = validateAll(raw, ctx);
    return { clean, actions, refused, extraBlocks };
  }

  /** Строка для системного промпта — чтобы список видов был в одном месте, а не в двух. */
  function promptContract() {
    return 'kind ∈ ' + KIND_LIST.join(' | ')
      + '. Изменяющие виды требуют targetId — точный id объекта из контекста; по описанию адресовать нельзя.'
      + ' Удаление любого рода недоступно: предложи паузу или архив, а необратимое человек делает сам в интерфейсе.';
  }

  return Object.freeze({
    VERSION, KINDS, KIND_LIST, REASONS, MAX_ACTIONS, KNOWN_REFUSALS,
    validate, validateAll, extract, fromReply, looksRefused, promptContract,
  });
});
