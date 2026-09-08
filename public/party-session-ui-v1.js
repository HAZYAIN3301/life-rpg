/* UI adapter. The server owns membership, transitions, time and receipts. */
(function (root) {
  'use strict';
  const COPY = {
    title: ['Сделаем рядом', 'Work side by side', 'Gemeinsam starten'],
    intro: ['Каждый со своим делом. Начало — общее.', 'Your own tasks. One shared start.', 'Eigene Aufgaben. Ein gemeinsamer Start.'],
    invite: ['Позвать на сессию', 'Invite to a session', 'Zur Sitzung einladen'],
    alone: ['Поделись кодом пати с близким человеком — и начните вместе.', 'Share your party code with someone you know to start together.', 'Teile deinen Gruppencode mit einer vertrauten Person.'],
    invited: ['Приглашение', 'Invitation', 'Einladung'], ready: ['Договорились', 'Agreed', 'Vereinbart'],
    running: ['Сессия идёт', 'Session in progress', 'Sitzung läuft'], review: ['Время вышло — как прошло?', 'Time is up — how did it go?', 'Die Zeit ist um — wie lief es?'],
    finished: ['Сессия завершена', 'Session finished', 'Sitzung beendet'], cancelled: ['Сессия отменена', 'Session cancelled', 'Sitzung abgesagt'],
    declined: ['Приглашение отклонено', 'Invitation declined', 'Einladung abgelehnt'], expired: ['Срок приглашения или итога истёк', 'Invitation or check-out expired', 'Einladung oder Rückmeldung abgelaufen'],
    accept: ['Присоединиться', 'Join', 'Mitmachen'], decline: ['Не сейчас', 'Not now', 'Jetzt nicht'],
    readyAction: ['Я готов начать', 'Ready to start', 'Bereit zum Start'],
    waiting: ['Ждём ответа', 'Waiting for a reply', 'Warten auf Antwort'], readyPerson: ['Готов начать', 'Ready to start', 'Bereit zum Start'],
    checkOut: ['Мой итог', 'My check-out', 'Meine Rückmeldung'],
    done: ['Задача выполнена', 'Task completed', 'Aufgabe erledigt'], partial: ['Продвинулся', 'Made progress', 'Weitergekommen'], stopped: ['Остановился', 'Stopped', 'Aufgehört'],
    withdraw: ['Убрать мою подпись и итог', 'Remove my label and outcome', 'Meine Angaben entfernen'],
    withdrawConfirm: ['Убрать твою подпись и итог? Незавершённая сессия будет отменена. Сама задача останется в плане.', 'Remove your label and outcome? An unfinished session will be cancelled. Your task stays in your plan.', 'Deine Angaben entfernen? Eine offene Sitzung wird abgesagt. Die Aufgabe bleibt im Plan.'],
    details: ['Детали и приватность', 'Details and privacy', 'Details und Datenschutz'],
    private: ['Виден только выбранный текст и итог. Без камеры, личного плана и истории сайтов.', 'Only the chosen label and outcome are shared. No camera, private plan or browsing history.', 'Nur der gewählte Text und das Ergebnis sind sichtbar. Keine Kamera, kein privater Plan oder Browserverlauf.'],
    task: ['Моё дело из плана', 'My planned task', 'Meine geplante Aufgabe'], label: ['Что увидит напарник', 'What your partner sees', 'Was dein Gegenüber sieht'],
    generic: ['Мой следующий шаг', 'My next step', 'Mein nächster Schritt'], partner: ['С кем', 'Who with', 'Mit wem'],
    duration: ['Минуты', 'Minutes', 'Minuten'], later: ['Назначить время', 'Schedule a time', 'Zeit vereinbaren'],
    consent: ['Разрешаю показать этому участнику подпись дела и мой итог.', 'Share this task label and my outcome with this participant.', 'Diesen Aufgabentext und mein Ergebnis mit dieser Person teilen.'],
    retention: ['Можно убрать в любой момент. История сессий хранится до 30 дней.', 'Remove them at any time. Session history is kept for up to 30 days.', 'Jederzeit entfernbar. Der Verlauf bleibt bis zu 30 Tage gespeichert.'],
    close: ['Закрыть', 'Close', 'Schließen'], save: ['Отправить приглашение', 'Send invitation', 'Einladung senden'],
    saved: ['Сохранено', 'Saved', 'Gespeichert'], sending: ['Сохраняем…', 'Saving…', 'Speichern…'],
    noTasks: ['Сначала добавь своё дело в «Сегодня». Сессия поможет начать именно его.', 'Add a task in Today first. The session will help you start that task.', 'Füge zuerst eine Aufgabe in Heute hinzu. Die Sitzung hilft beim Start.'],
    today: ['К моим делам', 'My tasks', 'Zu meinen Aufgaben'], history: ['Прошлые сессии', 'Past sessions', 'Vergangene Sitzungen'],
    preferences: ['Принимать приглашения', 'Receive invitations', 'Einladungen empfangen'],
    refresh: ['Обновить', 'Refresh', 'Aktualisieren'],
    shared: ['Договорились. Каждый подтверждает готовность; она действует 5 минут.', 'Agreed. Both confirm readiness, which lasts 5 minutes.', 'Vereinbart. Beide bestätigen ihre Bereitschaft; sie gilt 5 Minuten.'],
    timerNote: ['Это время сессии, а не доказательство фокуса. Итог выбираешь ты.', 'Session time is not proof of focus. You choose the outcome.', 'Die Zeit beweist keinen Fokus. Du wählst das Ergebnis.'],
    stale: ['Связь прервалась. Статус может быть устаревшим.', 'Connection lost. This status may be out of date.', 'Verbindung unterbrochen. Der Status kann veraltet sein.'],
    error: ['Не удалось сохранить. Проверь связь и повтори: данные формы остаются здесь.', 'Could not save. Check your connection and retry; your form is still here.', 'Speichern fehlgeschlagen. Verbindung prüfen und erneut versuchen; die Eingaben bleiben erhalten.'],
    uncertain: ['Ответ не дошёл. Повтори то же действие, чтобы проверить сохранение; поля пока зафиксированы. Можно закрыть окно и обновить сессию.', 'The response did not arrive. Retry the same action to confirm saving; the fields are held unchanged. You can close this window and refresh the session.', 'Die Antwort kam nicht an. Dieselbe Aktion erneut versuchen; die Eingaben bleiben unverändert. Du kannst das Fenster schließen und die Sitzung aktualisieren.'],
    task_not_saved: ['Сначала нужно сохранить выполнение задачи. Повтори попытку.', 'Task completion must be saved first. Try again.', 'Zuerst muss die erledigte Aufgabe gespeichert werden. Erneut versuchen.'],
    task_unavailable: ['Эта задача уже выполнена или недоступна. Выбери другую.', 'This task is completed or unavailable. Choose another.', 'Diese Aufgabe ist erledigt oder nicht verfügbar. Wähle eine andere.'],
    session_busy: ['У одного из вас уже есть открытая сессия. Завершите или отмените её.', 'One of you already has an open session. Finish or cancel it first.', 'Eine Person hat bereits eine offene Sitzung. Zuerst beenden oder absagen.'],
    invites_muted: ['Участник выключил приглашения.', 'This participant has muted invitations.', 'Diese Person hat Einladungen deaktiviert.'],
    invite_limit: ['На сегодня достаточно приглашений. Можно вернуться завтра.', 'Enough invitations for today. You can return tomorrow.', 'Für heute genug Einladungen. Morgen geht es weiter.'],
    too_early: ['Дождись назначенного времени.', 'Wait until the scheduled time.', 'Bitte bis zur vereinbarten Zeit warten.'],
    invalid_schedule: ['Выбери время в ближайшие 7 дней.', 'Choose a time in the next 7 days.', 'Wähle einen Termin in den nächsten 7 Tagen.'],
    invalid_transition: ['Состояние сессии изменилось. Обнови её.', 'The session has changed. Refresh it.', 'Die Sitzung hat sich geändert. Bitte aktualisieren.'],
    no_session: ['Сессия больше недоступна.', 'Session no longer available.', 'Sitzung nicht mehr verfügbar.'],
    removed: ['Подпись убрана', 'Label removed', 'Angabe entfernt'],
  };
  root.PartySessionUIV1 = { createUI(d) {
    const E = d.escape, get = d.state;
    const L = (key) => (COPY[key] || COPY.error)[({ ru: 0, en: 1, de: 2 })[d.lang()] ?? 1];
    const localDate = (v) => new Intl.DateTimeFormat(d.lang(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
    let pending = new Map(), account = null, pollBusy = false, stale = false, offset = 0, busy = false;
    const id = () => root.crypto.randomUUID();
    const sessions = () => get().party?.sessions || [];
    const current = () => sessions().find((s) => ['invited', 'ready', 'running', 'review'].includes(s.status));
    const button = (key, action, extra = '', secondary = false) => `<button type="button" class="btn${secondary ? ' ghost' : ''}" data-duo="${action}" ${extra}>${E(L(key))}</button>`;
    function card(s) {
      const attr = `data-session="${E(s.id)}"`, own = s.members.find((m) => m.me);
      return `<article class="duo-session" data-phase="${E(s.status)}"><div class="duo-session-heading"><h3>${E(L(s.status))}</h3><span class="duo-duration">${s.minutes} ${E(L('duration'))}</span></div>
        ${s.scheduledAt ? `<p class="duo-scheduled">${E(localDate(s.scheduledAt))}</p>` : ''}
        <div class="duo-participants">${s.members.map((m) => { const person = get().party?.members?.find((p) => p.id === m.id); return `<div class="duo-person"><span class="duo-person-mark" aria-hidden="true">${E((person?.name || '?').slice(0, 1))}</span><div><b>${E(person?.name || '—')}</b><p>${E(m.label || L(m.accepted ? 'removed' : 'waiting'))}</p>${m.outcome ? `<small>✓ ${E(L(m.outcome))}</small>` : m.ready && s.status === 'ready' ? `<small>${E(L('readyPerson'))}</small>` : ''}</div></div>`; }).join('')}</div>
        ${s.status === 'running' ? `<output class="duo-timer" data-duo-end="${E(s.endsAt)}" aria-label="${E(L('running'))}"></output>` : ''}
        <div class="duo-actions">${s.actions.filter((a) => !['withdraw', 'finish'].includes(a)).map((a) => button(a === 'ready' ? 'readyAction' : a, a, attr, a === 'decline')).join('')}
        ${s.actions.includes('finish') ? button('checkOut', 'check-out', attr) : ''}</div>
        ${s.status === 'ready' ? `<p class="duo-note">${E(L('shared'))}</p>` : ''}
        ${own.outcome && s.status !== 'finished' ? `<p class="duo-note">${E(L('saved'))}: ${E(L(own.outcome))}</p>` : ''}
        <details class="duo-privacy"><summary>${E(L('details'))}</summary><p>${E(L('private'))}</p><p>${E(L('retention'))}</p>${s.startedAt ? `<p>${E(L('timerNote'))}</p>` : ''}${s.actions.includes('withdraw') ? button('withdraw', 'withdraw', attr, true) : ''}</details>
      </article>`;
    }
    function body() {
      const p = get().party; if (!p) return '';
      const s = current(), history = sessions().filter((x) => x !== s).slice().reverse();
      return `${stale ? `<p class="duo-error" role="status">${E(L('stale'))} ${button('refresh', 'refresh', '', true)}</p>` : ''}
        ${s ? card(s) : `<div class="duo-empty"><div><h3>${E(L('title'))}</h3><p>${E(L(p.members.length > 1 ? 'intro' : 'alone'))}</p></div>${p.members.length > 1 ? button('invite', 'invite') : ''}</div>`}
        ${history.length ? `<details class="duo-history"><summary>${E(L('history'))} · ${history.length}</summary>${history.map(card).join('')}</details>` : ''}
        <label class="duo-preference"><input type="checkbox" data-duo="preferences" ${p.sessionInvitesEnabled !== false ? 'checked' : ''}> ${E(L('preferences'))}</label>`;
    }
    function today() {
      const s = current(); if (!s) return '';
      return `<button type="button" class="duo-today" data-duo="open-party"><span aria-hidden="true">✦</span><span><b>${E(L(s.status))}</b><small>${E(s.members.find((m) => !m.me)?.label || L('title'))}</small></span><span aria-hidden="true">↗</span></button>`;
    }
    function repaint() {
      document.querySelectorAll('[data-duo-host]').forEach((host) => {
        const open = [...host.querySelectorAll('details')].map((x) => x.open);
        const focused = host.contains(document.activeElement) ? { action: document.activeElement.dataset.duo, session: document.activeElement.dataset.session } : null;
        host.innerHTML = body(); host.querySelectorAll('details').forEach((x, i) => { x.open = !!open[i]; });
        if (focused) [...host.querySelectorAll('[data-duo]')].find((x) => x.dataset.duo === focused.action && x.dataset.session === focused.session)?.focus();
      });
      document.querySelectorAll('[data-duo-today-host]').forEach((host) => { host.innerHTML = today(); }); tick();
    }
    function tick() {
      document.querySelectorAll('[data-duo-end]').forEach((node) => {
        const seconds = Math.max(0, Math.ceil((Date.parse(node.dataset.duoEnd) - Date.now() - offset) / 1000));
        node.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      });
    }
    async function refresh() {
      const uid = get().me?.id;
      if (!uid || pollBusy) return;
      pollBusy = true;
      try {
        const response = await fetch('/api/party/sessions', { cache: 'no-store', signal: AbortSignal.timeout(10000) }), data = await response.json();
        if (!response.ok) throw new Error('network');
        if (get().me?.id !== uid) return;
        const changed = JSON.stringify(get().party?.sessions || []) !== JSON.stringify(data.sessions)
          || get().party?.sessionInvitesEnabled !== data.sessionInvitesEnabled || stale;
        if (!data.partyId) get().party = false;
        else if (get().party?.id !== data.partyId || JSON.stringify(get().party.members.map((m) => m.id)) !== JSON.stringify(data.memberIds)) {
          const full = await fetch('/api/party', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
          if (!full.ok) throw new Error('network');
          const latest = await full.json(); if (get().me?.id !== uid) return; get().party = latest.party || false;
        } else Object.assign(get().party, { sessions: data.sessions, sessionInvitesEnabled: data.sessionInvitesEnabled, serverNow: data.serverNow });
        offset = Date.parse(data.serverNow) - Date.now() || 0; stale = false;
        if (changed) repaint();
      } catch { if (get().me?.id === uid) { stale = true; repaint(); } }
      finally { pollBusy = false; }
    }
    async function send(path, payload, key) {
      const uid = get().me?.id;
      if (!pending.has(key)) pending.set(key, payload);
      let response, data;
      try {
        response = await fetch(path, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.get(key)) });
        data = await response.json();
      } catch { throw Object.assign(new Error('uncertain'), { uncertain: true }); }
      if (get().me?.id !== uid) throw new Error('no_session');
      if (!response.ok) { pending.delete(key); throw new Error(data.error); }
      pending.delete(key); get().party = data.party || false; offset = Date.parse(data.party?.serverNow) - Date.now() || 0;
      stale = false; repaint(); d.sound('confirm'); return data;
    }
    function dialog(content) {
      const overlay = document.createElement('div'); overlay.id = 'party-duo-dialog'; overlay.className = 'modal-overlay';
      overlay.innerHTML = `<section class="duo-dialog" role="dialog" aria-modal="true" aria-labelledby="duo-dialog-title">${button('close', 'close', 'aria-label="' + E(L('close')) + '"', true)}${content}<p class="duo-error" data-duo-error role="alert"></p></section>`;
      d.mount(overlay, { initial: '#duo-dialog-title' });
      overlay.addEventListener('submit', submit); return overlay;
    }
    function openForm(s) {
      const tasks = (get().tasks || []).filter((task) => !task.done);
      if (!tasks.length) return dialog(`<h2 id="duo-dialog-title" tabindex="-1">${E(L('invite'))}</h2><p>${E(L('noTasks'))}</p>${button('today', 'today')}`);
      const p = get().party;
      dialog(`<h2 id="duo-dialog-title" tabindex="-1">${E(L(s ? 'accept' : 'invite'))}</h2>
        <form data-duo-form data-session="${E(s?.id || '')}" data-request="${id()}">
        ${s ? `<p class="duo-note">${E(s.members.find((m) => !m.me)?.label || '')} · ${s.minutes} ${E(L('duration'))}</p>` : `<label>${E(L('partner'))}<select name="to" required>${p.members.filter((m) => !m.me).map((m) => `<option value="${E(m.id)}">${E(m.name)}</option>`).join('')}</select></label>`}
        <label>${E(L('task'))}<select name="taskId" required>${tasks.map((task) => `<option value="${E(task.id)}">${E(task.title)}</option>`).join('')}</select></label>
        <label>${E(L('label'))}<input name="publicLabel" required maxlength="160" value="${E(L('generic'))}"></label>
        ${!s ? `<label>${E(L('duration'))}<input name="minutes" type="number" min="5" max="120" value="25" required></label><details><summary>${E(L('later'))}</summary><input name="scheduledAt" type="datetime-local" aria-label="${E(L('later'))}"></details>` : ''}
        <label class="duo-consent"><input type="checkbox" name="share" required> <span>${E(L('consent'))}</span></label><small>${E(L('retention'))}</small>
        <button class="btn" type="submit">${E(L(s ? 'accept' : 'save'))}</button></form>`);
    }
    async function submit(event) {
      const form = event.target.closest('[data-duo-form]'); if (!form) return;
      event.preventDefault(); event.stopPropagation(); if (busy) return; busy = true;
      const submitter = form.querySelector('[type=submit]'), error = form.parentElement.querySelector('[data-duo-error]');
      submitter.disabled = true; const original = submitter.textContent; submitter.textContent = L('sending'); error.textContent = '';
      try {
        const f = new FormData(form), sid = form.dataset.session;
        const common = { taskId: f.get('taskId'), publicLabel: f.get('publicLabel'), share: f.get('share') === 'on' };
        await send('/api/party/sessions' + (sid ? '/' + sid : ''), sid ? { ...common, eventId: form.dataset.request, op: 'accept' }
          : { ...common, id: form.dataset.request, to: f.get('to'), minutes: Number(f.get('minutes')), scheduledAt: f.get('scheduledAt') ? new Date(f.get('scheduledAt')).toISOString() : null }, form.dataset.request);
        d.close('party-duo-dialog'); d.render();
      } catch (e) {
        error.textContent = L(e.message);
        if (e.uncertain) form.querySelectorAll('input,select').forEach((input) => { input.disabled = true; });
      }
      finally { busy = false; submitter.disabled = false; submitter.textContent = original; }
    }
    async function handle(event) {
      const el = event.target.closest('[data-duo]'); if (!el) return false;
      event.preventDefault(); const action = el.dataset.duo, sid = el.dataset.session;
      if (action === 'close') { d.close('party-duo-dialog'); return true; }
      if (action === 'open-party' || action === 'today') { d.close('party-duo-dialog'); d.navigate(action === 'today' ? 'today' : 'party'); return true; }
      if (action === 'invite' || action === 'accept') { openForm(action === 'accept' ? sessions().find((s) => s.id === sid) : null); return true; }
      if (action === 'check-out') {
        dialog(`<h2 id="duo-dialog-title" tabindex="-1">${E(L('checkOut'))}</h2><p>${E(L('timerNote'))}</p><div class="duo-outcomes">${['done', 'partial', 'stopped'].map((outcome) => button(outcome, 'finish', `data-session="${E(sid)}" data-outcome="${outcome}"`, outcome !== 'done')).join('')}</div>`); return true;
      }
      if (busy) return true;
      if (action === 'withdraw' && !root.confirm(L('withdrawConfirm'))) return true;
      busy = true; el.disabled = true;
      try {
        if (action === 'refresh') await refresh();
        else if (action === 'preferences') await send('/api/party/session-preferences', { enabled: !get().party?.sessionInvitesEnabled }, 'preferences');
        else {
          const s = sessions().find((v) => v.id === sid), own = s?.members.find((m) => m.me);
          if (!s) throw new Error('no_session');
          if (action === 'finish' && el.dataset.outcome === 'done') {
            const task = get().tasks.find((v) => v.id === own.taskId);
            if (!task) throw new Error('task_unavailable');
            if (!task.done && !await d.complete(task)) throw new Error('task_not_saved');
          }
          const key = [sid, action, el.dataset.outcome || ''].join(':');
          await send('/api/party/sessions/' + sid, { eventId: id(), op: action, ...(el.dataset.outcome ? { outcome: el.dataset.outcome } : {}) }, key);
          if (action === 'finish') d.close('party-duo-dialog'); d.render();
        }
      } catch (e) { const error = document.querySelector('#party-duo-dialog [data-duo-error]'); if (error) error.textContent = L(e.message); else d.toast(L(e.message)); }
      finally { busy = false; el.disabled = false; repaint(); }
      return true;
    }
    setInterval(() => {
      if (document.hidden) return;
      const uid = get().me?.id;
      if (uid !== account) { pending.clear(); account = uid; stale = false; }
      tick();
    }, 1000);
    setInterval(() => { if (!document.hidden && !busy && ['today', 'party'].includes(get().view)) refresh(); }, 12000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ['today', 'party'].includes(get().view)) refresh(); });
    return { body, today, handle, refresh };
  } };
})(window);
