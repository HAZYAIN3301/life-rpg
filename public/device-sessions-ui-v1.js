'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeviceSessionsUIV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const words = {
    cancel: ['Cancel', 'Отмена', 'Abbrechen', 'Скасувати', 'Cancelar'],
    title: ['Remembered devices', 'Запомненные устройства', 'Gespeicherte Geräte', 'Запам’ятовані пристрої', 'Dispositivos guardados'],
    empty: ['No remembered devices.', 'Запомненных устройств нет.', 'Keine gespeicherten Geräte.', 'Запам’ятованих пристроїв немає.', 'No hay dispositivos guardados.'],
    loading: ['Loading devices…', 'Загружаем устройства…', 'Geräte werden geladen…', 'Завантажуємо пристрої…', 'Cargando dispositivos…'],
    error: ['Could not verify devices. Try again.', 'Не удалось проверить устройства. Повторите.', 'Geräte konnten nicht geprüft werden. Erneut versuchen.', 'Не вдалося перевірити пристрої. Повторіть.', 'No se pudieron verificar los dispositivos. Reinténtalo.'],
    refresh: ['Refresh devices', 'Обновить устройства', 'Geräte aktualisieren', 'Оновити пристрої', 'Actualizar dispositivos'],
    notice: ['New device access needs your confirmation.', 'Новый доступ устройства ждёт вашего подтверждения.', 'Ein neuer Gerätezugriff wartet auf deine Bestätigung.', 'Новий доступ пристрою очікує вашого підтвердження.', 'Un nuevo acceso necesita tu confirmación.'],
    review: ['Review devices', 'Проверить устройства', 'Geräte prüfen', 'Перевірити пристрої', 'Revisar dispositivos'],
    current: ['This device', 'Это устройство', 'Dieses Gerät', 'Цей пристрій', 'Este dispositivo'],
    ack: ['This is me', 'Это я', 'Das bin ich', 'Це я', 'Soy yo'],
    revoke: ['Revoke access', 'Отозвать доступ', 'Zugriff widerrufen', 'Відкликати доступ', 'Revocar acceso'],
    all: ['Revoke all remembered devices', 'Отозвать все запомненные устройства', 'Alle gespeicherten Geräte widerrufen', 'Відкликати всі запам’ятовані пристрої', 'Revocar todos los dispositivos guardados'],
    confirm: ['End access for this device?', 'Завершить доступ этого устройства?', 'Zugriff für dieses Gerät beenden?', 'Завершити доступ цього пристрою?', '¿Finalizar el acceso de este dispositivo?'],
    confirmAll: ['End access for all remembered devices?', 'Завершить доступ всех запомненных устройств?', 'Zugriff für alle gespeicherten Geräte beenden?', 'Завершити доступ усіх запам’ятованих пристроїв?', '¿Finalizar el acceso de todos los dispositivos guardados?'],
    inactive: ['Access ended', 'Доступ завершён', 'Zugriff beendet', 'Доступ завершено', 'Acceso finalizado'],
    restricted: ['To confirm or manage other devices, sign in at satoruapp.com in your browser.', 'Для подтверждения и управления другими устройствами войдите на satoruapp.com в браузере.', 'Melde dich im Browser auf satoruapp.com an, um andere Geräte zu bestätigen oder zu verwalten.', 'Для підтвердження та керування іншими пристроями увійдіть на satoruapp.com у браузері.', 'Inicia sesión en satoruapp.com en el navegador para confirmar o gestionar otros dispositivos.'],
    description: ['Native devices you chose to remember. Browser sessions are separate.', 'Нативные устройства, которые вы решили запомнить. Входы в браузерах учитываются отдельно.', 'Native Geräte, die du gespeichert hast. Browsersitzungen sind separat.', 'Нативні пристрої, які ви вирішили запам’ятати. Входи в браузерах обліковуються окремо.', 'Dispositivos nativos que elegiste guardar. Las sesiones del navegador son independientes.'],
  };
  const text = (key, lang) => words[key][Math.max(0, ['en', 'ru', 'de', 'uk', 'es'].indexOf(lang))];
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function validList(data) {
    return data?.ok === true && typeof data.canManageAll === 'boolean' && Array.isArray(data.devices)
      && data.devices.length <= 60 && data.devices.every((d) => d && /^[a-f0-9]{32}$/.test(d.id)
        && typeof d.name === 'string' && typeof d.platform === 'string'
        && ['active', 'needsAck', 'current'].every((key) => typeof d[key] === 'boolean'));
  }
  function button(action, label, busy, id = '') {
    return `<button type="button" class="btn ghost" data-action="device-${action}" data-device-id="${esc(id)}" ${busy ? 'disabled' : ''}>${esc(label)}</button>`;
  }
  function card(state, lang) {
    const t = (key) => text(key, lang);
    const devices = state.data?.devices || [];
    const manage = state.data?.canManageAll;
    return `<section class="card device-sessions-card" aria-labelledby="device-sessions-title">
      <h3 id="device-sessions-title" tabindex="-1">${t('title')}</h3>
      <p class="muted">${t('description')}</p>
      ${state.error ? `<p role="alert">${t('error')}</p>` : ''}
      ${!state.data ? `<p class="muted">${t(state.busy ? 'loading' : 'error')}</p>`
        : `${!devices.length ? `<p class="muted">${t('empty')}</p>` : ''}
        ${!manage ? `<p class="muted">${t('restricted')}</p>` : ''}
        <ul class="device-session-list">${devices.map((d) => `<li>
          <strong>${esc(d.name)}</strong> <span class="muted">${esc(d.platform)}${d.current ? ' · ' + t('current') : ''}</span>
          ${d.needsAck ? `<p>${t('notice')}</p>` : ''}
          <div class="device-session-actions">
          ${d.needsAck && manage ? button('ack', t('ack'), state.busy, d.id) : ''}
          ${d.active && (manage || d.current) ? button('revoke', t('revoke'), state.busy, d.id) : ''}
          ${!d.active ? `<span class="muted">${t('inactive')}</span>` : ''}
          </div></li>`).join('')}</ul>
        ${manage && devices.some((d) => d.active) ? button('revoke-all', t('all'), state.busy) : ''}`}
      ${button('refresh', t('refresh'), state.busy)}
    </section>`;
  }
  function notice(state, lang) {
    if (!state.data?.devices.some((d) => d.needsAck)) return '';
    return `<aside class="device-session-notice" role="status"><span>${text('notice', lang)}</span>
      ${button('review', text('review', lang), false)}</aside>`;
  }
  return Object.freeze({ text, validList, card, notice });
});
