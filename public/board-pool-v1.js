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
    { id: 'b-body-newroute', sphereId: 'sport', title: 'Пройди пешком маршрут, которым никогда не ходил, — минимум двадцать минут' },
    { id: 'b-body-outside', sphereId: 'sport', title: 'Сделай свою обычную тренировку на улице, а не в помещении' },
    { id: 'b-body-water', sphereId: 'health', title: 'Искупайся в воде холоднее, чем тебе хочется' },

    // Люди
    { id: 'b-ppl-oldfriend', sphereId: 'mind', title: 'Напиши человеку, с которым не говорил больше полугода. Одно сообщение, без повода' },
    { id: 'b-ppl-cook', sphereId: 'health', title: 'Приготовь ужин для кого-то и накрой стол по-настоящему' },
    { id: 'b-ppl-question', sphereId: 'mind', title: 'Спроси у близкого что-то, чего никогда не спрашивал, и не перебивай ответ' },

    // Мастерство и созидание
    { id: 'b-craft-hands', sphereId: 'mind', title: 'Сделай руками вещь, которую можно взять в руки. Любую' },
    { id: 'b-craft-teach', sphereId: 'study', title: 'Объясни кому-нибудь то, в чём ты хорош, за десять минут' },
    { id: 'b-craft-finish', sphereId: 'work', title: 'Доделай то, что заброшено дольше месяца, — или честно выброси' },

    // Ум и внимание
    { id: 'b-mind-book', sphereId: 'study', title: 'Прочитай бумажную книгу час подряд, без телефона в комнате' },
    { id: 'b-mind-nophone', sphereId: 'mind', title: 'Проведи первый час после пробуждения без единого экрана' },
    { id: 'b-mind-write', sphereId: 'mind', title: 'Напиши от руки страницу о том, чего ты боишься. Никому не показывай' },

    // Место и взгляд
    { id: 'b-place-city', sphereId: null, title: 'Съезди туда, где ни разу не был, и привези оттуда одну фотографию' },
    { id: 'b-place-sunrise', sphereId: null, title: 'Встреть рассвет вне дома' },
    { id: 'b-place-lost', sphereId: null, title: 'Выйди на незнакомой остановке и дойди домой пешком' },
  ];

  // Сезонные — общие для всех, тон по §7 плана.
  const SEASONAL = [
    // Лето: приключения, впечатления, люди, поездки
    { id: 's-sum-night', seasonal: true, seasons: ['summer'], title: 'Проведи ночь не дома — палатка, крыша, чужой город' },
    { id: 's-sum-water', seasonal: true, seasons: ['summer'], title: 'Искупайся в естественном водоёме' },
    { id: 's-sum-stranger', seasonal: true, seasons: ['summer'], title: 'Заговори с незнакомым человеком и узнай одну его историю' },
    { id: 's-sum-nomap', seasonal: true, seasons: ['summer'], title: 'Проведи день без плана и без карты' },

    // Осень: возврат в темп + остатки приключений
    { id: 's-aut-restart', seasonal: true, seasons: ['autumn'], title: 'Верни одно дело, которое бросил летом' },
    { id: 's-aut-desk', seasonal: true, seasons: ['autumn'], title: 'Наведи порядок там, где работаешь, — до пустого стола' },
    { id: 's-aut-walk', seasonal: true, seasons: ['autumn'], title: 'Пройди под дождём час и не спрячься' },
    { id: 's-aut-goal', seasonal: true, seasons: ['autumn'], title: 'Назови одну вещь, которую хочешь успеть до Нового года, и запиши дату' },

    // Зима: дисциплина, длинные дуги, Winter Arc
    { id: 's-win-arc', seasonal: true, seasons: ['winter'], title: 'Выбери одно дело и делай его каждый день две недели подряд' },
    { id: 's-win-cold', seasonal: true, seasons: ['winter'], title: 'Выйди на мороз и побудь там дольше, чем комфортно' },
    { id: 's-win-dark', seasonal: true, seasons: ['winter'], title: 'Проведи вечер при одном источнике света, без экранов' },
    { id: 's-win-letter', seasonal: true, seasons: ['winter'], title: 'Напиши письмо себе через год и убери до декабря' },

    // Весна: восстановление, новое начало
    { id: 's-spr-new', seasonal: true, seasons: ['spring'], title: 'Начни то, чего никогда не пробовал, и продержись три занятия' },
    { id: 's-spr-clean', seasonal: true, seasons: ['spring'], title: 'Избавься от десяти вещей, которые тебе не нужны' },
    { id: 's-spr-plant', seasonal: true, seasons: ['spring'], title: 'Посади что-нибудь живое и оставь себе ответственность за это' },
    { id: 's-spr-early', seasonal: true, seasons: ['spring'], title: 'Проснись до шести и выйди на улицу до завтрака' },
  ];

  return { PERSONAL, SEASONAL, ALL: PERSONAL.concat(SEASONAL) };
});
