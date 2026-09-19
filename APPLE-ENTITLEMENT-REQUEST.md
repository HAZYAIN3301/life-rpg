# Заявка Apple на Family Controls — черновик для подачи

> 2026-08-25. Составлено Claude для подачи Альбертом: подавать нужно с его Apple Developer
> аккаунта, я этого сделать не могу и не должен.
> Контекст: `DISCIPLINE-ESCAPE-PLAN.md` §2 (региональный предел), §7 (R5), §14 (privacy).
> **Подавать стоит СЕЙЧАС, до готовности PWA** — это внешний процесс на недели-месяцы,
> и он единственный в плане, который нельзя ускорить своей работой.

---

## Куда подавать

Форма запроса Family Controls (Distribution):
https://developer.apple.com/contact/request/family-controls-distribution
Требуется существующий App ID. **Заявка подаётся отдельно на каждый Bundle ID и на каждое
расширение Screen Time** (обновлено 17.09):

- `com.satoruapp.satoru` — приложение;
- `com.satoruapp.satoru.DeviceActivityMonitor`;
- `com.satoruapp.satoru.ShieldConfiguration`;
- `com.satoruapp.satoru.ShieldAction`.

Сайт для заявки и App Store: `https://satoruapp.com` (куплен 17.09). Порядок: сначала
зарегистрировать App ID с capability Family Controls, затем подать заявки. Ответ Apple —
от нескольких дней до нескольких недель, поэтому подавать сразу после регистрации App ID.
Разработка на своём iPhone работает и без одобрения.

Три отдельные вещи, не путать:
- `com.apple.developer.family-controls` — базовый, даёт picker/shield/schedules;
- distribution-вариант того же — нужен для публикации в App Store, а не только для разработки;
- `...family-controls.app-and-website-usage` — детальная активность, **в ЕС-регионах**.
  Украинскому Apple Account третий недоступен (§2), и на него в заявке НЕ рассчитываем.

---

## Что важно понимать до подачи

Apple выдаёт этот entitlement выборочно. Отказ — реальный, не формальный, сценарий:
исторически его давали в первую очередь родительскому контролю, и лишь затем
приложениям самоограничения (Opal, one sec, Jomo — все живут с ним).

**Поэтому архитектура не должна на него закладываться.** В спеке это уже учтено:
R1–R3 работают без него, iOS деградирует до Shortcuts-моста, а Android даёт полную
статистику через `UsageStatsManager` независимо от решения Apple. Заявка — это
попытка усилить продукт, а не условие его существования.

Два предсказуемых основания для отказа, которых надо избежать формулировкой:
1. **«Это не про контроль устройства, а про мотивацию».** Лечится тем, что заявка прямо
   называет `ManagedSettings`-shield как механизм, а не «геймификацию».
2. **«Приложение собирает данные об активности».** Лечится тем, что заявка честно
   говорит: детальная активность нам не нужна и не запрашивается.

---

## Текст заявки (EN — Apple принимает на английском)

> **App name:** Satoru
> **What the app does:** Satoru is a personal life-tracking and self-management app. It
> helps a person plan real tasks, keep habits, and understand where their time and
> attention actually go.
>
> **Why we need Family Controls:** Satoru includes a self-directed attention feature.
> Before opening an app that the user themselves has identified as a problem for them,
> Satoru asks what they intend to do there and for how long, and records the outcome.
> The planned iOS feature lets the person choose a short, bounded restriction in advance,
> instead of relying only on an on-screen reminder. We are building an individual,
> voluntary self-management tool, with no parental or remote supervision.
>
> We need `FamilyControls` and `ManagedSettings` to honor that limit: to let the user pick
> their own apps through `FamilyActivityPicker`, and to shield those apps for a short,
> user-defined window (typically 10–30 minutes) once the window they granted themselves
> has expired.
>
> **Who controls it:** The user, and only the user, on their own device. This is not a
> parental-control product. There is no supervisor, no remote administration, no second
> party who can impose or extend a restriction. Every restriction is opt-in, is configured
> by the person it applies to, is bounded in time, and ships with a user-defined emergency
> exit (a limited number of passes with a short delay) so the person is never locked away
> from their own phone in a genuine emergency.
>
> **What data we collect:** We do not request `app-and-website-usage`. We do not need
> real bundle identifiers, domains, or exportable activity data, and our implementation is
> designed to work only with the opaque tokens returned by `FamilyActivityPicker`. What
> Satoru stores is what the user tells it: the purpose they declared before opening an app,
> the limit they chose, and the outcome they reported afterward. We never collect message
> content, search queries, browsing history, watched media, screen text, or an accessibility
> tree. The planned implementation keeps opaque selection tokens on the device and does
> not depend on detailed usage access. Any synchronization of user-declared attention
> records will require separate explicit opt-in and account-deletion support.
>
> **Why not an alternative API:** Screen Time is the only mechanism on iOS that can honor a
> limit the user set for themselves. Without it the app can show a reminder and record a
> user-reported intention or outcome, but cannot shield another app.

---

## Что приложить, если попросят

- Ссылку на описание фичи (`DISCIPLINE-ESCAPE-PLAN.md` §9–§10 — режимы, лимиты, аварийный выход).
- Скриншот/видео экрана входа и границы, когда Codex его соберёт (R1).
- Формулировку privacy-политики: разделы §14 переносятся почти дословно.

---

## После подачи

- Записать дату подачи здесь — срок ответа непредсказуем, и без даты через месяц никто не вспомнит.
- Отказ **не блокирует** R1–R4. Он означает: iOS остаётся на Shortcuts-мосте (§3), Android даёт полный Control, и это честно пишется в интерфейсе, а не обещается.
- Не менять регион Apple Account ради этой функции: затрагивает платежи, подписки и App Store, а детальную аналитику всё равно не откроет вне ЕС.

**19.09.2026:** членство активно, Team ID `8Y9TR9L674`; заявки владелец ещё не подал.
Это описание проектируемой функции: настоящий iOS shield ещё не реализован.
Перед отправкой владелец сверяет форму Apple и фактически зарегистрированные App IDs.

| Bundle ID | Дата подачи | Ответ |
|---|---|---|
| `com.satoruapp.satoru` | не подана | — |
| `com.satoruapp.satoru.DeviceActivityMonitor` | не подана | — |
| `com.satoruapp.satoru.ShieldConfiguration` | не подана | — |
| `com.satoruapp.satoru.ShieldAction` | не подана | — |

**Дата подачи:** _не подана_
**Ответ Apple:** _—_
