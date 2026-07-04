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

### D-008 — No copyrighted problem statements in seed content
**Context:** Data invariant §2.2.4/5.
**Decision:** DSA/content seeds store metadata, source URLs, patterns, and **original** practice
notes only — never external problem text. `content:validate` (MOM-024) enforces this with a
statement-pattern check and blocks publish on violation.
**Consequences:** Legally safe content pipeline; validation gates every seed batch.
**ADR:** [`docs/adr/0004-no-copyrighted-problem-statements-in-seeds.md`](../adr/0004-no-copyrighted-problem-statements-in-seeds.md)

### D-009 — `roleTrackId` is currently a bare string; decide model-vs-constant before MOM-061
**Context:** `roleTrackId` appears as an unconstrained `String` across `InterviewSession`, `Task`,
`JobApplication`, `CareerGoal`, `Mission`, etc. — no `RoleTrack` table.
**Decision:** MOM-061 (role tracks) must first decide, via inspection, whether to introduce a
`RoleTrack` model (migration → human-gated) or a shared constant set in `packages/shared`. Default
lean: constants first (no migration), promote to a table only if referential integrity is needed.
**Consequences:** Prevents an unplanned schema change sneaking in via a content task.
