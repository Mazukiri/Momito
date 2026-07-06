# AGENTS.md — Momito Codex Operating Rules

You are working on Momito, a personal Knowledge OS for software engineering interview preparation.

Momito is a pnpm monorepo:

* `apps/web`: Next.js 16, React 19, Tailwind v4
* `apps/api`: NestJS 11, Prisma 6, Postgres
* `packages/shared`: shared TypeScript types/constants
* `docs/plans/MOMITO_REDESIGN_PLAN_V2.md`: product/system plan
* `docs/agent/BACKLOG.md`: task backlog
* `docs/agent/NEXT.md`: current task
* `docs/agent/LOCKS.md`: active path locks
* `docs/agent/DECISIONS.md`: technical/product decisions
* `docs/agent/LOG.md`: implementation log

## Current Strategic State

The repository has already made significant progress on platform foundation, mobile shell, API hardening, PWA setup, content seeds, content coverage, DSA progress, and DSA ladder UI.

However, the product is currently at risk of becoming **data-rich but loop-poor**.

The next priority is not more content and not more UI breadth.

The next priority is to make the core learning loop real:

```text
Today
→ recommended practice/review item
→ session
→ answer
→ reflect
→ self-rate
→ schedule review
→ update progress
→ return to Today
```

Do not add large new features until the ReviewState / FSRS / Today queue path works end-to-end.

## Non-Negotiable Product Invariants

1. Phone-first usability is mandatory.
2. The app must remain usable without AI.
3. Every serious practice attempt must create history.
4. Every reviewable object must eventually have review state.
5. Every serious practice object must have a rubric or evaluation criteria.
6. Progress must be derived from real attempts, not static checkboxes.
7. Today must become a decision engine, not a generic dashboard.
8. Data volume is not enough; content must be validated and usable.
9. No copyrighted LeetCode/NeetCode/problem statement text may be copied into seeds.
10. Every migration must be safe on both fresh DB and existing DB.

## Current Priority Order

Work in this order unless explicitly instructed otherwise:

### P0 — Stabilize truth and build confidence

* Make sure docs truthfully reflect current state.
* Confirm CI/build/type/test/content validation status.
* Fix obvious assumptions that can break local/dev/deploy.
* Do not claim Gate 2 or Gate 3 is complete unless verified.

### P1 — Fix technical risks before new features

Important current risks to address:

1. `DIRECT_URL` / Prisma directUrl assumption must be verified and documented.
2. `aiScore`, `rubricScore`, and `selfRating` score scales must be normalized before AI grading.
3. DSA solved/progress heuristics must not treat partial attempts or mis-scaled AI scores as clean solves.
4. Agent docs should stay readable and accurate.
5. Golden Path must be manually verifiable.

### P2 — Implement Learning Loop

Prioritize:

* ReviewState migration design
* ReviewState migration
* FSRS scheduling service
* reviews module
* answer-submission → review scheduling hook
* dashboard/today API
* Today learning cards

### P3 — Only after core loop works

Then continue:

* AI grading
* story rehearsal
* career engine
* reminders
* further content expansion
* polish

## Forbidden Behavior

Do not do any of the following unless explicitly asked:

* Do not implement an entire phase at once.
* Do not implement multiple backlog tasks in one pass.
* Do not add more content batches before the core learning loop is working.
* Do not rewrite large UI areas opportunistically.
* Do not create destructive migrations without a design note and rollback plan.
* Do not touch service worker caching casually.
* Do not touch auth/session flow casually.
* Do not silently change scoring semantics.
* Do not claim something is complete without verification.
* Do not modify more than 15 files in one task unless you explain why first.
* Do not commit unless explicitly instructed.

## Required Working Mode

Always operate in one of these modes.

### MODE: PLANNER

Use this when selecting or refining the next task.

Rules:

* Do not code.
* Inspect the repo.
* Read `docs/plans/MOMITO_REDESIGN_PLAN_V2.md`.
* Read `docs/agent/BACKLOG.md`.
* Read `docs/agent/NEXT.md`.
* Read `docs/agent/DECISIONS.md`.
* Select exactly one PR-sized task.
* Update `docs/agent/NEXT.md`.

`NEXT.md` must include:

```md
# NEXT — MOM-XXX

Goal:
User-visible outcome:
Allowed files:
Forbidden files:
Dependencies:
Acceptance criteria:
Verification commands:
Manual test:
Rollback note:
Known risks:
```

### MODE: IMPLEMENTER

Use this when coding one task.

Before editing:

1. Read `docs/agent/NEXT.md`.
2. Read `docs/agent/LOCKS.md`.
3. Check `git status`.
4. Inspect all relevant files.
5. Restate current behavior.
6. Explain the minimal diff.
7. Confirm there is no locked-path conflict.

During editing:

* Implement only the task in `NEXT.md`.
* Do not implement future tasks.
* Do not refactor unrelated code.
* Keep changes minimal.
* Preserve existing typed API client patterns.
* Preserve existing route behavior unless the task explicitly changes it.
* Update shared types before frontend/backend consumers when needed.
* For migrations, document fresh DB and existing DB behavior.

After editing:

1. Run the narrowest useful checks first.
2. Run the task verification commands.
3. Update `docs/agent/LOG.md`.
4. Report:

   * files changed;
   * behavior changed;
   * commands run;
   * pass/fail;
   * known risks;
   * suggested commit message.

Do not commit unless explicitly asked.

### MODE: REVIEWER

Use this when reviewing current diff.

Rules:

* Do not code.
* Review `git diff`.
* Compare against `docs/agent/NEXT.md`.
* Check for scope creep.
* Check build/type/runtime risks.
* Check mobile UX risks.
* Check Prisma/migration risks.
* Check security risks.
* Check scoring/progress semantics.
* Check whether docs overclaim completion.

Output:

```md
## BLOCKING

## NON-BLOCKING

## GOOD DECISIONS

## SAFE TO COMMIT?
yes/no
```

### MODE: RELEASE CAPTAIN

Use this before commit/merge.

Rules:

* Do not add features.
* Show `git status`.
* Summarize diff.
* Confirm commands run and results.
* Confirm manual test status.
* Update `docs/agent/LOG.md` if needed.
* Suggest commit message.
* Do not commit unless explicitly asked.

## Required Checks

Use the narrowest checks first, then broader checks.

Common checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm content:validate
```

API-specific checks:

```bash
pnpm --filter @momito/api test
pnpm --filter @momito/api build
pnpm --filter @momito/api exec prisma validate
pnpm --filter @momito/api exec prisma generate
```

Web-specific checks:

```bash
pnpm --filter @momito/web lint
pnpm --filter @momito/web typecheck
pnpm --filter @momito/web build
```

Shared package checks:

```bash
pnpm --filter @momito/shared build
```

Database checks, when schema/seed changes:

```bash
pnpm --filter @momito/api exec prisma migrate dev
pnpm --filter @momito/api exec prisma migrate reset
pnpm db:seed
pnpm content:validate
```

Only run destructive DB commands when safe for the local environment.

## Golden Path Manual Test

After any change touching sessions, reviews, Today, DSA, attempts, or progress, manually verify:

```text
login
→ /today
→ start or open practice
→ answer one item
→ submit attempt
→ record reflection
→ self-rate
→ return to Today
→ progress/review state updates
→ reload
→ state persists
```

If ReviewState is not implemented yet, explicitly say so and verify the closest currently available path:

```text
login
→ /today
→ /practice
→ DSA ladder
→ start session
→ submit answer
→ session summary
→ DSA progress updates if applicable
```

## Scoring Semantics

Do not mix score scales.

Use these semantics unless the codebase has already standardized differently:

```text
selfRating: 1–4 or again/hard/good/easy for FSRS
rubricScore: 0–1 normalized score
aiScore: 0–100 score
outcome:
  solved_clean
  solved_with_hints
  partial
  failed
```

DSA progress should distinguish:

```text
attempted
solvedClean
solvedHints
partial
failed
```

Do not count `partial` as solved clean.

Do not use `aiScore >= 0.6` if `aiScore` is 0–100.

## Prisma and Migration Rules

Before schema changes:

1. Inspect current schema.
2. Inspect existing migrations.
3. Write the intended data model.
4. Explain fresh DB behavior.
5. Explain existing DB migration behavior.
6. Explain rollback risk.

For ReviewState, prefer a polymorphic design unless repo constraints require otherwise:

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

Do not use nullable multi-target relations unless constraints are explicitly tested.

## Service Worker Rules

Service worker changes are high-risk.

Rules:

* production-only registration;
* never cache cross-origin API calls;
* never cache auth responses;
* version caches;
* clean old caches;
* document manual unregister/reload steps for testing.

## AI Rules

AI grading is required eventually, but not before the self-rating/review loop is stable.

Before implementing AI:

1. Verify installed `@anthropic-ai/sdk` APIs.
2. Verify model names.
3. Verify structured output support.
4. Verify response usage token shape.
5. Verify error classes.
6. Implement no-key and over-budget states first.

AI failure must never break practice sessions.

## Content Rules

The repo already has substantial seed content. Do not add more content unless the task is explicitly content-related.

Before adding content:

* run content validation;
* check coverage dashboard;
* avoid duplicate source URLs;
* attach rubrics;
* attach tags;
* preserve provenance;
* avoid copyrighted statements.

Content quality matters more than raw count.

## Documentation Truthfulness

Do not overclaim.

Use these terms carefully:

* “Implemented” means code exists.
* “Verified” means commands/manual path passed.
* “Complete” means acceptance criteria and golden path passed.
* “Near target” means counts are close but quality audit may remain.
* “Blocked” means dependency unresolved.

If docs say Gate 2 or Gate 3 is complete, ensure the corresponding phase gate is actually verified.

## Suggested Immediate Next Work

Unless explicitly overridden, prioritize this sequence:

1. Verify and fix `DIRECT_URL` / Prisma directUrl assumptions.
2. Normalize score scale semantics for `aiScore`, `rubricScore`, `selfRating`, and DSA progress.
3. Run and document current Golden Path.
4. Design ReviewState migration.
5. Implement ReviewState migration.
6. Implement FSRS scheduling service.
7. Implement reviews module.
8. Hook answer submission into review scheduling.
9. Implement dashboard/today API.
10. Replace `/today` stub with real learning queue cards.

No major new feature should leapfrog these.
