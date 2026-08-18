/* Satoru Board Pool v1 — СОДЕРЖАНИЕ доски заказов (BOARD-OF-CONTRACTS-PLAN).
 *
 * ⚠️ Это черновик тона, а не финальный пул. §11 в.5 плана прямо говорит:
 * авторские заказы будут заметно лучше по тону. Здесь ~15 личных и по 4
 * сезонных — чтобы доску можно было пощупать и чтобы было что править.
 * Альберт правит текст здесь; логика в `board-v1.js` этот файл не читает и
 * от его содержимого не зависит.
 *
 * Что делает заказ рабочим (§2 плана): он должен быть ВЫПОЛНИМОЙ инструкцией.
 * «Сходи в приключение» — не заказ. «Съезди в город, где не был, и привези
 * оттуда одну фотографию» — заказ. Проверка простая: можно ли начать его
 * сегодня, не приняв ни одного дополнительного решения.
 *
 * Теги описывают ГРАНИ опыта, а не сферу (сфера — отдельное поле): outdoor,
 * indoor, people, solo, body, mind, craft, creative, care, travel, water,
 * cold, early, quiet, bold, detox. На них считается вкус (`board-taste-v1`),
 * поэтому у нового заказа теги обязательны — без них он невидим для подбора.
 *
 * Поля: id (стабильный, не менять после релиза — на него завязаны отметки
 * выполнения), title, sphereId (или null для сезонных), seasonal, seasons.
 * sphereId должен совпадать с id сферы пользователя, иначе заказ просто не
 * получит приоритета — на работу это не влияет.
 */
(function exposeBoardPool(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardPoolV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardPool() {
  'use strict';

  const PERSONAL = [
    // Тело и движение
    { id: 'b-body-newroute', tags: ['outdoor', 'body', 'solo', 'quiet'], sphereId: 'sport', title: 'Пройди пешком маршрут, которым никогда не ходил, — минимум двадцать минут' },
    { id: 'b-body-outside', tags: ['outdoor', 'body', 'bold'], sphereId: 'sport', title: 'Сделай свою обычную тренировку на улице, а не в помещении' },
    { id: 'b-body-water', tags: ['outdoor', 'body', 'water', 'bold', 'cold'], sphereId: 'health', title: 'Искупайся в воде холоднее, чем тебе хочется' },

    // Люди
    { id: 'b-ppl-oldfriend', tags: ['people', 'indoor', 'care', 'quiet'], sphereId: 'mind', title: 'Напиши человеку, с которым не говорил больше полугода. Одно сообщение, без повода' },
    { id: 'b-ppl-cook', tags: ['people', 'indoor', 'craft', 'care'], sphereId: 'health', title: 'Приготовь ужин для кого-то и накрой стол по-настоящему' },
    { id: 'b-ppl-question', tags: ['people', 'indoor', 'care', 'quiet'], sphereId: 'mind', title: 'Спроси у близкого что-то, чего никогда не спрашивал, и не перебивай ответ' },

    // Мастерство и созидание
    { id: 'b-craft-hands', tags: ['craft', 'indoor', 'creative', 'solo'], sphereId: 'mind', title: 'Сделай руками вещь, которую можно взять в руки. Любую' },
    { id: 'b-craft-teach', tags: ['people', 'mind', 'bold'], sphereId: 'study', title: 'Объясни кому-нибудь то, в чём ты хорош, за десять минут' },
    { id: 'b-craft-finish', tags: ['craft', 'solo', 'mind'], sphereId: 'work', title: 'Доделай то, что заброшено дольше месяца, — или честно выброси' },

    // Ум и внимание
    { id: 'b-mind-book', tags: ['mind', 'indoor', 'solo', 'quiet', 'detox'], sphereId: 'study', title: 'Прочитай бумажную книгу час подряд, без телефона в комнате' },
    { id: 'b-mind-nophone', tags: ['detox', 'solo', 'quiet', 'early'], sphereId: 'mind', title: 'Проведи первый час после пробуждения без единого экрана' },
    { id: 'b-mind-write', tags: ['mind', 'creative', 'solo', 'quiet'], sphereId: 'mind', title: 'Напиши от руки страницу о том, чего ты боишься. Никому не показывай' },

    // Место и взгляд
    { id: 'b-place-city', tags: ['travel', 'outdoor', 'bold', 'solo'], sphereId: null, title: 'Съезди туда, где ни разу не был, и привези оттуда одну фотографию' },
    { id: 'b-place-sunrise', tags: ['outdoor', 'early', 'quiet', 'solo'], sphereId: null, title: 'Встреть рассвет вне дома' },
    { id: 'b-place-lost', tags: ['travel', 'outdoor', 'bold', 'solo'], sphereId: null, title: 'Выйди на незнакомой остановке и дойди домой пешком' },

    // ── Батч 2 (17.08): расширение пула до рабочего объёма ─────────────────────
    // Проверка каждого: можно ли начать сегодня, не приняв ни одного доп. решения.

    // Тело и движение
    { id: 'b-body-stairs', tags: ['body', 'indoor', 'solo', 'bold'], sphereId: 'sport', title: 'Поднимись пешком туда, куда обычно едешь на лифте, — и не один раз' },
    { id: 'b-body-carry', tags: ['body', 'outdoor', 'solo'], sphereId: 'sport', title: 'Донеси покупки домой пешком, без транспорта' },
    { id: 'b-body-morning', tags: ['body', 'early', 'solo'], sphereId: 'sport', title: 'Сделай первое движение дня раньше, чем возьмёшь телефон' },
    { id: 'b-body-limit', tags: ['body', 'bold', 'solo'], sphereId: 'sport', title: 'Найди свой предел в одном упражнении и запиши число' },
    { id: 'b-body-barefoot', tags: ['outdoor', 'body', 'quiet'], sphereId: 'health', title: 'Пройди сто шагов босиком по земле, траве или песку' },

    // Люди
    { id: 'b-ppl-thanks', tags: ['people', 'care', 'quiet'], sphereId: 'mind', title: 'Скажи человеку спасибо за то, за что никогда не благодарил' },
    { id: 'b-ppl-listen', tags: ['people', 'care', 'quiet'], sphereId: 'mind', title: 'Проведи разговор, в котором ты только слушаешь' },
    { id: 'b-ppl-invite', tags: ['people', 'bold', 'outdoor'], sphereId: 'mind', title: 'Позови кого-нибудь туда, куда обычно ходишь один' },
    { id: 'b-ppl-help', tags: ['people', 'care', 'craft'], sphereId: 'life', title: 'Сделай за кого-то дело, о котором он не просил' },
    { id: 'b-ppl-old', tags: ['people', 'care', 'quiet'], sphereId: 'mind', title: 'Позвони тому, кто старше тебя, и спроси, как было в его двадцать' },

    // Мастерство и созидание
    { id: 'b-craft-repair', tags: ['craft', 'indoor', 'solo'], sphereId: 'life', title: 'Почини вещь, которую собирался выбросить' },
    { id: 'b-craft-copy', tags: ['craft', 'creative', 'solo'], sphereId: 'mind', title: 'Скопируй чужую работу, которая тебе нравится, — целиком и честно' },
    { id: 'b-craft-ship', tags: ['craft', 'bold', 'solo'], sphereId: 'work', title: 'Покажи кому-нибудь незаконченное' },
    { id: 'b-craft-hour', tags: ['craft', 'solo', 'quiet'], sphereId: 'work', title: 'Работай час над одним делом, не переключаясь ни разу' },
    { id: 'b-craft-worst', tags: ['craft', 'creative', 'solo', 'bold'], sphereId: 'mind', title: 'Сделай нарочно плохо и быстро — просто чтобы оно существовало' },

    // Ум и внимание
    { id: 'b-mind-hard', tags: ['mind', 'solo', 'quiet'], sphereId: 'study', title: 'Разберись в том, что откладывал, потому что казалось сложным' },
    { id: 'b-mind-teachback', tags: ['mind', 'people'], sphereId: 'study', title: 'Перескажи вслух то, что учил, — без конспекта' },
    { id: 'b-mind-wrong', tags: ['mind', 'solo', 'bold'], sphereId: 'mind', title: 'Найди аргумент против того, во что веришь, и дочитай до конца' },
    { id: 'b-mind-question', tags: ['mind', 'solo', 'quiet'], sphereId: 'study', title: 'Запиши вопрос, на который у тебя нет ответа, и поищи его час' },
    { id: 'b-mind-boring', tags: ['mind', 'detox', 'quiet', 'solo'], sphereId: 'mind', title: 'Побудь двадцать минут в скуке — без музыки, экрана и книги' },

    // Быт и порядок
    { id: 'b-life-drawer', tags: ['craft', 'indoor', 'solo'], sphereId: 'life', title: 'Разбери один ящик до конца, а не наполовину' },
    { id: 'b-life-give', tags: ['care', 'craft', 'indoor'], sphereId: 'life', title: 'Отдай пять вещей, которыми не пользовался год' },
    { id: 'b-life-money', tags: ['mind', 'indoor', 'solo'], sphereId: 'life', title: 'Посчитай, куда ушли деньги за последний месяц. Без выводов, просто цифры' },
    { id: 'b-life-cook', tags: ['craft', 'indoor', 'care'], sphereId: 'health', title: 'Приготовь то, что раньше только заказывал' },
    { id: 'b-life-early', tags: ['early', 'solo', 'quiet'], sphereId: 'health', title: 'Ляг спать на час раньше обычного' },

    // Детокс и внимание к себе
    { id: 'b-detox-grey', tags: ['detox', 'solo'], sphereId: 'mind', title: 'Сделай экран телефона чёрно-белым на один день' },
    { id: 'b-detox-unfollow', tags: ['detox', 'solo', 'quiet'], sphereId: 'mind', title: 'Отпишись от десяти аккаунтов, после которых тебе хуже' },
    { id: 'b-detox-nomorning', tags: ['detox', 'early', 'solo'], sphereId: 'mind', title: 'Не бери телефон, пока не выйдешь из дома' },
    { id: 'b-detox-silence', tags: ['detox', 'quiet', 'solo', 'outdoor'], sphereId: 'mind', title: 'Пройди дорогу без наушников' },

    // Место и взгляд
    { id: 'b-place-roof', tags: ['outdoor', 'bold', 'quiet'], sphereId: null, title: 'Найди в своём городе точку, откуда его видно целиком' },
    { id: 'b-place-old', tags: ['travel', 'outdoor', 'quiet'], sphereId: null, title: 'Вернись туда, где не был с детства' },
    { id: 'b-place-water', tags: ['outdoor', 'water', 'quiet'], sphereId: null, title: 'Найди ближайшую воду и дойди до неё пешком' },
    { id: 'b-place-night', tags: ['outdoor', 'quiet', 'solo', 'bold'], sphereId: null, title: 'Пройди по знакомой улице ночью и посмотри, что изменилось' },
    { id: 'b-place-museum', tags: ['indoor', 'mind', 'solo'], sphereId: 'mind', title: 'Зайди в музей на сорок минут и посмотри три вещи вместо сорока' },
  ];

  // Сезонные — общие для всех, тон по §7 плана.
  const SEASONAL = [
    // Лето: приключения, впечатления, люди, поездки
    { id: 's-sum-night', tags: ['outdoor', 'travel', 'bold'], seasonal: true, seasons: ['summer'], title: 'Проведи ночь не дома — палатка, крыша, чужой город' },
    { id: 's-sum-water', tags: ['outdoor', 'water', 'body'], seasonal: true, seasons: ['summer'], title: 'Искупайся в естественном водоёме' },
    { id: 's-sum-stranger', tags: ['people', 'bold', 'outdoor'], seasonal: true, seasons: ['summer'], title: 'Заговори с незнакомым человеком и узнай одну его историю' },
    { id: 's-sum-nomap', tags: ['travel', 'bold', 'detox'], seasonal: true, seasons: ['summer'], title: 'Проведи день без плана и без карты' },

    // Осень: возврат в темп + остатки приключений
    { id: 's-aut-restart', tags: ['mind', 'craft', 'solo'], seasonal: true, seasons: ['autumn'], title: 'Верни одно дело, которое бросил летом' },
    { id: 's-aut-desk', tags: ['indoor', 'craft', 'solo', 'quiet'], seasonal: true, seasons: ['autumn'], title: 'Наведи порядок там, где работаешь, — до пустого стола' },
    { id: 's-aut-walk', tags: ['outdoor', 'body', 'bold', 'quiet'], seasonal: true, seasons: ['autumn'], title: 'Пройди под дождём час и не спрячься' },
    { id: 's-aut-goal', tags: ['mind', 'solo', 'quiet'], seasonal: true, seasons: ['autumn'], title: 'Назови одну вещь, которую хочешь успеть до Нового года, и запиши дату' },

    // Зима: дисциплина, длинные дуги, Winter Arc
    { id: 's-win-arc', tags: ['mind', 'solo', 'body'], seasonal: true, seasons: ['winter'], title: 'Выбери одно дело и делай его каждый день две недели подряд' },
    { id: 's-win-cold', tags: ['outdoor', 'cold', 'body', 'bold'], seasonal: true, seasons: ['winter'], title: 'Выйди на мороз и побудь там дольше, чем комфортно' },
    { id: 's-win-dark', tags: ['indoor', 'detox', 'quiet', 'solo'], seasonal: true, seasons: ['winter'], title: 'Проведи вечер при одном источнике света, без экранов' },
    { id: 's-win-letter', tags: ['mind', 'creative', 'solo', 'quiet'], seasonal: true, seasons: ['winter'], title: 'Напиши письмо себе через год и убери до декабря' },

    // Весна: восстановление, новое начало
    { id: 's-spr-new', tags: ['bold', 'creative', 'mind'], seasonal: true, seasons: ['spring'], title: 'Начни то, чего никогда не пробовал, и продержись три занятия' },
    { id: 's-spr-clean', tags: ['indoor', 'craft', 'solo'], seasonal: true, seasons: ['spring'], title: 'Избавься от десяти вещей, которые тебе не нужны' },
    { id: 's-spr-plant', tags: ['craft', 'care', 'outdoor'], seasonal: true, seasons: ['spring'], title: 'Посади что-нибудь живое и оставь себе ответственность за это' },
    { id: 's-spr-early', tags: ['early', 'outdoor', 'body', 'quiet'], seasonal: true, seasons: ['spring'], title: 'Проснись до шести и выйди на улицу до завтрака' },
  ];

  // Authored orders are content, not UI chrome. Stable ids let each locale keep
  // a natural sentence without using the Russian source text as a translation key.
  const TITLES = {
    'b-body-stairs': { en: 'Take the stairs where you normally take the lift — and not just once', de: 'Nimm die Treppe, wo du sonst den Aufzug nimmst — und nicht nur einmal', uk: 'Піднімись пішки туди, куди зазвичай їдеш ліфтом, — і не один раз', es: 'Sube por las escaleras donde normalmente tomas el ascensor, y no solo una vez' },
    'b-body-carry': { en: 'Carry the groceries home on foot, no transport', de: 'Trag den Einkauf zu Fuß nach Hause, ohne Verkehrsmittel', uk: 'Донеси покупки додому пішки, без транспорту', es: 'Lleva la compra a casa a pie, sin transporte' },
    'b-body-morning': { en: 'Make the first movement of the day before you pick up your phone', de: 'Mach die erste Bewegung des Tages, bevor du zum Handy greifst', uk: 'Зроби перший рух дня раніше, ніж візьмеш телефон', es: 'Haz el primer movimiento del día antes de coger el móvil' },
    'b-body-limit': { en: 'Find your limit in one exercise and write the number down', de: 'Finde in einer Übung dein Limit und schreib die Zahl auf', uk: 'Знайди свою межу в одній вправі й запиши число', es: 'Encuentra tu límite en un ejercicio y anota el número' },
    'b-body-barefoot': { en: 'Walk a hundred steps barefoot on earth, grass or sand', de: 'Geh hundert Schritte barfuß über Erde, Gras oder Sand', uk: 'Пройди сто кроків босоніж по землі, траві чи піску', es: 'Da cien pasos descalzo sobre tierra, hierba o arena' },
    'b-ppl-thanks': { en: 'Thank someone for something you have never thanked them for', de: 'Bedank dich bei jemandem für etwas, wofür du dich nie bedankt hast', uk: 'Скажи людині дякую за те, за що ніколи не дякував', es: 'Da las gracias a alguien por algo que nunca le agradeciste' },
    'b-ppl-listen': { en: 'Have a conversation where you only listen', de: 'Führ ein Gespräch, in dem du nur zuhörst', uk: 'Проведи розмову, в якій ти лише слухаєш', es: 'Ten una conversación en la que solo escuches' },
    'b-ppl-invite': { en: 'Invite someone to a place you usually go alone', de: 'Lade jemanden dorthin ein, wo du sonst allein hingehst', uk: 'Поклич когось туди, куди зазвичай ходиш сам', es: 'Invita a alguien a un sitio al que sueles ir solo' },
    'b-ppl-help': { en: 'Do something for someone who did not ask for it', de: 'Tu etwas für jemanden, der nicht darum gebeten hat', uk: 'Зроби за когось справу, про яку він не просив', es: 'Haz algo por alguien que no te lo pidió' },
    'b-ppl-old': { en: 'Call someone older than you and ask what their twenties were like', de: 'Ruf jemanden an, der älter ist als du, und frag, wie es mit zwanzig war', uk: 'Зателефонуй тому, хто старший за тебе, і спитай, як було в його двадцять', es: 'Llama a alguien mayor que tú y pregúntale cómo fueron sus veinte' },
    'b-craft-repair': { en: 'Repair something you were about to throw away', de: 'Repariere etwas, das du wegwerfen wolltest', uk: 'Полагодь річ, яку збирався викинути', es: 'Repara algo que ibas a tirar' },
    'b-craft-copy': { en: 'Copy a piece of work you admire — fully and honestly', de: 'Kopiere eine Arbeit, die dir gefällt — ganz und ehrlich', uk: 'Скопіюй чужу роботу, яка тобі подобається, — цілком і чесно', es: 'Copia un trabajo ajeno que te guste, entero y con honestidad' },
    'b-craft-ship': { en: 'Show someone something unfinished', de: 'Zeig jemandem etwas Unfertiges', uk: 'Покажи комусь незакінчене', es: 'Enséñale a alguien algo sin terminar' },
    'b-craft-hour': { en: 'Work an hour on one thing without switching once', de: 'Arbeite eine Stunde an einer Sache, ohne ein einziges Mal zu wechseln', uk: 'Працюй годину над однією справою, не перемикаючись жодного разу', es: 'Trabaja una hora en una sola cosa sin cambiar ni una vez' },
    'b-craft-worst': { en: 'Make it deliberately bad and fast — just so it exists', de: 'Mach es absichtlich schlecht und schnell — nur damit es existiert', uk: 'Зроби навмисне погано і швидко — просто щоб воно існувало', es: 'Hazlo mal y rápido a propósito, solo para que exista' },
    'b-mind-hard': { en: 'Get to grips with the thing you postponed because it looked hard', de: 'Nimm dir das vor, was du aufgeschoben hast, weil es schwer aussah', uk: 'Розберися в тому, що відкладав, бо здавалося складним', es: 'Métete con eso que aplazabas porque parecía difícil' },
    'b-mind-teachback': { en: 'Say out loud what you studied — without your notes', de: 'Sag laut, was du gelernt hast — ohne Notizen', uk: 'Перекажи вголос те, що вчив, — без конспекту', es: 'Di en voz alta lo que estudiaste, sin apuntes' },
    'b-mind-wrong': { en: 'Find an argument against something you believe and read it to the end', de: 'Such ein Argument gegen etwas, das du glaubst, und lies es zu Ende', uk: 'Знайди аргумент проти того, у що віриш, і дочитай до кінця', es: 'Busca un argumento contra algo que crees y léelo hasta el final' },
    'b-mind-question': { en: 'Write down a question you cannot answer, then spend an hour looking', de: 'Schreib eine Frage auf, die du nicht beantworten kannst, und such eine Stunde lang', uk: 'Запиши питання, на яке в тебе немає відповіді, і пошукай його годину', es: 'Anota una pregunta que no sepas responder y búscala durante una hora' },
    'b-mind-boring': { en: 'Spend twenty minutes bored — no music, no screen, no book', de: 'Verbring zwanzig Minuten in Langeweile — ohne Musik, Bildschirm und Buch', uk: 'Побудь двадцять хвилин у нудьзі — без музики, екрана і книги', es: 'Pasa veinte minutos aburrido: sin música, sin pantalla, sin libro' },
    'b-life-drawer': { en: 'Clear out one drawer completely, not halfway', de: 'Räum eine Schublade ganz aus, nicht halb', uk: 'Розбери одну шухляду до кінця, а не наполовину', es: 'Vacía un cajón del todo, no a medias' },
    'b-life-give': { en: 'Give away five things you have not used in a year', de: 'Verschenk fünf Dinge, die du seit einem Jahr nicht benutzt hast', uk: 'Віддай пʼять речей, якими не користувався рік', es: 'Regala cinco cosas que no hayas usado en un año' },
    'b-life-money': { en: 'Add up where your money went last month. No conclusions, just the numbers', de: 'Rechne zusammen, wohin dein Geld letzten Monat ging. Keine Schlüsse, nur Zahlen', uk: 'Порахуй, куди пішли гроші за останній місяць. Без висновків, просто цифри', es: 'Suma en qué se fue tu dinero el mes pasado. Sin conclusiones, solo cifras' },
    'b-life-cook': { en: 'Cook something you have only ever ordered', de: 'Koch etwas, das du bisher nur bestellt hast', uk: 'Приготуй те, що раніше тільки замовляв', es: 'Cocina algo que hasta ahora solo habías pedido' },
    'b-life-early': { en: 'Go to bed an hour earlier than usual', de: 'Geh eine Stunde früher ins Bett als sonst', uk: 'Лягай спати на годину раніше, ніж зазвичай', es: 'Acuéstate una hora antes de lo habitual' },
    'b-detox-grey': { en: 'Set your phone screen to greyscale for a day', de: 'Stell deinen Handybildschirm für einen Tag auf Graustufen', uk: 'Зроби екран телефона чорно-білим на один день', es: 'Pon la pantalla del móvil en blanco y negro durante un día' },
    'b-detox-unfollow': { en: 'Unfollow ten accounts that leave you feeling worse', de: 'Entfolge zehn Accounts, nach denen es dir schlechter geht', uk: 'Відпишись від десяти акаунтів, після яких тобі гірше', es: 'Deja de seguir a diez cuentas que te dejan peor' },
    'b-detox-nomorning': { en: 'Do not touch your phone until you have left the house', de: 'Fass dein Handy nicht an, bis du aus dem Haus bist', uk: 'Не бери телефон, поки не вийдеш з дому', es: 'No toques el móvil hasta que salgas de casa' },
    'b-detox-silence': { en: 'Walk the route without headphones', de: 'Geh den Weg ohne Kopfhörer', uk: 'Пройди дорогу без навушників', es: 'Haz el camino sin auriculares' },
    'b-place-roof': { en: 'Find the spot in your city where you can see the whole of it', de: 'Finde den Punkt in deiner Stadt, von dem aus du sie ganz siehst', uk: 'Знайди у своєму місті точку, звідки його видно цілком', es: 'Encuentra el punto de tu ciudad desde donde se ve entera' },
    'b-place-old': { en: 'Go back somewhere you have not been since childhood', de: 'Geh zurück an einen Ort, an dem du seit deiner Kindheit nicht warst', uk: 'Повернись туди, де не був з дитинства', es: 'Vuelve a un sitio en el que no has estado desde la infancia' },
    'b-place-water': { en: 'Find the nearest water and walk to it', de: 'Finde das nächste Gewässer und geh zu Fuß hin', uk: 'Знайди найближчу воду і дійди до неї пішки', es: 'Encuentra el agua más cercana y ve caminando' },
    'b-place-night': { en: 'Walk a familiar street at night and see what changed', de: 'Geh nachts eine vertraute Straße entlang und sieh, was sich ändert', uk: 'Пройди знайомою вулицею вночі й подивись, що змінилося', es: 'Recorre de noche una calle conocida y mira qué cambia' },
    'b-place-museum': { en: 'Go to a museum for forty minutes and look at three things instead of forty', de: 'Geh vierzig Minuten ins Museum und sieh dir drei Dinge an statt vierzig', uk: 'Зайди в музей на сорок хвилин і подивись три речі замість сорока', es: 'Ve a un museo cuarenta minutos y mira tres cosas en vez de cuarenta' },
    'b-body-newroute': { en: 'Walk a route you have never taken before — at least twenty minutes', de: 'Geh mindestens zwanzig Minuten einen Weg, den du noch nie genommen hast', uk: 'Пройди пішки маршрутом, яким ніколи не ходив, — щонайменше двадцять хвилин', es: 'Camina al menos veinte minutos por una ruta que nunca hayas recorrido' },
    'b-body-outside': { en: 'Do your usual workout outside instead of indoors', de: 'Mach dein übliches Training draußen statt drinnen', uk: 'Зроби своє звичне тренування надворі, а не в приміщенні', es: 'Haz tu entrenamiento habitual al aire libre en vez de dentro' },
    'b-body-water': { en: 'Swim in water colder than you would like', de: 'Bade in Wasser, das kälter ist, als dir lieb ist', uk: 'Скупайся у воді, холоднішій, ніж тобі хотілося б', es: 'Báñate en agua más fría de lo que te gustaría' },
    'b-ppl-oldfriend': { en: 'Message someone you have not spoken to in over six months. One message, no occasion needed', de: 'Schreib jemandem, mit dem du seit über einem halben Jahr nicht gesprochen hast. Eine Nachricht, ohne Anlass', uk: 'Напиши людині, з якою не говорив понад пів року. Одне повідомлення, без приводу', es: 'Escribe a alguien con quien no hablas desde hace más de medio año. Un mensaje, sin motivo' },
    'b-ppl-cook': { en: 'Cook dinner for someone and set the table properly', de: 'Koch für jemanden zu Abend und deck den Tisch richtig', uk: 'Приготуй для когось вечерю й накрий стіл по-справжньому', es: 'Prepara la cena para alguien y pon la mesa de verdad' },
    'b-ppl-question': { en: 'Ask someone close to you something you have never asked, and do not interrupt the answer', de: 'Frag einen nahen Menschen etwas, das du noch nie gefragt hast, und unterbrich die Antwort nicht', uk: 'Запитай близьку людину про те, чого ніколи не питав, і не перебивай відповідь', es: 'Pregunta a alguien cercano algo que nunca le hayas preguntado y no interrumpas su respuesta' },
    'b-craft-hands': { en: 'Make something with your hands that you can physically hold. Anything', de: 'Mach mit deinen Händen etwas, das du anfassen kannst. Irgendetwas', uk: 'Зроби руками річ, яку можна взяти до рук. Будь-яку', es: 'Haz con tus manos algo que puedas sostener. Cualquier cosa' },
    'b-craft-teach': { en: 'Explain something you are good at to someone in ten minutes', de: 'Erklär jemandem in zehn Minuten etwas, worin du gut bist', uk: 'Поясни комусь за десять хвилин те, у чому ти вправний', es: 'Explica a alguien en diez minutos algo que se te dé bien' },
    'b-craft-finish': { en: 'Finish something abandoned for over a month — or honestly throw it away', de: 'Beende etwas, das seit über einem Monat liegen geblieben ist — oder wirf es ehrlich weg', uk: 'Дороби те, що покинуте понад місяць, — або чесно викинь', es: 'Termina algo abandonado desde hace más de un mes, o deséchalo con honestidad' },
    'b-mind-book': { en: 'Read a paper book for a full hour, with no phone in the room', de: 'Lies eine Stunde lang ein gedrucktes Buch, ohne Telefon im Zimmer', uk: 'Читай паперову книжку годину без перерви, без телефона в кімнаті', es: 'Lee un libro en papel durante una hora seguida, sin el teléfono en la habitación' },
    'b-mind-nophone': { en: 'Spend the first hour after waking without a single screen', de: 'Verbring die erste Stunde nach dem Aufwachen ohne einen einzigen Bildschirm', uk: 'Проведи першу годину після пробудження без жодного екрана', es: 'Pasa la primera hora después de despertar sin ninguna pantalla' },
    'b-mind-write': { en: 'Write one page by hand about what you fear. Show no one', de: 'Schreib von Hand eine Seite über das, wovor du Angst hast. Zeig sie niemandem', uk: 'Напиши від руки сторінку про те, чого боїшся. Нікому не показуй', es: 'Escribe a mano una página sobre lo que temes. No se la enseñes a nadie' },
    'b-place-city': { en: 'Go somewhere you have never been and bring back one photograph', de: 'Fahr an einen Ort, an dem du noch nie warst, und bring ein Foto mit', uk: 'Поїдь туди, де ще не був, і привези звідти одну фотографію', es: 'Ve a un lugar donde nunca hayas estado y trae una fotografía' },
    'b-place-sunrise': { en: 'Meet the sunrise outside your home', de: 'Erlebe den Sonnenaufgang außerhalb deines Zuhauses', uk: 'Зустрінь світанок поза домом', es: 'Recibe el amanecer fuera de casa' },
    'b-place-lost': { en: 'Get off at an unfamiliar stop and walk home', de: 'Steig an einer unbekannten Haltestelle aus und geh zu Fuß nach Hause', uk: 'Вийди на незнайомій зупинці й дійди додому пішки', es: 'Baja en una parada desconocida y vuelve a casa caminando' },
    's-sum-night': { en: 'Spend a night away from home — a tent, a rooftop, another city', de: 'Verbring eine Nacht nicht zu Hause — im Zelt, auf einem Dach oder in einer fremden Stadt', uk: 'Проведи ніч не вдома — намет, дах або чуже місто', es: 'Pasa una noche fuera de casa: en tienda, en una azotea o en otra ciudad' },
    's-sum-water': { en: 'Swim in a natural body of water', de: 'Bade in einem natürlichen Gewässer', uk: 'Скупайся в природній водоймі', es: 'Báñate en una masa de agua natural' },
    's-sum-stranger': { en: 'Talk to a stranger and learn one of their stories', de: 'Sprich mit einem fremden Menschen und erfahre eine seiner Geschichten', uk: 'Заговори з незнайомою людиною й дізнайся одну її історію', es: 'Habla con una persona desconocida y descubre una de sus historias' },
    's-sum-nomap': { en: 'Spend a day without a plan or a map', de: 'Verbring einen Tag ohne Plan und ohne Karte', uk: 'Проведи день без плану й без мапи', es: 'Pasa un día sin plan ni mapa' },
    's-aut-restart': { en: 'Bring back one thing you abandoned over the summer', de: 'Nimm eine Sache wieder auf, die du im Sommer aufgegeben hast', uk: 'Поверни одну справу, яку покинув улітку', es: 'Retoma una cosa que abandonaste durante el verano' },
    's-aut-desk': { en: 'Clear the place where you work until the desk is empty', de: 'Räum deinen Arbeitsplatz auf, bis der Tisch leer ist', uk: 'Наведи лад там, де працюєш, — до порожнього столу', es: 'Ordena el lugar donde trabajas hasta dejar la mesa vacía' },
    's-aut-walk': { en: 'Walk in the rain for an hour without hiding from it', de: 'Geh eine Stunde durch den Regen, ohne Schutz zu suchen', uk: 'Іди під дощем годину й не ховайся', es: 'Camina una hora bajo la lluvia sin esconderte' },
    's-aut-goal': { en: 'Name one thing you want to finish before New Year and write down a date', de: 'Nenne eine Sache, die du vor Neujahr schaffen willst, und notiere ein Datum', uk: 'Назви одну річ, яку хочеш встигнути до Нового року, і запиши дату', es: 'Nombra una cosa que quieras terminar antes de Año Nuevo y apunta una fecha' },
    's-win-arc': { en: 'Choose one thing and do it every day for two weeks', de: 'Wähle eine Sache und tu sie zwei Wochen lang jeden Tag', uk: 'Обери одну справу й роби її щодня протягом двох тижнів', es: 'Elige una cosa y hazla cada día durante dos semanas' },
    's-win-cold': { en: 'Go out into the cold and stay longer than feels comfortable', de: 'Geh in die Kälte und bleib länger, als es angenehm ist', uk: 'Вийди на мороз і побудь там довше, ніж комфортно', es: 'Sal al frío y quédate más tiempo del que resulte cómodo' },
    's-win-dark': { en: 'Spend an evening with one light source and no screens', de: 'Verbring einen Abend bei nur einer Lichtquelle und ohne Bildschirme', uk: 'Проведи вечір при одному джерелі світла, без екранів', es: 'Pasa una tarde con una sola fuente de luz y sin pantallas' },
    's-win-letter': { en: 'Write a letter to yourself one year from now and put it away until December', de: 'Schreib dir selbst einen Brief für in einem Jahr und leg ihn bis Dezember weg', uk: 'Напиши листа собі через рік і сховай до грудня', es: 'Escribe una carta para tu yo de dentro de un año y guárdala hasta diciembre' },
    's-spr-new': { en: 'Start something you have never tried and stay with it for three sessions', de: 'Beginne etwas, das du noch nie versucht hast, und bleib drei Einheiten dabei', uk: 'Почни те, чого ніколи не пробував, і протримайся три заняття', es: 'Empieza algo que nunca hayas probado y mantenlo durante tres sesiones' },
    's-spr-clean': { en: 'Let go of ten things you do not need', de: 'Trenn dich von zehn Dingen, die du nicht brauchst', uk: 'Позбудься десяти речей, які тобі не потрібні', es: 'Deshazte de diez cosas que no necesitas' },
    's-spr-plant': { en: 'Plant something living and take responsibility for it', de: 'Pflanze etwas Lebendiges und übernimm die Verantwortung dafür', uk: 'Посади щось живе й візьми за це відповідальність', es: 'Planta algo vivo y asume la responsabilidad de cuidarlo' },
    's-spr-early': { en: 'Wake before six and go outside before breakfast', de: 'Steh vor sechs auf und geh vor dem Frühstück nach draußen', uk: 'Прокинься до шостої й вийди надвір до сніданку', es: 'Despierta antes de las seis y sal antes del desayuno' },
  };

  function titleFor(order, locale) {
    const row = order && TITLES[order.id];
    return row && row[locale] ? row[locale] : order && order.title ? order.title : '';
  }

  return { PERSONAL, SEASONAL, ALL: PERSONAL.concat(SEASONAL), TITLES, titleFor };
});
