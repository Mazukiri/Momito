# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> `AGENTS.MD` sets the current priority order: P0 (stabilize truth) → P1 (fix named
> technical risks) → P2 (Learning Loop: ReviewState/FSRS/Today) → P3 (everything else).
> As of this update: P1 risks are resolved (DIRECT_URL verified fine, `aiScore` scale
> landmine documented — no writer exists yet so nothing to fix blind, Golden Path check
> blocked on Docker not being available in this environment). P2 progress: MOM-026/
> SPIKE-003 (ReviewState migration design) and MOM-030/SPIKE-004 (FSRS scheduling
> algorithm) are both done at the design/pure-logic layer. MOM-027 (the actual migration)
> is READY but requires explicit human approval per D-004 before anyone runs
> `prisma migrate`.

---

## Current state (2026-07-05, session 4, continued)

Done this session, in order:
1. MOM-035 — CodeMirror editor for DSA/coding answers (committed `4a1c1d3`).
2. P1 fix — DSA/mission solved-heuristics no longer count `correctness: 'partial'` as
   solved (committed `53c90ae`).
3. MOM-026/SPIKE-003 — ReviewState migration design finalized (ADR-0002 updated with all
   three open questions answered: migration is additive/safe, a real orphan-delete risk
   was found and scoped into MOM-027's acceptance criteria, partial-index strategy
   decided). **Design only, `schema.prisma` untouched.**
4. MOM-030/SPIKE-004 — FSRS scheduling algorithm implemented as pure functions in
   `apps/api/src/reviews/fsrs-scheduler.ts` (wraps `ts-fsrs`, verified against its real
   `.d.ts` first). No persistence, no module/controller — nothing to wire to yet.

(3) and (4) are uncommitted as of this NEXT.MD update — commit them together as one PR
(they're the same "P2 groundwork" unit) with message:
```text
docs+feat: finalize ReviewState migration design (SPIKE-003) and add FSRS scheduling algorithm (MOM-030/SPIKE-004)
```

## Next task

**MOM-027 — Implement ReviewState migration.** This is the next item in the P2 sequence,
but it is **blocked on explicit human approval** — per D-004, the planner/implementer may
never author a schema migration unattended. Do not start this without the user explicitly
saying to proceed with the migration.

If the human approves MOM-027:
- Add the `ReviewState` model to `apps/api/prisma/schema.prisma` exactly as specified in
  ADR-0002 (polymorphic `objectType`/`objectId`, `@@unique([userId, objectType, objectId])`).
- Run `prisma migrate dev --create-only`, then hand-edit the generated `migration.sql` to
  append the partial index from ADR-0002's SPIKE-003 findings
  (`CREATE INDEX ... WHERE NOT "suspended"`).
- Add the transactional `reviewState.deleteMany()` cleanup to
  `apps/api/src/questions/questions.service.ts`'s `remove()` in the *same* PR (the orphan
  risk ADR-0002 identified), not as a follow-up.
- Wire `apps/api/src/reviews/fsrs-scheduler.ts` (already built, MOM-030) into a new
  `ReviewsModule`/`ReviewsService` with actual Prisma persistence — this becomes MOM-029.

If the human does **not** yet want to approve MOM-027, reasonable alternative next steps
(all still P2/P3, none touch schema):
- Run the Golden Path manually — requires the user to start Docker locally
  (`docker compose up -d && pnpm dev`) since this sandbox has no Docker; I can then drive
  it via curl/API calls once confirmed running.
- MOM-033 — Recommendation reason standardization (marked READY-ish in `BACKLOG.MD`,
  no schema change).

### Allowed files (if MOM-027 is approved)
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**` (new migration only).
- `apps/api/src/questions/questions.service.ts` (orphan cleanup only).
- New `apps/api/src/reviews/reviews.module.ts`, `reviews.controller.ts`,
  `reviews.service.ts`.
- `apps/api/src/app.module.ts` (register the new module).

### Forbidden changes
- Do not touch any other existing migration file.
- Do not change `fsrs-scheduler.ts`'s pure-function signatures without re-running its
  existing test suite.

### After completing
1. Append an entry to `LOG.MD`.
2. Set `NEXT.MD` to MOM-029 (Reviews module API, if not folded into MOM-027) or MOM-031
   (hook answer submission into scheduling).
3. Release any locks in `LOCKS.MD`.
