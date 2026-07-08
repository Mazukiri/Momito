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
| _(none)_ | | | | |

## Released locks

| Task | Owner | Files / globs | Released (UTC) |
|------|-------|---------------|----------------|
| MOM-112 | CLAUDE | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/interview-rounds/interview-rounds.service.ts`, `apps/api/test/interview-rounds.service.spec.ts`, `docs/agent/*.MD` | 2026-07-09 |
| MOM-111 | CLAUDE | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/interview-rounds/**`, `apps/web/app/lib/api-client.ts`, `apps/web/app/components/InterviewRoundsCard.tsx`, `apps/api/test/interview-rounds.service.spec.ts`, `docs/agent/*.MD` | 2026-07-09 |
| MOM-130 | CLAUDE | `apps/api/src/career/**`, `apps/api/src/weaknesses/weaknesses.service.ts`, `packages/shared/src/index.ts`, `apps/web/app/lib/api-client.ts`, `apps/web/app/components/JobReadinessCard.tsx` (new), `apps/web/app/(authenticated)/jobs/[id]/page.tsx`, `apps/api/test/career.service.spec.ts`, `docs/agent/*.MD` | 2026-07-09 |
| MOM-129 | CLAUDE | `apps/api/src/readiness/**` (new), `apps/api/src/career/**`, `apps/api/src/missions/missions.service.ts`, `apps/api/src/missions/missions.module.ts`, `packages/shared/src/index.ts`, `apps/api/test/{readiness,career}.service.spec.ts` (new), `docs/agent/*.MD` | 2026-07-09 |
| MOM-142 | CLAUDE | `apps/api/src/recommendations/recommendations.service.ts`, `apps/api/test/recommendations.service.spec.ts`, `docs/agent/*.MD` | 2026-07-09 |
| MOM-128 | CLAUDE | `apps/api/src/sessions/sessions.service.ts`, `apps/api/test/sessions.service.spec.ts`, `docs/agent/*.MD` | 2026-07-09 |
| MOM-113 | CLAUDE | `apps/api/src/interview-rounds/interview-rounds.service.ts`, `apps/api/src/interview-rounds/interview-rounds.module.ts`, `apps/api/test/interview-rounds.service.spec.ts`, `docs/agent/*.MD` | 2026-07-09 |
| MOM-110 | CLAUDE | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/interview-rounds/**` (new), `apps/api/src/app.module.ts`, `apps/api/test/interview-rounds.service.spec.ts` (new), `packages/shared/src/index.ts`, `apps/web/app/lib/api-client.ts`, `apps/web/app/(authenticated)/jobs/[id]/page.tsx`, `docs/agent/*.MD` | 2026-07-09 |
| MOM-127 | CLAUDE | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/weaknesses/**`, `apps/api/src/sessions/sessions.service.ts`, `apps/api/test/{weaknesses,sessions}.service.spec.ts`, `packages/shared/src/index.ts`, `apps/web/app/lib/api-client.ts`, `docs/**` | 2026-07-09 |
| MOM-065 | CLAUDE | `apps/web/app/(authenticated)/stories/page.tsx` (new), `apps/web/app/lib/navigation.ts`, `docs/agent/*.MD` | 2026-07-06T02:35:00Z |
| MOM-066 | CLAUDE | `packages/shared/src/index.ts`, `apps/api/src/stories/**`, `apps/api/test/stories.service.spec.ts`, `apps/web/app/lib/api-client.ts`, `apps/web/app/(authenticated)/questions/[id]/page.tsx`, `docs/agent/*.MD` | 2026-07-06T02:50:00Z |
| MOM-067 | CLAUDE | `apps/api/src/reviews/reviews.service.ts`, `apps/api/test/reviews.service.spec.ts`, `apps/web/app/(authenticated)/stories/page.tsx`, `apps/web/app/(authenticated)/today/page.tsx`, `docs/agent/*.MD` | 2026-07-06T03:10:00Z |
| Content gap fill + stale-backlog sweep | CLAUDE | `apps/api/prisma/seed-data.ts`, `README.md`, `docs/agent/BACKLOG.md` | 2026-07-06T03:20:00Z |
| MOM-087 | CLAUDE | `.github/workflows/backup.yml` (new), `docs/adr/0006-backup-strategy.md` (new), `docs/runbooks/backup-restore.md` (new), `docs/agent/BACKLOG.md` | 2026-07-06T03:35:00Z |
| MOM-063/064 | CLAUDE | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/stories/**` (new), `apps/api/src/app.module.ts`, `packages/shared/src/index.ts`, `docs/adr/0005-story-bank-schema.md`, `apps/web/app/lib/api-client.ts`, `docs/agent/*.MD` | 2026-07-06T02:10:00Z |
| MOM-075/076/077 | CLAUDE | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/tasks/**`, `apps/api/src/study-plan/**` (removed), `apps/api/src/app.module.ts`, `packages/shared/src/index.ts`, `apps/web/app/lib/api-client.ts`, `apps/web/app/(authenticated)/study-plan/page.tsx`, `docs/agent/*.MD` | 2026-07-06T01:15:00Z |
| Backlog reality cleanup + MOM-080 top-bar bell | CLAUDE | `docs/agent/BACKLOG.md`, `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD`, `apps/web/app/(authenticated)/layout.tsx`, `apps/web/app/components/ReminderBell.tsx` | 2026-07-06T00:20:00Z |
| MOM-003 | CODEX | `backend/**`, `mobile/**`, `archive/**`, `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD` | 2026-07-04T20:20:58Z |
| MOM-001 | CODEX | git snapshot refs; `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD` bookkeeping | 2026-07-04T20:15:52Z |
| MOM-002 (planning) | CLAUDE (orchestrator) | `docs/agent/*.md` | 2026-07-05 |
| MOM-005 | CLAUDE | `docs/adr/000X-*.md`, `docs/agent/DECISIONS.MD` (cross-link only) | 2026-07-05 |
| MOM-035 | CLAUDE | `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/app/components/CodeEditor.tsx`, `apps/web/app/components/session/AnswerForm.tsx` | 2026-07-05 |
| Dark-mode final cleanup | CLAUDE | `apps/web/app/(authenticated)/attempts/[id]/page.tsx`, `apps/web/app/(authenticated)/study-plan/page.tsx`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:15:34Z |
| MOM-043 | CLAUDE | `apps/api/prisma/seed.ts`, `apps/api/prisma/seed-data.ts`, `apps/api/scripts/content-*.ts`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:19:07Z |
| MOM-044 | CLAUDE | `apps/api/prisma/seed.ts`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:20:37Z |
| MOM-048 | CLAUDE | `apps/api/prisma/seed-data.ts`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:23:17Z |
| MOM-056 | CLAUDE | `apps/api/prisma/seed-data.ts`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:25:00Z |
| MOM-050 (already implemented) | CLAUDE | `apps/api/src/dsa/**`, `apps/api/test/dsa.service.spec.ts`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:26:15Z |
| MOM-083 | CLAUDE | `apps/api/src/jobs/jobs.service.ts`, `apps/api/test/jobs.service.spec.ts`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:28:50Z |
| MOM-004 | CLAUDE | `README.md`, `docs/agent/LOG.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T10:30:28Z |
| Spaced review sessions | CLAUDE | `apps/api/src/sessions/sessions.service.ts`, `apps/api/test/sessions.service.spec.ts`, `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T13:19:48Z |
| Spaced review frontend follow-up | CLAUDE | `apps/web/app/(authenticated)/practice/new/page.tsx`, `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD` | 2026-07-05T13:23:39Z |

## Standing "hands-off" zones (never claim without an explicit, human-approved task)

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/**` — migration tasks are
  spike-gated and require human approval (see `DECISIONS.md` D-004).
- `backend/**`, `mobile/**` — legacy; only MOM-003 may move them (move, never delete).
- `docs/plans/**` — the source plan is read-only input.
