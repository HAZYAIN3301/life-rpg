/* Satoru Guide v3 — German (Deutsch) runtime copy.
 *
 * Translated from the Albert-approved Russian source (guide-v3-copy-ru.js,
 * VERSION 1.0.0/runtime-approved) after the RU tone gate closed. Mirrors its
 * exact key set and every {placeholder} — see scripts/guide-v3-copy-locales-v1.test.js,
 * which enforces both. Terminology (Lager, Stamm, Haustiere, Held, Skillbaum,
 * Fortschritt, Assistent, Funke/Geist/Wächter/Hüter, etc.) matches the existing
 * I18N_DE / per-key {en,de,uk,es} tables in app.js — cross-checked, not guessed.
 * "Skillbaum" over the stiffer "Fähigkeitenbaum": Satoru leans into RPG framing
 * and this is the term German gaming communities actually use.
 *
 * German is a launch-priority locale alongside RU (Albert's decision, 18.08) —
 * translated with the same register as the approved RU source: casual, warm,
 * a little cheeky, never preachy. "long DE" visual QA (does it overflow the UI)
 * is still Codex's to run once this is wired in.
 *
 * context.rewards.choose nods at Fullmetal Alchemist's law of equivalent exchange
 * (Albert's explicit choice: attribute rather than hide it) but paraphrases rather
 * than reproducing a specific published German dub/translation line verbatim.
 *
 * Pure UMD module: no DOM, State, storage, network, or translator access.
 * Callers must escape user-provided substitutions before inserting formatted
 * text into HTML. format() intentionally performs text substitution only.
 */
(function exposeGuideV3CopyDe(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuideV3CopyDe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuideV3CopyDe() {
  'use strict';

  const VERSION = '0.5.0';
  const LOCALE = 'de';
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
    "chapter.first.title": "Erste Reise",
    "chapter.habits.title": "Gewohnheiten",
    "chapter.goals.title": "Ziele",
    "chapter.calendar.title": "Kalender",
    "chapter.notes.title": "Notizen",
    "chapter.voice.title": "Schattens Stimme",
    "chapter.jarvis.title": "Persönlicher Assistent",
    "chapter.system_theme.title": "System-Design",
    "chapter.rewards.title": "Belohnungen",
    "chapter.hero.title": "Held",
    "chapter.den.title": "Lager",
    "chapter.pets.title": "Haustiere",
    "chapter.tree.title": "Entwicklungskarte",
    "chapter.stats.title": "Fortschritt",
    "chapter.tribe.title": "Stamm",

    "system.action.start": "Starten",
    "system.action.later": "Später",
    "system.action.next": "Weiter",
    "system.action.back": "Zurück",
    "system.action.close": "Schließen",
    "system.action.skip_chapter": "Kapitel überspringen",
    "system.action.disable_prompts": "Keine Tipps mehr zeigen",
    "system.action.enable_prompts": "Tipps wieder einschalten",
    "system.action.resume": "Fortsetzen",
    "system.action.replay": "Nochmal durchgehen",
    "system.action.retry": "Erneut versuchen",
    "system.action.save": "Speichern",
    "system.action.show": "Zeigen",
    "system.action.not_now": "Nicht jetzt",
    "system.action.understood": "Verstanden",
    "system.action.okay": "Okay",
    "system.action.speak": "Vorlesen",
    "system.action.stop_voice": "Stimme stoppen",
    "system.action.replay_voice": "Zeile nochmal vorlesen",
    "system.action.my_step": "Das ist mein Schritt",
    "system.action.choose_other": "Anderes wählen",
    "system.action.run_focus": "Starten",
    "system.action.without_timer": "Ich mach's ohne Timer",
    "system.action.stay_today": "Auf Heute bleiben",
    "system.action.whats_next": "Was kommt als Nächstes?",
    "system.action.touch_shadow": "Schatten berühren",
    "system.progress": "Schritt {current} von {total}",
    "system.saving": "Speichere…",
    "system.saved": "Gespeichert",
    "system.save_failed": "Konnte nicht gespeichert werden. Nichts wurde geändert — versuch's nochmal.",
    "system.offline": "Gerade keine Verbindung. Der Guide merkt sich die Stelle und macht weiter, sobald die App das Ergebnis wieder speichern kann.",
    "system.voice_unavailable": "Die Stimme ist gerade nicht verfügbar. Der Text bleibt trotzdem auf dem Bildschirm.",
    "system.target_unavailable": "Das Element ist gerade nicht verfügbar. Schließe das offene Fenster oder komm später zu diesem Schritt zurück.",
    "system.chapter_complete": "Kapitel abgeschlossen",
    "system.chapter_snoozed": "Okay. Wir kommen später darauf zurück.",
    "system.replay_no_reward": "Nochmal durchgehen hilft dir, dich an die Mechanik zu erinnern, gibt aber kein XP, Gold oder Bindung nochmal.",
    "system.global_disable_confirm": "Alle neuen Tipps ausschalten? Abgeschlossene Kapitel und die Spielanleitung bleiben verfügbar.",

    "first.episode.meeting.title": "Begegnung",
    "first.episode.recognition.title": "Dein erster Schritt",
    "first.episode.selection.title": "Auswahl",
    "first.episode.start.title": "Loslegen",
    "first.episode.wait.title": "Die echte Sache",
    "first.episode.victory.title": "Erster Erfolg",
    "first.episode.level.title": "Level und Form",
    "first.episode.bond.title": "Schatten kennenlernen",
    "first.episode.release.title": "Ab jetzt allein",
    "first.meeting": "Willkommen, Spieler! Ich bin Schatten, dein Begleiter. Fürs Erste zeig ich dir nur, was gerade wirklich nützlich ist — den Rest holen wir nach, wenn du bereit bist. Ich bin immer in der Nähe.",
    "first.recognition.seed": "Du hast geschrieben, dass dir {goalOrSphere} wichtig ist. Hier ist der erste Schritt, der dabei rausgekommen ist: „{firstQuest}“. Kein abstrakter Plan — etwas, das du wirklich tun kannst.",
    "first.recognition.seed_neutral": "Hier ist der erste Schritt, der aus deinen Angaben entstanden ist: „{firstQuest}“. Kein abstrakter Plan — etwas, das du wirklich tun kannst.",
    "first.recognition.create": "Fangen wir mit einem Schritt an. Nicht gleich ein neues Leben — nur etwas, das du heute wirklich schaffen kannst.",
    "first.create.label": "Eine Sache für heute",
    "first.create.placeholder": "Zum Beispiel: zehn Minuten spazieren gehen",
    "first.create.sphere_label": "Bereich für diesen Schritt",
    "first.selection": "Das wird dein nächster Schritt. Wenn jetzt nicht der richtige Moment ist — kein Problem, er bleibt hier, und du kommst zurück, wenn du kannst.",
    "first.start": "Wenn's schwerfällt, mit etwas anzufangen, drück auf ▶. Satoru hält die Zeit und einen einzigen Fokus für dich, damit du dir das nicht selbst merken musst.",
    "first.wait": "So, und jetzt — die eigentliche Sache! Ja, genau jetzt. Du hast ja nicht Brawl Stars runtergeladen — hier geht's um Produktivität, Weiterkommen, das ganze Programm. Also los, ich warte hier. Häkchen setzen erst, wenn's wirklich fertig ist, dann geht's weiter.",
    "first.wait.resume": "Du bist zurück. Unser Schritt ist noch da. Wenn er schon erledigt ist, gib das ehrlich an; wenn nicht, mach einfach in deinem Tempo weiter.",
    "first.victory": "Jetzt ist es Fortschritt: XP in deinen Bereich, Gold für Belohnungen, die erledigte Aufgabe in deine Geschichte. Nicht für ein Versprechen. Für das, was du wirklich gemacht hast.",
    "first.level_form": "Stell's dir so vor: Level ist wie ein Gürtel im Kampfsport — den nimmt dir keiner mehr weg, bewiesenes Können verschwindet nicht durch eine Pause. Aber wenn du zu lange nichts machst, wird's eingerostet — das ist deine Form, die nachlässt.",
    "first.bond": "Na, du! Faust drauf!",
    "first.bond.complete": "Gut. Jetzt kennen wir uns.",
    "first.release": "Alles klar, Champ! Für heute ist Pause. Wenn ein neuer Teil von Satoru wirklich gebraucht wird, zeig ich ihn dir extra. Diese und andere „Lektionen“ findest du unter Spielanleitung. Und jetzt bist du dran. Einen guten, produktiven Tag noch!",
    "first.teaser": "Als Nächstes kommen Gewohnheiten, Ziele und dein Held. Später — das Lager, Haustiere, Skills und dein Stamm. Nicht alles auf einmal: Erst soll der heutige Schritt wirklich deiner werden.",
    "first.skip": "Okay. Dein Tag bleibt deiner. Wenn du willst, kannst du jederzeit in der Spielanleitung weiterlesen.",

    "context.habits.prompt": "Eine Sache hilft heute. Eine wiederholte verändert, wer du wirst. Willst du zusammen einen Schritt, den du schon kennst, in eine Gewohnheit verwandeln?",
    "context.habits.choose": "Wähl einen Schritt, den du wirklich wiederholen willst. Du musst dir keinen neuen ausdenken.",
    "context.habits.schedule": "Markier die Tage, an denen dieser Rhythmus realistisch ist. Den Zeitplan kannst du später ändern.",
    "context.habits.two_minute": "Füg eine Zwei-Minuten-Version hinzu — der kleinste ehrliche Einstieg in die Gewohnheit an einem schwierigen Tag.",
    "context.habits.complete": "Fertig. Eine Serie zeigt Rhythmus, macht aber keine Schulden. Verpasst du mal einen Tag, machen wir einfach beim nächsten weiter.",

    "context.calendar.prompt": "Diese Aufgabe hat jetzt eine eigene Zeit. Willst du sie in den Kalender eintragen, damit sie nicht mit dem heutigen Schritt kollidiert?",
    "context.calendar.guide": "Wähl eine echte Aufgabe, ein Datum und, falls nötig, eine Uhrzeit. Wir ändern nur ihren Platz im Plan.",
    "context.calendar.complete": "Fertig. Die Aufgabe bleibt deine — wir haben ihr nur einen Platz gefunden.",

    "context.notes.prompt": "Nicht jeder Gedanke muss gleich zu einer Aufgabe werden. Willst du einen speichern, ohne dich jetzt schon zu entscheiden?",
    "context.notes.capture": "Schreib den Gedanken auf, so wie er ist. Später kannst du ihn als Notiz lassen oder in einen konkreten Schritt verwandeln.",
    "context.notes.complete": "Gespeichert. Diesen Gedanken musst du dir jetzt nicht mehr merken.",

    "context.voice.prompt": "Ich kann meine Sätze mit fester Stimme vorlesen. Der Text bleibt trotzdem auf dem Bildschirm. Willst du's ausprobieren?",
    "context.voice.complete": "Die Stimme kannst du stoppen, nochmal abspielen oder in den Einstellungen ganz ausschalten.",

    "context.jarvis.prompt": "Wenn's schwerfällt zu erkennen, was gerade wichtig ist, kannst du mich zu deinem Tag fragen. Ich schau mir die verfügbaren Daten an und schlage einen nächsten Schritt vor.",
    "context.jarvis.complete": "Das ist ein Gespräch, kein Befehl. Die Antwort kannst du annehmen, ändern oder einfach stehen lassen.",

    "context.system_theme.prompt": "Satoru kann dem hellen oder dunklen Design deines Geräts folgen. Das ändert nur das Aussehen.",
    "context.system_theme.complete": "Fertig. Das Design kannst du jederzeit wechseln.",

    "context.rewards.prompt": "Du hast schon Gold verdient. Willst du es gegen eine Belohnung eintauschen, die du dir selbst ausgesucht hast?",
    "context.rewards.choose": "Nichts, was sich lohnt, bekommst du, ohne dass du selbst was gibst — ja, das ist im Grunde die Regel aus Fullmetal Alchemist, aber stimmen tut's trotzdem.",
    "context.rewards.complete": "Belohnung gekauft. Jetzt kommt's drauf an, sie wirklich zu nutzen.",

    "context.hero.prompt": "Dein Held zeigt bewiesenen Fortschritt: Stufe, Rang und Form. Es gibt keine extra Stärke, die du nur fürs Bild grinden musst.",
    "context.hero.complete": "Deine Stufe verfällt nicht. Die Garderobe ändert nur, was du selbst auswählst.",

    "context.den.prompt": "Im Lager leben Schatten, dein Held und deine Haustiere. Es öffnet sich nach und nach, so wie deine Geschichte.",
    "context.den.complete": "Schau dich in Ruhe um. Komm zurück, wenn du deine Welt sehen willst — nicht um eine Liste abzuhaken.",

    "context.pets.prompt": "Jedes Haustier gehört zu einem Hauptbereich. Erledigte Handlungen füttern es, und dein jüngster Rhythmus verändert seinen Zustand. Das hilft, ein Ungleichgewicht zu sehen — es ist keine Wertung und keine Schuld.",
    "context.pets.complete": "Der Hinweis eines Haustiers zeigt, was für seinen Bereich zählt. Du musst nicht alles auf einmal in Ordnung bringen.",

    "context.tree.prompt": "Diese Karte hat zwei getrennte Ebenen. Der „Weg“ hält echte Ergebnisse fest: den nächsten Meilenstein, sein Kriterium und den nächsten Schritt. „Spielboni“ verändern nur Satoru; sie beweisen keine Fähigkeit. Öffne den markierten Bereich und schau zuerst auf seinen Weg.",
    "context.tree.complete": "Vor dir liegt der nächste echte Meilenstein. Das Kriterium sagt, was als Ergebnis zählt. Ist der nächste Schritt schon festgelegt, kannst du ihn in deinen Plan übernehmen; sonst klärst du ihn zuerst mit Schatten. Bestätige den Meilenstein erst, wenn das Ergebnis wirklich da ist. Spielboni bleiben getrennt und ersetzen keine Bestätigung.",

    "context.stats.prompt": "Sieben aktive Tage reichen, um einen Rhythmus ohne Raten zu erkennen. Schau dir ein Diagramm an.",
    "context.stats.complete": "Der Fortschritt zeigt eine Beobachtung, kein Urteil über dich. Die Entscheidung liegt trotzdem bei dir.",

    "context.tribe.prompt": "Der Stamm schaltet gemeinsames Spielen frei. Nichts wird veröffentlicht oder verglichen ohne deine extra Zustimmung.",
    "context.tribe.complete": "Du entscheidest selbst, ob du beim Stamm mitmachst und welche sozialen Funktionen du einschaltest.",

    "library.title": "Spielanleitung",
    "library.subtitle": "Kurze Kapitel tauchen auf, wenn sie wirklich helfen können. Du kannst sie überspringen und später nachholen.",
    "library.continue": "Weiter kennenlernen",
    "library.available": "Jetzt verfügbar",
    "library.completed": "Abgeschlossen",
    "library.locked": "Kommt später",
    "library.locked_condition": "Schaltet sich frei: {condition}",
    "library.replay_note": "Nochmal durchgehen ändert keine Daten und gibt keine Belohnungen nochmal.",
    "library.search.label": "Spielanleitung durchsuchen",
    "library.search.placeholder": "Funktion oder Mechanik finden",
    "library.empty_search": "Nichts gefunden. Versuch ein anderes Wort.",
    "library.overview.title": "Was Satoru besonders macht",
    "library.overview.body": "Satoru (japanisch für „Erwachen“) ist nicht „noch eine Produktivitäts-App“. Es ist ein Lebens-Tracker und persönlicher Sekretär, rund um die Uhr verfügbar. Mit eingebauter KI hilft es dir nicht nur, produktiv zu sein, sondern auch, nicht auszubrennen — erinnert an Balance zwischen deinen Bereichen, an Erholung und Abenteuer, und schlägt dir Optionen individuell vor.",
    "library.goals.deferred": "Das Kapitel über Ziele erscheint, sobald die neue Mechanik und ihre Verbindung zum kommenden Fragebogen feststehen.",
    "library.disable_prompts.note": "Das schaltet neue kontextbezogene Tipps aus. Die Spielanleitung und abgeschlossene Kapitel bleiben verfügbar.",

    "a11y.guide_dialog": "Satoru-Guide",
    "a11y.guide_status": "Satz von Schatten",
    "a11y.spotlight_target": "Das Element, über das Schatten gerade spricht",
    "a11y.shadow_visual": "Schatten · {form}",
    "a11y.shadow_alt": "Schatten, Form {form}: {state}",
    "a11y.form.spark": "Funke",
    "a11y.form.spirit": "Geist",
    "a11y.form.guardian": "Wächter",
    "a11y.form.keeper": "Hüter",
    "a11y.state.arrive": "erscheint in der Nähe",
    "a11y.state.close_speak": "spricht mit dem Nutzer",
    "a11y.state.listen": "hört zu",
    "a11y.state.direct": "lenkt die Aufmerksamkeit",
    "a11y.state.recognize": "erkennt ein bekanntes Ziel",
    "a11y.state.celebrate": "freut sich über eine erledigte Aufgabe",
    "a11y.state.wait": "wartet ruhig",
    "a11y.state.return": "begrüßt dich nach deiner Rückkehr"
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
