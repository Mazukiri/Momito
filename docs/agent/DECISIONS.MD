# DECISIONS

> Load-bearing decisions made during planning, grounded in repo inspection (not the plan's
> assumptions). Each is actionable and constrains implementers. Formal ADRs land under `docs/adr/`
> via MOM-005; this is the running index.

---

### D-001 — `apps/api` (NestJS) is the backend of record; `backend/` (Python) is legacy
**Context:** The plan says "archive the Python backend." Inspection shows the live API is
`apps/api` — NestJS 11 + Prisma 6 + Postgres — with modules for auth, questions, sessions,
attempts, dashboard, career, jobs, missions, learning, profile, tasks, topics, companies,
recommendations. The root `backend/` (uv/alembic/FastAPI-style) and `mobile/` (Expo) are abandoned.
**Decision:** All API work targets `apps/api`. `backend/` and `mobile/` are archived under
`archive/` by MOM-003 (moved, never deleted). Web work targets `apps/web` (Next 16.2.9 / React 19 /
Tailwind v4). Shared types live in `packages/shared`.
**Consequences:** Plan tasks referencing "backend/" are re-pointed at `apps/api`. Legacy code is not
maintained.
**ADR:** [`docs/adr/0001-nestjs-api-is-backend-of-record.md`](../adr/0001-nestjs-api-is-backend-of-record.md)

### D-002 — API security baseline is narrower than the plan states
**Context:** `apps/api/src/main.ts` already sets the `api/v1` global prefix, CORS (via
`common/config`), and a strict `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`).
**Decision:** MOM-017 adds **only** `helmet` + `@nestjs/throttler` (+ exception filter in MOM-085).
It must **not** re-add or weaken validation/prefix/CORS.
**Consequences:** Smaller, safer PR; no regression to existing request validation.

### D-003 — Several "new" plan fields already exist; verify before migrating
**Context:** `AnswerAttempt` already has `selfRating`, `aiScore`, `aiFeedback`, `correctness`,
`confidence`, `timeSpentSeconds`, `hintUsed`, `rubricScore`, `needsReview`. `Question` already has
`rubric` (Json), `roleTags`, `areaTags`, `patternTags`, `sourceUrl`, `referenceAnswer`,
`estimatedMinutes`, `importance`. `Task` is already the rich consolidation target; `Reminder` exists.
**Decision:** MOM-028 (reflection fields), MOM-022/023 (kernel types), MOM-076 (task merge),
MOM-078/079 (reminders) are **NEEDS_REPO_INSPECTION** — implementers must restate current state and
only fill genuine gaps (e.g. miss-tags/reflection-note). No redundant columns.
**Consequences:** Avoids duplicate/fake work and needless migrations.

**MOM-028 inspection outcome (2026-07-05):** `AnswerAttempt.correctness` (free-text
string) is already used as the plan's "outcome" field — `career.service.ts` and
`missions.service.ts` both branch on values like `'correct'`, `'partial'`, `'strong'`.
`confidence` and `timeSpentSeconds` already exist and are wired into
`create-answer.dto.ts`. Genuinely missing, confirmed by grep across `apps/api/src` and
`apps/web/app`: **miss tags** (an array describing why an attempt missed, e.g. the
`WeaknessSignal.reason` taxonomy from plan §5.4), **reflection note** (free-text),
**language** (the programming language used in the answer), and **complexity**
(self-reported Big-O). Adding these requires a Prisma migration on `AnswerAttempt`,
which is schema-gated per D-004 — **not implemented in this pass**. Follow-up task:
a small, human-approved migration adding `missTags String[] @default([])`,
`reflectionNote String?`, `language String?`, `complexity String?` to `AnswerAttempt`.

**MOM-028 implemented (2026-07-05), human-approved:** migration
`20260705060053_add_attempt_reflection_fields` applied to a real Postgres instance —
purely additive (`ADD COLUMN` only, all nullable/defaulted), matching the shape every
prior migration in this repo has used. `missTags` draws from plan §5.4's
`WeaknessSignal.reason` taxonomy, added to `packages/shared/src/index.ts` as
`MISS_TAG_REASONS`/`MissTagReason` (not previously defined anywhere in the codebase).
`CreateAnswerDto` validates `missTags` against that taxonomy (`@IsIn(..., { each: true })`)
and length-caps `reflectionNote`/`language`/`complexity`. No `sessions.service.ts` change
needed — `answer()` already spreads the whole DTO into `answerAttempt.create`, so the new
fields flow through automatically. Verified live: submitted a real answer via
`POST /sessions/:id/answer` with all four fields populated, confirmed they persisted
correctly, and confirmed an out-of-taxonomy miss tag is rejected with 400.

### D-004 — The planner never authors migrations; every schema change is human-gated
**Context:** Hard rule "Do not create migrations." Net-new models (`ReviewState`, `WeaknessSignal`,
`AiUsage`, `Story`, possibly `RoleTrack`) require schema changes.
**Decision:** MOM-026, MOM-063, MOM-069, MOM-075 stay **NEEDS_SPIKE** and produce a *migration
design doc* only. The actual `prisma migrate` step is a separate, human-approved implementer task,
tested on both fresh DB and existing DB.
**Consequences:** No accidental destructive migrations; `schema.prisma` is a hands-off zone (see
`LOCKS.md`).

### D-005 — ReviewState uses polymorphic `objectType` + `objectId` (per plan §6.3)
**Context:** FSRS must schedule many object kinds (questions, stories, cases, prompts, cards).
**Decision:** Adopt the plan's future-proof polymorphic `ReviewState` shape with
`@@unique([userId, objectType, objectId])` rather than nullable per-type relations — pending
SPIKE-003 confirming migration + constraint behavior on the existing DB.
**Consequences:** One review engine serves all domains; Story review (MOM-063) reuses it.
**ADR:** [`docs/adr/0002-reviewstate-polymorphic-object-reference.md`](../adr/0002-reviewstate-polymorphic-object-reference.md)

**SPIKE-003 outcome (2026-07-05):** Answered all three open questions (see ADR-0002's
"SPIKE-003 findings" section). Summary: the migration is purely additive (no ALTER/backfill
on existing tables — safe on fresh and existing DB); a real orphan risk exists because
`Question.remove()` hard-deletes with no FK from `ReviewState.objectId`, so MOM-027 must
ship a transactional `reviewState.deleteMany()` cleanup alongside every reviewable-object
delete, not as a follow-up; and the Today queue's due-lookup needs a partial index
(`WHERE NOT suspended`) added via raw SQL in the generated migration, since Prisma's
schema DSL can't express it directly. No open design question remains — MOM-026 is done;
MOM-027 (the actual `prisma migrate` + service code) awaits human approval per D-004.

**MOM-027/029 implemented (2026-07-05):** the user explicitly approved the migration.
`ReviewState` is live in `schema.prisma` (migration `20260705045159_add_review_state`),
matching this design exactly, including the partial index. The orphan-cleanup fix landed
in `questions.service.ts`'s `remove()`. `ReviewsService`/`ReviewsController` (MOM-029)
wire the FSRS scheduler (MOM-030) to real persistence. Verified against a real, running
Postgres instance — not just mocked tests — including a live create→delete round-trip
proving no orphaned rows remain.

### D-006 — The FSRS learning engine coexists with the existing Mission engine (no rewrite)
**Context:** The repo already contains a substantial, plan-unmentioned engine: `Mission`,
`WeeklyPlan`, `PlanItem`, `MissionCompetencyState`, `MissionCheckIn`, plus a Readwise learning-source
system. This is the "product sprawl" the plan warns about.
**Decision:** Do **not** rip out the Mission engine. Build the FSRS review/Today loop alongside it;
the Today queue (MOM-032) aggregates from both review states and mission/plan items. Consolidation,
if any, is deferred and gated — not part of Gate 1/2.
**Consequences:** No broad rewrite; the daily loop is additive.
**ADR:** [`docs/adr/0003-learning-engine-coexists-with-mission-engine.md`](../adr/0003-learning-engine-coexists-with-mission-engine.md)

### D-007 — Ship PWA manifest before service worker
**Context:** Kill/defer rule: a service worker can destabilize JWT auth/caching.
**Decision:** MOM-015 (manifest + icons, installable) ships in Gate 1. MOM-016 (service worker /
offline) is **NEEDS_SPIKE** (SPIKE-002) and **DEFER**-eligible if it breaks auth.
**Consequences:** App becomes installable safely without risking the auth flow.

**SPIKE-002 outcome (2026-07-05, MOM-016):** `apps/web/app/lib/auth-context.tsx` stores the JWT
in `localStorage` (`momito_token`), invisible to a service worker's execution context. A naive SW
would not break auth directly, but three real risks remain: (1) caching authenticated API
responses in the Cache API would leak one user's data to the next user on a shared device after
logout/login, since the SW has no notion of "current user" to scope the cache by; (2) SW
update/versioning (`skipWaiting`/`clients.claim`) is easy to get wrong and strands users on a
stale JS bundle that no longer matches the API contract; (3) an SW scoped over `/login` risks
serving a stale cached auth shell after logout, producing a confusing "logged out but see old UI"
state. **MOM-016 is DEFERRED** — MOM-015 shipped without it. Revisit only with an explicit
per-user cache-key strategy and a tested update flow.

### D-008 — No copyrighted problem statements in seed content
**Context:** Data invariant §2.2.4/5.
**Decision:** DSA/content seeds store metadata, source URLs, patterns, and **original** practice
notes only — never external problem text. `content:validate` (MOM-024) enforces this with a
statement-pattern check and blocks publish on violation.
**Consequences:** Legally safe content pipeline; validation gates every seed batch.
**ADR:** [`docs/adr/0004-no-copyrighted-problem-statements-in-seeds.md`](../adr/0004-no-copyrighted-problem-statements-in-seeds.md)

### D-010 — Self-rating (1-5 stars) maps to FSRS's 4 grades as 1/2/(3,4)/5
**Context:** `CreateAnswerDto.selfRating` is an existing 1-5 star scale used elsewhere
(dashboard averages, DSA/mission positive-attempt heuristics) that must not change.
`ts-fsrs` (SPIKE-004) only has 4 grades: Again/Hard/Good/Easy.
**Decision:** `apps/api/src/reviews/fsrs-scheduler.ts`'s `selfRatingToGrade` maps
1→Again, 2→Hard, 3→Good, 4→Good, 5→Easy. The existing `selfRating` column/scale is
untouched everywhere else; this mapping only applies inside the FSRS scheduler.
**Consequences:** No schema change, no change to any existing selfRating consumer. If a
future need arises to distinguish 3 from 4 for FSRS specifically, revisit here first
rather than guessing again at the call site.

### D-009 — `roleTrackId` is currently a bare string; decide model-vs-constant before MOM-061
**Context:** `roleTrackId` appears as an unconstrained `String` across `InterviewSession`, `Task`,
`JobApplication`, `CareerGoal`, `Mission`, etc. — no `RoleTrack` table.
**Decision:** MOM-061 (role tracks) must first decide, via inspection, whether to introduce a
`RoleTrack` model (migration → human-gated) or a shared constant set in `packages/shared`. Default
lean: constants first (no migration), promote to a table only if referential integrity is needed.
**Consequences:** Prevents an unplanned schema change sneaking in via a content task.
