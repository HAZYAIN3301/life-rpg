/* Satoru First Real Value UI v1 — pure presentation for FirstValueV1. */
(function exposeFirstValueUi(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FirstValueUiV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildFirstValueUi() {
  'use strict';

  const VERSION = '1.0.0';
  const ROUTE_LABELS = Object.freeze({
    do_now: Object.freeze({
      eyebrow: 'Сделать сейчас', title: 'Один маленький настоящий шаг',
      description: 'Выбери посильное дело и доведи его до сохранённого результата.',
      choose: 'Сделать маленький шаг', prepare: 'Выбрать шаг',
    }),
    clarify: Object.freeze({
      eyebrow: 'Уточнить', title: 'Достать следующий шаг из плана',
      description: 'Не планировать всё заново — закрепить одно конкретное действие.',
      choose: 'Найти следующий шаг', prepare: 'Уточнить действие',
    }),
    recover: Object.freeze({
      eyebrow: 'Восстановиться', title: 'Начать безопасное восстановление',
      description: 'Поставить настоящую границу отдыха и снять лишнее давление.',
      choose: 'Начать восстановление', prepare: 'Выбрать границу',
    }),
  });
  const STATUS_LABELS = Object.freeze({
    new: 'Первый вход', intent_known: 'Направление выбрано', action_ready: 'Шаг готов',
    action_started: 'Шаг начат', first_value_reached: 'Результат сохранён',
    completed: 'Завершено', deferred: 'Можно вернуться позже',
  });
  const OUTCOME_LABELS = Object.freeze({
    quest_completed: 'Задача выполнена', next_action_committed: 'Следующий шаг закреплён',
    recovery_boundary_started: 'Граница восстановления начата', real_plan_created: 'План сохранён',
  });
  const ENTITY_LABELS = Object.freeze({
    quest: 'Квест', task: 'Задача', goal: 'Цель', goal_step: 'Шаг цели', plan: 'План',
    recovery_boundary: 'Граница восстановления', attention_session: 'Сессия',
  });
  const ACTIONS = Object.freeze({
    chooseRoute: 'first-value-choose-route', prepareRoute: 'first-value-prepare-route',
    openPrimary: 'first-value-open-primary', openSupport: 'first-value-open-support',
    resume: 'first-value-resume', defer: 'first-value-defer',
    complete: 'first-value-complete-journey', overTargetStop: 'first-value-over-target-stop',
    overTargetContinue: 'first-value-over-target-continue',
  });

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function text(value, fallback) { const v = String(value == null ? '' : value).trim(); return v || fallback || ''; }
  function translate(context, key) {
    const source = text(key), t = context && typeof context.t === 'function' ? context.t : null;
    if (!t || !source) return source;
    try { return text(t(source), source); } catch (_) { return source; }
  }
  function translatedTemplate(context, key, values) {
    let result = translate(context, key);
    for (const [name, value] of Object.entries(values || {})) result = result.replaceAll(`{${name}}`, text(value));
    return result;
  }
  function array(value) { return Array.isArray(value) ? value : []; }
  function accepts(view, eventType) { return array(view && view.acceptsEvents).includes(eventType); }
  function routeCopy(route) { return ROUTE_LABELS[route] || ROUTE_LABELS.do_now; }
  function formatMinutes(milliseconds, context) {
    const value = Number(milliseconds); if (!Number.isFinite(value) || value < 0) return '';
    return `${Math.max(1, Math.round(value / 60000))} ${translate(context, 'мин')}`;
  }
  function referenceKey(reference) {
    const ref = reference && typeof reference === 'object' ? reference : {};
    return `${text(ref.entityType)}:${text(ref.entityId)}`;
  }
  function resolveReference(reference, context) {
    const ref = reference && typeof reference === 'object' ? reference : {};
    const ctx = context && typeof context === 'object' ? context : {};
    const fromMap = ctx.references && typeof ctx.references === 'object' ? ctx.references[referenceKey(ref)] : null;
    let resolved = fromMap && typeof fromMap === 'object' ? fromMap : null;
    if (!resolved && typeof ctx.resolveReference === 'function') {
      try {
        const candidate = ctx.resolveReference(Object.freeze({ entityType: text(ref.entityType), entityId: text(ref.entityId), at: text(ref.at) }));
        if (candidate && typeof candidate === 'object') resolved = candidate;
      } catch (_) { resolved = null; }
    }
    const entityType = text(ref.entityType, 'item'), entityId = text(ref.entityId);
    const fallbackType = translate(ctx, ENTITY_LABELS[entityType] || 'Шаг');
    return Object.freeze({
      entityType, entityId,
      title: text(resolved && resolved.title, `${fallbackType}: ${entityId || translate(ctx, 'без названия')}`),
      meta: text(resolved && resolved.meta), actionLabel: text(resolved && resolved.actionLabel),
    });
  }
  function actionButton(action, label, options, context) {
    const opts = options && typeof options === 'object' ? options : {};
    const attrs = ['type="button"', `class="${opts.secondary ? 'first-value-card__secondary' : 'first-value-card__primary'}"`, `data-action="${escapeHtml(action)}"`];
    if (opts.route) attrs.push(`data-route="${escapeHtml(opts.route)}"`);
    if (opts.entityType) attrs.push(`data-entity-type="${escapeHtml(opts.entityType)}"`);
    if (opts.entityId) attrs.push(`data-entity-id="${escapeHtml(opts.entityId)}"`);
    if (opts.disabled || context?.busy === true) attrs.push('disabled aria-disabled="true"');
    return `<button ${attrs.join(' ')}>${escapeHtml(translate(context, label))}</button>`;
  }
  function renderOtherRoutes(primaryRoute, context) {
    return Object.keys(ROUTE_LABELS).filter((route) => route !== primaryRoute)
      .map((route) => actionButton(ACTIONS.chooseRoute, routeCopy(route).eyebrow, { secondary: true, route }, context)).join('');
  }
  function renderSupport(view, context) {
    const items = array(view?.otherSupport).map((reference) => resolveReference(reference, context));
    if (!items.length) return '';
    const label = escapeHtml(translate(context, 'Другая поддержка'));
    return `<div class="first-value-card__support" aria-label="${label}"><span class="first-value-card__support-label">${label}</span><div class="first-value-card__support-list">${items.map((item) => actionButton(ACTIONS.openSupport, item.title, { secondary: true, entityType: item.entityType, entityId: item.entityId }, context)).join('')}</div></div>`;
  }
  function renderOverTarget(view, context) {
    if (!view || view.overTarget !== true || view.firstValueReached || view.deferred) return '';
    const promised = formatMinutes(view.targetMs, context) || translate(context, 'обещанного короткого времени');
    const description = translatedTemplate(context, 'Прошло больше {time}. Ничего не потеряно: остановись сейчас или спокойно продолжи.', { time: promised });
    return `<aside class="first-value-card__boundary" role="status"><div><strong>${escapeHtml(translate(context, 'Можно остановиться'))}</strong><p>${escapeHtml(description)}</p></div><div class="first-value-card__boundary-actions">${accepts(view, 'deferred') ? actionButton(ACTIONS.overTargetStop, 'Вернуться позже', { secondary: true }, context) : ''}${actionButton(ACTIONS.overTargetContinue, 'Продолжить', { secondary: true }, context)}</div></aside>`;
  }
  function renderNew(view, context) {
    const route = ROUTE_LABELS[view.suggestedRoute] ? view.suggestedRoute : 'do_now', copy = routeCopy(route);
    const primary = accepts(view, 'route_chosen') ? actionButton(ACTIONS.chooseRoute, copy.choose, { route }, context) : '';
    const alternatives = accepts(view, 'route_chosen') ? renderOtherRoutes(route, context) : '';
    const body = alternatives ? `<div class="first-value-card__support first-value-card__support--routes"><span class="first-value-card__support-label">${escapeHtml(translate(context, 'Другая поддержка'))}</span><div class="first-value-card__support-list">${alternatives}</div></div>` : '';
    return { eyebrow: translate(context, STATUS_LABELS.new), title: translate(context, 'Сначала — одна настоящая польза'), description: translate(context, 'Без длинной настройки. Satoru предложит один путь, а результат появится только после сохранённого действия.'), body, primary };
  }
  function renderDeferred(view, context) {
    const reason = translate(context, text(view.deferredReason));
    return {
      eyebrow: translate(context, STATUS_LABELS.deferred), title: translate(context, 'Твой шаг сохранён'),
      description: reason ? translatedTemplate(context, 'Отложено: {reason}. Это не провал — можно продолжить с того же места.', { reason }) : translate(context, 'Это не провал — можно продолжить с того же места, когда появится ресурс.'),
      body: '', primary: accepts(view, 'resumed') ? actionButton(ACTIONS.resume, 'Вернуться к шагу', {}, context) : '',
    };
  }
  function renderReached(view, context) {
    const evidence = view.evidence && typeof view.evidence === 'object' ? view.evidence : {};
    const resolved = evidence.entityId ? resolveReference(evidence, context) : null;
    const outcome = translate(context, OUTCOME_LABELS[evidence.outcomeType] || 'Настоящий результат сохранён');
    return {
      eyebrow: translate(context, STATUS_LABELS.first_value_reached), title: translate(context, 'Первый настоящий результат уже здесь'),
      description: resolved ? `${outcome}: ${resolved.title}.` : `${outcome}.`,
      body: `<p class="first-value-card__proof">${escapeHtml(translate(context, 'Satoru дождался подтверждённой записи — поэтому этому результату можно доверять.'))}</p>`,
      primary: accepts(view, 'journey_completed') ? actionButton(ACTIONS.complete, 'Продолжить в Satoru', {}, context) : '',
    };
  }
  function renderInProgress(view, context) {
    const route = ROUTE_LABELS[view.route] ? view.route : (ROUTE_LABELS[view.suggestedRoute] ? view.suggestedRoute : 'do_now');
    const copy = routeCopy(route), reference = view.primaryAction ? resolveReference(view.primaryAction, context) : null;
    const isStarted = view.status === 'action_started', isReady = view.status === 'action_ready';
    let primary = '';
    if (reference && (isReady || isStarted)) {
      const canOpen = isStarted ? accepts(view, 'outcome_recorded') : accepts(view, 'action_started');
      if (canOpen) primary = actionButton(ACTIONS.openPrimary, reference.actionLabel || (isStarted ? 'Продолжить шаг' : 'Начать шаг'), { entityType: reference.entityType, entityId: reference.entityId }, context);
    } else if (accepts(view, 'action_ready') || accepts(view, 'action_started')) primary = actionButton(ACTIONS.prepareRoute, copy.prepare, { route }, context);
    const detail = reference ? `<div class="first-value-card__chosen"><span>${escapeHtml(translate(context, isStarted ? 'Сейчас в работе' : 'Твой следующий шаг'))}</span><strong>${escapeHtml(reference.title)}</strong>${reference.meta ? `<small>${escapeHtml(reference.meta)}</small>` : ''}</div>` : '';
    return { eyebrow: translate(context, copy.eyebrow), title: translate(context, copy.title), description: translate(context, copy.description), body: `${detail}${renderSupport(view, context)}`, primary };
  }
  function renderCard(view, context) {
    if (!view || typeof view !== 'object' || view.status === 'completed') return '';
    const ctx = context && typeof context === 'object' ? context : {};
    const content = view.deferred || view.status === 'deferred' ? renderDeferred(view, ctx)
      : view.firstValueReached || view.status === 'first_value_reached' ? renderReached(view, ctx)
        : view.status === 'new' ? renderNew(view, ctx) : renderInProgress(view, ctx);
    const canDefer = accepts(view, 'deferred') && !view.deferred && !view.firstValueReached;
    return `<section class="first-value-card" data-first-value-status="${escapeHtml(view.status)}" data-first-value-route="${escapeHtml(view.route || view.suggestedRoute || '')}"><header class="first-value-card__header"><span class="first-value-card__kicker">${escapeHtml(text(ctx.title, translate(ctx, 'Первый результат')))}</span><span class="first-value-card__state">${escapeHtml(translate(ctx, STATUS_LABELS[view.status] || ''))}</span></header><div class="first-value-card__content"><span class="first-value-card__eyebrow">${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.title)}</h2><p>${escapeHtml(content.description)}</p>${content.body}</div>${renderOverTarget(view, ctx)}<footer class="first-value-card__actions">${content.primary || ''}${canDefer ? actionButton(ACTIONS.defer, 'Вернуться позже', { secondary: true }, ctx) : ''}</footer></section>`;
  }

  return Object.freeze({ VERSION, ACTIONS, ROUTE_LABELS, STATUS_LABELS, OUTCOME_LABELS, ENTITY_LABELS, escapeHtml, formatMinutes, resolveReference, renderCard });
});
