// Synthetic QA seed: isolated DATA_DIR only. No real accounts or AI calls.
const BASE = process.env.BASE || 'http://127.0.0.1:51900';
const profile = process.argv[2] || 'dense';
const lang = process.argv[3] || 'ru';
const name = process.argv[4] || ('qa' + profile + lang);
async function j(path, opts = {}, cookie) {
  const r = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) } });
  const txt = await r.text();
  return { status: r.status, body: txt, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const reg = await j('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email: name + '@example.test', password: 'synthetic-pass-123', lang }) });
if (reg.status !== 200) { console.error('register', reg.status, reg.body); process.exit(1); }
const cookie = reg.cookie;
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date(); today.setHours(12, 0, 0, 0);
const day = (off) => { const d = new Date(today); d.setDate(d.getDate() + off); return d; };
const longNames = { ru: ['Восстановление', 'Отношения и семья', 'Учёба', 'Работа', 'Спорт', 'Саморазвитие', 'Творчество', 'Финансы'],
  en: ['Recovery', 'Relationships & family', 'Study', 'Work', 'Sport', 'Self-development', 'Creativity', 'Finances'],
  de: ['Erholung', 'Beziehungen & Familie', 'Studium', 'Arbeit', 'Sport', 'Selbstentwicklung', 'Kreativität', 'Finanzen'],
  uk: ['Відновлення', 'Стосунки та родина', 'Навчання', 'Робота', 'Спорт', 'Саморозвиток', 'Творчість', 'Фінанси'],
  es: ['Recuperación', 'Relaciones y familia', 'Estudio', 'Trabajo', 'Deporte', 'Desarrollo personal', 'Creatividad', 'Finanzas'] }[lang];
const colors = ['#5fbf7a', '#e0526a', '#4f86f7', '#22c1a4', '#e0a23e', '#b06ff0', '#d8a44b', '#6c8cff'];
const nSk = profile === 'empty' ? 6 : 8;
const skills = longNames.slice(0, nSk).map((n, i) => ({ id: 's' + i, name: n, color: colors[i], colorMode: 'manual' }));
const settings = { appName: 'Satoru', lang, skills, theme: process.env.THEME || 'dark', accent: '#6c8cff',
  xp: { perMinute: 1, completionBonus: 5, difficulty: { easy: 1, normal: 1.5, hard: 1.75 } }, gold: { perMinute: 0.4, completionBonus: 3 },
  curve: { base: 100, growth: 1.3, skillBase: 60 }, imported: {}, cosmetics: [], equipped: { frame: null, background: null, title: null }, sound: false,
  companion: { name: 'Тень', born: fmt(day(-40)), bond: 10, lastSeen: null, journal: [], check: {} }, social: { leaderboard: false, party: false } };
const tasks = [];
let id = 1;
function add(off, sk, min, done = true) {
  const d = day(off); const date = fmt(d);
  const xp = Math.round(min * 1.5 + 5);
  tasks.push({ id: 'qa' + (id++), title: 'Synthetic ' + id, date, skillId: 's' + sk, estimateMin: min, difficulty: 'normal', done,
    ...(done ? { completedAt: new Date(d.getTime()).toISOString(), xpAwarded: xp, goldAwarded: Math.round(min * 0.4) + 3 } : {}) });
}
if (profile === 'dense') {
  // base window (days -34..-7): steady spheres 0..5; recent 7 days: sphere 1 spikes, 2 continues, 3 quiet
  for (let off = -34; off <= -7; off++) { add(off, 0, 30); add(off, 1, 25); if (off % 2) add(off, 2, 45); if (off % 3 === 0) add(off, 3, 60); if (off % 4 === 0) add(off, 4, 40); }
  for (let off = -6; off <= 0; off++) { add(off, 1, 90); add(off, 1, 60); add(off, 2, 45); add(off, 0, 30); if (off % 2) add(off, 5, 20); }
  add(-2, 6, 15); // brand-new sphere: tiny history
  for (let off = 0; off <= 2; off++) add(off, 4, 30, false);
} else if (profile === 'new') {
  // A few days only: base is insufficient
  add(-2, 0, 30); add(-1, 1, 45); add(0, 1, 60); add(0, 2, 20);
}
const put = async (n, v) => { const r = await j('/api/data/' + n, { method: 'PUT', body: JSON.stringify(v) }, cookie); if (r.status !== 200) throw new Error(n + ' ' + r.status + r.body); };
await put('settings', settings);
await put('tasks', tasks);
console.log(JSON.stringify({ cookie, name, tasks: tasks.length }));
