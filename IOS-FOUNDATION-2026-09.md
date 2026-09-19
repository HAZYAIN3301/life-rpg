# Первый локальный iOS foundation — 19.09.2026

## Результат и границы

SwiftUI-приложение Satoru собирается в Xcode 26.6 для iOS 17+ и запускается
на iPhone 14 simulator (iOS 26.5). UI основного продукта пока WKWebView.
Нативный слой: ошибки загрузки/retry, настройки, просмотр/отзыв устройств,
ручной режим внимания и пять App Shortcuts из общего B3-словаря.

Это начало C1, не завершение дорожки C и не App Store/TestFlight release.
Настоящие login/device mutation не выполнялись на production при QA.
Native registration выключена кодовым gate до B2 web notices и hybrid-session QA.
Swift core tests не означают проверку всего приложения или настоящего Keychain.

## Идентичность и окружение

- Team ID: `8Y9TR9L674`, членство активно по сообщению владельца.
- Локальный Bundle ID: `com.satoruapp.satoru`; фактическая регистрация в кабинете
  Apple не перепроверена. Идентификаторы в кабинете агент не создавал.
- iOS 17 — начальный минимум для Observation/SwiftUI; iPhone 14 поддерживается.
- Xcode 26.6 (17F113), iOS runtime 26.5 (23F77).
- Создан simulator `A0B2E5F0-32FB-4879-BD8A-69127450B348`.
- `security find-identity -p codesigning -v`: 0 valid identities.
- Исходники:
  `/Users/al.prokopets/Documents/Codex/2026-09-19/1-2-team-id-8y9tr9l674-3-3/outputs/satoru-ios`.
- DerivedData:
  `/private/tmp/satoru-ios-derived-8y9tr9l674`. В Documents File Provider добавляет
  FinderInfo к собранным bundles и ломает codesign. Сборочные продукты держать
  вне синхронизации. Исходники не помещать в Obsidian Vault.
- Native remote GitHub не создан; для его создания и первого push нужен отдельный
  ответ владельца по исходному handoff.

## Вход

Выбран WKWebView: существующий cookie login без изменения server auth API.
HttpOnly/SameSite=Strict не ослаблены; native не принимает пароли.
Keychain adapter хранит только refresh credential и timestamp незавершённого
обновления (`WhenUnlockedThisDeviceOnly`); access живёт только в памяти.
Transport ephemeral, cookie storage выключен; HTTP redirects для API запрещены.
Refresh single-flight; после generic 401 максимум один refresh и один повтор;
при device_revoked выход; неизвестный исход refresh повторяет тот же ключ в
консервативном окне 55 секунд. Marker сохраняется до запроса, включая crash path.

**Гейт:** гибридный клиент имеет отдельную web cookie. Проверка native-токена
при foreground не превращает все web-запросы в bearer-запросы. До включения
постоянного входа необходимо проверить account switch, logout, отзыв и web
fallback, не обещая мгновенный отзыв всей web-сессии по отзыву device token.
Также нужен B2 web UI, чтобы устройства были видны из других сессий.
Пока используется обычный web login; native registration скрыта и отключена.

## Ссылки и команды

Общий B3 JS parser копируется без изменений и исполняется через JavaScriptCore;
конечный web executor паркует намерение через вход, очищает URL и применяет
однократно с 30-минутным сроком. Extension target resolution остаётся за web.
Это переиспользование контракта, не завершённый Swift-порт.
App Shortcuts: capture/gate/return/finish/dayrec, без самостоятельных мутаций.
Metadata успешно скомпилирована без Siri entitlement. Siri execution, locked
device и cold-start App Intent ещё требуют проверки. Shortcut phrases пока EN.

Associated Domains настроены в app entitlements для satoruapp.com.
На обоих доменах AASA 404; Universal Links end-to-end не подтверждены.
Ожидаемая переменная владельца:
`APPLE_APP_IDS=8Y9TR9L674.com.satoruapp.satoru`.

## Следующий цельный срез

1. B2 web devices + needsAck notification в пяти языках.
2. Изолированный серверный QA hybrid auth и настоящее устройство/подпись.
3. Включение native registration только после этих проверок.
4. C3 Swift-порт всех 47 attention fixtures; B6/WAL перед C4.
5. Настоящие Family Controls targets и fail-open; сейчас shield не реализован.
6. App Intents execution/localization, privacy manifest/labels, внутренний TestFlight.

Корпус attention только скопирован; тест `scripts/check-contracts.mjs` проверяет
совпадение с web, но не исполнение корпуса на Swift. Награды/экономика,
Senku, avatar и Rest Profile не изменены. Заявки Apple подаёт владелец.
