# R04C — AI lifecycle: timeout, cancel, late response, v285

Scope from the in-repo R04 definition («weekly AI timeout/cancel/late-response
lifecycle») plus the same defect in Shadow chat. External CRITERIA.md was not
available in the cloud session. Applied rules: SD-08 (44px controls), C-04, TY-05,
M-05 (reduced motion), "success only after a real answer", no hidden actions.

## Before → after

- **Weekly review had no timeout.** A hung provider kept «Анализирую…» forever.
  Now 60 s → «Тень не ответила за минуту. Запрос отменён, ничего не изменено» with
  «Повторить» / «Закрыть».
- **No way to leave a pending request.** Pending state now says how long it usually
  takes, that closing cancels, and has «Отменить запрос». ✕, Escape and the button
  abort the network request (AbortController).
- **Late answers reopened a closed window.** A response after cancel/close/timeout,
  after a newer review started, or after logout never renders; the newer request
  wins. Logout (`clearAllData`) cancels requests and removes the window.
- **Focus.** Opening moves focus to the dialog title; closing returns it to
  «Разобрать неделю». Errors offer retry instead of a dead end.
- **Chat stayed busy forever** on a hung provider. The typing bubble now has
  «Остановить»; stop, a 90 s timeout or a network error end the request, return the
  question to the input with focus, and say that nothing changed. The existing
  account/epoch fence is kept; late answers are ignored.
- **Server.** Provider calls had no timeout. `httpsPostJson` now has an idle socket
  timeout (120 s default, `AI_UPSTREAM_TIMEOUT_MS`, bounded 5–300 s); the error takes
  the existing `provider_unavailable` path. This protects every AI endpoint.

New pure module `public/ai-request-v1.js` (`AiRequestV1.create → run/cancel`,
statuses done/timeout/cancelled/stale/error, exactly one settlement). No prompt,
provider, quota or data change.

## Verification

Synthetic isolated accounts; `/api/ai/keys`, `/api/ai/analyze` and `/api/ai/chat`
were intercepted with synthetic responses — no real AI request was made.

- Unit: 6 AiRequestV1 tests (done, timeout+late answer, cancel+abort, stale for
  closed/other account/newer, error vs stale, single run and bounds) and 1 server
  test running the real `httpsPostJson` with a stubbed `https` (idle timeout
  rejects with `AI_UPSTREAM_TIMEOUT`, bounded env value).
- Chromium flows (RU weekly, EN chat): pending → success with focus in the dialog;
  Escape closes and returns focus; cancel then a 2.5 s late answer — window stays
  closed; ✕ during pending — same; slow old + fast new — new shown, old ignored;
  503 → «Повторить» → success; logout while pending — no window, login shown; chat
  stop → question restored, late answer ignored, resend works.
- Real-time timeouts (DE, provider held for 70/100 s): weekly review showed the
  timeout notice after 60 s with focus in the dialog; chat ended after 90 s with the
  question back in the input. UK repeat of all weekly flows passed with translations.
- Targets: close 44×44, «Отменить запрос» 44px high, chat «Остановить» ≥44px.
- Screenshots of pending/error dialog and chat stop at 375 dark RU and 1280 light DE.

**Not verified here:** WebKit, real devices, real providers.

## Remaining

Other AI surfaces (category suggestion, stuck-task step, day recap, proposals,
Inspiration) still use their own request code; they are now bounded by the
server-side provider timeout but have no client cancel. R04D export, R05/R06.
