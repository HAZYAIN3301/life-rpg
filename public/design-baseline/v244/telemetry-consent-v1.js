/* Satoru Telemetry Consent v1 — AG-51 / AG-53 / AG-54.
 *
 * Три карточки, один корень: в продукте нет слова, которым можно отличить «это нужно,
 * чтобы приложение работало» от «это нужно, чтобы человек дольше сидел». Пока такого
 * слова нет, второе всегда прячется за первым — не по злому умыслу, а потому что
 * прятаться больше негде.
 *
 *   AG-51 (P0) — поведенческие эксперименты над людьми идут без согласия и без границ.
 *   AG-53      — аналитика меряет вовлечение и называет это пользой.
 *   AG-54      — нет разделения между необходимым для работы продукта и необходимым
 *                для оптимизации вовлечения.
 *
 * Этот модуль вводит недостающее слово: у каждого события обязана быть НАЗВАННАЯ цель,
 * у каждой цели — своё согласие, свой срок хранения и свой ответ на вопрос «а без этого
 * продукт работает?». Ровно одна цель необходима. Оптимизация вовлечения не может стать
 * необходимой ни при какой настройке — это проверяется кодом, а не обещанием.
 *
 * Позиция по умолчанию — opt-out, и это осознанный выбор владельца продукта: цели сбора
 * включены сразу, человек может выключить любую. Разделение целей от этого не исчезает,
 * оно и есть содержание AG-53/54 — цели остаются раздельными, независимо выключаемыми,
 * с разными сроками хранения и раздельными счётчиками в самом агрегате.
 *
 * Исключение ровно одно: `experimentation` выключена по умолчанию. Эксперимент — это не
 * сбор, а изменение того, что видит конкретный человек, ради проверки гипотезы на нём.
 * Другой поступок — другое умолчание (AG-51).
 *
 * Чего модуль НЕ делает: не пишет события, не ходит в сеть, не смотрит на часы, не
 * знает про HTTP. Он отвечает «можно или нет и почему», а собирает и хранит сервер.
 */
(function exposeTelemetryConsent(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TelemetryConsentV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTelemetryConsent() {
  'use strict';

  const VERSION = '1.0.0';

  /* Таксономия целей. Порядок — от необходимого к необязательному, и он же порядок
   * показа человеку: сначала то, на что его не спрашивают (и почему), потом то, где
   * решает он.
   *
   * `essential: true` есть ровно у одной цели. Это не экономия — это и есть содержание
   * AG-54: как только «необходимых» целей становится две, вторая немедленно начинает
   * означать «нам это очень нужно», и разделение исчезает. */
  const PURPOSE_LIST = [
    {
      id: 'service_operation',
      defaultOn: true,
      essential: true,
      retentionDays: 30,
      label: 'Работа приложения',
      description: 'Сбои, потери данных, неудавшиеся сохранения. Без этого нельзя починить то, что сломалось у вас.',
      // Согласия не спрашивают — но и права это не даёт ни на что другое.
      whyNotOptional: 'Без этих данных нельзя заметить, что приложение сломалось именно у вас.',
    },
    {
      id: 'safety',
      defaultOn: true,
      essential: false,
      retentionDays: 180,
      label: 'Обнаружение вреда',
      description: 'Признаки компульсии, ночных сессий, сожаления после использования.',
      whyNotOptional: '',
    },
    {
      id: 'product_improvement',
      defaultOn: true,
      essential: false,
      retentionDays: 180,
      label: 'Улучшение полезности',
      description: 'Помогает ли функция довести настоящее дело до конца.',
      whyNotOptional: '',
    },
    {
      id: 'personalization',
      defaultOn: true,
      essential: false,
      retentionDays: 365,
      label: 'Персонализация',
      description: 'Подстройка подсказок и порядка под ваши привычки.',
      whyNotOptional: '',
    },
    {
      id: 'engagement_optimization',
      defaultOn: true,
      essential: false,
      retentionDays: 90,
      label: 'Оптимизация вовлечения',
      description: 'Как сделать так, чтобы вы возвращались чаще и оставались дольше.',
      whyNotOptional: '',
    },
    {
      id: 'experimentation',
      defaultOn: false,
      essential: false,
      retentionDays: 180,
      label: 'Поведенческие эксперименты',
      description: 'Проверка гипотез на живых людях: разные варианты механик разным людям.',
      whyNotOptional: '',
    },
  ];

  const PURPOSES = Object.freeze(PURPOSE_LIST.map((p) => Object.freeze(Object.assign({}, p))));
  const PURPOSE_IDS = Object.freeze(PURPOSES.map((p) => p.id));
  const PURPOSE_BY_ID = new Map(PURPOSES.map((p) => [p.id, p]));
  const ESSENTIAL_PURPOSES = Object.freeze(PURPOSES.filter((p) => p.essential).map((p) => p.id));
  const DEFAULT_ON_PURPOSES = Object.freeze(PURPOSES.filter((p) => p.defaultOn).map((p) => p.id));

  /* AG-53 одной строкой. Эти две цели похожи ровно настолько, чтобы их путали, и
   * различаются ровно в том, что имеет значение: одна спрашивает «человеку стало
   * лучше?», другая — «человек вернулся чаще?». Согласие на одну НИКОГДА не означает
   * согласия на другую, и одно событие не может служить обеим. */
  const NEVER_IMPLIED = Object.freeze({
    product_improvement: Object.freeze(['engagement_optimization']),
    safety: Object.freeze(['engagement_optimization', 'personalization']),
    service_operation: Object.freeze(PURPOSE_IDS.filter((id) => id !== 'service_operation')),
  });

  const MAX_PROPS = 10;
  const MAX_NAME = 40;
  const MAX_HISTORY = 100;
  const SOURCES = Object.freeze(['settings', 'onboarding', 'import', 'default']);

  // ---------------------------------------------------------------- helpers --

  function text(value, max) {
    const s = String(value == null ? '' : value).trim();
    return max > 0 ? s.slice(0, max) : s;
  }
  function iso(value) {
    const s = text(value, 40);
    return s && Number.isFinite(Date.parse(s)) ? s : '';
  }
  // Та же санитизация, что у существующего /api/analytics: имя события — это
  // идентификатор, а не текст. Всё, что не идентификатор, вырезается.
  function eventName(value) {
    return text(value, MAX_NAME).replace(/[^\w:.-]/g, '');
  }
  function list(value) {
    return Array.isArray(value) ? value : [];
  }
  function tail(array, max) {
    return array.length > max ? array.slice(array.length - max) : array;
  }
  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return Object.freeze(value);
  }

  /**
   * Полная таксономия целей для показа человеку. Здесь же — единственное место, где
   * написано, какая цель необходима и почему.
   */
  function defineTelemetryPurposes() {
    return freezeDeep(PURPOSES.map((p) => Object.assign({}, p)));
  }

  // ---------------------------------------------------------------- consent --

  function emptyPurposes() {
    const out = {};
    for (const p of PURPOSES) out[p.id] = p.defaultOn;
    return out;
  }

  // Последнее решение человека по этой цели, если оно вообще было. Нужно ровно для
  // одного случая, но важного: при opt-out испорченный файл иначе «чинился» бы
  // возвратом к умолчанию, то есть молча воскрешал сбор, который человек выключил.
  // Отзыв не должен исчезать вместе с одним битым полем.
  function lastDecision(history, purposeId) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].purpose === purposeId) return history[i].granted;
    }
    return null;
  }

  /**
   * Приводит запись согласия к рабочей форме. Неизвестное, испорченное и отсутствующее
   * дают одинаковый безопасный результат: включено только необходимое.
   */
  function normalizeConsent(input) {
    const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const raw = src.purposes && typeof src.purposes === 'object' && !Array.isArray(src.purposes) ? src.purposes : {};
    // История читается первой: она — запасной свидетель решения, если само поле
    // с целями оказалось нечитаемым.
    const history = tail(list(src.history).map((h) => {
      const at = iso(h && h.at);
      const purpose = text(h && h.purpose, 40);
      if (!at || !PURPOSE_BY_ID.has(purpose)) return null;
      return { at, purpose, granted: !!(h && h.granted), source: text(h && h.source, 20) };
    }).filter(Boolean), MAX_HISTORY);

    const purposes = emptyPurposes();
    for (const p of PURPOSES) {
      // Необходимое всегда включено, и его состояние не читается из файла: испорченный
      // или подделанный файл не должен уметь его выключить.
      if (p.essential) { purposes[p.id] = true; continue; }
      // Решением считается только настоящий boolean. 'да', 1 и 'true' решением не
      // являются — за них отвечает умолчание, а не догадка о намерении.
      if (typeof raw[p.id] === 'boolean') { purposes[p.id] = raw[p.id]; continue; }
      const remembered = lastDecision(history, p.id);
      purposes[p.id] = remembered === null ? p.defaultOn : remembered;
    }

    return {
      version: 1,
      purposes,
      decidedAt: iso(src.decidedAt),
      source: SOURCES.indexOf(text(src.source, 20)) >= 0 ? text(src.source, 20) : 'default',
      history,
    };
  }

  function decisionResult(ok, reason, consent, changed) {
    return Object.freeze({ ok, reason, consent, changed: Object.freeze(changed || []) });
  }

  /**
   * Применяет решение человека. Возвращает НОВУЮ запись; вход не мутируется.
   *
   * `decision = { at, source, purposes: { <id>: boolean } }`.
   *
   * Отзыв разрешён всегда и действует сразу. Выдача согласия требует времени и
   * источника: согласие без «когда и где» невозможно ни показать, ни оспорить, а
   * значит его как бы и нет.
   */
  function applyConsentDecision(consent, decision) {
    const current = normalizeConsent(consent);
    const d = decision && typeof decision === 'object' ? decision : {};
    const at = iso(d.at);
    const source = SOURCES.indexOf(text(d.source, 20)) >= 0 ? text(d.source, 20) : '';
    const wanted = d.purposes && typeof d.purposes === 'object' && !Array.isArray(d.purposes) ? d.purposes : null;

    if (!wanted) return decisionResult(false, 'invalid_decision', current);
    if (!at) return decisionResult(false, 'invalid_decision_time', current);
    if (!source) return decisionResult(false, 'invalid_decision_source', current);

    const keys = Object.keys(wanted);
    if (!keys.length) return decisionResult(false, 'invalid_decision', current);
    for (const key of keys) {
      if (!PURPOSE_BY_ID.has(key)) return decisionResult(false, `unknown_purpose:${key}`, current);
      if (typeof wanted[key] !== 'boolean') return decisionResult(false, `invalid_value:${key}`, current);
      // Необходимое не предлагается как выбор. Молча «согласиться» с попыткой его
      // выключить значило бы соврать человеку о том, что он только что сделал.
      if (PURPOSE_BY_ID.get(key).essential) return decisionResult(false, `essential_not_a_choice:${key}`, current);
    }

    const next = normalizeConsent(current);
    const changed = [];
    const events = [];
    for (const key of keys.slice().sort()) {
      if (next.purposes[key] === wanted[key]) continue;
      next.purposes[key] = wanted[key];
      changed.push(key);
      events.push({ at, purpose: key, granted: wanted[key], source });
    }
    if (!changed.length) return decisionResult(true, 'unchanged', next, []);

    next.history = tail(next.history.concat(events), MAX_HISTORY);
    next.decidedAt = at;
    next.source = source;
    return decisionResult(true, 'updated', next, changed);
  }

  // ------------------------------------------------------------------ events --

  function propsProblem(props) {
    if (props == null) return '';
    if (typeof props !== 'object' || Array.isArray(props)) return 'invalid_props';
    const keys = Object.keys(props);
    if (keys.length > MAX_PROPS) return 'too_many_props';
    for (const key of keys) {
      if (key.length > MAX_NAME || eventName(key) !== key) return 'invalid_prop_name';
      const value = props[key];
      if (typeof value === 'boolean') continue;
      if (typeof value === 'number' && Number.isFinite(value)) continue;
      // Свободный текст — единственный способ протащить в телеметрию содержимое
      // жизни человека: название задачи, имя, ссылку. Поэтому строк здесь нет
      // вообще, а не «строки, которые мы почистили».
      return typeof value === 'string' ? 'free_text_not_allowed' : 'invalid_prop_value';
    }
    return '';
  }

  function permission(allowed, reason, purpose, event) {
    const p = PURPOSE_BY_ID.get(purpose);
    return freezeDeep({
      allowed,
      reason,
      purpose: purpose || '',
      essential: !!(p && p.essential),
      retentionDays: p ? p.retentionDays : 0,
      event: event || null,
    });
  }

  /**
   * Отвечает, можно ли записать одно событие.
   *
   * `event = { name, purpose, at?, props? }`. Цель обязательна и всегда одна: событие,
   * умеющее служить двум целям, — это и есть способ, которым оптимизация вовлечения
   * ездит на согласии, данном для чего-то другого.
   */
  function evaluateEventPermission(consent, event) {
    const current = normalizeConsent(consent);
    const raw = event && typeof event === 'object' ? event : {};
    const name = eventName(raw.name);
    const purpose = text(raw.purpose, 40);

    if (!name) return permission(false, 'invalid_event_name', purpose);
    // Событие без названной цели не «наверное служебное» — оно неизвестно чьё.
    if (!purpose) return permission(false, 'purpose_required', '');
    if (!PURPOSE_BY_ID.has(purpose)) return permission(false, 'unknown_purpose', '');
    if (Array.isArray(raw.purposes) || raw.purposes) return permission(false, 'single_purpose_required', purpose);

    const problem = propsProblem(raw.props);
    if (problem) return permission(false, problem, purpose);

    if (!current.purposes[purpose]) return permission(false, 'consent_missing', purpose);

    const props = {};
    for (const key of Object.keys(raw.props || {}).sort()) props[key] = raw.props[key];
    return permission(true, 'allowed', purpose, { name, purpose, at: iso(raw.at), props });
  }

  /**
   * Делит пачку событий на принятые и отклонённые. Отклонённые возвращаются с
   * причиной: телеметрия, которая молча теряет часть событий, врёт своим же отчётам.
   */
  function filterEventBatch(consent, events) {
    const current = normalizeConsent(consent);
    const accepted = [];
    const rejected = [];
    for (const raw of list(events)) {
      const verdict = evaluateEventPermission(current, raw);
      if (verdict.allowed) accepted.push(verdict.event);
      else rejected.push({ name: eventName(raw && raw.name), purpose: text(raw && raw.purpose, 40), reason: verdict.reason });
    }
    return freezeDeep({ accepted, rejected });
  }

  // ------------------------------------------------------------- experiments --

  /**
   * AG-51. Эксперимент над человеком требует двух вещей сразу, и ни одна не заменяет
   * другую: согласия человека и границ, объявленных заранее.
   *
   * `assignment = { experimentId, contractId, owner, reviewAt, purpose }`.
   *
   * `contractId` — ссылка на контракт из gamification-governance-v1: там живут
   * pre-mortem, метрики вреда, пороги остановки и план отката. Эксперимент без
   * контракта не «недооформлен» — он не имеет выключателя, и это отказ.
   */
  function evaluateExperimentEligibility(consent, assignment) {
    const current = normalizeConsent(consent);
    const a = assignment && typeof assignment === 'object' ? assignment : {};
    const experimentId = text(a.experimentId, 80);
    const purpose = text(a.purpose, 40) || 'experimentation';

    const verdict = (eligible, reason) => freezeDeep({ eligible, reason, experimentId, purpose });

    if (!experimentId) return verdict(false, 'invalid_experiment');
    if (!PURPOSE_BY_ID.has(purpose)) return verdict(false, 'unknown_purpose');
    if (!current.purposes.experimentation) return verdict(false, 'experiment_consent_missing');
    if (!text(a.contractId, 80)) return verdict(false, 'no_governance_contract');
    // Владелец и срок пересмотра — часть границ, а не бюрократия: эксперимент без
    // того, кто его остановит, и без дня, когда на него посмотрят, не заканчивается.
    if (!text(a.owner, 120)) return verdict(false, 'no_owner');
    if (!iso(a.reviewAt)) return verdict(false, 'no_review_date');
    // Цель эксперимента требует своего согласия отдельно. Согласие «ставьте на мне
    // опыты» не означает согласия «оптимизируйте моё вовлечение».
    if (!current.purposes[purpose]) return verdict(false, 'purpose_consent_missing');
    return verdict(true, 'eligible');
  }

  // ------------------------------------------------------------- explanation --

  /**
   * Человекочитаемое описание текущего состояния: что собирается, зачем, насколько
   * долго хранится и когда человек это решил. Детерминировано, годится в интерфейс
   * и в письмо целиком.
   */
  function describeConsentForHuman(consent) {
    const current = normalizeConsent(consent);
    const lines = [];
    for (const p of PURPOSES) {
      const on = current.purposes[p.id];
      const decided = lastDecision(current.history, p.id) !== null;
      // Человек обязан видеть разницу между «я это включил» и «включено за меня».
      // Без неё opt-out превращается в то самое нечитаемое соглашение.
      const state = p.essential ? 'всегда включено'
        : on && decided ? 'включено вами'
          : on ? 'включено по умолчанию — можно выключить'
            : 'выключено вами';
      lines.push(`${p.label} — ${state} · хранится ${p.retentionDays} дн.`);
      lines.push(`  ${p.description}`);
      if (p.essential && p.whyNotOptional) lines.push(`  Почему без выбора: ${p.whyNotOptional}`);
    }
    lines.push(current.decidedAt
      ? `Ваше последнее решение: ${current.decidedAt} (${current.source}).`
      : 'Вы ещё ничего не меняли: всё стоит так, как включено по умолчанию.');
    lines.push('Согласие на улучшение полезности никогда не означает согласия на оптимизацию вовлечения.');
    return lines.join('\n');
  }

  return {
    VERSION,
    PURPOSES,
    PURPOSE_IDS,
    ESSENTIAL_PURPOSES,
    DEFAULT_ON_PURPOSES,
    NEVER_IMPLIED,
    SOURCES,
    MAX_PROPS,
    defineTelemetryPurposes,
    normalizeConsent,
    applyConsentDecision,
    evaluateEventPermission,
    filterEventBatch,
    evaluateExperimentEligibility,
    describeConsentForHuman,
  };
});
