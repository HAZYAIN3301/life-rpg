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
  appName: 'Life-RPG',
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

const State = {
  settings: null, tasks: null, days: null, habits: null, habitlog: null,
  goals: null, tree: null, rewards: null, purchases: null, achievements: null, weeks: null,
  timer: null, view: 'today', treeSkill: null, weekStart: null, goalFilter: 'all',
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
function questById(id) { return State.tasks.find((t) => t.id === id); }
function habitById(id) { return State.habits.find((h) => h.id === id); }
function goalById(id) { return State.goals.find((g) => g.id === id); }
function dayOf(t) { return t.completedAt ? t.completedAt.slice(0, 10) : t.date; }

// ---- Опыт, золото, уровни, перки ----
function needForLevel(level, base, growth) { return Math.round(base * Math.pow(growth, level - 1)); }
function levelInfo(totalXp, base, growth) {
  let level = 1, remaining = Math.max(0, Math.floor(totalXp)), need = needForLevel(level, base, growth);
  while (remaining >= need) { remaining -= need; level++; need = needForLevel(level, base, growth); }
  return { level, into: remaining, need, pct: need ? Math.round((remaining / need) * 100) : 0 };
}
function skillPerkBonus(id) { const t = State.tree && State.tree[id]; if (!t) return 0; return t.nodes.filter((n) => n.unlocked).reduce((s, n) => s + (n.perkXpPct || 0), 0); }
function itemXp(it) {
  const xp = State.settings.xp, mult = xp.difficulty[it.difficulty] ?? 1;
  const base = (Number(it.estimateMin) || 0) * xp.perMinute * mult + xp.completionBonus;
  return Math.max(1, Math.round(base * (1 + skillPerkBonus(it.skillId) / 100)));
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
  for (const g of State.goals || []) if (g.completedAt) { const xp = g.xpReward != null ? g.xpReward : GOAL_BONUS.xp; ev.push({ date: g.completedAt.slice(0, 10), skillId: g.skillId, xp, gold: Math.round(xp * 0.35), min: 0 }); }
  return ev;
}
function doneTasks() { return State.tasks.filter((t) => t.done); }
function overallXp() { return xpEvents().reduce((s, e) => s + e.xp, 0); }
function skillXp(id) { return xpEvents().reduce((s, e) => s + (e.skillId === id ? e.xp : 0), 0); }
function goldEarned() { return xpEvents().reduce((s, e) => s + e.gold, 0); }
function goldSpent() { return (State.purchases || []).reduce((s, p) => s + (p.cost || 0), 0); }
function goldBalance() { return Math.round(goldEarned() - goldSpent()); }
function charLevel() { const c = State.settings.curve; return levelInfo(overallXp(), c.base, c.growth).level; }
function skillLevelOf(id) { const c = State.settings.curve; return levelInfo(skillXp(id), c.skillBase, c.growth).level; }
function currentStreak() {
  const set = new Set(xpEvents().map((e) => e.date));
  let streak = 0, cursor = todayStr();
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  while (set.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  return streak;
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
function ensureTrees() { for (const s of State.settings.skills) if (!State.tree[s.id]) State.tree[s.id] = defaultTreeForSkill(s.id); }
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
//  Заголовок: персонаж
// ============================================================
function renderHeader() {
  const c = State.settings.curve, oi = levelInfo(overallXp(), c.base, c.growth), streak = currentStreak();
  const skills = State.settings.skills.map((s) => {
    const si = levelInfo(skillXp(s.id), c.skillBase, c.growth);
    return `<div class="skill-chip" title="${esc(s.name)}: ${skillXp(s.id)} XP">
      <span class="dot" style="background:${esc(s.color)}"></span>
      <span class="sk-name">${esc(s.name)}</span><span class="sk-lvl">ур.${si.level}</span>
      <span class="sk-bar"><span style="width:${si.pct}%;background:${esc(s.color)}"></span></span></div>`;
  }).join('');
  document.getElementById('appName').textContent = State.settings.appName || 'Life-RPG';
  document.getElementById('charSummary').innerHTML = `
    <div class="char-main">
      <div class="char-level">Уровень <b>${oi.level}</b></div>
      <div class="xp-bar"><span style="width:${oi.pct}%"></span><i>${oi.into} / ${oi.need} XP</i></div>
      <div class="gold-pill" title="Золото">🪙 ${goldBalance()}</div>
      <div class="streak">🔥 ${streak} ${plural(streak, 'день', 'дня', 'дней')}</div>
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
  const skillOpts = State.settings.skills.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const tm = State.timer, tmTask = tm ? questById(tm.taskId) : null;

  const timerCard = `<div class="card timer-card">
      <div class="timer-left"><div class="timer-clock" id="timer-clock">${fmtClock(timerElapsedMs())}</div>
        <div class="timer-task">${tm ? (tmTask ? '🎯 ' + esc(tmTask.title) : '(задача удалена)') : 'Таймер фокуса — нажми ▶ у квеста'}</div></div>
      <div class="timer-controls">${tm ? `${tm.running ? '<button class="btn ghost" data-action="timer-pause">⏸ Пауза</button>' : '<button class="btn" data-action="timer-resume">▶ Продолжить</button>'}<button class="btn" data-action="timer-stop">⏹ Стоп · записать</button><button class="btn ghost" data-action="open-pip" title="Плавающее окно поверх всех приложений">↗ Окно</button>` : ''}</div></div>`;

  const overdueCard = overdue.length ? `<div class="card overdue"><h3>⏳ Просрочено (${overdue.length})</h3>
      <ul class="tasks">${overdue.map(questRow).join('')}</ul>
      <button class="btn ghost" data-action="move-overdue" style="margin-top:10px">↪ Перенести всё на сегодня</button></div>` : '';

  return `${timerCard}
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
  const skillOpts = State.settings.skills.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
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
function renderTree() {
  if (!State.treeSkill || !State.tree[State.treeSkill]) State.treeSkill = State.settings.skills[0] && State.settings.skills[0].id;
  const id = State.treeSkill, sk = skillById(id), t = State.tree[id];
  const tabs = State.settings.skills.map((s) => `<button class="tree-tab ${s.id === id ? 'active' : ''}" data-action="select-tree" data-skill="${s.id}" style="--c:${esc(s.color)}">${esc(s.name)} <span class="muted">ур.${skillLevelOf(s.id)}</span></button>`).join('');
  if (!t) return `<div class="card">${tabs}</div>`;
  const avail = treePointsAvailable(id), NW = 150, NH = 70, SX = 194, SY = 112;
  const maxRow = Math.max(0, ...t.nodes.map((n) => n.row));
  const width = 2 * SX + NW, height = (maxRow + 1) * SY;
  const center = (n) => ({ x: n.col * SX + NW / 2, y: n.row * SY + NH / 2 });
  const lines = t.nodes.flatMap((n) => (n.requires || []).map((rid) => {
    const r = t.nodes.find((x) => x.id === rid); if (!r) return '';
    const a = center(r), b = center(n), on = r.unlocked && n.unlocked;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${on ? esc(sk.color) : 'var(--line)'}" stroke-width="${on ? 3 : 2}"/>`;
  })).join('');
  const nodes = t.nodes.map((n) => {
    const st = n.unlocked ? 'unlocked' : nodeUnlockable(id, n) ? 'available' : 'locked';
    return `<div class="tree-node ${st}" style="left:${n.col * SX}px;top:${n.row * SY}px;--c:${esc(sk.color)}" data-action="unlock-node" data-node="${n.id}">
      <div class="tn-title">${esc(n.title)}</div><div class="tn-desc">+${n.perkXpPct}% XP</div>
      <div class="tn-cost">${n.unlocked ? '✓ открыто' : '◈ ' + n.cost}</div></div>`;
  }).join('');
  return `
    <div class="card"><div class="tree-tabs">${tabs}</div></div>
    <div class="card">
      <div class="tree-head"><h3 style="margin:0">Дерево: ${esc(sk.name)}</h3>
        <div class="tree-points">Очков навыка: <b>${avail}</b> <span class="muted">(уровень навыка ${skillLevelOf(id)})</span></div></div>
      <p class="muted" style="font-size:12px">Открытые узлы дают пассивный бонус к опыту этой сферы. Очко даётся за каждый уровень навыка.</p>
      <div class="tree-scroll"><div class="tree" style="width:${width}px;height:${height}px">
        <svg class="tree-lines" width="${width}" height="${height}">${lines}</svg>${nodes}</div></div></div>`;
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
  const byArea = State.settings.skills.map((s) => ({ label: s.name, value: ev.filter((e) => e.skillId === s.id).reduce((a, e) => a + e.min, 0), color: s.color }));
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
  return `
    <div class="kpis">
      <div class="kpi"><div class="v">${charLevel()}</div><div class="l">Уровень персонажа</div></div>
      <div class="kpi"><div class="v">${overallXp()}</div><div class="l">Всего опыта</div></div>
      <div class="kpi"><div class="v">🪙 ${goldBalance()}</div><div class="l">Золото</div></div>
      <div class="kpi"><div class="v">🔥 ${currentStreak()}</div><div class="l">Серия дней</div></div>
      <div class="kpi"><div class="v">${doneTasks().length}</div><div class="l">Квестов выполнено</div></div>
      <div class="kpi"><div class="v">${rate}%</div><div class="l">Выполнение (14 дн.)</div></div>
    </div>
    <div class="card"><h3>Опыт за последние 14 дней</h3>${barChartSVG(xpByDay(14), 2)}</div>
    <div class="card"><h3>Время по сферам жизни — эта неделя</h3>${barChartSVG(timeByAreaThisWeek())}</div>
    <div class="card"><h3>Последняя рефлексия</h3>${reflections ? `<ul class="reflections">${reflections}</ul>` : '<p class="muted">Пока нет записей.</p>'}</div>`;
}

// ============================================================
//  Вид «Настройки»
// ============================================================
function renderSettings() {
  const s = State.settings;
  const f = s.focus || DEFAULT_SETTINGS.focus;
  const skillOpts = (sel) => s.skills.map((sk) => `<option value="${sk.id}" ${sk.id === sel ? 'selected' : ''}>${esc(sk.name)}</option>`).join('');
  const skills = s.skills.map((sk) => `<div class="skill-edit" data-id="${sk.id}"><input type="color" value="${esc(sk.color)}" data-field="color" /><input type="text" value="${esc(sk.name)}" data-field="name" /><button class="del" data-action="delete-skill" data-id="${sk.id}">✕</button></div>`).join('');
  const habits = State.habits.map((h) => `<div class="habit-edit" data-id="${h.id}">
      <input type="text" value="${esc(h.title)}" data-field="title" />
      <select data-field="skillId">${skillOpts(h.skillId)}</select>
      <select data-field="difficulty"><option value="easy" ${h.difficulty === 'easy' ? 'selected' : ''}>Лёгкая</option><option value="normal" ${h.difficulty === 'normal' ? 'selected' : ''}>Обычная</option><option value="hard" ${h.difficulty === 'hard' ? 'selected' : ''}>Сложная</option></select>
      <input type="number" min="0" step="5" value="${Number(h.estimateMin) || 0}" data-field="estimateMin" />
      <div class="weekdays">${WEEKDAYS.map((w) => `<label><input type="checkbox" data-day="${w.js}" ${(h.days || []).includes(w.js) ? 'checked' : ''}/>${w.label}</label>`).join('')}</div>
      <button class="del" data-action="delete-habit" data-id="${h.id}">✕</button></div>`).join('');
  return `
    <div class="card"><h3>Название</h3><input id="set-appName" type="text" value="${esc(s.appName)}" style="width:100%;max-width:340px" /></div>
    <div class="card"><h3>Навыки / сферы жизни</h3><div id="skills-list">${skills}</div><button class="btn ghost" data-action="add-skill" style="margin-top:6px">+ Добавить навык</button></div>
    <div class="card"><h3>🔁 Привычки (повторяющиеся)</h3><div id="habits-list">${habits || '<p class="muted">Пока нет привычек.</p>'}</div><button class="btn ghost" data-action="add-habit" style="margin-top:6px">+ Добавить привычку</button></div>
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
const VIEWS = { today: renderToday, goals: renderGoals, tree: renderTree, rewards: renderRewards, weekly: renderWeekly, stats: renderStats, settings: renderSettings };
function render() {
  renderHeader();
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === State.view));
  document.getElementById('main').innerHTML = (VIEWS[State.view] || renderToday)();
}

// ============================================================
//  События
// ============================================================
function onSubmit(e) {
  const f = e.target;
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
  if (navBtn) { State.view = navBtn.dataset.view; render(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action, id = el.dataset.id, today = todayStr();

  if (action === 'toggle-task') {
    const t = questById(id); if (!t) return;
    if (!t.done) { if (State.timer && State.timer.taskId === id) stopFocus(true, true); t.done = true; t.completedAt = new Date().toISOString(); t.xpAwarded = itemXp(t); t.goldAwarded = itemGold(t); toast(`+${t.xpAwarded} XP · +${t.goldAwarded} 🪙 · ${skillById(t.skillId).name}`); }
    else { t.done = false; t.completedAt = null; t.xpAwarded = 0; t.goldAwarded = 0; }
    Store.save('tasks', State.tasks); checkAchievements(); render();
  } else if (action === 'toggle-habit') {
    const h = habitById(id); if (!h) return;
    State.habitlog[today] = State.habitlog[today] || {};
    if (State.habitlog[today][id]) { delete State.habitlog[today][id]; if (!Object.keys(State.habitlog[today]).length) delete State.habitlog[today]; }
    else { State.habitlog[today][id] = { xp: itemXp(h), gold: itemGold(h), min: Number(h.estimateMin) || 0, at: new Date().toISOString() }; toast(`+${itemXp(h)} XP · +${itemGold(h)} 🪙 · ${skillById(h.skillId).name}`); }
    Store.save('habitlog', State.habitlog); checkAchievements(); render();
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
  } else if (action === 'select-tree') { State.treeSkill = el.dataset.skill; render();
  } else if (action === 'unlock-node') {
    const sid = State.treeSkill, node = State.tree[sid] && State.tree[sid].nodes.find((n) => n.id === el.dataset.node); if (!node) return;
    if (!nodeUnlockable(sid, node)) { toast('Не хватает очков или закрыты предыдущие узлы'); return; }
    node.unlocked = true; Store.save('skilltree', State.tree); toast(`Открыто: ${node.title} (+${node.perkXpPct}% XP)`); render();

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
    if (!confirm('Удалить навык?')) return; State.settings.skills = State.settings.skills.filter((x) => x.id !== id); Store.save('settings', State.settings); render();
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
  s.appName = document.getElementById('set-appName').value.trim() || 'Life-RPG';
  s.skills = [...document.querySelectorAll('#skills-list .skill-edit')].map((row) => ({ id: row.dataset.id, name: row.querySelector('[data-field="name"]').value.trim() || 'Без названия', color: row.querySelector('[data-field="color"]').value }));
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

function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}

// ============================================================
//  Старт
// ============================================================
async function init() {
  State.settings = await Store.load('settings', DEFAULT_SETTINGS);
  State.settings.appName = State.settings.appName || DEFAULT_SETTINGS.appName;
  State.settings.skills = State.settings.skills || structuredClone(DEFAULT_SETTINGS.skills);
  State.settings.xp = Object.assign({}, DEFAULT_SETTINGS.xp, State.settings.xp);
  State.settings.xp.difficulty = Object.assign({}, DEFAULT_SETTINGS.xp.difficulty, State.settings.xp.difficulty);
  State.settings.gold = Object.assign({}, DEFAULT_SETTINGS.gold, State.settings.gold);
  State.settings.curve = Object.assign({}, DEFAULT_SETTINGS.curve, State.settings.curve);
  State.settings.focus = Object.assign({}, DEFAULT_SETTINGS.focus, State.settings.focus);

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

  ensureTrees();
  State.treeSkill = State.settings.skills[0] && State.settings.skills[0].id;
  State.weekStart = weekStart(todayStr());
  State.timer = loadTimer();
  if (State.timer) { State.timer.phase = State.timer.phase || 'work'; if (State.timer.phaseStartElapsed === undefined) State.timer.phaseStartElapsed = 0; updatePill(focusInfo()); if (State.timer.running) startTick(); }
  checkAchievements(true);

  document.addEventListener('submit', onSubmit);
  document.addEventListener('click', onClick);
  render();
}

init();
