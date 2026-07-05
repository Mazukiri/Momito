# LOCKS

> Coordination between concurrent agents. Before editing files for a task, claim them here.
> Release on merge/abandon. A file may appear in at most one active lock. Overlapping claims =
> stop and coordinate.

## How to use
1. Before starting a task, add a row with the task ID, the glob(s) you will touch, owner, and time.
2. Do not edit files locked by another active owner.
3. On completion, move the row to "Released".

## Active locks

| Task | Owner | Files / globs | Claimed (UTC) | Notes |
|------|-------|---------------|---------------|-------|
| _none_ | - | - | - | No active implementation locks. |

## Released locks

| Task | Owner | Files / globs | Released (UTC) |
|------|-------|---------------|----------------|
| MOM-003 | CODEX | `backend/**`, `mobile/**`, `archive/**`, `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD` | 2026-07-04T20:20:58Z |
| MOM-001 | CODEX | git snapshot refs; `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD` bookkeeping | 2026-07-04T20:15:52Z |
| MOM-002 (planning) | CLAUDE (orchestrator) | `docs/agent/*.md` | 2026-07-05 |
| MOM-005 | CLAUDE | `docs/adr/000X-*.md`, `docs/agent/DECISIONS.MD` (cross-link only) | 2026-07-05 |
| MOM-035 | CLAUDE | `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/app/components/CodeEditor.tsx`, `apps/web/app/components/session/AnswerForm.tsx` | 2026-07-05 |

## Standing "hands-off" zones (never claim without an explicit, human-approved task)

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/**` — migration tasks are
  spike-gated and require human approval (see `DECISIONS.md` D-004).
- `backend/**`, `mobile/**` — legacy; only MOM-003 may move them (move, never delete).
- `docs/plans/**` — the source plan is read-only input.
