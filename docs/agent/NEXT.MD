# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> **Major milestone this session: Gate 2 (Learning Loop) is now substantially real**, not
> just designed. `AGENTS.MD`'s priority order (P0 → P1 → P2 → P3) has been worked through
> P2 for the first time.

---

## Session summary (2026-07-05, session 4 — 10 commits)

1. `4a1c1d3` — MOM-035: CodeMirror editor for DSA/coding answers.
2. `53c90ae` — P1 fix: DSA/mission solved-heuristics no longer count `partial` as solved.
3. `d9c41f0` — MOM-026/SPIKE-003 (ReviewState migration design) + MOM-030/SPIKE-004 (FSRS
   scheduling algorithm, pure functions).
4. `0cb4223` — MOM-033: wired `/today` to real recommendations data.
5. `e9cae68` — MOM-038: split `AnswerForm` into per-question-type answer panels.
6. `390dedf` — MOM-079/080: reminders dismissible, surfaced on `/today`.
7. `25cf2e6` — Stale-doc cleanup (MOM-061/081/082 were already done, not marked).
8. `9b88fef` — **MOM-027/029, human-approved**: ReviewState migration applied to a real
   Postgres instance, plus the Reviews module wiring MOM-030's FSRS scheduler to real
   persistence.
9. `6b4cf07` — MOM-031: answer submission now updates the FSRS review schedule.
10. `c401d9b` — MOM-032: due reviews surfaced on `/today`, title-enriched.

**The full loop now genuinely works end to end** (verified via live HTTP round trips
against a real Postgres instance, not just mocked tests): submit a self-rated answer →
`ReviewState` is created/updated via FSRS → it appears in `GET /reviews/due` once its due
time passes → it's shown on `/today` with the question's title → clicking it opens the
question.

**Full verification, all green:** `pnpm lint`/`typecheck`/`test` (65/65)/`build` (32+ web
routes) and `pnpm content:validate` (0 errors).

## What's still NOT done, and why

**Still genuinely blocked:**
- **MOM-028** (attempt reflection fields: missTags/reflectionNote/language/complexity) —
  needs its own small `AnswerAttempt` migration. This is a **different, separate**
  migration decision from tonight's ReviewState one — D-004's human-approval gate applies
  per-migration, not as a blanket "migrations are now OK." Ask before starting this one.
- MOM-063 (Story schema), MOM-069 (AiUsage), MOM-075 (Task consolidation) — same gate,
  separate decisions.
- MOM-021 (deploy), MOM-068+ (AI feedback engine — needs an Anthropic API key), MOM-049
  (LeetCode import), MOM-087 (backup workflow) — credential-gated.

**Not done, but NOT blocked — legitimate next options if asked to keep going:**
- **A single unified priority queue for `/today`** (plan §6.1's fuller vision) — right now
  it's three separately-labeled sections (due reviews, recommendations, reminders), not
  one ranked list. A real but bounded follow-up.
- **A dedicated review-answering UI** — right now "reviewing" a due item just opens
  `/questions/:id` (read-only detail page); a proper flow would let the user re-answer and
  re-rate it, feeding a new `ReviewsService.record()` call. This is probably the more
  valuable next increment for the loop to feel complete.
- **Wiring `spaced_review`** — the web app already has a `spaced_review` session-type
  label with zero backend logic behind it (found this session); could be wired to start a
  session from a batch of due question IDs.
- MOM-039 (reflection panel) is blocked on MOM-028's migration, not on anything else.

### Update: the "review now" action above is now DONE (commit follows this file update)
`reviewsApi.record()` added to `api-client.ts`; `/today`'s due-review cards now have a
"Review now" button expanding an inline 1-5 rating row, calling the existing
`POST /reviews/:objectType/:objectId` directly. Verified live (recorded → became due →
re-rated → immediately disappeared from the due list, rescheduled correctly).

### Genuinely remaining, not blocked, but not yet done
- **Single unified priority queue for `/today`** (plan §6.1's fuller vision — merge
  reviews/recommendations/reminders into one ranked list instead of three sections).
- **Wire `spaced_review`** — the web app has a `spaced_review` session-type label with
  zero backend logic; could pull a batch of due question IDs into an exact-question
  session via the existing `questionIds` support in `CreateSessionDto`.
- MOM-028/039/063/069/075 remain migration-gated (separate decisions from tonight's).
- MOM-021/068+/049/087 remain credential-gated.

### After completing
1. Append an entry to `LOG.MD`.
2. Update this file to point at the next task.
3. Release any locks in `LOCKS.MD`.
