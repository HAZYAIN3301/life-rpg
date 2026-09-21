# Native browser sign-in — 21 September 2026

## Implemented scope

Apple/Google sign-in for an existing Satoru password account. First sign in normally,
then connect the provider in native Settings with current-password reauthentication.
Subsequent provider login needs no Satoru password. Never create/merge accounts by
email; no social-only registration or identity replacement in this slice.

Native ASWebAuthenticationSession uses an ephemeral external browser. POST prepare
creates a five-minute one-use launch, authorize sets a Secure/HttpOnly/__Host cookie,
then redirects to an allowlisted provider. Callback verifies one-use state, browser
binding, provider, RS256 signature, issuer, exact audience/azp, iat/exp/nbf and nonce.
Google additionally uses provider PKCE. Native completion receives a one-minute
one-use ticket protected by a second PKCE challenge, not a provider credential.
Redeem rechecks the current account session version. Restart loses pending flows
and requires retry; no unvalidated callback can create a session.

Linking checks identity uniqueness and current account session version after network
awaits. Registry write must succeed before a ticket exists. Raw tokens are not logged.
Apple refresh tokens are AES-256-GCM encrypted with a key derived from the persisted
server secret; deletion revokes Apple access before local account deletion. The
server reloads the registry after that await to avoid overwriting concurrent changes.
Public user responses and portable user-data exports do not include OAuth bindings.

## Deployment configuration (secret values never in this file)

- `OAUTH_PUBLIC_ORIGIN=https://satoruapp.com`
- Google web OAuth client: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
  Exact authorized redirect: `https://satoruapp.com/oauth/callback/google`.
- Apple Services ID: `APPLE_OAUTH_CLIENT_ID`, key `APPLE_OAUTH_KEY_ID`,
  `APPLE_OAUTH_TEAM_ID=8Y9TR9L674`, PEM `APPLE_OAUTH_PRIVATE_KEY`.
  Exact web return URL: `https://satoruapp.com/oauth/callback/apple`.
  Configure the service under the primary Satoru App ID with Sign in with Apple.
- Keep the credentials absent until provider configuration and live QA are complete.
  `/api/auth/oauth/providers` returns only configured providers; native controls
  stay hidden otherwise. Billing keys are unrelated.
- Native callback: `satoru-auth://callback?ticket=…`; no provider access token or
  refresh token in URLs. Only the app retaining the verifier can redeem a ticket.

## Evidence and remaining gates

18 pure/provider tests + real HTTP flow: signatures and invalid claims, one-use
state, browser binding, PKCE, expired/replayed tickets, email non-linking, identity
replacement refusal, password-rotation fencing, public response redaction, deletion,
Apple client-secret ES256 signature, encrypted refresh storage and revocation.
HTTP tests isolate DATA_DIR and intercept provider networking only inside a test
process; production contains no test issuer/JWKS override.

Native iOS simulator compile and signed Release archive pass. Credentials are not
provisioned yet, so these are simulated-provider tests, not a successful live Apple
or Google sign-in. Live linking/login/cancel/revocation, provider-branded UI review,
account switching and App Lock interaction on iPhone/iPad/Mac remain gates.

## Privacy/release setup

`/privacy.html` discloses current processing in EN/RU, including optional analytics
currently on by default. It is not a claim that consent and international-transfer
compliance are complete. Before public launch: resolve optional analytics defaults,
provider contracts/retention/transfer safeguards, seller details/Impressum and final
App Store privacy declarations. Native PrivacyInfo.xcprivacy describes first-party
data categories and no tracking; no Required Reason API use was found in native
app/core source. App Store labels still require final review, not “Data Not Collected”.

Sources: https://developers.google.com/identity/openid-connect/openid-connect
and https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple
