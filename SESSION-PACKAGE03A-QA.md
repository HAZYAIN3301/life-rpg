# Package 03A — ordinary web sessions and task persistence, v278

2026-09-24. Scoped to task actual-time writes through the existing Commitment
owner. Synthetic local accounts A/B; no production user data, OAuth or native edits.

## Confirmed problems and fixes

1. A 401 during task-time save rendered login underneath the still-mounted,
   disabled task dialog. It intercepted clicks and prevented signing in again.
   Account teardown now dismisses this account-owned dialog after invalidating
   pending writes. A late response still fails the existing account/epoch guard.
2. Pending A promises remained in Store's write queues after account teardown.
   B's initialization could wait indefinitely for A's delayed response. Resetting
   the queue references lets B proceed independently. Old queued work cannot run;
   old completion cannot remove B's new queue or publish A's state into B.
3. Disabling form controls during save lost keyboard focus. On rejection, focus
   now returns to the minutes input when outside the dialog; Escape works again.

No server admission, task storage shape, CAS/WAL or reward rules changed. Resetting
queue references does not cancel an already accepted A server write or move it to B.

## Browser evidence

Artifacts in external release plan `work/03a/`: qa.cjs, isolation.cjs, mobile.cjs,
evidence/checks.json, isolation.json, mobile.json and screenshots.

- Real password login, reload, logout/login and persisted task-time readback.
- Offline and HTTP 503 preserve the draft and previous server value; retry succeeds.
- Two tabs: stale 33-minute edit cannot overwrite newer 34-minute value; conflict
  explains reopening, keyboard focus restored and Escape closes the dialog.
- Expired cookie during save: real server 401, old form dismissed, visible login
  notice, successful password login; rejected time was not saved.
- A server write succeeds but its response is held. Logout in another tab removes
  the shared cookie. Playwright clock advances the real device polling timer,
  whose HTTP 401 ends A's UI session. B signs in BEFORE A's response is released.
  B's UI state and server tasks remain unchanged after the old response and reload.
- Task GET 503 shows recovery instead of an empty success; retry restores B data.
- Chrome 1280px and Chrome/WebKit touch at 375×812: expired save/relogin and no
  horizontal overflow. Existing styles and localized text are unchanged.

Two behavioral queue regression tests accompany this change. Initial focused
auth/device/account-fence suite: 28/28 PASS. Final full test result is recorded in
DEVLOG and release-plan CHECKPOINT with deployment receipts.

Boundary: one protected task writer, not every application dataset. Native sessions,
provider configuration, full export/import (03B) and installed PWA update remain
separate checks. Shell cache/current pin expectations raised to v278.
