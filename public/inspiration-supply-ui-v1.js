/* Supply states use authored copy in every UI locale, without changing the taste profile. */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationSupplyUIV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  'use strict';
  const LOCALES = ['ru', 'en', 'de', 'uk', 'es'];
  const rows = {
    language_gap: ['По этим темам пока нет материалов на выбранном языке.', 'There are no materials on these topics in your selected language yet.', 'Zu diesen Themen gibt es noch keine Inhalte in deiner gewählten Sprache.', 'За цими темами поки немає матеріалів обраною мовою.', 'Todavía no hay materiales sobre estos temas en el idioma elegido.'],
    no_matching_material: ['По этим темам пока нет материалов.', 'There are no materials on these topics yet.', 'Zu diesen Themen gibt es noch keine Inhalte.', 'За цими темами поки немає матеріалів.', 'Todavía no hay materiales sobre estos temas.'],
    supply_unverified: ['Материалы по этим темам пока ожидают проверки.', 'Materials on these topics are awaiting review.', 'Inhalte zu diesen Themen warten noch auf ihre Prüfung.', 'Матеріали за цими темами поки очікують перевірки.', 'Los materiales sobre estos temas están pendientes de revisión.'],
    temporarily_exhausted: ['На сегодня новых подходящих материалов пока нет.', 'There are no new matching materials for today yet.', 'Für heute gibt es noch keine neuen passenden Inhalte.', 'На сьогодні нових відповідних матеріалів поки немає.', 'Todavía no hay nuevos materiales adecuados para hoy.'],
    profile_filters: ['С текущими ограничениями подходящих материалов пока нет.', 'No materials match your current exclusions yet.', 'Mit deinen aktuellen Ausschlüssen gibt es noch keine passenden Inhalte.', 'З поточними обмеженнями відповідних матеріалів поки немає.', 'Todavía no hay materiales que coincidan con tus exclusiones actuales.'],
    empty_detail: ['Можно сохранить своё или вернуться к делам. Подборка останется по твоим интересам.', 'You can save something of your own or return to your day. The selection will stay relevant to your interests.', 'Du kannst etwas Eigenes speichern oder zu deinem Tag zurückkehren. Die Auswahl bleibt auf deine Interessen abgestimmt.', 'Можна зберегти своє або повернутися до справ. Добірка залишиться за твоїми інтересами.', 'Puedes guardar algo propio o volver a tu día. La selección seguirá respondiendo a tus intereses.'],
    shortage: ['Сегодня подборка короче: подходящих материалов пока мало.', 'Today’s selection is shorter: there are only a few matching materials.', 'Die heutige Auswahl ist kürzer: Es gibt noch wenige passende Inhalte.', 'Сьогодні добірка коротша: відповідних матеріалів поки мало.', 'La selección de hoy es más corta: todavía hay pocos materiales adecuados.'],
    thin_formats: ['Сегодня подходящие материалы есть не во всех выбранных форматах.', 'Today’s matching materials do not cover every format you selected.', 'Die heutigen passenden Inhalte decken nicht alle gewählten Formate ab.', 'Сьогодні відповідні матеріали є не в усіх обраних форматах.', 'Los materiales adecuados de hoy no cubren todos los formatos elegidos.'],
    unavailable: ['Этот материал пока недоступен: его нужно проверить. Твоя запись сохранена.', 'This material is unavailable until it is checked. Your saved entry is intact.', 'Dieser Inhalt ist bis zur Prüfung nicht verfügbar. Dein gespeicherter Eintrag bleibt erhalten.', 'Цей матеріал поки недоступний: його потрібно перевірити. Твій запис збережено.', 'Este material no está disponible hasta que se revise. Tu entrada guardada se conserva.'],
    fixed_unavailable: ['Часть сегодняшней подборки пока недоступна. Другие материалы вместо неё не подставлены.', 'Part of today’s selection is unavailable. No replacement materials have been added.', 'Ein Teil der heutigen Auswahl ist nicht verfügbar. Es wurden keine Ersatzinhalte hinzugefügt.', 'Частина сьогоднішньої добірки поки недоступна. Інші матеріали замість неї не підставлено.', 'Parte de la selección de hoy no está disponible. No se han añadido materiales de reemplazo.'],
    save_error: ['Не удалось подтвердить сохранение. Повтори то же действие.', 'The save could not be confirmed. Please repeat the same action.', 'Das Speichern konnte nicht bestätigt werden. Bitte wiederhole dieselbe Aktion.', 'Не вдалося підтвердити збереження. Повтори ту саму дію.', 'No se pudo confirmar el guardado. Repite la misma acción.'],
    module_error: ['Не удалось проверить подборку. Обнови страницу перед сохранением.', 'The selection could not be checked. Reload the page before saving.', 'Die Auswahl konnte nicht geprüft werden. Lade die Seite vor dem Speichern neu.', 'Не вдалося перевірити добірку. Онови сторінку перед збереженням.', 'No se pudo comprobar la selección. Recarga la página antes de guardar.'],
  };
  const COPY = Object.freeze(Object.fromEntries(LOCALES.map((locale, i) => [locale,
    Object.freeze(Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values[i]])))])));
  function copy(key, locale) { return (COPY[locale] || COPY.ru)[key] || ''; }
  function notice(report, unavailableIds) {
    if (Array.isArray(unavailableIds) && unavailableIds.length) return 'fixed_unavailable';
    return report && ['shortage', 'thin_formats'].includes(report.status) ? report.status : '';
  }
  return Object.freeze({ VERSION: '1.0.0', LOCALES, COPY, copy, notice });
});
