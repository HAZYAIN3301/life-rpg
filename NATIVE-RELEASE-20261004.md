# Продолжение выпуска 04.10 — build 11 / privacy / ES

Web runtime остаётся v328. Native локальный коммит e911378; remote native не настроен.

- Apple capabilities включены для существующих main/DeviceActivityMonitor/
  ShieldConfiguration/ShieldAction. Общая группа group.com.satoruapp.satoru.
- iOS и Mac signed build 11 загружены в App Store Connect; сервер Apple принял пакеты
  в обработку. Это не подтверждение app review или доступности внутренней группе.
- На сопряжённый iPhone 14 установлен development-signed build 11; запуск остановлен
  заблокированным экраном. Веб-кабинет ASC требует вход владельца.
- public/privacy.html дополнен на пяти языках: локальные tokens, ограничения, причины,
  намерение, счётчики; App Group; отсутствие серверной/AI-передачи; независимость от
  web-аккаунта/его удаления; отзыв разрешения в iOS; нет чтения постов чужих приложений.
- Это описание реализованной обработки, не заявление о завершённой юридической проверке.
- ES Заход: два живых ответа PASS. Следующий live apply/reload сценарий дважды упёрся
  в rate_limit; запросы остановлены. См. AI-ROUTES-V327.md.
- Privacy: Chromium/WebKit × 375/1280, пять якорей/языков, без переполнения/JS errors.
  Файл не входит в SHELL, изменение только документационное; CACHE не поднимался.

Осталось владельцу: разблокировать iPhone и device checklist; войти в ASC для проверки
обработки/группы; правдивые store-декларации и отправка review; CWS draft/Item ID
(браузерный инструмент отказал в автоматизации галереи расширений).
Полный список: satoru-ios/release/OWNER-ACTIONS-20261004.md.
