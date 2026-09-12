/* Supply admission and digest coordination; Profile remains the only selector. */
(function expose(root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./inspiration-supply-policy-v1.js') : root.InspirationSupplyPolicyV1,
    node ? require('./inspiration-profile-v1.js') : root.InspirationProfileV1,
    node ? require('./inspiration-catalog-v1.js') : root.InspirationCatalogV1,
    node ? require('./inspiration-supply-batch-v1.js') : root.InspirationSupplyBatchV1);
  if (node) module.exports = api;
  if (root) root.InspirationSupplyRuntimeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build(Policy, Profile, Catalog, Batch) {
  'use strict';
  const VERSION = '1.0.0';
  function candidates() {
    return Catalog.CATALOG.map((row) => Policy.fromCatalogV1Row(row).draft).concat(Batch.CANDIDATES);
  }
  function prepare(options) {
    const opts = options || {};
    if (!Policy || !Profile || !Catalog || !Batch) return { ok: false, error: 'supply_not_loaded' };
    if (!Policy.isDay(opts.day)) return { ok: false, error: 'invalid_day' };
    const profile = Profile.normalize(opts.profile);
    const locale = Catalog.language(opts.locale);
    const locales = Array.isArray(opts.locales) && opts.locales.length ? opts.locales : [locale];
    const raw = opts.candidates === undefined ? candidates() : opts.candidates;
    if (!Array.isArray(raw)) return { ok: false, error: 'invalid_context' };
    // Test examples are never a production supply, even if all their fields look valid.
    const synthetic = raw.filter((c) => c && (c.synthetic === true || c.verified === false));
    const ctx = Object.assign({}, opts.ctx || {}, { now: opts.now });
    const admission = Policy.admit(raw.filter((c) => !synthetic.includes(c)), ctx);
    if (!admission.ok) return admission;
    const rejected = admission.rejected.concat(synthetic.map((c) => ({ id: c.id, code: 'unverified_fixture', detail: '' })));
    const catalog = Policy.toCatalogRows(admission.items, locale);
    const byId = new Map(catalog.map((row) => [row.id, row]));
    const wanted = new Set(profile.interests.map((i) => i.id));
    const relevant = admission.items.filter((c) => profile.formats.includes(c.format) && c.interestIds.some((id) => wanted.has(id)));
    // Reuse Profile's own topic, keyword and feedback rules without implementing
    // another selector. A one-item choice is only an eligibility question.
    const matching = relevant.filter((c) => Profile.choose([byId.get(c.id)], profile, opts.day).length);
    const shown = (Array.isArray(opts.shown) ? opts.shown : []).concat(
      profile.feedback.map((row) => ({ id: row.itemId, day: row.day })),
      profile.digest && profile.digest.day !== opts.day ? profile.digest.ids.map((id) => ({ id, day: profile.digest.day })) : []);
    const eligible = Policy.eligibleToday(matching, {
      day: opts.day, locales, shown, requestedIds: opts.requestedIds, ctx,
    });
    const poolRows = Policy.toCatalogRows(eligible.pool, locale);
    const report = Policy.shortageReport(eligible.pool, {
      interests: [...wanted], formats: profile.formats, ctx,
    });
    const relevantIds = new Set(relevant.map((c) => c.id));
    const pendingMatch = raw.some((c) => c && profile.formats.includes(c.format)
      && Array.isArray(c.interestIds) && c.interestIds.some((id) => wanted.has(id))
      && rejected.some((r) => r.id === c.id));
    const languageGap = eligible.blocked.some((row) => row.code === Policy.BLOCK.LANGUAGE);
    const emptyReason = report.status !== 'empty' ? null : languageGap ? 'language_gap'
      : eligible.blocked.length ? 'temporarily_exhausted'
        : matching.length < relevantIds.size ? 'profile_filters'
          : pendingMatch ? 'supply_unverified' : 'no_matching_material';
    return { ok: true, profile, locale, locales, admission: Object.assign({}, admission, { rejected }),
      catalog, poolRows, report: Object.assign({}, report, { emptyReason }), blocked: eligible.blocked };
  }
  function ensureDigest(options) {
    const opts = options || {};
    const prepared = prepare(opts);
    if (!prepared.ok) return prepared;
    const profile = prepared.profile;
    if (profile.digest && profile.digest.day === opts.day) {
      // Feedback affects later digests; safety/language admission applies now.
      // Retain the receipt's ids/doneIds even if a source disappears. Never refill
      // a fixed day or resurrect rejected media through Profile.ensureDigest.
      const readable = Policy.eligibleToday(prepared.admission.items, {
        day: opts.day, locales: prepared.locales, ctx: { maxSharePerSource: 1 },
      });
      const byId = new Map(Policy.toCatalogRows(readable.pool, prepared.locale).map((r) => [r.id, r]));
      const items = profile.digest.ids.map((id) => byId.get(id)).filter(Boolean);
      const unavailableIds = profile.digest.ids.filter((id) => !byId.has(id));
      const report = Object.assign({}, prepared.report, {
        status: !items.length ? 'empty' : items.length < Profile.DIGEST_SIZE ? 'shortage'
          : new Set(items.map((item) => item.format)).size < Math.min(Profile.DIGEST_SIZE, profile.formats.length) ? 'thin_formats' : 'ok',
        deliverable: items.length, emptyReason: !items.length ?
          (readable.blocked.some((r) => profile.digest.ids.includes(r.id) && r.code === Policy.BLOCK.LANGUAGE)
            ? 'language_gap' : 'supply_unverified') : null,
      });
      return Object.assign({}, prepared, { profile, items, unavailableIds, report, fixed: true });
    }
    const result = Profile.ensureDigest(profile, prepared.poolRows, opts.day);
    return Object.assign({}, prepared, result, { unavailableIds: [], fixed: false });
  }
  function resolveSaved(item, catalog) {
    if (!item || !item.catalogId) return item;
    const source = (Array.isArray(catalog) ? catalog : []).find((row) => row.id === item.catalogId);
    if (!source) return Object.assign({}, item, {
      catalogItem: null, supplyUnavailable: true, mediaPolicy: 'unavailable',
      url: '', embedUrl: '', imageUrl: '', assetPath: '', sourceUrl: '', rightsUrl: '',
    });
    return Object.assign({}, item, source, { id: item.id, catalogId: item.catalogId,
      note: item.note, why: item.why, url: source.sourceUrl || '', catalogItem: source, supplyUnavailable: false });
  }
  // Operator queue, not a background network runner. Never refresh a timestamp
  // merely because a row was placed here or a server returned HEAD 200.
  function reviewQueue(raw, options) {
    const opts = options || {}, now = Policy.parseIso(opts.now);
    if (now === null) return { ok: false, error: 'invalid_time' };
    const lead = opts.leadDays === undefined ? 7 : Number(opts.leadDays);
    const horizon = Math.max(0, Number.isFinite(lead) ? lead : 7) * 86400000;
    const limit = Math.max(1, Math.min(10, Math.floor(Number(opts.limit) || 3)));
    const rows = (Array.isArray(raw) ? raw : []).filter((c) => c && c.delivery
      && !['text', 'local'].includes(c.delivery.policy)).map((c) => {
      const at = Policy.parseIso(c.lastCheckedAt);
      return { id: c.id, sourceUrl: c.delivery.sourceUrl || c.sourceUrl || '',
        dueAtMs: at === null || c.available !== true ? 0 : at + 30 * 86400000,
        requiredCheck: c.delivery.policy === 'embed' || ['video', 'edit', 'podcast'].includes(c.format) ? 'playback_in_satoru' : 'manual_image_and_source',
      };
    }).filter((c) => c.dueAtMs <= now + horizon)
      .sort((a, b) => a.dueAtMs - b.dueAtMs || a.id.localeCompare(b.id));
    return { ok: true, items: rows.slice(0, limit), remaining: Math.max(0, rows.length - limit) };
  }
  return Object.freeze({ VERSION, candidates, prepare, ensureDigest, resolveSaved, reviewQueue });
});
