'use strict';

/* Локальный ИИ для всех (владелец 05.10, «от частного к общему»). Раньше Ollama работала, только
 * если сервер Satoru стоит на том же компьютере (v268). Теперь компьютер человека привязывается к
 * аккаунту и сам держит ИСХОДЯЩЕЕ соединение с Satoru: забирает задание, отдаёт его своей модели на
 * 127.0.0.1 и возвращает ответ. Наружу ничего не открывается, облака в цепочке нет. Несколько
 * компьютеров — по порядку: первый в сети отвечает (у владельца Edith 9b, иначе Jarvis 2b).
 * Тело запроса к модели собирает только сервер; коннектор шлёт его в один адрес /api/chat. */

const crypto = require('node:crypto');

const FILE = 'local-ai';
const PAIR_TTL_MS = 10 * 60 * 1000;
const ONLINE_MS = 45 * 1000;      // между двумя запросами коннектора проходит меньше секунды
const POLL_MS = 25 * 1000;        // долгий опрос: держим запрос коннектора, пока нет задания
const PICKUP_MS = 10 * 1000;      // задание не забрали — компьютер, значит, уснул
const ACK_MS = 5 * 1000;          // забрали, но не подтвердили — соединение осталось от уснувшего Mac
const JOB_MS = 180 * 1000;        // локальная модель на большом контексте думает долго
const MAX_DEVICES = 5, MAX_QUEUE = 3, MAX_CHARS = 60000;
const MODEL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/;

const sha = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const b64u = (buf) => Buffer.from(buf).toString('base64url');
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function fail(reason, status) { return { ok: false, status, detail: 'local_' + reason, reason, source: 'local', provider: 'ollama' }; }

// Список моделей с компьютера (`/api/tags` Ollama) → только локальные чат-модели.
// Облачные псевдонимы Ollama (remote_*, «cloud») отбрасываются: данные не должны уйти в облако
// под видом локальной модели. Модели только для эмбеддингов чат вести не умеют.
function localModels(tags) {
  const list = tags && Array.isArray(tags.models) ? tags.models : [];
  const out = [];
  for (const m of list.slice(0, 80)) {
    if (!m || typeof m.name !== 'string' || !MODEL_NAME.test(m.name)) continue;
    if (m.remote_host || m.remote_model || /(?:^|[-:])cloud(?:$|[-:])/i.test(m.name) || /embed/i.test(m.name)) continue;
    const caps = Array.isArray(m.capabilities) ? m.capabilities.map(String) : null;
    if (caps && !caps.includes('completion')) continue;
    const format = m.details && m.details.format;
    if (format && !['gguf', 'safetensors'].includes(String(format))) continue;
    out.push({ name: m.name, size: Number(m.size) > 0 ? Math.round(Number(m.size)) : null,
      params: String((m.details && m.details.parameter_size) || '').slice(0, 12), vision: !!(caps && caps.includes('vision')) });
    if (out.length >= 40) break;
  }
  return out;
}

// Тело запроса к модели. Контекст — по размеру разговора: маленькой машине не нужен 32k на «привет».
function payloadFor(model, system, messages, maxTokens, images) {
  const norm = (Array.isArray(messages) ? messages : []).slice(-20)
    .map((m) => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '') }));
  if (!norm.length) return { error: 'empty' };
  const sys = String(system || '');
  const chars = sys.length + norm.reduce((sum, m) => sum + m.content.length, 0);
  if (chars > MAX_CHARS) return { error: 'context_too_large' };
  if (Array.isArray(images) && images.length) norm[norm.length - 1].images = images.slice(0, 2);
  const predict = Math.min(4000, Math.max(64, Number(maxTokens) || 1500));
  // Картинка тоже занимает контекст (фото расписания — тысячи токенов): без запаса модель теряет начало запроса.
  const pictures = Array.isArray(images) ? Math.min(images.length, 2) : 0;
  const need = Math.ceil(chars / 3 * 1.2) + predict + pictures * 4096;
  let ctx = 4096; while (ctx < need && ctx < 32768) ctx *= 2;
  return { model, stream: false, think: false, keep_alive: '10m',
    messages: [{ role: 'system', content: sys }, ...norm], options: { num_ctx: ctx, num_predict: predict } };
}

function readAnswer(status, body) {
  let json = null;
  try { json = JSON.parse(String(body || '')); } catch { json = null; }
  if (Number(status) !== 200 || !json || json.error) {
    const why = json && typeof json.error === 'string' ? json.error.replace(/\s+/g, ' ').slice(0, 160) : `HTTP ${Number(status) || 0}`;
    return Object.assign(fail('model_error', 502), { message: why });
  }
  const content = json.message && typeof json.message.content === 'string'
    ? json.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : '';
  if (json.done !== true || !content) return fail('invalid_response', 502);
  return { ok: true, text: content, tokens: Math.max(0, Number(json.prompt_eval_count) || 0) + Math.max(0, Number(json.eval_count) || 0),
    truncated: json.done_reason === 'length', provider: 'ollama', source: 'local' };
}

function create({ readStore, writeStore, now = Date.now, random = crypto.randomBytes,
  timers = { set: setTimeout, clear: clearTimeout } } = {}) {
  const slots = new Map();
  const slotOf = (uid, deviceId) => {
    const key = `${uid}|${deviceId}`;
    if (!slots.has(key)) slots.set(key, { uid, deviceId, seenAt: 0, waiter: null, inflight: null, queue: [] });
    return slots.get(key);
  };
  function load(uid) {
    let v = null;
    try { v = readStore(uid); } catch { v = null; }
    const devices = v && Array.isArray(v.devices) ? v.devices.filter((d) => d && typeof d.id === 'string' && typeof d.secretHash === 'string').slice(0, MAX_DEVICES) : [];
    return { version: 1, devices, pairing: v && v.pairing && typeof v.pairing.hash === 'string' ? v.pairing : null };
  }
  const save = (uid, store) => writeStore(uid, store);
  const online = (uid, deviceId) => { const s = slots.get(`${uid}|${deviceId}`); return !!s && (!!s.waiter || !!s.inflight || now() - s.seenAt < ONLINE_MS); };

  // ── Привязка компьютера ──
  function startPairing(uid) {
    const store = load(uid);
    if (store.devices.length >= MAX_DEVICES) return { error: 'too_many_devices' };
    const code = `sp1.${b64u(uid)}.${b64u(random(18))}`;
    store.pairing = { hash: sha(code), expiresAt: now() + PAIR_TTL_MS };
    save(uid, store);
    return { code, expiresAt: new Date(store.pairing.expiresAt).toISOString() };
  }
  function parse(token, prefix, parts) {
    const p = String(token || '').trim().split('.');
    if (p.length !== parts || p[0] !== prefix) return null;
    let uid = '';
    try { uid = Buffer.from(p[1], 'base64url').toString('utf8'); } catch { return null; }
    return uid && /^[A-Za-z0-9_.@:-]{1,120}$/.test(uid) ? { uid, p } : null;
  }
  function pair(code, { name, platform } = {}) {
    const t = parse(code, 'sp1', 3);
    if (!t) return { error: 'bad_code' };
    const store = load(t.uid);
    if (!store.pairing || store.pairing.expiresAt < now() || !same(store.pairing.hash, sha(code))) return { error: 'bad_code' };
    if (store.devices.length >= MAX_DEVICES) return { error: 'too_many_devices' };
    const id = b64u(random(6)), secret = b64u(random(32));
    const clean = String(name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Computer';
    store.devices.push({ id, name: clean, platform: ['macos', 'linux', 'windows'].includes(platform) ? platform : 'other',
      secretHash: sha(secret), createdAt: new Date(now()).toISOString(), models: [], model: null });
    store.pairing = null;
    save(t.uid, store);
    return { token: `sd1.${b64u(t.uid)}.${id}.${secret}`, deviceId: id };
  }
  function authenticate(token) {
    const t = parse(token, 'sd1', 4);
    if (!t) return null;
    const store = load(t.uid), device = store.devices.find((d) => d.id === t.p[2]);
    if (!device || !same(device.secretHash, sha(t.p[3]))) return null;
    return { uid: t.uid, device, store };
  }

  // ── Коннектор ──
  function hello(auth, tags) {
    const slot = slotOf(auth.uid, auth.device.id); slot.seenAt = now();
    const models = localModels(tags), d = auth.device;
    const changed = JSON.stringify(models) !== JSON.stringify(d.models || []);
    d.models = models;
    let pick = d.model && models.some((m) => m.name === d.model) ? d.model : null;
    // Первая модель — самая крупная из установленных: человек поставил её, значит, машина её тянет.
    if (!pick && models.length) pick = models.slice().sort((a, b) => (b.size || 0) - (a.size || 0))[0].name;
    if (changed || pick !== d.model) { d.model = pick; save(auth.uid, auth.store); }
    return { model: d.model, models: models.length };
  }
  function deliver(slot, job) {
    slot.inflight = job; job.picked = true; timers.clear(job.pickTimer);
    const w = slot.waiter; slot.waiter = null; timers.clear(w.timer);
    // Ответ мог уйти в соединение уснувшего компьютера: без подтверждения задание уходит дальше.
    job.ackTimer = timers.set(() => { if (!job.acked) { slot.seenAt = 0; finish(job, fail('unreachable', 503)); } }, ACK_MS);
    w.send(200, job.payload, job.id);
  }
  function pump(slot) {
    if (!slot.inflight && slot.queue.length && slot.waiter) deliver(slot, slot.queue.shift());
  }
  function finish(job, result) {
    if (job.done) return;
    job.done = true; timers.clear(job.timer); timers.clear(job.pickTimer); timers.clear(job.ackTimer);
    const slot = job.slot;
    if (slot.inflight === job) slot.inflight = null;
    slot.queue = slot.queue.filter((j) => j !== job);
    job.resolve(result);
    pump(slot);
  }
  // Долгий опрос. send(status, payload, jobId) пишет HTTP-ответ; onClose — обрыв соединения.
  function next(auth, send, onClose) {
    const slot = slotOf(auth.uid, auth.device.id); slot.seenAt = now();
    // Коннектор последователен: раз он снова спрашивает, прежнее задание до модели не дошло.
    if (slot.inflight) finish(slot.inflight, fail('interrupted', 502));
    if (slot.waiter) { const old = slot.waiter; slot.waiter = null; timers.clear(old.timer); old.send(204); }
    const waiter = { send, timer: null };
    waiter.timer = timers.set(() => { if (slot.waiter === waiter) { slot.waiter = null; slot.seenAt = now(); send(204); } }, POLL_MS);
    slot.waiter = waiter;
    if (onClose) onClose(() => { if (slot.waiter === waiter) { slot.waiter = null; timers.clear(waiter.timer); } });
    pump(slot);
  }
  function ack(auth, jobId) {
    const slot = slotOf(auth.uid, auth.device.id); slot.seenAt = now();
    const job = slot.inflight;
    if (!job || job.id !== String(jobId || '') || job.done) return false;
    job.acked = true; timers.clear(job.ackTimer);
    return true;
  }
  function result(auth, jobId, status, body) {
    const slot = slotOf(auth.uid, auth.device.id); slot.seenAt = now();
    const job = slot.inflight;
    if (!job || job.id !== String(jobId || '')) return false;
    const answer = readAnswer(status, body);
    finish(job, answer.ok ? Object.assign(answer, { device: auth.device.name, model: job.payload.model }) : answer);
    return true;
  }

  // ── Запрос из приложения ──
  function available(uid) { return load(uid).devices.length > 0; }
  function complete(uid, system, messages, maxTokens, { images = null } = {}) {
    const store = load(uid);
    if (!store.devices.length) return Promise.resolve(fail('not_paired', 400));
    const ready = store.devices.filter((d) => {
      const m = (d.models || []).find((x) => x.name === d.model);
      return m && (!images || m.vision);
    });
    if (!ready.length) return Promise.resolve(images ? Object.assign(fail('no_vision', 400), { error: 'vision_unavailable' }) : fail('model_missing', 400));
    // Первый в сети по порядку; уснувший (не забрал или не подтвердил) — следующий, иначе «не в сети».
    return (async () => {
      const tried = new Set();
      for (;;) {
        const device = ready.find((d) => !tried.has(d.id) && online(uid, d.id));
        if (!device) return fail('offline', 503);
        tried.add(device.id);
        const r = await dispatch(uid, device, system, messages, maxTokens, images);
        if (r.reason !== 'unreachable') return r;
      }
    })();
  }
  function dispatch(uid, device, system, messages, maxTokens, images) {
    const payload = payloadFor(device.model, system, messages, maxTokens, images);
    if (payload.error) return Promise.resolve(fail(payload.error, 400));
    const slot = slotOf(uid, device.id);
    if ((slot.inflight ? 1 : 0) + slot.queue.length >= MAX_QUEUE) return Promise.resolve(fail('busy', 429));
    return new Promise((resolve) => {
      const job = { id: b64u(random(12)), payload, resolve, slot, picked: false, done: false };
      job.timer = timers.set(() => finish(job, fail('timeout', 504)), JOB_MS);
      job.pickTimer = timers.set(() => { if (!job.picked) { slot.seenAt = 0; finish(job, fail('unreachable', 503)); } }, PICKUP_MS);
      slot.queue.push(job);
      pump(slot);
    });
  }

  // ── Настройки ──
  function status(uid) {
    const store = load(uid);
    return {
      devices: store.devices.map((d) => ({ id: d.id, name: d.name, platform: d.platform || 'other', createdAt: d.createdAt || null,
        online: online(uid, d.id), model: d.model || null, models: (d.models || []).map((m) => ({ name: m.name, params: m.params, size: m.size, vision: m.vision })) })),
      pairing: store.pairing && store.pairing.expiresAt > now() ? { expiresAt: new Date(store.pairing.expiresAt).toISOString() } : null,
      maxDevices: MAX_DEVICES,
    };
  }
  function update(uid, { id, model, primary } = {}) {
    const store = load(uid), i = store.devices.findIndex((d) => d.id === id);
    if (i < 0) return { error: 'not_found' };
    const d = store.devices[i];
    if (model !== undefined) {
      if (!(d.models || []).some((m) => m.name === model)) return { error: 'bad_model' };
      d.model = model;
    }
    if (primary === true && i > 0) { store.devices.splice(i, 1); store.devices.unshift(d); }
    save(uid, store);
    return status(uid);
  }
  function revoke(uid, id) {
    const store = load(uid), before = store.devices.length;
    store.devices = store.devices.filter((d) => d.id !== id);
    if (store.devices.length === before) return { error: 'not_found' };
    save(uid, store);
    const slot = slots.get(`${uid}|${id}`);
    if (slot) {
      if (slot.inflight) finish(slot.inflight, fail('revoked', 410));
      for (const job of slot.queue.slice()) finish(job, fail('revoked', 410));
      if (slot.waiter) { const w = slot.waiter; slot.waiter = null; timers.clear(w.timer); w.send(410); }
      slots.delete(`${uid}|${id}`);
    }
    return status(uid);
  }
  function summary(uid) {
    const s = status(uid);
    return { configured: s.devices.length > 0, mode: 'paired', devices: s.devices.length, online: s.devices.filter((d) => d.online).length,
      model: (s.devices.find((d) => d.online && d.model) || s.devices.find((d) => d.model) || {}).model || null };
  }
  return Object.freeze({ startPairing, pair, authenticate, hello, next, ack, result, available, complete, status, update, revoke, summary });
}

module.exports = { FILE, PAIR_TTL_MS, ONLINE_MS, POLL_MS, PICKUP_MS, ACK_MS, JOB_MS, MAX_DEVICES, MAX_QUEUE, MAX_CHARS, localModels, payloadFor, readAnswer, create };
