'use strict';

// Life-RPG — self-hosted gamified life planner. Zero npm dependencies (Node stdlib only).
// Serves static frontend from ./public, reads/writes JSON files in ./data.
// Local: listens on 127.0.0.1:4317. Cloud (Railway/Render/etc): auto-detects via PORT env → 0.0.0.0.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
// DATA_DIR can be overridden for cloud volumes: DATA_DIR=/data node server.js
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4317;
// Auto-switch to 0.0.0.0 on cloud platforms (they set PORT). Override with HOST env var.
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers));
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}

function safeName(name) {
  return /^[a-z0-9_-]+$/.test(name) ? name : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('payload too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath, headOnly) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, headOnly ? '' : buf, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
}

const server = http.createServer(async (req, res) => {
  const u = req.url || '/';

  // --- API данных: /api/data/<name> ---
  const m = u.match(/^\/api\/data\/([^/?]+)/);
  if (m) {
    const name = safeName(m[1].replace(/\.json$/, ''));
    if (!name) return sendJson(res, 400, { error: 'bad name' });
    const file = path.join(DATA_DIR, name + '.json');

    if (req.method === 'GET') {
      fs.readFile(file, 'utf8', (err, txt) => {
        if (err) return sendJson(res, 404, { error: 'not found' });
        send(res, 200, txt, { 'Content-Type': MIME['.json'] });
      });
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body); // валидируем, что это корректный JSON
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendJson(res, 400, { error: String(e.message || e) });
      }
    }

    return sendJson(res, 405, { error: 'method not allowed' });
  }

  // --- OPTIONS (preflight / health) ---
  if (req.method === 'OPTIONS') return send(res, 204, '');

  // --- Статика (GET / HEAD) ---
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, u, req.method === 'HEAD');
  return send(res, 405, 'Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ⚔️  Life-RPG запущен:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  📁  Данные:            ${DATA_DIR}`);
  if (HOST === '0.0.0.0') console.log('  📱  Сеть включена — открой с телефона по IP мака.');
  console.log('');
});
