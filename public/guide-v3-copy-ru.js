/* Satoru Guide v3 — centralized Russian draft copy.
 *
 * IMPORTANT: this is tone-review material, not approved runtime wording.
 * Albert must approve the Russian lines before any EN/DE/UK/ES translation.
 *
 * Pure UMD module: no DOM, State, storage, network, or translator access.
 * Callers must escape user-provided substitutions before inserting formatted
 * text into HTML. format() intentionally performs text substitution only.
 */
(function exposeGuideV3CopyRu(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuideV3CopyRu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuideV3CopyRu() {
  'use strict';

  const VERSION = '0.1.1-draft';
  const LOCALE = 'ru';
  const STATUS = 'tone-review-required';
  const RUNTIME_APPROVED = false;

  const CONTEXTUAL_STATUS = Object.freeze({
    habits: 'draft-ready',
    goals: 'deferred-questionnaire',
    calendar: 'draft-ready',
    notes: 'draft-ready',
    voice: 'draft-ready',
    jarvis: 'draft-ready',
    systemTheme: 'draft-ready',
    rewards: 'draft-ready',
    hero: 'draft-ready',
    den: 'draft-ready',
    pets: 'draft-ready',
    tree: 'draft-ready',
    stats: 'draft-ready',
    tribe: 'draft-ready',
  });

  const COPY = Object.freeze({
    "chapter.first.title": "Первое путешествие",
    "chapter.habits.title": "Привычки",
    "chapter.goals.title": "Цели",
    "chapter.calendar.title": "Календарь",
    "chapter.notes.title": "Заметки",
    "chapter.voice.title": "Голос Тени",
    "chapter.jarvis.title": "Личный помощник",
    "chapter.system_theme.title": "Тема системы",
    "chapter.rewards.title": "Награды",
    "chapter.hero.title": "Герой",
    "chapter.den.title": "Логово",
    "chapter.pets.title": "Питомцы",
    "chapter.tree.title": "Дерево навыков",
    "chapter.stats.title": "Статистика",
    "chapter.tribe.title": "Племя",

    "system.action.start": "Начать",
    "system.action.later": "Позже",
    "system.action.next": "Дальше",
    "system.action.back": "Назад",
    "system.action.close": "Закрыть",
    "system.action.skip_chapter": "Пропустить главу",
    "system.action.disable_prompts": "Не показывать подсказки",
    "system.action.enable_prompts": "Включить подсказки",
    "system.action.resume": "Продолжить",
    "system.action.replay": "Пройти ещё раз",
    "system.action.retry": "Повторить",
    "system.action.save": "Сохранить",
    "system.action.show": "Показать",
    "system.action.not_now": "Не сейчас",
    "system.action.understood": "Понятно",
    "system.action.okay": "Хорошо",
    "system.action.speak": "Озвучить",
    "system.action.stop_voice": "Остановить голос",
    "system.action.replay_voice": "Повторить реплику",
    "system.action.my_step": "Это мой шаг",
    "system.action.choose_other": "Выбрать другой",
    "system.action.run_focus": "Запустить",
    "system.action.without_timer": "Сделаю без таймера",
    "system.action.stay_today": "Остаться на Сегодня",
    "system.action.whats_next": "Что будет дальше?",
    "system.action.touch_shadow": "Коснуться Тени",
    "system.progress": "Шаг {current} из {total}",
    "system.saving": "Сохраняю…",
    "system.saved": "Сохранено",
    "system.save_failed": "Не удалось сохранить. Ничего не изменено — попробуй ещё раз.",
    "system.offline": "Сейчас нет связи. Гайд сохранит это место и продолжится, когда приложение снова сможет записать результат.",
    "system.voice_unavailable": "Голос сейчас недоступен. Реплика остаётся на экране.",
    "system.target_unavailable": "Нужный элемент сейчас недоступен. Закрой открытое окно или вернись на этот шаг позже.",
    "system.chapter_complete": "Глава завершена",
    "system.chapter_snoozed": "Хорошо. Вернёмся к этому позже.",
    "system.replay_no_reward": "Повтор помогает вспомнить механику, но не выдаёт опыт, золото или связь повторно.",
    "system.global_disable_confirm": "Отключить все новые подсказки? Пройденные главы и справочник останутся доступны.",

    "first.episode.meeting.title": "Встреча",
    "first.episode.recognition.title": "Твой первый шаг",
    "first.episode.selection.title": "Выбор",
    "first.episode.start.title": "Начать дело",
    "first.episode.wait.title": "Настоящее действие",
    "first.episode.victory.title": "Первая победа",
    "first.episode.level.title": "Уровень и Форма",
    "first.episode.bond.title": "Знакомство с Тенью",
    "first.episode.release.title": "Дальше самостоятельно",
    "first.meeting": "Я — Тень. Покажу только то, что пригодится прямо сейчас. Остальное оставим на потом — у нас ещё будет время.",
    "first.recognition.seed": "Ты писал, что для тебя важно {goalOrSphere}. Вот первый шаг, который из этого получился: «{firstQuest}». Не абстрактный план — вещь, которую можно сделать.",
    "first.recognition.seed_neutral": "Вот первый шаг, который получился из твоей настройки: «{firstQuest}». Не абстрактный план — вещь, которую можно сделать.",
    "first.recognition.create": "Начнём с одного шага. Не с новой жизни целиком — просто с того, что действительно можно сделать сегодня.",
    "first.create.label": "Одно дело на сегодня",
    "first.create.placeholder": "Например: пройтись десять минут",
    "first.create.sphere_label": "Сфера этого шага",
    "first.selection": "Это будет твой следующий шаг. Если сейчас не время — ничего страшного: он останется здесь, а ты вернёшься, когда сможешь.",
    "first.start": "Когда трудно войти в дело, нажми ▶. Satoru удержит время и один фокус, чтобы тебе не пришлось держать их в голове.",
    "first.wait": "Теперь — само дело. Я подожду здесь. Отмечай его только когда оно правда закончено; нам не нужны красивые цифры вместо твоей жизни.",
    "first.wait.resume": "Ты вернулся. Наш шаг всё ещё здесь. Если он уже сделан, отметь это честно; если нет — продолжай в своём темпе.",
    "first.victory": "Вот теперь это стало ростом: опыт — в твою сферу, золото — на награды, выполненное дело — в историю. Не за обещание. За то, что ты сделал.",
    "first.level_form": "Уровень хранит доказанное мастерство и не сгорает из-за паузы. Для свежести есть отдельная Форма: её можно потерять на время и вернуть без обнуления прошлого.",
    "first.bond": "И ещё одно. Я расту не от идеальных серий, а от наших встреч. Можешь просто коснуться меня — этого достаточно для знакомства.",
    "first.bond.complete": "Хорошо. Теперь мы знакомы.",
    "first.release": "На сегодня хватит. Когда новая часть Satoru действительно пригодится, я покажу её отдельно. А сейчас это твой день — не мой урок.",
    "first.teaser": "Дальше появятся привычки, цели и твой Герой. Позже — Логово, питомцы, навыки и Племя. Не всё сразу: сначала пусть сегодняшний шаг станет твоим.",
    "first.skip": "Хорошо. Твой день останется твоим. Если захочешь, продолжить знакомство можно в справочнике.",

    "context.habits.prompt": "Одно дело помогает сегодня. Повторяемое меняет то, каким человеком ты становишься. Хочешь превратить один знакомый шаг в привычку?",
    "context.habits.choose": "Выбери шаг, который действительно хочешь повторять. Новый придумывать не обязательно.",
    "context.habits.schedule": "Отметь дни, когда этот ритм реалистичен. Расписание можно изменить позже.",
    "context.habits.two_minute": "Добавь версию на две минуты — самый маленький честный вход в привычку на трудный день.",
    "context.habits.complete": "Готово. Серия показывает ритм, но не создаёт долг. Пропустишь — мы просто продолжим со следующего раза.",

    "context.calendar.prompt": "У этого дела появилось своё время. Хочешь поставить его в календарь, чтобы оно не спорило с сегодняшним шагом?",
    "context.calendar.guide": "Выбери реальное дело, дату и, если нужно, время. Мы меняем только его место в плане.",
    "context.calendar.complete": "Готово. Дело осталось твоим — мы только нашли ему место.",

    "context.notes.prompt": "Не каждая мысль должна сразу становиться делом. Хочешь сохранить одну без решения прямо сейчас?",
    "context.notes.capture": "Запиши мысль как есть. Позже её можно оставить заметкой или превратить в конкретный шаг.",
    "context.notes.complete": "Сохранено. Теперь эту мысль не нужно держать в голове.",

    "context.voice.prompt": "Я могу произносить реплики вслух постоянным голосом. Текст всё равно останется на экране. Хочешь проверить?",
    "context.voice.complete": "Голос можно остановить, повторить или полностью выключить в настройках.",

    "context.jarvis.prompt": "Если трудно понять, что сейчас главное, можно спросить меня о своём дне. Я посмотрю на доступные данные и предложу один следующий шаг.",
    "context.jarvis.complete": "Это диалог, а не команда. Ответ можно принять, изменить или оставить без действия.",

    "context.system_theme.prompt": "Satoru может следовать светлой или тёмной теме устройства. Это меняет только оформление.",
    "context.system_theme.complete": "Готово. Тему можно сменить в любой момент.",

    "context.rewards.prompt": "У тебя уже есть заработанное золото. Хочешь обменять его на одну награду, которую ты выбрал для себя?",
    "context.rewards.choose": "Выбери награду осознанно: золото отмечает сделанное, а не покупает право на отдых.",
    "context.rewards.complete": "Награда куплена. Теперь главное — действительно ею воспользоваться.",

    "context.hero.prompt": "Герой отражает доказанный прогресс в твоих сферах. Здесь нет отдельной силы, которую нужно фармить ради картинки.",
    "context.hero.complete": "Образ меняется вместе с твоим путём, но уже прожитый прогресс не исчезает.",

    "context.den.prompt": "Логово — место, где живут Тень, Герой и питомцы. Оно открывается постепенно вместе с твоей историей.",
    "context.den.complete": "Осмотрись без спешки. Возвращаться сюда можно тогда, когда хочется увидеть свой мир, а не проверить список дел.",

    "context.pets.prompt": "Питомцы отражают, каким сферам давно не доставалось внимания. Это ориентир, не упрёк и не наказание.",
    "context.pets.complete": "Выбери одного питомца и посмотри, с какой сферой он связан. Исправлять всё сразу не нужно.",

    "context.tree.prompt": "У тебя появилось очко навыка. В Дереве оно открывает практику на реальном пути сферы, а не случайный бонус.",
    "context.tree.complete": "Готово. Следующие узлы появятся тогда, когда для них будет доказанный прогресс.",

    "context.stats.prompt": "Накопилось достаточно дней, чтобы увидеть ритм без догадок. Хочешь посмотреть одну закономерность?",
    "context.stats.complete": "Статистика показывает наблюдение, а не оценку тебя. Решение всё равно остаётся за тобой.",

    "context.tribe.prompt": "Племя открывает совместную игру. Ничего не публикуется и не сравнивается без отдельного согласия.",
    "context.tribe.complete": "Ты сам выбираешь, участвовать ли в Племени и какие социальные возможности включать.",

    "library.title": "Как играть",
    "library.subtitle": "Короткие главы появляются тогда, когда могут пригодиться. Их можно пропустить и пройти позже.",
    "library.continue": "Продолжить знакомство",
    "library.available": "Доступно сейчас",
    "library.completed": "Пройдено",
    "library.locked": "Появится позже",
    "library.locked_condition": "Откроется: {condition}",
    "library.replay_note": "Повтор не меняет данные и не выдаёт награды повторно.",
    "library.search.label": "Поиск по справочнику",
    "library.search.placeholder": "Найти функцию или механику",
    "library.empty_search": "Ничего не найдено. Попробуй другое слово.",
    "library.overview.title": "Что делает Satoru особенным",
    "library.overview.body": "Satoru связывает реальные дела, восстановление и разные сферы жизни в одну историю. Прогресс доказывается действиями, не сгорает из-за паузы и не требует быть идеальным.",
    "library.goals.deferred": "Глава о целях появится после утверждения новой механики и связи с будущей анкетой.",
    "library.disable_prompts.note": "Это отключит новые contextual-подсказки. Справочник и пройденные главы останутся доступны.",

    "a11y.guide_dialog": "Гайд Satoru",
    "a11y.guide_status": "Реплика Тени",
    "a11y.spotlight_target": "Элемент, о котором сейчас говорит Тень",
    "a11y.shadow_visual": "Тень · {form}",
    "a11y.shadow_alt": "Тень, форма {form}: {state}",
    "a11y.form.spark": "Искра",
    "a11y.form.spirit": "Дух",
    "a11y.form.guardian": "Страж",
    "a11y.form.keeper": "Хранитель",
    "a11y.state.arrive": "появляется рядом",
    "a11y.state.close_speak": "говорит с пользователем",
    "a11y.state.listen": "слушает",
    "a11y.state.direct": "направляет внимание",
    "a11y.state.recognize": "узнаёт знакомую цель",
    "a11y.state.celebrate": "радуется выполненному делу",
    "a11y.state.wait": "спокойно ждёт",
    "a11y.state.return": "встречает после возвращения"
  });

  function has(key) {
    return Object.prototype.hasOwnProperty.call(COPY, key);
  }

  function get(key) {
    return has(key) ? COPY[key] : null;
  }

  function format(key, variables) {
    const source = get(key);
    if (source == null) return null;
    const values = variables && typeof variables === 'object' ? variables : {};
    return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
    ));
  }

  function entries() {
    return Object.entries(COPY);
  }

  return Object.freeze({
    VERSION,
    LOCALE,
    STATUS,
    RUNTIME_APPROVED,
    COPY,
    CONTEXTUAL_STATUS,
    has,
    get,
    format,
    entries,
  });
});
