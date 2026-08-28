/* Satoru Guide Surface v1 — DOM-only presentation adapter.
 *
 * Product state, persistence, copy selection and action handling stay outside this file.
 * The surface owns one non-modal fixed layer, a safe transcript and a spotlight that can
 * disappear without blocking the application when its target is not mounted.
 */
(function exposeGuideSurfaceV1(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuideSurfaceV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuideSurfaceV1(root) {
  'use strict';

  const VERSION = '1.1.0';
  const SURFACE_ID = 'guide-surface-v1';
  const SPOTLIGHT_LABEL_ID = 'guide-surface-v1-spotlight-label';
  let surface = null;
  let ring = null;
  let bubble = null;
  let spotlightLabel = null;
  let describedTarget = null;
  let describedByBefore = null;
  let activeModel = null;
  let returnFocus = null;
  let listenersBound = false;
  let frameHandle = 0;
  let frameUsesTimeout = false;

  function currentDocument() { return root && root.document ? root.document : null; }
  function text(value) { return value == null ? '' : String(value); }
  function token(value) { return text(value).trim().replace(/[^a-z0-9:._-]+/gi, '-').slice(0, 96); }
  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function element(tag, className) {
    const doc = currentDocument();
    const node = doc.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function replace(node, children) {
    if (typeof node.replaceChildren === 'function') node.replaceChildren(...children);
    else {
      while (node.firstChild) node.removeChild(node.firstChild);
      children.forEach((child) => node.appendChild(child));
    }
  }

  function canFocus(node) {
    return Boolean(node && typeof node.focus === 'function' && node.isConnected !== false);
  }

  function captureReturnFocus(model, doc) {
    const requested = model && model.returnFocus;
    if (canFocus(requested) && (!surface || !surface.contains(requested))) {
      returnFocus = requested;
      return;
    }
    const active = doc.activeElement;
    if (!returnFocus && canFocus(active) && active !== doc.body && (!surface || !surface.contains(active))) {
      returnFocus = active;
    }
  }

  function bindListeners() {
    const doc = currentDocument();
    if (!doc || listenersBound) return;
    if (root && typeof root.addEventListener === 'function') {
      root.addEventListener('resize', scheduleReposition);
      root.addEventListener('scroll', scheduleReposition, true);
    }
    if (typeof doc.addEventListener === 'function') doc.addEventListener('keydown', onKeydown);
    listenersBound = true;
  }

  function unbindListeners() {
    const doc = currentDocument();
    if (!listenersBound) return;
    if (root && typeof root.removeEventListener === 'function') {
      root.removeEventListener('resize', scheduleReposition);
      root.removeEventListener('scroll', scheduleReposition, true);
    }
    if (doc && typeof doc.removeEventListener === 'function') doc.removeEventListener('keydown', onKeydown);
    listenersBound = false;
  }

  function cancelScheduledFrame() {
    if (!frameHandle) return;
    if (!frameUsesTimeout && root && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(frameHandle);
    else if (root && typeof root.clearTimeout === 'function') root.clearTimeout(frameHandle);
    else clearTimeout(frameHandle);
    frameHandle = 0;
    frameUsesTimeout = false;
  }

  function scheduleReposition() {
    if (!surface || frameHandle) return;
    const run = () => { frameHandle = 0; frameUsesTimeout = false; reposition(); };
    if (root && typeof root.requestAnimationFrame === 'function') {
      frameUsesTimeout = false;
      frameHandle = root.requestAnimationFrame(run);
    } else {
      frameUsesTimeout = true;
      const later = root && typeof root.setTimeout === 'function' ? root.setTimeout.bind(root) : setTimeout;
      frameHandle = later(run, 16);
    }
  }

  function ensureSurface(doc) {
    if (surface && surface.isConnected !== false) return surface;
    const existing = typeof doc.getElementById === 'function' ? doc.getElementById(SURFACE_ID) : null;
    if (existing && typeof existing.remove === 'function') existing.remove();

    surface = element('section', 'guide-surface-v1 guide-safe-bubble');
    surface.id = SURFACE_ID;
    surface.dataset.guideSurface = 'v1';
    surface.dataset.guideFallback = 'safe-bubble';
    surface.setAttribute('role', 'region');
    surface.style.position = 'fixed';
    surface.style.inset = '0';
    surface.style.zIndex = '10001';
    surface.style.pointerEvents = 'none';

    ring = element('div', 'guide-surface-v1__spotlight');
    ring.setAttribute('aria-hidden', 'true');
    ring.style.position = 'fixed';
    ring.style.pointerEvents = 'none';
    ring.hidden = true;

    spotlightLabel = element('span', 'sr-only');
    spotlightLabel.id = SPOTLIGHT_LABEL_ID;
    spotlightLabel.setAttribute('id', SPOTLIGHT_LABEL_ID);
    spotlightLabel.setAttribute('data-noi18n', '');

    bubble = element('article', 'guide-surface-v1__bubble');
    bubble.style.position = 'fixed';
    bubble.style.left = '50%';
    bubble.style.bottom = 'var(--guide-bubble-bottom, 24px)';
    bubble.style.transform = 'translateX(-50%)';
    bubble.style.pointerEvents = 'auto';
    surface.appendChild(spotlightLabel);
    surface.appendChild(ring);
    surface.appendChild(bubble);
    doc.body.appendChild(surface);
    bindListeners();
    return surface;
  }

  function makeButton(item, fallbackAction) {
    const config = item && typeof item === 'object' ? item : {};
    const action = token(config.action || fallbackAction);
    if (!action) return null;
    const button = element('button', `guide-surface-v1__action${config.kind ? ` is-${token(config.kind)}` : ''}`);
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.id = text(config.id);
    button.textContent = text(config.label);
    if (config.noI18n === true) button.setAttribute('data-noi18n', '');
    if (config.ariaLabel != null) button.setAttribute('aria-label', text(config.ariaLabel));
    if (config.pressed === true || config.pressed === false) button.setAttribute('aria-pressed', String(config.pressed));
    button.disabled = config.disabled === true;
    return button;
  }

  function progressText(model) {
    if (model.progressLabel != null) return text(model.progressLabel);
    const progress = model.progress && typeof model.progress === 'object' ? model.progress : {};
    const current = Math.max(0, Math.round(number(progress.current, 0)));
    const total = Math.max(0, Math.round(number(progress.total, 0)));
    return total > 0 ? `${Math.min(current, total)} / ${total}` : text(model.stepLabel);
  }

  function renderBubble(model) {
    const nodes = [];
    const heading = element('header', 'guide-surface-v1__header');
    const chapter = element('span', 'guide-surface-v1__chapter');
    chapter.textContent = text(model.chapterLabel);
    const progress = element('span', 'guide-surface-v1__progress');
    progress.textContent = progressText(model);
    if (model.progressAriaLabel != null) progress.setAttribute('aria-label', text(model.progressAriaLabel));
    heading.appendChild(chapter);
    heading.appendChild(progress);
    nodes.push(heading);

    if (model.title != null) {
      const title = element('h2', 'guide-surface-v1__title');
      title.textContent = text(model.title);
      nodes.push(title);
    }

    const visual = element('div', 'guide-surface-v1__visual-fallback');
    const visualLabel = text(model.visualLabel || model.speakerLabel);
    visual.textContent = visualLabel;
    if (visualLabel) {
      visual.setAttribute('role', 'img');
      visual.setAttribute('aria-label', text(model.visualAriaLabel || visualLabel));
    } else visual.setAttribute('aria-hidden', 'true');
    nodes.push(visual);

    const transcript = element('p', 'guide-surface-v1__transcript');
    transcript.setAttribute('role', 'status');
    transcript.setAttribute('aria-live', 'polite');
    transcript.setAttribute('aria-atomic', 'true');
    transcript.setAttribute('data-noi18n', '');
    transcript.textContent = text(model.transcript);
    nodes.push(transcript);

    const choices = Array.isArray(model.choices) ? model.choices : [];
    if (choices.length) {
      const list = element('ul', 'guide-surface-v1__choices');
      list.setAttribute('role', 'list');
      choices.forEach((choice) => {
        const item = choice && typeof choice === 'object' ? choice : {};
        const row = element('li', 'guide-surface-v1__choice');
        const button = makeButton({
          ...item,
          action: item.action || model.choiceAction || 'guide-choice',
          kind: item.kind || 'choice',
        }, 'guide-choice');
        if (!button) return;
        if (item.selected === true || item.selected === false) button.setAttribute('aria-pressed', String(item.selected));
        if (item.description != null) {
          const label = element('span', 'guide-surface-v1__choice-label');
          label.textContent = text(item.label);
          const description = element('small', 'guide-surface-v1__choice-description');
          description.textContent = text(item.description);
          replace(button, [label, description]);
        }
        row.appendChild(button);
        list.appendChild(row);
      });
      nodes.push(list);
    }

    const actions = Array.isArray(model.actions) ? model.actions : [];
    if (actions.length) {
      const bar = element('div', 'guide-surface-v1__actions');
      actions.forEach((action) => {
        const button = makeButton(action, '');
        if (button) bar.appendChild(button);
      });
      if (bar.childNodes ? bar.childNodes.length : bar.children.length) nodes.push(bar);
    }
    replace(bubble, nodes);
  }

  function targetCandidates(doc, selector) {
    if (typeof doc.querySelectorAll === 'function') {
      const all = Array.from(doc.querySelectorAll(selector));
      if (all.length) return all;
    }
    const first = typeof doc.querySelector === 'function' ? doc.querySelector(selector) : null;
    return first ? [first] : [];
  }

  function resolveTarget() {
    const doc = currentDocument();
    const selector = activeModel && text(activeModel.targetSelector).trim();
    if (!doc || !selector || typeof doc.querySelector !== 'function') return null;
    try {
      return targetCandidates(doc, selector).find((target) => {
        if (!target || target.isConnected === false || (surface && surface.contains(target))
          || typeof target.getBoundingClientRect !== 'function') return false;
        const rect = target.getBoundingClientRect();
        const width = number(rect.width, number(rect.right, 0) - number(rect.left, 0));
        const height = number(rect.height, number(rect.bottom, 0) - number(rect.top, 0));
        return width > 0 && height > 0;
      }) || null;
    } catch { return null; }
  }

  function restoreTargetDescription() {
    if (!describedTarget) return;
    if (describedByBefore) describedTarget.setAttribute('aria-describedby', describedByBefore);
    else describedTarget.removeAttribute('aria-describedby');
    describedTarget = null;
    describedByBefore = null;
  }

  function describeTarget(target) {
    const label = text(activeModel && activeModel.spotlightLabel).trim();
    if (!target || !label || !spotlightLabel) { restoreTargetDescription(); return; }
    spotlightLabel.textContent = label;
    if (describedTarget === target) return;
    restoreTargetDescription();
    describedTarget = target;
    describedByBefore = target.getAttribute('aria-describedby');
    const ids = text(describedByBefore).split(/\s+/).filter(Boolean);
    if (!ids.includes(SPOTLIGHT_LABEL_ID)) ids.push(SPOTLIGHT_LABEL_ID);
    target.setAttribute('aria-describedby', ids.join(' '));
  }

  function setSafeBubble(safe) {
    if (!surface || !ring) return;
    surface.classList.toggle('guide-safe-bubble', safe);
    surface.dataset.guideFallback = safe ? 'safe-bubble' : 'spotlight';
    ring.hidden = safe;
  }

  function resetBubblePosition() {
    if (!bubble) return;
    bubble.style.top = '';
    bubble.style.bottom = 'var(--guide-bubble-bottom, 24px)';
    bubble.style.maxBlockSize = '';
  }

  function placeBubbleAround(rect) {
    if (!bubble || typeof bubble.getBoundingClientRect !== 'function') return;
    resetBubblePosition();
    const bubbleRect = bubble.getBoundingClientRect();
    const intersectsX = bubbleRect.right > rect.left && bubbleRect.left < rect.right;
    const intersectsY = bubbleRect.bottom > rect.top && bubbleRect.top < rect.bottom;
    if (!intersectsX || !intersectsY) return;
    const viewportHeight = Math.max(320, number(root && root.innerHeight, 800));
    const edge = 12, gap = 12;
    const above = Math.max(0, rect.top - gap - edge);
    const below = Math.max(0, viewportHeight - rect.bottom - gap - edge);
    const height = Math.max(0, number(bubbleRect.height, bubbleRect.bottom - bubbleRect.top));
    if (above >= below) {
      bubble.style.top = `${Math.round(Math.max(edge, rect.top - gap - Math.min(height, above)))}px`;
      bubble.style.bottom = 'auto';
      bubble.style.maxBlockSize = `${Math.max(120, Math.floor(above))}px`;
    } else {
      bubble.style.top = `${Math.round(rect.bottom + gap)}px`;
      bubble.style.bottom = 'auto';
      bubble.style.maxBlockSize = `${Math.max(120, Math.floor(below))}px`;
    }
  }

  function reposition() {
    if (!surface || !ring) return false;
    const target = resolveTarget();
    if (!target) { restoreTargetDescription(); resetBubblePosition(); setSafeBubble(true); return false; }
    describeTarget(target);
    const rect = target.getBoundingClientRect();
    const pad = Math.max(0, Math.min(40, number(activeModel && activeModel.spotlightPadding, 8)));
    const left = number(rect.left, 0) - pad;
    const top = number(rect.top, 0) - pad;
    const width = Math.max(0, number(rect.width, number(rect.right, 0) - number(rect.left, 0))) + pad * 2;
    const height = Math.max(0, number(rect.height, number(rect.bottom, 0) - number(rect.top, 0))) + pad * 2;
    ring.style.left = `${Math.round(left)}px`;
    ring.style.top = `${Math.round(top)}px`;
    ring.style.width = `${Math.round(width)}px`;
    ring.style.height = `${Math.round(height)}px`;
    setSafeBubble(false);
    placeBubbleAround({ left, top, right: left + width, bottom: top + height });
    return true;
  }

  function onKeydown(event) {
    if (!surface || !event || event.key !== 'Escape') return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    const callback = activeModel && typeof activeModel.onEscape === 'function' ? activeModel.onEscape : null;
    let shouldClose = true;
    if (callback) {
      try { shouldClose = callback({ reason: 'escape', chapterId: text(activeModel.chapterId) }) !== false; }
      catch { shouldClose = true; }
    }
    if (shouldClose) close();
  }

  function paint(viewModel) {
    const doc = currentDocument();
    if (!doc || !doc.body || typeof doc.createElement !== 'function') return null;
    const model = viewModel && typeof viewModel === 'object' ? viewModel : {};
    captureReturnFocus(model, doc);
    ensureSurface(doc);
    const nextChapter = token(model.chapterId), nextStep = token(model.stepId);
    const stepChanged = surface.dataset.chapterId !== nextChapter || surface.dataset.stepId !== nextStep;
    const activeBefore = doc.activeElement;
    const activeAction = activeBefore && surface.contains(activeBefore) ? text(activeBefore.dataset && activeBefore.dataset.action) : '';
    const activeId = activeBefore && surface.contains(activeBefore) ? text(activeBefore.dataset && activeBefore.dataset.id) : '';
    activeModel = model;
    if (model.surfaceLabel != null) surface.setAttribute('aria-label', text(model.surfaceLabel));
    else surface.removeAttribute('aria-label');
    surface.dataset.chapterId = nextChapter;
    surface.dataset.stepId = nextStep;
    renderBubble(model);
    reposition();
    let focusTarget = null;
    if (!stepChanged && activeAction && bubble && typeof bubble.querySelectorAll === 'function') {
      focusTarget = Array.from(bubble.querySelectorAll('[data-action]')).find((node) => (
        text(node.dataset && node.dataset.action) === activeAction && text(node.dataset && node.dataset.id) === activeId
      )) || null;
    } else if (stepChanged && model.focusInitial !== false && bubble && typeof bubble.querySelector === 'function') {
      const actionBar = Array.from(bubble.children || []).find((node) => (
        node.classList && node.classList.contains('guide-surface-v1__actions')
      ));
      focusTarget = actionBar?.querySelector('button:not(:disabled)') || bubble.querySelector('button:not(:disabled)');
    }
    if (canFocus(focusTarget)) {
      try { focusTarget.focus({ preventScroll: true }); } catch { try { focusTarget.focus(); } catch {} }
    }
    return surface;
  }

  function close(options) {
    const config = options && typeof options === 'object' ? options : {};
    const focusTarget = returnFocus;
    cancelScheduledFrame();
    unbindListeners();
    restoreTargetDescription();
    if (surface && typeof surface.remove === 'function') surface.remove();
    surface = null; ring = null; bubble = null; spotlightLabel = null; activeModel = null; returnFocus = null;
    if (config.restoreFocus !== false && canFocus(focusTarget)) {
      try { focusTarget.focus({ preventScroll: true }); } catch { try { focusTarget.focus(); } catch {} }
    }
    return Boolean(focusTarget || config.restoreFocus === false);
  }

  return Object.freeze({ VERSION, SURFACE_ID, paint, close });
});
