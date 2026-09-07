/* Satoru Board v2 — client-side local discovery view model.
 * Pure validation/formatting only: fetch, DOM, State and persistence stay in
 * the thin app adapter. Server registry remains the only authority for search
 * templates and interests.
 */
(function exposeBoardV2LocalUI(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2LocalUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2LocalUI() {
  'use strict';

  const VERSION = '1.0.0';
  const STATUS_SCHEMA = 'satoru.board-discovery-account/1';
  const SUMMARY_STATUSES = Object.freeze(['recently-matched', 'details-may-have-changed', 'likely-unavailable']);
  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    return out && out.length <= max && !/[\u0000-\u001f{}<>]/.test(out) ? out : '';
  }
  function id(value, max) {
    const out = text(value, max || 80);
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(out) ? out : '';
  }
  function safeHttps(value) {
    try { const url = new URL(text(value, 500)); return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  }
  function normalizeOption(raw) {
    if (!plain(raw)) return null;
    const optionId = id(raw.id, 48), label = text(raw.label, 80), description = text(raw.description, 220);
    const templateId = id(raw.templateId, 80), slotId = id(raw.slotId, 48);
    const interests = [];
    for (const row of Array.isArray(raw.interests) ? raw.interests : []) {
      const interestId = id(row && row.id, 48), interestLabel = text(row && row.label, 80);
      if (interestId && interestLabel && !interests.some((item) => item.id === interestId)) interests.push({ id: interestId, label: interestLabel });
    }
    return optionId && label && description && templateId && slotId && interests.length
      ? { id: optionId, label, description, templateId, slotId, interests: interests.slice(0, 12) } : null;
  }
  function normalizeStatus(raw) {
    if (!plain(raw) || raw.schema !== STATUS_SCHEMA) return null;
    const consentSource = plain(raw.consent) ? raw.consent : {};
    const enabled = consentSource.enabled === true;
    const consent = enabled ? {
      enabled: true, city: text(consentSource.city, 100),
      countryCode: text(consentSource.countryCode, 2).toUpperCase(),
      provider: text(consentSource.provider, 40),
      shareCityWithProvider: consentSource.shareCityWithProvider === true,
    } : { enabled: false };
    if (enabled && (!consent.city || !/^[A-Z]{2}$/.test(consent.countryCode)
      || consent.provider !== 'brave-web-v1' || !consent.shareCityWithProvider)) return null;
    const options = (Array.isArray(raw.options) ? raw.options : []).map(normalizeOption).filter(Boolean);
    const searches = Number(raw.billing && raw.billing.searches), limit = Number(raw.billing && raw.billing.limit);
    const freshCandidates = Number(raw.cache && raw.cache.freshCandidates);
    if (!Number.isSafeInteger(searches) || searches < 0 || !Number.isSafeInteger(limit) || limit < 1
      || !Number.isSafeInteger(freshCandidates) || freshCandidates < 0 || !options.length) return null;
    return {
      schema: STATUS_SCHEMA, consent, providerAvailable: raw.providerAvailable === true, options,
      cache: { freshCandidates }, billing: { searches, limit },
    };
  }
  function consentPayload(raw) {
    const source = plain(raw) ? raw : {};
    const city = text(source.city, 100), countryCode = text(source.countryCode, 2).toUpperCase();
    const timezone = text(source.timezone, 80), locale = text(source.locale, 12);
    if (source.accepted !== true || source.providerConfirmed !== true || !city || !/^[A-Z]{2}$/.test(countryCode)
      || !/^(?:UTC|GMT|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/.test(timezone)
      || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) return null;
    return {
      enabled: true, city, countryCode, timezone, locale,
      provider: 'brave-web-v1', shareCityWithProvider: true,
    };
  }
  function resolvePayload(status, raw) {
    const state = normalizeStatus(status), source = plain(raw) ? raw : {};
    if (!state || !state.consent.enabled || !state.providerAvailable) return null;
    const option = state.options.find((item) => item.id === id(source.optionId, 48));
    const interestId = id(source.interestId, 48);
    if (!option || !option.interests.some((item) => item.id === interestId)) return null;
    return { templateId: option.templateId, slotId: option.slotId, interestId };
  }
  function failureMessage(reason) {
    return ({
      'city-consent-required': 'Сначала разреши использовать город.',
      'provider-unavailable': 'Поиск по официальным источникам сейчас не подключён на сервере.',
      'daily-search-limit': 'Сегодня лимит поиска исчерпан. Уже найденные варианты остаются на доске.',
      'no-verified-candidate': 'Надёжный вариант не найден. Доска не будет подставлять случайное место.',
      'provider-error': 'Источник временно не ответил. Попробуй позже.',
      aborted: 'Поиск остановлен.',
      'invalid-verified-recommendation': 'Ответ не прошёл повторную проверку и не был добавлен.',
      'user-readiness-required': 'Для этого варианта сначала нужно подтвердить условия участия.',
      'commit-failed': 'Заказ найден, но не сохранился. Ничего не изменено — попробуй ещё раз.',
    })[reason] || 'Не удалось найти и сохранить конкретный вариант.';
  }
  function validLocalSnapshot(snapshot) {
    return plain(snapshot) && snapshot.schema === 'satoru.board-offer-snapshot/2'
      && Array.isArray(snapshot.tags) && snapshot.tags.includes('local')
      && plain(snapshot.primaryAction) && !!safeHttps(snapshot.primaryAction.url);
  }
  function feedbackTarget(rawOffers, tasks) {
    const snapshots = Array.isArray(rawOffers && rawOffers.snapshots) ? rawOffers.snapshots : [];
    const history = Array.isArray(rawOffers && rawOffers.history) ? rawOffers.history : [];
    const latestLive = snapshots.slice().reverse().find((snapshot) => {
      if (!validLocalSnapshot(snapshot) || snapshot.mode !== 'manual-local') return false;
      const outcome = history.slice().reverse().find((entry) => entry && entry.snapshotId === snapshot.id);
      return outcome && ['displayed', 'taken'].includes(outcome.outcome);
    });
    if (latestLive) return { snapshotId: latestLive.id, completed: false };
    for (const task of (Array.isArray(tasks) ? tasks : []).slice().reverse()) {
      if (!task || task.done !== true || task.fromBoardV2 !== true) continue;
      const snapshot = snapshots.find((item) => item && item.id === task.boardSnapshotId);
      if (validLocalSnapshot(snapshot)) return { snapshotId: snapshot.id, completed: true };
    }
    return null;
  }
  function normalizeCommunity(raw) {
    if (!plain(raw) || raw.ok !== true) return null;
    let summary = null;
    if (plain(raw.summary)) {
      const reports = Number(raw.summary.reports), status = text(raw.summary.status, 40);
      if (!Number.isSafeInteger(reports) || reports < 3 || !SUMMARY_STATUSES.includes(status)) return null;
      summary = { reports, status };
    }
    return { summary, canMark: raw.canMark === true, alreadyMarked: raw.alreadyMarked === true };
  }
  function summaryMessage(summary) {
    if (!summary) return '';
    if (summary.status === 'likely-unavailable') return `По ${summary.reports} отметкам место, вероятно, больше недоступно.`;
    if (summary.status === 'details-may-have-changed') return `${summary.reports} человек проверили место; часть деталей могла измениться.`;
    return `${summary.reports} человек недавно подтвердили, что данные совпадают.`;
  }

  return Object.freeze({
    VERSION, STATUS_SCHEMA, SUMMARY_STATUSES, normalizeStatus, consentPayload,
    resolvePayload, failureMessage, feedbackTarget, normalizeCommunity, summaryMessage,
  });
});
