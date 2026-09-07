/* Satoru Attention UI v1 — pure view-model renderer.
 *
 * This module deliberately knows nothing about State, Store, DOM events, native
 * permissions or the attention engine. app.js adapts domain objects into one of
 * four bounded view models: setup, entry, boundary or return. Keeping rendering
 * pure lets the engine land independently without turning its storage schema into
 * a public UI contract.
 */
(function exposeAttentionUI(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AttentionUIV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAttentionUI() {
  'use strict';

  const VERSION = '1.0.0';
  const MODES = Object.freeze(['trust', 'adaptive', 'control']);
  const PURPOSES = Object.freeze(['publish', 'create', 'reply', 'research', 'watch', 'rest', 'unsure']);
  const DEFAULT_DURATIONS = Object.freeze([3, 10, 20]);
  const RECOVERY_DURATIONS = Object.freeze([10, 20, 40]);

  function esc(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function tr(t, key) { return esc(typeof t === 'function' ? t(key) : key); }
  function boundedText(value, fallback, max = 120) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).slice(0, max);
  }
  function boundedMinutes(value, fallback = 10) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(1, Math.min(180, n)) : fallback;
  }
  function boundedRecoveryMinutes(value, fallback = 20) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(5, Math.min(180, n)) : fallback;
  }
  function cleanDurations(raw) {
    const list = Array.isArray(raw) ? raw : DEFAULT_DURATIONS;
    const values = [...new Set(list.map((n) => boundedMinutes(n, 0)).filter(Boolean))].slice(0, 4);
    return values.length ? values : [...DEFAULT_DURATIONS];
  }
  function cleanMode(value) { return MODES.includes(value) ? value : 'adaptive'; }
  function modeLabel(mode) {
    return mode === 'trust' ? 'Доверие' : mode === 'control' ? 'Контроль' : 'Адаптивный';
  }
  function purposeLabel(purpose) {
    return ({
      publish: 'Опубликовать готовое',
      create: 'Создать или смонтировать',
      reply: 'Ответить людям',
      research: 'Найти конкретные референсы',
      watch: 'Посмотреть сохранённый материал',
      rest: 'Осознанно отдохнуть',
      unsure: 'Пока не знаю',
    })[purpose] || 'Пока не знаю';
  }

  function purposeRows(raw) {
    const rows = Array.isArray(raw) ? raw : [];
    return rows.slice(0, 8).map((row, index) => {
      const id = boundedText(row && row.id, `purpose-${index + 1}`, 48).replace(/[^a-zA-Z0-9_.:-]/g, '-');
      return {
        id,
        label: boundedText(row && row.label, 'Рабочая цель', 80),
        minutes: boundedMinutes(row && row.minutes, 10),
        outcomeHint: boundedText(row && row.outcomeHint, '', 120),
        selected: !!(row && row.selected),
      };
    });
  }

  function renderDurationChoices(durations, selected, t) {
    return cleanDurations(durations).map((minutes, index) => `<label class="attention-choice attention-duration-choice">
      <input type="radio" name="minutes" value="${minutes}" ${minutes === boundedMinutes(selected, durations && durations[0]) || (!selected && index === 0) ? 'checked' : ''} />
      <span>${minutes} ${tr(t, 'мин')}</span>
    </label>`).join('');
  }

  function renderModeChoices(selected, t) {
    const active = cleanMode(selected);
    return MODES.map((mode) => `<label class="attention-choice attention-mode-choice" data-attention-mode="${mode}">
      <input type="radio" name="mode" value="${mode}" ${mode === active ? 'checked' : ''} />
      <span><b>${tr(t, modeLabel(mode))}</b><small>${tr(t, mode === 'trust'
        ? 'Пауза и честный выбор без блокировки.'
        : mode === 'adaptive'
          ? 'Одно продление, затем выбранная граница.'
          : 'Заранее выбранная граница без обычной отмены.')}</small></span>
    </label>`).join('');
  }

  function renderSetup(vm = {}, t) {
    const targetLabel = boundedText(vm.targetLabel, '', 80);
    const selectedPurpose = PURPOSES.includes(vm.purpose) ? vm.purpose : 'publish';
    const outcomeHint = boundedText(vm.outcomeHint, '', 120);
    const durations = cleanDurations(vm.durations);
    const storageMode = vm.storageMode === 'contracts' ? 'contracts' : 'local';
    return `<form id="attention-setup-form" class="attention-flow attention-setup" data-attention-screen="setup">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, 'Граница внимания')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${tr(t, 'Настроим одно правило')}</h2>
        <p id="attention-dialog-description">${tr(t, 'Одно приложение, одна цель, одна граница. Остальное можно добавить позже.')}</p>
      </header>
      <div class="attention-field-grid">
        <label class="attention-field attention-field-wide">
          <span>${tr(t, 'Приложение или сайт')}</span>
          <input name="targetLabel" maxlength="80" required value="${esc(targetLabel)}" placeholder="${tr(t, 'Например: TikTok')}" autocomplete="off" />
        </label>
        <label class="attention-field attention-field-wide">
          <span>${tr(t, 'Зачем открываешь')}</span>
          <select name="purpose" required>${PURPOSES.map((purpose) => `<option value="${purpose}" ${purpose === selectedPurpose ? 'selected' : ''}>${tr(t, purposeLabel(purpose))}</option>`).join('')}</select>
        </label>
        <fieldset class="attention-fieldset attention-field-wide">
          <legend>${tr(t, 'Сколько времени')}</legend>
          <div class="attention-choice-row">${renderDurationChoices(durations, vm.minutes, t)}</div>
        </fieldset>
        <label class="attention-field attention-field-wide">
          <span>${tr(t, 'Что должно остаться после выхода')}</span>
          <input name="outcomeHint" maxlength="120" value="${esc(outcomeHint)}" placeholder="${tr(t, 'Например: ролик опубликован')}" autocomplete="off" />
        </label>
        <fieldset class="attention-fieldset attention-field-wide">
          <legend>${tr(t, 'Сила границы')}</legend>
          <div class="attention-mode-grid">${renderModeChoices(vm.mode, t)}</div>
        </fieldset>
      </div>
      <details class="attention-data-choice">
        <summary>${tr(t, 'Данные и приватность')}</summary>
        <fieldset class="attention-fieldset">
          <legend>${tr(t, 'Где хранить контракты и исходы')}</legend>
          <label class="attention-choice"><input type="radio" name="storageMode" value="local" ${storageMode === 'local' ? 'checked' : ''} /><span><b>${tr(t, 'Только на этом устройстве')}</b><small>${tr(t, 'Ничего не отправляется в Satoru Cloud.')}</small></span></label>
          <label class="attention-choice"><input type="radio" name="storageMode" value="contracts" ${storageMode === 'contracts' ? 'checked' : ''} /><span><b>${tr(t, 'Синхронизировать контракты')}</b><small>${tr(t, 'Синхронизируются правила, окна и записанные исходы — без истории сайтов и содержимого экрана.')}</small></span></label>
        </fieldset>
      </details>
      <p class="attention-privacy-note">${tr(t, 'Подробная история устройства остаётся локальной. Синхронизация включается отдельно.')}</p>
      <p class="attention-form-status" data-attention-status role="status" aria-live="polite"></p>
      <div class="attention-actions">
        <button type="button" class="btn ghost" data-action="close-attention-dialog">${tr(t, 'Не сейчас')}</button>
        <button type="submit" class="btn" data-action="save-attention-policy">${tr(t, 'Сохранить правило')}</button>
      </div>
    </form>`;
  }

  function renderEntry(vm = {}, t) {
    const targetLabel = boundedText(vm.targetLabel, 'Приложение или сайт', 80);
    const purposes = purposeRows(vm.purposes);
    const selected = purposes.find((row) => row.selected) || purposes[0];
    const calibration = vm.calibration && Number(vm.calibration.recorded) >= 5 ? vm.calibration : null;
    return `<form id="attention-entry-form" class="attention-flow attention-entry" data-attention-screen="entry" data-policy-id="${esc(vm.policyId || '')}">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, 'Перед входом')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${esc(targetLabel)} — ${tr(t, 'зачем сейчас?')}</h2>
        <p id="attention-dialog-description">${tr(t, 'Выбери конкретный результат. Это займёт несколько секунд.')}</p>
      </header>
      ${purposes.length ? `<fieldset class="attention-fieldset">
        <legend>${tr(t, 'Цель этого входа')}</legend>
        <div class="attention-purpose-grid">${purposes.map((row, index) => `<label class="attention-choice attention-purpose-choice">
          <input type="radio" name="purposeId" value="${esc(row.id)}" data-minutes="${row.minutes}" data-outcome="${esc(row.outcomeHint)}" ${row === selected || (!selected && index === 0) ? 'checked' : ''} />
          <span><b>${esc(row.label)}</b><small>${row.minutes} ${tr(t, 'мин')}${row.outcomeHint ? ` · ${esc(row.outcomeHint)}` : ''}</small></span>
        </label>`).join('')}</div>
      </fieldset>` : `<div class="attention-empty" role="status"><p>${tr(t, 'Для этого приложения ещё нет правила.')}</p><button type="button" class="btn" data-action="attention-open-setup">${tr(t, 'Настроить за две минуты')}</button></div>`}
      ${selected ? `<label class="attention-field">
        <span>${tr(t, 'Конкретный результат')}</span>
        <input name="expectedOutcome" maxlength="120" value="${esc(selected.outcomeHint)}" placeholder="${tr(t, 'Что будет готово к выходу')}" autocomplete="off" />
      </label><label class="attention-field attention-topic-field" data-attention-topic ${selected.id === 'research' ? '' : 'hidden'}>
        <span>${tr(t, 'Тема поиска')}</span>
        <input name="topic" maxlength="80" placeholder="${tr(t, 'Что именно ищешь')}" autocomplete="off" ${selected.id === 'research' ? 'required' : ''} />
      </label>` : ''}
      ${calibration ? `<p class="attention-calibration" role="note"><b>${esc(calibration.label || targetLabel)}:</b> ${esc(calibration.outsidePlan)} ${tr(t, 'из')} ${esc(calibration.recorded)} ${tr(t, 'записанных заходов закончились вне плана')}${Number(calibration.started) > Number(calibration.recorded) ? `. ${esc(calibration.recorded)} ${tr(t, 'записано из')} ${esc(calibration.started)}.` : '.'}</p>` : ''}
      <p class="attention-form-status" data-attention-status role="status" aria-live="polite"></p>
      <div class="attention-actions">
        <button type="button" class="btn ghost" data-action="close-attention-dialog">${tr(t, 'Не открывать')}</button>
        ${selected ? `<button type="submit" class="btn" data-action="start-attention-session">${tr(t, 'Начать ограниченное окно')}</button>` : ''}
      </div>
    </form>`;
  }

  function renderBoundary(vm = {}, t) {
    const mode = cleanMode(vm.mode);
    const isRest = vm.purpose === 'rest';
    const targetLabel = boundedText(vm.targetLabel, 'Приложение или сайт', 80);
    const expectedOutcome = boundedText(vm.expectedOutcome, '', 120);
    const extensionMinutes = boundedMinutes(vm.extensionMinutes, 5);
    const emergencyDelay = Math.max(0, Math.min(600, Math.round(Number(vm.emergencyDelaySeconds) || 90)));
    return `<section class="attention-flow attention-boundary" data-attention-screen="boundary" data-session-id="${esc(vm.sessionId || '')}" data-attention-mode="${mode}">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, isRest ? 'Граница отдыха' : 'Граница достигнута')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${isRest
          ? tr(t, 'Запланированный отдых закончился')
          : `${tr(t, 'Окно для')} ${esc(targetLabel)} ${tr(t, 'закончилось')}`}</h2>
        <p id="attention-dialog-description">${expectedOutcome
          ? `${tr(t, isRest ? 'План отдыха' : 'План был такой')}: ${esc(expectedOutcome)}.`
          : tr(t, isRest
            ? 'Без оценки себя: просто отметь, как закончился этот отрезок.'
            : 'Не нужно доказывать идеальный результат. Просто выбери честный следующий шаг.')}</p>
      </header>
      <div class="attention-boundary-actions">
        <button type="button" class="btn" data-action="finish-attention-session" data-outcome="${isRest ? 'rested' : 'done'}">${tr(t, isRest ? 'Отдых закончен' : 'Готово — выйти')}</button>
        ${vm.canExtend ? `<button type="button" class="btn ghost" data-action="extend-attention-session" data-minutes="${extensionMinutes}">${tr(t, 'Продлить один раз')} · ${extensionMinutes} ${tr(t, 'мин')}</button>` : ''}
        <button type="button" class="btn ghost" data-action="finish-attention-session" data-outcome="escaped">${tr(t, 'Меня унесло')}</button>
        ${isRest ? `<button type="button" class="btn ghost" data-action="finish-attention-session" data-outcome="unknown">${tr(t, 'Не уверен')}</button>` : ''}
      </div>
      ${mode === 'control' ? `<details class="attention-emergency">
        <summary>${tr(t, 'Нужен аварийный выход')}</summary>
        <div class="attention-emergency-body">
          <p>${tr(t, 'Он не наказывает тебя. Задержка нужна только потому, что это решение было принято заранее.')}</p>
          <label class="attention-field"><span>${tr(t, 'Причина')}</span><input name="emergencyReason" maxlength="120" autocomplete="off" /></label>
          <button type="button" class="btn ghost" data-action="start-attention-emergency" data-delay="${emergencyDelay}" ${vm.emergencyAvailable === false ? 'disabled' : ''}>${vm.emergencyAvailable === false ? tr(t, 'Аварийный выход уже использован') : `${tr(t, 'Начать ожидание')} · ${emergencyDelay} ${tr(t, 'сек')}`}</button>
        </div>
      </details>` : ''}
      <p class="attention-form-status" data-attention-status role="status" aria-live="polite"></p>
    </section>`;
  }

  function renderRecovery(vm = {}, t) {
    const requestedMinutes = boundedRecoveryMinutes(vm.minutes, 20);
    const selectedMinutes = RECOVERY_DURATIONS.includes(requestedMinutes) ? requestedMinutes : 20;
    const recoveryLabel = boundedText(vm.recoveryLabel, '', 80);
    const deviceMode = ['none', 'bounded', 'open'].includes(vm.deviceMode) ? vm.deviceMode : 'none';
    const deviceOptions = [
      ['none', 'Без экрана', 'Телефон и ноутбук остаются в стороне.'],
      ['bounded', 'Экран с отдельной границей', 'Поставь системный таймер, если уходишь из Satoru.'],
      ['open', 'Экран без ограничения', 'Можно выбрать осознанно, но Satoru не сможет остановить ленту.'],
    ];
    return `<form id="attention-recovery-form" class="attention-flow attention-recovery attention-recovery-compact" data-attention-screen="recovery" data-minutes-min="5" data-minutes-max="180">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, 'Восстановление')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${tr(t, 'Отдых с границей')}</h2>
        <p id="attention-dialog-description">${tr(t, 'Выбери короткий отрезок отдыха и заранее реши, где он закончится.')}</p>
      </header>
      <label class="attention-field">
        <span>${tr(t, 'Что поможет отдохнуть')} <small>(${tr(t, 'необязательно')})</small></span>
        <input name="recoveryLabel" maxlength="80" value="${esc(recoveryLabel)}" placeholder="${tr(t, 'Например: еда, душ или прогулка')}" autocomplete="off" />
      </label>
      <fieldset class="attention-fieldset">
        <legend>${tr(t, 'Сколько времени')}</legend>
        <div class="attention-choice-row">${RECOVERY_DURATIONS.map((minutes) => `<label class="attention-choice attention-duration-choice">
          <input type="radio" name="minutes" value="${minutes}" ${minutes === selectedMinutes ? 'checked' : ''} />
          <span>${minutes} ${tr(t, 'мин')}</span>
        </label>`).join('')}</div>
      </fieldset>
      <fieldset class="attention-fieldset">
        <legend>${tr(t, 'Что делать с устройствами')}</legend>
        <div class="attention-mode-grid">${deviceOptions.map(([value, label, hint]) => `<label class="attention-choice">
          <input type="radio" name="deviceMode" value="${value}" ${value === deviceMode ? 'checked' : ''} />
          <span><b>${tr(t, label)}</b><small>${tr(t, hint)}</small></span>
        </label>`).join('')}</div>
      </fieldset>
      <p class="attention-privacy-note">${tr(t, 'Это не ежедневный трекер и не долг. Записывается только граница этого отдыха.')}</p>
      <p class="attention-privacy-note" role="note">${tr(t, 'PWA покажет границу, пока Satoru открыт. Если уходишь из приложения, поставь системный таймер.')}</p>
      <p class="attention-form-status" data-attention-status role="status" aria-live="polite"></p>
      <div class="attention-actions">
        <button type="button" class="btn ghost" data-action="close-attention-dialog">${tr(t, 'Отмена')}</button>
        <button type="submit" class="btn" data-action="start-recovery-session">${tr(t, 'Начать отдых')}</button>
      </div>
    </form>`;
  }

  function renderEvening(vm = {}, t) {
    const targetTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(vm.targetTime || '')) ? String(vm.targetTime) : '';
    const dailyReminder = vm.dailyReminder === true;
    const steps = [
      ['Закрыть работу', 'Сохранить незавершённое и назвать первый шаг на завтра.'],
      ['Вернуть базовый порядок', 'Вода, еда, гигиена и короткая забота о комнате — без генеральной уборки.'],
      ['Поставить будильник и убрать устройства', 'Подготовить сон, не отмечая его заранее как выполненный.'],
    ];
    if (vm.active) return `<section class="attention-flow attention-evening attention-evening-active" data-attention-screen="evening-active">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, 'Конец дня')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${tr(t, 'Завершить вечер')}</h2>
        <p id="attention-dialog-description">${tr(t, 'Три границы вместо нового списка дел. Достаточно базового результата.')}</p>
      </header>
      <ol class="attention-evening-plan" aria-label="${tr(t, 'План завершения вечера')}">${steps.map(([label, hint]) => `<li>
        <span aria-hidden="true">✓</span><div><b>${tr(t, label)}</b><small>${tr(t, hint)}</small></div>
      </li>`).join('')}</ol>
      <p class="attention-privacy-note">${tr(t, 'Завершение этого плана не означает, что ты уже лёг спать или восстановился.')}</p>
      <div class="attention-actions">
        <button type="button" class="btn ghost" data-action="close-attention-dialog">${tr(t, 'Закрыть')}</button>
        <button type="button" class="btn" data-action="finish-evening-landing">${tr(t, 'Вечер завершён')}</button>
      </div>
    </section>`;
    return `<form id="attention-evening-form" class="attention-flow attention-evening" data-attention-screen="evening">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, 'Конец дня')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${tr(t, 'Настроить завершение вечера')}</h2>
        <p id="attention-dialog-description">${tr(t, 'Выбери время. Это одна подсказка, а не новый ежедневный трекер.')}</p>
      </header>
      <label class="attention-field">
        <span>${tr(t, 'Во сколько убрать устройства')} <small>(${tr(t, 'необязательно')})</small></span>
        <input type="time" name="targetTime" value="${esc(targetTime)}" />
      </label>
      <label class="attention-choice">
        <input type="checkbox" name="dailyReminder" ${dailyReminder ? 'checked' : ''} />
        <span><b>${tr(t, 'Напоминать каждый вечер')}</b><small>${tr(t, 'Голос и диалог работают, только пока Satoru открыт. Уведомление браузера появится, только если разрешение уже выдано.')}</small></span>
      </label>
      <p class="attention-form-status" data-attention-status role="status" aria-live="polite"></p>
      <div class="attention-actions">
        <button type="button" class="btn ghost" data-action="close-attention-dialog">${tr(t, 'Отмена')}</button>
        <button type="submit" class="btn" data-action="start-evening-session">${tr(t, 'Начать завершение вечера')}</button>
      </div>
    </form>`;
  }

  function renderReturn(vm = {}, t) {
    const actionLabel = boundedText(vm.actionLabel, 'Один маленький шаг', 120);
    const actionMinutes = boundedMinutes(vm.actionMinutes, 10);
    return `<section class="attention-flow attention-return" data-attention-screen="return">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, 'Возвращение')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${tr(t, 'День не является долгом')}</h2>
        <p id="attention-dialog-description">${tr(t, 'Не нужно наверстывать всё. Вернём управление одним небольшим действием.')}</p>
      </header>
      <div class="attention-return-action">
        <span aria-hidden="true">→</span>
        <div><b>${esc(actionLabel)}</b><small>${actionMinutes} ${tr(t, 'мин')}</small></div>
      </div>
      <div class="attention-actions attention-return-actions">
        <button type="button" class="btn" data-action="start-attention-return" data-action-id="${esc(vm.actionId || '')}">${tr(t, 'Начать этот шаг')}</button>
        <button type="button" class="btn ghost" data-action="choose-attention-return">${tr(t, 'Выбрать другой')}</button>
        <button type="button" class="btn ghost" data-action="attention-care-first">${tr(t, 'Сначала позаботиться о себе')}</button>
        <button type="button" class="btn ghost" data-action="attention-rest-today">${tr(t, 'Сегодня отдых')}</button>
      </div>
      <p class="attention-form-status" data-attention-status role="status" aria-live="polite"></p>
    </section>`;
  }

  function renderLoadError(vm = {}, t) {
    const unavailable = vm.error === 'invalid';
    return `<section class="attention-flow attention-load-error" data-attention-screen="error" role="alert">
      <header class="attention-flow-head">
        <p class="attention-kicker">${tr(t, 'Граница внимания')}</p>
        <h2 id="attention-dialog-title" tabindex="-1">${tr(t, unavailable ? 'Данные внимания повреждены' : 'Не удалось загрузить правила внимания')}</h2>
        <p id="attention-dialog-description">${tr(t, 'Это не пустой список. Мы не будем ничего перезаписывать, пока данные не восстановлены.')}</p>
      </header>
      <div class="attention-actions"><button type="button" class="btn" data-action="retry-attention-load" ${vm.busy ? 'disabled' : ''}>${tr(t, vm.busy ? 'Повторяем…' : 'Повторить')}</button></div>
    </section>`;
  }

  return Object.freeze({
    VERSION, MODES, PURPOSES, DEFAULT_DURATIONS, RECOVERY_DURATIONS, purposeLabel,
    renderSetup, renderEntry, renderBoundary, renderRecovery, renderEvening, renderReturn, renderLoadError,
  });
});
