(function optionsPage() {
  'use strict';

  const Core = globalThis.SatoruAttentionCore;
  const I18n = globalThis.SatoruAttentionI18n;
  const language = I18n.detect();
  const t = (key, values) => I18n.translate(language, key, values);
  const presets = {
    tiktok: { label: 'TikTok', hostname: 'www.tiktok.com', appKey: 'tiktok', purpose: 'publish', mode: 'control', minutes: 12 },
    youtube: { label: 'YouTube', hostname: 'www.youtube.com', appKey: 'youtube', purpose: 'watch', mode: 'adaptive', minutes: 45 },
    instagram: { label: 'Instagram', hostname: 'www.instagram.com', appKey: 'instagram', purpose: 'publish', mode: 'adaptive', minutes: 15 },
    reddit: { label: 'Reddit', hostname: 'www.reddit.com', appKey: 'reddit', purpose: 'research', mode: 'control', minutes: 10 },
  };

  const form = document.querySelector('#policy-form');
  const siteSelect = document.querySelector('#site-select');
  const domainField = document.querySelector('#domain-field');
  const domainInput = document.querySelector('#domain');
  const purposeInput = document.querySelector('#purpose');
  const modeInput = document.querySelector('#mode');
  const minutesInput = document.querySelector('#policy-minutes');
  const outcomeField = document.querySelector('#policy-outcome-field');
  const outcomeInput = document.querySelector('#policy-outcome');
  const status = document.querySelector('#options-status');
  const siteList = document.querySelector('#site-list');
  const noSites = document.querySelector('#no-sites');
  let actionBusy = false;

  I18n.localizeDocument(language);

  function setStatus(message, kind = '') {
    status.textContent = message || '';
    status.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function errorText(code) { return t(`error_${code}`) === `error_${code}` ? t('saveFailed') : t(`error_${code}`); }
  function modeName(mode) { return t(`mode_${mode}`); }
  function purposeName(purpose) { return t(`purpose_${purpose}`); }

  async function send(message) {
    try { return await chrome.runtime.sendMessage(message); }
    catch { return { ok: false, error: 'runtime_unavailable', retryable: true }; }
  }

  function applyPreset() {
    const preset = presets[siteSelect.value];
    domainField.hidden = !!preset;
    if (!preset) return;
    purposeInput.value = preset.purpose;
    modeInput.value = preset.mode;
    minutesInput.value = String(preset.minutes);
    outcomeInput.value = '';
    updateOutcomeVisibility();
  }

  function updateOutcomeVisibility() {
    outcomeField.hidden = !Core.isWorkPurpose(purposeInput.value);
  }

  async function render(focusPolicyId = '') {
    const result = await send({ type: 'GET_OPTIONS' });
    if (!result || result.ok !== true) {
      setStatus(t('genericError'), 'error');
      return;
    }
    const state = result.state;
    siteList.replaceChildren();
    noSites.hidden = state.policies.length > 0;
    for (const policy of state.policies) {
      const item = document.createElement('article');
      item.className = 'site-item';
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = policy.label;
      const meta = document.createElement('div');
      meta.className = 'site-meta';
      const rules = policy.purposes
        .map((rule) => `${purposeName(rule.purpose)} · ${modeName(rule.mode)} · ${rule.defaultMinutes} min`)
        .join(' / ');
      meta.textContent = `${policy.hostname} · ${rules}`;
      if (result.permissions[policy.id] !== true) {
        const missing = document.createElement('div');
        missing.className = 'status error';
        missing.textContent = t('permissionMissing');
        copy.append(title, meta, missing);
      } else copy.append(title, meta);

      const controls = document.createElement('div');
      controls.className = 'stack';
      const pill = document.createElement('span');
      pill.className = `state-pill${policy.enabled ? ' on' : ''}`;
      pill.textContent = policy.enabled ? t('enabled') : t('paused');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = policy.enabled ? t('pause') : t('turnOn');
      button.dataset.policyId = policy.id;
      button.dataset.enabled = String(!policy.enabled);
      const locked = state.activeSession && state.activeSession.policyId === policy.id && state.activeSession.mode === 'control';
      button.disabled = !!locked;
      if (locked) button.title = t('controlLocked');
      controls.append(pill, button);
      item.append(copy, controls);
      siteList.append(item);
    }
    if (focusPolicyId) {
      const focusTarget = siteList.querySelector(`button[data-policy-id="${focusPolicyId}"]`);
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
  }

  siteSelect.addEventListener('change', applyPreset);
  purposeInput.addEventListener('change', updateOutcomeVisibility);

  siteList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-policy-id]');
    if (!button || actionBusy) return;
    actionBusy = true;
    button.disabled = true;
    try {
      const result = await send({
        type: 'TOGGLE_POLICY',
        policyId: button.dataset.policyId,
        enabled: button.dataset.enabled === 'true',
      });
      if (!result || result.ok !== true) setStatus(errorText(result && result.error), 'error');
      else setStatus(t('saveSuccess'), 'success');
      await render(button.dataset.policyId);
    } finally { actionBusy = false; }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (actionBusy) return;
    actionBusy = true;
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    setStatus('');
    try {
      const preset = presets[siteSelect.value];
      const hostname = Core.normalizeHostname(preset ? preset.hostname : domainInput.value);
      if (!hostname) {
        setStatus(t('saveFailed'), 'error');
        domainInput.focus();
        return;
      }
      const purpose = purposeInput.value;
      const mode = modeInput.value;
      const minutes = Number(minutesInput.value);
      const expectedOutcome = outcomeInput.value.trim();
      if (mode === 'control' && purpose === 'unsure') {
        setStatus(t('error_unsure_in_control'), 'error');
        purposeInput.focus();
        return;
      }
      if (Core.isWorkPurpose(purpose) && !expectedOutcome) {
        setStatus(t('error_outcome_required'), 'error');
        outcomeInput.focus();
        return;
      }
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > Core.MAX_MINUTES) {
        setStatus(t('error_duration_invalid'), 'error');
        minutesInput.focus();
        return;
      }

      // The optional manifest grant is broad only as a capability declaration. The
      // actual user prompt is always restricted to this exact hostname pattern.
      const origins = Core.hostPatterns(hostname);
      let granted = false;
      try { granted = await chrome.permissions.request({ origins }); }
      catch {
        setStatus(errorText('runtime_unavailable'), 'error');
        return;
      }
      if (!granted) {
        setStatus(t('permissionDenied'), 'error');
        return;
      }
      const label = preset ? preset.label : hostname;
      const extensionsAllowed = mode === 'control' ? 0 : 1;
      const extensionMinutes = Math.min(5, minutes);
      const policy = {
        id: Core.policyIdForHost(hostname),
        label,
        hostname,
        appKey: preset ? preset.appKey : 'web',
        enabled: true,
        purposes: [{
          purpose,
          mode,
          defaultMinutes: minutes,
          maxMinutes: Math.min(Core.MAX_MINUTES, minutes + extensionsAllowed * extensionMinutes),
          extensionsAllowed,
          extensionMinutes,
          expectedOutcome,
        }],
        emergency: {
          passes: Core.EMERGENCY_PASSES,
          perDays: Core.EMERGENCY_WINDOW_DAYS,
          delaySeconds: Core.EMERGENCY_DELAY_SECONDS,
          accessMinutes: Core.EMERGENCY_MINUTES,
        },
      };
      const result = await send({ type: 'SAVE_POLICY', policy });
      if (!result || result.ok !== true) {
        setStatus(errorText(result && result.error), 'error');
        return;
      }
      setStatus(t('saveSuccess'), 'success');
      await render();
    } finally {
      actionBusy = false;
      if (submit) submit.disabled = false;
    }
  });

  applyPreset();
  render().catch(() => setStatus(t('genericError'), 'error'));
})();
