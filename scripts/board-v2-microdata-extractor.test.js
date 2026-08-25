'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BoardDiscovery = require('../public/board-v2-discovery.js');
const Microdata = require('../server-board-v2-microdata-v1.js');
const PageVerifier = require('../server-board-v2-page-verifier-v1.js');

const ROOT = path.resolve(__dirname, '..');
const NOW = '2026-08-25T14:00:00.000Z';
const URL = 'https://hsp.sport.uni-bielefeld.de/course/boxing';

function request(intent) {
  return BoardDiscovery.createRequest({
    enabled: true, city: 'Bielefeld', countryCode: 'DE', timezone: 'Europe/Berlin', locale: 'de-DE', approvedAt: NOW,
    provider: BoardDiscovery.PROVIDER_ID, shareCityWithProvider: true,
  }, {
    requestId: `microdata-${intent}-01`, templateId: 'try-specific-local-class', slotId: 'class',
    intent, searchTerms: ['trial-class', 'boxing'],
  });
}

function eventMicrodata(overrides) {
  const input = Object.assign({
    title: 'Boxtraining Anfänger', startsAt: '2026-08-26T17:30:00+02:00',
    organizerUrl: 'https://hsp.sport.uni-bielefeld.de/', address: 'Universitätsstraße 25, 33615 Bielefeld',
    price: '5', currency: 'EUR', availability: 'https://schema.org/InStock', action: '/course/boxing',
  }, overrides || {});
  return `<!doctype html><main itemscope itemtype="https://schema.org/Event">
    <h1 itemprop="name">${input.title}</h1>
    <time itemprop="startDate" datetime="${input.startsAt}">26. August</time>
    <span itemprop="organizer" itemscope itemtype="https://schema.org/Organization">
      <link itemprop="url" href="${input.organizerUrl}">
    </span>
    <div itemprop="location" itemscope itemtype="https://schema.org/SportsActivityLocation">
      <address itemprop="address">${input.address}</address>
    </div>
    <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
      <meta itemprop="price" content="${input.price}">
      <meta itemprop="priceCurrency" content="${input.currency}">
      <link itemprop="availability" href="${input.availability}">
      <a itemprop="url" href="${input.action}">Anmelden</a>
    </div>
  </main>`;
}

test('schema.org Microdata supplies explicit evidence when JSON-LD is absent', () => {
  const documents = Microdata.microdataDocuments(eventMicrodata(), URL);
  assert.equal(documents.length, 1);
  assert.equal(documents[0]['@type'], 'event');
  assert.equal(documents[0].organizer.url, 'https://hsp.sport.uni-bielefeld.de/');
  assert.equal(documents[0].offers.url, URL);
  const raw = PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: eventMicrodata(), checkedAt: NOW });
  assert.equal(raw.title, 'Boxtraining Anfänger');
  assert.equal(raw.address, 'Universitätsstraße 25, 33615 Bielefeld');
  assert.deepEqual(raw.price, { type: 'fixed', amount: 5, currency: 'EUR', label: '5 EUR' });
  assert.equal(BoardDiscovery.verifyCandidate(request('class'), raw).availability, 'confirmed');
});

test('relative action URL is resolved against the verified official page', () => {
  const raw = PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: eventMicrodata({ action: '../book/boxing' }), checkedAt: NOW });
  assert.equal(raw.action.url, 'https://hsp.sport.uni-bielefeld.de/book/boxing');
});

test('Microdata cannot self-declare an aggregator as the organizer', () => {
  const html = eventMicrodata({ organizerUrl: 'https://uni-bielefeld.de/', action: 'https://tickets.example.net/boxing' });
  assert.equal(PageVerifier.extractDirectCandidate({ request: request('class'), url: 'https://tickets.example.net/boxing', html, checkedAt: NOW }), null);
});

test('missing price/availability, sold-out status, wrong city or unstructured prose fail closed', () => {
  assert.equal(PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: eventMicrodata({ price: '' }), checkedAt: NOW }), null);
  assert.equal(PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: eventMicrodata({ availability: '' }), checkedAt: NOW }), null);
  assert.equal(PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: eventMicrodata({ availability: 'https://schema.org/SoldOut' }), checkedAt: NOW }), null);
  assert.equal(PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: eventMicrodata({ address: 'Alexanderplatz 1, Berlin' }), checkedAt: NOW }), null);
  const prose = '<h1>Boxtraining</h1><p>26.08.2026 · 17:30 · 5 EUR · Bielefeld · jetzt anmelden</p>';
  assert.equal(PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: prose, checkedAt: NOW }), null);
});

test('hidden/template/script markup and malformed entities cannot become evidence', () => {
  const poisoned = `<script>${eventMicrodata({ title: 'Injected' })}</script><template>${eventMicrodata({ title: 'Template' })}</template><textarea>${eventMicrodata({ title: 'Text' })}</textarea><div hidden>${eventMicrodata({ title: 'Hidden' })}</div>`;
  assert.deepEqual(Microdata.microdataDocuments(poisoned, URL), []);
  assert.deepEqual(Microdata.microdataDocuments(`<script>${eventMicrodata({ title: 'Unclosed script' })}`, URL), []);
  assert.equal(Microdata.decodeEntities('A &amp; B &#x1f680;'), 'A & B 🚀');
  assert.deepEqual(Microdata.microdataDocuments(eventMicrodata().replace('https://schema.org/Event', 'https://attacker.invalid/Event'), URL), []);
});

test('supported Event can live inside an unsupported schema.org WebPage scope', () => {
  const nested = `<div itemscope itemtype="https://schema.org/WebPage">${eventMicrodata()}</div>`;
  assert.equal(Microdata.microdataDocuments(nested, URL).length, 1);
});

test('listing pages with several Microdata events are not guessed into one quest', () => {
  const listing = eventMicrodata({ title: 'Boxing A' }) + eventMicrodata({ title: 'Boxing B', action: '/boxing-b' });
  assert.equal(Microdata.microdataDocuments(listing, URL).length, 2);
  assert.equal(PageVerifier.extractDirectCandidate({ request: request('class'), url: URL, html: listing, checkedAt: NOW }), null);
});

test('extractor is bounded and owns no network, DOM or AI dependency', () => {
  assert.deepEqual(Microdata.microdataDocuments('x'.repeat(Microdata.MAX_HTML + 1), URL), []);
  const source = fs.readFileSync(path.join(ROOT, 'server-board-v2-microdata-v1.js'), 'utf8');
  assert.doesNotMatch(source, /\brequire\(['"](?:https?|dns|net|openai|gemini|jsdom|cheerio)/);
  assert.doesNotMatch(source, /\bfetch\s*\(|innerHTML|DOMParser|prompt injection/i);
});
