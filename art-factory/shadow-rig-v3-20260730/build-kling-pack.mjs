import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const generatedAt = '2026-07-30';

const forms = [
  {
    id: 'spark',
    name: 'Искра',
    bond: 0,
    image: 'runtime/shadow-spark-calm.png',
    sha256: '88394e10830d02f50c610754dc2f517bf29b6683a239738ed7702c6d3a2d7123',
    subject: 'the compact first evolution of Shadow: a rounded seed-like indigo flame with a friendly small face, black-violet oval eyes with a lavender inner glow, one tall layered flame crown and no separate limbs',
    motionLimits: 'Do not invent arms, hands, armour, a torso, a halo or a rune.',
  },
  {
    id: 'spirit',
    name: 'Дух',
    bond: 6,
    image: 'runtime/shadow-spirit-calm.png',
    sha256: 'b0ee5cd0cabc95cdbe76c572202aea2fb8ad75f60bf7cfd6dd0d1d9cbe172549',
    subject: 'the small friendly humanoid Spirit evolution of Shadow: a rounded flame head, calm oval lavender eyes, a tiny mouth, two short smoke-wisp arms and a tapering spectral tail',
    motionLimits: 'Keep both short wisp arms attached and preserve the simple unarmoured silhouette.',
  },
  {
    id: 'guardian',
    name: 'Страж',
    bond: 20,
    image: 'runtime/shadow-guardian-calm.png',
    sha256: '0166ec3ffaa0cf5499128d05ad092bd81914b6fb690e362720e77ff8a0b840bc',
    subject: 'the protective Guardian evolution of Shadow: a taller humanoid layered-flame body, calm oval lavender eyes, two readable arms and hands, broad smoke-wisp shoulders, a central violet diamond and a tapering spectral lower body',
    motionLimits: 'Preserve exactly two arms and two hands; never turn the mantle into plate armour or add a weapon.',
  },
  {
    id: 'keeper',
    name: 'Хранитель',
    bond: 50,
    image: 'runtime/shadow-keeper-calm.png',
    sha256: '444592ab00e796b399ac0eb671c720f0ba0e834dcdb6452ccbe61cc3b515830a',
    subject: 'the final wise Keeper evolution of Shadow: a broad serene layered-flame figure with calm oval lavender eyes, two open hands, a large central violet diamond, flowing spectral mantle and one circular flame halo crowned by a smaller diamond',
    motionLimits: 'Preserve exactly two arms, two open hands, one halo and two diamond motifs; never make the character threatening or boss-like.',
  },
];

const states = [
  {
    id: 'calm',
    name: 'Спокойствие',
    motion: 'Animate a restrained idle: slow breathing through the layered paper body, a gentle vertical hover of only a few pixels, one natural blink and tiny independent movement in the outer flame tips. End in the exact starting pose.',
  },
  {
    id: 'listening',
    name: 'Слушает',
    motion: 'The character leans toward the viewer by only a few degrees, the eyes become attentive, then the body settles back. Add one very soft inward pulse through the nearest paper wisps. End in the exact starting pose.',
  },
  {
    id: 'thinking',
    name: 'Думает',
    motion: 'Add a small thoughtful head tilt and a brief upward eye movement. The central highlight or rune, only where one already exists, pulses once; two tiny violet motes rise and disappear. End in the exact starting pose.',
  },
  {
    id: 'speaking',
    name: 'Говорит',
    motion: 'Animate believable quiet speech: small rhythmic mouth shapes, restrained head nods on phrase accents and minimal movement of the existing arms or side wisps. Do not create new limbs and do not use continuous chewing motion. Finish the phrase and return to the exact starting pose.',
  },
  {
    id: 'happy',
    name: 'Радость',
    motion: 'The mouth becomes a warm smile, the eyes brighten and the character makes one soft buoyant upward bounce. The outer flame tips lift briefly, then everything returns to the exact starting pose. Friendly, never hyperactive.',
  },
  {
    id: 'radiant',
    name: 'Сияние',
    motion: 'The character briefly radiates quiet pride: the lavender eye and rune glow intensifies, the layered silhouette expands by only a few percent and four tiny paper-light fragments bloom outward and fade. End at the original brightness and pose.',
  },
  {
    id: 'caring',
    name: 'Забота',
    motion: 'The posture softens and leans slightly toward the viewer. The eyes become reassuring; the existing hands or side wisps make one small welcoming gesture. A tiny warm gold-violet heart glow appears near the chest, pulses once and dissolves. End in the exact starting pose.',
  },
  {
    id: 'sleepy',
    name: 'Сонливость',
    motion: 'Use a very slow side-to-side drift, one heavy gentle blink and slightly drooping outer flame tips. Two small violet sleep wisps rise and fade. No falling down and no large deformation. End in the exact starting pose.',
  },
  {
    id: 'longing',
    name: 'Скучает',
    motion: 'The gaze lowers quietly for a moment and returns to the viewer. The silhouette contracts and expands by only a few percent, like a careful breath. Keep the emotion tender and welcoming, never guilty or tragic. End in the exact starting pose.',
  },
  {
    id: 'alert',
    name: 'Важный сигнал',
    motion: 'The character straightens into a calm attentive pose, the eyes sharpen and the existing central glow flashes once. One clean violet ring expands behind the silhouette and disappears. Protective and clear, never aggressive. End in the exact starting pose.',
  },
];

const pilotStateIds = new Set(['calm', 'speaking']);
const negativePrompt = [
  'No camera movement, zoom, crop change, cuts, scene change or parallax.',
  'No character redesign, face replacement, colour shift, realistic smoke, liquid simulation, glossy 3D, photorealism or cinematic relighting.',
  'No extra character, duplicated body, extra limb, missing limb, anatomy mutation, new armour, weapon, crown or accessory.',
  'No text, subtitles, logo, watermark, floor, prop, furniture, scenery, contact shadow or reflection.',
  'No background gradient, texture, green spill, green reflected light, edge flicker, alpha holes or random particles crossing the face.',
  'No horror, anger, villain pose, raid-boss behaviour, frantic motion, camera shake or seamless-loop jump.',
].join(' ');

const backdrop = [
  'Place the character on a perfectly flat, uniform pure chroma-green background #00FF00 from edge to edge.',
  'The green is a technical key only: it must not illuminate, tint or reflect onto the character.',
  'No floor plane, contact shadow, reflection, gradient or texture.',
].join(' ');

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function pngDimensions(file) {
  const buffer = readFileSync(file);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${file} is not a valid PNG`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function validateCanonicalForms() {
  for (const form of forms) {
    const absolute = join(root, form.image);
    if (!existsSync(absolute)) throw new Error(`Missing canonical reference: ${form.image}`);
    const dimensions = pngDimensions(absolute);
    if (dimensions.width !== 1024 || dimensions.height !== 1024) {
      throw new Error(`${form.image} must be 1024x1024, got ${dimensions.width}x${dimensions.height}`);
    }
    const actualHash = sha256(absolute);
    if (actualHash !== form.sha256) {
      throw new Error(`Canonical reference changed: ${form.image}\nexpected ${form.sha256}\nactual   ${actualHash}`);
    }
  }
}

validateCanonicalForms();

const jobs = [];
for (const form of forms) {
  for (const state of states) {
    const prompt = [
      'Create a five-second image-to-video character loop for Satoru using the uploaded canonical PNG as the only identity and style source.',
      `Preserve exactly ${form.subject}.`,
      'Keep the established dark indigo and muted purple handcrafted cut-paper construction, subtle warm-gold edge accents, restrained smoky-watercolour translucency printed inside the paper, clean silhouette, facial proportions and black-violet oval eye design.',
      form.motionLimits,
      state.motion,
      'Keep the complete character centred and fully inside the frame with generous padding.',
      backdrop,
      'Locked camera, front-facing composition, soft even frontal light, low creativity and maximum character-reference fidelity.',
      'The fifth second must visually reconnect to the first frame without a jump.',
    ].join(' ');
    jobs.push({
      id: `${form.id}-${state.id}`,
      form: form.id,
      formName: form.name,
      bond: form.bond,
      state: state.id,
      stateName: state.name,
      primaryImage: form.image,
      canonicalSha256: form.sha256,
      optionalStyleImage: null,
      mode: 'image-to-video',
      durationSeconds: 5,
      creativity: 'low',
      camera: 'locked',
      loop: true,
      pilot: pilotStateIds.has(state.id),
      prompt,
      negativePrompt,
      outputName: `shadow-v3-${form.id}-${state.id}-kling-source.mp4`,
    });
  }
}

const pilotJobs = jobs.filter((job) => job.pilot).map((job) => job.id);
if (jobs.length !== 40 || pilotJobs.length !== 8) {
  throw new Error(`Invalid job matrix: ${jobs.length} total, ${pilotJobs.length} pilot`);
}

const intro = `# Kling handoff — Shadow Rig v3

В пакете 40 независимых image-to-video jobs: 4 canonical формы × 10 состояний.

## Сначала только pilot

Не запускай все 40 сразу. Первый гейт — 8 jobs с пометкой **PILOT**: \`calm\` и \`speaking\` для каждой формы. Они проверяют две главные вещи: Kling сохраняет новый canonical дизайн и Тень умеет спокойно говорить без мутации лица/конечностей. После одобрения пилота запускаются остальные 32.

## Настройки Kling

1. Режим: image-to-video.
2. Загрузи только файл из **Primary image**. Отдельный style image не нужен.
3. Duration: 5 seconds.
4. Creativity / imagination: low; character or reference fidelity: maximum.
5. Camera: locked; motion: restrained.
6. Вставь Prompt и Negative prompt целиком.
7. Сохрани файл под **Output name**.

Зелёный фон — технический chroma key. Не удаляй его в Kling: после возврата исходников он будет превращён в настоящую alpha, затем ролики пройдут crop, loop и edge-fringe QA.

`;

const blocks = jobs.map((job, index) => `## ${String(index + 1).padStart(2, '0')}. ${job.formName} · ${job.stateName}${job.pilot ? ' · PILOT' : ''}

- **Primary image:** \`${job.primaryImage}\`
- **Output name:** \`${job.outputName}\`
- **Duration:** ${job.durationSeconds}s

### Prompt

\`\`\`text
${job.prompt}
\`\`\`

### Negative prompt

\`\`\`text
${job.negativePrompt}
\`\`\`
`).join('\n');

const payload = {
  version: 3,
  generatedAt,
  canonicalContract: {
    canvas: [1024, 1024],
    style: 'satoru-shadow-cut-paper-v3',
    primaryImageOnly: true,
    backdrop: '#00FF00',
  },
  forms,
  states,
  pilotJobs,
  jobs,
};

writeFileSync(join(root, 'kling-jobs.json'), `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(join(root, 'KLING-PROMPTS.md'), intro + blocks);

console.log(`Validated ${forms.length} canonical 1024x1024 references.`);
console.log(`Built ${jobs.length} Kling jobs (${pilotJobs.length} pilot).`);
console.log('Wrote kling-jobs.json and KLING-PROMPTS.md.');
