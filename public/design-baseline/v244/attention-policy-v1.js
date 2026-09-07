/* Satoru Attention Policy v1 — политика внимания на приложение (DISCIPLINE-ESCAPE-PLAN §9).
 *
 * Отвечает на один вопрос: «что этому человеку разрешено делать в этом приложении и на
 * каких условиях». Правила ВСЕГДА индивидуальны (§8 п.4): профиль Альберта — стартовый
 * шаблон, а не норма. Нельзя навязывать чужой запрет на развлекательный TikTok всем.
 *
 * Ключевая находка §4, из-за которой модуль вообще существует: одна иконка обслуживает
 * две несовместимые роли — рабочий инструмент и аварийный выход из неприятного. Поэтому
 * единица политики не приложение, а **цель входа** (purpose): у «опубликовать ролик» и
 * «поискать вдохновение» разные лимиты, разные режимы и разный смысл слова «успех».
 *
 * Три режима (§10), и различаются они ДО входа, а не после срыва — именно этого не
 * хватало старым Доверию/Контролю, которые отличались лишь заморозкой серии и тоном:
 *   trust    — намерение и мягкий таймер, продолжать можно осознанно;
 *   adaptive — намерение, результат и лимит, одно продление, дальше барьер;
 *   control  — обязательная цель, реальная граница, выход только аварийный.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ решает и не меняет политику сам. §11 гейт: политики никогда не меняются
 *    автоматически по статистике. Калибровка (`attention-episode-v1`) считает и
 *    ПРЕДЛАГАЕТ, решает человек. Здесь нет ни одной функции, которая правила ужесточает;
 *  — НЕ считает XP, золото, штрафы и серии. Срыв — данные, не проступок;
 *  — НЕ блокирует сам: отдаёт решение `control`, исполняет его платформа (R3–R5);
 *  — НЕ хранит, что именно человек смотрел: ни ссылок, ни запросов, ни истории (§14);
 *  — НЕ возвращает готовых фраз — только идентификаторы и числа, текст собирает UI.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 * Все операции иммутабельны — возвращают новое состояние, сохраняет вызывающий.
 */
(function exposeAttentionPolicy(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AttentionPolicyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAttentionPolicy() {
  'use strict';

  const VERSION = '1.0.0';

  const MODES = Object.freeze({ trust: 'trust', adaptive: 'adaptive', control: 'control' });

  // Цели входа. Закрытый список — открытый вернул бы «зайду просто так» под видом
  // рабочей цели, а это ровно та лазейка, ради закрытия которой всё строится.
  // `unsure` существует специально: человек имеет право не знать, но в control
  // незнание окна не открывает (§10).
  const PURPOSES = Object.freeze({
    publish: 'publish',   // выложить готовое
    create:  'create',    // выбрать/смонтировать
    reply:   'reply',     // ответить людям
    research:'research',  // найти N референсов по ЗАРАНЕЕ названной теме
    watch:   'watch',     // конкретный сохранённый материал, не Home/Recommendations
    rest:    'rest',      // отдых, если человек его себе разрешил
    unsure:  'unsure',    // «пока не знаю»
  });
  const WORK_PURPOSES = Object.freeze(['publish', 'create', 'reply', 'research', 'watch']);

  // Потолки — защита от политики, которая сама стала проблемой. Окно на восемь часов
  // это не граница, а её отсутствие.
  const MAX_MINUTES = 240;
  const MIN_MINUTES = 1;
  const MAX_EXTENSIONS = 3;
  const MAX_PURPOSES = 8;
  const MAX_NAME = 60;

  // Default аварийного правила (§10): один пропуск на семь дней и 90 секунд задержки.
  // Без задержки «аварийный выход» за неделю превращается в обычную кнопку «продолжить».
  const DEFAULT_EMERGENCY = Object.freeze({ passes: 1, perDays: 7, delaySeconds: 90 });

  const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const isTime = (s) => typeof s === 'string' && HHMM.test(s);
  const clampInt = (v, lo, hi) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
  };

  function cleanEmergency(raw) {
    if (raw === null) return null;                       // явное «аварийного выхода нет»
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_EMERGENCY };
    const passes = clampInt(raw.passes, 0, 7);
    const perDays = clampInt(raw.perDays, 1, 60);
    const delaySeconds = clampInt(raw.delaySeconds, 0, 600);
    return {
      passes: passes === null ? DEFAULT_EMERGENCY.passes : passes,
      perDays: perDays === null ? DEFAULT_EMERGENCY.perDays : perDays,
      delaySeconds: delaySeconds === null ? DEFAULT_EMERGENCY.delaySeconds : delaySeconds,
    };
  }

  /**
   * Правило одной цели. `outcome` — что человек обязуется предъявить себе на выходе;
   * для рабочих целей оно обязательно (§4: работа доказывается результатом), для
   * отдыха бессмысленно и не требуется.
   */
  function cleanPurposeRule(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const purpose = raw.purpose;
    if (!Object.prototype.hasOwnProperty.call(PURPOSES, purpose)) return null;
    if (raw.enabled === false) return { purpose, enabled: false };

    const dflt = clampInt(raw.defaultMinutes, MIN_MINUTES, MAX_MINUTES);
    if (dflt === null) return null;
    const max = clampInt(raw.maxMinutes, MIN_MINUTES, MAX_MINUTES);
    const out = {
      purpose,
      enabled: true,
      defaultMinutes: dflt,
      maxMinutes: max === null || max < dflt ? dflt : max,
      mode: Object.prototype.hasOwnProperty.call(MODES, raw.mode) ? raw.mode : MODES.adaptive,
      extensions: clampInt(raw.extensions, 0, MAX_EXTENSIONS) ?? 1,
      extensionMinutes: clampInt(raw.extensionMinutes, MIN_MINUTES, 60) ?? 5,
    };
    const outcome = typeof raw.outcome === 'string' ? raw.outcome.trim().slice(0, 120) : '';
    if (outcome) out.outcome = outcome;
    // Потолок улова для research: §9 профиля — максимум три материала, дальше закрыто.
    const cap = clampInt(raw.captureCap, 1, 10);
    if (cap !== null) out.captureCap = cap;
    // Тема обязательна для research: «просто вдохновиться» не рабочая цель (§9).
    if (raw.requiresTopic === true) out.requiresTopic = true;
    return out;
  }

  function cleanQuietHours(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!isTime(raw.from) || !isTime(raw.to)) return null;
    return { from: raw.from, to: raw.to };
  }

  function cleanPolicy(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 40) : null;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!id || !name) return null;

    const seen = new Set();
    const purposes = [];
    for (const p of Array.isArray(raw.purposes) ? raw.purposes : []) {
      const c = cleanPurposeRule(p);
      if (!c || seen.has(c.purpose)) continue;
      seen.add(c.purpose);
      purposes.push(c);
      if (purposes.length >= MAX_PURPOSES) break;
    }
    if (!purposes.length) return null;                   // политика без единой цели бессмысленна

    const out = {
      id,
      name: name.slice(0, MAX_NAME),
      purposes,
      emergency: cleanEmergency(raw.emergency),
      // Режимы дня (§9) — те же, что у `commitment-v1`: пустой список = во всех.
      modes: Array.isArray(raw.modes)
        ? [...new Set(raw.modes.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim().slice(0, 24)))]
        : [],
      sync: raw.sync === true,                           // §14: синк агрегатов строго opt-in, default false
    };
    // Непрозрачный токен платформы: на iOS для украинского аккаунта настоящий bundle id
    // недоступен (§2), и приложение обязано работать, зная только токен.
    if (typeof raw.platformToken === 'string' && raw.platformToken.trim()) {
      out.platformToken = raw.platformToken.trim().slice(0, 200);
    }
    const quiet = cleanQuietHours(raw.quietHours);
    if (quiet) out.quietHours = quiet;
    return out;
  }

  function emptyState() { return { version: 1, policies: [] }; }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState();
    const seen = new Set();
    const policies = [];
    for (const p of Array.isArray(raw.policies) ? raw.policies : []) {
      const c = cleanPolicy(p);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      policies.push(c);
    }
    return { version: 1, policies };
  }

  function policyById(state, id) {
    return normalize(state).policies.find((p) => p.id === String(id)) || null;
  }

  function upsert(state, draft) {
    const s = normalize(state);
    const policy = cleanPolicy(draft);
    if (!policy) return { ok: false, error: 'invalid' };
    const at = s.policies.findIndex((p) => p.id === policy.id);
    const policies = at < 0 ? s.policies.concat([policy]) : s.policies.map((p, i) => (i === at ? policy : p));
    return { ok: true, state: { ...s, policies } };
  }

  function remove(state, id) {
    const s = normalize(state);
    return { ...s, policies: s.policies.filter((p) => p.id !== String(id)) };
  }

  function ruleFor(state, policyId, purpose) {
    const p = policyById(state, policyId);
    if (!p) return null;
    return p.purposes.find((r) => r.purpose === purpose && r.enabled !== false) || null;
  }

  function isWorkPurpose(purpose) { return WORK_PURPOSES.includes(purpose); }

  /** Действует ли политика в этом режиме дня. Пустой `modes` = действует всегда. */
  function appliesInMode(policy, mode) {
    if (!policy) return false;
    const m = typeof mode === 'string' && mode.trim() ? mode.trim().slice(0, 24) : null;
    return !policy.modes.length || (!!m && policy.modes.includes(m));
  }

  /**
   * Внутри ли `HH:MM` окна полного закрытия. Окно через полночь (23:00→07:00) —
   * обычный случай для вечернего запрета, поэтому обрабатывается явно.
   */
  function inQuietHours(policy, hhmm) {
    if (!policy || !policy.quietHours || !isTime(hhmm)) return false;
    const { from, to } = policy.quietHours;
    if (from === to) return false;
    return from < to ? (hhmm >= from && hhmm < to) : (hhmm >= from || hhmm < to);
  }

  /**
   * Можно ли открыть окно — и если нет, то почему. Причина возвращается кодом, чтобы
   * UI сам решал тон: модуль текста не пишет.
   *
   * `unsure` в control не открывает окно (§10) — это единственное место, где модуль
   * говорит «нет» по режиму, и оно продумано: «не знаю зачем» и есть тот самый вход,
   * который заканчивается лентой.
   */
  function canOpen(state, policyId, purpose, ctx = {}) {
    const policy = policyById(state, policyId);
    if (!policy) return { ok: false, reason: 'no_policy' };
    if (!appliesInMode(policy, ctx.mode)) return { ok: false, reason: 'wrong_mode' };
    if (inQuietHours(policy, ctx.now)) return { ok: false, reason: 'quiet_hours' };
    const rule = ruleFor(state, policyId, purpose);
    if (!rule) return { ok: false, reason: 'purpose_disabled' };
    if (rule.mode === MODES.control && purpose === PURPOSES.unsure) {
      return { ok: false, reason: 'unsure_in_control' };
    }
    if (rule.requiresTopic && !(typeof ctx.topic === 'string' && ctx.topic.trim())) {
      return { ok: false, reason: 'topic_required' };
    }
    if (isWorkPurpose(purpose) && !rule.outcome && !(typeof ctx.expectedOutcome === 'string' && ctx.expectedOutcome.trim())) {
      return { ok: false, reason: 'outcome_required' };
    }
    return { ok: true, rule, policy };
  }

  /**
   * Стартовый шаблон. Двухминутный setup (§9 гейт «продуктивная настройка вместо дела»):
   * одно приложение, одна цель, одно правило — остальное человек добавит, если захочет.
   * Профиль Альберта живёт в `PRESETS`, но НЕ применяется никому по умолчанию.
   */
  function minimalPolicy(id, name, purpose, minutes, mode) {
    return cleanPolicy({
      id, name,
      purposes: [{ purpose, defaultMinutes: minutes, mode: mode || MODES.adaptive }],
    });
  }

  // Шаблоны — предложение, не норма. UI обязан дать их отредактировать (§9).
  const PRESETS = Object.freeze({
    tiktok: Object.freeze({
      id: 'tiktok', name: 'TikTok',
      purposes: [
        { purpose: 'create',   defaultMinutes: 25, mode: 'adaptive', outcome: 'готовый экспорт или черновик' },
        { purpose: 'publish',  defaultMinutes: 12, mode: 'control',  outcome: 'ролик опубликован или честная причина остановки' },
        { purpose: 'research', defaultMinutes: 10, mode: 'control',  outcome: 'до трёх материалов и «что беру»', captureCap: 3, requiresTopic: true },
        { purpose: 'rest',     enabled: false },
      ],
    }),
    youtube: Object.freeze({
      id: 'youtube', name: 'YouTube',
      purposes: [
        { purpose: 'publish', defaultMinutes: 15, mode: 'adaptive', outcome: 'видео опубликовано или черновик' },
        { purpose: 'watch',   defaultMinutes: 45, mode: 'adaptive', outcome: 'один вывод, заметка или следующее действие' },
      ],
    }),
  });

  return Object.freeze({
    VERSION, MODES, PURPOSES, WORK_PURPOSES, PRESETS,
    MAX_MINUTES, MIN_MINUTES, MAX_EXTENSIONS, MAX_PURPOSES, DEFAULT_EMERGENCY,
    emptyState, normalize,
    upsert, remove, policyById, ruleFor,
    isWorkPurpose, appliesInMode, inQuietHours, canOpen, minimalPolicy,
  });
});
