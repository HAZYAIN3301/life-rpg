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

  // 0.9.0 motivation: a daily attempt counter (no address is stored), Shadow's line for that
  // attempt, one practical tip and the person's own reasons from the options page.
  const ATTEMPTS_KEY = 'satoruBlockAttemptsV1';
  const MOTIVATION_KEY = 'satoruMotivationV1';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const motivation = document.querySelector('#block-motivation');
  const tip = document.querySelector('#block-tip');
  tip.textContent = t(`blockTip${1 + Math.floor(Math.random() * 4)}`);
  chrome.storage.local.get([ATTEMPTS_KEY, MOTIVATION_KEY]).then(async (stored) => {
    const previous = stored[ATTEMPTS_KEY];
    const count = previous && previous.day === today ? Math.min(999, Number(previous.count) + 1 || 1) : 1;
    await chrome.storage.local.set({ [ATTEMPTS_KEY]: { day: today, count } }).catch(() => undefined);
    motivation.textContent = count <= 3 ? t(`blockAttempt${count}`) : t('blockAttemptN', { count });
    const reasons = Array.isArray(stored[MOTIVATION_KEY]?.reasons) ? stored[MOTIVATION_KEY].reasons.slice(0, 5) : [];
    if (reasons.length) {
      const list = document.querySelector('#block-reasons-list');
      for (const reason of reasons) { const item = document.createElement('li'); item.textContent = String(reason).slice(0, 120); list.append(item); }
      document.querySelector('#block-reasons').hidden = false;
    }
  }).catch(() => { motivation.textContent = t('blockAttempt1'); });

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
