# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> `AGENTS.MD` sets the priority order: P0 (stabilize truth) → P1 (fix named technical
> risks) → P2 (Learning Loop: ReviewState/FSRS/Today) → P3 (everything else). As of this
> update, **every remaining backlog item is blocked on one of three things this agent
> cannot resolve unattended** — see below. This is not a stopping point chosen out of
> laziness; it's the actual state after a systematic sweep (see `LOG.MD`'s final entry for
> 2026-07-05).

---

## Session summary (2026-07-05, session 4 — 6 commits)

1. `4a1c1d3` — MOM-035: CodeMirror editor for DSA/coding answers.
2. `53c90ae` — P1 fix: DSA/mission solved-heuristics no longer count
   `correctness: 'partial'` as solved.
3. `d9c41f0` — MOM-026/SPIKE-003 (ReviewState migration design finalized) + MOM-030/
   SPIKE-004 (FSRS scheduling algorithm, pure functions, no persistence yet).
4. `0cb4223` — MOM-033: wired `/today` to real recommendations data.
5. `e9cae68` — MOM-038: split `AnswerForm` into per-question-type answer panels.
6. `390dedf` — MOM-079/080: reminders are now dismissible from the UI and surfaced on
   `/today`; MOM-078 resolved as no-scheduler-needed.

Plus doc-only corrections for three backlog entries that were stale (already done in
earlier sessions but not marked): MOM-061 (role tracks), MOM-081 (jobs mobile list),
MOM-082 (career hub).

**Full verification, all green:** `pnpm lint`/`typecheck`/`test`/`build` (3/3 projects,
56/56 tests, 32 web routes) and `pnpm content:validate` (0 errors).

## Why there's no next task queued

Every open backlog item now falls into one of three gated categories:

**1. Needs human approval for a schema migration (D-004 — hard rule, cannot be
self-authorized regardless of how much autonomy is otherwise granted):**
- **MOM-027** — Implement ReviewState migration. Fully designed (ADR-0002 + SPIKE-003
  answered), FSRS algorithm ready (MOM-030) — just needs the migration itself approved.
  This is the single highest-value next step once approved; it unblocks MOM-029, 031, 032,
  039, and the entire Gate 2 learning loop.
- MOM-063 (Story schema), MOM-069 (AiUsage), MOM-075 (Task consolidation) — same gate.

**2. Needs credentials/external services this agent doesn't have:**
MOM-021 (deploy), MOM-068+ (AI feedback engine, needs an Anthropic API key), MOM-049
(LeetCode import), MOM-087 (backup workflow).

**3. Needs a running Docker/Postgres instance, unavailable in this sandbox:**
MOM-090 (final golden-path verification) — the API/web code is ready to test, there's
just no live database here to exercise it against.

## If the user wants to unblock more work

- **Approve MOM-027** and I'll implement the ReviewState migration + wire the FSRS
  scheduler into a real `ReviewsModule`, per ADR-0002's already-finalized plan.
- **Start Docker locally** (`docker compose up -d && pnpm dev`) and confirm it's running,
  and I can drive the Golden Path via curl/API calls to verify and document it.
- **Provide an Anthropic API key** (as an env var, not pasted in chat) to unblock the AI
  feedback engine spike (MOM-068).
- Otherwise, flag any specific area to focus on — there may be polish-tier UI work not
  yet catalogued as its own backlog line that's worth a closer look.

### After the next task is picked
1. Append an entry to `LOG.MD`.
2. Update this file to point at the following task.
3. Release any locks in `LOCKS.MD`.
