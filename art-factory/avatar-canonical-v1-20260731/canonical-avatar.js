const ROOT = './runtime/';
const state = { outfit:true, hair:true, goggles:true, scarf:true, backpack:true, pouch:true, lantern:true };
const definitions = [
  ['body-full','base/body-underlay-full.png',() => !state.outfit],
  ['body-safe','base/body-underlay-safe.png',() => state.outfit],
  ['outfit-reveal','wardrobe/outfit/traveller-outfit-backpack-reveal.png',() => state.outfit],
  ['backpack-back','wardrobe/backpack/backpack-back.png',() => state.outfit && state.backpack],
  ['hair-back','wardrobe/hair/traveller-hair-back.png',() => state.hair],
  ['outfit','wardrobe/outfit/traveller-outfit-current.png',() => state.outfit],
  ['body-visible','base/body-visible-approved.png',() => state.outfit],
  ['bald-reveal','base/body-bald-head-reveal.png',() => !state.hair],
  ['scarf','wardrobe/scarf/traveller-scarf.png',() => state.outfit && state.scarf],
  ['backpack-straps','wardrobe/backpack/backpack-straps.png',() => state.outfit && state.backpack],
  ['face','states/traveller-face-neutral.png',() => true],
  ['hair-front','wardrobe/hair/traveller-hair-front.png',() => state.hair],
  ['goggles','wardrobe/goggles/traveller-goggles.png',() => state.goggles],
  ['pouch','wardrobe/pouch/traveller-pouch.png',() => state.outfit && state.pouch],
  ['lantern','wardrobe/lantern/traveller-lantern.png',() => state.outfit && state.backpack && state.lantern],
];

const avatar = document.querySelector('#avatar');
const nodes = new Map();
for (const [id, file] of definitions) {
  const image = new Image();
  image.alt = '';
  image.decoding = 'async';
  image.src = ROOT + file;
  image.dataset.layer = id;
  avatar.append(image);
  nodes.set(id, image);
}

function render() {
  if (!state.backpack) state.lantern = false;
  definitions.forEach(([id, , visible]) => nodes.get(id).classList.toggle('on', visible()));
  document.querySelectorAll('input[data-slot]').forEach((input) => { input.checked = state[input.dataset.slot]; });
}

const labels = { outfit:'Костюм', hair:'Волосы', goggles:'Очки', scarf:'Шарф', backpack:'Рюкзак', pouch:'Сумка', lantern:'Фонарь' };
const controls = document.querySelector('#controls');
for (const key of Object.keys(labels)) {
  const label = document.createElement('label');
  label.innerHTML = `<span>${labels[key]}</span><input type="checkbox" data-slot="${key}">`;
  label.querySelector('input').addEventListener('change', (event) => {
    state[key] = event.currentTarget.checked;
    if (key === 'lantern' && state.lantern) state.backpack = true;
    render();
  });
  controls.append(label);
}

Promise.all([...nodes.values()].map((image) => image.decode().catch(() => {}))).then(render);
