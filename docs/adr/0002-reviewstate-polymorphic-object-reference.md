# ADR-0002: ReviewState uses a polymorphic object reference

## Status
**Implemented** — 2026-07-05. The user explicitly approved running the migration
(D-004's human-approval gate). Migration `20260705045159_add_review_state` is applied;
`ReviewState` exists in `apps/api/prisma/schema.prisma` exactly as designed below,
including the SPIKE-003 partial index and the orphan-cleanup fix in
`questions.service.ts`'s `remove()`. `ReviewsService`/`ReviewsController` (MOM-029) wire
`apps/api/src/reviews/fsrs-scheduler.ts` (MOM-030) to real persistence — see the 2026-07-05
`LOG.MD` entry for full verification detail (unit tests + live round-trip against a real
Postgres instance).

## Context
The Learning Engine (plan §6) needs one spaced-repetition scheduler (FSRS) that can review many
kinds of practice objects: DSA/CS/system-design questions (`Question`), behavioral prompts,
personal STAR stories (`Story`, not yet built), and potentially other future knowledge objects.

Two schema shapes were considered:

1. **Nullable per-type relations** — a `ReviewState` row with `questionId?`, `storyId?`,
   `behavioralPromptId?`, etc., each nullable and each with its own foreign key.
2. **Polymorphic reference** — a single `objectType: String` + `objectId: Uuid` pair, uniquely
   constrained per `(userId, objectType, objectId)`, with no foreign key enforced at the
   database level (per plan §6.3).

Option 1 grows a new nullable column and relation for every reviewable domain added later
(Story, system design case, CS card, ...), which contradicts the "no broad rewrites" and
"KnowledgeObject at the service layer first" invariants (plan §5, §14 kill/defer rules). Option 2
matches the plan's own proposed shape and the wider `WeaknessSignal`/`Reviewable` polymorphic
design already specified in plan §5.2–5.4.

The current schema (`apps/api/prisma/schema.prisma`) has no `ReviewState` model yet. This ADR
records the *shape* decision so implementers do not re-litigate it when MOM-026/027 are
eventually approved; it does not itself create a migration.

## Decision
Adopt the polymorphic shape from plan §6.3:

```prisma
model ReviewState {
  id         String @id @default(uuid()) @db.Uuid
  userId     String @map("user_id") @db.Uuid
  objectType String @map("object_type")
  objectId   String @map("object_id") @db.Uuid

  stability  Float @default(0)
  difficulty Float @default(0)
  due        DateTime @default(now()) @db.Timestamptz(6)
  state      Int @default(0)
  reps       Int @default(0)
  lapses     Int @default(0)
  suspended  Boolean @default(false)

  lastReviewedAt DateTime? @map("last_reviewed_at") @db.Timestamptz(6)

  @@unique([userId, objectType, objectId])
  @@index([userId, due])
  @@map("review_states")
}
```

No foreign key is enforced from `objectId` to a specific table — referential integrity for each
`objectType` is validated at the service layer, matching the plan's explicit allowance
("nullable relation fields only after constraint tests" is the fallback, not the default).

Before implementation (MOM-027), SPIKE-003 must confirm:
- migration safety on the existing (non-empty) database,
- how orphaned `objectId`s are detected/cleaned if a referenced row is deleted,
- whether Postgres partial indexes are needed for `suspended`/`due` query performance.

## SPIKE-003 findings (2026-07-05)

**1. Migration safety on the existing (non-empty) database.**
The migration is purely additive — one new `CREATE TABLE review_states`, no `ALTER TABLE`
on any existing table, no new `NOT NULL` column added to a populated table, no backfill
required. Existing users simply start with zero `review_states` rows; the review/FSRS
service layer must use a get-or-create pattern the first time a user reviews an object
(create the row with FSRS defaults — `stability: 0`, `state: 0`, `due: now()` — on first
review) rather than a migration-time backfill job. Confirmed against the three prior
migrations in `apps/api/prisma/migrations/` (`add_profile_scoring`,
`add_career_os_mvp2`, `add_missions_v3`): all are additive `CREATE TABLE`/`ADD COLUMN`
statements with defaults, the same low-risk shape this migration follows. **Safe on both
fresh and existing DB**, no destructive step.

**2. Orphaned `objectId` detection/cleanup.**
Confirmed a real deletion path exists: `apps/api/src/questions/questions.service.ts`'s
`remove()` calls `prisma.question.delete()`, currently blocked only by the `AnswerAttempt`
foreign key (via `rethrowDeleteConstraint`). Because `ReviewState.objectId` has **no**
foreign key (by design, since it's polymorphic), deleting a `Question` that has a
`ReviewState` row would **not** be blocked and would silently orphan that row today.
Decision: MOM-027's implementation must add an explicit service-layer step — before/with
every hard-delete of a reviewable object (currently only `Question`), delete matching
`ReviewState` rows in the same transaction: `prisma.reviewState.deleteMany({ where: {
objectType: 'question', objectId: id } })`. This must ship as part of MOM-027, not a
separate follow-up, since the orphan risk exists from the moment `ReviewState` rows can be
created. A periodic integrity sweep is not needed given deletes are rare and this
transactional cleanup is sufficient.

**3. Partial indexes for `suspended`/`due` query performance.**
Prisma's `@@index` cannot express a partial (`WHERE`) index directly in the schema DSL as
of Prisma 6 for this attribute combination; the migration must add it via raw SQL appended
to the generated `migration.sql` after `prisma migrate dev --create-only`:
```sql
CREATE INDEX "review_states_user_due_active_idx"
  ON "review_states" ("user_id", "due")
  WHERE NOT "suspended";
```
This is worth doing from the start (not deferred) because the Today queue's core query
(`WHERE userId = ? AND due <= now() AND NOT suspended`) is the single highest-frequency
query this table will serve, and partial indexes avoid the full-table-scan-adjacent cost
of the default `@@index([userId, due])` once `suspended = true` rows accumulate over time.

**Conclusion:** SPIKE-003 is answered; no unresolved design question blocks a human
approving MOM-027. The migration is additive, its orphan risk has a concrete fix already
scoped into MOM-027's acceptance criteria, and its indexing strategy is decided.

## Consequences
- One review/scheduling engine (MOM-029/030/031) serves every domain, including `Story` review
  (MOM-063), without a schema change per domain.
- Application code, not the database, is responsible for validating `objectType` values and
  cleaning up `ReviewState` rows when a referenced object is deleted (e.g. via a service-layer
  cascade or a periodic integrity check) — this must be covered by tests before MOM-027 ships.
- The Today queue (MOM-032) can query all due/overdue reviews across domains with a single
  `WHERE userId = ? AND due <= now() AND NOT suspended` query.

## Related
- `docs/agent/DECISIONS.MD` — D-004, D-005
- `docs/agent/BACKLOG.MD` — MOM-026 (design), MOM-027 (implement, human-gated), MOM-063 (Story
  reuse), SPIKE-003
