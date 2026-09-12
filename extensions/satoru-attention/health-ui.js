(function healthPanel() {
  'use strict';
  const I18n = globalThis.SatoruAttentionI18n;
  const language = I18n.detect();
  const t = (key, values) => I18n.translate(language, key, values);
  const panel = document.querySelector('#boundary-check');
  const summary = panel.querySelector('#health-status');
  const signal = panel.querySelector('#health-signal');
  const result = panel.querySelector('#boundary-result');
  const select = panel.querySelector('#boundary-site');
  const start = panel.querySelector('#boundary-start');
  const refresh = panel.querySelector('#health-refresh');
  let snapshot = null;
  let poll = null;
  let busy = false;
  let receivedAt = 0;
  let actionError = '';
  function render() {
    const age = Math.max(0, Math.floor((Date.now() - receivedAt) / 1000));
    const stale = !snapshot || Date.now() < receivedAt || age > 90;
    const summaryText = t(stale ? 'health_unknown' : `health_${snapshot.enforcement.state}`);
    if (summary.textContent !== summaryText) summary.textContent = summaryText;
    signal.textContent = snapshot ? t('healthAge', { seconds: age }) : t('healthNoSignal');
    const test = snapshot?.selfTest;
    const testText = actionError || (test ? t(`test_${test.state}`) : t('test_never')) + (test?.checkedAt ? ` · ${new Date(test.checkedAt).toLocaleString(language)}` : '');
    if (result.textContent !== testText) result.textContent = testText;
    start.disabled = busy || !select.value || stale || snapshot?.enforcement.state !== 'active' || test?.state === 'pending';
  }
  async function check() {
    clearTimeout(poll);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_HEALTH' });
      if (!response?.ok || !response.status?.enforcement) throw new Error('unavailable');
      snapshot = response.status;
      receivedAt = Date.now();
      if (snapshot.selfTest.state === 'pending' && !document.hidden) poll = setTimeout(check, 1200);
    } catch { snapshot = null; }
    render();
  }
  async function sites() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_OPTIONS' });
      if (!response?.ok) return;
      const previous = select.value;
      select.replaceChildren();
      for (const policy of response.state.policies.filter(item => item.enabled)) {
        const option = document.createElement('option');
        option.value = policy.id;
        option.textContent = `${policy.label} · ${policy.hostname}`;
        select.append(option);
      }
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
      if (!select.options.length) {
        const option = document.createElement('option'); option.value = ''; option.textContent = t('test_site_required'); select.append(option);
      }
    } catch { /* The health read reports loss of the runtime separately. */ }
    await check();
  }
  start.addEventListener('click', async () => {
    if (busy || start.disabled) return;
    busy = true; actionError = ''; render();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_BOUNDARY_TEST', policyId: select.value });
      await check();
      if (!response?.ok) {
        const key = `error_${response?.error || 'test_failed'}`;
        actionError = t(key) === key ? t('error_test_failed') : t(key);
      }
    } catch { snapshot = null; actionError = t('error_test_failed'); }
    finally { busy = false; render(); }
  });
  refresh.addEventListener('click', () => { actionError = ''; sites(); });
  select.addEventListener('change', render);
  window.addEventListener('focus', sites);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(poll); else sites(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ['satoruAttentionStateV1', 'satoruProtectionStateV1', 'satoruBoundaryTestV1'].some(key => changes[key])) sites();
  });
  setInterval(() => { if (!document.hidden) render(); }, 15_000);
  sites();
})();
