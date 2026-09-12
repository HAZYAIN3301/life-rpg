/* Reviewed, finite, repository-owned supply. No network discovery at startup. */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationSupplyBatchV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  'use strict';
  const LOCALES = Object.freeze(['ru', 'en', 'de', 'uk', 'es']);
  const copy = (...values) => Object.freeze(Object.fromEntries(LOCALES.map((code, i) => [code, values[i]])));
  const quote = (id, interestIds, title, body) => Object.freeze({
    id, source: 'satoru', externalId: id, format: 'quote', lang: 'ru',
    contentLocales: LOCALES, interestIds: Object.freeze(interestIds), title, body,
    visual: 'ink', durationSec: null,
    rights: Object.freeze({ kind: 'satoru-original', holder: 'Satoru', url: '', embedAllowed: false, downloadAllowed: true }),
    delivery: Object.freeze({ policy: 'text' }),
    lastCheckedAt: '2026-09-10T21:27:18.000Z', available: true,
    checkMethod: 'manual', availabilityReason: '',
  });
  const CANDIDATES = Object.freeze([
    quote('sat-rest-has-an-edge', ['rest', 'recovery', 'focus'],
      copy('Отдыху не нужен отчёт.', 'Rest needs no report.', 'Erholung braucht keinen Bericht.', 'Відпочинку не потрібен звіт.', 'El descanso no necesita un informe.'),
      copy('Можно выбрать одну спокойную вещь и закончить на ней. Не всякая пауза должна становиться новым проектом.', 'Choose one quiet thing and let that be enough. A pause does not have to become another project.', 'Wähle eine ruhige Sache und lass es dabei. Eine Pause muss kein neues Projekt werden.', 'Можна обрати одну спокійну річ і на цьому зупинитися. Не кожна пауза має ставати новим проєктом.', 'Elige una cosa tranquila y deja que sea suficiente. Una pausa no tiene que convertirse en otro proyecto.')),
    quote('sat-route-before-distance', ['movement', 'running', 'hiking'],
      copy('Маршрут начинается с места, куда хочется выйти.', 'A route starts with somewhere you want to go.', 'Eine Route beginnt mit einem Ort, zu dem du möchtest.', 'Маршрут починається з місця, куди хочеться вийти.', 'Una ruta empieza con un lugar al que quieres ir.'),
      copy('Дерево, набережная, соседний двор. Иногда интерес к месту помогает сделать первый шаг лучше, чем большая цель в километрах.', 'A tree, a riverbank, a nearby courtyard. Curiosity about a place can invite the first step more readily than a distant mileage goal.', 'Ein Baum, ein Ufer, ein Hof in der Nähe. Neugier auf einen Ort kann den ersten Schritt leichter machen als ein fernes Kilometerziel.', 'Дерево, набережна, сусідній двір. Іноді цікавість до місця допомагає зробити перший крок краще, ніж велика ціль у кілометрах.', 'Un árbol, una orilla, un patio cercano. La curiosidad por un lugar puede invitar al primer paso mejor que una gran meta en kilómetros.')),
    quote('sat-design-by-subtraction', ['design', 'creative', 'art'],
      copy('Убери один элемент. Посмотри, что стало слышно.', 'Remove one element. Notice what becomes clearer.', 'Nimm ein Element weg. Was wird dadurch klarer?', 'Прибери один елемент. Подивись, що стало чутно.', 'Quita un elemento. Observa qué se vuelve más claro.'),
      copy('В черновике выбери деталь, которая спорит с главным. Сохрани копию без неё и сравни: усилилась ли мысль?', 'Pick a detail in a draft that competes with its main idea. Keep a copy without it and compare: is the idea stronger?', 'Wähle in einem Entwurf ein Detail, das mit der Hauptidee konkurriert. Speichere eine Kopie ohne dieses Detail. Wird die Idee stärker?', 'У чернетці обери деталь, яка сперечається з головним. Збережи копію без неї та порівняй: чи посилилася думка?', 'Elige un detalle del borrador que compita con la idea principal. Guarda una copia sin él y compara: ¿la idea tiene más fuerza?')),
    quote('sat-product-one-person', ['business', 'product', 'creative'],
      copy('Один понятный пример сильнее десяти обещаний.', 'One clear example carries more than ten promises.', 'Ein klares Beispiel trägt mehr als zehn Versprechen.', 'Один зрозумілий приклад сильніший за десять обіцянок.', 'Un ejemplo claro dice más que diez promesas.'),
      copy('Опиши одного человека, конкретную трудность и момент, когда твой продукт поможет. Это небольшой сюжет для проверки идеи.', 'Describe one person, one concrete difficulty and the moment your product would help. It is a small story for testing the idea.', 'Beschreibe eine Person, ein konkretes Problem und den Moment, in dem dein Produkt hilft. Eine kleine Geschichte, an der du die Idee prüfen kannst.', 'Опиши одну людину, конкретну складність і момент, коли твій продукт допоможе. Це невеликий сюжет для перевірки ідеї.', 'Describe a una persona, una dificultad concreta y el momento en que tu producto ayudaría. Es una pequeña historia para poner a prueba la idea.')),
    quote('sat-reading-one-margin', ['reading', 'study', 'learning'],
      copy('На полях достаточно одного своего вопроса.', 'One question of your own is enough for the margin.', 'Eine eigene Frage am Rand genügt.', 'На полях достатньо одного свого питання.', 'Una pregunta propia basta para el margen.'),
      copy('После страницы запиши, с чем ты не согласен или что хочешь проверить. Так у прочитанного появляется продолжение вне книги.', 'After a page, write down what you disagree with or want to check. The reading then has a continuation beyond the book.', 'Notiere nach einer Seite, womit du nicht einverstanden bist oder was du prüfen möchtest. So geht das Gelesene außerhalb des Buchs weiter.', 'Після сторінки запиши, з чим ти не згоден або що хочеш перевірити. Так у прочитаного з’являється продовження поза книгою.', 'Después de una página, anota con qué discrepas o qué quieres comprobar. Así la lectura continúa fuera del libro.')),
    quote('sat-nature-one-detail', ['nature', 'travel', 'hiking', 'rest'],
      copy('Знакомое место меняется, когда замечаешь одну деталь.', 'A familiar place changes when you notice one detail.', 'Ein vertrauter Ort verändert sich, wenn du ein Detail bemerkst.', 'Знайоме місце змінюється, коли помічаєш одну деталь.', 'Un lugar conocido cambia cuando observas un detalle.'),
      copy('Свет на стене, форма листа, звук за окном. Можно просто заметить — без фотографии, коллекции и следующего задания.', 'Light on a wall, the shape of a leaf, a sound outside. You can simply notice, without a photo, a collection or another assignment.', 'Licht an einer Wand, die Form eines Blatts, ein Geräusch draußen. Einfach wahrnehmen, ohne Foto, Sammlung oder nächste Aufgabe.', 'Світло на стіні, форма листка, звук за вікном. Можна просто помітити — без фотографії, колекції та наступного завдання.', 'La luz en una pared, la forma de una hoja, un sonido fuera. Puedes observar sin foto, colección ni otra tarea.')),
  ]);
  return Object.freeze({ VERSION: '1.0.0', ID: '2026-09-10-originals', CANDIDATES });
});
