/* Satoru Guide v3 — Spanish (Español) runtime copy.
 *
 * Translated from the Albert-approved Russian source (guide-v3-copy-ru.js,
 * VERSION 1.0.0/runtime-approved) after the RU tone gate closed. Mirrors its
 * exact key set and every {placeholder} — see scripts/guide-v3-copy-locales-v1.test.js,
 * which enforces both. Terminology (Guarida, Tribu, Mascotas, Héroe, Progreso,
 * Asistente, Chispa/Espíritu/Guardián/Custodio, etc.) matches the existing I18N_ES /
 * per-key {en,de,uk,es} tables in app.js — cross-checked, not guessed. Neutral,
 * international Spanish (tú register), not regionally marked slang.
 *
 * context.rewards.choose nods at Fullmetal Alchemist's law of equivalent exchange
 * (Albert's explicit choice: attribute rather than hide it), paraphrased rather
 * than reproducing a specific published translation's line verbatim.
 *
 * Pure UMD module: no DOM, State, storage, network, or translator access.
 * Callers must escape user-provided substitutions before inserting formatted
 * text into HTML. format() intentionally performs text substitution only.
 */
(function exposeGuideV3CopyEs(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuideV3CopyEs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuideV3CopyEs() {
  'use strict';

  const VERSION = '0.5.0';
  const LOCALE = 'es';
  const STATUS = 'translated';

  const CONTEXTUAL_STATUS = Object.freeze({
    habits: 'runtime-approved',
    goals: 'deferred-questionnaire',
    calendar: 'runtime-approved',
    notes: 'runtime-approved',
    voice: 'runtime-approved',
    jarvis: 'runtime-approved',
    systemTheme: 'runtime-approved',
    rewards: 'runtime-approved',
    hero: 'runtime-approved',
    den: 'runtime-approved',
    pets: 'runtime-approved',
    tree: 'runtime-approved',
    stats: 'runtime-approved',
    tribe: 'draft-ready',
  });

  const COPY = Object.freeze({
    "chapter.first.title": "Primer viaje",
    "chapter.habits.title": "Hábitos",
    "chapter.goals.title": "Metas",
    "chapter.calendar.title": "Calendario",
    "chapter.notes.title": "Notas",
    "chapter.voice.title": "La voz de Sombra",
    "chapter.jarvis.title": "Asistente personal",
    "chapter.system_theme.title": "Tema del sistema",
    "chapter.rewards.title": "Recompensas",
    "chapter.hero.title": "Héroe",
    "chapter.den.title": "Guarida",
    "chapter.pets.title": "Mascotas",
    "chapter.tree.title": "Mapa de progreso",
    "chapter.stats.title": "Progreso",
    "chapter.tribe.title": "Tribu",

    "system.action.start": "Empezar",
    "system.action.later": "Más tarde",
    "system.action.next": "Siguiente",
    "system.action.back": "Atrás",
    "system.action.close": "Cerrar",
    "system.action.skip_chapter": "Saltar capítulo",
    "system.action.disable_prompts": "No mostrar consejos",
    "system.action.enable_prompts": "Volver a activar los consejos",
    "system.action.resume": "Continuar",
    "system.action.replay": "Repasarlo de nuevo",
    "system.action.retry": "Reintentar",
    "system.action.save": "Guardar",
    "system.action.show": "Mostrar",
    "system.action.not_now": "Ahora no",
    "system.action.understood": "Entendido",
    "system.action.okay": "Vale",
    "system.action.speak": "Leer en voz alta",
    "system.action.stop_voice": "Detener la voz",
    "system.action.replay_voice": "Repetir esta frase",
    "system.action.my_step": "Este es mi paso",
    "system.action.choose_other": "Elegir otro",
    "system.action.run_focus": "Empezar",
    "system.action.without_timer": "Lo haré sin temporizador",
    "system.action.stay_today": "Quedarme en Hoy",
    "system.action.whats_next": "¿Qué sigue?",
    "system.action.touch_shadow": "Tocar a Sombra",
    "system.progress": "Paso {current} de {total}",
    "system.saving": "Guardando…",
    "system.saved": "Guardado",
    "system.save_failed": "No se pudo guardar. No se cambió nada — inténtalo de nuevo.",
    "system.offline": "Ahora mismo no hay conexión. La guía guardará este punto y seguirá en cuanto la app pueda registrar el resultado otra vez.",
    "system.voice_unavailable": "La voz no está disponible ahora mismo. El texto se queda en pantalla igualmente.",
    "system.target_unavailable": "Ese elemento no está disponible ahora mismo. Cierra la ventana abierta o vuelve a este paso más tarde.",
    "system.chapter_complete": "Capítulo completado",
    "system.chapter_snoozed": "Vale. Volveremos a esto más adelante.",
    "system.replay_no_reward": "Repasarlo te ayuda a recordar cómo funciona, pero no vuelve a dar XP, oro ni vínculo.",
    "system.global_disable_confirm": "¿Desactivar todos los consejos nuevos? Los capítulos completados y la biblioteca seguirán disponibles.",

    "first.episode.meeting.title": "Encuentro",
    "first.episode.recognition.title": "Tu primer paso",
    "first.episode.selection.title": "Elección",
    "first.episode.start.title": "Manos a la obra",
    "first.episode.wait.title": "La cosa real",
    "first.episode.victory.title": "Primera victoria",
    "first.episode.level.title": "Nivel y Forma",
    "first.episode.bond.title": "Conocer a Sombra",
    "first.episode.release.title": "Solo a partir de ahora",
    "first.meeting": "¡Bienvenido, jugador! Soy Sombra, tu guía. Por ahora solo te voy a mostrar lo que realmente sirve — a lo demás llegaremos cuando estés listo. Siempre ando cerca.",
    "first.recognition.seed": "Escribiste que {goalOrSphere} te importa. Aquí está el primer paso que salió de eso: «{firstQuest}». No es un plan abstracto — es algo que puedes hacer de verdad.",
    "first.recognition.seed_neutral": "Aquí está el primer paso que salió de tu configuración: «{firstQuest}». No es un plan abstracto — es algo que puedes hacer de verdad.",
    "first.recognition.create": "Empecemos con un paso. No con una vida nueva entera — solo con algo que de verdad puedas hacer hoy.",
    "first.create.label": "Una cosa para hoy",
    "first.create.placeholder": "Por ejemplo: caminar diez minutos",
    "first.create.sphere_label": "Área de este paso",
    "first.selection": "Este será tu próximo paso. Si ahora no es el momento — no pasa nada: se quedará aquí, y volverás cuando puedas.",
    "first.start": "Cuando cueste meterte en algo, pulsa ▶. Satoru se encargará del tiempo y de mantener un único foco, para que no tengas que llevarlo tú en la cabeza.",
    "first.wait": "Bueno, y ahora — la tarea de verdad. Sí, ahora mismo. No te descargaste Brawl Stars, ¿eh? — aquí hay productividad, crecimiento y todo eso. Así que a por ello, yo espero aquí. Márcala hecha solo cuando de verdad esté terminada, y seguimos.",
    "first.wait.resume": "Has vuelto. Nuestro paso sigue aquí. Si ya está hecho, márcalo con honestidad; si no, sigue a tu ritmo.",
    "first.victory": "Ahora sí que es crecimiento: XP para tu área, oro para recompensas, la tarea terminada a tu historial. No por una promesa. Por lo que de verdad hiciste.",
    "first.level_form": "Imagínatelo así: el Nivel es como un cinturón en artes marciales — nadie te lo puede quitar, la maestría demostrada no se apaga por una pausa. Pero si pasas mucho tiempo sin practicar, se te oxidan las habilidades: eso es tu Forma bajando.",
    "first.bond": "¡Eh! ¡Choca esos puños!",
    "first.bond.complete": "Bien. Ya nos conocemos.",
    "first.release": "¡Ya está, campeón! Por hoy, descanso. Cuando una parte nueva de Satoru te sirva de verdad, te la enseño aparte. Estas y otras «lecciones» las encuentras en Cómo jugar. Ahora te toca a ti. ¡Que tengas un buen día, productivo!",
    "first.teaser": "Después llegarán los hábitos, las metas y tu Héroe. Más adelante — la Guarida, mascotas, habilidades y tu Tribu. No todo de golpe: primero que el paso de hoy sea tuyo de verdad.",
    "first.skip": "Vale. Tu día sigue siendo tuyo. Si quieres, puedes seguir conociendo la app en la biblioteca cuando sea.",

    "context.habits.prompt": "Una tarea ayuda hoy. Una repetida cambia en quién te estás convirtiendo. ¿Quieres que convirtamos juntos un paso que ya conoces en un hábito?",
    "context.habits.choose": "Elige un paso que de verdad quieras repetir. No hace falta que inventes uno nuevo.",
    "context.habits.schedule": "Marca los días en que este ritmo es realista. Puedes cambiar el horario más tarde.",
    "context.habits.two_minute": "Añade una versión de dos minutos — la entrada honesta más pequeña al hábito en un día difícil.",
    "context.habits.complete": "Listo. Una racha muestra ritmo, no crea deuda. Si te la saltas, simplemente seguimos la próxima vez.",

    "context.calendar.prompt": "Esta tarea ya tiene su propio horario. ¿Quieres ponerla en el calendario para que no compita con el paso de hoy?",
    "context.calendar.guide": "Elige una tarea real, una fecha y, si hace falta, una hora. Solo cambiamos su lugar en el plan.",
    "context.calendar.complete": "Listo. La tarea sigue siendo tuya — solo le encontramos un sitio.",

    "context.notes.prompt": "No todos los pensamientos tienen que convertirse en tarea de inmediato. ¿Quieres guardar uno sin decidir ahora mismo?",
    "context.notes.capture": "Escribe el pensamiento tal cual. Más tarde puedes dejarlo como nota o convertirlo en un paso concreto.",
    "context.notes.complete": "Guardado. Ya no tienes que cargar con ese pensamiento en la cabeza.",

    "context.voice.prompt": "Puedo leer mis frases en voz alta con una voz fija. El texto se queda en pantalla igualmente. ¿Quieres probarlo?",
    "context.voice.complete": "Puedes detener la voz, repetirla o desactivarla del todo en los ajustes.",

    "context.jarvis.prompt": "Si cuesta ver qué es lo importante ahora mismo, puedes preguntarme sobre tu día. Miraré los datos disponibles y te propondré un próximo paso.",
    "context.jarvis.complete": "Esto es una conversación, no una orden. Puedes aceptar la respuesta, cambiarla o dejarla como está.",

    "context.system_theme.prompt": "Satoru puede seguir el tema claro u oscuro de tu dispositivo. Esto solo cambia el aspecto.",
    "context.system_theme.complete": "Listo. Puedes cambiar el tema cuando quieras.",

    "context.rewards.prompt": "Ya tienes oro ganado. ¿Quieres cambiarlo por una recompensa que elegiste para ti?",
    "context.rewards.choose": "No se consigue nada de valor sin dar algo a cambio — sí, es básicamente la regla de Fullmetal Alchemist, pero no deja de ser verdad.",
    "context.rewards.complete": "Recompensa comprada. Ahora lo importante es usarla de verdad.",

    "context.hero.prompt": "Tu Héroe muestra progreso demostrado: nivel, rango y forma. No hay un poder aparte que debas grindear solo por la imagen.",
    "context.hero.complete": "Tu nivel no se pierde. El guardarropa cambia solo lo que tú eliges.",

    "context.den.prompt": "La Guarida es donde viven Sombra, tu Héroe y tus mascotas. Se abre poco a poco, junto con tu historia.",
    "context.den.complete": "Échale un vistazo con calma. Puedes volver aquí cuando quieras ver tu mundo, no solo tachar una lista.",

    "context.pets.prompt": "Cada mascota está vinculada a un área principal. Las acciones completadas la alimentan y tu ritmo reciente cambia su estado. Sirve para notar desequilibrios, no es una nota ni una deuda.",
    "context.pets.complete": "La pista de una mascota muestra qué cuenta para su área. No hace falta arreglarlo todo de golpe.",

    "context.tree.prompt": "Este mapa tiene dos capas separadas. «Camino» registra resultados reales: el hito más cercano, su criterio y el siguiente paso. La capa «Bonificaciones de juego» solo cambia aspectos de Satoru; no demuestra una habilidad. Abre el área destacada y mira primero su Camino.",
    "context.tree.complete": "Este es tu hito real más cercano. El criterio indica qué cuenta como resultado. Si el siguiente paso ya está definido, puedes añadirlo al plan; si no, acláralo primero con Sombra. Registra el hito solo cuando el resultado ya exista. Las bonificaciones de juego están aparte y nunca sustituyen la confirmación.",

    "context.stats.prompt": "Siete días activos bastan para ver un ritmo sin adivinar. Mira un gráfico.",
    "context.stats.complete": "El progreso muestra una observación, no un juicio sobre ti. La decisión sigue siendo tuya.",

    "context.tribe.prompt": "La Tribu desbloquea el juego en grupo. Nada se publica ni se compara sin tu consentimiento aparte.",
    "context.tribe.complete": "Tú decides si participar en la Tribu y qué funciones sociales activar.",

    "library.title": "Cómo jugar",
    "library.subtitle": "Capítulos cortos que aparecen cuando de verdad pueden ayudar. Puedes saltarlos y volver más tarde.",
    "library.continue": "Seguir conociendo la app",
    "library.available": "Disponible ahora",
    "library.completed": "Completado",
    "library.locked": "Llegará más tarde",
    "library.locked_condition": "Se desbloquea: {condition}",
    "library.replay_note": "Repasarlo no cambia tus datos ni vuelve a dar recompensas.",
    "library.search.label": "Buscar en la biblioteca",
    "library.search.placeholder": "Buscar una función o mecánica",
    "library.empty_search": "No se encontró nada. Prueba con otra palabra.",
    "library.overview.title": "Qué hace especial a Satoru",
    "library.overview.body": "Satoru (del japonés «despertar») no es «otra app de productividad más». Es un registro de vida y secretario personal, disponible 24/7. Con IA integrada, te ayuda no solo a ser productivo, sino también a no quemarte — recordándote el equilibrio entre tus áreas, el descanso y la aventura, y sugiriéndote opciones a tu medida.",
    "library.goals.deferred": "El capítulo sobre metas aparecerá cuando se apruebe la nueva mecánica y su conexión con el futuro cuestionario.",
    "library.disable_prompts.note": "Esto desactiva los nuevos consejos contextuales. La biblioteca y los capítulos completados siguen disponibles.",

    "a11y.guide_dialog": "Guía de Satoru",
    "a11y.guide_status": "Frase de Sombra",
    "a11y.spotlight_target": "El elemento del que está hablando Sombra ahora mismo",
    "a11y.shadow_visual": "Sombra · {form}",
    "a11y.shadow_alt": "Sombra, forma {form}: {state}",
    "a11y.form.spark": "Chispa",
    "a11y.form.spirit": "Espíritu",
    "a11y.form.guardian": "Guardián",
    "a11y.form.keeper": "Custodio",
    "a11y.state.arrive": "aparece cerca",
    "a11y.state.close_speak": "habla con el usuario",
    "a11y.state.listen": "escucha",
    "a11y.state.direct": "dirige la atención",
    "a11y.state.recognize": "reconoce una meta familiar",
    "a11y.state.celebrate": "celebra una tarea terminada",
    "a11y.state.wait": "espera con calma",
    "a11y.state.return": "te recibe cuando vuelves"
  });

  function has(key) {
    return Object.prototype.hasOwnProperty.call(COPY, key);
  }

  function get(key) {
    return has(key) ? COPY[key] : null;
  }

  function format(key, variables) {
    const source = get(key);
    if (source == null) return null;
    const values = variables && typeof variables === 'object' ? variables : {};
    return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
    ));
  }

  function entries() {
    return Object.entries(COPY);
  }

  return Object.freeze({
    VERSION,
    LOCALE,
    STATUS,
    COPY,
    CONTEXTUAL_STATUS,
    has,
    get,
    format,
    entries,
  });
});
