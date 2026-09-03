'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');

function between(start, end) {
  const from = APP.indexOf(start);
  assert.notEqual(from, -1, `missing start: ${start}`);
  const to = APP.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end: ${end}`);
  return APP.slice(from, to);
}

test('English is the first-run default without changing legacy account fallback', () => {
  assert.match(APP, /const APP_LANGS = Object\.freeze\(\['en', 'ru', 'de', 'uk', 'es'\]\)/);
  assert.match(APP, /authLang: 'en'/);
  assert.match(APP, /appName: 'Satoru',\s+lang: 'en'/);
  const language = between('function lang()', '\nfunction t(');
  assert.match(language, /State\.phase !== 'app'/);
  assert.match(language, /return registrationLang\(\)/);
  assert.match(language, /return 'ru'/);
  assert.match(INDEX, /<html lang="en">/);
});

test('registration opens with a dedicated five-language step before account fields', () => {
  const screen = between('function renderRegistrationLanguageScreen()', '\nfunction renderRegisterScreen()');
  for (const code of ['en', 'ru', 'de', 'uk', 'es']) assert.match(screen, new RegExp(`\\['${code}',`));
  assert.match(screen, /role="group"/);
  assert.match(screen, /aria-pressed=/);
  assert.match(screen, /data-action="registration-language-continue"/);
  const actions = between("if (action === 'go-register')", "if (action === 'go-login')");
  assert.match(actions, /State\.phase = 'register-language'/);
  assert.match(actions, /pick-registration-language/);
  assert.match(actions, /State\.authLang = el\.dataset\.lang/);
  assert.match(actions, /registration-language-continue/);
  assert.match(actions, /State\.phase = 'register'/);
});

test('chosen language is persisted before onboarding and retained by every onboarding path', () => {
  assert.match(APP, /function freshOnboardingSettings\(skills = \[\], preferredLang = null\)[\s\S]*APP_LANGS\.includes\(preferredLang\)[\s\S]*lang: selectedLang, skills/);
  const registration = between("if (f.id === 'register-form')", "// --- Reset (по коду восстановления) ---");
  const saveAt = registration.indexOf("await Store.saveNow('settings', State.settings)");
  const onboardingAt = registration.indexOf("State.phase = 'onboarding'");
  assert.ok(saveAt >= 0 && onboardingAt > saveAt, 'language settings must persist before onboarding is shown');
  assert.match(between('async function applyProgramFresh', '\nasync function loginAsTestUser'), /freshOnboardingSettings\(skills\)/);
  const questionnaire = between('async function questionnaireCommit()', '\nasync function questionnaireDefer()');
  assert.match(questionnaire, /fetch\('\/api\/questionnaire\/commit'/);
  assert.match(questionnaire, /sourceLocale: q\.sourceLocale/);
  assert.match(SERVER, /const nextSettings = structuredClone\(domain\.settings\);\s*nextSettings\.skills = questionnaireMergeSkills/,
    'questionnaire may replace skills but must retain the already-persisted account language');
  assert.match(between("if (action === 'ob-finish')", '// --- Лутбоксы'), /freshOnboardingSettings\(skills\)/);
});

test('language step has complete locale copy and accessible touch targets', () => {
  for (const key of ['Выбери язык', 'На нём пройдёт регистрация', 'Продолжить']) {
    const row = APP.slice(APP.indexOf(`'${key}`), APP.indexOf('\n', APP.indexOf(`'${key}`)));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(row, new RegExp(locale));
  }
  assert.match(CSS, /\.registration-language-option\s*\{[\s\S]*?min-height:\s*52px/);
  assert.match(CSS, /\.registration-language-screen\s*\{[^}]*min-height:\s*100svh[^}]*box-sizing:\s*border-box/);
  assert.match(CSS, /#app:has\(> \.registration-language-screen\)\s*\{[^}]*padding:\s*0/);
  assert.match(CSS, /\.registration-language-option:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--text-strong\)[^}]*box-shadow:\s*var\(--focus-ring\)/);
  assert.match(CSS, /@media \(max-width: 380px\)[\s\S]*\.registration-language-options/);
});

test('v164 invalidates the PWA shell and cache-busts app and styles', () => {
  assert.match(SW, /const CACHE = 'satoru-v226'/);
  assert.match(INDEX, /styles\.css\?v=20260903-write-fence-v215-2/);
  assert.match(INDEX, /app\.js\?v=20260903-write-fence-v215-2/);
});
