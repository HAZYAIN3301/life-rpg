(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./chest-claim-v1') : root.ChestClaimV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChestClaimRuntimeV1 = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function (Claim) {
  'use strict';
  async function commit(holder, adapter) {
    if (!holder || !Claim || !adapter) return null;
    try {
      if (!adapter.current()) return null;
      if (!holder.request) {
        const request = { version: 1, requestId: adapter.requestId(), timeZone: adapter.timeZone(), base: adapter.base() };
        if (!Claim.requestValid(request)) { holder.error = 'chest_state_not_supported'; return null; }
        // Freeze one serialization before the request. Initialization failures
        // also return null; a failed getter/crypto call cannot escape the dialog.
        const body = JSON.stringify(request), frozen = JSON.parse(body);
        holder.request = frozen; holder.body = body;
      }
      holder.error = '';
      const response = await adapter.fetch('/api/rewards/chest', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: holder.body, signal: AbortSignal.timeout(15000) });
      if (!adapter.current()) return null;
      if (response.status === 401) { adapter.expired(); return null; }
      // Chest admission/replay conflicts are local to this claim. The older
      // commitment handler marks the whole account conflicted for every 409.
      // Preserve its unread response for actual graph-boundary errors only.
      if (!response.ok) {
        let rejection; try { rejection = await response.clone().json(); } catch {}
        if (!adapter.current()) return null;
        if (typeof rejection?.error === 'string' && /^(chest_|invalid_chest_request$)/.test(rejection.error)) {
          holder.error = rejection.error; return null;
        }
      }
      if (await adapter.boundary(response)) return null;
      if (!adapter.current()) return null;
      const receipt = await response.json();
      if (!adapter.current()) return null;
      if (!response.ok) { holder.error = typeof receipt?.error === 'string' ? receipt.error : 'chest_save_unconfirmed'; return null; }
      if (!Claim.receiptValid(receipt, holder.request)) { holder.error = 'chest_invalid_receipt'; return null; }
      if (!adapter.apply(receipt)) return null;
      return receipt;
    } catch {
      // A late rejection/json failure belongs to the original account/epoch.
      // It must not overwrite feedback in a replacement session.
      try { if (adapter.current()) holder.error = holder.request ? 'chest_save_unconfirmed' : 'chest_state_not_supported'; } catch {}
      return null;
    }
  }
  const COPY = {
    ru: ['Награда пока не подтверждена. Повтори запрос — повторной выдачи не будет.', 'Данные изменились. Обнови страницу перед следующим открытием.', 'Сейчас нет доступной награды. Обнови страницу.', 'Дата наград опережает текущую. Проверь часовой пояс и открой сундук позже.'],
    en: ['The reward is not confirmed yet. Retry; this will not issue it twice.', 'The data changed. Reload before opening another chest.', 'No reward is available now. Reload the page.', 'The reward date is ahead of today. Check your time zone and try later.'],
    de: ['Die Belohnung ist noch nicht bestätigt. Erneut versuchen; sie wird nicht doppelt vergeben.', 'Die Daten haben sich geändert. Vor der nächsten Truhe die Seite neu laden.', 'Momentan ist keine Belohnung verfügbar. Seite neu laden.', 'Das Belohnungsdatum liegt in der Zukunft. Zeitzone prüfen und später versuchen.'],
    uk: ['Нагороду ще не підтверджено. Повтори запит — подвійної видачі не буде.', 'Дані змінилися. Онови сторінку перед наступною скринею.', 'Зараз немає доступної нагороди. Онови сторінку.', 'Дата нагород попереду поточної. Перевір часовий пояс і спробуй пізніше.'],
    es: ['La recompensa aún no está confirmada. Reintenta; no se entregará dos veces.', 'Los datos han cambiado. Recarga antes de abrir otro cofre.', 'Ahora no hay recompensa disponible. Recarga la página.', 'La fecha de recompensas está adelantada. Revisa tu zona horaria e inténtalo más tarde.'],
  };
  function errorText(code, lang) {
    const index = ['chest_revision_conflict', 'chest_request_conflict', 'chest_receipt_state_changed'].includes(code) ? 1
      : code === 'chest_unavailable' || code === 'chest_not_available' ? 2 : code === 'chest_future_day' ? 3 : 0;
    return (COPY[lang] || COPY.en)[index];
  }
  return Object.freeze({ commit, errorText });
});
