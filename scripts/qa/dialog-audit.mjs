import { BASE, HOST, ACCOUNTS, accountFile, launch } from './qa-lib.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const fs = require('fs');
const [,, acct = 'dense-en', width = '375', theme = 'dark', only = ''] = process.argv;
const info = JSON.parse(fs.readFileSync(accountFile(acct), 'utf8')); const [cname, ...rest] = info.cookie.split('=');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, hasTouch: Number(width) < 700 });
await ctx.addCookies([{ name: cname, value: rest.join('='), domain: HOST, path: '/' }]);
await ctx.route('**/api/ai/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await ctx.route('**/api/commitments/commit', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"qa"}' }));
await ctx.route('**/api/account/**', (r) => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"qa"}' }));
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof State !== 'undefined' && State.settings?.skills && document.querySelector('#main')?.children.length, null, { timeout: 20000 });
await page.waitForTimeout(500);
const OPENERS = {
  'cal-sub-ov': 'showCalSubscribeModal()',
  'cat-pop': 'openCategoryPicker(State.tasks.find((t) => !t.done)?.id)',
  'economy-confirm-modal': "showEconomyConfirm('reward', (State.rewards || [])[0]?.id)",
  'entry-modal': 'openEntryRitual()',
  'focus-dur-modal': 'openFocusDurationPicker(State.tasks.find((t) => !t.done)?.id)',
  'loot-modal': 'openChest()',
  'ms-claim': "(() => { const sid = Object.keys(State.tree || {})[0]; const n = (State.tree[sid]?.nodes || []).find((x) => x.milestone && !x.unlocked); return n && openMilestoneClaim(sid, n.id); })()",
  'paywall': "showPaywall('ai')",
  'recovery-modal': "showRecoveryModal('SYNTHETIC-CODE-0000')",
  'rw-catalog': 'openRewardCatalog()',
  'sphguide-modal': "openSphereGuide((State.settings.skills[0] || {}).name || '')",
  'account-profile-modal': 'openAccountProfile ? openAccountProfile() : null',
  'account-reset-modal': 'showResetDataDialog()',
  'attention-dialog-overlay': "openEveningLanding()",
  'avatar-forge-overlay': 'openAvatarForgeEditor()',
  'cal-task-modal': 'openCalendarTaskEditor(State.tasks.find((t) => !t.done)?.id)',
  'desire-pop': 'openDesirePicker(State.tasks.find((t) => !t.done)?.id)',
  'goal-delete-dialog': "openGoalDeleteDialog([(State.goals || [])[0]?.id].filter(Boolean), null)",
  'goal-detail-dialog': 'openGoalDetailDialog((State.goals || [])[0]?.id)',
  'goal-group-dialog': 'openGoalGroupDialog()',
  'habit-edit-modal': 'openHabitEditDialog((State.habits || [])[0]?.id, null)',
  'logout-all-modal': 'showLogoutAllDialog()',
  'mobile-nav-sheet': 'showMobileNavSheet()',
  'note-delete-dialog': 'openNoteDeleteDialog((State.inbox || [])[0]?.id, null)',
  'path-choice-modal': 'showPathChoiceModal()',
  'quest-commitment-modal': "openQuestCommitmentDialog(State.tasks.find((t) => !t.done))",
  'social-party-dialog': "(State.party = State.party || { id: 'qa-party', name: 'Synthetic tribe', code: 'QA-CODE', members: [], permissions: { role: 'member' } }, showPartyExitDialog('leave'))",
  'task-actual-modal': 'openTaskActualDialog(State.tasks.find((t) => t.done)?.id)',
  'del-account-modal': 'showDeleteAccountModal()',
  'voucher-ov': "(ensureLootbox().vouchers = [RARITY_ORDER[2] || RARITY_ORDER[1]], showVoucherReward())",
};
const R = {};
for (const [id, code] of Object.entries(OPENERS)) {
  if (only && !only.split(',').includes(id)) continue;
  await page.evaluate(() => { document.querySelectorAll('.modal-overlay, [role="dialog"]').forEach((o) => o.closest('.modal-overlay, [id$="-overlay"], [id$="-dialog"], [id$="-modal"], [id$="-ov"]')?.remove()); document.getElementById('app')?.removeAttribute('inert'); State.view = 'today'; render(); });
  const btn = await page.evaluate(() => { const b = document.createElement('button'); b.id = 'qa-opener'; b.textContent = 'open'; document.querySelector('#main').prepend(b); b.focus(); return true; });
  let opened;
  try { opened = await page.evaluate((code) => { try { eval(code); return true; } catch (e) { return String(e).slice(0, 120); } }, code); } catch (e) { opened = String(e).slice(0, 120); }
  await page.waitForTimeout(450);
  const res = await page.evaluate((id) => {
    const root = document.getElementById(id); if (!root) return { missing: true };
    const vis = (n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const dlg = root.matches('[role="dialog"],[role="alertdialog"]') ? root : root.querySelector('[role="dialog"],[role="alertdialog"]');
    const labelled = !!dlg && (!!dlg.getAttribute('aria-labelledby') && !!document.getElementById(dlg.getAttribute('aria-labelledby')) || !!dlg.getAttribute('aria-label'));
    const close = root.querySelector('.modal-x, [data-action$="close"], [aria-label="Close"], [aria-label="Закрыть"]');
    const EM = /\p{Extended_Pictographic}/u; const nonRu = !['ru', 'uk'].includes(document.documentElement.lang);
    const emoji = [], cyr = [];
    const wk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = wk.nextNode());) { const v = n.nodeValue; const el = n.parentElement; if (!v || !v.trim() || !el || !vis(el) || el.closest('[data-noi18n], textarea')) continue; if (EM.test(v) && el.closest('button, a, h1, h2, h3, h4, summary, label, [role="tab"]')) emoji.push(v.trim().slice(0, 36)); if (nonRu && /[А-Яа-яЁёІіЇїЄєҐґ]/.test(v)) cyr.push(v.trim().slice(0, 46)); }
    const attrs = nonRu ? [...root.querySelectorAll('[placeholder],[aria-label],[title]')].filter((e) => !e.closest('[data-noi18n]')).flatMap((e) => ['placeholder', 'aria-label', 'title'].map((a) => e.getAttribute(a)).filter((v) => v && /[А-Яа-яЁё]/.test(v))) : [];
    const tiny = [...root.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12 && !el.closest('svg,[aria-hidden="true"]')).map((el) => `${getComputedStyle(el).fontSize} ${String(el.className).slice(0, 16)}:${el.textContent.trim().slice(0, 18)}`);
    const small = [...root.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]), select, summary, textarea')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); if (r.width >= 42 && r.height >= 42) return false; if ((b.type === 'radio' || b.type === 'checkbox' || b.type === 'range') && b.closest('label') && b.closest('label').getBoundingClientRect().height >= 42) return false; return true; }).map((b) => `${String(b.dataset.action || b.type || b.className || b.tagName).slice(0, 22)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
    const focusInside = root.contains(document.activeElement);
    return { dialog: !!dlg, labelled, closeLabel: close ? (close.getAttribute('aria-label') || close.textContent.trim()).slice(0, 20) : null, focusInside, emoji: [...new Set(emoji)].slice(0, 8), cyr: [...new Set(cyr)].slice(0, 6), attrs: [...new Set(attrs)].slice(0, 4), tiny: [...new Set(tiny)].slice(0, 6), small: [...new Set(small)].slice(0, 8) };
  }, id);
  if (!res.missing) {
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    res.escape = !(await page.evaluate((id) => { const r = document.getElementById(id); return !!r && r.getBoundingClientRect().height > 0; }, id));
    res.focusBack = await page.evaluate(() => document.activeElement?.id === 'qa-opener');
  }
  R[id] = { opened, ...res };
}
for (const [id, r] of Object.entries(R)) {
  if (r.missing) { console.log(`${id}: NOT OPENED (${r.opened})`); continue; }
  const issues = [];
  if (!r.dialog) issues.push('no-dialog-role'); else if (!r.labelled) issues.push('unlabelled');
  if (r.closeLabel === null) issues.push('no-close'); if (!r.focusInside) issues.push('focus-outside'); if (!r.escape) issues.push('esc-no-close'); else if (!r.focusBack) issues.push('focus-not-returned');
  for (const k of ['emoji', 'cyr', 'attrs', 'tiny', 'small']) if (r[k].length) issues.push(`${k}=${JSON.stringify(r[k])}`);
  console.log(`${id}: ${issues.length ? issues.join(' | ') : 'clean'}`);
}
console.log('errors', errors.length, JSON.stringify(errors.slice(0, 4)));
await browser.close();
