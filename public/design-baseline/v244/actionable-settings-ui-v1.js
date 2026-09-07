/* Satoru Actionable settings UI v1 — pure telemetry and AI-memory presentation. */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ActionableSettingsUiV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  'use strict';
  const VERSION = '1.0.0';
  const esc = (value) => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const tx = (context, value) => { try { return String(context?.t ? context.t(String(value || '')) : String(value || '')); } catch { return String(value || ''); } };
  const decided = (consent, id) => Array.isArray(consent?.history) && consent.history.some((row) => row && row.purpose === id);
  function telemetryState(purpose, consent, context) {
    const on = purpose.essential || consent?.purposes?.[purpose.id] === true;
    if (purpose.essential) return tx(context, 'Всегда включено');
    if (!on) return tx(context, 'Выключено вами');
    return decided(consent, purpose.id) ? tx(context, 'Включено вами') : tx(context, 'Включено по умолчанию — можно выключить');
  }
  function renderTelemetry(payload, context = {}) {
    if (context.loading) return `<section class="card actionable-card" aria-busy="true"><h3>${esc(tx(context, 'Диагностика и телеметрия'))}</h3><p class="muted">${esc(tx(context, 'Загружаем ваши настройки…'))}</p></section>`;
    if (!payload || !Array.isArray(payload.purposes)) return `<section class="card actionable-card" role="alert"><h3>${esc(tx(context, 'Диагностика и телеметрия'))}</h3><p>${esc(tx(context, context.error || 'Не удалось загрузить настройки телеметрии.'))}</p><button type="button" class="btn ghost" data-action="telemetry-consent-retry">${esc(tx(context, 'Повторить'))}</button></section>`;
    const rows = payload.purposes.map((purpose) => {
      const on = purpose.essential || payload.consent?.purposes?.[purpose.id] === true;
      return `<article class="telemetry-purpose" data-purpose="${esc(purpose.id)}"><div class="telemetry-purpose__copy"><div class="telemetry-purpose__head"><strong>${esc(tx(context, purpose.label))}</strong><span class="telemetry-purpose__state">${esc(telemetryState(purpose, payload.consent, context))}</span></div><p>${esc(tx(context, purpose.description))}</p><small>${esc(tx(context, 'Хранение'))}: ${esc(purpose.retentionDays)} ${esc(tx(context, 'дн.'))}</small>${purpose.essential && purpose.whyNotOptional ? `<small>${esc(tx(context, purpose.whyNotOptional))}</small>` : ''}</div>${purpose.essential ? `<span class="telemetry-purpose__essential" aria-label="${esc(tx(context, 'Всегда включено'))}">✓</span>` : `<label class="actionable-switch"><input type="checkbox" data-action="telemetry-consent-toggle" data-purpose="${esc(purpose.id)}" ${on ? 'checked' : ''} ${context.busy ? 'disabled' : ''}/><span aria-hidden="true"></span><span class="sr-only">${esc(telemetryState(purpose, payload.consent, context))}</span></label>`}</article>`;
    }).join('');
    return `<section class="card actionable-card telemetry-consent-card" aria-labelledby="telemetry-consent-title"><header><div><span class="actionable-kicker">${esc(tx(context, 'Ваш выбор'))}</span><h3 id="telemetry-consent-title">${esc(tx(context, 'Диагностика и телеметрия'))}</h3></div></header><p class="muted">${esc(tx(context, 'Каждая цель включается отдельно. Улучшение продукта не означает оптимизацию вовлечения.'))}</p>${context.error ? `<p class="actionable-error" role="alert">${esc(tx(context, context.error))}</p>` : ''}<div class="telemetry-purpose-list">${rows}</div></section>`;
  }
  function memoryActions(entry, context) {
    const disabled = context.busy || context.partial;
    if (entry.status === 'dismissed') return `<button type="button" class="btn ghost sm" data-action="ai-memory-restore" data-id="${esc(entry.id)}" ${disabled ? 'disabled' : ''}>${esc(tx(context, 'Вернуть'))}</button>`;
    return `<button type="button" class="btn ghost sm" data-action="ai-memory-edit" data-id="${esc(entry.id)}" ${disabled ? 'disabled' : ''}>${esc(tx(context, 'Исправить'))}</button><button type="button" class="btn ghost sm" data-action="ai-memory-dismiss" data-id="${esc(entry.id)}" ${disabled ? 'disabled' : ''}>${esc(tx(context, 'Не использовать'))}</button><button type="button" class="btn danger sm" data-action="ai-memory-delete" data-id="${esc(entry.id)}" ${disabled ? 'disabled' : ''}>${esc(tx(context, 'Удалить'))}</button>`;
  }
  function renderMemory(payload, context = {}) {
    if (context.loading) return `<section class="card actionable-card" aria-busy="true"><h3>${esc(tx(context, 'Память помощника'))}</h3><p class="muted">${esc(tx(context, 'Загружаем память…'))}</p></section>`;
    if (!payload || !Array.isArray(payload.entries)) return `<section class="card actionable-card" role="alert"><h3>${esc(tx(context, 'Память помощника'))}</h3><p>${esc(tx(context, context.error || 'Не удалось загрузить память помощника.'))}</p><button type="button" class="btn ghost" data-action="ai-memory-retry">${esc(tx(context, 'Повторить'))}</button></section>`;
    const rows = payload.entries.map((entry) => {
      const editing = String(context.editingId || '') === String(entry.id);
      const body = editing ? `<form class="ai-memory-edit-form" data-memory-id="${esc(entry.id)}"><label><span>${esc(tx(context, 'Что помнить'))}</span><textarea name="text" maxlength="400" required>${esc(entry.text)}</textarea></label><div class="actionable-row"><button type="submit" class="btn sm" ${context.busy ? 'disabled' : ''}>${esc(tx(context, 'Сохранить'))}</button><button type="button" class="btn ghost sm" data-action="ai-memory-cancel">${esc(tx(context, 'Отмена'))}</button></div></form>` : `<p class="ai-memory-entry__text" data-noi18n>${esc(entry.text)}</p>`;
      return `<article class="ai-memory-entry${entry.status === 'dismissed' ? ' is-dismissed' : ''}" data-memory-id="${esc(entry.id)}">${body}<div class="ai-memory-entry__explain"><span>${esc(tx(context, entry.origin))}</span><span>${esc(tx(context, entry.usage))}</span></div>${editing ? '' : `<div class="actionable-row">${memoryActions(entry, { ...context, partial: payload.partial })}</div>`}</article>`;
    }).join('');
    return `<section class="card actionable-card ai-memory-card" aria-labelledby="ai-memory-title"><header><div><span class="actionable-kicker">${esc(tx(context, 'Под вашим контролем'))}</span><h3 id="ai-memory-title">${esc(tx(context, 'Память помощника'))}</h3></div><button type="button" class="btn ghost sm" data-action="ai-memory-export">${esc(tx(context, 'Скачать память'))}</button></header><p class="muted">${esc(tx(context, 'Здесь видны отдельные факты, их источник и то, где они используются. Старое свободное досье остаётся отдельной карточкой ниже.'))}</p>${payload.partial ? `<p class="actionable-warning" role="alert">${esc(tx(context, 'Часть памяти не читается. Изменения заблокированы, чтобы ничего не потерять.'))}</p>` : ''}${context.error ? `<p class="actionable-error" role="alert">${esc(tx(context, context.error))}</p>` : ''}${rows || `<div class="actionable-empty"><b>${esc(tx(context, 'Отдельных записей пока нет'))}</b><span>${esc(tx(context, 'Когда помощник начнёт использовать структурированную память, каждая запись появится здесь с объяснением.'))}</span></div>`}</section>`;
  }
  return Object.freeze({ VERSION, telemetryState, renderTelemetry, renderMemory });
});
