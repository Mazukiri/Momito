# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> `AGENTS.MD` was rewritten with a stricter operating protocol and a new priority order:
> P0 (stabilize truth) → P1 (fix named technical risks) → P2 (Learning Loop/ReviewState/
> FSRS) → P3 (everything else, including further content/UI work). Read `AGENTS.MD` in
> full before picking up more work — it supersedes the older content-expansion cadence
> this backlog was running under.

---

## Current state (2026-07-05, session 4)

**P1 risk-check results** (see `LOG.MD` for full detail):
1. `DIRECT_URL` — already correctly configured in `.env`, `.env.example`, and documented
   in README's env var table. **No change needed.**
2. `aiScore`/`rubricScore`/`selfRating` scale audit — `rubricScore` (0–1) and `selfRating`
   (1–5) are DTO-enforced and read consistently everywhere; no active bug. `aiScore` has
   no writer anywhere (AI grading is unimplemented/credential-gated) — its `>= 0.6` reads
   are inert today, but **remain a landmine**: whoever implements AI grading must decide
   `aiScore`'s scale (AGENTS.MD says 0–100) and fix `missions.service.ts:532`,
   `dsa.service.ts`, and `career.service.ts`'s threshold checks together, in the same
   change that adds the writer.
3. **Fixed (both sites):** `apps/api/src/dsa/dsa.service.ts` and
   `apps/api/src/missions/missions.service.ts:532` both counted a `correctness: 'partial'`
   answer attempt as *solved*/*positive* (it's a live, reachable DTO value —
   `@IsIn(['correct', 'partial', 'incorrect'])`), contradicting the explicit "do not count
   partial as solved clean" rule. Both now only treat `'correct'`/`'strong'` correctness as
   a positive signal; partial attempts still count as *attempted* (DSA) or are simply
   excluded from mission-evidence matching (missions). `career.service.ts`'s
   `isPositiveAttempt` already excluded `'partial'`, so all three call sites are now
   consistent. Added a regression test for the DSA case (no existing test covered
   `matchesAttempt`). **Not yet committed** — `AGENTS.MD` says not to commit without being
   explicitly told to; ask the user before committing this (and note MOM-035's CodeMirror
   commit already happened earlier in this session, before this file was read).
4. **Golden Path manual verification — blocked in this environment.** Docker Desktop is
   not running in this sandbox, so there is no live Postgres to exercise
   register → login → practice → answer → summary → progress update against. This needs
   to be run by whoever has Docker available locally (`docker compose up -d`, `pnpm dev`,
   then walk the path in AGENTS.MD's "closest currently available path" section since
   ReviewState/Today don't exist yet). Do not claim this is verified until someone actually
   runs it.

## Next task once resumed

Two reasonable next steps, not yet started — pick one explicitly rather than assuming:

**Option A (recommended by AGENTS.MD's stated order): ReviewState migration *design*.**
A design-only task (no `schema.prisma` edit — that stays human-approval-gated per D-004):
write a short design note (`docs/adr/000X-review-state.md` or similar) proposing the
polymorphic `ReviewState` model AGENTS.MD sketches, covering fresh-DB behavior,
existing-DB migration behavior, and rollback risk, so a human can approve the actual
migration task with a concrete plan in hand rather than from scratch.

**Option B: Run the Golden Path manually.** Requires Docker; not something I can do
unattended in this sandbox. If the user runs `docker compose up -d && pnpm dev` and
confirms it's up, I can drive the API calls (register/login/session/answer/summary) via
curl to verify and document the closest-available path end-to-end.

### Allowed files (Option A)
- New `docs/adr/000X-review-state-design.md` (or append to `docs/agent/DECISIONS.MD`).
- No `schema.prisma`, no migration files, no service code.

### Forbidden changes
- Do not touch `apps/api/prisma/schema.prisma` or `apps/api/prisma/migrations/**` — design
  only, per the standing hands-off zone in `LOCKS.MD`.

### After completing
1. Append an entry to `LOG.MD`.
2. Get human approval before starting the actual ReviewState migration task.
3. Release any locks in `LOCKS.MD`.
