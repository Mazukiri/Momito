# ADR-0016: Release-hardening invariants (cron ↔ keep-warm, deploy branch, test tiers)

## Status
**ACCEPTED** — 2026-07-20. Implemented across MOM-173..MOM-178. Decision record: D-024.
Plan: the V2 "Prescriptive OS" roadmap, Epic 0.

## Context
Preparing the first real deployment surfaced four defects that had one thing in common: **each was invisible
from inside `apps/api/src`.** Every one of them depended on a fact that lives somewhere else — a value in
`render.yaml`, a schedule in a GitHub workflow, the state of a git branch, or the absence of a config file.
Reviewing the source would never have found them, and none produced a failing test.

They are recorded together because they will all decay the same way: someone changes one file, the constraint
lives in another, and nothing complains.

## Decision

### 1. Daily cron times and the keep-warm window are one unit
`render.yaml` sets `TZ: UTC`. A bare `@Cron` expression is interpreted in the server's zone, so
`CronExpression.EVERY_DAY_AT_6AM` fired at **13:00** in `Asia/Ho_Chi_Minh`.

The obvious correction is worse than the bug. `.github/workflows/keepwarm.yml` pings `/health` on
`*/10 0-17 * * *` UTC — 07:00 ICT through 00:59 ICT. Render's free tier sleeps the instance outside that
window and an in-process cron **cannot fire while the instance is asleep**. A job moved to 06:00 ICT is 23:00
UTC and would never run at all; the old wrong-hour schedules at least landed inside the window, which is
precisely why they worked.

- All schedules live in `apps/api/src/common/schedule.ts` and pass `{ timeZone }` explicitly.
- Daily jobs start **just after 07:00 local**: interview prep 07:02 → follow-up 07:05 → daily plan 07:10.
  Ordered so the daily plan snapshots inputs the earlier jobs have already produced.
- **`test/schedule.spec.ts` parses the window out of `keepwarm.yml`** rather than restating it, so narrowing
  that workflow fails the test suite instead of silently killing a job.

Corollary for V2: the cron is an optimisation, never the mechanism. `GET /daily-plan/today` must generate
lazily, because a missed tick is never made up.

### 2. `main` is the deploy branch
Neither `render.yaml` nor `apps/web/vercel.json` pins a branch, so Render Blueprint takes the repository
default. `main` had drifted **73 commits** behind the working branch; connecting the Blueprint would have
deployed a pre-CareerOS tree. Resolved by merging rather than pinning: pinning would have left the drift in
place permanently.

**Ship from `main`.** If that ever needs to change, add an explicit `branch:` key rather than relying on the
default, and say so here.

### 3. Tests come in two tiers, and only one may touch a database
Before MOM-178 there was no `vitest.config.ts` and all 40 spec files mocked Prisma by hand, while CI stood up
Postgres, migrated and seeded it — and nothing read from it.

- `*.spec.ts` — unit, mocked, runs everywhere.
- `*.int.spec.ts` — integration, real Postgres. **Required** for anything whose correctness lives in the
  query: uniqueness constraints, ordering, `take`, cascade behaviour. A mock has no constraints, so a
  `@@unique` — which is how the V2 daily-plan generator gets its idempotency — cannot be tested against one
  even in principle.
- The integration tier reads **`TEST_DATABASE_URL`, never `DATABASE_URL`**, and self-skips when unset. It
  `TRUNCATE`s every table; on a developer machine `DATABASE_URL` is real practice history, and the way you
  would discover a fallback is by losing it.

### 4. Seeding may not write the built-in demo login to a real database
Registration closes after the first user (`ALLOW_MULTI_USER_REGISTRATION=false`), `auth.controller.ts` has no
password reset and no recovery path, and production is seeded by hand from a laptop. Skipping the runbook step
that sets `SEED_USER_*` therefore produced an instance whose only account was `demo@momito.local` with a
password committed to a public repository — unchangeable by its owner, reachable by anyone.

`prisma/seed-guard.ts` refuses before any write. **`NODE_ENV` is not the primary signal**: the seed runs from a
machine where `NODE_ENV` is unset against a remote `DATABASE_URL`, so "is the target local" is the question
that matters.

## Consequences
- The three daily jobs now run at a different wall-clock time than they did. That is the point, but the first
  run after deploy shifts.
- Changing `keepwarm.yml`'s hours breaks `schedule.spec.ts` **by design**. Fix the times, do not relax the test.
- Contributors must set `TEST_DATABASE_URL` to run the integration tier. Documented in `apps/api/.env.example`.
- Seeding a remote database now requires explicit credentials. This is deliberate friction on a one-time step.
- Still open: `render.yaml`/`vercel.json` remain unpinned, correct only because `main` is now the truth.
  Pinning is the belt to add if the default branch ever changes.
