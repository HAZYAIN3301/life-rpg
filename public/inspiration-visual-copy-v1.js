/* Visual taste and media states; user reference text is never translated. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationVisualCopyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const locales = ['ru','en','de','uk','es'];
  const rows = [
    ['Твой визуальный вкус','Your visual taste','Dein visueller Geschmack','Твій візуальний смак','Tu gusto visual'],
    ['Какие образы, настроение, цвет, монтаж тебе близки?','Which images, moods, colours and editing styles speak to you?','Welche Bilder, Stimmungen, Farben und Schnittstile sprechen dich an?','Які образи, настрій, кольори й монтаж тобі близькі?','¿Qué imágenes, ambientes, colores y estilos de montaje te atraen?'],
    ['Например: комиксы о повседневности, зал среди зелени, горы и приключенческие коллажи.','For example: everyday-life comics, a gym surrounded by greenery, mountains and adventure collages.','Zum Beispiel: Alltagscomics, ein Fitnessraum im Grünen, Berge und Abenteuer-Collagen.','Наприклад: комікси про повсякденність, зал серед зелені, гори й пригодницькі колажі.','Por ejemplo: cómics cotidianos, un gimnasio entre plantas, montañas y collages de aventuras.'],
    ['Референсы: фото и эдиты','References: photos and edits','Referenzen: Fotos und Edits','Референси: фото й едіти','Referencias: fotos y edits'],
    ['Ссылка на пин или видео','Pin or video link','Link zu einem Pin oder Video','Посилання на пін або відео','Enlace a un pin o vídeo'],
    ['Pinterest, TikTok, YouTube…','Pinterest, TikTok, YouTube…','Pinterest, TikTok, YouTube…','Pinterest, TikTok, YouTube…','Pinterest, TikTok, YouTube…'],
    ['Добавить референс','Add a reference','Referenz hinzufügen','Додати референс','Añadir referencia'],
    ['Удалить референс','Remove reference','Referenz entfernen','Видалити референс','Eliminar referencia'],
    ['Что изображено?','What is pictured?','Was ist zu sehen?','Що зображено?','¿Qué aparece?'],
    ['Например: Человек-паук за работой','For example: Spider-Man at work','Zum Beispiel: Spider-Man bei der Arbeit','Наприклад: Людина-павук за роботою','Por ejemplo: Spider-Man trabajando'],
    ['Ссылки задают вкус. Новые находки подбираются отдельно; твои примеры не выдаются за открытия.','Links define your taste. New finds are selected separately; your examples are not presented as discoveries.','Links zeigen deinen Geschmack. Neue Fundstücke werden separat gewählt; deine Beispiele zählen nicht als Entdeckungen.','Посилання задають смак. Нові знахідки добираються окремо; твої приклади не видаються за відкриття.','Los enlaces definen tu gusto. Las novedades se eligen aparte; tus ejemplos no se presentan como descubrimientos.'],
    ['Искать новые пины и эдиты по моему вкусу','Find new pins and edits for my taste','Neue Pins und Edits nach meinem Geschmack suchen','Шукати нові піни й едіти за моїм смаком','Buscar nuevos pines y edits a mi gusto'],
    ['Поисковому сервису передаются только описанные здесь темы и стиль. До трёх находок на день.','Only the topics and style described here are shared with the search provider. Up to three finds a day.','Nur die hier beschriebenen Themen und Stilwünsche werden an den Suchdienst gesendet. Bis zu drei Fundstücke pro Tag.','Пошуковому сервісу передаються лише описані тут теми та стиль. До трьох знахідок на день.','Solo los temas y el estilo descritos aquí se envían al buscador. Hasta tres hallazgos al día.'],
    ['Поиск новых находок сейчас не подключён. Доступна подборка из каталога.','Discovery search is not connected yet. A selection from the available catalog is shown.','Die Suche nach neuen Fundstücken ist noch nicht verbunden. Eine Auswahl aus dem verfügbaren Katalog wird angezeigt.','Пошук нових знахідок поки не підключено. Доступна добірка з каталогу.','La búsqueda de novedades aún no está conectada. Se muestra una selección del catálogo disponible.'],
    ['Новые находки пока не загрузились. Сохранённая подборка остаётся на месте.','New finds could not load yet. Your saved selection is still here.','Neue Fundstücke konnten noch nicht geladen werden. Deine gespeicherte Auswahl bleibt erhalten.','Нові знахідки поки не завантажилися. Збережена добірка залишається на місці.','Las novedades no se han cargado. Tu selección guardada sigue aquí.'],
    ['Готовлю твою подборку…','Preparing your selection…','Deine Auswahl wird vorbereitet…','Готую твою добірку…','Preparando tu selección…'],
    ['Повторить загрузку подборки','Retry loading the selection','Auswahl erneut laden','Повторити завантаження добірки','Volver a cargar la selección'],
    ['Загрузка из источника…','Loading from the source…','Wird von der Quelle geladen…','Завантаження з джерела…','Cargando desde la fuente…'],
    ['Материал сейчас не открылся. Можно повторить или открыть источник.','This item could not open. Try again or open the source.','Dieser Inhalt konnte nicht geöffnet werden. Versuche es erneut oder öffne die Quelle.','Матеріал зараз не відкрився. Можна повторити або відкрити джерело.','No se pudo abrir este contenido. Inténtalo de nuevo o abre la fuente.'],
    ['Эдит закончился. Можно сохранить его или вернуться к своему дню.','The edit has ended. Save it or return to your day.','Der Edit ist zu Ende. Speichere ihn oder kehre zu deinem Tag zurück.','Едіт закінчився. Можна зберегти його або повернутися до свого дня.','El edit ha terminado. Guárdalo o vuelve a tu día.'],
    ['Закрыть просмотр','Close viewer','Ansicht schließen','Закрити перегляд','Cerrar visor'],
    ['Смотреть эдит','Watch edit','Edit ansehen','Дивитися едіт','Ver edit'],
    ['Понравился стиль','I like this style','Dieser Stil gefällt mir','Подобається стиль','Me gusta este estilo'],
    ['Не мой стиль','Not my style','Nicht mein Stil','Не мій стиль','No es mi estilo'],
    ['Найдено по твоему вкусу','Found for your taste','Nach deinem Geschmack gefunden','Знайдено за твоїм смаком','Encontrado según tu gusto'],
    ['Показать референс','Preview reference','Referenz ansehen','Показати референс','Ver referencia'],
    ['Читаю подписи и изображения источников…','Reading captions and images from the sources…','Beschriftungen und Bilder der Quellen werden gelesen…','Читаю підписи й зображення джерел…','Leyendo textos e imágenes de las fuentes…'],
    ['Фото и видео остаются у источника. В Satoru сохраняются ссылки, подписи и твои объяснения.','Photos and videos stay at their source. Satoru saves links, captions and your explanations.','Fotos und Videos bleiben bei der Quelle. Satoru speichert Links, Beschriftungen und deine Erklärungen.','Фото й відео залишаються у джерела. Satoru зберігає посилання, підписи й твої пояснення.','Las fotos y los vídeos permanecen en su fuente. Satoru guarda enlaces, textos y tus explicaciones.'],
    ['Предпросмотр недоступен. Открой материал из источника.','Preview unavailable. Open the item from its source.','Vorschau nicht verfügbar. Öffne den Inhalt bei der Quelle.','Попередній перегляд недоступний. Відкрий матеріал із джерела.','Vista previa no disponible. Abre el contenido en su fuente.'],
    ['Не удалось подготовить подборку. Попробуй ещё раз.','Your selection could not be prepared. Try again.','Deine Auswahl konnte nicht vorbereitet werden. Versuche es erneut.','Не вдалося підготувати добірку. Спробуй ще раз.','No se pudo preparar tu selección. Inténtalo de nuevo.'],
    ['Добавь описание вкуса или референсы, чтобы поиск стал точнее.','Add a taste description or references to guide the search.','Ergänze eine Beschreibung deines Geschmacks oder Referenzen, um die Suche einzugrenzen.','Додай опис смаку або референси, щоб пошук став точнішим.','Añade una descripción de tu gusto o referencias para orientar la búsqueda.'],
    ['На сегодня поиск завершён. Новые находки появятся в другой день.','Today’s search is complete. New finds will arrive another day.','Die heutige Suche ist abgeschlossen. Neue Fundstücke gibt es an einem anderen Tag.','На сьогодні пошук завершено. Нові знахідки з’являться іншого дня.','La búsqueda de hoy ha terminado. Habrá nuevos hallazgos otro día.'],
  ];
  const COPY = Object.freeze(Object.fromEntries(locales.map((code, i) => [code, Object.freeze(Object.fromEntries(rows.map(values => [values[0],values[i]])))])));
  function copy(key, locale) { return (COPY[locale] || COPY.ru)[key] || ''; }
  return Object.freeze({VERSION:'1.0.0',COPY,copy});
});
