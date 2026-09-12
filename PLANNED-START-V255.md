# Planned start — server and producer handoff for v255

Implemented against shipped v254 base `f142bb11ebf397e1578f1dc88595d661a72c00dc`.
This handoff covers the owner-data adapter and server transport. Client integration,
browser checks, the complete release suite and publication belong to the v255 release.

## Owner snapshot and selection

`SecretaryNextMovesProducerV1.build(snapshot)` retains the v254 input contract and
adds `context.plannedStart` and top-level `nextDecisionAt` to successful results:

```js
{
  ok: true,
  nextDecisionAt: '2026-09-11T12:46:00.000Z', // ISO timestamp or null
  context: {
    // Existing lapse, session, Guide, First Value and day context remains.
    plannedStart: {
      taskRef: 'quest:opaque-id',
      plannedAtLocal: '12:00',
      precision: 'exact_time',
      doneToday: false,
      observedAt: snapshot.now
    } // or null
  }
}
```

Only saved task `date` (a real calendar day), `startTime` (strict `HH:MM`), opaque
`id`, `done === false`, and absence of a truthy `completedAt` establish eligibility.
The task must belong to the current local day and its scheduled minute must be
between ten minutes ahead and forty-five minutes behind the current local minute.
The adapter selects the nearest eligible time, then the earlier time, then the
lexicographically smaller opaque id. Input ordering does not affect the result.
Titles, notes, estimated minutes and actual minutes are not sent in this projection.
`estimateMin` describes an estimate; neither it nor `actualMin` establishes an active
session. There is no durable started-today fact in the current owner model, so
`startedToday` is omitted. The existing global active-session gate applies.

`nextDecisionAt` is the earliest future opening or closing boundary among eligible
saved schedules, including future days. Opening is at start minus ten minutes;
closing is at start plus forty-six minutes because policy evaluates whole local
minutes (`+45:59` remains eligible). Both are clipped to the scheduled calendar day.
The caller supplies the existing local UTC offset. A future midnight task cannot
become eligible on the preceding date. Completed or malformed schedules do not
produce wakeups. No future transition means `null`.

The runtime can schedule one foreground timer for `nextDecisionAt` and rebuild on
local clock/day/offset or saved-task changes. Include selected `taskRef` and
`plannedAtLocal` in its context fingerprint. This is a read-only adapter: it does not
start timers, create tasks, modify schedules, or award progress.

## Capability negotiation and transport

The existing authenticated `POST /api/secretary/next-moves` route and its
`decide | claim | outcome` operations remain. New clients send this **top-level**
field on both `decide` and `claim`:

```js
supportedCapabilities: ['after-lapse-return', 'planned-start']
```

Omission defaults to `['after-lapse-return']`, preserving v254 clients whose offer
validator only understands return cards. A supplied value must be an array with
unique known capability ids; malformed, duplicate or unknown entries return
`400 invalid_capabilities`. An empty array opts into neither capability. The server
filters resumed claims as well: the same tab with a v254 client cannot receive a
previously claimed planned card. Claims held by another client remain quiet.

A healthy `held` or `legacy_held` decision includes `silence.recheckAt`, the earliest
still-valid lease expiry as a canonical ISO timestamp. If a competing claim wins
between decision and claim, `409 { error: 'held', recheckAt }` carries the same hint
at the response's top level. The client merges this deadline with its scheduled-task
wakeups and rechecks once while foregrounded. Further active leases may produce a
later deadline on that recheck. This avoids caching temporary silence until the
planned window has already closed. A blocked active-session/Guide/First-Value/day
decision does not need the held wake hint; context changes trigger its revalidation.

The hint neither extends nor releases a claim and spends no offer budget. Legacy
`delivered`, `dismissed` and uncertain `retry` claims continue to hold their surface
until their existing expiry; only established legacy `gone` semantics release early.
Expired leases are excluded. The wake is a new server decision, not permission to
render before a fresh successful claim. Old clients may ignore the additive field.

The existing local-private context fields remain unchanged. The server rebuilds
`plannedStart` from the authenticated account's saved tasks; client-provided planned
projections or scheduling fields do not establish authority. Accepted outcomes retain
their frozen request identity/context and do not require the negotiation field.

Planned offers use the existing v2 offer schema with:

```js
capabilityId: 'planned-start',
about: {
  // Existing day, invocation, precision and targetRef remain.
  planned: { date: '2026-09-11', startTime: '12:00' }
},
primary: {
  id: 'primary',
  action: {
    type: 'task_open_prepared',
    args: { targetRef: 'quest:opaque-id', day: '2026-09-11', size: 'planned' }
  }
},
alternatives: []
```

The first planned slice opens the saved task after an accepted durable receipt.
It does not introduce unrelated habit/commitment alternatives. The offer's `action`
is the same primary action. `about.planned` is the frozen schedule identity used at
acceptance, so a reschedule inside the same still-eligible window is detectable.

The lease ends at the earliest of the policy expiry, fifteen minutes from claim
evaluation, or the scheduled task's closing boundary/day end. Planned offers require
no lapse and never use lapse fields for their lease. Return offers retain their
existing three-hour episode window. Existing policy priority chooses a qualifying
return before a planned start.

## Acceptance and persistence

Acceptance resolves the exact claimed task against current account-owned files,
checks its saved date and exact saved `startTime`, verifies it is still unfinished
and currently within its original schedule window, and applies current context
gates. Adding another nearer scheduled task does not invalidate this existing claim.
Deletion, completion or rescheduling produces a durable expired outcome and
`409 stale_target`; repeating the identical request returns its saved receipt.

Active session, Guide, First Value and closed-day blockers retain their existing
behavior. The public planned policy does not include the evening-contract scope:
an explicitly saved late schedule remains valid. This slice preserves that owner
rule rather than introducing a blanket sleep veto. Return cards retain the existing
evening-contract behavior. No public policy code was changed.

Both capabilities share the existing `secretary.json` version-1 envelope,
`nextMoves` ledger, delivery claims and durable receipts. Cross-device arbitration,
legacy-card arbitration, ownership checks, idempotent lost-response retries,
expiry acknowledgment, restart recovery, export and account deletion remain on
the same stores and endpoint. A failed durable write returns an error without
reporting acceptance or opening a task.

## Verification

Targeted producer and real-server suites: **45/45 passed**:

```sh
node --test --test-concurrency=2 \
  scripts/secretary-next-moves-server-v1.test.js \
  scripts/secretary-next-moves-producer-v1.test.js \
  scripts/secretary-planned-start-producer-v1.test.js
```

Coverage includes strict source schedules; deterministic selection; local midnight,
UTC offsets and exact wake boundaries; no inferred started flag; capability defaults,
malformed negotiation and resume filtering; shared cross-device claims; no-lapse
lease/expiry; accepted reschedule/delete/completion rejection; a newly nearer task;
saved context gates; account isolation; write failure; and receipt replay after a
real server restart. Shared-lease checks also cover earliest live expiry, delivered
and uncertain legacy holds, unchanged lease files/budgets, claim-race deadlines,
and removal of the held hint after expiry. The existing producer and policy suites
also passed 96/96.
Integrated v255 candidate: **2143/2143 tests passed**, no skips, 50.0 seconds.
Browser coverage and its limits are recorded in the 2026-09-12 DEVLOG entry.
The production receipt is recorded after Railway succeeds and live bytes match
the pushed commit; this test result alone does not establish publication.
