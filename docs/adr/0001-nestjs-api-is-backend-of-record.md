# ADR-0001: NestJS `apps/api` is the backend of record

## Status
Accepted — 2026-07-05

## Context
The redesign plan (`docs/plans/MOMITO_REDESIGN_PLAN_V2.md`) instructs archiving "the Python
backend." Repo inspection during planning found two backend-shaped directories at the root:

- `backend/` — a Python project (uv-managed, `alembic.ini`, FastAPI-style `app/`).
- `apps/api/` — a NestJS 11 + Prisma 6 + PostgreSQL service with modules for auth, questions,
  sessions, attempts, dashboard, career, jobs, missions, learning, profile, tasks, topics,
  companies, and recommendations, wired into the pnpm workspace (`pnpm-workspace.yaml` globs
  `apps/*` and `packages/*` only) and exercised by `.github/workflows/ci.yml`.

There is also a root `mobile/` directory (Expo/React Native) with no corresponding entry in the
pnpm workspace and no CI coverage, alongside the actively developed `apps/web` (Next.js) app.

Only one backend and one client stack can be the target of ongoing implementation work without
violating the "no broad rewrites" and "one PR-sized task at a time" engineering invariants.

## Decision
`apps/api` (NestJS) is the backend of record. `apps/web` (Next.js) is the client of record.
`packages/shared` (zod-based types) is the shared contract layer between them.

`backend/` (Python) and `mobile/` (Expo) are legacy. They are **archived, not deleted** —
moved under `archive/` by task MOM-003, preserving full git history (`git log --follow`). No
implementation task may target `backend/` or `mobile/` going forward; any plan language that
refers to "the backend" or "the mobile app" is re-read as `apps/api` and `apps/web` respectively.

## Consequences
- All API-layer plan tasks (security baseline, health endpoint, review engine, AI grading,
  career engine, etc.) are implemented in `apps/api`.
- All UI-layer plan tasks (mobile-first shell, `/today`, PWA) are implemented in `apps/web`;
  there is no separate native mobile track — "phone usability" means a mobile-first responsive
  PWA, not the Expo app.
- Removing `backend/`/`mobile/` outright is out of scope for any task unless explicitly
  re-approved later; MOM-003 only moves them so the history and rollback path are preserved.
- CI, deploy, and env-var documentation (MOM-004/README rewrite) describe `apps/api` +
  `apps/web` + `packages/shared` only.

## Related
- `docs/agent/DECISIONS.MD` — D-001
- `docs/agent/BACKLOG.MD` — MOM-003 (archive), MOM-004 (README rewrite)
