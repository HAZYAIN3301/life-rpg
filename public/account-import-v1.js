/* Portable account import protocol. Pure validation/copy; the server signs a
 * preview against this account and these file revisions. No browser crypto,
 * persistence, DOM, clocks or authority inferred from archive metadata. */
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports
    ? require('./economy-write-v1') : root.EconomyWriteV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AccountImportV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Writes) {
  'use strict';
  const TYPES = Object.freeze({ settings: 'object', tasks: 'array', habits: 'array', habitlog: 'object',
    goals: 'array', 'goal-groups': 'array', skilltree: 'object', rewards: 'array', purchases: 'array',
    achievements: 'object', days: 'object', weeks: 'object', lootbox: 'object', inbox: 'array',
    antihabits: 'array', episodes: 'array', profile: 'object', boardmedia: 'object', attention: 'object',
    shelf: 'object', questionnaire: 'object' });
  const FILES = Object.freeze(Object.keys(TYPES));
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const sameKeys = (value, names) => record(value) && Object.keys(value).sort().join(',') === [...names].sort().join(',');
  const sameFiles = (value, names) => Array.isArray(value) && value.every(name => typeof name === 'string')
    && [...value].sort().join(',') === [...names].sort().join(',');
  const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const idValid = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value);
  function dataValid(data) {
    return record(data) && Object.keys(data).length > 0 && Object.keys(data).every(name =>
      Object.hasOwn(TYPES, name) && (TYPES[name] === 'array' ? Array.isArray(data[name]) : record(data[name])));
  }
  function namesFor(data) { return FILES.filter(name => name === 'settings' || name === 'tasks' || Object.hasOwn(data, name)); }
  function ticketValid(ticket, data) {
    return dataValid(data) && sameKeys(ticket, ['version', 'requestId', 'requestHash', 'revisions', 'signature'])
      && ticket.version === 1 && idValid(ticket.requestId) && hex(ticket.requestHash) && hex(ticket.signature)
      && sameKeys(ticket.revisions, namesFor(data)) && Object.values(ticket.revisions).every(hex);
  }
  function previewValid(result, requestId, data) {
    return record(result) && result.ok === true && ticketValid(result.ticket, data)
      && result.ticket.requestId === requestId && sameFiles(result.files, Object.keys(data));
  }
  function receiptValid(result, ticket, data) {
    return ticketValid(ticket, data) && record(result) && result.ok === true && result.writeVersion === 2
      && result.requestId === ticket.requestId && result.requestHash === ticket.requestHash
      && typeof result.replay === 'boolean' && sameFiles(result.files, Object.keys(data));
  }
  const COPY = {
    checking: ['Проверяю архив…', 'Checking archive…', 'Archiv wird geprüft…', 'Перевіряю архів…', 'Comprobando el archivo…'],
    preparingFailed: ['Не удалось проверить архив. Повтори проверку; данные ещё не отправлены на сохранение.', 'Could not check the archive. Retry the check; no save was requested.', 'Archiv konnte nicht geprüft werden. Erneut prüfen; es wurde noch keine Speicherung angefordert.', 'Не вдалося перевірити архів. Повтори перевірку; дані ще не надіслані на збереження.', 'No se pudo comprobar el archivo. Repite la comprobación; aún no se ha solicitado guardar.'],
    saving: ['Сохраняю архив…', 'Saving archive…', 'Archiv wird gespeichert…', 'Зберігаю архів…', 'Guardando el archivo…'],
    unconfirmed: ['Не удалось подтвердить сохранение. Повтори эту же попытку; если данные изменились в другой вкладке — обнови страницу.', 'Could not confirm the save. Retry this attempt; if another tab changed the data, reload the page.', 'Speicherung nicht bestätigt. Diesen Versuch wiederholen; bei Änderungen in einem anderen Tab die Seite neu laden.', 'Не вдалося підтвердити збереження. Повтори цю спробу; якщо дані змінилися в іншій вкладці — онови сторінку.', 'No se pudo confirmar el guardado. Repite este intento; si otra pestaña cambió los datos, recarga la página.'],
    conflict: ['После проверки данные изменились. Обнови страницу и начни заново; эта попытка ничего не заменила.', 'Data changed after the check. Reload and start again; this attempt replaced nothing.', 'Die Daten wurden seit der Prüfung geändert. Seite neu laden und erneut beginnen; dieser Versuch hat nichts ersetzt.', 'Після перевірки дані змінилися. Онови сторінку й почни знову; ця спроба нічого не замінила.', 'Los datos cambiaron después de la comprobación. Recarga y empieza de nuevo; este intento no reemplazó nada.'],
    invalid: ['Архив не прошёл проверку. Выбери корректный JSON-экспорт Satoru.', 'Archive validation failed. Choose a valid Satoru JSON export.', 'Archivprüfung fehlgeschlagen. Einen gültigen Satoru-JSON-Export auswählen.', 'Архів не пройшов перевірку. Вибери коректний JSON-експорт Satoru.', 'El archivo no superó la comprobación. Selecciona una exportación JSON válida de Satoru.'],
    capacity: ['Архив слишком велик для безопасного восстановления. Ничего не изменено.', 'The archive is too large to restore safely. Nothing changed.', 'Das Archiv ist für eine sichere Wiederherstellung zu groß. Nichts wurde geändert.', 'Архів завеликий для безпечного відновлення. Нічого не змінено.', 'El archivo es demasiado grande para restaurarlo de forma segura. No se cambió nada.'],
    unsupported: ['Не удалось подготовить безопасное восстановление: проверь размер архива и доступность текущих данных. Ничего не изменено.', 'Could not prepare a safe restore: check the archive size and whether current data is available. Nothing changed.', 'Sichere Wiederherstellung nicht vorbereitet: Archivgröße und Verfügbarkeit der aktuellen Daten prüfen. Nichts wurde geändert.', 'Не вдалося підготувати безпечне відновлення: перевір розмір архіву й доступність поточних даних. Нічого не змінено.', 'No se pudo preparar una restauración segura: comprueba el tamaño del archivo y la disponibilidad de los datos actuales. No se cambió nada.'],
    retryCheck: ['Повторить проверку', 'Retry check', 'Erneut prüfen', 'Повторити перевірку', 'Repetir comprobación'],
  };
  function text(code, locale) { return COPY[code]?.[Math.max(0, ['ru', 'en', 'de', 'uk', 'es'].indexOf(locale))] || ''; }
  return Object.freeze({ TYPES, FILES, dataValid, namesFor, idValid, ticketValid, previewValid, receiptValid,
    canonical: Writes.canonical, text });
});
