# Satoru Attention — privacy text for owner review

Draft for version 0.6.0, 12 September 2026. This file is prepared publication copy, not a
claim that a public privacy-policy URL or store declaration has already been approved.

Satoru Attention applies attention boundaries and optional content filters in the browser
where you install it. Rules, configured website names, allowed reasons for entry, the active
session, daily budgets, cooldowns, pending changes, emergency-access budget and up to 100
minimal session outcomes are stored in the extension's local browser storage. The current
session may include the task detail, research topic and expected outcome that you enter.
Emergency reasons are checked at the time of the action and are not saved as free text.

The extension processes addresses of permitted sites to decide whether to show its local
boundary. An attempted address can be kept briefly in memory to return to the same page;
it is not stored as a browsing-history log. It does not read cookies or collect page titles,
watched items, account credentials or the browser's history database. It does not use
analytics, remote code, cloud sync or its own network upload endpoint.

When you open the Satoru production website, a content script can send that page the
extension version, number of enabled/permitted sites, limited current-session status
(service category, phase, mode and time remaining), whether configured rules match actual
browser enforcement, and the state/time of the latest boundary test. It does not send the
site addresses, policies, task detail, topics, purposes, outcomes or browsing history.
The web page can open extension settings; it cannot change rules, start sessions or tests,
or change your account through this bridge.

A voluntary boundary test opens one configured site's homepage in a new tab. If protection
fails, that site can load normally and receive the ordinary browser request. The extension
keeps only one local test record with its result, times, extension version, local rule
fingerprint and the test tab identifier. A changed configuration/version invalidates the
old result. The website receives only the bounded test state and time.

Only Satoru's exact production origin is permanently granted at installation. Adding a site
requests permission for that exact hostname over HTTP/HTTPS. Enabling category protection
separately requests optional access to all HTTP/HTTPS sites so browser filtering can work.
You control these permissions in the browser and can disable or uninstall the extension.
Removing the extension removes its local extension storage; browser/profile backups are
managed by your browser. No extension data is sold or used for advertising, credit decisions
or unrelated profiling.

Owner: provide the verified publisher/support contact and host the approved text at a public
HTTPS URL before completing the store privacy fields. The Satoru account website has its own
data flows; this extension-specific text must not be presented as a complete account policy.
