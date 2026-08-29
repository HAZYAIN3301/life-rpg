(function guardConfiguredSite() {
  'use strict';

  const CHECK_INTERVAL_MS = 15_000;
  let failures = 0;
  let timer = null;
  let checking = false;

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(check, Math.max(250, delay));
  }

  async function check() {
    if (checking) return;
    checking = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_ACCESS', url: location.href });
      failures = 0;
      if (!response || response.ok !== true || response.allowed !== true) {
        const target = response && response.gateUrl ? response.gateUrl : chrome.runtime.getURL('gate.html');
        location.replace(target);
        return;
      }
      const remaining = Number(response.remainingMs);
      const delay = Number.isFinite(remaining) ? Math.min(CHECK_INTERVAL_MS, Math.max(500, remaining + 25)) : CHECK_INTERVAL_MS;
      schedule(delay);
    } catch {
      failures += 1;
      if (failures >= 3) {
        location.replace(chrome.runtime.getURL('gate.html'));
        return;
      }
      schedule(500);
    } finally {
      checking = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('pageshow', check);
  check();
})();
