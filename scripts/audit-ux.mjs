#!/usr/bin/env node
/* Аудит интерфейса: ищет классы проблем, которые видит пользователь, а не тесты.
 *
 * Повод — просьба Альберта «все ошибки, в том числе кривые состояния интерфейса или
 * какие-то нелогичные/неудобные вещи». Такие вещи не ловятся юнит-тестами: там всё
 * зелёное, а человек упирается в системное окно на чужом языке или в тупик после сбоя.
 *
 * Отчёт печатается в консоль и складывается в docs/audit/ux-<дата>.md.
 * Скрипт ничего не чинит и ничего не меняет — только находит.
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const LINES = APP.split('\n');
const CYR = /[А-Яа-яЁё]/;

const findings = [];
const add = (kind, line, text, why) => findings.push({ kind, line, text: text.trim().slice(0, 120), why });

// Строка считается «в коде», а не в комментарии, если до неё на строке нет // и она не в /* */.
const commentRanges = [];
{
  const re = /\/\*[\s\S]*?\*\//g; let m;
  while ((m = re.exec(APP))) commentRanges.push([m.index, m.index + m[0].length]);
}
const offsets = [];
{ let o = 0; for (const l of LINES) { offsets.push(o); o += l.length + 1; } }
const inBlockComment = (lineIdx) => {
  const start = offsets[lineIdx];
  return commentRanges.some(([a, b]) => start >= a && start <= b);
};
const codeOf = (lineIdx) => {
  if (inBlockComment(lineIdx)) return '';
  const l = LINES[lineIdx];
  const c = l.indexOf('//');
  // Грубо, но достаточно: // внутри строки-URL встречается, поэтому режем только если
  // перед ним нет открытой кавычки на этой же строке.
  if (c >= 0 && !/['"`].*\/\//.test(l.slice(0, c + 2))) return l.slice(0, c);
  return l;
};

// ── 1. Пользовательский текст мимо t() ───────────────────────────────────────
// toast/confirm/alert с русским литералом: в немецком интерфейсе покажется по-русски.
LINES.forEach((_, i) => {
  const code = codeOf(i);
  const m = code.match(/\b(toast|confirm|alert)\(\s*(['"])((?:(?!\2).)*)\2/);
  if (m && CYR.test(m[3])) add('i18n', i + 1, m[0], `${m[1]}() с русским литералом — не пройдёт через t()`);
  // Шаблонная строка с кириллицей внутри toast/confirm тоже мимо словаря.
  const tm = code.match(/\b(toast|confirm)\(\s*`([^`]*)`/);
  if (tm && CYR.test(tm[2]) && !tm[2].includes('${t(')) add('i18n', i + 1, tm[0], `${tm[1]}() с русским шаблоном без t()`);
});

// ── 2. Тупик после сбоя ──────────────────────────────────────────────────────
// Место, где кнопка выключается перед запросом, но включается не во всех ветках.
// Окно — ДО КОНЦА ФУНКЦИИ, а не фиксированные 30 строк: в двух местах включение
// стоит через 55 строк, и короткое окно давало ложную тревогу.
function functionEnd(startLine) {
  let depth = 0, seen = false;
  for (let i = startLine; i < LINES.length; i += 1) {
    for (const ch of LINES[i]) {
      if (ch === '{') { depth += 1; seen = true; }
      else if (ch === '}') { depth -= 1; if (seen && depth <= 0) return i; }
    }
    if (i - startLine > 400) break;
  }
  return Math.min(startLine + 60, LINES.length - 1);
}
function functionStart(fromLine) {
  for (let i = fromLine; i >= 0 && fromLine - i < 400; i -= 1) {
    if (/^(async )?function |^\s{0,2}(async )?function /.test(LINES[i])) return i;
  }
  return Math.max(0, fromLine - 60);
}
LINES.forEach((_, i) => {
  const code = codeOf(i);
  if (!/\.disabled\s*=\s*true/.test(code)) return;
  const start = functionStart(i);
  const window_ = LINES.slice(i, functionEnd(start)).join('\n');
  const reenabled = /disabled\s*=\s*false/.test(window_) || /finally\s*\{/.test(window_);
  if (!reenabled) add('deadend', i + 1, code, 'кнопка выключается и до конца функции не включается обратно');
});

// ── 3. Сбой без возможности повторить ────────────────────────────────────────
LINES.forEach((_, i) => {
  const code = codeOf(i);
  if (!/Сетевая ошибка|Не удалось|не удалось/.test(code)) return;
  if (!/textContent|innerHTML|toast\(/.test(code)) return;
  const window_ = LINES.slice(Math.max(0, i - 12), Math.min(i + 12, LINES.length)).join('\n');
  const canRetry = /retry|Повтор|повтор|hidden = false/.test(window_);
  if (!canRetry) add('noretry', i + 1, code, 'сообщение о сбое без видимого способа повторить');
});

// ── 4. Пустой catch — ошибка исчезает бесследно ──────────────────────────────
LINES.forEach((_, i) => {
  const code = codeOf(i);
  if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(code)) add('silent', i + 1, code, 'пустой catch: сбой не виден ни пользователю, ни в консоли');
});

// ── 5. Системные окна вместо интерфейса ──────────────────────────────────────
LINES.forEach((_, i) => {
  const code = codeOf(i);
  if (/\b(confirm|alert)\(/.test(code)) add('nativedialog', i + 1, code, 'системное окно браузера: не оформлено, не переводится, на телефоне выглядит чужим');
});

// ── 6. Необработанный статус ответа ──────────────────────────────────────────
LINES.forEach((_, i) => {
  const code = codeOf(i);
  if (!/await fetch\(|fetch\(/.test(code)) return;
  const window_ = LINES.slice(i, Math.min(i + 8, LINES.length)).join('\n');
  if (!/\.ok|status|catch|then\(/.test(window_)) add('nostatus', i + 1, code, 'ответ используется без проверки .ok/status');
});

// ── отчёт ────────────────────────────────────────────────────────────────────
const KIND_TITLE = {
  i18n: 'Текст мимо переводчика (немец увидит русский)',
  nativedialog: 'Системные окна браузера вместо интерфейса',
  deadend: 'Кнопка может остаться выключенной после сбоя',
  noretry: 'Сообщение о сбое без способа повторить',
  silent: 'Пустой catch — сбой исчезает бесследно',
  nostatus: 'Ответ сервера используется без проверки статуса',
};
// Честность про точность: два класса перестраховываются и требуют ручной разборки.
// Скрывать это нельзя — отчёт, которому нельзя верить, хуже отсутствия отчёта.
const KIND_NOTE = {
  i18n: 'Точный класс: каждое место — реальный русский текст в нерусском интерфейсе.',
  deadend: '⚠️ ПЕРЕСТРАХОВЫВАЕТСЯ. Границы функции определяются грубо, вложенные стрелки ломают разбор. Проверять руками — часть мест включает кнопку в `finally` или в дальней ветке.',
  noretry: '⚠️ Требует разборки: часть сообщений живёт в формах, где повтор — это просто нажать кнопку ещё раз.',
  silent: '⚠️ Требует разборки: у декоративных вещей (звук, анимация, риг) пустой catch намеренный — сбой там не должен ломать рендер. Смотреть только те, где за catch стоит пользовательское действие.',
  nostatus: 'Проверять руками: часть мест ловит ошибку в теле ответа (`d.error`), а не по статусу.',
};
const ORDER = ['i18n', 'deadend', 'noretry', 'nativedialog', 'silent', 'nostatus'];

const byKind = {};
for (const f of findings) (byKind[f.kind] = byKind[f.kind] || []).push(f);

let md = `# Аудит интерфейса — ${new Date().toISOString().slice(0, 10)}\n\n`;
md += `Найдено ${findings.length} мест в \`public/app.js\`. Скрипт: \`scripts/audit-ux.mjs\`.\n\n`;
md += '| Класс | Мест |\n|---|---|\n';
for (const k of ORDER) if (byKind[k]) md += `| ${KIND_TITLE[k]} | ${byKind[k].length} |\n`;
md += '\n';
for (const k of ORDER) {
  if (!byKind[k]) continue;
  md += `## ${KIND_TITLE[k]} — ${byKind[k].length}\n\n`;
  if (KIND_NOTE[k]) md += `> ${KIND_NOTE[k]}\n\n`;
  for (const f of byKind[k]) md += `- \`app.js:${f.line}\` — ${f.why}\n  \`\`\`js\n  ${f.text}\n  \`\`\`\n`;
  md += '\n';
}

const outDir = path.join(ROOT, 'docs/audit');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `ux-${new Date().toISOString().slice(0, 10)}.md`);
fs.writeFileSync(outFile, md);

console.log(`Найдено ${findings.length} мест:\n`);
for (const k of ORDER) if (byKind[k]) console.log(`  ${String(byKind[k].length).padStart(4)}  ${KIND_TITLE[k]}`);
console.log(`\nОтчёт: ${path.relative(ROOT, outFile)}`);
