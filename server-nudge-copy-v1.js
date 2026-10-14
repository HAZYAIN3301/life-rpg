'use strict';
/* Тексты пушей на пяти языках (i18n-приоритет 18.08: eng → deu → rus → ukr → esp).
 *
 * До этого весь `NUDGE_TEXT` жил в server.js только по-русски: немецкий или английский
 * пользователь получал пуши на языке, которого не знает. Для RU+DE-запуска это ломает
 * ровно ту поверхность, которая возвращает людей в приложение.
 *
 * ⚠️ Тон здесь важнее буквальности, и это не украшение. Пуш приходит непрошеным и часто
 * в плохой момент; весь `ALTERNEYT` держится на том, что приложение не производит вину.
 * Русские оригиналы намеренно мягкие — «без вины», «не тороплю», «в свой темп», — и
 * перевод обязан нести это, а не подстрочник. Поэтому:
 *  — никаких «ты пропустил», «снова», «должен», «не забыл ли ты» — это язык Duolingo,
 *    и он в этом продукте прямо запрещён (см. BACKLOG про уведомления с характером);
 *  — чем дольше человека не было (`far`), тем ТЕПЛЕЕ текст, а не настойчивее. Это
 *    контринтуитивно для маркетинга и намеренно: человек, пропавший на две недели,
 *    возвращается от «дверь открыта», а не от «ты нас потерял»;
 *  — `{pet}` — технический placeholder, он обязан пережить перевод во всех локалях.
 *
 * Чистый модуль: только данные и выбор строки, ничего не читает и не пишет.
 */

const LOCALES = ['ru', 'en', 'de', 'uk', 'es'];
const FALLBACK = 'ru';   // исходный язык копий: русский, как и по всему проекту

const COPY = {
  ru: {
    m: {
      near: ['Доброе утро! Чем наполним сегодня?', 'Утро. Один маленький шаг — и день уже не пустой.', 'С добрым утром! Что сегодня в фокусе?', 'Новый день, чистый лист. Куда посмотрим?', 'Утро — хорошее время начать с малого.', 'Доброе утро. Выбери одно дело — остальные подождут в очереди, как приличные.', 'Утро. Если сегодня только одно — пусть будет то, что легче всего начать.', 'Дай пять. Лапу. Дымку — как получится. С чего начнём?', 'Вчерашнее записано, сегодняшнее чистое. Люблю этот момент.'],
      mid: ['Давно не виделись — как ты вообще?', 'Тут стало тихо в последние дни. Есть пару минут?', 'Не тороплю — просто загляни, когда будет момент.', 'Пауза — тоже часть пути. Захочешь — начнём с одного дела.', 'Ничего не сгорело и не потерялось. Сферы на месте, Логово тоже.'],
      far: ['Сколько бы ни прошло — здесь по-прежнему ждут. Без спешки.', 'Ничего не пропало и не сгорело. Возвращайся в свой темп.', 'Будет минутка — заглядывай, в любой момент, без спешки.', 'Без вины, правда: просто будет свободная минута — заглядывай.', 'Я тут, без счёта дней. Захочешь вернуться — дверь открыта.'],
    },
    e: {
      near: ['Как прошёл день? Загляни на минутку 💛', 'Вечер — время подвести итог дня, даже коротко.', 'Как всё сегодня? Пара слов — и уже что-то.', 'День почти закончился. Что в нём было хорошего?', 'Вечер. Одна строка про день — и я запишу её в летопись.', 'Что было лучшим сегодня? Даже если это был обед.', 'День можно закрыть и без идеального списка. Закроем?'],
      mid: ['Несколько дней тишины. Как ты?', 'Вечер — хороший момент вернуться, без спешки.', 'Если было тяжело — можно просто написать «тяжело». Списка дел не будет.'],
      far: ['Вечер. Здесь всё так же спокойно ждут — без вины за паузу.', 'Сколько бы дней ни прошло, дверь открыта в любое время.', 'Не срочно и без давления — просто напоминаю, что жду.', 'Я тут, без счёта дней. Захочешь вернуться — дверь открыта.'],
    },
    p: ['Загляни к {pet} — тут давно ничего не происходило.', '{pet} нашёл в сфере «{sphere}» старое дело и разглядывает его. Посмотрите вместе?', 'В сфере «{sphere}» тихо. Если это осознанно — всё в порядке, {pet} просто спит.'],
    q: ['Давно тебя не видел. Это был отдых, занятость или что-то тяжёлое?', 'Тебя не было пару дней. Как оно — по-хорошему тихо или наоборот?', 'Если было тяжело, хватит одного слова. Как ты?'],
  },
  en: {
    m: {
      near: ['Morning! What are we filling today with?', 'Morning. One small step and the day is no longer empty.', 'Good morning! What is in focus today?', 'New day, clean page. Where shall we look?', 'Morning is a good time to start small.', 'Morning. Pick one task — the rest can wait in line like civilized tasks.', 'Morning. If there\'s room for just one thing today, make it the easiest to start.', 'High five. Paw. Wisp — whatever works. Where do we start?', 'Yesterday\'s written down, today\'s blank. I like this moment.'],
      mid: ['Been a while — how are you doing?', 'It has gone quiet here these past days. Got a couple of minutes?', 'No rush — just drop in when there is a moment.', 'A pause is part of the path too. When you want, we\'ll start with one task.', 'Nothing burned down, nothing got lost. Your spheres are here, so is the Den.'],
      far: ['However long it has been, you are still expected here. No rush.', 'Nothing was lost and nothing burned down. Come back at your own pace.', 'When a minute turns up, drop in — any time, no hurry.', 'No guilt, truly: whenever a free minute shows up, come by.', 'I\'m here, not counting days. If you want to come back, the door\'s open.'],
    },
    e: {
      near: ['How was the day? Drop in for a minute 💛', 'Evening — a good time to close the day, even briefly.', 'How did today go? A couple of words is already something.', 'The day is nearly over. What was good in it?', 'Evening. One line about your day, and I\'ll put it in the chronicle.', 'What was the best part of today? Even if it was lunch.', 'You can close the day without a perfect list. Shall we?'],
      mid: ['A few quiet days. How are you?', 'Evening is a good moment to come back, no rush.', 'If it\'s been hard, you can just write "hard". No to-do list will follow.'],
      far: ['Evening. You are still quietly expected here — no guilt for the pause.', 'However many days have passed, the door is open any time.', 'Not urgent and no pressure — just letting you know I am here.', 'I\'m here, not counting days. If you want to come back, the door\'s open.'],
    },
    p: ['Look in on {pet} — nothing has happened here in a long time.', '{pet} found an old task in "{sphere}" and is studying it. Take a look together?', 'It\'s quiet in "{sphere}". If that\'s on purpose, all good — {pet} is just napping.'],
    q: ['Have not seen you in a while. Was that rest, being busy, or something heavy?', 'You were away a couple of days. How was it — quiet in a good way, or not?', 'If it\'s been hard, one word is enough. How are you?'],
  },
  de: {
    m: {
      near: ['Guten Morgen! Womit füllen wir heute?', 'Morgen. Ein kleiner Schritt und der Tag ist nicht mehr leer.', 'Guten Morgen! Was steht heute im Fokus?', 'Neuer Tag, leeres Blatt. Wohin schauen wir?', 'Der Morgen ist eine gute Zeit, klein anzufangen.', 'Guten Morgen. Such dir eine Aufgabe aus — der Rest wartet brav in der Schlange.', 'Morgen. Wenn heute nur eine Sache drin ist — dann die, die am leichtesten anfängt.', 'Gib mir fünf. Pfote. Rauchschwade — wie es eben geht. Womit fangen wir an?', 'Gestern ist notiert, heute ist leer. Ich mag diesen Moment.'],
      mid: ['Lange nicht gesehen — wie geht es dir?', 'Hier ist es die letzten Tage still geworden. Hast du ein paar Minuten?', 'Kein Stress — schau vorbei, wenn ein Moment da ist.', 'Eine Pause gehört auch zum Weg. Wenn du magst, fangen wir mit einer Sache an.', 'Nichts ist abgebrannt, nichts verloren. Deine Bereiche sind da, die Höhle auch.'],
      far: ['Wie lange es auch her ist — hier wartet man weiter auf dich. Ohne Eile.', 'Nichts ist verloren und nichts ist verbrannt. Komm in deinem Tempo zurück.', 'Wenn eine Minute auftaucht, schau rein — jederzeit, ohne Eile.', 'Wirklich ohne schlechtes Gewissen: wann immer eine freie Minute da ist, komm vorbei.', 'Ich bin da und zähle keine Tage. Wenn du zurückwillst — die Tür ist offen.'],
    },
    e: {
      near: ['Wie war der Tag? Schau kurz rein 💛', 'Abend — eine gute Zeit, den Tag abzuschließen, auch kurz.', 'Wie lief es heute? Ein paar Worte sind schon etwas.', 'Der Tag ist fast vorbei. Was war gut daran?', 'Abend. Eine Zeile über deinen Tag — und ich trage sie in die Chronik ein.', 'Was war heute das Beste? Auch wenn es das Mittagessen war.', 'Man kann den Tag auch ohne perfekte Liste abschließen. Machen wir?'],
      mid: ['Ein paar stille Tage. Wie geht es dir?', 'Der Abend ist ein guter Moment zurückzukommen, ohne Eile.', 'Wenn es schwer war, schreib einfach „schwer". Eine To-do-Liste kommt nicht.'],
      far: ['Abend. Hier wartet man weiter in Ruhe — ohne schlechtes Gewissen für die Pause.', 'Wie viele Tage auch vergangen sind, die Tür steht jederzeit offen.', 'Nicht dringend und ohne Druck — ich sage nur, dass ich da bin.', 'Ich bin da und zähle keine Tage. Wenn du zurückwillst — die Tür ist offen.'],
    },
    p: ['Schau bei {pet} vorbei — hier ist lange nichts passiert.', '{pet} hat in „{sphere}" eine alte Aufgabe gefunden und mustert sie. Schaut ihr gemeinsam?', 'In „{sphere}" ist es ruhig. Wenn das so gewollt ist, alles gut — {pet} schläft nur.'],
    q: ['Habe dich lange nicht gesehen. War das Erholung, viel zu tun, oder etwas Schweres?', 'Du warst ein paar Tage weg. Wie war es — angenehm still oder eher nicht?', 'Wenn es schwer war, reicht ein Wort. Wie geht es dir?'],
  },
  uk: {
    m: {
      near: ['Доброго ранку! Чим наповнимо сьогодні?', 'Ранок. Один маленький крок — і день уже не порожній.', 'З добрим ранком! Що сьогодні у фокусі?', 'Новий день, чистий аркуш. Куди подивимось?', 'Ранок — гарний час почати з малого.', 'Доброго ранку. Обери одну справу — решта почекає в черзі, як годиться.', 'Ранок. Якщо сьогодні лише одне — нехай це буде те, що найлегше почати.', 'Дай п\'ять. Лапу. Димок — як вийде. З чого почнемо?', 'Учорашнє записано, сьогоднішнє чисте. Люблю цю мить.'],
      mid: ['Давно не бачились — як ти взагалі?', 'Тут стало тихо останніми днями. Є пара хвилин?', 'Не кваплю — просто зазирни, коли буде момент.', 'Пауза — теж частина шляху. Захочеш — почнемо з однієї справи.', 'Нічого не згоріло й не загубилося. Сфери на місці, Лігво теж.'],
      far: ['Скільки б не минуло — тут і далі чекають. Без поспіху.', 'Нічого не зникло і не згоріло. Повертайся у своєму темпі.', 'Буде хвилинка — зазирай, будь-коли, без поспіху.', 'Без провини, справді: просто буде вільна хвилина — зазирай.', 'Я тут, без лічби днів. Захочеш повернутися — двері відчинені.'],
    },
    e: {
      near: ['Як минув день? Зазирни на хвилинку 💛', 'Вечір — час підбити підсумок дня, навіть коротко.', 'Як усе сьогодні? Пара слів — і вже щось.', 'День майже скінчився. Що в ньому було доброго?', 'Вечір. Один рядок про день — і я запишу його до літопису.', 'Що сьогодні було найкращим? Навіть якщо це був обід.', 'День можна закрити й без ідеального списку. Закриємо?'],
      mid: ['Кілька днів тиші. Як ти?', 'Вечір — гарний момент повернутися, без поспіху.', 'Якщо було важко — можна просто написати «важко». Списку справ не буде.'],
      far: ['Вечір. Тут так само спокійно чекають — без провини за паузу.', 'Скільки б днів не минуло, двері відчинені будь-коли.', 'Не терміново і без тиску — просто нагадую, що чекаю.', 'Я тут, без лічби днів. Захочеш повернутися — двері відчинені.'],
    },
    p: ['Зазирни до {pet} — тут давно нічого не відбувалося.', '{pet} знайшов у сфері «{sphere}» стару справу й розглядає її. Подивитеся разом?', 'У сфері «{sphere}» тихо. Якщо це свідомо — усе гаразд, {pet} просто спить.'],
    q: ['Давно тебе не бачив. Це був відпочинок, зайнятість чи щось важке?', 'Тебе не було пару днів. Як воно — по-доброму тихо чи навпаки?', 'Якщо було важко, вистачить одного слова. Як ти?'],
  },
  es: {
    m: {
      near: ['¡Buenos días! ¿Con qué llenamos hoy?', 'Mañana. Un pequeño paso y el día ya no está vacío.', '¡Buenos días! ¿Qué está en foco hoy?', 'Día nuevo, hoja limpia. ¿Hacia dónde miramos?', 'La mañana es buen momento para empezar con poco.', 'Buenos días. Elige una tarea; las demás esperarán en la cola, como es debido.', 'Mañana. Si hoy solo cabe una cosa, que sea la más fácil de empezar.', 'Choca esos cinco. Pata. Humo, lo que salga. ¿Por dónde empezamos?', 'Lo de ayer está apuntado, lo de hoy en blanco. Me gusta este momento.'],
      mid: ['Hace tiempo que no nos vemos — ¿cómo estás?', 'Aquí se ha quedado en silencio estos días. ¿Tienes un par de minutos?', 'Sin prisa — pásate cuando haya un momento.', 'Una pausa también es parte del camino. Cuando quieras, empezamos con una tarea.', 'Nada se ha quemado ni perdido. Tus áreas siguen aquí, y la Guarida también.'],
      far: ['Haya pasado lo que haya pasado, aquí se te sigue esperando. Sin prisa.', 'Nada se perdió ni se quemó. Vuelve a tu propio ritmo.', 'Cuando aparezca un minuto, pásate — cuando sea, sin prisa.', 'Sin culpa, de verdad: cuando tengas un minuto libre, pásate.', 'Aquí estoy, sin contar días. Si quieres volver, la puerta está abierta.'],
    },
    e: {
      near: ['¿Qué tal el día? Pásate un minuto 💛', 'La tarde es buen momento para cerrar el día, aunque sea breve.', '¿Cómo fue hoy? Un par de palabras ya es algo.', 'El día casi termina. ¿Qué hubo de bueno en él?', 'Tarde. Una línea sobre tu día y la apunto en la crónica.', '¿Qué fue lo mejor de hoy? Aunque haya sido la comida.', 'Se puede cerrar el día sin una lista perfecta. ¿Lo cerramos?'],
      mid: ['Unos días de silencio. ¿Cómo estás?', 'La tarde es buen momento para volver, sin prisa.', 'Si ha sido duro, puedes escribir solo «duro». No vendrá ninguna lista.'],
      far: ['Tarde. Aquí se te sigue esperando con calma — sin culpa por la pausa.', 'Hayan pasado los días que sea, la puerta está abierta en cualquier momento.', 'Nada urgente y sin presión — solo te recuerdo que estoy aquí.', 'Aquí estoy, sin contar días. Si quieres volver, la puerta está abierta.'],
    },
    p: ['Pásate a ver a {pet} — hace mucho que no pasa nada por aquí.', '{pet} encontró una tarea vieja en «{sphere}» y la está examinando. ¿La miráis juntos?', 'Hay calma en «{sphere}». Si es a propósito, todo bien: {pet} solo duerme.'],
    q: ['Hace tiempo que no te veo. ¿Fue descanso, estar ocupado, o algo difícil?', 'Estuviste fuera un par de días. ¿Cómo fue — silencio del bueno, o no?', 'Si ha sido duro, basta una palabra. ¿Cómo estás?'],
  },
};


function normalizeLocale(lang) {
  const l = typeof lang === 'string' ? lang.trim().slice(0, 5).toLowerCase() : '';
  const short = l.split(/[-_]/)[0];
  return LOCALES.includes(short) ? short : FALLBACK;
}

/**
 * Пул строк для канала. `kind`: 'm' | 'e' — с бакетом near/mid/far; 'p' | 'q' — плоские.
 * Неизвестный язык или канал не роняет пуш, а падает в русский: молчащее уведомление
 * хуже, чем уведомление на исходном языке.
 */
function pool(lang, kind, bucket) {
  const table = COPY[normalizeLocale(lang)] || COPY[FALLBACK];
  const branch = table[kind] || COPY[FALLBACK][kind];
  if (!branch) return [];
  if (Array.isArray(branch)) return branch;
  return branch[bucket] || branch.near || [];
}

module.exports = { LOCALES, FALLBACK, COPY, normalizeLocale, pool };
