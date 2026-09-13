/* User-facing purchase rejection copy. Unknown/ambiguous replies keep the existing retry copy. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PurchaseFeedbackV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const COPY = {
    inventory: {
      ru: 'Изменение предметов отклонено. Обнови данные и выбери действие заново.',
      en: 'The inventory change was rejected. Reload your data and choose the action again.',
      de: 'Die Änderung der Gegenstände wurde abgelehnt. Lade die Daten neu und wähle die Aktion erneut.',
      uk: 'Зміну предметів відхилено. Онови дані та вибери дію знову.',
      es: 'Se rechazó el cambio de objetos. Actualiza los datos y elige la acción de nuevo.',
    },
    selection: {
      ru: 'Этот предмет сейчас недоступен для выбора. Обнови данные и выбери доступный предмет.',
      en: 'This item cannot be selected right now. Reload your data and choose an available item.',
      de: 'Dieser Gegenstand kann gerade nicht ausgewählt werden. Lade die Daten neu und wähle einen verfügbaren Gegenstand.',
      uk: 'Цей предмет зараз недоступний для вибору. Онови дані та вибери доступний предмет.',
      es: 'Este objeto no se puede seleccionar ahora. Actualiza los datos y elige un objeto disponible.',
    },
    inventoryState: {
      ru: 'Не удалось проверить предметы. Изменение не сохранено; обнови данные и сообщи об ошибке, если она повторится.',
      en: 'Could not verify the inventory. The change was not saved; reload your data and report the error if it returns.',
      de: 'Die Gegenstände konnten nicht geprüft werden. Die Änderung wurde nicht gespeichert. Lade die Daten neu und melde den Fehler, falls er erneut auftritt.',
      uk: 'Не вдалося перевірити предмети. Зміну не збережено; онови дані й повідом про помилку, якщо вона повториться.',
      es: 'No se pudieron verificar los objetos. El cambio no se guardó; actualiza los datos e informa del error si se repite.',
    },
    level: {
      ru: 'Для этой покупки ещё не достигнут нужный уровень. Обнови данные, чтобы увидеть актуальный прогресс.',
      en: 'This purchase needs a higher level. Reload your data to see your current progress.',
      de: 'Für diesen Kauf ist ein höheres Level nötig. Lade die Daten neu, um deinen aktuellen Fortschritt zu sehen.',
      uk: 'Для цієї покупки ще не досягнуто потрібного рівня. Онови дані, щоб побачити актуальний прогрес.',
      es: 'Esta compra requiere un nivel más alto. Actualiza los datos para ver tu progreso actual.',
    },
    progress: {
      ru: 'Не удалось прочитать прогресс для покупки. Обнови данные; если ошибка останется, сообщи о ней.',
      en: 'Could not read your progress for this purchase. Reload your data; if the error remains, report it.',
      de: 'Dein Fortschritt für diesen Kauf konnte nicht gelesen werden. Lade die Daten neu und melde den Fehler, falls er bleibt.',
      uk: 'Не вдалося прочитати прогрес для покупки. Онови дані; якщо помилка залишиться, повідом про неї.',
      es: 'No se pudo leer tu progreso para esta compra. Actualiza los datos; si el error continúa, comunícalo.',
    },
    pro: {
      ru: 'Для выбранного оформления нужен действующий Pro. Обнови данные и выбери доступное оформление.',
      en: 'The selected appearance needs an active Pro plan. Reload your data and choose an available appearance.',
      de: 'Die gewählte Gestaltung benötigt ein aktives Pro-Abo. Lade die Daten neu und wähle eine verfügbare Gestaltung.',
      uk: 'Для вибраного оформлення потрібен активний Pro. Онови дані та вибери доступне оформлення.',
      es: 'El aspecto elegido requiere un plan Pro activo. Actualiza los datos y elige un aspecto disponible.',
    },
    ownership: {
      ru: 'Состав покупки не совпал с твоими предметами. Закрой это окно, обнови данные и выбери покупку заново.',
      en: 'The purchase does not match your inventory. Close this window, reload your data and choose the purchase again.',
      de: 'Der Kauf passt nicht zu deinen Gegenständen. Schließe dieses Fenster, lade die Daten neu und wähle den Kauf erneut.',
      uk: 'Склад покупки не збігся з твоїми предметами. Закрий це вікно, онови дані та вибери покупку знову.',
      es: 'La compra no coincide con tus objetos. Cierra esta ventana, actualiza los datos y elige la compra de nuevo.',
    },
  };
  const TYPES = Object.freeze({ purchase_level_required: 'level', purchase_progress_unavailable: 'progress',
    purchase_pro_required: 'pro', purchase_ownership_changed: 'ownership', purchase_relics_changed: 'ownership',
    invalid_purchase_equipment: 'ownership', purchase_credit_changed: 'ownership',
    inventory_ownership_changed: 'inventory', inventory_relics_changed: 'inventory',
    inventory_invalid_selection: 'selection', inventory_pro_required: 'pro',
    inventory_state_not_supported: 'inventoryState', inventory_invalid_grant: 'inventoryState' });
  function text(code, locale = 'en') {
    const kind = Object.hasOwn(TYPES, code) ? TYPES[code] : '';
    return kind ? (COPY[kind][locale] || COPY[kind].en) : '';
  }
  return Object.freeze({ text });
});
