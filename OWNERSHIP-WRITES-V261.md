# Inventory ownership writes v261

Ordinary settings saves could add paid gear, cosmetics, Den items or arbitrary
relic power without including a purchase. Purchase admission only ran when a
request carried `purchases`. This change checks inventory on every ordinary
settings writer, including accounts without a Commitment graph, and checks the
remaining generic purchase-history writer before it can erase an existing debit.

## Contract and migration

`public/settings-inventory-policy-v1.js` is a pure browser/Node policy. Its inputs
are saved settings, the account's actual subscription tier, candidate settings,
and an optional **server-internal** list of `{kind, id}` catalog grants. It has no
I/O, clock, browser state or entropy. It does not infer grants from candidate
settings, request flags, a claimed tier, or a historical purchase row.

- Preserve the saved ownership tokens in `gear.owned`, `cosmetics`, `den.owned`,
  including unknown legacy JSON values. Existing duplicate counts can stay or
  deduplicate, but cannot increase. New authorized/starter tokens occur once.
- Preserve every field of previously earned `gear.relics`. There is no active
  new-relic producer. Ordinary saves cannot create, delete or edit relic power,
  identity, sphere, or legacy metadata.
- Missing/null arrays initialize empty. Existing inactive non-array legacy
  values can stay unchanged or initialize to an empty inventory; initialization
  cannot create a paid token. Den initialization may add the existing eight
  starter tokens, with their existing starter selections.
- A changed gear/cosmetic/Den selection must match its catalog slot and the
  account's saved or currently admitted ownership. A relic selection must use
  a saved relic UID. Clearing a selection is allowed. Previously saved selections
  remain valid unchanged, including unknown legacy selections and expired Pro
  selections; the policy does not reapply purchase level gates to owned gear.
- New Pro Den selections use the authenticated user's actual `pro`/`trial` tier.
  A candidate `plan`, or even a stored Pro ownership token, is not a subscription.
- Explicit portable imports (legacy and previewed), reset through the existing
  import owner, authenticated admin backup restore, and explicit server-side
  text repair from the same account's backups retain their replacement rights.

There is no migration file, backfill, second journal, new receipt ledger, or new
private state. Saved/imported inventory is the compatibility baseline. Existing
items are not relabeled as server-issued provenance. Import continues to carry
personal XP, gold, purchase history and items under the previous contract.

## Admission map

| Writer | Inventory admission |
| --- | --- |
| Generic settings PUT/POST | `assertAccountGraphTransition`, before the unprotected-graph early return and before backup/write |
| Commitment pair, including `base: 'server'` reconciliation | Same guard; reconciliation does not grant inventory |
| Economy and Guide/habits feature commits | Same guard before the existing shared WAL; a successful `assertPurchaseTransition` supplies only new paid catalog grants |
| Board settings/tasks/media commit | Same guard before any sequential file write or protected-pair WAL |
| Extended settings/tasks/goals/groups/skilltree commit | `assertGoalGraphTransition` explicitly checks saved vs candidate settings before WAL |
| Questionnaire materialization | Same pair guard; its server-built skill/task additions retain inventory |
| Daily chest | Only the validated server issuer callback supplies its exact cosmetic prize; its private receipt and settings still use the same account WAL |
| Portable import/reset and admin restore | Internal `Symbol` replacement authority, never deserialized from an HTTP body |
| Explicit damage repair | Existing server-produced recovery from same-account backups; request supplies only `apply`, never a candidate or grant |
| Journal recovery and startup migration | Existing trusted recovery/migration; no new admission during rollback/rollforward |

Generic `purchases` PUT/POST now validates a changed history with the same saved
account/catalog purchase policy as dedicated writes. It cannot remove/change the
historical prefix, forge a discount, or append an inventory purchase without its
atomic item grant. A legitimate personal-reward append remains supported.
Unchanged historical data remains saveable even when rows predate the catalog.
Active app purchases already use economy/Guide commits; the remaining direct
`Store.save('purchases')` occurrence is in the archived v244 design baseline.
Legacy penalty migration reads purchases but writes only settings/tasks.

The checks finish before backups or account-file mutations. A rejected batch
cannot persist its accompanying task, note, habit credit, lootbox or goal graph.
Dedicated purchases keep their existing error contracts. New inventory denials
and new generic purchase denials use HTTP 422, leaving actual revision conflicts
at 409. The app's broad Commitment boundary only handles 409/428, so an inventory
denial does not set the global account-conflict flag or trigger reconciliation.
Root integration supplies the localized inventory feedback.

New inventory codes: `inventory_ownership_changed`, `inventory_relics_changed`,
`inventory_invalid_selection`, `inventory_pro_required`,
`inventory_state_not_supported`, `inventory_invalid_grant`.

## Legitimate grant owners and remaining scope

Gear/paid cosmetics/paid Den additions are exact catalog purchases. Daily chests
issue cosmetics through the v260 server receipt. `ensureDen` adds starter items;
`ensureGear`/`ensureCosmetics` only initialize their empty collections. Den reset
clears layout while preserving owned items. Relics only survive as previously
earned or imported items; the current UI has no new relic grant producer.

Achievement checks record achievement timestamps, and personal levels/guide
progress do not issue gear or paid Den items. Achievement titles, legacy chest
titles, tree capstone titles, and `boardV2Titles` retain their existing owners.
**`equipped.title` and `boardV2Titles` are explicitly outside this slice.**
Custom avatar/fortune appearance and other ordinary settings remain outside it.

This is not an immutable wallet or a new restriction on personal history.
Task/habit/goal/import credit and `lootbox.goldWon` retain their current personal
history authority. The private v260 chest cursor/receipt remains protected
separately. Establishing server-issued provenance for all historical credits or
changing what an explicit import may transfer would require a separate contract;
this change makes neither claim nor policy change.

## Behavioral verification

`scripts/settings-inventory-v261.test.js` covers pure ownership, complete relic
preservation, correct selection slots, actual subscription tiers, starter and
legacy initialization, existing unknown rights, title isolation, exact grants,
and duplicate-count limits without mutating its inputs.

`scripts/ownership-server-v261.test.js` starts the actual server with an isolated
temporary `DATA_DIR`. It checks every ordinary settings admission route above,
legacy and modern envelopes, forged body authority, and byte-identical account
files **including backups** after rejection. It also checks admitted purchases,
lost-response replay, an exact server-issued cosmetic chest (entropy controlled
only by a test-process preload), old/imported selections, reset, actual Pro,
admin restore, backup text repair, and generic purchase debit preservation.

Related purchase, economy, feature, Commitment graph, import and chest HTTP
tests cover their existing exact-base and shared-WAL behavior, including real
SIGKILL rollback/rollforward. No production account or deployment is used.
