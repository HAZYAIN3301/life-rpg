/* Explicit single-item viewer. Metadata/load never awards a watched receipt. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./inspiration-media-v1.js') : root.InspirationMediaV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationPlayerV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Media) {
  'use strict';
  function createController({ document, window, setTimeout: later = setTimeout, clearTimeout: cancel = clearTimeout, timeoutMs = 15000 } = {}) {
    let current = null;
    function status(host, text) {
      let node = host.querySelector('[data-media-status]');
      if (!node) { node = document.createElement('p'); node.setAttribute('data-media-status', ''); node.setAttribute('role', 'status'); host.appendChild(node); }
      node.textContent = text;
    }
    function close({ restoreFocus = true, message = '' } = {}) {
      const active = current; if (!active) return;
      current = null; cancel(active.timer); window.removeEventListener('message', active.listener);
      window.removeEventListener('keydown', active.keydown);
      active.frame.removeAttribute('src'); active.layer.close?.(); active.layer.remove(); active.host.classList.remove('has-player');
      status(active.host, message);
      if (restoreFocus && active.opener?.isConnected) active.opener.focus();
    }
    function open({ host, item, opener, copy = (key) => key, allowLegacy = () => false } = {}) {
      if (!host || !item || item.supplyUnavailable) return false;
      const source = Media?.parseSource(item.sourceUrl || item.url), url = item.embedUrl;
      const imageUrl = source?.provider === 'pinterest' && item.mediaType === 'image' && Media.safeImage(item.imageUrl, 'pinterest');
      if (!imageUrl && (source ? !Media.isAllowedEmbed(url, source) : !allowLegacy(url))) return false;
      close({ restoreFocus: false });
      const layer = document.createElement(imageUrl ? 'dialog' : 'div');
      const frame = document.createElement(imageUrl ? 'img' : 'iframe'), button = document.createElement('button');
      layer.className = 'inspiration-embed' + (source ? ` is-${source.provider}` : '') + (imageUrl ? ' is-image-viewer' : '');
      if (imageUrl) {
        layer.setAttribute('aria-label', item.title || copy('Показать референс'));
        layer.setAttribute('aria-modal', 'true');
        frame.className = 'inspiration-viewer-image'; frame.alt = item.title || ''; frame.decoding = 'async';
        layer.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
      } else {
        frame.title = item.title || copy('Показать референс'); frame.loading = 'eager';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
        frame.setAttribute('allow', 'fullscreen; picture-in-picture'); frame.setAttribute('allowfullscreen', '');
      }
      button.type = 'button'; button.setAttribute('data-action', 'inspiration-media-close');
      button.setAttribute('aria-label', copy('Закрыть просмотр')); button.textContent = '✕';
      button.addEventListener('click', () => close());
      const active = { host, layer, frame, opener, timer: null, listener: null };
      active.keydown = (event) => { if (event.key === 'Escape' && current === active) { event.preventDefault(); close(); } };
      const fail = () => { if (current === active) close({ message: copy('Материал сейчас не открылся. Можно повторить или открыть источник.') }); };
      active.listener = (event) => {
        if (current !== active || !source || source.provider !== 'tiktok') return;
        const message = Media.parsePlayerEvent(event, frame.contentWindow, source);
        if (!message) return;
        if (message.type === 'ended') { close({ message: copy('Эдит закончился. Можно сохранить его или вернуться к своему дню.') }); return; }
        if (message.type === 'error') { fail(); return; }
        if (message.type === 'ready' || message.type === 'playing') { cancel(active.timer); status(host, ''); }
      };
      frame.addEventListener('error', fail);
      frame.addEventListener('load', () => {
        if (current === active && source?.provider !== 'tiktok') { cancel(active.timer); status(host, ''); }
      });
      current = active; window.addEventListener('message', active.listener);
      window.addEventListener('keydown', active.keydown);
      layer.appendChild(frame); layer.appendChild(button); (imageUrl ? document.body : host).appendChild(layer); host.classList.add('has-player');
      status(host, copy('Загрузка из источника…')); active.timer = later(fail, timeoutMs);
      frame.src = imageUrl || url;
      if (imageUrl) { if (typeof layer.showModal === 'function') layer.showModal(); else layer.setAttribute('open', ''); }
      button.focus(); return true;
    }
    function sync() { if (current && !current.host.isConnected) close({ restoreFocus: false }); }
    return Object.freeze({ open, close, sync });
  }
  let instance;
  function controller() {
    if (!instance && typeof document !== 'undefined' && typeof window !== 'undefined') instance = createController({ document, window });
    return instance;
  }
  return Object.freeze({ VERSION: '1.0.0', createController,
    open: (options) => controller()?.open(options), close: (options) => controller()?.close(options), sync: () => controller()?.sync() });
});
