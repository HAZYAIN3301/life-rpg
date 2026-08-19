#!/usr/bin/env node
/* Засев тестового аккаунта правдоподобными данными.
 *
 * Зачем: пустое приложение нельзя ни проверить, ни снять. Прогон QA по пустым экранам
 * показывает только пустые состояния, а скриншоты фич для роликов выглядят мёртвыми —
 * это записанная претензия к Mahoraga («вырезаны и непонятно», STUDIO-V5-PLAN слой 4).
 * Один инструмент закрывает обе задачи.
 *
 * Данные намеренно НЕ идеальные: есть пропущенные дни, брошенная привычка, просроченные
 * квесты и незакрытая цель. Аккаунт, где всё выполнено на 100%, не показывает ни одного
 * состояния, ради которого приложение вообще написано.
 *
 * Использование:
 *   node scripts/seed-demo.mjs --base http://localhost:4317 --email demo@example.test --password demo-pass-1234
 *   node scripts/seed-demo.mjs --wipe    # только очистить, ничего не засевать
 *
 * ⚠️ Пишет в аккаунт ЦЕЛИКОМ, перезаписывая файлы. Никогда не наводить на живой аккаунт —
 * скрипт проверяет, что email содержит 'demo' или 'test', и иначе отказывается работать.
 */
'use strict';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const BASE = arg('base', 'http://localhost:4317').replace(/\/+$/, '');
const EMAIL = arg('email', 'demo@example.test');
const PASSWORD = arg('password', 'demo-pass-1234');
const NAME = arg('name', 'Демо');
const WIPE = args.includes('--wipe');

if (!/demo|test|qa/i.test(EMAIL)) {
  console.error('Отказ: email должен содержать demo/test/qa. Это защита от засева живого аккаунта.');
  process.exit(1);
}

// ── даты ─────────────────────────────────────────────────────────────────────
const DAY = 86400000;
const today = new Date();
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const back = (n) => iso(today.getTime() - n * DAY);
const at = (n, h, m = 0) => new Date(new Date(back(n) + 'T00:00:00').getTime() + (h * 60 + m) * 60000).toISOString();
let seq = 0;
const uid = () => `seed${(seq += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── скелет: сферы те же, что в DEFAULT_SETTINGS, плюс вложенность ────────────
const SKILLS = [
  { id: 'study', name: 'Учёба', color: '#4f86f7' },
  { id: 'school', name: 'Школа', color: '#4f86f7', parentId: 'study' },
  { id: 'bio', name: 'Биология', color: '#4f86f7', parentId: 'school' },
  { id: 'work', name: 'Работа', color: '#22c1a4' },
  { id: 'sport', name: 'Спорт', color: '#e0526a' },
  { id: 'health', name: 'Здоровье', color: '#5fbf5f' },
  { id: 'mind', name: 'Саморазвитие', color: '#b06ff0' },
  { id: 'life', name: 'Быт', color: '#d8a44b' },
];

// Правдоподобные дела: тексты как у человека, а не «Задача 1».
const TASK_POOL = [
  ['Разобрать конспект по генетике', 'bio', 45, 'hard'],
  ['Прочитать главу учебника', 'bio', 30, 'normal'],
  ['Задачи по математике', 'school', 40, 'normal'],
  ['Немецкий: 20 карточек', 'study', 15, 'easy'],
  ['Пробежка', 'sport', 35, 'normal'],
  ['Зал: ноги', 'sport', 70, 'hard'],
  ['Растяжка перед сном', 'sport', 10, 'easy'],
  ['Приготовить нормальный ужин', 'health', 40, 'normal'],
  ['Убраться на столе', 'life', 15, 'easy'],
  ['Постирать', 'life', 20, 'easy'],
  ['Ответить на письма', 'work', 25, 'normal'],
  ['Час над проектом', 'work', 60, 'hard'],
  ['Прочитать бумажную книгу', 'mind', 30, 'normal'],
  ['Записать мысли за день', 'mind', 10, 'easy'],
];

function buildTasks() {
  const out = [];
  for (let d = 27; d >= 0; d -= 1) {
    const date = back(d);
    const weekday = new Date(date + 'T00:00:00').getDay();
    // Дырки намеренные: два пропущенных дня и просевшая неделя. Ровный график не бывает
    // ни у кого, и по ровному нельзя увидеть, как приложение говорит про провал.
    if (d === 12 || d === 11) continue;
    const load = d >= 18 && d <= 22 ? 1 : weekday === 0 || weekday === 6 ? 2 : 3;
    for (let i = 0; i < load; i += 1) {
      const [title, skillId, estimateMin, difficulty] = TASK_POOL[(d * 3 + i) % TASK_POOL.length];
      const done = d > 0 ? Math.random() > 0.18 : Math.random() > 0.5;
      const xp = Math.round(estimateMin * ({ easy: 1, normal: 1.5, hard: 2.2 }[difficulty]));
      out.push({
        id: uid(), title, skillId, skillIds: [skillId], date,
        estimateMin, difficulty, done,
        actualMin: done ? Math.max(5, estimateMin + Math.round((Math.random() - 0.4) * 15)) : null,
        completedAt: done ? at(d, 9 + (i * 4), 20) : null,
        xpAwarded: done ? xp : 0, goldAwarded: done ? Math.round(xp * 0.35) : 0,
        startTime: i === 0 ? '09:00' : i === 1 ? '14:30' : null,
        createdAt: at(d, 7, 30),
      });
    }
  }
  // Пара по-настоящему просроченных — чтобы было видно и амнистию, и «застрявшее дело».
  out.push({ id: uid(), title: 'Записаться к врачу', skillId: 'health', skillIds: ['health'], date: back(9), estimateMin: 15, difficulty: 'easy', done: false, actualMin: null, completedAt: null, xpAwarded: 0, goldAwarded: 0, startTime: null, createdAt: at(9, 10) });
  out.push({ id: uid(), title: 'Дописать заявку Jugend forscht', skillId: 'bio', skillIds: ['bio'], date: back(6), estimateMin: 90, difficulty: 'hard', done: false, actualMin: null, completedAt: null, xpAwarded: 0, goldAwarded: 0, startTime: null, createdAt: at(6, 11) });
  return out;
}

// Форма привычки — ровно та, что пишет редактор настроек: id, title, skillId,
// difficulty, estimateMin, days, archived, createdAt. Раньше здесь стояли
// name/xp/gold/min, и это тихо ломало весь засев: `validateHabitsPayload` требует
// `title` и отбраковывает НЕ отдельную запись, а файл целиком — засеянный аккаунт
// открывался с пустыми привычками и баннером восстановления. В интерфейсе это
// выглядело как «привычек просто нет», ошибка была только в консоли, поэтому и
// дожила до первой ручной проверки. Менять поля здесь — только вместе с редактором.
const HABITS = [
  { id: uid(), title: 'Вода утром', skillId: 'health', difficulty: 'easy', estimateMin: 2, days: [1, 2, 3, 4, 5, 6, 0], archived: false, createdAt: at(27, 8, 0) },
  { id: uid(), title: 'Немецкий 15 минут', skillId: 'study', difficulty: 'normal', estimateMin: 15, days: [1, 2, 3, 4, 5], archived: false, createdAt: at(27, 8, 5) },
  { id: uid(), title: 'Зарядка', skillId: 'sport', difficulty: 'normal', estimateMin: 10, days: [1, 3, 5], archived: false, createdAt: at(26, 9, 0) },
  // Брошенная — чтобы было видно, как выглядит привычка, которую забросили.
  { id: uid(), title: 'Медитация', skillId: 'mind', difficulty: 'easy', estimateMin: 10, days: [1, 2, 3, 4, 5, 6, 0], archived: true, createdAt: at(27, 8, 10) },
];

// Награда в журнале — историческая запись, а не пересчёт. Живое приложение считает
// её через itemXp/itemGold, где участвуют экономика настроек, перки и снаряжение;
// воспроизводить всю формулу в сидере незачем — журналу нужны правдоподобные числа.
const HABIT_LOG_REWARD = {
  'Вода утром': { xp: 8, gold: 3 },
  'Немецкий 15 минут': { xp: 15, gold: 6 },
  'Зарядка': { xp: 12, gold: 5 },
  'Медитация': { xp: 10, gold: 4 },
};

function buildHabitLog() {
  const log = {};
  for (let d = 27; d >= 0; d -= 1) {
    const date = back(d);
    const wd = new Date(date + 'T00:00:00').getDay();
    const rec = {};
    for (const h of HABITS) {
      if (h.archived) continue;
      if (!h.days.includes(wd)) continue;
      if (d === 12 || d === 11) continue;                 // те же дырки
      if (Math.random() > (d >= 18 && d <= 22 ? 0.5 : 0.85)) continue;
      const reward = HABIT_LOG_REWARD[h.title] || { xp: 10, gold: 4 };
      rec[h.id] = { xp: reward.xp, gold: reward.gold, min: h.estimateMin, at: at(d, 8, 30) };
    }
    if (Object.keys(rec).length) log[date] = rec;
  }
  return log;
}

const GOALS = [
  { id: uid(), title: 'Сдать биологию на 15 баллов', skillId: 'bio', type: 'term', parentId: null, status: 'active', targetDate: iso(today.getTime() + 60 * DAY), steps: [{ id: uid(), title: 'Разобрать генетику', done: true }, { id: uid(), title: 'Прорешать прошлые Klausur', done: true }, { id: uid(), title: 'Повторить экологию', done: false }], metric: null, progressKind: 'checklist', createdAt: at(25, 12) },
  { id: uid(), title: 'Подтягиваться 12 раз', skillId: 'sport', type: 'term', parentId: null, status: 'active', targetDate: iso(today.getTime() + 90 * DAY), steps: [], metric: { current: 7, target: 12, unit: 'раз', start: 4 }, progressKind: 'metric', createdAt: at(20, 12) },
  { id: uid(), title: 'Запустить Satoru', skillId: 'work', type: 'year', parentId: null, status: 'waiting', targetDate: iso(today.getTime() + 30 * DAY), steps: [{ id: uid(), title: 'Доделать гайд', done: false }, { id: uid(), title: 'Снять четыре ролика', done: false }], metric: null, progressKind: 'checklist', createdAt: at(26, 12) },
  { id: uid(), title: 'Прочитать 12 книг за год', skillId: 'mind', type: 'year', parentId: null, status: 'active', targetDate: iso(today.getTime() + 120 * DAY), steps: [], metric: { current: 5, target: 12, unit: 'книг', start: 0 }, progressKind: 'metric', completedAt: null, createdAt: at(27, 12) },
];

const REWARDS = [
  { id: uid(), name: 'Кофе в любимой кофейне', iconId: 'reward.coffee', cost: 60, createdAt: at(27, 12) },
  { id: uid(), name: '1 час игр без вины', iconId: 'reward.games', cost: 120, createdAt: at(27, 12) },
  { id: uid(), name: 'Серия сериала', iconId: 'reward.series', cost: 80, createdAt: at(27, 12) },
  { id: uid(), name: 'Новые наушники', iconId: 'reward.wishlist', cost: 5000, createdAt: at(27, 12) },
];
const PURCHASES = [
  { id: uid(), rewardId: REWARDS[0].id, name: REWARDS[0].name, cost: 60, at: at(5, 18) },
  { id: uid(), rewardId: REWARDS[2].id, name: REWARDS[2].name, cost: 80, at: at(2, 21) },
];

function buildDays() {
  const days = {};
  for (const d of [1, 2, 3, 5, 6, 8, 13, 16]) {
    days[back(d)] = { closed: true, note: ['Нормальный день.', 'Тяжело шло, но сделал.', 'Слился на телефон вечером.', 'Хороший день, много успел.'][d % 4], mood: (d % 5) + 1 };
  }
  return days;
}

const SETTINGS = {
  appName: 'Satoru',
  skills: SKILLS,
  xp: { perMinute: 1, completionBonus: 5, difficulty: { easy: 1, normal: 1.5, hard: 2.2 } },
  gold: { perMinute: 0.4, completionBonus: 3 },
  curve: { base: 100, growth: 1.3, skillBase: 60 },
  focus: { pomodoro: true, workMin: 25, breakMin: 5, sound: true, notify: true },
  imported: {},
  lang: 'ru',
  place: { name: 'Дрезден', lat: 51.05, lon: 13.74 },
  board: { version: 1, active: [], done: [], rested: [] },
  cosmetics: [],
};

const LOOTBOX = { day: iso(today), opened: 1, goldWon: 120, boost: null, titles: [], equipped: null, carry: 0, vouchers: ['common'], cosmeticsWon: 1, economyV124: true, history: [{ at: at(0, 9), label: '+40 золота', rarity: 'common', deterministic: false, cosmeticId: null }] };

// ── работа с сервером ────────────────────────────────────────────────────────
let cookie = '';
async function api(route, { method = 'GET', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

async function login() {
  const reg = await api('/api/auth/register', { method: 'POST', body: { name: NAME, email: EMAIL, password: PASSWORD } });
  if (reg.status === 200) return { created: true, recoveryCode: reg.data.recoveryCode };
  const log = await api('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  if (log.status !== 200) throw new Error(`не удалось войти: ${log.status} ${JSON.stringify(log.data)}`);
  return { created: false };
}

async function put(name, value) {
  const r = await api('/api/data/' + name, { method: 'PUT', body: value });
  if (r.status !== 200) throw new Error(`${name}: ${r.status} ${JSON.stringify(r.data)}`);
  return Array.isArray(value) ? value.length : Object.keys(value || {}).length;
}

const EMPTY = { tasks: [], habits: [], habitlog: {}, goals: [], rewards: [], purchases: [], days: {}, weeks: {}, achievements: {}, skilltree: {}, episodes: [], inbox: [], antihabits: [] };

async function main() {
  console.log(`Сервер: ${BASE}\nАккаунт: ${EMAIL}`);
  const session = await login();
  console.log(session.created ? '→ аккаунт создан' : '→ вошли в существующий');
  if (session.recoveryCode) console.log(`  код восстановления: ${session.recoveryCode}`);

  if (WIPE) {
    for (const [name, value] of Object.entries(EMPTY)) await put(name, value);
    console.log('Очищено. Настройки и сундук не тронуты.');
    return;
  }

  const tasks = buildTasks();
  const rows = [
    ['settings', SETTINGS], ['tasks', tasks], ['habits', HABITS], ['habitlog', buildHabitLog()],
    ['goals', GOALS], ['rewards', REWARDS], ['purchases', PURCHASES], ['days', buildDays()],
    ['lootbox', LOOTBOX], ['skilltree', {}], ['achievements', {}], ['weeks', {}],
  ];
  for (const [name, value] of rows) {
    const n = await put(name, value);
    console.log(`  ${name.padEnd(12)} ${n}`);
  }

  const done = tasks.filter((t) => t.done);
  const xp = done.reduce((s, t) => s + t.xpAwarded, 0);
  console.log(`\nГотово. Дел: ${tasks.length} (закрыто ${done.length}), опыта ~${xp}, дырки в графике на месте.`);
  console.log(`Войти: ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
