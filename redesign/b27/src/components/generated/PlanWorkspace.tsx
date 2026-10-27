import { InspirationWorkspace } from './InspirationWorkspace';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Data, Task, Goal, Habit, uid, day, shift, label, newTask, sphere } from './B2Model';
import { Field } from './B2Forms';
import { Icon } from './B2Scene';
import { TaskEditor, GoalEditor, HabitEditor, MaterialEditor } from './PlanForms';
import { PlanData, PlanGoal, PlanHabit, Material, monday, weekOf, duration, statsFor, moveTasks, saveTask, finish, stepTask, saveGoal, deleteGoal, goalState, habitLog, savePlanSetting, exportICS, clockTime, timeValue, horizons, legacyHorizons, validDate } from './PlanModel';
import './PlanWorkspace.css';
import { CalendarWorkspace, RegularForm } from './CalendarWorkspace';
import { CalendarData } from './CalendarModel';
import { GoalMap } from './GoalMap';
import { withExamples } from './ReviewExamples';
import { ShadowImport } from './ShadowImport';
import { Spheres } from './B2Forms';
type Layer = {
  kind: string;
  value?: any;
};
type Props = {
  onTime?: () => void;
  data: Data;
  mode: string;
  onMode: (m: string) => void;
  commit: (fn: (d: Data) => Data) => boolean;
  legacy: (kind: string) => void;
  start: (t: Task) => void;
  activeTask?: string;
  activeMinutes?: number;
  entryGoal?: string;
  onEntryHandled?: () => void;
  selectedDate: string;
  onSelectDate: (v: string) => void;
  period: string;
  onPeriod: (v: string) => void;
  onCompleted: (id: string) => void;
};
const modeLabels = ['Календарь', 'Цели', 'Привычки', 'Вдохновение'];
const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const Arrow = ({
  back = false
}: {
  back?: boolean;
}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{
  transform: back ? 'rotate(180deg)' : undefined
}} aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;
function Choice({
  values,
  value,
  change,
  label: aria
}: {
  values: string[];
  value: string;
  change: (v: string) => void;
  label: string;
}) {
  return <div className="pl-choice" role="group" aria-label={aria}>{values.map(v => <button key={v} aria-pressed={value === v} onClick={() => change(v)}>{v}</button>)}</div>;
}
function Empty({
  title,
  text,
  action,
  click
}: {
  title: string;
  text?: string;
  action?: string;
  click?: () => void;
}) {
  return <div className="pl-empty"><h3>{title}</h3>{text && <p>{text}</p>}{action && <button className="wb-primary" onClick={click}>{action}</button>}</div>;
}
export function PlanWorkspace({
  onTime,
  data,
  mode,
  onMode,
  commit,
  legacy,
  start,
  activeTask,
  activeMinutes,
  entryGoal,
  onEntryHandled,
  onCompleted,
  selectedDate,
  onSelectDate,
  period,
  onPeriod
}: Props) {
  useEffect(() => {
    if (entryGoal) {
      open('goalDetail', entryGoal);
      onEntryHandled?.();
    }
  }, [entryGoal]);
  const today = day(),
    pd = data as PlanData;
  const date = selectedDate,
    setDate = onSelectDate,
    scale = period,
    setScale = onPeriod;
  const [queue, setQueue] = useState('Без даты'),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [selecting, setSelecting] = useState(false);
  const [goalView, setGoalView] = useState('Сейчас'),
    [goalFilter, setGoalFilter] = useState('Активные'),
    [goalQuery, setGoalQuery] = useState(''),
    [goalSelected, setGoalSelected] = useState<string[]>([]),
    [goalSelecting, setGoalSelecting] = useState(false);
  const [habitDate, setHabitDate] = useState(today),
    [habitFilter, setHabitFilter] = useState('По расписанию'),
    [materialQuery, setMaterialQuery] = useState('');
  const [layer, setLayer] = useState<Layer | null>(null),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState('');
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const [undo, setUndo] = useState<{
    before: Task[];
    after: Task[];
    label: string;
  } | null>(null);
  const days = weekOf(date),
    stats = statsFor(data, date),
    budget = pd.plan?.budgets[date];
  const intent = pd.plan?.intents[monday(date)] ?? (monday(date) === monday(today) ? data.weekIntent : '');
  const unscheduled = data.tasks.filter(t => !t.date && !t.done),
    earlier = data.tasks.filter(t => t.date && t.date < today && !t.done);
  const queueList = (queue === 'Без даты' ? unscheduled : queue === 'Ранее' ? earlier : data.tasks).filter(t => t.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const goals = data.goals as PlanGoal[],
    habits = data.habits as PlanHabit[];
  function open(kind: string, value?: any) {
    opener.current = document.activeElement as HTMLElement;
    setError('');
    setLayer({
      kind,
      value
    });
  }
  function close() {
    setLayer(null);
    setError('');
    requestAnimationFrame(() => opener.current?.isConnected && opener.current.focus());
  }
  function apply(fn: (d: Data) => Data, message: string) {
    let detail = '';
    const ok = commit(d => {
      try {
        return fn(d);
      } catch (e) {
        detail = e instanceof Error ? e.message : 'Проверь введённые данные.';
        throw e;
      }
    });
    if (ok) {
      setError('');
      setReceipt(message);
      return true;
    }
    setError(detail || 'Не удалось сохранить. Ввод оставлен в форме. Освободи место в браузере и повтори.');
    return false;
  }
  function saveAndClose(fn: (d: Data) => Data, message: string) {
    const ok = apply(fn, message);
    if (ok) close();
    return ok;
  }
  function editTask(t?: Task, inbox = false) {
    open('task', {
      task: t || newTask('', inbox ? '' : date),
      existing: !!t
    });
  }
  function viewDate(next: string) {
    setDate(next);
    history.replaceState(null, '', `#plan/${modeLabels.indexOf(mode)}/${next}`);
  }
  function newGoal() {
    open('goalEdit', {
      id: uid(),
      title: '',
      description: '',
      project: '',
      horizon: 'Краткосрочная',
      deadline: '',
      primary: ['work'],
      background: [],
      steps: [],
      done: false
    });
  }
  function newHabit() {
    open('habit', {
      id: uid(),
      title: '',
      minutes: 10,
      days: [1, 2, 3, 4, 5, 6, 0],
      sphere: 'mind',
      identity: '',
      cue: '',
      twoMin: '',
      reward: '',
      logs: [],
      paused: false
    });
  }
  useEffect(() => {
    if (layer) {
      dialog.current?.showModal();
      requestAnimationFrame(() => {
        const field = dialog.current?.querySelector<HTMLElement>('[autofocus],input:not([type=hidden]),textarea,select');
        (field || dialog.current?.querySelector<HTMLElement>('[data-close]'))?.focus();
      });
    } else dialog.current?.close();
  }, [layer?.kind]);
  useEffect(() => {
    if (!receipt) return;
    const id = setTimeout(() => setReceipt(''), 7000);
    return () => clearTimeout(id);
  }, [receipt]);
  useEffect(() => {
    function back() {
      const chunks = location.hash.split('/');
      if (chunks[0] === '#plan') {
        if (validDate(chunks[2] || '')) setDate(chunks[2]);
        const m = modeLabels[Number(chunks[1])];
        if (m) onMode(m);
        close();
      }
    }
    addEventListener('popstate', back);
    return () => removeEventListener('popstate', back);
  }, []);
  function move(ids: string[], target: string, time = '') {
    const before = data.tasks.filter(t => ids.includes(t.id));
    let after: Task[] = [];
    if (apply(d => {
      const next = moveTasks(d, ids, target, time);
      after = next.tasks.filter(t => ids.includes(t.id));
      return next;
    }, target ? 'Перенесено на ' + label(target, true) : 'Возвращено в дела без даты')) {
      setUndo({
        before,
        after,
        label: 'Отменить перенос'
      });
      setSelected([]);
      setSelecting(false);
      if (target) viewDate(target);
      close();
    }
  }
  function undoMove() {
    if (!undo) return;
    const snapshot = undo;
    if (apply(d => {
      for (const after of snapshot.after) {
        if (JSON.stringify(d.tasks.find(t => t.id === after.id)) !== JSON.stringify(after)) throw Error('Эти дела уже изменены. Открой их и перенеси вручную.');
      }
      return {
        ...d,
        tasks: d.tasks.map(t => snapshot.before.find(b => b.id === t.id) || t)
      };
    }, 'Предыдущее расписание восстановлено')) setUndo(null);
  }
  function complete(t: Task) {
    if (t.done) {
      apply(d => finish(d, t.id, t.actual || 0, false), 'Выполнение отменено, опыт и золото возвращены');
      return;
    }
    const actual=t.id===activeTask?activeMinutes??t.minutes:t.actual??t.minutes;
    if(apply(d=>finish(d,t.id,actual),`Готово: ${t.title} · ${duration(actual)}`))onCompleted(t.id);
  }
  function taskRow(t: Task, select = false) {
    const goal = goals.find(g => g.id === t.goal);
    return <article key={t.id} className={'pl-task ' + (t.done ? 'is-done' : '')}>
    {select ? <label className="pl-select"><input type="checkbox" aria-label={'Выбрать: ' + t.title} checked={selected.includes(t.id)} onChange={() => setSelected(selected.includes(t.id) ? selected.filter(id => id !== t.id) : [...selected, t.id])} /></label> : <button className="pl-check" aria-label={(t.done ? 'Отменить выполнение: ' : 'Выполнить: ') + t.title} aria-pressed={t.done} onClick={() => complete(t)}><span>{t.done && <Icon id="action.check" size={16} />}</span></button>}
    <div className="pl-task-copy"><button className="pl-task-title" onClick={() => editTask(t)}>{t.title}</button><div className="pl-meta"><span className="pl-sphere" style={{
            color: sphere(t.primary[0]).color
          }} /><span>{t.start ? `${t.start}–${clockTime(timeValue(t.start)! + t.minutes)} · ` : ''}{duration(t.done ? t.actual ?? t.minutes : t.minutes)}</span>{t.core && <span>Ядро дня</span>}{t.date !== date && t.date && <span>{label(t.date, true)}</span>}</div>{goal && <button className="pl-goal-link" onClick={() => open('goalDetail', goal.id)}><Icon id="nav.plan" size={15} />{goal.title}</button>}</div>
    {!t.done && <button className="pl-row-tool" aria-label={'Перенести: ' + t.title} onClick={() => open('move', [t.id])}><Icon id="period.week" size={21} /></button>}
  </article>;
  }
  function queueView() {
    return <aside className="pl-queue"><div className="pl-section-head"><h3>Разобрать дела</h3><button aria-label="Добавить дело без даты" onClick={() => editTask(undefined, true)}><Icon id="action.add" /></button></div><Choice values={['Без даты', 'Ранее', 'Все']} value={queue} change={v => {
        setQueue(v);
        setSelected([]);
        setSelecting(false);
      }} label="Разбор дел" /><input className="pl-search" aria-label="Поиск по делам" placeholder="Найти дело" value={query} onChange={e => {
        setQuery(e.target.value);
        setSelected([]);
      }} />
    {queueList.some(t => !t.done) && <div className="pl-bulk-head"><small>{queueList.length} в списке</small><button onClick={() => {
          setSelecting(!selecting);
          setSelected([]);
        }}>{selecting ? 'Отменить выбор' : 'Выбрать несколько'}</button></div>}
    {selecting && <div className="pl-bulk"><button onClick={() => setSelected(queueList.filter(t => !t.done).map(t => t.id))}>Выбрать все</button><button className="wb-primary" disabled={!selected.length} onClick={() => open('move', selected)}>Перенести · {selected.length}</button></div>}
    {queueList.length ? queueList.map(t => taskRow(t, selecting && !t.done)) : <Empty title={query ? 'Ничего не найдено' : queue === 'Без даты' ? 'Все дела на своих местах' : queue === 'Ранее' ? 'Нет дел из прошлых дней' : 'Здесь пока пусто'} text={query ? 'Попробуй другое слово.' : queue === 'Без даты' ? 'Сюда можно быстро записать дело и решить когда позже.' : undefined} action={query ? 'Сбросить поиск' : queue === 'Без даты' ? 'Записать дело' : undefined} click={() => query ? setQuery('') : editTask(undefined, true)} />}
  </aside>;
  }
  function calendar() {
    return <CalendarWorkspace data={data} date={date} scale={scale} setDate={viewDate} setScale={setScale} edit={editTask} open={open} apply={apply} complete={complete}/>;
  }
  function goalRow(g: PlanGoal) {
    const count = g.steps.filter(s => s.done).length,
      next = g.steps.find(s => !s.done);
    return <article className="pl-goal-row" key={g.id}>{goalSelecting && <label className="pl-select"><input type="checkbox" aria-label={'Выбрать цель: ' + g.title} checked={goalSelected.includes(g.id)} onChange={() => setGoalSelected(goalSelected.includes(g.id) ? goalSelected.filter(id => id !== g.id) : [...goalSelected, g.id])} /></label>}<button className="pl-goal-main" onClick={() => open('goalDetail', g.id)}><small>{g.project || 'Личная цель'} · {g.horizon}{g.archived ? ' · Архив' : g.paused ? ' · На паузе' : g.done ? ' · Достигнута' : ''}</small><strong>{g.title}</strong><span className="pl-progress"><i style={{
            width: (g.done ? 100 : g.steps.length ? count / g.steps.length * 100 : 0) + '%'
          }} /></span><span className="pl-meta">{count} из {g.steps.length} шагов{g.deadline ? ' · до ' + label(g.deadline, true) : ''}</span>{!g.done && !g.archived && <span className="pl-next">Дальше: {next?.title || 'выбрать следующий шаг'}</span>}</button><button className="pl-row-tool" aria-label={'Открыть цель: ' + g.title} onClick={() => open('goalDetail', g.id)}><Arrow /></button></article>;
  }
  function goalsView() {
    const filtered = goals.filter(g => (goalFilter === 'Архив' ? g.archived : goalFilter === 'На паузе' ? g.paused && !g.archived : goalFilter === 'Достигнуты' ? g.done && !g.archived : !g.done && !g.archived && !g.paused) && g.title.toLocaleLowerCase().includes(goalQuery.toLocaleLowerCase()));
    const current = goals.filter(g => !g.done && !g.paused && !g.archived).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 3);
    const list = goalView === 'Сейчас' ? current : filtered;
    return <><div className="pl-title"><h2>Цели</h2><div className="b24-title-actions"><button onClick={()=>open('shadowImport')}>Разобрать с Тенью</button><button className="wb-primary" onClick={newGoal}><Icon id="action.add" />Цель</button></div></div><Choice values={['Сейчас', 'Все цели', 'Карта']} value={goalView} change={v => {
        setGoalView(v);
        setGoalSelecting(false);
        setGoalSelected([]);
      }} label="Представление целей" />
    {goalView === 'Сейчас' ? <div className="b24-current-note">Ближайшие результаты</div> : goalView==='Карта'?<p className="b24-map-note">Нажми цель, чтобы увидеть её связи и шаги.</p>: <><div className="pl-form-pair"><Field label="Состояние целей"><select value={goalFilter} onChange={e => {
              setGoalFilter(e.target.value);
              setGoalSelected([]);
            }}>{['Активные', 'На паузе', 'Достигнуты', 'Архив'].map(v => <option key={v}>{v}</option>)}</select></Field><Field label="Поиск целей"><input value={goalQuery} onChange={e => {
              setGoalQuery(e.target.value);
              setGoalSelected([]);
            }} placeholder="Название цели" /></Field></div><div className="pl-bulk-head"><small>{list.length} в списке</small><button onClick={() => {
            setGoalSelecting(!goalSelecting);
            setGoalSelected([]);
          }}>{goalSelecting ? 'Отменить выбор' : 'Выбрать несколько'}</button></div></>}
    {goalSelecting && <div className="pl-bulk"><button onClick={() => setGoalSelected(list.map(g => g.id))}>Все в списке</button><button disabled={!goalSelected.length} onClick={() => open('goalsManage', goalSelected)}>Действия · {goalSelected.length}</button></div>}
    {list.length ? goalView === 'Карта' ? <GoalMap goals={list} open={id=>open('goalDetail',id)}/> : list.map(goalRow) : <Empty title={goalView === 'Сейчас' ? 'К чему хочешь прийти?' : 'Здесь пока нет целей'} text={goalQuery ? 'Попробуй изменить поиск или состояние целей.' : 'Начни с результата, который важен лично тебе.'} action="Создать цель" click={newGoal} />}
    {goalView === 'Сейчас' && goals.length > 0 && <button className="pl-text-action" onClick={() => setGoalView('Все цели')}>Все цели и архив <Arrow /></button>}</>;
  }
  function habitsView() {
    const selectedDay = new Date(habitDate + 'T12:00:00').getDay(),
      list = habits.filter(h => habitFilter === 'На паузе' ? h.paused : habitFilter === 'Все' ? !h.paused : !h.paused && h.days.includes(selectedDay));
    return <><div className="pl-title"><h2>Привычки</h2><button className="wb-primary" onClick={newHabit}><Icon id="action.add" />Привычка</button></div><div className="pl-habit-date"><Field label="День отметки"><input type="date" max={today} value={habitDate} onChange={e => {
            if (e.target.value) setHabitDate(e.target.value);
          }} /></Field><button onClick={() => setHabitDate(today)}>Сегодня</button></div><Choice values={['По расписанию', 'Все', 'На паузе']} value={habitFilter} change={setHabitFilter} label="Список привычек" />
    {data.identity&&<div className="b24-identity"><span>Мой ориентир</span><strong>{data.identity}</strong><button aria-label="Изменить мой ориентир" onClick={()=>open('identity')}><Icon id="action.edit" size={18}/></button></div>}<div className="b24-habit-grid">{list.length ? list.map(h => <article key={h.id} className="pl-habit"><div className="pl-section-head"><button className="pl-habit-name" onClick={() => open('habit', h)}><strong>{h.title}</strong><small>{h.cue || h.days.map(i => dayNames[i]).join(' · ')} · {duration(h.minutes)}</small>{h.identity&&<span className="b24-habit-identity">{h.identity}</span>}</button><button aria-label={'Изменить привычку: ' + h.title} onClick={() => open('habit', h)}><Icon id="action.edit" /></button></div><div className="pl-habit-history">{weekOf(habitDate).map(k => <button key={k} disabled={k > today} aria-label={label(k) + (h.logs.includes(k) ? ', выполнено' : ', без отметки')} aria-pressed={k === habitDate} onClick={() => setHabitDate(k)}><span>{dayNames[new Date(k + 'T12:00:00').getDay()]}</span><b className={h.logs.includes(k) ? 'logged' : ''}>{h.logs.includes(k) ? <Icon id="action.check" size={15} /> : new Date(k + 'T12:00:00').getDate()}</b></button>)}</div>
    {h.logs.includes(habitDate) && <p className="pl-help">Сделано {label(habitDate, true)}{h.records?.[habitDate] ? ` · ${duration(h.records[habitDate].minutes)}${h.records[habitDate].twoMin ? ' · маленькая версия' : ''}` : ''}</p>}
    {h.paused ? <button onClick={() => apply(d => ({
          ...d,
          habits: d.habits.map(x => x.id === h.id ? {
            ...x,
            paused: false
          } : x)
        }), 'Привычка снова в расписании')}>Вернуть с паузы</button> : <div className="pl-habit-actions"><button className={h.logs.includes(habitDate) ? '' : 'wb-primary'} disabled={habitDate > today} onClick={() => apply(d => habitLog(d, h.id, habitDate, false, today), h.logs.includes(habitDate) ? 'Отметка отменена' : 'Привычка отмечена')}>{h.logs.includes(habitDate) ? 'Отменить отметку' : 'Сделано'}</button>{!h.logs.includes(habitDate) && h.twoMin && <button disabled={habitDate > today} onClick={() => open('twoMin', {
            id: h.id,
            date: habitDate
          })}>Версия на 2 минуты</button>}</div>}</article>) : <Empty title={habitFilter === 'На паузе' ? 'Все привычки в ритме' : 'На этот день ничего не назначено'} text="Можно посмотреть все привычки или создать новую." action="Создать привычку" click={newHabit} />}
    </div>{data.lapses.length>0&&<section className="b24-observations"><div className="pl-section-head"><h3>Мои наблюдения</h3><button onClick={()=>open('lapses')}>Все · {data.lapses.length}</button></div>{data.lapses.slice(0,2).map(l=><article key={l.id}><small>{label(l.at.slice(0,10),true)}</small><strong>{l.title}</strong><p>{l.context}</p></article>)}</section>}<div className="pl-secondary-links"><button onClick={() => open('identity')}>Мой ориентир <Arrow /></button><button onClick={() => open('lapses')}>Срывы и наблюдения <Arrow /></button><button onClick={() => legacy('attention')}>Границы внимания <Arrow /></button><button onClick={() => open('method')}>Как выстроить привычку <Arrow /></button></div></>;
  }
  function inspiration() {
    return <InspirationWorkspace data={data} commit={commit} onToday={() => legacy('today')} />;
  }
  function goalDetail(id: string) {
    const g = goals.find(g => g.id === id);
    if (!g) return <p>Цель больше не существует.</p>;
    const parent = goals.find(x => x.id === g.parent),
      linked = data.tasks.filter(t => t.goal === g.id),
      next = g.steps.find(s => !s.done);
    return <>
    <div className="pl-detail-heading"><small>{g.project || 'Личная цель'} · {g.horizon}</small><h3>{g.title}</h3><span>{g.archived ? 'В архиве' : g.paused ? 'На паузе' : g.done ? 'Достигнута' : 'В работе'}{g.deadline ? ' · до ' + label(g.deadline, true) : ''}</span></div>{g.description && <p>{g.description}</p>}{parent && <button className="pl-goal-link" onClick={() => open('goalDetail', parent.id)}>Часть цели: {parent.title}</button>}
    {!g.done && !g.archived && !g.paused && <div className="pl-next-action"><h3>Следующий шаг</h3>{next ? <><p>{next.title}</p><button className="wb-primary" onClick={() => editTask(stepTask(data, g, next.id, date))}>Выбрать день и время</button></> : g.steps.length > 0 ? <><p>Все шаги выполнены. Получился задуманный результат?</p><button className="wb-primary" onClick={() => open('goalComplete', g)}>Подтвердить результат</button></> : <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            title = String(f.get('step') || '').trim();
          if (!title) return;
          const step = {
            id: uid(),
            title,
            done: false
          };
          if (apply(d => saveGoal(d, {
            ...g,
            steps: [...g.steps, step]
          }), 'Шаг добавлен')) editTask(stepTask({
            ...data,
            goals: []
          }, {
            ...g,
            steps: [step]
          }, step.id, date));
        }}><Field label="Что можно сделать первым"><input required name="step" placeholder="Одно конкретное действие" /></Field><button className="wb-primary">Добавить и запланировать</button></form>}</div>}
    <div className="pl-section-head"><h3>Шаги · {g.steps.filter(s => s.done).length}/{g.steps.length}</h3><button onClick={() => open('goalEdit', g)}>Изменить</button></div>{g.steps.map(s => {
        const t = data.tasks.find(t => t.goal === g.id && t.source === 'step:' + s.id);
        return <div className="pl-goal-step" key={s.id}><button className="pl-check" aria-label={'Шаг: ' + s.title} aria-pressed={s.done} onClick={() => t ? complete(t) : apply(d => ({
            ...d,
            goals: d.goals.map(x => x.id === g.id ? {
              ...x,
              steps: x.steps.map(v => v.id === s.id ? {
                ...v,
                done: !v.done
              } : v)
            } : x)
          }), s.done ? 'Шаг возвращён в работу' : 'Шаг отмечен')}><span>{s.done && <Icon id="action.check" size={16} />}</span></button><span><strong>{s.title}</strong>{t && <small>{t.done ? 'Квест выполнен' : t.date ? label(t.date, true) + (t.start ? ' · ' + t.start : '') : 'Квест без даты'}</small>}</span><button disabled={s.done && !t} onClick={() => editTask(stepTask(data, g, s.id, date))}>{t ? 'Квест' : s.done ? 'Сделано' : 'В план'}</button></div>;
      })}
    {linked.filter(t => !t.source?.startsWith('step:')).length > 0 && <details className="pl-disclosure"><summary>Другие квесты цели</summary>{linked.filter(t => !t.source?.startsWith('step:')).map(t => taskRow(t))}</details>}
    <div className="pl-detail-actions"><button className="wb-primary" onClick={() => open('goalComplete', g)}>{g.done ? 'Вернуть в работу' : 'Цель достигнута'}</button><button onClick={() => open('goalEdit', g)}>Параметры цели</button></div><details className="pl-disclosure"><summary>Управление целью</summary><p className="pl-help">Пауза и архив скрывают цель из «Сейчас». Уже назначенные квесты остаются в календаре; их можно перенести отдельно.</p><div className="pl-inline-actions"><button onClick={() => saveAndClose(d => goalState(d, [g.id], g.paused || g.archived ? 'restore' : 'pause'), g.paused || g.archived ? 'Цель возвращена' : 'Цель на паузе')}>{g.paused || g.archived ? 'Вернуть в работу' : 'На паузу'}</button>{!g.archived && <button onClick={() => saveAndClose(d => goalState(d, [g.id], 'archive'), 'Цель в архиве')}>В архив</button>}<button className="wb-danger" onClick={() => open('deleteGoal', g)}>Удалить цель</button></div></details>
  </>;
  }
  function body(): ReactNode {
    if (!layer) return null;
    const v = layer.value;
    switch (layer.kind) {
      case 'task':
        return <>{data.tasks.some(t => t.id === v.task.id) && !v.task.done && <button className="pl-text-action" onClick={() => {
            close();
            start(v.task);
          }}><Icon id="media.play" />Начать фокус</button>}{data.tasks.some(t=>t.id===v.task.id)&&<button className="pl-text-action" onClick={()=>{complete(v.task);close();}}><Icon id="action.check"/>{v.task.done?'Отменить выполнение':'Выполнить квест'}</button>}<TaskEditor key={v.task.id} initial={v.task} data={data} draftKey={data.tasks.some(t => t.id === v.task.id) ? 'task-' + v.task.id : v.task.source ? 'task-source-' + v.task.source : 'task-new'} onSave={t => saveAndClose(d => saveTask(d, t), 'Квест сохранён' + (t.date ? ' · ' + label(t.date, true) : ' без даты'))} onDelete={data.tasks.some(t => t.id === v.task.id) ? () => open('deleteTask', v.task) : undefined} /></>;
      case 'move':
        {
          const tasks = data.tasks.filter(t => v.includes(t.id));
          return <form className="pl-form" onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            move(v, String(f.get('date') || ''), String(f.get('time') || ''));
          }}><p>{tasks.length === 1 ? tasks[0].title : `Перенос ${tasks.length} дел. Точное время будет сброшено.`}</p><Field label="Новая дата"><input autoFocus name="date" type="date" defaultValue={date} /></Field>{tasks.length === 1 && <Field label="Начало · необязательно"><input name="time" type="time" defaultValue={tasks[0].start} /></Field>}<div className="pl-inline-actions"><button type="button" onClick={() => move(v, today)}>Сегодня</button><button type="button" onClick={() => move(v, shift(today, 1))}>Завтра</button><button type="button" onClick={() => move(v, '')}>Без даты</button></div><p className="pl-help">Выполненные дела не переносятся. Пересечения будут видны в календаре. Перенос можно отменить.</p><button className="wb-primary wb-wide">Перенести</button></form>;
        }
      case 'complete':
        return <form className="pl-form" onSubmit={e => {
          e.preventDefault();
          const actual = Number(new FormData(e.currentTarget).get('actual'));
          let xp = 0,
            gold = 0;
          if (saveAndClose(d => {
            const next = finish(d, v.id, actual);
            xp = next.xp - d.xp;
            gold = next.gold - d.gold;
            return next;
          }, 'Квест выполнен')) {
            onCompleted(v.id);
            setReceipt(`Готово: ${v.title} · +${xp} XP · +${gold} золота`);
          }
        }}><h3>{v.title}</h3><Field label="Потрачено минут"><input autoFocus type="number" name="actual" required min={0} max={1440} defaultValue={v.id === activeTask ? activeMinutes : v.actual ?? v.minutes} /></Field><p className="pl-help">Шаг связанной цели обновится вместе с квестом. Повторной награды за шаг не будет.</p><button className="wb-primary wb-wide">Подтвердить выполнение</button></form>;
      case 'deleteTask':
        return <><h3>{v.title}</h3><p>Квест исчезнет из плана. Уже полученный опыт и история выполнения сохранятся.</p>{activeTask === v.id ? <p className="pl-error">Сначала заверши текущую сессию фокуса. Затем можно удалить квест.</p> : <button className="wb-danger wb-wide" onClick={() => saveAndClose(d => ({
            ...d,
            tasks: d.tasks.filter(t => t.id !== v.id)
          }), 'Квест удалён')}>Удалить квест</button>}</>;
      case 'intention':
      case 'budget':
        return <form className="pl-form" onSubmit={e => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get('value') ?? '');
          saveAndClose(d => {const next=savePlanSetting(d,layer.kind==='intention'?'intents':'budgets',v.key,value);return layer.kind==='intention'?{...next,intentSpheres:{...(d as CalendarData).intentSpheres,[v.key]:Array.from(new FormData(e.currentTarget).getAll('intentSphere')).map(String)}}:next;}, 'Сохранено');
        }}>{layer.kind === 'intention' ? <Field label="Что важно продвинуть на этой неделе"><textarea name="value" autoFocus rows={3} maxLength={250} defaultValue={v.value} /></Field> : <><Field label="Сколько минут доступно для дел"><input autoFocus name="value" type="number" min={0} max={1440} defaultValue={v.value} /></Field><p className="pl-help">Это твой ориентир, не лимит и не вся длина дня. Оставь поле пустым, чтобы убрать бюджет. Привычки показаны отдельно и не прибавляются автоматически.</p></>}{layer.kind==='intention'&&<fieldset className="b24-intent-spheres"><legend>Какие сферы продвигаем</legend>{['work','study','health','sport','mind','life'].map(id=><label key={id}><input type="checkbox" name="intentSphere" value={id} defaultChecked={(pd as CalendarData).intentSpheres?.[v.key]?.includes(id)}/>{sphere(id).name}</label>)}</fieldset>}<button className="wb-primary wb-wide">Сохранить</button></form>;
      case 'goalEdit':
        return <GoalEditor key={v.id} initial={v} data={data} onSave={g => {
          if (apply(d => saveGoal(d, g), 'Цель сохранена')) {
            open('goalDetail', g.id);
            return true;
          }
          return false;
        }} />;
      case 'goalDetail':
        return goalDetail(v);
      case 'goalComplete':
        return <><h3>{v.title}</h3><p>{v.done ? 'Цель снова появится среди активных. Шаги и выполненные квесты сохранятся.' : `Подтверди, что результат достигнут. Незавершённых шагов: ${v.steps.filter((s: any) => !s.done).length}. Их квесты останутся в плане — автоматического выполнения и дополнительного XP не будет.`}</p><button className="wb-primary wb-wide" onClick={() => saveAndClose(d => goalState(d, [v.id], v.done ? 'restore' : 'complete'), v.done ? 'Цель возвращена в работу' : 'Цель достигнута')}>{v.done ? 'Вернуть в работу' : 'Подтвердить достижение'}</button></>;
      case 'goalsManage':
        return <><p>Выбрано целей: {v.length}. Изменение применится ко всем сразу. Их квесты останутся в плане.</p><div className="pl-secondary-links">{[['pause', 'На паузу'], ['archive', 'В архив'], ['restore', 'Вернуть в работу']].map(([action, name]) => <button key={action} onClick={() => {
              if (saveAndClose(d => goalState(d, v, action as any), 'Состояние целей изменено')) {
                setGoalSelected([]);
                setGoalSelecting(false);
              }
            }}>{name}<Arrow /></button>)}</div></>;
      case 'deleteGoal':
        return <><h3>{v.title}</h3><p>Удалится только эта цель. Её квесты ({data.tasks.filter(t => t.goal === v.id).length}) сохранятся без связи. Дочерние цели ({goals.filter(g => g.parent === v.id).length}) станут самостоятельными.</p><button className="wb-danger wb-wide" onClick={() => saveAndClose(d => deleteGoal(d, v.id), 'Цель удалена, квесты сохранены')}>Удалить цель</button></>;
      case 'habit':
        return <HabitEditor key={v.id} initial={v} existing={habits.some(h => h.id === v.id)} onSave={h => saveAndClose(d => ({
          ...d,
          habits: d.habits.some(x => x.id === h.id) ? d.habits.map(x => x.id === h.id ? h : x) : [...d.habits, h]
        }), 'Привычка сохранена')} onDelete={habits.some(h => h.id === v.id) ? () => open('deleteHabit', v) : undefined} />;
      case 'deleteHabit':
        return <><h3>{v.title}</h3><p>Удалится привычка и её журнал ({v.logs.length} отметок). Если нужен перерыв, лучше поставить её на паузу.</p><div className="pl-detail-actions"><button onClick={() => saveAndClose(d => ({
              ...d,
              habits: d.habits.map(h => h.id === v.id ? {
                ...h,
                paused: true
              } : h)
            }), 'Привычка на паузе')}>На паузу</button><button className="wb-danger" onClick={() => saveAndClose(d => ({
              ...d,
              habits: d.habits.filter(h => h.id !== v.id)
            }), 'Привычка удалена')}>Удалить привычку</button></div></>;
      case 'twoMin':
        {
          const h = habits.find(h => h.id === v.id);
          return h ? <><h3>{h.twoMin}</h3><p>Маленькая версия считается полноценным выполнением. В журнале останутся честные 2 минуты.</p><button className="wb-primary wb-wide" onClick={() => saveAndClose(d => habitLog(d, h.id, v.date, true, today), 'Маленькая версия выполнена · 2 минуты')}>Сделал маленькую версию</button></> : null;
        }
      case 'inbox':return queueView();
      case 'regular':
        return <RegularForm data={data as CalendarData} days={days} save={saveAndClose}/>;
      case 'shadowImport':
        return <ShadowImport data={data} save={saveAndClose}/>;
      case 'shadowPlan':
        return <ShadowImport data={data} save={saveAndClose} kind="week" week={days}/>;
      case 'identity':
        return <form onSubmit={e => {
          e.preventDefault();
          saveAndClose(d => ({
            ...d,
            identity: String(new FormData(e.currentTarget).get('identity')).trim()
          }), 'Ориентир сохранён');
        }}><Field label="Каким человеком я хочу стать"><textarea autoFocus name="identity" rows={4} defaultValue={data.identity} /></Field><button className="wb-primary wb-wide">Сохранить ориентир</button></form>;
      case 'lapses':
        return <><p>Запись о контексте без штрафов и обнуления прогресса.</p><button className="wb-primary" onClick={() => {
            close();
            legacy('lapse');
          }}>Записать наблюдение</button>{data.lapses.map(l => <article className="pl-material" key={l.id}><small>{label(l.at.slice(0, 10), true)}</small><h3>{l.title}</h3><p>{l.context}</p><button className="wb-danger" onClick={() => open('deleteLapse', l)}>Удалить запись</button></article>)}</>;
      case 'deleteLapse':
        return <><p>Удалить наблюдение «{v.title}»?</p><button className="wb-danger" onClick={() => saveAndClose(d => ({
            ...d,
            lapses: d.lapses.filter(l => l.id !== v.id)
          }), 'Наблюдение удалено')}>Удалить запись</button></>;
      case 'method':
        return <><p>Привычка начинается с понятного сигнала и действия, которое легко повторить.</p>{[['Очевидно', 'Назови момент и место. Например: после вечернего чая.'], ['Привлекательно', 'Свяжи действие с тем, что тебе нравится.'], ['Просто', 'Подготовь среду и запиши версию на две минуты.'], ['Приятно', 'Отметь выполнение и выбери небольшую награду.']].map(([a, b]) => <section className="pl-material" key={a}><h3>{a}</h3><p>{b}</p></section>)}<button className="wb-primary wb-wide" onClick={newHabit}>Применить к своей привычке</button></>;
      case 'material':
        return <MaterialEditor key={v.id} initial={v} existing={data.inspiration.some(m => m.id === v.id)} onSave={m => saveAndClose(d => ({
          ...d,
          inspiration: d.inspiration.some(x => x.id === m.id) ? d.inspiration.map(x => x.id === m.id ? m : x) : [...d.inspiration, m]
        }), 'Материал сохранён')} />;
      case 'deleteMaterial':
        return <><h3>{v.title}</h3><p>Материал удалится. Уже созданный квест останется в плане.</p><button className="wb-danger wb-wide" onClick={() => saveAndClose(d => ({
            ...d,
            inspiration: d.inspiration.filter(m => m.id !== v.id)
          }), 'Материал удалён')}>Удалить материал</button></>;
      default:
        return <p>{v}</p>;
    }
  }
  const titles: Record<string, string> = {
    inbox:'Разобрать дела',regular:'Постоянное расписание',shadowImport:'Разобрать цели с Тенью',shadowPlan:'Неделя с Тенью',
    task: 'Квест',
    move: 'Перенести дело',
    complete: 'Завершение квеста',
    deleteTask: 'Удалить квест?',
    intention: 'Намерение недели',
    budget: 'Время на дела',
    goalEdit: 'Параметры цели',
    goalDetail: 'Цель',
    goalComplete: 'Результат цели',
    goalsManage: 'Управление целями',
    deleteGoal: 'Удалить цель?',
    habit: 'Привычка',
    deleteHabit: 'Удалить привычку?',
    twoMin: 'Можно начать с малого',
    identity: 'Мой ориентир',
    lapses: 'Наблюдения',
    deleteLapse: 'Удалить запись?',
    method: 'Петля привычки',
    material: 'Материал для вдохновения',
    deleteMaterial: 'Удалить материал?',
    info: 'Подключение к Satoru'
  };
  return <div className="pl-workspace"><nav className="pl-tabs" aria-label="Разделы плана">{modeLabels.map((m, i) => <button key={m} aria-current={mode === m ? 'page' : undefined} onClick={() => {
        onMode(m);
        history.pushState(null, '', `#plan/${i}/${date}`);
        setReceipt('');
      }}>{m}</button>)}</nav>
    {onTime&&<button className="ts-plan-entry" onClick={onTime}><span><Icon id="system.focus" size={18}/>Время и фокус</span><Icon id="action.expand" size={18}/></button>}
    {receipt && <div className="pl-receipt" role="status"><span>{receipt}</span><button aria-label="Закрыть сообщение" onClick={() => setReceipt('')}><Icon id="action.close" size={16} /></button></div>}
    {undo && <div className="pl-undo"><button onClick={undoMove}>{undo.label}</button><button aria-label="Скрыть отмену" onClick={() => setUndo(null)}><Icon id="action.close" size={16} /></button></div>}
    {!layer && error && <p className="pl-error" role="alert">{error}</p>}
    {mode === 'Календарь' ? calendar() : mode === 'Цели' ? goalsView() : mode === 'Привычки' ? habitsView() : inspiration()}
    {!(data as CalendarData).demoVersion&&<button className="b24-demo" onClick={()=>apply(withExamples,'Примеры добавлены. Твои записи сохранены.')}>Добавить примеры для проверки</button>}
    <dialog ref={dialog} className={'wb-dialog pl-dialog palette-' + data.palette} aria-labelledby="pl-dialog-title" onCancel={e => {
      e.preventDefault();
      close();
    }} onClick={e => {
      if (e.target === e.currentTarget) close();
    }}><div className="pl-sheet"><header><h2 id="pl-dialog-title">{titles[layer?.kind || ''] || 'План'}</h2><button data-close aria-label="Закрыть окно" onClick={close}><Icon id="action.close" /></button></header>{error && <p className="pl-error" role="alert">{error}</p>}{body()}</div></dialog>
  </div>;
}
