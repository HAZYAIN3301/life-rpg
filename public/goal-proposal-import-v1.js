/* Normalize the bounded JSON proposal that an outside AI supplies. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GoalProposalImportV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const MAX_PROPOSALS = 300;
  function numberWithUnit(value, declaredUnit = '') {
    if (typeof value === 'number') return Number.isFinite(value) ? { value, unit: '' } : null;
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^([+-]?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?)\s*([^\d]*)$/u);
    if (!match) return null;
    const number = Number(match[1].replace(/[ \u00a0\u202f]/g, '').replace(',', '.'));
    const suffix = match[2].trim();
    const unit = String(declaredUnit || '').trim();
    if (!Number.isFinite(number) || Math.abs(number) > 1e12 || suffix.length > 12
      || (suffix && unit && suffix.toLocaleLowerCase() !== unit.toLocaleLowerCase())) return null;
    return { value: number, unit: unit || suffix };
  }
  function normalize(proposals) {
    if (!Array.isArray(proposals)) return { proposals: [], issues: [{ index: -1, field: 'format' }] };
    if (proposals.length > MAX_PROPOSALS) return { proposals: [], issues: [{ index: -1, field: 'limit' }] };
    const issues = [];
    const normalized = proposals.map((proposal, index) => {
      if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
        issues.push({ index, field: 'format' }); return proposal;
      }
      if (proposal.type !== 'goal' || !proposal.metric || proposal.metric.target == null) return proposal;
      const metric = proposal.metric;
      if (typeof metric !== 'object' || Array.isArray(metric)) {
        issues.push({ index, field: 'metric' }); return proposal;
      }
      const target = numberWithUnit(metric.target, metric.unit);
      const current = metric.current == null || metric.current === ''
        ? { value: 0, unit: '' } : numberWithUnit(metric.current, metric.unit || target?.unit);
      if (!target || !current || (current.unit && target.unit && current.unit !== target.unit)) {
        issues.push({ index, field: 'metric' }); return proposal;
      }
      return { ...proposal, metric: { ...metric, current: current.value,
        target: target.value, unit: String(metric.unit || target.unit || current.unit || '').trim().slice(0, 12) } };
    });
    return { proposals: normalized, issues };
  }
  return Object.freeze({ MAX_PROPOSALS, numberWithUnit, normalize });
});
