(function gatePage() {
  'use strict';

  const I18n = globalThis.SatoruAttentionI18n;
  const language = I18n.detect();
  const t = (key, values) => I18n.translate(language, key, values);
  const siteId = new URLSearchParams(location.search).get('site') || '';
  let context = null;
  let selectedRule = null;
  let timer = null;
  let emergencyTimer = null;
  let actionBusy = false;
  let emergencyAnnounced = false;

  const sections = {
    loading: document.querySelector('#loading-section'),
    runtime: document.querySelector('#runtime-section'),
    missing: document.querySelector('#missing-section'),
    start: document.querySelector('#start-section'),
    active: document.querySelector('#active-section'),
    boundary: document.querySelector('#boundary-section'),
  };
  const purposeList = document.querySelector('#purpose-list');
  const gateCard = document.querySelector('#gate-card');
  const minutesInput = document.querySelector('#minutes');
  const topicField = document.querySelector('#topic-field');
  const topicInput = document.querySelector('#topic');
  const detailField = document.querySelector('#detail-field');
  const detailInput = document.querySelector('#detail');
  const outcomeField = document.querySelector('#outcome-field');
  const outcomeOutput = document.querySelector('#outcome');
  const startStatus = document.querySelector('#start-status');
  const activeStatus = document.querySelector('#active-status');
  const boundaryStatus = document.querySelector('#boundary-status');
  const emergencySection = document.querySelector('#emergency-section');
  const emergencyStart = document.querySelector('#emergency-start');
  const emergencyConfirm = document.querySelector('#emergency-confirm');
  const emergencyCountdown = document.querySelector('#emergency-countdown');
  const emergencyReason = document.querySelector('#emergency-reason');
  const emergencyOpen = document.querySelector('#emergency-open');
  const emergencyStatus = document.querySelector('#emergency-status');

  I18n.localizeDocument(language);

  function show(name) {
    Object.entries(sections).forEach(([key, element]) => { element.hidden = key !== name; });
    if (!['active', 'boundary'].includes(name)) {
      emergencySection.hidden = true;
      clearInterval(emergencyTimer);
    }
    const heading = sections[name] && sections[name].querySelector('h1');
    if (heading) {
      gateCard.setAttribute('aria-labelledby', heading.id);
      heading.focus({ preventScroll: true });
    }
  }

  async function send(message) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (response) return response;
      } catch { /* A stale unpacked-extension tab gets one quiet retry. */ }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return { ok: false, error: 'runtime_unavailable', retryable: true };
  }

  async function guarded(button, work) {
    if (actionBusy) return null;
    actionBusy = true;
    if (button) button.disabled = true;
    try { return await work(); }
    finally {
      actionBusy = false;
      if (button && button.isConnected) button.disabled = false;
    }
  }

  function errorText(code) {
    const key = `error_${code}`;
    const translated = t(key);
    return translated === key ? t('genericError') : translated;
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.ceil(Number(ms) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }

  function setMode(element, mode) { element.textContent = t(`mode_${mode}`); }

  function showRuntime(code) {
    document.querySelector('#runtime-status').textContent = errorText(code || 'runtime_unavailable');
    show('runtime');
  }

  async function openSettings() { await send({ type: 'OPEN_OPTIONS' }); }

  async function openSatoru(action) {
    if (!context || !context.policy) return;
    const result = await send({ type: 'GET_SATORU_LINK', action, appKey: context.policy.appKey });
    if (result && result.ok) await chrome.tabs.create({ url: result.url });
  }

  function chooseRule(rule) {
    selectedRule = rule;
    setMode(document.querySelector('#site-mode'), rule.mode);
    minutesInput.replaceChildren();
    const available = context?.quota ? Math.min(rule.defaultMinutes, context.quota.remainingMinutes) : rule.defaultMinutes;
    const selectedMinutes = Math.min(rule.defaultMinutes, available);
    const values = [...new Set([5, 8, 10, rule.defaultMinutes, available].filter((value) => value > 0 && value <= available))].sort((a, b) => a - b);
    for (const value of values) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      option.selected = value === selectedMinutes;
      minutesInput.append(option);
    }
    outcomeOutput.textContent = rule.expectedOutcome || t('outcomeUnsure');
    topicField.hidden = !rule.requiresTopic;
    detailField.hidden = !rule.requiresDetail;
    topicInput.value = '';
    detailInput.value = '';
    outcomeField.hidden = false;
  }

  function renderStart() {
    emergencySection.hidden = true;
    show('start');
    document.querySelector('#site-name').textContent = context.policy.label;
    const quota = context.quota;
    const quotaStatus = document.querySelector('#quota-status');
    quotaStatus.textContent = quota ? t('quotaSummary', {
      used: quota.sessionsUsed,
      max: quota.maxSessionsPerDay,
      minutes: quota.remainingMinutes,
    }) : '';
    if (quota?.cooldownRemainingMs > 0) quotaStatus.textContent = t('cooldownSummary', { time: formatTime(quota.cooldownRemainingMs) });
    if (quota && (quota.sessionsRemaining <= 0 || quota.remainingMinutes <= 0)) quotaStatus.textContent = t('dailyClosed');
    purposeList.replaceChildren();
    context.policy.purposes.forEach((rule, index) => {
      const label = document.createElement('label');
      label.className = 'purpose-choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'purpose';
      input.value = rule.purpose;
      input.checked = index === 0;
      input.disabled = !!(quota && !quota.canStart);
      const copy = document.createElement('span');
      copy.textContent = t(`purpose_${rule.purpose}`);
      input.addEventListener('change', () => chooseRule(rule));
      label.append(input, copy);
      purposeList.append(label);
    });
    chooseRule(context.policy.purposes[0]);
    document.querySelector('#start-form button[type="submit"]').disabled = !!(quota && !quota.canStart);
  }

  function startActiveTimer() {
    clearInterval(timer);
    const update = () => {
      const deadline = Date.parse(context.activeSession.deadlineAt);
      const remaining = Math.max(0, deadline - Date.now());
      const formatted = formatTime(remaining);
      document.querySelector('#active-timer').textContent = formatted;
      document.querySelector('#active-remaining').textContent = t('remaining', { time: formatted });
      if (remaining <= 0) refresh();
    };
    update();
    timer = setInterval(update, 1000);
  }

  function renderActive() {
    show('active');
    setMode(document.querySelector('#active-mode'), context.activeSession.mode);
    document.querySelector('#active-site').textContent = context.policy.label;
    document.querySelector('#active-context').textContent = t('boundaryContext', {
      purpose: t(`purpose_${context.activeSession.purpose}`),
      minutes: context.activeSession.plannedMinutes,
    });
    document.querySelector('#finish-early').hidden = context.activeSession.emergencyAccess === true;
    emergencySection.hidden = context.activeSession.mode !== 'control' || context.activeSession.emergencyAccess === true;
    emergencyStart.hidden = false;
    emergencyConfirm.hidden = true;
    emergencyStatus.textContent = '';
    activeStatus.textContent = '';
    activeStatus.className = 'status';
    emergencyAnnounced = false;
    if (context.emergency) updateEmergencyCountdown(context.emergency.unlockAt);
    startActiveTimer();
  }

  function updateEmergencyCountdown(unlockAt) {
    clearInterval(emergencyTimer);
    emergencyConfirm.hidden = false;
    emergencyStart.hidden = true;
    const update = () => {
      const remaining = Math.max(0, Date.parse(unlockAt) - Date.now());
      emergencyCountdown.textContent = remaining > 0 ? t('emergencyWait', { time: formatTime(remaining) }) : '';
      emergencyOpen.disabled = actionBusy || remaining > 0 || emergencyReason.value.trim().length < 2;
      if (remaining <= 0 && !emergencyAnnounced) {
        emergencyAnnounced = true;
        emergencyStatus.textContent = t('emergencyReady');
      }
    };
    update();
    emergencyTimer = setInterval(update, 1000);
  }

  function renderBoundary() {
    show('boundary');
    setMode(document.querySelector('#boundary-mode'), context.activeSession.mode);
    document.querySelector('#boundary-context').textContent = t('boundaryContext', {
      purpose: t(`purpose_${context.activeSession.purpose}`),
      minutes: context.activeSession.plannedMinutes,
    });
    const rest = context.activeSession.purpose === 'rest';
    document.querySelector('[data-outcome="done"]').hidden = rest;
    document.querySelector('[data-outcome="unfinished"]').hidden = rest;
    document.querySelector('[data-outcome="rested"]').hidden = !rest;
    document.querySelector('#extend-session').hidden = !context.boundary.canExtend;
    boundaryStatus.textContent = context.clockRollback ? t('error_clock_rollback') : '';
    boundaryStatus.className = `status${context.clockRollback ? ' error' : ''}`;
    emergencySection.hidden = context.activeSession.mode !== 'control' || context.clockRollback;
    emergencyStart.hidden = false;
    emergencyConfirm.hidden = true;
    emergencyStatus.textContent = '';
    emergencyAnnounced = false;
    if (context.emergency) updateEmergencyCountdown(context.emergency.unlockAt);
    if (context.activeSession.emergencyUsed) {
      emergencyStart.hidden = true;
      emergencyStatus.textContent = t('emergencySpent');
    }
  }

  async function refresh() {
    clearInterval(timer);
    const result = await send({ type: 'GET_CONTEXT', siteId });
    context = result;
    if (!result || result.ok !== true) {
      showRuntime(result && result.error);
      return;
    }
    if (!result.policy) {
      show('missing');
      return;
    }
    if (!result.activeSession) {
      renderStart();
      return;
    }
    if (result.boundary && result.boundary.over) renderBoundary();
    else renderActive();
  }

  document.querySelector('#start-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedRule || !context || !context.policy) return;
    await guarded(event.submitter, async () => {
      startStatus.textContent = '';
      startStatus.className = 'status';
      const result = await send({
        type: 'START_SESSION',
        input: {
          policyId: context.policy.id,
          purpose: selectedRule.purpose,
          minutes: Number(minutesInput.value),
          expectedOutcome: selectedRule.expectedOutcome,
          topic: topicInput.value,
          detail: detailInput.value,
        },
      });
      if (!result || result.ok !== true) {
        startStatus.textContent = errorText(result && result.error);
        startStatus.className = 'status error';
        if (result && result.committed === true) await refresh();
        return;
      }
      location.assign(result.targetUrl);
    });
  });

  async function finish(outcome, button) {
    await guarded(button, async () => {
      const result = await send({ type: 'FINISH_SESSION', outcome });
      if (!result || !result.ok) {
        const target = sections.boundary.hidden ? activeStatus : boundaryStatus;
        target.textContent = errorText(result && result.error);
        target.className = 'status error';
        if (result && result.committed === true) await refresh();
        return;
      }
      location.assign(result.returnUrl);
    });
  }

  document.querySelector('#boundary-section').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-outcome]');
    if (button) finish(button.dataset.outcome, button);
  });
  document.querySelector('#finish-early').addEventListener('click', (event) => finish('done', event.currentTarget));
  document.querySelector('#continue-site').addEventListener('click', () => location.assign(context.resumeUrl));
  document.querySelector('#extend-session').addEventListener('click', async (event) => {
    await guarded(event.currentTarget, async () => {
      const result = await send({ type: 'EXTEND_SESSION' });
      if (!result || !result.ok) {
        boundaryStatus.textContent = errorText(result && result.error);
        boundaryStatus.className = 'status error';
        if (result && result.committed === true) await refresh();
        return;
      }
      location.assign(result.targetUrl);
    });
  });

  emergencyStart.addEventListener('click', async (event) => {
    await guarded(event.currentTarget, async () => {
      const result = await send({ type: 'REQUEST_EMERGENCY' });
      if (!result || !result.ok) {
        emergencyStatus.textContent = errorText(result && result.error);
        emergencyStatus.className = 'status error';
        if (result && result.committed === true) await refresh();
        return;
      }
      context.emergency = result.emergency;
      updateEmergencyCountdown(result.emergency.unlockAt);
      emergencyReason.focus();
    });
  });
  emergencyReason.addEventListener('input', () => {
    if (!context || !context.emergency) return;
    const ready = Date.now() >= Date.parse(context.emergency.unlockAt);
    emergencyOpen.disabled = !ready || emergencyReason.value.trim().length < 2;
  });
  emergencyOpen.addEventListener('click', async (event) => {
    await guarded(event.currentTarget, async () => {
      const result = await send({ type: 'GRANT_EMERGENCY', reason: emergencyReason.value });
      if (!result || !result.ok) {
        emergencyStatus.textContent = errorText(result && result.error);
        emergencyStatus.className = 'status error';
        if (result && result.committed === true) await refresh();
        return;
      }
      location.assign(result.targetUrl);
    });
  });

  document.querySelector('#missing-settings').addEventListener('click', openSettings);
  document.querySelector('#runtime-retry').addEventListener('click', () => refresh());
  document.querySelector('#start-settings').addEventListener('click', openSettings);
  document.querySelector('#boundary-settings').addEventListener('click', openSettings);
  document.querySelector('#satoru-gate').addEventListener('click', () => openSatoru('gate'));
  document.querySelector('#satoru-return').addEventListener('click', () => openSatoru('return'));

  refresh().catch(() => showRuntime('runtime_unavailable'));
})();
