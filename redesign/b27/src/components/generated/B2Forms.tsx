import { useState } from 'react';
import { useDraft } from './LocalDraft';
import type { ReactNode } from 'react';
import { Task, Goal, Habit, Note, Reward, Data, sphereOptions, spheres, sphere, uid, day, difficultyNames } from './B2Model';
import { Icon } from './B2Scene';
import { Capture, MediaPlayer, putMedia } from './B2Media';
export function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return <label className="wb-field"><span>{label}</span>{children}</label>;
}
export function Spheres({
  primary,
  background,
  onChange
}: {
  primary: string[];
  background: string[];
  onChange: (p: string[], b: string[]) => void;
}) {
  const [q, setQ] = useState('');
  return <details className="wb-sphere-picker"><summary><b>Сферы</b><span>{primary.map(id => sphere(id).name).join(', ') || 'Выбери основную'}{background.length ? ' · +' + background.length + ' сопутств.' : ''}</span></summary><input aria-label="Поиск сферы" placeholder="Найти сферу или подсферу" value={q} onChange={e => setQ(e.target.value)} /><small>Основная — результат дела. Сопутствующая — то, что оно поддерживает попутно.</small><div className="wb-sphere-scroll">{sphereOptions.filter(s => s.name.toLowerCase().includes(q.toLowerCase())).map(s => <div key={s.id} className={'wb-sphere-option ' + (s.id.includes('/') ? 'child' : '')}><span><i style={{
            background: s.color
          }} />{s.name}</span><button type="button" aria-label={'Основная: ' + s.name} aria-pressed={primary.includes(s.id)} onClick={() => onChange(primary.includes(s.id) ? primary.filter(x => x !== s.id) : [...primary, s.id], background.filter(x => x !== s.id))}>Основная</button><button type="button" aria-label={'Сопутствующая: ' + s.name} disabled={!background.includes(s.id) && background.length >= 3} aria-pressed={background.includes(s.id)} onClick={() => onChange(primary.filter(x => x !== s.id), background.includes(s.id) ? background.filter(x => x !== s.id) : [...background, s.id])}>+ Фон</button></div>)}</div></details>;
}
export function QuestForm({
  initial,
  goals,
  onSave,
  onDelete
}: {
  initial: Task;
  goals: Goal[];
  onSave: (t: Task) => void;
  onDelete?: () => void;
}) {
  const [t, setT] = useState(initial),
    [error, setError] = useState('');
  const patch = (p: Partial<Task>) => setT({
    ...t,
    ...p
  });
  return <form onSubmit={e => {
    e.preventDefault();
    if (!t.title.trim()) return;
    if (!t.primary.length) {
      setError('Выбери хотя бы одну основную сферу.');
      return;
    }
    onSave({
      ...t,
      title: t.title.trim()
    });
  }}><Field label="Название квеста"><input autoFocus required maxLength={180} placeholder="Что хочешь сделать?" value={t.title} onChange={e => patch({
        title: e.target.value
      })} /></Field><div className="wb-form-grid"><Field label="Дата"><input type="date" required value={t.date} onChange={e => patch({
          date: e.target.value
        })} /></Field><Field label="Начало · необязательно"><input type="time" value={t.start} onChange={e => patch({
          start: e.target.value
        })} /></Field><Field label="План, минут"><input type="number" min="1" max="1440" required value={t.minutes} onChange={e => patch({
          minutes: Number(e.target.value)
        })} /></Field><Field label="Факт, минут"><input type="number" min="0" max="1440" placeholder="После выполнения" value={t.actual ?? ''} onChange={e => patch({
          actual: e.target.value === '' ? null : Number(e.target.value)
        })} /></Field></div>{t.reflection && <p className="wb-muted">После выполнения: {t.reflection}</p>}<fieldset className="wb-difficulty"><legend>Сложность</legend>{Object.keys(difficultyNames).map(v => <button type="button" key={v} aria-pressed={t.difficulty === v} onClick={() => patch({
        difficulty: v
      })}><Icon id={'difficulty.' + v} size={30} />{difficultyNames[v]}</button>)}</fieldset><Spheres primary={t.primary} background={t.background} onChange={(primary, background) => patch({
      primary,
      background
    })} /><details className="wb-details"><summary>Связи и акцент дня</summary><Field label="Связать с целью"><select value={t.goal || ''} onChange={e => patch({
          goal: e.target.value || undefined
        })}><option value="">Без цели</option>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field><label className="wb-check-label"><input type="checkbox" checked={t.core} onChange={e => patch({
          core: e.target.checked
        })} />В ядре дня</label></details>{error && <p role="alert" className="wb-error">{error}</p>}<button className="wb-primary wb-wide">Сохранить квест</button>{onDelete && <button type="button" className="wb-danger wb-wide" onClick={onDelete}><Icon id="action.delete" />Удалить квест</button>}</form>;
}
export function GoalForm({
  initial,
  onSave
}: {
  initial: Goal;
  onSave: (g: Goal) => void;
}) {
  const [g, setG] = useState(initial),
    [steps, setSteps] = useState(initial.steps.map(s => s.title).join('\n'));
  return <form onSubmit={e => {
    e.preventDefault();
    if (!g.title.trim() || !g.primary.length) return;
    const list = steps.split('\n').map(s => s.trim()).filter(Boolean).map(title => g.steps.find(s => s.title === title) || {
      id: uid(),
      title,
      done: false
    });
    onSave({
      ...g,
      title: g.title.trim(),
      steps: list
    });
  }}><Field label="Название цели"><input required value={g.title} onChange={e => setG({
        ...g,
        title: e.target.value
      })} /></Field><Field label="Что изменится, когда получится"><textarea rows={3} value={g.description} onChange={e => setG({
        ...g,
        description: e.target.value
      })} /></Field><div className="wb-form-grid"><Field label="Проект"><input placeholder="Например, Satoru" value={g.project} onChange={e => setG({
          ...g,
          project: e.target.value
        })} /></Field><Field label="Горизонт"><select value={g.horizon} onChange={e => setG({
          ...g,
          horizon: e.target.value
        })}>{['Неделя', 'Месяц', 'Квартал', 'Год', 'Когда-нибудь'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Срок · необязательно"><input type="date" value={g.deadline} onChange={e => setG({
          ...g,
          deadline: e.target.value
        })} /></Field></div><Spheres primary={g.primary} background={g.background || []} onChange={(primary, background) => setG({
      ...g,
      primary,
      background
    })} /><Field label="Шаги · по одному на строку"><textarea rows={4} placeholder="Первый конкретный шаг" value={steps} onChange={e => setSteps(e.target.value)} /></Field><button className="wb-primary wb-wide" disabled={!g.primary.length}>Сохранить цель</button></form>;
}
export function HabitForm({
  initial,
  onSave
}: {
  initial: Habit;
  onSave: (h: Habit) => void;
}) {
  const [h, setH] = useState(initial);
  return <form onSubmit={e => {
    e.preventDefault();
    onSave({
      ...h,
      title: h.title.trim()
    });
  }}><Field label="Название привычки"><input required value={h.title} onChange={e => setH({
        ...h,
        title: e.target.value
      })} /></Field><div className="wb-form-grid"><Field label="Сфера"><select value={h.sphere} onChange={e => setH({
          ...h,
          sphere: e.target.value
        })}>{sphereOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Минут"><input type="number" required min="1" max="1440" value={h.minutes} onChange={e => setH({
          ...h,
          minutes: Number(e.target.value)
        })} /></Field></div><fieldset className="wb-day-picks"><legend>Дни недели</legend>{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => {
        const value = (i + 1) % 7;
        return <button type="button" key={d} aria-pressed={h.days.includes(value)} onClick={() => setH({
          ...h,
          days: h.days.includes(value) ? h.days.filter(x => x !== value) : [...h.days, value]
        })}>{d}</button>;
      })}</fieldset><Field label="Версия на две минуты"><input required placeholder="Минимум, с которого можно начать" value={h.twoMin} onChange={e => setH({
        ...h,
        twoMin: e.target.value
      })} /></Field><details className="wb-details" open><summary>Петля привычки</summary><Field label="Идентичность · кем я становлюсь"><input value={h.identity} onChange={e => setH({
          ...h,
          identity: e.target.value
        })} /></Field><Field label="Сигнал · после чего начну"><input placeholder="После утреннего кофе я…" value={h.cue} onChange={e => setH({
          ...h,
          cue: e.target.value
        })} /></Field><Field label="Награда · чем отмечу"><input value={h.reward} onChange={e => setH({
          ...h,
          reward: e.target.value
        })} /></Field></details><label className="wb-check-label"><input type="checkbox" checked={h.paused} onChange={e => setH({
        ...h,
        paused: e.target.checked
      })} />Поставить привычку на паузу</label><button className="wb-primary wb-wide" disabled={!h.days.length}>Сохранить привычку</button></form>;
}
export function NoteForm({
  initial,
  isNew = false,
  onSave
}: {
  initial: Note;
  isNew?: boolean;
  onSave: (n: Note) => boolean;
}) {
  const draft = useDraft(isNew ? 'note-new' : 'note-' + initial.id, initial),
    n = draft.value,
    setN = draft.setValue;
  const [attachment, setAttachment] = useState<{
      blob: Blob;
      kind: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return <form onSubmit={async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let next = n;
      if (attachment) {
        const id = uid();
        await putMedia(id, attachment.blob);
        next = {
          ...n,
          media: id,
          kind: attachment.kind,
          mime: attachment.blob.type
        };
        setN(next);
        setAttachment(null);
      }
      if (onSave({
        ...next,
        text: next.text.trim()
      })) draft.clear();
    } catch {
      setError('Не удалось сохранить медиа. Запись осталась в форме — повтори сохранение.');
    } finally {
      setBusy(false);
    }
  }}><Field label="Мысль или подпись к записи"><textarea autoFocus rows={5} value={n.text} onChange={e => setN({
        ...n,
        text: e.target.value
      })} placeholder="Что хочется сохранить?" /></Field>{n.media && <MediaPlayer id={n.media} kind={n.kind} />}<Capture onCapture={(blob, kind) => {
      setAttachment({
        blob,
        kind
      });
      setError('');
    }} />{attachment && <p role="status">{attachment.kind === 'video' ? 'Видео' : 'Аудио'} прикреплено · {(attachment.blob.size / 1024 / 1024).toFixed(1)} МБ<button type="button" onClick={() => setAttachment(null)}>Убрать вложение</button></p>}<small>{draft.hint} Медиа сохранится после нажатия «Сохранить заметку»; до этого не закрывай форму.</small>{error && <p role="alert" className="wb-error">{error}</p>}<button className="wb-primary wb-wide" disabled={busy || !n.text.trim() && !n.media && !attachment}>{busy ? 'Сохраняем…' : 'Сохранить заметку'}</button></form>;
}
export function RewardForm({
  onSave
}: {
  onSave: (r: Reward) => void;
}) {
  return <form onSubmit={e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      id: uid(),
      name: String(f.get('name')).trim(),
      cost: Number(f.get('cost')),
      iconId: String(f.get('icon'))
    });
  }}><Field label="Название награды"><input name="name" required maxLength={120} placeholder="Как хочу отдохнуть" /></Field><div className="wb-form-grid"><Field label="Цена в золоте"><input type="number" name="cost" min="1" max="100000" defaultValue={100} required /></Field><Field label="Образ"><select name="icon">{[['game', 'Игры'], ['coffee', 'Кофе'], ['movie', 'Кино'], ['book', 'Книга'], ['walk', 'Прогулка'], ['wishlist', 'Мечта']].map(([id, name]) => <option key={id} value={'reward.' + id}>{name}</option>)}</select></Field></div><button className="wb-primary wb-wide">Добавить награду</button></form>;
}
