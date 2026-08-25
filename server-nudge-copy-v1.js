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
      near: ['Доброе утро! Чем наполним сегодня?', 'Утро. Один маленький шаг — и день уже не пустой.', 'С добрым утром! Что сегодня в фокусе?', 'Новый день, чистый лист. Куда посмотрим?', 'Утро — хорошее время начать с малого.'],
      mid: ['Давно не виделись — как ты вообще?', 'Тут стало тихо в последние дни. Есть пару минут?', 'Не тороплю — просто загляни, когда будет момент.', 'Соскучились по тебе твои сферы. Как оно?'],
      far: ['Сколько бы ни прошло — здесь по-прежнему ждут. Без спешки.', 'Ничего не пропало и не сгорело. Возвращайся в свой темп.', 'Будет минутка — заглядывай, в любой момент, без спешки.', 'Без вины, правда: просто будет свободная минута — заглядывай.'],
    },
    e: {
      near: ['Как прошёл день? Загляни на минутку 💛', 'Вечер — время подвести итог дня, даже коротко.', 'Как всё сегодня? Пара слов — и уже что-то.', 'День почти закончился. Что в нём было хорошего?'],
      mid: ['Несколько дней тишины. Как ты?', 'Не пропадай совсем — даже пара минут вечером считается.', 'Вечер — хороший момент вернуться, без спешки.'],
      far: ['Вечер. Здесь всё так же спокойно ждут — без вины за паузу.', 'Сколько бы дней ни прошло, дверь открыта в любое время.', 'Не срочно и без давления — просто напоминаю, что жду.'],
    },
    p: ['{pet} давно тебя не видел в этой сфере — загляни на минутку 💛', 'Кажется, {pet} немного скучает без тебя в этой сфере.', '{pet} ждёт хоть немного внимания здесь.', 'Загляни к {pet} — тут давно ничего не происходило.'],
    q: ['Давно тебя не видел. Это был отдых, занятость или что-то тяжёлое?', 'Тебя не было пару дней. Как оно — по-хорошему тихо или наоборот?', 'Ты пропал, и я не знаю почему. Расскажешь одной строкой?'],
  },
  en: {
    m: {
      near: ['Morning! What are we filling today with?', 'Morning. One small step and the day is no longer empty.', 'Good morning! What is in focus today?', 'New day, clean page. Where shall we look?', 'Morning is a good time to start small.'],
      mid: ['Been a while — how are you doing?', 'It has gone quiet here these past days. Got a couple of minutes?', 'No rush — just drop in when there is a moment.', 'Your spheres have missed you. How is it going?'],
      far: ['However long it has been, you are still expected here. No rush.', 'Nothing was lost and nothing burned down. Come back at your own pace.', 'When a minute turns up, drop in — any time, no hurry.', 'No guilt, truly: whenever a free minute shows up, come by.'],
    },
    e: {
      near: ['How was the day? Drop in for a minute 💛', 'Evening — a good time to close the day, even briefly.', 'How did today go? A couple of words is already something.', 'The day is nearly over. What was good in it?'],
      mid: ['A few quiet days. How are you?', 'Do not disappear entirely — even a couple of evening minutes count.', 'Evening is a good moment to come back, no rush.'],
      far: ['Evening. You are still quietly expected here — no guilt for the pause.', 'However many days have passed, the door is open any time.', 'Not urgent and no pressure — just letting you know I am here.'],
    },
    p: ['{pet} has not seen you in this sphere for a while — drop in for a minute 💛', '{pet} seems to miss you a little in this sphere.', '{pet} is waiting for even a bit of attention here.', 'Look in on {pet} — nothing has happened here in a long time.'],
    q: ['Have not seen you in a while. Was that rest, being busy, or something heavy?', 'You were away a couple of days. How was it — quiet in a good way, or not?', 'You disappeared and I do not know why. Tell me in one line?'],
  },
  de: {
    m: {
      near: ['Guten Morgen! Womit füllen wir heute?', 'Morgen. Ein kleiner Schritt und der Tag ist nicht mehr leer.', 'Guten Morgen! Was steht heute im Fokus?', 'Neuer Tag, leeres Blatt. Wohin schauen wir?', 'Der Morgen ist eine gute Zeit, klein anzufangen.'],
      mid: ['Lange nicht gesehen — wie geht es dir?', 'Hier ist es die letzten Tage still geworden. Hast du ein paar Minuten?', 'Kein Stress — schau vorbei, wenn ein Moment da ist.', 'Deine Bereiche haben dich vermisst. Wie läuft es?'],
      far: ['Wie lange es auch her ist — hier wartet man weiter auf dich. Ohne Eile.', 'Nichts ist verloren und nichts ist verbrannt. Komm in deinem Tempo zurück.', 'Wenn eine Minute auftaucht, schau rein — jederzeit, ohne Eile.', 'Wirklich ohne schlechtes Gewissen: wann immer eine freie Minute da ist, komm vorbei.'],
    },
    e: {
      near: ['Wie war der Tag? Schau kurz rein 💛', 'Abend — eine gute Zeit, den Tag abzuschließen, auch kurz.', 'Wie lief es heute? Ein paar Worte sind schon etwas.', 'Der Tag ist fast vorbei. Was war gut daran?'],
      mid: ['Ein paar stille Tage. Wie geht es dir?', 'Verschwinde nicht ganz — auch ein paar Minuten am Abend zählen.', 'Der Abend ist ein guter Moment zurückzukommen, ohne Eile.'],
      far: ['Abend. Hier wartet man weiter in Ruhe — ohne schlechtes Gewissen für die Pause.', 'Wie viele Tage auch vergangen sind, die Tür steht jederzeit offen.', 'Nicht dringend und ohne Druck — ich sage nur, dass ich da bin.'],
    },
    p: ['{pet} hat dich in diesem Bereich lange nicht gesehen — schau kurz vorbei 💛', '{pet} scheint dich in diesem Bereich ein wenig zu vermissen.', '{pet} wartet hier auf ein bisschen Aufmerksamkeit.', 'Schau bei {pet} vorbei — hier ist lange nichts passiert.'],
    q: ['Habe dich lange nicht gesehen. War das Erholung, viel zu tun, oder etwas Schweres?', 'Du warst ein paar Tage weg. Wie war es — angenehm still oder eher nicht?', 'Du bist verschwunden und ich weiß nicht warum. Erzählst du es in einer Zeile?'],
  },
  uk: {
    m: {
      near: ['Доброго ранку! Чим наповнимо сьогодні?', 'Ранок. Один маленький крок — і день уже не порожній.', 'З добрим ранком! Що сьогодні у фокусі?', 'Новий день, чистий аркуш. Куди подивимось?', 'Ранок — гарний час почати з малого.'],
      mid: ['Давно не бачились — як ти взагалі?', 'Тут стало тихо останніми днями. Є пара хвилин?', 'Не кваплю — просто зазирни, коли буде момент.', 'Скучили за тобою твої сфери. Як воно?'],
      far: ['Скільки б не минуло — тут і далі чекають. Без поспіху.', 'Нічого не зникло і не згоріло. Повертайся у своєму темпі.', 'Буде хвилинка — зазирай, будь-коли, без поспіху.', 'Без провини, справді: просто буде вільна хвилина — зазирай.'],
    },
    e: {
      near: ['Як минув день? Зазирни на хвилинку 💛', 'Вечір — час підбити підсумок дня, навіть коротко.', 'Як усе сьогодні? Пара слів — і вже щось.', 'День майже скінчився. Що в ньому було доброго?'],
      mid: ['Кілька днів тиші. Як ти?', 'Не зникай зовсім — навіть пара хвилин увечері рахується.', 'Вечір — гарний момент повернутися, без поспіху.'],
      far: ['Вечір. Тут так само спокійно чекають — без провини за паузу.', 'Скільки б днів не минуло, двері відчинені будь-коли.', 'Не терміново і без тиску — просто нагадую, що чекаю.'],
    },
    p: ['{pet} давно не бачив тебе в цій сфері — зазирни на хвилинку 💛', 'Здається, {pet} трохи сумує без тебе в цій сфері.', '{pet} чекає хоч трохи уваги тут.', 'Зазирни до {pet} — тут давно нічого не відбувалося.'],
    q: ['Давно тебе не бачив. Це був відпочинок, зайнятість чи щось важке?', 'Тебе не було пару днів. Як воно — по-доброму тихо чи навпаки?', 'Ти зник, і я не знаю чому. Розкажеш одним рядком?'],
  },
  es: {
    m: {
      near: ['¡Buenos días! ¿Con qué llenamos hoy?', 'Mañana. Un pequeño paso y el día ya no está vacío.', '¡Buenos días! ¿Qué está en foco hoy?', 'Día nuevo, hoja limpia. ¿Hacia dónde miramos?', 'La mañana es buen momento para empezar con poco.'],
      mid: ['Hace tiempo que no nos vemos — ¿cómo estás?', 'Aquí se ha quedado en silencio estos días. ¿Tienes un par de minutos?', 'Sin prisa — pásate cuando haya un momento.', 'Tus áreas te han echado de menos. ¿Cómo va?'],
      far: ['Haya pasado lo que haya pasado, aquí se te sigue esperando. Sin prisa.', 'Nada se perdió ni se quemó. Vuelve a tu propio ritmo.', 'Cuando aparezca un minuto, pásate — cuando sea, sin prisa.', 'Sin culpa, de verdad: cuando tengas un minuto libre, pásate.'],
    },
    e: {
      near: ['¿Qué tal el día? Pásate un minuto 💛', 'La tarde es buen momento para cerrar el día, aunque sea breve.', '¿Cómo fue hoy? Un par de palabras ya es algo.', 'El día casi termina. ¿Qué hubo de bueno en él?'],
      mid: ['Unos días de silencio. ¿Cómo estás?', 'No desaparezcas del todo — un par de minutos por la tarde ya cuentan.', 'La tarde es buen momento para volver, sin prisa.'],
      far: ['Tarde. Aquí se te sigue esperando con calma — sin culpa por la pausa.', 'Hayan pasado los días que sea, la puerta está abierta en cualquier momento.', 'Nada urgente y sin presión — solo te recuerdo que estoy aquí.'],
    },
    p: ['{pet} hace tiempo que no te ve en esta área — pásate un minuto 💛', 'Parece que {pet} te echa un poco de menos en esta área.', '{pet} espera aunque sea un poco de atención por aquí.', 'Pásate a ver a {pet} — hace mucho que no pasa nada por aquí.'],
    q: ['Hace tiempo que no te veo. ¿Fue descanso, estar ocupado, o algo difícil?', 'Estuviste fuera un par de días. ¿Cómo fue — silencio del bueno, o no?', 'Desapareciste y no sé por qué. ¿Me lo cuentas en una línea?'],
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
