(function(root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/ё/g, 'е');
  let savedQuery = '';
  function rank(query, items) {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return items.map(item => {
      const title = normalize(item.title), text = normalize(item.text);
      const score = words.reduce((n, word) => n + (title.includes(word) ? 5 : text.includes(word) ? 1 : 0), 0);
      return {...item, score};
    }).filter(item => item.score > 0).sort((a,b) => b.score - a.score).slice(0, 8);
  }
  const copy = {
    search: ['Search settings', 'Поиск настроек', 'Einstellungen suchen', 'Пошук налаштувань', 'Buscar ajustes'],
    ai: ['Find with AI', 'Найти с ИИ', 'Mit KI suchen', 'Знайти з ШІ', 'Buscar con IA'],
    hint: ['AI receives your query and setting names, not their values.', 'ИИ получит запрос и названия настроек, без их значений.', 'Die KI erhält deine Suche und Einstellungsnamen, keine Werte.', 'ШІ отримає запит і назви налаштувань, без їхніх значень.', 'La IA recibe tu consulta y nombres de ajustes, no sus valores.'],
    empty: ['No matches. Try another phrase.', 'Не найдено. Попробуй другие слова.', 'Keine Treffer. Versuche andere Wörter.', 'Не знайдено. Спробуй інші слова.', 'Sin resultados. Prueba otras palabras.'],
    failed: ['AI search is unavailable. Text search still works.', 'ИИ-поиск недоступен. Обычный поиск работает.', 'KI-Suche nicht verfügbar. Die Textsuche funktioniert weiterhin.', 'ШІ-пошук недоступний. Звичайний пошук працює.', 'La búsqueda con IA no está disponible. Usa la búsqueda de texto.'],
    busy: ['Searching…', 'Ищу…', 'Suche…', 'Шукаю…', 'Buscando…'],
    device: ['Device and sign-in', 'Устройство и вход', 'Gerät und Anmeldung', 'Пристрій і вхід', 'Dispositivo e inicio de sesión'],
    deviceInfo: ['Notifications, app lock with Face ID or Touch ID, Apple sign-in and device sessions.', 'Уведомления, защита приложения через Face ID или Touch ID, вход Apple и сеансы устройств.', 'Mitteilungen, App-Sperre mit Face ID oder Touch ID, Apple-Anmeldung und Gerätesitzungen.', 'Сповіщення, захист застосунку через Face ID або Touch ID, вхід Apple і сеанси пристроїв.', 'Notificaciones, bloqueo con Face ID o Touch ID, acceso con Apple y sesiones de dispositivos.'],
    apple: ['Continue with Apple', 'Продолжить с Apple', 'Mit Apple fortfahren', 'Продовжити з Apple', 'Continuar con Apple'],
    google: ['Continue with Google', 'Продолжить с Google', 'Mit Google fortfahren', 'Продовжити з Google', 'Continuar con Google'],
    linked: ['For an existing linked Satoru account.', 'Для уже привязанного аккаунта Satoru.', 'Für ein bereits verbundenes Satoru-Konto.', 'Для вже прив’язаного акаунта Satoru.', 'Para una cuenta de Satoru ya vinculada.'],
    actions: ['Quick actions', 'Быстрые действия', 'Schnellaktionen', 'Швидкі дії', 'Acciones rápidas'],
    capture: ['Capture', 'Записать', 'Erfassen', 'Записати', 'Anotar'],
    gate: ['Start with intention', 'Начать с намерения', 'Mit Absicht beginnen', 'Почати з наміром', 'Empezar con intención'],
    return: ['Return', 'Вернуться', 'Zurückkehren', 'Повернутися', 'Volver'],
    finish: ['Finish session', 'Завершить сессию', 'Sitzung beenden', 'Завершити сесію', 'Terminar sesión'],
    dayrec: ['Review day', 'Итоги дня', 'Tagesrückblick', 'Підсумки дня', 'Resumen del día'],
  };
  function mount(options) {
    const index = Math.max(0, ['en','ru','de','uk','es'].indexOf(options.language));
    const text = key => copy[key][index];
    const bridge = root.webkit?.messageHandlers?.satoruShell;
    if (bridge) bridge.postMessage({language: options.language});
    const login = document.getElementById('login-form');
    if (bridge && login && !document.getElementById('native-sign-in')) {
      const box = document.createElement('div'); box.id = 'native-sign-in'; box.className = 'settings-discovery-auth';
      login.before(box);
      fetch('/api/auth/oauth/providers').then(r => r.ok ? r.json() : {providers:[]}).then(data => {
        if (!box.isConnected) return;
        for (const provider of (data.providers || []).filter(p => ['apple','google'].includes(p))) {
          const button = document.createElement('button'); button.type='button'; button.className='btn ghost'; button.textContent=text(provider);
          button.onclick=()=>bridge.postMessage({action:provider}); box.append(button);
        }
        if (box.children.length) { const hint=document.createElement('p'); hint.className='muted'; hint.textContent=text('linked'); box.append(hint); }
      }).catch(()=>{});
    }
    const topbar = document.getElementById('topbar');
    const previousMenu = document.getElementById('native-quick-actions');
    if (previousMenu?.dataset.language !== options.language) previousMenu?.remove();
    if (bridge && topbar && !document.getElementById('native-quick-actions')) {
      const menu=document.createElement('details'); menu.id='native-quick-actions'; menu.className='settings-discovery-actions';
      menu.dataset.language=options.language;
      const summary=document.createElement('summary'); summary.textContent=text('actions'); menu.append(summary);
      const list=document.createElement('div'); menu.append(list);
      for (const action of ['capture','gate','return','finish','dayrec']) {
        const button=document.createElement('button'); button.type='button'; button.className='btn ghost'; button.textContent=text(action);
        button.onclick=()=>{menu.open=false; options.entry(action);}; list.append(button);
      }
      menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;summary.focus();}});
      topbar.append(menu);
    }
    const shell = document.querySelector('.settings-shell');
    if (!shell || shell.querySelector('.settings-discovery')) return;
    if (bridge) {
      const card=document.createElement('div'); card.className='card';
      const title=document.createElement('h3'); title.textContent=text('device'); card.append(title);
      const info=document.createElement('p'); info.className='muted'; info.textContent=text('deviceInfo'); card.append(info);
      const button=document.createElement('button'); button.type='button'; button.className='btn ghost'; button.textContent=text('device')+' · Face ID / Touch ID · Apple';
      button.onclick=()=>bridge.postMessage({action:'settings'}); card.append(button);
      shell.querySelector('.settings-group[data-settings-group="account"] .settings-group-head').after(card);
    }
    const items=Array.from(shell.querySelectorAll('.settings-group .card')).map(node=>{
      const heading=node.querySelector(':scope > summary, h3,h4,h2');
      const title=heading?.textContent.trim() || '', group=node.closest('.settings-group').dataset.settingsGroup;
      return {id:group+'|'+title,title,text:node.textContent,group,node};
    }).filter(item=>item.title);
    const bar=document.createElement('div'); bar.className='settings-discovery'; bar.dataset.noi18n='';
    const label=document.createElement('label'); label.textContent=text('search');
    const input=document.createElement('input'); input.type='search'; input.maxLength=240; input.placeholder=text('search'); label.append(input); bar.append(label);
    const ai=document.createElement('button'); ai.type='button'; ai.className='btn ghost'; ai.textContent=text('ai'); bar.append(ai);
    const hint=document.createElement('p'); hint.className='muted'; hint.textContent=text('hint'); bar.append(hint);
    const status=document.createElement('p'); status.role='status'; status.setAttribute('aria-live','polite'); bar.append(status);
    const results=document.createElement('div'); results.className='settings-discovery-results'; bar.append(results);
    shell.querySelector('.settings-hub').append(bar);
    let generation=0, controller;
    function show(found) {
      results.replaceChildren();
      for (const item of found) {
        const button=document.createElement('button'); button.type='button'; button.className='btn ghost'; button.textContent=item.title;
        button.onclick=()=>options.open(item.group,item.id); results.append(button);
      }
      status.textContent=found.length ? '' : text('empty');
    }
    input.value=savedQuery;
    if(savedQuery.trim())show(rank(savedQuery,items));
    input.oninput=()=>{savedQuery=input.value;generation++;controller?.abort();ai.disabled=false; status.textContent='';results.replaceChildren(); if(input.value.trim())show(rank(input.value,items));};
    ai.onclick=async()=>{
      const query=input.value.trim(); if(!query){input.focus();return;}
      const current=++generation; controller?.abort();controller=new AbortController();ai.disabled=true;status.textContent=text('busy');
      try {
        // Never include field values, account data or text content in the AI prompt.
        const ids=await options.ai(query,items.map(({id,title})=>({id,title})),controller.signal);
        if(current!==generation || !bar.isConnected)return;
        const found=Array.from(new Set(ids)).map(id=>items.find(item=>item.id===id)).filter(Boolean).slice(0,8);
        show(found);
      } catch { if(current===generation && bar.isConnected)status.textContent=text('failed'); }
      finally {if(current===generation)ai.disabled=false;}
    };
    if (options.target != null) {
      const item=items.find(i=>i.id===options.target);
      if(item){
        for(let ancestor=item.node;ancestor && ancestor!==shell;ancestor=ancestor.parentElement) {
          if(ancestor.tagName==='DETAILS')ancestor.open=true;
        }
        item.node.tabIndex=-1;item.node.focus({preventScroll:true});item.node.scrollIntoView({block:'start',behavior:'instant'});
      }
    }
  }
  const api={rank,mount}; if(typeof module==='object')module.exports=api; else root.SettingsDiscoveryV1=api;
})(typeof window==='object'?window:globalThis);
