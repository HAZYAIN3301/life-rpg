import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = process.argv[2] || "/Users/al.prokopets/.codex/generated_images/019f565d-6d96-7e42-b698-733d6a23175f";
const outputDir = path.join(projectRoot, "public/art/pets/fortune-v2");
const previewPath = path.join(outputDir, "fortune-v2-preview.png");
const canvasSize = 1024;

// Geometry is calibrated against the accepted assembled reference. Layer order
// is also the render order: ears and collar tuck behind the head, while the
// bell and both complete forelimbs remain in front of the torso.
const layers = [
  { id: "pet-shadow", generated: "shadow", z: 0, pivot: [512, 902] },
  { id: "pet-tail", file: "exec-42b6c74a-8623-4e92-8aef-fce7248efd4b.png", box: [112, 535, 255, 275], z: 10, pivot: [343, 720] },
  { id: "pet-back-bag", file: "exec-594d19e9-ae81-4cf4-bc96-e49e5906666d.png", box: [650, 300, 325, 525], z: 20, pivot: [680, 590] },
  { id: "pet-body", file: "exec-c5121495-24c7-4a8a-98ad-c480dbaec414.png", box: [205, 420, 620, 525], z: 30, pivot: [512, 690] },
  { id: "pet-collar", file: "exec-7df3944f-2205-4746-a98e-68128329d731.png", box: [255, 458, 520, 190], z: 40, pivot: [512, 525] },
  { id: "pet-paw-raised", file: "exec-20ad79bf-6619-4335-8813-2856b705c49e.png", box: [168, 245, 230, 455], z: 50, pivot: [350, 610] },
  { id: "pet-paw-holding-arm", file: "exec-d1845752-f6c4-4375-91b7-9f20f10e9f5a.png", box: [610, 455, 190, 380], z: 52, pivot: [668, 610] },
  { id: "pet-hand-item", file: "exec-89c5f6f3-e8fe-4d84-9188-03fe78229abb.png", box: [552, 625, 290, 330], z: 54, pivot: [650, 650] },
  { id: "pet-paw-holding", file: "exec-b19166eb-90ae-4f60-a4ce-c56ea2ee405c.png", box: [628, 520, 176, 178], z: 55, pivot: [668, 610] },
  { id: "pet-ear-r", file: "exec-ca677e8f-ce75-40d2-9031-4aa517e3e46f.png", box: [300, 72, 180, 250], z: 58, pivot: [390, 295] },
  { id: "pet-ear-l", file: "exec-b451a583-9ab7-44c2-a87a-21d43dd8179c.png", box: [584, 72, 180, 250], z: 59, pivot: [674, 295] },
  { id: "pet-head-base", file: "exec-6a662c51-ae71-41f5-90a5-5d5dc35134e4.png", box: [282, 142, 460, 380], z: 60, pivot: [512, 430] },
  { id: "pet-head-patch-r", file: "exec-75f4b7fe-fe45-4767-b6cd-84af55d2e16d.png", box: [505, 150, 94, 66], z: 63, pivot: [552, 183] },
  { id: "pet-head-patch-l", file: "exec-d5fa0820-ab9b-47d4-9680-0ccd52f0665a.png", box: [574, 144, 126, 84], z: 64, pivot: [637, 186] },
  { id: "pet-face", file: "exec-89e61d44-dadb-4f15-bf02-d65fbedac289.png", box: [341, 264, 342, 178], z: 70, pivot: [512, 368] },
  { id: "pet-bell", file: "exec-74193acb-9775-4b28-8434-546deeab1e60.png", box: [452, 520, 120, 140], z: 90, pivot: [512, 534] },
];

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

async function removeGreenScreen(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const sourceAlpha = data[i + 3];
    const dominance = g - Math.max(r, b);
    const chroma = smoothstep(8, 74, dominance) * smoothstep(24, 96, g);
    const alpha = Math.round(sourceAlpha * (1 - chroma));

    if (chroma > 0) {
      const neutralGreen = Math.max(r, b);
      data[i + 1] = Math.round(g * (1 - chroma) + neutralGreen * chroma);
    }
    data[i + 3] = alpha < 5 ? 0 : alpha;
  }

  return sharp(data, { raw: info })
    .png()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
    .toBuffer();
}

async function placeOnCanvas(layer) {
  const sourcePath = path.join(sourceDir, layer.file);
  const [left, top, width, height] = layer.box;
  const keyed = await removeGreenScreen(sourcePath);
  const fitted = await sharp(keyed)
    .resize({ width, height, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const metadata = await sharp(fitted).metadata();
  const x = left + Math.round((width - metadata.width) / 2);
  const y = top + Math.round((height - metadata.height) / 2);

  return sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fitted, left: x, top: y }])
    .png()
    .toBuffer();
}

async function createShadow() {
  const shadow = Buffer.from(
    `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><defs><filter id="blur"><feGaussianBlur stdDeviation="18"/></filter></defs><ellipse cx="512" cy="904" rx="286" ry="38" fill="#17120e" fill-opacity=".28" filter="url(#blur)"/></svg>`,
  );
  return sharp(shadow).png().toBuffer();
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  for (const layer of layers) {
    const output = layer.generated === "shadow" ? await createShadow() : await placeOnCanvas(layer);
    await sharp(output).toFile(path.join(outputDir, `${layer.id}.png`));
  }

  const manifest = {
    version: 2,
    canvas: [canvasSize, canvasSize],
    style: "satoru-cut-paper",
    layers: layers.map(({ id, z, pivot }) => ({ id, file: `${id}.png`, z, pivot })),
    slots: {
      head: [512, 250],
      neck: [512, 525],
      back: [680, 590],
    },
  };
  await writeFile(path.join(outputDir, "rig.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const composites = layers.map((layer) => ({
    input: path.join(outputDir, `${layer.id}.png`),
    left: 0,
    top: 0,
  }));
  await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 244, g: 238, b: 228, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toFile(previewPath);

  process.stdout.write(`Built ${layers.length} Fortune Cat layers and ${previewPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
