# Проверенный кандидат B2.5 / B2.13

Чистая ветка: `codex/b25-app-transfer-20261027`.
Runtime-коммит: `f8ff6916f29a899fc3e7e176002d5fe6d473d4c0`, единственный родитель
`3eca22b1b12221973a7c8215b7833b430bd60a1f` (`origin/master` после свежего fetch).
Отклонённый `d203502b` не предок; B26 js/css/test/plan/QA-файлы не включены.
Рабочий коммит `93562dca` сохранён в прежней ветке; для выпуска брать чистую ветку.

Кандидат отдельно экспортирован из Git и собран, без старых `.checks` артефактов:

```sh
npm run build --prefix redesign/b27
npm test --prefix redesign/b27
node --test --test-concurrency=2 scripts/*.test.js
```

- TypeScript + оба esbuild build: PASS.
- 174 live/model/baseline: PASS;3387 исходных tests: PASS,0 fail/skip.
- Повторная сборка byte-identical для всех7 app-entry assets и обоих preview bundles.
- Native B3/attention byte-contract check против чистого экспорта: PASS.
- Native commit `ca8291bf`: Debug build/install/launch через локальный скрипт PASS.
 18 Swift core tests PASS. UI/iPhone границы остаются в [B213-QA.md](B213-QA.md).

Последний readback: [final-readback.json](review/b213/final-readback.json).
Два новых synthetic notes, один новый synthetic task; actualMin остаётся unknown,
награды не начислялись. Старый task «Собрать план новой недели» полностью совпадает
с прежним JSON из B2.10 readback: core=false,09:00/60min/actual2. Новый task тоже
возвращён к core=false. День открыт, подтверждённая рефлексия сохранена.
Тема ru/light/motion=true; прежние покупки20/25/40 и World quest сохранены.

Итоговый [мобильный экран](review/b213/today-final-375.png) снят в браузере375×812.
Есть также desktop1280, dark Today и dark Notes. Это не снимки физического iPhone.
Production/удалённые ветки/TestFlight не обновлялись. Публикация — решение владельца.
