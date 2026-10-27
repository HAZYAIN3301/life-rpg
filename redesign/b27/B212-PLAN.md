# B2.12 — Мир на данных аккаунта

Основание: утверждённый B2.5, запрос владельца 27.10. Не менять generated,
исходные app.js/index.html/styles.css, auth/B3/attention, native и параллельные 3D/ассеты.

1. Проекция исходных владельцев: герой/уровни/XP, спутники реальных сфер,
   companion/bond/journal, schema V4 дерева, xpEvents/эпизоды. Никакого demo seed.
2. Пять вкладок B2.5: Дом, Герой, Спутники, Путь, Прогресс. Сохранить композицию,
   типографику и живые иллюстрации. Изолированный scene host с текущим Den renderer;
   будущий 3D меняет renderer, не settings.den, ownership и взаимодействия.
3. Сохранить исходные редакторы гардероба/поз/параметров, питомцев/Кацую,
   обустройства комнаты, AI-карты, подробной статистики. Оптимистические записи
   настройки спутников/комнаты/эпизодов заменить подтверждёнными адаптерами.
4. Реальный путь: критерий/шаг/доказательство, зависимости, карта/список,
   игровой слой/очки/перки, редактор/координаты/перетаскивание/удаление/раскладка.
   Подтверждённые вехи сохраняют историю. Следующий шаг создаётся один раз.
5. Проверки: pure model + async bridge на fail/retry/stale/actor/load-error,
   исходные доменные контракты, build/syntax/baseline, реальный браузер+API readback
   только на локальном QA аккаунте. Телефон375 и desktop1280, light/dark, клавиатура.
6. QA-отчёт/передача/локальный commit явных путей. Без push/publish/deploy.

Карта покрытия: Дом → исходная сцена+редактор Den; Герой → avatarAppearance,
characterWardrobe, avatarEditor, body-form, arsenal/relic/cosmetic/title owners;
Спутники → topSkills/petSVG, species/fortune/wear, rename, canonical interactions,
RecoverySlug, saveCompanionCare/Name/journal; Путь → State.tree V4, nodePerks,
nodeUnlockable/treePoints, personal-map AI; Прогресс → xpEvents/curve/ranks,
actualMin отдельно от estimate, source stats/load/restores/reflections, episodes.
