'use strict';

// Satoru — self-hosted multi-user gamified life planner.
// Auth: PIN profiles + HMAC-signed session cookies. Zero npm deps (Node stdlib only).
// Data layout: DATA_DIR/users/<userId>/*.json  (one dir per user)
//              DATA_DIR/users.json             (user registry, no PINs in plain text)
//              DATA_DIR/secret.json            (HMAC secret, auto-generated)

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, 'data');
const PORT = process.env.PORT ? Number(process.env.PORT) : 4317;
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4':  'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.apk':  'application/vnd.android.package-archive',
};

const USER_DATA_FILES = [
  'settings', 'tasks', 'habits', 'habitlog', 'goals',
  'skilltree', 'rewards', 'purchases', 'achievements', 'days', 'weeks',
];

// ============================================================
//  Helpers
// ============================================================
function send(res, status, body, headers = {}) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers));
  res.end(body);
}
function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}
function safeName(n) { return /^[a-z0-9_-]+$/.test(n) ? n : null; }
function safeId(n)   { return /^[a-z0-9_-]{1,32}$/.test(n) ? n : null; }
function readBody(req, maxBytes) {
  const cap = maxBytes || 5 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > cap) { req.destroy(); reject(new Error('payload too large')); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
const FB_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
function serveStatic(req, res, urlPath, headOnly) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, headOnly ? '' : buf, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
}

// ============================================================
//  Secret (HMAC key) — auto-generated, persisted
// ============================================================
let SECRET;
function loadSecret() {
  const f = path.join(DATA_DIR, 'secret.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')).secret; } catch {}
  const s = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ secret: s }));
  return s;
}

// ============================================================
//  Users registry
// ============================================================
const USERS_FILE = () => path.join(DATA_DIR, 'users.json');
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE(), 'utf8')); } catch { return []; }
}
function saveUsers(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE(), JSON.stringify(users, null, 2));
}
function userDataDir(id) { return path.join(DATA_DIR, 'users', id); }
// ---- Мультиплеер: пати (общее состояние). Реестр в DATA_DIR/parties.json ----
const PARTIES_FILE = () => path.join(DATA_DIR, 'parties.json');
function loadParties() { try { return JSON.parse(fs.readFileSync(PARTIES_FILE(), 'utf8')); } catch { return []; } }
function saveParties(p) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(PARTIES_FILE(), JSON.stringify(p, null, 2)); }
function partyOf(uid, parties) { return (parties || loadParties()).find((p) => (p.members || []).includes(uid)) || null; }
function genPartyCode(parties) { // 5-символьный код без похожих символов, уникальный
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c;
  do { c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (parties.some((p) => p.code === c));
  return c;
}
const PARTY_MAX = 6;
// Кооп-рейд: понедельник недели (для сброса), цель XP/чел, цель сезона (побед).
const RAID_PER_WEEK = 600, SEASON_GOAL = 4;
// ── Тематические боссы: СЛАБОСТЬ босса недели. Действия, попавшие в слабость, наносят УРОН ×2
//    (обычный XP тоже ранит — рейд не ломается, если сферы юзера не совпали с темой недели).
//    ⚠️ СИНХРОН С КЛИЕНТОМ: порядок/длина = BOSSES в public/app.js (bossForWeek = hash % length).
//    Правила детерминированы из сырых данных юзера (анти-накрутка, считает только сервер).
const BOSS_RULES = [
  'overdue2',   // 0 Прокрастинион — закрыть дело, висевшее ≥2 дней (отобрать съеденные дни)
  'focus',      // 1 Лярва Скролла — фокус-время (actualMin>0) вместо ленты
  'habit',      // 2 Голод Дофамина — отмеченные привычки (стабильность против быстрых радостей)
  'hard',       // 3 Туман Отговорок — сложные квесты (то, от чего отговариваешься)
  'sameday',    // 4 Дракон «Завтра» — сделать в день создания (не кормить «завтра»)
  'morning',    // 5 Сирена Уюта — дело завершено до 10:00 (встать с дивана)
  'firstofday', // 6 Голем Инерции — ПЕРВОЕ дело каждого дня (первое движение — самое трудное)
  'easy',       // 7 Идол Перфекто — лёгкие квесты (сделанное побеждает идеальное)
  'hard',       // 8 Шёпот-за-Плечом — сложные квесты (сделал, хотя «не выйдет»)
  'goal',       // 9 Зеркало Чужих Побед — закрытие СВОИХ целей (свой путь)
  'focus',      // 10 Гидра Многозадачность — фокус-сессии (одно дело за раз)
  'focus25',    // 11 Рой Уведомлений — сессии ≥25 мин без прерываний (полный помидор)
  'scheduled',  // 12 Вихрь Спешки — дела по расписанию (startTime задан)
  'evening',    // 13 Гипножаба — дело вечером 19:00–23:59 (вечер занят делом, не серией)
  'sphere:быт|дом|уборк|поряд|хаос|орган|chore|home|clean', // 14 Паутина Хаоса — сферы порядка/быта
  'overdue7',   // 15 Призрак Забытых Целей — закрыть дело, висевшее ≥7 дней (вспомнил — и сделал)
];
function bossRuleForWeek(ws) { let h = 0; const s = String(ws || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return BOSS_RULES[h % BOSS_RULES.length]; }
// Проверка задачи против правила слабости. ctx: { isFirstOfDay, sphereName }
function taskHitsBossRule(rule, t, ctx) {
  if (!rule || !t) return false;
  const doneAt = t.completedAt ? new Date(t.completedAt) : null;
  const hour = doneAt && !isNaN(doneAt) ? doneAt.getHours() : null;
  const madeDay = (t.createdAt && String(t.createdAt).slice(0, 10)) || t.date;
  const doneDay = (t.completedAt && String(t.completedAt).slice(0, 10)) || t.date;
  const ageDays = (madeDay && doneDay) ? Math.round((Date.parse(doneDay) - Date.parse(madeDay)) / 86400000) : 0;
  switch (rule.split(':')[0]) {
    case 'hard': return t.difficulty === 'hard';
    case 'easy': return t.difficulty === 'easy';
    case 'overdue2': return ageDays >= 2;
    case 'overdue7': return ageDays >= 7;
    case 'sameday': return madeDay && doneDay && madeDay === doneDay;
    case 'morning': return hour !== null && hour < 10;
    case 'evening': return hour !== null && hour >= 19;
    case 'focus': return (Number(t.actualMin) || 0) > 0;
    case 'focus25': return (Number(t.actualMin) || 0) >= 25;
    case 'scheduled': return !!t.startTime;
    case 'firstofday': return !!(ctx && ctx.isFirstOfDay);
    case 'sphere': { const re = new RegExp(rule.slice(7), 'i'); return !!(ctx && ctx.sphereName && re.test(ctx.sphereName)); }
    default: return false;
  }
}
function mondayStr(dt) { const x = dt ? new Date(dt) : new Date(); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
// Пересчитывает состояние рейда (мутирует party.raid/season). Победа недели = сумма недельного XP ≥ цель. Сброс на новой неделе. Сезон = накопленные победы.
function refreshRaid(party) {
  const ws = mondayStr();
  if (!party.raid || party.raid.ws !== ws) party.raid = { ws, won: false, claimed: [] };
  party.season = party.season || { wins: 0 };
  const users = loadUsers();
  let total = 0;
  // Урон боссу = bossXp (обычный XP + тематическая слабость ×2); фолбэк на xp для старых снапшотов
  for (const id of (party.members || [])) { const u = users.find((x) => x.id === id); const w = u && u.pub && u.pub.week; if (w && w.ws === ws) total += (w.bossXp != null ? w.bossXp : (w.xp || 0)); }
  const target = (party.members || []).length * RAID_PER_WEEK;
  let justWon = false;
  if (!party.raid.won && target > 0 && total >= target) { party.raid.won = true; party.season.wins = (party.season.wins || 0) + 1; justWon = true; }
  return { ws, total, target, won: party.raid.won, claimed: party.raid.claimed || [], seasonWins: party.season.wins || 0, justWon };
}
// ---- Серверная валидация XP: пересчёт из СОХРАНЁННЫХ данных юзера (не доверяем publish-payload) ----
const RANK_TABLE = [['Новичок', 1], ['Ученик', 3], ['Адепт', 6], ['Эксперт', 10], ['Мастер', 16], ['Грандмастер', 24], ['Легенда', 34]];
function rankNameFor(level) { let n = RANK_TABLE[0][0]; for (const [nm, min] of RANK_TABLE) if (level >= min) n = nm; return n; }
// ============================================================
//  Анти-чит XP (Фаза 1 + 2): сервер пересчитывает XP лидерборда/рейда из «сырых фактов»
//  СВОЕЙ фиксированной формулой, ИГНОРИРУЯ присланные клиентом числа (task.xpAwarded и т.д.),
//  + потолки/валидация против фабрикации. Личный (клиентский) XP не трогаем — это про тёплый UX.
//  Формула-константы фиксированы здесь, т.к. settings.xp/curve у юзера редактируемы = вектор накрутки.
// ============================================================
const XP_PER_MIN = 1, XP_BONUS = 5, XP_DIFF = { easy: 1, normal: 1.5, hard: 2.2 };
const LVL_BASE = 100, LVL_GROWTH = 1.3, SKILL_BASE = 60;            // серверная кривая уровней
const GOAL_XP_SRV = { mission: 8000, vision: 3000, path: 1200, long: 750, mid: 200, short: 50, recurring: 15 };
const GOAL_XP_DEFAULT = 60;
const ACX = { // потолки (env-настраиваемы для тюнинга без правки кода)
  maxTaskMin: Number(process.env.ACX_MAX_TASK_MIN) || 600,         // минут на одну задачу/привычку
  maxXpPerDay: Number(process.env.ACX_MAX_XP_PER_DAY) || 3000,     // зачётного XP/день (задачи+привычки) — рубит фабрикацию
  maxTasksPerDay: Number(process.env.ACX_MAX_TASKS_PER_DAY) || 80, // зачётных задач/день
  maxImportLevel: Number(process.env.ACX_MAX_IMPORT_LEVEL) || 20,  // макс. стартовый уровень импорта сферы
  futureSkewMs: 36 * 3600 * 1000,                                  // допуск на часовые пояса (±1.5 сут)
};
function acxLvlNeed(level) { return Math.round(LVL_BASE * Math.pow(LVL_GROWTH, level - 1)); }
function acxXpForLevel(L) { let xp = 0; for (let k = 1; k < L; k++) xp += Math.round(SKILL_BASE * Math.pow(LVL_GROWTH, k - 1)); return xp; }
function acxDiff(d) { return XP_DIFF[d] != null ? XP_DIFF[d] : XP_DIFF.normal; }
function acxBaseXp(estimateMin, difficulty) { // базовый XP БЕЗ модификаторов (их подделать нельзя проверить — не зачитываем)
  const min = Math.min(ACX.maxTaskMin, Math.max(0, Math.floor(Number(estimateMin) || 0)));
  return min * XP_PER_MIN * acxDiff(difficulty) + XP_BONUS;
}
function acxValidDate(d) { // строка-дата; валидна и не из будущего (с допуском) → Date, иначе null
  if (typeof d !== 'string') return null;
  const t = Date.parse(d); if (isNaN(t) || t > Date.now() + ACX.futureSkewMs) return null;
  return new Date(t);
}
function acxDayKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function computeUserXp(uid) {
  const dir = userDataDir(uid);
  const rd = (n) => { try { return JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8')); } catch { return null; } };
  const settings = rd('settings') || {}, tasks = rd('tasks') || [], habitlog = rd('habitlog') || {}, goals = rd('goals') || [], habits = rd('habits') || [];
  const habitById = {}; for (const h of (Array.isArray(habits) ? habits : [])) if (h && h.id) habitById[h.id] = h;
  const ws = mondayStr();
  let total = 0, weekXp = 0, weekQuests = 0, weekBoss = 0;
  // Тематический босс недели: действия из его «слабости» наносят урон ×2 (weekBoss = добавка сверх weekXp)
  const bossRule = bossRuleForWeek(ws);
  const skillNameOf = (id) => { const s = (Array.isArray(settings.skills) ? settings.skills : []).find((x) => x && x.id === id); return s ? String(s.name || '') : ''; };
  // Для правила «первое дело дня»: задача с минимальным completedAt в каждом дне
  const firstByDay = Object.create(null);
  if (bossRule === 'firstofday') for (const t of (Array.isArray(tasks) ? tasks : [])) {
    if (!t || !t.done) continue; const d = acxValidDate(t.completedAt || t.date); if (!d) continue;
    const dk = acxDayKey(d), ts = Date.parse(t.completedAt || t.date) || 0;
    if (!(dk in firstByDay) || ts < firstByDay[dk].ts) firstByDay[dk] = { id: t.id, ts };
  }
  // Дневные потолки: не даём одному дню превысить лимит (рубит «1000 фейковых дел сегодня»).
  const dayXp = Object.create(null), dayCnt = Object.create(null);
  const addCapped = (dk, xp, countsTask) => {
    if (countsTask && (dayCnt[dk] || 0) >= ACX.maxTasksPerDay) return 0;
    const room = ACX.maxXpPerDay - (dayXp[dk] || 0); if (room <= 0) return 0;
    const grant = Math.max(0, Math.min(xp, room));
    dayXp[dk] = (dayXp[dk] || 0) + grant; if (countsTask) dayCnt[dk] = (dayCnt[dk] || 0) + 1;
    return grant;
  };
  // Задачи: XP по серверной формуле из difficulty/estimateMin, xpAwarded игнорируем
  for (const t of (Array.isArray(tasks) ? tasks : [])) {
    if (!t || !t.done) continue;
    const d = acxValidDate(t.completedAt || t.date); if (!d) continue;
    const dk = acxDayKey(d), xp = addCapped(dk, acxBaseXp(t.estimateMin, t.difficulty), true);
    if (xp <= 0) continue;
    total += xp;
    if (dk >= ws) {
      weekXp += xp; weekQuests += 1;
      // слабость босса: попадание → урон ×2 (weekBoss — добавка сверх обычного XP)
      const ctx = { isFirstOfDay: !!(firstByDay[dk] && firstByDay[dk].id === t.id), sphereName: skillNameOf(t.skillId || (t.skillIds && t.skillIds[0])) };
      if (taskHitsBossRule(bossRule, t, ctx)) weekBoss += xp;
    }
  }
  // Привычки: difficulty/estimateMin из habits.json (фолбэк — min из лог-записи)
  for (const day in habitlog) {
    const dd = acxValidDate(day); if (!dd) continue;
    const dk = acxDayKey(dd), m = habitlog[day] || {};
    for (const hid in m) {
      const h = habitById[hid], rec = m[hid] || {};
      const min = (h && h.estimateMin != null) ? h.estimateMin : (rec.min || 0);
      const xp = addCapped(dk, acxBaseXp(min, h ? h.difficulty : 'normal'), false);
      if (xp <= 0) continue;
      total += xp;
      if (dk >= ws) {
        weekXp += xp;
        // привычки ранят «Голод Дофамина» (habit) и сферных боссов (sphere:)
        if (bossRule === 'habit') weekBoss += xp;
        else if (bossRule && bossRule.indexOf('sphere:') === 0 && taskHitsBossRule(bossRule, {}, { sphereName: skillNameOf(h && h.skillId) })) weekBoss += xp;
      }
    }
  }
  // Цели: XP по типу; кастомный xpReward режется потолком типа. Вне дневного лимита (это вехи).
  for (const g of (Array.isArray(goals) ? goals : [])) {
    if (!g || !g.completedAt) continue;
    const d = acxValidDate(g.completedAt); if (!d) continue;
    const cap = GOAL_XP_SRV[g.type] != null ? GOAL_XP_SRV[g.type] : GOAL_XP_DEFAULT;
    const xp = Math.max(0, Math.min(Number(g.xpReward) || cap, cap));
    total += xp;
    if (acxDayKey(d) >= ws) { weekXp += xp; if (bossRule === 'goal') weekBoss += xp; } // «Зеркало Чужих Побед» ранят СВОИ закрытые цели
  }
  // Импорт стартового уровня: на сферу не больше, чем XP к maxImportLevel
  const importCap = acxXpForLevel(ACX.maxImportLevel + 1);
  const imp = settings.imported || {};
  for (const k in imp) total += Math.max(0, Math.min(Number(imp[k] && imp[k].xp) || 0, importCap));
  total = Math.round(total);
  // Уровень — по серверной кривой (clamp на случай гигантских значений)
  let level = 1, rem = total, need = acxLvlNeed(level);
  while (rem >= need && level < 999) { rem -= need; level++; need = acxLvlNeed(level); }
  // bossXp = weekXp + тематическая добавка (слабость босса = урон ×2 за попавшие действия)
  return { total, weekXp: Math.round(weekXp), weekBossXp: Math.round(weekXp + weekBoss), weekQuests, level, rank: rankNameFor(level) };
}
// ---- Web Push (RFC8291 aes128gcm + VAPID RFC8292). Zero-dep, проверено round-trip-тестом. ----
const PUSH_SUBJECT = process.env.PUSH_SUBJECT || 'mailto:gojo@example.com';
const pb64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const punb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const phkdf = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
let _vapid = null;
function loadVapid() {
  if (_vapid) return _vapid;
  const f = path.join(DATA_DIR, 'push-vapid.json');
  try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); _vapid = { privateKey: crypto.createPrivateKey({ key: j.priv, format: 'jwk' }), pubB64: j.pubB64 }; return _vapid; } catch {}
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const pubRaw = Buffer.concat([Buffer.from([4]), punb64u(jwk.x), punb64u(jwk.y)]);
  const pubB64 = pb64u(pubRaw);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, JSON.stringify({ priv: privateKey.export({ format: 'jwk' }), pubB64 })); } catch {}
  _vapid = { privateKey, pubB64 }; return _vapid;
}
function vapidJWT(endpoint) {
  const v = loadVapid(), aud = new URL(endpoint).origin;
  const head = pb64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const pay = pb64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH_SUBJECT }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${pay}`), { key: v.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${head}.${pay}.${pb64u(sig)}`;
}
function encryptPush(keys, plaintext) {
  const uaPub = punb64u(keys.p256dh), auth = punb64u(keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), shared = ecdh.computeSecret(uaPub);
  const ikm = phkdf(shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const salt = crypto.randomBytes(16);
  const cek = phkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = phkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const record = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const enc = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(65, 20);
  return Buffer.concat([header, asPub, enc]);
}
function sendWebPush(sub, payloadObj) {
  return new Promise((resolve) => {
    try {
      const body = encryptPush({ p256dh: sub.p256dh, auth: sub.auth }, JSON.stringify(payloadObj));
      const url = new URL(sub.endpoint);
      const r = https.request({ host: url.host, path: url.pathname + url.search, method: 'POST', headers: {
        'Authorization': `vapid t=${vapidJWT(sub.endpoint)}, k=${loadVapid().pubB64}`,
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': '86400', 'Content-Length': body.length,
      } }, (resp) => { let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => resolve({ status: resp.statusCode, body: d.slice(0, 300) })); });
      r.on('error', (e) => resolve({ status: 0, error: String(e.message || e) })); r.write(body); r.end();
    } catch (e) { resolve({ status: 0, error: String(e.message || e) }); }
  });
}
// ---- Планировщик пушей: компаньон зовёт назад утром/вечером (Finch-присутствие вне приложения) ----
// Каждые 15 мин: для подписанных юзеров — утро (8–11) и вечер (19–22) по ИХ таймзоне,
// без дублей за день и только если чек-ин ещё не сделан. Через тепло, без вины.
function userLocalParts(tz) {
  const now = new Date();
  try {
    const date = now.toLocaleDateString('en-CA', { timeZone: tz });                 // YYYY-MM-DD
    const hour = Number(now.toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit' }));
    return { date, hour: Number.isNaN(hour) ? now.getHours() : (hour % 24) };
  } catch { return { date: now.toISOString().slice(0, 10), hour: now.getHours() }; }
}
function readUserJson(uid, name) { try { return JSON.parse(fs.readFileSync(path.join(userDataDir(uid), name + '.json'), 'utf8')); } catch { return null; } }
function readUserCompanion(uid) { const s = readUserJson(uid, 'settings'); return (s && s.companion) || null; }
// «Одинокий питомец»: активный юзер, но какая-то основная сфера давно заброшена → имя того питомца.
// Лёгкая эвристика из tasks.json + settings.json (без полной репликации xpEvents). Не нашли — null.
function lonelyPet(uid) {
  const settings = readUserJson(uid, 'settings'), tasks = readUserJson(uid, 'tasks');
  if (!settings || !Array.isArray(settings.skills) || !Array.isArray(tasks)) return null;
  const skills = settings.skills, tops = skills.filter((s) => !s.parentId);
  if (tops.length < 2) return null;
  const topOf = (id) => { let s = skills.find((x) => x.id === id), g = 0; while (s && s.parentId && g++ < 12) s = skills.find((x) => x.id === s.parentId); return s ? s.id : id; };
  const now = Date.now(), DAY = 86400000;
  const lastByTop = {}; let activeRecently = false;
  for (const t of tasks) {
    if (!t.done) continue;
    const when = t.completedAt ? new Date(t.completedAt).getTime() : new Date(t.date).getTime();
    if (Number.isNaN(when)) continue;
    const top = topOf(t.skillId || (t.skillIds && t.skillIds[0]));
    if (top) { lastByTop[top] = Math.max(lastByTop[top] || 0, when); }
    if ((now - when) / DAY <= 3) activeRecently = true;
  }
  if (!activeRecently) return null; // если юзер вообще не активен — это работа утреннего/вечернего нуджа, не питомца
  let worst = null, worstGap = 5; // нудж только при простое сферы ≥ 6 дней
  for (const s of tops) { const gap = lastByTop[s.id] ? (now - lastByTop[s.id]) / DAY : 99; if (gap > worstGap) { worstGap = gap; worst = s; } }
  if (!worst) return null;
  return (settings.petNames && settings.petNames[worst.id]) || worst.name;
}
// Чистое решение «слать ли и какой чек-ин» — вынесено, чтобы юнит-тестить без отправки.
function pushDecision(hour, log, checked) {
  if (hour >= 8 && hour < 11 && !log.m && !checked.m) return 'm';
  if (hour >= 19 && hour < 22 && !log.e && !checked.e) return 'e';
  return null;
}
async function pushTick() {
  let users; try { users = loadUsers(); } catch { return; }
  let changed = false;
  for (const user of users) {
    if (!user.push || !user.push.endpoint) continue;
    if (user.push.nudges === false) continue; // юзер отключил напоминания компаньона
    const tz = user.push.tz || 'Europe/Berlin';
    const { date, hour } = userLocalParts(tz);
    const log = (user.push.log && user.push.log.date === date) ? user.push.log : { date, m: false, e: false, p: false };
    const comp = readUserCompanion(user.id);
    const name = (comp && comp.name) || 'Тень';
    const checked = (comp && comp.check && comp.check[date]) || {};
    const kind = pushDecision(hour, log, checked);
    let payload = null;
    if (kind === 'm') payload = { title: `🌅 ${name} ждёт тебя`, body: 'Доброе утро! Чем наполним сегодня?', url: './?view=today', tag: 'satoru-checkin' };
    else if (kind === 'e') payload = { title: `🌙 ${name}`, body: 'Как прошёл день? Загляни на минутку 💛', url: './?view=today', tag: 'satoru-checkin' };
    // Днём (13–17): «питомец заскучал» — максимум раз в 2 дня, только если есть заброшенная сфера
    else if (hour >= 13 && hour < 17 && !log.p && (!user.push.petAt || (Date.parse(date) - Date.parse(user.push.petAt)) / 86400000 >= 2)) {
      const pet = lonelyPet(user.id);
      if (pet) { payload = { title: `🐾 ${pet} заскучал`, body: `${pet} давно тебя не видел в этой сфере — загляни на минутку 💛`, url: './?view=pets', tag: 'satoru-pet' }; log.p = true; user.push.petAt = date; }
    }
    if (!payload) { if (user.push.log !== log) { user.push.log = log; changed = true; } continue; }
    const r = await sendWebPush(user.push, payload);
    if (kind === 'm' || kind === 'e') log[kind] = true;
    user.push.log = log; changed = true;
    if (r && (r.status === 404 || r.status === 410)) delete user.push; // мёртвая подписка → выписать
  }
  if (changed) { try { saveUsers(users); } catch {} }
}

// ИИ BYOK: ключи per-user (в data/users/<id>/, под гитигнором). Наружу не отдаём.
function aiKeysFile(id) { return path.join(userDataDir(id), 'ai-keys.json'); }
function loadAiKeys(id) { try { return JSON.parse(fs.readFileSync(aiKeysFile(id), 'utf8')); } catch { return {}; } }
// HTTPS POST JSON → { status, json }. Для прокси к Anthropic/OpenAI ключом юзера.
function httpsPostJson(host, pathName, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(bodyObj));
    const r = https.request({ host, path: pathName, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': body.length }, headers) }, (resp) => {
      let data = ''; resp.on('data', (c) => data += c); resp.on('end', () => { let json = {}; try { json = JSON.parse(data || '{}'); } catch { json = { raw: data.slice(0, 500) }; } resolve({ status: resp.statusCode, json }); });
    });
    r.on('error', reject); r.write(body); r.end();
  });
}
// Универсальный вызов модели: { ok, text } | { ok:false, noKey } | { ok:false, status, detail }
// Реестр ИИ-провайдеров. shape: 'anthropic' | 'openai' (совместимый) | 'gemini'.
// free=true — ключ берётся бесплатно без карты/подписки (Gemini, Groq).
// ⚠️ Имена моделей ПРОТУХАЮТ. Живой случай 27.07: провайдер отдал «gemini-2.5-flash is no longer
// available to new users» — старый ключ работал бы, а свежесозданный уже нет, и поймать это можно
// было только настоящим вызовом (флаг houseAvailable показывал true, потому что проверяет лишь
// НАЛИЧИЕ ключа). Поэтому каждая модель переопределяется переменной окружения: сменить её можно
// на Railway за минуту, без правки кода и деплоя.
const AI_PROVIDERS = {
  gemini: { shape: 'gemini', host: 'generativelanguage.googleapis.com', model: process.env.AI_MODEL_GEMINI || 'gemini-3.6-flash' },
  groq: { shape: 'openai', host: 'api.groq.com', path: '/openai/v1/chat/completions', model: process.env.AI_MODEL_GROQ || 'llama-3.3-70b-versatile' },
  anthropic: { shape: 'anthropic', host: 'api.anthropic.com', model: process.env.AI_MODEL_ANTHROPIC || 'claude-opus-4-8' },
  openai: { shape: 'openai', host: 'api.openai.com', path: '/v1/chat/completions', model: process.env.AI_MODEL_OPENAI || 'gpt-4o' },
};
function aiComplete(provider, keys, system, prompt, maxTokens) {
  return aiCompleteMessages(provider, keys, system, [{ role: 'user', content: prompt }], maxTokens);
}
// ============================================================
//  ИИ-биллинг: «домашний» ключ (мы платим инференс) для Pro/триала + учёт токенов.
//  Логика: свой ключ юзера (BYOK) — приоритет (нам бесплатно); иначе дом.ключ из env —
//  только для Pro/триала и в пределах месячной квоты токенов. Free без своего ключа → апселл.
// ============================================================
function houseKeyFor(provider) { return process.env['AI_HOUSE_KEY_' + String(provider).toUpperCase()] || ''; }
// Какой провайдер крутим на дом.ключе: явный AI_HOUSE_PROVIDER → иначе первый с заданным ключом (Gemini дешёвый — первый).
function houseProvider() {
  const pref = (process.env.AI_HOUSE_PROVIDER || '').toLowerCase();
  if (pref && AI_PROVIDERS[pref] && houseKeyFor(pref)) return pref;
  for (const id of ['gemini', 'groq', 'anthropic', 'openai']) if (houseKeyFor(id)) return id;
  return null;
}
function houseAvailable() { return !!houseProvider(); }
const PRO_AI_TOKENS_MONTH = Number(process.env.PRO_AI_TOKENS_MONTH) || 1000000; // вкл. в Pro, токенов/мес
function curMonthUTC() { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function aiUsageFile(id) { return path.join(userDataDir(id), 'ai-usage.json'); }
function loadAiUsage(id) {
  let u; try { u = JSON.parse(fs.readFileSync(aiUsageFile(id), 'utf8')); } catch { u = null; }
  const m = curMonthUTC();
  if (!u || u.month !== m) u = { month: m, tokens: 0, requests: 0 }; // авто-сброс на новом месяце
  return u;
}
function bumpAiUsage(id, tokens) {
  const u = loadAiUsage(id);
  u.tokens += Math.max(0, Math.round(Number(tokens) || 0)); u.requests += 1;
  try { fs.mkdirSync(userDataDir(id), { recursive: true }); fs.writeFileSync(aiUsageFile(id), JSON.stringify(u)); } catch {}
  return u;
}
function aiQuota(user) {
  const u = loadAiUsage(user.id), tier = entitlement(user).tier;
  const limit = (tier === 'pro' || tier === 'trial') ? PRO_AI_TOKENS_MONTH : 0;
  return { tier, month: u.month, used: u.tokens, requests: u.requests, limit, remaining: Math.max(0, limit - u.tokens) };
}
// Грубая оценка токенов, если провайдер не вернул usage (≈4 символа/токен).
function estimateTokens(system, messages, out) {
  const chars = String(system || '').length + (messages || []).reduce((s, m) => s + String(m.content || '').length, 0) + String(out || '').length;
  return Math.ceil(chars / 4);
}
// Резолв ключа: { provider, key, source } | { error:'no_key'|'not_pro'|'quota' }
function resolveAiCall(user, requestedProvider, userKeys) {
  if (requestedProvider && userKeys[requestedProvider]) return { provider: requestedProvider, key: userKeys[requestedProvider], source: 'byok' };
  const ownAny = ['gemini', 'groq', 'anthropic', 'openai'].find((id) => userKeys[id]);
  if (ownAny) return { provider: ownAny, key: userKeys[ownAny], source: 'byok' };
  const hp = houseProvider();
  if (!hp) return { error: 'no_key' };
  const q = aiQuota(user);
  if (q.limit <= 0) return { error: 'not_pro' };
  if (q.remaining <= 0) return { error: 'quota', quota: q };
  return { provider: hp, key: houseKeyFor(hp), source: 'house' };
}
// Высокоуровневый вызов для эндпоинтов: резолв → вызов → учёт house-токенов. Возврат aiCompleteMessages + {source,provider} | {error}.
async function aiCallForUser(user, requestedProvider, system, messages, maxTokens) {
  const userKeys = loadAiKeys(user.id);
  const res = resolveAiCall(user, requestedProvider, userKeys);
  if (res.error) return res;
  const r = await aiCompleteMessages(res.provider, { [res.provider]: res.key }, system, messages, maxTokens);
  if (r.ok && res.source === 'house') bumpAiUsage(user.id, r.tokens || estimateTokens(system, messages, r.text));
  return Object.assign({}, r, { source: res.source, provider: res.provider });
}
// Маппинг ошибок aiCallForUser → HTTP-ответ. true = ошибка обработана (вызывающий должен return), false = всё ок.
function aiErr(res, r) {
  if (r.error === 'no_key') { sendJson(res, 400, { error: 'no_key' }); return true; }
  if (r.error === 'not_pro') { sendJson(res, 402, { error: 'not_pro' }); return true; }
  if (r.error === 'quota') { sendJson(res, 402, { error: 'quota', quota: r.quota }); return true; }
  if (!r.ok) { sendJson(res, 502, { error: 'provider', status: r.status, detail: r.detail }); return true; }
  return false;
}
// Единый вызов: системный промпт + история [{role,content}]. Диспатч по форме провайдера.
async function aiCompleteMessages(provider, keys, system, messages, maxTokens) {
  const P = AI_PROVIDERS[provider] || AI_PROVIDERS.anthropic;
  const key = keys[provider];
  if (!key) return { ok: false, noKey: true };
  const norm = messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 8000) }));
  const max = maxTokens || 1500;
  if (P.shape === 'gemini') {
    const contents = norm.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = { contents, generationConfig: { maxOutputTokens: max } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const r = await httpsPostJson(P.host, `/v1beta/models/${P.model}:generateContent?key=${encodeURIComponent(key)}`, {}, body);
    if (r.status !== 200) return { ok: false, status: r.status, detail: (r.json.error && r.json.error.message) || '' };
    const text = (((r.json.candidates || [])[0] || {}).content || {}).parts || [];
    const um = r.json.usageMetadata || {};
    return { ok: true, text: text.map((p) => p.text || '').join(''), tokens: Number(um.totalTokenCount) || 0 };
  }
  if (P.shape === 'anthropic') {
    const r = await httpsPostJson(P.host, '/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      { model: P.model, max_tokens: max, system, messages: norm });
    if (r.status !== 200) return { ok: false, status: r.status, detail: (r.json.error && r.json.error.message) || '' };
    const us = r.json.usage || {};
    return { ok: true, text: (r.json.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n'), tokens: (Number(us.input_tokens) || 0) + (Number(us.output_tokens) || 0) };
  }
  // openai-совместимый (openai, groq)
  const msgs = []; if (system) msgs.push({ role: 'system', content: system }); for (const m of norm) msgs.push(m);
  const r = await httpsPostJson(P.host, P.path, { 'Authorization': 'Bearer ' + key },
    { model: P.model, max_tokens: max, messages: msgs });
  if (r.status !== 200) return { ok: false, status: r.status, detail: (r.json.error && r.json.error.message) || '' };
  const us = r.json.usage || {};
  return { ok: true, text: (r.json.choices && r.json.choices[0] && r.json.choices[0].message && r.json.choices[0].message.content) || '', tokens: Number(us.total_tokens) || ((Number(us.prompt_tokens) || 0) + (Number(us.completion_tokens) || 0)) };
}
// Защищённый разбор JSON из ответа модели: срезаем ```fences``` и прозу вокруг { ... }
function normalizeSmartQuotes(s) {
  // Типографские кавычки ломают JSON.parse (вставляются мессенджерами/некоторыми ИИ-UI при копировании)
  return s.replace(/[“”„‟″‶＂]/g, '"').replace(/[‘’‚‛′‵]/g, "'").replace(/ /g, ' ');
}
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) t = fence[1].trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i < 0 || j < 0 || j < i) return null;
  const slice = t.slice(i, j + 1);
  try { return JSON.parse(slice); } catch {}
  try { return JSON.parse(normalizeSmartQuotes(slice)); } catch { return null; }
}
// Системный промпт: импорт целей/сфер из свободного текста → структурированные предложения
const AI_GOALS_SYS = `Ты — помощник по структурированию жизни в приложении Satoru (философия «жизнь как десятиборье»: у каждого свой набор сфер, целей и регулярных практик). Юзер описывает свободным текстом свои сферы, цели, проекты, задачи. Преврати это в структурированные ПРЕДЛОЖЕНИЯ, которые юзер потом одобрит или отклонит.

Верни СТРОГО JSON вида {"proposals":[ ... ]}, без markdown и без текста вне JSON. Каждый элемент — один из типов:
- {"type":"sphere","name":"...","parent":"<имя родительской сферы или null>"} — новая сфера жизни. Создавай ТОЛЬКО если её ещё нет среди текущих сфер юзера. Допустима иерархия (Учёба→Школа→Биология).
- {"type":"goal","title":"...","sphere":"<имя сферы>","horizon":"mission|vision|path|long|mid|short|recurring","metric":null,"status":"active|waiting|paused","window":"","parent":"<заголовок большей цели или null>"}. Поле metric для ЧИСЛОВЫХ целей = {"current":N,"target":N,"unit":"кг/км/балл","lowerBetter":false,"maintain":false}.

Правила:
- Горизонты: mission = дело жизни (≤1 на всё), vision = 10–20 лет, path = 3–5 лет (универ/карьера), long = цель года, mid = 1–6 мес, short = до месяца, recurring = регулярная практика без конца.
- metric только для измеримого (жим 130→150 кг; оценка 1.5→1.1). Для оценок и времени (где меньше = лучше) ставь "lowerBetter":true. "maintain":true если цель — достичь и удерживать планку.
- "status":"waiting" + "window" (напр. "лето", "после 23.06") для событийных целей вне прямого контроля (медаль зависит от соревнований, поездка от расписания).
- "parent" связывает цель с большей по смыслу (Abi → "Поступить в LMU" → миссия), используя ТОЧНЫЙ заголовок другой цели (существующей или из этого же списка).
- Переиспользуй СУЩЕСТВУЮЩИЕ сферы по точному имени — не дублируй. Будь реалистичен и конкретен, не выдумывай лишнего. Язык — русский.`;
// Системный промпт: сборка старта для НОВИЧКА (онбординг v2). Человек только зарегистрировался,
// у него ноль сфер и пустой экран. Он пишет пару предложений о себе — мы собираем ему рабочий
// старт: сферы + первые квесты на сегодня/завтра. Цели тут НЕ создаём: на первой минуте человек
// ещё не готов формулировать горизонты, а пустой список дел — главный источник «а что тут делать».
const AI_ONBOARD_SYS = `Ты — Тень, спутник новичка в приложении Satoru (философия «жизнь как десятиборье»: ценится баланс многих сфер, а не одна вертикаль). Человек ТОЛЬКО ЧТО зарегистрировался и в двух-трёх предложениях рассказал о себе. Собери ему рабочий старт.

Верни СТРОГО JSON {"proposals":[ ... ]}, без markdown и текста вне JSON. Типы элементов:
- {"type":"sphere","name":"...","parent":null} — сфера жизни человека.
- {"type":"quest","title":"...","sphere":"<имя сферы из этого же списка>","estimateMin":N,"difficulty":"easy|normal|hard","day":"today|tomorrow"} — конкретное дело.

Правила:
- 4–6 сфер. Бери ТОЛЬКО то, что реально следует из его слов (учёба, работа, спорт, творчество, отношения, здоровье…). Не выдумывай сферу, о которой он не упомянул.
- Если из текста не видно ни одной сферы про отдых/восстановление или про отношения — добавь ОДНУ такую: десятиборье без них разваливается, а сам человек про них вспоминает последними.
- 3–5 квестов, из них минимум два с "day":"today" — первый экран не должен быть пустым.
- Первые квесты МАЛЕНЬКИЕ и однозначные: 10–30 минут, "difficulty":"easy" или "normal". Никаких «начать новую жизнь» и «разобраться с учёбой». Человек должен закрыть первый квест сегодня же — это весь смысл.
- Хотя бы один квест — приятный или лёгкий, а не только долг.
- "sphere" у квеста должно ТОЧНО совпадать с "name" одной из предложенных сфер.
- Никаких XP, уровней и игровых терминов в заголовках — это дела из реальной жизни.
- Язык — язык, на котором писал человек.`;
// Системный промпт: калибровка уровня сферы по описанию
const AI_CALIB_SYS = `Ты — калибратор уровней в приложении Satoru. Юзер описывает, чем и насколько уверенно занимается в разных сферах. Оцени уровень по шкале 1–20 (личная RPG-абстракция, НЕ глобальный рейтинг): 1 = только начал; ~5 = регулярная практика, база есть; ~10 = уверенный, могу научить других; ~15 = глубокая экспертиза; 18–20 = топовый/мировой уровень. Для школы/универа опирайся на ступень и оценки честно (отличник старшей школы ≈ 8–11, не 20).

Верни СТРОГО JSON {"proposals":[{"type":"level","sphere":"<имя сферы>","level":N,"note":"<кратко, на чём основана оценка>"}]}, без markdown и текста вне JSON. Только по сферам, о которых юзер дал информацию. Переиспользуй существующие имена сфер. Язык — русский.`;
const AI_DAYLOG_SYS = `Ты — помощник «Итог дня голосом» в Satoru. Юзер НАГОВОРИЛ или написал разговорным текстом, что делал за день. Преврати это в список ВЫПОЛНЕННЫХ за сегодня дел.

Верни СТРОГО JSON {"proposals":[{"type":"done","title":"краткое название дела","sphere":"<точное имя сферы юзера или пустая строка>","minutes":N,"time":"HH:MM или пустая строка"}]}, без markdown и текста вне JSON.

Правила:
- Только ОСМЫСЛЕННЫЕ дела (учёба, тренировка, работа, готовка, уборка, встреча, чтение…). Мелочи (умывание, туалет, перекус, переписка) — ПРОПУСКАЙ, не превращай в дела.
- minutes — оценка длительности в минутах из сказанного; если не названо — оцени реалистично.
- sphere — подбери из СУЩЕСТВУЮЩИХ сфер юзера по точному имени; если не подходит ни одна — пустая строка.
- time — приблизительное начало, если упомянуто («около 3 дня» → "15:00"), иначе пустая строка.
- Не выдумывай дел, которых не было. Язык — русский. Будь краток и точен.`;
// Дерево v3 Фаза 3: картограф персональных вех (TREE-V3-PLAN.md)
const AI_TREEMAP_SYS = `Ты — картограф мастерства в Satoru. Юзер хочет ПЕРСОНАЛЬНУЮ лестницу вех для одной сферы своей жизни — не общий шаблон, а его реальный путь.

Верни СТРОГО JSON {"proposals":[{"title":"веха","desc":"как понять, что взята — одна короткая проверяемая фраза"}]} — от 4 до 6 вех, упорядоченных СТРОГО от ближайшей к вершине.

Правила:
- Веха — ПРОВЕРЯЕМОЕ состояние реальности («Сдал Klausur на 13+», «Пробежал 10 км без остановки», «Первый платящий клиент»), НЕ процесс («заниматься чаще»), НЕ игровая сущность (никаких XP и уровней).
- Строй из того, что юзер написал о себе, и из его целей в контексте: его экзамены, его проекты, его цифры. Уже взятые вехи в контексте показывают, где он СЕЙЧАС — первая новая веха идёт следом за ними.
- ПИК юзера — ЖЁСТКИЙ ПОТОЛОК. Вершина лестницы = ровно его пик, сформулированный проверяемо. НИКОГДА не строй вехи выше пика «для амбициозности»: если пик — «просто пробежать 10 км», карта заканчивается на 10 км и НЕ тянет в полумарафон. У людей разные вершины — «осилить 10 км за жизнь» так же достойно, как ультрамарафон. Если пик уже достигнут — предложи глубину ВНУТРИ пика (темп, стабильность, качество), не новый потолок.
- «СКУЧНО / НЕ ХОЧУ» — жёсткое исключение: ни одной вехи из этих тем и форматов. «НРАВИТСЯ» — предпочтительный материал: где возможно, формулируй вехи через то, что юзеру реально заходит (учить язык через любимые темы, а не через «профессии», если они ему скучны).
- Первая веха достижима из текущего положения за 2–6 недель — она даёт разгон. Вершина — амбиция из его слов (см. правило про пик).
- Названия ≤ 60 знаков, без нумерации. Язык — язык юзера.
- Ноль воды и лозунгов: только формулировки, которые можно проверить фактом.`;
// Каталог бэкапов одного файла данных пользователя
function backupDir(dir, name) { return path.join(dir, '.backups', name); }
// Снимок текущего содержимого файла ПЕРЕД перезаписью.
// Дедуп по СОДЕРЖИМОМУ (а не по времени): пропускаем только если оно идентично последнему снимку.
// Так гарантированно сохраняется каждое уникальное состояние, в т.ч. ДО разрушительной правки.
const BACKUP_KEEP = 50;
function backupFile(dir, name) {
  try {
    const src = path.join(dir, name + '.json');
    if (!fs.existsSync(src)) return; // нечего бэкапить (первая запись файла)
    const cur = fs.readFileSync(src);
    const bdir = backupDir(dir, name);
    fs.mkdirSync(bdir, { recursive: true });
    const existing = fs.readdirSync(bdir).filter((f) => f.endsWith('.json')).sort();
    if (existing.length) {
      try { if (fs.readFileSync(path.join(bdir, existing[existing.length - 1])).equals(cur)) return; } catch {}
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(bdir, stamp + '.json'), cur);
    const all = fs.readdirSync(bdir).filter((f) => f.endsWith('.json')).sort();
    for (const f of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) {
      try { fs.unlinkSync(path.join(bdir, f)); } catch {}
    }
  } catch (e) { console.error('[backup]', name, e.message); }
}
function hashPin(userId, pin) {
  return crypto.createHmac('sha256', SECRET).update(userId + ':' + String(pin)).digest('hex');
}
// ---- Email + пароль (scrypt) + код восстановления (zero-dep, без email-инфры) ----
function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
function hashPw(password, salt) { return crypto.scryptSync(String(password), salt, 64).toString('hex'); }
function verifyPw(password, salt, hash) {
  try { const h = hashPw(password, salt); return h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex')); } catch { return false; }
}
function genRecoveryCode() { return crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{4}/g).join('-'); } // XXXX-XXXX-XXXX-XXXX
function hashCode(code) { return crypto.createHmac('sha256', SECRET).update(String(code).replace(/[\s-]/g, '').toUpperCase()).digest('hex'); }
function setEmailPassword(user, email, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  user.email = normEmail(email); user.pwSalt = salt; user.pwHash = hashPw(password, salt);
  const code = genRecoveryCode(); user.recoveryHash = hashCode(code);
  return code; // вернуть открытый код ОДИН раз
}

// ---- Подписка / entitlement (Pro + 7-дневный триал) ----
const TRIAL_MS = 7 * 24 * 3600 * 1000;
function entitlement(user) {
  const now = Date.now();
  // Админ всегда Pro — создатель должен видеть весь продукт (fb: «у меня про, но аналитика недоступна»)
  if (user.isAdmin) return { tier: 'pro', proUntil: null, trialUsed: true };
  // Явный Pro (оплачен или выдан админом); proUntil=null => бессрочно
  if (user.plan === 'pro' && (!user.proUntil || new Date(user.proUntil).getTime() > now)) {
    return { tier: 'pro', proUntil: user.proUntil || null, trialUsed: !!user.trialStartedAt };
  }
  // Активный триал
  if (user.trialStartedAt) {
    const ends = new Date(user.trialStartedAt).getTime() + TRIAL_MS;
    if (ends > now) return { tier: 'trial', trialEndsAt: new Date(ends).toISOString(), trialUsed: true };
    return { tier: 'free', trialUsed: true };
  }
  return { tier: 'free', trialUsed: false };
}
function publicUser(user) {
  return { id: user.id, name: user.name, avatar: user.avatar, isAdmin: !!user.isAdmin, email: user.email || null, hasPin: !!user.pinHash, entitlement: entitlement(user) };
}

// ============================================================
//  Sessions — HMAC-signed cookie  userId.expires.signature
// ============================================================
const SESSION_COOKIE = 'lrpg_sess';
const SESSION_AGE_MS = 30 * 24 * 3600 * 1000; // 30 дней

function makeSession(userId) {
  const exp = Date.now() + SESSION_AGE_MS;
  const payload = userId + '.' + exp;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return payload + '.' + sig;
}
function verifySession(token) {
  if (!token) return null;
  const last = token.lastIndexOf('.');
  if (last < 0) return null;
  const payload = token.slice(0, last), sig = token.slice(last + 1);
  try {
    const exp = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (sig.length !== exp.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(exp, 'hex'))) return null;
  } catch { return null; }
  const dot = payload.indexOf('.');
  const uid = payload.slice(0, dot), expires = Number(payload.slice(dot + 1));
  if (!uid || isNaN(expires) || Date.now() > expires) return null;
  return uid;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function sessionUserId(req) { return verifySession(parseCookies(req)[SESSION_COOKIE]); }
function setCookieHeader(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_AGE_MS / 1000)}`;
}
function clearCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

// ============================================================
//  Migration: root data/*.json  →  data/users/albert/*.json
//  Runs once, only if no users.json exists yet.
// ============================================================
function migrateIfNeeded() {
  if (loadUsers().length > 0) return;
  const hasRoot = USER_DATA_FILES.some(f => fs.existsSync(path.join(DATA_DIR, f + '.json')));
  if (!hasRoot) return;

  console.log('  🔄  Мигрируем существующие данные → профиль "albert"...');
  const id = 'albert';
  const dir = userDataDir(id);
  fs.mkdirSync(dir, { recursive: true });

  for (const f of USER_DATA_FILES) {
    const src = path.join(DATA_DIR, f + '.json');
    const dst = path.join(dir, f + '.json');
    if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }

  const defaultPin = '1234';
  saveUsers([{
    id, name: 'Albert', avatar: '⚔️',
    pinHash: hashPin(id, defaultPin),
    createdAt: new Date().toISOString(), isAdmin: true,
  }]);
  console.log(`  👤  Профиль "Albert" создан. PIN по умолчанию: ${defaultPin} — смени в настройках!`);
}

// ============================================================
//  Startup
// ============================================================
fs.mkdirSync(DATA_DIR, { recursive: true });
SECRET = loadSecret();
migrateIfNeeded();

// ============================================================
//  GitHub Issues integration — forward feedback to issues tracker
// ============================================================
async function createGithubIssue(entry) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return; // молча пропускаем если не настроен
  const repo = process.env.GITHUB_REPO || 'HAZYAIN3301/life-rpg';
  const [owner, repoName] = repo.split('/');
  const KIND_EMOJI = { bug: '🐛', idea: '💡', praise: '💛', other: '📝' };
  const KIND_LABEL = { bug: 'bug', idea: 'enhancement', praise: 'praise', other: 'feedback' };
  const short = entry.text.slice(0, 70) + (entry.text.length > 70 ? '…' : '');
  const title = `${KIND_EMOJI[entry.kind] || '📝'} [${entry.kind}] ${short}`;
  const bodyLines = [
    `**От:** \`${entry.userId}\` · **${entry.at.slice(0, 16).replace('T', ' ')} UTC**`,
    '',
    entry.text,
  ];
  if (entry.attachments && entry.attachments.length) {
    bodyLines.push('', `---`, `📎 Вложений: ${entry.attachments.length}`);
  }
  const payload = JSON.stringify({
    title,
    body: bodyLines.join('\n'),
    labels: [KIND_LABEL[entry.kind] || 'feedback'],
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com',
      method: 'POST',
      path: `/repos/${owner}/${repoName}/issues`,
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'gojo-app',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (r) => { r.resume(); resolve(); });
    req.on('error', (e) => { console.error('[github-issue]', e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

// ============================================================
//  Strava integration (OAuth2) — авто-импорт тренировок в сферу здоровья/спорта.
//  Токены per-user в data/users/<id>/strava.json (секрет, под гитигнором — как ai-keys).
//  Session-cookie у нас SameSite=Strict → на редиректе-возврате со strava.com он НЕ
//  передаётся. Поэтому личность юзера едет в подписанном коротко-живущем `state`.
// ============================================================
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '';
function stravaConfigured() { return !!(STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET); }
function stravaFile(id) { return path.join(userDataDir(id), 'strava.json'); }
function loadStrava(id) { try { return JSON.parse(fs.readFileSync(stravaFile(id), 'utf8')); } catch { return null; } }
function saveStrava(id, obj) { try { fs.mkdirSync(userDataDir(id), { recursive: true }); fs.writeFileSync(stravaFile(id), JSON.stringify(obj)); return true; } catch { return false; } }
function clearStrava(id) { try { fs.unlinkSync(stravaFile(id)); } catch {} }

// Базовый URL для OAuth-redirect: явный env > заголовки прокси (Railway шлёт x-forwarded-*).
function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}
// Коротко-живущий подписанный state (uid + срок). Namespace 'oauth' — чтобы его нельзя было
// подсунуть как session-токен и наоборот. base64url для безопасной передачи в URL.
function makeOauthState(uid) {
  const payload = 'oauth.' + uid + '.' + (Date.now() + 15 * 60 * 1000);
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload + '.' + sig).toString('base64url');
}
function verifyOauthState(token) {
  let raw; try { raw = Buffer.from(String(token || ''), 'base64url').toString('utf8'); } catch { return null; }
  const parts = raw.split('.');
  if (parts.length !== 4 || parts[0] !== 'oauth') return null;
  const [, uid, exp, sig] = parts;
  const want = crypto.createHmac('sha256', SECRET).update(`oauth.${uid}.${exp}`).digest('hex');
  if (sig.length !== want.length) return null;
  try { if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(want, 'hex'))) return null; } catch { return null; }
  if (Date.now() > Number(exp)) return null;
  return uid;
}
// POST x-www-form-urlencoded к Strava /oauth/token (обмен кода / рефреш). → { status, json }
function stravaTokenRequest(params) {
  return new Promise((resolve) => {
    const body = Buffer.from(new URLSearchParams(params).toString());
    const r = https.request({ host: 'www.strava.com', path: '/oauth/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length } }, (resp) => {
      let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => { let j = {}; try { j = JSON.parse(d || '{}'); } catch {} resolve({ status: resp.statusCode, json: j }); });
    });
    r.on('error', (e) => resolve({ status: 0, json: { error: String(e.message || e) } }));
    r.write(body); r.end();
  });
}
// GET к Strava API с bearer-токеном. → { status, json }
function stravaApiGet(pathName, token) {
  return new Promise((resolve) => {
    const r = https.request({ host: 'www.strava.com', path: pathName, method: 'GET', headers: { 'Authorization': 'Bearer ' + token } }, (resp) => {
      let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => { let j = null; try { j = JSON.parse(d || 'null'); } catch {} resolve({ status: resp.statusCode, json: j }); });
    });
    r.on('error', (e) => resolve({ status: 0, json: { error: String(e.message || e) } }));
    r.end();
  });
}
// Best-effort отзыв доступа (при «Отключить»).
function stravaDeauthorize(token) {
  return new Promise((resolve) => {
    const r = https.request({ host: 'www.strava.com', path: '/oauth/deauthorize', method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Length': 0 } }, (resp) => { resp.resume(); resp.on('end', resolve); });
    r.on('error', () => resolve()); r.end();
  });
}
// Гарантирует свежий access-токен (рефреш, если истекает в ближайшие 5 мин). Мутирует+пишет strava.json.
async function stravaFreshToken(uid, st) {
  if (!st || !st.refreshToken) return null;
  const now = Math.floor(Date.now() / 1000);
  if (st.accessToken && st.expiresAt && st.expiresAt - now > 300) return st.accessToken;
  const r = await stravaTokenRequest({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: st.refreshToken });
  if (r.status !== 200 || !r.json.access_token) return null;
  st.accessToken = r.json.access_token;
  st.refreshToken = r.json.refresh_token || st.refreshToken;
  st.expiresAt = r.json.expires_at;
  saveStrava(uid, st);
  return st.accessToken;
}
// Эмодзи по виду активности (sport_type приоритетнее устаревшего type).
const STRAVA_TYPE_EMOJI = { Run: '🏃', TrailRun: '🏃', Ride: '🚴', VirtualRide: '🚴', MountainBikeRide: '🚵', Swim: '🏊', Walk: '🚶', Hike: '🥾', WeightTraining: '🏋️', Workout: '💪', Yoga: '🧘', Crossfit: '🏋️', Rowing: '🚣', Elliptical: '🌀', StairStepper: '🪜', AlpineSki: '⛷️', BackcountrySki: '🎿', NordicSki: '🎿', Snowboard: '🏂', IceSkate: '⛸️', Soccer: '⚽', Tennis: '🎾', Golf: '⛳', Badminton: '🏸', Pickleball: '🥒', TableTennis: '🏓', Pilates: '🧘', Skateboard: '🛹', Surfing: '🏄', Kayaking: '🛶', Velomobile: '🚴', Handcycle: '🦽', Wheelchair: '🦽' };
// Strava-активность → лёгкий объект импорта. Клиент превращает его в выполненный квест + XP.
function mapStravaActivity(a) {
  const sport = a.sport_type || a.type || 'Workout';
  const emoji = STRAVA_TYPE_EMOJI[sport] || STRAVA_TYPE_EMOJI[a.type] || '🏅';
  const min = Math.max(1, Math.round((a.moving_time || a.elapsed_time || 0) / 60));
  const km = a.distance ? Math.round(a.distance / 100) / 10 : 0;
  let title = `${emoji} ${a.name || sport}`;
  if (km >= 0.1) title += ` · ${km} км`;
  return { stravaId: String(a.id), title, sport, minutes: min, distanceKm: km, startDate: a.start_date_local || a.start_date || null };
}

// ============================================================
//  HTTP server
// ============================================================
const server = http.createServer(async (req, res) => {
  const u = req.url || '/';
  if (req.method === 'OPTIONS') return send(res, 204, '');

  // ---- Auth API ----
  if (u.startsWith('/api/auth/')) {
    let body = {};
    if (req.method === 'POST') {
      const raw = await readBody(req);
      if (raw) { try { body = JSON.parse(raw); } catch { return sendJson(res, 400, { error: 'bad json' }); } }
    }

    // GET /api/auth/me
    if (u === '/api/auth/me' && req.method === 'GET') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const user = loadUsers().find(x => x.id === uid);
      if (!user) return sendJson(res, 401, { error: 'user not found' });
      return sendJson(res, 200, publicUser(user));
    }

    // GET /api/auth/profiles — публичный список (только legacy-киоск без email; email-аккаунты приватны)
    if (u === '/api/auth/profiles' && req.method === 'GET') {
      return sendJson(res, 200, loadUsers().filter(x => !x.email).map(x => ({ id: x.id, name: x.name, avatar: x.avatar })));
    }

    // POST /api/auth/login — email+пароль (новое) ИЛИ userId+PIN (legacy)
    if (u === '/api/auth/login' && req.method === 'POST') {
      const { userId, pin, email, password } = body;
      let user = null;
      if (email && password !== undefined) {
        user = loadUsers().find(x => x.email && x.email === normEmail(email));
        if (!user || !user.pwHash || !verifyPw(password, user.pwSalt, user.pwHash)) return sendJson(res, 401, { error: 'неверный email или пароль' });
      } else {
        if (!userId || pin === undefined) return sendJson(res, 400, { error: 'нужен email+пароль или профиль+PIN' });
        user = loadUsers().find(x => x.id === userId);
        if (!user || !user.pinHash || user.pinHash !== hashPin(userId, String(pin))) return sendJson(res, 401, { error: 'неверный PIN' });
      }
      const token = makeSession(user.id);
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Set-Cookie': setCookieHeader(token), 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(Object.assign({ ok: true }, publicUser(user))));
    }

    // POST /api/auth/reset — сброс пароля по коду восстановления (без email-инфры)
    if (u === '/api/auth/reset' && req.method === 'POST') {
      const { email, code, newPassword } = body;
      if (!email || !code || !newPassword) return sendJson(res, 400, { error: 'email, код и новый пароль обязательны' });
      if (String(newPassword).length < 6) return sendJson(res, 400, { error: 'пароль минимум 6 символов' });
      const users = loadUsers();
      const user = users.find(x => x.email && x.email === normEmail(email));
      if (!user || !user.recoveryHash) return sendJson(res, 401, { error: 'аккаунт не найден' });
      const given = hashCode(code);
      if (given.length !== user.recoveryHash.length || !crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(user.recoveryHash, 'hex'))) return sendJson(res, 401, { error: 'неверный код восстановления' });
      const newCode = setEmailPassword(user, user.email, newPassword); // новый пароль + ротация кода
      saveUsers(users);
      const token = makeSession(user.id);
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Set-Cookie': setCookieHeader(token), 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(Object.assign({ ok: true, recoveryCode: newCode }, publicUser(user))));
    }

    // POST /api/auth/add-email — существующий (PIN) аккаунт добавляет email+пароль
    if (u === '/api/auth/add-email' && req.method === 'POST') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const { email, password } = body;
      if (!email || !password) return sendJson(res, 400, { error: 'email и пароль обязательны' });
      if (!validEmail(email)) return sendJson(res, 400, { error: 'некорректный email' });
      if (String(password).length < 6) return sendJson(res, 400, { error: 'пароль минимум 6 символов' });
      const users = loadUsers();
      if (users.find(x => x.email === normEmail(email) && x.id !== uid)) return sendJson(res, 400, { error: 'этот email уже занят' });
      const user = users.find(x => x.id === uid);
      if (!user) return sendJson(res, 401, { error: 'user not found' });
      const code = setEmailPassword(user, email, password);
      saveUsers(users);
      return sendJson(res, 200, { ok: true, recoveryCode: code, email: user.email });
    }

    // POST /api/auth/register — поддерживает email+пароль (новое) ИЛИ PIN (legacy-киоск)
    if (u === '/api/auth/register' && req.method === 'POST') {
      const { name, pin, email, password } = body;
      const hasPin = pin !== undefined && pin !== '';
      const hasEmail = email && password;
      if (!name) return sendJson(res, 400, { error: 'имя обязательно' });
      if (!hasPin && !hasEmail) return sendJson(res, 400, { error: 'нужен email+пароль или PIN' });
      if (hasPin && String(pin).length < 4) return sendJson(res, 400, { error: 'PIN минимум 4 символа' });
      const users = loadUsers();
      if (hasEmail) {
        if (!validEmail(email)) return sendJson(res, 400, { error: 'некорректный email' });
        if (String(password).length < 6) return sendJson(res, 400, { error: 'пароль минимум 6 символов' });
        if (users.find(x => x.email === normEmail(email))) return sendJson(res, 400, { error: 'этот email уже зарегистрирован' });
      }
      let id = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
      if (!id) id = 'user';
      while (users.find(x => x.id === id)) id += Math.floor(Math.random() * 9 + 1);
      if (!safeId(id)) id = 'u' + crypto.randomBytes(4).toString('hex');
      const user = {
        id, name: String(name).slice(0, 32),
        avatar: body.avatar || '⚡',
        createdAt: new Date().toISOString(),
        isAdmin: users.length === 0,
        // Триал стартует СРАЗУ при регистрации, а не по кнопке. Причина: без него новый юзер —
        // free с нулевой ИИ-квотой, то есть весь слой Джарвиса (чат, знающий его состояние,
        // сборка старта, личная карта) для него невидим, и приложение встречает пустым экраном
        // и вопросом «а что тут делать». Ровно тот порог, ради снятия которого Джарвис и строился.
        plan: 'free', trialStartedAt: new Date().toISOString(), proUntil: null,
      };
      if (hasPin) user.pinHash = hashPin(id, String(pin));
      let recoveryCode = null;
      if (hasEmail) recoveryCode = setEmailPassword(user, email, password);
      fs.mkdirSync(userDataDir(id), { recursive: true });
      users.push(user);
      saveUsers(users);
      const token = makeSession(id);
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Set-Cookie': setCookieHeader(token), 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(Object.assign({ ok: true, recoveryCode }, publicUser(user))));
    }

    // POST /api/auth/logout
    if (u === '/api/auth/logout' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Set-Cookie': clearCookieHeader(), 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // POST /api/auth/change-pin
    if (u === '/api/auth/change-pin' && req.method === 'POST') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const { oldPin, newPin } = body;
      const users = loadUsers();
      const user = users.find(x => x.id === uid);
      if (!user) return sendJson(res, 401, { error: 'user not found' });
      if (user.pinHash !== hashPin(uid, String(oldPin))) return sendJson(res, 401, { error: 'неверный текущий PIN' });
      if (String(newPin).length < 4) return sendJson(res, 400, { error: 'PIN минимум 4 символа' });
      user.pinHash = hashPin(uid, String(newPin));
      saveUsers(users);
      return sendJson(res, 200, { ok: true });
    }

    // POST /api/auth/update-profile
    if (u === '/api/auth/update-profile' && req.method === 'POST') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const users = loadUsers();
      const user = users.find(x => x.id === uid);
      if (!user) return sendJson(res, 401, { error: 'user not found' });
      if (body.name) user.name = String(body.name).slice(0, 32);
      if (body.avatar) user.avatar = String(body.avatar).slice(0, 4);
      saveUsers(users);
      return sendJson(res, 200, publicUser(user));
    }

    // POST /api/auth/start-trial — активировать 7-дневный Pro-триал (один раз на аккаунт)
    if (u === '/api/auth/start-trial' && req.method === 'POST') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const users = loadUsers();
      const user = users.find(x => x.id === uid);
      if (!user) return sendJson(res, 401, { error: 'user not found' });
      if (user.trialStartedAt) return sendJson(res, 400, { error: 'триал уже был использован' });
      if (user.plan === 'pro') return sendJson(res, 400, { error: 'у тебя уже Pro' });
      user.trialStartedAt = new Date().toISOString();
      saveUsers(users);
      return sendJson(res, 200, publicUser(user));
    }

    // POST /api/auth/grant-pro — выдать Pro (только админ; для комплимента друзьям)
    // body: { userId, days? }  days отсутствует => бессрочно
    if (u === '/api/auth/grant-pro' && req.method === 'POST') {
      const uid = sessionUserId(req);
      const users = loadUsers();
      const me = users.find(x => x.id === uid);
      if (!me || !me.isAdmin) return sendJson(res, 403, { error: 'только админ' });
      const target = users.find(x => x.id === body.userId);
      if (!target) return sendJson(res, 404, { error: 'профиль не найден' });
      target.plan = 'pro';
      target.proUntil = body.days ? new Date(Date.now() + Number(body.days) * 24 * 3600 * 1000).toISOString() : null;
      saveUsers(users);
      return sendJson(res, 200, publicUser(target));
    }

    // POST /api/auth/revoke-pro — снять Pro (только админ)
    if (u === '/api/auth/revoke-pro' && req.method === 'POST') {
      const uid = sessionUserId(req);
      const users = loadUsers();
      const me = users.find(x => x.id === uid);
      if (!me || !me.isAdmin) return sendJson(res, 403, { error: 'только админ' });
      const target = users.find(x => x.id === body.userId);
      if (!target) return sendJson(res, 404, { error: 'профиль не найден' });
      target.plan = 'free'; target.proUntil = null;
      saveUsers(users);
      return sendJson(res, 200, publicUser(target));
    }

    // POST /api/auth/upgrade — заглушка оплаты (реальные платежи — перед публичным запуском)
    if (u === '/api/auth/upgrade' && req.method === 'POST') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      return sendJson(res, 200, { ok: false, comingSoon: true, message: 'Оплата скоро будет доступна. Пока активируй 7-дневный триал, а для постоянного Pro попроси админа.' });
    }

    // POST /api/auth/delete-account — удалить аккаунт и все данные (DSGVO/GDPR)
    if (u === '/api/auth/delete-account' && req.method === 'POST') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const { password, pin } = body;
      const users = loadUsers();
      const user = users.find(x => x.id === uid);
      if (!user) return sendJson(res, 401, { error: 'пользователь не найден' });
      // Verify identity before deleting
      if (user.pwHash) {
        if (!password) return sendJson(res, 400, { error: 'нужен пароль для подтверждения' });
        if (!verifyPw(password, user.pwSalt, user.pwHash)) return sendJson(res, 401, { error: 'неверный пароль' });
      } else if (user.pinHash) {
        if (!pin) return sendJson(res, 400, { error: 'нужен PIN для подтверждения' });
        if (user.pinHash !== hashPin(uid, String(pin))) return sendJson(res, 401, { error: 'неверный PIN' });
      }
      // Delete all user data files
      try { fs.rmSync(userDataDir(uid), { recursive: true, force: true }); } catch {}
      // Remove from users registry
      saveUsers(users.filter(x => x.id !== uid));
      // Clear session cookie
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Set-Cookie': clearCookieHeader(), 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // POST /api/auth/cal-secret — создать/получить секрет для ICS-фида
    if (u === '/api/auth/cal-secret' && req.method === 'POST') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const users = loadUsers();
      const user = users.find(x => x.id === uid);
      if (!user) return sendJson(res, 401, { error: 'not found' });
      if (!user.calSecret) {
        user.calSecret = crypto.randomBytes(24).toString('hex');
        saveUsers(users);
      }
      return sendJson(res, 200, { secret: user.calSecret, userId: uid });
    }

    return sendJson(res, 404, { error: 'not found' });
  }

  // ---- Apple Calendar ICS feed (public URL with secret token) ----
  const calMatch = u.match(/^\/api\/cal\/([^/]+)\/([^/]+)$/);
  if (calMatch && req.method === 'GET') {
    const [, userId, secret] = calMatch;
    const users = loadUsers();
    const user = users.find(x => x.id === userId);
    if (!user || user.calSecret !== secret) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Forbidden');
    }
    // Load tasks for this user
    let tasks = [];
    try { tasks = JSON.parse(fs.readFileSync(path.join(userDataDir(userId), 'tasks.json'), 'utf8')); } catch {}
    const fmtDt = (dateStr, timeStr) => {
      // dateStr = YYYY-MM-DD, timeStr = HH:MM or null
      if (timeStr) {
        const [h, m] = timeStr.split(':');
        return `${dateStr.replace(/-/g, '')}T${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}00`;
      }
      return dateStr.replace(/-/g, '');
    };
    const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace(/Z$/, '');
    const veventList = tasks.filter(t => t.date).map(t => {
      const dtStart = fmtDt(t.date, t.startTime || null);
      const isAllDay = !t.startTime;
      const dtEnd = isAllDay ? fmtDt(t.date, null) : (() => {
        const dur = Number(t.estimateMin) || 30;
        const [h, m] = (t.startTime || '09:00').split(':').map(Number);
        const totalMin = h * 60 + m + dur;
        return `${t.date.replace(/-/g, '')}T${String(Math.floor(totalMin/60)).padStart(2,'0')}${String(totalMin%60).padStart(2,'0')}00`;
      })();
      const status = t.done ? 'COMPLETED' : 'CONFIRMED';
      const lines = [
        'BEGIN:VEVENT',
        `UID:satoru-${esc(t.id)}@satoru`,
        `DTSTAMP:${now}Z`,
        isAllDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
        isAllDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`,
        `SUMMARY:${esc(t.title)}`,
        `STATUS:${status}`,
        t.done ? `COMPLETED:${now}Z` : '',
      ].filter(Boolean);
      return lines.join('\r\n') + '\r\nEND:VEVENT';
    }).join('\r\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Satoru//Life RPG//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:Satoru — ${esc(user.name || 'Квесты')}`,
      veventList,
      'END:VCALENDAR',
    ].join('\r\n');
    res.writeHead(200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="satoru.ics"',
      'Cache-Control': 'no-cache',
    });
    return res.end(ics);
  }

  // ---- Public users list (for leaderboard) — requires session ----
  if (u === '/api/users' && req.method === 'GET') {
    if (!sessionUserId(req)) return sendJson(res, 401, { error: 'not logged in' });
    return sendJson(res, 200, loadUsers().map(x => ({ id: x.id, name: x.name, avatar: x.avatar })));
  }

  // ---- Feedback (баги/идеи/предложения + фото/видео) → data/feedback.json + data/feedback/ ----
  if (u === '/api/feedback' && req.method === 'POST') {
    const uid = sessionUserId(req);
    if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    // Клиент разрешает видео до 25 МБ бинарных — в base64 это ≈33.3 МБ (+33%), плюс JSON-обёртка
    // и возможно несколько файлов сразу. Старый лимит 30 МБ резал ровно те видео, что клиент считал
    // допустимыми («функция прикрепления медиа перестала работать» — размер у границы).
    let fb = {}; try { fb = JSON.parse(await readBody(req, 46 * 1024 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json / слишком большой файл' }); }
    const text = String(fb.text || '').slice(0, 4000).trim();
    if (!text && !(fb.attachments && fb.attachments.length)) return sendJson(res, 400, { error: 'пусто' });
    const id = 'fb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const fdir = path.join(DATA_DIR, 'feedback');
    const attachments = [];
    for (const [i, a] of (Array.isArray(fb.attachments) ? fb.attachments : []).slice(0, 6).entries()) {
      const m = /^data:(.*);base64,(.+)$/.exec(a && a.dataUrl || '');
      if (!m) continue;
      const mime = m[1].split(';')[0].trim(), ext = FB_EXT[mime]; if (!ext) continue;
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 26 * 1024 * 1024) continue;
      const fname = `${id}_${i}.${ext}`;
      try { fs.mkdirSync(fdir, { recursive: true }); fs.writeFileSync(path.join(fdir, fname), buf); attachments.push({ file: fname, type: mime, name: String(a.name || '').slice(0, 80) }); } catch {}
    }
    const file = path.join(DATA_DIR, 'feedback.json');
    let list = []; try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    list.push({ id, at: new Date().toISOString(), userId: uid, kind: String(fb.kind || 'other').slice(0, 20), text, attachments });
    try {
      const data = JSON.stringify(list, null, 2);
      // Атомарная запись (temp → rename): сбой при записи не оставит обрезанный/пустой файл.
      const tmp = file + '.tmp'; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file);
      // Ежедневный бэкап (раз в день): репорты Альберта — это и идеи, терять нельзя; удаление только по команде.
      try { const bdir = path.join(DATA_DIR, 'feedback-backups'); fs.mkdirSync(bdir, { recursive: true });
        const bfile = path.join(bdir, `feedback-${new Date().toISOString().slice(0, 10)}.json`);
        if (!fs.existsSync(bfile)) fs.writeFileSync(bfile, data); } catch {}
    } catch (e) { return sendJson(res, 500, { error: 'save failed' }); }
    createGithubIssue(list[list.length - 1]).catch(() => {}); // fire-and-forget
    return sendJson(res, 200, { ok: true, attachments: attachments.length });
  }
  // ---- Мои репорты: счётчик для ачивок («Баг-хантер», «Страж Врат») ----
  if (u === '/api/feedback/mine' && req.method === 'GET') {
    const uid = sessionUserId(req);
    if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let list = []; try { list = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'feedback.json'), 'utf8')); } catch {}
    return sendJson(res, 200, { count: list.filter(x => x.userId === uid).length });
  }
  // ---- Аналитика активности (#4): приватный агрегат, БЕЗ личного контента ----
  // Клиент шлёт только имя события (view:today, complete:quest…). Храним счётчики по дням + DAU.
  if (u === '/api/analytics' && req.method === 'POST') {
    const uid = sessionUserId(req);
    if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let body = {}; try { body = JSON.parse(await readBody(req, 8 * 1024)); } catch {}
    const ev = String(body.event || '').slice(0, 40).replace(/[^\w:.-]/g, '');
    if (!ev) return sendJson(res, 400, { error: 'no event' });
    const file = path.join(DATA_DIR, 'analytics.json');
    let data = {}; try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    const day = new Date().toISOString().slice(0, 10);
    const d = data[day] || (data[day] = { events: {}, users: {} });
    d.events[ev] = (d.events[ev] || 0) + 1;
    d.users[uid] = (d.users[uid] || 0) + 1;
    // держим только последние ~60 дней
    const days = Object.keys(data).sort();
    while (days.length > 60) { delete data[days.shift()]; }
    try { fs.writeFileSync(file, JSON.stringify(data)); } catch {}
    return sendJson(res, 200, { ok: true });
  }
  if (u === '/api/admin/analytics' && req.method === 'GET') {
    const me = loadUsers().find(x => x.id === sessionUserId(req));
    if (!me || !me.isAdmin) return sendJson(res, 403, { error: 'только админ' });
    let data = {}; try { data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'analytics.json'), 'utf8')); } catch {}
    return sendJson(res, 200, data);
  }
  // ---- Экспорт feedback.json (скачать, только админ) ----
  if (u === '/api/feedback/export' && req.method === 'GET') {
    const me = loadUsers().find(x => x.id === sessionUserId(req));
    if (!me || !me.isAdmin) return sendJson(res, 403, { error: 'только админ' });
    let list = []; try { list = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'feedback.json'), 'utf8')); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="gojo-feedback.json"' });
    res.end(JSON.stringify(list, null, 2));
    return;
  }
  // ---- Список репортов (только админ) ----
  if (u === '/api/feedback' && req.method === 'GET') {
    const me = loadUsers().find(x => x.id === sessionUserId(req));
    if (!me || !me.isAdmin) return sendJson(res, 403, { error: 'только админ' });
    let list = []; try { list = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'feedback.json'), 'utf8')); } catch {}
    return sendJson(res, 200, list.slice().reverse());
  }
  // ---- Файл-вложение репорта (только админ) ----
  {
    const fm = u.match(/^\/api\/feedback\/file\/([A-Za-z0-9_.-]+)$/);
    if (fm && req.method === 'GET') {
      const me = loadUsers().find(x => x.id === sessionUserId(req));
      if (!me || !me.isAdmin) return sendJson(res, 403, { error: 'только админ' });
      const name = fm[1];
      if (name.includes('..')) return sendJson(res, 400, { error: 'bad name' });
      const fp = path.join(DATA_DIR, 'feedback', name);
      const ext = path.extname(fp).toLowerCase();
      fs.readFile(fp, (err, buf) => err ? send(res, 404, 'Not found') : send(res, 200, buf, { 'Content-Type': MIME[ext] || 'application/octet-stream' }));
      return;
    }
  }

  // ---- Инбокс: медиа быстрых заметок (голос/видео) — per-user в data/users/<id>/inbox/ ----
  // audio/webm и video/webm раньше делили расширение .webm → GET всегда отдавал video/webm content-type,
  // даже для голосовых заметок. Safari/iOS строго проверяет MIME для <audio> и отказывался играть файл
  // (fb: «функция прикрепления медиа перестала работать»). Разводим расширения — .weba для аудио.
  const INBOX_EXT = { 'audio/webm': 'weba', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'video/webm': 'webm', 'video/mp4': 'mp4' };
  const INBOX_MIME = { weba: 'audio/webm', webm: 'video/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', mp4: 'video/mp4' };
  if (u === '/api/inbox/media' && req.method === 'POST') {
    const uid = sessionUserId(req);
    if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req, 40 * 1024 * 1024)); } catch { return sendJson(res, 400, { error: 'too large / bad json' }); }
    // mm[1] = полный media-type. Видео-MediaRecorder даёт ;codecs=vp8,opus (с ЗАПЯТОЙ!) — нельзя [^,]; жадно до ;base64,
    const mm = /^data:(.*);base64,(.+)$/.exec(b.dataUrl || '');
    if (!mm) return sendJson(res, 400, { error: 'bad dataUrl' });
    const mime = mm[1].split(';')[0].trim(), ext = INBOX_EXT[mime];
    if (!ext) return sendJson(res, 400, { error: 'unsupported type' });
    const buf = Buffer.from(mm[2], 'base64');
    if (buf.length > 35 * 1024 * 1024) return sendJson(res, 400, { error: 'file too big' });
    const dir = path.join(userDataDir(uid), 'inbox');
    const fname = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.' + ext;
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, fname), buf); } catch (e) { return sendJson(res, 500, { error: 'save failed' }); }
    return sendJson(res, 200, { ok: true, file: fname, type: mime });
  }
  {
    const im = u.match(/^\/api\/inbox\/media\/([A-Za-z0-9_.-]+)$/);
    if (im && req.method === 'GET') {
      const uid = sessionUserId(req);
      if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const name = im[1];
      if (name.includes('..')) return sendJson(res, 400, { error: 'bad name' });
      const fp = path.join(userDataDir(uid), 'inbox', name);
      const ext = path.extname(fp).slice(1).toLowerCase();
      fs.readFile(fp, (err, buf) => err ? send(res, 404, 'Not found') : send(res, 200, buf, { 'Content-Type': INBOX_MIME[ext] || 'application/octet-stream' }));
      return;
    }
  }

  // ---- ИИ-ассистент (BYOK — «принеси свой ключ»). Ключ хранится ТОЛЬКО на сервере (data/users/<id>/, в гитигноре), наружу — лишь признак наличия. ----
  if (u === '/api/ai/keys' && req.method === 'POST') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req, 64 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const cur = loadAiKeys(uid);
    for (const id of Object.keys(AI_PROVIDERS)) {
      if (typeof b[id] === 'string') { const v = b[id].trim(); if (v) cur[id] = v; else delete cur[id]; }
    }
    try { fs.mkdirSync(userDataDir(uid), { recursive: true }); fs.writeFileSync(aiKeysFile(uid), JSON.stringify(cur)); } catch { return sendJson(res, 500, { error: 'save failed' }); }
    const out = { ok: true }; for (const id of Object.keys(AI_PROVIDERS)) out[id] = !!cur[id]; return sendJson(res, 200, out);
  }
  if (u === '/api/ai/keys' && req.method === 'GET') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    const user = loadUsers().find(x => x.id === uid); if (!user) return sendJson(res, 401, { error: 'user not found' });
    const k = loadAiKeys(uid); const out = { houseAvailable: houseAvailable() }; for (const id of Object.keys(AI_PROVIDERS)) out[id] = !!k[id];
    out.quota = aiQuota(user); // { tier, used, limit, remaining, ... }
    return sendJson(res, 200, out);
  }
  // GET /api/ai/usage — расход токенов на дом.ключе за месяц + лимит Pro
  if (u === '/api/ai/usage' && req.method === 'GET') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    const user = loadUsers().find(x => x.id === uid); if (!user) return sendJson(res, 401, { error: 'user not found' });
    return sendJson(res, 200, Object.assign({ houseAvailable: houseAvailable() }, aiQuota(user)));
  }
  if (u === '/api/ai/analyze' && req.method === 'POST') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    const user = loadUsers().find(x => x.id === uid); if (!user) return sendJson(res, 401, { error: 'user not found' });
    let b = {}; try { b = JSON.parse(await readBody(req, 256 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const provider = AI_PROVIDERS[b.provider] ? b.provider : null;
    const system = String(b.system || '').slice(0, 8000);
    const prompt = String(b.prompt || '').slice(0, 100000);
    if (!prompt) return sendJson(res, 400, { error: 'empty prompt' });
    try {
      const r = await aiCallForUser(user, provider, system, [{ role: 'user', content: prompt }], 2000);
      if (aiErr(res, r)) return;
      return sendJson(res, 200, { text: r.text, source: r.source });
    } catch (e) { return sendJson(res, 502, { error: String(e.message || e) }); }
  }
  // Движок «Предложений»: импорт целей/сфер из текста (kind:goals) или калибровка уровней (kind:calibrate)
  if (u === '/api/ai/propose' && req.method === 'POST') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req, 256 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const user = loadUsers().find(x => x.id === uid); if (!user) return sendJson(res, 401, { error: 'user not found' });
    const provider = AI_PROVIDERS[b.provider] ? b.provider : null;
    const kind = b.kind === 'calibrate' ? 'calibrate' : b.kind === 'daylog' ? 'daylog' : b.kind === 'treemap' ? 'treemap' : b.kind === 'onboard' ? 'onboard' : 'goals';
    const text = String(b.text || '').slice(0, 20000);
    const context = String(b.context || '').slice(0, 6000);
    if (!text) return sendJson(res, 400, { error: 'empty' });
    const sys = kind === 'calibrate' ? AI_CALIB_SYS : kind === 'daylog' ? AI_DAYLOG_SYS : kind === 'treemap' ? AI_TREEMAP_SYS : kind === 'onboard' ? AI_ONBOARD_SYS : AI_GOALS_SYS;
    const prompt = `СФЕРЫ И ЦЕЛИ ЮЗЕРА СЕЙЧАС:\n${context || '(пусто)'}\n\nЧТО НАПИСАЛ ЮЗЕР:\n${text}\n\nВерни ТОЛЬКО JSON по схеме из системного промпта. Без markdown, без пояснений вне JSON.`;
    try {
      const r = await aiCallForUser(user, provider, sys, [{ role: 'user', content: prompt }], 3500);
      if (aiErr(res, r)) return;
      const parsed = extractJson(r.text);
      if (!parsed || !Array.isArray(parsed.proposals)) return sendJson(res, 200, { error: 'parse', raw: (r.text || '').slice(0, 800) });
      return sendJson(res, 200, { proposals: parsed.proposals.slice(0, 40) });
    } catch (e) { return sendJson(res, 502, { error: String(e.message || e) }); }
  }
  // Тех-поддержка / гид: многоходовой чат, знающий функции и философию (манифест шлёт клиент)
  if (u === '/api/ai/chat' && req.method === 'POST') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req, 256 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const user = loadUsers().find(x => x.id === uid); if (!user) return sendJson(res, 401, { error: 'user not found' });
    const provider = AI_PROVIDERS[b.provider] ? b.provider : null;
    const system = String(b.system || '').slice(0, 12000);
    let messages = Array.isArray(b.messages) ? b.messages.slice(-20) : [];
    while (messages.length && messages[0].role === 'assistant') messages.shift(); // история должна начинаться с user
    if (!messages.length) return sendJson(res, 400, { error: 'empty' });
    try {
      const r = await aiCallForUser(user, provider, system, messages, 1500);
      if (aiErr(res, r)) return;
      return sendJson(res, 200, { text: r.text, source: r.source });
    } catch (e) { return sendJson(res, 502, { error: String(e.message || e) }); }
  }

  // ---- Strava (OAuth2 — авто-импорт тренировок) ----
  if (u.startsWith('/api/strava/')) {
    const path0 = u.split('?')[0];
    // status — настроен ли сервер, подключён ли юзер, имя атлета, время последней синхр.
    if (path0 === '/api/strava/status' && req.method === 'GET') {
      const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const st = loadStrava(uid);
      return sendJson(res, 200, { configured: stravaConfigured(), connected: !!(st && st.refreshToken),
        athlete: st ? { id: st.athleteId, name: st.athleteName } : null, lastSync: (st && st.lastSync) || null });
    }
    // connect — 302 на страницу авторизации Strava. Личность — в подписанном state (cookie не выживет редирект).
    if (path0 === '/api/strava/connect' && req.method === 'GET') {
      const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      if (!stravaConfigured()) return sendJson(res, 503, { error: 'strava_not_configured' });
      const redirectUri = publicBaseUrl(req) + '/api/strava/callback';
      const auth = 'https://www.strava.com/oauth/authorize?' + new URLSearchParams({
        client_id: STRAVA_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
        approval_prompt: 'auto', scope: 'activity:read_all', state: makeOauthState(uid),
      }).toString();
      res.writeHead(302, { Location: auth, 'Cache-Control': 'no-store' }); return res.end();
    }
    // callback — обмен кода на токены, сохранение, возврат в Настройки
    if (path0 === '/api/strava/callback' && req.method === 'GET') {
      const q = new URL(u, 'http://x').searchParams;
      const back = (ok) => { res.writeHead(302, { Location: '/?strava=' + (ok ? 'connected' : 'error'), 'Cache-Control': 'no-store' }); res.end(); };
      const uid = verifyOauthState(q.get('state'));
      if (!uid || q.get('error') || !q.get('code') || !stravaConfigured()) return back(false);
      const r = await stravaTokenRequest({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, code: q.get('code'), grant_type: 'authorization_code' });
      if (r.status !== 200 || !r.json.access_token) return back(false);
      const ath = r.json.athlete || {};
      saveStrava(uid, {
        athleteId: ath.id || null,
        athleteName: [ath.firstname, ath.lastname].filter(Boolean).join(' ') || ath.username || 'Strava',
        accessToken: r.json.access_token, refreshToken: r.json.refresh_token, expiresAt: r.json.expires_at,
        scope: q.get('scope') || 'activity:read_all', connectedAt: new Date().toISOString(), lastSync: null,
      });
      return back(true);
    }
    // sync — тянем недавние активности → отдаём клиенту (он создаёт выполненные квесты + XP, дедуп по stravaId)
    if (path0 === '/api/strava/sync' && req.method === 'POST') {
      const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const st = loadStrava(uid); if (!st || !st.refreshToken) return sendJson(res, 400, { error: 'not_connected' });
      let b = {}; try { b = JSON.parse(await readBody(req)); } catch {}
      const token = await stravaFreshToken(uid, st);
      if (!token) return sendJson(res, 502, { error: 'token_refresh_failed' });
      const days = Math.min(365, Math.max(1, Number(b.days) || 30));
      const after = Number(b.after) > 0 ? Math.floor(Number(b.after)) : Math.floor(Date.now() / 1000) - days * 86400;
      const r = await stravaApiGet(`/api/v3/athlete/activities?after=${after}&per_page=100`, token);
      if (r.status === 401) return sendJson(res, 401, { error: 'unauthorized' });
      if (r.status !== 200 || !Array.isArray(r.json)) return sendJson(res, 502, { error: 'fetch_failed', status: r.status });
      const activities = r.json.map(mapStravaActivity);
      st.lastSync = new Date().toISOString(); saveStrava(uid, st);
      return sendJson(res, 200, { ok: true, athlete: { id: st.athleteId, name: st.athleteName }, activities });
    }
    // disconnect — best-effort отзыв + удаление токенов
    if (path0 === '/api/strava/disconnect' && req.method === 'POST') {
      const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
      const st = loadStrava(uid);
      if (st && st.accessToken) { try { await stravaDeauthorize(st.accessToken); } catch {} }
      clearStrava(uid);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: 'not found' });
  }

  // ---- Лидерборд (соцфича) ----
  // Клиент публикует ПУБЛИЧНЫЙ снапшот прогресса (XP/уровень/ранг). Приватные данные
  // (задачи, рефлексия, тело и т.д.) НЕ покидают клиента — на сервере только агрегат.
  if (u === '/api/leaderboard/publish' && req.method === 'POST') {
    const uid = sessionUserId(req);
    if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req)); } catch {}
    const users = loadUsers();
    const user = users.find(x => x.id === uid);
    if (!user) return sendJson(res, 401, { error: 'user not found' });
    // СЕРВЕРНАЯ ВАЛИДАЦИЯ: XP/уровень/недельный вклад пересчитываем из сохранённых данных юзера,
    // НЕ доверяя значениям из payload (анти-накрутка лидерборда/рейда). clean — некомпетитивно, берём с клиента.
    const xp = computeUserXp(uid);
    user.pub = {
      totalXp: xp.total, level: xp.level, rank: xp.rank, at: new Date().toISOString(),
      path: (b.path === 'trust' || b.path === 'control') ? b.path : null, // сторона «Доверие/Контроль» — некомпетитивна, берём с клиента
      week: { ws: mondayStr(), xp: xp.weekXp, bossXp: xp.weekBossXp, quests: xp.weekQuests, clean: Math.max(0, Math.round(Number(b.cleanDays) || 0)) },
    };
    user.leaderboardOptOut = !!b.optOut;
    saveUsers(users);
    return sendJson(res, 200, { ok: true, totalXp: xp.total, level: xp.level });
  }
  // GET /api/leaderboard — рейтинг всех, кто опубликовал снапшот и не отписался
  if (u === '/api/leaderboard' && req.method === 'GET') {
    const me = sessionUserId(req);
    if (!me) return sendJson(res, 401, { error: 'not logged in' });
    const rows = loadUsers()
      .filter(x => x.pub && !x.leaderboardOptOut)
      .map(x => ({ id: x.id, name: x.name, avatar: x.avatar, totalXp: x.pub.totalXp, level: x.pub.level, rank: x.pub.rank, path: x.pub.path || null, weekXp: (x.pub.week && x.pub.week.xp) || 0, me: x.id === me }))
      .sort((a, b) => b.totalXp - a.totalXp);
    return sendJson(res, 200, rows);
  }

  // ---- Мультиплеер: пати (дуо/группа), кооп-рейд по недельному вкладу ----
  // Собирает пати с участниками (из снапшотов users.json) + чиры. Позитивно, без вины.
  // ВАЖНО: partyView вызывает refreshRaid (мутирует party) — вызывающий эндпоинт ДОЛЖЕН saveParties после.
  function partyView(party, me) {
    if (!party) return null;
    const r = refreshRaid(party);
    const users = loadUsers();
    const members = (party.members || []).map((id) => {
      const u = users.find((x) => x.id === id) || {}; const w = (u.pub && u.pub.week) || {};
      return { id, name: u.name || '—', avatar: u.avatar || '👤', level: (u.pub && u.pub.level) || 1, rank: (u.pub && u.pub.rank) || '', weekXp: w.xp || 0, weekQuests: w.quests || 0, cleanDays: w.clean || 0, cheers: (party.cheers && party.cheers[id]) || 0, me: id === me };
    });
    return { id: party.id, name: party.name, code: party.code, createdBy: party.createdBy, members, max: PARTY_MAX, ws: r.ws,
      raid: { total: r.total, target: r.target, won: r.won, iClaimed: (r.claimed || []).includes(me), claimedCount: (r.claimed || []).length },
      season: { wins: r.seasonWins, goal: SEASON_GOAL } };
  }
  if (u === '/api/party' && req.method === 'GET') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    const parties = loadParties(); const party = partyOf(me, parties);
    const view = partyView(party, me); if (party) saveParties(parties); // persist раз пересчитали рейд/сезон
    return sendJson(res, 200, { party: view });
  }
  if (u === '/api/party/create' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req)); } catch {}
    const parties = loadParties();
    if (partyOf(me, parties)) return sendJson(res, 400, { error: 'already_in_party' });
    const party = { id: 'p_' + crypto.randomBytes(5).toString('hex'), name: String(b.name || 'Моя пати').slice(0, 40), code: genPartyCode(parties), members: [me], cheers: {}, season: { wins: 0 }, createdBy: me, createdAt: new Date().toISOString() };
    parties.push(party); const view = partyView(party, me); saveParties(parties);
    return sendJson(res, 200, { party: view });
  }
  if (u === '/api/party/join' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req)); } catch {}
    const parties = loadParties();
    if (partyOf(me, parties)) return sendJson(res, 400, { error: 'already_in_party' });
    const code = String(b.code || '').trim().toUpperCase();
    const party = parties.find((p) => p.code === code);
    if (!party) return sendJson(res, 404, { error: 'not_found' });
    if ((party.members || []).length >= PARTY_MAX) return sendJson(res, 400, { error: 'full' });
    party.members.push(me); const view = partyView(party, me); saveParties(parties);
    return sendJson(res, 200, { party: view });
  }
  if (u === '/api/party/leave' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    const parties = loadParties(); const party = partyOf(me, parties);
    if (party) {
      party.members = party.members.filter((x) => x !== me);
      if (party.cheers) delete party.cheers[me];
      if (party.raid && party.raid.claimed) party.raid.claimed = party.raid.claimed.filter((x) => x !== me);
      const idx = parties.indexOf(party);
      if (!party.members.length) parties.splice(idx, 1); // пустая пати удаляется
      else if (party.createdBy === me) party.createdBy = party.members[0]; // передаём «владельца»
      saveParties(parties);
    }
    return sendJson(res, 200, { ok: true });
  }
  if (u === '/api/party/cheer' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req)); } catch {}
    const parties = loadParties(); const party = partyOf(me, parties);
    if (!party) return sendJson(res, 404, { error: 'no_party' });
    const to = String(b.to || '');
    if (!party.members.includes(to)) return sendJson(res, 400, { error: 'not_member' });
    party.cheers = party.cheers || {}; party.cheers[to] = (party.cheers[to] || 0) + 1;
    const view = partyView(party, me); saveParties(parties);
    return sendJson(res, 200, { party: view });
  }
  // Забрать награду за победу в рейде (раз в неделю на участника) — сундук пати
  if (u === '/api/party/claim' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    const parties = loadParties(); const party = partyOf(me, parties);
    if (!party) return sendJson(res, 404, { error: 'no_party' });
    refreshRaid(party);
    if (!party.raid.won) return sendJson(res, 400, { error: 'not_won' });
    if ((party.raid.claimed || []).includes(me)) return sendJson(res, 400, { error: 'already_claimed' });
    party.raid.claimed = party.raid.claimed || []; party.raid.claimed.push(me);
    const view = partyView(party, me); saveParties(parties);
    return sendJson(res, 200, { reward: { gold: 150, boostPct: 30, boostHours: 6 }, party: view });
  }

  // ---- Web Push: подписка + тест ----
  if (u === '/api/push/vapid' && req.method === 'GET') {
    return sendJson(res, 200, { key: loadVapid().pubB64 });
  }
  if (u === '/api/push/subscribe' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req)); } catch {}
    const s = b.subscription || b;
    if (!s || !s.endpoint || !s.keys) return sendJson(res, 400, { error: 'bad_subscription' });
    const users = loadUsers(); const user = users.find((x) => x.id === me); if (!user) return sendJson(res, 401, { error: 'user not found' });
    const tz = (typeof b.tz === 'string' && b.tz.length < 64) ? b.tz : (user.push && user.push.tz) || 'Europe/Berlin';
    user.push = { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, at: new Date().toISOString(), tz, nudges: user.push ? user.push.nudges !== false : true };
    saveUsers(users); return sendJson(res, 200, { ok: true });
  }
  if (u === '/api/push/unsubscribe' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    const users = loadUsers(); const user = users.find((x) => x.id === me); if (user) { delete user.push; saveUsers(users); }
    return sendJson(res, 200, { ok: true });
  }
  // Вкл/выкл напоминаний компаньона (подписка остаётся — глушим только утро/вечер тики)
  if (u === '/api/push/nudges' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req)); } catch {}
    const users = loadUsers(); const user = users.find((x) => x.id === me);
    if (!user || !user.push) return sendJson(res, 400, { error: 'no_subscription' });
    user.push.nudges = b.on !== false; saveUsers(users);
    return sendJson(res, 200, { ok: true, nudges: user.push.nudges });
  }
  if (u === '/api/push/test' && req.method === 'POST') {
    const me = sessionUserId(req); if (!me) return sendJson(res, 401, { error: 'not logged in' });
    const user = loadUsers().find((x) => x.id === me); if (!user || !user.push) return sendJson(res, 400, { error: 'no_subscription' });
    const r = await sendWebPush(user.push, { title: 'Satoru 🔔', body: 'Уведомления работают! Я позову тебя, когда придёт время.', url: './' });
    return sendJson(res, 200, r);
  }

  // ---- Per-user data API ----
  const m = u.match(/^\/api\/data\/([^/?]+)/);
  if (m) {
    const uid = sessionUserId(req);
    if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    const name = safeName(m[1].replace(/\.json$/, ''));
    if (!name) return sendJson(res, 400, { error: 'bad name' });
    const dir = userDataDir(uid);
    const file = path.join(dir, name + '.json');

    if (req.method === 'GET') {
      fs.readFile(file, 'utf8', (err, txt) => {
        if (err) return sendJson(res, 404, { error: 'not found' });
        send(res, 200, txt, { 'Content-Type': MIME['.json'] });
      });
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body);
        fs.mkdirSync(dir, { recursive: true });
        backupFile(dir, name); // снимок прежнего содержимого ПЕРЕД перезаписью — защита от потери
        fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
        return sendJson(res, 200, { ok: true });
      } catch (e) { return sendJson(res, 400, { error: String(e.message || e) }); }
    }
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  // ---- Админ: инспекция и восстановление данных любого юзера (спасение при потере) ----
  {
    const me = loadUsers().find(x => x.id === sessionUserId(req));
    const isAdmin = me && me.isAdmin;
    const DATA_NAMES = ['settings', 'tasks', 'habits', 'goals', 'days', 'habitlog', 'weeks', 'lootbox', 'skilltree', 'purchases', 'achievements'];

    // GET /api/admin/userdata/<userId> — текущее содержимое всех файлов + список бэкапов
    let am = u.match(/^\/api\/admin\/userdata\/([a-z0-9_-]{1,32})$/);
    if (am && req.method === 'GET') {
      if (!isAdmin) return sendJson(res, 403, { error: 'только админ' });
      const dir = userDataDir(am[1]);
      const files = {}, backups = {};
      for (const n of DATA_NAMES) {
        try { files[n] = JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8')); } catch { files[n] = null; }
        try { backups[n] = fs.readdirSync(backupDir(dir, n)).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort().reverse(); } catch { backups[n] = []; }
      }
      return sendJson(res, 200, { userId: am[1], files, backups });
    }

    // GET /api/admin/userdata/<userId>/backup/<name>/<stamp> — содержимое конкретного бэкапа
    am = u.match(/^\/api\/admin\/userdata\/([a-z0-9_-]{1,32})\/backup\/([a-z0-9_-]+)\/([0-9TZ-]+)$/);
    if (am && req.method === 'GET') {
      if (!isAdmin) return sendJson(res, 403, { error: 'только админ' });
      if (!safeName(am[2])) return sendJson(res, 400, { error: 'bad name' });
      const fp = path.join(backupDir(userDataDir(am[1]), am[2]), am[3] + '.json');
      if (!fp.startsWith(DATA_DIR)) return sendJson(res, 400, { error: 'bad path' });
      return fs.readFile(fp, 'utf8', (err, txt) => err ? sendJson(res, 404, { error: 'not found' }) : send(res, 200, txt, { 'Content-Type': MIME['.json'] }));
    }

    // POST /api/admin/userdata/<userId>/restore  body { name, stamp } — восстановить бэкап (текущее сначала бэкапится)
    am = u.match(/^\/api\/admin\/userdata\/([a-z0-9_-]{1,32})\/restore$/);
    if (am && req.method === 'POST') {
      if (!isAdmin) return sendJson(res, 403, { error: 'только админ' });
      let b = {}; try { b = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
      const name = safeName(String(b.name || '')); if (!name) return sendJson(res, 400, { error: 'bad name' });
      const dir = userDataDir(am[1]);
      const bfile = path.join(backupDir(dir, name), String(b.stamp || '') + '.json');
      if (!bfile.startsWith(DATA_DIR) || !fs.existsSync(bfile)) return sendJson(res, 404, { error: 'backup not found' });
      try {
        backupFile(dir, name); // снимок текущего перед откатом
        fs.copyFileSync(bfile, path.join(dir, name + '.json'));
        return sendJson(res, 200, { ok: true, restored: name, from: b.stamp });
      } catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
    }
  }

  // ---- Static files ----
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, u, req.method === 'HEAD');
  return send(res, 405, 'Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ⚔️  Satoru запущен:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  📁  Данные:            ${DATA_DIR}`);
  if (HOST === '0.0.0.0') console.log('  🌐  Многопользовательский режим — доступен по сети.');
  console.log('');
  // Планировщик пушей-чек-инов компаньона: тик каждые 15 мин (отключаемо через PUSH_SCHED=off)
  if (process.env.PUSH_SCHED !== 'off') {
    setInterval(() => { pushTick().catch(() => {}); }, 15 * 60 * 1000);
    setTimeout(() => { pushTick().catch(() => {}); }, 60 * 1000); // первый тик через минуту после старта
  }
});
