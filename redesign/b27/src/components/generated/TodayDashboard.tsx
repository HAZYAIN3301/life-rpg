import { useState } from 'react';
import type { ReactNode } from 'react';
import { Task, Habit, day } from './B2Model';
import { DailyData, pendingReward, statusOf } from './DailyModel';
import { PlanData, monday, duration } from './PlanModel';
import { Icon } from './B2Scene';
import { Field } from './B2Forms';
import './ThreeSections.css';
import { RewardArt } from './RewardArt';
import { chestProgress } from './DailyModel';
export function TodayDashboard({
  chestsAvailable,
  data,
  taskRow,
  habitRow,
  add,
  notes,
  review,
  plan,
  reward
}: {
  chestsAvailable?: number;
  data: DailyData;
  taskRow: (t: Task, core?: boolean) => ReactNode;
  habitRow: (h: Habit) => ReactNode;
  add: () => void;
  notes: () => void;
  review: () => void;
  plan: (mode?: string) => void;
  reward: (entry?: string) => void;
}) {
  const today = day(),
    all = data.tasks.filter(t => t.date === today),
    done = all.filter(t => t.done),
    pending = all.filter(t => !t.done).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
  const cores = pending.filter(t => t.core),
    featured = cores.length ? cores : [...pending.slice(0, 1)];
  const rest = pending.filter(t => !featured.includes(t));
  const habits = data.habits.filter(h => !h.paused && h.days.includes(new Date().getDay()));
  const catchup = data.tasks.filter(t => !t.done && (!t.date || t.date < today));
  const p = pendingReward(data),
    r = data.rewards.find(r => r.id === data.nextReward);
  const intent = (data as PlanData).plan?.intents[monday(today)] ?? data.weekIntent;
  const budget = (data as PlanData).plan?.budgets[today],
    minutes = pending.reduce((s, t) => s + t.minutes, 0);
  return <div className="td-dashboard"><section className="td-main">
    <div className="td-progress"><span>{done.length} из {all.length} сделано</span><span>{duration(minutes)} осталось в плане</span></div>
    {budget !== undefined && minutes > budget && <p className="td-catchup">На {duration(minutes - budget)} больше твоего лимита. <button onClick={() => plan('Календарь')}>Облегчить день</button></p>}
    {featured.map(t => taskRow(t, true))}
    {!!rest.length && <h3 className="wb-list-label">Ещё сегодня</h3>}{rest.map(t => taskRow(t))}
    {!pending.length && <div className="tri-empty"><h3>{done.length ? 'На сегодня всё' : 'С чего начнём?'}</h3><p>{done.length ? 'Можно выдохнуть. Запомни, что получилось, или выбери время для себя.' : 'Добавь одно важное дело. Свободное место не обязательно заполнять.'}</p><button className="wb-primary" onClick={done.length ? review : add}>{done.length ? 'Подвести итог' : 'Добавить первый квест'}</button></div>}
    {!!done.length && <details className="td-done"><summary>Выполнено · {done.length}</summary>{done.map(t => taskRow(t))}</details>}
    {!!catchup.length && <div className="td-catchup"><button onClick={() => plan('Календарь')}>Ждут планирования · {catchup.length}</button><br /><span className="wb-muted">Без даты или остались с прошлых дней.</span></div>}
    </section><aside className="td-aside">{(chestsAvailable ?? chestProgress(data).available)>0&&<button className="b24-chest-link" onClick={()=>reward()}><Icon id="system.rewards" size={48}/><span><strong>Сундук готов</strong><small>За сегодняшние действия</small></span><Icon id="action.expand" size={18}/></button>}<div className="td-rest">{p||r?<RewardArt reward={p?.reward||r!} size={58}/>:<Icon id="reward.bath" size={58}/>}<div><h3>{p ? p.reward.name : r ? r.name : 'Время для себя'}</h3><p>{p ? statusOf(p) === 'planned' ? 'Отдых уже в плане. Награда получена.' : 'Награда получена и ждёт тебя.' : r ? data.gold >= r.cost ? 'Твоя следующая награда уже доступна.' : 'До выбранной награды ' + (r.cost - data.gold) + ' золота.' : 'Выбери, чем хочешь себя порадовать.'}</p><button onClick={() => reward(p ? 'use:' + p.id : r ? 'buy:' + r.id : undefined)}>{p ? 'Использовать или запланировать' : r ? 'Открыть награду' : 'Выбрать личную награду'}</button></div></div>
    {intent && <button className="wb-week-intent" onClick={() => plan('Календарь')}><Icon id="period.week" /><span><small>Намерение недели</small>{intent}</span><Icon id="action.expand" size={17} /></button>}
    <div className="wb-quick-capture"><button onClick={notes}><Icon id="media.notes" />Записать мысль</button><button aria-label="Записать аудио или видео" onClick={notes}><Icon id="media.microphone" /></button></div>
    <div className="wb-section-head"><h3>Привычки сегодня</h3><button onClick={() => plan('Привычки')}>Все</button></div>{habits.length ? habits.map(habitRow) : <button className="tri-link-row" onClick={() => plan('Привычки')}>Выбрать привычку<Icon id="action.add" /></button>}
    <button className="wb-day-end" onClick={review}><Icon id="system.day-end" size={35} /><span><strong>Итог дня</strong><small>{data.reviews[today] ? 'Сохранён · можно дополнить' : 'Что получилось и что хочется запомнить'}</small></span><Icon id="action.expand" /></button></aside>
  </div>;
}
export function DayReview({
  data,
  onSave,
  onVoice,
  onPlan
}: {
  data: DailyData;
  onSave: (text: string) => boolean;
  onVoice: () => void;
  onPlan: () => void;
}) {
  const key = 'satoru.review.draft.' + day();
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem(key) ?? data.reviews[day()] ?? '';
    } catch {
      return data.reviews[day()] || '';
    }
  });
  const done = data.tasks.filter(t => t.date === day() && t.done),
    remaining = data.tasks.filter(t => t.date === day() && !t.done);
  return <form onSubmit={e => {
    e.preventDefault();
    if (onSave(text.trim())) {
      try {
        sessionStorage.removeItem(key);
      } catch {}
    }
  }}><div className="td-review-summary"><strong>{done.length} {done.length === 1 ? 'квест выполнен' : 'квеста выполнено'}</strong> · {duration(done.reduce((s, t) => s + (t.actual ?? t.minutes), 0))}<br />{remaining.length ? `${remaining.length} осталось — их можно перенести в Плане.` : 'Все запланированные дела завершены.'}</div><Field label="Что получилось и что хочется запомнить"><textarea autoFocus rows={5} required value={text} placeholder="Даже маленький шаг имеет значение…" onChange={e => {
        setText(e.target.value);
        try {
          sessionStorage.setItem(key, e.target.value);
        } catch {}
      }} /></Field><button className="wb-primary wb-wide">Сохранить итог</button>{!!remaining.length && <button type="button" className="wb-wide" onClick={onPlan}>Разобрать оставшиеся дела</button>}<button type="button" className="wb-wide" onClick={onVoice}><Icon id="media.microphone" />Записать голосом или видео</button></form>;
}
