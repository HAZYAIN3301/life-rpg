'use strict';

importScripts('core.js', 'protection.js', 'protection-catalog.js');

const Core = self.SatoruAttentionCore;
const Protection = self.SatoruProtection;
const ProtectionCatalog = self.SatoruProtectionCatalog;
const STATE_KEY = 'satoruAttentionStateV1';
const PROTECTION_KEY = 'satoruProtectionStateV1';
const BOUNDARY_ALARM = 'satoru-attention-boundary';
const RECOVERY_ALARM = 'satoru-attention-recovery';
const PROTECTION_ALARM = 'satoru-protection-schedule';
const SITE_SCRIPT_PREFIX = 'satoru-site-';
const RULE_BASE = 20_000;
const CLOCK_OBSERVE_INTERVAL_MS = 30_000;
const EXTENSION_ROOT = chrome.runtime.getURL('');
const attemptsByTab = new Map(); // Ephemeral only: never persisted or synced.
let mutationQueue = Promise.resolve();

function currentIso() { return new Date().toISOString(); }
function extensionSender(sender) {
  if (!sender) return false;
  const candidateUrls = [sender.url, sender.documentUrl, sender.tab && sender.tab.url];
  const extensionUrl = candidateUrls.some((url) => typeof url === 'string' && url.startsWith(EXTENSION_ROOT));
  const extensionOrigin = typeof sender.origin === 'string' && `${sender.origin}/` === EXTENSION_ROOT;
  // Brave can move an extension-page URL from `sender.url` to `sender.tab.url`.
  // Requiring both our extension ID and our extension URL keeps site content scripts out.
  return sender.id === chrome.runtime.id && (extensionUrl || extensionOrigin);
}
function bridgeSender(sender) {
  return !!(sender && typeof sender.url === 'string'
    && (sender.url === Core.SATORU_ORIGIN || sender.url.startsWith(`${Core.SATORU_ORIGIN}/`)));
}

async function loadState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  const normalized = Core.normalizeState(stored[STATE_KEY]);
  const activated = Core.activatePendingPolicies(normalized, currentIso());
  if (activated.changed) {
    await chrome.storage.local.set({ [STATE_KEY]: activated.state });
    await reconcileEnforcement(activated.state);
  }
  return activated.state;
}

async function saveState(state) {
  const normalized = Core.normalizeState(state);
  await chrome.storage.local.set({ [STATE_KEY]: normalized });
  return normalized;
}

async function loadProtection() {
  const stored = await chrome.storage.local.get(PROTECTION_KEY);
  return Protection.normalizeSettings(stored[PROTECTION_KEY]);
}

async function saveProtection(settings) {
  const normalized = Protection.normalizeSettings(settings);
  await chrome.storage.local.set({ [PROTECTION_KEY]: normalized });
  return normalized;
}

async function scheduleRecovery() {
  try { await chrome.alarms.create(RECOVERY_ALARM, { when: Date.now() + 1_000 }); }
  catch { /* The next extension event also reconciles from local state. */ }
}

async function observeClockState(at) {
  const state = await loadState();
  if (Core.clockRolledBack(state, at)) return state;
  const last = state.lastSeenAt ? Date.parse(state.lastSeenAt) : 0;
  if (!last || Date.parse(at) - last >= CLOCK_OBSERVE_INTERVAL_MS) return saveState(Core.touchClock(state, at));
  return state;
}

function serialized(work) {
  const run = mutationQueue.then(work, work);
  mutationQueue = run.catch(() => undefined);
  return run;
}

async function permissionFor(policy) {
  if (!policy) return false;
  try { return await chrome.permissions.contains({ origins: Core.hostPatterns(policy.hostname) }); }
  catch { return false; }
}

function gateUrl(policyId) {
  const id = typeof policyId === 'string' && /^[a-z0-9_-]{1,48}$/i.test(policyId) ? policyId : '';
  return chrome.runtime.getURL(`gate.html${id ? `?site=${encodeURIComponent(id)}` : ''}`);
}

function protectionUrl() {
  return chrome.runtime.getURL('block.html');
}

async function broadProtectionPermission() {
  try {
    return await chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] });
  } catch { return false; }
}

function localDayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextLocalMidnightIso() {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next.toISOString();
}

function exactHostRegex(hostname) {
  const escaped = String(hostname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^https?://${escaped}(?::[0-9]+)?(?:/|$)`;
}

async function reconcileRules(state, protectionSettings, at) {
  const policies = state.policies.filter((policy) => policy.enabled).sort((a, b) => a.id.localeCompare(b.id));
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  const active = state.activeSession;
  const activeOpen = !!(active && !Core.clockRolledBack(state, at) && Date.parse(active.deadlineAt) > Date.parse(at));
  const addRules = [];
  for (let index = 0; index < policies.length; index += 1) {
    const policy = policies[index];
    if (activeOpen && active.policyId === policy.id) continue;
    if (!(await permissionFor(policy))) continue;
    addRules.push({
      id: RULE_BASE + index,
      priority: 1,
      action: { type: 'redirect', redirect: { url: gateUrl(policy.id) } },
      condition: {
        regexFilter: exactHostRegex(policy.hostname),
        isUrlFilterCaseSensitive: false,
        resourceTypes: ['main_frame'],
      },
    });
  }
  const canRedirect = await broadProtectionPermission();
  addRules.push(...Protection.buildRules(protectionSettings, ProtectionCatalog, new Date(at), {
    baseId: 30_000,
    blockUrl: canRedirect ? protectionUrl() : '',
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function reconcileContentScripts(state) {
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const ours = registered.map((script) => script.id).filter((id) => id.startsWith(SITE_SCRIPT_PREFIX));
  if (ours.length) await chrome.scripting.unregisterContentScripts({ ids: ours });
  const scripts = [];
  for (const policy of state.policies.filter((item) => item.enabled)) {
    if (!(await permissionFor(policy))) continue;
    scripts.push({
      id: `${SITE_SCRIPT_PREFIX}${policy.id}`,
      matches: Core.hostPatterns(policy.hostname),
      js: ['site-guard.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
      allFrames: false,
    });
  }
  if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
}

async function scheduleBoundary(state, at) {
  await chrome.alarms.clear(BOUNDARY_ALARM);
  const session = state.activeSession;
  if (!session) return;
  const when = Date.parse(session.deadlineAt);
  if (Number.isFinite(when) && when > Date.parse(at)) await chrome.alarms.create(BOUNDARY_ALARM, { when });
}

async function scheduleProtectionBoundary(settings) {
  await chrome.alarms.clear(PROTECTION_ALARM);
  const next = Protection.nextScheduleBoundary(settings, new Date());
  const when = next ? Date.parse(next) : NaN;
  if (Number.isFinite(when) && when > Date.now()) await chrome.alarms.create(PROTECTION_ALARM, { when });
}

async function redirectDeniedTabs(state, protectionSettings, at) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id || typeof tab.url !== 'string' || !/^https?:/.test(tab.url)) return;
    const protectionDecision = Protection.decision(protectionSettings, ProtectionCatalog, tab.url, new Date(at));
    if (protectionDecision.blocked) {
      try { await chrome.tabs.update(tab.id, { url: protectionUrl() }); }
      catch { /* A tab may disappear between query and update. */ }
      return;
    }
    const decision = Core.accessDecision(state, tab.url, at);
    if (decision.allowed || !decision.policy) return;
    attemptsByTab.set(tab.id, tab.url);
    try { await chrome.tabs.update(tab.id, { url: gateUrl(decision.policy.id) }); }
    catch { /* A tab may disappear between query and update. */ }
  }));
}

async function updateActionState(state, protectionSettings, at) {
  try {
    const enabled = state.policies.filter((policy) => policy.enabled).length;
    const session = state.activeSession;
    let text = enabled ? String(Math.min(99, enabled)) : 'NEW';
    let color = enabled ? '#087c9d' : '#8a5a14';
    const protection = Protection.summary(protectionSettings, ProtectionCatalog, new Date(at));
    let title = enabled ? `Satoru Attention · ${enabled} site${enabled === 1 ? '' : 's'}` : 'Satoru Attention · setup needed';
    if (protection.enabled) title += ` · protection ${protection.recreationActive ? 'paused' : 'on'}`;
    if (session) {
      const remaining = Date.parse(session.deadlineAt) - Date.parse(at);
      text = remaining > 0 ? 'ON' : '!';
      color = remaining > 0 ? '#13744d' : '#a32f2a';
      title = remaining > 0 ? `Satoru Attention · ${Math.max(1, Math.ceil(remaining / 60000))} min` : 'Satoru Attention · boundary reached';
    }
    await Promise.all([
      chrome.action.setBadgeBackgroundColor({ color }),
      chrome.action.setBadgeText({ text }),
      chrome.action.setTitle({ title }),
    ]);
  } catch { /* Badge visibility is helpful, never part of the enforcement transaction. */ }
}

async function reconcileEnforcement(state, options = {}) {
  const at = currentIso();
  const protectionSettings = options.protectionSettings || await loadProtection();
  await reconcileRules(state, protectionSettings, at);
  await reconcileContentScripts(state);
  await scheduleBoundary(state, at);
  await scheduleProtectionBoundary(protectionSettings);
  if (options.redirectTabs !== false) await redirectDeniedTabs(state, protectionSettings, at);
  await updateActionState(state, protectionSettings, at);
}

async function commitWithEnforcement(previousState, nextState, options = {}) {
  let saved;
  try { saved = await saveState(nextState); }
  catch {
    return { ok: false, error: 'storage_unavailable', committed: false, retryable: true };
  }
  try {
    await reconcileEnforcement(saved, options);
    return { ok: true, state: saved };
  } catch {
    // State and enforcement are one user-visible transaction. Restore the prior
    // snapshot when Chrome rejects a DNR/script/alarm update, then reconstruct it.
    try {
      const restored = await saveState(previousState);
      try {
        await reconcileEnforcement(restored);
        return { ok: false, error: 'enforcement_failed', committed: false, retryable: true };
      } catch {
        await scheduleRecovery();
        return { ok: false, error: 'enforcement_recovery', committed: false, retryable: true };
      }
    } catch {
      // The new snapshot may be committed if storage rollback itself failed. Say
      // that explicitly so the UI refreshes instead of blindly repeating a write.
      await scheduleRecovery();
      return { ok: false, error: 'enforcement_recovery', committed: true, retryable: true };
    }
  }
}

async function commitProtectionWithEnforcement(previousSettings, nextSettings) {
  let saved;
  try { saved = await saveProtection(nextSettings); }
  catch { return { ok: false, error: 'storage_unavailable', committed: false, retryable: true }; }
  try {
    await reconcileEnforcement(await loadState(), { protectionSettings: saved });
    return { ok: true, settings: saved, summary: Protection.summary(saved, ProtectionCatalog, new Date()) };
  } catch {
    try {
      const restored = await saveProtection(previousSettings);
      try {
        await reconcileEnforcement(await loadState(), { protectionSettings: restored });
        return { ok: false, error: 'enforcement_failed', committed: false, retryable: true };
      } catch {
        await scheduleRecovery();
        return { ok: false, error: 'enforcement_recovery', committed: false, retryable: true };
      }
    } catch {
      await scheduleRecovery();
      return { ok: false, error: 'enforcement_recovery', committed: true, retryable: true };
    }
  }
}

function contextFor(state, siteId, at) {
  const requestedPolicy = siteId ? Core.policyById(state, siteId) : null;
  const activePolicy = state.activeSession ? Core.policyById(state, state.activeSession.policyId) : null;
  const policy = (activePolicy && (!siteId || activePolicy.id === siteId) ? activePolicy : null)
    || (requestedPolicy && requestedPolicy.enabled ? requestedPolicy : null)
    || (!siteId ? state.policies.find((item) => item.enabled) : null)
    || null;
  const session = state.activeSession && policy && state.activeSession.policyId === policy.id ? state.activeSession : null;
  const clockRollback = !!(session && Core.clockRolledBack(state, at));
  return {
    ok: true,
    configured: !!policy,
    policy,
    activeSession: session,
    boundary: session ? (clockRollback
      ? { over: true, remainingMs: 0, mode: session.mode, canExtend: false, extensionsLeft: 0, emergencyAvailable: false }
      : Core.boundaryOptions(state, at)) : null,
    emergency: session && !clockRollback ? Core.emergencyStatus(state, at) : null,
    clockRollback,
    resumeUrl: policy ? (session ? missionTarget(null, state, policy, session) : policy.homeUrl) : null,
    quota: policy ? Core.quotaStatus(state, policy.id, at, localDayKey()) : null,
    pendingPolicy: policy ? state.pendingPolicies.find((item) => item.policyId === policy.id) || null : null,
  };
}

function safeAttempt(tabId, state, policy) {
  const attempted = attemptsByTab.get(tabId);
  attemptsByTab.delete(tabId);
  if (!attempted || !policy) return policy ? policy.homeUrl : null;
  const matched = Core.policyForUrl(state, attempted);
  return matched && matched.id === policy.id ? attempted : policy.homeUrl;
}

function missionTarget(tabId, state, policy, session) {
  const attempted = safeAttempt(tabId, state, policy);
  if (!policy || !session) return attempted;
  const origin = `https://${policy.hostname}`;
  if (policy.appKey === 'tiktok') {
    if (session.purpose === 'publish' || session.purpose === 'create') return `${origin}/tiktokstudio/upload?from=webapp`;
    if (session.purpose === 'research' && session.topic) return `${origin}/search?q=${encodeURIComponent(session.topic)}`;
    if (session.purpose === 'watch') return `${origin}/favorites`;
    if (session.purpose === 'reply') return `${origin}/messages`;
  }
  if (policy.appKey === 'youtube') {
    if (session.purpose === 'publish' || session.purpose === 'create') return `${origin}/upload`;
    if (session.purpose === 'research' && session.topic) return `${origin}/results?search_query=${encodeURIComponent(session.topic)}`;
    if (session.purpose === 'watch') {
      try {
        const url = new URL(attempted);
        if (url.hostname === policy.hostname && ['/watch', '/playlist'].includes(url.pathname)) return url.toString();
      } catch { /* Use the finite saved-items fallback below. */ }
      return `${origin}/feed/watch_later`;
    }
  }
  return attempted || policy.homeUrl;
}

async function handleExtensionMessage(message, sender) {
  const type = message && message.type;
  if (type === 'PING') return { ok: true, version: Core.VERSION };
  if (type === 'GET_CONTEXT') {
    const state = await loadState();
    return contextFor(state, message.siteId, currentIso());
  }
  if (type === 'GET_OPTIONS') {
    const state = await loadState();
    const protection = await loadProtection();
    const permissions = {};
    for (const policy of state.policies) permissions[policy.id] = await permissionFor(policy);
    return { ok: true, state, permissions, protection,
      protectionPermission: await broadProtectionPermission(),
      protectionSummary: Protection.summary(protection, ProtectionCatalog, new Date()),
      version: Core.VERSION };
  }
  if (type === 'SAVE_PROTECTION') {
    return serialized(async () => {
      const previous = await loadProtection();
      const candidate = Protection.normalizeSettings(message.settings);
      if (candidate.enabled && !(await broadProtectionPermission())) {
        return { ok: false, error: 'protection_permission_required' };
      }
      return commitProtectionWithEnforcement(previous, candidate);
    });
  }
  if (type === 'START_SESSION') {
    return serialized(async () => {
      const state = await loadState();
      const id = `session_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const result = Core.startSession(state, { ...message.input, id, dayKey: localDayKey() }, currentIso());
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state, { redirectTabs: false });
      if (!commit.ok) return commit;
      const saved = commit.state;
      const policy = Core.policyById(saved, result.session.policyId);
      return { ok: true, session: result.session, targetUrl: missionTarget(sender.tab && sender.tab.id, saved, policy, result.session) };
    });
  }
  if (type === 'EXTEND_SESSION') {
    return serialized(async () => {
      const state = await loadState();
      const result = Core.extendSession(state, currentIso());
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state, { redirectTabs: false });
      if (!commit.ok) return commit;
      const saved = commit.state;
      const policy = Core.policyById(saved, result.session.policyId);
      return { ok: true, session: result.session, targetUrl: policy && policy.homeUrl };
    });
  }
  if (type === 'FINISH_SESSION') {
    return serialized(async () => {
      const state = await loadState();
      const result = Core.closeSession(state, message.outcome, currentIso());
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state);
      if (!commit.ok) return commit;
      const saved = commit.state;
      return { ok: true, episode: result.episode, returnUrl: Core.satoruDeepLink('return', result.episode.appKey) };
    });
  }
  if (type === 'REQUEST_EMERGENCY') {
    return serialized(async () => {
      const state = await loadState();
      const result = Core.requestEmergency(state, currentIso());
      if (!result.ok) return result;
      let saved;
      try { saved = await saveState(result.state); }
      catch { return { ok: false, error: 'storage_unavailable', committed: false, retryable: true }; }
      return { ok: true, emergency: Core.emergencyStatus(saved, currentIso()) };
    });
  }
  if (type === 'GRANT_EMERGENCY') {
    return serialized(async () => {
      const state = await loadState();
      const result = Core.grantEmergency(state, message.reason, currentIso());
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state, { redirectTabs: false });
      if (!commit.ok) return commit;
      const saved = commit.state;
      const policy = Core.policyById(saved, result.session.policyId);
      return { ok: true, session: result.session, targetUrl: policy && policy.homeUrl };
    });
  }
  if (type === 'SAVE_POLICY') {
    return serialized(async () => {
      const candidate = Core.cleanPolicy(message.policy);
      if (!candidate) return { ok: false, error: 'policy_invalid' };
      if (!(await permissionFor(candidate))) return { ok: false, error: 'permission_required' };
      const state = await loadState();
      const result = Core.upsertPolicy(state, candidate, {
        replacePurposes: message.replacePurposes === true,
        deferLoosening: true,
        activatesAt: nextLocalMidnightIso(),
      });
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state);
      if (!commit.ok) return commit;
      return { ok: true, policy: result.policy, pending: result.pending === true, activatesAt: result.activatesAt || null };
    });
  }
  if (type === 'TOGGLE_POLICY') {
    return serialized(async () => {
      const state = await loadState();
      const policy = Core.policyById(state, message.policyId);
      if (message.enabled === true && !(await permissionFor(policy))) return { ok: false, error: 'permission_required' };
      const result = Core.setPolicyEnabled(state, message.policyId, message.enabled === true, {
        deferLoosening: true,
        activatesAt: nextLocalMidnightIso(),
      });
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state);
      if (!commit.ok) return commit;
      return { ok: true, policy: result.policy, pending: result.pending === true, activatesAt: result.activatesAt || null };
    });
  }
  if (type === 'CANCEL_PENDING_POLICY') {
    return serialized(async () => {
      const state = await loadState();
      const result = Core.cancelPendingPolicy(state, message.policyId);
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state);
      return commit.ok ? { ok: true } : commit;
    });
  }
  if (type === 'GET_SATORU_LINK') {
    const url = Core.satoruDeepLink(message.action, message.appKey);
    return url ? { ok: true, url } : { ok: false, error: 'link_invalid' };
  }
  if (type === 'OPEN_GATE') {
    const state = await loadState();
    const policy = Core.policyById(state, message.policyId) || state.policies.find((item) => item.enabled);
    if (!policy) return { ok: false, error: 'policy_unavailable' };
    await chrome.tabs.create({ url: gateUrl(policy.id) });
    return { ok: true };
  }
  if (type === 'OPEN_OPTIONS') {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }
  return { ok: false, error: 'unknown_message' };
}

async function handleBridgeMessage(message, sender) {
  if (message.type === 'BRIDGE_STATUS') {
    const state = await loadState();
    return { ok: true, status: Core.publicStatus(state, currentIso()) };
  }
  if (message.type === 'OPEN_OPTIONS') {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }
  return { ok: false, error: 'bridge_message_denied' };
}

async function handleSiteMessage(message, sender) {
  let senderOrigin;
  let messageOrigin;
  try {
    senderOrigin = new URL(sender && sender.url).origin;
    messageOrigin = new URL(message && message.url).origin;
  } catch {
    return { ok: false, error: 'sender_invalid' };
  }
  if (!sender.tab || !sender.tab.id || typeof message.url !== 'string' || senderOrigin !== messageOrigin) {
    return { ok: false, error: 'sender_invalid' };
  }
  return serialized(async () => {
    const at = currentIso();
    const state = await observeClockState(at);
    const decision = Core.accessDecision(state, message.url, at);
    if (!decision.allowed && decision.policy) attemptsByTab.set(sender.tab.id, message.url);
    return {
      ok: true,
      allowed: decision.allowed,
      reason: decision.reason,
      remainingMs: decision.remainingMs,
      gateUrl: decision.policy ? gateUrl(decision.policy.id) : null,
    };
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let work;
  if (message && message.type === 'CHECK_ACCESS') work = handleSiteMessage(message, sender);
  else if (bridgeSender(sender)) work = handleBridgeMessage(message || {}, sender);
  else if (extensionSender(sender)) work = handleExtensionMessage(message || {}, sender);
  else work = Promise.resolve({ ok: false, error: 'sender_denied' });
  work.then(sendResponse).catch((error) => sendResponse({ ok: false, error: 'internal_error', detail: String(error && error.message || error) }));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (![BOUNDARY_ALARM, RECOVERY_ALARM, PROTECTION_ALARM].includes(alarm.name)) return;
  serialized(async () => {
    const state = await loadState();
    await reconcileEnforcement(state);
  }).catch(() => undefined);
});

chrome.permissions.onAdded.addListener(() => {
  serialized(async () => reconcileEnforcement(await loadState())).catch(() => undefined);
});

chrome.permissions.onRemoved.addListener(() => {
  serialized(async () => reconcileEnforcement(await loadState())).catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  serialized(async () => reconcileEnforcement(await loadState())).catch(() => undefined);
});

chrome.runtime.onInstalled.addListener((details) => {
  serialized(async () => {
    const state = await saveState(await loadState());
    await saveProtection(await loadProtection());
    await reconcileEnforcement(state);
    if (details.reason === 'install') await chrome.runtime.openOptionsPage();
  }).catch(() => undefined);
});
