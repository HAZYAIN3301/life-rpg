# Questionnaire v1 — server API

This is the server-owned Q1 contract behind `QUESTIONNAIRE-V1-PLAN.md`. Identity always comes from the signed `lrpg_sess` cookie. None of these routes accepts a target user ID.

## Read

`GET /api/questionnaire`

Returns `{ ok, questionnaire }`.

- No receipt and no skills: `status: "draft"`, `revision: 0`.
- No receipt, but a legacy account already has skills: `status: "materialized"`, `legacy: true`; no file is created.
- Saved Skip: `status: "deferred"`.
- Saved seed: `status: "materialized"` with exact `goalIds`, `taskIds`, and `sphereIds`.
- Malformed stored data returns `409` with `recoverable: true`; it is never rendered as an empty onboarding.

## Atomic materialization

`POST /api/questionnaire/commit`

Maximum request size: 96 KiB. `revision` is the next receipt revision (`1` for a new account; a seed after a deferred revision `1` uses revision `2`). IDs and the idempotency key must be stable before the first attempt.

```json
{
  "idempotencyKey": "questionnaire.commit.draft-01",
  "revision": 1,
  "receipt": {
    "draftId": "draft-01",
    "originAnswerId": "answer-01",
    "sourceLocale": "ru",
    "recognitionPhrase": "Выпустить первое видео о Satoru",
    "source": "user_confirmed_suggestion",
    "confirmedAt": "2026-08-30T10:00:00.000Z",
    "consents": {
      "sendRawTextToAiProvider": true,
      "retainRawAnswer": false
    }
  },
  "settings": {
    "skills": [{
      "id": "sk-video-01",
      "name": "Видео",
      "color": "#4cc9f0",
      "parentId": null,
      "role": "primary",
      "source": "user_confirmed_suggestion"
    }]
  },
  "goal": {
    "id": "g-video-01",
    "title": "Выпустить первое видео",
    "why": "Начать продвижение Satoru",
    "outcome": "Видео опубликовано",
    "deadline": null,
    "skillIds": ["sk-video-01"],
    "backgroundSkillIds": [],
    "source": "user_confirmed_suggestion"
  },
  "task": {
    "id": "t-video-01",
    "title": "Выбрать сцену и записать черновой дубль",
    "estimateMin": 15,
    "date": "2026-08-30",
    "skillIds": ["sk-video-01"],
    "layers": [],
    "goalId": "g-video-01",
    "difficulty": "easy",
    "source": "user_confirmed_suggestion"
  },
  "profileConsent": {
    "useConfirmedFactsForAssistant": true,
    "useRecognitionInGuide": true
  }
}
```

Rules:

- exactly one goal, one task, and 1–3 confirmed spheres;
- source is one of `user_explicit`, `user_confirmed_suggestion`, `import_confirmed`;
- task duration is 5–60 minutes and its local `date` is mandatory;
- every goal/task sphere reference must resolve to an existing or included account-owned sphere;
- the task must reference the included goal;
- existing settings, goals, tasks, and groups are merged/preserved, never cleared;
- raw answer text is not accepted or retained by this endpoint;
- a reused key with the same canonical payload returns `200` and `replayed: true` with the same IDs;
- a reused key with different data returns `409 questionnaire_idempotency_conflict`;
- a stale/new revision returns `409 questionnaire_revision_conflict` with `currentRevision`.

Success is returned only after server read-after-write verification. The response is:

```json
{
  "ok": true,
  "replayed": false,
  "questionnaire": {},
  "settings": {},
  "goals": [],
  "tasks": [],
  "goalGroups": []
}
```

The synchronous account-owned transaction writes `settings → goals → tasks → questionnaire` under a per-user lock. Any write or verification failure restores all prior snapshots and returns `questionnaire_commit_failed_no_changes_lost` without false success.

## Defer / Skip

`POST /api/questionnaire/defer`

Accepts only `{ idempotencyKey, revision, receipt }`. It writes a bounded `status: "deferred"` receipt and creates no spheres, goals, or tasks. It follows the same idempotency and revision rules. A later explicit seed uses the next revision.

## Lifecycle and bypass protection

- `questionnaire.json` is included in account export/import and removed with the account directory.
- An imported materialized receipt is rejected unless its referenced settings, goals, and tasks exist in the final archive view.
- Direct `PUT/POST /api/data/questionnaire` returns `403 server_owned_data`.
- Account export omits raw answers and all usual account secrets.

Contract tests: `node --test scripts/questionnaire-server-v1.test.js`.
