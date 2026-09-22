# App Review — подготовленный текст

22.09.2026. Черновик; вставить только после проверки выбранной сборки.
Ниже нет пароля и нет выдуманного demo account. Владелец создаёт отдельный
проверочный аккаунт и вводит пароль непосредственно в App Store Connect.
Личный аккаунт владельца для review не использовать.

## Notes (English)

Satoru is a task planner and habit tracker with RPG-style progress.
The supplied review account must be used for the email/password sign-in flow.
An internet connection is required for account data and server-backed features.

Suggested review path:
1. Sign in, open Today and create a task. Complete it to see progress.
2. Open Habits and create or complete a habit.
3. Open Settings. Search for a setting and select a result to reveal its section.
4. In Profile & access, open Device and sign-in. App lock and notifications
   are optional; denying their permissions must not prevent ordinary use.
5. Account data can be exported and the account can be deleted from Settings.

Sign in with Apple currently supports existing linked Satoru accounts.
First sign in with email/password, then link Apple in Device and sign-in using
the current Satoru password. Subsequent Apple sign-in is available on the login screen.
No account is automatically merged based on its email address.
Google sign-in is not available unless its provider is configured.

AI features require an available configured provider and the applicable account
access. Text-based settings search does not require AI. Do not claim that every
AI feature is available to the review account without testing it first.

The current Founder Pass surface is an interest survey, not a checkout, and does
not charge money. No referral reward campaign is currently implemented.
Do not represent Screen Time blocking as available in the submitted build:
Family Controls distribution approval and the corresponding release remain separate.

## Проверить перед вставкой

- Выбранные iOS/macOS версии; логин demo account; контактный телефон для App Review.
- Доступные reviewer-аккаунту функции и живой backend; отсутствие чужих личных данных.
- Удаление аккаунта и отзыв Apple-доступа на отдельном тестовом аккаунте.
- Проверка первой регистрации и Apple-входа, а не только повторного входа владельца.
- Зафиксировать модель устройства, ОС, сборку и результат для iPhone/iPad/Mac.

Источник: https://developer.apple.com/app-store/review/ (проверено 22.09.2026).
