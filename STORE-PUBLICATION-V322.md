# Stores — current preparation, 03 October 2026

Supersedes STORE-PUBLICATION-V261.md. Candidate: web v322, Attention 0.10.2,
native 1.0 (10). This document is preparation, not a submitted declaration.

## Chrome: ready-to-copy fields

Name: Satoru Attention. Category: Productivity. Price: Free.
Support: https://satoruapp.com/support.html — satoru@satoruapp.com.
Policy: https://satoruapp.com/browser-companion-privacy.html.
Package: public/downloads/satoru-attention-chromium-v322.zip; exact hash and contents:
extensions/satoru-attention/store-kit-v322/release.json.
Use this package instead of 0.10.1: one misleading UI sentence was corrected in all five
languages. Permissions and blocking/puzzle behavior are unchanged.

### Description EN

Make room for what you meant to do. Satoru Attention helps you enter selected websites
with a purpose and a time limit, then returns you to a pause when time is up.

Choose daily budgets, entry limits and cooldowns. Optional protection blocks selected
categories or domains and supports strict search, YouTube Restricted Mode and scheduled
recreation. Lock protection settings for 7, 30 or 90 days. You can also require an offline
chess puzzle to extend a feed session within its daily budget. The boundary page shows
your own reasons for pausing and today's attempt count.

Rules and session records stay in local extension storage. Category lists and chess
puzzles are bundled. When the adult-content filter is enabled, the Reddit guard queries
Reddit about communities and profiles using your existing browser session. Reddit receives
these requests; they are not sent to Satoru. The Satoru website receives only limited
extension status, not your website rules or private task details.

No account is required for the extension. Optional category protection requests all-site
access when you enable it. Protection applies to this browser; it cannot prevent removal,
control other browsers or guarantee that every unwanted page is blocked.

### Description RU

Освободи время для того, что собирался сделать. Satoru Attention помогает заходить на
выбранные сайты с целью и ограничением времени, а затем возвращает к паузе.

Настрой дневной бюджет, число входов и перерывы. Дополнительная защита блокирует категории
и отдельные сайты, поддерживает строгий поиск, ограниченный режим YouTube и расписание
отдыха. Настройки защиты можно запереть на 7, 30 или 90 дней. Для продления сессии ленты
можно включить офлайн-задачу по шахматам — в пределах дневного бюджета. На странице границы
видны твои причины остановиться и число попыток за день.

Правила и записи сессий хранятся в расширении. Списки категорий и шахматные задачи входят
в пакет. При включённом фильтре 18+ защита Reddit запрашивает у Reddit сведения о сообществах
и профилях с использованием текущей браузерной сессии. Reddit получает эти запросы;
в Satoru они не отправляются. Сайт Satoru видит только ограниченный статус расширения,
а не правила сайтов и личные детали задач.

Для расширения не нужен аккаунт. Защита по категориям запрашивает доступ ко всем сайтам
при включении. Она действует в этом браузере, не препятствует удалению, не управляет
другими браузерами и не гарантирует блокировку каждой нежелательной страницы.

DE/UK/ES interface and privacy are localized; use the English listing fallback for this
submission. Do not imply that three additional localized store descriptions were uploaded.

### Single purpose

Help users limit distracting browsing through deliberate timed entries and optional local
website/category boundaries in the same browser.

### Permission rationale

| Permission | Copy for the store |
|---|---|
| storage | Saves user rules, session outcomes, lock state, daily attempt counts, written reasons and Reddit verdict cache locally; current chess puzzle state uses session storage. No chrome.storage.sync. |
| declarativeNetRequest | Redirects configured sites to the local boundary and applies the user's optional category, domain and strict-filter rules. Bundled adult rules are enabled only with that protection. |
| scripting | Installs packaged boundary guards on user-approved sites and, with adult protection enabled, a Reddit guard that reads community/profile labels through same-origin about.json requests. Reddit receives those requests with browser-session cookies when available. No remotely executed code. |
| alarms | Reconciles timed sessions and protection deadlines, including after browser interruptions. |
| host access | Two permanent Satoru production origins provide the limited status bridge. Attention requests individual hosts. Optional category protection asks separately for HTTP/HTTPS access across sites so its local rules can apply. |

Remote code: No. Do not reuse the old instruction “select no data types”.
Draft Data usage: Browsing history (visited/attempted addresses and Reddit identifiers),
Website content (Reddit community/profile labels and the user's entered task/reason text),
User activity (session outcomes, attempts and limited bridge state). These are handled even
when retained locally. No sale, unrelated use or credit scoring. Authentication cookie
values are not read or stored by extension code; the browser attaches existing Reddit
cookies to same-origin requests. Show this distinction to the owner when confirming the
store form; do not hide it behind a blanket “no data” claim.

### Reviewer instructions

No account needed. In extension options add youtube.com under Attention, approve an entry
scenario, then visit it to see the local purpose/time gate. Enable chess for a feed session;
after its interval expires solve a bundled puzzle to continue within the daily budget.
On a separate test profile, enable optional Browser Protection and grant all-site access;
add example.com to the denylist and visit it to see the boundary. The 7/30/90-day lock
cannot be undone through extension settings before expiry; test it only in a disposable
profile. Browser-level removal remains possible. The optional adult Reddit guard makes
same-origin requests to Reddit; no account or personal browsing data is needed for review.

### Owner steps

1. Upload the **0.10.2** ZIP to the existing draft or a new item; send its Item ID.
2. Paste these fields and use the refreshed screenshots. Confirm Privacy and Distribution
   in the actual form; previous account/draft state has not been rechecked this turn.
3. Submit for review yourself after the web deployment receipt; choose the publication
   timing yourself. An Item ID alone does not prove that an install URL is public.
4. After approval: verify the live listing, then replace download links and test Chrome/
   Brave installation and updating. The system policy/helper is a separate owner action.

## Apple: candidate and declaration evidence

Native build 10 archives are prepared **without signing**: release/build-10 in satoru-ios.
They prove Release compilation, not distribution readiness. The owner's Xcode signing/
upload flow must create the signed archive, then select the new build in TestFlight.
No credentials, certificates, account declarations or store buttons were used here.
Build 9 remains the last recorded TestFlight build; ASC was not read live this turn.

| Data/feature | Draft classification and evidence |
|---|---|
| Name/email; user/session IDs | Linked; App Functionality. Existing auth and device-session routes. User ID also accompanies telemetry/personalization; do not drop these purposes. |
| Plans, notes, reflections, weekly intention and timetable text | Other User Content; linked; App Functionality and Product Personalization where used by the assistant. public/app.js contextual AI and week-planner modules. |
| Senku session/deck facts | Other User Content / study progress; linked. server-senku-bridge-v1.js stores the connection key server-side. Optional AI assignment is gated by aiSpheres. Not payment or authentication of the Satoru account. |
| Uploaded photos/audio; support; fitness | Existing Photos or Videos, Audio Data, Customer Support, Fitness categories remain applicable. Native OCR alone does not upload a timetable image. |
| Native Apple Speech | May process microphone audio on Apple servers. App/ShellView.swift does not require on-device recognition. Do not claim all dictation stays local; transcript can be saved/sent. Audio Data already exists in the draft inventory. Verify applicable Apple processing terms before final labeling. |
| Damage repair | Text fragments around damaged characters go to configured AI after the user requests repair; these are Other User Content, not anonymous merely because fragmented. server.js + damage-repair-v1.js. |
| RPG/shared activity | Gameplay Content; linked. Other User Content for shared names/messages. A private group's content is still user-generated. |
| Interaction/crash/diagnostics | Existing analytics and operational purposes remain. Defaults were not changed. The manifest is not proof of third-party behavior. |
| TikTok/other embeds | Actual tracking and retention are not established. Do not finalize tracking=false based only on absence of an advertising SDK or a native manifest flag. |

All 13 existing categories remain an inventory, not an approved final set. Matrix details:
release/app-store/PRIVACY-MATRIX.md. Final labels must match provider behavior and the
selected release. No automatic “Data Not Collected” or “not linked” declaration.

### Age/content-rights draft

- User-generated content: present (shared names, activity and encouragement reactions).
- Messaging/communication: Tribe already supports /api/party/cheer encouragement
  reactions and invitations. This is interaction; it does not prove a free-text chat exists.
  Review the questionnaire against those current features.
- Loot boxes: inspect randomized chest items separately from gambling; no cash-out or
  money wagering was introduced by this release. Owner confirms the exact questionnaire.
- Advertising, mature/violent/sexual content, unrestricted web access: unresolved for the
  final Inspiration catalog/player configuration. A personal link is not a content license.
- Content rights: owner must confirm rights to included assets/media in distribution regions;
  THIRD-PARTY-NOTICES and credits cover named assets, not every externally linked video.
- Trader/territories and telemetry legal basis remain owner decisions. No personal address,
  legal status or final age number is inferred here.

Recommended product decision: for 1.0 use user-added links and owned/licensed materials,
with TikTok opening externally pending player tracking evidence. Alternative: keep embedded
playback and delay App Review while provider behavior and rights are established. This
recommendation does not silently change the product or close copyright/privacy gates.

### App Review notes — English, replace the old notes after build selection

Satoru combines daily tasks, habits, weekly planning and RPG progress. Use the dedicated
review account already supplied in App Store Connect. Account data and AI require internet.
Create and complete a task in Today, then a habit. In Plan → Week, enter an intention and
open the assistant or recurring timetable. Review proposed changes before saving. AI needs
an available configured provider; confirm the review account has access before submission.
Notes supports text and optional dictation. In build 10, dictation asks for microphone and
Speech access and may use Apple servers. Timetable photo recognition runs on-device;
recognized text is editable before a separate AI-planning request. Den and Tribe expose
personal/shared progress. Senku is optional and needs a separate connection key; core
planning does not depend on it. Settings includes export, account deletion and optional
app lock. Denying speech/camera/notification permissions does not disable text planning.
Family Controls and closed-app blocking are not part of this release. No payment flow was
added. The final Inspiration/player configuration must be reflected here before submission.

### Screenshots and owner acceptance

15 Apple sets from 23.09 are historical. Refresh Today, Habits, Den and Plan from the chosen
build on iPhone/iPad/Mac in five languages after the Inspiration choice; use synthetic data.
Do not fake native screenshots with web captures. Device checklist: allow/deny dictation,
stop/background/retry, speaker after recording, Bluetooth route, timetable OCR edit/save.
Owner's 03.10 “day recap voice works” is recorded; it is not proof of build-10 audio routing.

## Sources checked 03.10

Google requires disclosure of local handling too:
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq.
Apple distinguishes off-device collection and third-party tracking:
https://developer.apple.com/app-store/app-privacy-details/.
Age answers must describe the submitted app:
https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions.
These sources guide the draft; this is not a claim of legal compliance or store approval.
