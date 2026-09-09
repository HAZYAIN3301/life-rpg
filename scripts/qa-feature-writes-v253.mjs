import assert from 'node:assert/strict';
import path from 'node:path';
// Extends the existing real-Chrome economy runner; all writes stay in its
// ephemeral DATA_DIR / synthetic account. Run FEATURE_QA_V253=1.
export async function featureChecks({ page, base, out, report, disk }) {
  const lost = async endpoint => {
    const bodies = [];
    await page.route(base + endpoint, async route => { bodies.push(route.request().postData()); await route.fetch(); await route.abort(); }, { times: 1 });
    return {
      async retry() { await page.route(base + endpoint, async route => { bodies.push(route.request().postData()); await route.continue(); }, { times: 1 }); },
      verify() { assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1], 'identical retry including all timestamps'); },
    };
  };
  const seedGuide = async (chapter, candidateId = null) => {
    await page.evaluate(async ({ chapter, candidateId }) => {
      guideV3Close({ restoreFocus: false });
      State.settings.guideV3 = GuideV3.normalize({ enabled: true, voiceConsent: false,
        currentChapter: chapter, currentStep: chapter === 'habits' ? 'compose' : 'engage',
        completedChapters: [GuideV3.FIRST_CHAPTER], chapterMeta: { [chapter]: { candidateId } } });
      if (!await Store.saveNow('settings', State.settings)) throw Error('Guide seed');
      State._guideV3SessionPrompted = true; State._guideV3ForceOpen = true;
      State.view = chapter === 'notes' ? 'notes' : chapter === 'calendar' ? 'calendar' : 'habits';
      render();
    }, { chapter, candidateId });
  };
  await seedGuide('notes');
  const capture = page.locator('#capture-form input[name=text]');
  await capture.fill('Сохранить точную мысль — один раз');
  const noteAttempt = await lost('/api/guide/commit');
  await capture.press('Enter');
  await page.waitForFunction(() => !State._inboxBusy && document.querySelector('.capture-status')?.getAttribute('role') === 'alert');
  assert.equal(await page.evaluate(() => State.settings.guideV3.currentStep), 'engage');
  const savedNote = (await disk('inbox')).find(n => n.text === 'Сохранить точную мысль — один раз');
  assert.ok(savedNote);
  await page.screenshot({ path: path.join(out, 'notes-retry.png') });
  await noteAttempt.retry(); await capture.press('Enter');
  await page.waitForFunction(() => State.settings.guideV3.currentStep === 'complete');
  noteAttempt.verify();
  assert.equal((await disk('inbox')).filter(n => n.id === savedNote.id).length, 1);
  report.checks.push('Notes Guide: real form → lost saved response → stable timestamp/ID retry → one note + Guide completion');
  await page.evaluate(async () => {
    State.tasks.push({ id: 'guided-calendar', title: 'Конкретный следующий шаг', skillId: State.settings.skills[0].id,
      date: todayStr(), estimateMin: 30, startTime: null, done: false, difficulty: 'normal' });
    if (!await Store.saveNow('tasks', State.tasks)) throw Error('Calendar seed');
  });
  await seedGuide('calendar', 'guided-calendar');
  await page.locator('[data-action=cal-edit-task][data-id=guided-calendar]').first().click();
  await page.locator('#cal-task-form input[name=startTime]').fill('12:00');
  const calendarAttempt = await lost('/api/guide/commit');
  await page.locator('.cal-task-save').click();
  await page.waitForFunction(() => document.querySelector('.cal-task-save')?.disabled === false);
  assert.equal(await page.evaluate(() => State.tasks.find(t => t.id === 'guided-calendar').startTime), null);
  assert.equal((await disk('tasks')).find(t => t.id === 'guided-calendar').startTime, '12:00');
  await calendarAttempt.retry(); await page.locator('.cal-task-save').click();
  await page.waitForFunction(() => !document.querySelector('#cal-task-modal'));
  calendarAttempt.verify();
  assert.equal(await page.evaluate(() => State.settings.guideV3.currentStep), 'complete');
  report.checks.push('Calendar Guide: real schedule dialog → lost saved response → exact retry → time + Guide durable together');
  await seedGuide('habits');
  const form = page.locator('#add-habit-v126');
  await form.locator('[name=title]').fill('Прочитать страницу');
  await form.locator('[name=twoMin]').fill('Открыть книгу и прочитать абзац');
  const weekday = await page.evaluate(() => new Date().getDay());
  await form.locator('input[name=days][value="' + weekday + '"]').check();
  const habitAttempt = await lost('/api/habits/commit');
  await form.locator('button[type=submit]').click();
  await page.waitForFunction(() => !State._habitTxnBusy && document.querySelector('.habit-form-status')?.getAttribute('role') === 'alert');
  assert.equal(await page.evaluate(() => State.settings.guideV3.currentStep), 'compose');
  const savedHabit = (await disk('habits')).find(h => h.title === 'Прочитать страницу'); assert.ok(savedHabit);
  await habitAttempt.retry(); await form.locator('button[type=submit]').click();
  await page.waitForFunction(() => State.settings.guideV3.currentStep === 'complete');
  habitAttempt.verify();
  assert.equal((await disk('habits')).filter(h => h.id === savedHabit.id).length, 1);
  report.checks.push('Habits Guide: real compose → lost saved response → same habit+Guide timestamp on retry');
  await page.evaluate(async () => { guideV3Close({ restoreFocus: false }); State.settings.guideV3.enabled = false; await Store.saveNow('settings', State.settings); render(); });
  const check = page.locator('[data-action=toggle-habit][data-id="' + savedHabit.id + '"]').first();
  const completion = await lost('/api/habits/commit');
  await check.click(); await page.waitForFunction(() => !State._habitTxnBusy && !!State._habitError);
  const persistedLog = await disk('habitlog');
  await completion.retry(); await check.click();
  await page.waitForFunction(() => !State._habitTxnBusy && !!State._habitUndo);
  completion.verify(); assert.deepEqual(await disk('habitlog'), persistedLog);
  await page.locator('[data-action=habit-undo]').click();
  await page.waitForFunction(() => !State._habitTxnBusy && !State._habitUndo);
  assert.equal(Object.values(await disk('habitlog')).some(day => day[savedHabit.id]), false);
  report.checks.push('Habit check: no premature XP, exact repeat after lost ack, one record; Undo persists');
  await page.evaluate(() => { State.view = 'den'; State._denEdit = true; render(); });
  const previousLight = await page.evaluate(() => ensureDen().light);
  const light = page.locator('[data-action=den-light][data-value=night]');
  await page.route(base + '/api/economy/commit', route => route.fulfill({ status: 503, body: '{}' }), { times: 1 });
  await light.click(); await page.waitForFunction(() => !equipmentSaving);
  assert.equal(await page.evaluate(() => ensureDen().light), previousLight);
  await light.click(); await page.waitForFunction(() => !equipmentSaving);
  assert.equal((await disk('settings')).den.light, 'night');
  const resetAttempt = await lost('/api/economy/commit');
  await page.locator('[data-action=den-reset]').click(); await page.waitForFunction(() => !equipmentSaving);
  assert.equal(await page.evaluate(() => ensureDen().light), 'night');
  await resetAttempt.retry(); await page.locator('[data-action=den-reset]').click(); await page.waitForFunction(() => !equipmentSaving);
  resetAttempt.verify(); assert.equal((await disk('settings')).den.light, 'auto');
  await page.screenshot({ path: path.join(out, 'den-confirmed.png') });
  report.checks.push('Den light/reset: failed write keeps old room; exact lost-response retry; appearance after receipt only');
  await page.reload(); await page.waitForFunction(() => State.phase === 'app'); await page.locator('#main > *').first().waitFor();
  assert.equal(await page.evaluate(() => State.inbox.filter(n => n.text === 'Сохранить точную мысль — один раз').length), 1);
  assert.equal(await page.evaluate(() => State.tasks.find(t => t.id === 'guided-calendar').startTime), '12:00');
  assert.equal(await page.evaluate(() => State.habits.filter(h => h.title === 'Прочитать страницу').length), 1);
  report.checks.push('Reload keeps real note, calendar time and habit with no duplicates');
}
