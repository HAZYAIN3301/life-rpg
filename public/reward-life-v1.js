(function(root) {
  'use strict';
  const states = ['received', 'planned', 'used', 'deferred'];
  const labels = {
    title: ['Полученные награды','Your rewards','Deine Belohnungen','Отримані нагороди','Tus recompensas'],
    received: ['Получено','Received','Erhalten','Отримано','Recibida'],
    planned: ['Запланировано','Planned','Geplant','Заплановано','Planificada'],
    used: ['Использовано','Used','Genutzt','Використано','Utilizada'],
    deferred: ['Отложено','Deferred','Verschoben','Відкладено','Pospuesta'],
    plan: ['Запланировать','Plan','Planen','Запланувати','Planificar'],
    use: ['Я воспользовался','I used it','Ich habe sie genutzt','Я скористався','La he utilizado'],
    defer: ['Отложить','Defer','Verschieben','Відкласти','Posponer'],
    restore: ['Вернуть в полученные','Back to received','Zurück zu erhalten','Повернути в отримані','Volver a recibidas'],
    date: ['Дата для себя','Your planned date','Dein geplanter Tag','Дата для себе','Tu fecha prevista'],
    note: ['Золото уже потрачено. Эти отметки ничего не списывают и не возвращают. Реальные расходы, если они есть, нужно обеспечить отдельно.', 'Gold was already spent. These updates neither charge nor refund it. Any real-world costs need a separate budget.', 'Das Gold wurde bereits ausgegeben. Diese Angaben kosten nichts und erstatten nichts. Reale Ausgaben benötigen ein eigenes Budget.', 'Золото вже витрачено. Ці відмітки нічого не списують і не повертають. Реальні витрати, якщо вони є, потребують окремого бюджету.', 'El oro ya se gastó. Estos cambios no cobran ni reembolsan oro. Los gastos reales necesitan un presupuesto aparte.'],
    due: ['Ты запланировал награду','You planned a reward','Du hast eine Belohnung geplant','Ти запланував нагороду','Has planificado una recompensa'],
    open: ['Открыть награды','Open rewards','Belohnungen öffnen','Відкрити нагороди','Abrir recompensas'],
    error: ['Сохранение не подтверждено. Повтори то же действие или обнови страницу.', 'Save not confirmed. Retry the same action or reload.', 'Speicherung nicht bestätigt. Aktion wiederholen oder neu laden.', 'Збереження не підтверджено. Повтори ту саму дію або онови сторінку.', 'Guardado no confirmado. Repite la acción o recarga.'],
    saved: ['Сохранено','Saved','Gespeichert','Збережено','Guardado'],
    more: ['Остальные награды','More rewards','Weitere Belohnungen','Інші нагороди','Más recompensas'],
  };
  const text = (k,l) => labels[k][({ru:0,en:1,de:2,uk:3,es:4})[l] ?? 1];
  const personal = p => p && typeof p.id === 'string' && p.id && typeof p.rewardId === 'string' && p.rewardId;
  const date = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  function valid(value) {
    return value === undefined || value && typeof value === 'object' && !Array.isArray(value)
      && Object.values(value).every(r => r && states.includes(r.status) && (r.date === null || date(r.date)) && Number.isFinite(Date.parse(r.updatedAt)));
  }
  function change(settings, purchases, id, status, day, now) {
    if (!valid(settings.rewardLifeV1) || !purchases.some(p => personal(p) && p.id === id) || !states.includes(status)
      || status === 'planned' && !date(day) || !Number.isFinite(Date.parse(now))) throw Error('reward_life_request');
    const next = structuredClone(settings);
    next.rewardLifeV1 = { ...(next.rewardLifeV1 || {}), [id]: { status, date: status === 'planned' ? day : null, updatedAt: now } };
    return next;
  }
  function create(d) {
    const t = k => text(k,d.lang()), e = d.escape;
    let busy = false, attempt = null, message = '', identity = '';
    function scope() { const id = d.identity(); if (id !== identity) { identity=id; attempt=null; message=''; busy=false; } return id; }
    function items() { return (d.state().purchases || []).filter(personal).slice().reverse(); }
    function today() {
      scope(); const life = d.state().settings?.rewardLifeV1;
      if (!valid(life)) return '';
      const p = items().find(p => life?.[p.id]?.status === 'planned' && life[p.id].date <= d.today());
      return p ? `<button class="duo-today" data-reward-life="open"><span><b>${t('due')}</b><small data-noi18n>${e(p.name)}</small></span><span>${t('open')}</span></button>` : '';
    }
    function body() {
      scope(); if (!items().length) return '';
      const life = d.state().settings?.rewardLifeV1;
      if (!valid(life)) return `<section class="card"><p role="alert">${t('error')}</p></section>`;
      const card = p => { const r = life && Object.hasOwn(life,p.id) ? life[p.id] : {status:'received'}, disabled = busy ? 'disabled' : '';
        return `<article class="reward-life-item" data-reward-id="${e(p.id)}"><h4 data-noi18n>${e(p.name)}</h4><p>${t(r.status)}${r.date ? ' · '+e(r.date) : ''}</p>
        ${r.status === 'used' || r.status === 'deferred' ? `<button class="btn ghost" data-reward-life="received" ${disabled}>${t('restore')}</button>` : `<label>${t('date')}<input type="date" data-reward-date value="${e(attempt?.id === p.id && attempt.status === 'planned' ? attempt.day : r.date || d.today())}" ${disabled}></label><div class="reward-life-actions"><button class="btn ghost" data-reward-life="planned" ${disabled}>${t('plan')}</button><button class="btn" data-reward-life="used" ${disabled}>${t('use')}</button><button class="btn ghost" data-reward-life="deferred" ${disabled}>${t('defer')}</button></div>`}</article>`; };
      const rows = items();
      return `<section class="card reward-life" tabindex="-1"><h3>${t('title')}</h3><p class="muted">${t('note')}</p><p role="status" aria-live="polite">${e(message)}</p><div class="reward-life-grid">${rows.slice(0,6).map(card).join('')}</div>${rows.length>6?`<details><summary>${t('more')} · ${rows.length-6}</summary><div class="reward-life-grid">${rows.slice(6).map(card).join('')}</div></details>`:''}</section>`;
    }
    async function handle(event) {
      const b = event.target.closest('[data-reward-life]'); if (!b) return false;
      event.preventDefault(); scope();
      if (b.dataset.rewardLife === 'open') { d.open(); return true; }
      if (busy) return true;
      const host = b.closest('[data-reward-id]'), id = host?.dataset.rewardId, status=b.dataset.rewardLife, day=host?.querySelector('[data-reward-date]')?.value || null;
      const key=JSON.stringify([identity,id,status,status === 'planned' ? day : null]), captured=identity;
      try {
        if (attempt && attempt.key !== key) { message=t('error'); d.render(); return true; }
        if (!attempt) attempt={ key, id, status, day, data:{ settings:change(d.state().settings,d.state().purchases,id,status,day,new Date().toISOString()) } };
        busy=true; message=''; d.render(); const pending=attempt;
        const ok=await d.commit(pending.data); if (scope()!==captured) return true;
        if (ok) { d.state().settings=pending.data.settings; attempt=null; message=t('saved'); } else message=t('error');
      } catch { if (scope()===captured) message=t('error'); }
      finally { if (scope()===captured) { busy=false; d.render(); document.querySelector('.reward-life')?.focus(); } }
      return true;
    }
    return {body,today,handle};
  }
  root.RewardLifeV1 = {change,valid,create,text};
  if (typeof module === 'object') module.exports=root.RewardLifeV1;
})(typeof window === 'undefined' ? globalThis : window);
