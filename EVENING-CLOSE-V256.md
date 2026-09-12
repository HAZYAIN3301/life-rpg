# Evening close v256 — producer and delivery contract

Base: published v255 `b21ef90ffcc06160ff2771af3037aa57f89bad56`.
This handoff describes the server, owner projections and the narrow bridge for the
existing opt-in evening push. Client integration, full-suite/browser validation and
publication are owned by the integrating v256 task. Local checks are listed below.

## Actual saved facts

The configured boundary remains `settings.secretary.eveningTime`, strict `HH:MM`,
with `configured === true`. `dailyReminder === true` separately authorizes the
proactive evening reminder. False or missing means no proactive evening offer or
wakeup. A malformed non-boolean reminder flag is a visible data error.

The producer preserves the configured boundary when the reminder is disabled,
because after-lapse return already uses that same boundary to protect sleep. Its
projection adds the explicit reminder choice:

```js
eveningContract: {
  configured: true,
  eveningTimeLocal: '22:00',
  dailyReminder: true,
  observedAt: snapshot.now
} // or null when no configured boundary exists
```

The pure v2 policy does not know the reminder flag. The server adapter applies that
opt-in gate before enabling `evening-close`, preserving the existing return behavior.
No public policy code changed.

Known scheduled intervals come from unfinished account-owned tasks with a valid
opaque quest id, exact saved calendar `date`, strict `startTime`, and a positive
finite **numeric** `estimateMin`. End = start + estimate minutes. `done` must be
exactly false and `completedAt` absent/false. There is no `endTime` task field.
The calendar editor uses 5–1080 minutes, while the general hours/minutes task form
can exceed 24 hours and the loader imposes no upper duration cap. The adapter does
not invent a 24-hour ceiling: positive numeric estimates, including fractional
minutes, remain exact while the resulting date is representable. Missing, zero,
malformed and numeric-string durations are unknown; no default duration is guessed.

This is a saved plan, not proof that work actually started. `actualMin`, task titles,
notes and inferred `startedToday` do not establish occupancy. Only an interval
containing the current instant holds the evening conversation. Overlapping or
immediately adjacent intervals are merged; a future interval separated by free time
does not claim the person is already busy. An unfinished previous-day interval can
carry into today.

```js
tonightSchedule: {
  busyUntilAt: '2026-09-13T00:30:00.000Z',
  busyUntilLocal: null, // HH:MM when end is on today; null across midnight
  observedAt: snapshot.now
} // or null when no known interval contains now
```

The absolute timestamp is authoritative. `HH:MM` cannot represent tomorrow, so the
adapter never fabricates `23:59`/`24:00` or wraps a next-day end into an earlier
same-day time. The delivery service gates evening eligibility against `busyUntilAt`
even when the old pure policy's `busyUntilLocal` field cannot represent that end.

Top-level `nextDecisionAt` still merges planned-start deadlines and now adds the
configured evening opening, closing, next day's opening, and known schedule
start/end transitions within the current evening window. It uses the caller's
explicit local offset and returns a canonical ISO timestamp or null. The evening
window includes whole minute +120; it ends at +121:00 or local midnight, whichever
comes first. A late boundary does not silently become yesterday's offer tomorrow.

## Card transport and outcomes

The authenticated route and request identity remain unchanged. New clients opt in
on `decide` and `claim` with the top-level field:

```js
supportedCapabilities: ['after-lapse-return', 'planned-start', 'evening-close']
```

Omission still means return only. A v255 two-capability client receives neither an
evening offer nor an evening resume. Unknown or duplicate ids remain 400 errors.
Client-supplied boundary, schedule or owner projections cannot override saved files.

Evening actions are strictly `evening_transition_open` with only
`{ day, boundaryLocal }`. The saved offer's boundary and action must agree; its
`closesDay` and `plansTomorrow` stay false. There are no unreviewed rest alternatives
in this slice. The lease is the earliest of fifteen minutes from evaluation, policy
expiry and the real saved boundary window/day end. It requires no lapse.

Guide and First Value remain hard blockers. A closed day suppresses advice but does
not veto the user's own evening reminder. The policy's active-session candidate is
converted into healthy `session_active` silence with `deferUntil: 'session_end'`:
it spends no claim and cannot be shown during the session. When the session ends,
the client obtains a fresh decision. If a session starts after claim, acceptance
waits with `409 context_blocked`; the existing finite lease keeps running.

A known busy schedule produces `busy_until_known_commitment` silence with
`recheckAt` capped to the busy interval end and the current window/lease end. This
also applies to a resumed claim when a known plan appeared after delivery. A claim
or acceptance race returns `409 context_blocked` with the same bounded hint when
available. The client waits and revalidates; it does not open by a timer alone.

Acceptance rechecks the authenticated account's actual configured boundary and
reminder opt-in, current window and current context. Changing/disabling the saved
boundary expires the stale offer durably with `409 stale_target`. Malformed saved
data is an honest 422 error, not a successful expiry or healthy silence. Accepted,
dismissed and expired outcomes share the existing idempotent receipts. Explicit
evening reminders retain the public policy's daily cooldown without accumulating
advice rejection/ignore suppression. An accepted receipt authorizes only opening
the real evening flow; it does not close a day or edit tasks.

## Existing evening push uses the same logical offer

The pre-existing configured evening push remains available to opted-in subscribers.
Its narrow v256 bridge calls `reserveEveningPush` before awaiting the provider.
The method rereads account-owned configuration/schedule, respects shared live card
and legacy claims and the evening daily ledger, and durably reserves the same
logical evening offer. No successful reservation means no outbound effect.

The existing `secretary.json` envelope gains optional per-offer delivery metadata:

```js
{
  offer: { /* same logical evening offer, channel: 'push' */ },
  clientId: 'secretary-evening-push',
  token: 'opaque reservation token',
  state: 'offered',
  push: {
    token: 'opaque reservation token',
    status: 'reserved', // later delivered | retry | gone
    reservedAt: '2026-09-12T22:00:00.000Z'
    // settledAt added after a durably recorded provider result
  }
}
```

Provider delivery is **not** user acceptance. `settleEveningPush` only records the
transport result; it never marks the user outcome accepted or closes the day.
Reserved, delivered, uncertain retry and gone records do not create another send
for the same logical evening. A crash or failed settlement write leaves a durable
reserved record, so an uncertain request is never sent a second time. The existing
subscription cleanup still handles definite 404/410 failures.

The notification uses existing neutral localized copy and links to Today. It carries
no task title, reason, boundary time or direct `do=finish` action. A capable signed-in
client may receive the same still-live logical offer projected as a card. Its claim
atomically transfers the row to one real client and a new token, preserving the
original expiry and ledger entry. A second client sees held. A lost transfer reply
replays the same token/receipt. The original push token remains separate so a late
provider settlement cannot overwrite a card acceptance, dismissal or ownership.
An expired reservation cannot be renewed by opening an old notification.

The bridge strictly checks a saved Attention envelope when one exists and suppresses
reservation for a known active synced session. Corruption fails closed. Missing or
local-private telemetry cannot prove idle: the already-authorized background
notification may arrive during a local-only session. The server does not claim it
knows that session ended. The notification opens no action; the authenticated card
and evening flow still require the client's fresh active-session check. This is the
explicit limitation of preserving the existing opt-in background reminder without
uploading private local attention history. Return/planned push channels remain out
of scope.

## Verification and integration remainder

Targeted results: **85/85 passed** across the new evening producer/push tests, the
real-server transport suite, existing producer/planned suites and existing push
regressions. The existing recovery suite also passed **16/16** after updating its
server-only expectations to the approved closed-day and neutral-link behavior.
`node --check` for the three changed runtime files and `git diff --check` passed.

Targeted checks include real isolated HTTP server cases for old/new capability
negotiation, dayClosed and active-session behavior, schedule waiting, stale saved
boundary, malformed action, write refusal and receipt replay after server restart.
Producer cases cover offset/midnight boundaries, adjacent plans, exact durations,
strict source fields and opt-out/sleep separation.

The push tests execute the actual scheduler function with a real service and
temporary account files around a stubbed provider: durable reserve-before-send,
reservation refusal, uncertain response, successful delivery with failed settlement,
single-client handoff, original lease/budget, late provider acknowledgment after
acceptance, restart, gone subscription, existing terminal card outcomes, known
schedule, malformed/synced Attention and pending handoff context changes.

These checks do not prove delivery by an external push provider or real-device
notification behavior. Full application/browser checks, locale/UI integration,
release pins and production verification belong to the integrating v256 task.
