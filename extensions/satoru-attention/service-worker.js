'use strict';

importScripts('core.js');

const Core = self.SatoruAttentionCore;
const STATE_KEY = 'satoruAttentionStateV1';
const BOUNDARY_ALARM = 'satoru-attention-boundary';
const RECOVERY_ALARM = 'satoru-attention-recovery';
const SITE_SCRIPT_PREFIX = 'satoru-site-';
const RULE_BASE = 20_000;
const CLOCK_OBSERVE_INTERVAL_MS = 30_000;
const EXTENSION_ROOT = chrome.runtime.getURL('');
const attemptsByTab = new Map(); // Ephemeral only: never persisted or synced.
let mutationQueue = Promise.resolve();

function currentIso() { return new Date().toISOString(); }
function extensionSender(sender) { return !!(sender && typeof sender.url === 'string' && sender.url.startsWith(EXTENSION_ROOT)); }
function bridgeSender(sender) {
  return !!(sender && typeof sender.url === 'string'
    && (sender.url === Core.SATORU_ORIGIN || sender.url.startsWith(`${Core.SATORU_ORIGIN}/`)));
}

async function loadState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return Core.normalizeState(stored[STATE_KEY]);
}

async function saveState(state) {
  const normalized = Core.normalizeState(state);
  await chrome.storage.local.set({ [STATE_KEY]: normalized });
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

function exactHostRegex(hostname) {
  const escaped = String(hostname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^https?://${escaped}(?::[0-9]+)?(?:/|$)`;
}

async function reconcileRules(state, at) {
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

async function redirectDeniedTabs(state, at) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id || typeof tab.url !== 'string' || !/^https?:/.test(tab.url)) return;
    const decision = Core.accessDecision(state, tab.url, at);
    if (decision.allowed || !decision.policy) return;
    attemptsByTab.set(tab.id, tab.url);
    try { await chrome.tabs.update(tab.id, { url: gateUrl(decision.policy.id) }); }
    catch { /* A tab may disappear between query and update. */ }
  }));
}

async function updateActionState(state, at) {
  try {
    const enabled = state.policies.filter((policy) => policy.enabled).length;
    const session = state.activeSession;
    let text = enabled ? String(Math.min(99, enabled)) : 'NEW';
    let color = enabled ? '#087c9d' : '#8a5a14';
    let title = enabled ? `Satoru Attention · ${enabled} site${enabled === 1 ? '' : 's'}` : 'Satoru Attention · setup needed';
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
  await reconcileRules(state, at);
  await reconcileContentScripts(state);
  await scheduleBoundary(state, at);
  if (options.redirectTabs !== false) await redirectDeniedTabs(state, at);
  await updateActionState(state, at);
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

function contextFor(state, siteId, at) {
  const policy = Core.policyById(state, siteId)
    || (state.activeSession ? Core.policyById(state, state.activeSession.policyId) : null)
    || state.policies.find((item) => item.enabled)
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
    resumeUrl: policy ? policy.homeUrl : null,
  };
}

function safeAttempt(tabId, state, policy) {
  const attempted = attemptsByTab.get(tabId);
  attemptsByTab.delete(tabId);
  if (!attempted || !policy) return policy ? policy.homeUrl : null;
  const matched = Core.policyForUrl(state, attempted);
  return matched && matched.id === policy.id ? attempted : policy.homeUrl;
}

async function handleExtensionMessage(message, sender) {
  const type = message && message.type;
  if (type === 'GET_CONTEXT') {
    const state = await loadState();
    return contextFor(state, message.siteId, currentIso());
  }
  if (type === 'GET_OPTIONS') {
    const state = await loadState();
    const permissions = {};
    for (const policy of state.policies) permissions[policy.id] = await permissionFor(policy);
    return { ok: true, state, permissions, version: Core.VERSION };
  }
  if (type === 'START_SESSION') {
    return serialized(async () => {
      const state = await loadState();
      const id = `session_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const result = Core.startSession(state, { ...message.input, id }, currentIso());
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state, { redirectTabs: false });
      if (!commit.ok) return commit;
      const saved = commit.state;
      const policy = Core.policyById(saved, result.session.policyId);
      return { ok: true, session: result.session, targetUrl: safeAttempt(sender.tab && sender.tab.id, saved, policy) };
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
      const result = Core.upsertPolicy(state, candidate);
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state);
      if (!commit.ok) return commit;
      return { ok: true, policy: result.policy };
    });
  }
  if (type === 'TOGGLE_POLICY') {
    return serialized(async () => {
      const state = await loadState();
      const policy = Core.policyById(state, message.policyId);
      if (message.enabled === true && !(await permissionFor(policy))) return { ok: false, error: 'permission_required' };
      const result = Core.setPolicyEnabled(state, message.policyId, message.enabled === true);
      if (!result.ok) return result;
      const commit = await commitWithEnforcement(state, result.state);
      if (!commit.ok) return commit;
      return { ok: true, policy: result.policy };
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
  if (![BOUNDARY_ALARM, RECOVERY_ALARM].includes(alarm.name)) return;
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
    await reconcileEnforcement(state);
    if (details.reason === 'install') await chrome.runtime.openOptionsPage();
  }).catch(() => undefined);
});
