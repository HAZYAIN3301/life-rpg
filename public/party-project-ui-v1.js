(function(root) {
  'use strict';
  const copy = {
    focus: ['Фокус', 'Focus', 'Fokus', 'Фокус', 'Concentración'],
    focusRule: ['Остановленная сессия от одной минуты тоже подходит. Фокус и завершение одного дела дают один общий вклад.', 'A stopped session of at least one minute also counts. Focus and completion of the same task share one contribution.', 'Eine beendete Sitzung ab einer Minute zählt auch. Fokus und Abschluss derselben Aufgabe ergeben nur einen Beitrag.', 'Зупинена сесія від однієї хвилини також підходить. Фокус і завершення однієї справи дають один спільний внесок.', 'También cuenta una sesión detenida de al menos un minuto. Concentración y finalización de la misma tarea cuentan como una sola aportación.'],
    habit: ['Привычка', 'Habit', 'Gewohnheit', 'Звичка', 'Hábito'],
    sources: ['Можно внести дело или отметку привычки, сохранённые после начала проекта. Каждая отметка привычки засчитывается один раз за день. Дополнительной награды нет.', 'Contribute a task or habit check-in saved after the project started. Each habit counts once per day. No extra reward.', 'Bringe eine nach Projektbeginn gespeicherte Aufgabe oder Gewohnheit ein. Jede Gewohnheit zählt einmal pro Tag. Keine zusätzliche Belohnung.', 'Додай справу або відмітку звички, збережені після початку проєкту. Кожна звичка зараховується один раз на день. Додаткової нагороди немає.', 'Aporta una tarea o hábito guardado después del inicio. Cada hábito cuenta una vez al día. Sin recompensa adicional.'],
    title: ['Наш проект', 'Our project', 'Unser Projekt', 'Наш проєкт', 'Nuestro proyecto'],
    hearth: ['Вечерний очаг', 'Evening hearth', 'Abend am Kamin', 'Вечірнє вогнище', 'Hogar al anochecer'],
    garden: ['Зелёное окно', 'Green window', 'Grünes Fenster', 'Зелене вікно', 'Ventana verde'],
    hearthDesc: ['Разожгите очаг и откройте вечерний свет в общей комнате.', 'Light the hearth and bring evening light to your shared room.', 'Entzündet den Kamin und bringt Abendlicht in euren Raum.', 'Розпаліть вогнище й відкрийте вечірнє світло у спільній кімнаті.', 'Encended el hogar e iluminad vuestra habitación al anochecer.'],
    gardenDesc: ['Вырастите два растения у окна общей комнаты.', 'Grow two plants by the shared room window.', 'Zieht zwei Pflanzen am Fenster eures Raums.', 'Виростіть дві рослини біля вікна спільної кімнати.', 'Cultivad dos plantas junto a vuestra ventana.'],
    choose: ['Выберите, что изменится в комнате. Каждый вносит свои выполненные дела.', 'Choose what changes in the room. Each person contributes their completed tasks.', 'Wählt eine Veränderung im Raum. Alle bringen eigene erledigte Aufgaben ein.', 'Виберіть, що зміниться в кімнаті. Кожен додає свої виконані справи.', 'Elegid qué cambiar en la habitación. Cada persona aporta sus tareas completadas.'],
    start: ['Начать вместе', 'Start together', 'Gemeinsam beginnen', 'Почати разом', 'Empezar juntos'],
    progress: ['Вклад в проект', 'Project progress', 'Projektfortschritt', 'Внесок у проєкт', 'Progreso del proyecto'],
    contribute: ['Внести выполненное дело', 'Contribute completed task', 'Erledigte Aufgabe beitragen', 'Додати виконану справу', 'Aportar tarea completada'],
    task: ['Моё выполненное дело', 'My completed task', 'Meine erledigte Aufgabe', 'Моя виконана справа', 'Mi tarea completada'],
    private: ['Группа увидит только общий прогресс. Название дела останется у тебя. Золото за дело уже начислено.', 'The group sees only shared progress. Your task title stays private. Task gold has already been awarded.', 'Die Gruppe sieht nur den Fortschritt. Dein Aufgabentitel bleibt privat. Das Aufgabengold wurde bereits vergeben.', 'Група побачить лише спільний прогрес. Назва справи залишиться приватною. Золото за справу вже нараховано.', 'El grupo solo ve el progreso. El título sigue privado. El oro de la tarea ya se ha otorgado.'],
    empty: ['Заверши своё дело после начала проекта и вернись сюда. Пропуски не отнимают прогресс.', 'Finish your own task after the project starts, then return here. Missed days never remove progress.', 'Erledige nach Projektbeginn eine Aufgabe und kehre zurück. Pausen nehmen keinen Fortschritt weg.', 'Заверши свою справу після початку проєкту й повернись сюди. Пропуски не забирають прогрес.', 'Completa una tarea después del inicio y vuelve aquí. Los días de pausa no restan progreso.'],
    today: ['К моим делам', 'Go to my tasks', 'Zu meinen Aufgaben', 'До моїх справ', 'Ir a mis tareas'],
    done: ['Готово — осталось в вашей комнате', 'Completed — stays in your room', 'Fertig — bleibt in eurem Raum', 'Готово — залишилось у вашій кімнаті', 'Completado — permanece en vuestra habitación'],
    rules: ['Без срока. Для завершения нужен вклад хотя бы двух участников. Одно дело засчитывается один раз.', 'No deadline. Completion needs contributions from at least two people. Each task counts once.', 'Ohne Frist. Zum Abschluss braucht es Beiträge von mindestens zwei Personen. Jede Aufgabe zählt einmal.', 'Без строку. Для завершення потрібен внесок щонайменше двох учасників. Одна справа зараховується один раз.', 'Sin plazo. Para terminar deben contribuir al menos dos personas. Cada tarea cuenta una vez.'],
    partner: ['Для последнего шага нужен вклад другого участника. Его дело может быть совсем небольшим.', 'The last step needs another participant. Their task can be small.', 'Der letzte Schritt braucht einen Beitrag von jemand anderem. Eine kleine Aufgabe reicht.', 'Для останнього кроку потрібен внесок іншого учасника. Його справа може бути невеликою.', 'El último paso necesita a otra persona. Su tarea puede ser pequeña.'],
    error: ['Сохранение не подтверждено. Повтори попытку.', 'Save not confirmed. Please retry.', 'Speicherung nicht bestätigt. Bitte erneut versuchen.', 'Збереження не підтверджено. Спробуй ще раз.', 'Guardado no confirmado. Reintenta.'],
    conflict: ['Проект или дело изменились. Обнови список.', 'The project or task changed. Refresh the list.', 'Projekt oder Aufgabe geändert. Liste aktualisieren.', 'Проєкт або справа змінилися. Онови список.', 'El proyecto o la tarea cambiaron. Actualiza la lista.'],
    refresh: ['Обновить проект', 'Refresh project', 'Projekt aktualisieren', 'Оновити проєкт', 'Actualizar proyecto'],
    retry: ['Повторить сохранение', 'Retry save', 'Speichern wiederholen', 'Повторити збереження', 'Reintentar guardado'],
    saved: ['Вклад сохранён. Комната стала ближе к вашему замыслу.', 'Contribution saved. Your room is one step closer.', 'Beitrag gespeichert. Euer Raum ist einen Schritt weiter.', 'Внесок збережено. Кімната стала ближчою до вашого задуму.', 'Aportación guardada. Vuestra habitación está un paso más cerca.'],
    loading: ['Загружаем проект…', 'Loading project…', 'Projekt wird geladen…', 'Завантажуємо проєкт…', 'Cargando proyecto…'],
  };
  const text = (key, locale) => copy[key][({ ru: 0, en: 1, de: 2, uk: 3, es: 4 })[locale] ?? 1];
  function createUI(d) {
    let identity = '', eligible = null, busy = false, reading = false, pending = null, message = '';
    const t = key => text(key, d.lang()), e = d.escape;
    function today() {
      if (!scope()) return '';
      const active = d.state().party.projects?.chapters.find(c => !c.completedAt);
      return active ? `<button type="button" class="duo-today" data-project="open"><span><b>${t(active.id)}</b><small>${t('progress')}: ${active.progress} / ${active.target}</small></span><span aria-hidden="true">→</span></button>` : '';
    }
    function scope() {
      const p = d.state().party, next = p?.id && p.members?.find(m => m.me)?.id ? p.id + ':' + p.members.find(m => m.me).id : '';
      if (next !== identity) { identity = next; eligible = null; busy = false; pending = null; message = ''; }
      return next;
    }
    function body() {
      if (!scope()) return '';
      const projects = d.state().party.projects, active = projects?.chapters.find(c => !c.completedAt);
      if (eligible === null && !reading) queueMicrotask(() => refresh());
      if (!projects) return `<p role="status">${t('loading')}</p>`;
      const completed = projects.chapters.filter(c => c.completedAt);
      const choices = root.PartyProjectV1.catalog.filter(c => !projects.chapters.some(x => x.id === c.id));
      return `<div class="shared-project" aria-labelledby="shared-project-title"><h4 id="shared-project-title" tabindex="-1">${t('title')}</h4><div data-focus-sync-host>${d.notice?.() || ''}</div>
        ${active ? `<strong>${t(active.id)}</strong><p>${t(active.id + 'Desc')}</p><progress max="${active.target}" value="${active.progress}" aria-label="${e(t('progress'))}"></progress><p>${active.progress} / ${active.target}</p>
          ${eligible?.length ? `<label for="project-task">${t('task')}</label><select id="project-task" ${busy || pending ? 'disabled' : ''}>${eligible.map(task => `<option value="${e(JSON.stringify([task.kind || 'task', task.id]))}">${task.kind === 'habit' || task.kind === 'focus' ? t(task.kind) + ' · ' : ''}${e(task.title)}</option>`).join('')}</select><button class="btn" data-project="contribute" data-id="${active.id}" ${busy || pending ? 'disabled' : ''}>${t('contribute')}</button><p class="muted">${t('private')}</p>` : `<p class="muted">${t('empty')}</p><button class="btn" data-project="today">${t('today')}</button>`}
          <details><summary>${t('progress')}</summary><p class="muted">${t('sources')}</p><p class="muted">${t('focusRule')}</p></details>
          <p class="muted">${t('rules')}</p>` : choices.length ? `<p>${t('choose')}</p><div class="project-choices">${choices.map(c => `<article><strong>${t(c.id)}</strong><p>${t(c.id + 'Desc')}</p><p>${t('progress')}: 0 / ${c.target}</p><button class="btn ghost" data-project="start" data-id="${c.id}" ${busy || pending ? 'disabled' : ''}>${t('start')}</button></article>`).join('')}</div><p class="muted">${t('rules')}</p>` : ''}
        ${completed.length ? `<ul class="project-completed">${completed.map(c => `<li><strong>${t(c.id)}</strong> · ${t('done')}</li>`).join('')}</ul>` : ''}
        <p role="status" aria-live="polite">${e(message)}</p><div class="gold-goal-actions">${pending && !busy ? `<button class="btn" data-project="retry">${t('retry')}</button>` : ''}<button class="btn ghost" data-project="refresh" ${busy ? 'disabled' : ''}>${t('refresh')}</button></div></div>`;
    }
    function paint(focus) {
      const todayHost = document.querySelector('[data-project-today-host]');
      if (todayHost && !todayHost.contains(document.activeElement)) todayHost.innerHTML = today();
      const host = document.querySelector('[data-party-project-host]'); if (!host) return;
      if (!focus && host.contains(document.activeElement)) return;
      host.innerHTML = body(); if (focus) host.querySelector(focus)?.focus();
    }
    function apply(data) {
      const p = d.state().party;
      if (data.partyId !== p.id || !data.projects || !Array.isArray(data.eligible)) throw Error('invalid response');
      if ((p.projects?.revision || 0) > data.projects.revision) return;
      p.projects = data.projects; eligible = data.eligible;
    }
    async function refresh(explicit = false) {
      const captured = scope(); if (!captured || reading || busy || pending) return;
      const host = document.querySelector('[data-party-project-host]');
      if (!explicit && host?.contains(document.activeElement)) return;
      reading = true;
      try {
        const response = await fetch('/api/party/projects', { cache: 'no-store' }), data = await response.json();
        if (scope() !== captured) return;
        if (!response.ok) throw Error('load'); apply(data); message = ''; paint(explicit ? '#shared-project-title' : null); d.scene();
      } catch { if (scope() === captured) { eligible = []; message = t('error'); paint(); } }
      finally { reading = false; }
    }
    async function save(input) {
      const captured = scope(); if (!captured || busy) return;
      pending = input; busy = true; message = ''; paint('#shared-project-title');
      try {
        const response = await fetch('/api/party/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data = await response.json(); if (scope() !== captured) return;
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) { pending = null; message = t(data.error === 'project_partner' ? 'partner' : 'conflict'); }
          else message = t('error');
        } else { apply(data); pending = null; message = input.action === 'start' ? '' : t('saved'); d.scene(); }
      } catch { if (scope() === captured) message = t('error'); }
      finally { if (scope() === captured) { busy = false; paint(pending ? '[data-project="retry"]' : '#shared-project-title'); } }
    }
    async function handle(event) {
      const b = event.target.closest('[data-project]'); if (!b) return false;
      event.preventDefault(); scope(); const action = b.dataset.project;
      if (action === 'today') d.navigate('today');
      else if (action === 'open') d.navigate('party');
      else if (action === 'refresh') await refresh(true);
      else if (action === 'retry' && pending) await save(pending);
      else if (['start', 'contribute'].includes(action) && !pending) {
        const p = d.state().party;
        const [sourceType, taskId] = action === 'start' ? ['task', null] : JSON.parse(document.getElementById('project-task').value);
        await save({ action, partyId: p.id, projectId: b.dataset.id, revision: p.projects.revision,
          share: true, sourceType, taskId, operationId: crypto.randomUUID() });
      }
      return true;
    }
    setInterval(() => { if (['party', 'today'].includes(d.state().view) && document.visibilityState === 'visible') refresh(); }, 15000);
    return { body, handle, refresh, today };
  }
  root.PartyProjectUIV1 = { createUI, text };
})(typeof window === 'undefined' ? globalThis : window);
