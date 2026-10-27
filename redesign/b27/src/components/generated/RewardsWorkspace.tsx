import { useEffect, useRef, useState } from 'react';
import { Reward, Task, uid, label, day } from './B2Model';
import { DailyData, Purchase, buyReward, saveReward, statusOf, rewardState, rewardTask } from './DailyModel';
import { rewardCatalog } from './SatoruAssets';
import { Icon } from './B2Scene';
import { Field } from './B2Forms';
import './ThreeSections.css';
import { useDraft } from './LocalDraft';
import { ChestPreview } from './ChestPreview';
import { RewardArt,readRewardImage } from './RewardArt';
const states = {
  received: 'Получено',
  planned: 'Запланировано',
  used: 'Использовано',
  deferred: 'Отложено'
};
type Layer = {
  kind: 'edit' | 'buy' | 'use' | 'delete';
  reward?: Reward;
  id?: string;
  token?: string;
};
export function RewardsWorkspace({
  data,
  commit,
  onTask,
  onComplete,
  entry,
  onEntryHandled
}: {
  data: DailyData;
  commit: (fn: (d: DailyData) => DailyData) => boolean;
  onTask: (t: Task) => void;
  onComplete: (t: Task) => void;
  entry: string;
  onEntryHandled: () => void;
}) {
  const [mode, setMode] = useState('Личные'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('Все'),
    [owned, setOwned] = useState('Ждут меня'),
    [layer, setLayer] = useState<Layer | null>(null),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  function open(l: Layer) {
    opener.current = document.activeElement as HTMLElement;
    setLayer(l);
    setError('');
  }
  function close() {
    setLayer(null);
    requestAnimationFrame(() => opener.current?.isConnected && opener.current.focus());
  }
  useEffect(() => {
    if (layer) dialog.current?.showModal();else dialog.current?.close();
  }, [layer]);
  useEffect(() => {
    if (!entry) return;
    const [kind, id] = entry.split(':');
    if (kind === 'use') {
      setMode('Полученные');
      open({
        kind: 'use',
        id
      });
    } else {
      const reward = data.rewards.find(r => r.id === id);
      if (reward) open({
        kind: 'buy',
        reward,
        token: uid()
      });
    }
    onEntryHandled();
  }, [entry]);
  useEffect(() => {
    const f = () => close();
    addEventListener('popstate', f);
    return () => removeEventListener('popstate', f);
  }, []);
  function run(fn: (d: DailyData) => DailyData, text: string, keep = false) {
    try {
      let failure = '';
      const ok = commit(d => {
        try {
          return fn(d);
        } catch (e) {
          failure = (e as Error).message;
          throw e;
        }
      });
      if (!ok) {
        setError(failure || 'Сохранение не подтверждено. Ввод остался на месте. Повтори действие.');
        return false;
      }
      if (!keep) close();
      setMessage(text);
      setError('');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function changeMode(m: string) {
    setMode(m);
    setQuery('');
    setFilter('Все');
    setMessage('');
  }
  const purchases = (data.purchases as Purchase[]).slice().reverse();
  const waiting = purchases.filter(p => ['received', 'planned'].includes(statusOf(p)));
  const selected = data.rewards.find(r => r.id === data.nextReward);
  const list = data.rewards.filter(r => r.name.toLowerCase().includes(query.trim().toLowerCase()) && (filter !== 'Доступные' || r.cost <= data.gold));
  const catalog = rewardCatalog.filter(r => r.name.toLowerCase().includes(query.trim().toLowerCase()) && (filter !== 'Доступные' || r.cost <= data.gold) && (filter !== 'Не добавлены' || !data.rewards.some(x => x.iconId === r.iconId)));
  const buy = (r: Reward) => open({
    kind: 'buy',
    reward: r,
    token: uid()
  });
  const empty = (title: string, body: string) => <div className="tri-empty"><h3>{title}</h3><p>{body}</p></div>;
  const purchase = layer?.kind === 'use' ? purchases.find(p => p.id === layer.id) : undefined;
  const linked = purchase ? data.tasks.find(t => t.source === 'reward:' + purchase.id) : undefined;
  return <section className="rw-workspace">
    <div className="tri-heading"><div><h2>Награды</h2><p>То, ради чего приятно стараться.</p></div><span className="rw-wallet" aria-label={'Баланс ' + data.gold + ' золота'}><Icon id="status.gold" size={34} /><b>{data.gold.toLocaleString('ru-RU')}</b></span></div>
    <div className="wb-segments rw-tabs" role="group" aria-label="Раздел наград">{['Личные', 'Каталог', 'Полученные'].map(m => <button key={m} aria-pressed={mode === m} onClick={() => changeMode(m)}>{m}{m === 'Полученные' && waiting.length > 0 ? <span className="rw-count">{waiting.length}</span> : null}</button>)}</div>
    {message && <p className="tri-receipt" role="status">{message}</p>}{error && !layer && <p className="pl-error" role="alert">{error}</p>}
    {mode === 'Личные' && <>
      <ChestPreview data={data} commit={commit}/>
      <div className="rw-lead">{selected?<RewardArt reward={selected} size={86}/>:<Icon id="reward.game" size={86}/>}<div><h3>{selected ? selected.name : 'Выбери, чего ждёшь'}</h3><p>{selected ? data.gold >= selected.cost ? 'Уже доступна · ' + selected.cost + ' золота' : 'Осталось накопить ' + (selected.cost - data.gold) + ' золота' : 'Закрепи одну личную награду — она появится на главной.'}</p>{selected && <div className="rw-lead-actions"><button className="wb-primary" disabled={data.gold < selected.cost} onClick={() => buy(selected)}>Получить</button><button onClick={() => run(d => ({
              ...d,
              nextReward: undefined
            }), 'Выбор снят', true)}>Открепить</button></div>}</div></div>
      {waiting.length > 0 && <button className="tri-link-row" onClick={() => changeMode('Полученные')}><Icon id="action.check" /><span><strong>{waiting.length} {waiting.length === 1 ? 'награда ждёт' : 'награды ждут'} тебя</strong><small>{waiting[0].reward.name}</small></span><Icon id="action.expand" /></button>}
      <div className="tri-section-head"><h3>Мой список</h3><button onClick={() => open({
          kind: 'edit',
          reward: {
            id: uid(),
            name: '',
            cost: 100,
            iconId: 'reward.game'
          }
        })}><Icon id="action.add" />Своя награда</button></div>
      <div className="rw-search"><input aria-label="Поиск личной награды" placeholder="Найти в моих наградах" value={query} onChange={e => setQuery(e.target.value)} /><button aria-pressed={filter === 'Доступные'} onClick={() => setFilter(filter === 'Все' ? 'Доступные' : 'Все')}>Доступные</button></div>
      <div className="rw-personal-list">{list.map(r => <article className="rw-personal" key={r.id}><RewardArt reward={r} size={64}/><div><button className="rw-name" onClick={() => open({
              kind: 'edit',
              reward: r
            })}>{r.name}</button><small>{r.cost} золота{r.cost > data.gold ? ' · не хватает ' + (r.cost - data.gold) : ' · доступна'}</small><div className="rw-row-actions"><button aria-pressed={data.nextReward === r.id} onClick={() => run(d => ({
                ...d,
                nextReward: d.nextReward === r.id ? undefined : r.id
              }), data.nextReward === r.id ? 'Выбор снят' : 'Награда появится на главной', true)}>{data.nextReward === r.id ? 'Выбрана на главной' : 'Хочу следующей'}</button><button disabled={r.cost > data.gold} onClick={() => buy(r)}>Получить</button></div></div><button className="rw-edit" aria-label={'Изменить награду: ' + r.name} onClick={() => open({
            kind: 'edit',
            reward: r
          })}><Icon id="action.edit" size={18} /></button></article>)}</div>
      {!list.length && empty(query || filter !== 'Все' ? 'Ничего не найдено' : 'Твой список пока пуст', query || filter !== 'Все' ? 'Измени поиск или фильтр.' : 'Добавь личную награду или выбери готовую из каталога.')}
      <button className="tri-link-row" onClick={() => changeMode('Каталог')}><Icon id="nav.rewards" /><span>Каталог · {rewardCatalog.length} готовые награды</span><Icon id="action.expand" /></button>
      <p className="rw-note">Отдых не нужно заслуживать. Золото — способ отметить усилия и не забыть о том, что радует.</p>
    </>}
    {mode === 'Каталог' && <><div className="rw-search"><input aria-label="Поиск в каталоге" placeholder="Кино, игры, прогулка…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="tri-filters">{['Все', 'Доступные', 'Не добавлены'].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div><div className="rw-catalog">{catalog.map(r => {
          const added = data.rewards.some(x => x.iconId === r.iconId);
          return <article key={r.iconId}><Icon id={r.iconId} size={78} /><h3>{r.name}</h3><p>{r.cost} золота</p><button disabled={added} onClick={() => run(d => d.rewards.some(x => x.iconId === r.iconId) ? d : saveReward(d, {
              ...r,
              id: uid()
            }), 'Добавлено в личные. Название и цену можно изменить.', true)}>{added ? 'В моём списке' : 'Добавить себе'}</button></article>;
        })}</div>{!catalog.length && empty('Таких наград нет', 'Попробуй другой запрос или создай свою награду.')}<button className="wb-primary wb-wide" onClick={() => open({
        kind: 'edit',
        reward: {
          id: uid(),
          name: query,
          cost: 100,
          iconId: 'reward.hobby'
        }
      })}>Создать свою награду</button></>}
    {mode === 'Полученные' && <><p className="rw-note">Золото уже списано. Планирование и отметки использования не меняют баланс.</p><div className="tri-filters">{['Ждут меня', 'Использованы', 'Отложены', 'Все'].map(f => <button key={f} aria-pressed={owned === f} onClick={() => setOwned(f)}>{f}</button>)}</div>{purchases.filter(p => owned === 'Все' || owned === 'Ждут меня' && ['received', 'planned'].includes(statusOf(p)) || owned === 'Использованы' && statusOf(p) === 'used' || owned === 'Отложены' && statusOf(p) === 'deferred').map(p => <article className="rw-owned" key={p.id}><RewardArt reward={p.reward} size={60}/><div><h3>{p.reward.name}</h3><p>{states[statusOf(p)]}{p.date ? ' · ' + label(p.date, true) : ''}</p><small>{label(p.at.slice(0, 10), true)} · {p.reward.cost} золота</small></div><button aria-label={'Открыть полученную награду: ' + p.reward.name} onClick={() => open({
          kind: 'use',
          id: p.id
        })}><Icon id="action.expand" /></button></article>)}{!purchases.some(p => owned === 'Все' || owned === 'Ждут меня' && ['received', 'planned'].includes(statusOf(p)) || owned === 'Использованы' && statusOf(p) === 'used' || owned === 'Отложены' && statusOf(p) === 'deferred') && empty('Здесь пока пусто', owned === 'Ждут меня' ? 'Получи награду из своего списка. Здесь она останется до использования.' : 'Награды с этой отметкой появятся здесь.')}<details className="wb-details"><summary>История золота и действий</summary>{data.history.length ? data.history.slice(0, 60).map(h => <p key={h.id}><small>{label(h.at.slice(0, 10), true)} · {new Date(h.at).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            })}</small><br />{h.text}</p>) : <p>Операций пока нет.</p>}</details></>}
    <details className="rw-collection"><summary>Коллекция и достижения</summary><h3>Достижения этого макета</h3><div className="rw-achievements">{[['first_quest', 'Первый шаг', data.tasks.some(t => t.done), 'Заверши квест'], ['first_goal', 'Цель взята', data.goals.some(g => g.done), 'Достигни цели'], ['first_reward', 'Для себя', purchases.length > 0, 'Получи личную награду']].map(([id, name, got, hint]) => <div key={String(id)}><Icon id={'achievement.' + id} size={52} /><span><strong>{name}</strong><small>{got ? 'Получено' : hint}</small></span></div>)}</div></details>
    <dialog ref={dialog} className={'wb-dialog rw-dialog palette-' + data.palette} aria-label={layer?.kind === 'buy' ? 'Получить награду' : layer?.kind === 'edit' ? 'Личная награда' : 'Полученная награда'} onCancel={e => {
      e.preventDefault();
      close();
    }} onClick={e => {
      if (e.target === dialog.current) close();
    }}><div className="wb-sheet"><header><h2>{layer?.kind === 'buy' ? 'Получить награду' : layer?.kind === 'edit' ? 'Личная награда' : layer?.kind === 'delete' ? 'Удалить из списка?' : 'Время для себя'}</h2><button aria-label="Закрыть награду" onClick={close}><Icon id="action.close" /></button></header>{error && <p className="pl-error" role="alert">{error}</p>}
      {layer?.kind === 'edit' && <RewardEditor key={layer.reward!.id} initial={layer.reward!} isNew={!data.rewards.some(r => r.id === layer.reward!.id)} onSave={r => {
          const ok = run(d => saveReward(d, r), 'Личная награда сохранена');
          if (ok) changeMode('Личные');
          return ok;
        }} onDelete={data.rewards.some(r => r.id === layer.reward!.id) ? () => open({
          ...layer,
          kind: 'delete'
        }) : undefined} />}
      {layer?.kind === 'delete' && <><p>«{layer.reward!.name}» исчезнет из личного списка. Все полученные экземпляры и история останутся.</p><button className="wb-danger wb-wide" onClick={() => run(d => ({
            ...d,
            rewards: d.rewards.filter(r => r.id !== layer.reward!.id)
          }), 'Награда удалена из списка')}>Удалить из списка</button><button className="wb-wide" onClick={close}>Оставить</button></>}
      {layer?.kind === 'buy' && <><div className="rw-buy"><RewardArt reward={layer.reward!} size={108}/><h3>{layer.reward!.name}</h3></div><dl className="rw-receipt"><div><dt>Баланс</dt><dd>{data.gold}</dd></div><div><dt>Стоимость</dt><dd>−{layer.reward!.cost}</dd></div><div><dt>После получения</dt><dd>{Math.max(0, data.gold - layer.reward!.cost)}</dd></div></dl>{data.gold < layer.reward!.cost && <p className="pl-warning">Не хватает {layer.reward!.cost - data.gold} золота.</p>}<button className="wb-primary wb-wide" disabled={data.gold < layer.reward!.cost} onClick={() => {
            const id = layer.token!;
            if (run(d => buyReward(d, layer.reward!.id, id, layer.reward!.cost), 'Награда получена. Золото списано один раз.', true)) {
              setMode('Полученные');
              setOwned('Ждут меня');
              open({
                kind: 'use',
                id
              });
            }
          }}>Получить за {layer.reward!.cost} золота</button><p className="rw-note">Это золото макета. Если награда требует реальных расходов, их нужно обеспечить отдельно.</p></>}
      {purchase && <><div className="rw-buy"><RewardArt reward={purchase.reward} size={92}/><h3>{purchase.reward.name}</h3><p>{states[statusOf(purchase)]}{purchase.date ? ' · ' + label(purchase.date, true) : ''}</p></div>{['received', 'planned'].includes(statusOf(purchase)) ? <><button className="wb-primary wb-wide" onClick={() => {
              if (linked && !linked.done) {
                close();
                onComplete(linked);
              } else run(d => rewardState(d, purchase.id, 'used'), 'Использование сохранено · без повторного списания');
            }}>Я воспользовался</button><button className="wb-wide" onClick={() => {
              const t = rewardTask(data, purchase.id);
              close();
              onTask(t);
            }}><Icon id="period.day" />{linked ? 'Открыть отдых в плане' : 'Запланировать отдых как квест'}</button><p className="rw-note">Квест отдыха появится в Сегодня и Плане. Его завершение отметит награду использованной.</p><button className="wb-wide" onClick={() => run(d => rewardState(d, purchase.id, 'deferred'), 'Награда отложена')}>Отложить награду</button></> : <><button className="wb-primary wb-wide" onClick={() => {
              if (linked?.done) {
                close();
                onTask(linked);
              } else run(d => rewardState(d, purchase.id, 'received'), 'Награда снова в полученных · баланс не изменился');
            }}>{linked?.done ? 'Открыть завершённый квест' : 'Вернуть в полученные'}</button><p className="rw-note">Это изменение отметки. Потраченное золото не возвращается.</p></>}</>}
    </div></dialog>
  </section>;
}
function RewardEditor({
  initial,
  isNew,
  onSave,
  onDelete
}: {
  initial: Reward;
  isNew: boolean;
  onSave: (r: Reward) => boolean;
  onDelete?: () => void;
}) {
  const draft = useDraft(isNew ? 'reward-new' : 'reward-' + initial.id, initial),
    r = draft.value,
    setR = draft.setValue;
  const [error, setError] = useState('');
  return <form onSubmit={e => {
    e.preventDefault();
    if (!r.name.trim()) {
      setError('Укажи название.');
      return;
    }
    if (onSave(r)) draft.clear();
  }}><Field label="Что тебя порадует"><input autoFocus required maxLength={140} value={r.name} placeholder="Например, вечер с любимой игрой" onChange={e => setR({
        ...r,
        name: e.target.value
      })} /></Field><Field label="Цена в золоте"><input type="number" required min={1} max={1000000} value={r.cost} onChange={e => setR({
        ...r,
        cost: Number(e.target.value)
      })} /></Field><p className="rw-note">Цену выбираешь ты. Изменение не затронет уже полученные награды.</p><details className="wb-details"><summary>Выбрать значок</summary><div className="rw-icon-picker">{rewardCatalog.map(x => <button key={x.iconId} type="button" aria-label={'Иллюстрация: ' + x.name} aria-pressed={r.iconId === x.iconId} onClick={() => setR({
          ...r,
          iconId: x.iconId,image:undefined
        })}><Icon id={x.iconId} size={42} /></button>)}</div></details><label className="b24-upload"><span>Своя картинка</span>{r.image&&<RewardArt reward={r} size={100}/>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const image=await readRewardImage(file);setR({...r,image});setError('');}catch(err){setError((err as Error).message);}}}/><small>PNG, JPEG или WebP · до 5 МБ</small></label>{r.image&&<button type="button" onClick={()=>setR({...r,image:undefined})}>Убрать картинку</button>}{error && <p role="alert">{error}</p>}<p className="rw-note">{draft.hint}</p><button className="wb-primary wb-wide">Сохранить награду</button>{onDelete && <button type="button" className="wb-danger wb-wide" onClick={onDelete}>Удалить из моего списка</button>}</form>;
}
