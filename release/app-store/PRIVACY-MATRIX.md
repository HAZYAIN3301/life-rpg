# Privacy labels — таблица для проверки

22.09.2026; база кода db9e5b6. Это рабочая инвентаризация, не отправленная декларация.
Нельзя выбирать Data Not Collected: аккаунт и его содержимое уходят на сервер.
Собирать данные только для работы функции тоже означает необходимость декларирования.

| Категория Apple | Что есть в Satoru | Назначение / связь | Основание |
|---|---|---|---|
| Name, Email Address | Имя, email аккаунта | App Functionality; связано с аккаунтом | server.js auth routes |
| User ID | ID аккаунта и привязки входа | App Functionality; связано | OAUTH-NATIVE-V1.md; server.js |
| Device ID — проверить точное соответствие | ID запомненной установки/сессии, платформа и имя | App Functionality; связано | DEVICE-SESSIONS-V264.md |
| Other User Content | Задачи, заметки, цели, рефлексии, выбранные файлы | App Functionality; связано | server.js data/inbox routes |
| Gameplay Content | RPG-прогресс, награды, персонаж | App Functionality; связано | account export / progression |
| Photos or Videos, Audio Data | Вложения, которые пользователь отправляет | App Functionality; связано | server.js INBOX_EXT/INBOX_MIME |
| Fitness | Импорт тренировок и подключение Strava | App Functionality; связано | server.js /api/strava; импорт файла |
| Customer Support | Обращения / feedback | App Functionality; связано | server.js /api/feedback |
| Product Interaction | Имена событий и использование функций | Analytics; связано с ID | server.js /api/analytics |
| Crash Data, Other Diagnostic Data | Сообщения о сбоях и диагностические сведения | App Functionality; проверить дополнительные назначения | server.js crash/feedback export |

Свободный текст может содержать личные сведения. Это не основание объявлять
специальный сбор всех возможных категорий, но структурированные поля и контекст
каждой включённой функции нужно проверить отдельно. Для внешних media/AI нужны
реальные правила провайдера и фактические запросы; отсутствие рекламного SDK
само по себе не доказывает отсутствие tracking у всех партнёров.

## Что не следует ошибочно заявлять

- Face ID/Touch ID не передают Satoru шаблон лица или отпечатка: проверка в ОС.
- Данные, оставшиеся только локально, отличаются от данных, отправленных на сервер.
- Founder Pass сейчас не принимает платёжные карты. Будущий checkout потребует
  нового аудита; не заполнять платежные категории по планам, как по готовому коду.
- Локальный поиск настроек не отправляет поисковую строку. Кнопка ИИ отправляет
  строку и каталог заголовков; режимы хранения у провайдера ещё подлежат проверке.
- Privacy manifest в бинарнике и privacy labels в App Store Connect — разные вещи.
  22.09 native исходники скопированы в ~/Projects/satoru-ios с сохранением оригинала.
  Manifest проверен в двух подписанных архивах build 8: добавлены ранее пропущенные
  Device ID установки и Gameplay Content (linked, App Functionality).

## Не закрыто

1. Optional telemetry сейчас defaultOn=true для safety, product_improvement,
   personalization, engagement_optimization; experimentation=false. Источник:
   public/telemetry-consent-v1.js. Не описывать их как выключенные до согласия.
   Предложение: выключить необязательные цели до явного выбора; решение владельца
   и миграция существующих согласий нужны отдельно.
2. retentionDays в модуле: 30/180/180/365/90/180. Это значения политики;
   не считать их доказательством физического удаления у всех инфраструктурных сервисов.
3. Railway, Cloudflare, Apple iCloud и реально включённые AI/media-провайдеры:
   договоры, регионы, retention, субпроцессоры и передачи данных ещё не подтверждены.
4. Окончательные purposes для каждого типа и linked/tracking ответы утвердить
   по финальному составу сборки. Разделы Health, Sensitive Info, Search/Browsing
   History проверить по конкретным интеграциям, не угадывать.
5. Публичные реквизиты продавца, регион запуска и статус trader не определять
   автоматически из языка, гражданства или будущего Kleingewerbe.

Источник категорий и определения collection:
https://developer.apple.com/app-store/app-privacy-details/ (22.09.2026).
Это не заключение о полном соответствии GDPR или правилам магазина.
