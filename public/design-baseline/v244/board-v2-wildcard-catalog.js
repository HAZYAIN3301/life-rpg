/* Satoru Board v2 — approved Wildcard / Legendary source catalog (dormant).
 * Pure authored data: no DOM, fetch, geolocation, persistence or automatic
 * acceptance. Every local/safety slot must be resolved before a quest exists.
 */
(function exposeBoardV2WildcardCatalog(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2WildcardCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildWildcardCatalog() {
  'use strict';

  const VERSION = '1.0.0';
  const CATALOG_SCHEMA = 'satoru.board-wildcard-catalog/2';
  const CONTENT_STATUS = 'approved-ru-source';
  const SOURCES = Object.freeze(['consent', 'content', 'finance', 'history', 'local', 'profile', 'social', 'user-input']);
  const GATES = Object.freeze([
    'age-check', 'budget-check', 'equipment-check', 'filming-opt-in', 'health-check',
    'legal-check', 'personal-skill-match', 'publishing-opt-in', 'safe-context',
    'social-contact-selected', 'travel-check', 'weather-check',
  ]);

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function slot(id, type) { return { id, type, required: true }; }
  function adventure(adventureClass, safetyTier, requiredFlags) {
    return { class: adventureClass, safetyTier: safetyTier || 'ordinary', requiredFlags: requiredFlags || [] };
  }
  function template(id, kind, scale, xp, title, details, slots, proofModes, options) {
    const source = options || {};
    const reward = { xp };
    if (source.titleReward) reward.title = source.titleReward;
    return {
      schema: 'satoru.board-template/2', id, revision: 1, kind, scale,
      tags: source.tags || [], interests: source.interests || [], slots: slots || [],
      copy: { title, details },
      completion: { proofModes: proofModes || ['result'], proofRequired: false, share: source.share || 'optional' },
      followUp: source.followUp || null,
      adventure: adventure(source.class || 'wildcard', source.safetyTier, source.requiredFlags),
      reward,
    };
  }
  function entry(reviewId, sources, gates, rawTemplate, resolverExtra) {
    return {
      schema: CATALOG_SCHEMA, reviewId, contentStatus: CONTENT_STATUS,
      resolver: Object.assign({ sources, gates: gates || [], recommendationLimit: 1, alternativeLimit: 1 }, resolverExtra || {}),
      template: rawTemplate,
    };
  }

  const ENTRIES = [
    entry(1, ['local', 'finance', 'profile'], ['budget-check', 'travel-check', 'weather-check'], template(
      'zugspitze-cable-car-summit', 'expedition', 'expedition', 300,
      'Поднимись к вершине Zugspitze', 'Канатная дорога, дата, билет, транспорт и прогноз уже проверены.',
      [slot('summit', 'local-event')], ['photo', 'video', 'checkin'],
      { tags: ['mountain', 'travel', 'height'], interests: ['travel', 'mountains'], safetyTier: 'planned', requiredFlags: ['weather-checked', 'travel-ready', 'budget-confirmed', 'current-availability'], titleReward: 'Top of Germany' },
    )),
    entry(2, ['local', 'profile'], ['equipment-check', 'health-check', 'weather-check'], template(
      'zugspitze-guided-ascent', 'expedition', 'arc', 800,
      'Взойди на Zugspitze по маршруту {route}', 'Гид или подготовленная группа, сезон, снаряжение и аварийный план подтверждены.',
      [slot('route', 'local-route'), slot('guide', 'content'), slot('date', 'custom')], ['checkin', 'photo', 'video'],
      { class: 'legendary', tags: ['mountain', 'height', 'training'], interests: ['mountains'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready', 'equipment-ready', 'weather-checked'], titleReward: 'Покоритель Германии' },
    )),
    entry(3, ['local', 'profile'], ['health-check', 'travel-check', 'weather-check'], template(
      'climb-strong-regional-peak', 'expedition', 'expedition', 300,
      'Поднимись на {peak}', 'Выбран реальный маршрут под твою форму, а не случайная высокая парковка.',
      [slot('peak', 'local-route')], ['photo', 'video', 'checkin'],
      { tags: ['mountain', 'outside', 'height'], interests: ['hiking'], safetyTier: 'planned', requiredFlags: ['health-ready', 'weather-checked', 'travel-ready', 'current-availability'] },
    )),
    entry(4, ['local', 'finance', 'profile'], ['budget-check'], template(
      'taste-swordfish-locally', 'experience', 'session', 100,
      'Попробуй {dish}', 'Ресторан, текущая позиция меню, стол и цена уже проверены.',
      [slot('dish', 'local-event')], ['reflection', 'photo'],
      { tags: ['food', 'travel', 'local'], interests: ['food', 'travel'], requiredFlags: ['budget-confirmed', 'current-availability'] },
    )),
    entry(5, ['local', 'finance', 'profile'], ['budget-check'], template(
      'taste-rare-local-dish', 'experience', 'session', 100,
      'Попробуй местное блюдо {dish}', 'Это реальная местная специализация; меню, цена и ограничения проверены.',
      [slot('dish', 'local-event')], ['reflection', 'photo'],
      { tags: ['food', 'travel', 'local'], interests: ['food', 'travel'], requiredFlags: ['budget-confirmed', 'current-availability'] },
    )),
    entry(6, ['local', 'finance', 'profile'], ['age-check', 'budget-check', 'health-check'], template(
      'first-surf-lesson', 'experience', 'expedition', 300,
      'Возьми первый урок сёрфинга в {school}', 'Лицензированная школа, условия, оборудование и запись подтверждены.',
      [slot('school', 'local-class')], ['checkin', 'video'],
      { tags: ['water', 'sport', 'lesson'], interests: ['surfing', 'water-sports'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'swim-ready', 'weather-checked', 'equipment-ready', 'booking-confirmed'], titleReward: 'Wave Rider' },
    )),
    entry(7, ['local', 'profile'], ['age-check', 'health-check'], template(
      'first-instructor-dive', 'experience', 'expedition', 350,
      'Пройди пробное погружение в {center}', 'Сертифицированный центр, инструктор, требования и запись подтверждены.',
      [slot('center', 'local-class')], ['checkin', 'video'],
      { tags: ['water', 'diving', 'lesson'], interests: ['diving', 'water-sports'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready', 'age-eligible', 'booking-confirmed'], titleReward: 'Первое погружение' },
    )),
    entry(8, ['local', 'finance', 'profile'], ['budget-check', 'equipment-check', 'health-check', 'travel-check'], template(
      'first-ski-or-snowboard-lesson', 'experience', 'expedition', 300,
      'Возьми первый урок {lesson}', 'Школа, снег, аренда, транспорт и бюджет проверены.',
      [slot('lesson', 'local-class')], ['checkin', 'video'],
      { tags: ['snow', 'sport', 'lesson'], interests: ['ski', 'snowboard'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready', 'equipment-ready', 'weather-checked', 'travel-ready', 'budget-confirmed'] },
    )),
    entry(9, ['local', 'profile'], ['health-check'], template(
      'five-meter-pool-jump', 'challenge', 'expedition', 300,
      'Подготовь прыжок с пятиметровой вышки в {session}', 'Только разрешённый бассейн, открытая платформа и контроль специалиста.',
      [slot('session', 'local-class')], ['result', 'checkin', 'video'],
      { tags: ['water', 'height', 'challenge'], interests: ['swimming'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'swim-ready', 'health-ready', 'current-availability'] },
    )),
    entry(10, ['local', 'profile'], ['equipment-check', 'health-check', 'weather-check'], template(
      'guided-via-ferrata', 'expedition', 'expedition', 350,
      'Пройди via ferrata {route}', 'Официальный маршрут, гид, комплект, дата и погода подтверждены.',
      [slot('route', 'local-route'), slot('guide', 'content')], ['checkin', 'photo', 'video'],
      { tags: ['mountain', 'climbing', 'height'], interests: ['climbing', 'mountains'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready', 'equipment-ready', 'weather-checked'] },
    )),
    entry(11, ['local', 'finance', 'profile'], ['age-check', 'budget-check', 'health-check', 'weather-check'], template(
      'tandem-paragliding-flight', 'experience', 'expedition', 350,
      'Полети на параплане в тандеме с {operator}', 'Лицензия, ограничения, цена и прогноз проверены.',
      [slot('operator', 'local-event')], ['checkin', 'photo', 'video'],
      { tags: ['flight', 'height', 'travel'], interests: ['flight', 'adventure'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready', 'weather-checked', 'booking-confirmed'], titleReward: 'Над землёй' },
    )),
    entry(12, ['local', 'finance', 'profile'], ['budget-check', 'health-check', 'weather-check'], template(
      'first-sailing-lesson', 'experience', 'expedition', 300,
      'Возьми первый урок управления парусом в {club}', 'Официальный клуб, инструктор, оборудование и погода подтверждены.',
      [slot('club', 'local-class')], ['checkin', 'video'],
      { tags: ['water', 'sailing', 'lesson'], interests: ['sailing', 'water-sports'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'swim-ready', 'weather-checked', 'equipment-ready'] },
    )),
    entry(13, ['local', 'finance', 'profile'], ['budget-check', 'travel-check'], template(
      'visit-world-wonder', 'expedition', 'arc', 1000,
      'Посети {wonder}', 'Первый реальный этап — {next-step}; документы, сезон, бюджет и транспорт проверяются отдельно.',
      [slot('wonder', 'local-place'), slot('next-step', 'content')], ['checkin', 'photo', 'video', 'story'],
      { class: 'legendary', tags: ['world', 'travel', 'landmark'], interests: ['travel'], safetyTier: 'planned', requiredFlags: ['travel-ready', 'budget-confirmed', 'current-availability'], titleReward: 'Первопроходец' },
    )),
    entry(14, ['local', 'finance', 'profile'], ['budget-check', 'travel-check', 'weather-check'], template(
      'northern-lights-expedition', 'expedition', 'arc', 700,
      'Отправься за северным сиянием', 'Окно {dates}, база {place}; видимость не гарантируется, запасной план готов.',
      [slot('dates', 'custom'), slot('place', 'local-place')], ['checkin', 'photo', 'video', 'story'],
      { class: 'legendary', tags: ['nature', 'travel', 'night'], interests: ['travel', 'nature'], safetyTier: 'planned', requiredFlags: ['travel-ready', 'budget-confirmed', 'weather-checked', 'current-availability'] },
    )),
    entry(15, ['consent', 'local'], ['filming-opt-in', 'safe-context'], template(
      'chase-rainbow-end', 'experience', 'session', 120,
      'Поймай конец радуги', 'После сильной радуги отправься в её сторону безопасным маршрутом и сними, куда привела погоня.',
      [], ['video', 'story'], { tags: ['weather', 'strange', 'outside'], interests: ['video', 'adventure'], requiredFlags: ['weather-checked'] },
    )),
    entry(16, ['local', 'profile'], ['health-check'], template(
      'learn-flip-with-coach', 'challenge', 'arc', 500,
      'Научись делать {flip}', 'Первый этап проходит с тренером в оборудованном зале {class}.',
      [slot('flip', 'content'), slot('class', 'local-class')], ['video', 'result'],
      { tags: ['acrobatics', 'skill', 'sport'], interests: ['acrobatics'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready'], titleReward: 'Воздушный' },
    )),
    entry(17, ['local', 'profile'], ['health-check'], template(
      'train-for-official-marathon', 'challenge', 'arc', 1000,
      'Подготовься к марафону {marathon}', 'Реалистичный срок и текущий этап плана — {training-step}.',
      [slot('marathon', 'local-event'), slot('training-step', 'content')], ['result', 'checkin'],
      { class: 'legendary', tags: ['running', 'endurance', 'arc'], interests: ['running'], safetyTier: 'planned', requiredFlags: ['health-ready', 'booking-confirmed', 'current-availability'], titleReward: 'Марафонец' },
    )),
    entry(18, ['local', 'profile'], ['equipment-check', 'health-check', 'weather-check'], template(
      'cycle-one-hundred-kilometers', 'challenge', 'arc', 500,
      'Проедь 100 километров по маршруту {route}', 'Подготовка, дата, ремонтный комплект и безопасные участки маршрута проверены.',
      [slot('route', 'local-route'), slot('date', 'custom')], ['result', 'checkin'],
      { tags: ['cycling', 'endurance', 'arc'], interests: ['cycling'], safetyTier: 'planned', requiredFlags: ['health-ready', 'equipment-ready', 'weather-checked', 'travel-ready'] },
    )),
    entry(19, ['local', 'profile'], ['health-check', 'personal-skill-match'], template(
      'enter-amateur-tournament', 'challenge', 'expedition', 300,
      'Запишись на турнир {tournament}', 'Только знакомая тебе дисциплина; дедлайн регистрации уже проверен.',
      [slot('tournament', 'local-event')], ['checkin', 'result'],
      { tags: ['competition', 'sport', 'game'], interests: ['sport', 'games'], safetyTier: 'planned', requiredFlags: ['health-ready', 'booking-confirmed', 'current-availability'] },
    )),
    entry(20, ['content', 'local', 'profile'], ['health-check'], template(
      'master-hard-movement-month', 'challenge', 'arc', 500,
      'Освой {movement} за месяц', 'Безопасная прогрессия: {sessions} занятий с {coach}.',
      [slot('movement', 'content'), slot('sessions', 'custom'), slot('coach', 'local-class')], ['video', 'result'],
      { tags: ['skill', 'sport', 'arc'], interests: ['sport', 'movement'], safetyTier: 'professional-supervision', requiredFlags: ['professional-supervision', 'permitted-venue', 'health-ready'] },
    )),
    entry(21, ['user-input'], [], template(
      'delete-social-apps-thirty-days', 'challenge', 'arc', 500,
      'Удали {apps} на 30 дней', 'Сохрани нужные контакты и заранее выбери способ связи.',
      [slot('apps', 'custom')], ['result', 'reflection'], {
        tags: ['offline', 'experiment', 'arc'], interests: ['focus'], titleReward: 'Вне ленты', share: 'none',
        followUp: { interventionId: 'social-apps-thirty-days', question: 'Что изменилось без выбранных соцсетей?', contextTags: ['doomscrolling', 'distracted'] },
      },
    )),
    entry(22, ['content', 'social'], ['social-contact-selected'], template(
      'minecraft-server-thirty-days', 'social', 'arc', 500,
      'Запусти Minecraft-сервер {name} на 30 дней', 'Позови {players} и выберите общую цель: {goal}.',
      [slot('name', 'custom'), slot('players', 'person'), slot('goal', 'content')], ['video', 'story', 'result'],
      { tags: ['minecraft', 'social', 'arc'], interests: ['minecraft', 'games'] },
    )),
    entry(23, ['content', 'profile'], [], template(
      'one-book-month-until-year-end', 'challenge', 'arc', 800,
      'Читай по одной книге в месяц до конца года', 'Первая книга — {book}; следующий выбор появится только после завершения.',
      [slot('book', 'content'), slot('months', 'custom')], ['reflection', 'result'],
      { tags: ['reading', 'learning', 'arc'], interests: ['reading'] },
    )),
    entry(24, ['finance', 'profile'], ['legal-check', 'publishing-opt-in'], template(
      'earn-one-thousand-from-zero', 'challenge', 'arc', 1000,
      'Заработай {amount} с нуля и покажи весь путь', 'Первый легальный проверяемый шаг — {next-step}; никаких ставок, кредитов и гарантий.',
      [slot('amount', 'custom'), slot('next-step', 'content')], ['result', 'story'],
      { class: 'legendary', tags: ['business', 'money', 'experiment'], interests: ['business', 'finance'], safetyTier: 'planned', titleReward: 'С нуля' },
    )),
    entry(25, ['local', 'history'], ['safe-context'], template(
      'library-day-specific-deliverable', 'creation', 'expedition', 220,
      'Проведи день в {library} и закончи {project}', 'Время работы и конкретный результат {deliverable} уже определены.',
      [slot('library', 'local-place'), slot('project', 'content'), slot('deliverable', 'content')], ['result', 'checkin'],
      { tags: ['library', 'focus', 'creation'], interests: ['learning', 'writing'], requiredFlags: ['current-availability'] },
    )),
    entry(26, ['content', 'finance', 'profile'], ['budget-check', 'legal-check'], template(
      'build-and-sell-first-product', 'creation', 'arc', 500,
      'Собери и продай {product}', 'Первая продажа до {date}; следующий проверяемый шаг — {next-step}.',
      [slot('product', 'content'), slot('date', 'custom'), slot('next-step', 'content')], ['result', 'story'],
      { tags: ['business', 'creation', 'sale'], interests: ['business', 'diy'] },
    )),
    entry(27, ['consent', 'user-input'], ['equipment-check', 'safe-context'], template(
      'rearrange-room-approved-layout', 'creation', 'expedition', 220,
      'Переставь {room} по готовому плану', 'Цель — {goal}; схема, размеры и порядок перемещения согласованы.',
      [slot('room', 'custom'), slot('goal', 'content'), slot('layout', 'content')], ['result', 'photo'],
      { tags: ['room', 'design', 'creation'], interests: ['interior', 'diy'], safetyTier: 'planned', requiredFlags: ['equipment-ready'] },
    )),
    entry(28, ['content', 'local', 'profile'], ['equipment-check', 'health-check', 'safe-context'], template(
      'build-furniture-item', 'creation', 'arc', 500,
      'Сделай {item} своими руками', 'Чертёж, материалы {materials} и первый этап {next-step} готовы.',
      [slot('item', 'content'), slot('materials', 'content'), slot('next-step', 'content')], ['result'],
      { tags: ['furniture', 'diy', 'creation'], interests: ['diy'], safetyTier: 'planned', requiredFlags: ['equipment-ready', 'permitted-venue'], titleReward: 'Мастерская' },
    )),
    entry(29, ['consent', 'content', 'social'], ['filming-opt-in'], template(
      'forty-eight-hour-film-challenge', 'creation', 'expedition', 350,
      'Сними короткий фильм за 48 часов', 'Тема — {theme}; монтаж заверши до {deadline}.',
      [slot('theme', 'content'), slot('deadline', 'custom')], ['video'],
      { tags: ['film', 'creation', 'challenge'], interests: ['video', 'film'] },
    )),
    entry(30, ['consent', 'history', 'profile'], ['publishing-opt-in'], template(
      'record-and-release-one-track', 'creation', 'arc', 500,
      'Запиши и выпусти {track}', 'Запись {date}, финальный экспорт {deadline}, выбранный канал {channel}.',
      [slot('track', 'content'), slot('date', 'custom'), slot('deadline', 'custom'), slot('channel', 'content')], ['result', 'story'],
      { tags: ['music', 'creation', 'publish'], interests: ['music'] },
    )),
    entry(31, ['content', 'finance', 'profile'], ['budget-check'], template(
      'make-favorite-character-cosplay', 'creation', 'arc', 500,
      'Сделай косплей {character}', 'Срок {date}; первый элемент образа — {piece}.',
      [slot('character', 'content'), slot('date', 'custom'), slot('piece', 'content')], ['result', 'photo'],
      { tags: ['cosplay', 'creation', 'fandom'], interests: ['cosplay', 'anime', 'games'], titleReward: 'Shapeshifter' },
    )),
    entry(32, ['local', 'profile'], ['budget-check', 'travel-check'], template(
      'attend-convention-in-cosplay', 'experience', 'expedition', 300,
      'Приди на {event} в косплее', 'Билет, правила реквизита и маршрут уже проверены.',
      [slot('event', 'local-event')], ['checkin', 'photo', 'video'],
      { tags: ['cosplay', 'event', 'fandom'], interests: ['cosplay', 'anime', 'games'], safetyTier: 'planned', requiredFlags: ['travel-ready', 'budget-confirmed', 'current-availability'] },
    )),
    entry(33, ['content', 'social'], ['social-contact-selected'], template(
      'run-three-session-mini-campaign', 'social', 'arc', 500,
      'Стань Dungeon Master и проведи мини-кампанию', 'Три сессии {game} для {players}; стартовый модуль {module}.',
      [slot('game', 'content'), slot('players', 'person'), slot('module', 'content')], ['result', 'story'],
      { tags: ['tabletop', 'social', 'creation'], interests: ['role-playing-games', 'board-games'], titleReward: 'Dungeon Master' },
    )),
    entry(34, ['content', 'social'], ['social-contact-selected'], template(
      'run-friends-tournament', 'social', 'expedition', 250,
      'Устрой турнир по {game}', 'Дата {date}, формат {format}, участники {players}; сетка готова.',
      [slot('game', 'content'), slot('date', 'custom'), slot('format', 'content'), slot('players', 'person')], ['result', 'story'],
      { tags: ['tournament', 'social', 'game'], interests: ['games', 'sport'] },
    )),
    entry(35, ['local', 'finance', 'profile', 'social'], ['budget-check'], template(
      'city-dish-bracket', 'social', 'arc', 500,
      'Выбери лучший {dish} в городе через турнир', 'Сетка из {venues}; первый матч — {first-match}.',
      [slot('dish', 'content'), slot('venues', 'content'), slot('first-match', 'content')], ['result', 'story'],
      { tags: ['food', 'local', 'tournament'], interests: ['food'] },
    ), { optionPolicy: 'four-to-eight-verified-venues-over-time' }),
    entry(36, ['local', 'profile'], ['personal-skill-match'], template(
      'perform-at-open-mic', 'challenge', 'expedition', 350,
      'Выступи на {open-mic}', 'Подготовь номер выбранной длительности и зарегистрируйся.',
      [slot('open-mic', 'local-event')], ['checkin', 'video', 'result'],
      { tags: ['stage', 'performance', 'challenge'], interests: ['music', 'standup', 'poetry'], requiredFlags: ['booking-confirmed', 'current-availability'], titleReward: 'На сцене' },
    )),
    entry(37, ['local', 'profile'], ['budget-check'], template(
      'unusual-craft-workshop', 'creation', 'expedition', 250,
      'Пройди мастер-класс {workshop}', 'Материалы включены, готовый предмет заберёшь домой.',
      [slot('workshop', 'local-class')], ['result', 'checkin'],
      { tags: ['craft', 'creation', 'local'], interests: ['diy', 'art'], requiredFlags: ['budget-confirmed', 'booking-confirmed', 'current-availability'] },
    )),
    entry(38, ['local', 'profile', 'social'], ['legal-check', 'safe-context'], template(
      'go-legal-fishing-trip', 'experience', 'expedition', 220,
      'Сходи на рыбалку {trip}', 'Правила, лицензия, сезон, снасти и человек с опытом проверены.',
      [slot('trip', 'local-event')], ['checkin', 'photo', 'story'],
      { tags: ['fishing', 'outside', 'local'], interests: ['fishing', 'nature'], safetyTier: 'planned', requiredFlags: ['permitted-venue', 'equipment-ready', 'current-availability'] },
    )),
    entry(39, ['local', 'finance', 'profile'], ['budget-check'], template(
      'find-useful-flea-market-item', 'experience', 'session', 100,
      'Найди одну сильную вещь на {market}', 'Бюджет ограничен; покупать ничего не обязательно.',
      [slot('market', 'local-event')], ['result', 'checkin'],
      { tags: ['market', 'local', 'strange'], interests: ['vintage', 'design'], requiredFlags: ['budget-confirmed', 'current-availability'] },
    )),
    entry(40, ['local', 'profile'], ['age-check', 'legal-check'], template(
      'complete-volunteer-shift', 'social', 'expedition', 220,
      'Сделай добровольческую смену в {shift}', 'Организация, задача, требования и запись проверены.',
      [slot('shift', 'local-event')], ['checkin', 'result'],
      { tags: ['volunteer', 'social', 'local'], interests: ['volunteering'], requiredFlags: ['age-eligible', 'booking-confirmed', 'current-availability'] },
    )),
    entry(41, ['local', 'finance', 'profile'], ['budget-check'], template(
      'complete-first-aid-course', 'challenge', 'expedition', 250,
      'Пройди курс первой помощи {course}', 'Провайдер, длительность, цена и формат подтверждены.',
      [slot('course', 'local-class')], ['checkin', 'result'],
      { tags: ['first-aid', 'learning', 'local'], interests: ['health', 'learning'], requiredFlags: ['budget-confirmed', 'booking-confirmed', 'current-availability'] },
    )),
    entry(42, ['local', 'finance', 'profile'], ['budget-check', 'travel-check'], template(
      'random-weekend-from-three-safe-options', 'expedition', 'expedition', 300,
      'Устрой случайные выходные', 'Брось кубик и выбери одну из трёх уже проверенных поездок: {options}.',
      [slot('options', 'content')], ['checkin', 'photo', 'story'],
      { tags: ['random', 'travel', 'weekend'], interests: ['travel'], safetyTier: 'planned', requiredFlags: ['travel-ready', 'budget-confirmed', 'current-availability'] },
    ), { optionPolicy: 'randomize-only-three-fully-resolved-options' }),
    entry(43, ['local', 'finance', 'profile'], ['budget-check', 'travel-check'], template(
      'overnight-unusual-place', 'experience', 'expedition', 300,
      'Переночуй в {stay}', 'Свободная дата, цена, легальность и дорога проверены.',
      [slot('stay', 'local-event')], ['checkin', 'photo', 'story'],
      { tags: ['stay', 'travel', 'strange'], interests: ['travel'], safetyTier: 'planned', requiredFlags: ['travel-ready', 'budget-confirmed', 'booking-confirmed', 'current-availability'] },
    )),
    entry(44, ['content', 'local', 'profile'], ['travel-check'], template(
      'visit-favorite-fiction-location', 'expedition', 'expedition', 300,
      'Съезди в {place} из {work}', 'Связь с произведением, маршрут и правила посещения подтверждены.',
      [slot('place', 'local-place'), slot('work', 'content')], ['checkin', 'photo', 'video'],
      { tags: ['fandom', 'travel', 'place'], interests: ['film', 'anime', 'games'], safetyTier: 'planned', requiredFlags: ['travel-ready', 'current-availability'] },
    )),
    entry(45, ['local', 'profile'], ['safe-context'], template(
      'complete-travel-language-mission', 'challenge', 'session', 120,
      'Выполни языковую миссию в {venue}', 'Закажи {task} на {language}; пять нужных фраз уже подготовлены.',
      [slot('venue', 'local-place'), slot('task', 'content'), slot('language', 'content')], ['result', 'reflection'],
      { tags: ['language', 'travel', 'social'], interests: ['language', 'travel'], requiredFlags: ['current-availability'] },
    )),
  ];

  function validateEntry(candidate, expectedReviewId) {
    if (!candidate || candidate.schema !== CATALOG_SCHEMA || candidate.reviewId !== expectedReviewId) throw new Error('invalid-review-order');
    if (candidate.contentStatus !== CONTENT_STATUS) throw new Error('unapproved-content');
    if (!candidate.resolver.sources.every((source) => SOURCES.includes(source))) throw new Error('invalid-resolver-source');
    if (!candidate.resolver.gates.every((gate) => GATES.includes(gate))) throw new Error('invalid-gate');
    if (candidate.resolver.recommendationLimit !== 1 || candidate.resolver.alternativeLimit !== 1) throw new Error('choice-overload');
    if (!['wildcard', 'legendary'].includes(candidate.template.adventure.class)) throw new Error('not-unexpected');
  }
  for (let index = 0; index < ENTRIES.length; index += 1) validateEntry(ENTRIES[index], index + 1);
  deepFreeze(ENTRIES);

  function compileCatalog(boardApi) {
    if (!boardApi || typeof boardApi.compileTemplate !== 'function') throw new Error('board-v2-required');
    return deepFreeze({
      schema: CATALOG_SCHEMA, version: VERSION, contentStatus: CONTENT_STATUS,
      entries: ENTRIES,
      templates: ENTRIES.map((catalogEntry) => boardApi.compileTemplate(catalogEntry.template)),
    });
  }

  function entryByTemplateId(templateId) {
    return ENTRIES.find((candidate) => candidate.template.id === templateId) || null;
  }

  return deepFreeze({ VERSION, CATALOG_SCHEMA, CONTENT_STATUS, SOURCES, GATES, ENTRIES, compileCatalog, entryByTemplateId });
});
