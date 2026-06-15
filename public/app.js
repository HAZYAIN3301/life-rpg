'use strict';

// ============================================================
//  Store — общение с локальным сервером. Данные = JSON-файлы в vault.
// ============================================================
const Store = {
  _timers: {},
  async load(name, fallback) {
    try {
      const r = await fetch(`/api/data/${name}`);
      if (r.status === 404) return structuredClone(fallback);
      if (!r.ok) throw new Error('load ' + r.status);
      return await r.json();
    } catch (e) {
      console.error('load', name, e);
      return structuredClone(fallback);
    }
  },
  save(name, obj) {
    clearTimeout(this._timers[name]);
    this._timers[name] = setTimeout(() => this._put(name, obj), 250);
  },
  async _put(name, obj) {
    try {
      const r = await fetch(`/api/data/${name}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj),
      });
      if (!r.ok) throw new Error('save ' + r.status);
    } catch (e) { console.error('save', name, e); toast('⚠️ Не удалось сохранить'); }
  },
};

// ============================================================
//  Дефолты и константы
// ============================================================
// Generic defaults — shown to brand-new users who have no data/settings.json yet.
// Existing users see their own settings.json instead (your personal skills are safe there).
const DEFAULT_SETTINGS = {
  appName: 'Gojo',
  skills: [
    { id: 'study', name: 'Учёба', color: '#4f86f7' },
    { id: 'work', name: 'Работа', color: '#22c1a4' },
    { id: 'sport', name: 'Спорт', color: '#e0526a' },
    { id: 'health', name: 'Здоровье', color: '#5fbf5f' },
    { id: 'mind', name: 'Саморазвитие', color: '#b06ff0' },
    { id: 'life', name: 'Быт', color: '#d8a44b' },
  ],
  xp: { perMinute: 1, completionBonus: 5, difficulty: { easy: 1, normal: 1.5, hard: 2.2 } },
  gold: { perMinute: 0.4, completionBonus: 3 },
  curve: { base: 100, growth: 1.3, skillBase: 60 },
  focus: { pomodoro: true, workMin: 25, breakMin: 5, sound: true, notify: true },
  imported: {}, // { skillId: { tier, xp, label, at } } — импортированный стартовый уровень
  energy: { day: null, cur: 100, max: 100, loadToday: 0, hitZero: false, tickAt: null }, // «Энергия» (идея 19): пассивное восстановление по времени
  cosmetics: [], // id'шники выпавшей косметики (рамки/фоны) — #20
  equipped: { frame: null, background: null, title: null }, // надетые косметика + звание
  sound: true, // звуки интерфейса (#23)
  theme: 'dark', accent: '#6c8cff', // оформление (тема + акцент)
};

const DIFF = { easy: 'Лёгкая', normal: 'Обычная', hard: 'Сложная' };
const WEEKDAYS = [
  { js: 1, label: 'Пн' }, { js: 2, label: 'Вт' }, { js: 3, label: 'Ср' },
  { js: 4, label: 'Чт' }, { js: 5, label: 'Пт' }, { js: 6, label: 'Сб' }, { js: 0, label: 'Вс' },
];
const GOAL_BONUS = { xp: 60, gold: 30 };
// Горизонты целей — от Севера (полярная звезда) до недели. Дерево связывается через parentId.
const GOAL_TYPES = [
  { id: 'mission',   label: '★ Миссия',      timeframe: 'дело жизни',               hint: 'Полярная звезда — ради чего всё. Обычно одна. К ней привязывается всё остальное.' },
  { id: 'vision',    label: '🔭 Видение',    timeframe: '10–20 лет',                hint: 'Кем стать, что построить за десятилетия' },
  { id: 'path',      label: '🧭 Путь',       timeframe: '3–5 лет',                  hint: 'Крупный этап: образование, карьера, переезд' },
  { id: 'long',      label: 'Долгосрочные',  timeframe: '6 мес – несколько лет',    hint: 'Большие цели года-двух: Abi, C1, проект' },
  { id: 'mid',       label: 'Среднесрочные', timeframe: '1–6 месяцев',              hint: 'Проект или трансформация за сезон: запустить MVP, пробежать полумарафон' },
  { id: 'short',     label: 'Краткосрочные', timeframe: 'до 4 недель',              hint: 'Конкретный результат в ближайший месяц: сдать экзамен, дочитать книгу' },
  { id: 'recurring', label: 'Повторяющиеся', timeframe: 'ежедневно · еженедельно',  hint: 'Регулярные практики без конечной даты: спорт каждый день, еженедельный обзор' },
];
const GOAL_XP = { mission: 8000, vision: 3000, path: 1200, long: 750, mid: 200, short: 50, recurring: 15 };
function goalTypeLabel(t) { const x = GOAL_TYPES.find((g) => g.id === t); return x ? x.label : 'Цель'; }

// Достижения — описаны в коде, считаются на лету
const ACHIEVEMENTS = [
  { id: 'first_quest', icon: '⚔️', title: 'Первый шаг', desc: 'Выполни первый квест', ttl: 'Первопроходец', test: () => doneTasks().length >= 1 },
  { id: 'quests_50', icon: '🏆', title: 'Полста квестов', desc: '50 выполненных квестов', ttl: 'Ветеран квестов', test: () => doneTasks().length >= 50, prog: () => ({ cur: doneTasks().length, target: 50 }) },
  { id: 'first_habit', icon: '🌱', title: 'Росток привычки', desc: 'Отметь привычку впервые', ttl: 'Садовник', test: () => Object.values(State.habitlog).some((m) => Object.keys(m).length > 0) },
  { id: 'streak_7', icon: '🔥', title: 'Неделя подряд', desc: 'Серия 7 дней', ttl: 'Хранитель ритма', test: () => currentStreak() >= 7, prog: () => ({ cur: currentStreak(), target: 7 }) },
  { id: 'streak_30', icon: '🌋', title: 'Месяц подряд', desc: 'Серия 30 дней', ttl: 'Несокрушимый', test: () => currentStreak() >= 30, prog: () => ({ cur: currentStreak(), target: 30 }) },
  { id: 'level_5', icon: '⭐', title: 'Уровень 5', desc: 'Достигни 5 уровня', ttl: 'Восходящий', test: () => charLevel() >= 5, prog: () => ({ cur: charLevel(), target: 5 }) },
  { id: 'level_10', icon: '🌟', title: 'Уровень 10', desc: 'Достигни 10 уровня', ttl: 'Покоритель', test: () => charLevel() >= 10, prog: () => ({ cur: charLevel(), target: 10 }) },
  { id: 'xp_1000', icon: '💎', title: 'Тысяча опыта', desc: 'Накопи 1000 XP', ttl: 'Тысячник', test: () => overallXp() >= 1000, prog: () => ({ cur: overallXp(), target: 1000 }) },
  { id: 'first_goal', icon: '🎯', title: 'Цель взята', desc: 'Заверши первую цель', ttl: 'Целеустремлённый', test: () => State.goals.some((g) => g.completedAt) },
  { id: 'first_reward', icon: '🎁', title: 'Награда', desc: 'Купи первую награду', ttl: 'Ценитель', test: () => (State.purchases || []).length > 0 },
  { id: 'gold_500', icon: '🪙', title: 'Богатей', desc: 'Заработай 500 золота всего', ttl: 'Златолюб', test: () => goldEarned() >= 500, prog: () => ({ cur: goldEarned(), target: 500 }) },
  { id: 'skills_all3', icon: '📚', title: 'Разносторонний', desc: 'Все навыки до ур.3', ttl: 'Разносторонний', test: () => State.settings.skills.length > 0 && State.settings.skills.every((s) => skillLevelOf(s.id) >= 3) },
  // За полезные репорты — фидбек делает продукт (идея fb_mq2vy77ine8h)
  { id: 'reporter_3', icon: '🐞', title: 'Баг-хантер', desc: '3 репорта или идеи через 💬', ttl: 'Баг-хантер', test: () => (State.myFeedbackCount || 0) >= 3, prog: () => ({ cur: State.myFeedbackCount || 0, target: 3 }) },
  { id: 'cofounder_10', icon: '🛡️', title: 'Страж Врат · SCP-001', desc: '10 репортов — почти со-основатель', ttl: 'Страж Врат', test: () => (State.myFeedbackCount || 0) >= 10, prog: () => ({ cur: State.myFeedbackCount || 0, target: 10 }) },
  // Необычные/календарные — в духе Garmin (фидбек #9): ловят момент, а не только объём
  { id: 'early_bird', icon: '🌅', title: 'Ранняя пташка', desc: 'Выполни квест до 07:00', ttl: 'Ранняя пташка', test: () => completedTimes().some((d) => d.getHours() < 7) },
  { id: 'night_owl', icon: '🦉', title: 'Сова', desc: 'Квест между 00:00 и 05:00', ttl: 'Сова', test: () => completedTimes().some((d) => d.getHours() < 5) },
  { id: 'weekend_warrior', icon: '🛡️', title: 'Воин выходных', desc: 'Квесты и в субботу, и в воскресенье', ttl: 'Воин выходных', test: () => { const s = new Set(completedTimes().map((d) => d.getDay())); return s.has(6) && s.has(0); } },
  { id: 'new_year', icon: '🎆', title: 'Новогодний рывок', desc: 'Тренируйся 31 декабря или 1 января', ttl: 'Новогодний', test: () => completedTimes().some((d) => (d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1)) },
  { id: 'full_spectrum', icon: '🌈', title: 'Полный спектр', desc: '5+ разных сфер за один день', ttl: 'Многогранный', test: () => Object.values(eventsByDay()).some((evs) => new Set(evs.map((e) => e.skillId).filter(Boolean)).size >= 5) },
  { id: 'marathon_day', icon: '🏔️', title: 'Марафон дня', desc: '4+ часа активности за день', ttl: 'Марафонец', test: () => Object.values(eventsByDay()).some((evs) => evs.reduce((s, e) => s + (e.min || 0), 0) >= 240) },
  { id: 'balanced', icon: '⚖️', title: 'Десятиборец', desc: 'Индекс баланса ≥ 70', ttl: 'Десятиборец', test: () => balanceIndex().index >= 70, prog: () => ({ cur: balanceIndex().index, target: 70 }) },
  // #21 — больше достижений (2026-06-15): объём, уровни, навыки, цели, привычки, анти-привычки, коллекция, кастом
  { id: 'quests_100', icon: '💯', title: 'Сотня квестов', desc: '100 выполненных квестов', ttl: 'Сотник', test: () => doneTasks().length >= 100, prog: () => ({ cur: doneTasks().length, target: 100 }) },
  { id: 'quests_250', icon: '🗡️', title: 'Легион дел', desc: '250 выполненных квестов', ttl: 'Легионер', test: () => doneTasks().length >= 250, prog: () => ({ cur: doneTasks().length, target: 250 }) },
  { id: 'xp_5000', icon: '🔱', title: 'Пять тысяч', desc: 'Накопи 5000 XP', ttl: 'Архонт', test: () => overallXp() >= 5000, prog: () => ({ cur: overallXp(), target: 5000 }) },
  { id: 'xp_25000', icon: '☄️', title: 'Титан опыта', desc: 'Накопи 25000 XP', ttl: 'Титан опыта', test: () => overallXp() >= 25000, prog: () => ({ cur: overallXp(), target: 25000 }) },
  { id: 'streak_100', icon: '🌌', title: 'Сто дней подряд', desc: 'Серия 100 дней', ttl: 'Несгибаемый', test: () => currentStreak() >= 100, prog: () => ({ cur: currentStreak(), target: 100 }) },
  { id: 'level_20', icon: '🛡️', title: 'Двадцатый', desc: 'Достигни 20 уровня', ttl: 'Архимаг', test: () => charLevel() >= 20, prog: () => ({ cur: charLevel(), target: 20 }) },
  { id: 'level_30', icon: '👑', title: 'Тридцатый', desc: 'Достигни 30 уровня', ttl: 'Владыка пути', test: () => charLevel() >= 30, prog: () => ({ cur: charLevel(), target: 30 }) },
  { id: 'skill_master', icon: '🎓', title: 'Мастер сферы', desc: 'Любая сфера до ур.10', ttl: 'Виртуоз', test: () => State.settings.skills.some((s) => skillLevelOf(s.id) >= 10) },
  { id: 'skills_all5', icon: '🧭', title: 'Эрудит', desc: 'Все сферы до ур.5', ttl: 'Эрудит', test: () => State.settings.skills.length > 0 && State.settings.skills.every((s) => skillLevelOf(s.id) >= 5) },
  { id: 'goals_10', icon: '🏹', title: 'Десять целей', desc: 'Заверши 10 целей', ttl: 'Достигатор', test: () => State.goals.filter((g) => g.completedAt).length >= 10, prog: () => ({ cur: State.goals.filter((g) => g.completedAt).length, target: 10 }) },
  { id: 'mission_set', icon: '⭐', title: 'Полярная звезда', desc: 'Задай миссию (★ дело жизни)', ttl: 'Звездочёт', test: () => State.goals.some((g) => g.type === 'mission') },
  { id: 'habits_100', icon: '🔁', title: 'Сила привычки', desc: '100 отметок привычек', ttl: 'Машина привычек', test: () => Object.values(State.habitlog).reduce((s, m) => s + Object.keys(m).length, 0) >= 100, prog: () => ({ cur: Object.values(State.habitlog).reduce((s, m) => s + Object.keys(m).length, 0), target: 100 }) },
  { id: 'balanced_90', icon: '☯️', title: 'Идеальный баланс', desc: 'Индекс баланса ≥ 90', ttl: 'Гармония', test: () => balanceIndex().index >= 90, prog: () => ({ cur: balanceIndex().index, target: 90 }) },
  { id: 'clean_7', icon: '🕊️', title: 'Чистая неделя', desc: '7 дней без срыва (анти-привычка)', ttl: 'Освобождённый', test: () => (State.antihabits || []).some((a) => antiCleanDays(a) >= 7), prog: () => ({ cur: Math.max(0, ...(State.antihabits || []).map((a) => antiCleanDays(a)), 0), target: 7 }) },
  { id: 'clean_30', icon: '🦋', title: 'Чистый месяц', desc: '30 дней без срыва', ttl: 'Перерождённый', test: () => (State.antihabits || []).some((a) => antiCleanDays(a) >= 30), prog: () => ({ cur: Math.max(0, ...(State.antihabits || []).map((a) => antiCleanDays(a)), 0), target: 30 }) },
  { id: 'first_note', icon: '📝', title: 'Первая мысль', desc: 'Сохрани первую заметку', ttl: 'Хроникёр', test: () => (State.inbox || []).length >= 1 },
  { id: 'collector_5', icon: '🎨', title: 'Коллекционер', desc: 'Собери 5 косметики', ttl: 'Коллекционер', test: () => COSMETICS.filter((c) => ownsCosmetic(c.id)).length >= 5, prog: () => ({ cur: COSMETICS.filter((c) => ownsCosmetic(c.id)).length, target: 5 }) },
  { id: 'legendary_drop', icon: '🌟', title: 'Легендарная удача', desc: 'Получи легендарную косметику', ttl: 'Везунчик', test: () => COSMETICS.some((c) => c.rarity === 'legendary' && ownsCosmetic(c.id)) },
  { id: 'avatar_custom', icon: '🪄', title: 'Свой облик', desc: 'Настрой аватар под себя', ttl: 'Неповторимый', test: () => JSON.stringify(avCfg()) !== JSON.stringify(defaultAvatar()) },
];

// Каталог предустановленных наград — «дроп с босса уже выбран» (fb: награды должны быть предустановлены)
const REWARD_CATALOG = [
  { icon: '☕', name: 'Кофе в любимой кофейне', cost: 60 },
  { icon: '🍫', name: 'Шоколадка / сладость', cost: 50 },
  { icon: '🎮', name: '1 час игр без вины', cost: 120 },
  { icon: '📺', name: 'Серия сериала', cost: 80 },
  { icon: '🎬', name: 'Вечер кино с попкорном', cost: 200 },
  { icon: '🍕', name: 'Пицца / любимая еда', cost: 250 },
  { icon: '🛁', name: 'Долгая ванна со всеми смузи', cost: 100 },
  { icon: '😴', name: 'Поспать без будильника', cost: 150 },
  { icon: '📚', name: 'Новая книга', cost: 300 },
  { icon: '🎧', name: 'Час музыки/подкаста лёжа', cost: 90 },
  { icon: '🛍', name: 'Маленькая покупка до 1000₽/10€', cost: 400 },
  { icon: '🍣', name: 'Заказать доставку', cost: 350 },
  { icon: '🌳', name: 'Прогулка без телефона', cost: 40 },
  { icon: '💆', name: 'Массаж / спа', cost: 600 },
  { icon: '🎲', name: 'Настолки с друзьями', cost: 180 },
  { icon: '✈️', name: 'Поездка на выходные', cost: 2000 },
  { icon: '🎁', name: 'Большая хотелка (копилка)', cost: 5000 },
  { icon: '🍦', name: 'Мороженое', cost: 45 },
];
const FREE_REWARDS_MAX = 8; // лимит наград для Free (Pro — без лимита)

// Шаблоны навыков для онбординга (как у rpgreal)
// Шаблоны сфер сгруппированы по жизненным областям (десятиборье) — чтобы человек собирал
// «как я делю свою жизнь», а не из плоской кучи. #21: пресеты под реальное деление жизни.
const SKILL_GROUPS = [
  { group: '💪 Тело',       items: [{ name: 'Спорт', color: '#5fbf5f' }, { name: 'Здоровье', color: '#22c1a4' }, { name: 'Питание', color: '#e0a23e' }, { name: 'Сон', color: '#6c8cff' }, { name: 'Бег', color: '#46c46b' }] },
  { group: '🧠 Ум',         items: [{ name: 'Учёба', color: '#4f86f7' }, { name: 'Чтение', color: '#22c1a4' }, { name: 'Английский', color: '#5fbf7a' }, { name: 'Программирование', color: '#4f86f7' }] },
  { group: '💼 Дело',       items: [{ name: 'Работа', color: '#e0526a' }, { name: 'Финансы', color: '#d8a44b' }, { name: 'Бизнес', color: '#e0526a' }, { name: 'Карьера', color: '#c08a5e' }] },
  { group: '🧘 Душа',       items: [{ name: 'Саморазвитие', color: '#b06ff0' }, { name: 'Духовность', color: '#9c6ad6' }, { name: 'Медитация', color: '#7c5cff' }] },
  { group: '❤️ Связи',      items: [{ name: 'Отношения', color: '#e87d3e' }, { name: 'Семья', color: '#e0526a' }, { name: 'Друзья', color: '#e0a23e' }] },
  { group: '🎨 Творчество', items: [{ name: 'Творчество', color: '#b06ff0' }, { name: 'Блогинг', color: '#e87d3e' }, { name: 'Музыка', color: '#d8a44b' }, { name: 'Видео', color: '#4f86f7' }] },
  { group: '🏠 Быт',        items: [{ name: 'Быт', color: '#8899bb' }, { name: 'Порядок', color: '#7a8aa0' }, { name: 'Хобби', color: '#46c46b' }] },
];
const SKILL_TEMPLATES = SKILL_GROUPS.flatMap((g) => g.items); // плоский список для поиска цвета по имени

// ── Программы-данжи (идея 25): готовые наборы сфер + привычек + стартовых квестов.
//    Дают новичку структуру в один тап вместо чистого листа. Можно добавить и позже (Настройки).
// Персоны (#21): дают реалистичную карту жизни — 5-6 сфер с лёгкой иерархией там, где естественно
// (Здоровье ⊃ Спорт/Сон). Радар показывает столбы как оси, под-сферы агрегируются — карта богатая, но не куцая.
// Привычек/квестов немного (3 + 2) — структура полная, дневная нагрузка щадящая.
const DUNGEON_PROGRAMS = [
  { id: 'student', icon: '🎓', name: 'Студент', tagline: 'Учёба, тело, связи, быт — как настоящая жизнь.',
    skills: [ { name: 'Учёба', color: '#4f86f7' },
              { name: 'Здоровье', color: '#22c1a4' }, { name: 'Спорт', color: '#5fbf5f', parent: 'Здоровье' }, { name: 'Сон', color: '#6c8cff', parent: 'Здоровье' },
              { name: 'Отношения', color: '#e87d3e' }, { name: 'Саморазвитие', color: '#b06ff0' }, { name: 'Быт', color: '#8899bb' } ],
    habits: [ { skill: 'Учёба', title: 'Учить материал / карточки', estimateMin: 20, difficulty: 'easy', days: [1,2,3,4,5] },
              { skill: 'Спорт', title: 'Зарядка / тренировка', estimateMin: 20, difficulty: 'normal', days: [1,3,5] },
              { skill: 'Сон', title: 'Лечь спать до 23:30', estimateMin: 5, difficulty: 'easy', days: [1,2,3,4,5,6,0] } ],
    quests: [ { skill: 'Учёба', title: 'Разобрать сложную тему', estimateMin: 45, difficulty: 'hard' },
              { skill: 'Отношения', title: 'Встретиться / позвонить близким', estimateMin: 30, difficulty: 'easy' } ] },
  { id: 'athlete', icon: '🏃', name: 'Спортсмен', tagline: 'Тело как проект: нагрузка, питание, восстановление.',
    skills: [ { name: 'Спорт', color: '#5fbf5f' }, { name: 'Сила', color: '#e0526a', parent: 'Спорт' }, { name: 'Выносливость', color: '#22c1a4', parent: 'Спорт' },
              { name: 'Питание', color: '#e0a23e' }, { name: 'Сон', color: '#6c8cff' }, { name: 'Здоровье', color: '#46c46b' } ],
    habits: [ { skill: 'Сила', title: 'Силовая тренировка', estimateMin: 45, difficulty: 'normal', days: [1,3,5] },
              { skill: 'Выносливость', title: 'Кардио / пробежка', estimateMin: 30, difficulty: 'normal', days: [2,4,6] },
              { skill: 'Питание', title: 'Следить за КБЖУ', estimateMin: 5, difficulty: 'easy', days: [1,2,3,4,5,6,0] } ],
    quests: [ { skill: 'Спорт', title: 'Длинная тренировка на пределе', estimateMin: 60, difficulty: 'hard' },
              { skill: 'Сон', title: 'Восстановление: лечь до 23:00', estimateMin: 5, difficulty: 'easy' } ] },
  { id: 'creator', icon: '🎬', name: 'Креатор', tagline: 'Создавай и публикуй — и не выгорай.',
    skills: [ { name: 'Творчество', color: '#b06ff0' }, { name: 'Видео', color: '#e87d3e', parent: 'Творчество' }, { name: 'Сценарий', color: '#d8a44b', parent: 'Творчество' },
              { name: 'Аудитория', color: '#4f86f7' }, { name: 'Здоровье', color: '#22c1a4' } ],
    habits: [ { skill: 'Творчество', title: 'Идеи в копилку (3 шт)', estimateMin: 10, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Видео', title: 'Поработать над роликом', estimateMin: 45, difficulty: 'normal', days: [1,3,5] },
              { skill: 'Здоровье', title: 'Прогулка / разминка', estimateMin: 20, difficulty: 'easy', days: [2,4,6] } ],
    quests: [ { skill: 'Видео', title: 'Выпустить ролик / пост', estimateMin: 90, difficulty: 'hard' },
              { skill: 'Аудитория', title: 'Ответить аудитории / разобрать метрики', estimateMin: 20, difficulty: 'easy' } ] },
  { id: 'pro', icon: '💼', name: 'Профи', tagline: 'Карьера, деньги и связи под контролем.',
    skills: [ { name: 'Работа', color: '#e0526a' }, { name: 'Финансы', color: '#d8a44b' }, { name: 'Здоровье', color: '#22c1a4' },
              { name: 'Отношения', color: '#e87d3e' }, { name: 'Саморазвитие', color: '#b06ff0' } ],
    habits: [ { skill: 'Работа', title: 'Глубокая работа 90 мин', estimateMin: 90, difficulty: 'hard', days: [1,2,3,4,5] },
              { skill: 'Финансы', title: 'Записать траты', estimateMin: 5, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Здоровье', title: 'Прогулка / зал', estimateMin: 30, difficulty: 'easy', days: [2,4,6] } ],
    quests: [ { skill: 'Работа', title: 'Закрыть ключевую задачу недели', estimateMin: 90, difficulty: 'hard' },
              { skill: 'Финансы', title: 'Свести бюджет за неделю', estimateMin: 30, difficulty: 'normal' } ] },
  { id: 'coder', icon: '💻', name: 'Кодер', tagline: 'Разработка шаг за шагом + язык и режим.',
    skills: [ { name: 'Программирование', color: '#4f86f7' }, { name: 'Проекты', color: '#5fbf7a', parent: 'Программирование' }, { name: 'Алгоритмы', color: '#e0a23e', parent: 'Программирование' },
              { name: 'Английский', color: '#22c1a4' }, { name: 'Здоровье', color: '#46c46b' } ],
    habits: [ { skill: 'Проекты', title: 'Кодить pet-проект', estimateMin: 45, difficulty: 'normal', days: [1,2,3,4,5] },
              { skill: 'Алгоритмы', title: 'Решить задачу (LeetCode)', estimateMin: 30, difficulty: 'hard', days: [2,4] },
              { skill: 'Английский', title: 'Английский 15 мин', estimateMin: 15, difficulty: 'easy', days: [1,2,3,4,5] } ],
    quests: [ { skill: 'Программирование', title: 'Разобрать новую технологию', estimateMin: 60, difficulty: 'hard' },
              { skill: 'Здоровье', title: 'Размяться / прогуляться', estimateMin: 20, difficulty: 'easy' } ] },
  { id: 'zen', icon: '🧘', name: 'Дзен', tagline: 'Внутренняя опора: спокойствие и осознанность.',
    skills: [ { name: 'Саморазвитие', color: '#b06ff0' }, { name: 'Медитация', color: '#7c5cff', parent: 'Саморазвитие' },
              { name: 'Здоровье', color: '#22c1a4' }, { name: 'Отношения', color: '#e87d3e' }, { name: 'Творчество', color: '#46c46b' } ],
    habits: [ { skill: 'Медитация', title: 'Медитация 10 мин', estimateMin: 10, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Саморазвитие', title: 'Дневник благодарности', estimateMin: 5, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Здоровье', title: 'Прогулка без телефона', estimateMin: 20, difficulty: 'easy', days: [2,4,6] } ],
    quests: [ { skill: 'Саморазвитие', title: 'Цифровой детокс 2 часа', estimateMin: 120, difficulty: 'normal' },
              { skill: 'Отношения', title: 'Глубокий разговор с близким', estimateMin: 30, difficulty: 'easy' } ] },
  { id: 'decathlete', icon: '⚖️', name: 'Десятиборец', tagline: 'Не вписался в роль? Сбалансированная карта всей жизни.',
    skills: [ { name: 'Тело', color: '#5fbf5f' }, { name: 'Ум', color: '#4f86f7' }, { name: 'Дело', color: '#e0526a' },
              { name: 'Душа', color: '#b06ff0' }, { name: 'Связи', color: '#e87d3e' }, { name: 'Творчество', color: '#d8a44b' }, { name: 'Быт', color: '#8899bb' } ],
    habits: [ { skill: 'Тело', title: 'Движение 20 мин', estimateMin: 20, difficulty: 'easy', days: [1,3,5] },
              { skill: 'Душа', title: 'Тихие 10 минут для себя', estimateMin: 10, difficulty: 'easy', days: [1,2,3,4,5,6,0] } ],
    quests: [ { skill: 'Дело', title: 'Главное дело недели', estimateMin: 60, difficulty: 'hard' },
              { skill: 'Связи', title: 'Время с близкими', estimateMin: 30, difficulty: 'easy' } ] },
];

function programSkillMap(prog, existingSkills) {
  const map = {}, skills = (existingSkills || []).slice();
  skills.forEach((sk) => { map[sk.name.toLowerCase()] = sk.id; });
  prog.skills.forEach((ps) => {
    const k = ps.name.toLowerCase();
    if (!map[k]) { const id = 'sk_' + k.replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).slice(2, 7); skills.push({ id, name: ps.name, color: ps.color }); map[k] = id; }
  });
  // Второй проход: связываем под-сферы с родителем по имени (пресеты с иерархией, напр. Здоровье ⊃ Спорт/Сон)
  prog.skills.forEach((ps) => {
    if (!ps.parent) return;
    const sk = skills.find((s) => s.id === map[ps.name.toLowerCase()]), pid = map[ps.parent.toLowerCase()];
    if (sk && pid && sk.id !== pid) sk.parentId = pid;
  });
  return { skills, map };
}
function programHabits(prog, map) { return (prog.habits || []).map((ph) => ({ id: 'h_' + uid(), title: ph.title, skillId: map[ph.skill.toLowerCase()], difficulty: ph.difficulty || 'normal', estimateMin: ph.estimateMin || 10, days: ph.days || [1, 2, 3, 4, 5], archived: false, createdAt: new Date().toISOString() })); }
function programTasks(prog, map) { return (prog.quests || []).map((pq) => ({ id: uid(), title: pq.title, skillId: map[pq.skill.toLowerCase()], estimateMin: pq.estimateMin || 20, difficulty: pq.difficulty || 'normal', date: todayStr(), done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: null, createdAt: new Date().toISOString() })); }

// Онбординг: чистый профиль из программы. Пишем файлы НАПРЯМУЮ (await), чтобы initApp их загрузил без гонки.
async function applyProgramFresh(prog) {
  const { skills, map } = programSkillMap(prog, []);
  const settings = Object.assign(structuredClone(DEFAULT_SETTINGS), { skills });
  await Promise.all([ Store._put('settings', settings), Store._put('habits', programHabits(prog, map)), Store._put('tasks', programTasks(prog, map)) ]);
  State.phase = 'app'; initApp();
}
// В приложении: домерживаем программу к существующим данным (не затирая их).
function applyProgramMerge(prog) {
  const { skills, map } = programSkillMap(prog, State.settings.skills);
  State.settings.skills = skills;
  State.habits.push(...programHabits(prog, map));
  State.tasks.push(...programTasks(prog, map));
  Store.save('settings', State.settings); Store.save('habits', State.habits); Store.save('tasks', State.tasks);
  toast(`📦 Программа «${prog.name}» добавлена`); render();
}
function programCard(p, action) {
  return `<button type="button" class="prog-card" data-action="${action}" data-prog="${p.id}">
    <span class="pc-ic">${p.icon}</span>
    <span class="pc-body">
      <span class="pc-name">${esc(p.name)}</span>
      <span class="pc-tag">${esc(p.tagline)}</span>
      <span class="pc-meta">${p.skills.map((s) => esc(s.name)).join(' · ')} · ${(p.habits || []).length} прив. · ${(p.quests || []).length} квест.</span>
    </span></button>`;
}

// ── Импорт достижений (стартовый уровень): честные лестницы-вехи, НЕ точная математика.
//    Каждый тир → целевой уровень сферы. tier 0 = «с нуля» (xp 0). Завязка по ключевому слову в имени сферы.
const IMPORT_LADDERS = {
  // Физическое
  'бег':          { hint: 'дистанция + темп', top: 20, tiers: ['Не бегаю', 'Иногда, до 5 км', 'Регулярно 5–10 км', 'Полумарафон', 'Марафон', 'Марафон <3:30 / ультра'] },
  'сил':          { hint: 'жим относительно своего веса (честно при любом весе)', top: 18, tiers: ['Не тренируюсь', 'Жим < 0.75× веса', 'Жим ≈ вес тела', 'Жим 1.25× веса', 'Жим 1.5×+ веса'] },
  'зал':          { hint: 'жим относительно своего веса', top: 18, tiers: ['Не тренируюсь', 'Жим < 0.75× веса', 'Жим ≈ вес тела', 'Жим 1.25× веса', 'Жим 1.5×+ веса'] },
  'качал':        { hint: 'жим относительно своего веса', top: 18, tiers: ['Не тренируюсь', 'Жим < 0.75× веса', 'Жим ≈ вес тела', 'Жим 1.25× веса', 'Жим 1.5×+ веса'] },
  'единоборств':  { hint: 'пояс / разряд', top: 20, tiers: ['Не занимаюсь', 'Белый–жёлтый пояс', 'Оранжевый–зелёный', 'Синий–коричневый', 'Чёрный пояс / разряд'] },
  'велосипед':    { hint: 'дистанция', top: 18, tiers: ['Не катаюсь', 'До 20 км', '20–50 км регулярно', 'Сенчури 100 км', 'Бревет 200 км+ / гонки'] },
  'плаван':       { hint: 'дистанция без остановки', top: 18, tiers: ['Не плаваю', 'Держусь на воде', '500 м', '1.5 км', 'Триатлон / 3 км+'] },
  'питани':       { hint: 'осознанность рациона', top: 16, tiers: ['Ем как получится', 'Базовый КБЖУ / слежу', 'Осознанный рацион без строгого счёта', 'Спортивное питание / протокол', 'Нутрициолог / диетолог'] },
  'нутриц':       { hint: 'осознанность рациона', top: 16, tiers: ['Ем как получится', 'Базовый КБЖУ / слежу', 'Осознанный рацион без строгого счёта', 'Спортивное питание / протокол', 'Нутрициолог / диетолог'] },
  'танц':         { hint: 'стиль / соревнования', top: 18, tiers: ['Не танцую', 'Базовые движения', 'Уверенно на вечеринках', 'Регулярные занятия, свой стиль', 'Соревнования / хореография'] },
  // Интеллект / учёба
  'английск':     { hint: 'CEFR', top: 18, tiers: ['A1 — начальный', 'A2 — базовый', 'B1 — средний', 'B2 — выше среднего', 'C1 — продвинутый', 'C2 — владение'] },
  'deutsch':      { hint: 'CEFR', top: 18, tiers: ['A1 — начальный', 'A2 — базовый', 'B1 — средний', 'B2 — выше среднего', 'C1 — продвинутый', 'C2 — владение'] },
  'немецк':       { hint: 'CEFR', top: 18, tiers: ['A1 — начальный', 'A2 — базовый', 'B1 — средний', 'B2 — выше среднего', 'C1 — продвинутый', 'C2 — владение'] },
  'язык':         { hint: 'CEFR', top: 18, tiers: ['A1 — начальный', 'A2 — базовый', 'B1 — средний', 'B2 — выше среднего', 'C1 — продвинутый', 'C2 — владение'] },
  'учёб':         { hint: 'ступень образования', top: 20, tiers: ['Школа', 'Старшие классы / Abitur', 'Бакалавриат', 'Магистратура', 'Аспирантура / PhD'] },
  'программир':   { hint: 'грейд', top: 20, tiers: ['Не программирую', 'Учу основы', 'Junior', 'Middle', 'Senior', 'Lead / архитектор'] },
  'кодинг':       { hint: 'грейд', top: 20, tiers: ['Не программирую', 'Учу основы', 'Junior', 'Middle', 'Senior', 'Lead / архитектор'] },
  'разработк':    { hint: 'грейд', top: 20, tiers: ['Не программирую', 'Учу основы', 'Junior', 'Middle', 'Senior', 'Lead / архитектор'] },
  'чтени':        { hint: 'книг в год', top: 16, tiers: ['Почти не читаю', '5–10 книг/год', '1–2 в месяц', 'Книга в неделю', 'Запойный читатель'] },
  // Творчество / харизма
  'рисов':        { hint: 'реальные работы как ориентир', top: 18, tiers: ['Не рисую', 'Копирую из туториалов', 'Рисую из головы простые образы', 'Сложные работы, свой стиль', 'Коммерческий / профессиональный уровень'] },
  'арт':          { hint: 'реальные работы как ориентир', top: 18, tiers: ['Не рисую', 'Копирую из туториалов', 'Рисую из головы простые образы', 'Сложные работы, свой стиль', 'Коммерческий / профессиональный уровень'] },
  'дизайн':       { hint: 'проекты / клиенты', top: 18, tiers: ['Не занимаюсь', 'Базы Figma/Canva, простые макеты', 'Свои проекты, понятная система', 'Продаю работы / работаю с клиентами', 'Ведущий дизайнер / арт-директор'] },
  'иллюстр':      { hint: 'реальные работы как ориентир', top: 18, tiers: ['Не рисую', 'Копирую из туториалов', 'Рисую из головы простые образы', 'Сложные работы, свой стиль', 'Коммерческий / профессиональный уровень'] },
  'фото':         { hint: 'контроль над снимком', top: 18, tiers: ['Только авто-режим', 'Базовая ручная настройка', 'Стабильно хорошие кадры', 'Продаю / публикую работы', 'Профессиональный фотограф'] },
  'видеограф':    { hint: 'проекты / качество', top: 18, tiers: ['Не снимаю', 'Снимаю для себя на телефон', 'Сознательная работа с кадром/светом', 'Коммерческие съёмки / клиенты', 'Профессиональный видеограф'] },
  'видеомонт':    { hint: 'проекты / инструменты', top: 18, tiers: ['Не монтирую', 'Базовый монтаж на телефоне', 'Premiere/Final Cut, стабильный результат', 'VFX / motion graphics', 'Профессиональный монтажёр'] },
  'блог':         { hint: 'аудитория / регулярность', top: 18, tiers: ['Не веду', 'Первые публикации, нерегулярно', 'Регулярно, есть постоянные читатели', 'Монетизация / спонсоры', 'Крупный блог / медиа'] },
  'контент':      { hint: 'аудитория / регулярность', top: 18, tiers: ['Не создаю', 'Первые ролики/посты', 'Регулярно, стабильное качество', 'Своя аудитория, монетизация', 'Крупный канал / инфлюенсер'] },
  'музык':        { hint: 'инструмент', top: 18, tiers: ['Не играю', 'Базовые аккорды/ноты', 'Играю любимое', 'Сложный репертуар', 'Концертный уровень'] },
  'гитар':        { hint: 'инструмент', top: 18, tiers: ['Не играю', 'Базовые аккорды', 'Играю любимое', 'Сложный репертуар', 'Концертный уровень'] },
  'пени':         { hint: 'выступления / уровень', top: 18, tiers: ['Только в душе', 'Пою для себя/друзей', 'Занимаюсь с педагогом', 'Выступления на публике', 'Профессиональный вокал'] },
  'вокал':        { hint: 'выступления / уровень', top: 18, tiers: ['Только в душе', 'Пою для себя/друзей', 'Занимаюсь с педагогом', 'Выступления на публике', 'Профессиональный вокал'] },
  // Дело / финансы
  'бизнес':       { hint: 'стадия дела', top: 20, tiers: ['Только идея', 'Первые клиенты / MVP', 'Стабильная выручка', 'Масштабируемый бизнес', 'Успешный выход / инвестиции'] },
  'стартап':      { hint: 'стадия дела', top: 20, tiers: ['Только идея', 'Первые клиенты / MVP', 'Стабильная выручка', 'Масштабируемый бизнес', 'Успешный выход / инвестиции'] },
  'предприн':     { hint: 'стадия дела', top: 20, tiers: ['Только идея', 'Первые клиенты / MVP', 'Стабильная выручка', 'Масштабируемый бизнес', 'Успешный выход / инвестиции'] },
  'инвест':       { hint: 'знания + портфель', top: 18, tiers: ['Нет сбережений', 'Есть подушка безопасности', 'Регулярно инвестирую (ETF/акции)', 'Диверсифицированный портфель', 'Финансовая независимость'] },
  'финанс':       { hint: 'знания + портфель', top: 18, tiers: ['Нет сбережений', 'Есть подушка безопасности', 'Регулярно инвестирую', 'Диверсифицированный портфель', 'Финансовая независимость'] },
  'продаж':       { hint: 'результат / объём', top: 18, tiers: ['Не продаю', 'Первые сделки', 'Стабильно закрываю', 'Перевыполняю план', 'Топ-сейлз / руковожу отделом'] },
  'маркетинг':    { hint: 'каналы / результат', top: 18, tiers: ['Не занимаюсь', 'Базы: посты, таргет', 'Веду каналы с результатом', 'Системный маркетинг / аналитика', 'Маркетинг-директор / стратег'] },
  // Социальное / коммуникация
  'отношен':      { hint: 'честная самооценка близости', top: 16, tiers: ['Сложно сближаться', 'Есть близкие, но нестабильно', 'Здоровые крепкие связи', 'Глубокая близость, умею в конфликты', 'Опора и пример для других'] },
  'выступл':      { hint: 'опыт сцены', top: 18, tiers: ['Боюсь публики', 'Выступаю с подготовкой', 'Уверенно держу зал', 'Регулярные доклады / лекции', 'Профессиональный спикер'] },
  'оратор':       { hint: 'опыт сцены', top: 18, tiers: ['Боюсь публики', 'Выступаю с подготовкой', 'Уверенно держу зал', 'Регулярные доклады / лекции', 'Профессиональный спикер'] },
  'переговор':    { hint: 'сложность сделок', top: 18, tiers: ['Избегаю', 'Базовые договорённости', 'Уверенно торгуюсь', 'Сложные многосторонние сделки', 'Профессиональный переговорщик'] },
  // Письмо / контент
  'писательств':  { hint: 'объём / публикации', top: 18, tiers: ['Не пишу', 'Пишу для себя', 'Регулярные тексты, есть читатели', 'Публикуюсь / продаю тексты', 'Профессиональный автор'] },
  'копирайт':     { hint: 'клиенты / результат', top: 18, tiers: ['Не пишу', 'Учусь, первые тексты', 'Беру заказы', 'Стабильный поток клиентов', 'Топ-копирайтер / редактор'] },
  'подкаст':      { hint: 'регулярность / аудитория', top: 18, tiers: ['Не веду', 'Первые выпуски', 'Регулярно, есть слушатели', 'Стабильная аудитория / гости', 'Крупный подкаст'] },
  // Практики / тело
  'йог':          { hint: 'глубина практики', top: 18, tiers: ['Не практикую', 'Базовые асаны по видео', 'Регулярная самостоятельная практика', 'Сложные асаны, пранаяма', 'Преподаю / сертифицирован'] },
  'медитац':      { hint: 'регулярность практики', top: 16, tiers: ['Не практикую', 'Иногда 5–10 мин', 'Ежедневная практика', '20–30 мин в потоке', 'Ретриты / углублённая практика'] },
  'готов':        { hint: 'сложность блюд', top: 16, tiers: ['Только базовое', 'Готовлю по рецептам', 'Импровизирую уверенно', 'Сложные блюда / своя кухня', 'Уровень шефа'] },
  'кулинар':      { hint: 'сложность блюд', top: 16, tiers: ['Только базовое', 'Готовлю по рецептам', 'Импровизирую уверенно', 'Сложные блюда / своя кухня', 'Уровень шефа'] },
  'скалолаз':     { hint: 'категория трасс', top: 18, tiers: ['Не лажу', 'Лёгкие трассы в зале', 'Уверенно 6a–6b', 'Сложные 7-е категории', 'Профи / аутдор-мультипитчи'] },
  // Игры / digital
  'шахмат':       { hint: 'рейтинг ELO', top: 18, tiers: ['Знаю правила', 'Играю, ~800–1200', 'Уверенно 1200–1600', '1600–2000', 'Кандидат в мастера / выше'] },
  'геймдев':      { hint: 'выпущенные проекты', top: 20, tiers: ['Не делаю игры', 'Учу движок, прототипы', 'Завершил мелкие проекты', 'Выпустил игру / в команде', 'Профессиональный геймдев'] },
  'моделирован':  { hint: '3D / портфолио', top: 18, tiers: ['Не моделю', 'Базовые формы в Blender', 'Готовые модели', 'Портфолио / фриланс', 'Профессиональный 3D-артист'] },
  'актёр':        { hint: 'сцена / роли', top: 18, tiers: ['Не играю', 'Кружок / любитель', 'Регулярные постановки', 'Заметные роли / съёмки', 'Профессиональный актёр'] },
  'волонт':       { hint: 'регулярность вклада', top: 16, tiers: ['Не участвую', 'Разовые акции', 'Регулярно помогаю', 'Координирую проекты', 'Веду своё движение'] },
};
const GENERIC_LADDER = { hint: 'честная самооценка — сравни с тем, кем был год назад', top: 16, tiers: ['Только начинаю', 'Регулярная практика', 'Уверенный прогресс', 'Могу научить других', 'Глубокая экспертиза'] };
// Ключи матчим от длинных к коротким — специфичное побеждает (иначе «Стартап» цепляет «арт»→рисование, «Рукоделие» цеплял «дел»).
const LADDER_KEYS = Object.keys(IMPORT_LADDERS).sort((a, b) => b.length - a.length);
// Нормализация для русского матчинга: ё→е (юзеры часто пишут «учеба» вместо «учёба» — фидбек #16)
function normRu(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
// Авто-категория (Блок 3): локальная эвристика «слово→сфера» по истории квестов. Без ИИ — мгновенно и бесплатно.
function normTitle(s) { return normRu(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim(); }
// Подсказывает сферу по тому, как юзер раньше категоризировал похожие квесты. → { skillId, score } | null
function guessCategoryFromHistory(title) {
  const q = normTitle(title); if (q.length < 2) return null;
  const words = q.split(' ').filter((w) => w.length >= 3);
  const tally = {};
  const tasks = State.tasks || [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const tt = normTitle(t.title || ''); if (!tt) continue;
    let match = 0;
    if (tt === q) match = 4;                                   // точное совпадение названия
    else if (tt.includes(q) || q.includes(tt)) match = 2;      // одно содержит другое
    else { const tw = new Set(tt.split(' ')); const overlap = words.filter((w) => tw.has(w)).length; if (overlap) match = overlap; }
    if (!match) continue;
    const recency = 1 + i / Math.max(1, tasks.length);          // свежие записи весомее (×1..2)
    const ids = (t.skillIds && t.skillIds.length) ? t.skillIds : (t.skillId ? [t.skillId] : []);
    for (const id of ids) { if (skillById(id).missing) continue; tally[id] = (tally[id] || 0) + match * recency; }
  }
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return ranked.length ? { skillId: ranked[0][0], score: ranked[0][1] } : null;
}
// Обновляет чип-подсказку под полем ввода квеста (вызывается на input)
function updateCatSuggest(inputEl) {
  const form = inputEl.closest('form'); if (!form) return;
  const box = form.parentElement.querySelector('#cat-suggest'); if (!box) return;
  const sel = form.querySelector('select[name="skillId"]');
  const txt = inputEl.value.trim();
  const g = guessCategoryFromHistory(txt);
  if (g && sel && sel.value !== g.skillId) { // локальная эвристика по истории — мгновенно, бесплатно
    box.innerHTML = `<button type="button" class="cat-chip" data-action="apply-cat" data-skill="${esc(g.skillId)}">💡 Обычно сюда: <b>${esc(skillLabel(g.skillId))}</b> · применить</button>`;
  } else if (!g && txt.length >= 4 && aiProvider()) { // нет в истории + есть ключ → предложить спросить ИИ
    box.innerHTML = `<button type="button" class="cat-chip cat-chip-ai" data-action="ai-cat-suggest" data-title="${esc(txt)}">🤖 Подобрать сферу через ИИ</button>`;
  } else { box.innerHTML = ''; }
}
// ИИ-фолбэк авто-категории: для нового названия просим модель выбрать ОДНУ сферу из списка
async function aiCatSuggest(title, box, sel) {
  if (!aiProvider() || !sel) return;
  box.innerHTML = '<span class="cat-chip">🤖 думаю…</span>';
  const names = State.settings.skills.map((s) => skillLabel(s.id));
  const sys = 'Ты подбираешь сферу жизни для задачи в планировщике. Ответь СТРОГО одним точным названием сферы из списка — без кавычек, без пояснений.';
  const prompt = `Сферы (выбери ОДНУ, ровно как в списке):\n${names.join('\n')}\n\nЗадача: «${title}»\n\nОтвет (одно название):`;
  try {
    const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: aiProvider(), system: sys, messages: [{ role: 'user', content: prompt }] }) });
    const d = await r.json();
    const ans = (d.text || '').trim().toLowerCase();
    if (!r.ok || !ans) { box.innerHTML = ''; return; }
    const match = State.settings.skills.find((s) => { const n = normRu(skillLabel(s.id)); return normRu(ans).includes(n) || n.includes(normRu(ans)); })
      || State.settings.skills.find((s) => normRu(ans).includes(normRu(s.name)));
    if (match) { box.innerHTML = `<button type="button" class="cat-chip" data-action="apply-cat" data-skill="${esc(match.id)}">🤖 ИИ: <b>${esc(skillLabel(match.id))}</b> · применить</button>`; track('ai:catsuggest'); }
    else box.innerHTML = '<span class="cat-chip muted">ИИ не подобрал — выбери вручную</span>';
  } catch { box.innerHTML = ''; }
}
function ladderFor(skillName) {
  const n = normRu(skillName);
  for (const key of LADDER_KEYS) if (n.includes(normRu(key))) return IMPORT_LADDERS[key];
  return GENERIC_LADDER;
}
// Целевой уровень для каждого тира (tier 0 → ур.1; верхний → ladder.top)
function tierLevels(ladder) { const n = ladder.tiers.length, top = ladder.top || 16; return ladder.tiers.map((_, i) => (i === 0 ? 1 : Math.round(1 + (top - 1) * i / (n - 1)))); }

const AVATARS = ['⚡','⚔️','🔥','🌟','🎯','🚀','💎','🐉','🦊','🐺','🌙','☀️','🎭','🎸','🏆','🦁'];

const State = {
  // auth
  me: null,           // { id, name, avatar, isAdmin } | null
  profiles: [],       // [{ id, name, avatar }] для экрана логина
  phase: 'boot',      // 'boot' | 'login' | 'register' | 'onboarding' | 'app'
  selectedProfile: null,
  obSkills: new Set(), // выбранные шаблоны на онбординге
  // app data
  settings: null, tasks: null, days: null, habits: null, habitlog: null,
  goals: null, tree: null, rewards: null, purchases: null, achievements: null, weeks: null,
  lootbox: null, inbox: null, inboxOpen: false, antihabits: null, aiKeys: null,
  chatLog: [], _chatBusy: false,
  leaderboard: null, _lbLoading: false,
  adminUsers: null, _adminUsersLoading: false,
  timer: null, view: 'today', treeSkill: null, weekStart: null, goalFilter: 'all', wkAddDate: null, calDate: null, calMode: 'day',
  aveCat: 'hair', // активная категория в редакторе аватара
  treeEdit: false, treeSelNode: null, // редактор дерева навыков
  settingsCollapsed: {}, // свёрнутые столбы в редакторе сфер
};

// ============================================================
//  Утилиты
// ============================================================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// Приватный трекинг активности (#4): шлём ТОЛЬКО имя события (без личного контента). Дедуп частых.
const _lastTrack = {};
function track(event) {
  try {
    const now = Date.now();
    if (_lastTrack[event] && now - _lastTrack[event] < 2000) return;
    _lastTrack[event] = now;
    fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) });
  } catch {}
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
function dmShort(s) { return s.slice(8) + '.' + s.slice(5, 7); }
function fmtClock(ms) { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`; }
function fmtDur(min) { const m = Math.max(0, Math.round(Number(min) || 0)); if (m < 60) return m + 'м'; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}ч ${r}м` : `${h}ч`; }
function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; }
function skillById(id) { return State.settings.skills.find((s) => s.id === id) || { id, name: '—', color: '#888', missing: true }; }
// ── Иерархия сфер (импорт v2.2): под-навыки через parentId. 2 уровня: столб → под-навык.
function childSkills(id) { return State.settings.skills.filter((s) => s.parentId === id); }
function isPillar(id) { return childSkills(id).length > 0; }            // столб = есть под-навыки
function topSkills() { return State.settings.skills.filter((s) => !s.parentId); } // верхний уровень
function leafSkills() { return State.settings.skills.filter((s) => !isPillar(s.id)); } // листья (для атрибутов/формы)
// Все потомки сферы на любую глубину (иерархия N уровней: Учёба → Школа → Bio LK)
function descendantSkills(id) {
  const out = [], seen = new Set();
  const walk = (pid, depth) => { if (depth > 6) return; for (const c of childSkills(pid)) { if (seen.has(c.id)) continue; seen.add(c.id); out.push(c); walk(c.id, depth + 1); } };
  walk(id, 0); return out;
}
function skillDepth(id) { let d = 0, cur = skillById(id), g = 0; while (cur && cur.parentId && g++ < 8) { d++; cur = State.settings.skills.find((x) => x.id === cur.parentId); } return d; }
function skillLabel(id) {
  const parts = []; let cur = State.settings.skills.find((x) => x.id === id), g = 0;
  while (cur && g++ < 8) { parts.unshift(cur.name); cur = cur.parentId ? State.settings.skills.find((x) => x.id === cur.parentId) : null; }
  return parts.length ? parts.join(' › ') : id;
}
// Опции <select> в иерархическом порядке: столб, затем его под-навыки («Столб › Под»)
function skillOptionsHTML(sel) {
  let html = '';
  const walk = (parentId, chain, depth) => {
    if (depth > 6) return;
    for (const s of State.settings.skills.filter((x) => (x.parentId || null) === parentId)) {
      html += `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc([...chain, s.name].join(' › '))}${isPillar(s.id) ? ' (общее)' : ''}</option>`;
      walk(s.id, [...chain, s.name], depth + 1);
    }
  };
  walk(null, [], 0);
  return html;
}
function questById(id) { return State.tasks.find((t) => t.id === id); }
function habitById(id) { return State.habits.find((h) => h.id === id); }
function goalById(id) { return State.goals.find((g) => g.id === id); }
function dayOf(t) { return t.completedAt ? fmtDate(new Date(t.completedAt)) : t.date; } // локальная дата (не UTC-срез) — консистентно с todayStr()

// ---- Опыт, золото, уровни, перки ----
function needForLevel(level, base, growth) { return Math.round(base * Math.pow(growth, level - 1)); }
// Сколько суммарного XP нужно, чтобы достичь уровня L (старт уровня L)
function xpForLevel(L, base, growth) { let xp = 0; for (let k = 1; k < L; k++) xp += needForLevel(k, base, growth); return xp; }
function levelInfo(totalXp, base, growth) {
  let level = 1, remaining = Math.max(0, Math.floor(totalXp)), need = needForLevel(level, base, growth);
  while (remaining >= need) { remaining -= need; level++; need = needForLevel(level, base, growth); }
  return { level, into: remaining, need, pct: need ? Math.round((remaining / need) * 100) : 0 };
}
function skillPerkBonus(id) { const t = State.tree && State.tree[id]; if (!t) return 0; return t.nodes.filter((n) => n.unlocked).reduce((s, n) => s + (n.perkXpPct || 0), 0); }
function lootBoostPct() { const b = State.lootbox && State.lootbox.boost; if (b && new Date(b.until).getTime() > Date.now()) return b.pct || 0; return 0; }

// ── Хайп: временный XP-бафф за ДОБРОВОЛЬНЫЙ выбор сложных квестов (идея 26).
//    Философия «лезь в сложное» — челлендж компаундится. Хранится в lootbox (уже персист).
const HYPE_PER_STACK = 15, HYPE_MAX_STACKS = 3, HYPE_DURATION_MS = 2 * 3600 * 1000;
function hypeState() { const h = State.lootbox && State.lootbox.hype; if (h && h.stacks > 0 && new Date(h.until).getTime() > Date.now()) return h; return null; }
function hypePct() { const h = hypeState(); return h ? Math.min(HYPE_MAX_STACKS, h.stacks) * HYPE_PER_STACK : 0; }
function hypeMinLeft() { const h = hypeState(); return h ? Math.max(0, Math.ceil((new Date(h.until).getTime() - Date.now()) / 60000)) : 0; }
function activateHype() {
  const lb = ensureLootbox(), cur = hypeState();
  lb.hype = { stacks: Math.min(HYPE_MAX_STACKS, (cur ? cur.stacks : 0) + 1), until: new Date(Date.now() + HYPE_DURATION_MS).toISOString() };
  Store.save('lootbox', lb); return lb.hype;
}
const GRIT_BONUS = 0.10; // бонус за выполнение «через силу» — признание воли, но меньше Хайпа
// Завершить квест с учётом «желания» (desire): null | 'forced' | 'neutral' | 'hyped'
function completeTask(t, desire) {
  if (State.timer && State.timer.taskId === t.id) stopFocus(true, true);
  const lvlBefore = charLevel();
  t.done = true; t.completedAt = new Date().toISOString(); t.desire = desire || null;
  let xp = itemXp(t);
  if (desire === 'forced') xp = Math.round(xp * (1 + GRIT_BONUS));
  t.xpAwarded = Math.max(1, xp); t.goldAwarded = itemGold(t);
  const eDelta = applyEnergy(t, desire);
  let msg = `+${t.xpAwarded} XP · +${t.goldAwarded} 🪙 · ${skillById(t.skillId).name}`;
  if (desire === 'forced') msg += ` · 💪 через силу +${Math.round(GRIT_BONUS * 100)}% XP, но −энергия`;
  if (eDelta) msg += ` · ${eDelta > 0 ? '+' : ''}${eDelta} 🔋`;
  toast(msg);
  if (desire === 'hyped') { const h = activateHype(); toast(`⚔️ Хайп ×${h.stacks} · +${hypePct()}% XP на ${hypeMinLeft()} мин — ты захотел трудное!`); }
  track('complete:quest');
  Store.save('tasks', State.tasks);
  if (charLevel() > lvlBefore) sfx('levelup'); else sfx('complete'); // #23 звук: левелап важнее завершения
  checkAchievements(); render(); publishLeaderboard();
}
// Поп-ап выбора желания при завершении сложного квеста
function openDesirePicker(taskId) {
  if (document.getElementById('desire-pop')) return;
  const t = questById(taskId); if (!t) return;
  const ov = document.createElement('div'); ov.id = 'desire-pop'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="desire-box">
    <button class="modal-x" data-action="desire-cancel">✕</button>
    <h3>Насколько ты хотел это сделать?</h3>
    <p class="muted">🔥 «${esc(t.title)}» — сложный квест. Честный ответ влияет на XP и на твою 🔋 энергию.</p>
    <div class="desire-btns">
      <button class="desire-opt forced" data-action="desire-pick" data-id="${t.id}" data-desire="forced"><span class="d-emoji">😮‍💨</span><b>Через силу</b><small>+${Math.round(GRIT_BONUS * 100)}% XP · −энергия ×1.5</small></button>
      <button class="desire-opt neutral" data-action="desire-pick" data-id="${t.id}" data-desire="neutral"><span class="d-emoji">🙂</span><b>Нормально</b><small>обычный XP и энергия</small></button>
      <button class="desire-opt hyped" data-action="desire-pick" data-id="${t.id}" data-desire="hyped"><span class="d-emoji">⚔️</span><b>В кураже!</b><small>🔥 Хайп · энергии тратит меньше</small></button>
    </div>
    <p class="desire-sci muted">Воля против сопротивления истощает сильнее (ego depletion), поток — меньше (flow). Поэтому здоровая середина устойчивее, чем вечный форсаж.</p></div>`;
  document.body.appendChild(ov);
}
// Поп-ап выбора нескольких категорий для квеста (иллюстрация = работа + творчество)
function openCategoryPicker(taskId) {
  if (document.getElementById('cat-pop')) return;
  const t = questById(taskId); if (!t) return;
  const ids = taskSkills(t);
  const opt = (s, depth) => {
    const checked = ids.includes(s.id);
    return `<label class="cat-opt ${depth ? 'is-sub' : ''}" style="padding-left:${10 + depth * 18}px"><input type="checkbox" data-action="toggle-cat" data-id="${t.id}" data-skill="${s.id}" ${checked ? 'checked' : ''}/><span class="t-cat" style="--c:${esc(s.color)}">${depth ? '↳ ' : ''}${esc(s.name)}</span></label>`;
  };
  // Полная иерархия любой глубины (Учёба › Школа › Математика) — фидбек #19
  let list = '';
  const walk = (parentId, depth) => { if (depth > 6) return; for (const s of State.settings.skills.filter((x) => (x.parentId || null) === parentId)) { list += opt(s, depth); walk(s.id, depth + 1); } };
  walk(null, 0);
  const ov = document.createElement('div'); ov.id = 'cat-pop'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="desire-box"><button class="modal-x" data-action="close-cats">✕</button>
    <h3>Категории квеста</h3>
    <p class="muted">«${esc(t.title)}» · отметь все подходящие сферы. Опыт делится между ними поровну. Первая — основная.</p>
    <div class="cat-list">${list}</div>
    <div class="settings-actions" style="margin-top:14px"><button class="btn" data-action="close-cats">Готово</button></div></div>`;
  document.body.appendChild(ov);
}

function itemXp(it) {
  const xp = State.settings.xp, mult = xp.difficulty[it.difficulty] ?? 1;
  const base = (Number(it.estimateMin) || 0) * xp.perMinute * mult + xp.completionBonus;
  return Math.max(1, Math.round(base * (1 + skillPerkBonus(it.skillId) / 100) * (1 + lootBoostPct() / 100) * (1 + hypePct() / 100)));
}
function itemGold(it) {
  const g = State.settings.gold || DEFAULT_SETTINGS.gold, mult = State.settings.xp.difficulty[it.difficulty] ?? 1;
  return Math.max(1, Math.round((Number(it.estimateMin) || 0) * g.perMinute * mult) + g.completionBonus);
}

// ---- Единый поток событий (квесты + привычки + цели) ----
// Категории квеста: массив id сфер. Back-compat: старые задачи с одним skillId.
function taskSkills(t) { return (t.skillIds && t.skillIds.length) ? t.skillIds : (t.skillId ? [t.skillId] : []); }
// Делёж целого числа на n частей без потерь: часть i (остаток уходит первым частям/основной сфере).
function shareInt(total, n, i) { const base = Math.floor(total / n); return base + (i < (total % n) ? 1 : 0); }
function xpEvents() {
  const ev = [];
  for (const t of State.tasks) if (t.done) {
    const ids = taskSkills(t), n = ids.length || 1;
    const xp = t.xpAwarded || 0, gold = t.goldAwarded || 0, min = Number(t.actualMin || t.estimateMin) || 0;
    if (n <= 1) { ev.push({ date: dayOf(t), skillId: ids[0] || t.skillId || null, xp, gold, min }); }
    else ids.forEach((sid, i) => ev.push({ date: dayOf(t), skillId: sid, xp: shareInt(xp, n, i), gold: shareInt(gold, n, i), min: shareInt(min, n, i) }));
  }
  const log = State.habitlog || {};
  for (const date in log) for (const hid in log[date]) { const rec = log[date][hid], h = habitById(hid); ev.push({ date, skillId: h ? h.skillId : null, xp: rec.xp || 0, gold: rec.gold || 0, min: rec.min || 0 }); }
  for (const g of State.goals || []) if (g.completedAt) { const xp = g.xpReward != null ? g.xpReward : GOAL_BONUS.xp; ev.push({ date: fmtDate(new Date(g.completedAt)), skillId: g.skillId, xp, gold: Math.round(xp * 0.35), min: 0 }); }
  return ev;
}
function doneTasks() { return State.tasks.filter((t) => t.done); }
// Для календарных ачивок: моменты выполнения и группировка событий по дню
function completedTimes() { return doneTasks().map((t) => t.completedAt ? new Date(t.completedAt) : null).filter(Boolean); }
function eventsByDay() { const m = {}; for (const e of xpEvents()) (m[e.date] = m[e.date] || []).push(e); return m; }
// Импортированный «стартовый» XP (доказанное мастерство) — добавляется к заработанному
function importedXp(id) { const im = State.settings && State.settings.imported; return (im && im[id] && im[id].xp) || 0; }
function totalImportedXp() { const im = (State.settings && State.settings.imported) || {}; return Object.keys(im).reduce((s, k) => s + (im[k].xp || 0), 0); }
function earnedXp() { return xpEvents().reduce((s, e) => s + e.xp, 0); } // только заработанное в приложении (для честного лидерборда)
function overallXp() { return earnedXp() + totalImportedXp(); }
function ownSkillXp(id) { return xpEvents().reduce((s, e) => s + (e.skillId === id ? e.xp : 0), 0) + importedXp(id); }
// XP сферы. Для столба = собственный + сумма ВСЕХ потомков (агрегация вверх по дереву любой глубины).
function skillXp(id) { let xp = ownSkillXp(id); for (const c of descendantSkills(id)) xp += ownSkillXp(c.id); return xp; }
function goldEarned() { return xpEvents().reduce((s, e) => s + e.gold, 0) + (State.lootbox ? (State.lootbox.goldWon || 0) : 0); }
function goldSpent() { return (State.purchases || []).reduce((s, p) => s + (p.cost || 0), 0); }
function goldBalance() { return Math.round(goldEarned() - goldSpent()); }
// ── Форма / Momentum (импорт v2): «свежесть» по активности. НЕ трогает уровень (Proven).
//    Уровень — доказанное мастерство (не сгорает). Форма мягко падает без тренировок и легко возвращается.
const FORM_FLOOR = 25, FORM_FRESH = 3, FORM_DECAY = 21;
function skillLastActive(id) { let last = null; for (const e of xpEvents()) if (e.skillId === id && e.date && (!last || e.date > last)) last = e.date; return last; }
function daysSinceDate(dateStr) { if (!dateStr) return Infinity; const d = new Date(dateStr + 'T00:00:00'); return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)); }
function skillForm(id) {
  const last = skillLastActive(id);
  if (!last) return null; // ещё не тренировалось в приложении
  const ds = daysSinceDate(last);
  if (ds <= FORM_FRESH) return 100;
  return Math.round(Math.max(FORM_FLOOR, Math.min(100, 100 - ((ds - FORM_FRESH) / FORM_DECAY) * (100 - FORM_FLOOR))));
}
function overallForm() { const v = leafSkills().map((s) => skillForm(s.id)).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
function formMeta(f) {
  if (f == null) return { text: 'разогрей', color: 'var(--muted)' };
  if (f >= 80) return { text: 'в форме', color: 'var(--good)' };
  if (f >= 55) return { text: 'в тонусе', color: 'var(--accent)' };
  if (f >= 38) return { text: 'расслабленно', color: 'var(--warn)' };
  return { text: 'подзаржавел', color: 'var(--bad)' };
}
function charLevel() { const c = State.settings.curve; return levelInfo(overallXp(), c.base, c.growth).level; }
function skillLevelOf(id) { const c = State.settings.curve; return levelInfo(skillXp(id), c.skillBase, c.growth).level; }

// ---- Ранги и мастерство ----
const RANKS = [
  { name: 'Новичок',     min: 1,  color: '#8b97b5', icon: '🌱' },
  { name: 'Ученик',      min: 3,  color: '#5fbf7a', icon: '📗' },
  { name: 'Адепт',       min: 6,  color: '#4f9ff7', icon: '🔷' },
  { name: 'Эксперт',     min: 10, color: '#7c6cff', icon: '⚜️' },
  { name: 'Мастер',      min: 16, color: '#b06ff0', icon: '🔮' },
  { name: 'Грандмастер', min: 24, color: '#e0a23e', icon: '👑' },
  { name: 'Легенда',     min: 34, color: '#e0526a', icon: '🏆' },
];
function rankFor(level) { let r = RANKS[0]; for (const x of RANKS) if (level >= x.min) r = x; return r; }
function rankProgress(level) {
  const idx = RANKS.reduce((a, x, i) => (level >= x.min ? i : a), 0);
  const cur = RANKS[idx], next = RANKS[idx + 1];
  if (!next) return { pct: 100, cur, next: null, toNext: 0 };
  const span = next.min - cur.min, into = level - cur.min;
  return { pct: Math.max(0, Math.min(100, Math.round((into / span) * 100))), cur, next, toNext: next.min - level };
}
function skillRank(id) { return rankFor(skillLevelOf(id)); }
function charRank() { return rankFor(charLevel()); }

// ---- Индекс баланса (философия десятиборья: ценим композицию, а не одну вертикаль) ----
function balanceIndex() {
  const skills = topSkills(); // баланс по крупным жизненным сферам (столбы агрегируют под-навыки)
  const xps = skills.map((s) => skillXp(s.id));
  const active = xps.filter((x) => x > 0);
  if (active.length < 2) return { index: 0, active: active.length, total: skills.length, weakest: null, strongest: null };
  const mean = active.reduce((a, b) => a + b, 0) / active.length;
  const variance = active.reduce((a, x) => a + (x - mean) ** 2, 0) / active.length;
  const cv = Math.sqrt(variance) / (mean || 1);
  const evenness = Math.max(0, 1 - cv);            // 1 = идеально равномерно
  const coverage = active.length / Math.max(1, skills.length); // охват сфер
  const index = Math.max(0, Math.min(100, Math.round(evenness * 70 + coverage * 30)));
  // самая отстающая активная сфера — куда направить внимание
  const pairs = skills.map((s) => ({ s, xp: skillXp(s.id) })).filter((p) => p.xp > 0).sort((a, b) => a.xp - b.xp);
  return { index, active: active.length, total: skills.length, weakest: pairs[0] ? pairs[0].s : null, strongest: pairs[pairs.length - 1] ? pairs[pairs.length - 1].s : null };
}

// ---- Подписка / Pro ----
function ent() { return (State.me && State.me.entitlement) || { tier: 'free' }; }
function isPro() { const t = ent().tier; return t === 'pro' || t === 'trial'; }
function trialDaysLeft() { const e = ent(); if (e.tier !== 'trial' || !e.trialEndsAt) return 0; return Math.max(0, Math.ceil((new Date(e.trialEndsAt).getTime() - Date.now()) / 86400000)); }

// ---- Атрибуты персонажа (выводятся из сфер жизни) ----
const ATTRIBUTES = [
  { id: 'str', name: 'Сила',         icon: '💪', color: '#e0526a', hint: 'силовые, мышцы, тело' },
  { id: 'end', name: 'Выносливость', icon: '🫁', color: '#5fbf7a', hint: 'здоровье, кардио, сон, питание' },
  { id: 'int', name: 'Интеллект',    icon: '🧠', color: '#4f86f7', hint: 'учёба, языки, чтение, код' },
  { id: 'spr', name: 'Дух',          icon: '🧘', color: '#b06ff0', hint: 'эмоции, медитация, психология' },
  { id: 'cha', name: 'Харизма',      icon: '✨', color: '#e0a23e', hint: 'общение, творчество, видео' },
  { id: 'dis', name: 'Дисциплина',   icon: '⚙️', color: '#22c1a4', hint: 'финансы, быт, бизнес, привычки' },
];
function attrById(id) { return ATTRIBUTES.find((a) => a.id === id) || ATTRIBUTES[5]; }
function guessAttr(name) {
  const n = normRu(name); // ё→е, чтобы «учеба»/«учёба» матчились одинаково
  if (/спорт|сил|качал|штанг|жим|мыш|workout|gym|подтяг|отжим|кросфит|кроссфит/.test(n)) return 'str';
  if (/бег|вынослив|кардио|велик|плав|run|марафон|ходьб|дыхан|поход|здоров|питани|нутриц|диет|сон/.test(n)) return 'end';
  if (/уч[её]б|программ|код|чтени|книг|англ|немецк|deutsch|язык|наук|study|math|школ|универ|интеллект|шахмат/.test(n)) return 'int';
  if (/медит|дух|психо|релакс|йог|вер|осознан|благодар|ментал|эмоц/.test(n)) return 'spr';
  if (/отношен|блог|общени|социал|харизм|выступл|видео|музык|творч|друз|свидан|рисов|арт|иллюстр|дизайн|фото|танц|пени|вокал/.test(n)) return 'cha';
  if (/быт|дисциплин|финанс|план|привыч|работа|бизнес|порядок|деньг|инвест|стартап|предприн/.test(n)) return 'dis';
  return 'dis';
}
// Атрибуты считаем по листьям (под-навыки + одиночные), чтобы не дублировать со столбами.
// Маппинг сфера→атрибут полностью автоматический (guessAttr) — атрибуты живут только для архетипа и силуэта.
function attrScore(attrId) { return leafSkills().filter((s) => guessAttr(s.name) === attrId).reduce((sum, s) => sum + skillLevelOf(s.id), 0); }
function attrScores() { return ATTRIBUTES.map((a) => Object.assign({}, a, { value: attrScore(a.id) })); }
// Оси радара = собственные крупные сферы юзера (его личное «десятиборье»), а не абстрактные атрибуты.
// При >8 сферах берём самые прокачанные, но сохраняем порядок из настроек (оси не скачут).
function sphereScores() {
  let list = topSkills();
  if (list.length > 8) list = [...list].sort((a, b) => skillXp(b.id) - skillXp(a.id)).slice(0, 8)
    .sort((a, b) => State.settings.skills.indexOf(a) - State.settings.skills.indexOf(b));
  return list.map((s) => ({ id: s.id, name: s.name, color: s.color, value: skillLevelOf(s.id) }));
}
function archetype() {
  const sorted = attrScores().filter((a) => a.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length === 0) return { name: 'Искатель', desc: 'Путь только начинается' };
  const top = sorted.slice(0, 2).map((a) => a.id).sort().join('+');
  const MAP = {
    'end+str': 'Атлет', 'dis+str': 'Воин дисциплины', 'int+str': 'Боевой маг', 'spr+str': 'Монах', 'cha+str': 'Герой',
    'end+int': 'Биохакер', 'dis+end': 'Марафонец воли', 'cha+end': 'Энерджайзер', 'end+spr': 'Странник',
    'dis+int': 'Стратег', 'int+spr': 'Мудрец', 'cha+int': 'Просветитель', 'dis+spr': 'Хранитель',
    'cha+spr': 'Вдохновитель', 'cha+dis': 'Лидер',
  };
  const single = { str: 'Силач', end: 'Бегун', int: 'Учёный', spr: 'Аскет', cha: 'Душа компании', dis: 'Машина воли' };
  return { name: MAP[top] || single[sorted[0].id] || 'Многогранник', desc: `${sorted[0].name}${sorted[1] ? ' + ' + sorted[1].name : ''}` };
}
function bodyBMI() { const b = State.settings.body || {}; if (!b.height || !b.weight) return null; return b.weight / ((b.height / 100) ** 2); }

// ---- SVG: радар сфер (личное десятиборье) + схематичное телосложение ----
function radarSVG(scores) {
  const cx = 140, cy = 140, R = 88, n = scores.length, max = Math.max(3, ...scores.map((s) => s.value));
  const pt = (i, r) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; };
  let grid = '';
  for (let g = 1; g <= 3; g++) { const poly = scores.map((_, i) => pt(i, R * g / 3).join(',')).join(' '); grid += `<polygon points="${poly}" fill="none" stroke="var(--line)" stroke-width="1"/>`; }
  let axes = '', labels = '';
  scores.forEach((s, i) => {
    const [x, y] = pt(i, R); axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`;
    const [lx, ly] = pt(i, R + 18);
    const txt = s.icon || esc(s.name.length > 11 ? s.name.slice(0, 10) + '…' : s.name);
    labels += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="${s.icon ? 15 : 10.5}" ${s.icon ? '' : `fill="${esc(s.color)}" font-weight="600"`}>${txt}</text>`;
  });
  const dpoly = scores.map((s, i) => pt(i, R * Math.min(1, s.value / max)).join(',')).join(' ');
  const dots = scores.map((s, i) => { const [x, y] = pt(i, R * Math.min(1, s.value / max)); return `<circle cx="${x}" cy="${y}" r="3.5" fill="${s.color}"/>`; }).join('');
  return `<svg viewBox="0 0 280 280" class="radar"><defs><radialGradient id="radg"><stop offset="0%" stop-color="rgba(108,140,255,.35)"/><stop offset="100%" stop-color="rgba(108,140,255,.08)"/></radialGradient></defs>${grid}${axes}<polygon points="${dpoly}" fill="url(#radg)" stroke="var(--accent)" stroke-width="2"/>${dots}${labels}</svg>`;
}
function figureSVG() {
  const str = attrScore('str'), end = attrScore('end'), bmi = bodyBMI(), cr = charRank();
  const sex = (State.settings.body || {}).sex || '';
  const sh = (sex === 'f' ? 20 : 24) + Math.min(20, str * (sex === 'f' ? 1.2 : 1.6)); // плечи растут от силы; женский силуэт — уже
  const wa0 = Math.max(11, 15 + (bmi ? Math.max(0, (bmi - 21)) * 1.7 : 0) - Math.min(5, end * 0.35)); // талия от BMI, минус выносливость
  const hip = sex === 'f' ? wa0 + 7 : wa0;                                   // женский силуэт — шире бёдра
  const limb = 6 + Math.min(7, str * 0.5);                                  // толщина конечностей
  const cx = 70, c = cr.color, wa = hip;
  const torso = `${cx - sh},58 ${cx + sh},58 ${cx + wa},132 ${cx - wa},132`;
  return `<svg viewBox="0 0 140 230" class="figure">
    <ellipse cx="${cx}" cy="120" rx="${56 + charLevel() * 0.6}" ry="86" fill="${c}" opacity="0.07"/>
    <circle cx="${cx}" cy="30" r="15" fill="none" stroke="${c}" stroke-width="3"/>
    <polygon points="${torso}" fill="${c}" opacity="0.18" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="${cx - sh + 3}" y1="62" x2="${cx - sh - 8}" y2="118" stroke="${c}" stroke-width="${limb}" stroke-linecap="round"/>
    <line x1="${cx + sh - 3}" y1="62" x2="${cx + sh + 8}" y2="118" stroke="${c}" stroke-width="${limb}" stroke-linecap="round"/>
    <line x1="${cx - wa + 4}" y1="132" x2="${cx - wa - 2}" y2="206" stroke="${c}" stroke-width="${limb + 2}" stroke-linecap="round"/>
    <line x1="${cx + wa - 4}" y1="132" x2="${cx + wa + 2}" y2="206" stroke="${c}" stroke-width="${limb + 2}" stroke-linecap="round"/>
  </svg>`;
}
// ============================================================
//  Кастомизируемый аватар — послойный flat-vector SVG.
//  Каждая часть = генератор. Арт-наборы художника подключаются как новые варианты/слои.
// ============================================================
const AV_SKINS  = ['#f7d4b6', '#eebd95', '#dca579', '#c08a5e', '#9c6a45', '#6e482e'];
const AV_HAIRC  = ['#15110f', '#3b2a1d', '#5e3f25', '#8a5a2b', '#b6863f', '#dcc06a', '#9aa3ad', '#d65a5a', '#7c5cff', '#f0f0f0'];
const AV_CLOTH  = ['#6c8cff', '#46c46b', '#e0526a', '#e0a23e', '#b06ff0', '#22c1a4', '#39414f'];
const AV_PARTS  = {
  face:      { label: 'Лицо',       n: 3 },
  skin:      { label: 'Кожа',       colors: AV_SKINS },
  hair:      { label: 'Причёска',   n: 7 },
  hairColor: { label: 'Цвет волос', colors: AV_HAIRC },
  brows:     { label: 'Брови',      n: 3 },
  eyes:      { label: 'Глаза',      n: 4 },
  mouth:     { label: 'Рот',        n: 4 },
  beard:     { label: 'Борода',     n: 3 },
  glasses:   { label: 'Очки',       n: 3 },
  cloth:     { label: 'Одежда',     colors: AV_CLOTH },
};
const AV_CAT_ORDER = ['hair', 'hairColor', 'face', 'skin', 'eyes', 'brows', 'mouth', 'beard', 'glasses', 'cloth'];
function defaultAvatar() { return { face: 0, skin: 1, hair: 1, hairColor: 1, brows: 0, eyes: 0, mouth: 0, beard: 0, glasses: 0, cloth: 0 }; }
function avCfg() { return Object.assign(defaultAvatar(), (State.settings && State.settings.avatar) || {}); }
function shade(hex, amt) { // amt -100..100 (минус = темнее)
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt) / 100;
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function avatarSVG(cfg, opts = {}) {
  cfg = Object.assign(defaultAvatar(), cfg);
  const skin = AV_SKINS[cfg.skin] || AV_SKINS[1];
  const sd = shade(skin, -14), hair = AV_HAIRC[cfg.hairColor] || AV_HAIRC[1];
  const cloth = AV_CLOTH[cfg.cloth] || AV_CLOTH[0];
  const cx = 120;
  const faces = [{ rx: 56, ry: 62, cy: 116 }, { rx: 50, ry: 65, cy: 118 }, { rx: 60, ry: 57, cy: 114 }];
  const F = faces[cfg.face] || faces[0], cy = F.cy, rx = F.rx, ry = F.ry;
  const eyeY = cy + 2, eyeDX = rx * 0.44, browY = eyeY - 15, mouthY = cy + ry * 0.52;
  // ---- части ----
  const ear = `<ellipse cx="${cx - rx + 3}" cy="${cy + 8}" rx="9" ry="12" fill="${skin}"/><ellipse cx="${cx + rx - 3}" cy="${cy + 8}" rx="9" ry="12" fill="${skin}"/>`;
  const neck = `<path d="M${cx - 15} ${cy + ry - 14} h30 v22 q0 8 -15 8 q-15 0 -15 -8 z" fill="${sd}"/>`;
  const shoulders = `<path d="M${cx - 78} 240 Q ${cx - 70} 184 ${cx} 182 Q ${cx + 70} 184 ${cx + 78} 240 Z" fill="${cloth}"/><path d="M${cx - 16} 184 Q ${cx} 200 ${cx + 16} 184 L ${cx + 16} 196 Q ${cx} 206 ${cx - 16} 196 Z" fill="${shade(cloth, -16)}"/>`;
  const head = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>`;
  // глаза
  const eye = (ex) => {
    const E = cfg.eyes;
    if (E === 1) return `<path d="M${ex - 8} ${eyeY} Q ${ex} ${eyeY - 6} ${ex + 8} ${eyeY} Q ${ex} ${eyeY + 5} ${ex - 8} ${eyeY} Z" fill="#fff"/><circle cx="${ex}" cy="${eyeY}" r="4" fill="#3a2a20"/>`;
    if (E === 2) return `<circle cx="${ex}" cy="${eyeY}" r="8" fill="#fff"/><circle cx="${ex}" cy="${eyeY}" r="5.5" fill="#3a2a20"/><circle cx="${ex + 2}" cy="${eyeY - 2}" r="1.6" fill="#fff"/>`;
    if (E === 3) return `<path d="M${ex - 8} ${eyeY} q 8 7 16 0" stroke="#3a2a20" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return `<ellipse cx="${ex}" cy="${eyeY}" rx="6.5" ry="7.5" fill="#fff"/><circle cx="${ex}" cy="${eyeY + 0.5}" r="4" fill="#3a2a20"/><circle cx="${ex + 1.5}" cy="${eyeY - 1.5}" r="1.4" fill="#fff"/>`;
  };
  const eyes = eye(cx - eyeDX) + eye(cx + eyeDX);
  // брови
  const brow = (bx, dir) => {
    const B = cfg.brows;
    if (B === 1) return `<path d="M${bx - 9} ${browY + 2} Q ${bx} ${browY - 4} ${bx + 9} ${browY + 2}" stroke="${shade(hair, -10)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    if (B === 2) return `<rect x="${bx - 9}" y="${browY - 2}" width="18" height="4.5" rx="2.2" fill="${shade(hair, -10)}"/>`;
    return `<path d="M${bx - 9} ${browY} L ${bx + 9} ${browY - (dir * 2)}" stroke="${shade(hair, -10)}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  };
  const brows = brow(cx - eyeDX, 1) + brow(cx + eyeDX, -1);
  // нос
  const nose = `<path d="M${cx} ${cy + 4} q -4 12 -1 15 q 2 1.5 5 0.5" stroke="${sd}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  // рот
  let mouth;
  if (cfg.mouth === 1) mouth = `<line x1="${cx - 12}" y1="${mouthY}" x2="${cx + 12}" y2="${mouthY}" stroke="#9c5247" stroke-width="3" stroke-linecap="round"/>`;
  else if (cfg.mouth === 2) mouth = `<path d="M${cx - 15} ${mouthY - 2} Q ${cx} ${mouthY + 14} ${cx + 15} ${mouthY - 2} Z" fill="#8e4038"/><path d="M${cx - 12} ${mouthY} Q ${cx} ${mouthY + 4} ${cx + 12} ${mouthY}" fill="#fff"/>`;
  else if (cfg.mouth === 3) mouth = `<path d="M${cx - 9} ${mouthY} Q ${cx} ${mouthY + 7} ${cx + 9} ${mouthY}" stroke="#9c5247" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  else mouth = `<path d="M${cx - 15} ${mouthY - 1} Q ${cx} ${mouthY + 13} ${cx + 15} ${mouthY - 1}" stroke="#9c5247" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  // борода
  let beard = '';
  if (cfg.beard === 1) beard = `<path d="M${cx - rx + 4} ${cy} Q ${cx - rx} ${cy + ry} ${cx} ${cy + ry + 1} Q ${cx + rx} ${cy + ry} ${cx + rx - 4} ${cy} Q ${cx} ${cy + ry * 0.5} ${cx - rx + 4} ${cy} Z" fill="${hair}" opacity="0.32"/>`;
  else if (cfg.beard === 2) beard = `<path d="M${cx - rx + 2} ${cy - 4} Q ${cx - rx} ${cy + ry + 4} ${cx} ${cy + ry + 6} Q ${cx + rx} ${cy + ry + 4} ${cx + rx - 2} ${cy - 4} Q ${cx} ${cy + ry * 0.62} ${cx - rx + 2} ${cy - 4} Z" fill="${hair}"/>`;
  // волосы (back + front)
  const hairParts = avHair(cfg.hair, cx, cy, rx, ry, hair);
  // очки
  let glasses = '';
  if (cfg.glasses) {
    const lens = cfg.glasses === 1
      ? `<circle cx="${cx - eyeDX}" cy="${eyeY}" r="11" fill="none" stroke="#2a3250" stroke-width="2.6"/><circle cx="${cx + eyeDX}" cy="${eyeY}" r="11" fill="none" stroke="#2a3250" stroke-width="2.6"/>`
      : `<rect x="${cx - eyeDX - 11}" y="${eyeY - 9}" width="22" height="18" rx="4" fill="none" stroke="#2a3250" stroke-width="2.6"/><rect x="${cx + eyeDX - 11}" y="${eyeY - 9}" width="22" height="18" rx="4" fill="none" stroke="#2a3250" stroke-width="2.6"/>`;
    glasses = lens + `<line x1="${cx - eyeDX + 11}" y1="${eyeY}" x2="${cx + eyeDX - 11}" y2="${eyeY}" stroke="#2a3250" stroke-width="2.6"/>`;
  }
  const bg = opts.bg ? `<rect x="0" y="0" width="240" height="240" fill="${opts.bg}"/>` : '';
  // косметическая рамка (кольцо по краю) — дроп из сундуков
  const fr = opts.frame ? `${opts.frame.glow ? `<circle cx="120" cy="120" r="111" fill="none" stroke="${opts.frame.ring}" stroke-width="3" opacity="0.5"/>` : ''}<circle cx="120" cy="120" r="117" fill="none" stroke="${opts.frame.ring}" stroke-width="6"/>` : '';
  return `<svg viewBox="0 0 240 240" class="avatar-svg" preserveAspectRatio="xMidYMid slice">${bg}${hairParts.back}${shoulders}${neck}${ear}${head}${beard}${hairParts.front}${brows}${eyes}${nose}${mouth}${glasses}${fr}</svg>`;
}
function avHair(style, cx, cy, rx, ry, hair) {
  if (!style) return { back: '', front: '' };
  const topY = cy - ry, R = rx * 1.06;
  // базовая «шапка»: дуга поверх головы + линия волос
  const cap = (lineY, extra = '') => `<path d="M${cx - R} ${cy - ry * 0.1} A ${R} ${ry * 1.05} 0 0 1 ${cx + R} ${cy - ry * 0.1} Q ${cx + rx * 0.55} ${lineY} ${cx} ${lineY + 2} Q ${cx - rx * 0.55} ${lineY} ${cx - R} ${cy - ry * 0.1} Z" fill="${hair}"/>${extra}`;
  switch (style) {
    case 1: // короткая
      return { back: '', front: cap(cy - ry * 0.42) };
    case 2: // ёжик/buzz
      return { back: '', front: cap(cy - ry * 0.58) };
    case 3: { // квифф (зачёс наверх)
      const tuft = `<path d="M${cx - 6} ${topY + 4} Q ${cx + 4} ${topY - 18} ${cx + 22} ${topY + 2} Q ${cx + 6} ${topY + 2} ${cx - 6} ${topY + 4} Z" fill="${hair}"/>`;
      return { back: '', front: cap(cy - ry * 0.4, tuft) };
    }
    case 4: { // длинные
      const back = `<path d="M${cx - rx - 6} ${cy - ry * 0.2} Q ${cx - rx - 14} ${cy + ry + 30} ${cx - rx + 8} ${cy + ry + 36} L ${cx + rx - 8} ${cy + ry + 36} Q ${cx + rx + 14} ${cy + ry + 30} ${cx + rx + 6} ${cy - ry * 0.2} Z" fill="${hair}"/>`;
      return { back, front: cap(cy - ry * 0.3) };
    }
    case 5: { // пучок
      const bun = `<circle cx="${cx}" cy="${topY - 6}" r="16" fill="${hair}"/>`;
      return { back: bun, front: cap(cy - ry * 0.48) };
    }
    case 6: { // кудри
      let curls = '';
      for (let i = -3; i <= 3; i++) curls += `<circle cx="${cx + i * (rx / 3.2)}" cy="${cy - ry * 0.78 + Math.abs(i) * 4}" r="13" fill="${hair}"/>`;
      return { back: '', front: curls + cap(cy - ry * 0.46) };
    }
    default: return { back: '', front: cap(cy - ry * 0.42) };
  }
}
function currentStreak() {
  const set = new Set(xpEvents().map((e) => e.date));
  let streak = 0, cursor = todayStr();
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  while (set.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}
// Рекорд серии — никогда не сбрасывается (анти-Duolingo: потеря текущей серии не стирает достижение)
function longestStreak() {
  const days = [...new Set(xpEvents().map((e) => e.date))].sort();
  if (!days.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < days.length; i++) { if (addDays(days[i - 1], 1) === days[i]) { cur++; best = Math.max(best, cur); } else cur = 1; }
  return best;
}

// ---- Привычки ----
function habitScheduledOn(h, dateStr) { return (h.days || []).includes(parseDate(dateStr).getDay()); }
function habitDone(h, dateStr) { return !!(State.habitlog[dateStr] && State.habitlog[dateStr][h.id]); }
function todaysHabits() { const t = todayStr(); return State.habits.filter((h) => !h.archived && habitScheduledOn(h, t)); }
function habitsDueOn(dateStr) { return State.habits.filter((h) => !h.archived && habitScheduledOn(h, dateStr)); }
// Щадящий стрик (анти-Duolingo): один пропуск не сжигает серию — «заморозка»
// восстанавливается после каждых 7 отмеченных дней. Жизнь не наказывает за единичный сбой.
function habitStreak(h) {
  let s = 0, cursor = todayStr(), guard = 0, freezeLeft = 1, doneRun = 0;
  if (habitScheduledOn(h, cursor) && !habitDone(h, cursor)) cursor = addDays(cursor, -1); // сегодня ещё не вечер
  while (guard++ < 400) {
    if (!habitScheduledOn(h, cursor)) { cursor = addDays(cursor, -1); continue; }
    if (habitDone(h, cursor)) { s++; doneRun++; if (doneRun >= 7) { freezeLeft = 1; doneRun = 0; } cursor = addDays(cursor, -1); }
    else if (freezeLeft > 0) { freezeLeft--; doneRun = 0; cursor = addDays(cursor, -1); } // заморозка съедает пропуск
    else break;
  }
  return s;
}

// ---- Цели ----
// Числовая цель достигнута? (lowerBetter — для оценок/времени, где меньше = лучше)
function goalMetricReached(g) { const m = g.metric; if (!m || m.target == null) return false; return m.lowerBetter ? m.current <= m.target : m.current >= m.target; }
function goalProgress(g) {
  const m = g.metric;
  if (m && m.target != null) {
    const span = m.lowerBetter ? (m.start - m.target) : (m.target - m.start);
    if (!(span > 0)) return goalMetricReached(g) ? 100 : 0;
    const prog = m.lowerBetter ? (m.start - m.current) : (m.current - m.start);
    return Math.max(0, Math.min(100, Math.round(prog / span * 100)));
  }
  const n = g.steps.length; if (!n) return 0; return Math.round(g.steps.filter((s) => s.done).length / n * 100);
}
// Цепочка вверх до Севера (для хлебной крошки «зачем»)
function goalChain(g) { const out = []; let cur = g.parentId ? goalById(g.parentId) : null, guard = 0; while (cur && guard++ < 12) { out.push(cur); cur = cur.parentId ? goalById(cur.parentId) : null; } return out; }
// Статус-бейдж: достигнута / держу / просело / жду / пауза / активна
function goalStatusInfo(g) {
  if (g.completedAt) return { txt: '✅ Достигнута', cls: 'gs-done' };
  if (g.metric && g.metric.maintain && g.metric.everReached) return goalMetricReached(g) ? { txt: '🔄 Держу', cls: 'gs-maint' } : { txt: '⚠️ Просело', cls: 'gs-slip' };
  if (g.status === 'waiting') return { txt: '⏳ Жду' + (g.window ? ' · ' + g.window : ''), cls: 'gs-wait' };
  if (g.status === 'paused') return { txt: '⏸ Пауза', cls: 'gs-pause' };
  return { txt: '▶ Активна', cls: 'gs-active' };
}
function refreshGoalCompletion(g) {
  if (g.metric && g.metric.target != null) {
    const reached = goalMetricReached(g);
    if (reached) g.metric.everReached = true;
    // maintain-цель никогда не «завершается» — остаётся в режиме удержания
    if (reached && !g.metric.maintain && !g.completedAt) { g.completedAt = new Date().toISOString(); toast(`🎯 Цель достигнута: ${g.title} (+${g.xpReward != null ? g.xpReward : GOAL_BONUS.xp} XP)`); }
    else if (!reached && g.completedAt && !g.metric.maintain) g.completedAt = null;
    return;
  }
  const allDone = g.steps.length > 0 && g.steps.every((s) => s.done);
  if (allDone && !g.completedAt) { g.completedAt = new Date().toISOString(); toast(`🎯 Цель достигнута: ${g.title} (+${g.xpReward != null ? g.xpReward : GOAL_BONUS.xp} XP)`); }
  else if (!allDone && g.completedAt) g.completedAt = null;
}

// ---- Дерево навыков ----
function defaultTreeForSkill(skillId) {
  const p = 'nd_' + skillId + '_';
  return {
    nodes: [
      { id: p + '1', title: 'Старт', desc: 'Первый шаг в сфере', cost: 1, requires: [], perkXpPct: 5, unlocked: false, col: 1, row: 0 },
      { id: p + '2', title: 'Регулярность', desc: 'Стабильный ритм', cost: 1, requires: [p + '1'], perkXpPct: 5, unlocked: false, col: 1, row: 1 },
      { id: p + '3', title: 'Глубина', desc: 'Глубокая работа', cost: 2, requires: [p + '2'], perkXpPct: 10, unlocked: false, col: 0, row: 2 },
      { id: p + '4', title: 'Широта', desc: 'Расширение охвата', cost: 2, requires: [p + '2'], perkXpPct: 10, unlocked: false, col: 2, row: 2 },
      { id: p + '5', title: 'Мастерство', desc: 'Высокий уровень', cost: 3, requires: [p + '3', p + '4'], perkXpPct: 15, unlocked: false, col: 1, row: 3 },
    ],
  };
}
const TREE_SX = 194, TREE_SY = 112, TREE_NW = 150, TREE_NH = 70;
function ensureTrees() {
  for (const s of State.settings.skills) if (!State.tree[s.id]) State.tree[s.id] = defaultTreeForSkill(s.id);
  // миграция: позиции col/row → свободные x/y (для перетаскивания)
  for (const id in State.tree) for (const n of State.tree[id].nodes || []) {
    if (n.x == null) n.x = (n.col || 0) * TREE_SX;
    if (n.y == null) n.y = (n.row || 0) * TREE_SY;
  }
}
function treePointsEarned(id) { return skillLevelOf(id); }
function treePointsSpent(id) { const t = State.tree[id]; return t ? t.nodes.filter((n) => n.unlocked).reduce((s, n) => s + (n.cost || 0), 0) : 0; }
function treePointsAvailable(id) { return treePointsEarned(id) - treePointsSpent(id); }
function nodeUnlockable(id, node) {
  if (node.unlocked) return false;
  const t = State.tree[id];
  if ((node.requires || []).some((rid) => { const r = t.nodes.find((x) => x.id === rid); return r && !r.unlocked; })) return false;
  return treePointsAvailable(id) >= (node.cost || 0);
}

// ---- Достижения ----
function achUnlocked(a) { try { return !!a.test(); } catch { return false; } }
function checkAchievements(silent) {
  let changed = false;
  for (const a of ACHIEVEMENTS) if (achUnlocked(a) && !State.achievements[a.id]) { State.achievements[a.id] = new Date().toISOString(); changed = true; if (!silent) { toast(`🏆 Достижение: ${a.title}`); sfx('achievement'); } }
  if (changed) Store.save('achievements', State.achievements);
}

// ============================================================
//  Лутбоксы (сундуки) — ежедневные награды за активность
// ============================================================
const TITLES = ['Ранняя пташка', 'Несокрушимый', 'Полиглот', 'Железная воля', 'Мастер баланса', 'Книжный червь', 'Атлет', 'Творец', 'Стратег', 'Феникс', 'Хранитель ритма', 'Первопроходец', 'Тихий гром', 'Луч дисциплины', 'Алхимик дней'];
// ============================================================
//  #20 Награды-реформа: рарности + косметика (рамки/фоны) + звания за ачивки + дроп-юс
// ============================================================
const RARITY = {
  common:    { label: 'Обычное',     color: '#8b97b5' },
  rare:      { label: 'Редкое',      color: '#4f9ff7' },
  epic:      { label: 'Эпическое',   color: '#b06ff0' },
  legendary: { label: 'Легендарное', color: '#e0a23e' },
};
// Косметика-рамки аватара (кольцо по краю)
const FRAMES = [
  { id: 'fr_bronze',   name: 'Бронза',    rarity: 'common',    ring: '#a9744a' },
  { id: 'fr_leaf',     name: 'Листва',    rarity: 'common',    ring: '#5fbf7a' },
  { id: 'fr_silver',   name: 'Серебро',   rarity: 'rare',      ring: '#c7cee6' },
  { id: 'fr_azure',    name: 'Лазурь',    rarity: 'rare',      ring: '#4f9ff7' },
  { id: 'fr_gold',     name: 'Золото',    rarity: 'epic',      ring: '#e0a23e' },
  { id: 'fr_amethyst', name: 'Аметист',   rarity: 'epic',      ring: '#b06ff0' },
  { id: 'fr_flame',    name: 'Пламя',     rarity: 'epic',      ring: '#e0526a' },
  { id: 'fr_eclipse',  name: 'Затмение',  rarity: 'legendary', ring: '#7c6cff', glow: true },
  { id: 'fr_phoenix',  name: 'Феникс',    rarity: 'legendary', ring: '#ff8a3d', glow: true },
];
// Косметика-фоны аватара (заливка позади)
const BACKGROUNDS = [
  { id: 'bg_slate',  name: 'Сланец',     rarity: 'common',    fill: '#2a3150' },
  { id: 'bg_moss',   name: 'Мох',        rarity: 'common',    fill: '#23402f' },
  { id: 'bg_ocean',  name: 'Океан',      rarity: 'rare',      fill: '#163a4a' },
  { id: 'bg_wine',   name: 'Вино',       rarity: 'rare',      fill: '#3a1630' },
  { id: 'bg_nebula', name: 'Туманность', rarity: 'epic',      fill: '#2c1a4a' },
  { id: 'bg_ember',  name: 'Тлен',       rarity: 'epic',      fill: '#4a2018' },
  { id: 'bg_aurora', name: 'Аврора',     rarity: 'legendary', fill: '#0f3a3a' },
  { id: 'bg_void',   name: 'Бездна',     rarity: 'legendary', fill: '#160f2e' },
];
const COSMETICS = FRAMES.concat(BACKGROUNDS); // единый каталог для коллекции
function cosmeticById(id) { return COSMETICS.find((c) => c.id === id) || null; }
function frameById(id) { return FRAMES.find((c) => c.id === id) || null; }
function bgFill(id) { const b = BACKGROUNDS.find((c) => c.id === id); return b ? b.fill : null; }
function cosmeticType(id) { return FRAMES.some((f) => f.id === id) ? 'frame' : 'background'; }
function rarityOf(id) { const c = cosmeticById(id); return c ? c.rarity : 'common'; }
// Инициализация косметики в settings (миграция для существующих юзеров)
function ensureCosmetics() {
  const s = State.settings; if (!s) return { frame: null, background: null, title: null };
  if (!Array.isArray(s.cosmetics)) s.cosmetics = [];
  if (!s.equipped || typeof s.equipped !== 'object') s.equipped = { frame: null, background: null, title: null };
  return s.equipped;
}
function ownsCosmetic(id) { return (State.settings.cosmetics || []).includes(id); }
function equippedCosmeticsOpts() { const eq = ensureCosmetics(); return { bg: bgFill(eq.background), frame: frameById(eq.frame) }; }
// Звания: даются ЗА ДОСТИЖЕНИЯ (не из кейсов — фидбек #20). + легаси-титулы из старых сундуков.
function earnedTitles() {
  const fromAch = ACHIEVEMENTS.filter((a) => State.achievements[a.id] && a.ttl).map((a) => a.ttl);
  const legacy = (State.lootbox && State.lootbox.titles) || [];
  return [...new Set([...fromAch, ...legacy])];
}
function equippedTitle() { const eq = ensureCosmetics(); return eq.title || (State.lootbox && State.lootbox.equipped) || null; }
const LOOT_POOL = [
  { w: 26, type: 'gold',     min: 15,  max: 45,  label: '🪙 Золото' },
  { w: 18, type: 'gold',     min: 50,  max: 100, label: '🪙 Золото' },
  { w: 16, type: 'cosmetic', rarity: 'common',   label: '🎨 Косметика' },
  { w: 12, type: 'energy',   min: 20,  max: 40,  label: '🔋 Заряд энергии' },
  { w: 11, type: 'boost',    pct: 25,  hours: 6, label: '⚡ +25% XP' },
  { w: 9,  type: 'cosmetic', rarity: 'rare',     label: '🎨 Редкая косметика' },
  { w: 7,  type: 'boost',    pct: 50,  hours: 3, label: '🔥 +50% XP' },
  { w: 6,  type: 'gold',     min: 120, max: 220, label: '🪙 Куча золота' },
  { w: 4,  type: 'cosmetic', rarity: 'epic',     label: '🎨 Эпическая косметика' },
  { w: 3,  type: 'gold',     min: 280, max: 450, label: '💎 Джекпот' },
  { w: 1.4,type: 'cosmetic', rarity: 'legendary',label: '🎨 Легендарная косметика' },
];
const LOOT_THRESHOLDS = [1, 3, 5]; // активностей за день для сундука №1 / №2 / №3
function ensureLootbox() {
  if (!State.lootbox) State.lootbox = { day: todayStr(), opened: 0, goldWon: 0, boost: null, titles: [], equipped: null, history: [] };
  if (State.lootbox.day !== todayStr()) { State.lootbox.day = todayStr(); State.lootbox.opened = 0; }
  return State.lootbox;
}

// ============================================================
//  Энергия (идея 19) — ресурс «нагрузка ↔ восстановление».
//  Принцип: НИКОГДА не блокирует и не режет XP. Только индикатор + тёплый нудж.
//  ВОССТАНОВЛЕНИЕ ПАССИВНОЕ — по реальному времени (не работаешь = отдыхаешь; сон ночью = много часов).
//  Логировать отдых/сон НЕ нужно. Это оценка по задачам; точные данные — позже через часы (Apple Watch/Garmin).
//  Ёмкость (max) растёт по суперкомпенсации: нагрузка + отдых → адаптация.
// ============================================================
const ENERGY = { perHour: 7, maxFloor: 80, maxCeil: 220, grow: 2, shrink: 1, loadForGrowth: 12,
  cost: { easy: 0, normal: 4, hard: 8 }, costCap: 24 };
function ensureEnergy() {
  const s = State.settings;
  if (!s.energy) s.energy = { day: todayStr(), cur: 100, max: 100, loadToday: 0, hitZero: false, tickAt: Date.now() };
  const e = s.energy, today = todayStr(), now = Date.now();
  if (!e.tickAt) e.tickAt = now;
  // Пассивное восстановление по реальному времени — главный механизм отдыха (сон, паузы)
  const elapsedH = (now - e.tickAt) / 3600000;
  if (elapsedH > 0) { e.cur = Math.min(e.max, e.cur + ENERGY.perHour * elapsedH); e.tickAt = now; }
  if (e.day !== today) {
    // Суперкомпенсация по вчерашнему дню: была нагрузка и не ушёл в ноль → ёмкость растёт; загнал в ноль → падает.
    if (e.day) {
      if (e.loadToday >= ENERGY.loadForGrowth && !e.hitZero) e.max = Math.min(ENERGY.maxCeil, e.max + ENERGY.grow);
      else if (e.hitZero) e.max = Math.max(ENERGY.maxFloor, e.max - ENERGY.shrink);
    }
    e.loadToday = 0; e.hitZero = false; e.day = today; e.cur = Math.min(e.max, e.cur);
  }
  e.cur = Math.round(e.cur);
  return e;
}
function energyPct() { const e = ensureEnergy(); return e.max ? Math.round(e.cur / e.max * 100) : 0; }
function energyMeta() {
  const p = energyPct();
  if (p >= 60) return { color: '#5fbf7a', text: 'свежесть', icon: '🔋' };
  if (p >= 25) return { color: '#e0a23e', text: 'на исходе', icon: '🔋' };
  return { color: '#e0526a', text: 'нужен отдых', icon: '🪫' };
}
// Множитель траты энергии по «желанию» (фидбек #6 + наука):
//  forced (через силу) → дороже: волевое усилие против сопротивления истощает сильнее (ego depletion, Baumeister).
//  hyped (в кураже)     → дешевле: добровольный челлендж/поток менее истощающ (flow, Csikszentmihalyi).
//  neutral/обычный      → база: устойчивая «золотая середина» десятиборья.
const DESIRE_ENERGY = { forced: 1.5, hyped: 0.8 };
// Применяем энергию при выполнении квеста/привычки (только трата; восстановление — пассивное по времени).
// Восстановительные дела (сон/отдых/медитация/прогулка/растяжка/баня…) — АКТИВНО дают энергию (фидбек #14).
// Без \b — он в JS работает только для ASCII и ломает матч кириллицы. Стемы достаточно различимы.
const ENERGY_RESTORE_RE = /(сон|поспат|выспат|вздремн|отдых|отдохн|релакс|медитац|дыхани|прогул|растяж|разминк|мобилк|баня|сауна|массаж|ванна|nap|sleep|relax|medit|walk|stretch|yoga|йога)/i;
function isRestActivity(it) { return ENERGY_RESTORE_RE.test(normRu(it.title || '')); }
function applyEnergy(it, desire) {
  const e = ensureEnergy(), min = Number(it.estimateMin) || 0;
  let delta;
  if (isRestActivity(it)) {
    // отдых пополняет энергию (мягко, по длительности) — даёт агентность поверх пассивного восстановления
    delta = Math.min(ENERGY.costCap, Math.max(6, Math.round(min / 30 * 12)));
    e.cur = Math.min(e.max, e.cur + delta);
  } else {
    const w = ENERGY.cost[it.difficulty] ?? ENERGY.cost.normal, m = DESIRE_ENERGY[desire] || 1;
    delta = -Math.min(ENERGY.costCap, Math.round(w * Math.max(0.5, min / 30) * m));
    e.loadToday += -delta;
    e.cur = Math.max(0, e.cur + delta);
    if (e.cur <= 0) e.hitZero = true;
  }
  Store.save('settings', State.settings);
  return delta;
}
function todayActivityCount() {
  const t = todayStr();
  const q = State.tasks.filter((x) => x.done && dayOf(x) === t).length;
  const h = State.habitlog[t] ? Object.keys(State.habitlog[t]).length : 0;
  return q + h;
}
function lootTierCap() { return isPro() ? 3 : 1; }
function lootChestsAvailable() {
  ensureLootbox();
  const earned = LOOT_THRESHOLDS.filter((th) => todayActivityCount() >= th).length;
  return Math.max(0, Math.min(earned, lootTierCap()) - State.lootbox.opened);
}
function lootNextThreshold() { const act = todayActivityCount(); const th = LOOT_THRESHOLDS.find((x) => act < x); return th ? { need: th - act, at: th } : null; }
function rollLoot() { const total = LOOT_POOL.reduce((s, x) => s + x.w, 0); let r = Math.random() * total; for (const it of LOOT_POOL) { if ((r -= it.w) <= 0) return it; } return LOOT_POOL[0]; }
function lootResolve(item) {
  if (item.type === 'gold') { const amt = Math.round(item.min + Math.random() * (item.max - item.min)); const rar = amt >= 280 ? 'epic' : amt >= 120 ? 'rare' : 'common'; return { type: 'gold', amount: amt, rarity: rar, label: `+${amt} 🪙` }; }
  if (item.type === 'energy') { const amt = Math.round(item.min + Math.random() * (item.max - item.min)); return { type: 'energy', amount: amt, rarity: 'common', label: `+${amt} 🔋 энергии` }; }
  if (item.type === 'boost') return { type: 'boost', pct: item.pct, hours: item.hours, rarity: item.pct >= 50 ? 'epic' : 'rare', label: `+${item.pct}% XP · ${item.hours}ч` };
  if (item.type === 'cosmetic') {
    const rar = item.rarity || 'common', pool = COSMETICS.filter((c) => c.rarity === rar && !ownsCosmetic(c.id));
    if (pool.length) { const c = pool[Math.floor(Math.random() * pool.length)]; return { type: 'cosmetic', id: c.id, rarity: rar, name: c.name, label: `🎨 ${c.name}` }; }
    const dup = { common: 40, rare: 80, epic: 160, legendary: 320 }[rar] || 40; // дубль (всё собрано) → золото, Brawl-Stars-стиль
    return { type: 'gold', amount: dup, rarity: rar, label: `+${dup} 🪙 (${RARITY[rar].label.toLowerCase()} собрано)` };
  }
  return { type: 'gold', amount: 20, rarity: 'common', label: '+20 🪙' };
}
function applyLoot(reward) {
  const lb = ensureLootbox();
  if (reward.type === 'gold') lb.goldWon += reward.amount;
  else if (reward.type === 'energy') { const e = ensureEnergy(); e.cur = Math.min(e.max, e.cur + reward.amount); Store.save('settings', State.settings); }
  else if (reward.type === 'boost') lb.boost = { pct: reward.pct, until: new Date(Date.now() + reward.hours * 3600 * 1000).toISOString() };
  else if (reward.type === 'cosmetic') {
    ensureCosmetics();
    if (!State.settings.cosmetics.includes(reward.id)) State.settings.cosmetics.push(reward.id);
    const t = cosmeticType(reward.id); if (!State.settings.equipped[t]) State.settings.equipped[t] = reward.id; // авто-надеть, если слот пуст
    Store.save('settings', State.settings);
  }
  lb.opened += 1;
  lb.history.unshift({ at: new Date().toISOString(), label: reward.label, rarity: reward.rarity || 'common' });
  lb.history = lb.history.slice(0, 40);
  Store.save('lootbox', lb);
}

// ============================================================
//  Таймер фокуса + плавающее окно (Document PiP), помодоро, колокол
//  (эфемерное состояние — в localStorage, не в vault)
// ============================================================
let tickId = null, pipWindow = null, audioCtx = null;

function loadTimer() { try { return JSON.parse(localStorage.getItem('liferpg_timer') || 'null'); } catch { return null; } }
function persistTimer() { if (State.timer) localStorage.setItem('liferpg_timer', JSON.stringify(State.timer)); else localStorage.removeItem('liferpg_timer'); }
function timerElapsedMs() { const tm = State.timer; if (!tm) return 0; return tm.accumulatedMs + (tm.running ? Date.now() - tm.startedAt : 0); }
function focusCfg() { return Object.assign({ pomodoro: true, workMin: 25, breakMin: 5, sound: true, notify: true }, (State.settings && State.settings.focus) || {}); }

// --- колокол через Web Audio (без файлов) ---
function ensureAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch {} }
function bell(strong) {
  if (!focusCfg().sound) return; ensureAudio(); if (!audioCtx) return;
  const t0 = audioCtx.currentTime, freqs = strong ? [880, 1320, 1760] : [660, 990];
  freqs.forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.2 / (i + 1), t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + 1.7);
  });
}
// ---- SFX (#23): синтезированные звуки интерфейса через Web Audio, без файлов ----
function sfxOn() { return !State.settings || State.settings.sound !== false; }
function sfxTone(freq, t0, dur, opts) {
  if (!audioCtx) return; opts = opts || {};
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = opts.type || 'sine'; o.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const peak = opts.gain || 0.15;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + dur + 0.03);
}
function sfx(name, rarity) {
  if (!sfxOn()) return; ensureAudio(); if (!audioCtx) return;
  const t = audioCtx.currentTime;
  if (name === 'complete') { [[660, 0], [880, 0.07], [1320, 0.15]].forEach(([f, d]) => sfxTone(f, t + d, 0.18, { type: 'triangle', gain: 0.13 })); }
  else if (name === 'levelup') { [523, 659, 784, 1046, 1318].forEach((f, i) => sfxTone(f, t + i * 0.085, 0.3, { type: 'sawtooth', gain: 0.11 })); sfxTone(1046, t + 0.45, 0.5, { type: 'sine', gain: 0.1 }); }
  else if (name === 'coin') { sfxTone(988, t, 0.06, { type: 'square', gain: 0.09 }); sfxTone(1319, t + 0.055, 0.1, { type: 'square', gain: 0.09 }); }
  else if (name === 'achievement') { [784, 1046, 1318, 1568].forEach((f, i) => sfxTone(f, t + i * 0.1, 0.32, { type: 'triangle', gain: 0.12 })); }
  else if (name === 'loot') {
    const map = { common: [523, 659], rare: [523, 659, 784], epic: [523, 659, 784, 1046], legendary: [392, 523, 659, 784, 1046, 1318] };
    const notes = map[rarity] || map.common, leg = rarity === 'legendary';
    notes.forEach((f, i) => sfxTone(f, t + i * 0.08, 0.36, { type: leg ? 'sawtooth' : 'triangle', gain: leg ? 0.15 : 0.11 }));
    if (rarity === 'epic' || leg) sfxTone(notes[notes.length - 1] * 2, t + notes.length * 0.08, 0.55, { type: 'sine', gain: 0.1 });
  }
}
function sfxLoot(rarity) { sfx('loot', rarity); } // вызывается из openChest (#20)
function notify(title, body) {
  if (!focusCfg().notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch {}
}

function focusInfo() {
  const tm = State.timer; if (!tm) return null;
  const t = questById(tm.taskId), elapsed = timerElapsedMs(), estMs = (Number(t && t.estimateMin) || 0) * 60000;
  return { tm, t, elapsed, estMs, remaining: estMs - elapsed, phaseElapsed: elapsed - (tm.phaseStartElapsed || 0) };
}
function pipSub(fi) {
  const cfg = focusCfg(); let s = '';
  if (cfg.pomodoro) { const limit = (fi.tm.phase === 'break' ? cfg.breakMin : cfg.workMin) * 60000; s = (fi.tm.phase === 'break' ? '☕ перерыв ' : '🎯 ') + fmtClock(Math.max(0, limit - fi.phaseElapsed)); }
  if (fi.estMs > 0) s += (s ? ' · ' : '') + (fi.remaining >= 0 ? 'осталось ' + fmtClock(fi.remaining) : '⚠ +' + fmtClock(-fi.remaining));
  return s;
}
// единый тик: дисплеи + помодоро + превышение оценки
function focusTick() {
  const fi = focusInfo(); if (!fi) return;
  const cfg = focusCfg(), main = document.getElementById('timer-clock');
  if (main) main.textContent = fmtClock(fi.elapsed);
  updatePill(fi); updatePip(fi);
  if (!fi.tm.running) return;
  if (cfg.pomodoro) {
    const limit = (fi.tm.phase === 'break' ? cfg.breakMin : cfg.workMin) * 60000;
    if (fi.phaseElapsed >= limit) {
      if (fi.tm.phase === 'break') { fi.tm.phase = 'work'; bell(true); notify('Перерыв окончен', 'Возвращаемся к фокусу 🎯'); }
      else { fi.tm.phase = 'break'; bell(true); notify('Время на перерыв ☕', `Поработал ${cfg.workMin} мин — отдохни ${cfg.breakMin}`); }
      fi.tm.phaseStartElapsed = fi.elapsed; persistTimer();
    }
  }
  if (fi.estMs > 0 && fi.elapsed >= fi.estMs && !fi.tm.overrunNotified) {
    fi.tm.overrunNotified = true; persistTimer(); bell(true); notify('Превышено расчётное время', fi.t ? `«${fi.t.title}» дольше плана` : '');
  }
}
function startTick() { stopTick(); if (!pipWindow) tickId = setInterval(focusTick, 1000); }
function stopTick() { if (tickId) { clearInterval(tickId); tickId = null; } }

// --- встроенная плашка (видна везде в приложении; fallback без PiP) ---
function pillEl() {
  let p = document.getElementById('focus-pill');
  if (!p) {
    p = document.createElement('div'); p.id = 'focus-pill'; p.className = 'focus-pill';
    p.innerHTML = `<div class="fp-main"><span class="fp-task" id="fp-task"></span><span class="fp-clock" id="fp-clock">0:00</span></div>
      <div class="fp-sub" id="fp-sub"></div>
      <div class="fp-ctrl"><button data-action="timer-pause" id="fp-pause">⏸</button><button data-action="timer-stop">⏹</button><button data-action="open-pip" title="Плавающее окно поверх всех приложений">↗</button></div>`;
    document.body.appendChild(p);
  }
  return p;
}
function updatePill(fi) {
  const p = pillEl();
  if (!fi || pipWindow) { p.classList.remove('show'); return; }
  p.classList.add('show');
  p.classList.toggle('overrun', fi.estMs > 0 && fi.elapsed >= fi.estMs);
  p.querySelector('#fp-task').textContent = fi.t ? fi.t.title : 'Фокус';
  p.querySelector('#fp-clock').textContent = fmtClock(fi.elapsed);
  p.querySelector('#fp-pause').textContent = fi.tm.running ? '⏸' : '▶';
  p.querySelector('#fp-sub').textContent = pipSub(fi);
}
function removePill() { const p = document.getElementById('focus-pill'); if (p) p.classList.remove('show'); }

// --- плавающее окно поверх всех приложений (Document Picture-in-Picture) ---
const PIP_CSS = `body{margin:0;font:13px -apple-system,'Segoe UI',Roboto,sans-serif;background:#11151f;color:#e7ebf5;overflow:hidden}body.break{background:#15241a}body.overrun{background:#2a1622}.pip{padding:9px 11px;display:flex;flex-direction:column;gap:3px;height:100%;box-sizing:border-box}.pip-task{font-size:11px;color:#99a2c0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pip-clock{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}.pip-sub{font-size:12px;color:#c7cee6}body.overrun .pip-sub{color:#ff9bb0}.pip-bar{height:6px;background:#222a40;border-radius:999px;overflow:hidden;margin-top:2px}.pip-bar>span{display:block;height:100%;width:0;background:linear-gradient(90deg,#6c8cff,#9b7cff)}body.overrun .pip-bar>span{background:#e0526a}.pip-ctrl{display:flex;gap:8px;margin-top:auto}.pip-ctrl button{flex:1;background:#1f2640;border:1px solid #2a3250;color:#fff;border-radius:8px;padding:7px;font-size:15px;cursor:pointer}.pip-ctrl button:hover{background:#2a3250}`;

async function openFocusWidget() {
  if (!State.timer) return;
  if (!('documentPictureInPicture' in window)) { toast('Плавающее окно недоступно в этом браузере — показываю плашку'); return; }
  if (pipWindow) { try { pipWindow.focus(); } catch {} return; }
  try {
    pipWindow = await documentPictureInPicture.requestWindow({ width: 232, height: 148 }); // компактнее — меньше мешает (fb)
    const d = pipWindow.document;
    d.title = (State.settings && State.settings.appName) || 'Gojo'; // вместо служебного текста в заголовке
    const st = d.createElement('style'); st.textContent = PIP_CSS; d.head.appendChild(st);
    d.body.innerHTML = `<div class="pip"><div class="pip-task" id="pip-task"></div><div class="pip-clock" id="pip-clock">0:00</div><div class="pip-sub" id="pip-sub"></div><div class="pip-bar"><span id="pip-bar"></span></div><div class="pip-ctrl"><button id="pip-pause">⏸</button><button id="pip-stop">⏹</button></div></div>`;
    d.getElementById('pip-pause').addEventListener('click', () => { State.timer && State.timer.running ? pauseFocus() : resumeFocus(); });
    d.getElementById('pip-stop').addEventListener('click', () => stopFocus(true));
    pipWindow.addEventListener('pagehide', () => { pipWindow = null; if (State.timer) { startTick(); updatePill(focusInfo()); } });
    stopTick();
    pipWindow.setInterval(focusTick, 1000); // видимое окно не тротлится фоновыми вкладками
    updatePip(focusInfo()); updatePill(focusInfo());
  } catch (e) { console.error('pip', e); pipWindow = null; }
}
function updatePip(fi) {
  if (!pipWindow || pipWindow.closed || !fi) return;
  const d = pipWindow.document, set = (id, v) => { const el = d.getElementById(id); if (el) el.textContent = v; };
  set('pip-task', fi.t ? fi.t.title : 'Фокус'); set('pip-clock', fmtClock(fi.elapsed)); set('pip-sub', pipSub(fi));
  const pp = d.getElementById('pip-pause'); if (pp) pp.textContent = fi.tm.running ? '⏸' : '▶';
  const bar = d.getElementById('pip-bar'); if (bar) bar.style.width = (fi.estMs > 0 ? Math.min(100, fi.elapsed / fi.estMs * 100) : 0) + '%';
  d.body.classList.toggle('overrun', fi.estMs > 0 && fi.elapsed >= fi.estMs);
  d.body.classList.toggle('break', fi.tm.phase === 'break');
}
function closeFocusWidget() { if (pipWindow && !pipWindow.closed) { try { pipWindow.close(); } catch {} } pipWindow = null; }

function startFocus(taskId) {
  if (State.timer) { if (State.timer.taskId === taskId) { if (!State.timer.running) resumeFocus(); return; } stopFocus(true, true); }
  State.timer = { taskId, startedAt: Date.now(), accumulatedMs: 0, running: true, phase: 'work', phaseStartElapsed: 0, overrunNotified: false };
  persistTimer(); ensureAudio();
  if (focusCfg().notify && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch {} }
  openFocusWidget(); startTick(); render();
}
function pauseFocus() { const tm = State.timer; if (!tm || !tm.running) return; tm.accumulatedMs += Date.now() - tm.startedAt; tm.running = false; persistTimer(); updatePill(focusInfo()); updatePip(focusInfo()); render(); }
function resumeFocus() { const tm = State.timer; if (!tm || tm.running) return; tm.startedAt = Date.now(); tm.running = true; persistTimer(); if (!pipWindow) startTick(); updatePill(focusInfo()); updatePip(focusInfo()); render(); }
function stopFocus(log = true, skipRender = false) {
  const tm = State.timer; if (!tm) return;
  const mins = Math.round(timerElapsedMs() / 60000), t = questById(tm.taskId);
  if (log && t && mins > 0) { t.actualMin = (t.actualMin || 0) + mins; Store.save('tasks', State.tasks); toast(`⏱ Записано ${mins} мин в «${t.title}»`); }
  State.timer = null; persistTimer(); stopTick(); closeFocusWidget(); removePill();
  if (!skipRender) render();
}

// ============================================================
//  Экраны аутентификации
// ============================================================
function renderLoginScreen() {
  const profileCards = State.profiles.map((p) => {
    const selected = State.selectedProfile === p.id;
    return `<div class="profile-card ${selected ? 'selected' : ''}" data-action="select-profile" data-id="${p.id}">
      <div class="profile-avatar">${esc(p.avatar || '👤')}</div>
      <div class="profile-name">${esc(p.name)}</div>
      ${selected ? `<form id="pin-form" class="pin-form" data-id="${p.id}">
        <input name="pin" type="password" inputmode="numeric" placeholder="PIN" maxlength="8" required autofocus />
        <button type="submit">Войти →</button>
        <div id="pin-error" class="pin-error"></div>
      </form>` : ''}
    </div>`;
  }).join('');
  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo"><span>⚔️</span><h1>Gojo</h1><p>Превращаем жизнь в игру</p></div>
      <div class="profiles-grid">${profileCards}
        <div class="profile-card new-card" data-action="go-register">
          <div class="profile-avatar add-avatar">+</div>
          <div class="profile-name">Новый профиль</div>
        </div>
      </div>
    </div>
    <div id="toasts"></div>`;
}

function renderRegisterScreen() {
  const avatarPicker = AVATARS.map((a) => `<button type="button" class="av-btn ${a === State.regAvatar ? 'sel' : ''}" data-action="pick-avatar" data-av="${a}">${a}</button>`).join('');
  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo"><span>⚔️</span><h1>Gojo</h1><p>Создай свой профиль</p></div>
      <div class="auth-box">
        <form id="register-form">
          <label>Твоё имя</label>
          <input name="name" placeholder="Как тебя зовут?" maxlength="32" required autocomplete="off" value="${esc(State.regName || '')}" />
          <label style="margin-top:12px">Аватар</label>
          <div class="av-grid">${avatarPicker}</div>
          <label style="margin-top:12px">PIN-код (минимум 4 символа)</label>
          <input name="pin" type="password" inputmode="numeric" placeholder="Придумай PIN" maxlength="8" required />
          <input name="pin2" type="password" inputmode="numeric" placeholder="Повтори PIN" maxlength="8" required />
          <div id="reg-error" class="pin-error"></div>
          <button type="submit" class="btn" style="margin-top:14px;width:100%">Создать профиль</button>
        </form>
        <button class="btn ghost" data-action="go-login" style="margin-top:10px;width:100%">← Назад</button>
      </div>
    </div>
    <div id="toasts"></div>`;
}

function renderOnboardingScreen() {
  const chips = SKILL_GROUPS.map((g) => {
    const items = g.items.map((t) => {
      const sel = State.obSkills.has(t.name);
      return `<button type="button" class="ob-chip ${sel ? 'sel' : ''}" data-action="ob-toggle" data-skill="${esc(t.name)}" data-color="${esc(t.color)}" style="--c:${esc(t.color)}">${t.name}</button>`;
    }).join('');
    return `<div class="ob-group"><div class="ob-group-h">${g.group}</div><div class="ob-group-chips">${items}</div></div>`;
  }).join('');
  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo"><span>${esc(State.me && State.me.avatar || '⚡')}</span>
        <h1>Привет, ${esc(State.me && State.me.name || '')}!</h1>
        <p>Выбери свои сферы развития — их всегда можно изменить</p>
      </div>
      <div class="auth-box">
        <div class="ob-section">📦 Быстрый старт — готовая программа</div>
        <div class="prog-grid">${DUNGEON_PROGRAMS.map((p) => programCard(p, 'ob-program')).join('')}</div>
        <div class="ob-or">— или собери вручную —</div>
        <div class="ob-groups">${chips}</div>
        <div style="margin-top:14px;display:flex;gap:8px;align-items:center">
          <input id="ob-custom" placeholder="Своя сфера…" style="flex:1" />
          <input id="ob-color" type="color" value="#6c8cff" style="width:44px;height:38px;padding:2px;cursor:pointer" />
          <button class="btn ghost" data-action="ob-add-custom">+</button>
        </div>
        <button class="btn" data-action="ob-finish" style="margin-top:18px;width:100%" ${State.obSkills.size === 0 ? 'disabled' : ''}>
          Поехали! (${State.obSkills.size} сфер${State.obSkills.size === 1 ? 'а' : State.obSkills.size < 5 ? 'ы' : ''})
        </button>
      </div>
    </div>
    <div id="toasts"></div>`;
}

function showAuthScreen() {
  if (State.phase === 'login') renderLoginScreen();
  else if (State.phase === 'register') renderRegisterScreen();
  else if (State.phase === 'onboarding') renderOnboardingScreen();
}

// ============================================================
//  Заголовок: персонаж
// ============================================================
function renderHeader() {
  const c = State.settings.curve, oi = levelInfo(overallXp(), c.base, c.growth), streak = currentStreak();
  const cr = charRank(), eqTitle = equippedTitle(), e = ent();
  const skills = topSkills().map((s) => {
    const si = levelInfo(skillXp(s.id), c.skillBase, c.growth), sr = rankFor(si.level), pillar = isPillar(s.id);
    const subInfo = pillar ? ` · ${descendantSkills(s.id).length} под-навыков` : '';
    return `<div class="skill-chip" title="${esc(s.name)} — ${sr.name} (ур.${si.level}, ${skillXp(s.id)} XP)${subInfo}">
      <span class="dot" style="background:${esc(s.color)}"></span>
      <span class="sk-name">${esc(s.name)}${pillar ? ' ▾' : ''}</span><span class="sk-lvl">ур.${si.level}</span>
      <span class="sk-bar"><span style="width:${si.pct}%;background:${esc(s.color)}"></span></span></div>`;
  }).join('');
  const proBadge = e.tier === 'pro' ? '<span class="plan-badge pro" title="Pro активен">PRO</span>'
    : e.tier === 'trial' ? `<span class="plan-badge trial" title="Pro-триал">PRO ${trialDaysLeft()}д</span>`
    : '<button class="plan-badge free" data-action="show-paywall" data-feature="Pro" title="Открыть Pro — сейчас у тебя Free">🔓 Pro?</button>';
  document.getElementById('appName').textContent = State.settings.appName || 'Gojo';
  document.getElementById('charSummary').innerHTML = `
    <div class="char-main">
      ${State.me ? `<div class="user-pill" title="Профиль">
        <span class="up-av">${esc(State.me.avatar || '👤')}</span>
        <span class="up-meta"><span class="up-name">${esc(State.me.name)}${eqTitle ? ` <span class="eq-title">🏷 ${esc(eqTitle)}</span>` : ''}</span>
        <span class="up-rank" style="--rc:${cr.color}">${cr.icon} ${cr.name}</span></span></div>` : ''}
      <div class="char-level">Уровень <b>${oi.level}</b></div>
      <div class="xp-bar"><span style="width:${oi.pct}%"></span><i>${oi.into} / ${oi.need} XP</i></div>
      <div class="gold-pill" title="Золото">🪙 ${goldBalance()}</div>
      <div class="streak" title="Рекорд: ${longestStreak()} ${plural(longestStreak(), 'день', 'дня', 'дней')}">🔥 ${streak} ${plural(streak, 'день', 'дня', 'дней')}</div>
      ${hypePct() > 0 ? `<div class="hype-chip" title="Хайп ×${hypeState().stacks}: бонус XP за добровольный выбор сложных квестов. Осталось ${hypeMinLeft()} мин.">🔥 Хайп +${hypePct()}%</div>` : ''}
      <button class="help-btn" data-action="show-guide" title="Как играть">?</button>
      ${proBadge}
      <button class="btn ghost logout-btn" data-action="logout" title="Сменить профиль">⇦ Выйти</button>
    </div>
    <div class="skills-row">${skills}</div>`;
}

// ============================================================
//  Вид «Сегодня»
// ============================================================
function catChips(t) {
  const ids = taskSkills(t);
  if (!ids.length) return `<span class="t-cat missing">— сфера —</span>`;
  return ids.map((sid) => { const s = skillById(sid); return `<span class="t-cat ${s.missing ? 'missing' : ''}" style="--c:${esc(s.color)}">${esc(s.name)}</span>`; }).join('');
}
function questRow(t) {
  const estMin = Number(t.estimateMin) || 0;
  const time = t.actualMin ? `${fmtDur(t.actualMin)} / ${fmtDur(estMin)}` : fmtDur(estMin);
  const active = State.timer && State.timer.taskId === t.id;
  const skSel = `<button class="t-cats" data-action="edit-cats" data-id="${t.id}" title="Категории квеста — клик чтобы изменить (можно несколько)">${catChips(t)}</button>`;
  return `<li class="task ${t.done ? 'done' : ''}">
    <button class="check" data-action="toggle-task" data-id="${t.id}">${t.done ? '✓' : ''}</button>
    <span class="t-title">${esc(t.title)}</span>
    ${skSel}
    <span class="t-time" data-action="edit-actual" data-id="${t.id}" title="Клик — фактическое время">${time}</span>
    <span class="t-diff">${DIFF[t.difficulty] || ''}</span>
    <span class="t-xp">${t.done ? '+' + (t.xpAwarded || 0) : ''}</span>
    ${t.done ? '<span></span>' : `<button class="focus ${active ? 'active' : ''}" data-action="focus-task" data-id="${t.id}" title="Фокус-таймер">${active ? '⏱' : '▶'}</button>`}
    <button class="del" data-action="delete-task" data-id="${t.id}" title="Удалить">✕</button></li>`;
}
function habitRow(h) {
  const sk = skillById(h.skillId), done = habitDone(h, todayStr()), hs = habitStreak(h);
  return `<li class="task habit ${done ? 'done' : ''}">
    <button class="check" data-action="toggle-habit" data-id="${h.id}">${done ? '✓' : ''}</button>
    <span class="t-title">${esc(h.title)}</span>
    <span class="t-skill" style="--c:${esc(sk.color)}">${esc(sk.name)}</span>
    <span class="t-time">${fmtDur(h.estimateMin)}</span>
    <span class="t-diff">${DIFF[h.difficulty] || ''}</span>
    <span class="t-xp">${done ? '+' + itemXp(h) : ''}</span>
    <span class="habit-streak" title="Серия">${hs ? '🔥' + hs : ''}</span><span></span></li>`;
}
// ============================================================
//  Вид «Календарь» — день по часам (Apple-стиль), отдельная вкладка
// ============================================================
const CAL_H0 = 6, CAL_H1 = 23, CAL_ROWH = 48;
function calMinToY(min) { return (min - CAL_H0 * 60) / 60 * CAL_ROWH; }
function calYtoMin(y) { const raw = CAL_H0 * 60 + y / CAL_ROWH * 60; return Math.max(CAL_H0 * 60, Math.min(CAL_H1 * 60 + 45, Math.round(raw / 15) * 15)); }
function fmtHM(min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function calModeToggle(mode) {
  return `<div class="cal-modes">
    <button class="cal-mode ${mode === 'day' ? 'active' : ''}" data-action="cal-mode" data-mode="day">День</button>
    <button class="cal-mode ${mode === 'week' ? 'active' : ''}" data-action="cal-mode" data-mode="week">Неделя</button>
    <button class="cal-mode ${mode === 'month' ? 'active' : ''}" data-action="cal-mode" data-mode="month">Месяц</button></div>`;
}
function calRemindBtn() {
  const on = State.settings && State.settings.remind;
  return `<button class="btn ghost sm cal-remind ${on ? 'on' : ''}" data-action="cal-remind-toggle" title="Напоминания о задачах со временем (пока вкладка открыта)">${on ? '🔔 Напоминания вкл' : '🔕 Напоминания'}</button>`;
}
function calExportBtn() { return `<button class="btn ghost sm" data-action="export-ics" title="Скачать запланированные квесты как .ics — импортировать в Apple/Google Календарь (разово; #8)">📆 .ics</button>`; }
// Экспорт запланированных квестов (с датой и временем) в iCalendar (#8). Разовый экспорт, не живая подписка.
function buildICS() {
  const tasks = (State.tasks || []).filter((t) => t.date && t.startTime);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const escV = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const dt = (date, time) => `${date.replace(/-/g, '')}T${(time || '09:00').replace(':', '')}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gojo//Life Planner//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Gojo'];
  tasks.forEach((t) => {
    const dur = Math.max(5, Number(t.estimateMin) || 30);
    lines.push('BEGIN:VEVENT', `UID:${t.id}@gojo`, `DTSTAMP:${stamp}`, `DTSTART:${dt(t.date, t.startTime)}`, `DURATION:PT${dur}M`,
      `SUMMARY:${escV('🎯 ' + t.title)}`, `DESCRIPTION:${escV('Gojo · ' + (skillById(t.skillId).name || ''))}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
// Месячная сетка (6×7, с понедельника). Клик по дню → день этой даты.
function renderCalMonth(date) {
  const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const d = parseDate(date), y = d.getFullYear(), mo = d.getMonth();
  const first = new Date(y, mo, 1), startJs = first.getDay();
  const gridStart = addDays(fmtDate(first), -((startJs === 0 ? 7 : startJs) - 1)); // понедельник перед 1-м
  const counts = {};
  for (const t of State.tasks) if (!t.done) counts[t.date] = (counts[t.date] || 0) + 1;
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const ds = addDays(gridStart, i), cd = parseDate(ds), inMonth = cd.getMonth() === mo;
    const n = counts[ds] || 0, isToday = ds === todayStr(), isSel = ds === date;
    cells += `<button class="cm-cell ${inMonth ? '' : 'cm-out'} ${isToday ? 'cm-today' : ''} ${isSel ? 'cm-sel' : ''}" data-action="cal-pick-day" data-date="${ds}">
      <span class="cm-n">${cd.getDate()}</span>${n ? `<span class="cm-dot">${n > 9 ? '9+' : n}</span>` : ''}</button>`;
  }
  return `
    <div class="card calv-head">
      <div class="calv-title">
        <button class="btn ghost sm" data-action="cal-shift-month" data-delta="-1" title="Предыдущий месяц">‹</button>
        <h2>${MONTHS_NOM[mo]} ${y}</h2>
        <button class="btn ghost sm" data-action="cal-shift-month" data-delta="1" title="Следующий месяц">›</button>
        ${calModeToggle('month')}${calExportBtn()}${calRemindBtn()}
      </div>
      <div class="cm-wd">${WD.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cm-grid">${cells}</div>
    </div>`;
}
function renderCalendarView() {
  const date = State.calDate || (State.calDate = todayStr());
  if ((State.calMode || 'day') === 'month') return renderCalMonth(date);
  if (State.calMode === 'week') { if (!State.weekStart) State.weekStart = weekStart(todayStr()); return renderWeekly(); }
  const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const d = parseDate(date);
  const dayTasks = State.tasks.filter((t) => t.date === date);
  const scheduled = dayTasks.filter((t) => t.startTime);
  const unscheduled = dayTasks.filter((t) => !t.startTime && !t.done);
  // полоса недели вокруг выбранной даты (с понедельника)
  const js = d.getDay(), mon = addDays(date, -(js === 0 ? 6 : js - 1));
  let strip = '';
  for (let i = 0; i < 7; i++) {
    const ds = addDays(mon, i), open = State.tasks.filter((t) => t.date === ds && !t.done).length;
    strip += `<button class="calv-day ${ds === date ? 'active' : ''} ${ds === todayStr() ? 'is-today' : ''}" data-action="cal-date" data-date="${ds}">
      <span class="cd-wd">${WD[parseDate(ds).getDay()]}</span><span class="cd-n">${Number(ds.slice(8))}</span>${open ? `<span class="cd-dot">${open}</span>` : '<span class="cd-dot-empty"></span>'}</button>`;
  }
  const hours = [];
  for (let h = CAL_H0; h <= CAL_H1; h++) hours.push(h);
  const grid = hours.map((h, i) => `<div class="cal-row" style="top:${i * CAL_ROWH}px"><span class="cal-h">${pad2(h)}:00</span></div>`).join('');
  const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const nowLine = (date === todayStr() && nowMin >= CAL_H0 * 60 && nowMin <= (CAL_H1 + 1) * 60) ? `<div class="calv-now" style="top:${calMinToY(nowMin)}px"></div>` : '';
  const blocks = scheduled.map((t) => {
    const [H, M] = t.startTime.split(':').map(Number);
    const dur = Number(t.estimateMin) || 30;
    const sk = skillById(t.skillId);
    return `<div class="cal-block calv-block ${t.done ? 'done' : ''}" draggable="true" data-id="${t.id}" style="top:${calMinToY(H * 60 + M)}px;height:${Math.max(24, dur / 60 * CAL_ROWH)}px;--c:${esc(sk.color)}" title="${esc(t.title)} · ${fmtDur(dur)} — тяни, чтобы перенести">
      <button class="check sm cal-check" data-action="toggle-task" data-id="${t.id}">${t.done ? '✓' : ''}</button>
      <span class="cal-b-text"><b>${pad2(H)}:${pad2(M)}</b> ${esc(t.title)}<span class="cal-dur"> · ${fmtDur(dur)}</span></span>
      <button class="cal-x" data-action="unschedule-quest" data-id="${t.id}" title="Снять с расписания">✕</button></div>`;
  }).join('');
  const trayTasks = unscheduled.map((t) => { const sk = skillById(t.skillId); return `<span class="calv-chip" draggable="true" data-id="${t.id}" style="--c:${esc(sk.color)}" title="Тяни в сетку, чтобы поставить на время">⠿ ${esc(t.title)} <span class="muted">${fmtDur(Number(t.estimateMin) || 30)}</span></span>`; }).join('');
  const dur0 = unscheduled.length ? (Number(unscheduled[0].estimateMin) || 30) : 30;
  const picker = unscheduled.length ? `
    <div class="cal-schedule">
      <select id="cal-quest">${unscheduled.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>
      <input id="cal-time" type="time" value="09:00" title="Начало" />
      <input id="cal-dur" type="number" min="5" step="5" value="${dur0}" title="Длительность, мин" />
      <span class="cal-dur-unit muted">мин</span>
      <button class="btn ghost" data-action="schedule-quest">🗓 Поставить</button>
    </div>` : '';
  const planned = dayTasks.reduce((s, t) => s + (Number(t.estimateMin) || 0), 0);
  return `
    <div class="card calv-head">
      <div class="calv-title">
        <button class="btn ghost sm" data-action="cal-shift" data-days="-1" title="Предыдущий день">‹</button>
        <h2>${d.getDate()} ${MON[d.getMonth()]} <span class="muted">· ${WD[d.getDay()]}${date === todayStr() ? ' · сегодня' : ''}</span></h2>
        <button class="btn ghost sm" data-action="cal-shift" data-days="1" title="Следующий день">›</button>
        ${date !== todayStr() ? '<button class="btn ghost sm" data-action="cal-today">Сегодня</button>' : ''}
        <span class="wk-load muted">план: ${fmtDur(planned)}</span>
        ${calModeToggle('day')}${calExportBtn()}${calRemindBtn()}
      </div>
      <div class="calv-strip">${strip}</div>
    </div>
    <div class="card">
      <form id="add-task" class="add-row">
        <input type="hidden" name="date" value="${date}" />
        <input name="title" placeholder="Новый квест на этот день…" autocomplete="off" required />
        <select name="skillId">${skillOptionsHTML()}</select>
        <input name="estimateMin" type="number" min="0" step="1" value="30" title="Минут" />
        <select name="difficulty"><option value="easy">🌱 Лёгкая</option><option value="normal" selected>⚔️ Обычная</option><option value="hard">🔥 Сложная</option></select>
        <button type="submit">+ Квест</button></form>
    </div>
    ${unscheduled.length ? `<div class="card calv-tray"><h3>📥 Без времени (${unscheduled.length})</h3><div class="calv-chips">${trayTasks}</div>${picker}</div>` : ''}
    <div class="card">
      <p class="cal-hint muted">Тяни квест по сетке, чтобы сменить время (шаг 15 мин). Клик по пустому месту — подставить время в форму. Крестик ✕ — снять с расписания.</p>
      <div class="cal calv-grid" style="height:${hours.length * CAL_ROWH}px">${grid}${nowLine}${blocks}</div>
    </div>`;
}
// ============================================================
//  Быстрый захват + Инбокс (Блок 2) — текст/голос/видео, замена Telegram «Избранное»
// ============================================================
let _rec = null; // { kind, recorder, chunks, stream, startedAt, timer }
let _mobilSnoozeDay = null; // «Позже» для нуджа мобилки — на сегодня
// Профилактика травм: за 7 дней были силовые/единоборства, но НЕ было мобилки/растяжки?
function trainingWithoutMobility() {
  const since = addDays(todayStr(), -7);
  const strengthRe = /зал|штанг|жим|силов|присед|становая|тяга|дзюдо|единоборств|бокс|борьб|gym|judo/i;
  const mobilityRe = /растяжк|мобил|йог|разминк|гибкост|шпагат|суставн|stretch|mobility/i;
  let strength = false, mobility = false;
  for (const t of State.tasks) if (t.done && dayOf(t) >= since) { const n = normRu(t.title); if (strengthRe.test(n)) strength = true; if (mobilityRe.test(n)) mobility = true; }
  for (const d in State.habitlog) if (d >= since) for (const hid in State.habitlog[d]) { const h = habitById(hid); if (h) { const n = normRu(h.title); if (strengthRe.test(n)) strength = true; if (mobilityRe.test(n)) mobility = true; } }
  return strength && !mobility;
}

// ---- Анти-привычки (Блок 4): «чистые дни», без стыда. Срыв = данные, не провал. ----
function antiDates(a) { return (a.slips || []).slice().sort(); }
function antiLastSlip(a) { const s = antiDates(a); return s.length ? s[s.length - 1] : null; }
function antiCleanDays(a) {
  const last = antiLastSlip(a), from = last || (a.createdAt ? fmtDate(new Date(a.createdAt)) : todayStr());
  return Math.max(0, Math.round((parseDate(todayStr()) - parseDate(from)) / 86400000));
}
function antiBestStreak(a) {
  const start = a.createdAt ? fmtDate(new Date(a.createdAt)) : todayStr();
  const pts = [start, ...antiDates(a), todayStr()];
  let best = 0; for (let i = 1; i < pts.length; i++) { const gap = Math.round((parseDate(pts[i]) - parseDate(pts[i - 1])) / 86400000); if (gap > best) best = gap; }
  return best;
}
function antiHabitsCard() {
  const list = State.antihabits || []; if (!list.length) return '';
  const rows = list.map((a) => {
    const clean = antiCleanDays(a), best = antiBestStreak(a), slippedToday = antiLastSlip(a) === todayStr();
    return `<div class="anti-row">
      <div class="anti-main"><span class="anti-title">${esc(a.title)}</span>
        <span class="anti-stat">🟢 <b>${clean}</b> ${plural(clean, 'день', 'дня', 'дней')} чисто${best > clean ? ` · рекорд ${best}` : ''}</span></div>
      ${slippedToday
        ? `<button class="btn ghost sm anti-undo" data-action="anti-unslip" data-id="${a.id}">сегодня был срыв · отменить</button>`
        : `<button class="btn ghost sm" data-action="anti-slip" data-id="${a.id}">был срыв?</button>`}</div>`;
  }).join('');
  return `<div class="card anti-card"><h3>🛡 Свобода от привычек</h3>${rows}
    <p class="muted anti-note">Срыв — не провал, а данные. Без стыда: это копинг, а не ты. Заметь, что его вызвало — и иди дальше. Завтра новый чистый день 🌱</p></div>`;
}

// ============================================================
//  ИИ-ассистент (BYOK) — твой ключ Claude/OpenAI, сервер проксирует. Разбор недели «правдой о времени».
// ============================================================
// Реестр ИИ-провайдеров для UI. free=true → ключ берётся бесплатно без карты/подписки.
const AI_PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', free: true, prefix: 'AIza…', url: 'https://aistudio.google.com/api-keys', hint: 'Бесплатно, без карты — рекомендую. ~500 запросов/день.' },
  { id: 'groq', label: 'Groq · Llama 3.3', free: true, prefix: 'gsk_…', url: 'https://console.groq.com/keys', hint: 'Бесплатно, без карты, очень быстро.' },
  { id: 'anthropic', label: 'Claude (Anthropic)', free: false, prefix: 'sk-ant-…', url: 'https://console.anthropic.com/settings/keys', hint: 'Нужны кредиты (~5$), отдельно от подписки Claude.ai.' },
  { id: 'openai', label: 'OpenAI (ChatGPT)', free: false, prefix: 'sk-…', url: 'https://platform.openai.com/api-keys', hint: 'Нужны кредиты (~5$), отдельно от подписки ChatGPT.' },
];
const AI_ORDER = ['gemini', 'groq', 'anthropic', 'openai']; // приоритет автовыбора: бесплатные первыми
// Активный провайдер: предпочтение юзера (если есть ключ) → иначе первый доступный (free первыми)
function aiProvider() {
  const k = State.aiKeys || {};
  const pref = State.settings && State.settings.aiPref;
  if (pref && k[pref]) return pref;
  return AI_ORDER.find((id) => k[id]) || null;
}
function aiProviderLabel(id) { const p = AI_PROVIDERS.find((x) => x.id === id); return p ? p.label : id; }
function ensureAiKeys() { if (State.aiKeys === null) { State.aiKeys = {}; fetch('/api/ai/keys').then((r) => r.json()).then((d) => { State.aiKeys = d || {}; render(); }).catch(() => {}); } }
// Карточка ИИ-ключей: мультипровайдер + гид «получить бесплатный ключ» + выбор провайдера по умолчанию
function aiKeysCard() {
  const k = State.aiKeys || {};
  const keyed = AI_PROVIDERS.filter((p) => k[p.id]);
  const rows = AI_PROVIDERS.map((p) => {
    const saved = k[p.id];
    return `<div class="aikey-row ${saved ? 'has' : ''}">
      <div class="aikey-head"><b>${esc(p.label)}</b>${p.free ? '<span class="aikey-free">бесплатно</span>' : '<span class="aikey-paid">нужны кредиты</span>'}${saved ? '<span class="aikey-ok">✓ ключ сохранён</span>' : ''}</div>
      <div class="aikey-hint muted">${esc(p.hint)} <a href="${p.url}" target="_blank" rel="noopener">Получить ключ →</a></div>
      <input name="${p.id}" type="password" placeholder="Вставь ключ (${p.prefix})" autocomplete="off" />
    </div>`;
  }).join('');
  const prefSel = keyed.length > 1 ? `<div class="aikey-pref"><label>Использовать по умолчанию:
      <select data-action="set-ai-pref">${keyed.map((p) => `<option value="${p.id}" ${aiProvider() === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label></div>` : '';
  return `<div class="card"><h3>🤖 ИИ-ассистент (свой ключ)</h3>
    <p class="muted" style="font-size:12.5px;margin:0 0 6px">ИИ-функции (помощник 🤖, импорт целей, калибровка, разбор недели) работают на твоём ключе — так инференс бесплатен для нас, а данные идут только к выбранному ИИ.</p>
    <div class="aikey-tip">💡 Нет ключа и платной подписки? Возьми <b>бесплатный</b> у Google Gemini или Groq — 2 минуты, без карты: жми «Получить ключ», войди аккаунтом, создай ключ, вставь сюда.</div>
    <form id="ai-keys" class="aikey-form">
      ${rows}
      ${prefSel}
      <div class="aikey-actions"><button type="submit" class="btn">Сохранить</button><span id="ai-keys-msg" class="muted"></span></div>
    </form>
    <p class="muted" style="font-size:11.5px;margin:8px 0 0">Ключ хранится только на сервере (в гит не попадает, наружу отдаётся лишь признак «✓ сохранён»). Стереть — очисти поле и сохрани. Можно держать несколько и переключаться.</p></div>`;
}
// Компактная сводка недели для ИИ — реальные данные, не выдумка
function buildWeekContext() {
  const end = todayStr(), start = addDays(end, -6);
  const ev = xpEvents().filter((e) => e.date >= start && e.date <= end);
  const bySphere = {};
  for (const e of ev) { const n = e.skillId ? (skillById(e.skillId).name) : '—'; bySphere[n] = bySphere[n] || { xp: 0, min: 0 }; bySphere[n].xp += e.xp; bySphere[n].min += e.min; }
  const sphereLines = Object.entries(bySphere).sort((a, b) => b[1].min - a[1].min).map(([n, v]) => `  ${n}: ${fmtDur(v.min)}, ${v.xp} XP`).join('\n') || '  (нет активности)';
  const bal = balanceIndex();
  const en = ensureEnergy();
  const goals = (State.goals || []).filter((g) => !g.archived).map((g) => `  ${g.title} — ${goalStatusInfo(g).txt}${g.metric ? ` (${g.metric.current}/${g.metric.target}${g.metric.unit ? ' ' + g.metric.unit : ''})` : ''}`).join('\n') || '  (нет целей)';
  const anti = (State.antihabits || []).map((a) => `  ${a.title}: ${antiCleanDays(a)} дней чисто`).join('\n');
  const radar = sphereScores().map((s) => `${s.name} ур.${s.value}`).join(', ');
  return `НЕДЕЛЯ ${start}…${end}\nВремя по сферам:\n${sphereLines}\nИндекс баланса: ${bal.index}/100${bal.weakest ? ` (отстаёт: ${bal.weakest.name})` : ''}\nЭнергия сейчас: ${en.cur}/${en.max}\nРадар сфер: ${radar}\nЦели:\n${goals}${anti ? `\nАнти-привычки:\n${anti}` : ''}`;
}
async function runWeeklyReview() {
  const prov = aiProvider();
  if (!prov) { toast('Добавь ИИ-ключ в Настройках'); State.view = 'settings'; render(); return; }
  openAiModal('🤖 Разбор недели', '<p class="muted">Анализирую твою неделю…</p>', true);
  const system = 'Ты — заботливый, научно обоснованный наставник в приложении Gojo (философия «жизнь как десятиборье»). Анализируй данные недели честно и по-человечески, без воды и без льстивости. Дай: (1) что реально происходило со временем и балансом; (2) 2–3 конкретных наблюдения; (3) 1–2 мягких, выполнимых шага на след. неделю. Помни: отдых и восстановление так же ценны, как труд. Коротко, тепло, по делу. Отвечай на русском.';
  try {
    const r = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: prov, system, prompt: buildWeekContext() }) });
    const d = await r.json();
    if (!r.ok || !d.text) { openAiModal('🤖 Разбор недели', `<p class="muted">Не удалось: ${esc(d.detail || d.error || 'ошибка')}. Проверь ключ ${prov} в Настройках.</p>`); return; }
    openAiModal('🤖 Разбор недели', `<div class="ai-out">${esc(d.text).replace(/\n/g, '<br>')}</div>`);
    track('ai:weekly');
  } catch { openAiModal('🤖 Разбор недели', '<p class="muted">Сетевая ошибка.</p>'); }
}
function openAiModal(title, bodyHtml, loading) {
  let ov = document.getElementById('ai-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'ai-modal'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = `<div class="ai-box"><button class="modal-x" data-action="ai-close">✕</button><h3>${esc(title)}</h3>${loading ? '<div class="ai-spin">⏳</div>' : ''}<div class="ai-body">${bodyHtml}</div></div>`;
}
// ---- Движок «Предложений»: ИИ предлагает → ты одобряешь/отклоняешь ----
let _proposals = []; // последний полученный набор предложений
// Контекст: текущие сферы и цели, чтобы ИИ не дублировал и переиспользовал имена
function proposeContext() {
  const spheres = State.settings.skills.map((s) => skillLabel(s.id)).join(', ');
  const goals = (State.goals || []).filter((g) => !g.archived).map((g) => g.title).slice(0, 40).join('; ');
  return `Сферы: ${spheres || '(нет)'}\nЦели: ${goals || '(нет)'}`;
}
function openProposeModal(kind, prefill) {
  _proposals = [];
  const isCal = kind === 'calibrate';
  const prov = aiProvider();
  let ov = document.getElementById('propose-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'propose-modal'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = `<div class="ai-box"><button class="modal-x" data-action="propose-close">✕</button>
    <h3>${isCal ? '📊 Оценить уровни сфер' : '📥 Импорт целей текстом'}</h3>
    <p class="muted" style="font-size:12.5px;margin:0 0 10px">${isCal
      ? 'Опиши, чем и насколько уверенно занимаешься. ИИ предложит стартовые уровни — ты одобришь или отклонишь.'
      : 'Опиши свободным текстом свои цели, проекты, сферы. ИИ оформит их в цели и сферы — ты одобришь или отклонишь.'}</p>
    <textarea id="propose-text" rows="6" placeholder="${isCal
      ? 'Напр.: жму 130 кг на 2 раза; бегал до 36 км; немецкий — речь B2+, понимание C1; Abi около 1.3; монтирую видео пару лет…'
      : 'Напр.: хочу Abi 1.0–1.1; дойти до C1 немецкого; закончить проект Jugend Forscht к лету; жим 150 кг; пробежать марафон осенью…'}"></textarea>
    <div class="propose-actions">
      ${prov ? `<button class="btn" data-action="propose-run" data-kind="${kind}">🤖 Предложить (${esc(aiProviderLabel(prov))})</button>` : ''}
      <button class="btn ${prov ? 'ghost' : ''}" data-action="bridge-copy" data-kind="${kind}">📋 Через свой Claude/ChatGPT${prov ? '' : ' (без ключа)'}</button>
    </div>
    ${prov ? '' : '<p class="muted" style="font-size:11.5px;margin:8px 0 0">Нет API-ключа? Не беда — кнопка справа сделает всё через ИИ, которым ты уже пользуешься (хоть в браузере).</p>'}
    <div id="propose-result"></div></div>`;
  setTimeout(() => { const t = document.getElementById('propose-text'); if (t) { if (prefill) t.value = prefill; t.focus(); } }, 30);
}
// Карточки-предложения в #propose-result (общий рендер для API и копипаст-моста)
function renderProposalCards(res) {
  if (!res) return;
  if (!_proposals.length) { res.innerHTML = '<p class="muted">Ничего не нашлось. Добавь деталей или переформулируй.</p>'; return; }
  res.innerHTML = `<div class="prop-list">${_proposals.map((p, i) => `<label class="prop-row"><input type="checkbox" data-prop="${i}" checked/> <span class="prop-text">${esc(proposalLabel(p))}</span></label>`).join('')}</div>
    <div class="propose-actions"><button class="btn" data-action="propose-apply">✓ Применить выбранные</button> <span class="muted" style="font-size:12px">${_proposals.length} предложений · сними галочку, чтобы отклонить</span></div>`;
}
async function runPropose(kind) {
  const ta = document.getElementById('propose-text');
  const text = ((ta && ta.value) || '').trim();
  if (!text) { toast('Напиши текст'); return; }
  const res = document.getElementById('propose-result');
  if (res) res.innerHTML = '<div class="ai-spin">⏳ ИИ думает…</div>';
  try {
    const r = await fetch('/api/ai/propose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, provider: aiProvider(), text, context: proposeContext() }) });
    const d = await r.json();
    if (d.error === 'parse') { if (res) res.innerHTML = '<p class="muted">ИИ вернул не тот формат. Попробуй переформулировать короче и конкретнее.</p>'; return; }
    if (!r.ok || !d.proposals) { if (res) res.innerHTML = `<p class="muted">Не удалось: ${esc(d.detail || d.error || 'ошибка')}. Проверь ключ в Настройках.</p>`; return; }
    _proposals = d.proposals;
    renderProposalCards(res);
    track('ai:propose:' + kind);
  } catch { if (res) res.innerHTML = '<p class="muted">Сетевая ошибка.</p>'; }
}
// ---- Копипаст-мост: используем СВОЙ внешний ИИ (без API-ключа) ----
// Защищённый разбор JSON из ответа модели (клиентская версия серверного extractJson)
function extractJsonClient(text) {
  if (!text) return null;
  let t = String(text).trim();
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) t = f[1].trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j < 0 || j < i) return null;
  try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
}
const BRIDGE_GOALS = `Ты помогаешь оформить цели для приложения-планировщика Gojo (философия «жизнь как десятиборье»). На основе описания ниже верни СТРОГО JSON {"proposals":[ ... ]} — без markdown и без текста вне JSON. Элементы — одного из типов:
{"type":"sphere","name":"...","parent":"<имя родительской сферы или null>"}
{"type":"goal","title":"...","sphere":"<имя сферы>","horizon":"mission|vision|path|long|mid|short|recurring","metric":null,"status":"active|waiting|paused","window":"","parent":"<заголовок большей цели или null>"}
metric для числовых целей = {"current":N,"target":N,"unit":"кг/км/балл","lowerBetter":false,"maintain":false}.
Горизонты: mission=дело жизни, vision=10–20 лет, path=3–5 лет, long=цель года, mid=1–6 мес, short=до месяца, recurring=регулярная практика. lowerBetter:true для оценок/времени. status:"waiting"+window для событийных целей. parent — точный заголовок другой цели. Переиспользуй существующие сферы по точному имени. Русский.`;
const BRIDGE_CALIB = `Ты калибруешь уровни в приложении Gojo. На основе описания верни СТРОГО JSON {"proposals":[{"type":"level","sphere":"<имя сферы>","level":N,"note":"<кратко>"}]} — без markdown и текста вне JSON. Шкала уровня 1–20: 1=только начал, 5=регулярная практика, 10=уверенный/могу учить, 15=глубокая экспертиза, 18–20=топ. Школа/универ оценивай честно. Только по сферам из описания.`;
function copyBridgePrompt(kind) {
  const ta = document.getElementById('propose-text');
  const text = ((ta && ta.value) || '').trim();
  if (!text) { toast('Сначала опиши в поле выше — что за цели/уровни'); return; }
  const instr = kind === 'calibrate' ? BRIDGE_CALIB : BRIDGE_GOALS;
  const prompt = `${instr}\n\nТЕКУЩИЕ СФЕРЫ И ЦЕЛИ ЮЗЕРА:\n${proposeContext()}\n\nОПИСАНИЕ ОТ ЮЗЕРА:\n${text}\n\nВерни ТОЛЬКО JSON по схеме.`;
  const done = () => toast('📋 Промпт скопирован — вставь своему ИИ');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt).then(done, () => {});
  const res = document.getElementById('propose-result'); if (!res) return;
  res.innerHTML = `<div class="bridge-steps">
    <div class="bridge-step"><b>1.</b> Промпт скопирован. Не вставился? Скопируй вручную:
      <textarea class="bridge-prompt" readonly rows="3" onclick="this.select()">${esc(prompt)}</textarea></div>
    <div class="bridge-step"><b>2.</b> Вставь его своему ИИ — claude.ai, ChatGPT, любой (можно в браузере по подписке, ключ не нужен).</div>
    <div class="bridge-step"><b>3.</b> Скопируй его ответ и вставь сюда:
      <textarea id="bridge-json" rows="4" placeholder="Вставь ответ ИИ (JSON) сюда…"></textarea>
      <button class="btn" data-action="bridge-parse" data-kind="${kind}">Разобрать ответ →</button></div>
  </div>`;
  done();
}
function parseBridgeResponse() {
  const ta = document.getElementById('bridge-json');
  const raw = (ta && ta.value || '').trim();
  const res = document.getElementById('propose-result');
  if (!raw) { toast('Вставь ответ ИИ'); return; }
  const parsed = extractJsonClient(raw);
  if (!parsed || !Array.isArray(parsed.proposals)) { if (res) res.insertAdjacentHTML('beforeend', '<p class="muted" style="margin-top:8px">Не нашёл корректный JSON в ответе. Скопируй ответ ИИ целиком (он должен содержать {"proposals":[…]}).</p>'); return; }
  _proposals = parsed.proposals.slice(0, 40);
  renderProposalCards(res);
  track('ai:bridge');
}
function proposalLabel(p) {
  if (p.type === 'sphere') return `➕ Сфера: ${p.name}${p.parent ? ` (внутри «${p.parent}»)` : ''}`;
  if (p.type === 'level') return `📊 Уровень: ${p.sphere} → ур.${p.level}${p.note ? ` — ${p.note}` : ''}`;
  if (p.type === 'goal') {
    const m = (p.metric && p.metric.target != null) ? ` · ${p.metric.current}→${p.metric.target}${p.metric.unit ? ' ' + p.metric.unit : ''}` : '';
    const w = p.status === 'waiting' ? ` · ⏳ждёт${p.window ? ' ' + p.window : ''}` : (p.status === 'paused' ? ' · ⏸' : '');
    return `🎯 Цель: ${p.title} · ${p.sphere} · ${goalTypeLabel(p.horizon)}${m}${w}`;
  }
  return JSON.stringify(p).slice(0, 80);
}
function applyAcceptedProposals() {
  const set = new Set([...document.querySelectorAll('#propose-result input[data-prop]:checked')].map((el) => Number(el.dataset.prop)));
  if (!set.size) { toast('Ничего не выбрано'); return; }
  const n = applyProposals(_proposals, set);
  const m = document.getElementById('propose-modal'); if (m) m.remove();
  toast(`✓ Применено: ${n}`); checkAchievements(); render();
}
// Применяет принятые предложения. Порядок: сферы → уровни → цели (с резолвом родителей по имени).
function applyProposals(proposals, acceptedIdx) {
  const accepted = proposals.filter((_, i) => acceptedIdx.has(i));
  const c = State.settings.curve;
  const palette = ['#4f86f7', '#5fbf5f', '#e0526a', '#b06ff0', '#e0a23e', '#22c1a4', '#e87d3e', '#8899bb'];
  const findSphere = (name) => name && State.settings.skills.find((s) => normRu(s.name) === normRu(name));
  let pi = State.settings.skills.length, applied = 0;
  // 1) Сферы
  accepted.filter((p) => p.type === 'sphere' && p.name).forEach((p) => {
    if (findSphere(p.name)) return;
    State.settings.skills.push({ id: 'sk_' + uid(), name: String(p.name).slice(0, 40), color: p.color || palette[pi++ % palette.length], parentId: null });
    applied++;
  });
  // Привязка родителей сфер (после создания всех в батче)
  accepted.filter((p) => p.type === 'sphere' && p.parent).forEach((p) => {
    const sk = findSphere(p.name), par = findSphere(p.parent);
    if (sk && par && sk.id !== par.id && !sk.parentId) sk.parentId = par.id;
  });
  // 2) Уровни (калибровка) → импортированный стартовый XP
  accepted.filter((p) => p.type === 'level').forEach((p) => {
    const sk = findSphere(p.sphere); if (!sk) return;
    const lvl = Math.max(1, Math.min(25, Math.round(Number(p.level) || 1)));
    State.settings.imported = State.settings.imported || {};
    State.settings.imported[sk.id] = { tier: null, xp: xpForLevel(lvl, c.skillBase, c.growth), label: '🤖 ИИ: ' + String(p.note || '').slice(0, 60), at: new Date().toISOString() };
    applied++;
  });
  // 3) Цели — два прохода (создать, затем привязать родителей по точному заголовку)
  const made = [];
  accepted.filter((p) => p.type === 'goal' && p.title).forEach((p) => {
    const sk = findSphere(p.sphere) || State.settings.skills[0]; if (!sk) return;
    const type = ['mission', 'vision', 'path', 'long', 'mid', 'short', 'recurring'].includes(p.horizon) ? p.horizon : 'mid';
    let metric = null;
    if (p.metric && p.metric.target != null) {
      const cur = Number(p.metric.current) || 0;
      metric = { start: cur, current: cur, target: Number(p.metric.target), unit: String(p.metric.unit || '').slice(0, 12), lowerBetter: !!p.metric.lowerBetter, maintain: !!p.metric.maintain, everReached: false, log: [] };
    }
    const g = { id: 'g_' + uid(), title: String(p.title).slice(0, 120), skillId: sk.id, type, xpReward: GOAL_XP[type], parentId: null, _parentTitle: p.parent || null, targetDate: null, steps: [], metric, status: ['waiting', 'paused'].includes(p.status) ? p.status : 'active', window: String(p.window || '').slice(0, 40), createdAt: new Date().toISOString(), completedAt: null, archived: false };
    State.goals.push(g); made.push(g); applied++;
  });
  made.forEach((g) => {
    if (g._parentTitle) { const par = State.goals.find((x) => x.id !== g.id && normRu(x.title) === normRu(g._parentTitle)); if (par) g.parentId = par.id; }
    delete g._parentTitle;
    if (g.metric) refreshGoalCompletion(g);
  });
  ensureTrees();
  Store.save('settings', State.settings); Store.save('goals', State.goals); Store.save('skilltree', State.tree);
  return applied;
}
// ---- ИИ тех-поддержка / гид (Блок 2): постоянный помощник, знает функции и философию ----
const GOJO_MANUAL = `Ты — встроенный помощник приложения Gojo (геймификация жизни). Философия: «жизнь как десятиборье» — ценится баланс многих сфер, а не одна вертикаль; отдых и восстановление так же важны, как труд; уровень = доказанное мастерство, оно НЕ сгорает (как чёрный пояс). Твоя роль — тёплая постоянная тех-поддержка и гид: помогаешь разобраться в функциях, подсказываешь, что юзер недоиспользует, объясняешь механики простыми словами. Отвечай КРАТКО, по делу, дружелюбно, на русском. Ты не можешь сам нажимать кнопки — направляй словами (куда зайти, что нажать). Если юзер описывает свои цели или опыт — посоветуй кнопку «🤖 Импорт целей» (вкладка Цели) или «🤖 Оценить через ИИ» (Настройки → Импорт), они оформят это автоматически.

ФУНКЦИИ И ГДЕ ОНИ:
• Сегодня — квесты на день (разовые дела), сложность 🌱лёгкая/⚔️обычная/🔥сложная. ▶ у квеста = фокус-таймер (помодоро + плавающее окно ↗ поверх всех окон). Галочка = XP + золото. Привычки — повторяющиеся дела со стриком. Энергия — индикатор дневной нагрузки, восстанавливается ПАССИВНО по времени (логировать отдых не нужно), ни на что не влияет, честная «оценка по задачам». Хайп — выполни 🔥сложный квест → временный бонус +15% XP за стак (до +45%, на 2 ч); «через силу» тратит больше энергии, «в кураже» меньше.
• Заметки — быстрый захват: текст / 🎤голос / 🎥видео, хранятся как в приложении «Заметки». Заметку можно превратить в квест (кнопка → Квест).
• Календарь — Apple-стиль, неделя/месяц, перетаскивание, напоминалки.
• Персонаж — кастом-аватар (лицо/причёска/цвета), атрибуты (Сила/Интеллект/Дух…) растут из сфер → радар-билд и архетип; силуэт телосложения меняется от тренировок и веса.
• Цели — горизонты: ★Миссия (полярная звезда, зачем всё) → видение 10–20 лет → путь 3–5 лет → долго / средне / кратко → повтор. Привязка к большей цели (parent) рисует цепочку «↑ зачем». Цель = чек-лист ИЛИ числовая (текущее→цель, лог рекордов, режим «держать» для KPI вроде жима/оценок). Статусы: активна / ⏳ ждёт события / ⏸ пауза.
• Навыки — у каждой сферы дерево; за уровни навыка копятся очки, открывай узлы (пассивный бонус к XP сферы); «✏️ Редактор» — конструктор узлов под себя.
• Награды — магазин на золото (придумай свои награды!), сундуки за активность дня (рулетка: золото / XP-бусты / титулы), ачивки.
• Неделя — недельный обзор и планирование.
• Статистика — ранг, Индекс баланса (ровно ли развиты сферы — суть десятиборья), ранги по сферам, графики XP/времени, «🤖 Разбор недели» (ИИ-анализ твоей реальной недели).
• Рейтинг — соревнование по XP со всеми на сервере (видны только имя/аватар/уровень/ранг, задачи приватны; можно скрыться).
• Настройки — сферы жизни (иерархия N уровней: Учёба→Школа→Bio LK), Импорт достижений (отметь реальный уровень → стартовый XP, не начинаешь с нуля; или «🤖 Оценить через ИИ»), ИИ-ключ (свой ключ питает все ИИ-функции; бесплатный без карты — Google Gemini или Groq, либо платные Claude/OpenAI), кривые XP, бэкапы данных.

Важно — Уровень vs Форма: уровень не сгорает; Форма — отдельный показатель свежести, мягко падает если забросил сферу и быстро возвращается (жизнь не наказывает за паузу).`;
const CHAT_SUGGESTIONS = ['Какие функции я не использую?', 'Как импортировать мой реальный опыт?', 'Объясни энергию и Хайп', 'Чем цель-метрика отличается от чек-листа?', 'Что такое Индекс баланса?'];
// Живой контекст юзера — чтобы советы были не абстрактные
function chatUserContext() {
  const c = State.settings.curve, lvl = levelInfo(overallXp(), c.base, c.growth).level;
  const spheres = State.settings.skills.map((s) => `${skillLabel(s.id)} (ур.${skillLevelOf(s.id)})`).join(', ');
  const bal = balanceIndex();
  const goalsN = (State.goals || []).filter((g) => !g.archived).length;
  const noImports = !Object.keys((State.settings && State.settings.imported) || {}).length;
  return `КОНТЕКСТ ЮЗЕРА СЕЙЧАС: уровень персонажа ${lvl}; сферы: ${spheres || '(нет)'}; целей: ${goalsN}; индекс баланса ${bal.index}/100${bal.weakest ? ` (отстаёт «${bal.weakest.name}»)` : ''}; импорт опыта ${noImports ? 'НЕ сделан' : 'сделан'}; открытая вкладка: ${State.view}.`;
}
function openHelperChat() {
  let ov = document.getElementById('helper-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'helper-modal'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  const noKey = !aiProvider();
  ov.innerHTML = `<div class="ai-box chat-box"><button class="modal-x" data-action="helper-close">✕</button>
    <h3>🤖 Помощник Gojo</h3>
    ${noKey ? `<p class="muted">Помощник работает на твоём ИИ-ключе. Не хочешь платить? Возьми <b>бесплатный</b> ключ Google Gemini или Groq за 2 минуты (без карты) — в Настройках есть пошаговый гид.<br><button class="btn" data-action="helper-to-settings" style="margin-top:10px">⚙️ Подключить ИИ</button></p>`
      : `<div id="chat-msgs" class="chat-msgs"></div>
         <form id="chat-form" class="chat-form"><input id="chat-input" placeholder="Спроси про любую функцию…" autocomplete="off" /><button type="submit" class="cap-add" title="Отправить">↵</button></form>`}</div>`;
  if (!noKey) { renderChatMessages(); setTimeout(() => { const i = document.getElementById('chat-input'); if (i) i.focus(); }, 30); }
}
function renderChatMessages() {
  const box = document.getElementById('chat-msgs'); if (!box) return;
  if (!State.chatLog.length) {
    box.innerHTML = `<div class="chat-empty"><p class="muted">Привет! Я знаю все функции Gojo и помогу разобраться. Спроси меня или начни с подсказки:</p>
      <div class="chat-suggs">${CHAT_SUGGESTIONS.map((s) => `<button class="chat-sugg" data-action="chat-suggest" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    return;
  }
  box.innerHTML = State.chatLog.map((m) => m.role === 'user'
    ? `<div class="chat-msg me">${esc(m.content)}</div>`
    : `<div class="chat-msg ai">${esc(m.content).replace(/\n/g, '<br>')}</div>`).join('') + (State._chatBusy ? '<div class="chat-msg ai typing">…</div>' : '');
  box.scrollTop = box.scrollHeight;
}
async function sendChat(text) {
  text = String(text || '').trim(); if (!text || State._chatBusy) return;
  if (!aiProvider()) { openHelperChat(); return; }
  State.chatLog.push({ role: 'user', content: text });
  State._chatBusy = true; renderChatMessages();
  const inp = document.getElementById('chat-input'); if (inp) inp.value = '';
  try {
    const system = GOJO_MANUAL + '\n\n' + chatUserContext();
    const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: aiProvider(), system, messages: State.chatLog.slice(-20) }) });
    const d = await r.json();
    State._chatBusy = false;
    if (!r.ok || !d.text) { State.chatLog.push({ role: 'assistant', content: `⚠️ Не удалось: ${d.detail || d.error || 'ошибка'}. Проверь ИИ-ключ в Настройках.` }); }
    else { State.chatLog.push({ role: 'assistant', content: d.text }); track('ai:chat'); }
    renderChatMessages();
  } catch { State._chatBusy = false; State.chatLog.push({ role: 'assistant', content: '⚠️ Сетевая ошибка.' }); renderChatMessages(); }
}
function captureBar() {
  if (_rec) {
    return `<div class="card capture-card recording">
      <div class="cap-rec"><span class="cap-dot"></span><span>${_rec.kind === 'video' ? '🎥' : '🎤'} Запись <span id="rec-timer">0:00</span></span>
      <button class="btn" data-action="cap-stop">⏹ Стоп · сохранить</button></div></div>`;
  }
  return `<div class="card capture-card">
    <form id="capture-form" class="cap-row">
      <input name="text" placeholder="Быстрая мысль, идея, план — в Заметки…" autocomplete="off" />
      <button type="button" class="cap-btn" data-action="cap-voice" title="Голосовая заметка">🎤</button>
      <button type="button" class="cap-btn" data-action="cap-video" title="Видео-заметка">🎥</button>
      <button type="submit" class="cap-add" title="Сохранить заметку">↵</button>
    </form></div>`;
}
// Карточка-заметка: редактируемый текст + плеер (если медиа) + действия
function noteCard(it) {
  const media = it.file ? (it.kind === 'video'
    ? `<video class="note-media" controls preload="metadata" src="/api/inbox/media/${esc(it.file)}"></video>`
    : `<audio class="note-media" controls preload="metadata" src="/api/inbox/media/${esc(it.file)}"></audio>`) : '';
  const icon = it.kind === 'voice' ? '🎤' : it.kind === 'video' ? '🎥' : '📝';
  const when = (it.at || '').replace('T', ' ').slice(0, 16);
  return `<div class="card note-card">
    <div class="note-top"><span class="note-when muted">${icon} ${esc(when)}</span>
      <span class="note-acts">${(it.text || '').trim() ? `<button class="btn ghost sm" data-action="note-to-goal" data-id="${it.id}" title="ИИ оформит заметку в цели/квесты">🤖 → Цель</button>` : ''}<button class="btn ghost sm" data-action="note-quest" data-id="${it.id}" title="Сделать квестом на сегодня">→ Квест</button><button class="del" data-action="note-del" data-id="${it.id}" title="Удалить">✕</button></span></div>
    ${media}
    <textarea class="note-text" data-action="note-edit" data-id="${it.id}" rows="2" placeholder="${it.file ? 'Подпиши заметку…' : 'Текст заметки…'}">${esc(it.text || '')}</textarea></div>`;
}
function notesPeekToday() {
  const n = (State.inbox || []).length; if (!n) return '';
  return `<div class="card notes-peek"><button class="nudge" data-action="goto-notes">📝 ${n} ${plural(n, 'заметка', 'заметки', 'заметок')} — открыть</button></div>`;
}
function renderNotes() {
  const notes = State.inbox || [];
  return `${captureBar()}
    <div class="card"><p class="muted" style="margin:0">📝 Лови любые мысли — идеи проектов, личное, планы. Всё хранится в одном месте. Потом примени в Gojo (→ Квест) или разберёшь с ИИ (скоро).</p></div>
    ${notes.length ? notes.map(noteCard).join('') : '<div class="card"><p class="muted">Пусто. Запиши первую мысль в строке выше ↑ (текст, 🎤 голос или 🎥 видео).</p></div>'}`;
}
function blobToDataUrl(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
async function startCapture(kind) {
  if (_rec) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Браузер не поддерживает запись'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia(kind === 'video' ? { audio: true, video: { width: 640, height: 480 } } : { audio: true }); }
  catch { toast('Нужен доступ к ' + (kind === 'video' ? 'камере' : 'микрофону')); return; }
  const recorder = new MediaRecorder(stream);
  _rec = { kind, recorder, chunks: [], stream, startedAt: Date.now(), timer: null };
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) _rec.chunks.push(e.data); };
  recorder.onstop = onCaptureStop;
  recorder.start();
  _rec.timer = setInterval(() => {
    const el = document.getElementById('rec-timer'); const s = Math.floor((Date.now() - _rec.startedAt) / 1000);
    if (el) el.textContent = Math.floor(s / 60) + ':' + pad2(s % 60);
    if (s >= 120) stopCapture(); // авто-стоп 2 мин
  }, 250);
  render();
}
function stopCapture() { if (_rec && _rec.recorder && _rec.recorder.state !== 'inactive') _rec.recorder.stop(); }
async function onCaptureStop() {
  const rec = _rec; if (!rec) return;
  clearInterval(rec.timer);
  rec.stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(rec.chunks, { type: rec.recorder.mimeType || (rec.kind === 'video' ? 'video/webm' : 'audio/webm') });
  _rec = null; render();
  if (!blob.size) { toast('Пустая запись'); return; }
  try {
    const dataUrl = await blobToDataUrl(blob);
    const r = await fetch('/api/inbox/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl, kind: rec.kind }) });
    if (!r.ok) { toast('Не удалось сохранить запись'); return; }
    const d = await r.json();
    State.inbox.unshift({ id: uid(), kind: rec.kind, text: '', file: d.file, type: d.type, at: new Date().toISOString() });
    Store.save('inbox', State.inbox); track('capture:' + rec.kind); toast(rec.kind === 'video' ? '🎥 Видео в Заметках' : '🎤 Голос в Заметках'); render();
  } catch { toast('Ошибка сохранения записи'); }
}
function renderToday() {
  const today = todayStr();
  const todays = State.tasks.filter((t) => t.date === today);
  const overdue = State.tasks.filter((t) => !t.done && t.date < today);
  const habits = todaysHabits();
  const day = State.days[today] || { reflection: '', closed: false };
  const planned = todays.reduce((s, t) => s + (Number(t.estimateMin) || 0), 0);
  const doneCount = todays.filter((t) => t.done).length;
  const todayEv = xpEvents().filter((e) => e.date === today);
  const xpToday = todayEv.reduce((s, e) => s + e.xp, 0), goldToday = todayEv.reduce((s, e) => s + e.gold, 0), minToday = todayEv.reduce((s, e) => s + e.min, 0);
  const skillOpts = skillOptionsHTML();
  const tm = State.timer, tmTask = tm ? questById(tm.taskId) : null;

  const timerCard = `<div class="card timer-card">
      <div class="timer-left"><div class="timer-clock" id="timer-clock">${fmtClock(timerElapsedMs())}</div>
        <div class="timer-task">${tm ? (tmTask ? '🎯 ' + esc(tmTask.title) : '(задача удалена)') : 'Таймер фокуса — нажми ▶ у квеста'}</div></div>
      <div class="timer-controls">${tm ? `${tm.running ? '<button class="btn ghost" data-action="timer-pause">⏸ Пауза</button>' : '<button class="btn" data-action="timer-resume">▶ Продолжить</button>'}<button class="btn" data-action="timer-stop">⏹ Стоп · записать</button><button class="btn ghost" data-action="open-pip" title="Плавающее окно поверх всех приложений">↗ Окно</button>` : ''}</div></div>`;

  // Энергия (идея 19) — индикатор нагрузки/восстановления
  const en = ensureEnergy(), eP = energyPct(), eM = energyMeta();
  const energyCard = `<div class="card energy-card" title="Энергия — индикатор нагрузки за день. Сложные квесты тратят. Восстановление ПАССИВНОЕ: идёт само по реальному времени (паузы, вечер, сон ночью) — логировать отдых не нужно. Не блокирует ничего, на XP не влияет. Ёмкость растёт, когда чередуешь нагрузку и восстановление (как в тренировках). Это оценка по задачам — точнее будет позже через часы.">
      <div class="en-head"><span class="en-ic">${eM.icon}</span><b>Энергия</b><span class="en-num" style="color:${eM.color}">${en.cur} / ${en.max}</span><span class="en-text muted">· ${eM.text}</span></div>
      <div class="en-bar"><span style="width:${eP}%;background:${eM.color}"></span></div>
      <p class="en-note muted">Восстанавливается сама со временем + дела вроде сна / прогулки / растяжки / медитации <b>пополняют</b> её · ≈ оценка по задачам, точнее с Apple Watch / Garmin (позже)</p></div>`;
  const lowEnergyNudge = (eP < 25 && doneCount > 0) ? `<div class="card nudge-card en-low"><span class="nudge-boost">🪫 Много нагрузки сегодня. Отдых ценнее форсажа — энергия восстановится сама за паузами и ночью, а ёмкость вырастет.</span></div>` : '';

  const chestsAvail = lootChestsAvailable(), activeBoost = lootBoostPct(), hp = hypePct();
  const nudgeCard = (chestsAvail > 0 || activeBoost > 0 || hp > 0) ? `<div class="card nudge-card">${chestsAvail > 0 ? `<button class="nudge" data-action="goto-rewards">🎁 ${chestsAvail} ${plural(chestsAvail, 'сундук', 'сундука', 'сундуков')} ждёт — открыть</button>` : ''}${activeBoost > 0 ? `<span class="nudge-boost">⚡ +${activeBoost}% XP активен</span>` : ''}${hp > 0 ? `<span class="nudge-boost">🔥 Хайп ×${hypeState().stacks} · +${hp}% XP · ${hypeMinLeft()}м</span>` : ''}</div>` : '';
  // Нудж новичку: не начинай с нуля — импортируй реальный опыт
  const noImports = !Object.keys((State.settings && State.settings.imported) || {}).length;
  const importNudge = (noImports && earnedXp() < 200) ? `<div class="card nudge-card"><button class="nudge" data-action="goto-import">🎖 Не начинай с нуля — импортируй свой реальный опыт</button><span class="nudge-boost">отметь свой уровень в сферах → стартовый опыт</span></div>` : '';
  // Сидячий день (4+ ч планов без движения) → мягкий нудж добавить разминку (идея fb_mq3m7zjd)
  const hasMove = todays.some((t) => /размин|прогул|зарядк|растяжк|спорт|трениров|walk|stretch|gym/i.test(t.title)) || habits.some((h) => /размин|прогул|зарядк|растяжк|спорт|трениров/i.test(h.title));
  const stretchNudge = (planned >= 240 && !hasMove) ? `<div class="card nudge-card"><button class="nudge" data-action="add-stretch">🤸 ${fmtDur(planned)} сидячих планов — вставить разминку 10 мин</button><span class="nudge-boost">баланс — это тоже квест</span></div>` : '';
  // Профилактика травм (Блок 3, спек F): активные силовые/единоборства без мобилки → мягкая opt-in подсказка
  const prefs = State.settings.prefs || {};
  const showMobil = !prefs.noMobilityNudge && _mobilSnoozeDay !== today && trainingWithoutMobility();
  const mobilityNudge = showMobil ? `<div class="card nudge-card mobil-nudge">
      <div class="mobil-text"><b>🧘 Мобилка спины и плеч</b><p class="muted">Ты активно тренируешься (силовая / дзюдо), но регулярной растяжки давно не видно. Мобилка снижает риск зажимов и перегруза. <i>Это не медицинский совет — при болях сверься со специалистом.</i></p></div>
      <div class="mobil-acts"><button class="nudge" data-action="add-mobility">+ Растяжка 10 мин</button><button class="btn ghost sm" data-action="mobil-later">Позже</button><button class="btn ghost sm" data-action="mobil-never">Не показывать</button></div></div>` : '';

  const overdueCard = overdue.length ? `<div class="card overdue"><h3>⏳ Просрочено (${overdue.length})</h3>
      <ul class="tasks">${overdue.map(questRow).join('')}</ul>
      <button class="btn ghost" data-action="move-overdue" style="margin-top:10px">↪ Перенести всё на сегодня</button></div>` : '';

  return `${captureBar()}${notesPeekToday()}${timerCard}${energyCard}${lowEnergyNudge}${nudgeCard}${importNudge}${stretchNudge}${mobilityNudge}
    <div class="card"><form id="add-task" class="add-row">
        <input name="title" placeholder="Новый квест на сегодня…" autocomplete="off" required />
        <select name="skillId">${skillOpts}</select>
        <input name="estimateMin" type="number" min="0" step="1" value="30" title="Минут" />
        <select name="difficulty"><option value="easy">🌱 Лёгкая</option><option value="normal" selected>⚔️ Обычная</option><option value="hard">🔥 Сложная</option></select>
        <button type="submit">+ Квест</button></form>
      <div id="cat-suggest" class="cat-suggest"></div>
      <p class="diff-hint muted">🌱 Лёгкая — рутина, механика · ⚔️ Обычная — требует фокуса · 🔥 Сложная — вызов, выход из зоны комфорта → активирует Хайп <b>+15% XP</b></p>
    </div>
    ${overdueCard}
    <div class="card"><div class="daystat">
        <span>Квестов: <b>${doneCount}/${todays.length}</b></span>
        <span>Время: <b>${fmtDur(minToday)} / ${fmtDur(planned)}</b></span>
        <span>Опыт: <b>+${xpToday}</b> XP</span>
        <span>Золото: <b>+${goldToday}</b> 🪙</span></div>
      ${todays.length ? `<ul class="tasks">${todays.map(questRow).join('')}</ul>` : '<p class="muted">На сегодня пусто. Запланируй первый квест выше ↑</p>'}</div>
    ${todays.some((t) => t.startTime) ? `<div class="card"><button class="nudge" data-action="goto-calendar">🗓 ${todays.filter((t) => t.startTime).length} ${plural(todays.filter((t) => t.startTime).length, 'квест', 'квеста', 'квестов')} в расписании — открыть календарь</button></div>` : ''}
    <div class="card"><h3>🔁 Привычки на сегодня</h3>
      ${habits.length ? `<ul class="tasks">${habits.map(habitRow).join('')}</ul>` : '<p class="muted">На сегодня привычек нет. Добавь их в «Настройках».</p>'}</div>
    ${antiHabitsCard()}
    <div class="card shutdown"><h3>🌙 Итог дня</h3>
      <p class="muted">Квестов ${doneCount}/${todays.length} · привычек ${habits.filter((h) => habitDone(h, today)).length}/${habits.length} · ${fmtDur(minToday)} · +${xpToday} XP · +${goldToday} 🪙</p>
      <textarea id="reflection" placeholder="Рефлексия: что получилось, что перенести, как себя чувствую…">${esc(day.reflection || '')}</textarea>
      <div style="margin-top:10px"><button class="${day.closed ? 'btn ghost' : 'btn'}" data-action="${day.closed ? 'reopen-day' : 'close-day'}">${day.closed ? '✓ День закрыт — открыть заново' : 'Закрыть день'}</button></div></div>`;
}

// ============================================================
//  Вид «Цели»
// ============================================================
function goalCard(g) {
  const sk = skillById(g.skillId), prog = goalProgress(g), done = !!g.completedAt;
  const chain = goalChain(g), st = goalStatusInfo(g);
  const m = (g.metric && g.metric.target != null) ? g.metric : null;
  const xpR = g.xpReward != null ? g.xpReward : (GOAL_XP[g.type] || 50);
  let deadline = '';
  if (g.targetDate) { const left = Math.round((parseDate(g.targetDate) - parseDate(todayStr())) / 86400000); deadline = `<span class="goal-deadline ${left < 0 ? 'overdue' : ''}">📅 ${g.targetDate}${left >= 0 ? ` · ${left} ${plural(left, 'день', 'дня', 'дней')}` : ' · просрочено'}</span>`; }
  const breadcrumb = chain.length ? `<div class="goal-why" title="Зачем это — цепочка вверх до Севера">↑ ${chain.map((p) => (p.type === 'mission' ? '★ ' : '') + esc(p.title)).join(' › ')}</div>` : '';
  const metricBlock = m ? `<div class="gm-block">
      <div class="gm-head"><b>${m.current}</b> / ${m.target}${m.unit ? ' ' + esc(m.unit) : ''}${m.lowerBetter ? ' <span class="muted">↓ меньше лучше</span>' : ''}${m.maintain ? ' <span class="muted">· держать</span>' : ''}</div>
      ${g.archived ? '' : `<form class="metric-form" data-goal="${g.id}"><input name="val" type="number" step="any" placeholder="новое значение" required /><button type="submit" class="btn ghost sm">Записать</button></form>`}
      ${(m.log && m.log.length) ? `<div class="gm-log muted">рекорды: ${m.log.slice(0, 5).map((r) => `${r.value} <span>(${dmShort(r.date)})</span>`).join(' · ')}</div>` : ''}
    </div>` : '';
  const steps = g.steps.map((s) => `<li class="gstep ${s.done ? 'done' : ''}"><button class="check sm" data-action="toggle-step" data-goal="${g.id}" data-step="${s.id}">${s.done ? '✓' : ''}</button><span>${esc(s.title)}</span><button class="del" data-action="delete-step" data-goal="${g.id}" data-step="${s.id}">✕</button></li>`).join('');
  const subline = m ? `прогресс ${prog}%` : `${g.steps.filter((s) => s.done).length}/${g.steps.length} пунктов · ${prog}%`;
  const statusCtl = (done || g.archived) ? '' : `<select class="goal-status-sel" data-action="goal-status" data-id="${g.id}">
      <option value="active" ${(!g.status || g.status === 'active') ? 'selected' : ''}>▶ Активна</option>
      <option value="waiting" ${g.status === 'waiting' ? 'selected' : ''}>⏳ Жду</option>
      <option value="paused" ${g.status === 'paused' ? 'selected' : ''}>⏸ Пауза</option></select>`;
  return `<div class="card goal ${done ? 'goal-done' : ''} ${g.archived ? 'goal-archived' : ''}">
    <div class="goal-head"><div><h3>${done ? '✅ ' : ''}${esc(g.title)}</h3>
        ${breadcrumb}
        <div class="goal-meta">
          <span class="t-skill" style="--c:${esc(sk.color)}">${esc(sk.name)}</span>
          <span class="goal-type type-${g.type || 'short'}">${goalTypeLabel(g.type)}</span>
          <span class="goal-status ${st.cls}">${st.txt}</span>
          <span class="goal-xp">+${xpR} XP</span>
          ${deadline}${g.why ? `<span class="muted">— ${esc(g.why)}</span>` : ''}
        </div></div>
      <div class="goal-actions">
        ${statusCtl}
        ${done || g.archived ? `<button class="btn ghost sm" data-action="${g.archived ? 'restore-goal' : 'archive-goal'}" data-id="${g.id}">${g.archived ? '↩ Вернуть' : '🗄 В архив'}</button>` : ''}
        <button class="del" data-action="delete-goal" data-id="${g.id}" title="Удалить">✕</button>
      </div></div>
    ${metricBlock}
    <div class="progress"><span style="width:${prog}%;background:${esc(sk.color)}"></span></div>
    <div class="muted" style="font-size:12px;margin:4px 0 8px">${subline}</div>
    <ul class="gsteps">${steps}</ul>
    ${g.archived ? '' : `<form class="add-step-form" data-goal="${g.id}"><input name="step" placeholder="+ пункт чек-листа…" autocomplete="off" /><button type="submit" class="btn ghost">Добавить</button></form>`}</div>`;
}
function renderGoals() {
  const active = State.goals.filter((g) => !g.archived && !g.completedAt);
  const completed = State.goals.filter((g) => g.completedAt && !g.archived);
  const archived = State.goals.filter((g) => g.archived);
  const nearest = active.filter((g) => g.targetDate).sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1))[0];
  const skillOpts = skillOptionsHTML();
  const typeOpts = GOAL_TYPES.map((t) => `<option value="${t.id}" ${t.id === 'short' ? 'selected' : ''}>${t.label} · ${t.timeframe}</option>`).join('');
  const parentOpts = '<option value="">— самостоятельная цель —</option>' + active.map((g) => `<option value="${g.id}">↳ часть цели: ${esc(g.title)}</option>`).join('');
  const typeGuide = `<details class="gtype-guide"><summary>ℹ️ Как выбрать тип цели?</summary><div class="gtype-rows">${GOAL_TYPES.map((t) => `<div class="gtype-row"><span class="goal-type type-${t.id}">${t.label}</span><span class="gtype-tf">${t.timeframe}</span><span class="muted">${t.hint}</span></div>`).join('')}</div></details>`;

  const counts = { all: active.length };
  GOAL_TYPES.forEach((t) => { counts[t.id] = active.filter((g) => (g.type || 'short') === t.id).length; });
  const filterTabs = `<button class="gfilter ${State.goalFilter === 'all' ? 'active' : ''}" data-action="filter-goals" data-type="all">Все (${counts.all})</button>` +
    GOAL_TYPES.map((t) => `<button class="gfilter ${State.goalFilter === t.id ? 'active' : ''}" data-action="filter-goals" data-type="${t.id}">${t.label} (${counts[t.id]})</button>`).join('');
  const shown = State.goalFilter === 'all' ? active : active.filter((g) => (g.type || 'short') === State.goalFilter);

  return `
    <div class="kpis">
      <div class="kpi"><div class="v">${active.length}</div><div class="l">Активных целей</div></div>
      <div class="kpi"><div class="v">${completed.length}</div><div class="l">Достигнуто</div></div>
      <div class="kpi"><div class="v">${nearest ? nearest.targetDate.slice(5) : '—'}</div><div class="l">Ближайший дедлайн</div></div>
    </div>
    <div class="card ai-import-card">
      <div class="ai-imp-l"><b>📥 Опиши цели текстом — ИИ оформит</b><span class="muted">расскажи словами, что хочешь; ИИ предложит цели и сферы, ты одобришь</span></div>
      <button class="btn" data-action="ai-import-goals">🤖 Импорт целей</button></div>
    <div class="card"><h3>Новая цель</h3>
      ${typeGuide}
      <form id="add-goal" class="goal-form">
        <input name="title" placeholder="Чего хочешь достичь?" autocomplete="off" required />
        <select name="skillId" title="Навык">${skillOpts}</select>
        <select name="type" title="Тип цели">${typeOpts}</select>
        <input name="xpReward" type="number" min="0" placeholder="XP" title="Награда XP (пусто = по типу)" />
        <select name="parentId" title="Родительская цель — привязка к большей цели вверх до Севера">${parentOpts}</select>
        <input name="targetDate" type="date" title="Дедлайн" />
        <details class="goal-extra"><summary>📊 Число / состояние (опц.)</summary>
          <div class="gx-grid">
            <input name="mStart" type="number" step="any" placeholder="сейчас" title="Текущее значение" />
            <span class="gx-arrow">→</span>
            <input name="mTarget" type="number" step="any" placeholder="цель" title="Целевое значение — задай, чтобы цель стала числовой" />
            <input name="mUnit" placeholder="ед. (кг, км…)" title="Единица" />
            <label class="gx-check"><input type="checkbox" name="mLower" /> меньше = лучше</label>
            <label class="gx-check"><input type="checkbox" name="mMaintain" /> держать после</label>
            <select name="status" title="Состояние цели">
              <option value="active">▶ Активна</option>
              <option value="waiting">⏳ Жду события</option>
              <option value="paused">⏸ Пауза</option></select>
            <input name="window" placeholder="окно: лето / после 23.06…" title="Когда (для «жду события»)" />
          </div>
        </details>
        <button type="submit">+ Цель</button></form>
      <p class="diff-hint muted">💰 XP пусто = по типу цели: ${GOAL_TYPES.map((t) => `${t.label.toLowerCase()} ${GOAL_XP[t.id]}`).join(' · ')}. Это «курс валюты» — не накручивай себе, иначе уровень потеряет смысл.</p></div>
    <div class="card"><h3>📋 Сводка целей</h3><div class="gfilters">${filterTabs}</div></div>
    ${shown.length ? shown.map(goalCard).join('') : '<div class="card"><p class="muted">Нет активных целей этого типа. Добавь выше ↑</p></div>'}
    ${completed.length ? `<div class="section-title">Достигнутые</div>${completed.map(goalCard).join('')}` : ''}
    ${archived.length ? `<div class="section-title">🗄 Архив (${archived.length})</div>${archived.map(goalCard).join('')}` : ''}`;
}

// ============================================================
//  Вид «Навыки» (деревья навыков)
// ============================================================
function treeNodeCenter(n) { return { x: (n.x || 0) + TREE_NW / 2, y: (n.y || 0) + TREE_NH / 2 }; }
function treeLinesHTML(t, color) {
  return t.nodes.flatMap((n) => (n.requires || []).map((rid) => {
    const r = t.nodes.find((x) => x.id === rid); if (!r) return '';
    const a = treeNodeCenter(r), b = treeNodeCenter(n), on = r.unlocked && n.unlocked;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${on ? color : 'var(--line)'}" stroke-width="${on ? 3 : 2}"/>`;
  })).join('');
}
function treeBounds(t) {
  const xs = t.nodes.map((n) => n.x || 0), ys = t.nodes.map((n) => n.y || 0);
  return { width: Math.max(TREE_SX * 2 + TREE_NW, Math.max(0, ...xs) + TREE_NW + 40), height: Math.max(TREE_SY * 2, Math.max(0, ...ys) + TREE_NH + 40) };
}
function treeNodePanel(id, t) {
  const n = t.nodes.find((x) => x.id === State.treeSelNode); if (!n) return '';
  const reqs = t.nodes.filter((x) => x.id !== n.id).map((o) => `<label class="tp-req"><input type="checkbox" data-action="tree-toggle-req" data-node="${n.id}" data-req="${o.id}" ${(n.requires || []).includes(o.id) ? 'checked' : ''}/> ${esc(o.title)}</label>`).join('') || '<span class="muted">других узлов нет</span>';
  return `<div class="tree-panel">
    <div class="tp-grid">
      <label>Название<input data-action="tree-field" data-node="${n.id}" data-field="title" value="${esc(n.title)}" /></label>
      <label>Описание<input data-action="tree-field" data-node="${n.id}" data-field="desc" value="${esc(n.desc || '')}" /></label>
      <label>Цена (очки)<input type="number" min="0" step="1" data-action="tree-field" data-node="${n.id}" data-field="cost" value="${n.cost || 0}" /></label>
      <label>Бонус XP, %<input type="number" min="0" step="1" data-action="tree-field" data-node="${n.id}" data-field="perkXpPct" value="${n.perkXpPct || 0}" /></label>
    </div>
    <div class="tp-reqs"><span class="muted">Требует узлы:</span> ${reqs}</div>
    <div class="tp-actions">
      <button class="btn danger sm" data-action="tree-del-node" data-node="${n.id}">🗑 Удалить</button>
      <button class="btn ghost sm" data-action="tree-sel-node" data-node="">Закрыть</button>
    </div>
  </div>`;
}
function renderTree() {
  if (!State.treeSkill || !State.tree[State.treeSkill]) State.treeSkill = State.settings.skills[0] && State.settings.skills[0].id;
  const id = State.treeSkill, sk = skillById(id), t = State.tree[id];
  const tabs = State.settings.skills.map((s) => `<button class="tree-tab ${s.id === id ? 'active' : ''}" data-action="select-tree" data-skill="${s.id}" style="--c:${esc(s.color)}">${esc(skillLabel(s.id))} <span class="muted">ур.${skillLevelOf(s.id)}</span></button>`).join('');
  if (!t) return `<div class="card">${tabs}</div>`;
  const edit = State.treeEdit, avail = treePointsAvailable(id), { width, height } = treeBounds(t);
  const lines = treeLinesHTML(t, sk.color);
  const nodes = t.nodes.map((n) => {
    const st = n.unlocked ? 'unlocked' : nodeUnlockable(id, n) ? 'available' : 'locked';
    const sel = State.treeSelNode === n.id;
    return `<div class="tree-node ${edit ? 'editing' : st} ${sel ? 'sel' : ''}" style="left:${n.x}px;top:${n.y}px;--c:${esc(sk.color)}" data-node="${n.id}" ${edit ? '' : 'data-action="unlock-node"'}>
      <div class="tn-title">${esc(n.title)}</div><div class="tn-desc">+${n.perkXpPct || 0}% XP</div>
      <div class="tn-cost">${n.unlocked && !edit ? '✓ открыто' : '◈ ' + (n.cost || 0)}</div></div>`;
  }).join('');
  const controls = `<div class="tree-ctrls">
      <div class="tree-points">Очков: <b>${avail}</b></div>
      ${edit ? '<button class="btn ghost sm" data-action="tree-add-node">+ Узел</button>' : ''}
      <button class="btn ${edit ? '' : 'ghost'} sm" data-action="toggle-tree-edit">${edit ? '✓ Готово' : '✏️ Редактор'}</button>
    </div>`;
  return `
    <div class="card"><div class="tree-tabs">${tabs}</div></div>
    <div class="card">
      <div class="tree-head"><h3 style="margin:0">Дерево: ${esc(sk.name)}</h3>${controls}</div>
      <p class="muted" style="font-size:12px">${edit ? '✏️ Перетаскивай узлы мышкой/пальцем. Клик по узлу — настроить (название, цена, бонус, что требует). «+ Узел» добавит новый.' : 'Открытые узлы дают пассивный бонус к опыту сферы. Очко — за каждый уровень навыка.'}</p>
      <div class="tree-scroll"><div class="tree ${edit ? 'edit' : ''}" style="width:${width}px;height:${height}px">
        <svg class="tree-lines" width="${width}" height="${height}">${lines}</svg>${nodes}</div></div>
      ${edit && State.treeSelNode ? treeNodePanel(id, t) : ''}
    </div>`;
}
// Живая перерисовка линий при перетаскивании (без полного render)
function updateTreeLines() {
  const t = State.tree[State.treeSkill]; if (!t) return;
  const svg = document.querySelector('.tree-lines'); if (svg) svg.innerHTML = treeLinesHTML(t, skillById(State.treeSkill).color);
}
// Перетаскивание узлов в режиме редактора (pointer; делегировано на document)
let _treeDrag = null;
function onTreePointerDown(e) {
  if (State.view !== 'tree' || !State.treeEdit) return;
  const el = e.target.closest('.tree-node'); if (!el) return;
  const t = State.tree[State.treeSkill]; if (!t) return;
  const node = t.nodes.find((n) => n.id === el.dataset.node); if (!node) return;
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY, ox = node.x || 0, oy = node.y || 0;
  let moved = false;
  const onMove = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    node.x = Math.max(0, Math.round(ox + dx)); node.y = Math.max(0, Math.round(oy + dy));
    el.style.left = node.x + 'px'; el.style.top = node.y + 'px';
    updateTreeLines();
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp);
    if (moved) { Store.save('skilltree', State.tree); render(); }
    else { State.treeSelNode = State.treeSelNode === node.id ? null : node.id; render(); }
  };
  document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onUp);
}

// ============================================================
//  Вид «Персонаж» — живой аватар, атрибуты, телосложение
// ============================================================
function avatarEditor() {
  const cfg = avCfg(), cat = AV_PARTS[State.aveCat] ? State.aveCat : 'hair', meta = AV_PARTS[cat];
  const cats = AV_CAT_ORDER.map((k) => `<button class="ave-cat ${k === cat ? 'sel' : ''}" data-action="av-cat" data-cat="${k}">${AV_PARTS[k].label}</button>`).join('');
  let options;
  if (meta.colors) {
    options = meta.colors.map((col, i) => `<button class="ave-opt ave-color ${cfg[cat] === i ? 'sel' : ''}" data-action="av-set" data-part="${cat}" data-idx="${i}" style="background:${col}" title="${meta.label} ${i + 1}"></button>`).join('');
  } else {
    options = Array.from({ length: meta.n }, (_, i) => {
      const preview = avatarSVG(Object.assign({}, cfg, { [cat]: i }));
      return `<button class="ave-opt ${cfg[cat] === i ? 'sel' : ''}" data-action="av-set" data-part="${cat}" data-idx="${i}" title="${meta.label} ${i + 1}"><span class="ave-mini">${preview}</span></button>`;
    }).join('');
  }
  return `<div class="card avatar-editor">
    <h3>🪞 Твой персонаж</h3>
    <div class="ave-stage">${avatarSVG(cfg)}</div>
    <div class="ave-cats">${cats}</div>
    <div class="ave-options ${meta.colors ? 'is-colors' : ''}">${options}</div>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Собери свой облик. Скоро добавим больше стилей — в том числе нарисованные художником наборы.</p>
  </div>`;
}
function renderCharacter() {
  const c = State.settings.curve, oi = levelInfo(overallXp(), c.base, c.growth), cr = charRank();
  const scores = sphereScores(), arch = archetype(), b = State.settings.body || {}, bmi = bodyBMI(), bal = balanceIndex();
  const max = Math.max(3, ...scores.map((s) => s.value));
  const attrBars = scores.map((a) => `<div class="attr-row"><span class="attr-dot" style="background:${esc(a.color)}"></span><span class="attr-nm">${esc(a.name)}</span><span class="attr-bar"><span style="width:${Math.round(Math.min(100, a.value / max * 100))}%;background:${esc(a.color)}"></span></span><span class="attr-val">ур.${a.value}</span></div>`).join('');
  const balChip = bal.active >= 2 ? `<span class="bal-chip" title="Индекс баланса: равномерность твоих активных сфер + охват. Философия десятиборья — побеждает композиция, не одна вертикаль.">⚖️ Баланс ${bal.index}/100${bal.weakest ? ` · подтяни «${esc(bal.weakest.name)}»` : ''}</span>` : '';
  let bmiLabel = '';
  if (bmi) { const cat = bmi < 18.5 ? 'недовес' : bmi < 25 ? 'норма' : bmi < 30 ? 'избыток' : 'выше нормы'; bmiLabel = `<div class="bmi-label">ИМТ <b>${bmi.toFixed(1)}</b> · ${cat}${b.bodyfat ? ` · жир ${b.bodyfat}%` : ''}</div>`; }
  const bodyForm = `<form id="body-form" class="body-form">
      <label>Пол<select name="sex"><option value="" ${!b.sex ? 'selected' : ''}>—</option><option value="m" ${b.sex === 'm' ? 'selected' : ''}>М</option><option value="f" ${b.sex === 'f' ? 'selected' : ''}>Ж</option></select></label>
      <label>Рост, см<input name="height" type="number" min="100" max="250" value="${b.height || ''}" placeholder="—" /></label>
      <label>Вес, кг<input name="weight" type="number" min="30" max="300" step="0.1" value="${b.weight || ''}" placeholder="—" /></label>
      ${isPro() ? `<label>% жира<input name="bodyfat" type="number" min="3" max="60" step="0.1" value="${b.bodyfat || ''}" placeholder="—" /></label>`
      : `<label class="locked-inline" data-action="show-paywall" data-feature="Состав тела">% жира 🔒<input disabled placeholder="Pro" /></label>`}
      <button type="submit" class="btn">Сохранить</button></form>`;
  return `
    <div class="card char-hero">
      <div class="ch-avatar ch-avatar-img" style="--rc:${cr.color};--p:${oi.pct}">${avatarSVG(avCfg(), equippedCosmeticsOpts())}</div>
      <div class="ch-meta">
        <h2>${esc((State.me && State.me.name) || 'Герой')}</h2>
        <div class="ch-rank" style="--rc:${cr.color}">${cr.icon} ${cr.name} · ур.${charLevel()}</div>
        <div class="ch-arch" title="Класс определяется автоматически из названий твоих сфер">🎭 <b>${arch.name}</b> <span class="muted">— ${arch.desc}</span></div>
        ${equippedTitle() ? `<div class="ch-title" title="Звание — сменить в «Наградах → Коллекция»">🏷 ${esc(equippedTitle())}</div>` : ''}
        <div class="xp-bar" style="max-width:340px"><span style="width:${oi.pct}%"></span><i>${oi.into} / ${oi.need} XP</i></div>
        ${(() => { const of = overallForm(), fm = formMeta(of); return `<div class="ch-form" title="Форма — текущая «свежесть» по активности. В отличие от уровня (доказанное мастерство — не сгорает), форма мягко падает без тренировок и легко возвращается.">
          <span class="cf-label">Форма</span>
          <span class="cf-bar"><span style="width:${of == null ? 0 : of}%;background:${fm.color}"></span></span>
          <span class="cf-val" style="color:${fm.color}">${of == null ? '—' : of + '%'} · ${fm.text}</span>
        </div>`; })()}
      </div>
    </div>
    ${avatarEditor()}
    <div class="char-grid">
      <div class="card"><h3>🎯 Твоё десятиборье ${balChip}</h3>
        ${scores.length >= 3 ? `<div class="radar-wrap">${radarSVG(scores)}</div>` : '<p class="muted">Добавь минимум 3 сферы в «Настройках», чтобы увидеть радар баланса.</p>'}
        <div class="attr-list">${attrBars}</div>
        <p class="muted" style="font-size:12px;margin-bottom:0">Оси — твои собственные сферы (уровень с учётом под-навыков). Это твоя уникальная комбинация: цель — не пик в одной оси, а сильная форма всего многоугольника.</p></div>
      <div class="card"><h3>🧍 Телосложение</h3>
        <div class="figure-wrap">${figureSVG()}</div>${bmiLabel}
        <p class="muted" style="font-size:12px">Силуэт живой: сила расширяет плечи, выносливость подсушивает, вес влияет на талию.</p>
        ${bodyForm}</div>
    </div>`;
}

// ============================================================
//  Лутбоксы — карточка + рулетка
// ============================================================
function lootboxCard() {
  const lb = ensureLootbox(), avail = lootChestsAvailable(), act = todayActivityCount(), nextTh = lootNextThreshold();
  const earned = LOOT_THRESHOLDS.filter((th) => act >= th).length;
  const lockedExtra = Math.max(0, earned - lootTierCap());
  const boost = lootBoostPct();
  const hist = (lb.history || []).slice(0, 6).map((h) => `<li><span class="rar-dot" style="background:${(RARITY[h.rarity] || RARITY.common).color}"></span><span class="muted">${(h.at || '').slice(11, 16)}</span> ${esc(h.label)}</li>`).join('');
  const statusTxt = avail > 0 ? `Открыть (${avail})` : (nextTh ? `Ещё ${nextTh.need} ${plural(nextTh.need, 'дело', 'дела', 'дел')} до сундука` : 'На сегодня всё ✓');
  return `<div class="card lootbox-card">
    <div class="lb-head"><h3>🎁 Сундуки дня</h3>${boost ? `<span class="lb-boost">⚡ +${boost}% XP активен</span>` : ''}</div>
    <div class="lb-body">
      <div class="lb-chest ${avail > 0 ? 'ready' : 'empty'}" ${avail > 0 ? 'data-action="open-chest"' : ''}>
        <div class="lb-emoji">${avail > 0 ? '🎁' : '📦'}</div><div class="lb-status">${statusTxt}</div>
      </div>
      <div class="lb-info">
        <p class="muted" style="font-size:12px;margin:0 0 8px">Выполняй квесты и привычки — за активность дают сундуки. Внутри: золото, XP-бусты, заряд энергии и <b>косметика</b> (рамки/фоны) по рарностям. ${isPro() ? 'Pro: до 3 сундуков в день.' : 'Free: 1 сундук в день.'}</p>
        ${lockedExtra > 0 && !isPro() ? `<button class="btn pro-cta sm" data-action="show-paywall" data-feature="Больше сундуков">🔒 Ещё ${lockedExtra} ${plural(lockedExtra, 'сундук', 'сундука', 'сундуков')} — с Pro</button>` : ''}
      </div>
    </div>
    ${hist ? `<details class="lb-hist"><summary>История дропов</summary><ul class="reflections">${hist}</ul></details>` : ''}</div>`;
}
// Brawl-Stars-коллекция: видимый прогресс + экипировка рамок/фонов/званий
function collectionCard() {
  const eq = ensureCosmetics();
  const ownedCount = COSMETICS.filter((c) => ownsCosmetic(c.id)).length;
  const tile = (c) => {
    const owned = ownsCosmetic(c.id), r = RARITY[c.rarity], isEq = eq[cosmeticType(c.id)] === c.id;
    const swatch = c.ring ? `<span class="cos-prev cos-frame" style="border-color:${c.ring}"></span>` : `<span class="cos-prev cos-bg" style="background:${c.fill}"></span>`;
    return `<button class="cos-tile r-${c.rarity} ${owned ? 'owned' : 'locked'} ${isEq ? 'eq' : ''}" ${owned ? `data-action="equip-cosmetic" data-id="${c.id}"` : 'disabled'} style="--rc:${r.color}" title="${esc(c.name)} · ${r.label}${owned ? (isEq ? ' · надето' : ' · нажми, чтобы надеть') : ' · ещё не выпало'}">
      ${owned ? swatch : '<span class="cos-prev cos-lock">🔒</span>'}<span class="cos-name">${owned ? esc(c.name) : '???'}</span>${isEq ? '<span class="cos-eq">✓</span>' : ''}</button>`;
  };
  const titles = earnedTitles();
  const titleChips = titles.length
    ? `<button class="title-chip ${!eq.title ? 'eq' : ''}" data-action="equip-title" data-title="">— без звания —</button>` + titles.map((t) => `<button class="title-chip ${eq.title === t ? 'eq' : ''}" data-action="equip-title" data-title="${esc(t)}">${eq.title === t ? '★ ' : ''}${esc(t)}</button>`).join('')
    : '<span class="muted">званий пока нет — открывай достижения ниже ↓</span>';
  return `<div class="card collection-card">
    <div class="coll-head"><h3>🎨 Коллекция</h3><span class="coll-prog">${ownedCount}/${COSMETICS.length} собрано</span></div>
    <div class="coll-body">
      <div class="coll-preview" title="Так выглядит твой аватар">${avatarSVG(avCfg(), equippedCosmeticsOpts())}</div>
      <div class="coll-cats">
        <h4 class="coll-sub">Рамки</h4><div class="cos-grid">${FRAMES.map(tile).join('')}</div>
        <h4 class="coll-sub">Фоны</h4><div class="cos-grid">${BACKGROUNDS.map(tile).join('')}</div>
      </div>
    </div>
    <h4 class="coll-sub">🏷 Звания <span class="muted" style="font-size:12px;font-weight:400">— за достижения</span></h4>
    <div class="title-chips">${titleChips}</div>
  </div>`;
}
function openChest() {
  if (lootChestsAvailable() <= 0) { toast('Сундуков нет — выполни ещё дела'); return; }
  const reward = lootResolve(rollLoot());
  const rar = RARITY[reward.rarity] || RARITY.common;
  const ITEMW = 130, WINIDX = 34, N = 42;
  const labels = [], rars = [];
  for (let i = 0; i < N; i++) { if (i === WINIDX) { labels.push(reward.label); rars.push(reward.rarity || 'common'); } else { const r = lootResolve(rollLoot()); labels.push(r.label); rars.push(r.rarity || 'common'); } }
  const strip = labels.map((l, i) => `<div class="loot-item r-${rars[i]} ${i === WINIDX ? 'win' : ''}" style="--rc:${(RARITY[rars[i]] || RARITY.common).color}">${esc(l)}</div>`).join('');
  const ov = document.createElement('div'); ov.id = 'loot-modal'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="loot-box">
    <h3>Открываем сундук…</h3>
    <div class="loot-window"><div class="loot-pointer"></div><div class="loot-track" id="loot-track">${strip}</div></div>
    <div class="loot-result" id="loot-result"></div>
    <button class="btn" id="loot-claim" style="display:none">Забрать 🎉</button></div>`;
  document.body.appendChild(ov);
  const track = ov.querySelector('#loot-track'), win = ov.querySelector('.loot-window');
  const target = WINIDX * ITEMW + ITEMW / 2 - win.clientWidth / 2 + (Math.random() * 36 - 18);
  track.style.transform = 'translateX(0)';
  requestAnimationFrame(() => { track.style.transition = 'transform 3.6s cubic-bezier(.12,.72,.16,1)'; track.style.transform = `translateX(${-target}px)`; });
  setTimeout(() => {
    applyLoot(reward);
    if (typeof sfxLoot === 'function') sfxLoot(reward.rarity || 'common'); // звук по рарности (#23)
    const rEl = ov.querySelector('#loot-result');
    rEl.innerHTML = `<div class="loot-rarity" style="color:${rar.color}">${rar.label.toUpperCase()}</div><div class="loot-rline">🎉 ${esc(reward.label)}</div>`;
    rEl.classList.add('show'); rEl.style.setProperty('--rc', rar.color);
    const box = ov.querySelector('.loot-box'); box.classList.add('reveal', `r-${reward.rarity || 'common'}`);
    ov.querySelector('.loot-item.win')?.classList.add('flash');
    const claim = ov.querySelector('#loot-claim'); claim.style.display = '';
    claim.addEventListener('click', () => { ov.remove(); render(); });
  }, 3750);
}

// ============================================================
//  Подписка / Pro — карточки и paywall
// ============================================================
function subscriptionCard() {
  const e = ent(), dl = trialDaysLeft();
  const tierLabel = e.tier === 'pro' ? '💎 Pro' : (e.tier === 'trial' ? `✨ Pro-триал · ${dl} ${plural(dl, 'день', 'дня', 'дней')}` : 'Free');
  let cta = '';
  if (e.tier === 'free') {
    if (!e.trialUsed) cta += `<button class="btn" data-action="start-trial">✨ 7 дней Pro бесплатно</button>`;
    cta += `<button class="btn pro-cta" data-action="show-paywall" data-feature="Pro">💎 Оформить Pro</button>`;
  } else if (e.tier === 'trial') {
    cta += `<button class="btn pro-cta" data-action="show-paywall" data-feature="Pro">💎 Оформить Pro насовсем</button>`;
  }
  const feats = ['📊 Расширенная аналитика и Индекс баланса', '🎁 До 3 сундуков в день + редкие дропы', '🧍 Живой персонаж и кастомизация (скоро)', '🤖 ИИ-ассистент (на своём ключе — есть бесплатные)', '🎨 Темы оформления (скоро)'];
  return `<div class="card sub-card">
    <h3>Подписка — <span class="tier-badge tier-${e.tier}">${tierLabel}</span></h3>
    <ul class="pro-feats">${feats.map((f) => `<li>${f}</li>`).join('')}</ul>
    <div class="settings-actions">${cta || '<span class="muted">Спасибо за поддержку 💛</span>'}</div></div>`;
}
function securityCard() {
  return `<div class="card"><h3>🔐 Сменить PIN</h3>
    <form id="change-pin" class="pin-change">
      <input name="oldPin" type="password" inputmode="numeric" placeholder="Текущий PIN" maxlength="8" required />
      <input name="newPin" type="password" inputmode="numeric" placeholder="Новый PIN (4+)" maxlength="8" required />
      <button type="submit" class="btn">Сменить</button><span id="pin-change-msg" class="muted"></span></form></div>`;
}
function adminCard() {
  if (!State.me || !State.me.isAdmin) return '';
  // Загружаем список пользователей для select
  if (State.adminUsers === null && !State._adminUsersLoading) {
    State._adminUsersLoading = true;
    fetch('/api/users').then((r) => r.json()).then((d) => {
      State.adminUsers = Array.isArray(d) ? d : [];
      State._adminUsersLoading = false;
      if (State.view === 'settings') render();
    }).catch(() => { State.adminUsers = []; State._adminUsersLoading = false; });
  }
  const users = State.adminUsers || [];
  const datalist = users.length
    ? `<datalist id="admin-users-dl">${users.map((u) => `<option value="${esc(u.id)}">${esc(u.avatar || '')} ${esc(u.name)} (${esc(u.id)})</option>`).join('')}</datalist>`
    : '';
  const userInput = users.length
    ? `<input name="userId" list="admin-users-dl" placeholder="Найди друга по имени…" autocomplete="off" required />${datalist}`
    : `<input name="userId" placeholder="${State._adminUsersLoading ? 'Загружаю…' : 'id профиля'}" required />`;
  const recoverList = users.length
    ? `<datalist id="recover-users-dl">${users.map((u) => `<option value="${esc(u.id)}">${esc(u.avatar || '')} ${esc(u.name)} (${esc(u.id)})</option>`).join('')}</datalist>`
    : '';
  return `<div class="card"><h3>🛠 Админ — выдать Pro</h3>
    <form id="grant-pro" class="pin-change">
      ${userInput}
      <input name="days" type="number" placeholder="дней (пусто=навсегда)" min="1" style="width:170px" />
      <button type="submit" class="btn">Выдать Pro</button><span id="grant-msg" class="muted"></span></form>
    <p class="muted" style="font-size:12px">Выбери профиль из списка — поиск по имени или id. Пусто в «дней» = бессрочный Pro.</p>
    <h3 style="margin-top:16px">🗂 Данные и бэкапы юзера</h3>
    <form id="recover-data" class="pin-change">
      <input name="userId" ${users.length ? 'list="recover-users-dl"' : ''} placeholder="id или имя профиля" autocomplete="off" required />${recoverList}
      <button type="submit" class="btn ghost">Открыть</button></form>
    <p class="muted" style="font-size:12px">Посмотреть текущие данные и восстановить из автоснимка (бэкапы делаются перед каждой записью).</p>
    <h3 style="margin-top:16px">📊 Активность (аналитика)</h3>
    ${analyticsHTML()}
    <p class="muted" style="font-size:12px">Только агрегат: какие вкладки/действия используются и сколько активных в день. Без личного контента.</p></div>`;
}
function analyticsHTML() {
  if (State.analytics === undefined) {
    State.analytics = null;
    fetch('/api/admin/analytics').then((r) => r.json()).then((d) => { State.analytics = d || {}; if (State.view === 'settings') render(); }).catch(() => { State.analytics = {}; });
    return '<p class="muted">Загружаю…</p>';
  }
  if (!State.analytics || !Object.keys(State.analytics).length) return '<p class="muted">Данных пока нет.</p>';
  const days = Object.keys(State.analytics).sort().slice(-7);
  const ev = {}; const dauSet = {};
  for (const day of days) { const x = State.analytics[day]; for (const k in (x.events || {})) ev[k] = (ev[k] || 0) + x.events[k]; dauSet[day] = Object.keys(x.users || {}).length; }
  const top = Object.entries(ev).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const dauRows = days.map((d) => `<span class="an-dau" title="${d}">${d.slice(5)}: <b>${dauSet[d] || 0}</b></span>`).join('');
  const evRows = top.map(([k, v]) => `<div class="an-row"><span class="an-k">${esc(k)}</span><span class="an-v">${v}</span></div>`).join('');
  return `<div class="an-box"><div class="an-dau-row">DAU за 7 дней: ${dauRows}</div><div class="an-events">${evRows}</div></div>`;
}
function showPaywall(feature) {
  if (document.getElementById('paywall')) return;
  const e = ent();
  const trialBtn = (e.tier === 'free' && !e.trialUsed) ? `<button class="btn" data-action="start-trial">✨ 7 дней Pro бесплатно</button>` : '';
  const ov = document.createElement('div'); ov.id = 'paywall'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="paywall-box">
    <button class="modal-x" data-action="close-paywall">✕</button>
    <div class="pw-crown">💎</div>
    <h2>${feature && feature !== 'Pro' ? esc(feature) + ' — в Pro' : 'Gojo Pro'}</h2>
    <p class="muted">Открой глубину игры. Ядро всегда бесплатно — Pro добавляет силу.</p>
    <ul class="pro-feats">
      <li>📊 Расширенная аналитика и Индекс баланса</li>
      <li>🎁 До 3 сундуков в день + редкие дропы</li>
      <li>🧍 Живой персонаж и кастомизация (скоро)</li>
      <li>🤖 ИИ-ассистент (на своём ключе — есть бесплатные)</li>
      <li>🎨 Темы оформления (скоро)</li></ul>
    <div class="pw-actions">${trialBtn}<button class="btn pro-cta" data-action="do-upgrade">Оформить Pro</button></div>
    <p class="muted pw-fine">Без карты для триала. Даунгрейд никогда не удаляет данные.</p></div>`;
  document.body.appendChild(ov);
}

// ============================================================
//  Гайд «Как играть» + форма обратной связи
// ============================================================
const GUIDE_SECTIONS = [
  { icon: '⚔️', title: 'Что это', text: 'Gojo превращает жизнь в игру. Дела дают опыт и золото, ты растёшь в уровне и рангах, а кастомизируемый персонаж отражает прогресс. Не начинаешь с нуля — импортируй реальный опыт (Настройки → Импорт). Философия — «жизнь как десятиборье»: ценится баланс многих сфер, а не одна вертикаль.' },
  { icon: '📅', title: 'Сегодня', text: 'Добавляй квесты (разовые дела) на день. ▶ запускает фокус-таймер (помодоро + плавающее окно поверх всех окон). Галочка — получаешь XP и золото. Ниже — привычки и итог дня с рефлексией.' },
  { icon: '🧍', title: 'Персонаж', text: 'Настраиваемый аватар (собери лицо/причёску/цвета). Атрибуты (Сила, Интеллект, Дух…) растут из твоих сфер и рисуют радар-билд. Архетип = твои сильнейшие атрибуты. Силуэт телосложения меняется от тренировок и веса.' },
  { icon: '🎖', title: 'Уровень vs Форма', text: 'Импортируй реальный опыт в Настройках — не начинаешь с нуля. Уровень = доказанное мастерство, оно НЕ сгорает (как чёрный пояс). Форма — отдельный показатель свежести: мягко падает, если забросил сферу, и быстро возвращается. Так жизнь не наказывает тебя за паузу.' },
  { icon: '🎯', title: 'Цели', text: 'Горизонты от ★ Миссии (полярная звезда — зачем всё) вниз: видение 10–20 лет → путь 3–5 лет → долго/средне/кратко → повтор. Привязывай цель к большей (parent) — на карточке видна цепочка «↑ зачем». Цель может быть чек-листом ИЛИ числовой (текущее→цель, лог рекордов, режим «держать» для KPI вроде жима/оценок). Статусы: активна / ⏳ жду события / ⏸ пауза.' },
  { icon: '🌳', title: 'Навыки', text: 'У каждой сферы — дерево. За уровни навыка копятся очки, открывай узлы — они дают пассивный бонус к опыту сферы. Кнопка «✏️ Редактор» включает конструктор: перетаскивай узлы, добавляй свои, задавай название/цену/бонус и что требует. Сделай дерево под себя.' },
  { icon: '🎁', title: 'Награды', text: 'Трать золото в магазине наград (придумай свои!). За активность дня падают сундуки — открывай рулеткой: золото, XP-бусты, титулы. Тут же ачивки.' },
  { icon: '🔥', title: 'Хайп', text: 'Выполни «Сложный» квест — включается Хайп: временный бонус к XP (+15% за стак, до +45%, на 2 часа). Каждый следующий сложный квест усиливает и продлевает его. Награда за то, что лезешь в трудное, а не фармишь лёгкое.' },
  { icon: '📊', title: 'Статистика', text: 'Ранг, Индекс баланса (ровно ли развиты сферы — это и есть десятиборье), ранги по сферам, графики опыта и времени.' },
  { icon: '🏆', title: 'Рейтинг', text: 'Соревнование по опыту со всеми на сервере — позови друзей! Видны только имя, аватар, уровень и ранг; задачи и личные данные приватны. В рейтинге можно скрыться галочкой.' },
  { icon: '🤖', title: 'ИИ-помощник', text: 'Плавающая кнопка 🤖 (внизу справа) — постоянный помощник: знает все функции и философию Gojo, отвечает на вопросы, подсказывает что недоиспользуешь. На вкладке Цели «🤖 Импорт целей» оформит цели из твоего текста, в Настройках «🤖 Оценить через ИИ» откалибрует уровни, в Статистике «🤖 Разбор недели». Работает на твоём ключе Claude/OpenAI (Настройки → ИИ-ключ).' },
  { icon: '💎', title: 'Free и Pro', text: 'Ядро бесплатно навсегда. Pro добавляет глубину: расширенная аналитика, 3 сундука в день, состав тела, темы. ИИ-функции работают на твоём ключе (BYOK). 7-дневный триал без карты.' },
];
// ── Вложения к репортам: фото ужимаем (canvas), видео — как есть с лимитом ──
function fileToDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
function downscaleImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение')); };
    img.src = url;
  });
}
async function readAttachment(file) {
  if (file.type.startsWith('image/')) return { name: file.name, type: 'image/jpeg', dataUrl: await downscaleImage(file) };
  if (file.type.startsWith('video/')) { if (file.size > 25 * 1024 * 1024) throw new Error('Видео > 25 МБ — сократи или сожми'); return { name: file.name, type: file.type, dataUrl: await fileToDataURL(file) }; }
  throw new Error('Только фото или видео');
}
// Админ: данные и бэкапы юзера + восстановление (спасение при потере)
function dataSummary(name, val) {
  if (val == null) return '<span class="muted">нет файла</span>';
  if (name === 'settings') return `${(val.skills || []).length} сфер`;
  if (Array.isArray(val)) return `${val.length} элементов`;
  if (name === 'days' || name === 'habitlog' || name === 'weeks') return `${Object.keys(val).length} дней/записей`;
  if (typeof val === 'object') return `${Object.keys(val).length} ключей`;
  return String(val).slice(0, 40);
}
async function showUserData(userId) {
  const old = document.getElementById('userdata'); if (old) old.remove();
  let d;
  try { const r = await fetch(`/api/admin/userdata/${encodeURIComponent(userId)}`); if (!r.ok) throw 0; d = await r.json(); }
  catch { toast('Не удалось загрузить (нужен админ / нет юзера)'); return; }
  const rows = Object.keys(d.files).map((name) => {
    const backups = d.backups[name] || [];
    const bopts = backups.length
      ? `<select class="ud-stamp" data-name="${name}">${backups.map((s) => `<option value="${esc(s)}">${esc(s.replace('T', ' ').replace(/-/g, (m, i) => i < 10 ? '-' : ':').slice(0, 19))}</option>`).join('')}</select>
         <button class="btn ghost sm" data-action="restore-backup" data-user="${esc(userId)}" data-name="${name}">↩ Восстановить</button>`
      : '<span class="muted">нет снимков</span>';
    return `<tr><td><b>${name}</b></td><td>${dataSummary(name, d.files[name])}</td><td class="ud-bk">${bopts}</td></tr>`;
  }).join('');
  const ov = document.createElement('div'); ov.id = 'userdata'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="guide-box"><button class="modal-x" data-action="close-userdata">✕</button>
    <h2>🗂 Данные: <code>${esc(userId)}</code></h2>
    <p class="muted">Текущее состояние + автоснимки (бэкап перед каждой записью). Восстановление сделает снимок текущего перед откатом — не разрушительно.</p>
    <table class="ud-table"><thead><tr><th>Файл</th><th>Сейчас</th><th>Восстановить из снимка</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  document.body.appendChild(ov);
}
// Админ-вид всех репортов с вложениями
async function showReports() {
  if (document.getElementById('reports')) return;
  let list = [];
  try { const r = await fetch('/api/feedback'); if (!r.ok) throw 0; list = await r.json(); } catch { toast('Не удалось загрузить (нужен админ)'); return; }
  const KIND = { bug: '🐞 Баг', idea: '💡 Идея', other: '💬 Другое' };
  const items = list.length ? list.map((f) => {
    // ⬇ скачать — чтобы быстро отдать скрин/видео Claude'у для починки бага (Claude видит картинки)
    const media = (f.attachments || []).map((a) => {
      const url = `/api/feedback/file/${esc(a.file)}`, dl = `<a class="rep-dl" href="${url}" download="${esc(a.file)}" title="Скачать вложение">⬇ скачать</a>`;
      const el = a.type && a.type.startsWith('video/')
        ? `<video class="rep-media" controls preload="metadata" src="${url}"></video>`
        : `<a href="${url}" target="_blank"><img class="rep-media" src="${url}" alt=""/></a>`;
      return `<div class="rep-att">${el}${dl}</div>`;
    }).join('');
    return `<div class="rep-item">
      <div class="rep-head"><span class="rep-kind">${KIND[f.kind] || f.kind}</span><span class="muted">${esc((f.at || '').slice(0, 16).replace('T', ' '))} · ${esc(f.userId || '')}</span></div>
      ${f.text ? `<div class="rep-text">${esc(f.text)}</div>` : ''}
      ${media ? `<div class="rep-medias">${media}</div>` : ''}</div>`;
  }).join('') : '<p class="muted">Репортов пока нет.</p>';
  const ov = document.createElement('div'); ov.id = 'reports'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="guide-box"><button class="modal-x" data-action="close-reports">✕</button>
    <div class="rep-toolbar">
      <h2 style="margin:0">🐞 Репорты (${list.length})</h2>
      <div class="rep-toolbar-btns">
        <button class="btn ghost sm" data-action="copy-feedback-for-claude">📋 Скопировать для Claude</button>
        <a class="btn ghost sm" href="/api/feedback/export" download="gojo-feedback.json">📥 JSON</a>
      </div>
    </div>
    <p class="muted" style="margin:4px 0 10px">Файлы — <code>data/feedback/</code> · список — <code>data/feedback.json</code>. GitHub Issues: настрой <code>GITHUB_TOKEN</code> в Railway → новые репорты пойдут в Issues.</p>
    <div class="rep-list">${items}</div></div>`;
  document.body.appendChild(ov);
}
function showGuide() {
  if (document.getElementById('guide')) return;
  const secs = GUIDE_SECTIONS.map((s) => `<div class="guide-sec"><div class="gs-ic">${s.icon}</div><div><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></div></div>`).join('');
  const ov = document.createElement('div'); ov.id = 'guide'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="guide-box">
    <button class="modal-x" data-action="close-guide">✕</button>
    <h2>📖 Как играть в Gojo</h2>
    <p class="muted">Коротко по разделам. Лучший способ понять — добавить первый квест и выполнить его.</p>
    <div class="guide-list">${secs}</div>
    <h3 style="margin:6px 0 8px">💬 Нашёл баг или есть идея?</h3>
    <form id="feedback-form" class="feedback-form">
      <select name="kind"><option value="bug">🐞 Баг</option><option value="idea">💡 Идея</option><option value="other">💬 Другое</option></select>
      <textarea name="text" placeholder="Опиши, что случилось или что предлагаешь…"></textarea>
      <label class="fb-file">📎 Прикрепить фото/видео
        <input type="file" name="files" accept="image/*,video/*" multiple />
      </label>
      <div id="fb-previews" class="fb-previews"></div>
      <div class="fb-actions"><button type="submit" class="btn">Отправить</button><span id="fb-msg" class="muted"></span></div>
    </form>
    ${State.me && State.me.isAdmin ? '<button class="btn ghost" data-action="show-reports" style="margin-top:10px">🐞 Смотреть все репорты (админ)</button>' : ''}
    </div>`;
  document.body.appendChild(ov);
}

// ============================================================
//  Вид «Награды» (магазин + достижения)
// ============================================================
function renderRewards() {
  const bal = goldBalance();
  const cards = State.rewards.map((r) => `<div class="reward">
      <div class="rw-icon">${esc(r.icon || '🎁')}</div><div class="rw-name">${esc(r.name)}</div>
      <div class="rw-cost">🪙 ${r.cost}</div>
      <button class="btn ${bal >= r.cost ? '' : 'disabled'}" data-action="buy-reward" data-id="${r.id}" ${bal >= r.cost ? '' : 'disabled'}>Купить</button>
      <button class="del" data-action="delete-reward" data-id="${r.id}" title="Удалить">✕</button></div>`).join('');
  const history = (State.purchases || []).slice().reverse().slice(0, 8).map((p) => `<li><span class="muted">${(p.at || '').slice(0, 10)}</span> ${esc(p.name)} — 🪙 ${p.cost}</li>`).join('');
  const achs = ACHIEVEMENTS.map((a) => {
    const got = !!State.achievements[a.id];
    let pr = '';
    if (!got && a.prog) { try { const p = a.prog(); pr = `<div class="ach-prog">${p.cur}/${p.target}</div>`; } catch {} }
    return `<div class="ach ${got ? 'got' : ''}"><div class="ach-icon">${a.icon}</div><div class="ach-title">${esc(a.title)}</div><div class="ach-desc">${esc(a.desc)}</div>${got ? `<div class="ach-date">${State.achievements[a.id].slice(0, 10)}</div>` : pr}</div>`;
  }).join('');
  return `
    ${lootboxCard()}
    ${collectionCard()}
    <div class="kpis">
      <div class="kpi"><div class="v">🪙 ${bal}</div><div class="l">Баланс золота</div></div>
      <div class="kpi"><div class="v">${COSMETICS.filter((c) => ownsCosmetic(c.id)).length}/${COSMETICS.length}</div><div class="l">Косметики</div></div>
      <div class="kpi"><div class="v">${ACHIEVEMENTS.filter((a) => State.achievements[a.id]).length}/${ACHIEVEMENTS.length}</div><div class="l">Достижений</div></div>
    </div>
    <div class="card"><h3>🎁 Магазин наград</h3><div class="rewards-grid">${cards || '<p class="muted">Наград пока нет — возьми готовые из каталога ↓</p>'}</div>
      <div class="settings-actions" style="margin:10px 0 4px"><button class="btn ghost" data-action="open-reward-catalog">📚 Каталог наград</button>${!isPro() ? `<span class="muted" style="font-size:12px">${State.rewards.length}/${FREE_REWARDS_MAX} наград (Free)</span>` : ''}</div>
      <form id="add-reward" class="reward-form">
        <input name="name" placeholder="Своя награда…" autocomplete="off" required />
        <input name="icon" placeholder="🎁" maxlength="2" style="width:60px;text-align:center" />
        <input name="cost" type="number" min="1" value="100" style="width:90px" />
        <button type="submit">+ Награда</button></form></div>
    <div class="card"><h3>История покупок</h3>${history ? `<ul class="reflections">${history}</ul>` : '<p class="muted">Пока ничего не куплено.</p>'}</div>
    <div class="card"><h3>🏆 Достижения</h3><div class="ach-grid">${achs}</div></div>`;
}

// ============================================================
//  Вид «Неделя»
// ============================================================
function rangeStats(start, end) {
  const ev = xpEvents().filter((e) => e.date >= start && e.date <= end);
  const xp = ev.reduce((s, e) => s + e.xp, 0), gold = ev.reduce((s, e) => s + e.gold, 0), min = ev.reduce((s, e) => s + e.min, 0);
  const quests = State.tasks.filter((t) => t.done && dayOf(t) >= start && dayOf(t) <= end).length;
  let habitsC = 0; for (const d in State.habitlog) if (d >= start && d <= end) habitsC += Object.keys(State.habitlog[d]).length;
  const byArea = leafSkills().map((s) => ({ label: skillLabel(s.id), value: ev.filter((e) => e.skillId === s.id).reduce((a, e) => a + e.min, 0), color: s.color }));
  return { xp, gold, min, quests, habitsC, byArea };
}
function renderWeekly() {
  const ws = State.weekStart, end = addDays(ws, 6), st = rangeStats(ws, end);
  const wk = State.weeks[ws] || { intention: '', review: '' };
  const isThis = ws === weekStart(todayStr());
  const today = todayStr();
  // js getDay(): 0=Вс,1=Пн,...,6=Сб — карта для быстрого доступа
  const WD_BY_JS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const dayCols = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const isToday = d === today;
    const isPast = d < today;
    const dayTasks = State.tasks.filter((t) => t.date === d);
    const doneCount = dayTasks.filter((t) => t.done).length;
    const plannedMin = dayTasks.reduce((s, t) => s + (Number(t.estimateMin) || 0), 0);
    const dueHabits = habitsDueOn(d);
    const wdLbl = WD_BY_JS[parseDate(d).getDay()];
    const adding = State.wkAddDate === d;

    const tasksHtml = dayTasks.length
      ? dayTasks.map((t) => {
          const sk = skillById(t.skillId);
          return `<div class="wk-task${t.done ? ' done' : ''}" draggable="true" data-task="${t.id}">
            <button class="check sm" data-action="toggle-task" data-id="${t.id}">${t.done ? '✓' : ''}</button>
            <span class="wk-t-title" title="${esc(t.title)} · ${fmtDur(t.estimateMin)}">${esc(t.title)}</span>
            <span class="wk-t-dot" style="background:${esc(sk.color)}" title="${esc(sk.name)}"></span>
          </div>`;
        }).join('')
      : `<p class="wk-empty muted">Пусто</p>`;

    const habitsHtml = dueHabits.length
      ? `<div class="wk-habits-dots">${dueHabits.map((h) => {
          const done = habitDone(h, d);
          const sk = skillById(h.skillId);
          return `<span class="wk-h-dot${done ? ' done' : ''}" style="--c:${esc(sk.color)}" title="${esc(h.title)}${done ? ' ✓' : ''}"></span>`;
        }).join('')}</div>`
      : '';

    const addArea = adding
      ? `<form class="wk-add-form" data-date="${d}">
          <input name="title" placeholder="Название квеста…" autocomplete="off" required />
          <select name="skillId">${skillOptionsHTML()}</select>
          <div class="wk-add-btns">
            <button type="submit" class="btn sm">+</button>
            <button type="button" class="btn ghost sm" data-action="wk-add-cancel">✕</button>
          </div>
         </form>`
      : `<button class="wk-add-btn" data-action="wk-add-task" data-date="${d}">+ Квест</button>`;

    return `<div class="wk-col${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}" data-date="${d}">
      <div class="wk-col-head">
        <span class="wk-wd">${wdLbl}</span>
        <span class="wk-date">${dmShort(d)}</span>
        ${dayTasks.length ? `<span class="wk-prog${doneCount === dayTasks.length ? ' all-done' : ''}">${doneCount}/${dayTasks.length}</span>` : ''}
      </div>
      ${plannedMin ? `<div class="wk-load" title="Запланировано времени на день">⏱ ${fmtDur(plannedMin)}</div>` : ''}
      <div class="wk-tasks">${tasksHtml}</div>
      ${habitsHtml}
      ${addArea}
    </div>`;
  }).join('');

  const reflections = Object.entries(State.days)
    .filter(([d, v]) => d >= ws && d <= end && v.reflection && v.reflection.trim())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([d, v]) => `<li><span class="date">${d}</span><br>${esc(v.reflection)}</li>`)
    .join('');

  return `
    <div class="card week-nav">
      <button class="btn ghost" data-action="week-prev">←</button>
      <div><b>Неделя ${dmShort(ws)} – ${dmShort(end)}</b>${isThis ? ' <span class="muted">(текущая)</span>' : ''}</div>
      <button class="btn ghost" data-action="week-next">→</button>
      ${calModeToggle('week')}
    </div>
    <div class="kpis">
      <div class="kpi"><div class="v">${st.xp}</div><div class="l">XP за неделю</div></div>
      <div class="kpi"><div class="v">🪙 ${st.gold}</div><div class="l">Золото</div></div>
      <div class="kpi"><div class="v">${st.quests}</div><div class="l">Квестов</div></div>
      <div class="kpi"><div class="v">${st.habitsC}</div><div class="l">Привычек</div></div>
      <div class="kpi"><div class="v">${Math.round(st.min / 60 * 10) / 10}ч</div><div class="l">Времени</div></div>
    </div>
    <p class="wk-hint muted">↔ Перетащи квест на другой день, чтобы перенести. ⏱ — запланированное время дня.</p>
    <div class="wk-grid-wrap">
      <div class="wk-grid">${dayCols}</div>
    </div>
    <div class="card"><h3>📊 Время по сферам</h3>${barChartSVG(st.byArea)}</div>
    <div class="card"><h3>🎯 Намерение на неделю</h3>
      <textarea id="week-intention" placeholder="Что главное на этой неделе? Куда направить фокус…">${esc(wk.intention || '')}</textarea>
      <h3 style="margin-top:14px">🔄 Итоги недели</h3>
      <textarea id="week-review" placeholder="Что получилось, что нет, что перенести…">${esc(wk.review || '')}</textarea>
      <div style="margin-top:10px"><button class="btn" data-action="save-week">Сохранить</button>
    </div></div>
    ${reflections ? `<div class="card"><h3>Рефлексии этой недели</h3><ul class="reflections">${reflections}</ul></div>` : ''}`;
}

// ============================================================
//  Вид «Статистика»
// ============================================================
function xpByDay(n) {
  const ev = xpEvents(), out = [];
  for (let i = n - 1; i >= 0; i--) { const d = addDays(todayStr(), -i); out.push({ label: dmShort(d), value: ev.filter((e) => e.date === d).reduce((s, e) => s + e.xp, 0) }); }
  return out;
}
function weekStart(s) { const wd = (parseDate(s).getDay() + 6) % 7; return addDays(s, -wd); }
function timeByAreaThisWeek() { const ws = weekStart(todayStr()); return rangeStats(ws, addDays(ws, 6)).byArea; }
function barChartSVG(data, showEvery = 1) {
  const w = 600, h = 190, pad = 26, bw = (w - pad * 2) / Math.max(1, data.length), max = Math.max(1, ...data.map((d) => d.value));
  const bars = data.map((d, i) => {
    const bh = Math.round((d.value / max) * (h - pad * 2)), x = pad + i * bw + bw * 0.15, y = h - pad - bh, ww = bw * 0.7, color = d.color || 'var(--accent)';
    const lbl = i % showEvery === 0 ? `<text class="bar-lbl" x="${x + ww / 2}" y="${h - pad + 14}" text-anchor="middle">${esc(d.label)}</text>` : '';
    return `<rect x="${x}" y="${y}" width="${ww}" height="${bh}" rx="3" fill="${color}"></rect>${d.value ? `<text class="bar-val" x="${x + ww / 2}" y="${y - 4}" text-anchor="middle">${d.value}</text>` : ''}${lbl}`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}
function renderStats() {
  ensureAiKeys();
  const since = addDays(todayStr(), -13);
  const planned14 = State.tasks.filter((t) => t.date >= since && t.date <= todayStr());
  const rate = planned14.length ? Math.round((planned14.filter((t) => t.done).length / planned14.length) * 100) : 0;
  const reflections = Object.entries(State.days).filter(([, v]) => v.reflection && v.reflection.trim()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7).map(([d, v]) => `<li><span class="date">${d}</span><br>${esc(v.reflection)}</li>`).join('');
  const cr = charRank(), bal = balanceIndex();
  const balColor = bal.index >= 70 ? '#5fbf7a' : bal.index >= 40 ? '#e0a23e' : '#e0526a';
  const rankRow = (s, sub) => {
    const lvl = skillLevelOf(s.id), r = rankFor(lvl), rp = rankProgress(lvl);
    return `<div class="rank-row ${sub ? 'sub' : ''}">
      <span class="rr-dot" style="background:${esc(s.color)}"></span>
      <span class="rr-name">${sub ? '↳ ' : ''}${esc(s.name)}</span>
      <span class="rr-rank" style="--rc:${r.color}">${r.icon} ${r.name}</span>
      <span class="rr-lvl">ур.${lvl}</span>
      <span class="rr-bar"><span style="width:${rp.pct}%;background:${r.color}"></span></span>
      <span class="rr-next muted">${rp.next ? `+${rp.toNext} до «${rp.next.name}»` : 'макс'}</span></div>`;
  };
  const skillRanksRows = topSkills().map((s) => rankRow(s, false) + childSkills(s.id).map((c) => rankRow(c, true)).join('')).join('');
  const advanced = isPro()
    ? `<div class="card"><h3>Время по сферам — эта неделя</h3>${barChartSVG(timeByAreaThisWeek())}</div>`
    : `<div class="card locked-card" data-action="show-paywall" data-feature="Расширенная аналитика">
        <div class="lock-veil"><span>🔒 Расширенная аналитика — в Pro</span></div>
        <h3>Время по сферам</h3>${barChartSVG(timeByAreaThisWeek())}</div>`;
  return `
    <div class="kpis">
      <div class="kpi"><div class="v">${cr.icon} ${charLevel()}</div><div class="l">${cr.name}</div></div>
      <div class="kpi"><div class="v" style="color:${balColor}">${bal.index}</div><div class="l">Индекс баланса</div></div>
      <div class="kpi"><div class="v">${overallXp()}</div><div class="l">Всего опыта</div></div>
      <div class="kpi"><div class="v">🪙 ${goldBalance()}</div><div class="l">Золото</div></div>
      <div class="kpi"><div class="v">🔥 ${currentStreak()}</div><div class="l">Серия · рекорд ${longestStreak()}</div></div>
      <div class="kpi"><div class="v">${rate}%</div><div class="l">Выполнение (14 дн.)</div></div>
    </div>
    <div class="card ai-review-card">
      <div><h3 style="margin:0">🤖 ИИ-разбор недели</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Правда о времени и балансе + мягкие шаги. ${aiProvider() ? 'Твой ключ ' + aiProvider() + '.' : 'Добавь ключ в Настройках.'}</p></div>
      <button class="btn" data-action="ai-review">Разобрать неделю</button></div>
    <div class="card balance-card">
      <div class="bal-head"><h3>⚖️ Баланс сфер — твоё десятиборье</h3><div class="bal-score" style="color:${balColor}">${bal.index}<small>/100</small></div></div>
      <div class="bal-meter"><span style="width:${bal.index}%;background:${balColor}"></span></div>
      <p class="muted" style="font-size:13px;margin-bottom:0">Активных сфер: <b>${bal.active}/${bal.total}</b>. Индекс растёт, когда развиваешь жизнь как композицию, а не одну вертикаль. ${bal.weakest && bal.index < 80 ? `Сейчас проседает <b>${esc(bal.weakest.name)}</b> — дай ей внимание.` : (bal.index >= 80 ? 'Отличный баланс — так держать. ⚖️' : 'Добавь активность в несколько сфер, чтобы поднять индекс.')}</p>
    </div>
    <div class="card"><h3>🎖 Ранги по сферам</h3>${skillRanksRows || '<p class="muted">Добавь навыки в Настройках.</p>'}</div>
    <div class="card"><h3>Опыт за последние 14 дней</h3>${barChartSVG(xpByDay(14), 2)}</div>
    ${advanced}
    <div class="card"><h3>Последняя рефлексия</h3>${reflections ? `<ul class="reflections">${reflections}</ul>` : '<p class="muted">Пока нет записей.</p>'}</div>`;
}

// ============================================================
//  Вид «Настройки»
// ============================================================
// Импорт: начислить/снять стартовый XP сферы по выбранному тиру
function applyImport(skillId, tierIdx) {
  const sk = skillById(skillId); if (!sk) return;
  const ladder = ladderFor(sk.name), levels = tierLevels(ladder), c = State.settings.curve;
  State.settings.imported = State.settings.imported || {};
  if (tierIdx <= 0) { delete State.settings.imported[skillId]; toast(`${sk.name}: импорт снят`); }
  else {
    const lvl = levels[tierIdx];
    State.settings.imported[skillId] = { tier: tierIdx, xp: xpForLevel(lvl, c.skillBase, c.growth), label: ladder.tiers[tierIdx], at: new Date().toISOString() };
    toast(`🎖 ${sk.name}: старт с ур.${lvl}`);
  }
  Store.save('settings', State.settings); render(); publishLeaderboard();
}
function importCard() {
  const s = State.settings, im = s.imported || {};
  const row = (sk, sub) => {
    const ladder = ladderFor(sk.name), levels = tierLevels(ladder);
    const curTier = (im[sk.id] && im[sk.id].tier) || 0;
    const opts = ladder.tiers.map((t, i) => `<option value="${i}" ${i === curTier ? 'selected' : ''}>${i === 0 ? '— с нуля' : esc(t) + ' · ур.' + levels[i]}</option>`).join('');
    return `<div class="import-row ${sub ? 'sub' : ''}">
      <span class="imp-dot" style="background:${esc(sk.color)}"></span>
      <span class="imp-name">${sub ? '↳ ' : ''}${esc(sk.name)}</span>
      <select data-action="set-import" data-skill="${esc(sk.id)}" title="${esc(ladder.hint)}">${opts}</select>
      <span class="imp-lvl ${curTier > 0 ? '' : 'muted'}">${curTier > 0 ? 'ур.' + levels[curTier] : '—'}</span>
    </div>`;
  };
  const rows = topSkills().map((sk) => row(sk, false) + childSkills(sk.id).map((c) => row(c, true)).join('')).join('');
  return `<div class="card" id="import-card">
    <div class="imp-head"><h3>🎖 Импорт достижений</h3><button class="btn ghost sm" data-action="ai-import-levels" title="ИИ оценит уровни по твоему описанию">🤖 Оценить через ИИ</button></div>
    <p class="muted" style="margin:0 0 12px">Ты не начинаешь с нуля. Отметь честно свой реальный уровень в каждой сфере — стартовый опыт начислится. Это «доказанное мастерство», оно не сгорает. Менять можно в любой момент. Лестницы не подходят (школа, готовка, творчество)? Жми <b>«Оценить через ИИ»</b> — опиши словами, ИИ предложит уровень.</p>
    <div class="import-list">${rows}</div>
  </div>`;
}
function renderSettings() {
  ensureAiKeys();
  const s = State.settings;
  const f = s.focus || DEFAULT_SETTINGS.focus;
  const skillOpts = (sel) => skillOptionsHTML(sel);
  // допустимые родители: любая сфера любой глубины, кроме самой себя и её потомков (защита от циклов).
  // Столб тоже может иметь родителя — так строится Учёба → Школа → Bio LK. Это же «расстолбливает» (#16).
  const parentOptions = (sk) => {
    const blocked = new Set([sk.id, ...descendantSkills(sk.id).map((x) => x.id)]);
    let html = `<option value="" ${!sk.parentId ? 'selected' : ''}>Самостоятельная сфера</option>`;
    const walk = (parentId, chain, depth) => {
      if (depth > 6) return;
      for (const p of State.settings.skills.filter((x) => (x.parentId || null) === parentId)) {
        if (blocked.has(p.id)) continue; // в себя/потомка нельзя — пропускаем вместе с поддеревом
        html += `<option value="${p.id}" ${sk.parentId === p.id ? 'selected' : ''}>Внутри «${esc([...chain, p.name].join(' › '))}»</option>`;
        walk(p.id, [...chain, p.name], depth + 1);
      }
    };
    walk(null, [], 0);
    return html;
  };
  const collapsed = State.settingsCollapsed || {};
  const skillRow = (sk, depth, hidden) => {
    const pillar = isPillar(sk.id);
    return `<div class="skill-edit ${depth > 0 ? 'is-sub' : ''} ${hidden ? 'se-hidden' : ''}" data-id="${sk.id}" style="--d:${depth}">
      <span class="se-move"><button data-action="skill-move" data-id="${sk.id}" data-dir="-1" title="Выше">▲</button><button data-action="skill-move" data-id="${sk.id}" data-dir="1" title="Ниже">▼</button></span>
      ${pillar ? `<button class="se-collapse" data-action="skill-collapse" data-id="${sk.id}" title="Свернуть/развернуть под-навыки">${collapsed[sk.id] ? '▸' : '▾'}</button>` : '<span class="se-collapse-spacer"></span>'}
      <input type="color" value="${esc(sk.color)}" data-field="color" />
      <input type="text" value="${esc(sk.name)}" data-field="name" />
      <select data-field="parentId" title="Вложенность сферы">${parentOptions(sk)}</select>
      <button class="del" data-action="delete-skill" data-id="${sk.id}">✕</button></div>`;
  };
  // Рекурсивный рендер дерева сфер: глубина любая, свёрнутый узел прячет всё поддерево
  const renderSkillRows = (parentId, depth, hidden) => State.settings.skills
    .filter((x) => (x.parentId || null) === parentId)
    .map((sk) => skillRow(sk, depth, hidden) + renderSkillRows(sk.id, depth + 1, hidden || !!collapsed[sk.id]))
    .join('');
  const skills = renderSkillRows(null, 0, false);
  const habits = State.habits.map((h) => `<div class="habit-edit" data-id="${h.id}">
      <input type="text" value="${esc(h.title)}" data-field="title" />
      <select data-field="skillId" class="${skillById(h.skillId).missing ? 'missing' : ''}">${skillById(h.skillId).missing ? `<option value="${esc(h.skillId)}" selected>— нет сферы —</option>` : ''}${skillOpts(h.skillId)}</select>
      <select data-field="difficulty"><option value="easy" ${h.difficulty === 'easy' ? 'selected' : ''}>Лёгкая</option><option value="normal" ${h.difficulty === 'normal' ? 'selected' : ''}>Обычная</option><option value="hard" ${h.difficulty === 'hard' ? 'selected' : ''}>Сложная</option></select>
      <input type="number" min="0" step="1" value="${Number(h.estimateMin) || 0}" data-field="estimateMin" />
      <div class="weekdays">${WEEKDAYS.map((w) => `<label><input type="checkbox" data-day="${w.js}" ${(h.days || []).includes(w.js) ? 'checked' : ''}/>${w.label}</label>`).join('')}</div>
      <button class="del" data-action="delete-habit" data-id="${h.id}">✕</button></div>`).join('');
  return `
    ${subscriptionCard()}
    ${securityCard()}
    ${adminCard()}
    <div class="card"><h3>Название</h3><input id="set-appName" type="text" value="${esc(s.appName)}" style="width:100%;max-width:340px" /></div>
    <div class="card"><h3>🔊 Звук</h3>
      <label class="sound-toggle"><input type="checkbox" data-action="toggle-sound" ${sfxOn() ? 'checked' : ''}/> Звуки интерфейса (выполнение квеста, левелап, дроп из сундука, покупка)</label>
      <button class="btn ghost sm" data-action="sound-test" style="margin-top:8px">▶ Проверить звук</button></div>
    <div class="card"><h3>🎨 Оформление</h3>
      <div class="theme-row"><span class="theme-lbl">Тема</span>
        <div class="theme-toggle">
          <button class="theme-opt ${s.theme !== 'light' ? 'active' : ''}" data-action="set-theme" data-theme="dark">🌙 Тёмная</button>
          <button class="theme-opt ${s.theme === 'light' ? 'active' : ''}" data-action="set-theme" data-theme="light">☀️ Светлая</button>
        </div></div>
      <div class="theme-row"><span class="theme-lbl">Акцент</span>
        <div class="accent-swatches">${ACCENTS.map((c) => `<button class="accent-sw ${(s.accent || '#6c8cff') === c ? 'active' : ''}" data-action="set-accent" data-accent="${c}" style="background:${c}" title="${c}" aria-label="Акцент ${c}"></button>`).join('')}</div></div></div>
    <div class="card"><h3>Навыки / сферы жизни</h3><p class="muted" style="font-size:12px;margin:0 0 10px">Вложенность любой глубины: Учёба → Школа → Биология. Выбери «Внутри …» — опыт суммируется вверх по всей цепочке. Изменения сохраняются автоматически.</p><div id="skills-list">${skills}</div><button class="btn ghost" data-action="add-skill" style="margin-top:6px">+ Добавить сферу</button></div>
    ${importCard()}
    <div class="card"><h3>🔁 Привычки (повторяющиеся)</h3><div id="habits-list">${habits || '<p class="muted">Пока нет привычек.</p>'}</div><button class="btn ghost" data-action="add-habit" style="margin-top:6px">+ Добавить привычку</button></div>
    <div class="card"><h3>🛡 Анти-привычки — с чем борешься</h3>
      <p class="muted" style="font-size:12px;margin:0 0 10px">Отслеживай «чистые дни». Срыв не наказывается — это данные, без стыда. Подход — твой фреймворк доверия/контекста.</p>
      <form id="add-antihabit" class="add-row">
        <input name="title" placeholder="Напр. без бессмысленного скролла" autocomplete="off" required />
        <select name="approach" title="Подход к борьбе">
          <option value="">— подход —</option>
          <option value="доверие">Доверие к себе</option>
          <option value="недоверие">Недоверие (блоки/лимиты)</option>
          <option value="контекст">Смена контекста/среды</option></select>
        <button type="submit">+ Добавить</button></form>
      ${(State.antihabits || []).map((a) => `<div class="ah-edit"><span class="ah-name">${esc(a.title)}${a.approach ? ` · <span class="muted">${esc(a.approach)}</span>` : ''}</span><button class="del" data-action="delete-antihabit" data-id="${a.id}">✕</button></div>`).join('')}</div>
    ${aiKeysCard()}
    <div class="card"><h3>📦 Программы-данжи</h3><p class="muted" style="margin:0 0 12px">Готовый набор сфер, привычек и стартовых квестов. Добавляется к тому, что уже есть.</p><div class="prog-grid">${DUNGEON_PROGRAMS.map((p) => programCard(p, 'add-program')).join('')}</div></div>
    <div class="card"><h3>Формула опыта</h3><div class="knobs">
        <div class="knob"><label>XP за минуту</label><input id="k-perMinute" type="number" step="0.1" value="${s.xp.perMinute}" /></div>
        <div class="knob"><label>Бонус за выполнение</label><input id="k-bonus" type="number" step="1" value="${s.xp.completionBonus}" /></div>
        <div class="knob"><label>× Лёгкая</label><input id="k-easy" type="number" step="0.1" value="${s.xp.difficulty.easy}" /></div>
        <div class="knob"><label>× Обычная</label><input id="k-normal" type="number" step="0.1" value="${s.xp.difficulty.normal}" /></div>
        <div class="knob"><label>× Сложная</label><input id="k-hard" type="number" step="0.1" value="${s.xp.difficulty.hard}" /></div></div></div>
    <div class="card"><h3>Формула золота</h3><div class="knobs">
        <div class="knob"><label>Золото за минуту</label><input id="g-perMinute" type="number" step="0.1" value="${(s.gold || DEFAULT_SETTINGS.gold).perMinute}" /></div>
        <div class="knob"><label>Бонус за выполнение</label><input id="g-bonus" type="number" step="1" value="${(s.gold || DEFAULT_SETTINGS.gold).completionBonus}" /></div></div></div>
    <div class="card"><h3>🎯 Фокус и Помодоро</h3><div class="knobs">
        <div class="knob"><label>Помодоро</label><select id="f-pomodoro"><option value="1" ${f.pomodoro ? 'selected' : ''}>Вкл</option><option value="0" ${!f.pomodoro ? 'selected' : ''}>Выкл</option></select></div>
        <div class="knob"><label>Работа, мин</label><input id="f-workMin" type="number" min="1" value="${f.workMin}" /></div>
        <div class="knob"><label>Перерыв, мин</label><input id="f-breakMin" type="number" min="1" value="${f.breakMin}" /></div>
        <div class="knob"><label>Колокол</label><select id="f-sound"><option value="1" ${f.sound ? 'selected' : ''}>Вкл</option><option value="0" ${!f.sound ? 'selected' : ''}>Выкл</option></select></div>
        <div class="knob"><label>Уведомления</label><select id="f-notify"><option value="1" ${f.notify ? 'selected' : ''}>Вкл</option><option value="0" ${!f.notify ? 'selected' : ''}>Выкл</option></select></div></div>
        <p class="muted" style="font-size:12px;margin-top:8px">Плавающее окно поверх всех приложений работает в Chrome / Edge / Brave (Document Picture-in-Picture). В Safari — встроенная плашка внизу слева. Колокол звенит на перерыв и при превышении расчётного времени.<br>⚠️ Честно об ограничении: окно остаётся поверх программ, но на другие рабочие столы macOS (Spaces) браузер его не переносит — это лимит самой технологии, обойти из веба нельзя. Лайфхак: держи окно на том столе, где работаешь, или используй Split View.</p></div>
    <div class="card"><h3>Кривая уровней</h3><div class="knobs">
        <div class="knob"><label>База (персонаж)</label><input id="k-base" type="number" step="10" value="${s.curve.base}" /></div>
        <div class="knob"><label>База (навыки)</label><input id="k-skillBase" type="number" step="10" value="${s.curve.skillBase}" /></div>
        <div class="knob"><label>Рост ×</label><input id="k-growth" type="number" step="0.05" value="${s.curve.growth}" /></div></div></div>
    <div class="settings-actions"><button class="btn" data-action="save-settings">Сохранить настройки</button><button class="btn danger" data-action="reset-data">Сбросить квесты и дни</button></div>
    <p class="muted" style="margin-top:12px">Данные лежат в <code>life-rpg/data/</code> внутри твоего vault — это обычные JSON-файлы.</p>`;
}

// ============================================================
//  Рендер
// ============================================================
const APP_SHELL = `
  <header id="topbar">
    <div class="brand"><span class="logo">⚔️</span><h1 id="appName">Gojo</h1></div>
    <div id="charSummary" class="char-summary"></div>
    <nav id="nav"><!-- 2-уровневая навигация рендерится в renderNav() --></nav>
  </header>
  <main id="main"></main>
  <div id="toasts"></div>
  <button id="ai-fab" data-action="open-helper" title="Помощник Gojo — спроси про любую функцию" aria-label="Помощник">🤖</button>`;

function renderLeaderboard() {
  if (State.leaderboard === null) {
    if (!State._lbLoading) {
      State._lbLoading = true;
      fetch('/api/leaderboard').then((r) => r.json()).then((d) => { State.leaderboard = Array.isArray(d) ? d : []; State._lbLoading = false; if (State.view === 'leaderboard') render(); })
        .catch(() => { State.leaderboard = []; State._lbLoading = false; if (State.view === 'leaderboard') render(); });
    }
    return `<div class="card"><p class="muted">Загрузка рейтинга…</p></div>`;
  }
  const rows = State.leaderboard;
  const optOut = !!(State.settings && State.settings.leaderboardOptOut);
  const medals = ['🥇', '🥈', '🥉'];
  const list = rows.length ? rows.map((r, i) => `
    <div class="lb-row ${r.me ? 'me' : ''}">
      <div class="lb-pos">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
      <div class="lb-av">${esc(r.avatar || '👤')}</div>
      <div class="lb-name">${esc(r.name)}${r.me ? ' <span class="lb-you">ты</span>' : ''}<span class="lb-rank">${esc(r.rank || '')}</span></div>
      <div class="lb-lvl">ур.${r.level}</div>
      <div class="lb-xp">${r.totalXp.toLocaleString('ru')} XP</div>
    </div>`).join('') : '<p class="muted">Пока пусто. Выполняй квесты — и попадёшь в рейтинг. Позови друзей!</p>';
  return `
    <div class="card">
      <h3>🏆 Рейтинг</h3>
      <p class="muted" style="margin:0 0 14px">Соревнование по суммарному опыту среди всех игроков на этом сервере. Видны только имя, аватар, уровень и ранг — твои задачи и личные данные приватны.</p>
      <div class="lb-table">${list}</div>
    </div>
    <div class="card">
      <label class="lb-optout"><input type="checkbox" data-action="toggle-lb-optout" ${optOut ? 'checked' : ''}/> Скрыть меня из рейтинга</label>
    </div>`;
}

const VIEWS = { today: renderToday, notes: renderNotes, calendar: renderCalendarView, character: renderCharacter, goals: renderGoals, tree: renderTree, rewards: renderRewards, weekly: renderWeekly, stats: renderStats, leaderboard: renderLeaderboard, settings: renderSettings };
// Разгрузка дизайна: 11 вкладок → 5 разделов с под-вкладками. Прогрессивное раскрытие через гейт уровня.
const SECTIONS = [
  { id: 'today', icon: '🎯', label: 'Сегодня', gate: 0, views: [{ view: 'today', label: 'День' }, { view: 'notes', label: 'Заметки' }] },
  { id: 'plan', icon: '🗓', label: 'План', gate: 0, views: [{ view: 'calendar', label: 'Календарь' }, { view: 'goals', label: 'Цели' }] },
  { id: 'rewards', icon: '🎁', label: 'Награды', gate: 0, views: [{ view: 'rewards', label: 'Награды' }] },
  { id: 'hero', icon: '🧍', label: 'Герой', gate: 3, views: [{ view: 'character', label: 'Персонаж' }, { view: 'tree', label: 'Навыки' }, { view: 'stats', label: 'Прогресс' }] },
  { id: 'tribe', icon: '🤝', label: 'Племя', gate: 3, views: [{ view: 'leaderboard', label: 'Рейтинг' }] },
];
function sectionOf(view) { for (const s of SECTIONS) if (s.views.some((v) => v.view === view)) return s.id; return null; } // settings (шестерёнка) и legacy weekly → null
function navUnlockLevel() { return (State.me && State.me.isAdmin) ? 999 : charLevel(); } // админ видит всё (дог-фуддинг)
function renderNav() {
  const nav = document.getElementById('nav'); if (!nav) return;
  const lvl = navUnlockLevel(), cur = sectionOf(State.view);
  const primary = SECTIONS.map((s) => {
    const locked = s.gate > lvl;
    return `<button class="navsec${s.id === cur ? ' active' : ''}${locked ? ' locked' : ''}" data-action="go-section" data-sec="${s.id}" title="${locked ? 'Откроется на ур.' + s.gate : s.label}">${s.icon}<span class="navsec-l">${s.label}</span>${locked ? `<span class="navsec-lock">🔒${s.gate}</span>` : ''}</button>`;
  }).join('');
  const gear = `<button class="navgear${State.view === 'settings' ? ' active' : ''}" data-view="settings" title="Настройки" aria-label="Настройки">⚙️</button>`;
  const sec = SECTIONS.find((s) => s.id === cur);
  const subs = (sec && sec.views.length > 1) ? `<div class="navsub">${sec.views.map((v) => `<button class="navsubtab${v.view === State.view ? ' active' : ''}" data-view="${v.view}">${esc(v.label)}</button>`).join('')}</div>` : '';
  nav.innerHTML = `<div class="navrow">${primary}${gear}</div>${subs}`;
}
const ACCENTS = ['#6c8cff', '#22c1a4', '#e0526a', '#b06ff0', '#e0a23e', '#4f9ff7']; // палитра акцентов (#тема)
function applyTheme() {
  const s = State.settings || {};
  document.documentElement.dataset.theme = s.theme === 'light' ? 'light' : 'dark';
  document.documentElement.style.setProperty('--accent', s.accent || '#6c8cff');
}
function render() {
  if (State.phase !== 'app') { showAuthScreen(); return; }
  applyTheme();
  // Восстановить app shell если auth-экран его перезаписал
  if (!document.getElementById('main')) document.getElementById('app').innerHTML = APP_SHELL;
  renderHeader();
  renderNav();
  document.getElementById('main').innerHTML = (VIEWS[State.view] || renderToday)();
  scheduleReminders();
}

// ============================================================
//  События
// ============================================================
function onSubmit(e) {
  const f = e.target;

  // --- PIN login ---
  if (f.id === 'pin-form') {
    e.preventDefault();
    const userId = f.dataset.id, pin = f.pin.value;
    const errEl = f.querySelector('#pin-error');
    fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, pin }) })
      .then(async r => { const d = await r.json(); if (r.ok) { State.me = d; initApp(); } else { if (errEl) errEl.textContent = d.error || 'Неверный PIN'; f.pin.value = ''; } })
      .catch(() => { if (errEl) errEl.textContent = 'Ошибка сети'; });
    return;
  }

  // --- Register ---
  if (f.id === 'register-form') {
    e.preventDefault();
    const name = f.name.value.trim(), pin = f.pin.value, pin2 = f.pin2.value;
    const errEl = f.querySelector('#reg-error');
    if (pin !== pin2) { errEl.textContent = 'PIN-коды не совпадают'; return; }
    if (pin.length < 4) { errEl.textContent = 'PIN минимум 4 символа'; return; }
    fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pin, avatar: State.regAvatar || '⚡' }) })
      .then(async r => { const d = await r.json(); if (r.ok) { State.me = d; State.phase = 'onboarding'; render(); } else { errEl.textContent = d.error || 'Ошибка регистрации'; } })
      .catch(() => { f.querySelector('#reg-error').textContent = 'Ошибка сети'; });
    return;
  }

  // --- Смена PIN ---
  if (f.id === 'change-pin') {
    e.preventDefault();
    const msg = f.querySelector('#pin-change-msg');
    fetch('/api/auth/change-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPin: f.oldPin.value, newPin: f.newPin.value }) })
      .then(async (r) => { const d = await r.json(); if (r.ok) { msg.textContent = '✓ PIN изменён'; msg.style.color = '#5fbf7a'; f.reset(); } else { msg.textContent = d.error || 'Ошибка'; msg.style.color = '#e0526a'; } })
      .catch(() => { msg.textContent = 'Ошибка сети'; msg.style.color = '#e0526a'; });
    return;
  }

  // --- Админ: выдать Pro ---
  if (f.id === 'grant-pro') {
    e.preventDefault();
    const msg = f.querySelector('#grant-msg'), days = f.days.value ? Number(f.days.value) : undefined;
    fetch('/api/auth/grant-pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: f.userId.value.trim(), days }) })
      .then(async (r) => { const d = await r.json(); if (r.ok) { msg.textContent = `✓ Pro выдан: ${d.name}`; msg.style.color = '#5fbf7a'; if (d.id === (State.me && State.me.id)) { State.me = d; render(); } } else { msg.textContent = d.error || 'Ошибка'; msg.style.color = '#e0526a'; } })
      .catch(() => { msg.textContent = 'Ошибка сети'; msg.style.color = '#e0526a'; });
    return;
  }
  if (f.id === 'recover-data') {
    e.preventDefault();
    const uid = f.userId.value.trim(); if (uid) showUserData(uid);
    return;
  }

  // --- Обратная связь ---
  if (f.id === 'feedback-form') {
    e.preventDefault();
    const msg = f.querySelector('#fb-msg'), btn = f.querySelector('button[type="submit"]');
    const files = [...(f.files.files || [])];
    if (!f.text.value.trim() && !files.length) { msg.textContent = 'Опиши или приложи файл'; msg.style.color = '#e0526a'; return; }
    btn.disabled = true; msg.style.color = 'var(--muted)'; msg.textContent = files.length ? 'Обрабатываю файлы…' : 'Отправляю…';
    (async () => {
      let attachments = [];
      try { attachments = await Promise.all(files.map(readAttachment)); }
      catch (err) { msg.textContent = err.message || 'Файл не подошёл'; msg.style.color = '#e0526a'; btn.disabled = false; return; }
      msg.textContent = 'Отправляю…';
      try {
        const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: f.kind.value, text: f.text.value, attachments }) });
        const d = await r.json();
        if (r.ok) { msg.textContent = `✓ Спасибо! Отправлено${d.attachments ? ` (вложений: ${d.attachments})` : ''}.`; msg.style.color = '#5fbf7a'; f.text.value = ''; f.files.value = ''; const pv = f.querySelector('#fb-previews'); if (pv) pv.innerHTML = '';
          State.myFeedbackCount = (State.myFeedbackCount || 0) + 1; checkAchievements(); }
        else { msg.textContent = d.error || 'Ошибка'; msg.style.color = '#e0526a'; }
      } catch { msg.textContent = 'Ошибка сети'; msg.style.color = '#e0526a'; }
      btn.disabled = false;
    })();
    return;
  }

  // --- Телосложение ---
  if (f.id === 'body-form') {
    e.preventDefault();
    const num = (v) => { const x = parseFloat(v); return isNaN(x) ? null : x; };
    State.settings.body = Object.assign({}, State.settings.body, { height: num(f.height.value), weight: num(f.weight.value), sex: f.sex.value || '' });
    if (f.bodyfat) State.settings.body.bodyfat = num(f.bodyfat.value);
    Store.save('settings', State.settings); toast('🧍 Телосложение обновлено'); render();
    return;
  }

  if (f.classList.contains('wk-add-form')) {
    e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
    const date = f.dataset.date || todayStr();
    State.tasks.push({ id: uid(), title, skillId: f.skillId.value, skillIds: [f.skillId.value], estimateMin: 30, difficulty: 'normal', date, done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: null, createdAt: new Date().toISOString() });
    Store.save('tasks', State.tasks); State.wkAddDate = null; render(); return;
  }

  if (f.id === 'capture-form') {
    e.preventDefault(); const text = f.text.value.trim(); if (!text) return;
    State.inbox.unshift({ id: uid(), kind: 'text', text, file: null, type: null, at: new Date().toISOString() });
    Store.save('inbox', State.inbox); track('capture:text'); f.text.value = ''; toast('📝 В Заметках'); render();
    return;
  }
  if (f.id === 'chat-form') {
    e.preventDefault(); const inp = document.getElementById('chat-input'); sendChat(inp && inp.value);
    return;
  }
  if (f.id === 'add-antihabit') {
    e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
    State.antihabits = State.antihabits || [];
    State.antihabits.push({ id: 'ah_' + uid(), title, approach: (f.approach && f.approach.value) || '', slips: [], createdAt: new Date().toISOString() });
    Store.save('antihabits', State.antihabits); render();
    return;
  }
  if (f.id === 'ai-keys') {
    e.preventDefault();
    const body = {};
    AI_PROVIDERS.forEach((p) => { if (f[p.id] && f[p.id].value.trim()) body[p.id] = f[p.id].value.trim(); });
    if (!Object.keys(body).length) { const m0 = document.getElementById('ai-keys-msg'); if (m0) m0.textContent = 'Вставь хотя бы один ключ'; return; }
    const msg = document.getElementById('ai-keys-msg'); if (msg) msg.textContent = 'Сохраняю…';
    fetch('/api/ai/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json()).then((d) => { const m = {}; AI_PROVIDERS.forEach((p) => m[p.id] = !!d[p.id]); State.aiKeys = m; toast('🤖 Ключ сохранён'); render(); })
      .catch(() => { if (msg) msg.textContent = 'Ошибка'; });
    return;
  }
  if (f.id === 'add-task') {
    e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
    const tDate = (f.date && f.date.value) || todayStr(); // вкладка «Календарь» добавляет на выбранный день
    State.tasks.push({ id: uid(), title, skillId: f.skillId.value, skillIds: [f.skillId.value], estimateMin: Number(f.estimateMin.value) || 0, difficulty: f.difficulty.value, date: tDate, done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: null, createdAt: new Date().toISOString() });
    Store.save('tasks', State.tasks); render();
  } else if (f.id === 'add-goal') {
    e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
    const type = f.type.value || 'short';
    const xpReward = f.xpReward.value !== '' ? Math.max(0, Number(f.xpReward.value)) : GOAL_XP[type];
    const tgt = (f.mTarget && f.mTarget.value !== '') ? Number(f.mTarget.value) : null;
    let metric = null;
    if (tgt != null && !isNaN(tgt)) {
      const cur = (f.mStart && f.mStart.value !== '') ? Number(f.mStart.value) : 0;
      metric = { start: cur, current: cur, target: tgt, unit: (f.mUnit.value || '').trim().slice(0, 12), lowerBetter: !!(f.mLower && f.mLower.checked), maintain: !!(f.mMaintain && f.mMaintain.checked), everReached: false, log: [] };
    }
    const status = (f.status && f.status.value) || 'active';
    const window = (f.window && f.window.value || '').trim().slice(0, 40);
    const goal = { id: 'g_' + uid(), title, skillId: f.skillId.value, type, xpReward, parentId: f.parentId.value || null, targetDate: f.targetDate.value || null, steps: [], metric, status, window, createdAt: new Date().toISOString(), completedAt: null, archived: false };
    State.goals.push(goal);
    if (goal.metric) refreshGoalCompletion(goal); // вдруг уже достигнута на старте (напр. жим уже взят)
    Store.save('goals', State.goals); render();
  } else if (f.classList.contains('add-step-form')) {
    e.preventDefault(); const g = goalById(f.dataset.goal); const v = f.step.value.trim(); if (!g || !v) return;
    g.steps.push({ id: 's_' + uid(), title: v, done: false }); refreshGoalCompletion(g);
    Store.save('goals', State.goals); render();
  } else if (f.classList.contains('metric-form')) {
    e.preventDefault(); const g = goalById(f.dataset.goal); if (!g || !g.metric || f.val.value === '') return;
    const val = Number(f.val.value); if (isNaN(val)) return;
    g.metric.current = val; g.metric.log = g.metric.log || [];
    g.metric.log.unshift({ date: todayStr(), value: val }); g.metric.log = g.metric.log.slice(0, 50);
    refreshGoalCompletion(g); Store.save('goals', State.goals); checkAchievements(); render(); publishLeaderboard();
  } else if (f.id === 'add-reward') {
    e.preventDefault(); const name = f.name.value.trim(); if (!name) return;
    if (!isPro() && State.rewards.length >= FREE_REWARDS_MAX) { showPaywall('Больше наград'); return; }
    State.rewards.push({ id: 'r_' + uid(), name, icon: f.icon.value.trim() || '🎁', cost: Math.max(1, Number(f.cost.value) || 1), createdAt: new Date().toISOString() });
    Store.save('rewards', State.rewards); render();
  }
}

// Модалка каталога предустановленных наград
function openRewardCatalog() {
  if (document.getElementById('rw-catalog')) return;
  const have = new Set(State.rewards.map((r) => r.name));
  const rows = REWARD_CATALOG.map((c, i) => `<div class="rwc-row">
      <span class="rwc-ic">${c.icon}</span><span class="rwc-name">${esc(c.name)}</span><span class="rwc-cost">🪙 ${c.cost}</span>
      ${have.has(c.name) ? '<span class="muted" style="font-size:12px">добавлено ✓</span>' : `<button class="btn ghost sm" data-action="add-catalog-reward" data-idx="${i}">+ Добавить</button>`}
    </div>`).join('');
  const ov = document.createElement('div'); ov.id = 'rw-catalog'; ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="guide-box"><button class="modal-x" data-action="close-reward-catalog">✕</button>
    <h2>📚 Каталог наград</h2>
    <p class="muted">Готовые награды с откалиброванными ценами — как дроп с босса. Добавь свои в форме на странице наград.</p>
    <div class="rwc-list">${rows}</div></div>`;
  document.body.appendChild(ov);
}

function onClick(e) {
  const navBtn = e.target.closest('#nav button[data-view]');
  if (navBtn) { flushSettingsForm(); State.view = navBtn.dataset.view; track('view:' + State.view); if (State.view === 'leaderboard') State.leaderboard = null; if (State.view === 'settings') { State.adminUsers = null; State.analytics = undefined; } render(); return; }
  const secBtn = e.target.closest('#nav [data-action="go-section"]');
  if (secBtn) {
    const s = SECTIONS.find((x) => x.id === secBtn.dataset.sec); if (!s) return;
    if (s.gate > navUnlockLevel()) { toast(`🔒 «${s.label}» откроется на ур.${s.gate}`); return; }
    if (sectionOf(State.view) !== s.id) { flushSettingsForm(); State.view = s.views[0].view; track('view:' + State.view); if (State.view === 'leaderboard') State.leaderboard = null; render(); }
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) {
    // клик по пустому месту сетки календаря → подставить время в форму планирования
    const calGrid = e.target.closest('.calv-grid');
    if (calGrid && !e.target.closest('.cal-block')) {
      const min = calYtoMin(e.clientY - calGrid.getBoundingClientRect().top);
      const ti = document.getElementById('cal-time');
      if (ti) { ti.value = fmtHM(min); toast(`Время ${fmtHM(min)} подставлено в форму`); }
    }
    return;
  }
  const action = el.dataset.action, id = el.dataset.id, today = todayStr();

  // --- Auth actions ---
  if (action === 'select-profile') {
    if (e.target.closest('#pin-form')) return; // клик внутри формы — не схлопываем
    State.selectedProfile = State.selectedProfile === id ? null : id;
    renderLoginScreen(); return;
  }
  if (action === 'go-register') { State.phase = 'register'; State.regAvatar = '⚡'; State.regName = ''; render(); return; }
  if (action === 'go-login') { State.phase = 'login'; render(); return; }
  if (action === 'pick-avatar') { State.regAvatar = el.dataset.av; State.regName = document.querySelector('input[name="name"]')?.value || ''; render(); return; }
  if (action === 'logout') {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      State.me = null; State.phase = 'login'; stopFocus(false); clearAllData();
      fetch('/api/auth/profiles').then(r => r.json()).then(p => { State.profiles = p; render(); }).catch(() => { State.profiles = []; render(); });
    }); return;
  }

  // --- Onboarding actions ---
  if (action === 'ob-toggle') {
    const name = el.dataset.skill;
    if (State.obSkills.has(name)) State.obSkills.delete(name); else State.obSkills.add(name);
    render(); return;
  }
  if (action === 'ob-add-custom') {
    const inp = document.getElementById('ob-custom'), col = document.getElementById('ob-color');
    const name = inp ? inp.value.trim() : '';
    if (name) { State.obSkills.add(name + '|' + (col ? col.value : '#6c8cff')); render(); }
    return;
  }
  if (action === 'ob-program') { const p = DUNGEON_PROGRAMS.find((x) => x.id === el.dataset.prog); if (p) applyProgramFresh(p); return; }
  if (action === 'add-program') { const p = DUNGEON_PROGRAMS.find((x) => x.id === el.dataset.prog); if (p) applyProgramMerge(p); return; }
  if (action === 'toggle-lb-optout') { State.settings.leaderboardOptOut = !State.settings.leaderboardOptOut; Store.save('settings', State.settings); publishLeaderboard(); State.leaderboard = null; render(); return; }
  if (action === 'ob-finish') {
    if (State.obSkills.size === 0) return;
    const skills = [...State.obSkills].map((entry) => {
      const [name, color] = entry.split('|');
      const tpl = SKILL_TEMPLATES.find(t => t.name === name);
      return { id: 'sk_' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36), name, color: color || (tpl ? tpl.color : '#6c8cff') };
    });
    const settings = Object.assign(structuredClone(DEFAULT_SETTINGS), { skills });
    Store.save('settings', settings);
    State.phase = 'app'; initApp(); return;
  }

  // --- Лутбоксы / Pro / Paywall ---
  if (action === 'open-chest') { openChest(); return; }
  if (action === 'equip-title') {
    const eq = ensureCosmetics(), t = el.dataset.title || null;
    eq.title = (!t || eq.title === t) ? null : t; Store.save('settings', State.settings); render(); return;
  }
  if (action === 'equip-cosmetic') {
    if (!ownsCosmetic(el.dataset.id)) return;
    const eq = ensureCosmetics(), ty = cosmeticType(el.dataset.id);
    eq[ty] = (eq[ty] === el.dataset.id) ? null : el.dataset.id; Store.save('settings', State.settings); render(); return;
  }
  if (action === 'toggle-sound') { State.settings.sound = !!el.checked; Store.save('settings', State.settings); if (el.checked) sfx('complete'); return; }
  if (action === 'set-theme') { State.settings.theme = el.dataset.theme === 'light' ? 'light' : 'dark'; Store.save('settings', State.settings); applyTheme(); render(); return; }
  if (action === 'set-accent') { State.settings.accent = el.dataset.accent; Store.save('settings', State.settings); applyTheme(); render(); return; }
  if (action === 'sound-test') { ['complete', 'coin', 'achievement'].forEach((n, i) => setTimeout(() => sfx(n), i * 420)); setTimeout(() => sfx('loot', 'legendary'), 1300); return; }
  if (action === 'show-paywall') { showPaywall(el.dataset.feature); return; }
  if (action === 'close-paywall') { const p = document.getElementById('paywall'); if (p) p.remove(); return; }
  if (action === 'show-guide') { showGuide(); return; }
  if (action === 'close-guide') { const g = document.getElementById('guide'); if (g) g.remove(); return; }
  if (action === 'show-reports') { showReports(); return; }
  if (action === 'close-reports') { const r = document.getElementById('reports'); if (r) r.remove(); return; }
  if (action === 'close-userdata') { const r = document.getElementById('userdata'); if (r) r.remove(); return; }
  if (action === 'open-reward-catalog') { openRewardCatalog(); return; }
  if (action === 'close-reward-catalog') { const r = document.getElementById('rw-catalog'); if (r) r.remove(); render(); return; }
  if (action === 'add-catalog-reward') {
    if (!isPro() && State.rewards.length >= FREE_REWARDS_MAX) { showPaywall('Больше наград'); return; }
    const c = REWARD_CATALOG[Number(el.dataset.idx)]; if (!c) return;
    State.rewards.push({ id: 'r_' + uid(), name: c.name, icon: c.icon, cost: c.cost, createdAt: new Date().toISOString() });
    Store.save('rewards', State.rewards); toast(`🎁 «${c.name}» в магазине`);
    const m = document.getElementById('rw-catalog'); if (m) m.remove(); openRewardCatalog(); return;
  }
  if (action === 'restore-backup') {
    const name = el.dataset.name, user = el.dataset.user;
    const sel = el.parentElement.querySelector('.ud-stamp'); const stamp = sel ? sel.value : null;
    if (!stamp) { toast('Нет снимка'); return; }
    if (!confirm(`Восстановить «${name}» для ${user} из снимка ${stamp.slice(0, 19).replace('T', ' ')}?\nТекущее состояние сохранится в новый бэкап.`)) return;
    (async () => {
      try {
        const r = await fetch(`/api/admin/userdata/${encodeURIComponent(user)}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, stamp }) });
        const d = await r.json();
        if (r.ok) { toast(`✓ Восстановлено: ${name}`); showUserData(user); } else { toast(d.error || 'Ошибка'); }
      } catch { toast('Ошибка сети'); }
    })();
    return;
  }
  if (action === 'edit-cats') { openCategoryPicker(el.dataset.id); return; }
  if (action === 'close-cats') { const p = document.getElementById('cat-pop'); if (p) p.remove(); render(); return; }
  if (action === 'desire-cancel') { const p = document.getElementById('desire-pop'); if (p) p.remove(); return; }
  if (action === 'desire-pick') { const t = questById(el.dataset.id), p = document.getElementById('desire-pop'); if (p) p.remove(); if (t && !t.done) completeTask(t, el.dataset.desire); return; }
  if (action === 'copy-feedback-for-claude') {
    (async () => {
      try {
        const r = await fetch('/api/feedback'); if (!r.ok) { toast('Ошибка доступа'); return; }
        const list = await r.json();
        if (!list.length) { toast('Репортов пока нет'); return; }
        const KIND = { bug: '🐞 Баг', idea: '💡 Идея', praise: '💛 Похвала', other: '💬 Другое' };
        const lines = list.map((f, i) => [
          `## [${i + 1}] ${KIND[f.kind] || f.kind} | ${(f.at || '').slice(0, 16).replace('T', ' ')} | ${f.userId}`,
          f.text,
          f.attachments && f.attachments.length ? `📎 Вложений: ${f.attachments.length}` : '',
        ].filter(Boolean).join('\n'));
        const text = `# Gojo Feedback — ${list.length} репортов\nЭкспорт: ${new Date().toLocaleString('ru')}\n\n` + lines.join('\n\n---\n\n');
        await navigator.clipboard.writeText(text);
        toast('📋 Скопировано! Вставь в чат с Claude.');
      } catch (e) { toast('Ошибка: ' + e.message); }
    })();
    return;
  }
  if (action === 'goto-rewards') { State.view = 'rewards'; render(); return; }
  if (action === 'goto-import') { State.view = 'settings'; render(); setTimeout(() => { const c = document.getElementById('import-card'); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.add('flash-card'); } }, 60); return; }
  if (action === 'av-cat') { State.aveCat = el.dataset.cat; render(); return; }
  if (action === 'av-set') { State.settings.avatar = Object.assign(avCfg(), { [el.dataset.part]: Number(el.dataset.idx) }); Store.save('settings', State.settings); render(); return; }
  if (action === 'start-trial') {
    fetch('/api/auth/start-trial', { method: 'POST' }).then(async (r) => {
      const d = await r.json();
      if (r.ok) { State.me = d; const p = document.getElementById('paywall'); if (p) p.remove(); toast('✨ Pro-триал активирован на 7 дней!'); render(); }
      else toast(d.error || 'Не удалось');
    }).catch(() => toast('Ошибка сети'));
    return;
  }
  if (action === 'do-upgrade') {
    fetch('/api/auth/upgrade', { method: 'POST' }).then(async (r) => { const d = await r.json(); toast(d.message || 'Скоро'); }).catch(() => toast('Ошибка сети'));
    return;
  }

  if (action === 'toggle-task') {
    const t = questById(id); if (!t) return;
    if (!t.done) {
      // Сложный квест → спрашиваем «насколько хотел» (Хайп за добровольный выбор трудного). Лёгкий/обычный — сразу.
      if (t.difficulty === 'hard') { openDesirePicker(id); return; }
      completeTask(t, null);
    } else { t.done = false; t.completedAt = null; t.xpAwarded = 0; t.goldAwarded = 0; t.desire = null;
      Store.save('tasks', State.tasks); checkAchievements(); render(); publishLeaderboard(); }
  } else if (action === 'toggle-habit') {
    const h = habitById(id); if (!h) return;
    State.habitlog[today] = State.habitlog[today] || {};
    if (State.habitlog[today][id]) { delete State.habitlog[today][id]; if (!Object.keys(State.habitlog[today]).length) delete State.habitlog[today]; }
    else { State.habitlog[today][id] = { xp: itemXp(h), gold: itemGold(h), min: Number(h.estimateMin) || 0, at: new Date().toISOString() }; const eD = applyEnergy(h); track('complete:habit'); toast(`+${itemXp(h)} XP · +${itemGold(h)} 🪙 · ${skillById(h.skillId).name}${eD ? ` · ${eD > 0 ? '+' : ''}${eD} 🔋` : ''}`); }
    Store.save('habitlog', State.habitlog); checkAchievements(); render(); publishLeaderboard();
  } else if (action === 'focus-task') { const t = questById(id); if (t && !t.done) startFocus(id);
  } else if (action === 'timer-pause') { pauseFocus();
  } else if (action === 'timer-resume') { resumeFocus();
  } else if (action === 'timer-stop') { stopFocus(true);
  } else if (action === 'open-pip') { openFocusWidget();
  } else if (action === 'edit-actual') {
    const t = questById(id); if (!t) return; const v = prompt('Фактическое время в минутах:', t.actualMin || t.estimateMin || ''); if (v === null) return;
    const n = Math.round(Number(v)); if (!isNaN(n) && n >= 0) { t.actualMin = n || null; Store.save('tasks', State.tasks); render(); }
  } else if (action === 'delete-task') {
    const t = questById(id); if (t && t.done && !confirm(`Удалить «${t.title}»?`)) return;
    if (State.timer && State.timer.taskId === id) { State.timer = null; persistTimer(); stopTick(); }
    State.tasks = State.tasks.filter((x) => x.id !== id); Store.save('tasks', State.tasks); render();
  } else if (action === 'add-stretch') {
    const sk = State.settings.skills.find((s) => /спорт|здоров|sport|health/i.test(s.name)) || State.settings.skills.find((s) => ['str', 'end'].includes(guessAttr(s.name))) || State.settings.skills[0];
    if (!sk) return;
    State.tasks.push({ id: uid(), title: 'Разминка / прогулка', skillId: sk.id, skillIds: [sk.id], estimateMin: 10, difficulty: 'easy', date: todayStr(), done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: null, createdAt: new Date().toISOString() });
    Store.save('tasks', State.tasks); toast('🤸 Разминка в плане — тело скажет спасибо'); render();
  } else if (action === 'add-mobility') {
    const sk = State.settings.skills.find((s) => /спорт|здоров|тело|sport|health/i.test(s.name)) || State.settings.skills.find((s) => ['str', 'end'].includes(guessAttr(s.name))) || State.settings.skills[0];
    if (!sk) return;
    State.tasks.push({ id: uid(), title: 'Мобилка спины и плеч', skillId: sk.id, skillIds: [sk.id], estimateMin: 10, difficulty: 'easy', date: todayStr(), done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: null, createdAt: new Date().toISOString() });
    _mobilSnoozeDay = today; Store.save('tasks', State.tasks); toast('🧘 Мобилка в плане — спина и плечи скажут спасибо'); render();
  } else if (action === 'mobil-later') { _mobilSnoozeDay = today; render();
  } else if (action === 'mobil-never') {
    State.settings.prefs = Object.assign({}, State.settings.prefs, { noMobilityNudge: true }); Store.save('settings', State.settings); toast('Подсказки мобилки отключены'); render();
  } else if (action === 'anti-slip') {
    const a = (State.antihabits || []).find((x) => x.id === id); if (!a) return;
    a.slips = a.slips || []; if (!a.slips.includes(today)) a.slips.push(today);
    Store.save('antihabits', State.antihabits); toast('Записано. Без стыда — завтра новый чистый день 🌱'); render();
  } else if (action === 'anti-unslip') {
    const a = (State.antihabits || []).find((x) => x.id === id); if (!a) return;
    a.slips = (a.slips || []).filter((d) => d !== today); Store.save('antihabits', State.antihabits); render();
  } else if (action === 'delete-antihabit') {
    State.antihabits = (State.antihabits || []).filter((x) => x.id !== id); Store.save('antihabits', State.antihabits); render();
  } else if (action === 'move-overdue') {
    State.tasks.forEach((t) => { if (!t.done && t.date < today) t.date = today; }); Store.save('tasks', State.tasks); toast('Перенесено на сегодня'); render();
  } else if (action === 'schedule-quest') {
    const qid = document.getElementById('cal-quest').value, time = document.getElementById('cal-time').value, t = questById(qid);
    const durEl = document.getElementById('cal-dur'), dur = durEl ? Math.max(5, Math.round(Number(durEl.value) || 0)) : 0;
    if (t && time) { t.startTime = time; if (dur) t.estimateMin = dur; Store.save('tasks', State.tasks); render(); }
  } else if (action === 'unschedule-quest') {
    const t = questById(id); if (t) { t.startTime = null; Store.save('tasks', State.tasks); render(); }
  } else if (action === 'close-day' || action === 'reopen-day') {
    const ref = document.getElementById('reflection'); State.days[today] = State.days[today] || { reflection: '', closed: false };
    if (ref) State.days[today].reflection = ref.value; State.days[today].closed = action === 'close-day';
    Store.save('days', State.days); if (action === 'close-day') toast('🌙 День закрыт'); render();

  // --- Цели ---
  } else if (action === 'toggle-step') {
    const g = goalById(el.dataset.goal); if (!g) return; const st = g.steps.find((x) => x.id === el.dataset.step); if (!st) return;
    st.done = !st.done; refreshGoalCompletion(g); Store.save('goals', State.goals); checkAchievements(); render();
  } else if (action === 'delete-step') {
    const g = goalById(el.dataset.goal); if (!g) return; g.steps = g.steps.filter((x) => x.id !== el.dataset.step); refreshGoalCompletion(g); Store.save('goals', State.goals); render();
  } else if (action === 'delete-goal') {
    if (!confirm('Удалить цель?')) return; State.goals = State.goals.filter((g) => g.id !== id); Store.save('goals', State.goals); render();
  } else if (action === 'archive-goal') {
    const g = goalById(id); if (g) { g.archived = true; Store.save('goals', State.goals); toast('🗄 В архиве'); render(); }
  } else if (action === 'restore-goal') {
    const g = goalById(id); if (g) { g.archived = false; Store.save('goals', State.goals); render(); }
  } else if (action === 'filter-goals') {
    State.goalFilter = el.dataset.type; render();

  // --- Дерево ---
  } else if (action === 'select-tree') { State.treeSkill = el.dataset.skill; State.treeSelNode = null; render();
  } else if (action === 'unlock-node') {
    const sid = State.treeSkill, node = State.tree[sid] && State.tree[sid].nodes.find((n) => n.id === el.dataset.node); if (!node) return;
    if (!nodeUnlockable(sid, node)) { toast('Не хватает очков или закрыты предыдущие узлы'); return; }
    node.unlocked = true; Store.save('skilltree', State.tree); toast(`Открыто: ${node.title} (+${node.perkXpPct}% XP)`); render();

  // --- Редактор дерева навыков ---
  } else if (action === 'toggle-tree-edit') { State.treeEdit = !State.treeEdit; State.treeSelNode = null; render();
  } else if (action === 'tree-sel-node') { State.treeSelNode = el.dataset.node || null; render();
  } else if (action === 'tree-add-node') {
    const t = State.tree[State.treeSkill]; if (!t) return;
    const k = t.nodes.length, nn = { id: 'nd_' + uid(), title: 'Новый узел', desc: '', cost: 1, requires: [], perkXpPct: 5, unlocked: false, x: 40 + (k % 4) * 46, y: 40 + (k % 4) * 46 };
    t.nodes.push(nn); State.treeSelNode = nn.id; Store.save('skilltree', State.tree); render();
  } else if (action === 'tree-del-node') {
    const t = State.tree[State.treeSkill]; if (!t) return;
    const nid = el.dataset.node;
    t.nodes = t.nodes.filter((n) => n.id !== nid);
    for (const n of t.nodes) n.requires = (n.requires || []).filter((r) => r !== nid); // снять висящие связи
    State.treeSelNode = null; Store.save('skilltree', State.tree); render();

  // --- Награды ---
  } else if (action === 'buy-reward') {
    const r = State.rewards.find((x) => x.id === id); if (!r) return;
    if (goldBalance() < r.cost) { toast('Недостаточно золота'); return; }
    State.purchases.push({ id: 'p_' + uid(), rewardId: r.id, name: r.name, cost: r.cost, at: new Date().toISOString() });
    Store.save('purchases', State.purchases); toast(`Куплено: ${r.name} 🎉`); sfx('coin'); checkAchievements(); render();
  } else if (action === 'delete-reward') {
    State.rewards = State.rewards.filter((x) => x.id !== id); Store.save('rewards', State.rewards); render();

  // --- Неделя ---
  } else if (action === 'week-prev') { State.weekStart = addDays(State.weekStart, -7); State.wkAddDate = null; render();
  } else if (action === 'week-next') { State.weekStart = addDays(State.weekStart, 7); State.wkAddDate = null; render();
  } else if (action === 'wk-add-task') { State.wkAddDate = el.dataset.date; render();
  } else if (action === 'wk-add-cancel') { State.wkAddDate = null; render();

  // --- Календарь (вкладка) ---
  } else if (action === 'cal-date') { State.calDate = el.dataset.date; render();
  } else if (action === 'cal-shift') { State.calDate = addDays(State.calDate || todayStr(), Number(el.dataset.days)); render();
  } else if (action === 'cal-today') { State.calDate = todayStr(); render();
  } else if (action === 'goto-calendar') { State.calDate = todayStr(); State.view = 'calendar'; render();

  // --- Инбокс / быстрый захват (Блок 2) ---
  } else if (action === 'cap-voice') { startCapture('voice');
  } else if (action === 'cap-video') { startCapture('video');
  } else if (action === 'cap-stop') { stopCapture();
  } else if (action === 'goto-notes') { State.view = 'notes'; track('view:notes'); render();
  } else if (action === 'ai-review') { runWeeklyReview();
  } else if (action === 'ai-import-goals') { openProposeModal('goals');
  } else if (action === 'ai-import-levels') { openProposeModal('calibrate');
  } else if (action === 'propose-run') { runPropose(el.dataset.kind);
  } else if (action === 'bridge-copy') { copyBridgePrompt(el.dataset.kind);
  } else if (action === 'bridge-parse') { parseBridgeResponse();
  } else if (action === 'propose-apply') { applyAcceptedProposals();
  } else if (action === 'propose-close') { const m = document.getElementById('propose-modal'); if (m) m.remove();
  } else if (action === 'open-helper') { openHelperChat();
  } else if (action === 'helper-close') { const m = document.getElementById('helper-modal'); if (m) m.remove();
  } else if (action === 'helper-to-settings') { const m = document.getElementById('helper-modal'); if (m) m.remove(); State.view = 'settings'; render();
  } else if (action === 'chat-suggest') { sendChat(el.dataset.q);
  } else if (action === 'apply-cat') {
    const form = el.closest('.card').querySelector('#add-task'); const sel = form && form.querySelector('select[name="skillId"]');
    if (sel) { sel.value = el.dataset.skill; const ti = form.querySelector('input[name="title"]'); if (ti) ti.focus(); }
    el.parentElement.innerHTML = '';
  } else if (action === 'ai-cat-suggest') {
    const card = el.closest('.card'); const form = card && card.querySelector('#add-task');
    const sel = form && form.querySelector('select[name="skillId"]'); const box = card && card.querySelector('#cat-suggest');
    if (box && sel) aiCatSuggest(el.dataset.title, box, sel);
  } else if (action === 'ai-close') { const m = document.getElementById('ai-modal'); if (m) m.remove();
  } else if (action === 'note-del') {
    State.inbox = (State.inbox || []).filter((x) => x.id !== id); Store.save('inbox', State.inbox); render();
  } else if (action === 'note-to-goal') {
    const it = (State.inbox || []).find((x) => x.id === id); if (!it || !(it.text || '').trim()) return;
    openProposeModal('goals', it.text.trim()); // заметка → движок предложений (ИИ оформит в цели/сферы)
  } else if (action === 'note-quest') {
    const it = (State.inbox || []).find((x) => x.id === id); if (!it) return;
    const title = (it.text || (it.kind === 'voice' ? 'Голосовая заметка' : it.kind === 'video' ? 'Видео-заметка' : 'Заметка')).slice(0, 120);
    const sid = State.settings.skills[0] && State.settings.skills[0].id;
    State.tasks.push({ id: uid(), title, skillId: sid, skillIds: sid ? [sid] : [], estimateMin: 30, difficulty: 'normal', date: todayStr(), done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: null, createdAt: new Date().toISOString() });
    State.inbox = State.inbox.filter((x) => x.id !== id);
    Store.save('tasks', State.tasks); Store.save('inbox', State.inbox); toast('→ В квестах на сегодня'); render();
  } else if (action === 'export-ics') {
    const ics = buildICS();
    if (!/BEGIN:VEVENT/.test(ics)) { toast('Нет квестов со временем — поставь их в Календаре'); return; }
    try { const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'gojo-calendar.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('📆 .ics скачан — открой его в Календаре для импорта'); } catch { toast('Не удалось создать файл'); }
  } else if (action === 'cal-mode') { State.calMode = el.dataset.mode; State.view = 'calendar'; render();
  } else if (action === 'cal-pick-day') { State.calDate = el.dataset.date; State.calMode = 'day'; render();
  } else if (action === 'cal-shift-month') { const d = parseDate(State.calDate || todayStr()); State.calDate = fmtDate(new Date(d.getFullYear(), d.getMonth() + Number(el.dataset.delta), Math.min(d.getDate(), 28))); render();
  } else if (action === 'cal-remind-toggle') { toggleReminders();
  } else if (action === 'save-week') {
    const ws = State.weekStart; State.weeks[ws] = State.weeks[ws] || {};
    State.weeks[ws].intention = document.getElementById('week-intention').value;
    State.weeks[ws].review = document.getElementById('week-review').value;
    Store.save('weeks', State.weeks); toast('Сохранено'); render();

  // --- Настройки ---
  } else if (action === 'add-skill') {
    captureSettingsForm(); // сохранить текущие правки формы, чтобы не потерять
    State.settings.skills.push({ id: 'sk_' + uid(), name: 'Новая сфера', color: '#6c8cff' }); ensureTrees();
    Store.save('settings', State.settings); Store.save('skilltree', State.tree); render();
  } else if (action === 'delete-skill') {
    captureSettingsForm();
    const sk = State.settings.skills.find((x) => x.id === id);
    // СОХРАНЯЕМ планы: квесты/привычки/цели НЕ удаляются — просто теряют категорию (переназначаются потом).
    const affected = State.tasks.filter((t) => t.skillId === id).length
      + State.habits.filter((h) => h.skillId === id).length
      + (State.goals || []).filter((g) => g.skillId === id).length;
    const msg = affected
      ? `Удалить сферу «${sk ? sk.name : id}»?\n\nЕё ${affected} квестов / привычек / целей НЕ удалятся — останутся без категории, переназначишь их потом. Опыт сохранится.`
      : `Удалить сферу «${sk ? sk.name : id}»?`;
    if (!confirm(msg)) return;
    State.settings.skills = State.settings.skills.filter((x) => x.id !== id);
    for (const s2 of State.settings.skills) if (s2.parentId === id) s2.parentId = null;
    if (State.tree) delete State.tree[id];
    if (State.settings.imported) delete State.settings.imported[id];
    Store.save('settings', State.settings); Store.save('skilltree', State.tree); render();
  } else if (action === 'skill-collapse') {
    captureSettingsForm();
    State.settingsCollapsed = State.settingsCollapsed || {};
    State.settingsCollapsed[id] = !State.settingsCollapsed[id];
    render();
  } else if (action === 'skill-move') {
    captureSettingsForm();
    const arr = State.settings.skills, sk = arr.find((x) => x.id === id);
    if (sk) {
      const dir = Number(el.dataset.dir);
      const sibs = arr.filter((x) => (x.parentId || null) === (sk.parentId || null));
      const pos = sibs.indexOf(sk), tgt = sibs[pos + dir];
      if (tgt) { const i = arr.indexOf(sk), j = arr.indexOf(tgt); arr[i] = tgt; arr[j] = sk; Store.save('settings', State.settings); }
    }
    render();
  } else if (action === 'add-habit') {
    captureSettingsForm();
    const first = State.settings.skills[0];
    State.habits.push({ id: 'h_' + uid(), title: 'Новая привычка', skillId: first ? first.id : 'life', difficulty: 'easy', estimateMin: 10, days: [1, 2, 3, 4, 5], archived: false, createdAt: new Date().toISOString() });
    Store.save('habits', State.habits); render();
  } else if (action === 'delete-habit') {
    if (!confirm('Удалить привычку? Её отметки и опыт тоже удалятся.')) return;
    captureSettingsForm();
    State.habits = State.habits.filter((h) => h.id !== id);
    for (const d in State.habitlog) { delete State.habitlog[d][id]; if (!Object.keys(State.habitlog[d]).length) delete State.habitlog[d]; }
    Store.save('habits', State.habits); Store.save('habitlog', State.habitlog); render();
  } else if (action === 'save-settings') { saveSettingsFromForm();
  } else if (action === 'reset-data') {
    if (!confirm('Удалить ВСЕ квесты и записи дней? Навыки, привычки, цели и настройки останутся.')) return;
    State.tasks = []; State.days = {}; Store.save('tasks', State.tasks); Store.save('days', State.days); State.view = 'today'; toast('Сброшено'); render();
  }
}

// Считать ТЕКУЩИЕ правки формы настроек в State (без сохранения/рендера).
// Вызывается перед любыми структурными изменениями (add/delete), чтобы не терять несохранённые правки.
function captureSettingsForm() {
  if (!document.getElementById('skills-list')) return; // формы нет на экране
  const s = State.settings, num = (id, fb) => { const el = document.getElementById(id); if (!el) return fb; const v = parseFloat(el.value); return isNaN(v) ? fb : v; };
  const appEl = document.getElementById('set-appName'); if (appEl) s.appName = appEl.value.trim() || 'Gojo';
  // ВАЖНО: перезаписываем skills только если в DOM реально есть строки. Иначе глитч/гонка могли бы стереть все сферы.
  const skillRows = [...document.querySelectorAll('#skills-list .skill-edit')];
  if (skillRows.length) {
    s.skills = skillRows.map((row) => {
      const psel = row.querySelector('[data-field="parentId"]');
      return { id: row.dataset.id, name: row.querySelector('[data-field="name"]').value.trim() || 'Без названия', color: row.querySelector('[data-field="color"]').value, parentId: psel && psel.value ? psel.value : null };
    });
    // нормализация parentId: глубина любая, но родитель должен существовать и цепочка не должна зацикливаться
    for (const sk of s.skills) {
      if (!sk.parentId) continue;
      let cur = sk, ok = true, g = 0; const seen = new Set([sk.id]);
      while (cur.parentId && g++ < 10) {
        const p = s.skills.find((x) => x.id === cur.parentId);
        if (!p || seen.has(p.id)) { ok = false; break; } // битая ссылка или цикл
        seen.add(p.id); cur = p;
      }
      if (!ok || g >= 10) sk.parentId = null;
    }
  }
  // Привычки: 0 строк = пусто легитимно ТОЛЬКО когда секция реально отрендерена. Защита от гонки: пишем лишь если контейнер на месте.
  const habitsList = document.getElementById('habits-list');
  if (habitsList) {
    const oldHabits = State.habits;
    State.habits = [...habitsList.querySelectorAll('.habit-edit')].map((row) => {
      const old = oldHabits.find((h) => h.id === row.dataset.id);
      return { id: row.dataset.id, title: row.querySelector('[data-field="title"]').value.trim() || 'Привычка', skillId: row.querySelector('[data-field="skillId"]').value, difficulty: row.querySelector('[data-field="difficulty"]').value, estimateMin: Number(row.querySelector('[data-field="estimateMin"]').value) || 0, days: [...row.querySelectorAll('input[data-day]:checked')].map((c) => Number(c.dataset.day)), archived: false, createdAt: old ? old.createdAt : new Date().toISOString() };
    });
  }
  s.xp.perMinute = num('k-perMinute', 1); s.xp.completionBonus = num('k-bonus', 5);
  s.xp.difficulty = { easy: num('k-easy', 1), normal: num('k-normal', 1.5), hard: num('k-hard', 2.2) };
  s.gold = { perMinute: num('g-perMinute', 0.4), completionBonus: num('g-bonus', 3) };
  s.focus = { pomodoro: document.getElementById('f-pomodoro').value === '1', workMin: num('f-workMin', 25), breakMin: num('f-breakMin', 5), sound: document.getElementById('f-sound').value === '1', notify: document.getElementById('f-notify').value === '1' };
  s.curve = { base: num('k-base', 100), skillBase: num('k-skillBase', 60), growth: num('k-growth', 1.3) };
}
function saveSettingsFromForm() {
  captureSettingsForm();
  ensureTrees();
  Store.save('settings', State.settings); Store.save('habits', State.habits); Store.save('skilltree', State.tree);
  toast('Настройки сохранены'); render();
}
// Автосохранение формы настроек: читаем DOM в State и сохраняем (дебаунс).
let _settingsAutosaveTimer = null;
function autosaveSettings() {
  clearTimeout(_settingsAutosaveTimer);
  _settingsAutosaveTimer = setTimeout(flushSettingsForm, 500);
}
// Немедленный флаш формы настроек (при уходе с экрана / закрытии вкладки).
function flushSettingsForm() {
  if (!document.getElementById('skills-list')) return; // формы нет на экране
  clearTimeout(_settingsAutosaveTimer);
  captureSettingsForm();
  Store.save('settings', State.settings); Store.save('habits', State.habits);
}

function clearAllData() {
  State.settings = null; State.tasks = null; State.days = null; State.habits = null;
  State.habitlog = null; State.goals = null; State.tree = null; State.rewards = null;
  State.purchases = null; State.achievements = null; State.weeks = null; State.lootbox = null;
  State.timer = null; persistTimer(); stopTick(); closeFocusWidget(); removePill();
  State.selectedProfile = null; State.obSkills = new Set();
}

function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}

// ============================================================
//  Старт
// ============================================================

// Загружает данные пользователя и переходит в основное приложение
async function initApp() {
  State.settings = await Store.load('settings', DEFAULT_SETTINGS);
  State.settings.appName = State.settings.appName || DEFAULT_SETTINGS.appName;
  State.settings.skills = State.settings.skills || [];
  State.settings.xp = Object.assign({}, DEFAULT_SETTINGS.xp, State.settings.xp);
  State.settings.xp.difficulty = Object.assign({}, DEFAULT_SETTINGS.xp.difficulty, State.settings.xp.difficulty);
  State.settings.gold = Object.assign({}, DEFAULT_SETTINGS.gold, State.settings.gold);
  State.settings.curve = Object.assign({}, DEFAULT_SETTINGS.curve, State.settings.curve);
  State.settings.focus = Object.assign({}, DEFAULT_SETTINGS.focus, State.settings.focus);
  State.settings.body = State.settings.body || {};
  State.settings.imported = State.settings.imported || {};
  State.settings.avatar = State.settings.avatar || defaultAvatar();

  // Если нет навыков → онбординг
  if (State.settings.skills.length === 0) {
    State.phase = 'onboarding'; render(); return;
  }

  // Счётчик своих репортов — для ачивок «Баг-хантер»/«Страж Врат» (не блокирует загрузку)
  fetch('/api/feedback/mine').then((r) => r.json()).then((d) => { State.myFeedbackCount = d.count || 0; checkAchievements(); }).catch(() => {});

  State.tasks = await Store.load('tasks', []);
  State.tasks.forEach((t) => { if (t.actualMin === undefined) t.actualMin = null; if (t.startTime === undefined) t.startTime = null; if (t.goldAwarded === undefined) t.goldAwarded = 0; });
  State.days = await Store.load('days', {});
  State.habits = await Store.load('habits', []);
  State.habitlog = await Store.load('habitlog', {});
  State.goals = await Store.load('goals', []);
  State.goals.forEach((g) => { if (!g.type) g.type = 'mid'; if (g.xpReward === undefined) g.xpReward = GOAL_XP[g.type] != null ? GOAL_XP[g.type] : GOAL_BONUS.xp; if (g.parentId === undefined) g.parentId = null; if (g.status === undefined) g.status = 'active'; if (g.metric === undefined) g.metric = null; });
  State.tree = await Store.load('skilltree', {});
  State.rewards = await Store.load('rewards', []);
  State.purchases = await Store.load('purchases', []);
  State.achievements = await Store.load('achievements', {});
  State.weeks = await Store.load('weeks', {});
  State.lootbox = await Store.load('lootbox', { day: todayStr(), opened: 0, goldWon: 0, boost: null, titles: [], equipped: null, history: [] });
  State.inbox = await Store.load('inbox', []);
  State.antihabits = await Store.load('antihabits', []);
  ensureLootbox();
  ensureEnergy();

  ensureTrees();
  State.treeSkill = State.settings.skills[0] && State.settings.skills[0].id;
  State.weekStart = weekStart(todayStr());
  State.timer = loadTimer();
  if (State.timer) { State.timer.phase = State.timer.phase || 'work'; if (State.timer.phaseStartElapsed === undefined) State.timer.phaseStartElapsed = 0; updatePill(focusInfo()); if (State.timer.running) startTick(); }
  checkAchievements(true);
  State.phase = 'app';
  render();
  publishLeaderboard();
  if (!localStorage.getItem('liferpg_seen_guide')) { localStorage.setItem('liferpg_seen_guide', '1'); setTimeout(showGuide, 500); }
}

// Публикует публичный снапшот прогресса в лидерборд (приватные данные не уходят)
function publishLeaderboard() {
  if (!State.settings) return;
  try {
    const c = State.settings.curve, oi = levelInfo(overallXp(), c.base, c.growth);
    fetch('/api/leaderboard/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalXp: overallXp(), level: oi.level, rank: charRank().name, optOut: !!State.settings.leaderboardOptOut }) }).catch(() => {});
  } catch (e) {}
}

// Делегированный обработчик change (для select-ов вне форм — напр. импорт достижений)
function onChange(e) {
  // смена статуса цели (active/waiting/paused)
  if (e.target.dataset && e.target.dataset.action === 'goal-status') {
    const g = goalById(e.target.dataset.id); if (g) { g.status = e.target.value; Store.save('goals', State.goals); render(); }
    return;
  }
  // правка текста заметки (сохраняем на blur/change, без ререндера — не сбивая фокус)
  if (e.target.dataset && e.target.dataset.action === 'note-edit') {
    const it = (State.inbox || []).find((x) => x.id === e.target.dataset.id); if (it) { it.text = e.target.value; Store.save('inbox', State.inbox); }
    return;
  }
  // превью выбранных фото/видео в форме фидбека
  if (e.target.name === 'files' && e.target.closest('#feedback-form')) {
    const pv = document.getElementById('fb-previews'); if (!pv) return;
    pv.innerHTML = '';
    for (const file of e.target.files) {
      const url = URL.createObjectURL(file);
      pv.insertAdjacentHTML('beforeend', file.type.startsWith('video/')
        ? `<video class="fb-thumb" src="${url}" muted></video>`
        : `<img class="fb-thumb" src="${url}" alt=""/>`);
    }
    return;
  }
  // при смене квеста в пикере календаря — подставить его длительность
  if (e.target.id === 'cal-quest') { const t = questById(e.target.value), d = document.getElementById('cal-dur'); if (t && d) d.value = Number(t.estimateMin) || 30; return; }
  // смена вложенности сферы → сохранить и сразу перерисовать дерево (отступы, защита от циклов)
  if (e.target.dataset.field === 'parentId' && e.target.closest('#skills-list')) { flushSettingsForm(); render(); return; }
  // автосохранение формы настроек (сферы/привычки/формулы/название) — чтобы правки не терялись при F5
  if (e.target.closest('#skills-list, #habits-list, .knob') || e.target.id === 'set-appName') autosaveSettings();
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'set-import') { applyImport(el.dataset.skill, Number(el.value)); return; }
  if (a === 'set-ai-pref') { State.settings.aiPref = el.value; Store.save('settings', State.settings); toast('🤖 ИИ по умолчанию: ' + aiProviderLabel(el.value)); return; }
  if (a === 'toggle-cat') {
    const t = questById(el.dataset.id); if (!t) return;
    let ids = taskSkills(t).slice(); const sid = el.dataset.skill;
    if (el.checked) { if (!ids.includes(sid)) ids.push(sid); }
    else ids = ids.filter((x) => x !== sid);
    if (!ids.length) { el.checked = true; toast('Нужна хотя бы одна категория'); return; } // нельзя снять последнюю
    t.skillIds = ids; t.skillId = ids[0]; // основная = первая
    Store.save('tasks', State.tasks); return;
  }
  if (a === 'tree-field') {
    const t = State.tree[State.treeSkill], n = t && t.nodes.find((x) => x.id === el.dataset.node); if (!n) return;
    const f = el.dataset.field;
    if (f === 'cost' || f === 'perkXpPct') n[f] = Math.max(0, Math.round(Number(el.value) || 0));
    else n[f] = el.value.trim() || (f === 'title' ? 'Узел' : '');
    Store.save('skilltree', State.tree); render(); return;
  }
  if (a === 'tree-toggle-req') {
    const t = State.tree[State.treeSkill], n = t && t.nodes.find((x) => x.id === el.dataset.node); if (!n) return;
    const req = el.dataset.req; n.requires = n.requires || [];
    if (el.checked) { if (!n.requires.includes(req)) n.requires.push(req); }
    else n.requires = n.requires.filter((r) => r !== req);
    Store.save('skilltree', State.tree); render(); return;
  }
}
// Живой автосейв формы настроек при вводе (текст печатается без blur — 'change' не сработал бы)
function onSettingsInput(e) {
  if (e.target.closest('#skills-list, #habits-list, .knob') || e.target.id === 'set-appName') autosaveSettings();
  if (e.target.matches('#add-task input[name="title"]')) updateCatSuggest(e.target);
}

// --- Перетаскивание задач между днями в недельном виде (Sunsama-style) ---
let _wkDragId = null;
function onWkDragStart(e) {
  const task = e.target.closest('.wk-task'); if (!task) return;
  _wkDragId = task.dataset.task;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', _wkDragId); } catch {}
  task.classList.add('wk-dragging');
}
function onWkDragOver(e) {
  if (!_wkDragId) return;
  const col = e.target.closest('.wk-col'); if (!col) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.wk-col.wk-drop').forEach((c) => { if (c !== col) c.classList.remove('wk-drop'); });
  col.classList.add('wk-drop');
}
function onWkDrop(e) {
  const col = e.target.closest('.wk-col'); if (!col || !_wkDragId) { cleanupWkDrag(); return; }
  e.preventDefault();
  const t = questById(_wkDragId), date = col.dataset.date, changed = t && date && t.date !== date;
  if (changed) { t.date = date; Store.save('tasks', State.tasks); }
  cleanupWkDrag();
  if (changed) render();
}
function cleanupWkDrag() {
  _wkDragId = null;
  document.querySelectorAll('.wk-dragging').forEach((el) => el.classList.remove('wk-dragging'));
  document.querySelectorAll('.wk-drop').forEach((el) => el.classList.remove('wk-drop'));
}

// --- Перетаскивание по часовой сетке во вкладке «Календарь» (#8: drag в расписании дня) ---
let _calDragId = null;
function onCalDragStart(e) {
  const b = e.target.closest('.calv-block, .calv-chip'); if (!b) return;
  _calDragId = b.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', _calDragId); } catch {}
  b.classList.add('wk-dragging');
}
function onCalDragOver(e) {
  if (!_calDragId) return;
  const grid = e.target.closest('.calv-grid'), tray = e.target.closest('.calv-tray');
  if (!grid && !tray) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  if (grid) {
    const min = calYtoMin(e.clientY - grid.getBoundingClientRect().top);
    let ind = grid.querySelector('.calv-indicator');
    if (!ind) { ind = document.createElement('div'); ind.className = 'calv-indicator'; grid.appendChild(ind); }
    ind.style.top = calMinToY(min) + 'px';
    ind.dataset.time = fmtHM(min);
  }
}
function onCalDrop(e) {
  if (!_calDragId) return;
  const grid = e.target.closest('.calv-grid'), tray = e.target.closest('.calv-tray');
  if (!grid && !tray) { cleanupCalDrag(); return; }
  e.preventDefault();
  const t = questById(_calDragId);
  if (t) {
    if (grid) t.startTime = fmtHM(calYtoMin(e.clientY - grid.getBoundingClientRect().top));
    else t.startTime = null; // дроп в «Без времени» — снять с расписания
    Store.save('tasks', State.tasks);
  }
  cleanupCalDrag();
  render();
}
function cleanupCalDrag() {
  _calDragId = null;
  document.querySelectorAll('.calv-indicator').forEach((el) => el.remove());
  document.querySelectorAll('.wk-dragging').forEach((el) => el.classList.remove('wk-dragging'));
}

// --- Напоминания о задачах со временем (#7). Браузерные уведомления, пока вкладка открыта. ---
let _reminderTimers = [];
function scheduleReminders() {
  _reminderTimers.forEach(clearTimeout); _reminderTimers = [];
  if (!State.settings || !State.settings.remind) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = todayStr(), now = Date.now();
  for (const t of State.tasks) {
    if (t.date !== today || !t.startTime || t.done) continue;
    const [H, M] = t.startTime.split(':').map(Number);
    const when = new Date(); when.setHours(H, M, 0, 0);
    const delay = when.getTime() - now;
    if (delay > 0 && delay < 24 * 3600 * 1000) {
      _reminderTimers.push(setTimeout(() => { try { new Notification('🗓 ' + t.title, { body: 'Время по плану: ' + t.startTime, tag: t.id }); } catch {} }, delay));
    }
  }
}
function toggleReminders() {
  if (!('Notification' in window)) { toast('Браузер не поддерживает уведомления'); return; }
  if (State.settings.remind) { State.settings.remind = false; Store.save('settings', State.settings); scheduleReminders(); toast('🔕 Напоминания выключены'); render(); return; }
  const apply = () => { State.settings.remind = true; Store.save('settings', State.settings); scheduleReminders(); toast('🔔 Напоминания включены · работают пока вкладка открыта'); render(); };
  if (Notification.permission === 'granted') apply();
  else Notification.requestPermission().then((p) => { if (p === 'granted') apply(); else toast('Нужно разрешить уведомления в браузере'); });
}

// Точка входа — проверяем сессию, потом грузим нужный экран
async function init() {
  document.addEventListener('submit', onSubmit);
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onSettingsInput);
  document.addEventListener('pointerdown', onTreePointerDown);
  document.addEventListener('dragstart', onWkDragStart);
  document.addEventListener('dragover', onWkDragOver);
  document.addEventListener('drop', onWkDrop);
  document.addEventListener('dragend', cleanupWkDrag);
  document.addEventListener('dragstart', onCalDragStart);
  document.addEventListener('dragover', onCalDragOver);
  document.addEventListener('drop', onCalDrop);
  document.addEventListener('dragend', cleanupCalDrag);
  // Страховка от потери правок: при закрытии/перезагрузке дочитываем форму настроек из DOM и сохраняем (keepalive переживает unload)
  window.addEventListener('beforeunload', () => {
    if (!document.getElementById('skills-list')) return;
    captureSettingsForm();
    const opt = (o) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o), keepalive: true });
    try { fetch('/api/data/settings', opt(State.settings)); fetch('/api/data/habits', opt(State.habits)); } catch {}
  });

  // Проверяем текущую сессию
  try {
    const r = await fetch('/api/auth/me');
    if (r.ok) { State.me = await r.json(); await initApp(); return; }
  } catch {}

  // Не залогинен — загружаем профили и показываем экран входа
  try {
    const r = await fetch('/api/auth/profiles');
    if (r.ok) State.profiles = await r.json();
  } catch { State.profiles = []; }

  State.phase = 'login';
  render();
}

init();
