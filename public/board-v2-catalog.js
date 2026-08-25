/* Satoru Board v2 — approved RU source catalog (dormant).
 *
 * This file contains authored source templates and resolver requirements. It
 * does not fetch places, read State, render UI or silently invent missing
 * context. The catalog becomes executable only through BoardV2.compileTemplate.
 */
(function exposeBoardV2Catalog(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2Catalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2Catalog() {
  'use strict';

  const VERSION = '1.0.0';
  const CATALOG_SCHEMA = 'satoru.board-catalog/2';
  const CONTENT_STATUS = 'approved-ru-source';
  const RESOLVER_SOURCES = Object.freeze([
    'consent', 'content', 'finance', 'history', 'local', 'profile', 'social', 'user-input',
  ]);
  const ELIGIBILITY_GATES = Object.freeze([
    'existing-project', 'finance-source-opt-in', 'filming-opt-in', 'personal-place-selected',
    'publishing-opt-in', 'safe-context', 'saved-place-selected', 'social-contact-selected',
    'sport-routine', 'subscription-selected', 'user-item-selected',
  ]);

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }

  function slot(id, type, required) {
    return { id, type, required: required !== false };
  }

  function template(id, kind, scale, title, details, slots, proofModes, extra) {
    const additions = extra || {};
    return {
      schema: 'satoru.board-template/2',
      id,
      revision: 1,
      kind,
      scale,
      tags: additions.tags || [],
      interests: additions.interests || [],
      slots: slots || [],
      copy: { title, details },
      completion: {
        proofModes: proofModes || ['result'],
        proofRequired: false,
        share: additions.share || 'optional',
      },
      followUp: additions.followUp || null,
      adventure: additions.adventure || undefined,
      reward: additions.reward || undefined,
    };
  }

  function entry(reviewId, resolverSources, gates, rawTemplate, resolverExtra) {
    return {
      schema: CATALOG_SCHEMA,
      reviewId,
      contentStatus: CONTENT_STATUS,
      resolver: Object.assign({
        sources: resolverSources,
        gates: gates || [],
        recommendationLimit: 1,
        alternativeLimit: 1,
      }, resolverExtra || {}),
      template: rawTemplate,
    };
  }

  const STRETCH_OPTIONS = Object.freeze([
    {
      id: 'yoga-with-adriene-beginners-40',
      label: 'Yoga For Beginners — 40 Minute Home Yoga Workout',
      url: 'https://yogawithadriene.com/yoga-beginners-40-minute-home-yoga-workout/',
      fit: 'beginner',
    },
    {
      id: 'yoga-kiss-total-body-40',
      label: 'Yoga Kiss — 40-Minute Total Body Flow',
      url: 'https://www.youtube.com/watch?v=qiu1SYtAdBg',
      fit: 'regular',
    },
    {
      id: 'move-with-nicole-daily-flow-30',
      label: 'Move With Nicole — 30 Minute Daily Yoga Flow',
      url: 'https://www.youtube.com/watch?v=5TzqqPJFHeQ',
      fit: 'shorter',
    },
  ]);

  const ENTRIES = [
    entry(1, ['local', 'profile'], [], template(
      'try-specific-local-class', 'experience', 'session',
      'Попробуй {class}', 'Пробное занятие, время, адрес, цена и запись уже проверены.',
      [slot('class', 'local-class')], ['checkin', 'reflection'],
      { tags: ['local', 'sport', 'novelty'], interests: ['sport'] },
    )),
    entry(2, ['local', 'profile'], ['sport-routine'], template(
      'train-at-another-gym', 'experience', 'session',
      'Проведи тренировку в {gym}', 'Разовый вход и свободное время уже найдены.',
      [slot('gym', 'local-class')], ['result', 'checkin'],
      { tags: ['local', 'sport', 'training'], interests: ['sport'] },
    )),
    entry(3, ['local', 'profile'], [], template(
      'learn-one-specific-movement', 'challenge', 'session',
      'На занятии {class} разучи {movement}', 'Выбрано одно конкретное движение под твой интерес и уровень.',
      [slot('class', 'local-class'), slot('movement', 'content')], ['video', 'checkin', 'result'],
      { tags: ['skill', 'sport', 'learning'], interests: ['sport', 'movement'] },
    )),
    entry(4, ['profile'], ['sport-routine'], template(
      'full-workout-without-music', 'challenge', 'session',
      'Проведи полноценную тренировку без музыки', 'После тренировки просто зафиксируй результат.',
      [], ['result', 'reflection'], {
        tags: ['sport', 'focus', 'experiment'], interests: ['sport'],
        followUp: {
          interventionId: 'workout-without-music',
          question: 'Без музыки ты лучше держал темп или только сильнее отвлекался?',
          contextTags: ['training-focus', 'distracted'],
        },
      },
    )),
    entry(5, ['content', 'profile'], [], template(
      'long-guided-stretch', 'recovery', 'session',
      'Сделай длинную растяжку по {routine}', 'Остановись, если появилась боль.',
      [slot('routine', 'video')], ['result', 'reflection'], {
        tags: ['recovery', 'mobility', 'overloaded'], interests: ['yoga', 'mobility', 'sport'],
        followUp: {
          interventionId: 'long-stretch',
          question: 'Тебе стало спокойнее или голова всё ещё перегружена?',
          contextTags: ['overloaded', 'tense'],
        },
      },
    ), { approvedOptions: STRETCH_OPTIONS, optionPolicy: 'select-exactly-one' }),
    entry(6, ['history', 'profile'], [], template(
      'guided-recovery-evening', 'recovery', 'session',
      'Устрой восстановительный вечер', '{action-one}, {action-two}, затем {action-three}. Начни в {starts-at}.',
      [slot('action-one', 'content'), slot('action-two', 'content'), slot('action-three', 'content'), slot('starts-at', 'custom')],
      ['result', 'reflection'], {
        tags: ['recovery', 'rest', 'overloaded'], interests: ['recovery'],
        followUp: {
          interventionId: 'guided-recovery-evening',
          question: 'Что из этого реально вернуло тебе силы?',
          contextTags: ['low-energy', 'overloaded'],
        },
      },
    )),
    entry(7, ['profile'], ['safe-context'], template(
      'walk-without-phone', 'challenge', 'micro',
      'Выйди на прогулку без телефона', 'Если телефон нужен для безопасности — оставь его в режиме полёта.',
      [], ['checkin', 'reflection'], { tags: ['walk', 'offline', 'outside'], interests: ['walking'] },
    )),
    entry(8, ['local', 'profile'], ['safe-context'], template(
      'complete-specific-route', 'expedition', 'expedition',
      'Пройди маршрут {route}', 'Старт, длина, сложность, погода и дорога обратно уже проверены.',
      [slot('route', 'local-route')], ['checkin', 'photo', 'video'], {
        tags: ['route', 'hiking', 'outside'], interests: ['hiking', 'walking'],
        adventure: { class: 'standard', safetyTier: 'planned', requiredFlags: ['weather-checked', 'travel-ready', 'current-availability'] },
      },
    )),
    entry(9, ['local', 'profile'], ['safe-context'], template(
      'climb-selected-viewpoint', 'expedition', 'expedition',
      'Поднимись на {place}', 'Маршрут, дорога до старта и безопасное возвращение уже проверены.',
      [slot('place', 'local-route')], ['photo', 'video', 'checkin'], {
        tags: ['height', 'hiking', 'outside'], interests: ['hiking'],
        adventure: { class: 'standard', safetyTier: 'planned', requiredFlags: ['weather-checked', 'travel-ready', 'current-availability'] },
        reward: { title: 'Покоритель высоты' },
      },
    )),
    entry(10, ['history', 'local'], ['saved-place-selected'], template(
      'visit-saved-social-place', 'experience', 'session',
      'Сходи в {place}', 'Ты сам сохранил это место; часы работы и дорога уже проверены.',
      [slot('place', 'local-place')], ['checkin', 'photo', 'video', 'none'],
      { tags: ['local', 'saved-place', 'novelty'], interests: ['travel', 'food', 'culture'] },
    )),
    entry(11, ['local', 'profile', 'social'], ['social-contact-selected'], template(
      'try-specific-local-entertainment', 'social', 'session',
      'Сходи с {person} на {activity}', 'Конкретный слот рядом уже найден.',
      [slot('person', 'person'), slot('activity', 'local-event')], ['checkin', 'result'],
      { tags: ['local', 'social', 'game'], interests: ['games', 'sport', 'social'] },
    )),
    entry(12, ['local', 'profile'], ['safe-context'], template(
      'travel-for-specific-event', 'expedition', 'expedition',
      'Съезди в другой город на {event}', 'Событие подходит по интересам; билет, дорога и возвращение уже проверены.',
      [slot('event', 'local-event')], ['checkin', 'photo', 'video'], {
        tags: ['travel', 'event', 'novelty'], interests: ['music', 'culture', 'games', 'sport'],
        adventure: { class: 'standard', safetyTier: 'planned', requiredFlags: ['travel-ready', 'budget-confirmed', 'current-availability'] },
      },
    )),
    entry(13, ['local', 'profile'], [], template(
      'visit-exhibition-three-works', 'experience', 'session',
      'Сходи на {exhibition}', 'Если съёмка разрешена — сфотографируй три работы, которые реально зацепили.',
      [slot('exhibition', 'local-event')], ['photo', 'checkin'],
      { tags: ['culture', 'art', 'local'], interests: ['art', 'culture'] },
    )),
    entry(14, ['local'], ['safe-context'], template(
      'watch-sunrise-or-sunset', 'experience', 'session',
      'Встреть закат или рассвет в {place}', 'Погода, обзор, доступ и дорога обратно уже проверены.',
      [slot('place', 'local-place'), slot('time', 'custom')], ['photo', 'video', 'checkin'],
      { tags: ['outside', 'sunset', 'local'], interests: ['nature', 'photo'] },
    )),
    entry(15, ['content', 'profile'], [], template(
      'cook-new-dish', 'creation', 'session',
      'Приготовь {dish}', 'Рецепт подходит по уровню и ограничениям. Не хватает: {shopping-list}.',
      [slot('dish', 'recipe'), slot('shopping-list', 'content')], ['result', 'photo'],
      { tags: ['cooking', 'creation'], interests: ['cooking', 'food'] },
    )),
    entry(16, ['content', 'history'], [], template(
      'recreate-memorable-dish', 'creation', 'session',
      'Приготовь свою версию {dish}', 'Выбран рецепт, максимально близкий к оригиналу.',
      [slot('dish', 'recipe')], ['result', 'reflection', 'photo'],
      { tags: ['cooking', 'memory', 'creation'], interests: ['cooking', 'food', 'film'] },
    )),
    entry(17, ['content', 'profile'], [], template(
      'cook-special-breakfast', 'creation', 'session',
      'Приготовь особенный завтрак: {dish}', 'Подготовь ингредиенты сегодня вечером.',
      [slot('dish', 'recipe')], ['result', 'photo'],
      { tags: ['cooking', 'breakfast', 'creation'], interests: ['cooking', 'food'] },
    )),
    entry(18, ['content', 'profile', 'social'], ['social-contact-selected'], template(
      'host-dinner-for-someone-close', 'social', 'session',
      'Устрой ужин для {person}', 'Приготовь {menu}, накрой стол и начни в {starts-at}.',
      [slot('person', 'person'), slot('menu', 'recipe'), slot('starts-at', 'custom')], ['result', 'photo', 'reflection'],
      { tags: ['cooking', 'social', 'care'], interests: ['cooking', 'social'] },
    )),
    entry(19, ['content', 'user-input'], ['user-item-selected'], template(
      'repair-delayed-item', 'creation', 'session',
      'Почини {item}', 'Нужны {tools}; безопасная инструкция уже выбрана.',
      [slot('item', 'custom'), slot('tools', 'content'), slot('instruction', 'video')], ['result'],
      { tags: ['repair', 'creation', 'practical'], interests: ['diy'] },
    )),
    entry(20, ['history', 'user-input'], ['existing-project'], template(
      'finish-useful-project', 'creation', 'session',
      'Закончи {project}', 'Следующий шаг — {next-step}. Критерий готовности уже определён.',
      [slot('project', 'content'), slot('next-step', 'content')], ['result'],
      { tags: ['creation', 'project', 'finish'], interests: ['diy', 'creative'] },
    )),
    entry(21, ['social'], ['social-contact-selected'], template(
      'reconnect-and-invite-for-walk', 'social', 'session',
      'Напиши {person} и позови погулять', 'Предложи эту или следующую неделю.',
      [slot('person', 'person')], ['result'],
      { tags: ['social', 'reconnect'], interests: ['social'] },
    )),
    entry(22, ['local', 'profile', 'social'], ['social-contact-selected'], template(
      'invite-person-to-found-event', 'social', 'session',
      'Позови {person} на {event}', 'Событие уже найдено по вашим общим интересам.',
      [slot('person', 'person'), slot('event', 'local-event')], ['result', 'checkin'],
      { tags: ['social', 'event', 'invite'], interests: ['social'] },
    )),
    entry(23, ['content', 'social'], ['social-contact-selected'], template(
      'play-new-board-game', 'social', 'session',
      'Соберите {player-count} человек и сыграйте в {game}', 'Правила, длительность и подходящее место уже выбраны.',
      [slot('player-count', 'custom'), slot('game', 'content')], ['result'],
      { tags: ['social', 'tabletop', 'game'], interests: ['board-games', 'games'] },
    )),
    entry(24, ['content', 'social'], ['social-contact-selected'], template(
      'run-first-dungeon-master-session', 'social', 'expedition',
      'Проведи первую игру как Dungeon Master', 'Сценарий {scenario}: подготовка {prep-time}, игра {play-time}.',
      [slot('scenario', 'content'), slot('prep-time', 'custom'), slot('play-time', 'custom')], ['result', 'story'], {
        tags: ['social', 'tabletop', 'creation'], interests: ['board-games', 'role-playing-games'],
        reward: { title: 'Dungeon Master' },
      },
    )),
    entry(25, ['profile', 'social'], ['social-contact-selected'], template(
      'friend-chooses-large-adventure', 'expedition', 'arc',
      'Пусть {person} выберет ваше приключение', 'Три подходящих варианта уже проверены; завершите один до {deadline}.',
      [slot('person', 'person'), slot('deadline', 'custom'), slot('options', 'content')], ['checkin', 'story', 'result'], {
        tags: ['social', 'adventure', 'novelty'], interests: ['travel', 'social'],
        reward: { title: 'Проводник' },
      },
    ), { choicePolicy: 'three-preapproved-options-chosen-by-friend' }),
    entry(26, ['profile', 'social'], ['social-contact-selected'], template(
      'teach-one-specific-skill', 'social', 'session',
      'Покажи {person}, как {skill}', 'Цель — чтобы в конце человек смог повторить это сам.',
      [slot('person', 'person'), slot('skill', 'content')], ['result'],
      { tags: ['social', 'teaching', 'skill'], interests: ['teaching'] },
    )),
    entry(27, ['local', 'profile'], [], template(
      'ask-expert-specific-question', 'experience', 'session',
      'Задай специалисту один конкретный вопрос', '{expert}: вопрос «{question}».',
      [slot('expert', 'local-event'), slot('question', 'content')], ['result'],
      { tags: ['learning', 'expert', 'question'], interests: ['learning'] },
    )),
    entry(28, ['local', 'profile'], [], template(
      'join-live-discussion', 'social', 'session',
      'Вступи в дискуссию на {event}', 'Тема — {topic}. Включись в разговор хотя бы один раз.',
      [slot('event', 'local-event'), slot('topic', 'content')], ['checkin', 'result'],
      { tags: ['discussion', 'social', 'learning'], interests: ['debate', 'learning'] },
    )),
    entry(29, ['local', 'profile'], [], template(
      'attend-specific-open-lecture', 'experience', 'session',
      'Сходи на лекцию {lecture}', 'Тема подходит по интересам; время, место и регистрация уже проверены.',
      [slot('lecture', 'local-event')], ['checkin', 'reflection'],
      { tags: ['lecture', 'learning', 'local'], interests: ['learning'] },
    )),
    entry(30, ['history', 'user-input'], [], template(
      'make-notes-for-one-lecture', 'creation', 'session',
      'Сделай конспект лекции {lecture}', 'Сохрани основные идеи, примеры и один оставшийся вопрос.',
      [slot('lecture', 'content')], ['result'],
      { tags: ['lecture', 'learning', 'notes'], interests: ['learning'] },
    )),
    entry(31, ['history', 'user-input'], ['existing-project', 'publishing-opt-in'], template(
      'finish-and-publish-one-work', 'creation', 'expedition',
      'Закончи и опубликуй {work}', 'Доведи работу до версии, которую можно показать, и размести в {channel}.',
      [slot('work', 'content'), slot('channel', 'content')], ['result', 'story'],
      { tags: ['creation', 'publish', 'project'], interests: ['creative'] },
    )),
    entry(32, ['consent', 'history'], ['filming-opt-in'], template(
      'film-completed-adventure-story', 'creation', 'session',
      'Сними короткую историю о {quest}', 'Покажи старт, один сильный момент и результат.',
      [slot('quest', 'content')], ['video'],
      { tags: ['video', 'story', 'creation'], interests: ['video', 'content'] },
    )),
    entry(33, ['finance', 'user-input'], ['subscription-selected', 'finance-source-opt-in'], template(
      'cancel-unused-subscription', 'challenge', 'session',
      'Отмени {subscription}', 'Следующее списание — {date}, экономия — {amount} в месяц.',
      [slot('subscription', 'custom'), slot('date', 'custom'), slot('amount', 'custom')], ['result'],
      { tags: ['money', 'subscription', 'practical'], interests: ['finance'], share: 'none' },
    )),
    entry(34, ['content', 'user-input'], ['user-item-selected'], template(
      'list-unused-item-for-sale', 'creation', 'session',
      'Выстави {item} на продажу', 'Реалистичная цена — {price-range}; черновик объявления и список фото готовы.',
      [slot('item', 'custom'), slot('price-range', 'custom')], ['result'],
      { tags: ['money', 'sale', 'practical'], interests: ['finance'] },
    )),
    entry(35, ['history', 'local'], ['personal-place-selected'], template(
      'return-to-important-place', 'experience', 'session',
      'Вернись в {place}', 'Это место было важным для тебя пять лет назад. Зафиксируй, что изменилось.',
      [slot('place', 'local-place')], ['reflection', 'story', 'photo', 'checkin'],
      { tags: ['memory', 'place', 'reflection'], interests: ['reflection'] },
    )),
    entry(36, ['consent', 'user-input'], [], template(
      'write-letter-to-future-self', 'creation', 'session',
      'Напиши письмо себе на {date}', 'Что ты строишь сейчас, чего боишься и что не хочешь забыть.',
      [slot('date', 'custom')], ['result'],
      { tags: ['writing', 'reflection', 'future'], interests: ['writing'], share: 'none' },
    )),
  ];

  function validateEntry(candidate, expectedReviewId) {
    if (!candidate || candidate.schema !== CATALOG_SCHEMA) throw new Error('invalid-catalog-entry');
    if (candidate.reviewId !== expectedReviewId) throw new Error('invalid-review-order');
    if (candidate.contentStatus !== CONTENT_STATUS) throw new Error('unapproved-content');
    const sources = candidate.resolver && candidate.resolver.sources;
    const gates = candidate.resolver && candidate.resolver.gates;
    if (!Array.isArray(sources) || sources.some((source) => !RESOLVER_SOURCES.includes(source))) {
      throw new Error('invalid-resolver-source');
    }
    if (!Array.isArray(gates) || gates.some((gate) => !ELIGIBILITY_GATES.includes(gate))) {
      throw new Error('invalid-eligibility-gate');
    }
    if (candidate.resolver.recommendationLimit !== 1 || candidate.resolver.alternativeLimit !== 1) {
      throw new Error('choice-overload');
    }
  }

  for (let index = 0; index < ENTRIES.length; index += 1) validateEntry(ENTRIES[index], index + 1);
  deepFreeze(ENTRIES);

  function compileCatalog(boardApi) {
    if (!boardApi || typeof boardApi.compileTemplate !== 'function') throw new Error('board-v2-required');
    const templates = ENTRIES.map((catalogEntry) => boardApi.compileTemplate(catalogEntry.template));
    return deepFreeze({
      schema: CATALOG_SCHEMA,
      version: VERSION,
      contentStatus: CONTENT_STATUS,
      entries: ENTRIES,
      templates,
    });
  }

  function entryByTemplateId(templateId) {
    return ENTRIES.find((catalogEntry) => catalogEntry.template.id === templateId) || null;
  }

  return deepFreeze({
    VERSION,
    CATALOG_SCHEMA,
    CONTENT_STATUS,
    RESOLVER_SOURCES,
    ELIGIBILITY_GATES,
    STRETCH_OPTIONS,
    ENTRIES,
    compileCatalog,
    entryByTemplateId,
  });
});
