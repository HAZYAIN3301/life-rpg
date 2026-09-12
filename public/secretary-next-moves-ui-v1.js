/* Authored neutral card copy and escaped presentation; no state or effects. */
(function (root, factory) {
  const api = factory(root?.SecretaryNextMovesProducerV1 || (typeof require === 'function' ? require('./secretary-next-moves-producer-v1.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryNextMovesUIV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Producer) {
  'use strict';
  const LANGS = ['ru', 'en', 'de', 'uk', 'es'];
  const rows = {
    'evening.eyebrow': ['Твоя граница', 'Your boundary', 'Deine Grenze', 'Твоя межа', 'Tu límite'],
    'evening.title': ['Подошла вечерняя граница', 'Your evening boundary is here', 'Deine Abendgrenze ist erreicht', 'Настала вечірня межа', 'Ha llegado tu límite de la noche'],
    'evening.body': ['Это время ты выбрал для завершения вечера. Можно посмотреть, что сейчас подходит.', 'You chose this time to wind down. You can see what fits right now.', 'Du hast diese Zeit zum Ausklang gewählt. Schau, was gerade passt.', 'Ти обрав цей час для завершення вечора. Можна подивитися, що зараз доречно.', 'Elegiste esta hora para cerrar la noche. Puedes ver qué encaja ahora.'],
    'evening.open_transition': ['Выбрать следующий шаг', 'Choose the next step', 'Den nächsten Schritt wählen', 'Обрати наступний крок', 'Elegir el siguiente paso'],
    'evening.context_question': ['Чем ты сейчас занят?', 'What are you doing right now?', 'Was machst du gerade?', 'Чим ти зараз зайнятий?', '¿Qué estás haciendo ahora?'],
    'evening.ready': ['Готов завершать — открыть вечер', 'Ready to wind down — open the evening', 'Bereit zum Ausklang — Abend öffnen', 'Готовий завершувати — відкрити вечір', 'Quiero terminar — abrir la noche'],
    'evening.busy': ['Ещё занят — вернуться к своему делу', 'Still busy — return to what I am doing', 'Noch beschäftigt — zur Tätigkeit zurück', 'Ще зайнятий — повернутися до своєї справи', 'Sigo ocupado — volver a lo mío'],
    'evening.planning': ['Планирую завтра — открыть план', 'Planning tomorrow — open the plan', 'Ich plane morgen — Plan öffnen', 'Планую завтра — відкрити план', 'Planifico mañana — abrir el plan'],
    'evening.at': ['Выбранное время', 'Your chosen time', 'Deine gewählte Zeit', 'Обраний час', 'La hora que elegiste'],
    'evening.changed': ['Вечерняя настройка изменилась. Обнови предложение.', 'Your evening setting has changed. Refresh the offer.', 'Deine Abendeinstellung hat sich geändert. Aktualisiere den Vorschlag.', 'Вечірнє налаштування змінилося. Онови пропозицію.', 'Tu ajuste de la noche cambió. Actualiza la propuesta.'],
    'reason.evening_boundary_reached': ['Наступило выбранное тобой время.', 'The time you chose has arrived.', 'Die von dir gewählte Zeit ist gekommen.', 'Настав обраний тобою час.', 'Ha llegado la hora que elegiste.'],
    'planned_start.eyebrow': ['Твой план', 'Your plan', 'Dein Plan', 'Твій план', 'Tu plan'],
    'planned_start.title': ['Дело из твоего плана', 'A task from your plan', 'Eine Aufgabe aus deinem Plan', 'Справа з твого плану', 'Una tarea de tu plan'],
    'planned_start.body.window': ['В плане есть дело на это время. Можно открыть его и начать.', 'You have a task planned for this time. You can open it and begin.', 'Für diese Zeit ist eine Aufgabe geplant. Du kannst sie öffnen und beginnen.', 'У плані є справа на цей час. Можна відкрити її та почати.', 'Tienes una tarea prevista para esta hora. Puedes abrirla y empezar.'],
    'planned_start.body.due_soon': ['Подошло время дела с указанным тобой сроком.', 'It is time for the task with your chosen deadline.', 'Es ist Zeit für die Aufgabe mit deiner festgelegten Frist.', 'Настав час справи з указаним тобою строком.', 'Es hora de la tarea con el plazo que indicaste.'],
    'planned_start.open': ['Открыть дело', 'Open the task', 'Aufgabe öffnen', 'Відкрити справу', 'Abrir la tarea'],
    'planned_start.question': ['Хочешь сейчас открыть запланированное дело?', 'Would you like to open the planned task now?', 'Möchtest du die geplante Aufgabe jetzt öffnen?', 'Хочеш зараз відкрити заплановану справу?', '¿Quieres abrir ahora la tarea prevista?'],
    'planned_start.at': ['В плане на', 'Planned for', 'Geplant für', 'У плані на', 'Prevista para'],
    'planned_start.prepared': ['Дело из твоего плана. Выбери, с чего начать.', 'A task from your plan. Choose where to begin.', 'Eine Aufgabe aus deinem Plan. Wähle, womit du beginnst.', 'Справа з твого плану. Обери, з чого почати.', 'Una tarea de tu plan. Elige por dónde empezar.'],
    'reason.planned_start_window': ['В плане есть точное время начала.', 'Your plan has a saved start time.', 'Dein Plan enthält eine gespeicherte Startzeit.', 'У плані є точний час початку.', 'Tu plan tiene una hora de inicio guardada.'],
    'reason.planned_start_due_soon': ['Дело запланировано на это время и имеет твой срок.', 'The task is planned for this time and has your deadline.', 'Die Aufgabe ist für diese Zeit geplant und hat deine Frist.', 'Справа запланована на цей час і має твій строк.', 'La tarea está prevista para esta hora y tiene tu plazo.'],
    'return.eyebrow': ['Тень рядом', 'Shadow is here', 'Der Schatten ist da', 'Тінь поруч', 'Sombra está aquí'],
    'return.title.minimum': ['Вернуться к одному делу', 'Return to one task', 'Zu einer Aufgabe zurückkehren', 'Повернутися до однієї справи', 'Volver a una tarea'],
    'return.body.minimum': ['Можно начать с небольшого шага по этому делу.', 'A small step on this task is enough to begin.', 'Ein kleiner Schritt bei dieser Aufgabe reicht für den Anfang.', 'Можна почати з невеликого кроку в цій справі.', 'Puedes empezar con un paso pequeño en esta tarea.'],
    'return.start_minimum': ['Открыть шаг', 'Open the step', 'Schritt öffnen', 'Відкрити крок', 'Abrir el paso'],
    'return.title.rest': ['Время для короткого отдыха', 'Time for a short rest', 'Zeit für eine kurze Pause', 'Час для короткого відпочинку', 'Tiempo para un breve descanso'],
    'return.body.rest': ['Подготовленный отдых с понятной границей.', 'A prepared rest with a clear boundary.', 'Eine vorbereitete Pause mit einer klaren Grenze.', 'Підготовлений відпочинок зі зрозумілою межею.', 'Un descanso preparado con un límite claro.'],
    'return.start_rest': ['Открыть отдых', 'Open rest', 'Pause öffnen', 'Відкрити відпочинок', 'Abrir descanso'],
    'return.title.ask': ['Один следующий шаг', 'One next step', 'Ein nächster Schritt', 'Один наступний крок', 'Un siguiente paso'],
    'return.question': ['Что сейчас подойдёт: одно дело или отдых?', 'What fits now: one task or a rest?', 'Was passt jetzt: eine Aufgabe oder eine Pause?', 'Що зараз підійде: одна справа чи відпочинок?', '¿Qué te viene bien ahora: una tarea o un descanso?'],
    'return.answer': ['Выбрать', 'Choose', 'Auswählen', 'Обрати', 'Elegir'],
    'reason.return_after_confirmed': ['Окно внимания закончилось за намеченной границей.', 'The attention window ended outside its intended boundary.', 'Das Aufmerksamkeitsfenster endete außerhalb der geplanten Grenze.', 'Вікно уваги закінчилось за наміченою межею.', 'La ventana de atención terminó fuera del límite previsto.'],
    'reason.return_needs_one_answer': ['Можно выбрать, как продолжить.', 'You can choose how to continue.', 'Du kannst wählen, wie es weitergeht.', 'Можна обрати, як продовжити.', 'Puedes elegir cómo continuar.'],
    'common.answer_one': ['Выбрать', 'Choose', 'Auswählen', 'Обрати', 'Elegir'],
    'common.do_minimum': ['Маленький шаг', 'A small step', 'Ein kleiner Schritt', 'Маленький крок', 'Un paso pequeño'],
    'common.finite_rest': ['Короткий отдых', 'A short rest', 'Eine kurze Pause', 'Короткий відпочинок', 'Un breve descanso'],
    'common.dismiss': ['Не сейчас', 'Not now', 'Jetzt nicht', 'Не зараз', 'Ahora no'],
    'common.retry': ['Повторить', 'Retry', 'Erneut versuchen', 'Повторити', 'Reintentar'],
    'common.more': ['Другая поддержка', 'Other support', 'Andere Unterstützung', 'Інша підтримка', 'Otro apoyo'],
    'common.close': ['Закрыть', 'Close', 'Schließen', 'Закрити', 'Cerrar'],
    'common.plan': ['Открыть план', 'Open plan', 'Plan öffnen', 'Відкрити план', 'Abrir el plan'],
    'common.continue': ['Открыть', 'Open', 'Öffnen', 'Відкрити', 'Abrir'],
    'common.choose': ['Выбери один вариант', 'Choose one option', 'Wähle eine Möglichkeit', 'Обери один варіант', 'Elige una opción'],
    'common.target': ['К какому делу вернуться после окна?', 'Which task will you return to after this window?', 'Zu welcher Aufgabe kehrst du nach dem Fenster zurück?', 'До якої справи повернутися після вікна?', '¿A qué tarea volverás al terminar esta ventana?'],
    'common.no_target': ['Пока без привязки', 'No linked task yet', 'Noch keine verknüpfte Aufgabe', 'Поки без прив’язки', 'Sin tarea vinculada por ahora'],
    'common.error': ['Ответ не подтверждён. Повтори попытку.', 'The response is not confirmed. Please retry.', 'Die Antwort ist nicht bestätigt. Bitte erneut versuchen.', 'Відповідь не підтверджена. Повтори спробу.', 'La respuesta no está confirmada. Inténtalo de nuevo.'],
    'common.corrupt': ['Данные секретаря не удалось прочитать. Повторное чтение доступно ниже.', 'The secretary data could not be read. You can retry below.', 'Die Sekretärdaten konnten nicht gelesen werden. Du kannst es unten erneut versuchen.', 'Дані секретаря не вдалося прочитати. Нижче можна повторити читання.', 'No se pudieron leer los datos del secretario. Puedes reintentar abajo.'],
    'common.stale': ['Это дело уже изменилось. Обнови предложение.', 'This task has changed. Refresh the offer.', 'Diese Aufgabe hat sich geändert. Aktualisiere den Vorschlag.', 'Ця справа вже змінилася. Онови пропозицію.', 'Esta tarea ha cambiado. Actualiza la propuesta.'],
    'common.saving': ['Сохраняю…', 'Saving…', 'Wird gespeichert…', 'Зберігаю…', 'Guardando…'],
    'common.blocked': ['Сначала закончи текущую сессию или обучение, затем повтори открытие.', 'Finish the current session or guide, then try opening again.', 'Beende zuerst die aktuelle Sitzung oder Anleitung und versuche es dann erneut.', 'Спочатку заверши поточну сесію або навчання, потім повтори відкриття.', 'Termina la sesión o guía actual y vuelve a intentar abrirlo.'],
    'common.deferred': ['Открытие отложено. Когда будешь готов, повтори.', 'Opening is paused. Retry when you are ready.', 'Das Öffnen wartet. Versuche es erneut, wenn du bereit bist.', 'Відкриття відкладено. Коли будеш готовий, повтори.', 'La apertura está pendiente. Reintenta cuando quieras continuar.'],
    'common.prepared': ['Достаточно открыть дело и выбрать маленький шаг.', 'Open the task and choose a small step.', 'Öffne die Aufgabe und wähle einen kleinen Schritt.', 'Достатньо відкрити справу й обрати маленький крок.', 'Abre la tarea y elige un paso pequeño.'],
    'common.own_words': ['Твои слова', 'Your words', 'Deine Worte', 'Твої слова', 'Tus palabras'],
  };
  const COPY = Object.freeze(Object.fromEntries(LANGS.map((lang, i) => [lang, Object.freeze(Object.fromEntries(Object.entries(rows).map(([key, values]) => ['secretary.v2.' + key, values[i]])))])));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function copy(key, lang = 'ru') { return COPY[lang]?.[key] || COPY.ru[key] || ''; }
  function label(key, lang) { return esc(copy('secretary.v2.' + key, lang)); }
  function target(ref, snapshot) {
    const match = /^(quest|habit):([A-Za-z0-9_-]{1,74})$/.exec(ref || '');
    if (!match) return null;
    const [ , kind, id] = match;
    const resolved = Producer?.resolveOriginal(snapshot, ref), item = resolved?.row;
    if (!item) return null;
    return { kind, id, title: item.title || item.name || '', minimum: resolved.twoMin || '', item };
  }
  function candidates(snapshot) {
    return [...(snapshot.tasks || []).map(item => 'quest:' + item.id), ...(snapshot.habits || []).map(item => 'habit:' + item.id)]
      .map(ref => ({ ref, value: target(ref, snapshot) })).filter(row => row.value);
  }
  function targetField(snapshot, lang) {
    return `<label class="attention-field attention-field-wide"><span>${label('common.target', lang)}</span><select name="originalRef"><option value="">${label('common.no_target', lang)}</option>${candidates(snapshot).map(row => `<option value="${esc(row.ref)}">${esc(row.value.title)}</option>`).join('')}</select></label>`;
  }
  function errorHTML(error, lang, retry = true) {
    const key = error === 'stale_evening' ? 'evening.changed' : /invalid_secretary|invalid_ledger|corrupt/.test(error || '') ? 'common.corrupt' : /stale_target|offer_expired|terminal_outcome|offer_not_found/.test(error || '') ? 'common.stale' : error === 'context_blocked' ? 'common.blocked' : error === 'opening_deferred' ? 'common.deferred' : 'common.error';
    return `<div role="alert" class="secretary-next-error"><p>${label(key, lang)}</p>${retry ? `<button type="button" class="btn ghost" data-action="secretary-next-retry">${label('common.retry', lang)}</button>` : ''}</div>`;
  }
  function render(state, lang, snapshot) {
    const offer = state.offer;
    if (!offer) return state.error ? errorHTML(state.error, lang) : '';
    const ref = offer.primary.action.args.targetRef;
    const named = ref ? target(ref, snapshot) : null;
    const quote = offer.quote?.title ? `<p class="secretary-offer-quote">${label('common.own_words', lang)}: <span data-noi18n>${esc(offer.quote.title)}</span></p>` : '';
    return `<div class="secretary-offer" data-secretary-next-offer="${esc(offer.offerId)}" aria-busy="${state.busy}">
      <p><b>${esc(copy(offer.copy.titleKey, lang))}</b></p>
      ${named ? `<p data-noi18n><b>${esc(named.title)}</b>${named.minimum ? `<br>${esc(named.minimum)}` : ''}</p>` : ''}
      ${named && offer.capabilityId === 'planned-start' && (offer.about?.planned?.startTime || named.item.startTime) ? `<p>${label('planned_start.at', lang)} <time>${esc(offer.about?.planned?.startTime || named.item.startTime)}</time></p>` : ''}
      <p class="secretary-primary-note">${esc(copy(offer.capabilityId === 'evening-close' ? offer.copy.bodyKey : offer.copy.questionKey || offer.copy.bodyKey, lang))}</p>${quote}
      <div class="secretary-offer-buttons"><button type="button" class="btn secretary-primary" data-action="secretary-next-accept" ${state.busy ? 'disabled' : ''}>${state.busy ? label('common.saving', lang) : esc(copy(offer.primary.labelKey, lang))}</button><button type="button" class="btn ghost" data-action="secretary-next-dismiss" ${state.busy ? 'disabled' : ''}>${label('common.dismiss', lang)}</button></div>
      ${state.error ? errorHTML(state.error, lang) : ''}
    </div>`;
  }
  function renderQuestion(vm, translate) {
    const lang = vm.lang || 'ru';
    return `<form class="attention-flow" id="secretary-next-question-form"><header class="attention-flow-head"><h2 id="attention-dialog-title" tabindex="-1">${label('return.question', lang)}</h2><p id="attention-dialog-description">${label('common.choose', lang)}</p></header><label class="attention-field"><span>${label('common.choose', lang)}</span><select name="targetRef" required><option value="">${label('common.choose', lang)}</option>${candidates(vm).map(row => `<option value="${esc(row.ref)}">${esc(row.value.title)}</option>`).join('')}<option value="rest">${label('common.finite_rest', lang)}</option><option value="plan">${label('common.plan', lang)}</option></select></label><p data-attention-status role="status"></p><div class="attention-actions"><button type="button" class="btn ghost" data-action="close-attention-dialog">${label('common.close', lang)}</button><button class="btn" type="submit">${label('common.continue', lang)}</button></div></form>`;
  }
  function renderPrepared(vm) {
    const lang = vm.lang || 'ru';
    return `<div class="attention-flow" data-secretary-prepared="${esc(vm.ref)}"><header class="attention-flow-head"><h2 id="attention-dialog-title" tabindex="-1" data-noi18n>${esc(vm.title)}</h2><p id="attention-dialog-description">${vm.size === 'planned' ? label('planned_start.prepared', lang) : vm.minimum ? esc(vm.minimum) : label('common.prepared', lang)}</p></header><ul class="tasks">${vm.ownerHTML}</ul><div class="attention-actions"><button type="button" class="btn ghost" data-action="close-attention-dialog">${label('common.close', lang)}</button>${vm.kind === 'quest' ? `<button type="button" class="btn" data-action="focus-task" data-id="${esc(vm.id)}">${esc(vm.startLabel)}</button>` : ''}</div></div>`;
  }
  function eveningCurrent(vm, snapshot, account) {
    const cfg = snapshot.settings?.secretary;
    return account != null && String(vm.accountId) === String(account) && vm.day === snapshot.today
      && cfg?.configured === true && cfg.dailyReminder === true && cfg.eveningTime === vm.boundaryLocal;
  }
  function renderEvening(vm) {
    const lang = vm.lang || 'ru';
    return `<div class="attention-flow" data-secretary-evening><header class="attention-flow-head"><h2 id="attention-dialog-title" tabindex="-1">${label('evening.title', lang)}</h2><p id="attention-dialog-description">${label('evening.context_question', lang)}</p><p>${label('evening.at', lang)} <time>${esc(vm.boundaryLocal)}</time></p></header><div class="attention-actions"><button type="button" class="btn" data-action="secretary-evening-ready">${label('evening.ready', lang)}</button><button type="button" class="btn ghost" data-action="secretary-evening-busy">${label('evening.busy', lang)}</button><button type="button" class="btn ghost" data-action="secretary-evening-planning">${label('evening.planning', lang)}</button></div><p data-attention-status role="status" aria-live="polite"></p></div>`;
  }
  return Object.freeze({ LANGS, COPY, copy, target, candidates, targetField, render, errorHTML, renderQuestion, renderPrepared, renderEvening, eveningCurrent });
});
