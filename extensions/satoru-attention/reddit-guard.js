/* Satoru Attention 0.8.0 — Reddit NSFW guard (content script on reddit.com while the Adult
 * category is active). Reddit itself stays usable: subreddits and profiles that Reddit marks
 * 18+ (about.json `over18` / `subreddit.over_18`) are replaced by the Satoru block page, and
 * feed posts from such subreddits are hidden. Nothing is sent anywhere except Reddit's own
 * about.json on the same origin; the verdict cache stays in local extension storage.
 */
(function satoruRedditGuard() {
  'use strict';
  if (globalThis.__satoruRedditGuard) return;
  globalThis.__satoruRedditGuard = true;

  const BLOCK_URL = chrome.runtime.getURL('block.html') + '?reason=reddit';
  const CACHE_KEY = 'satoruRedditVerdictsV1';
  const TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_CACHE = 3000;
  const REVEAL_AFTER_MS = 4000; // fail open: an unknown answer never hides Reddit for good
  const POST_SELECTOR = 'shreddit-post, article, .thing, [data-testid="post-container"]';
  const memory = new Map();
  const pending = new Map();
  let cacheLoaded = null;
  let saveTimer = 0;

  function target(pathname) {
    const sub = /^\/r\/([A-Za-z0-9_]{2,21})(?:\/|$)/.exec(pathname);
    if (sub && !['all', 'popular', 'friends', 'mod', 'random', 'randnsfw'].includes(sub[1].toLowerCase())) {
      return { kind: 'r', name: sub[1].toLowerCase() };
    }
    if (sub && sub[1].toLowerCase() === 'randnsfw') return { kind: 'blocked', name: 'randnsfw' };
    const user = /^\/(?:user|u)\/([A-Za-z0-9_-]{3,20})(?:\/|$)/.exec(pathname);
    return user ? { kind: 'u', name: user[1].toLowerCase() } : null;
  }

  function loadCache() {
    if (!cacheLoaded) {
      cacheLoaded = chrome.storage.local.get(CACHE_KEY).then((stored) => {
        const now = Date.now();
        for (const [key, entry] of Object.entries(stored[CACHE_KEY] || {})) {
          if (entry && typeof entry.nsfw === 'boolean' && now - entry.at < TTL_MS) memory.set(key, entry);
        }
      }).catch(() => undefined);
    }
    return cacheLoaded;
  }

  function saveCacheSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const entries = [...memory.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_CACHE);
      chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) }).catch(() => undefined);
    }, 500);
  }

  async function fetchVerdict(item) {
    const path = item.kind === 'r' ? `/r/${item.name}/about.json?raw_json=1` : `/user/${item.name}/about.json?raw_json=1`;
    const response = await fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const body = await response.json();
    const data = body && body.data;
    if (!data) return null;
    return item.kind === 'r' ? data.over18 === true : !!(data.subreddit && data.subreddit.over_18 === true);
  }

  // true = 18+, false = not marked, null = unknown (network/API) — unknown never blocks.
  async function isNsfw(item) {
    if (item.kind === 'blocked') return true;
    const key = `${item.kind}:${item.name}`;
    await loadCache();
    if (memory.has(key)) return memory.get(key).nsfw;
    if (!pending.has(key)) {
      pending.set(key, fetchVerdict(item).then((nsfw) => {
        if (typeof nsfw === 'boolean') { memory.set(key, { nsfw, at: Date.now() }); saveCacheSoon(); }
        return nsfw;
      }).catch(() => null).finally(() => pending.delete(key)));
    }
    return pending.get(key);
  }

  function hideDocument() {
    if (document.getElementById('satoru-reddit-veil')) return;
    const veil = document.createElement('style');
    veil.id = 'satoru-reddit-veil';
    veil.textContent = 'html { visibility: hidden !important; }';
    (document.head || document.documentElement).appendChild(veil);
  }
  function revealDocument() { document.getElementById('satoru-reddit-veil')?.remove(); }

  let checkedHref = '';
  async function checkPage() {
    if (location.href === checkedHref) return;
    checkedHref = location.href;
    const item = target(location.pathname);
    if (!item) { revealDocument(); return; }
    hideDocument();
    const reveal = setTimeout(revealDocument, REVEAL_AFTER_MS);
    const nsfw = await isNsfw(item);
    clearTimeout(reveal);
    if (nsfw === true && checkedHref === location.href) { location.replace(BLOCK_URL); return; }
    revealDocument();
  }

  function postSubreddit(post) {
    const named = post.getAttribute('subreddit-prefixed-name') || post.getAttribute('data-subreddit-prefixed')
      || (post.getAttribute('data-subreddit') ? `r/${post.getAttribute('data-subreddit')}` : '');
    const fromName = /^r\/([A-Za-z0-9_]{2,21})$/.exec(named || '');
    if (fromName) return fromName[1].toLowerCase();
    const link = post.querySelector('a[href^="/r/"], a[href*="reddit.com/r/"]');
    const match = link && /\/r\/([A-Za-z0-9_]{2,21})(?:\/|$)/.exec(link.getAttribute('href'));
    return match ? match[1].toLowerCase() : '';
  }

  async function screenPost(post) {
    if (post.dataset.satoruScreened) return;
    post.dataset.satoruScreened = '1';
    const current = target(location.pathname);
    const sub = postSubreddit(post);
    if (!sub || (current && current.kind === 'r' && current.name === sub)) return; // the page gate covers it
    if (await isNsfw({ kind: 'r', name: sub })) {
      post.style.setProperty('display', 'none', 'important');
      post.dataset.satoruHidden = 'nsfw';
    }
  }

  let scanQueued = false;
  function scanPosts() {
    scanQueued = false;
    for (const post of document.querySelectorAll(POST_SELECTOR)) screenPost(post);
  }
  function queueScan() { if (!scanQueued) { scanQueued = true; setTimeout(scanPosts, 150); } }

  checkPage();
  new MutationObserver(queueScan).observe(document.documentElement, { childList: true, subtree: true });
  // Reddit is a single-page app: history navigation does not reload the content script.
  setInterval(checkPage, 400);
  addEventListener('popstate', checkPage);
})();
