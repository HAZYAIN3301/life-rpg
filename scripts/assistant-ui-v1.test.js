'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const between = (from, to) => app.slice(app.indexOf(from), app.indexOf(to, app.indexOf(from)));

test('published safe-action and wake modules load before app and live in the shell', () => {
  for (const file of ['assistant-actions-v1.js', 'assistant-wake-v1.js']) {
    assert.ok(index.includes(`src="${file}`), `${file} missing from index`);
    assert.ok(index.indexOf(`src="${file}`) < index.indexOf('src="app.js'), `${file} must load before app`);
    assert.ok(sw.includes(`'${file}'`), `${file} missing from SW shell`);
  }
  assert.match(sw, /const CACHE = 'satoru-v219'/);
});

test('model output is parsed by the one published whitelist, not the legacy parser', () => {
  const parse = between('function parseChatActions', 'function chatActionLabel');
  assert.match(parse, /AssistantActionsV1/);
  assert.match(parse, /fromReply\(text, assistantActionContext\(\)\)/);
  assert.doesNotMatch(parse, /JSON\.parse|\['quest', 'habit', 'goal'\]/);
});

test('executor revalidates owned target ids immediately before mutation', () => {
  const apply = between('async function applyChatActions', 'async function sendChat');
  assert.match(apply, /contract\.validate\(\{ kind: action\.kind, targetId: action\.targetId/);
  assert.match(apply, /assistantActionContext\(\)/);
  assert.match(apply, /goalDataCommit\(nextGoals, nextTasks\)/);
  assert.match(apply, /habitDataCommit\(\{ habits: nextHabits \},\s*\(\) => \{ State\.habits = nextHabits; \}\)/);
  assert.match(apply, /await completeTask\(task, null\)/);
});

test('executor has no destructive/account/privacy branch', () => {
  const apply = between('async function applyChatActions', 'async function sendChat');
  assert.doesNotMatch(apply, /delete|destroy|remove|reset|account|password|privacy|admin|grant_pro/i);
  for (const allowed of ['goal_pause', 'goal_resume', 'goal_archive', 'quest_reschedule', 'quest_done', 'habit_pause', 'habit_resume']) assert.ok(apply.includes(allowed));
});

test('every action remains a visible checked preview until a human applies it', () => {
  assert.match(app, /data-action="chat-actions-apply"/);
  assert.match(app, /type="checkbox" data-ca data-index=/);
  assert.match(app, /if \(!checks\[index\]/);
  assert.match(app, /if \(!checks\.some\(Boolean\)\) return/);
  assert.doesNotMatch(between('async function sendChat', 'function captureBar'), /applyChatActions\(/);
});

test('write failure stays retryable and does not report success', () => {
  const apply = between('async function applyChatActions', 'async function sendChat');
  assert.match(apply, /settle\(index, 'failed'\)/);
  assert.match(app, /Повторить неприменённое/);
  assert.match(app, /Не сохранено — можно повторить/);
});

test('thinking state has meaningful live text, motion and a static reduced-motion state', () => {
  assert.match(app, /id="chat-msgs" class="chat-msgs" role="log" aria-live="polite"/);
  assert.match(app, /class="chat-msg ai typing"[^>]*><span>\$\{t\('Тень формулирует ответ'\)\}/);
  assert.doesNotMatch(app, /class="chat-msg ai typing"[^>]*role="status"/, 'the live log must not contain a competing nested live region');
  assert.equal((app.match(/<i><\/i>/g) || []).length >= 3, true);
  assert.match(css, /@keyframes assistantThinkingDot/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.typing-dots i \{ animation: none/);
});

test('helper is a labelled modal with close, backdrop, Escape, trap and focus return', () => {
  assert.match(app, /role="dialog" aria-modal="true" aria-labelledby="helper-title"/);
  assert.match(app, /event\.target === ov\) closeHelperChat/);
  assert.match(app, /event\.key === 'Escape'[\s\S]*closeHelperChat/);
  assert.match(app, /pathChoiceFocusable\(modal\)/);
  assert.match(app, /function helperReturnFocusTarget/);
  assert.match(app, /modal && modal\._returnFocus/);
  assert.match(app, /\[data-action="mobile-nav-more"\]/, 'detached mobile-sheet opener must fall back to persistent More');
  assert.match(app, /node\.getClientRects\(\)\.length/, 'focus fallback must be visible');
  assert.match(app, /document\.getElementById\('app'\)\?\.setAttribute\('inert'/);
});

test('wake word only fills a draft; it never sends or applies', () => {
  const wake = between('function startAssistantWake', 'function toggleAssistantWake');
  assert.match(wake, /parseTranscript/);
  assert.match(wake, /input\.value = parsed\.command/);
  assert.doesNotMatch(wake, /sendChat|applyChatActions|requestSubmit|\.submit\(/);
  assert.match(app, /команда появится как черновик и не отправится сама/);
});

test('wake listening is explicit, visible and stops while the document is hidden', () => {
  assert.match(app, /data-action="assistant-wake-toggle" aria-pressed=/);
  assert.match(app, /_assistantWakeArmed = false/);
  assert.match(app, /if \(document\.hidden\) stopAssistantWake\(\)/);
  assert.match(css, /#ai-fab\.is-wake-listening/);
});

test('local plan access requires a user-picked bounded text file', () => {
  assert.match(app, /id="chat-plan-file" type="file"/);
  assert.match(app, /\['txt', 'md', 'markdown', 'json', 'csv'\]/);
  assert.match(app, /file\.size > 20 \* 1024/);
  assert.match(app, /ВЫБРАННЫЙ ФАЙЛ/);
  assert.match(app, /Ты не видишь произвольные файлы на компьютере/);
  assert.match(server, /String\(b\.system \|\| ''\)\.slice\(0, 48000\)/, 'server must not silently cut the selected plan at the legacy 12k ceiling');
});

test('real Satoru plan context carries exact owned ids and hierarchy', () => {
  const context = between('function assistantObjectContext', 'function assistantFileContext');
  assert.match(context, /goal id=/);
  assert.match(context, /quest id=/);
  assert.match(context, /habit id=/);
  assert.match(context, /parentId=/);
  assert.match(context, /horizon=/);
  assert.match(app, /Для планирования сначала назови конкретную цель\/квест/);
});

test('assistant supports one reviewed bulk goal action and hides provider contract leakage', () => {
  const apply = between('async function applyChatActions', 'async function sendChat');
  assert.match(apply, /goal_pause_many/);
  assert.match(apply, /goal_archive_many/);
  assert.match(apply, /affected\.length !== wanted\.size/);
  assert.match(apply, /goalDataCommit\(nextGoals, nextTasks\)/);
  const send = between('async function sendChat', 'function captureBar');
  assert.match(send, /chat-contract-leak-blocked/);
  assert.doesNotMatch(send, /parsed\.clean \|\| d\.text/);
});

test('provider UTF-8 is decoded once after complete response buffering', () => {
  const post = server.slice(server.indexOf('function httpsPostJson'), server.indexOf('function resolveAiProvider'));
  assert.match(post, /const chunks = \[\]/);
  assert.match(post, /Buffer\.concat\(chunks\)\.toString\('utf8'\)/);
  assert.doesNotMatch(post, /data \+=/);
});

test('new assistant copy has complete EN DE UK ES rows with no duplicates', () => {
  const keys = ['Тень формулирует ответ', 'Голосовой вызов', 'Включить «Сатору» для этой вкладки', 'План из файла', 'Подключить ИИ', 'Помощник работает на твоём ИИ-ключе. Не хочешь платить? Возьми бесплатный ключ Google Gemini или Groq за 2 минуты (без карты) — в Настройках есть пошаговый гид.', 'Приостановить цель', 'Возобновить цель', 'Архивировать цель', 'Перенести квест', 'Отметить квест выполненным', 'Приостановить привычку', 'Возобновить привычку', 'Действие заблокировано'];
  for (const key of keys) {
    const encoded = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = app.match(new RegExp(`^\\s*'${encoded}':\\s*\\{[^\\n]*en:\\s*'[^']+'[^\\n]*de:\\s*'[^']+'[^\\n]*uk:\\s*'[^']+'[^\\n]*es:\\s*'[^']+'`, 'gm')) || [];
    assert.equal(matches.length, 1, `${key}: incomplete or duplicate locale row`);
  }
});

test('mobile helper controls keep the 42px floor and readable text entry', () => {
  assert.match(css, /#helper-modal :is\(button, input, label\.drc-row\) \{ min-block-size: var\(--touch-min\)/);
  assert.match(css, /#helper-modal \.chat-form input \{ font-size: max\(16px, var\(--type-control\)\)/);
  assert.match(css, /#helper-modal :is\(button, input\):focus-visible/);
});
