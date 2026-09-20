# B2 и отзываемый вход WKWebView — v266

20.09.2026. Дополнение к DEVICE-SESSIONS-V264.md, без изменения dat1/drt1.

## Протокол

- `POST /api/auth/devices/web-session` принимает только действующий Bearer dat1.
  Возвращает `{ok, webSessionToken, expiresAt}`; обычную полноправную куку не выдаёт.
- dws1 подписан отдельным назначением HMAC и живёт максимум 30 дней. Каждый запрос
  проверяет живого пользователя, sessionVersion и active device. Это не access/refresh token.
- Нативный клиент сохраняет его в Secure, HttpOnly, SameSite=Strict cookie
  `lrpg_device` для origin приложения. Refresh остаётся только в Keychain.
- Наличие lrpg_device исключает fallback на lrpg_sess, даже когда первая кука
  отозвана/невалидна. Удаление/смена пароля/отзыв прекращают web-доступ.
- Bound cookie имеет те же права, что device bearer: нельзя выдавать новый доступ,
  подтверждать устройства, отзывать чужие или все. Можно отозвать себя.
- Вход по паролю очищает bound cookie. Обычный logout с bound cookie сначала
  сохраняет отзыв устройства; foreground native refresh не восстанавливает выход.
- GET devices добавляет canManageAll. GET version добавляет
  capabilities.deviceWebSessions=true; старые клиенты продолжают работать.

## Интерфейс

Настройки → Профиль и доступ: список, новый доступ, «Это я», отзыв одного/всех,
обновление и честная ошибка. Уведомление вне Настроек ведёт прямо к списку.
Пять языков. Bound-клиент видит ограниченные кнопки и объяснение управления через
обычный вход в браузере. После mutation — durable receipt и повторный GET.
Опрос раз в минуту только на видимой странице, без перерисовки чужих форм.
Epoch аккаунта защищает ответы и диалог отзыва; clearAllData сбрасывает epoch.
Диалог поддерживает Escape, ловушку фокуса и возврат к исходной кнопке.

## Проверки

- Полный runner concurrency=2: 3028 PASS на окончательном кандидате,
  включая account-epoch guard (53.95 сек).
- HTTP/unit: разделение token purposes, lifetime, scope, запрет fallback,
  revoke/logout/logout-all, unreadable store, ошибка записи, sessionVersion.
- UI: локальный изолированный сервер, empty/dense, 375/1280, RU dark,
  DE/UK/ES/EN light; notices → settings, ack, revoke с повторным чтением,
  cancel/Escape и возврат фокуса. Данные production не менялись.
- Native DEBUG probe: 18 сценариев с настоящими Keychain/WK cookie APIs в
  iPhone simulator: rotation/reopen/revoke, очистка ключа/куки, восстановление
  отсутствующей куки, web logout, свежий login после revoke, смена аккаунта.

Это не проверка подписанного iPhone/Mac, Siri, APNs или Family Controls.
Release-native регистрация зависит от capability сервера. На физическом iPhone
ещё нужны Developer Mode и сертификат; unsigned Mac не прошёл Keychain probe.
Локальный HTTP test origin, отдельные Keychain/WK stores и probe — только DEBUG.
В Release остаётся HTTPS production origin без тестовых переключателей.
