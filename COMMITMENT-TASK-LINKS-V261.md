# CommitmentV2 task links — v261

Implementation slice on base `ac64ba7`. The existing task-boundary UI, CommitmentV2
model, owner endpoint, CAS pair and journal already exist. This change connects
their explicit links to the existing secretary card and prepared-task interface.
Visual browser acceptance and release pins belong to the integration owner.

## User-visible behavior

When a person records a qualifying distraction without a still-actionable original
task, the secretary can offer a task to which they explicitly attached a personal
boundary. The card shows that task and their saved concrete result. An actionable
original task or habit still takes precedence. A planned-start card can show the
same task's own saved result; another task's agreement is never quoted.

Accepting opens the existing prepared-task view after the secretary has durably
saved acceptance. It does not start a timer, finish the task, mark a commitment,
award anything, schedule work or change the chosen boundary.

The existing boundary dialog gains one explanation:

> После отмеченного отвлечения Тень сможет предложить вернуться к этому делу и показать выбранный результат.

The explanation and an honest unconfirmed-save message are supplied in Russian,
English, German, Ukrainian and Spanish by the existing secretary UI module.
Personal titles and results are escaped and retain `data-noi18n`.

## Existing persisted relation

- Source of truth remains `settings.commitmentsV1`, interpreted with
  `CommitmentV2.migrate`, and the current owner's `tasks`.
- The explicit relation is `task.commitmentId === 'quest:' + task.id === item.id`.
  No relation is inferred from a commitment title, its id alone, an attention
  target, a habit, or an old free-text reference.
- The complete state and task graph must pass `CommitmentStoreV1` validation.
  Migration must report no dropped records. Unsupported/corrupt relations produce
  no task-link projection; they are never normalized into an empty saved state.
- A projected record must be an unarchived V2 `step`, due in the current mode
  and day, unmarked for that day, explicitly attached to an unfinished task dated
  today. Its task must pass the existing owner-ref/actionability check.
- V1 data with a valid existing explicit relation is read through the lossless V2
  migration. Reading does not persist migration or discard other V2 kinds/history.

The producer returns bounded runtime-only rows:
`{ id, taskRef, kind, title, win, commitmentBasis }`. These fields are not added to
the persisted CommitmentV2 item schema. Multiple eligible links retain the
existing deterministic first-step order. All existing lapse evidence, evening,
guide, session, FirstValue, delivery and cooldown gates remain in force.

## Boundary and action validity

`edge.time` means the chosen finish boundary. It never supplies
`task.startTime`, a planned-start window or a scheduler wake. Only the existing
saved task start time enables the planned-start capability.

A task action carrying a quote also carries `args.commitmentBasis`: an exact
bounded JSON tuple of the linked id, title, result, edge, decision/revision dates
and retained history length. This is a current-state comparison, not a secret,
hash, authorization token or new monotonic revision. Existing history stays capped
at 30. An identical restored current record is intentionally indistinguishable
from the same current record; no hidden mutation journal is added to the model.

The server resolves the whole authoritative owner graph before acceptance, checks
the selected task, basis and quote, and expires a stale offer durably. The planned
target is rechecked independently of whichever task is nearest now, while retaining
the complete graph for link validation. A forged client context cannot supply
owner tasks or commitment words.

The card checks its current projection before displaying a bound quote or accepting
action. Runtime rechecks the binding before opening an accepted or deferred action,
including after reload. Account and Store write epoch guard every late opening.
A stale visible link can be expired via the existing retry control without
recording acceptance. Changing the projected basis invalidates cached silence.

The server continues to replay the exact durable outcome after a lost reply.
That reply does not authorize a locally stale link: runtime checks the current
owner snapshot. There is no additional remote refresh RPC before deferred open;
an edit made on another device after acceptance is visible to this check once
the app receives the updated owner data. This matches the existing prepared-action
execution boundary and is not a cross-device instantaneous-consistency claim.

## Saving the relation

The existing `takeQuestCommitment`, `reviseQuestCommitment` and
`releaseQuestCommitment` builders still write the settings/tasks pair through
`commitmentDataCommit`, `Store.runExclusive`, the authenticated
`POST /api/commitments/commit` endpoint and its durable WAL.

The shared commitment writer now requires the existing successful JSON receipt
`{ ok: true, files: ['settings', 'tasks'] }` before applying its candidate to the
UI. A successful HTTP status alone is insufficient. One revision conflict may
reload and rebuild on the current base; a second remains a conflict. This caller
no longer sends `base: 'server'`, which could overwrite a later concurrent edit.
The legacy endpoint and other caller protocols are unchanged.

Account/epoch checks precede applying refreshed data, expiring a session, saving
slots and updating the UI. Late confirm/release handlers cannot toast, close a
new account's dialog, sound or render; an old completion cannot unlock that
account's active control. A lost or malformed response reports unconfirmed saving
instead of claiming that nothing changed. Task-boundary writes do not gain a new
durable intent/replay protocol in this slice.

## Validation and integration

- `node --test scripts/commitment-task-links-v261.test.js`: 32 passing tests,
  including actual producer/policy/UI modules, real filesystem secretary service
  with fsync and injected failure, real client/runtime in VM, and extracted actual
  app writer/builders/handlers. Covers forged/dangling links, owner/epoch switches,
  revision/release/completion/reschedule, no finish-to-start inference, exact
  lost-response retry, deferred reopen, five locales and escaped personal copy.
- 214 existing module tests pass across CommitmentV2/store/journal, attention
  integration, secretary policy/producer/client/runtime, planned/evening flows
  and the morning commitment source.
- 49 existing real HTTP Commitment and next-moves server tests pass, including
  CAS conflicts, WAL rollback/rollforward/SIGKILL, legacy compatibility and account
  ownership. Local listen required sandbox escalation; no real account data was used.

Integration owner should update browser pins for the seven changed public JS
files (app, commitment-store, next-moves producer/policy/client/runtime/UI), their
offline entries and release-level fixture expectations. Existing script order
already loads CommitmentV2 and its store before the producer. No new browser
module, dependency, endpoint, navigation, stylesheet or migration is required.

Browser smoke: create a synthetic task today with no start time; save a boundary
and a result; record a qualifying distraction without an original task; inspect
one card, saved result and prepared-task opening. Repeat with the boundary revised
or released before acceptance; check all five locales, phone width, keyboard and
long text. Confirm that the finish time alone produces no planned reminder.

Rest Profile, avatar, artistic canon, provider/model choices, paid APIs, telemetry
and external publication are outside this slice.
