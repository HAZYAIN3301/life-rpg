/* Specific public references reviewed through official widget/oEmbed metadata.
 * This finite fallback stock is not automatic global discovery or playback QA.
 * Source images remain remote. A signed TikTok poster can expire and needs fresh
 * official metadata; no video/image file is downloaded or rehosted here.
 */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InspirationVisualBatchV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  'use strict';
  const LOCALES = Object.freeze(['ru', 'en', 'de', 'uk', 'es']);
  const copy = (...values) => Object.freeze(Object.fromEntries(LOCALES.map((locale, i) => [locale, values[i]])));
  // Only selected public fields from bounded official metadata, checked 19 Sep.
  // Publisher/pinner attribution is not a claim to authorship of the photograph.
  const METADATA = Object.freeze({
    "354658539408264219": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/354658539408264219/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=354658539408264219",
      "thumbnailUrl": "https://i.pinimg.com/564x/b3/6e/78/b36e78c729e4291048afa0720c13428e.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 564,
      "mediaType": "image",
      "authorName": "kas",
      "checkedAt": "2026-09-19T16:30:33.788Z"
    },
    "140244975883750646": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/140244975883750646/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=140244975883750646",
      "thumbnailUrl": "https://i.pinimg.com/564x/f1/bc/93/f1bc93265d7bf6426d58d5e3cd04cb7e.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 705,
      "mediaType": "image",
      "authorName": "Andrew Massey",
      "checkedAt": "2026-09-19T16:30:33.749Z"
    },
    "287386019967085670": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/287386019967085670/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=287386019967085670",
      "thumbnailUrl": "https://i.pinimg.com/564x/fe/85/9a/fe859a880b558bb29b2f4a5d191d0fe3.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 564,
      "mediaType": "image",
      "authorName": "Inspiration Grid",
      "checkedAt": "2026-09-19T16:30:33.975Z"
    },
    "287386019965477013": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/287386019965477013/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=287386019965477013",
      "thumbnailUrl": "https://i.pinimg.com/564x/70/d4/81/70d481b1d6e5f8678d53f374b2d82f77.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 375,
      "mediaType": "image",
      "authorName": "Inspiration Grid",
      "checkedAt": "2026-09-19T16:30:34.156Z"
    },
    "455145106092028927": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/455145106092028927/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=455145106092028927",
      "thumbnailUrl": "https://i.pinimg.com/564x/15/a3/dd/15a3ddeb975155f3130d6426c57bde85.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 480,
      "mediaType": "image",
      "authorName": "Jess Bonde",
      "checkedAt": "2026-09-19T16:30:34.161Z"
    },
    "491736853086922533": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/491736853086922533/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=491736853086922533",
      "thumbnailUrl": "https://i.pinimg.com/564x/a0/f6/aa/a0f6aa74f668581d13d6222ddf8aa03f.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 705,
      "mediaType": "image",
      "authorName": "Jess Howell Photography",
      "checkedAt": "2026-09-19T16:30:34.161Z"
    },
    "462674561688722574": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/462674561688722574/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=462674561688722574",
      "thumbnailUrl": "https://i.pinimg.com/564x/f9/be/4e/f9be4e70387cbdcd37ec5c5f3281c8fe.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 358,
      "mediaType": "image",
      "authorName": "olivera davidoff",
      "checkedAt": "2026-09-19T16:30:34.447Z"
    },
    "170785010862666018": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/170785010862666018/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=170785010862666018",
      "thumbnailUrl": "https://i.pinimg.com/564x/bb/7f/8f/bb7f8f779d081d095ca5e4589ed5c93c.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 564,
      "mediaType": "image",
      "authorName": "Adam",
      "checkedAt": "2026-09-19T16:30:34.353Z"
    },
    "134334001376557674": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/134334001376557674/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=134334001376557674",
      "thumbnailUrl": "https://i.pinimg.com/564x/f5/1a/09/f51a099db621ef2488fa04f033688f98.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 239,
      "mediaType": "image",
      "authorName": "Nico Campbell",
      "checkedAt": "2026-09-19T16:30:34.330Z"
    },
    "7647936071673629973": {
      "provider": "tiktok",
      "sourceUrl": "https://www.tiktok.com/@kingston.b0/video/7647936071673629973",
      "embedUrl": "https://www.tiktok.com/player/v1/7647936071673629973?autoplay=0&loop=0&rel=0&controls=1&music_info=1&description=1&closed_caption=1&native_context_menu=0",
      "thumbnailUrl": "https://p16-common-sign.tiktokcdn-eu.com/tos-alisg-p-0037/ocOBErQAAX8BTFyxAAAIGxfYCPAii7i1wEcIzN~tplv-tiktokx-origin.image?dr=10395&x-expires=1790006400&x-signature=WgV6R43n4j1PiFui%2BCLadkHHyFI%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=no1a",
      "thumbnailWidth": 1024,
      "thumbnailHeight": 576,
      "mediaType": "video",
      "authorName": "𝐊𝐈𝐍𝐆𝐒𝐓𝐎𝐍𖤍",
      "checkedAt": "2026-09-19T16:30:34.727Z"
    },
    "7623750797154635038": {
      "provider": "tiktok",
      "sourceUrl": "https://www.tiktok.com/@beanpan_/video/7623750797154635038",
      "embedUrl": "https://www.tiktok.com/player/v1/7623750797154635038?autoplay=0&loop=0&rel=0&controls=1&music_info=1&description=1&closed_caption=1&native_context_menu=0",
      "thumbnailUrl": "https://p16-common-sign.tiktokcdn-eu.com/tos-useast8-p-0068-tx2/ocYLBANiKKNfbBDtAAAoUIA5EAv0L5BaiyOiiB~tplv-tiktokx-origin.image?dr=10395&x-expires=1790006400&x-signature=RCshvZVgsiEvOhs%2BNf06xwwVj5k%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=no1a",
      "thumbnailWidth": 854,
      "thumbnailHeight": 720,
      "mediaType": "video",
      "authorName": "beanpan",
      "checkedAt": "2026-09-19T16:30:34.720Z"
    },
    "7482465014314552598": {
      "provider": "tiktok",
      "sourceUrl": "https://www.tiktok.com/@andresixeight/video/7482465014314552598",
      "embedUrl": "https://www.tiktok.com/player/v1/7482465014314552598?autoplay=0&loop=0&rel=0&controls=1&music_info=1&description=1&closed_caption=1&native_context_menu=0",
      "thumbnailUrl": "https://p16-common-sign.tiktokcdn-eu.com/tos-no1a-p-0037-no/o8Kv8CIGPDDTlugLITDhWAIBILWXer3AejQkfX~tplv-tiktokx-origin.image?dr=10395&x-expires=1790006400&x-signature=kMvT041LmR6gjJcrCy%2FkFVszSwE%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=no1a",
      "thumbnailWidth": 576,
      "thumbnailHeight": 1024,
      "mediaType": "video",
      "authorName": "Andre ⚡️",
      "checkedAt": "2026-09-19T16:30:34.763Z"
    },
    "974818281863152085": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/974818281863152085/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=974818281863152085",
      "thumbnailUrl": "https://i.pinimg.com/564x/75/67/ae/7567aeed89a0652cdd453a335ab6d590.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 559,
      "mediaType": "image",
      "authorName": "༺ CLAY💋",
      "checkedAt": "2026-09-19T16:30:34.979Z"
    },
    "733523858101103384": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/733523858101103384/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=733523858101103384",
      "thumbnailUrl": "https://i.pinimg.com/564x/4b/55/4f/4b554f057bc2e5526534fbf6d051d5cb.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 1002,
      "mediaType": "image",
      "authorName": "Grégori Pablo",
      "checkedAt": "2026-09-19T16:30:34.984Z"
    },
    "1128433250417695713": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/1128433250417695713/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=1128433250417695713",
      "thumbnailUrl": "https://i.pinimg.com/564x/90/c4/0e/90c40e0cf76a753a5a2e12efc9f62bf0.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 564,
      "mediaType": "unknown",
      "authorName": "Helaink",
      "checkedAt": "2026-09-19T16:30:34.942Z"
    },
    "1075375217279793808": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/1075375217279793808/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=1075375217279793808",
      "thumbnailUrl": "https://i.pinimg.com/564x/b6/36/c2/b636c2350a8287197537b3f1b89a459d.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 846,
      "mediaType": "unknown",
      "authorName": "FitFolio",
      "checkedAt": "2026-09-19T16:30:35.166Z"
    },
    "1096063628085416862": {
      "provider": "pinterest",
      "sourceUrl": "https://www.pinterest.com/pin/1096063628085416862/",
      "embedUrl": "https://assets.pinterest.com/ext/embed.html?id=1096063628085416862",
      "thumbnailUrl": "https://i.pinimg.com/564x/5f/b8/f7/5fb8f759635f3de6477850510e295fba.jpg",
      "thumbnailWidth": 564,
      "thumbnailHeight": 772,
      "mediaType": "unknown",
      "authorName": "wolt",
      "checkedAt": "2026-09-19T16:30:35.199Z"
    }
  });

  function material(externalId, interestIds, keywords, tags, lang, title, body, referenceExample = false) {
    const metadata = METADATA[externalId];
    const pinterest = metadata.provider === 'pinterest';
    return Object.freeze({
      id: `${metadata.provider}-${externalId}`, source: metadata.provider, externalId,
      format: pinterest ? 'image' : 'edit', lang, interestIds: Object.freeze(interestIds),
      keywords: Object.freeze(keywords), tags: Object.freeze(tags), title, body,
      visual: pinterest ? 'photo' : 'edit', imageUrl: metadata.thumbnailUrl,
      imageWidth: metadata.thumbnailWidth, imageHeight: metadata.thumbnailHeight,
      mediaType: metadata.mediaType, referenceExample,
      rights: Object.freeze({
        kind: 'official-source', holder: `${pinterest ? 'Pinterest' : 'TikTok'} · ${metadata.authorName}`,
        url: pinterest ? 'https://developers.pinterest.com/docs/web-features/widgets/' : 'https://developers.tiktok.com/docs/en/embed-player',
        embedAllowed: true, downloadAllowed: false,
      }),
      delivery: Object.freeze({ policy: 'embed', sourceUrl: metadata.sourceUrl, embedUrl: metadata.embedUrl }),
      durationSec: null, lastCheckedAt: metadata.checkedAt, available: 'unknown',
      checkMethod: 'metadata', availabilityReason: 'not_checked',
    });
  }

  const CANDIDATES = Object.freeze([
    material('354658539408264219', ['travel', 'art', 'creative'],
      ['red-hair', 'umbrella', 'tokyo-night', 'neon', 'rain', 'рыжие волосы', 'зонт', 'неон'],
      ['night-photography', 'neon', 'portrait'], 'none',
      copy('Рыжие волосы, зонт, ночной город', 'Red hair, an umbrella, the city at night', 'Rote Haare, Schirm und nächtliche Stadt', 'Руде волосся, парасоля, нічне місто', 'Pelo rojo, paraguas y ciudad nocturna'),
      copy('Портрет с прозрачным зонтом на фоне размытых ночных огней.', 'A portrait with a clear umbrella against blurred lights at night.', 'Ein Porträt mit durchsichtigem Schirm vor unscharfen Nachtlichtern.', 'Портрет із прозорою парасолею на тлі розмитих нічних вогнів.', 'Un retrato con paraguas transparente ante las luces desenfocadas de la noche.')),
    material('140244975883750646', ['travel', 'art', 'creative'],
      ['liam-wong', 'tokyo', 'taxi', 'night-photography', 'wepresent', 'токио', 'такси'],
      ['urban-night', 'street-photography'], 'none',
      copy('Токио после полуночи · такси', 'Tokyo after midnight · taxis', 'Tokio nach Mitternacht · Taxis', 'Токіо після опівночі · таксі', 'Tokio después de medianoche · taxis'),
      copy('Кадр из материала WePresent о ночном Токио и таксистах в фотографиях Лиама Вонга.', 'A frame from WePresent’s story on Tokyo at night and taxi drivers photographed by Liam Wong.', 'Ein Bild aus WePresents Beitrag über nächtliches Tokio und Taxifahrer, fotografiert von Liam Wong.', 'Кадр із матеріалу WePresent про нічне Токіо й таксистів у фотографіях Ліама Вонга.', 'Una imagen del reportaje de WePresent sobre Tokio nocturno y los taxistas fotografiados por Liam Wong.')),
    material('287386019967085670', ['design', 'art', 'creative'],
      ['sebastian-weiss', 'dramatis-personae', 'architecture', 'geometry', 'архитектура', 'геометрия'],
      ['architectural-photography', 'geometry'], 'none',
      copy('Dramatis Personae · архитектура', 'Dramatis Personae · architecture', 'Dramatis Personae · Architektur', 'Dramatis Personae · архітектура', 'Dramatis Personae · arquitectura'),
      copy('Архитектурный кадр из серии Себастьяна Вайса, представленной Inspiration Grid.', 'An architectural photograph from Sebastian Weiss’s series featured by Inspiration Grid.', 'Eine Architekturfotografie aus der von Inspiration Grid vorgestellten Serie von Sebastian Weiss.', 'Архітектурний кадр із серії Себастьяна Вайса, представленої Inspiration Grid.', 'Una fotografía arquitectónica de la serie de Sebastian Weiss presentada por Inspiration Grid.')),
    material('287386019965477013', ['design', 'art', 'travel'],
      ['sebastian-weiss', 'red-wall', 'architecture', 'colour', 'красная стена', 'архитектура'],
      ['architectural-photography', 'colour'], 'none',
      copy('The Red Wall · цвет и архитектура', 'The Red Wall · colour and architecture', 'The Red Wall · Farbe und Architektur', 'The Red Wall · колір та архітектура', 'The Red Wall · color y arquitectura'),
      copy('Фотография из архитектурной серии The Red Wall Себастьяна Вайса.', 'A photograph from Sebastian Weiss’s architectural series The Red Wall.', 'Eine Fotografie aus Sebastian Weiss’ Architekturserie The Red Wall.', 'Фотографія з архітектурної серії The Red Wall Себастьяна Вайса.', 'Una fotografía de la serie arquitectónica The Red Wall de Sebastian Weiss.')),
    material('455145106092028927', ['travel', 'hiking', 'nature'],
      ['lofoten', 'norway', 'wildbonde', 'vanlife', 'fjord', 'roadtrip', 'лофотены', 'норвегия'],
      ['adventure', 'vanlife', 'mountains'], 'none',
      copy('Лофотены · жизнь в дороге', 'Lofoten · life on the road', 'Lofoten · Leben unterwegs', 'Лофотени · життя в дорозі', 'Lofoten · vida en ruta'),
      copy('Фотография Лофотен из дорожной подборки @wildbonde.', 'A Lofoten photograph from @wildbonde’s travel collection.', 'Eine Lofoten-Aufnahme aus der Reisesammlung von @wildbonde.', 'Фотографія Лофотен із дорожньої добірки @wildbonde.', 'Una fotografía de Lofoten de la colección de viajes de @wildbonde.')),
    material('491736853086922533', ['diy', 'creative', 'art'],
      ['urban-meadows-pottery', 'jess-howell', 'ceramics', 'handbuilt-vases', 'garden-workshop', 'керамика', 'вазы'],
      ['handmade', 'craft-photography'], 'none',
      copy('Керамика из садовой мастерской', 'Pottery from a garden workshop', 'Keramik aus einer Gartenwerkstatt', 'Кераміка із садової майстерні', 'Cerámica de un taller en el jardín'),
      copy('Вазы ручной работы Urban Meadows Pottery в съёмке Джесс Хауэлл.', 'Hand-built Urban Meadows Pottery vases photographed by Jess Howell.', 'Handgefertigte Vasen von Urban Meadows Pottery, fotografiert von Jess Howell.', 'Вази ручної роботи Urban Meadows Pottery у зйомці Джесс Хауелл.', 'Jarrones hechos a mano de Urban Meadows Pottery fotografiados por Jess Howell.')),
    material('462674561688722574', ['diy', 'creative', 'art'],
      ['pottery-workshop', 'pham-ty', 'ceramics', 'craft', 'гончарная мастерская', 'керамика'],
      ['workshop', 'craft-photography'], 'none',
      copy('Гончарная мастерская · Pham Ty', 'Pottery workshop · Pham Ty', 'Töpferwerkstatt · Pham Ty', 'Гончарна майстерня · Pham Ty', 'Taller de cerámica · Pham Ty'),
      copy('Фотография гончарной мастерской с указанием Pham Ty в подписи источника.', 'A pottery workshop photograph credited to Pham Ty in the source caption.', 'Ein Foto einer Töpferwerkstatt, dessen Quellenbeschreibung Pham Ty nennt.', 'Фотографія гончарної майстерні із зазначенням Pham Ty у підписі джерела.', 'Una fotografía de un taller de cerámica acreditada a Pham Ty en la descripción de origen.')),
    material('170785010862666018', ['home', 'reading', 'design'],
      ['reading-nook', 'kirsten-johnstone', 'tatjana-plitt', 'interior', 'reading-corner', 'уголок для чтения'],
      ['interior-photography', 'reading-space'], 'none',
      copy('Уголок для чтения · пространство дома', 'A reading nook · a space at home', 'Eine Leseecke · Raum zu Hause', 'Куточок для читання · простір удома', 'Un rincón de lectura · espacio en casa'),
      copy('Уголок для чтения из проекта Kirsten Johnstone Architecture; источник указывает фотографа Tatjana Plitt.', 'A reading nook from a Kirsten Johnstone Architecture project; the source credits photographer Tatjana Plitt.', 'Eine Leseecke aus einem Projekt von Kirsten Johnstone Architecture; die Quelle nennt die Fotografin Tatjana Plitt.', 'Куточок для читання з проєкту Kirsten Johnstone Architecture; джерело вказує фотографку Tatjana Plitt.', 'Un rincón de lectura de un proyecto de Kirsten Johnstone Architecture; la fuente acredita a la fotógrafa Tatjana Plitt.')),
    material('134334001376557674', ['travel', 'art', 'creative'],
      ['liam-wong', 'cities-after-dark', 'neon', 'panorama', 'urban-loneliness', 'ночной город', 'неон'],
      ['urban-night', 'panoramic-photography'], 'none',
      copy('Город после темноты · панорама', 'A city after dark · panorama', 'Stadt nach Einbruch der Dunkelheit · Panorama', 'Місто після настання темряви · панорама', 'Una ciudad de noche · panorámica'),
      copy('Панорамный кадр из материала Colossal о ночной фотографии Лиама Вонга.', 'A panoramic frame from Colossal’s feature on Liam Wong’s night photography.', 'Ein Panoramabild aus Colossals Beitrag über Liam Wongs Nachtfotografie.', 'Панорамний кадр із матеріалу Colossal про нічну фотографію Ліама Вонга.', 'Una panorámica del artículo de Colossal sobre la fotografía nocturna de Liam Wong.')),
    material('7647936071673629973', ['anime', 'animation', 'video'],
      ['gojo', 'gojosatoru', 'onepiece', 'jujutsukaisen', 'masking', 'kingston', 'годжо', 'ван пис'],
      ['masking-edit', 'anime-edit'], 'unknown',
      copy('Годжо × One Piece · masking edit', 'Gojo × One Piece · masking edit', 'Gojo × One Piece · Masking-Edit', 'Ґоджьо × One Piece · masking edit', 'Gojo × One Piece · edit con máscaras'),
      copy('KINGSTON называет этот монтаж эдитом Годжо и One Piece с масками.', 'KINGSTON describes this as a Gojo and One Piece masking edit.', 'KINGSTON beschreibt diesen Clip als Masking-Edit zu Gojo und One Piece.', 'KINGSTON називає цей монтаж едітом Ґоджьо та One Piece з масками.', 'KINGSTON describe este montaje como un edit con máscaras de Gojo y One Piece.')),
    material('7623750797154635038', ['anime', 'animation', 'video'],
      ['run-kaisen', 'jujutsukaisen', 'jujutsukaisen-season3', 'beanpan', 'anime-running'],
      ['anime-edit', 'running-scene'], 'unknown',
      copy('Run Kaisen · beanpan', 'Run Kaisen · beanpan', 'Run Kaisen · beanpan', 'Run Kaisen · beanpan', 'Run Kaisen · beanpan'),
      copy('Аниме-монтаж beanpan с подписью Run Kaisen и тегами Jujutsu Kaisen.', 'An anime edit by beanpan captioned Run Kaisen and tagged Jujutsu Kaisen.', 'Ein Anime-Edit von beanpan mit dem Titel Run Kaisen und Jujutsu-Kaisen-Tags.', 'Аніме-монтаж beanpan із підписом Run Kaisen і тегами Jujutsu Kaisen.', 'Un edit de anime de beanpan titulado Run Kaisen y etiquetado Jujutsu Kaisen.')),
    material('7482465014314552598', ['fitness', 'movement', 'sport'],
      ['andresixeight', 'running', 'martialarts', 'fitness', 'gym', 'бег', 'боевые искусства'],
      ['fitness-edit', 'training'], 'unknown',
      copy('Andre · бег и боевые искусства', 'Andre · running and martial arts', 'Andre · Laufen und Kampfsport', 'Andre · біг і бойові мистецтва', 'Andre · correr y artes marciales'),
      copy('Ролик Andre с тегами бега, тренировок и боевых искусств.', 'Andre’s clip tagged with running, training and martial arts.', 'Andres Clip mit Tags zu Laufen, Training und Kampfsport.', 'Ролик Andre з тегами бігу, тренувань і бойових мистецтв.', 'Un clip de Andre etiquetado con correr, entrenamiento y artes marciales.')),
    // These are taste examples when their URLs occur in a person's references;
    // the profile selector must not return their own examples as new discovery.
    material('974818281863152085', ['philosophy', 'art', 'design'],
      ['stoicism', 'stoic', 'collage', 'стоицизм', 'коллаж'],
      ['stoic-collage', 'vision-board'], 'en',
      copy('Стоицизм · коллаж', 'Stoicism · collage', 'Stoizismus · Collage', 'Стоїцизм · колаж', 'Estoicismo · collage'),
      copy('Коллаж со стоической темой и английскими надписями.', 'A collage with a stoic theme and English text.', 'Eine Collage mit stoischem Thema und englischen Texten.', 'Колаж зі стоїчною темою та англійськими написами.', 'Un collage de tema estoico con texto en inglés.'), true),
    material('733523858101103384', ['travel', 'hiking', 'nature'],
      ['adventure', 'vision-board', 'travel-collage', 'приключения', 'коллаж путешествий'],
      ['adventure-collage', 'vision-board'], 'none',
      copy('Приключения · доска образов', 'Adventure · vision board', 'Abenteuer · Bildersammlung', 'Пригоди · дошка образів', 'Aventura · tablero de inspiración'),
      copy('Вертикальный коллаж с образами приключений и путешествий.', 'A vertical collage of adventure and travel imagery.', 'Eine vertikale Collage mit Abenteuer- und Reisebildern.', 'Вертикальний колаж з образами пригод і подорожей.', 'Un collage vertical de imágenes de aventura y viajes.'), true),
    material('1128433250417695713', ['superhero', 'art', 'creative'],
      ['spider-man', 'spiderman', 'work-hours', 'comic', 'человек-паук', 'комикс'],
      ['comic-panel', 'spider-man'], 'en',
      copy('Spider-Man · Work Hours', 'Spider-Man · Work Hours', 'Spider-Man · Work Hours', 'Spider-Man · Work Hours', 'Spider-Man · Work Hours'),
      copy('Комикс с Человеком-пауком и надписью Work Hours.', 'A Spider-Man comic image with the words Work Hours.', 'Ein Comicbild mit Spider-Man und den Worten Work Hours.', 'Комікс із Людиною-павуком і написом Work Hours.', 'Una imagen de cómic de Spider-Man con las palabras Work Hours.'), true),
    material('1075375217279793808', ['home', 'fitness', 'design'],
      ['garden-home-gym', 'home-gym', 'garden', 'fitness-interior', 'домашний спортзал', 'сад'],
      ['home-gym-interior', 'garden'], 'unknown',
      copy('Домашний спортзал рядом с садом', 'A home gym beside a garden', 'Ein Fitnessraum am Garten', 'Домашній спортзал поруч із садом', 'Un gimnasio en casa junto al jardín'),
      copy('Образ домашнего спортзала с садом в поле зрения.', 'A home-gym scene with a garden in view.', 'Ein Bild eines Fitnessraums mit Blick in den Garten.', 'Образ домашнього спортзалу із садом у полі зору.', 'Una escena de gimnasio en casa con el jardín a la vista.'), true),
    material('1096063628085416862', ['nature', 'travel', 'design'],
      ['arcteryx', 'arc-teryx', 'snow-leopard', 'mountains', 'alpine', 'горный коллаж', 'снежный барс'],
      ['outdoor-fashion', 'ai-collage', 'alpine'], 'unknown',
      copy('Arc’teryx · горный AI-коллаж', 'Arc’teryx · an AI mountain collage', 'Arc’teryx · KI-Bergcollage', 'Arc’teryx · гірський ШІ-колаж', 'Arc’teryx · collage de montaña con IA'),
      copy('Изменённый с помощью AI образ со снежным барсом, горами и Arc’teryx.', 'An AI-altered image combining a snow leopard, mountains and Arc’teryx.', 'Ein mit KI verändertes Bild mit Schneeleopard, Bergen und Arc’teryx.', 'Змінений за допомогою ШІ образ зі сніговим барсом, горами та Arc’teryx.', 'Una imagen modificada con IA que combina un leopardo de las nieves, montañas y Arc’teryx.'), true),
  ]);
  return Object.freeze({ VERSION: '1.0.0', ID: '2026-09-19-visual-metadata', CANDIDATES });
});
