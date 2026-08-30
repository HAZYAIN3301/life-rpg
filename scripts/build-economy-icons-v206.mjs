#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'art', 'icons', 'content');

const C = Object.freeze({
  ink: '#20273a',
  paper: '#f1e5cb',
  paper2: '#d9c39d',
  steel: '#aebbd0',
  steel2: '#6f819d',
  teal: '#59b7c8',
  teal2: '#317f91',
  gold: '#dfa84b',
  gold2: '#9b642c',
  ember: '#d66b4b',
  green: '#6ead78',
  violet: '#9877c5',
  rose: '#c96b87',
  leather: '#8b5b3d',
  dark: '#111827',
  white: '#f8f4e8',
});

const commonDefs = `
  <defs>
    <filter id="lift" x="-25%" y="-25%" width="150%" height="165%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#050814" flood-opacity=".34"/>
    </filter>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${C.white}"/><stop offset="1" stop-color="${C.paper2}"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#e8edf5"/><stop offset=".5" stop-color="${C.steel}"/><stop offset="1" stop-color="${C.steel2}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#ffd77d"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.gold2}"/>
    </linearGradient>
  </defs>`;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[m]);
}

function svg(title, body, family) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-labelledby="title" data-icon-family="${family}" data-icon-version="2">
  <title id="title">${esc(title)}</title>${commonDefs}
  <g filter="url(#lift)" stroke="${C.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</g>
</svg>\n`;
}

function label(text, y = 84, size = 25, fill = C.ink) {
  return `<text x="64" y="${y}" text-anchor="middle" fill="${fill}" stroke="none" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${size}" font-weight="900" letter-spacing="-.8">${esc(text)}</text>`;
}

function symbol(kind, accent = C.teal, mark = '') {
  switch (kind) {
    case 'blade': return `<path d="M88 17l18 18-46 53-17 4 5-17z" fill="url(#steel)"/><path d="M76 29l18 18" stroke="${accent}"/><path d="M39 84l17 17M33 96l12 12" stroke="url(#gold)" stroke-width="9"/>`;
    case 'crossed-blades': return `<path d="M34 24l14 8 19 48-12 10-25-47zM94 24l-14 8-19 48 12 10 25-47z" fill="url(#steel)"/><path d="M47 82l-13 20M81 82l13 20" stroke="url(#gold)" stroke-width="9"/>${mark ? label(mark, 70, mark.length > 2 ? 21 : 27, C.ink) : ''}`;
    case 'trophy': return `<path d="M42 24h44v22c0 19-9 31-22 31S42 65 42 46z" fill="url(#gold)"/><path d="M42 32H25v9c0 13 8 20 20 20M86 32h17v9c0 13-8 20-20 20" fill="none"/><path d="M64 77v17M46 103h36" stroke-width="8"/>${mark ? label(mark, 58, mark.length > 2 ? 19 : 24, C.ink) : ''}`;
    case 'sprout': return `<path d="M64 104V55" stroke="${C.green}" stroke-width="9"/><path d="M62 62C39 64 25 51 29 29c21-1 35 10 35 31zM66 74c23-1 36-14 34-35-21-2-35 9-36 32z" fill="${C.green}"/><path d="M39 106h50" stroke="${C.leather}" stroke-width="9"/>`;
    case 'flame': return `<path d="M67 18c7 20-5 24 7 37 7-13 16-16 17-28 16 16 23 34 16 54-7 21-25 31-43 31S27 99 23 79c-4-24 13-39 31-54-2 17 2 24 13 31" fill="${C.ember}"/><path d="M64 103c-12 0-21-8-19-20 2-9 9-15 17-22 0 10 3 14 9 19 4-6 7-10 8-17 7 8 10 16 7 25-3 10-12 15-22 15z" fill="${C.gold}"/>${mark ? label(mark, 90, mark.length > 2 ? 18 : 24, C.ink) : ''}`;
    case 'star': return `<path d="M64 17l14 29 32 5-23 22 5 32-28-15-28 15 5-32-23-22 32-5z" fill="url(#gold)"/>${mark ? label(mark, 70, mark.length > 2 ? 20 : 26, C.ink) : ''}`;
    case 'gem': return `<path d="M25 47l18-24h42l18 24-39 63z" fill="${C.violet}"/><path d="M25 47h78M43 23l21 24 21-24M64 47v63" fill="none" stroke="${C.paper}" stroke-width="4"/>${mark ? label(mark, 75, mark.length > 2 ? 18 : 22, C.white) : ''}`;
    case 'target': return `<circle cx="64" cy="66" r="43" fill="${C.paper}"/><circle cx="64" cy="66" r="27" fill="${accent}"/><circle cx="64" cy="66" r="10" fill="${C.gold}"/><path d="M92 39l19-19M97 20h14v14" fill="none" stroke="${C.ink}" stroke-width="7"/>`;
    case 'gift': return `<path d="M26 52h76v57H26z" fill="${accent}"/><path d="M20 39h88v21H20z" fill="url(#gold)"/><path d="M64 39v70" stroke="${C.paper}" stroke-width="8"/><path d="M64 39c-10-25-35-20-27-4 4 8 17 7 27 4zm0 0c10-25 35-20 27-4-4 8-17 7-27 4z" fill="${C.rose}"/>`;
    case 'coin': return `<circle cx="64" cy="64" r="45" fill="url(#gold)"/><circle cx="64" cy="64" r="33" fill="none" stroke="${C.paper}" stroke-width="4"/>${label(mark || 'S', 75, mark.length > 2 ? 18 : 29, C.ink)}`;
    case 'books': return `<path d="M24 84h77v22H24z" fill="${C.teal}"/><path d="M31 56h73v22H31z" fill="${C.rose}"/><path d="M24 28h73v22H24z" fill="url(#gold)"/><path d="M38 28v22M86 56v22M40 84v22" stroke="${C.paper}" stroke-width="4"/>${mark ? label(mark, 73, 25, C.white) : ''}`;
    case 'bug': return `<ellipse cx="64" cy="69" rx="30" ry="36" fill="${C.ember}"/><path d="M64 35v69M38 55L23 42m17 33H20m22 19l-15 12m63-51 15-13M88 75h20M86 94l15 12M49 30c1-12 11-17 15-17s14 5 15 17" fill="none"/>${mark ? label(mark, 78, 27, C.paper) : ''}`;
    case 'shield': return `<path d="M64 16l42 16v30c0 26-16 42-42 53-26-11-42-27-42-53V32z" fill="${accent}"/><path d="M64 29v67M38 55h52" fill="none" stroke="${C.paper}" stroke-width="6"/>${mark ? label(mark, 77, mark.length > 2 ? 19 : 25, C.ink) : ''}`;
    case 'sunrise': return `<path d="M20 91h88M28 78h72" fill="none"/><path d="M40 78a24 24 0 0148 0" fill="${C.gold}"/><path d="M64 21v15M31 36l11 11m55-11L86 47M18 62h15m62 0h15" fill="none" stroke="${C.gold}" stroke-width="7"/><path d="M76 53c8-7 17-7 26-1-11 1-16 7-18 13" fill="none"/>`;
    case 'owl': return `<path d="M34 38l13-16 17 12 17-12 13 16v45c0 19-13 29-30 29S34 102 34 83z" fill="${C.violet}"/><circle cx="50" cy="61" r="14" fill="${C.paper}"/><circle cx="78" cy="61" r="14" fill="${C.paper}"/><circle cx="50" cy="61" r="5" fill="${C.ink}" stroke="none"/><circle cx="78" cy="61" r="5" fill="${C.ink}" stroke="none"/><path d="M58 76l6 10 6-10" fill="url(#gold)"/>`;
    case 'spark': return `<path d="M64 13v102M13 64h102M28 28l72 72m0-72l-72 72" stroke="${C.gold}" stroke-width="8"/><circle cx="64" cy="64" r="14" fill="${C.ember}"/><path d="M64 25l7 28 28 11-28 11-7 28-7-28-28-11 28-11z" fill="${C.paper}" stroke-width="3"/>`;
    case 'rainbow': return `<path d="M17 91a47 47 0 0194 0" fill="none" stroke="${C.rose}" stroke-width="18"/><path d="M27 91a37 37 0 0174 0" fill="none" stroke="${C.gold}" stroke-width="12"/><path d="M37 91a27 27 0 0154 0" fill="none" stroke="${C.teal}" stroke-width="9"/><path d="M14 92h28m44 0h28" stroke="${C.paper}" stroke-width="11"/>`;
    case 'mountain': return `<path d="M13 105l38-60 13 18 15-26 36 68z" fill="${C.steel2}"/><path d="M51 45l13 18 8-13 7-13 13 25-13-6-11 14-14-12-12 3z" fill="${C.paper}"/>${mark ? label(mark, 103, mark.length > 2 ? 18 : 23, C.gold) : ''}`;
    case 'scales': return `<path d="M64 20v81M38 105h52M38 35h52" fill="none" stroke-width="8"/><path d="M38 35L20 68h36zm52 0L72 68h36z" fill="${accent}"/><circle cx="64" cy="22" r="7" fill="url(#gold)"/>${mark ? label(mark, 91, 19, C.paper) : ''}`;
    case 'wave': return `<path d="M14 73c14-34 34-39 50-10 16 28 34 23 50-10-3 34-22 56-50 56-27 0-46-13-50-36z" fill="${C.teal}"/><path d="M23 72c12-14 23-13 33 2 13 19 29 19 48-1" fill="none" stroke="${C.paper}" stroke-width="7"/>${mark ? label(mark, 99, 20, C.ink) : ''}`;
    case 'crown': return `<path d="M23 44l22 18 19-36 19 36 22-18-9 55H32z" fill="url(#gold)"/><path d="M34 87h60" stroke="${C.paper}" stroke-width="5"/>${mark ? label(mark, 81, 22, C.ink) : ''}`;
    case 'tree': return `<path d="M56 104h17l-4-26H59z" fill="${C.leather}"/><circle cx="64" cy="43" r="26" fill="${C.green}"/><circle cx="43" cy="62" r="23" fill="${C.green}"/><circle cx="84" cy="64" r="24" fill="${C.green}"/><path d="M64 91V53m0 20L45 59m19 6l18-17" fill="none" stroke="${C.paper2}" stroke-width="5"/>`;
    case 'compass': return `<circle cx="64" cy="64" r="46" fill="${C.paper}"/><path d="M77 47L68 70 43 83l12-25z" fill="${accent}"/><circle cx="64" cy="64" r="7" fill="url(#gold)"/><path d="M64 18v11m0 70v11M18 64h11m70 0h11" fill="none"/>`;
    case 'bow': return `<path d="M64 57C49 22 19 31 29 53c5 11 20 13 35 4zm0 0c15-35 45-26 35-4-5 11-20 13-35 4z" fill="${C.rose}"/><circle cx="64" cy="57" r="11" fill="url(#gold)"/><path d="M58 67l-18 38 25-12 23 13-17-39" fill="${C.rose}"/>`;
    case 'bricks': return `<path d="M19 35h42v26H19zM67 35h42v26H67zM31 67h42v26H31zM79 67h30v26H79zM19 99h42v18H19zM67 99h42v18H67z" fill="${C.ember}"/>${mark ? label(mark, 87, 18, C.paper) : ''}`;
    case 'globe': return `<circle cx="64" cy="64" r="46" fill="${C.teal}"/><path d="M18 64h92M64 18c17 15 25 30 25 46s-8 31-25 46C47 95 39 80 39 64s8-31 25-46z" fill="none" stroke="${C.paper}" stroke-width="5"/>${mark ? label(mark, 73, 24, C.ink) : ''}`;
    case 'flag': return `<path d="M31 112V19" fill="none" stroke-width="8"/><path d="M35 24h66L88 47l13 23H35z" fill="${accent}"/>${mark ? label(mark, 57, mark.length > 2 ? 17 : 22, C.paper) : ''}`;
    case 'cap': return `<path d="M15 50l49-26 49 26-49 26z" fill="${accent}"/><path d="M39 64v25c13 12 37 12 50 0V64" fill="${C.paper2}"/><path d="M105 54v31" fill="none"/><circle cx="105" cy="91" r="7" fill="url(#gold)"/>`;
    case 'dove': return `<path d="M18 75c19 1 29-8 35-25 7 10 15 15 24 16 12-14 22-19 35-17-9 8-16 17-20 29 6 3 12 7 18 13-19 1-34-4-45-14-9 13-24 22-44 25 9-9 13-18 13-27z" fill="${C.paper}"/>${mark ? label(mark, 86, 22, accent) : ''}`;
    case 'butterfly': return `<path d="M59 63C52 31 24 22 20 43c-3 17 13 28 35 27-22 7-33 25-22 36 13 12 27-7 30-28zm10 0c7-32 35-41 39-20 3 17-13 28-35 27 22 7 33 25 22 36-13 12-27-7-30-28z" fill="${C.violet}"/><path d="M64 57v45M57 45c2 7 4 10 7 12m7-12c-2 7-4 10-7 12" fill="none"/>${mark ? label(mark, 88, 20, C.paper) : ''}`;
    case 'note': return `<path d="M30 17h52l17 18v76H30z" fill="${C.paper}"/><path d="M82 17v20h17M44 55h40M44 70h40M44 85h27" fill="none" stroke="${accent}" stroke-width="6"/><path d="M84 96l22-22" stroke="${C.gold}" stroke-width="8"/>`;
    case 'palette': return `<path d="M64 18c-27 0-49 19-49 43 0 26 21 48 47 49 9 0 13-6 9-13-4-7 2-14 11-14h10c16 0 23-14 19-28-6-22-24-37-47-37z" fill="${C.paper}"/><circle cx="39" cy="50" r="8" fill="${C.rose}" stroke="none"/><circle cx="60" cy="39" r="8" fill="${C.gold}" stroke="none"/><circle cx="83" cy="46" r="8" fill="${C.teal}" stroke="none"/><circle cx="37" cy="75" r="8" fill="${C.green}" stroke="none"/>${mark ? label(mark, 87, 22, C.ink) : ''}`;
    case 'wand': return `<path d="M31 103l52-52" stroke="url(#gold)" stroke-width="10"/><path d="M90 18l5 15 16 5-16 5-5 16-5-16-16-5 16-5zM31 30l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" fill="${accent}"/><path d="M39 77l13 13" fill="none"/>`;
    case 'mask': return `<path d="M20 40c26-18 62-18 88 0l-9 45c-12 22-27 29-35 29S41 107 29 85z" fill="${C.paper}"/><path d="M36 59c10-8 18-8 27 0-6 12-18 14-27 0zm29 0c10-8 18-8 27 0-6 12-18 14-27 0z" fill="${accent}"/><path d="M51 90c8 5 18 5 26 0" fill="none"/>`;
    default: return symbol('star', accent, mark);
  }
}

function achievementIcon(entry) {
  const ribbon = `<path d="M37 79l-7 35 21-11 13 14V82zM91 79l7 35-21-11-13 14V82z" fill="${entry.accent}"/>`;
  const coin = `<circle cx="64" cy="57" r="47" fill="${C.dark}"/><circle cx="64" cy="57" r="40" fill="url(#paper)" stroke="url(#gold)" stroke-width="5"/>`;
  const motif = `<g transform="translate(17 12) scale(.73)">${symbol(entry.kind, entry.accent, entry.mark || '')}</g>`;
  return svg(`Achievement: ${entry.title}`, `${ribbon}${coin}${motif}`, 'achievement');
}

function rewardIcon(entry) {
  return svg(`Reward: ${entry.title}`, symbol(entry.kind, entry.accent || C.teal, entry.mark || ''), 'reward');
}

function rewardBody(id) {
  const a = C.teal;
  const bodies = {
    coffee: `<path d="M28 47h58v48c0 12-10 19-29 19S28 107 28 95z" fill="${C.paper}"/><path d="M86 57h11c17 0 17 27 0 27H86" fill="none"/><path d="M43 37c-9-11 8-12 0-24M59 37c-9-11 8-12 0-24M75 37c-9-11 8-12 0-24" fill="none" stroke="${a}"/>`,
    chocolate: `<path d="M31 17h66v96H31z" fill="${C.leather}"/><path d="M31 49h66M31 81h66M53 17v96M75 17v96" fill="none" stroke="${C.paper2}" stroke-width="4"/><path d="M25 27l8-10v96l-8-10zM103 27l-6-10v96l6-10z" fill="${C.gold}"/>`,
    icecream: `<path d="M43 57l21 59 22-59z" fill="${C.paper2}"/><path d="M49 73l28 23M79 71L56 96" stroke="${C.leather}" stroke-width="3"/><path d="M35 52c0-13 9-23 22-24 2-12 12-19 24-16 12 3 18 14 15 26 10 4 15 13 13 24H35z" fill="${C.rose}"/>`,
    pizza: `<path d="M64 15l49 96H15z" fill="${C.gold}"/><path d="M64 15c-17 3-34 12-46 25l9 14c20-16 52-16 74 0l9-14C96 25 80 17 64 15z" fill="${C.leather}"/><circle cx="52" cy="62" r="8" fill="${C.ember}" stroke="none"/><circle cx="79" cy="72" r="9" fill="${C.ember}" stroke="none"/><circle cx="58" cy="92" r="7" fill="${C.green}" stroke="none"/>`,
    delivery: `<path d="M25 40h78v66H25z" fill="${C.paper}"/><path d="M25 40l39 29 39-29M64 69v37" fill="none" stroke="${C.leather}"/><path d="M49 24h30l8 16H41z" fill="${C.ember}"/><path d="M49 83h30" stroke="${a}" stroke-width="7"/>`,
    boba: `<path d="M33 39h62l-8 74H41z" fill="${C.paper}"/><path d="M39 70h50l-5 39H44z" fill="${C.leather}" opacity=".78"/><path d="M75 42L91 14" stroke="${C.rose}" stroke-width="8"/><path d="M28 35h72" stroke="${C.gold}" stroke-width="8"/><circle cx="51" cy="92" r="6" fill="${C.ink}" stroke="none"/><circle cx="67" cy="83" r="6" fill="${C.ink}" stroke="none"/><circle cx="78" cy="99" r="6" fill="${C.ink}" stroke="none"/>`,
    cake: `<path d="M28 53h70v55H28z" fill="${C.paper}"/><path d="M28 73c11 8 21-8 32 0s21-8 38 0" fill="none" stroke="${C.rose}" stroke-width="8"/><path d="M58 53V27h13v26" fill="${C.gold}"/><path d="M64 27c-10-8 1-17 1-17s10 9-1 17z" fill="${C.ember}"/>`,
    breakfast: `<circle cx="64" cy="69" r="44" fill="${C.paper}"/><path d="M39 81c5-24 31-31 48-16 8 8 7 22-5 27-17 8-46 6-43-11z" fill="${C.white}"/><circle cx="66" cy="78" r="13" fill="${C.gold}"/><path d="M22 22v34M14 22v18m16-18v18M105 22v34m0-34c12 9 12 22 0 29" fill="none"/>`,
    game: `<path d="M35 49h58c13 0 22 13 19 29l-5 24c-3 14-19 17-27 5L69 91H59l-11 16c-8 12-24 9-27-5l-5-24c-3-16 6-29 19-29z" fill="${a}"/><path d="M42 67v22M31 78h22" fill="none" stroke="${C.paper}"/><circle cx="87" cy="70" r="6" fill="${C.gold}" stroke="none"/><circle cx="97" cy="83" r="6" fill="${C.rose}" stroke="none"/>`,
    episode: `<path d="M19 29h90v65H19z" fill="${C.dark}"/><path d="M53 47l30 15-30 17z" fill="${a}"/><path d="M42 109h44M64 94v15" fill="none"/>`,
    movie: `<path d="M22 45h84v64H22z" fill="${C.dark}"/><path d="M22 45l12-27h84l-12 27z" fill="${C.paper}"/><path d="M42 18L30 45m34-27L52 45m34-27L74 45m34-27L96 45" fill="none" stroke="${C.ember}" stroke-width="6"/><path d="M53 66l27 13-27 14z" fill="${C.gold}"/>`,
    boardgames: `<path d="M20 50h53v53H20z" fill="${C.paper}"/><circle cx="36" cy="67" r="5" fill="${C.ink}" stroke="none"/><circle cx="57" cy="67" r="5" fill="${C.ink}" stroke="none"/><circle cx="36" cy="88" r="5" fill="${C.ink}" stroke="none"/><circle cx="57" cy="88" r="5" fill="${C.ink}" stroke="none"/><path d="M84 20c-13 0-19 12-12 22l6 8-10 44h32L90 50l6-8c7-10 1-22-12-22z" fill="${C.rose}"/>`,
    hobby: symbol('target', C.ember),
    drawing: symbol('palette', C.teal),
    bath: `<path d="M16 65h96v14c0 18-14 31-32 31H48c-18 0-32-13-32-31z" fill="${C.paper}"/><path d="M25 66V39c0-14 20-17 25-5" fill="none"/><path d="M43 82h7m10 0h7m10 0h7" stroke="${a}" stroke-width="6"/><circle cx="85" cy="38" r="12" fill="${C.teal}" opacity=".72"/><circle cx="103" cy="25" r="7" fill="${C.teal}" opacity=".55"/>`,
    sleep: `<path d="M21 69h86v35H21z" fill="${C.paper}"/><path d="M21 69c4-19 19-28 41-28 25 0 39 9 45 28" fill="${C.violet}"/><path d="M31 69c0-15 10-23 27-23v23z" fill="${C.white}"/><path d="M83 17c-14 20-3 39 18 39-10 11-30 11-41-2-13-16-6-32 23-37z" fill="${C.gold}"/>`,
    music: `<path d="M29 72V55c0-22 14-37 35-37s35 15 35 37v17" fill="none" stroke="${a}" stroke-width="10"/><path d="M21 67h20v34H29c-8 0-12-7-12-17s4-17 12-17zm86 0H87v34h12c8 0 12-7 12-17s-4-17-12-17z" fill="${C.paper}"/><path d="M87 100c-8 10-16 13-27 12" fill="none"/>`,
    spa: `<path d="M22 88h84v25H22z" fill="${C.paper}"/><path d="M31 64h66v24H31z" fill="${C.paper2}"/><path d="M42 40h44v24H42z" fill="${C.white}"/><path d="M64 39c-18-8-19-24-19-24 15 1 22 9 19 24zm0 0c18-8 19-24 19-24-15 1-22 9-19 24z" fill="${C.green}"/>`,
    walk: `<path d="M48 18c15 18 14 39 7 55l-9 20c-5 12-19 16-30 8-7-6-5-15 4-18l17-6c7-20 1-37 11-59zM82 39c13 18 12 38 6 52-4 11-2 16 10 20 12 4 19-5 12-14l-12-15c5-22 1-35-16-43z" fill="${C.leather}"/>`,
    meditation: `<circle cx="64" cy="28" r="14" fill="${C.paper}"/><path d="M64 43v36M64 57L42 73M64 57l22 16M26 105c5-20 21-31 38-31s33 11 38 31H76L64 91l-12 14z" fill="${C.violet}"/>`,
    banya: `<path d="M29 58h70l-8 54H37z" fill="${C.leather}"/><path d="M29 73h68M34 94h60" fill="none" stroke="${C.gold}"/><path d="M43 48c-12-14 8-15-1-30M64 48c-12-14 8-15-1-30M85 48c-12-14 8-15-1-30" fill="none" stroke="${a}"/>`,
    book: `<path d="M16 27c18-8 34-7 48 5v77c-14-12-30-13-48-5zM112 27c-18-8-34-7-48 5v77c14-12 30-13 48-5z" fill="${C.paper}"/><path d="M64 32v77" fill="none"/><path d="M28 48h23M28 62h23m26-14h23M77 62h23" stroke="${a}" stroke-width="4"/>`,
    'small-purchase': `<path d="M27 45h74l8 66H19z" fill="${C.paper}"/><path d="M43 49c0-22 9-33 21-33s21 11 21 33" fill="none"/><circle cx="64" cy="78" r="17" fill="url(#gold)"/>${label('S', 87, 24, C.ink)}`,
    clothes: `<path d="M24 86c17-4 29-22 34-55l16 3c2 25 13 39 33 43 12 2 14 17 1 22-27 10-56 10-84 2-12-4-12-12 0-15z" fill="${C.teal}"/><path d="M54 55h24M44 73h43" fill="none" stroke="${C.paper}" stroke-width="5"/>`,
    gadget: `<path d="M31 19h66v90H31z" fill="${C.dark}"/><path d="M39 31h50v61H39z" fill="${a}"/><circle cx="64" cy="100" r="5" fill="${C.gold}" stroke="none"/><path d="M48 53h32M48 67h22" stroke="${C.paper}" stroke-width="5"/>`,
    decor: `<path d="M18 25h92v78H18z" fill="${C.paper}"/><circle cx="85" cy="47" r="12" fill="${C.gold}" stroke="none"/><path d="M27 91l25-31 17 17 12-13 20 27z" fill="${C.teal}"/><path d="M34 112h60" stroke="${C.leather}" stroke-width="8"/>`,
    'weekend-trip': `<path d="M27 38h74v73H27z" fill="${C.teal}"/><path d="M45 38V24h38v14M47 57v38M81 57v38" fill="none" stroke="${C.paper}"/><path d="M18 59h18v30H18zm74 0h18v30H92z" fill="url(#gold)"/>`,
    event: `<path d="M19 37h90v64H19z" fill="${C.rose}"/><path d="M36 37c0 8-5 13-17 13m90 0c-12 0-17-5-17-13M36 101c0-8-5-13-17-13m90 0c-12 0-17 5-17 13" fill="none"/><path d="M64 50l7 14 16 3-12 11 3 16-14-8-14 8 3-16-12-11 16-3z" fill="${C.gold}"/>`,
    concert: `<path d="M42 19v67c0 17-28 23-32 7-3-12 13-23 27-19V29l71-13v58c0 17-28 23-32 7-3-12 13-23 27-19V18z" fill="${C.violet}"/><path d="M42 45l66-12" stroke="${C.paper}" stroke-width="6"/>`,
    restaurant: `<circle cx="64" cy="68" r="37" fill="${C.paper}"/><circle cx="64" cy="68" r="21" fill="${C.gold}" opacity=".7"/><path d="M17 21v83M10 21v26m14-26v26M112 21c-13 12-14 31-2 43v40" fill="none" stroke-width="7"/>`,
    course: `<path d="M18 31h92v65H18z" fill="${C.dark}"/><path d="M28 41h72v45H28z" fill="${a}"/><path d="M12 106h104" stroke="${C.steel}" stroke-width="9"/><path d="M42 56l22-12 22 12-22 12zM51 64v13c8 6 18 6 26 0V64" fill="${C.gold}"/>`,
    wishlist: symbol('gift', C.violet),
    vacation: `<path d="M18 96h92" stroke="${a}" stroke-width="10"/><path d="M35 94c2-31 17-50 42-61" fill="none" stroke="${C.leather}" stroke-width="9"/><path d="M72 36c-19-1-31-8-37-22 18-1 31 5 37 22zm3 1c5-18 17-28 35-30-3 17-15 28-35 30zm-2 0c18 3 29 13 33 29-17 1-28-9-33-29z" fill="${C.green}"/><circle cx="27" cy="28" r="14" fill="${C.gold}"/>`,
  };
  return bodies[id];
}

function gearIcon(entry) {
  const rarity = { common: C.steel2, rare: C.teal, epic: C.violet, legendary: C.gold }[entry.rarity];
  const glint = entry.rarity === 'legendary' ? `<path d="M105 18l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="${C.gold}" stroke-width="3"/>` : '';
  return svg(`Gear: ${entry.title}`, `${gearBody(entry.id, rarity)}${glint}`, `gear gear-${entry.rarity}`);
}

function gearBody(id, accent) {
  if (id.startsWith('w')) {
    const dagger = id === 'w2b';
    const blade = dagger
      ? `<path d="M88 22l16 16-43 46-20 3 6-19z" fill="url(#steel)"/>`
      : `<path d="M92 14l18 18-53 59-19 3 6-19z" fill="url(#steel)"/>`;
    const rune = id === 'w1' ? `<path d="M72 39l10 10" stroke="${C.paper}"/>`
      : id === 'w2' ? `<path d="M69 42l12 2-3 12 12 2" fill="none" stroke="${accent}"/>`
      : id === 'w3' ? `<path d="M61 51c12-9 23-7 31 5" fill="none" stroke="${accent}"/>`
      : id === 'w4' ? `<path d="M64 48l13-20 1 17 15-3-19 19" fill="${C.gold}"/>`
      : `<circle cx="77" cy="50" r="7" fill="${C.gold}"/>`;
    return `${blade}${rune}<path d="M38 84l17 17M30 98l13 13" stroke="${accent}" stroke-width="10"/><path d="M52 89l-11-11 10-10 11 11z" fill="url(#gold)"/>`;
  }
  if (id.startsWith('a')) {
    if (id === 'a2') return `<path d="M64 14l43 17v31c0 27-17 43-43 54-26-11-43-27-43-54V31z" fill="${accent}"/><path d="M64 28v68M37 53h54" fill="none" stroke="${C.paper}" stroke-width="7"/>`;
    if (id === 'a2b') return `<path d="M44 19l20 14 20-14 25 22-15 25-10-8v54H44V58l-10 8-15-25z" fill="${accent}"/><path d="M64 33v79M44 59l20 15 20-15" fill="none" stroke="${C.paper}" stroke-width="6"/>`;
    return `<path d="M45 19l19 14 19-14 25 24-16 22-8-7v53H44V58l-8 7-16-22z" fill="${accent}"/><path d="M64 33v78M44 61h40" fill="none" stroke="${C.paper}" stroke-width="6"/><path d="M48 78l16 12 16-12" fill="none" stroke="${id === 'a4' ? C.gold : C.ink}" stroke-width="6"/>`;
  }
  const pendant = id === 'm1' ? `<path d="M64 43l22 24-22 41-22-41z" fill="url(#gold)"/>`
    : id === 'm2' ? `<path d="M42 52c13-7 28-7 44 0v48c-16-7-31-7-44 0z" fill="${accent}"/><path d="M64 55v42" fill="none" stroke="${C.paper}"/>`
    : id === 'm3' ? `<path d="M27 75c19-25 55-25 74 0-19 25-55 25-74 0z" fill="${accent}"/><circle cx="64" cy="75" r="16" fill="${C.paper}"/><circle cx="64" cy="75" r="7" fill="${C.ink}" stroke="none"/>`
    : id === 'm4' ? `<path d="M64 108C22 82 26 43 47 38c12-3 17 4 17 12 0-8 5-15 17-12 21 5 25 44-17 70z" fill="${C.ember}"/><path d="M44 72h14l7-14 8 29 7-15h13" fill="none" stroke="${C.paper}"/>`
    : `<path d="M64 42l31 32-31 34-31-34z" fill="${accent}"/><path d="M48 79l16-25 16 25z" fill="${C.paper}"/>`;
  return `<path d="M31 18c6 24 18 35 33 35s27-11 33-35" fill="none" stroke="${C.paper2}" stroke-width="8"/>${pendant}`;
}

const achievements = [
  ['first_quest','Первый шаг','blade',C.teal], ['quests_50','Полста квестов','trophy',C.gold,'50'],
  ['first_habit','Росток привычки','sprout',C.green], ['streak_7','Неделя подряд','flame',C.ember,'7'],
  ['streak_30','Месяц подряд','flame',C.ember,'30'], ['level_5','Уровень 5','star',C.gold,'5'],
  ['level_10','Уровень 10','star',C.gold,'10'], ['xp_1000','Тысяча опыта','gem',C.violet,'1K'],
  ['first_goal','Цель взята','target',C.teal], ['first_reward','Первая награда','gift',C.rose],
  ['gold_500','Богатей','coin',C.gold,'500'], ['skills_all3','Разносторонний','books',C.teal,'3'],
  ['reporter_3','Баг-хантер','bug',C.ember,'3'], ['cofounder_10','Страж Врат','shield',C.violet,'10'],
  ['early_bird','Ранняя пташка','sunrise',C.gold], ['night_owl','Сова','owl',C.violet],
  ['weekend_warrior','Воин выходных','shield',C.teal,'2'], ['new_year','Новогодний рывок','spark',C.ember],
  ['full_spectrum','Полный спектр','rainbow',C.rose], ['marathon_day','Марафон дня','mountain',C.teal],
  ['balanced','Десятиборец','scales',C.teal], ['focus_10h','Глубоководный','wave',C.teal,'10h'],
  ['capstone_first','Вершина ветви','crown',C.gold], ['tree_full','Древо в цвету','tree',C.green],
  ['path_chosen','Сторона выбрана','compass',C.violet], ['wear_first','Первый наряд','bow',C.rose],
  ['gear_full','Полный доспех','shield',C.gold], ['goals_10','Десять вершин','mountain',C.teal,'10'],
  ['habit_100','Кирпич за кирпичом','bricks',C.ember,'100'], ['sphere_lvl10','Глубина сферы','globe',C.teal,'10'],
  ['allspheres_5','Широта жизни','globe',C.green,'5'], ['quests_100','Сотня квестов','flag',C.ember,'100'],
  ['quests_250','Легион дел','crossed-blades',C.gold,'250'], ['xp_5000','Пять тысяч','gem',C.violet,'5K'],
  ['xp_25000','Титан опыта','gem',C.gold,'25K'], ['streak_100','Сто дней подряд','flame',C.violet,'100'],
  ['level_20','Двадцатый','star',C.teal,'20'], ['level_30','Тридцатый','crown',C.gold,'30'],
  ['skill_master','Мастер сферы','cap',C.violet], ['skills_all5','Эрудит','books',C.green,'5'],
  ['mission_set','Полярная звезда','compass',C.gold], ['balanced_90','Идеальный баланс','scales',C.gold,'90'],
  ['clean_7','Чистая неделя','dove',C.teal,'7'], ['clean_30','Чистый месяц','butterfly',C.violet,'30'],
  ['first_note','Первая мысль','note',C.teal], ['collector_5','Коллекционер','palette',C.rose,'5'],
  ['legendary_drop','Легендарная коллекция','star',C.gold], ['avatar_custom','Свой облик','mask',C.violet],
].map(([id,title,kind,accent,mark]) => ({ id,title,kind,accent,mark }));

const rewards = [
  ['coffee','Кофе'],['chocolate','Шоколад'],['icecream','Мороженое'],['pizza','Пицца'],['delivery','Доставка'],['boba','Бабл-ти'],['cake','Торт'],['breakfast','Завтрак'],
  ['game','Игры'],['episode','Серия'],['movie','Кино'],['boardgames','Настолки'],['hobby','Хобби'],['drawing','Рисование'],
  ['bath','Ванна'],['sleep','Сон'],['music','Музыка'],['spa','Спа'],['walk','Прогулка'],['meditation','Медитация'],['banya','Баня'],
  ['book','Книга'],['small-purchase','Маленькая покупка'],['clothes','Одежда'],['gadget','Гаджет'],['decor','Декор'],
  ['weekend-trip','Поездка'],['event','Событие'],['concert','Концерт'],['restaurant','Ресторан'],['course','Курс'],['wishlist','Хотелка'],['vacation','Отпуск'],
].map(([id,title]) => ({ id,title }));

const gear = [
  ['w1','Тренировочный клинок','common'],['w2','Клинок Фокуса','rare'],['w3','Катана Бесконечности','epic'],
  ['a1','Лёгкая броня','common'],['a2','Эгида Стойкости','rare'],['a3','Латы Несокрушимости','epic'],
  ['m1','Медный амулет','common'],['m2','Амулет Знаний','rare'],['m3','Реликвия Шести Глаз','epic'],
  ['w2b','Кинжал Наживы','rare'],['a2b','Мантия Потока','rare'],['m2b','Кулон Испытаний','rare'],
  ['w4','Клинок Рассветной Клятвы','legendary'],['a4','Доспех Несгибаемого','legendary'],['m4','Сердце Десятиборца','legendary'],
].map(([id,title,rarity]) => ({ id,title,rarity }));

for (const folder of ['achievements', 'rewards', 'gear']) fs.mkdirSync(path.join(OUT, folder), { recursive: true });

for (const entry of achievements) fs.writeFileSync(path.join(OUT, 'achievements', `${entry.id}.svg`), achievementIcon(entry));
for (const entry of rewards) fs.writeFileSync(path.join(OUT, 'rewards', `${entry.id}.svg`), svg(`Reward: ${entry.title}`, rewardBody(entry.id), 'reward'));
for (const entry of gear) fs.writeFileSync(path.join(OUT, 'gear', `${entry.id}.svg`), gearIcon(entry));

console.log(`Economy icons v2: ${achievements.length} achievements, ${rewards.length} rewards, ${gear.length} gear items.`);
