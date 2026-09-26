(function protectionBlockPage() {
  'use strict';
  const I18n = globalThis.SatoruAttentionI18n;
  const language = I18n.detect();
  const t = (key, values) => I18n.translate(language, key, values);
  const title = document.querySelector('#block-title');
  const status = document.querySelector('#block-schedule');
  const options = document.querySelector('#open-options');
  I18n.localizeDocument(language);
  // 0.8.0: the Reddit guard says why only this part of Reddit is closed.
  const reason = new URLSearchParams(location.search).get('reason');
  const reasonLine = document.querySelector('#block-reason');
  if (reason === 'reddit' && reasonLine) { reasonLine.textContent = t('blockedRedditNsfw'); reasonLine.hidden = false; }
  title.focus({ preventScroll: true });

  chrome.runtime.sendMessage({ type: 'GET_OPTIONS' }).then((result) => {
    if (!result?.ok || !result.protectionSummary?.nextBoundaryAt) return;
    const date = new Date(result.protectionSummary.nextBoundaryAt);
    if (!Number.isNaN(date.getTime())) status.textContent = t('nextProtectionChange', { time: date.toLocaleString(language) });
  }).catch(() => { status.textContent = t('protectionStillApplied'); });

  options.addEventListener('click', async () => {
    options.disabled = true;
    try { await chrome.runtime.openOptionsPage(); }
    catch { status.textContent = t('protectionStillApplied'); }
    options.disabled = false;
  });
})();
