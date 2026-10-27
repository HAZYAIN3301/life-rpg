import {heroImage,forms,petImage} from '../components/generated/B2Scene';
import './start-screen.css';
const room='https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/93644289290217a21020d498d4b32af4d2556491b0c47cd63372d6271be35898.webp';
const copy={
  ru:{title:'Твои дела.\nТвой мир.',body:'Планируй день, выполняй квесты и развивай героя.',login:'С возвращением',register:'Начни свою историю',language:'На каком языке начнём?',reset:'Вернёмся в твой мир',password:'Новый пароль',signin:'Войти',signup:'Начать путь',show:'Показать пароль',hide:'Скрыть пароль',scene:'Логово Satoru',demo:'Открыть тестового героя',languageLabel:'Язык'},
  en:{title:'Your day.\nYour world.',body:'Plan your day, complete quests and grow your hero.',login:'Welcome back',register:'Start your story',language:'Which language shall we use?',reset:'Find your way back',password:'A new password',signin:'Sign in',signup:'Begin your journey',show:'Show password',hide:'Hide password',scene:'Satoru lair',demo:'Open the test hero',languageLabel:'Language'},
  de:{title:'Dein Tag.\nDeine Welt.',body:'Plane deinen Tag, erledige Quests und entwickle deinen Helden.',login:'Willkommen zurück',register:'Beginne deine Geschichte',language:'In welcher Sprache starten wir?',reset:'Zurück in deine Welt',password:'Ein neues Passwort',signin:'Anmelden',signup:'Jetzt beginnen',show:'Passwort anzeigen',hide:'Passwort verbergen',scene:'Satoru-Zuflucht',demo:'Testheld öffnen',languageLabel:'Sprache'},
  uk:{title:'Твої справи.\nТвій світ.',body:'Плануй день, виконуй квести й розвивай героя.',login:'З поверненням',register:'Почни свою історію',language:'Якою мовою почнемо?',reset:'Повернімося у твій світ',password:'Новий пароль',signin:'Увійти',signup:'Почати шлях',show:'Показати пароль',hide:'Приховати пароль',scene:'Лігво Satoru',demo:'Відкрити тестового героя',languageLabel:'Мова'},
  es:{title:'Tu día.\nTu mundo.',body:'Planifica tu día, completa misiones y desarrolla a tu héroe.',login:'Te damos la bienvenida',register:'Empieza tu historia',language:'¿En qué idioma empezamos?',reset:'Vuelve a tu mundo',password:'Una nueva contraseña',signin:'Entrar',signup:'Empieza tu camino',show:'Mostrar contraseña',hide:'Ocultar contraseña',scene:'Refugio Satoru',demo:'Abrir héroe de prueba',languageLabel:'Idioma'},
};
declare global{interface Window{SatoruStartView:{mount:(phase:string,language:string)=>void;hide:()=>void;changeLanguage:(code:string)=>void}}}
const el=(tag:string,cls:string,text?:string)=>{const node=document.createElement(tag);node.className=cls;if(text)node.textContent=text;return node;};
const languages=[['en','English'],['ru','Русский'],['uk','Українська'],['de','Deutsch'],['es','Español']];
window.SatoruStartView={
  changeLanguage:()=>{},
  hide(){document.body.classList.remove('b29-start');},
  mount(phase,language){
    const box=document.querySelector<HTMLElement>('#app .auth-box');
    if(!box||box.closest('.start-screen'))return;
    const c=copy[language as keyof typeof copy]||copy.en;
    document.documentElement.removeAttribute('data-design');
    document.body.classList.add('b29-start');
    const app=document.getElementById('app')!,frame=el('div','wb palette-ink start-screen');
    const header=el('header','start-header'),brand=el('div','start-brand');brand.append(el('span','start-mark','?'),document.createTextNode('satoru'));
    const languageLabel=el('label','start-language'),select=document.createElement('select');select.setAttribute('aria-label',c.languageLabel);
    for(const [code,name]of languages){const option=document.createElement('option');option.value=code;option.textContent=name;option.selected=code===language;select.append(option);}
    select.addEventListener('change',()=>window.SatoruStartView.changeLanguage(select.value));
    languageLabel.append(select);header.append(brand,languageLabel);
    const world=el('section','start-world'),intro=el('div','start-intro');intro.append(el('h1','',c.title),el('p','',c.body));
    const scene=el('div','start-scene');scene.setAttribute('role','img');scene.setAttribute('aria-label',c.scene);
    for(const [src,cls]of [[room,'start-room'],[heroImage,'start-hero'],[petImage,'start-pet'],[forms[0],'start-shadow']]){const img=document.createElement('img');img.src=src;img.alt='';img.className=cls;img.draggable=false;scene.append(img);}
    world.append(intro,scene);
    const panel=el('main','start-panel'),heading=el('h2','start-title',phase==='login'?c.login:phase==='register'?c.register:phase==='register-language'?c.language:phase==='reset-token'?c.password:c.reset);
    heading.id='start-title';panel.setAttribute('aria-labelledby',heading.id);
    if(phase==='login'){
      const modes=el('nav','start-modes');modes.setAttribute('aria-label',c.signin+' / '+c.signup);
      for(const [action,text,active]of [['go-login',c.signin,true],['go-register',c.signup,false]] as const){const b=document.createElement('button');b.type='button';b.dataset.action=action;b.textContent=text;if(active)b.setAttribute('aria-current','page');modes.append(b);}
      panel.append(modes);
      box.querySelector('.auth-cta')?.remove();box.querySelector('.auth-or')?.remove();box.querySelector('.auth-links [data-action=go-register]')?.remove();
      const demo=box.querySelector<HTMLElement>('[data-action=test-login]');if(demo){const details=document.createElement('details'),summary=document.createElement('summary');details.className='start-test';summary.textContent=c.demo;details.append(summary,demo);box.append(details);}
    }
    panel.append(heading,box);
    // Never allow a native GET fallback to put credentials into the URL,
    // including if the legacy runtime fails before binding its submit listener.
    box.querySelectorAll<HTMLFormElement>('form').forEach(form=>{form.method='post';form.addEventListener('submit',event=>event.preventDefault());});
    // Keep the original nodes, IDs, field names and submit listeners intact.
    // Passwords are never copied into state, telemetry or browser storage.
    for(const input of box.querySelectorAll<HTMLInputElement>('input[type=password]')){
      const shell=el('div','start-password');input.replaceWith(shell);shell.append(input);
      const button=document.createElement('button');button.type='button';button.className='start-password-toggle';button.setAttribute('aria-label',c.show);button.setAttribute('aria-pressed','false');
      button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
      button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?c.hide:c.show);button.setAttribute('aria-pressed',String(show));});shell.append(button);
      // Wrapping a field would otherwise break the legacy label linker.
      const label=shell.previousElementSibling;
      if(label instanceof HTMLLabelElement){if(!input.id)input.id='start-'+(input.form?.id||phase)+'-'+input.name;label.htmlFor=input.id;}
    }
    box.querySelectorAll<HTMLElement>('.pin-error').forEach(n=>{n.setAttribute('role','alert');n.setAttribute('aria-live','polite');});
    const avatarLabel=({ru:'Образ',en:'Origin',de:'Figur',uk:'Образ',es:'Personaje'} as Record<string,string>)[language]||'Origin';
    box.querySelectorAll<HTMLButtonElement>('[data-action=pick-avatar]').forEach((button,index)=>{button.setAttribute('aria-label',avatarLabel+' '+(index+1));button.setAttribute('aria-pressed',String(button.classList.contains('sel')));});
    frame.append(header,world,panel);
    const toasts=document.getElementById('toasts');
    app.replaceChildren(frame);if(toasts)app.append(toasts);
  }
};
