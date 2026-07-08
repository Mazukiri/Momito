# Momito v2 — Execution Backlog

> Orchestrator/Planner output. Converts `docs/plans/MOMITO_REDESIGN_PLAN_V2.md` into a
> PR-sized, repo-grounded backlog. **No code has been written.** This file is the source of
> truth for what to build next; `NEXT.MD` holds the single active task.
>
> Generated: 2026-07-05 · Plan: MOMITO_REDESIGN_PLAN_V2 · Repo HEAD: `8c52d59` (single commit, dirty tree)
> Audit update: 2026-07-05, Codex backlog audit. Source code remains untouched.

---

## 0. Repo reality snapshot (why the plan is not taken at face value)

The plan was written against assumptions that the repo has already partly outgrown. Inspection findings:

| Plan assumption | Repo reality | Consequence |
|---|---|---|
| "Archive Python backend + Expo mobile" | Legacy `backend/` (Python/uv/alembic) and `mobile/` (Expo) **still present**; the *live* backend is `apps/api` (NestJS 11 + Prisma 6). | Archive targets confirmed. Live API is NestJS, not Python. |
| Add API security baseline (validation, prefix, CORS) | `apps/api/src/main.ts` **already** sets `api/v1` prefix, CORS via `common/config`, strict `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`). | Baseline task narrows to **helmet + throttling + exception filter**, not validation. |
| Add reflection fields to attempts | `AnswerAttempt` **already** has `selfRating`, `aiScore`, `aiFeedback`, `correctness`, `confidence`, `timeSpentSeconds`, `hintUsed`, `rubricScore`, `needsReview`. | MOM-028 shrinks to *miss-tags/reflection-note* gaps only; verify before migrating. |
| Merge StudyPlanItem → Task | `Task` is **already** the rich consolidated model (`plannedFor`, `dueDate`, `recurrence`, `reminderOffsetMinutes`, `snoozedUntil`); `StudyPlanItem` still exists in parallel. | Consolidation is a data-migration task, target model already exists. |
| Add Reminder system | `Reminder` model **already exists** with `Task`/`JobApplication` relations, plus task/job reminder creation and reminder list/dismiss endpoints. | MOM-078/079 narrow to due-delivery semantics, scheduler choice, API gaps, tests, and UI integration. |
| Knowledge kernel fields | `Question` already has `rubric` (Json), `roleTags`, `areaTags`, `patternTags`, `sourceUrl`, `referenceAnswer`, `estimatedMinutes`, `importance`. | Kernel work is type/service layer, not schema churn. |
| ReviewState / FSRS exists somewhere | **No `ReviewState`, `WeaknessSignal`, `AiUsage`, `Story`, `RoleTrack` models.** | Those are genuinely net-new (migrations → spike-gated). |
| Web has a Today dashboard + design system | **No `/today` route** (only `/dashboard`); nav is `hidden sm:flex` (**no mobile nav at all**); no shadcn, CodeMirror, markdown renderer, or PWA manifest/service worker. | Mobile shell + Today are real, high-value, net-new. |
| — | A large **Mission / WeeklyPlan / PlanItem / MissionCompetencyState** engine and a **Readwise learning** engine exist and are **not mentioned in the plan**. | This is the "product sprawl" the plan warns about. FSRS learning engine must sit *alongside* it, not fight it. See `DECISIONS.md` D-006. |

**Stack of record:** pnpm workspaces — `apps/api` (NestJS 11, Prisma 6, Postgres), `apps/web` (Next 16.2.9, React 19, Tailwind v4, no component lib yet), `packages/shared` (zod types). CI at `.github/workflows/ci.yml` runs lint→typecheck→test→build with a Postgres service + `migrate deploy` + seed.

**Missing deps** the plan implies: `helmet`, `@nestjs/throttler`, `ts-fsrs`, `@anthropic-ai/sdk`, `next-pwa`/`serwist`, `@codemirror/*`, `react-markdown`. Each is introduced by the task that first needs it, verified against installed versions (see spikes).

**Audit corrections (2026-07-05):**
- `AGENTS.MD` references `docs/plans/momito-redesign-v2.md`, but the real file is `docs/plans/MOMITO_REDESIGN_PLAN_V2.md`; future prompts should use the real path.
- Agent docs are mixed-case on disk (`NEXT.MD`, `LOCKS.MD`, `DECISIONS.MD`, `LOG.MD`). On Windows this is harmless, but Linux tooling must reference the actual names or a separate docs-only normalization task must rename them deliberately.
- Dirty-tree counts are not a stable acceptance criterion. MOM-001 must snapshot the current reviewed dirty tree, after inspecting the staged file list, rather than relying on the earlier "56 files" count.
- Reminder work is partly implemented already: `GET /api/v1/reminders`, `POST /api/v1/reminders/:id/dismiss`, task due reminders, job deadline reminders, and dashboard reminder summaries exist. MOM-078/079 must focus on due-delivery gaps, scheduler semantics, tests, and UI integration, not recreating the API.
- `PracticeRecommendationResponse.reason` already exists and `RecommendationsService` already returns reasons. MOM-033 is a standardization/queue-integration task, not a new-field task.
- Role tracks already exist as shared constants (`CAREER_ROLE_TRACKS`) with 4 tracks, while the plan target is 8. MOM-061 should extend/validate constants first; a `RoleTrack` table is migration-gated and not the default.

---

## 1. Status legend

- **READY** — repo-grounded, dependencies met, safe to implement now.
- **NEEDS_SPIKE** — an unknown must be de-risked first (see §5 Spikes).
- **NEEDS_REPO_INSPECTION** — implementer must restate current behavior of named files before editing.
- **BLOCKED** — waits on a listed dependency.
- **DEFER** — intentionally not now (kill/defer rule); revisit after its gate.

Owner: **CLAUDE**, **CODEX**, or **EITHER**.

Owner audit:
- **CLAUDE-owned:** planning, backlog/ADR/decision work, migration design docs, product-scope decisions, and external-service spikes.
- **CODEX-owned:** narrow implementation tasks after scope is pinned, especially API/web/shared code with tests and verification.
- **EITHER:** git safety/release-captain work and small docs tasks that do not require product architecture decisions.

Global verification / forbidden-file defaults:
- Every implementation task may update `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, and `docs/agent/LOCKS.MD` for bookkeeping only, even when not repeated in Allowed files.
- Unless a task explicitly allows them, forbidden files are: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, dependency manifests/lockfiles, `docs/plans/**`, generated output, and unrelated app source.
- Tasks touching API/web/shared source should run their scoped lint/typecheck/test/build where available, then the relevant root CI-equivalent command before handoff (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) unless blocked and documented.
- Dependency tasks must include the corresponding manifest and `pnpm-lock.yaml` in Allowed files and verify the lockfile was intentionally changed.

---

## 2. Phase gates (must pass in order)

1. **Gate 1 — Phone Foundation:** login on phone, `/today` route, bottom tabs, deploy, health endpoint, installable.
2. **Gate 2 — Learning Loop:** session → answer → reflect → rate → ReviewState updates → Today queue updates.
3. **Gate 3 — Data Depth:** DSA 150, CS 150, sysdesign 25, behavioral 60, companies 20, tracks 8, 100% rubric coverage, `content:validate` green.
4. **Gate 4 — AI Feedback:** grade-with-key, no-key path, budget-exceeded path, stored feedback renders, zero network in tests.
5. **Gate 5 — Career Engine:** jobs, reminders, career hub, job-linked prep.
6. **Gate 6 — Production:** backup, restore docs, Lighthouse, a11y, final golden paths.

---

## 3. The first 10 executable tasks (detailed)

> Ordered for safety and unblocking value. Each is one PR. `NEXT.MD` always mirrors the top **READY** task not yet started. Task template per plan §14.

### MOM-001 — Snapshot current repo state · **DONE** (verified 2026-07-06: `git tag --list` shows `pre-redesign-v2`, `git branch --list "safety/*"` shows `safety/pre-redesign-v2`, both present; stale READY status) · EITHER
- **Goal:** Establish a clean, recoverable git baseline before any redesign work.
- **User-visible outcome:** None directly; guarantees every later change is revertable.
- **Allowed files:** git only - `git add -A`, commit, annotated tag/branch. No file *content* edits before the snapshot except an optional `.gitignore` touch-up if build artifacts are staged. After the snapshot, `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, and `docs/agent/LOCKS.MD` may be updated for bookkeeping only.
- **Forbidden changes:** Any app source, schema, or dependency. Do not delete `backend/` or `mobile/`.
- **Dependencies:** none.
- **Acceptance criteria:**
  - Working tree is clean (`git status --short` empty) after the commit.
  - A recovery ref exists: tag `pre-redesign-v2` **and** branch `safety/pre-redesign-v2` both point at the snapshot commit.
  - The current pre-existing dirty tree is captured in one commit with a descriptive message; no generated/ignored artifacts (`node_modules/`, `dist/`, `.next/`, coverage, local env files) added.
  - Before committing, the staged file list is reviewed and includes only intentional repo files.
- **Verification:** `git status --short --ignored` before staging - `git diff --cached --name-only` before commit - `git diff --cached --stat` before commit - `git status --short` (empty after commit) - `git tag --list pre-redesign-v2` - `git branch --list "safety/*"` - `git log --oneline -3`.
- **Manual test:** `git stash list` empty; `git show pre-redesign-v2 --stat` lists expected files only and no generated output.
- **Rollback:** `git reset --soft HEAD~1` (snapshot commit is additive; nothing destroyed).
- **Commit message:** `chore(repo): snapshot pre-redesign-v2 baseline`

### MOM-002 - Establish agent execution docs - READY (drafted in dirty tree) - CLAUDE
- **Goal:** Stand up the orchestration surface (`BACKLOG/NEXT/LOCKS/DECISIONS/LOG`) under `docs/agent/`.
- **User-visible outcome:** None; enables disciplined multi-agent execution.
- **Allowed files:** `docs/agent/*.md`, `docs/agent/*.MD` only.
- **Forbidden changes:** App source, schema, plan file content.
- **Dependencies:** MOM-001 (so the doc commit lands on a clean base).
- **Acceptance criteria:** All five docs exist, are non-empty, and are internally consistent (IDs referenced in `NEXT.MD`/`LOG.MD` exist in `BACKLOG.md`). If MOM-001 snapshots the already-drafted docs, treat MOM-002 as satisfied and advance to MOM-003.
- **Verification:** `Get-ChildItem docs/agent` shows 5 files - manual read.
- **Manual test:** Open `NEXT.MD`; it names exactly one active task that also appears here.
- **Rollback:** `git checkout -- docs/agent`.
- **Commit message:** `docs(agent): add execution backlog and orchestration docs`

### MOM-003 — Archive legacy Python backend & Expo mobile · **DONE** (verified 2026-07-06: `archive/` exists at repo root; `backend/`/`mobile/` no longer present at root; stale READY status) · EITHER
- **Goal:** Move abandoned `backend/` (Python) and `mobile/` (Expo) out of the active build path without deleting history.
- **User-visible outcome:** Cleaner repo; `pnpm install`/`build` no longer touches dead apps.
- **Allowed files:** `git mv backend/ archive/backend/`, `git mv mobile/ archive/mobile/`; `pnpm-workspace.yaml` (already only globs `apps/*`,`packages/*` — confirm no reference); a short `archive/README.md` explaining status.
- **Forbidden changes:** **Do not `rm` either tree** — move only. Do not touch `apps/*` source. No schema, no deps.
- **Dependencies:** MOM-001.
- **Acceptance criteria:**
  - `backend/` and `mobile/` no longer at repo root; both present under `archive/` with full history (`git log --follow`).
  - `pnpm -w install` and `pnpm build` succeed unchanged (neither was in the workspace globs).
  - `docker-compose.yml`/`justfile` references to the moved paths are updated or documented as dead.
- **Verification:** `pnpm build` green - `git log --follow archive/backend/pyproject.toml` shows history - `rg "mobile/|backend/" justfile docker-compose.yml`.
- **Manual test:** Fresh `pnpm install` produces no reference to Python/Expo packages.
- **Rollback:** `git mv archive/backend backend && git mv archive/mobile mobile`.
- **Commit message:** `chore(repo): archive legacy python backend and expo mobile`

### MOM-019 - Add health endpoint - **DONE** (verified 2026-07-06: `apps/api/src/health/health.{controller,module}.ts` exist, registered in `app.module.ts`; `GET /api/v1/health` is `@Public()` + `@SkipThrottle()`, dependency-free; a `GET /api/v1/health/db` DB-ping probe also exists for MOM-086, kept separate so a DB outage can't fail liveness) - CODEX
- **Goal:** Public, unauthenticated `GET /api/v1/health` returning liveness (DB ping deferred to MOM-086).
- **User-visible outcome:** Deploy platforms and uptime checks get a stable health URL.
- **Allowed files:** new `apps/api/src/health/health.module.ts`, `health.controller.ts`; register in `apps/api/src/app.module.ts`; one spec in `apps/api/test/`.
- **Forbidden changes:** No schema, no auth changes beyond marking the health controller `@Public()`, no DB call yet (keep it dependency-free so it can't be broken by DB outages).
- **Dependencies:** MOM-001.
- **Acceptance criteria:**
  - `GET /api/v1/health` → `200 { status: "ok", uptime, timestamp }`, no auth required.
  - Endpoint is excluded from any global auth guard (verify guard strategy in `auth/`).
  - Unit test asserts 200 + shape.
- **Verification:** `pnpm --filter @momito/api test` · `pnpm --filter @momito/api build` · manual `curl localhost:3001/api/v1/health`.
- **Manual test:** Hit the URL with no token → 200.
- **Rollback:** Remove module + revert `app.module.ts` import.
- **Commit message:** `feat(api): add unauthenticated health endpoint`

### MOM-017 - API security hardening (helmet + throttling) - **DONE** (verified 2026-07-06: `main.ts` applies `helmet()` globally; `app.module.ts` registers a global `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` + `APP_GUARD: ThrottlerGuard`; health endpoint carries `@SkipThrottle()` so liveness checks are unaffected) - CODEX
- **Goal:** Add HTTP hardening headers and global rate limiting. **Not** validation/prefix/CORS — those already exist in `main.ts`.
- **User-visible outcome:** App is safer to expose on the public internet (single-user).
- **Allowed files:** `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/package.json` (add `helmet`, `@nestjs/throttler`), `pnpm-lock.yaml`, `apps/api/src/common/*` for config; a spec.
- **Forbidden changes:** Do not weaken the existing `ValidationPipe`. No schema/migrations. Do not change route paths or `@Public()` semantics.
- **Dependencies:** MOM-001. Verify: restate current `main.ts` (prefix `api/v1`, CORS, ValidationPipe) before editing.
- **Acceptance criteria:**
  - `helmet()` applied globally; security headers present on responses.
  - `@nestjs/throttler` global guard with a sane default (e.g. 100 req/min); auth routes get a tighter limit (coordinates with MOM-018).
  - Health endpoint (MOM-019) remains reachable and is not throttled into failure by liveness checks.
  - CI green.
- **Verification:** `pnpm --filter @momito/api build && test` · manual `curl -I` shows helmet headers · burst test hits 429.
- **Manual test:** Rapid repeated login attempts return 429.
- **Rollback:** Revert `main.ts`/`app.module.ts`, drop the two deps.
- **Commit message:** `feat(api): add helmet and global rate limiting`

### MOM-006 - Frontend utility foundation - **DONE** (verified 2026-07-06: `apps/web/app/lib/cn.ts` exists and is used throughout `ui.tsx` and every page touched this session; stale READY status) - CODEX
- **Goal:** Introduce shared FE utilities (`cn()` class merger + minimal helpers) as the base for the design system, without adding a component library yet.
- **User-visible outcome:** None; unblocks MOM-007/009/011.
- **Allowed files:** `apps/web/app/lib/` (new `cn.ts`/`utils.ts`), `apps/web/package.json` (add `clsx` + `tailwind-merge` only), `pnpm-lock.yaml`.
- **Forbidden changes:** No shadcn install yet (that's MOM-007, spike-gated). No route/layout edits. No API changes.
- **Dependencies:** MOM-001.
- **Acceptance criteria:** `cn()` merges Tailwind classes with correct precedence; unit-importable; typecheck + lint + build green.
- **Verification:** `pnpm --filter @momito/web build` · `pnpm --filter @momito/web lint`.
- **Manual test:** Temporary usage of `cn('p-2','p-4')` resolves to `p-4`.
- **Rollback:** Delete files, drop the two deps.
- **Commit message:** `feat(web): add cn() and frontend utility foundation`

### MOM-008 - Navigation model - **DONE** (verified 2026-07-06: `apps/web/app/lib/navigation.ts` exists, extended this session for MOM-065's Story Bank entry; stale READY status) - CODEX
- **Goal:** Single source of truth for app navigation (labels, hrefs, icons, mobile-primary flag) as data — no UI change yet.
- **User-visible outcome:** None yet; MOM-009/011 consume it.
- **Allowed files:** new `apps/web/app/lib/navigation.ts` (or `nav-config.ts`).
- **Forbidden changes:** Do not modify `(authenticated)/layout.tsx` yet (that's MOM-011). No new routes.
- **Dependencies:** MOM-001. Reflect reality: current nav has 12 links and points at `/dashboard` (no `/today` yet — leave a TODO marker keyed to MOM-012).
- **Acceptance criteria:**
  - Exported typed array of nav items; a documented subset flagged as mobile bottom-tab primaries (≤5).
  - No runtime behavior change; build green.
- **Verification:** `pnpm --filter @momito/web build`.
- **Manual test:** Import the config in a scratch file; types resolve.
- **Rollback:** Delete the file.
- **Commit message:** `feat(web): add central navigation model`

### MOM-012 - `/today` stub route and redirect - **DONE** (verified 2026-07-06: `/today` has been the live, fully-wired priority queue — not a stub — for most of this session's history; stale READY status) - CODEX
- **Goal:** Create a real `/today` route (stub content) and make it the post-login landing target.
- **User-visible outcome:** After login the user lands on **Today** (even if it's a placeholder), matching the North Star loop.
- **Allowed files:** new `apps/web/app/(authenticated)/today/page.tsx`; `apps/web/app/page.tsx`; `apps/web/app/(auth)/login/page.tsx`; `apps/web/app/(auth)/register/page.tsx`; `apps/web/app/(authenticated)/layout.tsx` for brand/nav target only.
- **Forbidden changes:** Do not delete `/dashboard`. No API calls yet (static stub). No nav rewrite.
- **Dependencies:** MOM-008 (uses nav model for the link). NEEDS_REPO_INSPECTION on redirect targets: root page, login, register, authenticated layout brand link.
- **Acceptance criteria:**
  - `/today` renders a titled placeholder ("Today") with sections stubbed (Reviews / Practice / Career) and no data fetching.
  - Post-login navigation resolves to `/today`; `/dashboard` still reachable directly.
  - Build + lint green; no hydration warnings.
- **Verification:** `pnpm --filter @momito/web build` · manual login → lands on `/today`.
- **Manual test:** Log in on a narrow viewport; Today renders without horizontal scroll.
- **Rollback:** Delete `today/`, revert redirect.
- **Commit message:** `feat(web): add /today stub route and post-login redirect`

### MOM-004 - Rewrite root project docs - **DONE** (see 2026-07-05 LOG entry — README refreshed; stale READY status) - CLAUDE
- **Goal:** Replace the outdated root `README.md` with accurate setup/run/deploy instructions reflecting the pnpm monorepo (api/web/shared) and the archive of legacy apps.
- **User-visible outcome:** A new contributor (or future agent) can bootstrap the app from the README alone.
- **Allowed files:** `README.md`, optional `docs/` supporting pages. No `CLAUDE.md`/plan edits.
- **Forbidden changes:** No source/schema/deps. Do not document features that don't exist yet (no fake completeness).
- **Dependencies:** MOM-003 (so archived apps are described correctly).
- **Acceptance criteria:** README lists real scripts (`pnpm dev/build/lint/typecheck/test`, `db:*`), env vars (`DATABASE_URL`, `JWT_SECRET`, CORS origin), and marks `archive/*` as legacy. No dead commands.
- **Verification:** Run each documented command; all resolve. Manual read.
- **Manual test:** Follow README from a clean checkout mentally/step-by-step; no gaps.
- **Rollback:** `git checkout -- README.md`.
- **Commit message:** `docs: rewrite root README for pnpm monorepo`

### MOM-005 — Architecture doctrine ADRs · **DONE** (verified 2026-07-06: all four required ADRs exist — `0001-nestjs-api-is-backend-of-record.md`, `0002-reviewstate-polymorphic-object-reference.md`, `0003-learning-engine-coexists-with-mission-engine.md`, `0004-no-copyrighted-problem-statements-in-seeds.md` — plus 0005-0007 added by later work (Story Bank schema, backup strategy, AI grading scaffold); stale READY status) · CLAUDE
- **Goal:** Capture the load-bearing decisions from this planning pass as ADRs so implementers don't re-litigate them.
- **User-visible outcome:** None; reduces future churn/regressions.
- **Allowed files:** `docs/adr/000X-*.md` (new). Cross-link from `DECISIONS.md`.
- **Forbidden changes:** No source/schema.
- **Dependencies:** MOM-002.
- **Acceptance criteria:** One ADR each for: (a) NestJS `apps/api` is the backend of record; (b) FSRS ReviewState as polymorphic `objectType/objectId`; (c) Learning engine coexists with existing Mission engine; (d) no copyrighted problem statements in seeds. Each ADR: context / decision / consequences.
- **Verification:** Manual read; links resolve.
- **Manual test:** Each ADR maps to a `DECISIONS.md` entry.
- **Rollback:** Delete ADR files.
- **Commit message:** `docs(adr): record redesign-v2 architecture decisions`

---

## 4. Epics (remaining tasks, summarized)

> Not expanded to full template yet. Each becomes a detailed task in `NEXT.MD` when it reaches the top of a ready track. Statuses reflect repo reality above.

### Track A — Safety & Foundation
- **MOM-001..005** — detailed in §3.

### Track B — Mobile Platform · Gate 1
- **MOM-007** Design-system primitives (shadcn/Tailwind v4) — **DONE** (verified
  2026-07-05: `apps/web/app/components/ui.tsx` has the full primitive set — Card, Badge,
  Spinner, ErrorBanner, EmptyState — used throughout; Tailwind v4 confirmed via
  `dark:`-prefixed classes across every page; stale NEEDS_SPIKE status).
- **MOM-009** Mobile bottom tabs — **DONE** (verified: `BottomTabs.tsx` exists, driven by
  `navigation.ts`'s `primary: true` items).
- **MOM-010** Desktop sidebar + top bar — **DONE** (verified: `Sidebar.tsx` exists).
- **MOM-011** Rewrite authenticated layout shell (mobile-first) — **DONE** (implied by
  MOM-009/010 both being real; no further stub nav found).
- **MOM-013** Theme + typography baseline (dark/light) — **DONE**, re-audited 2026-07-06.
  The 2026-07-05 "zero `dark:` classes on 11 pages" finding was stale — later
  session work (not reflected back into this backlog at the time) had already added
  `dark:` coverage to all 11 (attempts 3, calendar 13, career 11, dashboard 23, jobs 16,
  learning 12, missions 12, profile 17, questions 6, settings 26, study-plan 40 `dark:`
  occurrences, re-counted 2026-07-06). Re-audit found one genuine remaining gap —
  `calendar/page.tsx`'s reminder-dismiss button (`border-zinc-300`/`text-zinc-600`/
  `hover:bg-zinc-50` with no `dark:` variants) — fixed. A repo-wide grep for the classic
  light-only patterns (`text-gray-*`, `bg-white`, `border-gray-*`, `text-black`, unpaired
  `text-zinc-{700,800,900}`, unpaired `border-zinc-300`/`bg-zinc-50`/`bg-zinc-100`) across
  all 11 pages now returns no further hits.
- **MOM-014** Restyle auth pages for phone — **DONE** (verified: login/register already
  styled with dark-mode-aware Tailwind classes).
- **MOM-015** PWA manifest + icons — **DONE** (verified: `apps/web/app/manifest.ts`
  exists, plus `icon.tsx`/`apple-icon.tsx`/`pwa-icon-*` routes seen in build output).
- **MOM-016** Offline page + service worker — **DONE** 2026-07-06, reversing the earlier
  DEFER (see SPIKE-002 above for rationale). `apps/web/public/sw.js`,
  `app/offline/page.tsx`, `app/components/sw-register.tsx` (production-only registration,
  mounted in `layout.tsx`), `app/components/offline-banner.tsx` (connectivity banner).

### Track C — API Foundation · Gate 1
- **MOM-017** Security hardening — **DONE**, detailed in §3.
- **MOM-018** Auth throttling + registration lock — **DONE** (verified 2026-07-06:
  `auth.controller.ts`'s login/register handlers both carry `@Throttle(AUTH_THROTTLE)`,
  a tighter limit than the global default; stale READY status).
- **MOM-019** Health endpoint — **DONE**, detailed in §3.
- **MOM-020** Neon `directUrl` support — **DONE** (verified 2026-07-05:
  `schema.prisma`'s `datasource db` already has `directUrl = env("DIRECT_URL")` with a
  `// MOM-020` comment; `.env`/`.env.example`/README's env table all document it; stale
  NEEDS_REPO_INSPECTION status — this was independently re-verified as P1 item #1 earlier
  in this session too).
- **MOM-021** First deploy (Vercel + Render + Neon) — **BLOCKED on credentials/hosting
  accounts this agent doesn't have** (real accounts, real secrets — never something an
  agent should self-provision). **Scaffolded dormant** 2026-07-06 so the actual deploy is
  a config-only, no-code-change action once the user has accounts: `render.yaml` (API
  Blueprint — build/start/health/env, secrets marked `sync: false`), `apps/web/vercel.json`
  (build command), `.github/workflows/keepwarm.yml` (SPIKE-008). README's new "Deploy"
  section documents the 7-step walkthrough.

### Track D — Knowledge Kernel (type/service layer only)
- **MOM-022** Shared domain constants — **DONE** (verified 2026-07-06:
  `KnowledgeDomain`/`KnowledgeProvenance`/`KnowledgeQualityStatus`/`ReviewableObjectType`
  all defined in `packages/shared/src/index.ts`; stale READY status).
- **MOM-023** Rubric type definitions — **DONE** (verified 2026-07-06: `Rubric`/
  `RubricCriterion`/`RubricCriterionLevel` + `isRubric()` type guard exist, matching
  `Question.rubric`'s Json shape; stale READY status).
- **MOM-024** Content validation framework (`content:validate/stats/sample`) — **DONE**
  (verified 2026-07-06: `apps/api/scripts/content-{validate,stats,sample,lib}.ts` exist
  and are wired to `package.json`'s `content:validate/stats/sample` scripts; stale READY
  status).
- **MOM-025** KnowledgeObject response helpers — **DONE** (verified 2026-07-06:
  `questionToKnowledgeObject()` in `packages/shared/src/index.ts` maps a `QuestionResponse`
  to the shared `KnowledgeObject` shape; stale BLOCKED status, blockers were already
  resolved).

### Track E — Review & Learning Engine · Gate 2
- **MOM-026** Design ReviewState migration — **DONE** (2026-07-05). SPIKE-003 answered in
  `docs/adr/0002-reviewstate-polymorphic-object-reference.md`; see `DECISIONS.MD` D-005.
- **MOM-027** Implement ReviewState migration — **DONE** 2026-07-05, human-approved.
  Migration `20260705045159_add_review_state` applied to a real Postgres instance;
  `ReviewState` model added to `schema.prisma` exactly per ADR-0002, including the
  SPIKE-003 partial index (`review_states_user_due_active_idx ... WHERE NOT suspended`,
  hand-added to the generated `migration.sql`). `questions.service.ts`'s `remove()` now
  wraps the delete in a `$transaction` with `reviewState.deleteMany()` to prevent the
  orphan risk ADR-0002 identified. Verified with a live create→delete round-trip against
  Postgres (zero orphaned rows left), not just mocked unit tests.
- **MOM-028** Attempt reflection fields — **DONE** 2026-07-05, human-approved migration.
  Added `missTags String[] @default([])`, `reflectionNote String?`, `language String?`,
  `complexity String?` to `AnswerAttempt` exactly per D-003's spec. `missTags` validated
  against plan §5.4's taxonomy (new `MISS_TAG_REASONS`/`MissTagReason` in
  `packages/shared`). `CreateAnswerDto` updated; no service-layer change needed since
  `answer()` already spreads the DTO into the create call. Verified via unit tests (3 new
  DTO-validation cases) and a live round trip submitting a real answer with all four
  fields through the actual HTTP endpoint. MOM-039 (reflection panel UI) is now unblocked.
- **MOM-029** Reviews module (API) — **DONE** 2026-07-05. New
  `apps/api/src/reviews/{reviews.service,reviews.controller,reviews.module,dto/record-review.dto}.ts`,
  registered in `app.module.ts`. `GET /reviews/due` lists non-suspended due reviews;
  `POST /reviews/:objectType/:objectId` records a review (get-or-create + FSRS schedule +
  upsert), rejecting unsupported `objectType`s with 400. Verified via unit tests (mocked
  Prisma) **and** live HTTP calls against a running server + real Postgres — confirmed
  correct FSRS scheduling (Easy → ~8 days out; Again → ~1min relearning step) and the
  unsupported-type rejection.
- **MOM-030** FSRS scheduling service — **DONE (algorithm layer only)** 2026-07-05.
  `apps/api/src/reviews/fsrs-scheduler.ts` wraps `ts-fsrs` as pure functions
  (`createInitialReviewState`, `scheduleNextReview`, `selfRatingToGrade`) operating on
  plain `ReviewCardState` objects shaped like ADR-0002's planned `ReviewState` columns.
  Now wired to real persistence by MOM-029.
- **MOM-031** Hook answer submission into scheduling — **DONE** 2026-07-05.
  `sessions.service.ts`'s `answer()` now calls `ReviewsService.record()` whenever the
  submitted `CreateAnswerDto` includes a `selfRating` (optional field — no rating means no
  FSRS grade to schedule from). Wrapped in try/catch with a `Logger.warn` on failure so a
  scheduling error can never break answer submission itself. `SessionsModule` now imports
  `ReviewsModule` (which exports `ReviewsService`). Verified via unit tests (3 new cases:
  fires with a rating, doesn't fire without one, attempt still returns on scheduling
  failure) and a live round trip: registered/logged in, created a real session, submitted
  a real answer with `selfRating: 4` through the actual HTTP endpoint, and confirmed a
  `ReviewState` row was created in Postgres with the correct FSRS-scheduled values.
- **MOM-032** Today dashboard API (queue priority §6.1) — **DONE, including the unified
  queue** (three-section version shipped 2026-07-05, upgraded to a single ranked queue
  the same day). `ReviewsService.listDue()` enriches `question`-type rows with the
  question's `title` (a second batched lookup, since `objectId` has no FK to join through
  — ADR-0002). `apps/web/app/lib/api-client.ts` gained `reviewsApi.due()`.
  `apps/web/app/(authenticated)/today/page.tsx` fetches recommendations, reminders, and
  due reviews in parallel, computes a client-side priority per source (due reviews:
  200 + hours-overdue; recommendations: the service's existing 50-190ish scale as-is;
  reminders: 150 + hours-overdue if past due, else a low flat 30 so upcoming-not-yet-due
  reminders still show but sink to the bottom), and renders one sorted list — each entry
  keeps its own specialized card (inline re-rating for reviews, dismiss for reminders,
  navigate for recommendations), just interleaved instead of stacked in three sections.
  Verified via unit tests, two live round trips (one per section version), and full web
  build/lint/typecheck.
- **MOM-033** Recommendation reason standardization — **DONE** 2026-07-05. The reason
  taxonomy half was already implemented in an earlier session (`RECOMMENDATION_REASONS`
  in `recommendations.service.ts`). This pass did the remaining "Today integration" half:
  `apps/web/app/(authenticated)/today/page.tsx` was a static MOM-012 stub with no data
  fetching; it now calls `recommendationsApi.list()` (the same endpoint the Dashboard's
  "Next Actions" card already used) and renders the real, priority-sorted recommendation
  queue. Spaced-repetition due-reviews still can't appear here — that needs MOM-027/032.

### Track F — Practice Engine UI · Gate 2
- **MOM-034** Markdown renderer — **DONE** (verified: `react-markdown` installed,
  `apps/web/app/components/Markdown.tsx` exists and is used across question detail,
  system design preview, Today, etc.).
- **MOM-035** CodeMirror editor — **DONE** 2026-07-05 (see this session's earlier commit
  `4a1c1d3`; this was a stale duplicate line — the real entry with full detail is further
  up this file).
- **MOM-036** Timer hook — **DONE** (verified: `apps/web/app/lib/use-timer.ts` exists,
  used in `AnswerForm.tsx`).
- **MOM-037** Split session page into components — **DONE** (verified 2026-07-05:
  `practice/session/[id]/page.tsx` already composes `SessionHeader`/`AnswerForm`/
  `AllAnsweredPanel`/`ReviewQuestionCard` as separate components; stale status).
- **MOM-038** Answer panel by question type — **DONE** 2026-07-05. Split
  `AnswerForm.tsx`'s inline branching into `apps/web/app/components/session/answer-panels/`
  (`TextAnswerPanel`, `SystemDesignAnswerPanel`, `CodeAnswerPanel`); `AnswerForm` now just
  dispatches on question type. Pure refactor — behavior unchanged for every question type.
- **MOM-039** Reflection panel — **DONE** 2026-07-05. New
  `apps/web/app/components/session/ReflectionPanel.tsx` — collapsed-by-default "+ Add
  reflection (optional)" toggle expanding into miss-tag chips (plan §5.4 taxonomy,
  human-readable labels) and a free-text note. Wired into `AnswerForm.tsx` and the
  session page's submit flow (`missTags`/`reflectionNote` state, cleared after each
  submit like `selfRating`). `sessionsApi.answer()`'s type signature extended with the
  four MOM-028 fields. The API side (persistence, DTO validation) was already verified
  live in MOM-028's commit — this is purely the UI wiring to that proven endpoint.
- **MOM-040** Session summary — **DONE** (verified 2026-07-05: `summary/page.tsx` exists
  and now also shows the MOM-039 reflection fields per-question, not just self-rating).
- **MOM-041** Practice hub — **DONE** (verified 2026-07-05, was already shipped in an
  earlier session; `apps/web/app/(authenticated)/practice/page.tsx` exists — stale
  BLOCKED status, not actually blocked).
- **MOM-042** Today learning cards — **DONE** (both blockers resolved: MOM-012 done long
  ago, MOM-032 done 2026-07-05 — `/today`'s "Due for Review" section with inline
  "Review now" rating *is* the Today learning card implementation; stale BLOCKED status).
- **Spaced Review session type wired up** (no MOM number — discovered 2026-07-05 while
  reviewing `/practice/new`: the `spaced_review` session-type label/description existed
  with zero backend logic behind it since an early session). Now pulls the exact set of
  currently-due FSRS reviews (`reviewsApi.due()`) into a session via the existing
  `questionIds` exact-selection path in `sessions.service.ts` — no backend change needed,
  since `CreateSessionDto.questionIds` already supported an arbitrary question list.
  `/practice/new` hides the filter fields for this type (the set is fixed, not filtered)
  and previews the due titles/count before starting. Verified live: seeded two due
  reviews, created a real `spaced_review` session via the exact API call the new UI
  makes, confirmed both questions were included in order.

### Track G — Content Factory · Gate 3
- **MOM-043** Seed-data structure — **DONE** (see 2026-07-05 LOG entry — split into
  `seed-data.ts`).
- **MOM-044** Idempotent seed upsert utilities — **DONE** (see 2026-07-05 LOG entry).
- **MOM-045** Seed DSA patterns — **DONE** (150/150 DSA items seeded, all with pattern
  tags — verified via `content:stats`/`content:validate`; stale BLOCKED status).
- **MOM-046/047/048** DSA ladder batches (50/100/150) — **DONE** (150/150, verified via
  `content:stats`; MOM-048's specific "final item" was logged 2026-07-05).
- **MOM-049** LeetCode import service — **NEEDS_SPIKE** (SPIKE-006 GraphQL shape), still
  genuinely open. Deliberately not attempted autonomously: scraping/calling a third-party
  API's GraphQL endpoint without an explicit go-ahead is a different risk class than
  writing original seed content, even though the plan scopes it to links/metadata only.
- **MOM-050** DSA progress API · **MOM-051** DSA ladder UI — **DONE** (verified 2026-07-06:
  `apps/api/src/dsa/{dsa.service,dsa.controller,dsa.module}.ts` registered in
  `app.module.ts` with test coverage; `apps/web/app/(authenticated)/practice/dsa-ladder/
  page.tsx` exists and is linked from `/practice`; stale BLOCKED status, blockers
  (seed batches) were already resolved).
- **MOM-052/053/054** CS fundamentals batches (50/100/150) — **DONE** 2026-07-06.
  `pnpm content:stats` was at 149/150 (one short) when checked this session; added one
  original (non-LeetCode, conceptual) `nodejs`-type seed item on backpressure in stream
  pipelines, bringing the total to exactly 150. `content:validate` — 0 errors, 0 warnings.
- **MOM-055/056** System design batches (10/25) — **DONE** (25/25, verified earlier this
  session via `content:stats`) · **MOM-057** System design editor (7-section template) —
  **DONE** (verified: `SYSTEM_DESIGN_TEMPLATE` used in `SystemDesignAnswerPanel.tsx`, per
  MOM-038's log entry).
- **MOM-058/059** Behavioral prompt batches (30/60) — **DONE** (60/60, verified via
  `content:stats`).
- **MOM-060** Company packs (20) — **DONE** (verified 2026-07-06: `companies` array in
  `apps/api/prisma/seed-data.ts` has exactly 20 entries with focus-area/linked-track notes
  per plan §8.2; stale unmarked status).
- **MOM-061** Role tracks (8) — **DONE** (verified 2026-07-05: `CAREER_ROLE_TRACKS` in
  `packages/shared/src/index.ts` now defines 10 tracks, covering all 8 plan categories;
  this entry was stale, done in an earlier session but not marked here).
- **MOM-062** Content coverage dashboard — **DONE** (verified 2026-07-06:
  `CONTENT_COVERAGE_TARGETS`/`ContentCoverageResponse` in `packages/shared`, backed by
  `apps/api/src/content/content.service.ts` and rendered at
  `apps/web/app/(authenticated)/settings/content/page.tsx`; stale BLOCKED status, blocker
  already resolved).

### Track H — Story & Behavioral Engine · Gate 2/3
- **MOM-063** Story schema + review integration — **DONE** 2026-07-06, human-approved. See
  `docs/adr/0005-story-bank-schema.md`. Three new tables (`stories`, `story_companies`,
  `story_prompts`), purely additive migration `20260705174649_add_story_bank`. Reuses
  ADR-0002's polymorphic `ReviewState` (`objectType: 'story'`) — no `ReviewState` schema
  change needed.
- **MOM-064** Story CRUD API — **DONE** 2026-07-06. New
  `apps/api/src/stories/{stories.service,stories.controller,stories.module}.ts` + 2 DTOs,
  registered in `app.module.ts`. `GET/POST /stories`, `GET/PATCH/DELETE /stories/:id`, all
  scoped to the authenticated user (`findFirst`/`updateMany`-style ownership checks, same
  pattern as `TasksService`). Company tagging mirrors `QuestionsService`'s
  delete-then-recreate join-table pattern. Delete cleans up any `ReviewState` row in the
  same transaction (ADR-0002/0003 orphan-prevention pattern, same as
  `questions.service.ts`). `apps/web/app/lib/api-client.ts` gained a `storiesApi` client;
  no page consumes it yet (that's MOM-065). Verified via 5 unit tests + full
  build/lint/typecheck/test + a live round trip (create with a company link, get, list,
  update, delete → 404, unauthenticated → 401).
- **MOM-065** Story frontend — **DONE** 2026-07-06. New
  `apps/web/app/(authenticated)/stories/page.tsx` — list + inline STAR create/edit form
  (Situation/Task/Action/Result/Metrics as separate fields), comma-separated competency-tag
  and follow-up-question inputs, a toggle-chip company multi-select reusing `companiesApi`,
  expand/collapse per-story detail view, and delete-with-confirm — same conventions as
  `/study-plan`/`/questions`. Added a "Story Bank" nav entry
  (`apps/web/app/lib/navigation.ts`, non-primary — all 5 mobile bottom-tab slots already
  used). No backend changes; consumes the `storiesApi` client MOM-064 already added.
  Verified via lint/typecheck/build (`/stories` now a 32nd static route) and an HTTP smoke
  test (both the compiled API and a production web server started locally; `GET /stories`
  returned 200 with no server-side render crash — full interactive/auth-gated behavior not
  visually verified since no browser tool is available in this environment).
- **MOM-066** Link stories↔prompts — **DONE** 2026-07-06. `StoriesService` gained
  `linkPrompt`/`unlinkPrompt` (idempotent link — re-linking an existing pair is a no-op,
  not a conflict error; only `type: 'behavioral'` questions are linkable, enforced with a
  400 otherwise). `POST/DELETE /stories/:id/prompts[/:questionId]`. `StoryResponse` gained
  `prompts: StoryPromptLink[]` (denormalized `questionTitle` for display, no join needed
  client-side). Frontend: `apps/web/app/(authenticated)/questions/[id]/page.tsx` gained an
  "Answer with a Story" card, shown only for behavioral questions — lists linked stories
  with an unlink button and a select+link control for the user's unlinked stories. Verified
  via 5 new unit tests (10 total in `stories.service.spec.ts`) + full build/lint/typecheck
  + a live round trip (link → idempotent re-link (still 201) → unlink → cleanup, against a
  real behavioral question from the seed data).
- **MOM-067** Rehearsal sessions — **DONE** 2026-07-06. This closes Track H
  (MOM-063→064→065→066→067) end to end in one session.
  `ReviewsService`'s `objectType` allow-list now includes `'story'` alongside
  `'question'`; `record()` additionally verifies story ownership before scheduling
  (`ensureAccessible` — Story is per-user private data, unlike the shared `Question`
  bank, so this prevents user A from reviewing/reading user B's story indirectly via
  review state). `listDue()` enriches story-type due rows with the story's title,
  mirroring the existing question-title enrichment. Frontend: the Story Bank page
  gained a "Rehearse" action (self-rate 1-5, calling the same `reviewsApi.record()`
  Today already uses) — this is the actual entry point into the FSRS loop for stories,
  since there's no session/practice flow for them the way there is for questions.
  Also fixed a real bug found while wiring this up: Today's due-review card
  unconditionally linked to `/questions/:objectId`, which would 404/misnavigate for a
  story-type review (no per-story detail route exists yet) — now branches on
  `review.objectType` and links story reviews to `/stories` instead. Verified via 3 new
  unit tests (8 total in `reviews.service.spec.ts`) + full build/lint/typecheck/test +
  a live round trip: rehearsed a real story through 3 self-ratings via
  `POST /reviews/story/:id`, confirmed the `ReviewState` row persisted correctly in
  Postgres with the right FSRS values (reps: 3, lapses: 1, state: 3/Relearning after
  two "Again" grades), then deleted the story and confirmed the transactional
  orphan-cleanup removed the `ReviewState` row too (0 remaining).

### Track I — AI Feedback Engine · Gate 4
**Status note (2026-07-07):** this entire track is **DONE (scaffold) — VERIFICATION-BLOCKED
on a live `ANTHROPIC_API_KEY`**. Reconciles a contradiction the doc-audit found: this section
marked MOM-068–074 flatly "DONE" while `NEXT.MD` simultaneously listed the same range as
blocked/unverified pending a real key. Both were true in different senses — the code is
complete, tested (14 mocked/zero-network tests), and live-verified against the *no-key*
path (`available:false`, clean `503`). What remains genuinely unverified: a real
`messages.parse` call succeeding, the budget-exceeded path, and a real graded
score/feedback actually rendering on the frontend. Gate 4 stays open until a key is added
and those three are checked once.
- **MOM-068** AI SDK spike — **DONE** 2026-07-06 (SPIKE-005 resolved). Consulted the
  bundled `claude-api` skill, then verified directly against the *installed*
  `@anthropic-ai/sdk` package types (the skill's docs describe a newer GA shape than
  what `^0.70.0` shipped — `messages.parse`/`zodOutputFormat` did not exist under that
  version; bumped to `^0.110.0`, which matches the skill's documented GA structured-output
  API: `client.messages.parse()` + `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`,
  `output_config: {effort, format}`, `thinking: {type: 'adaptive'}`, typed error classes).
  Also discovered the installed `zod` schema must be built from the `zod/v4` subpath
  (`import * as z from 'zod/v4'`) — the SDK's `zodOutputFormat` type rejects a classic
  `zod` v3 `ZodObject`. Model: `claude-opus-4-8` (plan default, current pricing).
- **MOM-069** AiUsage migration — **DONE** 2026-07-06, human-approved (blanket migration
  approval covers the remainder of the plan). `AiUsage(userId, day @db.Date, requests,
  inputTokens, outputTokens, costUsd, @@unique([userId, day]))` — migration
  `20260705230553_add_ai_usage`, applied to the local Postgres instance.
- **MOM-070** Budget service · **MOM-071** Grading service · **MOM-072** Grade-attempt
  endpoint — **DONE** 2026-07-06. `apps/api/src/ai/`: `budget.service.ts`
  (`getUsage`/`checkAndReserve`/`record`, daily-budget gate, default `$1.00` via
  `AI_DAILY_BUDGET_USD`), `grading.service.ts` (structured grading via
  `messages.parse`+`zodOutputFormat(GradeResultSchema)`, every Anthropic SDK error class
  caught most-specific-first and turned into `{ok: false, reason}` — **never throws** on a
  remote failure), `ai.service.ts` (orchestrates cache/force/budget/persistence),
  `ai.controller.ts`. Endpoints: `POST /attempts/:id/grade` (idempotent, `?force=true`
  regrades) and `GET /ai/usage`. `ANTHROPIC_API_KEY` absent ⇒ `available: false`
  everywhere, checked explicitly via `common/config.ts::isAiGradingAvailable` (not
  inferred from an SDK construction failure). This activates the previously-dead
  `AnswerAttempt.aiScore`/`aiFeedback` columns. See `docs/adr/0007-ai-grading-scaffold.md`.
  Verified live against a running API + real Postgres with no key configured:
  `GET /ai/usage` → `available:false`; `POST /attempts/:id/grade` → clean `503`, no crash.
  Zero-network unit tests (mocked Anthropic client, real SDK error classes constructed
  directly): `ai.budget.spec.ts`, `ai.grading.spec.ts`, `ai.service.spec.ts` — 14 tests.
- **MOM-073** AI feedback FE card · **MOM-074** Integrate into reflection panel —
  **DONE** 2026-07-06 (Gate 2's self-rating loop has been complete since MOM-039, so the
  original DEFER no longer applies). `apps/web/app/components/ai-feedback-card.tsx`
  probes `GET /ai/usage` once on mount and renders nothing at all when
  `available:false`; otherwise shows a "Grade with AI" button, a "Regrade" affordance
  once graded, and the persisted feedback through the existing `Markdown` component.
  Wired into `(authenticated)/attempts/[id]/page.tsx` (attempt detail view) rather than
  live inside the in-session `ReflectionPanel`, since grading happens after an attempt is
  already persisted, not mid-session.

### Track J — Career Engine · Gate 5
- **MOM-075/076/077** Task consolidation (`StudyPlanItem`→`Task`) — **DONE** 2026-07-06,
  human-approved (user granted blanket approval to cross the D-004 migration gate for the
  remainder of the plan). SPIKE-007's mapping: `title`/`notes`/`topicId`/`status` carry
  over unchanged (`StudyPlanStatus` is a strict subset of `TaskStatus`); `targetDate` →
  `dueDate`; `priority` defaults to `'medium'` (StudyPlanItem never had one); `type` is
  always `'study'`. Migration `20260705172825_merge_study_plan_into_task` backfills every
  `study_plan_items` row into `tasks` before dropping the table. The standalone
  `apps/api/src/study-plan/*` module, its DTOs, and `packages/shared`'s
  `StudyPlanItemResponse`/`STUDY_PLAN_STATUSES` are removed; `TasksService`/`TasksController`
  gained a `remove()`/`DELETE /tasks/:id` (StudyPlanItem had delete, Task didn't yet).
  `apps/web/(authenticated)/study-plan/page.tsx` repointed onto `tasksApi` with
  `type: 'study'` — UI/UX unchanged, same route. **Known incident:** the create-only
  migration command unexpectedly applied itself immediately (dropping `study_plan_items`
  before the backfill INSERT was hand-added to the migration SQL) — see `LOG.MD` for
  detail; the backfill was still added to the migration file for correctness on any other
  environment, but any pre-existing local `study_plan_items` rows in this dev DB could not
  be recovered. Verified via unit tests + full build/lint/typecheck + a live round trip
  (create/list/update/delete a `type: 'study'` task via `/tasks`, confirmed `/study-plan`
  API route now 404s).
- **MOM-078** Reminder due-delivery / scheduler semantics — **RESOLVED, no scheduler
  needed** (2026-07-05 inspection). Due-delivery is correctly just a query-time filter
  (`status: 'pending' AND dueAt <= now`, see `tasks.service.ts` `listReminders`) — there's
  no push-notification requirement, so a poll-on-fetch model is sufficient by design.
  `@nestjs/schedule`/cron would be unnecessary complexity, not a missing gap.
- **MOM-079** Reminder API gap hardening — **DONE** 2026-07-05. Inspection found the API
  (`GET /reminders`, `POST /reminders/:id/dismiss` — both under `TasksController`'s
  no-prefix `@Controller()`) already matches `apps/web/app/lib/api-client.ts`'s
  `remindersApi` exactly; no route mismatch, no missing filters needed. The real gap was
  UI: the calendar page fetched reminders but never called `.dismiss()`. Fixed — added a
  Dismiss button to the calendar Reminders card.
- **MOM-080** Reminder UI (Today + top bar) — **DONE** 2026-07-06. Today-half shipped
  2026-07-05 (see history below); top-bar half closed 2026-07-06: new
  `apps/web/app/components/ReminderBell.tsx` fetches `remindersApi.list()` once on mount
  and renders a bell icon linking to `/today`, with a small red count badge when any
  pending reminder's `dueAt` has passed (no badge otherwise — ambient signal only, no
  polling/websocket). Wired into `(authenticated)/layout.tsx`'s header next to
  `ThemeToggle`.
- **MOM-081** Jobs page → mobile-first list (no drag-drop) — **DONE** (verified 2026-07-05:
  `jobs/page.tsx` is already a single-column, filterable, mobile-first card list with a
  responsive form grid; no drag-drop anywhere).
- **MOM-082** Career hub — **DONE** (verified 2026-07-05: `career/page.tsx` already shows
  role-readiness bars, role track selection, and career goals; fully built out).
- **MOM-083** Link jobs ↔ prep objects — **DONE** (verified 2026-07-06: already fully
  wired, stale BLOCKED status — `JobApplication.roleTrackId` links a job to a
  `CAREER_ROLE_TRACKS` entry; `POST /jobs/:id/generate-prep` (`jobs.service.ts`'s
  `generatePrep()`) turns that role track's checklist into up to 5 `Task` rows carrying
  `jobApplicationId`/`roleTrackId`/`area`/`priority`/`dueDate`, plus ensures a deadline
  reminder; the job detail page (`jobs/[id]/page.tsx`) has a working "Generate Prep"
  button calling it. Generated tasks flow into the existing Task/Reminder pipeline
  (MOM-078-080) and so already surface on Today/the reminder bell — no separate Today
  wiring needed.).

### Track K — Operations & Hardening · Gate 6
- **MOM-084** Error/loading boundaries — **DONE**. Already had `global-error.tsx` (root),
  `(authenticated)/error.tsx`+`loading.tsx`, and `not-found.tsx`. Found and fixed one real
  gap 2026-07-05: `(auth)` (login/register) had no scoped error boundary, so a render
  error there fell through to `global-error.tsx`, replacing the whole `<html>` instead of
  just the auth card. Added `(auth)/error.tsx` matching the `(authenticated)` pattern.
- **MOM-085** API exception filter + request logging — **DONE** (verified 2026-07-06:
  `apps/api/src/common/all-exceptions.filter.ts` registered globally in `main.ts` via
  `app.useGlobalFilters(...)`; `apps/api/src/common/request-logging.middleware.ts`
  registered for all routes in `app.module.ts`'s `configure()`; stale READY status).
- **MOM-086** DB health ping — **DONE** (verified 2026-07-06:
  `GET /api/v1/health/db` in `health.controller.ts` runs `SELECT 1` via Prisma and
  returns 503 on failure, kept separate from the base liveness route; stale READY
  status).
- **MOM-087** Backup workflow (weekly encrypted) — **DONE (design + implementation;
  execution untested against real infra)** 2026-07-06. See
  `docs/adr/0006-backup-strategy.md`. New `.github/workflows/backup.yml` — weekly cron +
  manual `workflow_dispatch`, `pg_dump --format=custom` piped through `gpg --symmetric`
  (AES256, passphrase on fd 3 to avoid colliding with the piped dump data on stdin —
  verified locally with a fake-data round trip), uploaded as a 90-day-retention GitHub
  Actions artifact. Needs no credentials this agent holds to *merge safely*: the first
  step checks for `BACKUP_DATABASE_URL`/`BACKUP_GPG_PASSPHRASE` secrets and exits cleanly
  (not a failure) if either is absent, so the workflow sits dormant with no red-X noise
  until the user configures both. New `docs/runbooks/backup-restore.md` documents restore
  as a deliberate manual procedure, not a one-click job. **Known gap, documented not
  hidden:** 90-day GitHub artifact retention is not a durable long-term archive; swapping
  in real object storage is the natural follow-up once the user picks a provider.
  **Genuinely untested:** the real `pg_dump`/`pg_restore` invocations against an actual
  Postgres/Neon instance — neither binary is installed in this sandbox, and there is no
  real target database to restore into. This is disclosed as a real limitation, not
  claimed as fully verified.
- **MOM-088** Lighthouse + accessibility pass — BLOCKED on Gate 1 UI (Lighthouse itself needs
  a real browser + deployed URL). A manual accessibility pass (not Lighthouse) was done as
  part of MOM-096 below — labeled form controls, keyboard-reachable clickable cards, dark:
  contrast on badges/pagination — but a full Lighthouse audit is still credential/deploy-gated.
- **MOM-089** README rewrite — folded into MOM-004; final polish here.
- **MOM-090** Final full-product golden-path verification — BLOCKED on all gates (Gate 4
  live-key verification and Gate 1/6 real deploy are the remaining blockers).

### Track L — Post-redesign production-readiness pass (2026-07-07)
A second audit pass (three parallel research agents: docs/agent hygiene, API
production-readiness, web UX/quality) after Tracks A–K were believed complete, run per the
user's "keep finishing the plan" instruction plus an explicit ask for push notifications.
Full detail in the plan file used to drive this pass and in the commit messages below —
this section is the BACKLOG-native summary.

- **MOM-091** Dark-mode dev-build bug — **DONE** 2026-07-07. Root cause (found by diffing
  compiled dev vs. prod CSS): `apps/web/app/globals.css`'s `@custom-variant dark (&:where(
  .dark, .dark *))` sat after a foreign `@import "highlight.js/..."` and `@plugin
  "@tailwindcss/typography"`; Turbopack's dev CSS pipeline silently dropped the variant, so
  `dark:` utilities compiled as plain `prefers-color-scheme` media queries instead of
  `.dark`-class rules — toggling the UI switch changed `localStorage` and the DOM class but
  not a single pixel. Production `next build` already compiled this correctly; only `next
  dev` was affected. Fixed by moving the `@custom-variant` line immediately after the
  `tailwindcss` import. Also added a blocking pre-hydration `<head>` script (`layout.tsx`)
  so a saved dark preference applies before first paint instead of flashing light, and made
  the CodeMirror editor follow the app theme instead of being hardcoded dark. Live-verified
  via Playwright: background genuinely flips between light/dark, persists across reload.
- **MOM-092** Web Push notifications — **DONE (dormant until VAPID keys are set)**
  2026-07-07. See `docs/adr/0008-web-push-notifications.md`. New `PushSubscription` model;
  `apps/api/src/push/` (`PushService`, `PushController` — `GET /push/config`, `POST`/`DELETE
  /push/subscriptions` — and `ReminderPushScheduler`, a `@Cron` every 5 minutes on an
  off-minute that no-ops entirely without keys and otherwise pushes each due, undelivered,
  non-dismissed reminder exactly once via the existing `Reminder.lastTriggeredAt` field, no
  new column needed). `apps/web/public/sw.js` gained `push`/`notificationclick` handlers; a
  new `push-settings-card.tsx` on `/settings` mirrors `ai-feedback-card.tsx`'s
  hidden-when-unavailable pattern. No third-party account needed — VAPID keys are
  self-generated (`npx web-push generate-vapid-keys`). 14 zero-network tests. Live-verified
  locally with a generated keypair: `GET /push/config` reports `available:true`+key,
  subscribe/unsubscribe round-trips clean. Real iOS install→subscribe→receive is unverified
  until deployed over HTTPS (push requires it) — flagged the same way as AI grading's live
  key path.
- **MOM-093** Graceful shutdown — **DONE** 2026-07-07. `app.enableShutdownHooks()` was never
  called in `main.ts`, so `PrismaService.onModuleDestroy` never fired on SIGTERM — a
  platform redeploy/restart dropped connections mid-request instead of disconnecting
  cleanly. One-line fix.
- **MOM-094** Real token revocation — **DONE** 2026-07-07. `User.tokenVersion` embedded as
  `tv` in every signed JWT; `JwtAuthGuard` now checks it against the current DB value and
  rejects a mismatch. `POST /auth/logout` (previously a no-op) bumps `tokenVersion`,
  invalidating every token issued before it immediately instead of leaving them valid for
  up to 30 more days (the JWT expiry). This was flagged as the single largest security
  exposure in the audit (a leaked localStorage token had no revocation path at all).
  Live-verified: login → logout → the same old token gets 401 "Session has been revoked";
  a fresh login still works. 6 new guard tests.
- **MOM-095** API never linted in CI — **DONE** 2026-07-07. `apps/api` had no ESLint config
  or `lint` script at all, so root `pnpm -r lint` (already run in CI) silently skipped it.
  Added `eslint.config.mjs` + script; fixed the two issues this surfaced (an
  `@typescript-eslint/no-empty-object-type` on a bare `Prisma.XGetPayload<{}>`, one unused
  import).
- **MOM-096** UX/accessibility polish — **DONE** 2026-07-07. 401 mid-session now triggers
  auto-logout + redirect (previously just silently cleared the token, leaving stale UI up
  until the next manual navigation) via a `momito:unauthorized` window event `api-client.ts`
  dispatches and `AuthProvider` listens for. Questions search debounced (300ms; was firing
  one request per keystroke) and filters written to the URL so they survive back/forward
  and PWA relaunch. Optimistic updates (remove-then-rollback-on-error, no full refetch) for
  Today's reminder-dismiss/inline-review-rating and Calendar's complete/snooze/dismiss —
  verified live at ~100ms perceived latency vs. a real round trip. Labeled the
  previously-unlabeled Questions/Calendar form controls; `Card` (`ui.tsx`) is now
  keyboard-reachable (`role="button"`/tabIndex/Enter+Space) when given an `onClick`; `Badge`/
  `Pagination` gained `dark:` variants (previously always light-mode colors, illegible in
  dark mode since MOM-013). `ReminderBell` now polls every 60s + on window focus instead of
  fetching once on mount. New `Skeleton`/`ListSkeleton` primitives replace the full-page
  spinner on Today/Questions.
- **MOM-097** Frontend test foundation — **DONE** 2026-07-07. `apps/web` had zero automated
  tests. Added vitest + `@testing-library/react` + jsdom (no `@vitejs/plugin-react` — a vite
  version conflict in this monorepo's install; tsconfig's `"jsx":"react-jsx"` is enough for
  Vite's default esbuild transform). 20 tests: `api-client` error shaping/401 flow, an
  extracted-and-tested `resolveInitialTheme()` pure function (the logic MOM-091's
  pre-hydration script has to hand-duplicate), `push-settings-card` visibility states,
  Today's priority-queue ordering, and the practice-session answer-submit payload
  (self-rating/missTags/reflectionNote present-when-set, omitted-when-default). Caught one
  real bug while writing the session-page test: a naive `useRouter` mock returning a fresh
  object every call changed `fetchSession`'s `useCallback` identity every render,
  re-triggering its effect in an infinite fetch loop — a test-mock artifact (real Next
  returns a stable router), not an app bug, fixed by memoizing the mock.
- **MOM-098** `aiScore` scale reconciliation — **VERIFIED, no bug found** 2026-07-07. The
  audit flagged this as a landmine worth checking: `ai.service.ts` writes `aiScore =
  overallScore / 100` (a 0–1 scale), and `dsa.service.ts`/`missions.service.ts` both gate on
  `aiScore >= 0.6`. Confirmed these agree (a 65/100 AI grade counts as solved/positive, a
  55/100 does not) and pinned the contract with regression tests in both services so a
  future accidental removal of the `/100` conversion would be caught immediately (a
  raw 55 would wrongly satisfy `>= 0.6`).
- **MOM-099** AI budget check-and-reserve race — **DONE** 2026-07-07. The old
  `checkAndReserve` read today's usage via a plain `SELECT`, so two concurrent grade
  requests could both read "under budget" and both proceed, overshooting the daily cap once
  both eventually recorded their real cost. Replaced with an atomic conditional `UPDATE ...
  WHERE cost_usd < budget` (via Prisma's `updateMany`), closing the read-then-write gap —
  the real per-call cost still can't be reserved upfront since it's unknown until the model
  responds; `record()` still trues it up afterward. Low real-world risk for a single-user
  app; fixed while already touching the module.
- **MOM-100** `answer_attempts` composite index — **DONE** 2026-07-07. Added `@@index([
  userId, createdAt])` alongside the existing single-column `userId` index, covering
  `dashboard.service.ts`'s recent-attempts query (filter by user, order by createdAt desc)
  directly.
- **Consciously deferred, not built this pass:** Readwise access-token encryption at rest
  (do when that integration goes live in a real public deploy — currently plaintext, low
  risk while nothing is publicly deployed); throttler external storage (in-memory is fine
  for a single Render dyno; revisit only if ever scaled beyond one instance); stricter
  password complexity rules (single-user account, not worth the friction); Sentry/metrics/
  request-ID correlation (genuinely useful, but needs a real deployed instance to be
  worth wiring up — premature against localhost).

---

## 4b. CareerOS tracks (M–S) — turn the study tool into a role-landing OS

Full plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`. **Thesis:** the study loop closes; the *career* loop
does not. Every task serves the North-Star Career Loop `TARGET → TAILOR → APPLY → PREP → INTERVIEW →
OUTCOME → LEARN → re-TARGET`, and must make an OUTCOME reshape the next PREP or a TARGET/conversion
decision sharper. Owner decisions: (1) **close the study↔target loop first**; (2) résumé track is
**AI-first, dormant-until-key** (MOM-068 pattern); (3) **missions frozen** — pipeline-driven loop is
primary, the two readiness engines consolidate into one FSRS-grounded engine (MOM-129). Every schema
task is a DESIGN-doc PR then a separate human-approved implementer PR (D-004), tested on fresh + existing DB.

### Track M — Pipeline Truth & Funnel Analytics · CareerOS Gate 2
- **MOM-101** Funnel & conversion endpoint + dashboard card (saved→…→offer, response rate, per-source/per-visaTag) · READY · EITHER · *small, no schema*
- **MOM-102** Auto-create `JobEvent` on status transition (from→to, ts) via `update()` · READY · EITHER · *small, no schema*
- **MOM-103** SPIKE-009 + migration DESIGN: per-stage timestamps / `StatusTransition` history · NEEDS_SPIKE · CLAUDE
- **MOM-104** Implement timestamp + transition-history migration + service writes · BLOCKED on MOM-103 · *migration*
- **MOM-105** Time-in-stage stall detection on job list + Today · BLOCKED on MOM-104,117
- **MOM-106** Rejection-reason + loss-analysis capture (`REJECTION_REASONS` enum on transition) · BLOCKED on MOM-104
- **MOM-107** Kanban board pipeline view (drag → existing status `update()`) · READY · EITHER
- **MOM-108** Quick-add / paste-JD rapid capture (reuse `extractJdSkills`) · READY · EITHER · *no schema*

### Track N — Interview Rounds, Debriefs & Offers · CareerOS Gate 3
- **MOM-109** SPIKE-010 + DESIGN: `InterviewRound` (roundType, interviewer, scheduledAt, outcome, debrief) · **DESIGN DONE** (ADR-0013 / D-016, 2026-07-09) · CLAUDE. SPIKE-010 resolved: round owns no prep/practice — attaches via a nullable `interviewRoundId` back-ref on `Task`/`InterviewSession` (added in MOM-111/141), no dual-write; reminders keyed per-round; coexists with `JobEvent` (no backfill); outcome independent of pipeline status. Additive migration → MOM-110 awaits D-004.
- **MOM-110** Implement `InterviewRound` + CRUD + timeline UI upgrade in place · **DONE** 2026-07-09 (migration `20260708173028_interview_rounds`, additive; CRUD scoped to owned job; `InterviewRoundsCard` on job detail with outcome badge + debrief editor emitting `areasWeak`/`missTags`; 179 API tests; live CRUD round-trip + Playwright screenshot verified) · *migration*
- **MOM-111** Round-scoped prep task generation (extend `generatePrep`) · **DONE** 2026-07-09 (additive migration `task_interview_round`: nullable `Task.interviewRoundId` FK; `generatePrep(jobId,roundId)` filters the role checklist by a `ROUND_TYPE_FOCUS` map, staggers due dates before `scheduledAt`, back-refs the round; per-round Prep button. 202 API tests; live + DB verified.) · *migration*
- **MOM-112** Interview-date reminder automation (reuse `ensureDeadlineReminder`) · **DONE** 2026-07-09 (additive migration `reminder_interview_round`: nullable `Reminder.interviewRoundId` FK; `ensureRoundReminder` upserts one per-round reminder due the day before `scheduledAt`, cleans up when the date is cleared, surfaces via existing reminders UI. 205 API tests; live-verified.) · *migration*
- **MOM-113** Debrief → `WeaknessSignal`/`LearningEvidence` emission — **the loop-closing edge** · **DONE** 2026-07-09 (no schema; `emitDebriefSignals` in `interview-rounds.service.update()` fires area+reason signals via MOM-127's `recordSignal` + writes one `interview_debrief` `LearningEvidence` row per round as the OUTCOME record and idempotency ledger; per-round idempotent via `metadata.emittedKeys`, best-effort. 182 API tests; live-verified: bombed Meta round → 3 job-scoped open signals, re-save doesn't inflate.)
- **MOM-114** SPIKE-015 + structured `Offer` model (base/equity/bonus/location/visa/deadline) · NEEDS_SPIKE · CLAUDE · *migration*
- **MOM-115** Offer comparison decision view (normalized, visa-adjusted) · BLOCKED on MOM-114

### Track O — Contacts, Referrals & Follow-up Cadence · CareerOS Gate 3
- **MOM-116** SPIKE-011 + DESIGN: `Contact` model; migrate `referralName` · NEEDS_SPIKE · CLAUDE
- **MOM-117** Implement `Contact` CRUD + attach to job + `referralName` backfill · BLOCKED on MOM-116 · *migration*
- **MOM-118** Stage-driven follow-up cadence reminders · BLOCKED on MOM-104,117
- **MOM-119** Referral network view + Today thank-you nudges · BLOCKED on MOM-117

### Track P — Company Intelligence & Job↔Company Linkage · CareerOS Gate 2/5
- **MOM-120** SPIKE-012 + DESIGN: structured `Company` (rounds, focus-area weights vs `CAREER_ROLE_AREA_IDS`, `sponsorshipStatus`, `compBand`) + nullable `JobApplication.companyId` FK · NEEDS_SPIKE · CLAUDE
- **MOM-121** Implement structured `Company` columns + migrate 20 seed packs' focus/track prose · BLOCKED on MOM-120 · *migration*
- **MOM-122** Add `companyId` FK + link/backfill UI (**highest-risk migration**) · BLOCKED on MOM-120 · *migration*
- **MOM-123** Company detail page (interview process, focus, sponsorship, linked content) · BLOCKED on MOM-121
- **MOM-124** Visa/sponsorship filter + sort on catalog + job list · BLOCKED on MOM-121
- **MOM-125** Company targeting/fit shortlist (fit × company-readiness × sponsorship × region) · BLOCKED on MOM-121,130

### Track R — Target-Scoped Readiness & Weakness Engine · CareerOS Gate 1 *(spine; owner's first focus)*
- **MOM-126** SPIKE-013 + DESIGN: `WeaknessSignal` (V2 §5.4) + `roleTrackId/area` tags on `AnswerAttempt` · **DESIGN DONE** (ADR-0011 finalized 2026-07-08) · CLAUDE. SPIKE-013 resolved: keep the derived weakness path + a table for event-sourced signals (debriefs) only; FSRS-per-area is a cheap bounded service-layer join (no `ReviewState` denorm); tags go on `AnswerAttempt` not `ReviewState`; `companyId` deferred (scoped via `jobApplicationId` until the MOM-122 FK lands). Additive migration → MOM-127 implementer PR awaits D-004 approval.
- **MOM-127** Implement `WeaknessSignal` + `mixed_interview` session type (reuse `selectWeaknessQuestions`) · **DONE** 2026-07-09 (migration `20260708170956_weakness_signals`, additive; store + read-time decay + resolve/dismiss + `openSignals` in summary; 171 API tests, live-verified). `weakness_repair` reconciled to the existing `weak_area_review` (ADR-0011 §3) — no duplicate type. · *migration*
- **MOM-128** Tag study signals on create (populate `AnswerAttempt.roleTrackId/area`) + implement missing `job_prep` session branch (derive question set from `jobApplicationId`; no MOM-122 dependency after SPIKE-013) · **DONE** 2026-07-09 (no schema; `answer()` tags area from the practiced question + roleTrackId from the session; `selectJobPrepQuestions` draws the company bank with this job's open-weakness areas leading. 187 API tests; live-verified: a Meta job_prep session returned only `system_design` questions after that round was bombed, and attempts carry area/roleTrackId.)
- **MOM-129** **Ground readiness in FSRS retrievability + graded attempts; consolidate the two readiness engines into one** · **DONE** 2026-07-09 (no schema; new shared `ReadinessService` = canonical `isPositiveAttempt` + FSRS-grounded `areaMastery` (retrievability via `ts-fsrs` over `ReviewState`→`Question.areaTags` + graded attempts by `area`). career blends coverage 50/50 with mastery + exposes `masteryScore`/`retrievability`; missions shares the positive-attempt rule. 197 API tests; live-verified: real retrievability on career/dashboard, mission diagnose intact.) · *large*
- **MOM-130** Company-scoped readiness rollup ("am I ready for Meta?" go/no-go) · **DONE** 2026-07-09 (no schema; `career.getJobReadiness` = grounded role readiness (MOM-129) − open-weakness-signal penalty (MOM-113), route `GET /career/jobs/:jobId/readiness`, `JobReadinessCard` on the job page. Focus derived from role-track checklist until MOM-121's structured Company lands. 200 API tests; live-verified: bombed Meta round → verdict 2/100 not_ready, penalty 15.) · *company focus-weighting enriches when MOM-121 lands*
- **MOM-131** Story coverage → specific-interview behavioral gap map · BLOCKED on MOM-110,121

### Track Q — Résumé Versioning, Tailoring & Artifacts · CareerOS Gate 4 *(AI-first; key coming)*
- **MOM-132** SPIKE-014 + DESIGN: `ResumeVersion` decoupled from `@unique Profile` · NEEDS_SPIKE · CLAUDE
- **MOM-133** Implement `ResumeVersion` CRUD + link to `JobApplication` · BLOCKED on MOM-132 · *migration*
- **MOM-134** ATS keyword coverage vs a JD (deterministic; extend `extractJdSkills`) · READY (lite form in Phase 0) · EITHER
- **MOM-135** Gap → Task bridge from `score-profile`/ATS (reuse `generatePrep` pattern) · READY · EITHER · *no schema*
- **MOM-136** AI résumé/bullet analysis service (dormant-until-key; reuse `grading.service`) · BLOCKED on MOM-133 · *AI-dormant*
- **MOM-137** AI bullet rewriting per JD · BLOCKED on MOM-136 · *AI-dormant*
- **MOM-138** AI cover-letter drafting per job (visa-context framing) · BLOCKED on MOM-136 · *AI-dormant*
- **MOM-139** Résumé export — Markdown then ATS-safe PDF · BLOCKED on MOM-133

### Track S — Career Today, Automation & Loop Closure · CareerOS Gate 1/5
- **MOM-140** Stage-aware Today cards + interview countdown · READY (lite copy in Phase 0) · EITHER
- **MOM-141** Auto-assembled company/round-scoped prep queue on approaching date · BLOCKED on MOM-111,128,131
- **MOM-142** Register career-target items in `recommendations.service` · **DONE** 2026-07-09 (open `WeaknessSignal`s — the MOM-113 debrief output — surface as ranked `Repair:` Today cards at priority 95–99, deduped against the derived path; readiness-gap cards already existed. 190 API tests; live + Playwright verified: 3 Meta debrief signals render on Today. **Completes CareerOS Gate 1 loop visibility.**) · *Stall-detection cards (the MOM-105 sub-part) fold in when MOM-105 lands in Phase 2.*
- **MOM-145** Conversion analytics by source **and** résumé version · BLOCKED on MOM-101,133
- *(MOM-143 mission auto-diagnose, MOM-144 mission-plan visa weighting — **DROPPED** under missions-frozen (D-015); intent lives in MOM-141/142 and MOM-125.)*

### CareerOS Phase Gates (continue the product Gate sequence 1–6)
- **CareerOS Gate 1 — Loop Closes:** target carries structured company context; an interview debrief emits a weakness signal that changes Today's prep; FSRS-grounded company-scoped readiness verdict renders; auto prep-queue counts down. *(First — owner's loop-closure-first choice.)* Tracks R + N(113) + P(120-122) + S(140-142).
- **CareerOS Gate 2 — Pipeline Truth:** stage machine + transition history live; funnel card real; stalls + rejection reasons captured. Track M.
- **CareerOS Gate 3 — Relationships & Rounds:** `InterviewRound` + debrief live; `Contact` replaces `referralName`; follow-up cadence fires; offers structured + comparable. Tracks N + O.
- **CareerOS Gate 4 — Artifacts:** `ResumeVersion` + per-application linkage; ATS coverage + export; AI tailoring dormant (mocked tests), live path VERIFICATION-BLOCKED pending key. Track Q.
- **CareerOS Gate 5 — Targeting & Decision:** company detail + sponsorship filter + targeting shortlist; conversion-by-source-and-résumé analytics. Tracks P + S(145).

---

## 5. Risk spikes (run before the dangerous task)

| Spike | Question to answer | Gates |
|---|---|---|
| SPIKE-001 | shadcn + Tailwind v4 + Next 16.2.9 compatibility (React 19) | MOM-007 |
| SPIKE-002 | Service-worker cache vs JWT auth behavior — **RESOLVED 2026-07-06, reversing the earlier DEFER** (D-007's multi-tenant Cache-API leak concern doesn't apply here: this is a single-user, localStorage-Bearer app with registration locked down by default — see the MOM-018 doctrine comment in `apps/api/src/common/config.ts` — so there's no second tenant whose cached HTML could leak). Shipped a hand-rolled `apps/web/public/sw.js`: precache `/`+`/offline` only, network-first-with-cache-fallback for same-origin navigations/static assets, **never caches cross-origin API calls or authenticated page HTML**, old-cache cleanup on activate. (Note: fixed a dangling "ADR-0001/0009" citation here 2026-07-07 — ADR-0009 never existed and ADR-0001 is about the NestJS-vs-Python backend choice, not this doctrine; there is no dedicated ADR for the single-user/localStorage-Bearer decision, only this inline doctrine comment.) | MOM-016 |
| SPIKE-003 | ReviewState polymorphic `objectType/objectId` migration on existing DB — **DONE 2026-07-05 for ReviewState/MOM-026**, see ADR-0002. `Story`'s own schema (MOM-063) — **DONE 2026-07-06**, see ADR-0005. | MOM-026, MOM-063 |
| SPIKE-004 | `ts-fsrs` real API + scheduling semantics — **DONE 2026-07-05**, see `apps/api/src/reviews/fsrs-scheduler.ts` | MOM-030 |
| SPIKE-005 | Anthropic SDK structured output — **DONE 2026-07-06**, see MOM-068 | MOM-068 |
| SPIKE-006 | LeetCode GraphQL response shape (metadata/links only) — **DEFERRED**, human judgment call (third-party GraphQL scope; not required for the study-loop-depth priority) | MOM-049 |
| SPIKE-007 | `StudyPlanItem` → `Task` field mapping + backfill — **DONE 2026-07-06**, see MOM-075/076/077 | MOM-075 |
| SPIKE-008 | Render cold-start reality + keep-warm — **DESIGNED, dormant** 2026-07-06: `.github/workflows/keepwarm.yml` pings `/health` every 10 min during study hours (07:00-24:59 ICT), skips cleanly if `API_HEALTH_URL` isn't set. Real cold-start behavior unverified (no live Render deploy in this environment). | MOM-021 |
| SPIKE-009 | (CareerOS) Per-stage timestamps vs a normalized `StatusTransition` history table — which shape supports funnel timing + stall detection without bloating `JobApplication`? | MOM-103 |
| SPIKE-010 | (CareerOS) `InterviewRound` + interview-date modeling + reminder idempotency; link to `InterviewSession`/`Task` **without repeating the PlanItem/Task dual-write anti-pattern** · **RESOLVED 2026-07-09** (ADR-0013 §SPIKE-010): round owns no rows — back-ref `interviewRoundId` FK on Task/Session (deferred to MOM-111/141); reminder sentinel keyed per-round; JobEvent coexists, no backfill; outcome ⟂ status. | MOM-109 |
| SPIKE-011 | (CareerOS) Migrate `referralName` String → `Contact` rows without data loss | MOM-116 |
| SPIKE-012 | (CareerOS) `JobApplication.company` free-text → `companyId` FK backfill by name-match with free-text fallback; structure `Company` focus-area weights vs `CAREER_ROLE_AREA_IDS`. **Highest-risk migration** (busiest table + seed) | MOM-120 |
| SPIKE-013 | (CareerOS) `WeaknessSignal` schema + tagging attempts with `roleTrackId/area`; is FSRS retrievability cheaply queryable to ground readiness per area? · **RESOLVED 2026-07-08** (ADR-0011 §SPIKE-013 findings): table stores only event-sourced signals (derived path kept for practice struggles); FSRS-per-area = bounded indexed service-layer join, no `ReviewState` denorm; tags on `AnswerAttempt` not `ReviewState`; `companyId` deferred to post-MOM-122, `jobApplicationId` scoping for now. | MOM-126 |
| SPIKE-014 | (CareerOS) `ResumeVersion` decoupling from `@unique Profile`; ATS-safe PDF-export library choice (new dep); AI tailoring cost/prompt/structured-output budget mirroring MOM-068 | MOM-132, MOM-136 |
| SPIKE-015 | (CareerOS) Offer/comp normalization (multi-currency, equity vesting, visa-adjusted) — enough structure to compare without over-modeling | MOM-114 |

---

## 6. Hard rules honored by this backlog (planner scope)

- No code written. No app source modified. No migrations created. `backend/`/`mobile/` are **moved, never deleted** (MOM-003).
- Every migration-bearing task is **NEEDS_SPIKE + human-approval gated**; the planner does not author schema changes.
- Tasks are PR-sized, dependency-ordered, and each carries verification + rollback.
- No "implement Phase X" tasks; no opportunistic rewrites; kill/defer rules applied (service worker, AI UI, jobs kanban, content batch 3, Story review).
