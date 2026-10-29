/* Explicit single-item viewer. Metadata/load never awards a watched receipt. */
(function (root, factory) {
  const node=typeof module==='object'&&module.exports;
  const api = factory(node ? require('./inspiration-media-v1.js') : root.InspirationMediaV1,node ? require('./inspiration-licensed-media-v1.js') : root.InspirationLicensedMediaV1,node ? require('./inspiration-tiktok-frame-v1.js') : root.InspirationTikTokFrameV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationPlayerV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Media,Licensed,TikTokFrame) {
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
      active.frame.pause?.(); active.frame.removeAttribute('src'); active.frame.load?.(); active.layer.close?.(); active.layer.remove(); active.host.classList.remove('has-player');
      window.removeEventListener('pagehide',active.pagehide);document.removeEventListener?.('visibilitychange',active.visibility);
      status(active.host, message);
      if (restoreFocus && active.opener?.isConnected) active.opener.focus();
    }
    function open({ host, item, opener, copy = (key) => key, allowLegacy = () => false } = {}) {
      const personal=TikTokFrame?.personalSource(item);
      if (!host || !item || item.supplyUnavailable || Media.externalOnly(item)&&!personal) return false;
      const direct=item.mediaPolicy==='stream'&&item.provider==='pexels';
      const videoUrl=direct&&item.format==='video'&&Licensed?.safeUrl(item.videoUrl,'video');
      const source = Media?.parseSource(item.sourceUrl || item.url), url = personal?TikTokFrame.wrapperUrl(item):videoUrl || item.embedUrl;
      const imageUrl = direct&&item.format==='image'?Licensed?.safeUrl(item.imageUrl,'image'):source?.provider === 'pinterest' && item.mediaType === 'image' && Media.safeImage(item.imageUrl, 'pinterest');
      if(direct&&!imageUrl&&!videoUrl)return false;
      if (!personal && !imageUrl && !videoUrl && (source ? !Media.isAllowedEmbed(url, source) : !allowLegacy(url))) return false;
      close({ restoreFocus: false });
      const modal=!!imageUrl||!!personal;
      const layer = document.createElement(modal ? 'dialog' : 'div');
      const frame = document.createElement(imageUrl ? 'img' : videoUrl ? 'video' : 'iframe'), button = document.createElement('button');
      layer.className = 'inspiration-embed' + (source ? ` is-${source.provider}` : '') + (imageUrl ? ' is-image-viewer' : '');
      if(personal){layer.className+=' is-personal-viewer';layer.setAttribute('aria-label',item.title||copy('Смотреть эдит'));layer.setAttribute('aria-modal','true');layer.addEventListener('cancel',event=>{event.preventDefault();close();});}
      if (imageUrl) {
        layer.setAttribute('aria-label', item.title || copy('Показать референс'));
        layer.setAttribute('aria-modal', 'true');
        frame.className = 'inspiration-viewer-image'; frame.alt = item.title || ''; frame.decoding = 'async';
        layer.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
      } else if(videoUrl) {
        layer.className+=' is-licensed-video';frame.controls=true;frame.playsInline=true;frame.loop=false;frame.preload='metadata';frame.referrerPolicy='no-referrer';
        frame.setAttribute('aria-label',item.title||copy('Смотреть'));
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
      active.pagehide=()=>close({restoreFocus:false});active.visibility=()=>{if(document.hidden)close({restoreFocus:false});};
      active.keydown = (event) => { if (event.key === 'Escape' && current === active) { event.preventDefault(); close(); } };
      const fail = () => {
        if (current !== active) return;
        close({ message: copy(personal?'Эдит не загрузился. Повтори просмотр здесь.':'Материал сейчас не открылся. Можно повторить или открыть источник.') });
        if (!personal && typeof item.id === 'string' && item.id && (source || item.sourceUrl || item.url)) {
          const fallback = document.createElement('button');
          fallback.type = 'button'; fallback.className = 'btn btn-ghost inspiration-source-fallback';
          fallback.setAttribute('data-action', 'inspiration-open-source'); fallback.setAttribute('data-id', item.id);
          fallback.textContent = copy('Открыть источник');
          host.querySelector('[data-media-status]')?.appendChild(fallback);
        }
      };
      active.listener = (event) => {
        if (current !== active || !source || source.provider !== 'tiktok') return;
        const message = personal?TikTokFrame.parseMessage(event,frame.contentWindow,personal.id,window.location?.origin):Media.parsePlayerEvent(event, frame.contentWindow, source);
        if (!message) return;
        if (message.type === 'ended') { close({ message: copy('Эдит закончился. Можно сохранить его или вернуться к своему дню.') }); return; }
        if (message.type === 'error') { fail(); return; }
        if (message.type === 'ready' || message.type === 'playing') { cancel(active.timer); status(host, ''); }
        if(personal&&message.type==='buffering'){cancel(active.timer);active.timer=later(fail,timeoutMs);}
        if(personal&&message.type==='paused')cancel(active.timer);
        if(personal&&message.type==='time'&&message.currentTime>0)cancel(active.timer);
      };
      frame.addEventListener('error', fail);
      if(videoUrl){frame.addEventListener('loadedmetadata',()=>{if(current===active){cancel(active.timer);status(host,'');}});frame.addEventListener('ended',()=>{if(current===active)close();});}
      frame.addEventListener('load', () => {
        if(current===active&&personal){status(host,copy('Нажми Play в плеере TikTok.'));return;}
        if (current === active && source?.provider !== 'tiktok') { cancel(active.timer); status(host, ''); }
      });
      current = active; window.addEventListener('message', active.listener);
      window.addEventListener('keydown', active.keydown);
      window.addEventListener('pagehide',active.pagehide);document.addEventListener?.('visibilitychange',active.visibility);
      layer.appendChild(frame); layer.appendChild(button); (modal ? document.body : host).appendChild(layer); host.classList.add('has-player');
      status(host, copy('Загрузка из источника…')); if(!personal)active.timer = later(fail, timeoutMs);
      frame.src = imageUrl || url;
      if (modal) { if (typeof layer.showModal === 'function') layer.showModal(); else layer.setAttribute('open', ''); }
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
