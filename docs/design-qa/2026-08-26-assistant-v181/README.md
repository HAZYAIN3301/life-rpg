# Assistant v181 — visual/live QA

Финальные артефакты сняты с локального release-candidate v181 после rebase и последнего CSS/JS-байта.

## Кадры

- `assistant-de-light-360.jpg` — German, light, 360×800.
- `assistant-de-light-375.jpg` — German, light, 375×812.
- `assistant-de-dark-1280.jpg` — German, dark, 1280×900.

## Измеренные гейты

- document horizontal overflow: `0` на 360/375/1280;
- mobile dialog: `344×725.6` на 360 и `359×725.6` на 375, внутри viewport;
- mobile visible controls below 42 px: `0`;
- desktop dialog: `640×573.8`, полностью внутри 1280×900;
- initial focus: `#chat-input`;
- Escape: dialog removed, inert removed, body scroll restored;
- mobile More → assistant → Escape: focus returns to persistent `[data-action=mobile-nav-more]`, не в `BODY`;
- microphone denial: visible localized status, `aria-pressed=false`;
- German copy and light/dark layout: no meaning-bearing truncation.

Action whitelist, ownership, confirmation, rollback/Retry и reduced-motion дополнительно зафиксированы executable tests; модельный API в preview использовал заведомо невалидный fixture-key, поэтому никакие реальные пользовательские данные внешнему провайдеру не отправлялись.

Проверки release candidate: assistant actions/wake/UI + PWA/Attention/Shelf/recovery **75/75**, полный suite **1021/1021**. Все три файла — настоящие JPEG/JFIF с точными размерами из названий.
