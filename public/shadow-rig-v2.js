/* Satoru Shadow Rig v2 runtime + v3 canonical evolution art
 * Reactive wrapper around the four normalized Shadow evolution posters.
 * The rig is intentionally DOM/CSS-native: forms stay recognisable while
 * state, speech and context can change instantly without rendering a video.
 */
(function shadowRigFactory(global) {
  'use strict';

  const FORMS = [
    { id: 'spark', name: 'Искра', asset: '/art/companions/shadow-v3-20260730/shadow-spark-calm.png?v=20260730-1', bond: 0 },
    { id: 'spirit', name: 'Дух', asset: '/art/companions/shadow-v3-20260730/shadow-spirit-calm.png?v=20260730-1', bond: 6 },
    { id: 'guardian', name: 'Страж', asset: '/art/companions/shadow-v3-20260730/shadow-guardian-calm.png?v=20260730-1', bond: 20 },
    { id: 'keeper', name: 'Хранитель', asset: '/art/companions/shadow-v3-20260730/shadow-keeper-calm.png?v=20260730-1', bond: 50 },
  ];
  const STATES = ['calm', 'listening', 'thinking', 'speaking', 'happy', 'radiant', 'caring', 'sleepy', 'longing', 'alert'];
  const STATE_ALIASES = {
    idle: 'calm',
    morning: 'happy',
    evening: 'caring',
    proud: 'radiant',
    celebrate: 'radiant',
    focused: 'thinking',
    listen: 'listening',
    talk: 'speaking',
  };
  let transientTimer = null;

  function clampTier(tier) {
    const value = Number(tier);
    return Number.isFinite(value) ? Math.max(0, Math.min(FORMS.length - 1, Math.round(value))) : 1;
  }
  function normalizeState(state) {
    const value = STATE_ALIASES[state] || state;
    return STATES.includes(value) ? value : 'calm';
  }
  function safeToken(value, fallback) {
    const token = String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return token || fallback;
  }
  function html(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function markup(options) {
    const opts = options || {};
    const tier = clampTier(opts.tier);
    const form = FORMS[tier];
    const state = normalizeState(opts.state);
    const context = safeToken(opts.context, 'card');
    const label = html(opts.label || `Тень — ${form.name}`);
    return `<span class="shadow-rig shadow-form-${form.id} shadow-state-${state} shadow-context-${context}" data-shadow-rig data-shadow-tier="${tier}" data-shadow-form="${form.id}" data-shadow-state="${state}" data-shadow-context="${context}" role="img" aria-label="${label}">
      <span class="shadow-rig-ground" aria-hidden="true"></span>
      <span class="shadow-rig-aura shadow-rig-aura-back" aria-hidden="true"></span>
      <span class="shadow-rig-orbit shadow-rig-orbit-a" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="shadow-rig-orbit shadow-rig-orbit-b" aria-hidden="true"><i></i><i></i></span>
      <span class="shadow-rig-body" aria-hidden="true"><img class="shadow-rig-image" src="${form.asset}" alt="" draggable="false" /></span>
      <span class="shadow-rig-aura shadow-rig-aura-front" aria-hidden="true"></span>
      <span class="shadow-rig-motes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <span class="shadow-rig-voice" aria-hidden="true"><i></i><i></i><i></i><b></b></span>
      <span class="shadow-rig-thought" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="shadow-rig-care" aria-hidden="true"><i></i></span>
      <span class="shadow-rig-sleep" aria-hidden="true"><i></i><i></i><i></i></span>
    </span>`;
  }

  function setState(target, state) {
    const rig = target && target.matches && target.matches('[data-shadow-rig]')
      ? target : target && target.querySelector ? target.querySelector('[data-shadow-rig]') : null;
    if (!rig) return null;
    const next = normalizeState(state);
    STATES.forEach((name) => rig.classList.remove(`shadow-state-${name}`));
    rig.classList.add(`shadow-state-${next}`);
    rig.dataset.shadowState = next;
    return rig;
  }
  function setGlobalState(state) {
    document.documentElement.dataset.shadowMode = normalizeState(state);
  }
  function clearGlobalState() {
    delete document.documentElement.dataset.shadowMode;
    document.documentElement.classList.remove('shadow-speech-pulse');
  }
  function setTransient(state, duration) {
    if (transientTimer) clearTimeout(transientTimer);
    setGlobalState(state);
    transientTimer = setTimeout(() => {
      transientTimer = null;
      clearGlobalState();
    }, Math.max(120, Number(duration) || 900));
  }
  function speechPulse() {
    const root = document.documentElement;
    root.classList.remove('shadow-speech-pulse');
    void root.offsetWidth;
    root.classList.add('shadow-speech-pulse');
  }
  function tierForBond(bond) {
    const score = Number(bond) || 0;
    let tier = 0;
    FORMS.forEach((form, index) => { if (score >= form.bond) tier = index; });
    return tier;
  }

  global.ShadowRig = Object.freeze({
    forms: FORMS.slice(),
    states: STATES.slice(),
    markup,
    setState,
    setGlobalState,
    clearGlobalState,
    setTransient,
    speechPulse,
    tierForBond,
    normalizeState,
  });
})(window);
