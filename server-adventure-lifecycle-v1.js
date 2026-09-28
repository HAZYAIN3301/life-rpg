'use strict';

const fs = require('node:fs'), path = require('node:path');
const Policy = require('./server-adventure-policy-v1.js');
const Store = require('./server-adventure-store-v1.js');
const FILE = 'party-adventure-lifecycle-v1.json';

// A single synchronous writer. Once the intent is durable, recovery rolls forward
// both membership and consent before either can be read or changed again.
function create({ dataDir, write, remove, validateParties }) {
  const journal = path.join(dataDir, FILE);
  function validate(value) {
    if (!value || Object.keys(value).sort().join('|') !== 'adventure|parties|version' || value.version !== 1)
      throw new Error('adventure_lifecycle_invalid');
    validateParties(value.parties);
    if (value.adventure !== null) Policy.validate(value.adventure);
    return value;
  }
  function recover() {
    let pending;
    try { pending = JSON.parse(fs.readFileSync(journal, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    validate(pending);
    // Consent first: an interrupted departure cannot leave sharing enabled.
    if (pending.adventure !== null) write(path.join(dataDir, Store.FILE), pending.adventure);
    write(path.join(dataDir, 'parties.json'), pending.parties);
    remove(journal);
  }
  function commit(parties, adventure) {
    recover();
    const pending = validate({ version: 1, parties, adventure });
    write(journal, pending);
    recover();
  }
  return Object.freeze({ recover, commit });
}
module.exports = Object.freeze({ FILE, create });
