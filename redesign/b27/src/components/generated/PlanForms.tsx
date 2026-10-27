import { useEffect, useState } from 'react';
import { Data, Task, uid, sphereOptions, difficultyNames, day } from './B2Model';
import { Field, Spheres } from './B2Forms';
import { Icon } from './B2Scene';
import { PlanGoal, PlanHabit, Material, horizons, legacyHorizons, taskError, overlaps, duration } from './PlanModel';
import { useDraft } from './LocalDraft';
import { DurationField } from './DurationField';
export function TaskEditor({
  initial,
  data,
  draftKey,
  onSave,
  onDelete
}: {
  initial: Task;
  data: Data;
  draftKey: string;
  onSave: (t: Task) => boolean;
  onDelete?: () => void;
}) {
  const draft = useDraft(draftKey, initial),
    t = draft.value;
  const patch = (p: Partial<Task>) => draft.setValue({
    ...t,
    ...p
  });
  const [error, setError] = useState('');
  const conflicts = overlaps(t, data.tasks);
  const linkedStep = !!t.source?.startsWith('step:');
  return <form className="pl-form" onSubmit={e => {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const next = {
      ...t,
      title: t.title.trim(),
      start: String(fields.get('start') || '')
    };
    const message = taskError(next);
    setError(message);
    if (!message && onSave(next)) draft.clear();
  }}>
    <Field label="Название квеста"><input autoFocus required maxLength={180} value={t.title} placeholder="Конкретное действие" onChange={e => patch({
        title: e.target.value
      })} /></Field>
    <Spheres primary={t.primary} background={t.background} onChange={(primary,background)=>patch({primary,background})}/>
    <label className="b24-core"><input type="checkbox" disabled={!t.date} checked={t.core} onChange={e=>patch({core:e.target.checked})}/><span><b>Ядро дня</b></span></label>
    <div className="pl-form-pair"><Field label="Дата"><input type="date" value={t.date} onChange={e => patch({
          date: e.target.value,
          start: e.target.value ? t.start : '',
          core: e.target.value ? t.core : false
        })} /></Field><Field label="Начало"><input name="start" type="time" disabled={!t.date} value={t.start} onChange={e => patch({
          start: e.target.value
        })} /></Field></div>
    <DurationField value={t.minutes} onChange={minutes=>patch({minutes})}/>
    {t.done&&<DurationField label="Фактическое время" allowZero value={t.actual??t.minutes} onChange={actual=>patch({actual})}/>}
    {conflicts.length > 0 && <div className="pl-warning" role="status">Пересекается с {conflicts.map(c => `«${c.title}» (${c.start}, ${duration(c.minutes)})`).join(', ')}. Можно сохранить так или выбрать другое время.</div>}
    {linkedStep && <p className="pl-help">Это шаг цели. Выполнение квеста обновит шаг автоматически.</p>}
      <fieldset className="pl-difficulties"><legend>Сложность</legend>{Object.entries(difficultyNames).map(([id, name]) => <button type="button" key={id} aria-pressed={id === t.difficulty} onClick={() => patch({
          difficulty: id
        })}><Icon id={'difficulty.' + id} size={28} />{name}</button>)}</fieldset>
    <details className="pl-disclosure"><summary>Связать с целью</summary>
      <Field label="Цель"><select disabled={linkedStep} value={t.goal || ''} onChange={e => patch({
          goal: e.target.value || undefined
        })}><option value="">Без связи с целью</option>{data.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
    </details>
    {error && <p className="pl-error" role="alert">{error}</p>}
    <p className="pl-help">{draft.hint}</p><button className="wb-primary wb-wide">Сохранить квест</button>
    {onDelete && <button type="button" className="wb-danger wb-wide" onClick={onDelete}>Удалить квест</button>}
  </form>;
}
export function GoalEditor({
  initial,
  data,
  onSave
}: {
  initial: PlanGoal;
  data: Data;
  onSave: (g: PlanGoal) => boolean;
}) {
  const draft = useDraft(data.goals.some(g => g.id === initial.id) ? 'goal-' + initial.id : 'goal-new', initial),
    g = draft.value;
  const patch = (p: Partial<PlanGoal>) => draft.setValue({
    ...g,
    ...p
  });
  const options = [...horizons, ...legacyHorizons.filter(h => h === g.horizon)];
  return <form className="pl-form" onSubmit={e => {
    e.preventDefault();
    if (onSave({
      ...g,
      title: g.title.trim(),
      steps: g.steps.filter(s => s.title.trim()).map(s => ({
        ...s,
        title: s.title.trim()
      }))
    })) draft.clear();
  }}>
    <Field label="Название цели"><input required autoFocus maxLength={180} value={g.title} onChange={e => patch({
        title: e.target.value
      })} /></Field>
    <Field label="Какой результат хочешь получить"><textarea rows={2} value={g.description} onChange={e => patch({
        description: e.target.value
      })} /></Field>
    <div className="pl-form-pair"><Field label="Проект"><input value={g.project} placeholder="Например, Satoru" onChange={e => patch({
          project: e.target.value
        })} /></Field><Field label="Срок · необязательно"><input type="date" value={g.deadline} onChange={e => patch({
          deadline: e.target.value
        })} /></Field></div>
    <details className="pl-disclosure"><summary>Горизонт, родительская цель и сферы</summary><Field label="Горизонт"><select value={g.horizon} onChange={e => patch({
          horizon: e.target.value
        })}>{options.map(h => <option key={h}>{h}</option>)}</select></Field><Field label="Часть большей цели"><select value={g.parent || ''} onChange={e => patch({
          parent: e.target.value || undefined
        })}><option value="">Самостоятельная цель</option>{data.goals.filter(x => x.id !== g.id).map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field><Spheres primary={g.primary} background={g.background || []} onChange={(primary, background) => patch({
        primary,
        background
      })} /></details>
    <h3>Конкретные шаги</h3><p className="pl-help">Их можно назначить на день. Переименование сохранит связь с квестом.</p>
    {g.steps.map((s, i) => <div className="pl-step-edit" key={s.id}><Field label={'Шаг ' + (i + 1)}><input value={s.title} maxLength={180} onChange={e => patch({
          steps: g.steps.map(x => x.id === s.id ? {
            ...x,
            title: e.target.value
          } : x)
        })} /></Field><button type="button" aria-label={'Убрать шаг ' + (i + 1)} onClick={() => patch({
        steps: g.steps.filter(x => x.id !== s.id)
      })}><Icon id="action.delete" /></button></div>)}
    <button type="button" onClick={() => patch({
      steps: [...g.steps, {
        id: uid(),
        title: '',
        done: false
      }]
    })}><Icon id="action.add" />Добавить шаг</button>
    <p className="pl-help">Убранный шаг оставит созданный квест в плане. {draft.hint}</p><button className="wb-primary wb-wide">Сохранить цель</button>
  </form>;
}
export function HabitEditor({
  initial,
  existing,
  onSave,
  onDelete
}: {
  initial: PlanHabit;
  existing: boolean;
  onSave: (h: PlanHabit) => boolean;
  onDelete?: () => void;
}) {
  const draft = useDraft(existing ? 'habit-' + initial.id : 'habit-new', initial),
    h = draft.value;
  const patch = (p: Partial<PlanHabit>) => draft.setValue({
    ...h,
    ...p
  });
  const [error, setError] = useState('');
  return <form className="pl-form" onSubmit={e => {
    e.preventDefault();
    if (!h.days.length) {
      setError('Выбери хотя бы один день недели.');
      return;
    }
    if (onSave({
      ...h,
      title: h.title.trim()
    })) draft.clear();
  }}>
    <Field label="Название привычки"><input autoFocus required maxLength={180} value={h.title} onChange={e => patch({
        title: e.target.value
      })} /></Field>
    <Field label="Обычная длительность, минут"><input type="number" required min={1} max={1440} value={h.minutes} onChange={e => patch({
        minutes: Number(e.target.value)
      })} /></Field>
    <fieldset className="pl-days"><legend>Дни недели</legend>{[1, 2, 3, 4, 5, 6, 0].map(i => <button type="button" key={i} aria-pressed={h.days.includes(i)} onClick={() => patch({
        days: h.days.includes(i) ? h.days.filter(d => d !== i) : [...h.days, i]
      })}>{['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][i]}</button>)}</fieldset>
    <Field label="Версия на две минуты"><input value={h.twoMin} placeholder="Самый маленький шаг" onChange={e => patch({
        twoMin: e.target.value
      })} /></Field>
    <Field label="После какого действия или в какое время"><input value={h.cue} placeholder="После вечернего чая" onChange={e => patch({
        cue: e.target.value
      })} /></Field>
    <details className="pl-disclosure"><summary>Ориентир, награда и сфера</summary><Field label="Каким человеком я становлюсь"><input value={h.identity} onChange={e => patch({
          identity: e.target.value
        })} /></Field><Field label="Чем порадую себя после"><input value={h.reward} onChange={e => patch({
          reward: e.target.value
        })} /></Field><Field label="Сфера"><select value={h.sphere} onChange={e => patch({
          sphere: e.target.value
        })}>{sphereOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></details>
    <label className="wb-check-label"><input type="checkbox" checked={h.paused} onChange={e => patch({
        paused: e.target.checked
      })} />На паузе</label>
    {error && <p role="alert" className="pl-error">{error}</p>}<p className="pl-help">{draft.hint}</p><button className="wb-primary wb-wide">Сохранить привычку</button>{onDelete && <button type="button" className="wb-danger wb-wide" onClick={onDelete}>Удалить привычку</button>}
  </form>;
}
export function MaterialEditor({
  initial,
  existing,
  onSave
}: {
  initial: Material;
  existing: boolean;
  onSave: (m: Material) => boolean;
}) {
  const draft = useDraft(existing ? 'material-' + initial.id : 'material-new', initial),
    m = draft.value;
  const [error, setError] = useState('');
  return <form className="pl-form" onSubmit={e => {
    e.preventDefault();
    try {
      const url = new URL(m.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw Error();
      if (onSave({
        ...m,
        title: m.title.trim(),
        url: url.href
      })) draft.clear();
    } catch {
      setError('Нужна ссылка, начинающаяся с https:// или http://.');
    }
  }}><Field label="Название материала"><input required autoFocus value={m.title} onChange={e => draft.setValue({
        ...m,
        title: e.target.value
      })} /></Field><Field label="Ссылка"><input required type="url" value={m.url} placeholder="https://" onChange={e => draft.setValue({
        ...m,
        url: e.target.value
      })} /></Field><Field label="Что хочу взять из этого"><textarea value={m.note || ''} rows={3} onChange={e => draft.setValue({
        ...m,
        note: e.target.value
      })} /></Field>{error && <p className="pl-error" role="alert">{error}</p>}<p className="pl-help">{draft.hint}</p><button className="wb-primary wb-wide">Сохранить материал</button></form>;
}
