#!/usr/bin/env node

// Reproducible local profile seed for Guide browser QA.
// This script writes only to the explicitly supplied local test account.

const BASE = String(process.env.SATORU_QA_BASE || 'http://127.0.0.1:4345').replace(/\/$/, '');
const EMAIL = String(process.env.SATORU_QA_EMAIL || 'test@satoru.local');
const PASSWORD = String(process.env.SATORU_QA_PASSWORD || 'test1234');
const CHAPTER = String(process.argv[2] || 'calendar');
const LOCALE = String(process.argv[3] || 'ru');
const CHAPTERS = new Set(['calendar', 'notes', 'voice', 'jarvis', 'systemTheme', 'rewards', 'hero', 'den', 'pets', 'tree', 'stats']);
const LOCALES = new Set(['ru', 'en', 'de', 'uk', 'es']);

if (!CHAPTERS.has(CHAPTER)) throw new Error(`unsupported chapter: ${CHAPTER}`);
if (!LOCALES.has(LOCALE)) throw new Error(`unsupported locale: ${LOCALE}`);

function day(delta = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + delta);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const value = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${value}`;
}

async function login() {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`login ${response.status}`);
  const cookie = String(response.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('login cookie missing');
  return cookie;
}

async function request(cookie, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function completedTask(index, skillId) {
  const date = day(-(index + 1));
  return {
    id: `guide-qa-done-${index + 1}`,
    title: `Guide QA completed ${index + 1}`,
    skillId,
    skillIds: [skillId],
    estimateMin: 30,
    difficulty: 'normal',
    date,
    done: true,
    completedAt: `${date}T12:00:00.000Z`,
    xpAwarded: 140,
    goldAwarded: 20,
    actualMin: 30,
    startTime: null,
    createdAt: `${date}T10:00:00.000Z`,
  };
}

function futureTask(index, skillId) {
  const date = day(index + 1);
  return {
    id: `guide-qa-future-${index + 1}`,
    title: `Guide QA future ${index + 1}`,
    skillId,
    skillIds: [skillId],
    estimateMin: 30,
    difficulty: 'normal',
    date,
    done: false,
    completedAt: null,
    xpAwarded: 0,
    goldAwarded: 0,
    actualMin: null,
    startTime: null,
    createdAt: `${day()}T10:0${index}:00.000Z`,
  };
}

function prerequisiteChapters(chapter) {
  const out = ['first-journey'];
  if (['den', 'tree', 'stats', 'pets'].includes(chapter)) out.push('hero');
  if (chapter === 'pets') out.push('den');
  return out;
}

function guideState(chapter) {
  const completedChapters = prerequisiteChapters(chapter);
  const chapterMeta = {
    'first-journey': { completedAt: Date.now() - 172800000 },
  };
  for (const id of completedChapters) {
    if (id !== 'first-journey') chapterMeta[id] = { completedAt: Date.now() - 86400000 };
  }
  if (chapter === 'voice') chapterMeta.voice = { replay: true, replayAt: Date.now() };
  else chapterMeta[chapter] = {};
  return {
    version: 3,
    enabled: true,
    currentChapter: chapter,
    currentStep: 'intro',
    completedSteps: [],
    completedChapters,
    skippedChapters: [],
    seenPrompts: [],
    snoozedUntil: null,
    lastPromptAt: null,
    firstRunForm: 'spark',
    voiceConsent: null,
    questionnaireVersion: null,
    selectedTaskId: null,
    waitingFor: null,
    chapterMeta,
  };
}

const cookie = await login();
const settings = await request(cookie, '/api/data/settings');
if (!settings || !Array.isArray(settings.skills) || settings.skills.length < 2) throw new Error('seed requires at least two skills');
const firstSkill = settings.skills[0].id;
const secondSkill = settings.skills[1].id;
const tasks = [
  ...Array.from({ length: 8 }, (_, index) => completedTask(index, index % 2 ? secondSkill : firstSkill)),
  ...Array.from({ length: 3 }, (_, index) => futureTask(index, firstSkill)),
];
const days = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [day(-(index + 1)), {
  note: `Guide QA day ${index + 1}`,
  closed: true,
  closedAt: `${day(-(index + 1))}T20:00:00.000Z`,
}]));
const nextSettings = structuredClone(settings);
nextSettings.lang = LOCALE;
nextSettings.theme = 'dark';
nextSettings.systemMode = false;
nextSettings.imported = {
  ...(nextSettings.imported || {}),
  [firstSkill]: { tier: 3, xp: 1400, label: 'Guide QA', at: new Date().toISOString() },
  [secondSkill]: { tier: 2, xp: 700, label: 'Guide QA', at: new Date().toISOString() },
};
nextSettings.tutorial = { i: 0, active: false, done: true, skipped: false, seenDrips: ['d_habits', 'd_den', 'd_tree', 'd_capture', 'd_voice', 'd_jarvis'], mode: 'day1', dripId: null };
nextSettings.guideV3 = guideState(CHAPTER);

const tree = {
  [firstSkill]: {
    nodes: [{
      id: 'guide-qa-tree-node',
      title: 'Guide QA practice',
      desc: 'A stable unlockable node used only by local Guide QA.',
      cost: 1,
      requires: [],
      perks: [],
      unlocked: false,
      x: 0,
      y: 0,
    }],
  },
};
const writes = {
  tasks,
  habits: [],
  habitlog: {},
  antihabits: [],
  goals: [],
  'goal-groups': [],
  skilltree: tree,
  rewards: [{ id: 'guide-qa-reward', name: 'Guide QA tea', iconId: 'reward.coffee', cost: 5, createdAt: new Date().toISOString() }],
  purchases: [],
  inbox: [],
  days,
  weeks: {},
  achievements: {},
  lootbox: { day: day(), opened: 0, goldWon: 0, boost: null, titles: [], equipped: null, history: [], carry: 0, vouchers: [], economyV124: true },
  episodes: [],
  settings: nextSettings,
};

for (const [name, value] of Object.entries(writes)) {
  await request(cookie, `/api/data/${name}`, { method: 'PUT', body: value });
}

console.log(JSON.stringify({ ok: true, chapter: CHAPTER, locale: LOCALE, account: EMAIL, tasks: tasks.length }));
