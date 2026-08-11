/* Satoru Board Pool v1 — СОДЕРЖАНИЕ доски заказов (BOARD-OF-CONTRACTS-PLAN).
 *
 * ⚠️ Это черновик тона, а не финальный пул. §11 в.5 плана прямо говорит:
 * авторские заказы будут заметно лучше по тону. Здесь ~15 личных и по 4
 * сезонных — чтобы доску можно было пощупать и чтобы было что править.
 * Альберт правит текст здесь; логика в `board-v1.js` этот файл не читает и
 * от его содержимого не зависит.
 *
 * Что делает заказ рабочим (§2 плана): он должен быть ВЫПОЛНИМОЙ инструкцией.
 * «Сходи в приключение» — не заказ. «Съезди в город, где не был, и привези
 * оттуда одну фотографию» — заказ. Проверка простая: можно ли начать его
 * сегодня, не приняв ни одного дополнительного решения.
 *
 * Теги описывают ГРАНИ опыта, а не сферу (сфера — отдельное поле): outdoor,
 * indoor, people, solo, body, mind, craft, creative, care, travel, water,
 * cold, early, quiet, bold, detox. На них считается вкус (`board-taste-v1`),
 * поэтому у нового заказа теги обязательны — без них он невидим для подбора.
 *
 * Поля: id (стабильный, не менять после релиза — на него завязаны отметки
 * выполнения), title, sphereId (или null для сезонных), seasonal, seasons.
 * sphereId должен совпадать с id сферы пользователя, иначе заказ просто не
 * получит приоритета — на работу это не влияет.
 */
(function exposeBoardPool(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardPoolV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardPool() {
  'use strict';

  const PERSONAL = [
    // Тело и движение
    { id: 'b-body-newroute', tags: ['outdoor', 'body', 'solo', 'quiet'], sphereId: 'sport', title: 'Пройди пешком маршрут, которым никогда не ходил, — минимум двадцать минут' },
    { id: 'b-body-outside', tags: ['outdoor', 'body', 'bold'], sphereId: 'sport', title: 'Сделай свою обычную тренировку на улице, а не в помещении' },
    { id: 'b-body-water', tags: ['outdoor', 'body', 'water', 'bold', 'cold'], sphereId: 'health', title: 'Искупайся в воде холоднее, чем тебе хочется' },

    // Люди
    { id: 'b-ppl-oldfriend', tags: ['people', 'indoor', 'care', 'quiet'], sphereId: 'mind', title: 'Напиши человеку, с которым не говорил больше полугода. Одно сообщение, без повода' },
    { id: 'b-ppl-cook', tags: ['people', 'indoor', 'craft', 'care'], sphereId: 'health', title: 'Приготовь ужин для кого-то и накрой стол по-настоящему' },
    { id: 'b-ppl-question', tags: ['people', 'indoor', 'care', 'quiet'], sphereId: 'mind', title: 'Спроси у близкого что-то, чего никогда не спрашивал, и не перебивай ответ' },

    // Мастерство и созидание
    { id: 'b-craft-hands', tags: ['craft', 'indoor', 'creative', 'solo'], sphereId: 'mind', title: 'Сделай руками вещь, которую можно взять в руки. Любую' },
    { id: 'b-craft-teach', tags: ['people', 'mind', 'bold'], sphereId: 'study', title: 'Объясни кому-нибудь то, в чём ты хорош, за десять минут' },
    { id: 'b-craft-finish', tags: ['craft', 'solo', 'mind'], sphereId: 'work', title: 'Доделай то, что заброшено дольше месяца, — или честно выброси' },

    // Ум и внимание
    { id: 'b-mind-book', tags: ['mind', 'indoor', 'solo', 'quiet', 'detox'], sphereId: 'study', title: 'Прочитай бумажную книгу час подряд, без телефона в комнате' },
    { id: 'b-mind-nophone', tags: ['detox', 'solo', 'quiet', 'early'], sphereId: 'mind', title: 'Проведи первый час после пробуждения без единого экрана' },
    { id: 'b-mind-write', tags: ['mind', 'creative', 'solo', 'quiet'], sphereId: 'mind', title: 'Напиши от руки страницу о том, чего ты боишься. Никому не показывай' },

    // Место и взгляд
    { id: 'b-place-city', tags: ['travel', 'outdoor', 'bold', 'solo'], sphereId: null, title: 'Съезди туда, где ни разу не был, и привези оттуда одну фотографию' },
    { id: 'b-place-sunrise', tags: ['outdoor', 'early', 'quiet', 'solo'], sphereId: null, title: 'Встреть рассвет вне дома' },
    { id: 'b-place-lost', tags: ['travel', 'outdoor', 'bold', 'solo'], sphereId: null, title: 'Выйди на незнакомой остановке и дойди домой пешком' },
  ];

  // Сезонные — общие для всех, тон по §7 плана.
  const SEASONAL = [
    // Лето: приключения, впечатления, люди, поездки
    { id: 's-sum-night', tags: ['outdoor', 'travel', 'bold'], seasonal: true, seasons: ['summer'], title: 'Проведи ночь не дома — палатка, крыша, чужой город' },
    { id: 's-sum-water', tags: ['outdoor', 'water', 'body'], seasonal: true, seasons: ['summer'], title: 'Искупайся в естественном водоёме' },
    { id: 's-sum-stranger', tags: ['people', 'bold', 'outdoor'], seasonal: true, seasons: ['summer'], title: 'Заговори с незнакомым человеком и узнай одну его историю' },
    { id: 's-sum-nomap', tags: ['travel', 'bold', 'detox'], seasonal: true, seasons: ['summer'], title: 'Проведи день без плана и без карты' },

    // Осень: возврат в темп + остатки приключений
    { id: 's-aut-restart', tags: ['mind', 'craft', 'solo'], seasonal: true, seasons: ['autumn'], title: 'Верни одно дело, которое бросил летом' },
    { id: 's-aut-desk', tags: ['indoor', 'craft', 'solo', 'quiet'], seasonal: true, seasons: ['autumn'], title: 'Наведи порядок там, где работаешь, — до пустого стола' },
    { id: 's-aut-walk', tags: ['outdoor', 'body', 'bold', 'quiet'], seasonal: true, seasons: ['autumn'], title: 'Пройди под дождём час и не спрячься' },
    { id: 's-aut-goal', tags: ['mind', 'solo', 'quiet'], seasonal: true, seasons: ['autumn'], title: 'Назови одну вещь, которую хочешь успеть до Нового года, и запиши дату' },

    // Зима: дисциплина, длинные дуги, Winter Arc
    { id: 's-win-arc', tags: ['mind', 'solo', 'body'], seasonal: true, seasons: ['winter'], title: 'Выбери одно дело и делай его каждый день две недели подряд' },
    { id: 's-win-cold', tags: ['outdoor', 'cold', 'body', 'bold'], seasonal: true, seasons: ['winter'], title: 'Выйди на мороз и побудь там дольше, чем комфортно' },
    { id: 's-win-dark', tags: ['indoor', 'detox', 'quiet', 'solo'], seasonal: true, seasons: ['winter'], title: 'Проведи вечер при одном источнике света, без экранов' },
    { id: 's-win-letter', tags: ['mind', 'creative', 'solo', 'quiet'], seasonal: true, seasons: ['winter'], title: 'Напиши письмо себе через год и убери до декабря' },

    // Весна: восстановление, новое начало
    { id: 's-spr-new', tags: ['bold', 'creative', 'mind'], seasonal: true, seasons: ['spring'], title: 'Начни то, чего никогда не пробовал, и продержись три занятия' },
    { id: 's-spr-clean', tags: ['indoor', 'craft', 'solo'], seasonal: true, seasons: ['spring'], title: 'Избавься от десяти вещей, которые тебе не нужны' },
    { id: 's-spr-plant', tags: ['craft', 'care', 'outdoor'], seasonal: true, seasons: ['spring'], title: 'Посади что-нибудь живое и оставь себе ответственность за это' },
    { id: 's-spr-early', tags: ['early', 'outdoor', 'body', 'quiet'], seasonal: true, seasons: ['spring'], title: 'Проснись до шести и выйди на улицу до завтрака' },
  ];

  return { PERSONAL, SEASONAL, ALL: PERSONAL.concat(SEASONAL) };
});
