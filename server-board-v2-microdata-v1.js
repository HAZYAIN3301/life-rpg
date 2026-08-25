'use strict';

/* Bounded HTML Microdata reader for Board v2 official-page evidence.
 *
 * This is not a general browser DOM and never infers facts from prose. It only
 * reads explicit schema.org itemtype/itemprop declarations from a bounded HTML
 * document. The page verifier remains responsible for source ownership, time,
 * price, availability and action validation.
 */

const VERSION = '1.0.0';
const MAX_HTML = 512 * 1024;
const MAX_NODES = 5000;
const MAX_DEPTH = 32;
const MAX_DOCUMENTS = 16;
const RAW_ELEMENTS = /<(script|style|noscript|template|svg|textarea|xmp|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HIDDEN_ELEMENTS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'textarea', 'xmp', 'iframe', 'object', 'plaintext', 'title']);
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const SUPPORTED_TYPES = new Set(['event', 'courseinstance', 'place', 'localbusiness', 'sportsactivitylocation', 'restaurant', 'library']);

function decodeEntities(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] || match;
    const radix = entity[1].toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
    const point = Number.parseInt(digits, radix);
    return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  });
}

function normalizeText(value, max) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseAttributes(source) {
  const attributes = Object.create(null);
  const body = String(source || '').replace(/^\s*[^\s/>]+/, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  let count = 0;
  while ((match = pattern.exec(body)) && count < 32) {
    const name = match[1].toLowerCase();
    if (!/^[a-z_:][a-z0-9_.:-]*$/.test(name) || Object.hasOwn(attributes, name)) continue;
    attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
    count += 1;
  }
  return attributes;
}

function parseTree(rawHtml) {
  const html = String(rawHtml || '');
  if (!html || Buffer.byteLength(html) > MAX_HTML) return null;
  const source = html.replace(RAW_ELEMENTS, ' ');
  const root = { tag: '#root', attrs: Object.create(null), children: [], text: [] };
  const stack = [root];
  const tokens = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/g;
  let nodes = 1;
  let match;
  while ((match = tokens.exec(source))) {
    const token = match[0];
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (!token.startsWith('<')) {
      if (stack.length <= MAX_DEPTH + 1) stack[stack.length - 1].text.push(token);
      continue;
    }
    const closing = /^<\s*\/\s*([a-zA-Z][\w:-]*)/.exec(token);
    if (closing) {
      const tag = closing[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag !== tag) continue;
        stack.length = index;
        break;
      }
      continue;
    }
    const opening = /^<\s*([a-zA-Z][\w:-]*)/.exec(token);
    if (!opening || nodes >= MAX_NODES || stack.length > MAX_DEPTH) continue;
    const tag = opening[1].toLowerCase();
    const node = { tag, attrs: parseAttributes(token.slice(1, -1)), children: [], text: [] };
    stack[stack.length - 1].children.push(node);
    nodes += 1;
    if (!VOID_ELEMENTS.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
  }
  return root;
}

function hidden(node) {
  return HIDDEN_ELEMENTS.has(node.tag) || Object.hasOwn(node.attrs, 'hidden')
    || String(node.attrs['aria-hidden'] || '').toLowerCase() === 'true';
}
function visibleText(node) {
  if (!node || hidden(node)) return '';
  const chunks = node.text.slice();
  for (const child of node.children) chunks.push(visibleText(child));
  return normalizeText(chunks.join(' '), 600);
}
function itemTypes(node) {
  return normalizeText(node.attrs.itemtype, 500).split(' ').map((value) => {
    const match = /^https?:\/\/schema\.org\/([A-Za-z][A-Za-z0-9_-]{0,79})\/?$/i.exec(value);
    return match ? match[1].toLowerCase() : '';
  }).filter(Boolean);
}
function properties(node) {
  return normalizeText(node.attrs.itemprop, 300).split(' ').filter((value) => /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value));
}
function resolveUrl(value, pageUrl) {
  const source = normalizeText(value, 1200);
  if (!source) return '';
  try { return new URL(source, pageUrl).href; } catch { return ''; }
}
function propertyValue(node, pageUrl) {
  if (Object.hasOwn(node.attrs, 'content')) return normalizeText(node.attrs.content, 600);
  if (Object.hasOwn(node.attrs, 'datetime')) return normalizeText(node.attrs.datetime, 80);
  if (Object.hasOwn(node.attrs, 'href')) return resolveUrl(node.attrs.href, pageUrl);
  if (Object.hasOwn(node.attrs, 'src')) return resolveUrl(node.attrs.src, pageUrl);
  if (Object.hasOwn(node.attrs, 'value')) return normalizeText(node.attrs.value, 120);
  return visibleText(node);
}
function assign(target, key, value) {
  if (value == null || value === '') return;
  if (!Object.hasOwn(target, key)) target[key] = value;
  else if (Array.isArray(target[key])) target[key].push(value);
  else target[key] = [target[key], value];
}
function microdataObject(root, pageUrl, depth) {
  if (!root || depth > 8) return null;
  const types = itemTypes(root);
  const output = types.length ? { '@type': types.length === 1 ? types[0] : types } : {};
  const itemId = resolveUrl(root.attrs.itemid, pageUrl);
  if (itemId) output.url = itemId;
  function visit(node) {
    for (const child of node.children) {
      if (hidden(child)) continue;
      const props = properties(child);
      const nested = Object.hasOwn(child.attrs, 'itemscope');
      if (props.length) {
        const value = nested ? microdataObject(child, pageUrl, depth + 1) : propertyValue(child, pageUrl);
        for (const prop of props) assign(output, prop, value);
      }
      if (!nested) visit(child);
    }
  }
  visit(root);
  return output;
}

function microdataDocuments(html, pageUrl) {
  const tree = parseTree(html);
  if (!tree) return [];
  const documents = [];
  function visit(node, insideScope) {
    if (documents.length >= MAX_DOCUMENTS || hidden(node)) return;
    const scope = Object.hasOwn(node.attrs, 'itemscope');
    const supported = scope && itemTypes(node).some((type) => SUPPORTED_TYPES.has(type));
    if (supported && !insideScope) {
      const props = properties(node);
      if (!props.length || props.includes('mainEntity')) {
        const document = microdataObject(node, pageUrl, 0);
        if (document) documents.push(document);
      }
      return;
    }
    for (const child of node.children) visit(child, insideScope || supported);
  }
  visit(tree, false);
  return documents;
}

module.exports = Object.freeze({
  VERSION,
  MAX_HTML,
  MAX_NODES,
  MAX_DEPTH,
  MAX_DOCUMENTS,
  decodeEntities,
  microdataDocuments,
});
