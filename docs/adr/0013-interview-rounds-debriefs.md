# ADR-0013: InterviewRound, debriefs & the outcome→weakness edge

## Status
**ACCEPTED (design)** — 2026-07-09. SPIKE-010 resolved below; schema finalized for the MOM-110
implementer PR (awaits D-004 human approval — the migration is not run in this design PR). Decision
record: **D-016**. Track N. Cross-links ADR-0009 (pipeline stage machine — a round is *not* a status),
ADR-0011 (the debrief emits a `WeaknessSignal`), ADR-0002 (a round's mock practice reuses
`InterviewSession`). Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md` (Phase 1, loop-first).

## Context
An interview today can only be recorded as a free-form `JobEvent` (`type`/`title`/`notes`/`eventAt`)
— a note on a timeline, not a model. There is no round type, no scheduled date, no interviewer, no
structured outcome, and **no debrief that feeds anything**: "bombed system design at the Meta onsite"
changes no weakness, no readiness, no next action. This is the open half of the CareerOS loop. MOM-127
just landed the `WeaknessSignal` store (`recordSignal`) that the debrief needs to write to; what's
missing is the first-class interview object that carries the outcome.

## SPIKE-010 findings

**Q1 — How do a round's prep tasks and mock sessions link back without the PlanItem/Task dual-write
anti-pattern?**
The mission engine's original sin was writing the *same* work into two tables (`PlanItem` **and**
`Task`) that then drift. `InterviewRound` avoids it by **owning neither**. Prep for a round is an
ordinary `Task` (which already has `jobApplicationId`); a round-scoped mock is an ordinary
`InterviewSession` (which already has `jobApplicationId`). To attribute either to a *specific* round
(not just the job), a **single nullable `interviewRoundId` FK** is added to each of `Task` and
`InterviewSession` — a back-reference, not a copy. Those two columns are deferred to the PRs that need
them (MOM-111 round-scoped prep; MOM-141 auto-prep), each additive; MOM-110 ships `InterviewRound`
alone. No row is ever written twice.

**Q2 — Reminder idempotency across multiple rounds of one job.**
`ensureDeadlineReminder` keys its sentinel upsert on `jobApplicationId` + a type string. A job has
many rounds, each with its own `scheduledAt`, so the reminder sentinel must be keyed by **round**, not
job: `type = 'interview_round'` + a stable per-round title (or a `reminders.interviewRoundId` — but a
title-sentinel keyed by round id avoids a third schema touch). Re-saving a round updates its one
reminder; deleting a round (cascade) removes it. This is MOM-112; MOM-110 only lands the model + the
`scheduledAt` it reads.

**Q3 — Do we migrate existing `JobEvent`s into rounds?**
No. A `JobEvent` is either a pipeline movement (`status_change`, auto-logged by MOM-102) or a free-form
note — neither is a structured interview. `InterviewRound` and `JobEvent` **coexist**: the upgraded
job timeline (MOM-110) merges structured rounds with free-form events chronologically. No backfill, no
data migration, no loss — old free-form interview notes stay as they are; new interviews use the model.

**Q4 — Does a round outcome mutate the pipeline `status`?**
Not automatically in MOM-110. Round outcome and `JobApplication.status` stay **independent** to avoid
coupling two state machines; the user advances status themselves (which already auto-logs a `JobEvent`
via MOM-102). A future nicety (suggest "mark rejected?" after a failed final round) is deferred.

## Decision

### `InterviewRound` model (MOM-109 schema; MOM-110 implements)
```prisma
model InterviewRound {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  jobApplicationId String    @map("job_application_id") @db.Uuid
  roundType        String    @map("round_type")   // INTERVIEW_ROUND_TYPES
  sequence         Int       @default(0)          // order within the loop
  scheduledAt      DateTime? @map("scheduled_at") @db.Timestamptz(6)
  durationMinutes  Int?      @map("duration_minutes")
  interviewer      String?
  outcome          String    @default("pending")  // INTERVIEW_ROUND_OUTCOMES
  debrief          String?                          // "what happened / what I missed"
  areasWeak        String[]  @default([]) @map("areas_weak")  // CAREER_ROLE_AREA_IDS the round exposed
  missTags         String[]  @default([]) @map("miss_tags")   // MISS_TAG_REASONS
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobApplication   JobApplication @relation(fields: [jobApplicationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([jobApplicationId])
  @@index([scheduledAt])
  @@map("interview_rounds")
}
```
Plus back-relations `interviewRounds InterviewRound[]` on `User` and `JobApplication`.

### Shared taxonomies (MOM-109)
```ts
INTERVIEW_ROUND_TYPES = ['recruiter_screen','phone_screen','online_assessment','technical',
  'coding','system_design','behavioral','hiring_manager','onsite','final','other']
INTERVIEW_ROUND_OUTCOMES = ['pending','passed','failed','mixed','withdrawn','unknown']
```
`areasWeak` validates against `CAREER_ROLE_AREA_IDS`; `missTags` against `MISS_TAG_REASONS` — the same
taxonomy the practice reflection UI already uses, so a debrief speaks the weakness engine's language.

### The debrief → weakness edge (MOM-113, the loop-closer — separate PR)
On saving a round with `outcome ∈ {failed, mixed}` and any `areasWeak`/`missTags`, the service calls
`weaknesses.recordSignal` once per item — `signalType:'area'` (key = areaId) or `'reason'` (key =
missTag), `source:'debrief'`, `jobApplicationId` set, `roleTrackId` inherited from the job — and emits
one `LearningEvidence` (`type:'interview_debrief'`). Those signals enter `weaknesses.summary()`
(MOM-127) and thus Today (MOM-142). **This is where bombing a round reshapes tomorrow's prep.**

### Deferred, additive back-links (not MOM-110)
`Task.interviewRoundId?` (MOM-111) and `InterviewSession.interviewRoundId?` (MOM-141) — single nullable
FKs, added when those features need round attribution. Listed here so the model's relationships are
designed up front even though the columns land later.

## Consequences
- The `JobEvent`-as-interview hack is replaced by a real object with a date (→ reminders MOM-112,
  countdown MOM-140-full, auto-prep MOM-141), an outcome, and a debrief that **closes the loop**
  (MOM-113 → MOM-127 store → MOM-142 Today).
- Migration is **additive** (one new table + indexes + 2 FKs; no ALTER of existing data, no backfill);
  `JobEvent` untouched. Human-gated by D-004; verified fresh + existing DB in MOM-110; rollback = drop.
- No dual-write: Task/Session remain the single home for prep/practice, attributed to a round by a
  back-reference FK only.

## Alternatives considered
- **Extend `JobEvent` with interview columns** — rejected: overloads a free-form note model with a
  structured schema and mixes pipeline movements with interviews in one table.
- **A round owns its own prep/practice rows** — rejected (Q1): that's the PlanItem/Task dual-write
  anti-pattern; reuse `Task`/`InterviewSession` with a back-link instead.
- **Auto-advance `status` from outcome** — rejected for MOM-110 (Q4): couples two state machines.
