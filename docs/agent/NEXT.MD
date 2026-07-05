# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> **Gate 2 (Learning Loop) is now substantially real end to end**, including reflection.
> Two migrations were human-approved and implemented this session (ReviewState, attempt
> reflection fields), each verified with live HTTP round trips against a real Postgres
> instance, not just mocked tests.

---

## Session summary (2026-07-05, session 4 — 13 commits)

1. `4a1c1d3` — MOM-035: CodeMirror editor for DSA/coding answers.
2. `53c90ae` — P1 fix: DSA/mission solved-heuristics no longer count `partial` as solved.
3. `d9c41f0` — MOM-026/SPIKE-003 (ReviewState design) + MOM-030/SPIKE-004 (FSRS algorithm).
4. `0cb4223` — MOM-033: `/today` wired to real recommendations.
5. `e9cae68` — MOM-038: `AnswerForm` split into per-question-type panels.
6. `390dedf` — MOM-079/080: reminders dismissible, surfaced on `/today`.
7. `25cf2e6` — Stale-doc cleanup (MOM-061/081/082 already done).
8. `9b88fef` — **MOM-027/029, human-approved**: ReviewState migration + Reviews module.
9. `6b4cf07` — MOM-031: answer submission updates FSRS review schedule.
10. `c401d9b` — MOM-032: due reviews surfaced on `/today`.
11. `1a6da47` — Inline "Review now" rating action on Today.
12. `1b088b1` — **MOM-028, human-approved**: attempt reflection fields
    (missTags/reflectionNote/language/complexity) migration.
13. `2d09c22` — MOM-039: reflection panel UI.

**Full verification, all green:** `pnpm lint`/`typecheck`/`test` (68/68)/`build` (32+ web
routes)/`content:validate` (0 errors).

**The full loop now works end to end, including reflection:** submit an answer with a
self-rating and optional miss-tags/reflection note → `AnswerAttempt` stores all of it,
`ReviewState` is scheduled via FSRS → it surfaces on `/today` when due, title-enriched →
review it inline (re-rate) or reflect on it further next time → back to Today.

## What's still NOT done, and why

**Migration-gated (separate D-004 decisions from tonight's two):**
- MOM-063 (Story schema), MOM-069 (AiUsage), MOM-075 (Task consolidation).

**Credential-gated:**
- MOM-021 (deploy), MOM-068+ (AI feedback engine — Anthropic API key), MOM-049 (LeetCode
  import), MOM-087 (backup workflow).

**Not blocked, but not yet done — legitimate next options:**
- Single unified priority queue for `/today` (plan §6.1's fuller vision — currently three
  labeled sections, not one ranked list).
- Wiring `spaced_review` (a session-type label with zero backend logic behind it,
  discovered this session) to pull a batch of due question IDs into a session.
- MOM-073/074 (AI feedback card + reflection panel integration) — explicitly **DEFER**red
  per `BACKLOG.MD` until Gate 2 (now substantially done) *and* an Anthropic API key exist.

### After the next task is picked
1. Append an entry to `LOG.MD`.
2. Update this file to point at the next task.
3. Release any locks in `LOCKS.MD`.
