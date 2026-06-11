'use strict';

// Gojo — self-hosted multi-user gamified life planner.
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
  return { id: user.id, name: user.name, avatar: user.avatar, isAdmin: !!user.isAdmin, entitlement: entitlement(user) };
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

    // GET /api/auth/profiles — публичный (для экрана выбора профиля)
    if (u === '/api/auth/profiles' && req.method === 'GET') {
      return sendJson(res, 200, loadUsers().map(x => ({ id: x.id, name: x.name, avatar: x.avatar })));
    }

    // POST /api/auth/login
    if (u === '/api/auth/login' && req.method === 'POST') {
      const { userId, pin } = body;
      if (!userId || pin === undefined) return sendJson(res, 400, { error: 'userId и pin обязательны' });
      const user = loadUsers().find(x => x.id === userId);
      if (!user) return sendJson(res, 401, { error: 'профиль не найден' });
      if (user.pinHash !== hashPin(userId, String(pin))) return sendJson(res, 401, { error: 'неверный PIN' });
      const token = makeSession(userId);
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Set-Cookie': setCookieHeader(token), 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(Object.assign({ ok: true }, publicUser(user))));
    }

    // POST /api/auth/register
    if (u === '/api/auth/register' && req.method === 'POST') {
      const { name, pin } = body;
      if (!name || pin === undefined) return sendJson(res, 400, { error: 'name и pin обязательны' });
      if (String(pin).length < 4) return sendJson(res, 400, { error: 'PIN минимум 4 символа' });
      const users = loadUsers();
      let id = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
      if (!id) id = 'user';
      while (users.find(x => x.id === id)) id += Math.floor(Math.random() * 9 + 1);
      if (!safeId(id)) id = 'u' + crypto.randomBytes(4).toString('hex');
      const user = {
        id, name: String(name).slice(0, 32),
        avatar: body.avatar || '⚡',
        pinHash: hashPin(id, String(pin)),
        createdAt: new Date().toISOString(),
        isAdmin: users.length === 0,
        plan: 'free', trialStartedAt: null, proUntil: null,
      };
      fs.mkdirSync(userDataDir(id), { recursive: true });
      users.push(user);
      saveUsers(users);
      const token = makeSession(id);
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Set-Cookie': setCookieHeader(token), 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(Object.assign({ ok: true }, publicUser(user))));
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

    return sendJson(res, 404, { error: 'not found' });
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
    let fb = {}; try { fb = JSON.parse(await readBody(req, 30 * 1024 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json / слишком большой файл' }); }
    const text = String(fb.text || '').slice(0, 4000).trim();
    if (!text && !(fb.attachments && fb.attachments.length)) return sendJson(res, 400, { error: 'пусто' });
    const id = 'fb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const fdir = path.join(DATA_DIR, 'feedback');
    const attachments = [];
    for (const [i, a] of (Array.isArray(fb.attachments) ? fb.attachments : []).slice(0, 6).entries()) {
      const m = /^data:([\w/.+-]+);base64,(.+)$/.exec(a && a.dataUrl || '');
      if (!m) continue;
      const mime = m[1], ext = FB_EXT[mime]; if (!ext) continue;
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 26 * 1024 * 1024) continue;
      const fname = `${id}_${i}.${ext}`;
      try { fs.mkdirSync(fdir, { recursive: true }); fs.writeFileSync(path.join(fdir, fname), buf); attachments.push({ file: fname, type: mime, name: String(a.name || '').slice(0, 80) }); } catch {}
    }
    const file = path.join(DATA_DIR, 'feedback.json');
    let list = []; try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    list.push({ id, at: new Date().toISOString(), userId: uid, kind: String(fb.kind || 'other').slice(0, 20), text, attachments });
    try { fs.writeFileSync(file, JSON.stringify(list, null, 2)); } catch (e) { return sendJson(res, 500, { error: 'save failed' }); }
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
    user.pub = {
      totalXp: Math.max(0, Math.round(Number(b.totalXp) || 0)),
      level: Math.max(1, Math.round(Number(b.level) || 1)),
      rank: String(b.rank || '').slice(0, 40),
      at: new Date().toISOString(),
    };
    user.leaderboardOptOut = !!b.optOut;
    saveUsers(users);
    return sendJson(res, 200, { ok: true });
  }
  // GET /api/leaderboard — рейтинг всех, кто опубликовал снапшот и не отписался
  if (u === '/api/leaderboard' && req.method === 'GET') {
    const me = sessionUserId(req);
    if (!me) return sendJson(res, 401, { error: 'not logged in' });
    const rows = loadUsers()
      .filter(x => x.pub && !x.leaderboardOptOut)
      .map(x => ({ id: x.id, name: x.name, avatar: x.avatar, totalXp: x.pub.totalXp, level: x.pub.level, rank: x.pub.rank, me: x.id === me }))
      .sort((a, b) => b.totalXp - a.totalXp);
    return sendJson(res, 200, rows);
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
  console.log(`\n  ⚔️  Gojo запущен:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  📁  Данные:            ${DATA_DIR}`);
  if (HOST === '0.0.0.0') console.log('  🌐  Многопользовательский режим — доступен по сети.');
  console.log('');
});
