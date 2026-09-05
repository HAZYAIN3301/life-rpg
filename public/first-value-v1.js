/* Satoru First Real Value v1 — AG-09 / AG-11 / AG-12 / AG-32.
 *
 * Что сломано и почему это один предмет:
 *
 *   AG-09 (FAIL) — регистрация собирает имя, аватар, почту, пароль и recovery-код, потом
 *                  предлагает био, программы и десятки сфер — и всё это ДО первого
 *                  сохранённого настоящего действия. Настройка владения сама стала
 *                  работой, а ценность ещё не доказана.
 *   AG-11 (GAP)  — переход в приложение случается после незапрошенного «успеха»: запись
 *                  не подтверждена, а праздник уже показан. Это учит не доверять фидбэку.
 *   AG-12 (FAIL) — обучение заканчивается тапом по питомцу. Питомец тёплый, но это не
 *                  First Major Win-State: человек ещё не увидел, что система умеет
 *                  держать его настоящее дело.
 *   AG-32 (GAP)  — обещан маленький вход, а таймер запускает другой интервал. Неверная
 *                  граница уменьшает и доверие, и ability.
 *
 * Общий корень: нигде не записано, что считается настоящей первой ценностью. Пока это
 * не записано, ею становится любой яркий экран.
 *
 * Этот модуль записывает. Он ведёт путь от «человек только пришёл» до «у человека есть
 * доказанный реальный результат» и физически не умеет засчитать вместо результата
 * тап, открытие экрана, начисление или сундук.
 *
 * Чего модуль НЕ делает: не начисляет опыт, золото, серии и предметы; не наказывает за
 * превышение времени; не трогает DOM, сеть и хранилище. Это движок состояния, а не
 * экономика и не UI.
 */
(function exposeFirstValue(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FirstValueV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildFirstValue() {
  'use strict';

  const VERSION = '1.0.0';

  const STATES = Object.freeze([
    'new',                 // пришёл, маршрут ещё не выбран
    'intent_known',        // маршрут выбран, конкретики нет
    'action_ready',        // есть ровно одно конкретное действие, к которому можно приступить
    'action_started',      // приступил
    'first_value_reached', // есть доказанный реальный результат
    'completed',           // путь закрыт и убран с глаз
    'deferred',            // отложен человеком; это законный исход, а не провал
  ]);

  /* Три маршрута, и все три ведут к настоящему делу, а не к экрану:
   *   do_now   — сделать настоящий микрошаг;
   *   clarify  — вытащить конкретное следующее действие из реального плана;
   *   recover  — начать настоящую границу восстановления.
   * Четвёртого «просто осмотреться» здесь нет намеренно: осмотр не требует пути. */
  const ROUTES = Object.freeze(['do_now', 'clarify', 'recover']);

  // AG-12. Единственные исходы, которые считаются первой ценностью. Список закрыт:
  // расширять его можно только вместе с ответом «что реального осталось у человека».
  const OUTCOME_TYPES = Object.freeze([
    'quest_completed',            // настоящая задача доведена до конца
    'next_action_committed',      // из плана вынуто конкретное следующее действие и закреплено
    'recovery_boundary_started',  // начата настоящая граница восстановления
    'real_plan_created',          // создан настоящий план, а не заготовка интерфейса
  ]);

  /* Явный список того, что первой ценностью НЕ является. Он существует, чтобы отказ
   * был написан в коде, а не держался на договорённости: каждое из этих событий
   * когда-то уже выдавалось за успех онбординга. */
  const NON_VALUE_EVENTS = Object.freeze(['pet_tapped', 'screen_opened', 'xp_received', 'chest_opened']);

  const EVENT_TYPES = Object.freeze([
    'route_chosen',      // { route }
    'action_ready',      // { entityType, entityId }
    'action_started',    // { entityType, entityId }
    'outcome_recorded',  // { outcomeType, entityType, entityId, occurredAt }
    'journey_completed',
    'deferred',          // { reason }
    'resumed',
  ]);

  // Ожидаемый исход маршрута. Несовпадение НЕ отвергается: человек, зашедший
  // «уточнить», мог просто взять и сделать. Несовпадение помечается флагом
  // routeAligned, чтобы отчёт видел разницу, а движок не мешал жизни.
  const ROUTE_OUTCOMES = Object.freeze({
    do_now: Object.freeze(['quest_completed']),
    clarify: Object.freeze(['next_action_committed', 'real_plan_created']),
    recover: Object.freeze(['recovery_boundary_started']),
  });

  /* AG-32. Десять минут — это ОБЕЩАНИЕ маленького входа, а не срок сдачи. Число живёт
   * здесь, чтобы таймер и текст брали его из одного места и не расходились. Превышение
   * не отнимает результат, не понижает статус и не появляется в экономике: единственное
   * последствие — тихое предложение остановиться или продолжить. */
  const TARGET_MS = 10 * 60 * 1000;

  // Границы роста состояния: путь живёт минуты, а не годы, и не должен раздуваться.
  const MAX_SUPPORT = 20;
  const MAX_HISTORY = 60;
  const MAX_SEEN_EVENTS = 200;

  // ---------------------------------------------------------------- helpers --

  function text(value, max) {
    const s = String(value == null ? '' : value).trim();
    return max > 0 ? s.slice(0, max) : s;
  }
  function isoOrEmpty(value) {
    const s = text(value, 40);
    if (!s) return '';
    return Number.isFinite(Date.parse(s)) ? s : '';
  }
  function list(value) {
    return Array.isArray(value) ? value : [];
  }
  function oneOf(value, allowed) {
    return allowed.indexOf(value) >= 0 ? value : '';
  }
  function tail(array, max) {
    return array.length > max ? array.slice(array.length - max) : array;
  }
  function clone(value) {
    return value == null ? null : JSON.parse(JSON.stringify(value));
  }

  // -------------------------------------------------------- create/normalize --

  function normalizeReference(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const entityType = text(r.entityType, 40);
    const entityId = text(r.entityId, 120);
    if (!entityType || !entityId) return null;
    return { entityType, entityId, at: isoOrEmpty(r.at) };
  }

  function normalizeEvidence(raw) {
    const e = raw && typeof raw === 'object' ? raw : {};
    const entityType = text(e.entityType, 40);
    const entityId = text(e.entityId, 120);
    const outcomeType = oneOf(text(e.outcomeType, 40), OUTCOME_TYPES);
    const occurredAt = isoOrEmpty(e.occurredAt);
    if (!entityType || !entityId || !outcomeType || !occurredAt) return null;
    return { entityType, entityId, outcomeType, occurredAt };
  }

  function normalizeProfile(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    return {
      locale: text(p.locale, 8),
      returning: p.returning === true,
      hasPlan: p.hasPlan === true,
      needsRecovery: p.needsRecovery === true,
    };
  }

  /**
   * Создаёт путь. Ничего не начисляет и ничего не требует, кроме userId: путь обязан
   * существовать раньше, чем человек что-либо настроил (AG-09).
   */
  function createJourney(input) {
    const src = input && typeof input === 'object' ? input : {};
    return {
      version: 1,
      userId: text(src.userId, 120),
      startedAt: isoOrEmpty(src.startedAt),
      status: 'new',
      route: '',
      profile: normalizeProfile(src.profile),
      primaryAction: null,
      otherSupport: [],
      firstValueAt: '',
      evidence: null,
      completedAt: '',
      deferredAt: '',
      deferredReason: '',
      resumeStatus: '',
      seenEventIds: [],
      history: [],
      lastEvent: null,
    };
  }

  /**
   * Приводит любое (в том числе перечитанное с диска) состояние к рабочей форме.
   * Не экспортируется: снаружи он выглядел бы как второй способ создать путь, а
   * способ должен быть один.
   */
  function normalizeJourney(raw) {
    if (!raw || typeof raw !== 'object') return createJourney({});
    const base = createJourney({ userId: raw.userId, startedAt: raw.startedAt, profile: raw.profile });
    const status = oneOf(text(raw.status, 40), STATES) || 'new';
    const evidence = normalizeEvidence(raw.evidence);
    const firstValueAt = isoOrEmpty(raw.firstValueAt);
    return {
      version: 1,
      userId: base.userId,
      startedAt: base.startedAt,
      // Состояние «достигнута ценность» без самой улики — это не состояние, а
      // испорченный файл. Откатываем на предыдущую честную ступень, а не верим
      // на слово: иначе повреждение once-записи превращалось бы в вечный успех.
      status: (status === 'first_value_reached' || status === 'completed') && !evidence ? 'action_started' : status,
      route: oneOf(text(raw.route, 20), ROUTES),
      profile: base.profile,
      primaryAction: normalizeReference(raw.primaryAction),
      otherSupport: tail(list(raw.otherSupport).map(normalizeReference).filter(Boolean), MAX_SUPPORT),
      firstValueAt: evidence ? firstValueAt : '',
      evidence,
      completedAt: isoOrEmpty(raw.completedAt),
      deferredAt: isoOrEmpty(raw.deferredAt),
      deferredReason: text(raw.deferredReason, 200),
      resumeStatus: oneOf(text(raw.resumeStatus, 40), STATES),
      seenEventIds: tail(list(raw.seenEventIds).map((id) => text(id, 120)).filter(Boolean), MAX_SEEN_EVENTS),
      history: tail(list(raw.history).filter((h) => h && typeof h === 'object').map((h) => ({
        eventId: text(h.eventId, 120), type: text(h.type, 40), at: isoOrEmpty(h.at),
        from: text(h.from, 40), to: text(h.to, 40),
      })), MAX_HISTORY),
      lastEvent: raw.lastEvent && typeof raw.lastEvent === 'object' ? {
        id: text(raw.lastEvent.id, 120), type: text(raw.lastEvent.type, 40),
        applied: raw.lastEvent.applied === true, reason: text(raw.lastEvent.reason, 60),
      } : null,
    };
  }

  // -------------------------------------------------------------- meaningful --

  /**
   * Единственная дверь, через которую что-либо становится первой ценностью.
   *
   * Принимает и событие `{ type:'outcome_recorded', ... }`, и голую улику. Всё, что
   * не несёт полной улики — entityType, entityId, разрешённый outcomeType и время —
   * не является первой ценностью, каким бы приятным оно ни было на экране.
   */
  function isMeaningfulOutcome(event) {
    if (!event || typeof event !== 'object') return false;
    const type = text(event.type, 40);
    // Явный отказ важнее общей проверки: эти события не спасает даже полная улика.
    if (NON_VALUE_EVENTS.indexOf(type) >= 0) return false;
    if (type && type !== 'outcome_recorded' && EVENT_TYPES.indexOf(type) >= 0) return false;
    const candidate = event.evidence && typeof event.evidence === 'object' ? event.evidence : event;
    return normalizeEvidence(candidate) !== null;
  }

  function getFirstValueEvidence(state) {
    const s = normalizeJourney(state);
    if (!s.evidence || !s.firstValueAt) return null;
    return Object.freeze({
      entityType: s.evidence.entityType,
      entityId: s.evidence.entityId,
      outcomeType: s.evidence.outcomeType,
      occurredAt: s.evidence.occurredAt,
      route: s.route,
      routeAligned: routeAligned(s.route, s.evidence.outcomeType),
      firstValueAt: s.firstValueAt,
    });
  }

  function routeAligned(route, outcomeType) {
    const expected = ROUTE_OUTCOMES[route];
    return expected ? expected.indexOf(outcomeType) >= 0 : false;
  }

  // -------------------------------------------------------------- transition --

  // Из каких состояний событие вообще имеет смысл.
  const ALLOWED_FROM = Object.freeze({
    route_chosen: Object.freeze(['new', 'intent_known', 'deferred']),
    action_ready: Object.freeze(['intent_known', 'action_ready', 'deferred']),
    // `intent_known` здесь намеренно: «выбрал и сразу начал» — это один жест
    // человека, и требовать ради него отдельного промежуточного клика значило бы
    // строить тот же лишний гейт, из-за которого падает нынешний онбординг.
    action_started: Object.freeze(['intent_known', 'action_ready', 'action_started', 'deferred']),
    // Улику принимаем почти отовсюду. Настоящий результат, отвергнутый из-за
    // непрокликанного промежуточного шага, — это ровно тот гейт, на котором
    // спотыкается нынешний tutorial (AG-12). Жизнь не обязана идти по экрану.
    // `first_value_reached` тоже в списке: второй настоящий результат надо принять
    // и записать в историю, но «первым» он уже не станет — см. ветку ниже.
    outcome_recorded: Object.freeze(['intent_known', 'action_ready', 'action_started', 'first_value_reached', 'deferred']),
    journey_completed: Object.freeze(['first_value_reached', 'completed']),
    deferred: Object.freeze(['new', 'intent_known', 'action_ready', 'action_started', 'deferred']),
    resumed: Object.freeze(['deferred']),
  });

  function record(next, event, from, applied, reason) {
    next.lastEvent = { id: event.id, type: event.type, applied, reason };
    if (applied) {
      next.history = tail(next.history.concat([{
        eventId: event.id, type: event.type, at: event.at, from, to: next.status,
      }]), MAX_HISTORY);
    }
    if (event.id) next.seenEventIds = tail(next.seenEventIds.concat([event.id]), MAX_SEEN_EVENTS);
    return next;
  }

  /**
   * Применяет событие и возвращает НОВОЕ состояние. Вход не мутируется.
   *
   * Идемпотентность по `event.id`: повторная доставка того же события (retry, второе
   * устройство, перезагрузка на полпути) не двигает путь и не пишет вторую запись в
   * историю. Это не оптимизация — без неё «сохранено» после обрыва сети означало бы
   * разное на клиенте и на сервере, а именно этому учит AG-11.
   *
   * Отказ — тоже результат: состояние возвращается прежним, а `lastEvent.reason`
   * называет причину. Молчаливое игнорирование выглядело бы как успех.
   */
  function transitionJourney(state, event) {
    const current = normalizeJourney(state);
    const raw = event && typeof event === 'object' ? event : {};
    const ev = {
      id: text(raw.id, 120),
      type: text(raw.type, 40),
      at: isoOrEmpty(raw.at),
    };
    const next = clone(current);

    if (!ev.type) return record(next, ev, current.status, false, 'no_event_type');
    if (!ev.id) return record(next, ev, current.status, false, 'no_event_id');
    if (current.seenEventIds.indexOf(ev.id) >= 0) {
      next.lastEvent = { id: ev.id, type: ev.type, applied: false, reason: 'duplicate_event' };
      return next;
    }
    if (NON_VALUE_EVENTS.indexOf(ev.type) >= 0) return record(next, ev, current.status, false, 'not_first_value');
    if (EVENT_TYPES.indexOf(ev.type) < 0) return record(next, ev, current.status, false, 'unknown_event_type');

    const allowed = ALLOWED_FROM[ev.type] || [];
    if (allowed.indexOf(current.status) < 0) return record(next, ev, current.status, false, 'not_allowed_from_state');

    const from = current.status;

    if (ev.type === 'route_chosen') {
      const route = oneOf(text(raw.route, 20), ROUTES);
      if (!route) return record(next, ev, from, false, 'unknown_route');
      next.route = route;
      next.status = 'intent_known';
      next.deferredAt = '';
      next.deferredReason = '';
      next.resumeStatus = '';
      return record(next, ev, from, true, 'route_chosen');
    }

    if (ev.type === 'action_ready') {
      const ref = normalizeReference({ entityType: raw.entityType, entityId: raw.entityId, at: ev.at });
      if (!ref) return record(next, ev, from, false, 'incomplete_reference');
      // AG-13: ровно одно очевидное действие. Первое становится primary, остальное
      // уезжает в поддержку и никогда не спорит с ним за место.
      if (!next.primaryAction) next.primaryAction = ref;
      else if (next.primaryAction.entityId !== ref.entityId || next.primaryAction.entityType !== ref.entityType) {
        const known = next.otherSupport.some((s) => s.entityId === ref.entityId && s.entityType === ref.entityType);
        if (!known) next.otherSupport = tail(next.otherSupport.concat([ref]), MAX_SUPPORT);
      }
      next.status = 'action_ready';
      next.deferredAt = '';
      next.deferredReason = '';
      next.resumeStatus = '';
      return record(next, ev, from, true, 'action_ready');
    }

    if (ev.type === 'action_started') {
      const ref = normalizeReference({ entityType: raw.entityType, entityId: raw.entityId, at: ev.at });
      if (ref && !next.primaryAction) next.primaryAction = ref;
      if (!next.primaryAction) return record(next, ev, from, false, 'no_primary_action');
      next.status = 'action_started';
      next.deferredAt = '';
      next.deferredReason = '';
      next.resumeStatus = '';
      return record(next, ev, from, true, 'action_started');
    }

    if (ev.type === 'outcome_recorded') {
      if (!isMeaningfulOutcome(Object.assign({ type: 'outcome_recorded' }, raw))) {
        return record(next, ev, from, false, 'not_first_value');
      }
      const evidence = normalizeEvidence(raw.evidence && typeof raw.evidence === 'object' ? raw.evidence : raw);
      // firstValueAt пишется один раз и навсегда. Второй настоящий результат — это
      // хорошая новость, но «первым» он уже не станет, и переписывать момент нельзя:
      // на нём держится весь замер AG-09.
      if (!next.firstValueAt) {
        next.firstValueAt = ev.at || evidence.occurredAt;
        next.evidence = evidence;
      }
      if (!next.primaryAction) next.primaryAction = { entityType: evidence.entityType, entityId: evidence.entityId, at: evidence.occurredAt };
      next.status = 'first_value_reached';
      next.deferredAt = '';
      next.deferredReason = '';
      next.resumeStatus = '';
      return record(next, ev, from, true, from === 'first_value_reached' ? 'first_value_already_recorded' : 'first_value_reached');
    }

    if (ev.type === 'journey_completed') {
      if (!next.firstValueAt) return record(next, ev, from, false, 'no_first_value');
      if (!next.completedAt) next.completedAt = ev.at || next.firstValueAt;
      next.status = 'completed';
      return record(next, ev, from, true, 'completed');
    }

    if (ev.type === 'deferred') {
      // Отложить — законный ход, а не провал. Ни статуса, ни улики он не отнимает,
      // и вернуться можно ровно туда, где человек остановился.
      if (!next.resumeStatus) next.resumeStatus = from === 'deferred' ? current.resumeStatus : from;
      next.deferredAt = ev.at;
      next.deferredReason = text(raw.reason, 200);
      next.status = 'deferred';
      return record(next, ev, from, true, 'deferred');
    }

    if (ev.type === 'resumed') {
      next.status = next.resumeStatus || (next.route ? 'intent_known' : 'new');
      next.resumeStatus = '';
      next.deferredAt = '';
      next.deferredReason = '';
      return record(next, ev, from, true, 'resumed');
    }

    return record(next, ev, from, false, 'unhandled_event');
  }

  // -------------------------------------------------------------------- view --

  function suggestRoute(profile) {
    if (profile.needsRecovery) return 'recover';
    if (profile.hasPlan) return 'clarify';
    return 'do_now';
  }

  function nextEventTypes(status) {
    return Object.freeze(EVENT_TYPES.filter((type) => (ALLOWED_FROM[type] || []).indexOf(status) >= 0));
  }

  /**
   * Готовит контракт для UI. Что рисовать — решает Codex; здесь фиксируется только то,
   * чего рисовать нельзя: два «главных» действия одновременно и любое последствие
   * превышения десяти минут.
   *
   * `options.now` (ISO) необязателен. Без него `elapsedMs` и `overTarget` равны null:
   * часов внутри нет, иначе вид перестал бы быть воспроизводимым.
   */
  function deriveJourneyView(state, options) {
    const s = normalizeJourney(state);
    const opts = options && typeof options === 'object' ? options : {};
    const nowMs = isoOrEmpty(opts.now) ? Date.parse(opts.now) : NaN;
    const startMs = s.startedAt ? Date.parse(s.startedAt) : NaN;
    const elapsedMs = Number.isFinite(nowMs) && Number.isFinite(startMs) ? Math.max(0, nowMs - startMs) : null;

    return Object.freeze({
      version: 1,
      status: s.status,
      route: s.route,
      // Подсказка, а не решение: маршрут всё равно выбирает человек.
      suggestedRoute: s.route || suggestRoute(s.profile),
      // Ровно одно главное действие. Никогда массив.
      primaryAction: s.primaryAction ? Object.freeze(Object.assign({}, s.primaryAction)) : null,
      otherSupport: Object.freeze(s.otherSupport.map((r) => Object.freeze(Object.assign({}, r)))),
      firstValueReached: !!s.firstValueAt,
      firstValueAt: s.firstValueAt || null,
      evidence: getFirstValueEvidence(s),
      deferred: s.status === 'deferred',
      deferredReason: s.deferredReason || null,
      elapsedMs,
      targetMs: TARGET_MS,
      // AG-32. Флаг существует, чтобы предложить остановиться или продолжить.
      // Он не меняет статус, не отнимает улику и не имеет продолжения в экономике.
      overTarget: elapsedMs == null ? null : elapsedMs > TARGET_MS,
      acceptsEvents: nextEventTypes(s.status),
      lastEvent: s.lastEvent ? Object.freeze(Object.assign({}, s.lastEvent)) : null,
    });
  }

  return {
    VERSION,
    STATES,
    ROUTES,
    OUTCOME_TYPES,
    NON_VALUE_EVENTS,
    EVENT_TYPES,
    ROUTE_OUTCOMES,
    TARGET_MS,
    createJourney,
    transitionJourney,
    deriveJourneyView,
    isMeaningfulOutcome,
    getFirstValueEvidence,
  };
});
