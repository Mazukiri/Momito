# ADR-0002: ReviewState uses a polymorphic object reference

## Status
Accepted (design) — 2026-07-05. Schema change is **not yet implemented**; gated behind
SPIKE-003 and human approval per `docs/agent/DECISIONS.MD` D-004.

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
