/* Satoru Inspiration Catalog v1.
 *
 * Starter material is authored for Satoru and may be rendered inside the app.
 * Rows with an external source must declare their rights/attribution explicitly;
 * the UI never downloads or rehosts that source. No popularity or engagement
 * fields exist in this catalog.
 */
(function exposeInspirationCatalog(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationCatalogV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildInspirationCatalog() {
  'use strict';

  const VERSION = '1.0.0';
  const LOCALES = Object.freeze(['ru', 'en', 'de', 'uk', 'es']);
  const copy = (ru, en, de, uk, es) => Object.freeze({ ru, en, de, uk, es });
  const row = (id, format, interestIds, visual, title, body, extra) => Object.freeze(Object.assign({
    id, format, interestIds: Object.freeze(interestIds), visual,
    title, body, rightsKind: 'satoru-original', attribution: 'Satoru',
  }, extra || {}));

  const CATALOG = Object.freeze([
    row('blender-spring', 'video', ['animation', 'nature', 'fantasy', 'creative', 'video'], 'spring',
      copy('Spring · открытый анимационный фильм', 'Spring · open animated film', 'Spring · offener Animationsfilm', 'Spring · відкритий анімаційний фільм', 'Spring · película animada abierta'),
      copy('Семь минут без диалогов о столкновении света, природы и силы. Официальный фильм Blender Studio.', 'Seven dialogue-free minutes about light, nature and force. An official Blender Studio film.', 'Sieben Minuten ohne Dialog über Licht, Natur und Kraft. Ein offizieller Film von Blender Studio.', 'Сім хвилин без діалогів про зіткнення світла, природи й сили. Офіційний фільм Blender Studio.', 'Siete minutos sin diálogos sobre luz, naturaleza y fuerza. Una película oficial de Blender Studio.'),
      { provider: 'YouTube · Blender Studio', durationLabel: '7:44', mediaPolicy: 'iframe',
        sourceUrl: 'https://www.youtube.com/watch?v=WhWc3b3KhnY', embedUrl: 'https://www.youtube-nocookie.com/embed/WhWc3b3KhnY',
        rightsKind: 'cc-by-4.0', rightsUrl: 'https://studio.blender.org/projects/spring/pages/about/', attribution: '© Blender Foundation · cloud.blender.org/spring' }),
    row('nps-yosemite', 'video', ['nature', 'travel', 'calm', 'video'], 'valley',
      copy('Йосемити · три минуты пространства', 'Yosemite · three minutes of space', 'Yosemite · drei Minuten Weite', 'Йосеміті · три хвилини простору', 'Yosemite · tres minutos de espacio'),
      copy('Официальные кадры National Park Service. Можно смотреть внутри Satoru без ленты и autoplay.', 'Official National Park Service footage. Watch inside Satoru without a feed or autoplay.', 'Offizielle Aufnahmen des National Park Service. In Satoru ohne Feed und Autoplay ansehen.', 'Офіційні кадри National Park Service. Можна дивитися в Satoru без стрічки й autoplay.', 'Imágenes oficiales del National Park Service. Míralas en Satoru sin feed ni reproducción automática.'),
      { provider: 'National Park Service', durationLabel: '3:16', mediaPolicy: 'iframe',
        sourceUrl: 'https://www.nps.gov/media/video/view.htm?id=01964B37-C8B7-8B9D-A2DB28BD3EBDF07E', embedUrl: 'https://www.nps.gov/media/video/embed.htm?id=01964B37-C8B7-8B9D-A2DB28BD3EBDF07E',
        rightsKind: 'public-domain', rightsUrl: 'https://www.nps.gov/media/video/view.htm?id=01964B37-C8B7-8B9D-A2DB28BD3EBDF07E', attribution: 'National Park Service' }),
    row('dvids-run', 'edit', ['sport', 'running', 'movement', 'fitness'], 'run',
      copy('Бег в фокусе · 58 секунд', 'Run in focus · 58 seconds', 'Laufen im Fokus · 58 Sekunden', 'Біг у фокусі · 58 секунд', 'Correr en foco · 58 segundos'),
      copy('Короткий ритмичный ролик из официального public-domain архива DVIDS.', 'A short rhythmic film from the official public-domain DVIDS archive.', 'Ein kurzer rhythmischer Film aus dem offiziellen gemeinfreien DVIDS-Archiv.', 'Короткий ритмічний ролик з офіційного public-domain архіву DVIDS.', 'Un vídeo corto y rítmico del archivo oficial de dominio público DVIDS.'),
      { provider: 'DVIDS', durationLabel: '0:58', mediaPolicy: 'iframe',
        sourceUrl: 'https://www.dvidshub.net/video/302024/troops-in-focus-run', embedUrl: 'https://www.dvidshub.net/video/embed/302024',
        rightsKind: 'public-domain', rightsUrl: 'https://www.dvidshub.net/video/302024/troops-in-focus-run', attribution: 'DVIDS · Troops in Focus: Run' }),
    row('blender-bunny', 'video', ['animation', 'humor', 'creative', 'games'], 'bunny',
      copy('Big Buck Bunny · открытая 3D-анимация', 'Big Buck Bunny · open 3D animation', 'Big Buck Bunny · offene 3D-Animation', 'Big Buck Bunny · відкрита 3D-анімація', 'Big Buck Bunny · animación 3D abierta'),
      copy('Официальный открытый фильм Blender Foundation о характере, ритме и визуальном рассказе.', 'An official open Blender Foundation film about character, rhythm and visual storytelling.', 'Ein offizieller offener Film der Blender Foundation über Figur, Rhythmus und visuelles Erzählen.', 'Офіційний відкритий фільм Blender Foundation про характер, ритм і візуальну оповідь.', 'Una película abierta oficial de Blender Foundation sobre personaje, ritmo y narración visual.'),
      { provider: 'YouTube · Blender Foundation', mediaPolicy: 'iframe',
        sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', embedUrl: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
        rightsKind: 'cc-by-3.0', rightsUrl: 'https://peach.blender.org/about/', attribution: '© Blender Foundation · peach.blender.org' }),
    row('nasa-hum-sun', 'podcast', ['space', 'science', 'audio', 'learning'], 'sun',
      copy('NASA · гул Солнца', 'NASA · the hum of the Sun', 'NASA · das Summen der Sonne', 'NASA · гул Сонця', 'NASA · el zumbido del Sol'),
      copy('Официальный выпуск NASA’s Curious Universe о том, как учёные превращают данные Солнца в звук. Открывается через защищённую границу источника.', 'An official NASA’s Curious Universe episode about turning solar data into sound. It opens through the protected source boundary.', 'Eine offizielle Folge von NASA’s Curious Universe darüber, wie Sonnendaten hörbar werden. Sie öffnet sich über die geschützte Quellengrenze.', 'Офіційний випуск NASA’s Curious Universe про те, як науковці перетворюють дані Сонця на звук. Відкривається через захищену межу джерела.', 'Un episodio oficial de NASA’s Curious Universe sobre convertir datos solares en sonido. Se abre mediante el límite protegido de la fuente.'),
      { provider: 'NASA’s Curious Universe', mediaPolicy: 'link', sourceUrl: 'https://www.nasa.gov/podcasts/curious-universe/the-hum-of-the-sun/',
        rightsKind: 'official-source', rightsUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/', attribution: 'NASA' }),
    row('nasa-pale-blue-dot', 'image', ['space', 'science', 'philosophy', 'future'], 'pale-dot',
      copy('Земля в одном пикселе', 'Earth in one pixel', 'Die Erde in einem Pixel', 'Земля в одному пікселі', 'La Tierra en un píxel'),
      copy('Pale Blue Dot: Земля в луче света с расстояния около шести миллиардов километров.', 'Pale Blue Dot: Earth in a ray of light from roughly six billion kilometres away.', 'Pale Blue Dot: die Erde in einem Lichtstrahl aus rund sechs Milliarden Kilometern Entfernung.', 'Pale Blue Dot: Земля в промені світла з відстані близько шести мільярдів кілометрів.', 'Pale Blue Dot: la Tierra en un rayo de luz desde unos seis mil millones de kilómetros.'),
      { provider: 'NASA/JPL-Caltech', mediaPolicy: 'remote-image',
        sourceUrl: 'https://science.nasa.gov/image-detail/pia23645-3/', imageUrl: 'https://science.nasa.gov/wp-content/uploads/2024/02/pia23645.jpg',
        rightsKind: 'official-source', rightsUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/', attribution: 'NASA/JPL-Caltech' }),
    row('spiderverse-official-trailer', 'edit', ['superhero', 'animation', 'creative', 'video'], 'hero',
      copy('Spider-Verse · официальный трейлер', 'Spider-Verse · official trailer', 'Spider-Verse · offizieller Trailer', 'Spider-Verse · офіційний трейлер', 'Spider-Verse · tráiler oficial'),
      copy('Ритм, типографика и столкновение визуальных миров в официальном трейлере Sony Pictures.', 'Rhythm, typography and colliding visual worlds in the official Sony Pictures trailer.', 'Rhythmus, Typografie und kollidierende Bildwelten im offiziellen Trailer von Sony Pictures.', 'Ритм, типографіка й зіткнення візуальних світів в офіційному трейлері Sony Pictures.', 'Ritmo, tipografía y mundos visuales que chocan en el tráiler oficial de Sony Pictures.'),
      { provider: 'YouTube · Sony Pictures Entertainment', durationLabel: '2:35', mediaPolicy: 'iframe',
        sourceUrl: 'https://www.youtube.com/watch?v=cqGjhVJWtEg', embedUrl: 'https://www.youtube-nocookie.com/embed/cqGjhVJWtEg',
        rightsKind: 'official-source', rightsUrl: 'https://www.youtube.com/watch?v=cqGjhVJWtEg', attribution: '© Sony Pictures Entertainment' }),
    row('rezero-official-pv', 'edit', ['anime', 'fantasy', 'animation', 'video'], 'signal',
      copy('Re:Zero · официальный PV', 'Re:Zero · official PV', 'Re:Zero · offizieller PV', 'Re:Zero · офіційний PV', 'Re:Zero · PV oficial'),
      copy('Официальный ролик KADOKAWA: напряжение, пауза и резкий переход как учебник эмоционального монтажа.', 'An official KADOKAWA film: tension, pause and sharp transition as a lesson in emotional editing.', 'Ein offizieller KADOKAWA-Film: Spannung, Pause und harter Übergang als Lektion im emotionalen Schnitt.', 'Офіційний ролик KADOKAWA: напруга, пауза й різкий перехід як урок емоційного монтажу.', 'Un vídeo oficial de KADOKAWA: tensión, pausa y corte brusco como lección de montaje emocional.'),
      { provider: 'YouTube · KADOKAWAanime', mediaPolicy: 'iframe',
        sourceUrl: 'https://www.youtube.com/watch?v=zrkSqgrA2o0', embedUrl: 'https://www.youtube-nocookie.com/embed/zrkSqgrA2o0',
        rightsKind: 'official-source', rightsUrl: 'https://www.youtube.com/watch?v=zrkSqgrA2o0', attribution: '© KADOKAWA · Re:Zero production committee' }),

    row('control-circle', 'quote', ['philosophy', 'focus', 'stoicism', 'learning'], 'ink',
      copy('Не управляй всем днём. Управляй следующим решением.', 'Do not control the whole day. Control the next decision.', 'Kontrolliere nicht den ganzen Tag. Kontrolliere die nächste Entscheidung.', 'Не керуй усім днем. Керуй наступним рішенням.', 'No controles todo el día. Controla la siguiente decisión.'),
      copy('Satoru · оригинальная мысль', 'Satoru · original line', 'Satoru · eigener Gedanke', 'Satoru · оригінальна думка', 'Satoru · frase original')),
    row('builder-release', 'quote', ['business', 'product', 'video', 'creative'], 'forge',
      copy('Черновик, который вышел в мир, сильнее идеала, который остался в голове.', 'A draft released into the world is stronger than a perfect thing left in your head.', 'Ein Entwurf in der Welt ist stärker als Perfektion, die im Kopf bleibt.', 'Чернетка, що вийшла у світ, сильніша за ідеал, який лишився в голові.', 'Un borrador que sale al mundo es más fuerte que un ideal que se queda en tu cabeza.'),
      copy('Satoru · оригинальная мысль', 'Satoru · original line', 'Satoru · eigener Gedanke', 'Satoru · оригінальна думка', 'Satoru · frase original')),
    row('study-question', 'quote', ['study', 'learning', 'science', 'reading'], 'paper',
      copy('Хорошая учебная сессия начинается не с ответа, а с одного точного вопроса.', 'A good study session starts not with an answer, but with one precise question.', 'Eine gute Lerneinheit beginnt nicht mit einer Antwort, sondern mit einer präzisen Frage.', 'Хороша навчальна сесія починається не з відповіді, а з одного точного питання.', 'Una buena sesión de estudio no empieza con una respuesta, sino con una pregunta precisa.'),
      copy('Satoru · оригинальная мысль', 'Satoru · original line', 'Satoru · eigener Gedanke', 'Satoru · оригінальна думка', 'Satoru · frase original')),

  ]);

  function language(locale) {
    const code = String(locale || 'ru').toLowerCase().split('-')[0];
    return LOCALES.includes(code) ? code : 'ru';
  }
  function localize(value, locale) {
    const code = language(locale);
    return value && typeof value === 'object' ? (value[code] || value.ru || '') : String(value || '');
  }
  function items(locale) {
    return CATALOG.map((item) => Object.freeze(Object.assign({}, item, {
      title: localize(item.title, locale), body: localize(item.body, locale),
    })));
  }
  function byId(id, locale) { return items(locale).find((item) => item.id === String(id)) || null; }

  return Object.freeze({ VERSION, LOCALES, CATALOG, items, byId, language });
});
