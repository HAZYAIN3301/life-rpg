(function optionsPage() {
  'use strict';

  const Core = globalThis.SatoruAttentionCore;
  const Protection = globalThis.SatoruProtection;
  const ProtectionCatalog = globalThis.SatoruProtectionCatalog;
  const I18n = globalThis.SatoruAttentionI18n;
  const language = I18n.detect();
  const t = (key, values) => I18n.translate(language, key, values);
  const scenarioDefaults = Object.freeze({
    publish: { minutes: 12, mode: 'control', outcomeKey: 'outcomePublish', detail: true },
    create: { minutes: 25, mode: 'control', outcomeKey: 'outcomeCreate', detail: true },
    reply: { minutes: 10, mode: 'control', outcomeKey: 'outcomeReply', detail: true },
    research: { minutes: 10, mode: 'control', outcomeKey: 'outcomeResearch', topic: true },
    watch: { minutes: 8, mode: 'control', outcomeKey: 'outcomeWatch', detail: true },
    rest: { minutes: 10, mode: 'adaptive', outcomeKey: 'outcomeRest' },
    unsure: { minutes: 5, mode: 'trust', outcomeKey: 'outcomeUnsure' },
  });
  const presets = Object.freeze({
    tiktok: { label: 'TikTok', hostname: 'www.tiktok.com', appKey: 'tiktok', purposes: ['publish', 'create', 'research', 'watch'], dailyBudgetMinutes: 50, maxSessionsPerDay: 3, cooldownMinutes: 10 },
    youtube: { label: 'YouTube', hostname: 'www.youtube.com', appKey: 'youtube', purposes: ['publish', 'research', 'watch'], dailyBudgetMinutes: 60, maxSessionsPerDay: 3, cooldownMinutes: 10 },
    instagram: { label: 'Instagram', hostname: 'www.instagram.com', appKey: 'instagram', purposes: ['publish', 'create', 'reply'], dailyBudgetMinutes: 35, maxSessionsPerDay: 3, cooldownMinutes: 10 },
    reddit: { label: 'Reddit', hostname: 'www.reddit.com', appKey: 'reddit', purposes: ['research', 'reply'], dailyBudgetMinutes: 30, maxSessionsPerDay: 3, cooldownMinutes: 10 },
    custom: { label: '', hostname: '', appKey: 'web', purposes: ['research', 'watch'], dailyBudgetMinutes: 30, maxSessionsPerDay: 3, cooldownMinutes: 10 },
  });

  const form = document.querySelector('#policy-form');
  const siteSelect = document.querySelector('#site-select');
  const domainField = document.querySelector('#domain-field');
  const domainInput = document.querySelector('#domain');
  const scenarioList = document.querySelector('#scenario-list');
  const dailyBudgetInput = document.querySelector('#daily-budget');
  const dailySessionsInput = document.querySelector('#daily-sessions');
  const cooldownInput = document.querySelector('#cooldown-minutes');
  const status = document.querySelector('#options-status');
  const runtimeHelp = document.querySelector('#runtime-help');
  const siteList = document.querySelector('#site-list');
  const noSites = document.querySelector('#no-sites');
  const protectionForm = document.querySelector('#protection-form');
  const protectionEnabled = document.querySelector('#protection-enabled');
  const protectionBadge = document.querySelector('#protection-badge');
  const protectionStatus = document.querySelector('#protection-status');
  const denyInput = document.querySelector('#deny-domain');
  const allowInput = document.querySelector('#allow-domain');
  const denyList = document.querySelector('#deny-list');
  const allowList = document.querySelector('#allow-list');
  const recreationEnabled = document.querySelector('#recreation-enabled');
  const recreationStart = document.querySelector('#recreation-start');
  const recreationEnd = document.querySelector('#recreation-end');
  const safeSearch = document.querySelector('#safe-search');
  const youtubeRestricted = document.querySelector('#youtube-restricted');
  const blockBypass = document.querySelector('#block-bypass');
  const runtimeReload = document.querySelector('#runtime-reload');
  const installedVersion = document.querySelector('#installed-version');
  const checkUpdate = document.querySelector('#check-update');
  const updateStatus = document.querySelector('#update-status');
  let actionBusy = false;
  let currentState = Core.emptyState();
  let currentProtection = Protection.emptySettings();
  let protectionDirty = false;
  let editingPolicyId = '';
  let runtimePort = null;
  let heartbeatTimer = 0;
  let booting = true;

  I18n.localizeDocument(language);
  installedVersion.textContent = chrome.runtime.getManifest().version;

  function requestUpdateCheck() {
    return new Promise((resolve, reject) => {
      if (typeof chrome.runtime.requestUpdateCheck !== 'function') { reject(new Error('unsupported')); return; }
      let settled = false;
      const finish = (status, details = {}) => {
        if (settled) return;
        settled = true;
        resolve(typeof status === 'object' ? status : { status, version: details?.version });
      };
      try {
        const pending = chrome.runtime.requestUpdateCheck((status, details) => {
          const error = chrome.runtime.lastError;
          if (error) { if (!settled) { settled = true; reject(new Error(error.message)); } return; }
          finish(status, details);
        });
        if (pending && typeof pending.then === 'function') pending.then((result) => finish(result)).catch((error) => {
          if (!settled) { settled = true; reject(error); }
        });
      } catch (error) { if (!settled) { settled = true; reject(error); } }
    });
  }

  checkUpdate.addEventListener('click', async () => {
    checkUpdate.disabled = true;
    updateStatus.className = 'status';
    updateStatus.textContent = t('updateChecking');
    try {
      const result = await requestUpdateCheck();
      const statusCode = result?.status || 'no_update';
      if (statusCode === 'update_available') updateStatus.textContent = t('updateAvailable', { version: result.version || '—' });
      else if (statusCode === 'throttled') updateStatus.textContent = t('updateThrottled');
      else updateStatus.textContent = t('updateCurrent');
      updateStatus.classList.add('success');
    } catch {
      updateStatus.textContent = t('updateUnavailable');
      updateStatus.classList.add('error');
    } finally { checkUpdate.disabled = false; }
  });

  function setStatus(message, kind = '', runtime = false) {
    status.textContent = message || '';
    status.className = `status${kind ? ` ${kind}` : ''}`;
    runtimeHelp.hidden = !runtime;
  }
  function setProtectionStatus(message, kind = '') {
    protectionStatus.textContent = message || '';
    protectionStatus.className = `status${kind ? ` ${kind}` : ''}`;
  }
  function errorText(code) {
    const key = `error_${code}`;
    const translated = t(key);
    return translated === key ? t('saveFailed') : translated;
  }
  function modeName(mode) { return t(`mode_${mode}`); }
  function purposeName(purpose) { return t(`purpose_${purpose}`); }
  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  function runtimeInvalidated(detail) {
    return /extension context invalidated|receiving end does not exist|message port closed|could not establish connection/i.test(String(detail || ''));
  }

  function recoverStaleOptions(detail, afterBoot = false) {
    if ((!booting && !afterBoot) || !runtimeInvalidated(detail)) return false;
    const url = new URL(location.href);
    if (url.searchParams.has('runtime-reconnect')) return false;
    url.searchParams.set('runtime-reconnect', String(Date.now()));
    location.replace(url.toString());
    return true;
  }

  function connectRuntime() {
    if (runtimePort) return;
    try {
      runtimePort = chrome.runtime.connect({ name: 'satoru-options-heartbeat' });
      runtimePort.onMessage.addListener((message) => {
        if (message?.type === 'PONG') {
          const url = new URL(location.href);
          if (url.searchParams.has('runtime-reconnect')) {
            url.searchParams.delete('runtime-reconnect');
            history.replaceState(null, '', url.toString());
          }
        }
      });
      runtimePort.onDisconnect.addListener(() => {
        runtimePort = null;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = 0;
        if (recoverStaleOptions('extension context invalidated', true)) return;
        setStatus(errorText('runtime_unavailable'), 'error', true);
      });
      runtimePort.postMessage({ type: 'PING' });
      heartbeatTimer = setInterval(() => {
        try { runtimePort?.postMessage({ type: 'PING' }); }
        catch { /* onDisconnect exposes the recovery action. */ }
      }, 20_000);
    } catch (error) {
      if (!recoverStaleOptions(error && error.message)) setStatus(errorText('runtime_unavailable'), 'error', true);
    }
  }

  async function send(message) {
    let detail = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (response) return response;
      } catch (error) { detail = String(error && error.message || ''); }
      if (attempt === 0) await wait(180);
    }
    if (recoverStaleOptions(detail)) return { ok: false, error: 'runtime_reloading', retryable: true, detail };
    return { ok: false, error: 'runtime_unavailable', retryable: true, detail };
  }

  function scenarioRow(purpose, rule, enabled) {
    const defaults = scenarioDefaults[purpose];
    const item = document.createElement('article');
    item.className = 'scenario-item';
    item.dataset.purpose = purpose;
    const toggle = document.createElement('label');
    toggle.className = 'scenario-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabled;
    checkbox.dataset.role = 'enabled';
    const copy = document.createElement('span');
    const title = document.createElement('b');
    title.textContent = purposeName(purpose);
    const result = document.createElement('small');
    result.textContent = t(defaults.outcomeKey);
    copy.append(title, result);
    toggle.append(checkbox, copy);
    const controls = document.createElement('div');
    controls.className = 'scenario-controls';
    const mode = document.createElement('select');
    mode.dataset.role = 'mode';
    mode.setAttribute('aria-label', t('mode'));
    for (const value of ['trust', 'adaptive', 'control']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = modeName(value);
      option.selected = value === (rule?.mode || defaults.mode);
      mode.append(option);
    }
    const minutes = document.createElement('input');
    minutes.type = 'number';
    minutes.inputMode = 'numeric';
    minutes.min = '1';
    minutes.max = String(Core.MAX_MINUTES);
    minutes.value = String(rule?.defaultMinutes || defaults.minutes);
    minutes.dataset.role = 'minutes';
    minutes.setAttribute('aria-label', t('minutes'));
    controls.append(mode, minutes);
    item.append(toggle, controls);
    const update = () => {
      item.classList.toggle('is-disabled', !checkbox.checked);
      mode.disabled = !checkbox.checked;
      minutes.disabled = !checkbox.checked;
    };
    checkbox.addEventListener('change', update);
    update();
    return item;
  }

  function buildScenarios(policy, preset) {
    scenarioList.replaceChildren();
    const byPurpose = new Map((policy?.purposes || []).map((rule) => [rule.purpose, rule]));
    const enabled = new Set(policy ? policy.purposes.map((rule) => rule.purpose) : preset.purposes);
    for (const purpose of Object.keys(scenarioDefaults)) scenarioList.append(scenarioRow(purpose, byPurpose.get(purpose), enabled.has(purpose)));
  }

  function loadDraft(policy = null) {
    const preset = policy ? Object.values(presets).find((item) => item.hostname === policy.hostname) || presets.custom : presets[siteSelect.value];
    editingPolicyId = policy?.id || '';
    if (policy) {
      const key = Object.keys(presets).find((name) => presets[name].hostname === policy.hostname) || 'custom';
      siteSelect.value = key;
      domainInput.value = key === 'custom' ? policy.hostname : '';
    }
    domainField.hidden = siteSelect.value !== 'custom';
    dailyBudgetInput.value = String(policy?.dailyBudgetMinutes || preset.dailyBudgetMinutes);
    dailySessionsInput.value = String(policy?.maxSessionsPerDay || preset.maxSessionsPerDay);
    cooldownInput.value = String(policy?.cooldownMinutes ?? preset.cooldownMinutes);
    buildScenarios(policy, preset);
  }

  function pendingFor(policyId) { return currentState.pendingPolicies.find((item) => item.policyId === policyId) || null; }

  function renderDomainList(container, domains, kind) {
    container.replaceChildren();
    for (const domain of domains) {
      const chip = document.createElement('span');
      chip.className = 'domain-chip';
      const text = document.createElement('span');
      text.textContent = domain;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.removeDomain = domain;
      remove.dataset.listKind = kind;
      remove.setAttribute('aria-label', t('removeDomain', { domain }));
      remove.textContent = '×';
      chip.append(text, remove);
      container.append(chip);
    }
  }

  function renderProtection(settings, summary = null) {
    currentProtection = Protection.normalizeSettings(settings);
    protectionEnabled.checked = currentProtection.enabled;
    for (const input of protectionForm.querySelectorAll('[data-category]')) {
      input.checked = currentProtection.categories[input.dataset.category] === true;
    }
    renderDomainList(denyList, currentProtection.denylist, 'deny');
    renderDomainList(allowList, currentProtection.allowlist, 'allow');
    recreationEnabled.checked = currentProtection.recreation.enabled;
    recreationStart.value = currentProtection.recreation.start;
    recreationEnd.value = currentProtection.recreation.end;
    for (const input of protectionForm.querySelectorAll('[data-recreation-day]')) {
      input.checked = currentProtection.recreation.days.includes(Number(input.dataset.recreationDay));
    }
    safeSearch.checked = currentProtection.safeSearch;
    youtubeRestricted.checked = currentProtection.youtubeRestricted;
    blockBypass.checked = currentProtection.blockBypass;
    const state = summary || Protection.summary(currentProtection, ProtectionCatalog, new Date());
    protectionBadge.textContent = currentProtection.enabled
      ? t(state.recreationActive ? 'protectionPaused' : 'protectionOn')
      : t('protectionOff');
    protectionBadge.className = `state-pill${currentProtection.enabled ? ' on' : ''}`;
    protectionBadge.title = currentProtection.enabled ? t('protectionCount', { count: state.blockedDomains }) : '';
    protectionDirty = false;
  }

  function readProtectionForm() {
    const days = [...protectionForm.querySelectorAll('[data-recreation-day]:checked')]
      .map((input) => Number(input.dataset.recreationDay));
    const categories = {};
    for (const input of protectionForm.querySelectorAll('[data-category]')) categories[input.dataset.category] = input.checked;
    return Protection.normalizeSettings({
      ...currentProtection,
      enabled: protectionEnabled.checked,
      categories,
      recreation: {
        enabled: recreationEnabled.checked,
        days,
        start: recreationStart.value,
        end: recreationEnd.value,
      },
      safeSearch: safeSearch.checked,
      youtubeRestricted: youtubeRestricted.checked,
      blockBypass: blockBypass.checked,
    });
  }

  function addDomain(kind) {
    const input = kind === 'deny' ? denyInput : allowInput;
    const domain = Protection.normalizeDomain(input.value);
    if (!domain) { setProtectionStatus(t('invalidDomain'), 'error'); input.focus(); return; }
    const next = readProtectionForm();
    const ownList = kind === 'deny' ? next.denylist : next.allowlist;
    const otherList = kind === 'deny' ? next.allowlist : next.denylist;
    if (!ownList.includes(domain)) ownList.push(domain);
    const filteredOther = otherList.filter((item) => item !== domain);
    currentProtection = Protection.normalizeSettings({
      ...next,
      denylist: kind === 'deny' ? ownList : filteredOther,
      allowlist: kind === 'allow' ? ownList : filteredOther,
    });
    renderDomainList(denyList, currentProtection.denylist, 'deny');
    renderDomainList(allowList, currentProtection.allowlist, 'allow');
    input.value = '';
    protectionDirty = true;
    setProtectionStatus('');
  }

  for (const key of Protection.CATEGORY_KEYS) {
    const count = document.querySelector(`#category-count-${key}`);
    if (count) count.textContent = t('domainCount', { count: ProtectionCatalog[key].length });
  }

  async function render(focusPolicyId = '') {
    const result = await send({ type: 'GET_OPTIONS' });
    if (!result || result.ok !== true) {
      setStatus(errorText(result && result.error), 'error', result && result.error === 'runtime_unavailable');
      return;
    }
    currentState = result.state;
    if (!protectionDirty) renderProtection(result.protection, result.protectionSummary);
    siteList.replaceChildren();
    noSites.hidden = currentState.policies.length > 0;
    for (const policy of currentState.policies) {
      const item = document.createElement('article');
      item.className = 'site-item';
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = policy.label;
      const meta = document.createElement('div');
      meta.className = 'site-meta';
      meta.textContent = t('policySummary', { count: policy.purposes.length, minutes: policy.dailyBudgetMinutes, sessions: policy.maxSessionsPerDay });
      const purposes = document.createElement('div');
      purposes.className = 'scenario-pills';
      for (const rule of policy.purposes) {
        const pill = document.createElement('span');
        pill.textContent = `${purposeName(rule.purpose)} · ${rule.defaultMinutes}`;
        purposes.append(pill);
      }
      copy.append(title, meta, purposes);
      if (result.permissions[policy.id] !== true) {
        const missing = document.createElement('div');
        missing.className = 'status error';
        missing.textContent = t('permissionMissing');
        copy.append(missing);
      }
      const pending = pendingFor(policy.id);
      if (pending) {
        const pendingRow = document.createElement('div');
        pendingRow.className = 'pending-row';
        const text = document.createElement('span');
        text.textContent = t('pendingTomorrow');
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'quiet';
        cancel.dataset.cancelPolicyId = policy.id;
        cancel.textContent = t('cancelPending');
        pendingRow.append(text, cancel);
        copy.append(pendingRow);
      }
      const controls = document.createElement('div');
      controls.className = 'site-controls';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.dataset.editPolicyId = policy.id;
      edit.textContent = t('editScenarios');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = policy.enabled ? t('pause') : t('turnOn');
      toggle.dataset.policyId = policy.id;
      toggle.dataset.enabled = String(!policy.enabled);
      const locked = currentState.activeSession && currentState.activeSession.policyId === policy.id && currentState.activeSession.mode === 'control';
      edit.disabled = !!locked;
      toggle.disabled = !!locked;
      if (locked) edit.title = toggle.title = t('controlLocked');
      controls.append(edit, toggle);
      item.append(copy, controls);
      siteList.append(item);
    }
    if (focusPolicyId) {
      const target = siteList.querySelector(`[data-edit-policy-id="${focusPolicyId}"], [data-policy-id="${focusPolicyId}"]`);
      if (target) target.focus({ preventScroll: true });
    }
  }

  protectionForm.addEventListener('change', () => { protectionDirty = true; setProtectionStatus(''); });
  document.querySelector('#add-deny').addEventListener('click', () => addDomain('deny'));
  document.querySelector('#add-allow').addEventListener('click', () => addDomain('allow'));
  denyInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addDomain('deny'); } });
  allowInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addDomain('allow'); } });
  for (const container of [denyList, allowList]) {
    container.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-remove-domain]');
      if (!button) return;
      const next = readProtectionForm();
      const key = button.dataset.listKind === 'allow' ? 'allowlist' : 'denylist';
      currentProtection = Protection.normalizeSettings({
        ...next,
        [key]: next[key].filter((domain) => domain !== button.dataset.removeDomain),
      });
      renderDomainList(denyList, currentProtection.denylist, 'deny');
      renderDomainList(allowList, currentProtection.allowlist, 'allow');
      protectionDirty = true;
    });
  }

  protectionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (actionBusy) return;
    actionBusy = true;
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    setProtectionStatus('');
    try {
      const selectedRecreationDays = protectionForm.querySelectorAll('[data-recreation-day]:checked').length;
      if (protectionEnabled.checked && recreationEnabled.checked && !selectedRecreationDays) {
        setProtectionStatus(t('chooseRecreationDay'), 'error'); return;
      }
      const settings = readProtectionForm();
      if (settings.enabled) {
        let granted = false;
        try { granted = await chrome.permissions.request({ origins: ['http://*/*', 'https://*/*'] }); }
        catch (error) {
          if (!recoverStaleOptions(error && error.message)) setStatus(errorText('runtime_unavailable'), 'error', true);
          return;
        }
        if (!granted) { setProtectionStatus(t('protectionPermissionDenied'), 'error'); return; }
      }
      const result = await send({ type: 'SAVE_PROTECTION', settings });
      if (!result?.ok) {
        setProtectionStatus(errorText(result && result.error), 'error'); return;
      }
      renderProtection(result.settings, result.summary);
      setProtectionStatus(t('protectionSaved', { count: result.summary.blockedDomains }), 'success');
    } finally {
      actionBusy = false;
      if (submit) submit.disabled = false;
    }
  });

  runtimeReload.addEventListener('click', () => location.reload());

  siteSelect.addEventListener('change', () => { editingPolicyId = ''; loadDraft(); });

  siteList.addEventListener('click', async (event) => {
    const edit = event.target.closest('button[data-edit-policy-id]');
    if (edit) {
      const policy = Core.policyById(currentState, edit.dataset.editPolicyId);
      if (policy) { loadDraft(policy); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    const cancel = event.target.closest('button[data-cancel-policy-id]');
    if (cancel && !actionBusy) {
      actionBusy = true;
      const result = await send({ type: 'CANCEL_PENDING_POLICY', policyId: cancel.dataset.cancelPolicyId });
      setStatus(result?.ok ? t('pendingCancelled') : errorText(result && result.error), result?.ok ? 'success' : 'error');
      await render(cancel.dataset.cancelPolicyId);
      actionBusy = false;
      return;
    }
    const button = event.target.closest('button[data-policy-id]');
    if (!button || actionBusy) return;
    actionBusy = true;
    button.disabled = true;
    const result = await send({ type: 'TOGGLE_POLICY', policyId: button.dataset.policyId, enabled: button.dataset.enabled === 'true' });
    if (!result || result.ok !== true) setStatus(errorText(result && result.error), 'error', result && result.error === 'runtime_unavailable');
    else setStatus(result.pending ? t('changeTomorrow') : t('saveSuccess'), 'success');
    await render(button.dataset.policyId);
    actionBusy = false;
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
      const hostname = Core.normalizeHostname(preset.hostname || domainInput.value);
      if (!hostname) { setStatus(t('saveFailed'), 'error'); domainInput.focus(); return; }
      const purposes = [];
      for (const item of scenarioList.querySelectorAll('.scenario-item')) {
        if (!item.querySelector('[data-role="enabled"]').checked) continue;
        const purpose = item.dataset.purpose;
        const defaults = scenarioDefaults[purpose];
        const mode = item.querySelector('[data-role="mode"]').value;
        const minutes = Number(item.querySelector('[data-role="minutes"]').value);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > Core.MAX_MINUTES) {
          setStatus(t('error_duration_invalid'), 'error'); item.querySelector('[data-role="minutes"]').focus(); return;
        }
        const extensionsAllowed = mode === 'control' ? 0 : 1;
        const extensionMinutes = Math.min(5, minutes);
        purposes.push({ purpose, mode, defaultMinutes: minutes,
          maxMinutes: Math.min(Core.MAX_MINUTES, minutes + extensionsAllowed * extensionMinutes),
          extensionsAllowed, extensionMinutes, expectedOutcome: t(defaults.outcomeKey),
          requiresTopic: defaults.topic === true, requiresDetail: defaults.detail === true });
      }
      if (!purposes.length) { setStatus(t('error_scenario_required'), 'error'); return; }
      const dailyBudgetMinutes = Number(dailyBudgetInput.value);
      const maxSessionsPerDay = Number(dailySessionsInput.value);
      const cooldownMinutes = Number(cooldownInput.value);
      if (!Number.isInteger(dailyBudgetMinutes) || dailyBudgetMinutes < 1 || dailyBudgetMinutes > Core.MAX_DAILY_BUDGET_MINUTES
        || !Number.isInteger(maxSessionsPerDay) || maxSessionsPerDay < 1 || maxSessionsPerDay > Core.MAX_SESSIONS_PER_DAY
        || !Number.isInteger(cooldownMinutes) || cooldownMinutes < 0 || cooldownMinutes > Core.MAX_COOLDOWN_MINUTES) {
        setStatus(t('error_daily_limits_invalid'), 'error'); return;
      }
      const origins = Core.hostPatterns(hostname);
      let granted = false;
      try { granted = await chrome.permissions.request({ origins }); }
      catch { setStatus(errorText('runtime_unavailable'), 'error', true); return; }
      if (!granted) { setStatus(t('permissionDenied'), 'error'); return; }
      const existing = editingPolicyId ? Core.policyById(currentState, editingPolicyId) : null;
      const policy = {
        id: existing?.id || Core.policyIdForHost(hostname), label: existing?.label || preset.label || hostname,
        hostname, appKey: existing?.appKey || preset.appKey, enabled: existing?.enabled !== false,
        dailyBudgetMinutes, maxSessionsPerDay, cooldownMinutes, purposes,
        emergency: existing?.emergency || { passes: Core.EMERGENCY_PASSES, perDays: Core.EMERGENCY_WINDOW_DAYS,
          delaySeconds: Core.EMERGENCY_DELAY_SECONDS, accessMinutes: Core.EMERGENCY_MINUTES },
      };
      const result = await send({ type: 'SAVE_POLICY', policy, replacePurposes: true });
      if (!result || result.ok !== true) {
        setStatus(errorText(result && result.error), 'error', result && result.error === 'runtime_unavailable'); return;
      }
      setStatus(result.pending ? t('changeTomorrow') : t('saveSuccess'), 'success');
      editingPolicyId = policy.id;
      await render(policy.id);
    } finally {
      actionBusy = false;
      if (submit) submit.disabled = false;
    }
  });

  loadDraft();
  connectRuntime();
  render().catch(() => setStatus(errorText('runtime_unavailable'), 'error', true)).finally(() => { booting = false; });
})();
