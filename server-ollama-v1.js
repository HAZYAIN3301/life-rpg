'use strict';

// Administrator-owned configuration. Request bodies never choose a host/model.
function configuration(env = process.env) {
  const users = new Set(String(env.SATORU_OLLAMA_USERS || '').split(',').map(x => x.trim()).filter(Boolean));
  const model = String(env.OLLAMA_MODEL || '').trim();
  let base;
  try {
    base = new URL(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434');
    if (!['http:', 'https:'].includes(base.protocol) || !['localhost','127.0.0.1','[::1]'].includes(base.hostname)
      || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw Error();
    if (base.hostname === 'localhost') base.hostname = '127.0.0.1';
  } catch { return { enabled: false, users, model: '', base: null }; }
  const enabled = env.SATORU_OLLAMA_ENABLED === '1' && users.size > 0
    && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/.test(model) && !/(?:^|[-:])cloud(?:$|[-:])/i.test(model);
  return { enabled, users, model, base: base.origin };
}

function create({ env = process.env, fetchImpl = fetch, timeoutMs = 120000 } = {}) {
  const config = configuration(env);
  let busy = false;
  const allowed = uid => config.enabled && config.users.has(String(uid));
  function status(uid) { return { configured: allowed(uid), mode: 'server-local', model: allowed(uid) ? config.model : null }; }
  async function json(route, body, signal) {
    const response = await fetchImpl(config.base + route, { method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!response.ok) { await response.body?.cancel(); throw Error('ollama_http_' + response.status); }
    const reader = response.body.getReader(); const chunks = []; let bytes = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength; if (bytes > 1024 * 1024) throw Error('ollama_response_too_large'); chunks.push(Buffer.from(value)); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); }
  }
  async function complete(uid, system, messages, maxTokens = 1500) {
    const fail = (detail, status = 502) => ({ ok: false, status, detail, source: 'local', provider: 'ollama' });
    if (!allowed(uid)) return fail('ollama_not_configured_for_account', 403);
    if (busy) return fail('ollama_busy', 429);
    const norm = (Array.isArray(messages) ? messages : []).slice(-20).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }));
    const prompt = String(system || '');
    if (!norm.length || prompt.length + norm.reduce((sum, m) => sum + m.content.length, 0) > 48000) return fail('ollama_context_too_large', 400);
    busy = true;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const metadata = await json('/api/show', { model: config.model }, controller.signal);
      // Refuse cloud aliases before sending any user context, even when their
      // alias does not contain ':cloud'. No model pulling or silent cloud fallback.
      if (metadata.remote_host || metadata.remote_model || !['gguf','safetensors'].includes(metadata.details?.format)
        || !metadata.capabilities?.includes('completion')) return fail('ollama_local_model_required', 400);
      const result = await json('/api/chat', { model: config.model, stream: false, think: false,
        messages: [{ role: 'system', content: prompt }, ...norm],
        options: { num_ctx: 32768, num_predict: Math.min(4000, Math.max(64, Number(maxTokens) || 1500)) }, keep_alive: '5m' }, controller.signal);
      if (result.done !== true || result.error || typeof result.message?.content !== 'string' || !result.message.content.trim()) return fail('ollama_invalid_response');
      return { ok: true, text: result.message.content.trim(), tokens: Math.max(0, Number(result.prompt_eval_count) || 0) + Math.max(0, Number(result.eval_count) || 0),
        truncated: result.done_reason === 'length', provider: 'ollama', source: 'local' };
    } catch (error) { return fail(controller.signal.aborted ? 'ollama_timeout' : 'ollama_unavailable'); }
    finally { clearTimeout(timer); busy = false; }
  }
  return Object.freeze({ status, complete });
}
module.exports = { configuration, create };
