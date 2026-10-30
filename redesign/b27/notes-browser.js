/* Local presentation only. Existing inbox owners retain every write and media action. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SatoruNotesBrowser=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const kinds=['all','text','voice','video'];
 const fold=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
 function select(notes,{query='',kind='all'}={}){
  const list=(Array.isArray(notes)?notes:[]).filter(n=>n&&typeof n.id==='string'),terms=fold(query).trim().split(/\s+/).filter(Boolean),counts={all:list.length,text:0,voice:0,video:0};
  const type=n=>['voice','video'].includes(n.kind)?n.kind:'text';for(const n of list)counts[type(n)]++;
  return {counts,ids:list.filter(n=>(!kinds.includes(kind)||kind==='all'||type(n)===kind)&&terms.every(w=>fold(n.text).includes(w))).map(n=>n.id)};
 }
 function prepare(host,notes,state,t,searchIcon){
  const screen=host.querySelector('.notes-screen'),list=screen?.querySelector('.notes-list');if(!list)return;
  let tools=screen.querySelector('.b218-notes-tools');
  if(!tools){tools=host.ownerDocument.createElement('div');tools.className='b218-notes-tools';
   tools.innerHTML='<div class="b218-notes-search"><span class="notes-search-icon" aria-hidden="true"></span><label class="sr-only" for="b218-notes-query"></label><input id="b218-notes-query" type="search" autocomplete="off"><button type="button" data-notes-clear></button></div><div class="b218-notes-filter-row"><div class="b218-notes-kinds" role="group"></div><output data-notes-count aria-live="polite" aria-atomic="true"></output></div>';
   list.before(tools);
   const empty=host.ownerDocument.createElement('div');empty.className='b218-notes-empty';empty.dataset.notesEmpty='';empty.innerHTML='<h3></h3><p></p><button type="button" data-notes-reset></button><button type="button" data-notes-new></button>';list.after(empty);
  }
  tools.querySelector('.notes-search-icon').innerHTML=searchIcon;
  tools.querySelector('label').textContent=t('Поиск заметок');
  const input=tools.querySelector('input');input.value=String(state.query||'');input.placeholder=t('Найти заметку…');
  tools.querySelector('[data-notes-clear]').textContent=t('Очистить');
  tools.querySelector('[data-notes-clear]').setAttribute('aria-label',t('Очистить поиск'));
  const group=tools.querySelector('[role=group]');group.setAttribute('aria-label',t('Формат заметок'));
  if(!group.children.length)for(const [kind,title] of [['all','Все'],['text','Текст'],['voice','Аудио'],['video','Видео']]){const button=host.ownerDocument.createElement('button');button.type='button';button.dataset.notesKind=kind;button.dataset.title=title;group.append(button);}
  for(const button of group.children)button.dataset.label=t(button.dataset.title);
  list.querySelector('.notes-empty')?.remove();
 }
 function bind(host,notes,state,t){
  const tools=host.querySelector('.b218-notes-tools'),empty=host.querySelector('[data-notes-empty]');if(!tools||!empty)return;
  if(!kinds.includes(state.kind))state.kind='all';
  const input=tools.querySelector('input');if(input.value!==String(state.query||''))input.value=String(state.query||'');
  function apply(){
   const result=select(typeof notes==='function'?notes():notes,state),visible=new Set(result.ids),total=result.counts.all;
   for(const card of host.querySelectorAll('.note-card')){card.hidden=!visible.has(card.dataset.id);if(card.hidden)for(const media of card.querySelectorAll('audio,video'))if(!media.paused)media.pause();}
   tools.hidden=!total;tools.querySelector('[data-notes-clear]').hidden=!state.query;
   for(const button of tools.querySelectorAll('[data-notes-kind]')){button.textContent=button.dataset.label+' '+result.counts[button.dataset.notesKind];button.setAttribute('aria-pressed',String(state.kind===button.dataset.notesKind));}
   tools.querySelector('output').textContent=t('Найдено заметок')+': '+result.ids.length+' / '+total;
   empty.hidden=!!result.ids.length;empty.querySelector('h3').textContent=t(total?'Ничего не найдено':'Пока нет заметок');
   empty.querySelector('p').textContent=t(total?'Попробуй другой запрос или формат.':'Запиши мысль текстом, голосом или на видео.');
   empty.querySelector('[data-notes-reset]').hidden=!total;empty.querySelector('[data-notes-reset]').textContent=t('Сбросить фильтры');
   empty.querySelector('[data-notes-new]').hidden=!!total;empty.querySelector('[data-notes-new]').textContent=t('Записать первую мысль');
  }
  const click=e=>{const button=e.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-notes-kind'))state.kind=button.dataset.notesKind;
   else if(button.hasAttribute('data-notes-reset')){state.kind='all';state.query='';input.value='';}
   else if(button.hasAttribute('data-notes-clear')){state.query='';input.value='';}
   else if(button.hasAttribute('data-notes-new')){host.querySelector('#capture-text')?.focus();return;}else return;
   apply();if(!button.hasAttribute('data-notes-kind'))input.focus();
  };
  tools.oninput=e=>{if(e.target===input){state.query=input.value;apply();}};tools.onclick=click;empty.onclick=click;apply();
 }
 return {select,prepare,bind};
});
