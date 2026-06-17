'use strict';
// Генератор иконок приложения (PWA): фирменный знак вопроса «?» Альберта (чёрный на светлом).
// Zero-dep: рисуем пиксельно, кодируем PNG через zlib. Запуск: node scripts/gen-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [245, 245, 247];     // светлый фон #f5f5f7 (как бренд: чёрное на белом)
const INK = [22, 22, 28];       // чернильно-чёрный «?»

// Полилиния знака вопроса в системе 240×240 (петля сверху + ножка), затем точка.
const QMARK = [
  [82, 78], [88, 62], [99, 55], [110, 50], [120, 48],
  [138, 49], [150, 57], [157, 69], [160, 84],
  [159, 98], [152, 108], [142, 117], [130, 124],
  [124, 128], [120, 134], [118, 142], [118, 150],
];
const DOT = [118, 186], DOT_R = 12, STROKE = 21; // в 240-координатах

function lerp(a, b, t) { return a + (b - a) * t; }
function over(dst, src, a) { return [lerp(dst[0], src[0], a), lerp(dst[1], src[1], a), lerp(dst[2], src[2], a)]; }
// расстояние от точки до отрезка
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function distPolyline(px, py, pts) { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return d; }

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
  const S = size, k = S / 240;          // координаты заданы в 240-системе
  const rgba = Buffer.alloc(S * S * 4);
  const corner = S * 0.225;             // скругление (≈54 в 240)
  const pts = QMARK.map(([x, y]) => [x * k, y * k]);
  const dot = [DOT[0] * k, DOT[1] * k], dotR = DOT_R * k, half = STROKE * k / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const qx = Math.max(corner - x, x - (S - corner), 0);
      const qy = Math.max(corner - y, y - (S - corner), 0);
      const i = (y * S + x) * 4;
      if (Math.hypot(qx, qy) > corner) { rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0; continue; } // вне скруглённого квадрата
      let col = BG;
      const d = Math.min(distPolyline(x, y, pts), Math.hypot(x - dot[0], y - dot[1]) - (dotR - half)); // «?» + точка
      if (d < half + 0.75) { const aa = Math.max(0, Math.min(1, half + 0.5 - d)); col = over(col, INK, aa); } // сглаживание края
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
