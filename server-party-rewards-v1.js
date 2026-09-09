'use strict';
const Policy = require('./public/party-reward-policy-v1.js');

// Synchronous dependencies: no await between authoritative read and durable write.
// The existing single-process JSON deployment serializes claims in its event loop.
// A multi-writer deployment requires a transactional database, not this adapter.
function createService({ read, write, now }) {
  function snapshot(uid) { return Policy.validate(read(uid) ?? Policy.empty()); }
  function claim(uid, input) {
    const result = Policy.grant(snapshot(uid), { ...input, at: now() });
    if (!result.replay) write(uid, result.ledger);
    // If write committed then threw (directory-fsync/response ambiguity), don't
    // roll back or issue another credit. Retry reads the one persisted receipt.
    return result;
  }
  function migrateLegacy(parties, exists) {
    for (const party of parties) {
      const cycle = party.raid?.ws;
      if (!Policy.cycleValid(cycle)) continue;
      for (const uid of party.raid?.claimed || []) if (exists(uid)) {
        claim(uid, { cycle, partyId: party.id, legacy: true });
      }
    }
  }
  return Object.freeze({ snapshot, claim, migrateLegacy });
}
module.exports = { createService };
