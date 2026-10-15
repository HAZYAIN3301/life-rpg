(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PartyWorldUIV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const places=Object.freeze([
    {id:'den',x:23,y:20,doorX:26,doorY:24},
    {id:'room',x:76,y:20,doorX:70,doorY:24},
    {id:'forest',x:22,y:43,doorX:30,doorY:50},
    {id:'sessions',x:77,y:43,doorX:68,doorY:50},
    {id:'cave',x:25,y:66,doorX:30,doorY:75},
    {id:'arena',x:78,y:66,doorX:68,doorY:75},
  ].map(Object.freeze));
  const copy={
    map:['Карта','Map','Karte','Мапа','Mapa'],world:['Долина своих','Our valley','Unser Tal','Долина своїх','Nuestro valle'],
    den:['Логово','My Den','Mein Versteck','Лігво','Mi Guarida'],room:['Общий дом','Shared home','Gemeinschaftshaus','Спільний дім','Casa común'],
    forest:['Лес','Forest','Wald','Ліс','Bosque'],sessions:['Казарма','Barracks','Kaserne','Казарма','Cuartel'],
    cave:['Пещера','Cave','Höhle','Печера','Cueva'],arena:['Арена','Arena','Arena','Арена','Arena'],
    friends:['Друзья','Friends','Freunde','Друзі','Amigos'],back:['К карте','Back to map','Zur Karte','До мапи','Volver al mapa'],
    choose:['Выбери место — отправимся туда.','Choose a place — let’s go.','Wähle einen Ort — los geht’s.','Обери місце — вирушаймо.','Elige un lugar y vamos.'],
    denHint:['Твоё место и твои вещи.','Your space and your belongings.','Dein Ort und deine Dinge.','Твоє місце й твої речі.','Tu espacio y tus cosas.'],
    roomHint:['Обустраивайте дом вместе.','Make a home together.','Gestaltet euer Zuhause zusammen.','Облаштовуйте дім разом.','Cread un hogar juntos.'],
    forestHint:['Настоящие дела открывают путь.','Real effort opens the path.','Echte Schritte öffnen den Weg.','Справжні справи відкривають шлях.','Tu esfuerzo abre el camino.'],
    sessionsHint:['Одно дело — в компании друга.','Work on a task with a friend.','Eine Aufgabe mit einem Freund angehen.','Одна справа — з другом поруч.','Una tarea junto a un amigo.'],
    caveHint:['Встретьте стража своей командой.','Face the guardian as a team.','Stellt euch gemeinsam dem Wächter.','Зустріньте вартового командою.','Enfrentaos juntos al guardián.'],
    arenaHint:['Общий вклад и награда недели.','Shared progress and a weekly reward.','Gemeinsamer Fortschritt und Wochenbelohnung.','Спільний внесок і нагорода тижня.','Progreso común y recompensa semanal.'],
    locked:['Сначала завершите одну вылазку.','Complete one expedition first.','Schließt zuerst eine Expedition ab.','Спершу завершіть одну вилазку.','Completad primero una expedición.'],
    toForest:['К вылазке','Go on an expedition','Zur Expedition','До вилазки','Ir de expedición'],
    loading:['Загружаем компанию…','Loading your group…','Gruppe wird geladen…','Завантажуємо компанію…','Cargando el grupo…'],
    invite:['Пригласи друга','Invite a friend','Lade einen Freund ein','Запроси друга','Invita a un amigo'],
    company:['Здесь начинается ваше приключение.','Your adventure together starts here.','Hier beginnt euer gemeinsames Abenteuer.','Тут починається ваша пригода.','Aquí empieza vuestra aventura.'],
    building:['Строительство','Building projects','Bauprojekte','Будівництво','Construcción'],
    collection:['Предметы в доме','Items in the house','Dinge im Haus','Речі в домі','Objetos de la casa'],
    details:['Подробности','Details','Details','Подробиці','Detalles'],
  };
  const text=(key,lang)=>(copy[key]||copy.map)[{ru:0,en:1,de:2,uk:3,es:4}[lang]??1];
  const valid=id=>id==='map'||id==='friends'||places.some(p=>p.id===id);
  function createNavigation(){
    let account='',party,location='map',point={x:50,y:90},ticket=0;
    function reset(){location='map';point={x:50,y:90};ticket++;}
    return {
      sync({userId,epoch,group}){
        const key=String(userId||'')+':'+String(epoch||0);
        if(key!==account){account=key;party=undefined;reset();}
        if(group!==null&&group!==undefined){const next=group?.id||false;if(party&&party!==next)reset();party=next;}
      },
      location:()=>location,point:()=>({...point}),cancel:()=>{ticket++;},
      go(id){if(!valid(id))return false;ticket++;location=id;return true;},
      begin(id){const target=places.find(p=>p.id===id);if(!target)return null;return {id,token:++ticket,from:{...point},to:{x:target.doorX,y:target.doorY}};},
      finish(move){if(!move||move.token!==ticket)return false;point={...move.to};location=move.id;return true;},
    };
  }
  function createUI(d){
    const nav=createNavigation(),e=d.escape,t=k=>text(k,d.lang());let focusNext=false,animation=null;
    function sync(){const s=d.state();nav.sync({userId:s.me?.id,epoch:d.epoch(),group:s.party});}
    const location=()=>{sync();return nav.location();};
    function go(id,focus=true){sync();animation?.cancel();if(!nav.go(id))return;focusNext=focus;d.navigate(id);}
    function backButton(){return `<button type="button" class="btn ghost" data-world="map">← ${t('back')}</button>`;}
    function map(){sync();const p=d.state().party,at=nav.point();return `<section class="party-world" aria-labelledby="party-world-title"><header class="world-header"><h2 id="party-world-title" tabindex="-1">${e(p?.name||t('world'))}</h2><button type="button" class="btn ghost" data-world="friends">${t('friends')}</button></header><div class="world-field" role="group" aria-label="${e(t('map'))}"><img class="world-landscape" src="/art/party-world-v1/valley.png" alt="" fetchpriority="high">${places.map(p=>`<button type="button" class="world-place" style="--x:${p.x}%;--y:${p.y}%" data-world-walk="${p.id}" aria-label="${e(t(p.id)+'. '+t(p.id+'Hint'))}"><span>${t(p.id)}</span></button>`).join('')}<span class="world-traveller" data-gender="${d.gender()==='female'?'female':'male'}" style="left:${at.x}%;top:${at.y}%" aria-hidden="true"><span class="world-chibi"><img src="/art/party-world-v1/travellers.png" alt=""></span></span></div><p class="world-hint" role="status">${t('choose')}</p></section>`;}
    function panel(content){const id=location();return `<section class="world-interior" data-world-location="${id}" aria-labelledby="world-place-title"><header class="world-interior-header">${backButton()}<h2 id="world-place-title" tabindex="-1">${t(id)}</h2></header>${content}</section>`;}
    function afterCommit(){
      if(d.state().view!=='party'&&d.state().view!=='den')nav.cancel();
      if(focusNext){focusNext=false;const el=document.querySelector('#world-place-title,#party-world-title');el?.focus({preventScroll:true});el?.closest('section')?.scrollIntoView({block:'start',behavior:'instant'});}
    }
    async function handle(event){
      const b=event.target.closest('[data-world],[data-world-walk]');if(!b)return false;event.preventDefault();sync();
      if(b.dataset.world){go(b.dataset.world);return true;}
      animation?.cancel();const move=nav.begin(b.dataset.worldWalk);if(!move)return true;
      const hint=document.querySelector('.world-hint');if(hint)hint.textContent=t(move.id+'Hint');
      const el=document.querySelector('.world-traveller');
      if(el&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        el.classList.add('is-walking');
        animation=el.animate([{left:move.from.x+'%',top:move.from.y+'%'},{left:'50%',top:move.from.y+'%'},{left:'50%',top:move.to.y+'%'},{left:move.to.x+'%',top:move.to.y+'%'}],{duration:700,easing:'ease-in-out',fill:'forwards'});
        const currentAnimation=animation;try{await currentAnimation.finished;}catch{}
        if(animation!==currentAnimation)return true;
        el.classList.remove('is-walking');
      }
      sync();if(d.state().view==='party'&&nav.finish(move)){focusNext=true;d.navigate(move.id);}return true;
    }
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&d.state().view==='party'&&location()!=='map'&&!document.querySelector('[role="dialog"],dialog[open],.modal-overlay')){event.preventDefault();go('map');}});
    return {map,panel,location,go,sync,handle,afterCommit,backButton,text:t};
  }
  return Object.freeze({places,text,createNavigation,createUI});
});
