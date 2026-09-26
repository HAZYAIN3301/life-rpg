# v296 — owner reports: extension package in the Mac app, goal import rejected

Two blocking bugs reported by the owner on 26.09 (Mac app screenshots, goal JSON).

## 1. Extension package shown as text in the Mac app

**Cause.** The installer's «Download package» was `<a href=zip download>`. The native
shell (WKWebView) allows same-origin navigations and has no download handling, so it
navigated to the ZIP and rendered the bytes as text (`PK…THIRD-PARTY-NOTICES.md…`).
The server already sends `Content-Disposition: attachment`; the web view ignores it.

**Fix (web only, no native rebuild).** When the page runs inside the app shell
(`window.webkit.messageHandlers.satoruShell`), the link is `target="_blank"` without
`download`; the native shell already opens such links in the system default browser
(`createWebViewWith` → `UIApplication.shared.open`), where the extension is installed.
A one-line note says so (5 languages). Ordinary browsers keep the direct download.

**Checked:** WebKit with a simulated shell bridge — link has `target=_blank`, no
`download`, click requests a new window and the app page stays; without the bridge —
direct download `satoru-attention-chromium-v260.zip`. Real Mac app: owner.

**Related, not changed (native):** the shell also cancels `blob:` navigations, so
exports built in the page (.ics, account archive, «Your week» PNG) most likely do not
save inside the Mac/iPhone app. Needs `WKDownloadDelegate` in satoru-ios — native owner.

## 2. Goal import: «Связи целей или сфер не прошли проверку»

**Reproduced** on an isolated server with a synthetic account whose sphere tree mirrors
the names in the owner's JSON (31 proposals, 3 new sub-spheres, 28 goals): the JSON
itself commits fine. The identical error appears as soon as the account holds **one old
quest whose sphere was deleted**: the five-file proposal commit re-validated every
existing task and goal and rejected the whole import for that legacy reference.

**Fix.** `goalCommitPayloadIssue` tolerates an unknown sphere id only when the same
record already had it on disk (`skillReferencesKnown(record, known, previous)`); a new
or changed reference to a missing sphere is still rejected. The 400 now carries a
reason code (`task_sphere`, `goal_sphere`, `goal_parent`, `task_goal`, … — no content)
and the client names the failed link (5 languages) instead of the generic message.

**Published:** `3accbc7`, both domains `satoru-v296` at 14:23 UTC, 10/10 SHA256
(app.js, index.html, sw.js, styles.css, design-next-v1.css), logged-out smoke in WebKit
(iPhone profile) and Chromium without page errors. Server change live with the commit.

**Checked:** repro variants on the fixed server — clean account, old quest with a
deleted sphere, stale task goal, stale goal parent/sphere: all commit (29–30 goals,
24 spheres). Server tests: legacy reference accepted and stored exactly; a changed
old quest, a new task/goal pointing to a deleted sphere and a missing parent are
rejected with their reason and change none of the five files. Full suite 3157/3157.
