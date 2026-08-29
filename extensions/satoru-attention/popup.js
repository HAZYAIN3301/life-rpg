(function popupPage() {
  'use strict';

  const I18n = globalThis.SatoruAttentionI18n;
  const language = I18n.detect();
  const t = (key, values) => I18n.translate(language, key, values);
  const active = document.querySelector('#popup-active');
  const count = document.querySelector('#popup-count');
  const gate = document.querySelector('#popup-gate');
  let firstPolicyId = null;
  let timer = null;

  I18n.localizeDocument(language);

  function formatTime(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }

  async function render() {
    clearInterval(timer);
    const result = await chrome.runtime.sendMessage({ type: 'GET_OPTIONS' });
    if (!result || !result.ok) {
      active.textContent = t('genericError');
      gate.disabled = true;
      return;
    }
    const state = result.state;
    const enabled = state.policies.filter((policy) => policy.enabled);
    firstPolicyId = (state.activeSession && state.activeSession.policyId) || (enabled[0] && enabled[0].id);
    gate.disabled = !firstPolicyId;
    count.textContent = t('configuredCount', { count: enabled.length });
    if (!state.activeSession) {
      active.textContent = t('noActive');
      return;
    }
    const update = () => {
      const remaining = Date.parse(state.activeSession.deadlineAt) - Date.now();
      active.textContent = remaining > 0
        ? t('activeUntil', { app: state.activeSession.appKey, time: formatTime(remaining) })
        : t('boundaryNow', { app: state.activeSession.appKey });
    };
    update();
    timer = setInterval(update, 1000);
  }

  gate.addEventListener('click', async () => {
    if (firstPolicyId) await chrome.runtime.sendMessage({ type: 'OPEN_GATE', policyId: firstPolicyId });
    window.close();
  });
  document.querySelector('#popup-settings').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    window.close();
  });

  render().catch(() => { active.textContent = t('genericError'); });
})();
