# LOG

> Append-only execution journal. Newest entries on top. Every implementer PR adds an entry:
> task ID, files changed, checks run, result, risks/follow-ups.

---

## 2026-07-05 - MOM-003 archive legacy Python backend and Expo mobile

**Actor:** CODEX
**Action:** Moved legacy `backend/` and `mobile/` trees under `archive/` using `git mv`; added `archive/README.md` documenting inactive legacy status. No active `apps/*` source, schema, migration, or dependency files were edited for this task.

**Files changed:**
- `backend/**` -> `archive/backend/**`
- `mobile/**` -> `archive/mobile/**`
- `archive/README.md`
- `docs/agent/LOCKS.MD` and `docs/agent/LOG.MD` bookkeeping

**Checks run:**
- `rg "mobile/|backend/" justfile docker-compose.yml` - no matches
- root/archive path existence checks - root paths absent, archive paths present
- `pnpm build` - passed outside sandbox after sandbox `spawn EPERM`
- `git log --oneline -5 --follow -- archive/backend/pyproject.toml` - no output before commit; expected until staged rename is committed

**Result:** Implementation is staged but not committed because `AGENTS.MD` says not to commit unless explicitly asked. `NEXT.MD` remains on **MOM-003** until commit/final verification completes.

**Risks / follow-ups:**
- Commit with `chore(repo): archive legacy python backend and expo mobile`, then rerun `git log --follow archive/backend/pyproject.toml` after commit.

---

## 2026-07-05 - MOM-001 snapshot current repo state

**Actor:** CODEX
**Action:** Captured the dirty repository state as the pre-redesign-v2 safety baseline.

**Files changed:** One snapshot commit containing the existing dirty app/API/web/shared changes, agent docs, plan docs, ADR replacement, prompt files, and dependency/schema/migration changes already present before implementation work.

**Checks run:**
- `git status --short --ignored`
- `git diff --cached --name-only`
- `git diff --cached --stat`
- staged generated/local file scan for `node_modules/`, `dist/`, `.next/`, coverage, and `.env*`
- `git tag --list pre-redesign-v2`
- `git branch --list "safety/*"`
- `git log --oneline -3`
- `git stash list`
- `git show pre-redesign-v2 --stat --oneline`

**Result:** Complete. Snapshot commit `680934b` created with annotated tag `pre-redesign-v2` and branch `safety/pre-redesign-v2` pointing to the same commit. Tracked working tree was clean after commit; ignored local artifacts remain ignored.

**Risks / follow-ups:**
- Plain Git read commands on this Windows sandbox sometimes leave a stale `.git/index.lock`; read-only checks should use `GIT_OPTIONAL_LOCKS=0` here.

---

## 2026-07-05 — MOM-005 (CLAUDE IMPLEMENTER mode)

**Actor:** CLAUDE (implementer)
**Task:** MOM-005 — Architecture doctrine ADRs.

**Pre-check:** Read `docs/agent/LOCKS.MD`, claimed `docs/adr/000X-*.md` +
`docs/agent/DECISIONS.MD` (cross-link only). Confirmed dependency MOM-002 already satisfied.
MOM-001 (git snapshot) and MOM-003/004 (owner EITHER/CODEX) are untouched by this task, as
required — this task has no dependency on a clean tree. Note: `docs/adr/` was empty on disk
(the 8 pre-existing ADR files show as deleted in the working tree per current `git status`,
unrelated to this task); new ADRs were numbered 0001–0004 fresh rather than reusing old numbers.

**Files changed:**
- `docs/adr/0001-nestjs-api-is-backend-of-record.md` (new)
- `docs/adr/0002-reviewstate-polymorphic-object-reference.md` (new)
- `docs/adr/0003-learning-engine-coexists-with-mission-engine.md` (new)
- `docs/adr/0004-no-copyrighted-problem-statements-in-seeds.md` (new)
- `docs/agent/DECISIONS.MD` (added `**ADR:**` cross-link line to D-001, D-005, D-006, D-008)
- `docs/agent/LOCKS.MD` (claim + release bookkeeping)

**Checks run:** None applicable — docs-only change, no build/lint/typecheck/test surface
touched. Manually verified each ADR maps to its `DECISIONS.md` entry and that relative links
(`../adr/...`) resolve from `docs/agent/`.

**Result:** MOM-005 complete. 4 ADRs recorded (backend of record, ReviewState polymorphism,
Mission-engine coexistence, no-copyrighted-content) with context/decision/consequences, each
cross-linked from `DECISIONS.md`.

**Risks / follow-ups:**
- ADR-0002 and ADR-0004 describe *design* decisions for not-yet-built systems (`ReviewState`,
  content pipeline); they constrain future implementers but do not themselves unblock
  MOM-026/027/069/075 (still SPIKE + human-approval gated per D-004).
- MOM-004 (README rewrite) remains BLOCKED on MOM-003 (archive legacy backend/mobile, owner
  EITHER/CODEX) and was intentionally not started.
- MOM-001 (git snapshot) is still outstanding; the working tree remains dirty. This is owned by
  EITHER (Codex per current task split) and was intentionally left alone.

---

## 2026-07-05 — Orchestration pass (PLANNER mode)

**Actor:** CLAUDE (orchestrator)
**Action:** Converted `docs/plans/MOMITO_REDESIGN_PLAN_V2.md` into a repo-grounded, PR-sized backlog.
No code written; no app source, schema, or migration touched.

**Inspected:**
- Monorepo layout — pnpm workspaces: `apps/api` (NestJS 11 + Prisma 6), `apps/web` (Next 16.2.9,
  React 19, Tailwind v4), `packages/shared` (zod). Legacy `backend/` (Python) + `mobile/` (Expo).
- `apps/api/prisma/schema.prisma` (full model set), `main.ts`, module list, `.github/workflows/ci.yml`.
- `apps/web` route tree, `(authenticated)/layout.tsx`, `package.json` deps.
- Git state: single commit `8c52d59` on `main`; **56 uncommitted modified files**.

**Key findings (see `DECISIONS.md`):**
- Backend of record is NestJS `apps/api`, not the Python `backend/` (D-001).
- Security baseline already covers validation/prefix/CORS; only helmet+throttling remain (D-002).
- Reflection fields, rich `Task`, and `Reminder` already exist; verify-before-migrate (D-003).
- No `ReviewState`/`WeaknessSignal`/`AiUsage`/`Story`/`RoleTrack` models — net-new, migration-gated (D-004/005).
- A large Mission/WeeklyPlan/PlanItem + Readwise engine exists and is unmentioned by the plan;
  FSRS loop must coexist, not rewrite (D-006).
- No `/today` route; mobile nav is `hidden sm:flex` (no mobile navigation at all).

**Produced:**
- `docs/agent/BACKLOG.md` — full backlog: 90 MOM tasks across tracks A–K, 8 spikes, 6 gates; first
  10 tasks expanded to full template; rest summarized as epics with realistic statuses.
- `docs/agent/NEXT.md` — active task set to **MOM-001** (snapshot repo).
- `docs/agent/LOCKS.md` — no active locks; hands-off zones (schema, legacy, plans) defined.
- `docs/agent/DECISIONS.md` — D-001..D-009.
- `docs/agent/LOG.md` — this entry.

**Checks run:** none (planning only — no build/test surface changed).

**Result:** Backlog ready. Next executable task = **MOM-001**.

**Risks / follow-ups:**
- Working tree is dirty (56 files) — MOM-001 must land before any implementer work.
- Filenames on disk use mixed case (`NEXT.MD`, `LOCKS.MD`, `DECISIONS.MD`, `LOG.MD`, `BACKLOG.md`);
  harmless on Windows but normalize to lowercase `.md` in a later docs pass if Linux CI ever reads them.
- Migration-bearing tasks (MOM-026/027, 063, 069, 075) require a human approval step before any
  `prisma migrate` runs.
