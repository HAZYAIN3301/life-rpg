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
function mondayStr(dt) { const x = dt ? new Date(dt) : new Date(); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
// Пересчитывает состояние рейда (мутирует party.raid/season). Победа недели = сумма недельного XP ≥ цель. Сброс на новой неделе. Сезон = накопленные победы.
function refreshRaid(party) {
  const ws = mondayStr();
  if (!party.raid || party.raid.ws !== ws) party.raid = { ws, won: false, claimed: [] };
  party.season = party.season || { wins: 0 };
  const users = loadUsers();
  let total = 0;
  for (const id of (party.members || [])) { const u = users.find((x) => x.id === id); const w = u && u.pub && u.pub.week; if (w && w.ws === ws) total += (w.xp || 0); }
  const target = (party.members || []).length * RAID_PER_WEEK;
  let justWon = false;
  if (!party.raid.won && target > 0 && total >= target) { party.raid.won = true; party.season.wins = (party.season.wins || 0) + 1; justWon = true; }
  return { ws, total, target, won: party.raid.won, claimed: party.raid.claimed || [], seasonWins: party.season.wins || 0, justWon };
}
// ---- Серверная валидация XP: пересчёт из СОХРАНЁННЫХ данных юзера (не доверяем publish-payload) ----
const RANK_TABLE = [['Новичок', 1], ['Ученик', 3], ['Адепт', 6], ['Эксперт', 10], ['Мастер', 16], ['Грандмастер', 24], ['Легенда', 34]];
function rankNameFor(level) { let n = RANK_TABLE[0][0]; for (const [nm, min] of RANK_TABLE) if (level >= min) n = nm; return n; }
function computeUserXp(uid) {
  const dir = userDataDir(uid);
  const rd = (n) => { try { return JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8')); } catch { return null; } };
  const settings = rd('settings') || {}, tasks = rd('tasks') || [], habitlog = rd('habitlog') || {}, goals = rd('goals') || [];
  const curve = settings.curve || { base: 100, growth: 1.3 };
  const ws = mondayStr(), inWeek = (d) => typeof d === 'string' && d.slice(0, 10) >= ws;
  let total = 0, weekXp = 0, weekQuests = 0;
  for (const t of (Array.isArray(tasks) ? tasks : [])) {
    if (t && t.done && t.completedAt) { const xp = Math.max(0, Number(t.xpAwarded) || 0); total += xp; if (inWeek(t.completedAt)) { weekXp += xp; weekQuests++; } }
  }
  for (const day in habitlog) { const m = habitlog[day] || {}; for (const hid in m) { const xp = Math.max(0, Number(m[hid] && m[hid].xp) || 0); total += xp; if (inWeek(day)) weekXp += xp; } }
  for (const g of (Array.isArray(goals) ? goals : [])) { if (g && g.completedAt) { const xp = Math.max(0, Number(g.xpReward) || 0); total += xp; if (inWeek(g.completedAt)) weekXp += xp; } }
  const imp = settings.imported || {}; for (const k in imp) total += Math.max(0, Number(imp[k] && imp[k].xp) || 0);
  total = Math.round(total);
  let level = 1, rem = total, need = Math.round(curve.base * Math.pow(curve.growth, level - 1));
  while (rem >= need && level < 999) { rem -= need; level++; need = Math.round(curve.base * Math.pow(curve.growth, level - 1)); }
  return { total, weekXp: Math.round(weekXp), weekQuests, level, rank: rankNameFor(level) };
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
const AI_PROVIDERS = {
  gemini: { shape: 'gemini', host: 'generativelanguage.googleapis.com', model: 'gemini-2.5-flash' },
  groq: { shape: 'openai', host: 'api.groq.com', path: '/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  anthropic: { shape: 'anthropic', host: 'api.anthropic.com', model: 'claude-opus-4-8' },
  openai: { shape: 'openai', host: 'api.openai.com', path: '/v1/chat/completions', model: 'gpt-4o' },
};
function aiComplete(provider, keys, system, prompt, maxTokens) {
  return aiCompleteMessages(provider, keys, system, [{ role: 'user', content: prompt }], maxTokens);
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
    return { ok: true, text: text.map((p) => p.text || '').join('') };
  }
  if (P.shape === 'anthropic') {
    const r = await httpsPostJson(P.host, '/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      { model: P.model, max_tokens: max, system, messages: norm });
    if (r.status !== 200) return { ok: false, status: r.status, detail: (r.json.error && r.json.error.message) || '' };
    return { ok: true, text: (r.json.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n') };
  }
  // openai-совместимый (openai, groq)
  const msgs = []; if (system) msgs.push({ role: 'system', content: system }); for (const m of norm) msgs.push(m);
  const r = await httpsPostJson(P.host, P.path, { 'Authorization': 'Bearer ' + key },
    { model: P.model, max_tokens: max, messages: msgs });
  if (r.status !== 200) return { ok: false, status: r.status, detail: (r.json.error && r.json.error.message) || '' };
  return { ok: true, text: (r.json.choices && r.json.choices[0] && r.json.choices[0].message && r.json.choices[0].message.content) || '' };
}
// Защищённый разбор JSON из ответа модели: срезаем ```fences``` и прозу вокруг { ... }
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) t = fence[1].trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i < 0 || j < 0 || j < i) return null;
  try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
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
// Системный промпт: калибровка уровня сферы по описанию
const AI_CALIB_SYS = `Ты — калибратор уровней в приложении Satoru. Юзер описывает, чем и насколько уверенно занимается в разных сферах. Оцени уровень по шкале 1–20 (личная RPG-абстракция, НЕ глобальный рейтинг): 1 = только начал; ~5 = регулярная практика, база есть; ~10 = уверенный, могу научить других; ~15 = глубокая экспертиза; 18–20 = топовый/мировой уровень. Для школы/универа опирайся на ступень и оценки честно (отличник старшей школы ≈ 8–11, не 20).

Верни СТРОГО JSON {"proposals":[{"type":"level","sphere":"<имя сферы>","level":N,"note":"<кратко, на чём основана оценка>"}]}, без markdown и текста вне JSON. Только по сферам, о которых юзер дал информацию. Переиспользуй существующие имена сфер. Язык — русский.`;
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
        plan: 'free', trialStartedAt: null, proUntil: null,
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

  // ---- Инбокс: медиа быстрых заметок (голос/видео) — per-user в data/users/<id>/inbox/ ----
  const INBOX_EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'video/webm': 'webm', 'video/mp4': 'mp4' };
  const INBOX_MIME = { webm: 'video/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', mp4: 'video/mp4' };
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
    const k = loadAiKeys(uid); const out = {}; for (const id of Object.keys(AI_PROVIDERS)) out[id] = !!k[id]; return sendJson(res, 200, out);
  }
  if (u === '/api/ai/analyze' && req.method === 'POST') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req, 256 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const provider = AI_PROVIDERS[b.provider] ? b.provider : 'anthropic';
    const system = String(b.system || '').slice(0, 8000);
    const prompt = String(b.prompt || '').slice(0, 100000);
    if (!prompt) return sendJson(res, 400, { error: 'empty prompt' });
    try {
      const r = await aiComplete(provider, loadAiKeys(uid), system, prompt, 2000);
      if (r.noKey) return sendJson(res, 400, { error: 'no_key', provider });
      if (!r.ok) return sendJson(res, 502, { error: 'provider', status: r.status, detail: r.detail });
      return sendJson(res, 200, { text: r.text });
    } catch (e) { return sendJson(res, 502, { error: String(e.message || e) }); }
  }
  // Движок «Предложений»: импорт целей/сфер из текста (kind:goals) или калибровка уровней (kind:calibrate)
  if (u === '/api/ai/propose' && req.method === 'POST') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req, 256 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const provider = AI_PROVIDERS[b.provider] ? b.provider : 'anthropic';
    const kind = b.kind === 'calibrate' ? 'calibrate' : 'goals';
    const text = String(b.text || '').slice(0, 20000);
    const context = String(b.context || '').slice(0, 6000);
    if (!text) return sendJson(res, 400, { error: 'empty' });
    const sys = kind === 'calibrate' ? AI_CALIB_SYS : AI_GOALS_SYS;
    const prompt = `СФЕРЫ И ЦЕЛИ ЮЗЕРА СЕЙЧАС:\n${context || '(пусто)'}\n\nЧТО НАПИСАЛ ЮЗЕР:\n${text}\n\nВерни ТОЛЬКО JSON по схеме из системного промпта. Без markdown, без пояснений вне JSON.`;
    try {
      const r = await aiComplete(provider, loadAiKeys(uid), sys, prompt, 3500);
      if (r.noKey) return sendJson(res, 400, { error: 'no_key', provider });
      if (!r.ok) return sendJson(res, 502, { error: 'provider', status: r.status, detail: r.detail });
      const parsed = extractJson(r.text);
      if (!parsed || !Array.isArray(parsed.proposals)) return sendJson(res, 200, { error: 'parse', raw: (r.text || '').slice(0, 800) });
      return sendJson(res, 200, { proposals: parsed.proposals.slice(0, 40) });
    } catch (e) { return sendJson(res, 502, { error: String(e.message || e) }); }
  }
  // Тех-поддержка / гид: многоходовой чат, знающий функции и философию (манифест шлёт клиент)
  if (u === '/api/ai/chat' && req.method === 'POST') {
    const uid = sessionUserId(req); if (!uid) return sendJson(res, 401, { error: 'not logged in' });
    let b = {}; try { b = JSON.parse(await readBody(req, 256 * 1024)); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const provider = AI_PROVIDERS[b.provider] ? b.provider : 'anthropic';
    const system = String(b.system || '').slice(0, 12000);
    let messages = Array.isArray(b.messages) ? b.messages.slice(-20) : [];
    while (messages.length && messages[0].role === 'assistant') messages.shift(); // история должна начинаться с user
    if (!messages.length) return sendJson(res, 400, { error: 'empty' });
    try {
      const r = await aiCompleteMessages(provider, loadAiKeys(uid), system, messages, 1500);
      if (r.noKey) return sendJson(res, 400, { error: 'no_key', provider });
      if (!r.ok) return sendJson(res, 502, { error: 'provider', status: r.status, detail: r.detail });
      return sendJson(res, 200, { text: r.text });
    } catch (e) { return sendJson(res, 502, { error: String(e.message || e) }); }
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
      week: { ws: mondayStr(), xp: xp.weekXp, quests: xp.weekQuests, clean: Math.max(0, Math.round(Number(b.cleanDays) || 0)) },
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
      .map(x => ({ id: x.id, name: x.name, avatar: x.avatar, totalXp: x.pub.totalXp, level: x.pub.level, rank: x.pub.rank, me: x.id === me }))
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
