# B2.5 / v344 опубликован, 27.10.2026

Владелец разрешил обновить сайт и текущий TestFlight для всех пользователей.
Runtime `4973db94009b5124f6051684576b886b43890225` отправлен fast-forward в master
из чистой ветки `codex/b25-app-transfer-20261027`. Отклонённый d203502b не предок;
B26 JS/CSS отсутствуют. Параллельные ветки и native remote не менялись.

Railway life-rpg **success**:
https://railway.com/project/b7468036-1520-433f-937f-1d73b73d933b/service/7a8e0c26-8a60-4bcc-ade2-f9f2e0f7ac7c?id=b1881347-6925-4646-8112-5da81a74e56d&environmentId=6765444e-61c8-49b4-b37c-d3759cc4985f

В18:02 Europe/Berlin оба домена — satoruapp.com и Railway alias — подтвердили
именно этот commit и `satoru-v344` через `/api/version`. SHA-256 всех10 проверенных
файлов на каждом домене совпал с Git: index/core/SW/new UI+CSS+runtime/review,
source styles/B3 contract и hero image. **20/20, mismatch0.**
[Полная квитанция](review/b214/release-receipt.json).

3387 source +176 live/model/baseline +268 профильных economy проверок PASS;
TypeScript/esbuild/syntax/diff, source data readback/reload, RU/EN/DE/темы/клавиатура.
После чистой пересборки файлы идентичны Git. [QA](B214-QA.md).
Public welcome375px загрузился без console errors; authenticated покупки проверены
только на изолированном серверном Тестовом герое. Production задачи/награды не правились.

В текущем TestFlight обновляется web root: полностью закрыть Satoru и открыть снова,
при предложении перезагрузки воспользоваться им. Новый Apple binary не загружался,
номер установленной native-сборки не меняется из-за web-релиза. Проверка на физическом
iPhone/VoiceOver/полного offline остаётся открытой; её не заменяют browser screenshots.

Следующий commit содержит только эту квитанцию/docs/evidence: public runtime тот же.
Доступность и metadata последнего docs deployment проверяются отдельно без повторной
переборки функциональных тестов. Будущий 3D и новый multiplayer в этот выпуск не входят.
