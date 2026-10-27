import { WorldWorkspace } from './WorldWorkspace';
import { TimeWorkspace } from './TimeWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';
import { trackFocus } from './TimeModel';
import type { SettingsGroup } from './TimeModel';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as PE } from 'react';
import { Task, Goal, Habit, Note, Reward, Data, uid, day, shift, label, spheres, sphere, sphereOptions, newTask, award, completeTask, undoTask, loadData, saveData, boardOffers, KEY } from './B2Model';
import { Icon, Lair, Portrait, formNames, heroImage, petImage } from './B2Scene';
import { QuestForm, GoalForm, HabitForm, NoteForm, RewardForm, Field } from './B2Forms';
import { Capture, MediaPlayer, putMedia } from './B2Media';
import { rewardCatalog } from './SatoruAssets';
import './B2Workbench.css';
import { PlanWorkspace } from './PlanWorkspace';
import { habitLog, saveTask as savePlanTask, validDate, finish, saveGoal } from './PlanModel';
import { TaskEditor, GoalEditor } from './PlanForms';
import { DailyData, elapsedMs, startFocus, pauseFocus, stopFocus, reconcileDaily, persistDaily } from './DailyModel';
import { RewardsWorkspace } from './RewardsWorkspace';
import { TodayDashboard, DayReview } from './TodayDashboard';
import { withExamples } from './ReviewExamples';
import { FocusDock } from './FocusDock';
import { QuestBoard } from './QuestBoard';
import './B24.css';
import './TimeSettings.css';
import { duration } from './PlanModel';
import { ActualTimeForm } from './ActualTimeForm';
type Panel = {
  kind: string;
  id?: string;
  value?: any;
};
const tabs = [['today', 'Сегодня', 'nav.today'], ['plan', 'План', 'nav.plan'], ['world', 'Мир', 'nav.lair'], ['rewards', 'Награды', 'nav.rewards'], ['tribe', 'Племя', 'nav.tribe']];
const paletteNames: Record<string, string> = {
  ink: 'Чернила',
  forest: 'Лес',
  stone: 'Тёплый камень'
};
function Segments({
  values,
  value,
  onChange,
  label: aria
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return <div className="wb-segments" role="group" aria-label={aria}>{values.map(v => <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{v}</button>)}</div>;
}
function Empty({
  title,
  body,
  action,
  onAction
}: {
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return <div className="wb-empty"><h3>{title}</h3>{body && <p>{body}</p>}{action && <button className="wb-primary" onClick={onAction}>{action}</button>}</div>;
}
function Scope({
  ids,
  background = []
}: {
  ids: string[];
  background?: string[];
}) {
  return <span className="wb-scopes">{ids.slice(0, 2).map(id => <span key={id}><i style={{
        background: sphere(id).color
      }} />{sphere(id).name.split(' › ').at(-1)}</span>)}{ids.length > 2 && <span>+{ids.length - 2}</span>}{background.length > 0 && <span title={background.map(id => sphere(id).name).join(', ')}>+{background.length} сопутств.</span>}</span>;
}
export function B2Workbench() {
  useEffect(() => {
    document.title = 'Satoru B2.7 — Время и настройки';
  }, []);
  const [initial] = useState(()=>{const loaded=loadData();if(!loaded.error&&!localStorage.getItem(KEY))loaded.data=withExamples(loaded.data);return loaded;});
  const [data, setData] = useState<DailyData>(initial.data),
    state = useRef(data);
  const stored = useRef<string | null | undefined>(undefined);
  if (stored.current === undefined) {
    try {
      stored.current = localStorage.getItem(KEY);
    } catch {
      stored.current = null;
    }
  }
  const [error, setError] = useState(initial.error);
  const utilityRoutes = ['time', 'settings'];
  const returnStack = useRef<{route:string;mode?:string}[]>([]);
  const [settingsGroup, setSettingsGroup] = useState<SettingsGroup|null>(null);
  const [timeMode, setTimeMode] = useState('Фокус');
  const [route, setRoute] = useState([...tabs.map(t=>t[0]),...utilityRoutes].includes(location.hash.slice(1).split('/')[0]) ? location.hash.slice(1).split('/')[0] : 'today'),
    [todayMode, setTodayMode] = useState('День'),
    [planMode, setPlanMode] = useState(['Календарь', 'Цели', 'Привычки', 'Вдохновение'][Number(location.hash.split('/')[1])] || 'Календарь'),
    [period, setPeriod] = useState('Неделя'),
    [selected, setSelected] = useState(() => {
      const raw = location.hash.split('/')[2];
      return validDate(raw || '') ? raw : day();
    }),
    [rewardMode, setRewardMode] = useState('Мои награды'),
    [habitMode, setHabitMode] = useState('Привычки'),
    [goalMode, setGoalMode] = useState('Сейчас'),
    [worldMode, setWorldMode] = useState('Логово');
  const [panel, setPanel] = useState<Panel | null>(null),
    [toast, setToast] = useState(''),
    [celebrate, setCelebrate] = useState<{
      id:string;
      title: string;
      xp: number;
      gold: number;
    } | null>(null),
    [form, setForm] = useState(1),
    [sceneSeen, setSceneSeen] = useState(true),
    [tick, setTick] = useState(0);
  const [draft, setDraft] = useState(''),
    [messages, setMessages] = useState([{
      from: 'shadow',
      text: 'Я рядом. Выберем следующее дело?'
    }]),
    [noteQuery, setNoteQuery] = useState(''),
    [catalogQuery, setCatalogQuery] = useState(''),
    [bubble, setBubble] = useState<{
      x: number;
      y: number;
    } | null>(null),
    [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null),
    chatLog = useRef<HTMLDivElement>(null),
    audioContext = useRef<AudioContext | null>(null),
    drag = useRef<{
      x: number;
      y: number;
      left: number;
      top: number;
      moved: boolean;
    } | null>(null);
  const focus = data.focus;
  const [rewardEntry, setRewardEntry] = useState('');
  const [entryGoal, setEntryGoal] = useState('');
  const today = day(),
    todayTasks = data.tasks.filter(t => t.date === today),
    done = todayTasks.filter(t => t.done),
    cores = todayTasks.filter(t => t.core && !t.done),
    normal = todayTasks.filter(t => !cores.includes(t)),
    todayHabits = data.habits.filter(h => !h.paused && h.days.includes(new Date().getDay()));
  const showScene = route === 'today' && todayMode === 'День' || route === 'world' && worldMode === 'Логово';
  const showBubble = (!showScene || !sceneSeen) && !panel;
  const elapsed = elapsedMs(focus);
  const time = `${String(Math.floor(elapsed / 60000)).padStart(2, '0')}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`;
  void tick;
  function commit(fn: (d: DailyData) => DailyData) {
    if (initial.error) {
      setError(initial.error);
      return false;
    }
    try {
      const next = trackFocus(state.current, reconcileDaily(state.current, fn(state.current)));
      stored.current = persistDaily(next, stored.current ?? null);
      state.current = next;
      setData(next);
      setError('');
      return true;
    } catch (e) {
      setError(e instanceof DOMException ? 'Не удалось сохранить. Изменение не применено. Освободи место в браузере и повтори.' : (e as Error).message || 'Сохранение не подтверждено. Повтори действие.');
      return false;
    }
  }
  function tell(text: string) {
    setToast(text);
  }
  useEffect(() => {
    const restoreRoute = () => {
      const [requested, mode, date] = location.hash.slice(1).split('/');
      if ([...tabs.map(t=>t[0]),...utilityRoutes].includes(requested)) setRoute(requested);
      if (requested === 'plan') {
        setPlanMode(['Календарь', 'Цели', 'Привычки', 'Вдохновение'][Number(mode)] || 'Календарь');
        if (validDate(date || '')) setSelected(date);
      }
      setPanel(null);
    };
    addEventListener('popstate', restoreRoute);
    addEventListener('hashchange', restoreRoute);
    return () => {
      removeEventListener('popstate', restoreRoute);
      removeEventListener('hashchange', restoreRoute);
    };
  }, []);
  const purchasePending = useRef(false);
  function open(kind: string, id?: string, value?: any) {
    if(kind==='settings'){setPanel(null);setSettingsGroup(null);go('settings');return;}
    if(kind==='time'){setPanel(null);setTimeMode(value||'Фокус');go('time');return;}
    if(kind==='attention'){setPanel(null);setTimeMode('Внимание');go('time');return;}
    purchasePending.current = false;
    opener.current = document.activeElement as HTMLElement;
    setPanel({
      kind,
      id,
      value
    });
  }
  function close() {
    setPanel(null);
    requestAnimationFrame(() => opener.current?.isConnected && opener.current.focus());
  }
  function utilityBack(){const prev=returnStack.current.pop();go(prev?.route||'plan',prev?.mode,true);}
  function focusSettings(){setSettingsGroup('focus');go('settings');}
  function go(to: string, mode?: string, returning=false) {
    if(!returning){if(utilityRoutes.includes(to)){if(to!==route)returnStack.current.push({route,mode:route==='plan'?planMode:undefined});}else returnStack.current=[];}
    setPanel(null);
    setRoute(to);
    history.pushState(null, '', '#' + to + (to === 'plan' ? '/' + ['Календарь', 'Цели', 'Привычки', 'Вдохновение'].indexOf(mode || planMode) : ''));
    setSceneSeen(true);
    if (to === 'today' && mode) setTodayMode(mode);
    if (to === 'plan' && mode) setPlanMode(mode);
    requestAnimationFrame(() => scroll.current?.scrollTo({
      top: 0
    }));
  }
  function sound() {
    if (!state.current.sound) return;
    try {
      const C = window.AudioContext || (window as any).webkitAudioContext;
      if (!C) return;
      const c = audioContext.current || (audioContext.current = new C());
      void c.resume();
      [523.25, 659.25].forEach((f, i) => {
        const o = c.createOscillator(),
          g = c.createGain(),
          at = c.currentTime + i * .07;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(.0001, at);
        g.gain.exponentialRampToValueAtTime(.055, at + .015);
        g.gain.exponentialRampToValueAtTime(.0001, at + .23);
        o.connect(g);
        g.connect(c.destination);
        o.start(at);
        o.stop(at + .25);
      });
    } catch {/* visual receipt remains */}
  }
  function editQuest(t?: Task) {
    open('quest', t?.id, t || newTask('', route === 'plan' ? selected : today));
  }
  function saveQuest(t: Task) {
    const duplicate = t.source && state.current.tasks.find(x => x.source === t.source && x.id !== t.id);
    if (duplicate) {
      close();
      tell('Этот материал уже связан с квестом: ' + duplicate.title);
      return false;
    }
    const exists = state.current.tasks.some(x => x.id === t.id);
    if (commit(d => ({
      ...savePlanTask(d, t),
      notes: t.source?.startsWith('note:') ? d.notes.map(n => n.id === t.source!.slice(5) ? {
        ...n,
        converted: 'квест'
      } : n) : d.notes
    }))) {
      close();
      tell(exists ? 'Квест обновлён' : 'Квест добавлен' + (t.date ? ' · ' + label(t.date, true) : ' без даты'));
      sound();
      return true;
    }
    return false;
  }
  function requestComplete(t: Task) {
    if (t.done) {
      if (commit(d => finish(d, t.id, t.actual || 0, false))) tell('Выполнение отменено, начисление снято');
      return;
    }
    const actual=focus?.id===t.id?Math.min(1440,Math.max(1,Math.round(elapsed/60000))):t.actual??t.minutes;
    finishTask(t,actual);
  }
  function finishTask(t: Task, actual: number, reflection = '') {
    if (state.current.tasks.find(x => x.id === t.id)?.done) {
      close();
      return;
    }
    if (commit(d => {
      const next = finish(d, t.id, actual);
      return {
        ...next,
        tasks: next.tasks.map(x => x.id === t.id ? {
          ...x,
          reflection: reflection === 'Без оценки' ? '' : reflection
        } : x)
      };
    })) {
      close();
      setCelebrate({
        id:t.id,
        title: t.title,
        ...award(t)
      });
      sound();
    }
  }
  function start(t: Task) {
    if (state.current.focus && state.current.focus.id !== t.id) {
      open('focus');
      return;
    }
    if (commit(d => startFocus(d, t.id))) tell('Фокус · ' + t.title);
  }
  function pause() {
    commit(d => pauseFocus(d));
  }
  function callShadow() {
    commit(d => ({
      ...d,
      care: today
    }));
    open('shadow');
  }
  function noteTo(n: Note, kind: string) {
    const existing = state.current.tasks.find(t => t.source === 'note:' + n.id);
    if (kind === 'quest' && existing) {
      editQuest(existing);
      return;
    }
    if (n.converted?.startsWith('цель:')) {
      const goal = state.current.goals.find(g => g.id === n.converted!.slice(5));
      if (goal) {
        setEntryGoal(goal.id);
        go('plan', 'Цели');
        return;
      }
    }
    if (n.converted && kind === 'goal') {
      tell('Эта заметка уже преобразована. Связанный квест можно открыть здесь.');
      return;
    }
    if (kind === 'quest') {
      const t = {
        ...newTask(n.text || 'Разобрать ' + (n.kind === 'video' ? 'видеозаметку' : 'голосовую заметку')),
        source: 'note:' + n.id
      };
      open('quest', undefined, t);
    } else open('goal', undefined, {
      id: uid(),
      title: n.text.slice(0, 140) || 'Разобрать заметку',
      description: n.text,
      project: '',
      horizon: 'Месяц',
      deadline: '',
      primary: ['mind'],
      steps: [],
      done: false,
      noteSource: n.id
    });
  }
  function newNote() {
    open('note', undefined, {
      id: uid(),
      text: '',
      kind: 'text',
      created: new Date().toISOString()
    });
  }
  function newGoal() {
    open('goal', undefined, {
      id: uid(),
      title: '',
      description: '',
      project: '',
      horizon: 'Месяц',
      deadline: '',
      primary: ['work'],
      steps: [],
      done: false
    });
  }
  function newHabit() {
    open('habit', undefined, {
      id: uid(),
      title: '',
      minutes: 10,
      days: [0, 1, 2, 3, 4, 5, 6],
      sphere: 'mind',
      identity: '',
      cue: '',
      twoMin: '',
      reward: '',
      logs: [],
      paused: false
    });
  }
  function toggleHabit(h: Habit) {
    const completed = h.logs.includes(today);
    if (commit(d => habitLog(d, h.id, today, false, today))) {
      tell(completed ? 'Отметка убрана' : 'Привычка отмечена · ещё один день практики');
      if (!completed) sound();
    }
  }
  function down(e: PE<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect(),
      p = root.current!.getBoundingClientRect();
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: r.left - p.left,
      top: r.top - p.top,
      moved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PE<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) < 7 && !d.moved) return;
    d.moved = true;
    setDragging(true);
    const r = root.current!.getBoundingClientRect();
    setBubble({
      x: Math.max(8, Math.min(r.width - 66, d.left + dx)),
      y: Math.max(8, Math.min(r.height - 152, d.top + dy))
    });
  }
  function up(e: PE<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.moved) {
      const w = root.current!.clientWidth;
      setBubble(p => p ? {
        x: p.x < w / 2 ? 8 : w - 66,
        y: p.y
      } : null);
      e.preventDefault();
    } else callShadow();
  }
  useEffect(() => {
    if (!focus?.running) return;
    const id = setInterval(() => setTick(x => x + 1), 500);
    return () => clearInterval(id);
  }, [focus?.running]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(null), 6500);
    return () => clearTimeout(id);
  }, [celebrate]);
  useEffect(() => {
    const d = dialog.current;
    if (panel && !d?.open) {
      d?.showModal();
      requestAnimationFrame(() => d?.querySelector<HTMLElement>('input:not([type=hidden]),textarea')?.focus());
    }
    if (!panel && d?.open) d.close();
  }, [panel]);
  useEffect(() => {
    const fn = () => setBubble(null);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  useEffect(() => {
    if (panel?.kind === 'shadow' && chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [messages, panel]);
  function taskRow(t: Task, core = false) {
    return <article className={'wb-task ' + (t.done ? 'done ' : '') + (core ? 'core' : '')} key={t.id}><button className="wb-check" aria-label={(t.done ? 'Отменить выполнение: ' : 'Выполнить: ') + t.title} aria-pressed={t.done} onClick={() => requestComplete(t)}>{t.done && <Icon id="action.check" size={18} />}</button><div className="wb-task-copy"><button className="wb-task-title" onClick={() => editQuest(t)}>{t.title}</button><div className="wb-task-meta"><Icon id={'difficulty.' + t.difficulty} size={22} /><Scope ids={t.primary} background={t.background} /><span>{t.start ? t.start + ' · ' : ''}{t.done&&t.actual!==null&&t.actual!==t.minutes?duration(t.actual)+' / '+duration(t.minutes):duration(t.minutes)}</span></div>{core && <div className="wb-core-action">{focus?.id === t.id ? <><b className="wb-timer">{time}</b><button onClick={pause}><Icon id={focus.running ? 'media.pause' : 'media.play'} />{focus.running ? 'Пауза' : 'Продолжить'}</button><button onClick={() => requestComplete(t)} aria-label="Завершить фокус"><Icon id="action.check" /></button></> : <button className="wb-primary" onClick={() => start(t)}><Icon id="media.play" size={18} />Начать фокус</button>}</div>}</div><button className="b24-edit-task" aria-label={'Изменить квест: '+t.title} onClick={()=>editQuest(t)}><Icon id="action.edit" size={18}/></button>{!core && !t.done && <button className="wb-row-action" aria-label={'Фокус: ' + t.title} onClick={() => start(t)}><Icon id="media.play" size={18} /></button>}</article>;
  }
  const taskList = (items: Task[]) => items.length ? items.map(t => taskRow(t)) : <Empty title="Пока свободно" action="Добавить квест" onAction={() => editQuest()} />;
  const habitRow = (h: Habit) => <div className="wb-habit-row" key={h.id}><button className="wb-check" aria-pressed={h.logs.includes(today)} aria-label={'Отметить привычку: ' + h.title} onClick={() => toggleHabit(h)}>{h.logs.includes(today) && <Icon id="action.check" size={18} />}</button><button className="wb-row-copy" onClick={() => open('habit', h.id, h)}><strong>{h.title}</strong><small>{(h as any).records?.[today]?.minutes ?? h.minutes} мин · {h.twoMin}</small></button></div>;
  const notesView = <><div className="wb-section-head"><h2>Заметки <small>{data.notes.length}</small></h2><button className="wb-primary" onClick={newNote}><Icon id="action.add" />Заметка</button></div><input className="wb-search" aria-label="Найти заметку" placeholder="Найти мысль" value={noteQuery} onChange={e => setNoteQuery(e.target.value)} />{data.notes.length === 0 ? <Empty title="Освободи голову" body="Текст, голос или видео. Из любой заметки можно сделать квест или цель." action="Записать мысль" onAction={newNote} /> : data.notes.filter(n => n.text.toLowerCase().includes(noteQuery.toLowerCase())).map(n => <article className="wb-note" key={n.id}><div className="wb-note-meta"><Icon id={n.kind === 'video' ? 'media.video' : n.kind === 'voice' ? 'media.microphone' : 'media.notes'} /><small>{label(n.created.slice(0, 10), true)} · {n.kind === 'text' ? 'Текст' : n.kind === 'video' ? 'Видео' : 'Аудио'}</small><button aria-label="Редактировать заметку" onClick={() => open('note', n.id, n)}><Icon id="action.edit" /></button></div><p>{n.text || 'Запись без подписи'}</p>{n.media && <MediaPlayer id={n.media} kind={n.kind} />}<div className="wb-actions"><button onClick={() => noteTo(n, 'quest')}>{data.tasks.some(t => t.source === 'note:' + n.id) ? 'Открыть квест' : 'В квест'}</button><button onClick={() => noteTo(n, 'goal')}>{n.converted?.startsWith('цель:') ? 'Открыть цель' : 'В цель'}</button><button aria-label="Удалить заметку" onClick={() => open('delete', n.id, {
          type: 'note',
          title: n.text || 'Запись'
        })}><Icon id="action.delete" /></button></div></article>)}</>;
  const boardView=<QuestBoard data={data} take={t=>open('quest',undefined,t)} edit={editQuest} hide={id=>commit(d=>({...d,boardHidden:[...d.boardHidden,id]}))} restore={()=>commit(d=>({...d,boardHidden:[]}))}/>;
  function rewardsView() {
    return <RewardsWorkspace data={data} commit={commit} onTask={editQuest} onComplete={requestComplete} entry={rewardEntry} onEntryHandled={() => setRewardEntry('')} />;
  }
  function worldView() {
    return <WorldWorkspace data={data} commit={commit} mode={worldMode} onMode={setWorldMode} onTask={editQuest} onToday={() => go('today', 'День')} onReview={() => open('review')} shadow={callShadow} form={form} onForm={setForm} />;
  }
  const currentTask = panel?.id ? data.tasks.find(t => t.id === panel.id) : undefined,
    currentGoal = panel?.id ? data.goals.find(g => g.id === panel.id) : undefined;
  function panelBody(): ReactNode {
    if (!panel) return null;
    switch (panel.kind) {
      case 'quest':
        return <TaskEditor key={panel.value.id} initial={panel.value} data={data} draftKey={data.tasks.some(t => t.id === panel.value.id) ? 'task-' + panel.value.id : panel.value.source ? 'task-source-' + panel.value.source : 'task-new'} onSave={saveQuest} onDelete={data.tasks.some(t => t.id === panel.value.id) ? () => open('delete', panel.value.id, {
          type: 'task',
          title: panel.value.title
        }) : undefined} />;
      case 'focus':
        return focus ? <><h3>{data.tasks.find(t => t.id === focus.id)?.title}</h3><p className="wb-timer">{time}</p><button className="wb-primary wb-wide" onClick={pause}>{focus.running ? 'Пауза' : 'Продолжить'}</button><button className="wb-wide" onClick={() => {
            const t = data.tasks.find(t => t.id === focus.id);
            if (t) requestComplete(t);
          }}>Завершить квест</button><button className="wb-wide" onClick={() => {
            if (commit(d => stopFocus(d))) {
              close();
              tell('Время сохранено. Квест остаётся незавершённым.');
            }
          }}>Остановить таймер</button><button className="wb-wide" onClick={()=>open('time')}>Время и история сессий</button><p className="rw-note">Накопленное время сохранится в квесте. При новом запуске отсчёт продолжится. Золото начисляется только при завершении.</p></> : null;
      case 'actual':
        return currentTask?<ActualTimeForm task={currentTask} save={actual=>{if(commit(d=>({...d,tasks:d.tasks.map(t=>t.id===currentTask.id?{...t,actual}:t)}))){close();tell('Фактическое время обновлено');}}}/>:null;
      case 'complete':
        return currentTask ? <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          finishTask(currentTask, Number(f.get('actual')), String(f.get('reflection') || ''));
        }}><h3>{currentTask.title}</h3><Field label="Фактически потрачено, минут"><input name="actual" type="number" required min="0" max="1440" defaultValue={panel.value.actual} /></Field>{currentTask.difficulty === 'hard' && <Field label="Как далось · необязательно"><select name="reflection" defaultValue={currentTask.reflection || 'Без оценки'}><option>Без оценки</option><option>Легче, чем ожидал</option><option>По плану</option><option>Было непросто</option></select></Field>}<div className="wb-gain"><span><Icon id="status.xp" size={36} />+{award(currentTask).xp} XP</span><span><Icon id="status.gold" size={36} />+{award(currentTask).gold}</span></div><small>Награда рассчитана по плану и сложности. Фактическое время сохраняется отдельно.</small><button className="wb-primary wb-wide">Выполнено</button></form> : null;
      case 'note':
        return <NoteForm key={panel.value.id} initial={panel.value} isNew={!data.notes.some(n => n.id === panel.value.id)} onSave={n => {
          const ok = commit(d => ({
            ...d,
            notes: d.notes.some(x => x.id === n.id) ? d.notes.map(x => x.id === n.id ? n : x) : [n, ...d.notes]
          }));
          if (ok) {
            close();
            tell('Заметка сохранена');
            sound();
          }
          return ok;
        }} />;
      case 'goal':
        return <GoalEditor key={panel.value.id} initial={panel.value} data={data} onSave={g => {
          const source = panel.value.noteSource;
          const ok = commit(d => ({
            ...saveGoal(d, g),
            notes: source ? d.notes.map(n => n.id === source ? {
              ...n,
              converted: 'цель:' + g.id
            } : n) : d.notes
          }));
          if (ok) {
            close();
            setEntryGoal(g.id);
            go('plan', 'Цели');
            tell('Цель сохранена');
          }
          return ok;
        }} />;
      case 'habit':
        return <HabitForm key={panel.value.id} initial={panel.value} onSave={h => {
          if (commit(d => ({
            ...d,
            habits: d.habits.some(x => x.id === h.id) ? d.habits.map(x => x.id === h.id ? h : x) : [...d.habits, h]
          }))) {
            close();
            tell('Привычка сохранена');
          }
        }} />;
      case 'review':
        return <DayReview data={data} onSave={text => {
          const ok = commit(d => ({
            ...d,
            reviews: {
              ...d.reviews,
              [today]: text
            }
          }));
          if (ok) {
            close();
            tell('Итог дня сохранён');
          }
          return ok;
        }} onVoice={newNote} onPlan={() => {
          close();
          go('plan', 'Календарь');
        }} />;
      case 'shadow':
        return <><div className="wb-shadow-intro"><Portrait form={form} /><div><h3>Тень рядом</h3><small>Демо-диалог · сценарные ответы</small></div></div><div ref={chatLog} className="wb-chat" aria-live="polite">{messages.map((m, i) => <p key={i} className={m.from === 'you' ? 'you' : ''}>{m.text}</p>)}</div><div className="wb-actions"><button onClick={() => setDraft('Что осталось на сегодня?')}>Мой день</button><button onClick={() => setDraft('Хочу отдохнуть')}>Выдохнуть</button></div><form className="wb-chat-form" onSubmit={e => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            const pending = data.tasks.filter(t => t.date === today && !t.done);
            setMessages(ms => [...ms, {
              from: 'you',
              text
            }, {
              from: 'shadow',
              text: /отдых|устал|пауз/i.test(text) ? 'Можно сделать паузу. Личные награды доступны внизу — и отдыхать можно без покупки.' : pending.length ? 'На сегодня осталось ' + pending.length + ' квеста. Ближайший: «' + pending[0].title + '». Откроем его?' : 'На сегодня все дела закрыты. Можно подвести итог или сохранить мысль.'
            }]);
            setDraft('');
          }}><input aria-label="Сообщение Тени" placeholder="Напиши Тени" value={draft} onChange={e => setDraft(e.target.value)} /><button className="wb-primary" disabled={!draft.trim()}>Отправить</button></form><button className="wb-wide" onClick={() => {
            close();
            go('today', 'День');
          }}>К своим квестам</button></>;
      case 'boardCreate':
        return <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          open('quest', undefined, {
            ...newTask(String(f.get('title'))),
            source: 'board:custom:' + uid()
          });
        }}><Field label="Свой заказ · конкретный опыт"><textarea name="title" required placeholder="Что хочешь попробовать и какой результат получить?" rows={4} /></Field><button className="wb-primary wb-wide">Выбрать время и параметры</button></form>;
      case 'lapse':
        return <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (commit(d => ({
            ...d,
            lapses: [{
              id: uid(),
              title: String(f.get('title')).trim(),
              context: String(f.get('context')),
              at: new Date().toISOString()
            }, ...d.lapses]
          }))) {
            close();
            tell('Событие сохранено без штрафов');
          }
        }}><Field label="Что произошло"><input name="title" required placeholder="Например, долго листал ленту" /></Field><Field label="Что было перед этим"><textarea name="context" rows={4} placeholder="Обстановка, настроение, возможный сигнал" /></Field><button className="wb-primary wb-wide">Сохранить наблюдение</button></form>;
      case 'attention':
        return <><p>Правила внимания остаются частью привычек.</p><form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (commit(d => ({
              ...d,
              rules: [...d.rules, {
                id: uid(),
                site: String(f.get('site')).trim(),
                minutes: Number(f.get('minutes')),
                gate: String(f.get('gate'))
              }]
            }))) tell('Черновик правила сохранён. Блокировка в макете не включается.');
          }}><Field label="Сайт или приложение"><input name="site" required placeholder="Например, youtube.com" /></Field><div className="wb-form-grid"><Field label="Лимит, минут"><input name="minutes" type="number" required min="1" max="1440" defaultValue={20} /></Field><Field label="Пауза перед входом"><select name="gate"><option>Осознанная пауза</option><option>Шахматная задача</option></select></Field></div><button className="wb-primary wb-wide">Сохранить черновик правила</button></form>{data.rules.map(r => <div className="wb-note" key={r.id}><h3>{r.site}</h3><p>{r.minutes} мин · {r.gate}</p></div>)}<p className="wb-status-note">Блокировка приложений требует установленного Satoru и системных разрешений. В браузерном макете правила сохраняются для проверки настройки, но ничего не блокируют.</p></>;
      case 'inspiration':
        return <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const url = String(f.get('url'));
          try {
            if (!['https:', 'http:'].includes(new URL(url).protocol)) throw Error();
          } catch {
            tell('Нужна обычная ссылка https://');
            return;
          }
          if (commit(d => ({
            ...d,
            inspiration: [{
              id: uid(),
              title: String(f.get('title')).trim(),
              url
            }, ...d.inspiration]
          }))) {
            close();
            tell('Материал сохранён');
          }
        }}><Field label="Название"><input name="title" required /></Field><Field label="Ссылка на материал"><input name="url" type="url" required placeholder="https://" /></Field><button className="wb-primary wb-wide">Сохранить материал</button></form>;
      case 'delete':
        return <><h3>{panel.value.title}</h3><p>Удалить эту запись из макета? Настоящие данные Satoru не затрагиваются.</p><button className="wb-danger wb-wide" onClick={() => {
            const id = panel.id,
              type = panel.value.type;
            if (type === 'task' && currentTask?.done) {
              tell('Сначала отмени выполнение, чтобы сохранить баланс наград.');
              return;
            }
            if (commit(d => ({
              ...d,
              tasks: type === 'task' ? d.tasks.filter(t => t.id !== id) : type === 'goal' ? d.tasks.map(t => t.goal === id ? {
                ...t,
                goal: undefined
              } : t) : d.tasks,
              goals: type === 'goal' ? d.goals.filter(g => g.id !== id) : d.goals,
              notes: type === 'note' ? d.notes.filter(n => n.id !== id) : d.notes,
              rewards: type === 'reward' ? d.rewards.filter(r => r.id !== id) : d.rewards,
              lapses: type === 'lapse' ? d.lapses.filter(l => l.id !== id) : d.lapses,
              inspiration: type === 'inspiration' ? d.inspiration.filter(i => i.id !== id) : d.inspiration
            }))) {
              close();
              tell('Запись удалена');
            }
          }}>Удалить</button><button className="wb-wide" onClick={close}>Оставить</button></>;
      case 'settings':
        return <><h3>Палитра Satoru</h3><div className="wb-palettes">{Object.entries(paletteNames).map(([id, name]) => <button key={id} aria-pressed={data.palette === id} onClick={() => commit(d => ({
              ...d,
              palette: id
            }))}><span className={'swatch ' + id} />{name}</button>)}</div><p className="wb-muted">Одинаковые функции и композиция — можно сравнить именно цвет. «Чернила» отделяют Satoru от зелёного Senku и связывают оболочку с Тенью.</p><button className="wb-directory" aria-pressed={data.sound} onClick={() => commit(d => ({
            ...d,
            sound: !d.sound
          }))}><Icon id="media.sound" /><span>Звук действий</span><b>{data.sound ? 'Вкл.' : 'Выкл.'}</b></button><button className="wb-directory" aria-pressed={data.motion} onClick={() => commit(d => ({
            ...d,
            motion: !d.motion
          }))}><Icon id="nav.lair" /><span>Движение в Логове</span><b>{data.motion ? 'Вкл.' : 'Выкл.'}</b></button><p className="wb-status-note">B2.4 · отдельный рабочий макет. Изменения хранятся в этом браузере. Сервер Satoru, аккаунт и данные приложения не подключены.</p><button className="wb-wide" onClick={() => {
            const blob = new Blob([localStorage.getItem(KEY) || JSON.stringify(data, null, 2)], {
                type: 'application/json'
              }),
              url = URL.createObjectURL(blob),
              a = document.createElement('a');
            a.href = url;
            a.download = 'satoru-b2-backup.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Скачать данные макета</button><small>Медиа хранится отдельно в браузере и в JSON не включается.</small></>;
      case 'streak':
        return <><div className="wb-buy"><Icon id="status.streak" size={90} /><h3>{done.length ? 'Сегодня отмечено' : 'День ещё продолжается'}</h3></div><p>Серия основного аккаунта не перенесена. В макете видны только выполненные здесь дела.</p><button className="wb-primary wb-wide" onClick={() => {
            close();
            go('world');
            setWorldMode('Прогресс');
          }}>Посмотреть свой прогресс</button></>;
      case 'collectionInfo':
        return <><h3>Коллекция Satoru</h3><p>Сундуки, ваучеры, косметика, мебель и экипировка сохраняют свои назначения. Здесь нужен настоящий серверный инвентарь и подтверждённая выдача.</p><p>Мы не подменяем его случайной демо-наградой. Каталог личных наград и покупки уже можно проверить полностью.</p><button className="wb-primary wb-wide" onClick={() => {
            close();
            setRewardMode('Каталог');
          }}>К каталогу наград</button></>;
      case 'runtimeInfo':
        return <p className="wb-muted">{panel.value}</p>;
      default:
        return null;
    }
  }
  const titles: Record<string, string> = {
    quest: 'Квест',
    actual:'Уточнить время',
    complete: 'Квест завершён?',
    note: 'Заметка',
    goal: 'Цель',
    goalDetail: 'Твоя цель',
    habit: 'Привычка',
    review: 'Итог дня',
    shadow: 'Тень',
    rewardCreate: 'Своя награда',
    focus: 'Текущий фокус',
    buy: 'Получить награду',
    useReward: 'Время для себя',
    boardCreate: 'Свой заказ',
    lapse: 'Наблюдение',
    attention: 'Границы внимания',
    inspiration: 'Материал для вдохновения',
    delete: 'Удалить запись?',
    settings: 'Настройки макета',
    streak: 'Серия',
    collectionInfo: 'Коллекция',
    runtimeInfo: 'Связь с основным Satoru'
  };
  return <div ref={root} className={'wb palette-' + data.palette + (!data.motion ? ' reduce-motion' : '') + (dragging ? ' is-dragging' : '') + ' route-'+route}><div ref={scroll} className="wb-scroll"><header className="wb-header"><button className="wb-brand" onClick={() => go('today', 'День')} aria-label="Satoru — Сегодня"><span>?</span>satoru</button><button className="wb-header-tool" onClick={() => open('streak')}><Icon id="status.streak" size={31} /><span>Серия</span></button><button className="wb-header-tool" aria-label="Палитра и настройки" onClick={() => open('settings')}><Icon id="nav.settings" /></button></header>
 {error && <p className="wb-global-error" role="alert">{error}</p>}
 {showScene && <aside className="wb-scene-column"><div className="wb-date"><h1>{route === 'today' ? label(today) : 'Моё Логово'}</h1><button onClick={() => open('review')} aria-label="Открыть итог дня"><Icon id="system.day-end" /></button></div><Lair working={!!focus} paused={!focus?.running} motion={data.motion && !panel} form={form} onShadow={callShadow} onOpen={() => {
          go('world');
          setWorldMode('Логово');
        }} onSeen={setSceneSeen} /></aside>}
 <main className={'wb-main ' + (showScene ? 'with-scene' : 'full')}>
 {route === 'today' && <><div className="wb-section-head"><h2>Сегодня</h2><button className="wb-primary" onClick={() => open('quest', undefined, newTask())}><Icon id="action.add" size={18} />Квест</button></div><Segments values={['День', 'Доска', 'Заметки']} value={todayMode} onChange={v => {
            setTodayMode(v);
            setSceneSeen(true);
          }} label="Раздел Сегодня" />{todayMode === 'Доска' ? boardView : todayMode === 'Заметки' ? <>{notesView}{data.notes.length > 0 && !data.notes.some(n => n.text.toLowerCase().includes(noteQuery.toLowerCase())) && <Empty title="Ничего не найдено" body="Попробуй другой запрос." />}</> : <TodayDashboard data={data} taskRow={taskRow} habitRow={habitRow} add={() => editQuest()} notes={newNote} review={() => open('review')} plan={mode => {
            go('plan', mode);
            setSelected(today);
            setPeriod('Неделя');
          }} reward={entry => {
            setRewardEntry(entry || '');
            go('rewards');
          }} />}</>}
 {route === 'time' && <TimeWorkspace key={timeMode} initialMode={timeMode} data={data} commit={commit} start={start} pause={pause} finish={requestComplete} edit={editQuest} back={utilityBack} settings={focusSettings} rewards={()=>go('rewards')} add={()=>editQuest()}/>}
 {route === 'settings' && <SettingsWorkspace data={data} commit={commit} back={utilityBack} initialGroup={settingsGroup} time={mode=>open('time',undefined,mode)} shadow={callShadow}/>}
 {route === 'plan' && <PlanWorkspace onTime={()=>open('time')} entryGoal={entryGoal} onEntryHandled={() => setEntryGoal('')} activeMinutes={Math.min(1440, Math.max(1, Math.round(elapsed / 60000)))} data={data} mode={planMode} onMode={setPlanMode} commit={commit} legacy={kind => kind === 'today' ? go('today', 'День') : open(kind)} start={start} activeTask={focus?.id} selectedDate={selected} onSelectDate={setSelected} period={period} onPeriod={setPeriod} onCompleted={id => {
          sound();
        }} />}
 {route === 'world' && worldView()}{route === 'rewards' && rewardsView()}
 {route === 'tribe' && <><h2>Племя</h2><p className="wb-muted">Общие дела и места твоего мира.</p><div className="wb-places">{[['Общий дом', 'Встречи и совместный фокус', 'nav.tribe'], ['Казарма', 'Подготовка и общие задания', 'difficulty.normal'], ['Лес', 'Вылазки и общий путь', 'difficulty.easy'], ['Пещера', 'Испытания', 'difficulty.hard'], ['Арена', 'Соревнования', 'nav.today'], ['Друзья', 'Участники и приглашения', 'nav.tribe']].map(([title, desc, icon]) => <button key={title} onClick={() => open('runtimeInfo', undefined, title + ' сохраняется в структуре Племени. Для участников, совместной сессии и общего прогресса нужен аккаунт и multiplayer-сервер; в макете нет выдуманных подключённых людей.')}><Icon id={icon} size={38} /><strong>{title}</strong><small>{desc}</small></button>)}</div><p className="wb-status-note">Проверка структуры. Настоящее Племя подключается при переносе в Satoru.</p></>}
 <footer className="wb-footer">B2.7 · продолжение B2.5 <button onClick={() => open('settings')}>Палитра и настройки</button></footer></main></div>
 {focus&&route!=='time'&&<FocusDock time={time} title={data.tasks.find(t=>t.id===focus.id)?.title||'Фокус'} running={focus.running} open={()=>open('focus')} pause={pause} finish={()=>{const t=data.tasks.find(t=>t.id===focus.id);if(t)requestComplete(t);}}/>}
 {showBubble && <button className="wb-bubble" style={bubble ? {
      left: bubble.x,
      top: bubble.y,
      right: 'auto',
      bottom: 'auto'
    } : undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => {
      drag.current = null;
      setDragging(false);
    }} onClick={e => {
      if (e.detail === 0) callShadow();
    }} aria-label="Открыть чат с Тенью. Можно перемещать."><Portrait form={form} /></button>}
 <nav className="wb-nav" aria-label="Основные разделы">{tabs.map(([id, name, ic]) => <button key={id} aria-current={route === id || (route === 'time' && id === 'plan') ? 'page' : undefined} onClick={() => go(id)}><Icon id={ic} size={23} /><span>{name}</span></button>)}</nav>
 {toast && <div role="status" className="wb-toast">{toast}</div>}{celebrate && <div className="wb-celebration" role="status"><Icon id="achievement.first_quest" size={50} /><div><strong>Готово. Ещё один шаг.</strong><span>{celebrate.title}</span><b>+{celebrate.xp} XP · +{celebrate.gold} золота</b><div className="b24-receipt-actions"><button onClick={()=>{const t=data.tasks.find(t=>t.id===celebrate.id);if(t)open('actual',t.id,{actual:t.actual??t.minutes});setCelebrate(null);}}>Уточнить время</button><button onClick={()=>{const t=data.tasks.find(t=>t.id===celebrate.id);if(t)requestComplete(t);setCelebrate(null);}}>Отменить</button></div></div><button aria-label="Закрыть результат" onClick={() => setCelebrate(null)}><Icon id="action.close" /></button></div>}
 <dialog ref={dialog} className={'wb-dialog palette-' + data.palette} aria-label={panel ? titles[panel.kind] : 'Satoru'} onCancel={e => {
      e.preventDefault();
      close();
    }} onClick={e => {
      if (e.target === dialog.current) close();
    }}><div className="wb-sheet"><header><h2>{panel ? titles[panel.kind] : ''}</h2><button aria-label="Закрыть панель" onClick={close}><Icon id="action.close" /></button></header>{error && <p role="alert" className="wb-error">{error}</p>}{panelBody()}</div></dialog>
 </div>;
}
