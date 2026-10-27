import { useEffect, useRef, useState } from 'react';
import { art, glyphs } from './SatoruAssets';
import { ClearIcon, hasClearIcon } from './ClearIcons';
const room = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/93644289290217a21020d498d4b32af4d2556491b0c47cd63372d6271be35898.webp";
const heroRest = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/8b49bdaf09af1261cbbbca5f803ce703f1c42b92c825c0ee7c4aaa8c08cee452.png";
const heroReadA = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/8e5dac27c29955085807a3fbf707f888a66a43172879f2a92ee0b6dacf9f1613.png";
const heroReadB = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/95071e68b1f57505bff3a8b13e81cf6d336867bb953725be5c3325117fba3685.png";
const pet = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/69e52128cfcb63124f2b8b8ce3d960477b6ea00df0c266b226a9045d69255039.png";
const petBlink = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/de0242879016da86324665abb40a081e019c4494001092e92f6ea3505c83a9d7.png";
const focusWork = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/43e1f84b034dbcafdc6baf831648f61b7b976a844cedb2bd684485abc44cad1a.png";
const focusCheck = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/c3a93bfc47c91f7f621e5b73074efb5a68482a938b21f2f019abe518cad908f6.png";
const focusNod = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/e0dff2de2fd6aacf400b4a189c559522595e359bed04184ec8a127da59b72197.png";
const spark = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/88394e10830d02f50c610754dc2f517bf29b6683a239738ed7702c6d3a2d7123.png";
const spirit = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/b0ee5cd0cabc95cdbe76c572202aea2fb8ad75f60bf7cfd6dd0d1d9cbe172549.png";
const guardian = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/0166ec3ffaa0cf5499128d05ad092bd81914b6fb690e362720e77ff8a0b840bc.png";
const keeper = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/465075406421258240/465075406421258241/444592ab00e796b399ac0eb671c720f0ba0e834dcdb6452ccbe61cc3b515830a.png";
export const forms = [spark, spirit, guardian, keeper];
export const formNames = ['Искра', 'Дух', 'Страж', 'Хранитель'];
export const heroImage = heroRest;
export const petImage = pet;
export function Icon({
  id,
  size = 22
}: {
  id: string;
  size?: number;
}) {
  if(hasClearIcon(id))return <ClearIcon id={id} size={size}/>;
  return art[id] ? <img className="wb-icon" width={size} height={size} src={art[id]} alt="" draggable={false} /> : <span className="wb-glyph" style={{
    width: size,
    height: size
  }} aria-hidden="true" dangerouslySetInnerHTML={{
    __html: glyphs[id] || glyphs['action.add'] || ''
  }} />;
}
export function Portrait({
  form = 1
}: {
  form?: number;
}) {
  return <span className="wb-portrait"><img src={forms[form]} alt="" draggable={false} /></span>;
}
export function Lair({
  working,
  paused,
  motion,
  form,
  onShadow,
  onOpen,
  onSeen
}: {
  working: boolean;
  paused: boolean;
  motion: boolean;
  form: number;
  onShadow: () => void;
  onOpen: () => void;
  onSeen: (v: boolean) => void;
}) {
  const [reading, setReading] = useState(false),
    [beat, setBeat] = useState(0),
    [greet, setGreet] = useState(false),
    [visible, setVisible] = useState(true),
    [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false),
    [docVisible, setDocVisible] = useState(!document.hidden);
  const target = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.intersectionRatio > .55);
      onSeen(e.intersectionRatio > .55);
    }, {
      threshold: [0, .55, 1]
    });
    if (target.current) io.observe(target.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const fn = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, []);
  useEffect(() => {
    if (!motion || !visible || !docVisible) return;
    const id = setInterval(() => setBeat(x => x + 1), 2200);
    return () => clearInterval(id);
  }, [motion, visible, docVisible]);
  useEffect(() => {
    if (!greet) return;
    const id = setTimeout(() => setGreet(false), 1200);
    return () => clearTimeout(id);
  }, [greet]);
  return <div className={'wb-lair ' + (working ? 'working ' : '') + (!motion || !visible || !docVisible ? 'still' : '')}><img src={room} className="wb-room" alt="Логово Satoru: камин, деревянная комната, окно" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />{!loaded && <span className="wb-loading">{failed ? 'Комната не загрузилась. Дела доступны.' : 'Открываем Логово…'}</span>}{working ? <button className="wb-pair" onClick={onOpen} aria-label="Герой и питомец работают вместе"><img src={paused ? focusCheck : [focusWork, focusCheck, focusNod][beat % 3]} alt="" /></button> : <><button className="wb-hero" onClick={() => setReading(x => !x)} aria-label={reading ? 'Герой читает — дать отдохнуть' : 'Герой — почитать у окна'}><img src={reading ? beat % 2 ? heroReadA : heroReadB : heroRest} alt="" /></button><button className={'wb-pet ' + (greet ? 'greet' : '')} onClick={() => setGreet(true)} aria-label="Поздороваться с питомцем"><img src={beat % 5 === 4 ? petBlink : pet} alt="" /></button></>}<button ref={target} className="wb-shadow-actor" onClick={onShadow} aria-label="Позвать Тень"><img src={forms[form]} alt="" draggable={false} /><span>{working ? 'Я рядом' : 'Поговорим?'}</span></button><div className="wb-scene-foot"><span>{working ? paused ? 'Минутка тишины' : 'Работаем вместе' : reading ? 'Тихое время' : 'Все дома'}</span><button onClick={onOpen} aria-label="Открыть Логово"><Icon id="action.expand" size={18} /></button></div></div>;
}
