/* Satoru Inspiration Import v1 — local TikTok archive/link analysis.
 *
 * Privacy contract:
 * - archives are read in the browser and are never uploaded by this module;
 * - only allow-listed taste/activity sections are inspected;
 * - direct messages, login history, addresses, contacts and payment data are ignored;
 * - public TikTok links may be resolved through TikTok's official oEmbed endpoint;
 * - raw archive rows are never returned or persisted.
 */
(function exposeInspirationImport(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationImportV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildInspirationImport() {
  'use strict';

  const VERSION = '1.0.0';
  const MAX_FILE_BYTES = 96 * 1024 * 1024;
  const MAX_ENTRY_BYTES = 12 * 1024 * 1024;
  const MAX_TOTAL_TEXT_BYTES = 24 * 1024 * 1024;
  const MAX_LINKS = 32;
  const MAX_SIGNALS = 64;
  const MAX_OEMBED_LINKS = 24;
  const TEXT_EXT = /\.(?:json|txt|csv)$/i;
  const TIKTOK_LINK = /https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s"'<>\])}]+/ig;

  const text = (value, max = 160) => String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const fold = (value) => text(value, 1000).toLocaleLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = (value) => fold(value).replace(/[^a-z0-9а-яёіїєґ]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 56);

  const TAXONOMY = Object.freeze([
    ['sport', /спорт|fitness|фитнес|gym|workout|training|трениров|football|soccer|basketball|tennis|volley|mma|boxing|бокс|martial|calisthen|crossfit|powerlift|bodybuild|athlet|swim|плаван|surf|ski|snowboard|скейт|climb|паркур|flip|сальто/i],
    ['fitness', /fitness|фитнес|gym|workout|training|трениров|calisthen|crossfit|powerlift|bodybuild|mobility|растяж|stretch/i],
    ['movement', /movement|движ|рух|dance|танц|choreograph|mobility|stretch|растяж|parkour|паркур|acrobat|акробат|yoga|йог/i],
    ['running', /running?|runner|jog|бег|біг|marathon|марафон|laufen|correr/i],
    ['yoga', /yoga|йог|asana|асана|pilates|пилатес/i],
    ['recovery', /recover|recovery|восстанов|віднов|rehab|реабил|sleep|сон|massage|массаж|breathwork|дыхани|mental health|выгора/i],
    ['rest', /rest|отдых|відпоч|relax|расслаб|cozy|уют|slow living|sleep|сон/i],
    ['health', /health|здоров|nutrition|питани|mental health|psycholog|психолог|therapy|терап|medicine|медицин|biohack|wellness/i],
    ['video', /video|видео|tiktok|youtube|reels?|shorts?|film|movie|cinema|кино|сериал|series|anime edit|монтаж|editing|cinematograph/i],
    ['content', /content|контент|creator|блог|blog|social media|tiktok|youtube|reels?|shorts?|meme|мем|comedy|юмор|storytell/i],
    ['creative', /creative|твор|созидан|create|maker|art|дизайн|design|craft|diy|cosplay|косплей|fashion|мод|beauty|макияж|makeup|cooking|готов|recipe|рецепт|photo|фото|music|музык/i],
    ['art', /\bart\b|artist|рисов|drawing|paint|illustrat|искусств|мистец|kunst|arte|photo|фото|sculpt|скульп|tattoo|тату|architecture|архитект/i],
    ['design', /design|дизайн|ui\b|ux\b|graphic|графич|interior|интерьер|fashion|мод|style|стиль|aesthetic|эстетик|architecture|архитект/i],
    ['music', /music|музык|музик|song|песн|guitar|гитар|piano|пиани|beat|бит|vocal|вокал|concert|концерт|rap\b|рэп|techno|metal|rock\b/i],
    ['animation', /animation|анимац|animat|blender|3d\b|motion design|моушн|vfx|cgi|pixar|ghibli/i],
    ['science', /science|наук|wissenschaft|ciencia|physics|физик|chem|хими|biology|биолог|astronom|астроном|space|космос|research|исслед|neuroscience|нейро/i],
    ['technology', /technology|технолог|\btech\b|program|программ|coding|code\b|код|developer|разработ|robot|робот|ai\b|ии\b|штучн|gadget|гаджет|computer|компьют|engineering|инженер|car|авто|motorcycle|мото/i],
    ['learning', /learning|learn|обуч|учить|навчан|education|образован|tutorial|гайд|how to|курс|course|history|истори|language|язык|мов|psycholog|психолог|philosoph|философ/i],
    ['study', /study|уч[её]б|навч|university|универ|school|школ|exam|экзам|student|студент|lecture|лекц|конспект/i],
    ['reading', /reading?|чтен|чит|книг|book|literature|литератур|poetry|поэз|novel|роман|manga|манга|comic|комикс/i],
    ['philosophy', /philosoph|философ|stoic|стоиц|psycholog|психолог|meaning of life|смысл жизни|self.?improv|саморазвит|discipline|дисциплин/i],
    ['space', /space|космос|astronom|астроном|nasa|spacex|planet|планет|universe|вселен/i],
    ['travel', /travel|путеш|подорож|trip\b|vacation|отпуск|italy|итал|croatia|хорват|japan|япон|germany|герман|city break|road trip|туризм|tourism/i],
    ['nature', /nature|природ|wildlife|животн|animal|pet|кот|собак|ocean|океан|forest|лес|camping|кемпинг|fishing|рыбал|rainbow|радуг|diving|дайв/i],
    ['mountains', /mountain|гор[аы]|berge?|alps|альп|summit|вершин|hiking|поход|wandern|climb|скалолаз/i],
    ['hiking', /hiking|поход|похід|wandern|trek|треккинг|trail|тропа|camping|кемпинг/i],
    ['games', /games?|gaming|игр|ігр|playstation|xbox|nintendo|steam|rpg\b|dnd|d&d|dungeon|настол|board game|cosplay|косплей/i],
    ['minecraft', /minecraft|майнкрафт|майн/i],
    ['anime', /anime|аниме|manga|манга|re.?zero|naruto|наруто|one piece|ghibli|cosplay|косплей/i],
    ['superhero', /superhero|супергер|marvel|dc\b|spider.?man|spider.?verse|человек.?паук|batman|бэтмен/i],
    ['business', /business|бизнес|бізнес|entrepreneur|предприним|startup|стартап|marketing|маркетинг|sales|продаж|career|карьер|freelance|фриланс|money|деньг|income|заработ/i],
    ['product', /product|продукт|startup|стартап|saas|app\b|приложен|ux\b|customer|клиент|maker|launch|запуск/i],
    ['finance', /finance|финанс|фінанс|invest|инвест|stock|акци|crypto|крипт|budget|бюджет|money|деньг|econom|эконом/i],
    ['diy', /\bdiy\b|своими руками|craft|ремонт|woodwork|дерев|maker|сделай сам|upcycl|restoration|реставрац|mechanic|механик/i],
    ['social', /social|общени|спілку|people|люди|friend|друз|relationship|отношен|знакомств|community|сообществ|party|вечерин|dating|свидан/i],
    ['focus', /focus|фокус|концентрац|зосеред|deep work|productiv|продуктив|discipline|дисциплин|adhd|сдвг|dopamine|дофамин/i],
    ['home', /home|дом|дім|room|комнат|interior|интерьер|decor|декор|cleaning|уборк|organization|организац|перестанов|garden|сад/i],
  ].map(([id, pattern]) => Object.freeze({ id, pattern })));

  const KIND_WEIGHT = Object.freeze({ interests: 9, ad_interests: 7, hashtags: 7, searches: 5, favourites: 4, likes: 3, shares: 3, watch: 1, profile: 3, links: 3 });
  const EXCLUDED_CONTEXT = /direct.?message|chat history|login history|ip address|payment|credit card|address|autofill|phone|telephone|email|contact|order|wallet|transaction|support history/i;

  function categoryFor(value) {
    const name = fold(value);
    if (!name || EXCLUDED_CONTEXT.test(name)) return '';
    if (/ad interest/.test(name)) return 'ad_interests';
    if (/content preference|\binterests?\b|manage topics/.test(name)) return 'interests';
    if (/search/.test(name)) return 'searches';
    if (/hashtag/.test(name)) return 'hashtags';
    if (/favo(?:u)?rite/.test(name)) return 'favourites';
    if (/like list|liked video/.test(name)) return 'likes';
    if (/watch history|watched video/.test(name)) return 'watch';
    if (/share history|shared content/.test(name)) return 'shares';
    if (/bio description|profile bio/.test(name)) return 'profile';
    return '';
  }

  function newAccumulator() {
    return { signals: new Map(), canonical: new Map(), links: new Map(), counts: Object.create(null), files: 0 };
  }

  function safePhrase(value) {
    let phrase = text(value, 180).replace(/^#+/, '#');
    if (!phrase || /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(phrase) || /^https?:\/\//i.test(phrase)) return '';
    if (/^(?:true|false|yes|no|null|undefined|enabled|disabled)$/i.test(phrase)) return '';
    if (/^[\d\W_]+$/.test(phrase) || phrase.length < 2) return '';
    return phrase;
  }

  function addCanonical(acc, phrase, kind, weight) {
    for (const row of TAXONOMY) {
      if (!row.pattern.test(phrase)) continue;
      const current = acc.canonical.get(row.id) || { id: row.id, score: 0, count: 0, evidence: [], sources: new Set() };
      current.score += weight; current.count += 1; current.sources.add(kind);
      if (current.evidence.length < 3 && !current.evidence.includes(phrase)) current.evidence.push(phrase);
      acc.canonical.set(row.id, current);
    }
  }

  function addSignal(acc, value, kind, customWeight) {
    const phrase = safePhrase(value); if (!phrase) return;
    const weight = Number(customWeight) || KIND_WEIGHT[kind] || 1;
    const key = fold(phrase).replace(/^#/, ''); if (!key) return;
    const current = acc.signals.get(key) || { id: slug(phrase), label: phrase, score: 0, count: 0, sources: new Set() };
    current.score += weight; current.count += 1; current.sources.add(kind);
    if (phrase.length < current.label.length || current.label === current.label.toLowerCase()) current.label = phrase;
    acc.signals.set(key, current); acc.counts[kind] = (acc.counts[kind] || 0) + 1;
    addCanonical(acc, phrase, kind, weight);
  }

  function cleanTikTokLink(value) {
    const raw = text(value, 800).replace(/[.,;:!?]+$/, '');
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (!['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(host)) return '';
      url.hash = ''; ['is_from_webapp', 'sender_device', 'sender_web_id', '_r', '_t'].forEach((key) => url.searchParams.delete(key));
      return url.href.slice(0, 900);
    } catch { return ''; }
  }

  function addLink(acc, value, kind) {
    const link = cleanTikTokLink(value); if (!link) return;
    const current = acc.links.get(link) || { url: link, score: 0, kinds: new Set() };
    current.score += KIND_WEIGHT[kind] || 1; current.kinds.add(kind); acc.links.set(link, current);
    acc.counts.videos = (acc.counts.videos || 0) + (current.score === (KIND_WEIGHT[kind] || 1) ? 1 : 0);
  }

  function addString(acc, value, context) {
    const category = categoryFor(context); if (!category) return;
    const raw = String(value == null ? '' : value);
    const links = raw.match(TIKTOK_LINK) || [];
    for (const link of links) addLink(acc, link, category);
    if (['interests', 'ad_interests', 'hashtags', 'searches', 'profile'].includes(category)) {
      const fieldLikeList = /interest|categor|hashtag/i.test(context);
      const parts = fieldLikeList ? raw.split(/[,;|\n]/) : [raw];
      for (const part of parts) addSignal(acc, part, category);
    }
  }

  function walkJson(acc, value, path = [], depth = 0) {
    if (depth > 14 || value == null) return;
    if (typeof value === 'string' || typeof value === 'number') { addString(acc, value, path.join(' / ')); return; }
    if (Array.isArray(value)) { for (const item of value.slice(0, 8000)) walkJson(acc, item, path, depth + 1); return; }
    if (typeof value !== 'object') return;
    let count = 0;
    for (const [key, child] of Object.entries(value)) {
      if (++count > 8000) break;
      const next = path.concat(text(key, 120));
      if (EXCLUDED_CONTEXT.test(next.join(' / '))) continue;
      walkJson(acc, child, next, depth + 1);
    }
  }

  function parseText(acc, name, value) {
    const baseCategory = categoryFor(name);
    const lines = String(value || '').split(/\r?\n/).slice(0, 120000);
    for (const line of lines) {
      const trimmed = line.trim(); if (!trimmed) continue;
      const match = trimmed.match(/^([^:\t]{2,80})\s*[:\t]\s*(.+)$/);
      const key = match ? `${name} / ${match[1]}` : name;
      const body = match ? match[2] : trimmed;
      const category = categoryFor(key) || baseCategory;
      if (!category) continue;
      addString(acc, body, `${key} / ${category}`);
    }
  }

  function finalize(acc, source = 'tiktok') {
    const signals = [...acc.signals.values()].sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, MAX_SIGNALS).map((row) => ({ id: row.id, label: row.label, score: Math.round(row.score), count: row.count, sources: [...row.sources].slice(0, 6) }));
    const interests = [...acc.canonical.values()].sort((a, b) => b.score - a.score || b.count - a.count || a.id.localeCompare(b.id))
      .slice(0, 16).map((row) => ({ id: row.id, score: Math.round(row.score), count: row.count, evidence: row.evidence.slice(), sources: [...row.sources].slice(0, 6) }));
    const links = [...acc.links.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, MAX_LINKS)
      .map((row) => ({ url: row.url, score: row.score, kinds: [...row.kinds] }));
    const stats = { files: acc.files, signals: acc.signals.size, searches: acc.counts.searches || 0, hashtags: acc.counts.hashtags || 0,
      videos: links.length, explicitInterests: (acc.counts.interests || 0) + (acc.counts.ad_interests || 0) };
    return { version: 1, source, interests, signals, links, stats };
  }

  function analyzeEntries(entries, source = 'tiktok') {
    const acc = newAccumulator();
    for (const entry of Array.isArray(entries) ? entries.slice(0, 400) : []) {
      const name = text(entry && entry.name, 500); if (!name || !TEXT_EXT.test(name) || EXCLUDED_CONTEXT.test(name)) continue;
      const value = String(entry && entry.text || ''); if (!value) continue;
      acc.files += 1;
      if (/\.json$/i.test(name)) {
        try { walkJson(acc, JSON.parse(value), [name]); }
        catch { parseText(acc, name, value); }
      } else parseText(acc, name, value);
    }
    return finalize(acc, source);
  }

  function findEocd(bytes) {
    for (let i = bytes.length - 22, min = Math.max(0, bytes.length - 65557); i >= min; i -= 1) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
    }
    return -1;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('zip_unsupported');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzipTextEntries(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), eocd = findEocd(bytes);
    if (eocd < 0) throw new Error('zip_invalid');
    const total = view.getUint16(eocd + 10, true), centralOffset = view.getUint32(eocd + 16, true);
    if (total > 400 || centralOffset >= bytes.length) throw new Error('zip_large');
    const decoder = new TextDecoder('utf-8'), entries = []; let cursor = centralOffset, totalText = 0;
    for (let index = 0; index < total && cursor + 46 <= bytes.length; index += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('zip_invalid');
      const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true), name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      cursor += 46 + nameLength + extraLength + commentLength;
      if (!TEXT_EXT.test(name) || EXCLUDED_CONTEXT.test(name) || size > MAX_ENTRY_BYTES || totalText + size > MAX_TOTAL_TEXT_BYTES) continue;
      if ((flags & 1) || ![0, 8].includes(method) || localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) continue;
      const localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength, compressed = bytes.slice(dataStart, dataStart + compressedSize);
      const unpacked = method === 0 ? compressed : await inflateRaw(compressed);
      if (unpacked.length > MAX_ENTRY_BYTES) continue;
      totalText += unpacked.length; entries.push({ name, text: decoder.decode(unpacked) });
    }
    if (!entries.length) throw new Error('zip_empty');
    return entries;
  }

  async function parseFile(file) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('file_invalid');
    if (Number(file.size) > MAX_FILE_BYTES) throw new Error('file_large');
    const name = text(file.name || 'TikTok data', 500);
    if (/\.zip$/i.test(name)) return analyzeEntries(await unzipTextEntries(await file.arrayBuffer()));
    if (!TEXT_EXT.test(name)) throw new Error('file_type');
    const value = typeof file.text === 'function' ? await file.text() : new TextDecoder().decode(await file.arrayBuffer());
    return analyzeEntries([{ name, text: value }]);
  }

  function linksFromText(value) {
    const found = String(value || '').match(TIKTOK_LINK) || [], out = [], seen = new Set();
    for (const raw of found) { const link = cleanTikTokLink(raw); if (!link || seen.has(link)) continue; seen.add(link); out.push(link); if (out.length >= MAX_LINKS) break; }
    return out;
  }

  function analyzeLinkMetadata(rows) {
    const acc = newAccumulator(); acc.files = 0;
    for (const row of Array.isArray(rows) ? rows : []) {
      const url = cleanTikTokLink(row && row.url); if (url) addLink(acc, url, 'links');
      const title = text(row && row.title, 500); if (title) {
        addSignal(acc, title.replace(/#[\p{L}\p{N}_-]+/gu, '').trim(), 'links', 2);
        for (const tag of title.match(/#[\p{L}\p{N}_-]+/gu) || []) addSignal(acc, tag, 'hashtags');
      }
      const author = text(row && row.author_name, 120); if (author && /(?:fitness|travel|art|music|tech|science|anime|game|food|fashion)/i.test(author)) addSignal(acc, author, 'links', 1);
    }
    return finalize(acc, 'tiktok-links');
  }

  async function resolveTikTokLinks(links, fetchImpl) {
    const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetcher) return [];
    const queue = (Array.isArray(links) ? links : []).map((row) => cleanTikTokLink(row && row.url || row)).filter(Boolean).slice(0, MAX_OEMBED_LINKS);
    const output = new Array(queue.length); let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const index = cursor++, url = queue[index];
        try {
          const controller = typeof AbortController === 'function' ? new AbortController() : null;
          const timer = controller ? setTimeout(() => controller.abort(), 6500) : null;
          const response = await fetcher(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, controller ? { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' } : undefined);
          if (timer) clearTimeout(timer);
          if (!response || !response.ok) continue;
          const data = await response.json(); output[index] = { url, title: text(data && data.title, 500), author_name: text(data && data.author_name, 120) };
        } catch { /* A removed/private video is simply unavailable as evidence. */ }
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker()));
    return output.filter(Boolean);
  }

  function mergeResults(base, extra) {
    const acc = newAccumulator();
    const absorb = (result) => {
      for (const signal of (result && result.signals) || []) {
        for (let i = 0; i < Math.max(1, Number(signal.count) || 1); i += 1) addSignal(acc, signal.label, (signal.sources || [result.source || 'links'])[0], Math.max(1, Number(signal.score) / Math.max(1, Number(signal.count) || 1)));
      }
      for (const link of (result && result.links) || []) addLink(acc, link.url, (link.kinds || ['links'])[0]);
      acc.files += Number(result && result.stats && result.stats.files) || 0;
    };
    absorb(base); absorb(extra);
    const merged = finalize(acc, (base && base.source) || (extra && extra.source) || 'tiktok');
    merged.stats = Object.assign({}, base && base.stats, merged.stats, { enrichedVideos: (extra && extra.links && extra.links.length) || 0 });
    return merged;
  }

  return Object.freeze({
    VERSION, MAX_FILE_BYTES, MAX_ENTRY_BYTES, MAX_TOTAL_TEXT_BYTES, MAX_LINKS, MAX_SIGNALS, MAX_OEMBED_LINKS,
    TAXONOMY, categoryFor, cleanTikTokLink, linksFromText, analyzeEntries, analyzeLinkMetadata,
    parseFile, resolveTikTokLinks, mergeResults,
  });
});
