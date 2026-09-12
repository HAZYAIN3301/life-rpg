(async function boundaryTestReceipt() {
  'use strict';
  try {
    const receipt = await chrome.runtime.sendMessage({ type: 'CONFIRM_BOUNDARY_TEST' });
    if (!receipt?.ok || receipt.confirmed !== true) return;
    const I18n = globalThis.SatoruAttentionI18n;
    const t = key => I18n.translate(I18n.detect(), key);
    const notice = document.createElement('aside');
    notice.id = 'boundary-test-receipt';
    notice.className = 'notice'; notice.setAttribute('role', 'status');
    const title = document.createElement('b'); title.textContent = t('test_passed');
    const detail = document.createElement('p'); detail.textContent = t('testReceiptLead');
    const link = document.createElement('a'); link.className = 'button quiet'; link.href = 'https://life-rpg-production-416a.up.railway.app/browser-companion.html#connect'; link.textContent = t('testReturn');
    notice.append(title, detail, link);
    document.querySelector('main').prepend(notice);
  } catch { /* No receipt means no success claim. The options page offers a retry. */ }
})();
