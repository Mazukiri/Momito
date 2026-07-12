# ADR-0011: WeaknessSignal + one target-scoped, FSRS-grounded readiness engine

## Status
**ACCEPTED (design)** — 2026-07-08. SPIKE-013 resolved below; the schema is finalized for the
MOM-127 implementer PR, which awaits human approval per **D-004** (the migration itself is not run
in this design PR). Decision record: **D-013**. Supersedes the dual readiness engines; cross-links
ADR-0003 (learning/mission coexistence) and ADR-0002 (polymorphic ReviewState). Plan:
`docs/plans/MOMITO_CAREEROS_PLAN.md` (Phase 1, loop-first ordering — owner decision 2026-07-08).

## Context
Readiness today is substring keyword-matching over profile/attempt text, computed by **two
divergent engines**:

- `career.service.getReadiness` — for each role-track checklist item, marks it *done* if **any**
  evidence text (profile / project / practice / job / task / learning) contains one of the item's
  keywords, weighted by checklist weight → `overallPercentage`. Binary, derived on-demand, **never
  decays**: a question answered once counts forever.
- `missions.service.diagnose` — the *second* engine. Counts evidence/task/attempt matches per
  checklist item into a `currentLevel` (0–3) + `confidence`, persisted to `MissionCompetencyState`.
  Same checklist, same keyword matching, **different math** → a different "readiness" number for the
  same user.

So the "am I ready" number is untrustworthy and can contradict itself. Separately, study signals
carry `roleTrackId/area = null` on `AnswerAttempt`, so nothing can be scoped to a specific target
("am I ready for **Meta**?"). And the `weaknesses.service` derives weakness signals on-demand from
`AnswerAttempt` reflection data (`missTags` / `selfRating` / `correctness`) — deliberately **with no
table** (see its header comment) — which works for practice struggles but **cannot represent an
interview outcome**: there is no `AnswerAttempt` behind "bombed system design at the Meta onsite",
so interview outcomes currently feed **nothing**. The `WeaknessSignal` model (V2 plan §5.4) and the
`weakness_repair` / `mixed_interview` session types (§7.1) were specced and never built.

## SPIKE-013 findings

**Q1 — Do we replace the derived weakness engine with a table, or keep both?**
Keep both. The derived path (`weaknesses.service.summary` / `struggledQuestionIds`) is correct and
cheap for **practice struggles**, which are always re-derivable from `AnswerAttempt`. The table
stores only **event-sourced signals that cannot be re-derived** — interview debriefs (MOM-113) and
manual entries — plus the state the derived path can't hold: **severity decay, repair lifecycle, and
dismissal**. `summary()` **merges** the two sources (derived practice signals ∪ stored signals),
deduplicating on `(signalType, key, jobApplicationId)`. This keeps MOM-127 small and preserves the
working engine. (Resolves the `weaknesses.service` header's own "a dedicated table can come later if
severity decay or manual dismissal is ever needed" — that time is now, but only for the signals that
need it.)

**Q2 — Is FSRS retrievability cheaply queryable per area to ground readiness?**
Yes, via a bounded service-layer join — **no denormalization of `ReviewState` is required.**
`ReviewState` is `(userId, objectType, objectId)` with `objectId = questionId` for questions and is
indexed `@@index([userId, due])` + `@@unique([userId, objectType, objectId])`, so fetching *all* of a
user's review states is a single indexed scan. Area is resolved by mapping `objectId → Question.areaTags`
in memory. Per-user `ReviewState` cardinality is small (one row per reviewed object), so the in-memory
group-by-area is cheap and keeps `ReviewState` polymorphically pure (it must serve Story and other
object types later — ADR-0002). We therefore **do not** add `area` to `ReviewState`. Actual timing is
confirmed when MOM-129 implements the engine; the access pattern is already index-covered.

**Q3 — Where do target tags go?**
On `AnswerAttempt` (`roleTrackId` + `area`), not `ReviewState`. A standalone (sessionless) attempt
has no session to inherit a target from, so the columns must live on the attempt. This also gives
**graded-attempt-per-area** cheaply (group attempts by `area`), the performance half of the grounded
score. `companyId` is intentionally **omitted** for now: there is no `Company` FK on `JobApplication`
yet (that is the deliberately-deferred, highest-risk MOM-120→122 migration). Company-scoping is
carried by **`jobApplicationId`** on `WeaknessSignal` (an existing FK target); when the catalog
`Company` FK lands, a nullable `companyId` is added alongside — additive, no rework.

## Decision

### 1. `WeaknessSignal` model (MOM-126 schema; MOM-127 implements)
```prisma
model WeaknessSignal {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  signalType       String    @map("signal_type") // reason | pattern | topic | area | round
  key              String                        // MissTagReason | patternTag | topicId | areaId | roundType
  label            String
  roleTrackId      String?   @map("role_track_id")     // target scoping — nullable (global signal allowed)
  area             String?
  jobApplicationId String?   @map("job_application_id") @db.Uuid  // company/target scoping until Company FK lands
  severity         Float     @default(1)          // accrues on repeat; decays with age at read time
  occurrences      Int       @default(1)
  source           String                         // attempt | debrief | manual
  status           String    @default("open")     // open | repairing | resolved | dismissed
  lastSignalAt     DateTime  @map("last_signal_at") @db.Timestamptz(6)
  resolvedAt       DateTime? @map("resolved_at") @db.Timestamptz(6)
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobApplication   JobApplication? @relation(fields: [jobApplicationId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([jobApplicationId])
  @@index([roleTrackId, area])
  @@map("weakness_signals")
}
```
Plus the back-relations `weaknessSignals WeaknessSignal[]` on `User` and `JobApplication`.

**Idempotency / accrual:** a signal is keyed conceptually by `(userId, signalType, key, jobApplicationId)`.
On a repeat event the service bumps `occurrences`, raises `severity`, and refreshes `lastSignalAt`
rather than inserting a duplicate row. (Enforced in the service layer, not a DB unique constraint,
because `jobApplicationId` is nullable and Postgres treats NULLs as distinct in a unique index — a
service-layer upsert-by-find is the correct pattern here, mirroring `ensureDeadlineReminder`.)

**Severity decay** is computed at **read time** (`severity * exp(-age/halflife)`), not written on a
schedule — no cron, consistent with the "derive at read time" ethos. A signal drops out of the
summary when decayed severity falls below a floor or `status ∈ {resolved, dismissed}`.

### 2. Tag columns on `AnswerAttempt` (MOM-126 schema; MOM-128 populates on create)
```prisma
// on model AnswerAttempt
roleTrackId String? @map("role_track_id")
area        String?
@@index([userId, area])
```
Existing rows backfill to `NULL` (additive, no data migration). MOM-128 populates them on attempt
creation from the session's `roleTrackId`/`area` or the standalone-attempt DTO.

### 3. New session-type branches (MOM-127)
**Implementation reconciliation (MOM-127):** the existing `weak_area_review` session type *already*
draws from the user's weakness signals (redo struggled items + weak-pattern siblings, falling back to
a filtered draw) — it **is** the "weakness_repair" the plan named, and the recommendations engine
already links to it. Adding a second, near-identical `weakness_repair` type would be pure duplication,
so it was **not** added; once stored debrief signals merge into `weaknesses.summary` (below),
`weak_area_review` repairs interview-derived weaknesses too. Only the genuinely-new
**`mixed_interview`** type was added — a mock-loop draw that interleaves recently-struggled questions
with a fresh cross-area draw (distinct from the plain `mixed_mock`). The `job_prep` branch (MOM-128)
auto-derives its question set from a `jobApplicationId`. **No new Task/PlanItem dual-write** — prep
still writes to the existing `Task` model (avoids the anti-pattern SPIKE-010 flags for MOM-109).

### 4. One grounded engine (MOM-129, separate PR)
Replace both readiness computations with a single shared helper
`computeAreaReadiness(userId, roleTrackId, { jobApplicationId? })` that blends, per checklist area:
**coverage** (questions/evidence tagged to the area — today's keyword/tag match) × **durability**
(FSRS retrievability of those questions' `ReviewState`: recently reviewed, stable, not overdue) ×
**performance** (graded / self-rated attempt scores in the area). Per **D-015 (missions frozen)**,
`missions.service` diagnosis becomes a **view over this one helper**, not a parallel computation;
`MissionCompetencyState` is persisted *from* it. MOM-130 adds the target-scoped rollup → the "am I
ready for Meta?" go/no-go, scoped by `jobApplicationId`.

## Consequences
- An interview debrief (MOM-113) emits a persisted `WeaknessSignal` (`source='debrief'`,
  `jobApplicationId` set) + a `LearningEvidence` row. That signal enters `weaknesses.summary`, which
  drives a `recommendations.service` repair item (MOM-142) — **so bombing a round visibly reshapes
  tomorrow's Today.** This is the edge that closes the career loop.
- Readiness stops being gameable: an area you crammed once but never reviewed **decays** (low FSRS
  retrievability), so the "ready" number reflects durable recall, and it can be scoped to a specific
  target instead of a global average.
- The two-engine contradiction is removed; the mission engine keeps working as a legacy view.
- **Migration is additive** (one new table + two nullable columns + indexes; no ALTER of existing
  data, no backfill) — the safe class, but still human-gated by D-004. Verified on fresh + existing
  DB in the MOM-127 implementer PR, with rollback = drop table + columns.

## Alternatives considered
- **Denormalize `area` onto `ReviewState`** for a one-query per-area FSRS group-by — rejected (Q2):
  breaks polymorphic purity and needs syncing when a question's `areaTags` change; the bounded
  in-memory join is cheap enough.
- **Replace the derived weakness engine entirely with the table** — rejected (Q1): practice struggles
  are always re-derivable; storing them duplicates state and risks drift. Store only what can't be
  derived.
- **Add `companyId` now** — rejected (Q3): depends on the highest-risk MOM-122 FK migration, which the
  owner deliberately sequenced *last* in Phase 1. `jobApplicationId` scoping is sufficient for Gate 1.
