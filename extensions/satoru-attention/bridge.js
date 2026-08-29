(function bridgeSatoruAttention() {
  'use strict';

  const ORIGIN = 'https://life-rpg-production-416a.up.railway.app';
  const SOURCE_APP = 'satoru-app';
  const SOURCE_EXTENSION = 'satoru-attention-extension';
  const version = chrome.runtime.getManifest().version;

  if (location.origin !== ORIGIN) return;

  function validRequestId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[a-z0-9._:-]+$/i.test(value);
  }

  function post(payload) {
    window.postMessage({ source: SOURCE_EXTENSION, ...payload }, ORIGIN);
  }

  post({ type: 'SATORU_ATTENTION_EXTENSION_READY', version });

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== ORIGIN) return;
    const data = event.data;
    if (!data || data.source !== SOURCE_APP || !validRequestId(data.requestId)) return;

    if (data.type === 'SATORU_ATTENTION_STATUS_REQUEST') {
      try {
        const result = await chrome.runtime.sendMessage({ type: 'BRIDGE_STATUS' });
        if (result && result.ok === true) {
          post({ type: 'SATORU_ATTENTION_STATUS_RESPONSE', requestId: data.requestId, status: result.status });
        }
      } catch { /* Extension reload: the next page load announces again. */ }
      return;
    }

    if (data.type === 'SATORU_ATTENTION_OPEN_OPTIONS') {
      let ok = false;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
        ok = !!(result && result.ok === true);
      } catch { /* Report the failed request without exposing an internal error. */ }
      post({ type: 'SATORU_ATTENTION_OPEN_OPTIONS_RESULT', requestId: data.requestId, ok });
    }
  });
})();
