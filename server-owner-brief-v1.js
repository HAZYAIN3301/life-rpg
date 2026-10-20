'use strict';
/* Сводка для владельца — для утреннего брифинга Jarvis (OWNER-BRIEF-V1.md).
 *
 * Только числа: сколько людей, сколько новых, сколько Pro и триалов, сколько отзывов какого вида.
 * Ни текстов отзывов, ни id, ни почт: сводка уходит в Telegram, а там нет сквозного шифрования.
 * Доступ — Bearer-токен, на сервере хранится только его SHA-256 (OWNER_BRIEF_TOKEN_SHA256).
 */
const crypto = require('node:crypto');

const DAY = 86400000;
const KINDS = Object.freeze(['bug', 'idea', 'praise', 'other']);

/** users — users.json, feedback — feedback.json, entitlement — тот же расчёт тарифа, что у сервера. */
function brief({ users, feedback, entitlement, now = Date.now() }) {
  const within = (iso, ms) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t <= now && now - t < ms;
  };
  const people = Array.isArray(users) ? users : [];
  const notes = Array.isArray(feedback) ? feedback : [];
  // Админ всегда Pro (entitlement) — это создатель, а не подписчик; в тарифах его не считаем.
  const plans = { pro: 0, trial: 0 };
  for (const user of people) {
    if (!user || user.isAdmin) continue;
    const tier = entitlement(user).tier;
    if (tier === 'pro' || tier === 'trial') plans[tier] += 1;
  }
  const day = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const note of notes) if (note && within(note.at, DAY)) day[KINDS.includes(note.kind) ? note.kind : 'other'] += 1;
  return {
    v: 1,
    at: new Date(now).toISOString(),
    users: {
      total: people.length,
      new24h: people.filter((u) => u && within(u.createdAt, DAY)).length,
      new7d: people.filter((u) => u && within(u.createdAt, 7 * DAY)).length,
    },
    plans,
    feedback: { day, bugs7d: notes.filter((n) => n && n.kind === 'bug' && within(n.at, 7 * DAY)).length },
  };
}

/** Тот ли токен. Хэш не настроен или кривой — не пускаем никого. Сравнение постоянного времени. */
function tokenOk(authorization, sha256hex) {
  if (!/^[a-f0-9]{64}$/i.test(String(sha256hex || ''))) return false;
  const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(token).digest(), Buffer.from(sha256hex, 'hex'));
}

module.exports = { brief, tokenOk, KINDS };
