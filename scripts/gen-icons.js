'use strict';
// Генератор иконок приложения (PWA): скрещённые мечи на тёмно-синем — бренд Gojo ⚔️.
// Zero-dep: рисуем пиксельно, кодируем PNG через zlib. Запуск: node scripts/gen-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [15, 19, 32];        // #0f1320
const BLADE_TOP = [157, 180, 255];
const BLADE_BOT = [108, 140, 255]; // #6c8cff
const GLOW = [108, 140, 255];
const HANDLE = [224, 162, 62];  // золото рукоять

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
function over(dst, src, a) { return [lerp(dst[0], src[0], a), lerp(dst[1], src[1], a), lerp(dst[2], src[2], a)]; }
// расстояние от точки до отрезка
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function renderIcon(size) {
  const S = size, cx = S / 2, cy = S / 2;
  const rgba = Buffer.alloc(S * S * 4);
  const corner = S * 0.22;          // скругление
  const bladeW = S * 0.085;         // толщина клинка
  const m = S * 0.18;               // отступ концов мечей
  // два скрещённых клинка (диагонали)
  const swords = [
    [m, S - m, S - m, m],           // ↗
    [m, m, S - m, S - m],           // ↘
  ];
  const pommels = [[m, S - m], [S - m, m], [m, m], [S - m, S - m]]; // рукояти-навершия
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // маска скруглённого квадрата
      const qx = Math.max(corner - x, x - (S - corner), 0);
      const qy = Math.max(corner - y, y - (S - corner), 0);
      const outside = Math.hypot(qx, qy) > corner;
      const i = (y * S + x) * 4;
      if (outside) { rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0; continue; }
      // фон + центральное свечение
      const dC = Math.hypot(x - cx, y - cy) / (S * 0.5);
      let col = over(BG, GLOW, Math.max(0, 0.22 * (1 - dC)));
      // клинки
      let bd = Infinity; for (const s of swords) bd = Math.min(bd, segDist(x, y, s[0], s[1], s[2], s[3]));
      const edge = bladeW / 2;
      if (bd < edge + 1) {
        const aa = Math.max(0, Math.min(1, edge + 0.5 - bd)); // сглаживание края
        col = over(col, mix(BLADE_TOP, BLADE_BOT, y / S), aa);
      }
      // навершия рукоятей (золото)
      for (const p of pommels) { const pd = Math.hypot(x - p[0], y - p[1]); if (pd < bladeW * 0.75) { const aa = Math.max(0, Math.min(1, bladeW * 0.75 + 0.5 - pd)); col = over(col, HANDLE, aa); } }
      rgba[i] = Math.round(col[0]); rgba[i + 1] = Math.round(col[1]); rgba[i + 2] = Math.round(col[2]); rgba[i + 3] = 255;
    }
  }
  return encodePNG(S, S, rgba);
}

const outDir = path.join(__dirname, '..', 'public');
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(outDir, name), renderIcon(size));
  console.log('wrote', name, size + 'x' + size);
}
