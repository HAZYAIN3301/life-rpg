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
};

const DIFF = { easy: 'Лёгкая', normal: 'Обычная', hard: 'Сложная' };
const WEEKDAYS = [
  { js: 1, label: 'Пн' }, { js: 2, label: 'Вт' }, { js: 3, label: 'Ср' },
  { js: 4, label: 'Чт' }, { js: 5, label: 'Пт' }, { js: 6, label: 'Сб' }, { js: 0, label: 'Вс' },
];
const GOAL_BONUS = { xp: 60, gold: 30 };
const GOAL_TYPES = [
  { id: 'recurring', label: 'Повторяющиеся' },
  { id: 'short', label: 'Краткосрочные' },
  { id: 'mid', label: 'Среднесрочные' },
  { id: 'long', label: 'Долгосрочные' },
];
const GOAL_XP = { recurring: 15, short: 50, mid: 200, long: 750 };
function goalTypeLabel(t) { const x = GOAL_TYPES.find((g) => g.id === t); return x ? x.label : 'Цель'; }

// Достижения — описаны в коде, считаются на лету
const ACHIEVEMENTS = [
  { id: 'first_quest', icon: '⚔️', title: 'Первый шаг', desc: 'Выполни первый квест', test: () => doneTasks().length >= 1 },
  { id: 'quests_50', icon: '🏆', title: 'Полста квестов', desc: '50 выполненных квестов', test: () => doneTasks().length >= 50, prog: () => ({ cur: doneTasks().length, target: 50 }) },
  { id: 'first_habit', icon: '🌱', title: 'Росток привычки', desc: 'Отметь привычку впервые', test: () => Object.values(State.habitlog).some((m) => Object.keys(m).length > 0) },
  { id: 'streak_7', icon: '🔥', title: 'Неделя подряд', desc: 'Серия 7 дней', test: () => currentStreak() >= 7, prog: () => ({ cur: currentStreak(), target: 7 }) },
  { id: 'streak_30', icon: '🌋', title: 'Месяц подряд', desc: 'Серия 30 дней', test: () => currentStreak() >= 30, prog: () => ({ cur: currentStreak(), target: 30 }) },
  { id: 'level_5', icon: '⭐', title: 'Уровень 5', desc: 'Достигни 5 уровня', test: () => charLevel() >= 5, prog: () => ({ cur: charLevel(), target: 5 }) },
  { id: 'level_10', icon: '🌟', title: 'Уровень 10', desc: 'Достигни 10 уровня', test: () => charLevel() >= 10, prog: () => ({ cur: charLevel(), target: 10 }) },
  { id: 'xp_1000', icon: '💎', title: 'Тысяча опыта', desc: 'Накопи 1000 XP', test: () => overallXp() >= 1000, prog: () => ({ cur: overallXp(), target: 1000 }) },
  { id: 'first_goal', icon: '🎯', title: 'Цель взята', desc: 'Заверши первую цель', test: () => State.goals.some((g) => g.completedAt) },
  { id: 'first_reward', icon: '🎁', title: 'Награда', desc: 'Купи первую награду', test: () => (State.purchases || []).length > 0 },
  { id: 'gold_500', icon: '🪙', title: 'Богатей', desc: 'Заработай 500 золота всего', test: () => goldEarned() >= 500, prog: () => ({ cur: goldEarned(), target: 500 }) },
  { id: 'skills_all3', icon: '📚', title: 'Разносторонний', desc: 'Все навыки до ур.3', test: () => State.settings.skills.length > 0 && State.settings.skills.every((s) => skillLevelOf(s.id) >= 3) },
];

// Шаблоны навыков для онбординга (как у rpgreal)
const SKILL_TEMPLATES = [
  { name: 'Спорт',          color: '#5fbf5f' }, { name: 'Учёба',          color: '#4f86f7' },
  { name: 'Работа',         color: '#e0526a' }, { name: 'Здоровье',       color: '#22c1a4' },
  { name: 'Творчество',     color: '#b06ff0' }, { name: 'Отношения',      color: '#e87d3e' },
  { name: 'Финансы',        color: '#d8a44b' }, { name: 'Программирование', color: '#4f86f7' },
  { name: 'Английский',     color: '#22c1a4' }, { name: 'Бизнес',         color: '#e0526a' },
  { name: 'Саморазвитие',   color: '#b06ff0' }, { name: 'Быт',            color: '#8899bb' },
  { name: 'Похудение',      color: '#5fbf5f' }, { name: 'Блогинг',        color: '#e87d3e' },
  { name: 'Музыка',         color: '#d8a44b' }, { name: 'Чтение',         color: '#22c1a4' },
];

// ── Программы-данжи (идея 25): готовые наборы сфер + привычек + стартовых квестов.
//    Дают новичку структуру в один тап вместо чистого листа. Можно добавить и позже (Настройки).
const DUNGEON_PROGRAMS = [
  { id: 'athlete', icon: '🏃', name: 'Спортсмен', tagline: 'Тело как проект: сила, выносливость, режим.',
    skills: [ { name: 'Спорт', color: '#5fbf5f', attr: 'str' }, { name: 'Здоровье', color: '#22c1a4', attr: 'end' } ],
    habits: [ { skill: 'Спорт', title: 'Силовая / зарядка', estimateMin: 30, difficulty: 'normal', days: [1,3,5] },
              { skill: 'Спорт', title: 'Растяжка', estimateMin: 10, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Здоровье', title: 'Выпить 8 стаканов воды', estimateMin: 5, difficulty: 'easy', days: [1,2,3,4,5,6,0] } ],
    quests: [ { skill: 'Спорт', title: 'Пробежка 20 минут', estimateMin: 20, difficulty: 'normal' },
              { skill: 'Здоровье', title: 'Лечь спать до 23:00', estimateMin: 5, difficulty: 'easy' } ] },
  { id: 'student', icon: '🎓', name: 'Студент', tagline: 'Учёба без аврала: регулярность и глубина.',
    skills: [ { name: 'Учёба', color: '#4f86f7', attr: 'int' }, { name: 'Чтение', color: '#22c1a4', attr: 'int' } ],
    habits: [ { skill: 'Учёба', title: 'Учить лексику / карточки', estimateMin: 15, difficulty: 'easy', days: [1,2,3,4,5] },
              { skill: 'Чтение', title: 'Прочитать 10 страниц', estimateMin: 20, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Учёба', title: 'Конспект / повторение', estimateMin: 30, difficulty: 'normal', days: [2,4] } ],
    quests: [ { skill: 'Учёба', title: 'Разобрать сложную тему', estimateMin: 45, difficulty: 'hard' },
              { skill: 'Учёба', title: 'Сделать домашку', estimateMin: 30, difficulty: 'normal' } ] },
  { id: 'creator', icon: '🎬', name: 'Креатор', tagline: 'Создавай и публикуй регулярно.',
    skills: [ { name: 'Творчество', color: '#b06ff0', attr: 'cha' }, { name: 'Блогинг', color: '#e87d3e', attr: 'cha' } ],
    habits: [ { skill: 'Творчество', title: 'Идеи в копилку (3 шт)', estimateMin: 10, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Блогинг', title: 'Поработать над контентом', estimateMin: 45, difficulty: 'normal', days: [1,3,5] } ],
    quests: [ { skill: 'Блогинг', title: 'Выпустить пост / ролик', estimateMin: 60, difficulty: 'hard' },
              { skill: 'Творчество', title: 'Изучить работу кумира', estimateMin: 30, difficulty: 'easy' } ] },
  { id: 'zen', icon: '🧘', name: 'Дзен', tagline: 'Внутренняя опора: спокойствие и осознанность.',
    skills: [ { name: 'Саморазвитие', color: '#b06ff0', attr: 'spr' }, { name: 'Здоровье', color: '#22c1a4', attr: 'spr' } ],
    habits: [ { skill: 'Саморазвитие', title: 'Медитация', estimateMin: 10, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Саморазвитие', title: 'Дневник благодарности', estimateMin: 5, difficulty: 'easy', days: [1,2,3,4,5,6,0] },
              { skill: 'Здоровье', title: 'Прогулка без телефона', estimateMin: 20, difficulty: 'easy', days: [2,4,6] } ],
    quests: [ { skill: 'Саморазвитие', title: 'Цифровой детокс 2 часа', estimateMin: 120, difficulty: 'normal' } ] },
  { id: 'pro', icon: '💼', name: 'Профи', tagline: 'Карьера и деньги под контролем.',
    skills: [ { name: 'Работа', color: '#e0526a', attr: 'dis' }, { name: 'Финансы', color: '#d8a44b', attr: 'int' } ],
    habits: [ { skill: 'Работа', title: 'Глубокая работа 90 мин', estimateMin: 90, difficulty: 'hard', days: [1,2,3,4,5] },
              { skill: 'Финансы', title: 'Записать траты', estimateMin: 5, difficulty: 'easy', days: [1,2,3,4,5,6,0] } ],
    quests: [ { skill: 'Работа', title: 'Закрыть ключевую задачу недели', estimateMin: 90, difficulty: 'hard' },
              { skill: 'Финансы', title: 'Свести бюджет за неделю', estimateMin: 30, difficulty: 'normal' } ] },
  { id: 'coder', icon: '💻', name: 'Кодер', tagline: 'Прокачка в разработке шаг за шагом.',
    skills: [ { name: 'Программирование', color: '#4f86f7', attr: 'int' }, { name: 'Английский', color: '#22c1a4', attr: 'int' } ],
    habits: [ { skill: 'Программирование', title: 'Кодить / pet-проект', estimateMin: 45, difficulty: 'normal', days: [1,2,3,4,5] },
              { skill: 'Программирование', title: 'Решить задачу (LeetCode)', estimateMin: 30, difficulty: 'hard', days: [2,4] },
              { skill: 'Английский', title: 'Английский 15 мин', estimateMin: 15, difficulty: 'easy', days: [1,2,3,4,5] } ],
    quests: [ { skill: 'Программирование', title: 'Разобрать новую технологию', estimateMin: 60, difficulty: 'hard' } ] },
];

function programSkillMap(prog, existingSkills) {
  const map = {}, skills = (existingSkills || []).slice();
  skills.forEach((sk) => { map[sk.name.toLowerCase()] = sk.id; });
  prog.skills.forEach((ps) => {
    const k = ps.name.toLowerCase();
    if (!map[k]) { const id = 'sk_' + k.replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).slice(2, 7); skills.push({ id, name: ps.name, color: ps.color, attr: ps.attr }); map[k] = id; }
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
  ensureSkillAttrs();
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
  'бег':          { hint: 'дистанция + темп', top: 20, tiers: ['Не бегаю', 'Иногда, до 5 км', 'Регулярно 5–10 км', 'Полумарафон', 'Марафон', 'Марафон <3:30 / ультра'] },
  'сил':          { hint: 'жим относительно своего веса (честно при любом весе)', top: 18, tiers: ['Не тренируюсь', 'Жим < 0.75× веса', 'Жим ≈ вес тела', 'Жим 1.25× веса', 'Жим 1.5×+ веса'] },
  'зал':          { hint: 'жим относительно своего веса', top: 18, tiers: ['Не тренируюсь', 'Жим < 0.75× веса', 'Жим ≈ вес тела', 'Жим 1.25× веса', 'Жим 1.5×+ веса'] },
  'качал':        { hint: 'жим относительно своего веса', top: 18, tiers: ['Не тренируюсь', 'Жим < 0.75× веса', 'Жим ≈ вес тела', 'Жим 1.25× веса', 'Жим 1.5×+ веса'] },
  'единоборств':  { hint: 'пояс / разряд', top: 20, tiers: ['Не занимаюсь', 'Белый–жёлтый пояс', 'Оранжевый–зелёный', 'Синий–коричневый', 'Чёрный пояс / разряд'] },
  'велосипед':    { hint: 'дистанция', top: 18, tiers: ['Не катаюсь', 'До 20 км', '20–50 км регулярно', 'Сенчури 100 км', 'Бревет 200 км+ / гонки'] },
  'плаван':       { hint: 'дистанция без остановки', top: 18, tiers: ['Не плаваю', 'Держусь на воде', '500 м', '1.5 км', 'Триатлон / 3 км+'] },
  'английск':     { hint: 'CEFR', top: 18, tiers: ['A1 — начальный', 'A2 — базовый', 'B1 — средний', 'B2 — выше среднего', 'C1 — продвинутый', 'C2 — владение'] },
  'язык':         { hint: 'CEFR', top: 18, tiers: ['A1 — начальный', 'A2 — базовый', 'B1 — средний', 'B2 — выше среднего', 'C1 — продвинутый', 'C2 — владение'] },
  'учёб':         { hint: 'ступень', top: 20, tiers: ['Школа', 'Старшие классы / Abitur', 'Бакалавриат', 'Магистратура', 'Аспирантура / PhD'] },
  'программир':   { hint: 'грейд', top: 20, tiers: ['Не программирую', 'Учу основы', 'Junior', 'Middle', 'Senior', 'Lead / архитектор'] },
  'код':          { hint: 'грейд', top: 20, tiers: ['Не программирую', 'Учу основы', 'Junior', 'Middle', 'Senior', 'Lead / архитектор'] },
  'музык':        { hint: 'инструмент', top: 18, tiers: ['Не играю', 'Базовые аккорды/ноты', 'Играю любимое', 'Сложный репертуар', 'Концертный уровень'] },
  'гитар':        { hint: 'инструмент', top: 18, tiers: ['Не играю', 'Базовые аккорды', 'Играю любимое', 'Сложный репертуар', 'Концертный уровень'] },
  'чтени':        { hint: 'книг в год', top: 16, tiers: ['Почти не читаю', '5–10 книг/год', '1–2 в месяц', 'Книга в неделю', 'Запойный читатель'] },
};
const GENERIC_LADDER = { hint: 'честная самооценка', top: 16, tiers: ['Новичок', 'Любитель', 'Опытный', 'Продвинутый', 'Эксперт'] };
function ladderFor(skillName) {
  const n = (skillName || '').toLowerCase();
  for (const key in IMPORT_LADDERS) if (n.includes(key)) return IMPORT_LADDERS[key];
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
  lootbox: null,
  leaderboard: null, _lbLoading: false,
  timer: null, view: 'today', treeSkill: null, weekStart: null, goalFilter: 'all',
  aveCat: 'hair', // активная категория в редакторе аватара
  treeEdit: false, treeSelNode: null, // редактор дерева навыков
};

// ============================================================
//  Утилиты
// ============================================================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
function dmShort(s) { return s.slice(8) + '.' + s.slice(5, 7); }
function fmtClock(ms) { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`; }
function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; }
function skillById(id) { return State.settings.skills.find((s) => s.id === id) || { id, name: id || '—', color: '#888' }; }
// ── Иерархия сфер (импорт v2.2): под-навыки через parentId. 2 уровня: столб → под-навык.
function childSkills(id) { return State.settings.skills.filter((s) => s.parentId === id); }
function isPillar(id) { return childSkills(id).length > 0; }            // столб = есть под-навыки
function topSkills() { return State.settings.skills.filter((s) => !s.parentId); } // верхний уровень
function leafSkills() { return State.settings.skills.filter((s) => !isPillar(s.id)); } // листья (для атрибутов/формы)
function skillLabel(id) { const s = skillById(id); if (s && s.parentId) { const p = skillById(s.parentId); return (p ? p.name + ' › ' : '') + s.name; } return s ? s.name : id; }
// Опции <select> в иерархическом порядке: столб, затем его под-навыки («Столб › Под»)
function skillOptionsHTML(sel) {
  let html = '';
  for (const p of topSkills()) {
    html += `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}${isPillar(p.id) ? ' (общее)' : ''}</option>`;
    for (const c of childSkills(p.id)) html += `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(p.name)} › ${esc(c.name)}</option>`;
  }
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
function xpEvents() {
  const ev = [];
  for (const t of State.tasks) if (t.done) ev.push({ date: dayOf(t), skillId: t.skillId, xp: t.xpAwarded || 0, gold: t.goldAwarded || 0, min: Number(t.actualMin || t.estimateMin) || 0 });
  const log = State.habitlog || {};
  for (const date in log) for (const hid in log[date]) { const rec = log[date][hid], h = habitById(hid); ev.push({ date, skillId: h ? h.skillId : null, xp: rec.xp || 0, gold: rec.gold || 0, min: rec.min || 0 }); }
  for (const g of State.goals || []) if (g.completedAt) { const xp = g.xpReward != null ? g.xpReward : GOAL_BONUS.xp; ev.push({ date: fmtDate(new Date(g.completedAt)), skillId: g.skillId, xp, gold: Math.round(xp * 0.35), min: 0 }); }
  return ev;
}
function doneTasks() { return State.tasks.filter((t) => t.done); }
// Импортированный «стартовый» XP (доказанное мастерство) — добавляется к заработанному
function importedXp(id) { const im = State.settings && State.settings.imported; return (im && im[id] && im[id].xp) || 0; }
function totalImportedXp() { const im = (State.settings && State.settings.imported) || {}; return Object.keys(im).reduce((s, k) => s + (im[k].xp || 0), 0); }
function earnedXp() { return xpEvents().reduce((s, e) => s + e.xp, 0); } // только заработанное в приложении (для честного лидерборда)
function overallXp() { return earnedXp() + totalImportedXp(); }
function ownSkillXp(id) { return xpEvents().reduce((s, e) => s + (e.skillId === id ? e.xp : 0), 0) + importedXp(id); }
// XP сферы. Для столба = собственный + сумма под-навыков (агрегация в столб).
function skillXp(id) { let xp = ownSkillXp(id); for (const c of childSkills(id)) xp += ownSkillXp(c.id); return xp; }
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
  { id: 'str', name: 'Сила',         icon: '💪', color: '#e0526a' },
  { id: 'end', name: 'Выносливость', icon: '🫁', color: '#5fbf7a' },
  { id: 'int', name: 'Интеллект',    icon: '🧠', color: '#4f86f7' },
  { id: 'spr', name: 'Дух',          icon: '🧘', color: '#b06ff0' },
  { id: 'cha', name: 'Харизма',      icon: '✨', color: '#e0a23e' },
  { id: 'dis', name: 'Дисциплина',   icon: '⚙️', color: '#22c1a4' },
];
function attrById(id) { return ATTRIBUTES.find((a) => a.id === id) || ATTRIBUTES[5]; }
function guessAttr(name) {
  const n = (name || '').toLowerCase();
  if (/спорт|сил|качал|штанг|жим|мыш|workout|gym|подтяг|отжим|кросфит|кроссфит/.test(n)) return 'str';
  if (/бег|вынослив|кардио|велик|плав|run|марафон|ходьб|дыхан|поход/.test(n)) return 'end';
  if (/уч[её]б|программ|код|чтени|книг|англ|язык|наук|study|math|школ|универ|интеллект|шахмат/.test(n)) return 'int';
  if (/здоров|медит|сон|дух|психо|релакс|йог|вер|осознан|благодар|ментал/.test(n)) return 'spr';
  if (/отношен|блог|общени|социал|харизм|выступл|видео|музык|творч|друз|свидан/.test(n)) return 'cha';
  if (/быт|дисциплин|финанс|план|привыч|работа|бизнес|порядок|деньг/.test(n)) return 'dis';
  return 'dis';
}
function ensureSkillAttrs() { for (const s of State.settings.skills) if (!s.attr) s.attr = guessAttr(s.name); }
// Атрибуты считаем по листьям (под-навыки + одиночные), чтобы не дублировать со столбами
function attrScore(attrId) { return leafSkills().filter((s) => (s.attr || guessAttr(s.name)) === attrId).reduce((sum, s) => sum + skillLevelOf(s.id), 0); }
function attrScores() { return ATTRIBUTES.map((a) => Object.assign({}, a, { value: attrScore(a.id) })); }
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

// ---- SVG: радар атрибутов + схематичное телосложение ----
function radarSVG(scores) {
  const cx = 140, cy = 140, R = 96, n = scores.length, max = Math.max(3, ...scores.map((s) => s.value));
  const pt = (i, r) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; };
  let grid = '';
  for (let g = 1; g <= 3; g++) { const poly = scores.map((_, i) => pt(i, R * g / 3).join(',')).join(' '); grid += `<polygon points="${poly}" fill="none" stroke="var(--line)" stroke-width="1"/>`; }
  let axes = '', labels = '';
  scores.forEach((s, i) => { const [x, y] = pt(i, R); axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`; const [lx, ly] = pt(i, R + 20); labels += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="15">${s.icon}</text>`; });
  const dpoly = scores.map((s, i) => pt(i, R * Math.min(1, s.value / max)).join(',')).join(' ');
  const dots = scores.map((s, i) => { const [x, y] = pt(i, R * Math.min(1, s.value / max)); return `<circle cx="${x}" cy="${y}" r="3.5" fill="${s.color}"/>`; }).join('');
  return `<svg viewBox="0 0 280 280" class="radar"><defs><radialGradient id="radg"><stop offset="0%" stop-color="rgba(108,140,255,.35)"/><stop offset="100%" stop-color="rgba(108,140,255,.08)"/></radialGradient></defs>${grid}${axes}<polygon points="${dpoly}" fill="url(#radg)" stroke="var(--accent)" stroke-width="2"/>${dots}${labels}</svg>`;
}
function figureSVG() {
  const str = attrScore('str'), end = attrScore('end'), bmi = bodyBMI(), cr = charRank();
  const sh = 24 + Math.min(20, str * 1.6);                                  // плечи растут от силы
  const wa = Math.max(11, 15 + (bmi ? Math.max(0, (bmi - 21)) * 1.7 : 0) - Math.min(5, end * 0.35)); // талия от BMI, минус выносливость
  const limb = 6 + Math.min(7, str * 0.5);                                  // толщина конечностей
  const cx = 70, c = cr.color;
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
  return `<svg viewBox="0 0 240 240" class="avatar-svg" preserveAspectRatio="xMidYMid slice">${bg}${hairParts.back}${shoulders}${neck}${ear}${head}${beard}${hairParts.front}${brows}${eyes}${nose}${mouth}${glasses}</svg>`;
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
function habitStreak(h) {
  let s = 0, cursor = todayStr(), guard = 0;
  if (habitScheduledOn(h, cursor) && !habitDone(h, cursor)) cursor = addDays(cursor, -1);
  while (guard++ < 400) {
    if (!habitScheduledOn(h, cursor)) { cursor = addDays(cursor, -1); continue; }
    if (habitDone(h, cursor)) { s++; cursor = addDays(cursor, -1); } else break;
  }
  return s;
}

// ---- Цели ----
function goalProgress(g) { const n = g.steps.length; if (!n) return 0; return Math.round(g.steps.filter((s) => s.done).length / n * 100); }
function refreshGoalCompletion(g) {
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
  for (const a of ACHIEVEMENTS) if (achUnlocked(a) && !State.achievements[a.id]) { State.achievements[a.id] = new Date().toISOString(); changed = true; if (!silent) toast(`🏆 Достижение: ${a.title}`); }
  if (changed) Store.save('achievements', State.achievements);
}

// ============================================================
//  Лутбоксы (сундуки) — ежедневные награды за активность
// ============================================================
const TITLES = ['Ранняя пташка', 'Несокрушимый', 'Полиглот', 'Железная воля', 'Мастер баланса', 'Книжный червь', 'Атлет', 'Творец', 'Стратег', 'Феникс', 'Хранитель ритма', 'Первопроходец', 'Тихий гром', 'Луч дисциплины', 'Алхимик дней'];
const LOOT_POOL = [
  { w: 36, type: 'gold',  min: 15,  max: 40,  label: '🪙 Золото' },
  { w: 22, type: 'gold',  min: 45,  max: 90,  label: '🪙 Золото' },
  { w: 14, type: 'boost', pct: 25,  hours: 6, label: '⚡ +25% XP' },
  { w: 10, type: 'gold',  min: 110, max: 200, label: '🪙 Куча золота' },
  { w: 8,  type: 'boost', pct: 50,  hours: 3, label: '🔥 +50% XP' },
  { w: 6,  type: 'title',                     label: '🏷 Титул' },
  { w: 4,  type: 'gold',  min: 250, max: 400, label: '💎 Джекпот' },
];
const LOOT_THRESHOLDS = [1, 3, 5]; // активностей за день для сундука №1 / №2 / №3
function ensureLootbox() {
  if (!State.lootbox) State.lootbox = { day: todayStr(), opened: 0, goldWon: 0, boost: null, titles: [], equipped: null, history: [] };
  if (State.lootbox.day !== todayStr()) { State.lootbox.day = todayStr(); State.lootbox.opened = 0; }
  return State.lootbox;
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
  if (item.type === 'gold') { const amt = Math.round(item.min + Math.random() * (item.max - item.min)); return { type: 'gold', amount: amt, label: `+${amt} 🪙` }; }
  if (item.type === 'boost') return { type: 'boost', pct: item.pct, hours: item.hours, label: `+${item.pct}% XP · ${item.hours}ч` };
  if (item.type === 'title') {
    const lb = ensureLootbox(), pool = TITLES.filter((t) => !lb.titles.includes(t));
    if (pool.length) { const t = pool[Math.floor(Math.random() * pool.length)]; return { type: 'title', title: t, label: `🏷 «${t}»` }; }
    return { type: 'gold', amount: 60, label: '+60 🪙 (все титулы собраны)' };
  }
  return { type: 'gold', amount: 20, label: '+20 🪙' };
}
function applyLoot(reward) {
  const lb = ensureLootbox();
  if (reward.type === 'gold') lb.goldWon += reward.amount;
  else if (reward.type === 'boost') lb.boost = { pct: reward.pct, until: new Date(Date.now() + reward.hours * 3600 * 1000).toISOString() };
  else if (reward.type === 'title') { if (!lb.titles.includes(reward.title)) lb.titles.push(reward.title); if (!lb.equipped) lb.equipped = reward.title; }
  lb.opened += 1;
  lb.history.unshift({ at: new Date().toISOString(), label: reward.label });
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
const PIP_CSS = `body{margin:0;font:14px -apple-system,'Segoe UI',Roboto,sans-serif;background:#11151f;color:#e7ebf5;overflow:hidden}body.break{background:#15241a}body.overrun{background:#2a1622}.pip{padding:12px 14px;display:flex;flex-direction:column;gap:4px;height:100%;box-sizing:border-box}.pip-task{font-size:12px;color:#99a2c0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pip-clock{font-size:36px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}.pip-sub{font-size:12px;color:#c7cee6}body.overrun .pip-sub{color:#ff9bb0}.pip-bar{height:6px;background:#222a40;border-radius:999px;overflow:hidden;margin-top:2px}.pip-bar>span{display:block;height:100%;width:0;background:linear-gradient(90deg,#6c8cff,#9b7cff)}body.overrun .pip-bar>span{background:#e0526a}.pip-ctrl{display:flex;gap:8px;margin-top:auto}.pip-ctrl button{flex:1;background:#1f2640;border:1px solid #2a3250;color:#fff;border-radius:8px;padding:7px;font-size:15px;cursor:pointer}.pip-ctrl button:hover{background:#2a3250}`;

async function openFocusWidget() {
  if (!State.timer) return;
  if (!('documentPictureInPicture' in window)) { toast('Плавающее окно недоступно в этом браузере — показываю плашку'); return; }
  if (pipWindow) { try { pipWindow.focus(); } catch {} return; }
  try {
    pipWindow = await documentPictureInPicture.requestWindow({ width: 300, height: 190 });
    const d = pipWindow.document;
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
  const chips = SKILL_TEMPLATES.map((t) => {
    const sel = State.obSkills.has(t.name);
    return `<button type="button" class="ob-chip ${sel ? 'sel' : ''}" data-action="ob-toggle" data-skill="${esc(t.name)}" data-color="${esc(t.color)}" style="--c:${esc(t.color)}">${t.name}</button>`;
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
        <div class="ob-chips">${chips}</div>
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
  const cr = charRank(), eqTitle = State.lootbox && State.lootbox.equipped, e = ent();
  const skills = topSkills().map((s) => {
    const si = levelInfo(skillXp(s.id), c.skillBase, c.growth), sr = rankFor(si.level), pillar = isPillar(s.id);
    const subInfo = pillar ? ` · ${childSkills(s.id).length} под-навыков` : '';
    return `<div class="skill-chip" title="${esc(s.name)} — ${sr.name} (ур.${si.level}, ${skillXp(s.id)} XP)${subInfo}">
      <span class="dot" style="background:${esc(s.color)}"></span>
      <span class="sk-name">${esc(s.name)}${pillar ? ' ▾' : ''}</span><span class="sk-lvl">ур.${si.level}</span>
      <span class="sk-bar"><span style="width:${si.pct}%;background:${esc(s.color)}"></span></span></div>`;
  }).join('');
  const proBadge = e.tier === 'pro' ? '<span class="plan-badge pro" title="Pro активен">PRO</span>'
    : e.tier === 'trial' ? `<span class="plan-badge trial" title="Pro-триал">PRO ${trialDaysLeft()}д</span>`
    : '<button class="plan-badge free" data-action="show-paywall" data-feature="Pro" title="Открыть Pro">PRO</button>';
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
function questRow(t) {
  const sk = skillById(t.skillId), time = t.actualMin ? `${t.actualMin}/${t.estimateMin}` : `${Number(t.estimateMin) || 0}`;
  const active = State.timer && State.timer.taskId === t.id;
  return `<li class="task ${t.done ? 'done' : ''}">
    <button class="check" data-action="toggle-task" data-id="${t.id}">${t.done ? '✓' : ''}</button>
    <span class="t-title">${esc(t.title)}</span>
    <span class="t-skill" style="--c:${esc(sk.color)}">${esc(sk.name)}</span>
    <span class="t-time" data-action="edit-actual" data-id="${t.id}" title="Клик — фактическое время">${time} мин</span>
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
    <span class="t-time">${Number(h.estimateMin) || 0} мин</span>
    <span class="t-diff">${DIFF[h.difficulty] || ''}</span>
    <span class="t-xp">${done ? '+' + itemXp(h) : ''}</span>
    <span class="habit-streak" title="Серия">${hs ? '🔥' + hs : ''}</span><span></span></li>`;
}
function renderCalendar(todays) {
  const startH = 6, endH = 23, rowH = 42;
  const scheduled = todays.filter((t) => t.startTime);
  const unscheduled = todays.filter((t) => !t.startTime);
  const hours = [];
  for (let h = startH; h <= endH; h++) hours.push(h);
  const grid = hours.map((h, i) => `<div class="cal-row" style="top:${i * rowH}px"><span class="cal-h">${pad2(h)}:00</span></div>`).join('');
  const blocks = scheduled.map((t) => {
    const [H, M] = t.startTime.split(':').map(Number);
    const top = ((H * 60 + M) - startH * 60) / 60 * rowH;
    const height = Math.max(20, (Number(t.estimateMin) || 30) / 60 * rowH);
    const sk = skillById(t.skillId);
    return `<div class="cal-block ${t.done ? 'done' : ''}" style="top:${top}px;height:${height}px;--c:${esc(sk.color)}" data-action="unschedule-quest" data-id="${t.id}" title="Клик — убрать из расписания"><b>${pad2(H)}:${pad2(M)}</b> ${esc(t.title)}</div>`;
  }).join('');
  const picker = unscheduled.length ? `
    <div class="cal-schedule">
      <select id="cal-quest">${unscheduled.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>
      <input id="cal-time" type="time" value="09:00" />
      <button class="btn ghost" data-action="schedule-quest">🗓 Поставить на время</button>
    </div>` : '<p class="muted">Все квесты разложены по времени.</p>';
  return `<div class="card"><h3>🗓 Календарь дня</h3>
    <div class="cal" style="height:${hours.length * rowH}px">${grid}${blocks}</div>${picker}</div>`;
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

  const chestsAvail = lootChestsAvailable(), activeBoost = lootBoostPct(), hp = hypePct();
  const nudgeCard = (chestsAvail > 0 || activeBoost > 0 || hp > 0) ? `<div class="card nudge-card">${chestsAvail > 0 ? `<button class="nudge" data-action="goto-rewards">🎁 ${chestsAvail} ${plural(chestsAvail, 'сундук', 'сундука', 'сундуков')} ждёт — открыть</button>` : ''}${activeBoost > 0 ? `<span class="nudge-boost">⚡ +${activeBoost}% XP активен</span>` : ''}${hp > 0 ? `<span class="nudge-boost">🔥 Хайп ×${hypeState().stacks} · +${hp}% XP · ${hypeMinLeft()}м</span>` : ''}</div>` : '';
  // Нудж новичку: не начинай с нуля — импортируй реальный опыт
  const noImports = !Object.keys((State.settings && State.settings.imported) || {}).length;
  const importNudge = (noImports && earnedXp() < 200) ? `<div class="card nudge-card"><button class="nudge" data-action="goto-import">🎖 Не начинай с нуля — импортируй свой реальный опыт</button><span class="nudge-boost">отметь свой уровень в сферах → стартовый опыт</span></div>` : '';

  const overdueCard = overdue.length ? `<div class="card overdue"><h3>⏳ Просрочено (${overdue.length})</h3>
      <ul class="tasks">${overdue.map(questRow).join('')}</ul>
      <button class="btn ghost" data-action="move-overdue" style="margin-top:10px">↪ Перенести всё на сегодня</button></div>` : '';

  return `${timerCard}${nudgeCard}${importNudge}
    <div class="card"><form id="add-task" class="add-row">
        <input name="title" placeholder="Новый квест на сегодня…" autocomplete="off" required />
        <select name="skillId">${skillOpts}</select>
        <input name="estimateMin" type="number" min="0" step="5" value="30" title="Минут" />
        <select name="difficulty"><option value="easy">Лёгкая</option><option value="normal" selected>Обычная</option><option value="hard">Сложная</option></select>
        <button type="submit">+ Квест</button></form></div>
    ${overdueCard}
    <div class="card"><div class="daystat">
        <span>Квестов: <b>${doneCount}/${todays.length}</b></span>
        <span>Время: <b>${minToday}/${planned}</b> мин</span>
        <span>Опыт: <b>+${xpToday}</b> XP</span>
        <span>Золото: <b>+${goldToday}</b> 🪙</span></div>
      ${todays.length ? `<ul class="tasks">${todays.map(questRow).join('')}</ul>` : '<p class="muted">На сегодня пусто. Запланируй первый квест выше ↑</p>'}</div>
    ${todays.length ? renderCalendar(todays) : ''}
    <div class="card"><h3>🔁 Привычки на сегодня</h3>
      ${habits.length ? `<ul class="tasks">${habits.map(habitRow).join('')}</ul>` : '<p class="muted">На сегодня привычек нет. Добавь их в «Настройках».</p>'}</div>
    <div class="card shutdown"><h3>🌙 Итог дня</h3>
      <p class="muted">Квестов ${doneCount}/${todays.length} · привычек ${habits.filter((h) => habitDone(h, today)).length}/${habits.length} · ${minToday} мин · +${xpToday} XP · +${goldToday} 🪙</p>
      <textarea id="reflection" placeholder="Рефлексия: что получилось, что перенести, как себя чувствую…">${esc(day.reflection || '')}</textarea>
      <div style="margin-top:10px"><button class="${day.closed ? 'btn ghost' : 'btn'}" data-action="${day.closed ? 'reopen-day' : 'close-day'}">${day.closed ? '✓ День закрыт — открыть заново' : 'Закрыть день'}</button></div></div>`;
}

// ============================================================
//  Вид «Цели»
// ============================================================
function goalCard(g) {
  const sk = skillById(g.skillId), prog = goalProgress(g), done = !!g.completedAt;
  const parent = g.parentId ? goalById(g.parentId) : null;
  const xpR = g.xpReward != null ? g.xpReward : (GOAL_XP[g.type] || 50);
  let deadline = '';
  if (g.targetDate) { const left = Math.round((parseDate(g.targetDate) - parseDate(todayStr())) / 86400000); deadline = `<span class="goal-deadline ${left < 0 ? 'overdue' : ''}">📅 ${g.targetDate}${left >= 0 ? ` · ${left} ${plural(left, 'день', 'дня', 'дней')}` : ' · просрочено'}</span>`; }
  const steps = g.steps.map((s) => `<li class="gstep ${s.done ? 'done' : ''}"><button class="check sm" data-action="toggle-step" data-goal="${g.id}" data-step="${s.id}">${s.done ? '✓' : ''}</button><span>${esc(s.title)}</span><button class="del" data-action="delete-step" data-goal="${g.id}" data-step="${s.id}">✕</button></li>`).join('');
  return `<div class="card goal ${done ? 'goal-done' : ''} ${g.archived ? 'goal-archived' : ''}">
    <div class="goal-head"><div><h3>${done ? '✅ ' : ''}${esc(g.title)}</h3>
        <div class="goal-meta">
          <span class="t-skill" style="--c:${esc(sk.color)}">${esc(sk.name)}</span>
          <span class="goal-type type-${g.type || 'short'}">${goalTypeLabel(g.type)}</span>
          <span class="goal-xp">+${xpR} XP</span>
          ${deadline}${parent ? `<span class="muted">↳ ${esc(parent.title)}</span>` : ''}${g.why ? `<span class="muted">— ${esc(g.why)}</span>` : ''}
        </div></div>
      <div class="goal-actions">
        ${done || g.archived ? `<button class="btn ghost sm" data-action="${g.archived ? 'restore-goal' : 'archive-goal'}" data-id="${g.id}">${g.archived ? '↩ Вернуть' : '🗄 В архив'}</button>` : ''}
        <button class="del" data-action="delete-goal" data-id="${g.id}" title="Удалить">✕</button>
      </div></div>
    <div class="progress"><span style="width:${prog}%;background:${esc(sk.color)}"></span></div>
    <div class="muted" style="font-size:12px;margin:4px 0 8px">${g.steps.filter((s) => s.done).length}/${g.steps.length} пунктов · ${prog}%</div>
    <ul class="gsteps">${steps}</ul>
    ${g.archived ? '' : `<form class="add-step-form" data-goal="${g.id}"><input name="step" placeholder="+ пункт чек-листа…" autocomplete="off" /><button type="submit" class="btn ghost">Добавить</button></form>`}</div>`;
}
function renderGoals() {
  const active = State.goals.filter((g) => !g.archived && !g.completedAt);
  const completed = State.goals.filter((g) => g.completedAt && !g.archived);
  const archived = State.goals.filter((g) => g.archived);
  const nearest = active.filter((g) => g.targetDate).sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1))[0];
  const skillOpts = skillOptionsHTML();
  const typeOpts = GOAL_TYPES.map((t) => `<option value="${t.id}" ${t.id === 'short' ? 'selected' : ''}>${t.label}</option>`).join('');
  const parentOpts = '<option value="">— без родителя —</option>' + active.map((g) => `<option value="${g.id}">${esc(g.title)}</option>`).join('');

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
    <div class="card"><h3>Новая цель</h3>
      <form id="add-goal" class="goal-form">
        <input name="title" placeholder="Чего хочешь достичь?" autocomplete="off" required />
        <select name="skillId" title="Навык">${skillOpts}</select>
        <select name="type" title="Тип цели">${typeOpts}</select>
        <input name="xpReward" type="number" min="0" placeholder="XP" title="Награда XP (пусто = по типу)" />
        <select name="parentId" title="Родительская цель">${parentOpts}</select>
        <input name="targetDate" type="date" title="Дедлайн" />
        <input name="why" placeholder="Зачем? (мотивация)" autocomplete="off" />
        <button type="submit">+ Цель</button></form></div>
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
  const scores = attrScores(), arch = archetype(), b = State.settings.body || {}, bmi = bodyBMI();
  const max = Math.max(3, ...scores.map((s) => s.value));
  const attrBars = scores.map((a) => `<div class="attr-row"><span class="attr-ic">${a.icon}</span><span class="attr-nm">${a.name}</span><span class="attr-bar"><span style="width:${Math.round(Math.min(100, a.value / max * 100))}%;background:${a.color}"></span></span><span class="attr-val">${a.value}</span></div>`).join('');
  let bmiLabel = '';
  if (bmi) { const cat = bmi < 18.5 ? 'недовес' : bmi < 25 ? 'норма' : bmi < 30 ? 'избыток' : 'выше нормы'; bmiLabel = `<div class="bmi-label">ИМТ <b>${bmi.toFixed(1)}</b> · ${cat}${b.bodyfat ? ` · жир ${b.bodyfat}%` : ''}</div>`; }
  const bodyForm = `<form id="body-form" class="body-form">
      <label>Рост, см<input name="height" type="number" min="100" max="250" value="${b.height || ''}" placeholder="—" /></label>
      <label>Вес, кг<input name="weight" type="number" min="30" max="300" step="0.1" value="${b.weight || ''}" placeholder="—" /></label>
      ${isPro() ? `<label>% жира<input name="bodyfat" type="number" min="3" max="60" step="0.1" value="${b.bodyfat || ''}" placeholder="—" /></label>`
      : `<label class="locked-inline" data-action="show-paywall" data-feature="Состав тела">% жира 🔒<input disabled placeholder="Pro" /></label>`}
      <button type="submit" class="btn">Сохранить</button></form>`;
  return `
    <div class="card char-hero">
      <div class="ch-avatar ch-avatar-img" style="--rc:${cr.color};--p:${oi.pct}">${avatarSVG(avCfg())}</div>
      <div class="ch-meta">
        <h2>${esc((State.me && State.me.name) || 'Герой')}</h2>
        <div class="ch-rank" style="--rc:${cr.color}">${cr.icon} ${cr.name} · ур.${charLevel()}</div>
        <div class="ch-arch">🎭 <b>${arch.name}</b> <span class="muted">— ${arch.desc}</span></div>
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
      <div class="card"><h3>🎯 Атрибуты — твой билд</h3>
        <div class="radar-wrap">${radarSVG(scores)}</div>
        <div class="attr-list">${attrBars}</div>
        <p class="muted" style="font-size:12px;margin-bottom:0">Атрибуты растут из уровней сфер. Какая сфера качает какой атрибут — в «Настройках».</p></div>
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
  const titles = lb.titles.length ? lb.titles.map((t) => `<button class="title-chip ${lb.equipped === t ? 'eq' : ''}" data-action="equip-title" data-title="${esc(t)}">${lb.equipped === t ? '★ ' : ''}${esc(t)}</button>`).join('') : '<span class="muted">титулов пока нет — лови в сундуках</span>';
  const hist = (lb.history || []).slice(0, 6).map((h) => `<li><span class="muted">${(h.at || '').slice(11, 16)}</span> ${esc(h.label)}</li>`).join('');
  const statusTxt = avail > 0 ? `Открыть (${avail})` : (nextTh ? `Ещё ${nextTh.need} ${plural(nextTh.need, 'дело', 'дела', 'дел')} до сундука` : 'На сегодня всё ✓');
  return `<div class="card lootbox-card">
    <div class="lb-head"><h3>🎁 Сундуки дня</h3>${boost ? `<span class="lb-boost">⚡ +${boost}% XP активен</span>` : ''}</div>
    <div class="lb-body">
      <div class="lb-chest ${avail > 0 ? 'ready' : 'empty'}" ${avail > 0 ? 'data-action="open-chest"' : ''}>
        <div class="lb-emoji">${avail > 0 ? '🎁' : '📦'}</div><div class="lb-status">${statusTxt}</div>
      </div>
      <div class="lb-info">
        <p class="muted" style="font-size:12px;margin:0 0 8px">Выполняй квесты и привычки — за активность дают сундуки. ${isPro() ? 'Pro: до 3 сундуков в день.' : 'Free: 1 сундук в день.'}</p>
        ${lockedExtra > 0 && !isPro() ? `<button class="btn pro-cta sm" data-action="show-paywall" data-feature="Больше сундуков">🔒 Ещё ${lockedExtra} ${plural(lockedExtra, 'сундук', 'сундука', 'сундуков')} — с Pro</button>` : ''}
        <div class="lb-titles">${titles}</div>
      </div>
    </div>
    ${hist ? `<details class="lb-hist"><summary>История дропов</summary><ul class="reflections">${hist}</ul></details>` : ''}</div>`;
}
function openChest() {
  if (lootChestsAvailable() <= 0) { toast('Сундуков нет — выполни ещё дела'); return; }
  const reward = lootResolve(rollLoot());
  const ITEMW = 130, WINIDX = 34, N = 42;
  const labels = [];
  for (let i = 0; i < N; i++) labels.push(i === WINIDX ? reward.label : lootResolve(rollLoot()).label);
  const strip = labels.map((l, i) => `<div class="loot-item ${i === WINIDX ? 'win' : ''}">${esc(l)}</div>`).join('');
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
    const rEl = ov.querySelector('#loot-result'); rEl.innerHTML = `🎉 ${esc(reward.label)}`; rEl.classList.add('show');
    ov.querySelector('.loot-win, .loot-item.win')?.classList.add('flash');
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
  const feats = ['📊 Расширенная аналитика и Индекс баланса', '🎁 До 3 сундуков в день + редкие дропы', '🧍 Живой персонаж и кастомизация (скоро)', '🤖 ИИ-ассистент со своим ключом (скоро)', '🎨 Темы оформления (скоро)'];
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
  return `<div class="card"><h3>🛠 Админ — выдать Pro</h3>
    <form id="grant-pro" class="pin-change">
      <input name="userId" placeholder="id профиля (напр. albert)" required />
      <input name="days" type="number" placeholder="дней (пусто=навсегда)" min="1" style="width:170px" />
      <button type="submit" class="btn">Выдать Pro</button><span id="grant-msg" class="muted"></span></form>
    <p class="muted" style="font-size:12px">id виден на экране входа. Пусто в «дней» = бессрочный Pro. Для друзей.</p></div>`;
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
      <li>🤖 ИИ-ассистент со своим ключом (скоро)</li>
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
  { icon: '🎯', title: 'Цели', text: 'Большие цели 4 горизонтов: повторяющиеся, кратко-, средне-, долгосрочные. Разбивай на чек-лист, ставь дедлайн и «зачем». Все пункты закрыл — цель засчитана с бонусом.' },
  { icon: '🌳', title: 'Навыки', text: 'У каждой сферы — дерево. За уровни навыка копятся очки, открывай узлы — они дают пассивный бонус к опыту сферы. Кнопка «✏️ Редактор» включает конструктор: перетаскивай узлы, добавляй свои, задавай название/цену/бонус и что требует. Сделай дерево под себя.' },
  { icon: '🎁', title: 'Награды', text: 'Трать золото в магазине наград (придумай свои!). За активность дня падают сундуки — открывай рулеткой: золото, XP-бусты, титулы. Тут же ачивки.' },
  { icon: '🔥', title: 'Хайп', text: 'Выполни «Сложный» квест — включается Хайп: временный бонус к XP (+15% за стак, до +45%, на 2 часа). Каждый следующий сложный квест усиливает и продлевает его. Награда за то, что лезешь в трудное, а не фармишь лёгкое.' },
  { icon: '📊', title: 'Статистика', text: 'Ранг, Индекс баланса (ровно ли развиты сферы — это и есть десятиборье), ранги по сферам, графики опыта и времени.' },
  { icon: '🏆', title: 'Рейтинг', text: 'Соревнование по опыту со всеми на сервере — позови друзей! Видны только имя, аватар, уровень и ранг; задачи и личные данные приватны. В рейтинге можно скрыться галочкой.' },
  { icon: '💎', title: 'Free и Pro', text: 'Ядро бесплатно навсегда. Pro добавляет глубину: расширенная аналитика, 3 сундука в день, состав тела, скоро — ИИ-ассистент и темы. 7-дневный триал без карты.' },
];
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
      <textarea name="text" placeholder="Опиши, что случилось или что предлагаешь…" required></textarea>
      <div class="fb-actions"><button type="submit" class="btn">Отправить</button><span id="fb-msg" class="muted"></span></div>
    </form></div>`;
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
    <div class="kpis">
      <div class="kpi"><div class="v">🪙 ${bal}</div><div class="l">Баланс золота</div></div>
      <div class="kpi"><div class="v">${goldEarned()}</div><div class="l">Заработано всего</div></div>
      <div class="kpi"><div class="v">${ACHIEVEMENTS.filter((a) => State.achievements[a.id]).length}/${ACHIEVEMENTS.length}</div><div class="l">Достижений</div></div>
    </div>
    <div class="card"><h3>🎁 Магазин наград</h3><div class="rewards-grid">${cards || '<p class="muted">Наград пока нет.</p>'}</div>
      <form id="add-reward" class="reward-form">
        <input name="name" placeholder="Новая награда…" autocomplete="off" required />
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
  const reflections = Object.entries(State.days).filter(([d, v]) => d >= ws && d <= end && v.reflection && v.reflection.trim()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, v]) => `<li><span class="date">${d}</span><br>${esc(v.reflection)}</li>`).join('');
  return `
    <div class="card week-nav">
      <button class="btn ghost" data-action="week-prev">←</button>
      <div><b>Неделя ${dmShort(ws)} – ${dmShort(end)}</b>${isThis ? ' <span class="muted">(текущая)</span>' : ''}</div>
      <button class="btn ghost" data-action="week-next">→</button></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${st.xp}</div><div class="l">Опыт за неделю</div></div>
      <div class="kpi"><div class="v">🪙 ${st.gold}</div><div class="l">Золото</div></div>
      <div class="kpi"><div class="v">${st.quests}</div><div class="l">Квестов</div></div>
      <div class="kpi"><div class="v">${st.habitsC}</div><div class="l">Привычек</div></div>
      <div class="kpi"><div class="v">${Math.round(st.min / 60 * 10) / 10}ч</div><div class="l">Времени</div></div>
    </div>
    <div class="card"><h3>Время по сферам</h3>${barChartSVG(st.byArea)}</div>
    <div class="card"><h3>🎯 Намерение на неделю</h3>
      <textarea id="week-intention" placeholder="Что главное на этой неделе? Куда направить фокус…">${esc(wk.intention || '')}</textarea>
      <h3 style="margin-top:14px">🔄 Итоги недели</h3>
      <textarea id="week-review" placeholder="Что получилось, что нет, что перенести…">${esc(wk.review || '')}</textarea>
      <div style="margin-top:10px"><button class="btn" data-action="save-week">Сохранить</button></div></div>
    <div class="card"><h3>Рефлексии этой недели</h3>${reflections ? `<ul class="reflections">${reflections}</ul>` : '<p class="muted">Нет записей за эту неделю.</p>'}</div>`;
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
  return `<div class="card">
    <h3>🎖 Импорт достижений</h3>
    <p class="muted" style="margin:0 0 12px">Ты не начинаешь с нуля. Отметь честно свой реальный уровень в каждой сфере — стартовый опыт начислится. Это «доказанное мастерство», оно не сгорает. Менять можно в любой момент.</p>
    <div class="import-list">${rows}</div>
  </div>`;
}
function renderSettings() {
  const s = State.settings;
  const f = s.focus || DEFAULT_SETTINGS.focus;
  const skillOpts = (sel) => skillOptionsHTML(sel);
  // допустимые родители для сферы sk: верхнеуровневые сферы (не она сама), и только если сама не столб (2 уровня)
  const parentOptions = (sk) => {
    if (isPillar(sk.id)) return `<option value="" selected>— столб</option>`; // у столба не может быть родителя
    let html = `<option value="" ${!sk.parentId ? 'selected' : ''}>— верхний уровень</option>`;
    for (const p of topSkills()) if (p.id !== sk.id) html += `<option value="${p.id}" ${sk.parentId === p.id ? 'selected' : ''}>↳ ${esc(p.name)}</option>`;
    return html;
  };
  const skills = s.skills.map((sk) => `<div class="skill-edit" data-id="${sk.id}"><input type="color" value="${esc(sk.color)}" data-field="color" /><input type="text" value="${esc(sk.name)}" data-field="name" /><select data-field="attr" title="Какой атрибут персонажа качает эта сфера">${ATTRIBUTES.map((a) => `<option value="${a.id}" ${(sk.attr || guessAttr(sk.name)) === a.id ? 'selected' : ''}>${a.icon} ${a.name}</option>`).join('')}</select><select data-field="parentId" title="Вложить в столб (под-навык)">${parentOptions(sk)}</select><button class="del" data-action="delete-skill" data-id="${sk.id}">✕</button></div>`).join('');
  const habits = State.habits.map((h) => `<div class="habit-edit" data-id="${h.id}">
      <input type="text" value="${esc(h.title)}" data-field="title" />
      <select data-field="skillId">${skillOpts(h.skillId)}</select>
      <select data-field="difficulty"><option value="easy" ${h.difficulty === 'easy' ? 'selected' : ''}>Лёгкая</option><option value="normal" ${h.difficulty === 'normal' ? 'selected' : ''}>Обычная</option><option value="hard" ${h.difficulty === 'hard' ? 'selected' : ''}>Сложная</option></select>
      <input type="number" min="0" step="5" value="${Number(h.estimateMin) || 0}" data-field="estimateMin" />
      <div class="weekdays">${WEEKDAYS.map((w) => `<label><input type="checkbox" data-day="${w.js}" ${(h.days || []).includes(w.js) ? 'checked' : ''}/>${w.label}</label>`).join('')}</div>
      <button class="del" data-action="delete-habit" data-id="${h.id}">✕</button></div>`).join('');
  return `
    ${subscriptionCard()}
    ${securityCard()}
    ${adminCard()}
    <div class="card"><h3>Название</h3><input id="set-appName" type="text" value="${esc(s.appName)}" style="width:100%;max-width:340px" /></div>
    <div class="card"><h3>Навыки / сферы жизни</h3><div id="skills-list">${skills}</div><button class="btn ghost" data-action="add-skill" style="margin-top:6px">+ Добавить навык</button></div>
    ${importCard()}
    <div class="card"><h3>🔁 Привычки (повторяющиеся)</h3><div id="habits-list">${habits || '<p class="muted">Пока нет привычек.</p>'}</div><button class="btn ghost" data-action="add-habit" style="margin-top:6px">+ Добавить привычку</button></div>
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
        <p class="muted" style="font-size:12px;margin-top:8px">Плавающее окно поверх всех приложений работает в Chrome / Edge / Brave (Document Picture-in-Picture). В Safari — встроенная плашка внизу слева. Колокол звенит на перерыв и при превышении расчётного времени.</p></div>
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
    <nav id="nav">
      <button data-view="today">Сегодня</button>
      <button data-view="character">Персонаж</button>
      <button data-view="goals">Цели</button>
      <button data-view="tree">Навыки</button>
      <button data-view="rewards">Награды</button>
      <button data-view="weekly">Неделя</button>
      <button data-view="stats">Статистика</button>
      <button data-view="leaderboard">Рейтинг</button>
      <button data-view="settings">Настройки</button>
    </nav>
  </header>
  <main id="main"></main>
  <div id="toasts"></div>`;

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

const VIEWS = { today: renderToday, character: renderCharacter, goals: renderGoals, tree: renderTree, rewards: renderRewards, weekly: renderWeekly, stats: renderStats, leaderboard: renderLeaderboard, settings: renderSettings };
function render() {
  if (State.phase !== 'app') { showAuthScreen(); return; }
  // Восстановить app shell если auth-экран его перезаписал
  if (!document.getElementById('main')) document.getElementById('app').innerHTML = APP_SHELL;
  renderHeader();
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === State.view));
  const activeNav = document.querySelector('#nav button.active');
  if (activeNav && activeNav.scrollIntoView) activeNav.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  document.getElementById('main').innerHTML = (VIEWS[State.view] || renderToday)();
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

  // --- Обратная связь ---
  if (f.id === 'feedback-form') {
    e.preventDefault();
    const msg = f.querySelector('#fb-msg');
    fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: f.kind.value, text: f.text.value }) })
      .then(async (r) => { const d = await r.json(); if (r.ok) { msg.textContent = '✓ Спасибо! Отправлено.'; msg.style.color = '#5fbf7a'; f.text.value = ''; } else { msg.textContent = d.error || 'Ошибка'; msg.style.color = '#e0526a'; } })
      .catch(() => { msg.textContent = 'Ошибка сети'; msg.style.color = '#e0526a'; });
    return;
  }

  // --- Телосложение ---
  if (f.id === 'body-form') {
    e.preventDefault();
    const num = (v) => { const x = parseFloat(v); return isNaN(x) ? null : x; };
    State.settings.body = Object.assign({}, State.settings.body, { height: num(f.height.value), weight: num(f.weight.value) });
    if (f.bodyfat) State.settings.body.bodyfat = num(f.bodyfat.value);
    Store.save('settings', State.settings); toast('🧍 Телосложение обновлено'); render();
    return;
  }

  if (f.id === 'add-task') {
    e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
    State.tasks.push({ id: uid(), title, skillId: f.skillId.value, estimateMin: Number(f.estimateMin.value) || 0, difficulty: f.difficulty.value, date: todayStr(), done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: null, createdAt: new Date().toISOString() });
    Store.save('tasks', State.tasks); render();
  } else if (f.id === 'add-goal') {
    e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
    const type = f.type.value || 'short';
    const xpReward = f.xpReward.value !== '' ? Math.max(0, Number(f.xpReward.value)) : GOAL_XP[type];
    State.goals.push({ id: 'g_' + uid(), title, skillId: f.skillId.value, type, xpReward, parentId: f.parentId.value || null, why: f.why.value.trim(), targetDate: f.targetDate.value || null, steps: [], createdAt: new Date().toISOString(), completedAt: null, archived: false });
    Store.save('goals', State.goals); render();
  } else if (f.classList.contains('add-step-form')) {
    e.preventDefault(); const g = goalById(f.dataset.goal); const v = f.step.value.trim(); if (!g || !v) return;
    g.steps.push({ id: 's_' + uid(), title: v, done: false }); refreshGoalCompletion(g);
    Store.save('goals', State.goals); render();
  } else if (f.id === 'add-reward') {
    e.preventDefault(); const name = f.name.value.trim(); if (!name) return;
    State.rewards.push({ id: 'r_' + uid(), name, icon: f.icon.value.trim() || '🎁', cost: Math.max(1, Number(f.cost.value) || 1), createdAt: new Date().toISOString() });
    Store.save('rewards', State.rewards); render();
  }
}

function onClick(e) {
  const navBtn = e.target.closest('#nav button[data-view]');
  if (navBtn) { State.view = navBtn.dataset.view; if (State.view === 'leaderboard') State.leaderboard = null; render(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
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
    const lb = ensureLootbox(); lb.equipped = lb.equipped === el.dataset.title ? null : el.dataset.title; Store.save('lootbox', lb); render(); return;
  }
  if (action === 'show-paywall') { showPaywall(el.dataset.feature); return; }
  if (action === 'close-paywall') { const p = document.getElementById('paywall'); if (p) p.remove(); return; }
  if (action === 'show-guide') { showGuide(); return; }
  if (action === 'close-guide') { const g = document.getElementById('guide'); if (g) g.remove(); return; }
  if (action === 'goto-rewards') { State.view = 'rewards'; render(); return; }
  if (action === 'goto-import') { State.view = 'settings'; render(); return; }
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
    if (!t.done) { if (State.timer && State.timer.taskId === id) stopFocus(true, true); t.done = true; t.completedAt = new Date().toISOString(); t.xpAwarded = itemXp(t); t.goldAwarded = itemGold(t); toast(`+${t.xpAwarded} XP · +${t.goldAwarded} 🪙 · ${skillById(t.skillId).name}`);
      if (t.difficulty === 'hard') { const h = activateHype(); toast(`🔥 Хайп ×${h.stacks} · +${hypePct()}% XP ${hypeMinLeft()} мин — ты выбрал сложное!`); } }
    else { t.done = false; t.completedAt = null; t.xpAwarded = 0; t.goldAwarded = 0; }
    Store.save('tasks', State.tasks); checkAchievements(); render(); publishLeaderboard();
  } else if (action === 'toggle-habit') {
    const h = habitById(id); if (!h) return;
    State.habitlog[today] = State.habitlog[today] || {};
    if (State.habitlog[today][id]) { delete State.habitlog[today][id]; if (!Object.keys(State.habitlog[today]).length) delete State.habitlog[today]; }
    else { State.habitlog[today][id] = { xp: itemXp(h), gold: itemGold(h), min: Number(h.estimateMin) || 0, at: new Date().toISOString() }; toast(`+${itemXp(h)} XP · +${itemGold(h)} 🪙 · ${skillById(h.skillId).name}`); }
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
  } else if (action === 'move-overdue') {
    State.tasks.forEach((t) => { if (!t.done && t.date < today) t.date = today; }); Store.save('tasks', State.tasks); toast('Перенесено на сегодня'); render();
  } else if (action === 'schedule-quest') {
    const qid = document.getElementById('cal-quest').value, time = document.getElementById('cal-time').value, t = questById(qid);
    if (t && time) { t.startTime = time; Store.save('tasks', State.tasks); render(); }
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
    Store.save('purchases', State.purchases); toast(`Куплено: ${r.name} 🎉`); checkAchievements(); render();
  } else if (action === 'delete-reward') {
    State.rewards = State.rewards.filter((x) => x.id !== id); Store.save('rewards', State.rewards); render();

  // --- Неделя ---
  } else if (action === 'week-prev') { State.weekStart = addDays(State.weekStart, -7); render();
  } else if (action === 'week-next') { State.weekStart = addDays(State.weekStart, 7); render();
  } else if (action === 'save-week') {
    const ws = State.weekStart; State.weeks[ws] = State.weeks[ws] || {};
    State.weeks[ws].intention = document.getElementById('week-intention').value;
    State.weeks[ws].review = document.getElementById('week-review').value;
    Store.save('weeks', State.weeks); toast('Сохранено'); render();

  // --- Настройки ---
  } else if (action === 'add-skill') {
    State.settings.skills.push({ id: 'sk_' + uid(), name: 'Новый навык', color: '#6c8cff' }); ensureTrees(); Store.save('settings', State.settings); Store.save('skilltree', State.tree); render();
  } else if (action === 'delete-skill') {
    if (!confirm('Удалить навык?')) return; State.settings.skills = State.settings.skills.filter((x) => x.id !== id); for (const sk of State.settings.skills) if (sk.parentId === id) sk.parentId = null; Store.save('settings', State.settings); render();
  } else if (action === 'add-habit') {
    const first = State.settings.skills[0];
    State.habits.push({ id: 'h_' + uid(), title: 'Новая привычка', skillId: first ? first.id : 'life', difficulty: 'easy', estimateMin: 10, days: [1, 2, 3, 4, 5], archived: false, createdAt: new Date().toISOString() });
    Store.save('habits', State.habits); render();
  } else if (action === 'delete-habit') {
    if (!confirm('Удалить привычку?')) return; State.habits = State.habits.filter((h) => h.id !== id); Store.save('habits', State.habits); render();
  } else if (action === 'save-settings') { saveSettingsFromForm();
  } else if (action === 'reset-data') {
    if (!confirm('Удалить ВСЕ квесты и записи дней? Навыки, привычки, цели и настройки останутся.')) return;
    State.tasks = []; State.days = {}; Store.save('tasks', State.tasks); Store.save('days', State.days); State.view = 'today'; toast('Сброшено'); render();
  }
}

function saveSettingsFromForm() {
  const s = State.settings, num = (id, fb) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? fb : v; };
  s.appName = document.getElementById('set-appName').value.trim() || 'Gojo';
  s.skills = [...document.querySelectorAll('#skills-list .skill-edit')].map((row) => {
    const psel = row.querySelector('[data-field="parentId"]');
    return { id: row.dataset.id, name: row.querySelector('[data-field="name"]').value.trim() || 'Без названия', color: row.querySelector('[data-field="color"]').value, attr: row.querySelector('[data-field="attr"]') ? row.querySelector('[data-field="attr"]').value : guessAttr(row.querySelector('[data-field="name"]').value), parentId: psel && psel.value ? psel.value : null };
  });
  // нормализация parentId: убрать ссылки на несуществующих и 3-й уровень (оставляем строго 2 уровня)
  for (const sk of s.skills) { if (sk.parentId) { const p = s.skills.find((x) => x.id === sk.parentId); if (!p || p.parentId) sk.parentId = null; } }
  const oldHabits = State.habits;
  State.habits = [...document.querySelectorAll('#habits-list .habit-edit')].map((row) => {
    const old = oldHabits.find((h) => h.id === row.dataset.id);
    return { id: row.dataset.id, title: row.querySelector('[data-field="title"]').value.trim() || 'Привычка', skillId: row.querySelector('[data-field="skillId"]').value, difficulty: row.querySelector('[data-field="difficulty"]').value, estimateMin: Number(row.querySelector('[data-field="estimateMin"]').value) || 0, days: [...row.querySelectorAll('input[data-day]:checked')].map((c) => Number(c.dataset.day)), archived: false, createdAt: old ? old.createdAt : new Date().toISOString() };
  });
  s.xp.perMinute = num('k-perMinute', 1); s.xp.completionBonus = num('k-bonus', 5);
  s.xp.difficulty = { easy: num('k-easy', 1), normal: num('k-normal', 1.5), hard: num('k-hard', 2.2) };
  s.gold = { perMinute: num('g-perMinute', 0.4), completionBonus: num('g-bonus', 3) };
  s.focus = { pomodoro: document.getElementById('f-pomodoro').value === '1', workMin: num('f-workMin', 25), breakMin: num('f-breakMin', 5), sound: document.getElementById('f-sound').value === '1', notify: document.getElementById('f-notify').value === '1' };
  s.curve = { base: num('k-base', 100), skillBase: num('k-skillBase', 60), growth: num('k-growth', 1.3) };
  ensureTrees();
  Store.save('settings', s); Store.save('habits', State.habits); Store.save('skilltree', State.tree);
  toast('Настройки сохранены'); render();
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

  State.tasks = await Store.load('tasks', []);
  State.tasks.forEach((t) => { if (t.actualMin === undefined) t.actualMin = null; if (t.startTime === undefined) t.startTime = null; if (t.goldAwarded === undefined) t.goldAwarded = 0; });
  State.days = await Store.load('days', {});
  State.habits = await Store.load('habits', []);
  State.habitlog = await Store.load('habitlog', {});
  State.goals = await Store.load('goals', []);
  State.goals.forEach((g) => { if (!g.type) g.type = 'mid'; if (g.xpReward === undefined) g.xpReward = GOAL_XP[g.type] != null ? GOAL_XP[g.type] : GOAL_BONUS.xp; if (g.parentId === undefined) g.parentId = null; });
  State.tree = await Store.load('skilltree', {});
  State.rewards = await Store.load('rewards', []);
  State.purchases = await Store.load('purchases', []);
  State.achievements = await Store.load('achievements', {});
  State.weeks = await Store.load('weeks', {});
  State.lootbox = await Store.load('lootbox', { day: todayStr(), opened: 0, goldWon: 0, boost: null, titles: [], equipped: null, history: [] });
  ensureLootbox();

  ensureTrees();
  ensureSkillAttrs();
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
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'set-import') { applyImport(el.dataset.skill, Number(el.value)); return; }
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

// Точка входа — проверяем сессию, потом грузим нужный экран
async function init() {
  document.addEventListener('submit', onSubmit);
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('pointerdown', onTreePointerDown);

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
