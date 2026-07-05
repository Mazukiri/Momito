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

### MOM-001 — Snapshot current repo state · READY · EITHER
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

### MOM-003 — Archive legacy Python backend & Expo mobile · READY · EITHER
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

### MOM-019 - Add health endpoint - READY - CODEX
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

### MOM-017 - API security hardening (helmet + throttling) - READY - NEEDS_REPO_INSPECTION - CODEX
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

### MOM-006 - Frontend utility foundation - READY - CODEX
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

### MOM-008 - Navigation model - READY - CODEX
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

### MOM-012 - `/today` stub route and redirect - READY - CODEX
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

### MOM-004 - Rewrite root project docs - READY - CLAUDE
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

### MOM-005 — Architecture doctrine ADRs · READY · CLAUDE
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
- **MOM-007** Design-system primitives (shadcn/Tailwind v4) — **NEEDS_SPIKE** (SPIKE-001).
- **MOM-009** Mobile bottom tabs — BLOCKED on MOM-007, MOM-008.
- **MOM-010** Desktop sidebar + top bar — BLOCKED on MOM-008.
- **MOM-011** Rewrite authenticated layout shell (mobile-first; current nav is `hidden sm:flex` = no mobile nav) — BLOCKED on MOM-009/010.
- **MOM-013** Theme + typography baseline (dark/light) — READY after MOM-007.
- **MOM-014** Restyle auth pages for phone — READY after MOM-007.
- **MOM-015** PWA manifest + icons — READY (safe, ship before service worker).
- **MOM-016** Offline page + service worker — **NEEDS_SPIKE** (SPIKE-002); **DEFER** per kill rule if it destabilizes auth/cache.

### Track C — API Foundation · Gate 1
- **MOM-017** Security hardening — detailed in §3.
- **MOM-018** Auth throttling + registration lock — READY after MOM-017.
- **MOM-019** Health endpoint — detailed in §3.
- **MOM-020** Neon `directUrl` support — **NEEDS_REPO_INSPECTION** (schema `datasource` currently single `url`); small.
- **MOM-021** First deploy (Vercel + Render + Neon) — BLOCKED on MOM-015/019/020; **NEEDS_SPIKE** (SPIKE-008 Render cold start).

### Track D — Knowledge Kernel (type/service layer only)
- **MOM-022** Shared domain constants — READY (extend `packages/shared/src/index.ts`; `QUESTION_TYPES` already exists).
- **MOM-023** Rubric type definitions — READY (Question.rubric Json already present; formalize the shape).
- **MOM-024** Content validation framework (`content:validate/stats/sample`) — READY.
- **MOM-025** KnowledgeObject response helpers — BLOCKED on MOM-022/023.

### Track E — Review & Learning Engine · Gate 2
- **MOM-026** Design ReviewState migration — **DONE** (2026-07-05). SPIKE-003 answered in
  `docs/adr/0002-reviewstate-polymorphic-object-reference.md`; see `DECISIONS.MD` D-005.
- **MOM-027** Implement ReviewState migration — READY, but **BLOCKED on human approval**
  (D-004: planner/implementer may not author migrations unattended). Design is complete;
  a human must explicitly greenlight running `prisma migrate dev` for this to proceed.
- **MOM-028** Attempt reflection fields — **NEEDS_REPO_INSPECTION** (most fields already exist; only miss-tags/reflection-note may be missing).
- **MOM-029** Reviews module (API) — BLOCKED on MOM-027.
- **MOM-030** FSRS scheduling service — **DONE (algorithm layer only)** 2026-07-05.
  `apps/api/src/reviews/fsrs-scheduler.ts` wraps `ts-fsrs` as pure functions
  (`createInitialReviewState`, `scheduleNextReview`, `selfRatingToGrade`) operating on
  plain `ReviewCardState` objects shaped like ADR-0002's planned `ReviewState` columns —
  no persistence, no module/controller, since there's no `ReviewState` table yet
  (MOM-027, human-gated). MOM-031 wires this to Prisma once that migration lands.
- **MOM-031** Hook answer submission into scheduling — BLOCKED on MOM-029/030.
- **MOM-032** Today dashboard API (queue priority §6.1) — BLOCKED on MOM-031.
- **MOM-033** Recommendation reason standardization — **DONE** 2026-07-05. The reason
  taxonomy half was already implemented in an earlier session (`RECOMMENDATION_REASONS`
  in `recommendations.service.ts`). This pass did the remaining "Today integration" half:
  `apps/web/app/(authenticated)/today/page.tsx` was a static MOM-012 stub with no data
  fetching; it now calls `recommendationsApi.list()` (the same endpoint the Dashboard's
  "Next Actions" card already used) and renders the real, priority-sorted recommendation
  queue. Spaced-repetition due-reviews still can't appear here — that needs MOM-027/032.

### Track F — Practice Engine UI · Gate 2
- **MOM-034** Markdown renderer — READY after MOM-007 (add `react-markdown`).
- **MOM-035** CodeMirror editor — **NEEDS_SPIKE** (bundle/SSR in Next 16).
- **MOM-036** Timer hook — READY.
- **MOM-037** Split session page into components — **NEEDS_REPO_INSPECTION** (`practice/session/[id]` exists).
- **MOM-038** Answer panel by question type — **DONE** 2026-07-05. Split
  `AnswerForm.tsx`'s inline branching into `apps/web/app/components/session/answer-panels/`
  (`TextAnswerPanel`, `SystemDesignAnswerPanel`, `CodeAnswerPanel`); `AnswerForm` now just
  dispatches on question type. Pure refactor — behavior unchanged for every question type.
- **MOM-039** Reflection panel — BLOCKED on MOM-028.
- **MOM-040** Session summary — **NEEDS_REPO_INSPECTION** (`summary` route already exists).
- **MOM-041** Practice hub — BLOCKED on MOM-032.
- **MOM-042** Today learning cards — BLOCKED on MOM-032, MOM-012.

### Track G — Content Factory · Gate 3
- **MOM-043** Seed-data structure — READY (`prisma/seed.ts` exists; restructure).
- **MOM-044** Idempotent seed upsert utilities — READY.
- **MOM-045** Seed DSA patterns — BLOCKED on MOM-044.
- **MOM-046/047/048** DSA ladder batches (50/100/150) — BLOCKED chain; each gated by `content:validate` (kill rule: defer batch 3 if batch 1/2 fails).
- **MOM-049** LeetCode import service — **NEEDS_SPIKE** (SPIKE-006 GraphQL shape); links/metadata only, no copyrighted statements.
- **MOM-050** DSA progress API · **MOM-051** DSA ladder UI — BLOCKED on seeds.
- **MOM-052/053/054** CS fundamentals batches (50/100/150).
- **MOM-055/056** System design batches (10/25) · **MOM-057** System design editor (7-section template).
- **MOM-058/059** Behavioral prompt batches (30/60).
- **MOM-060** Company packs (20) — extends existing `Company` model/`companies` module.
- **MOM-061** Role tracks (8) - **NEEDS_REPO_INSPECTION** (`CAREER_ROLE_TRACKS` constants already define 4 tracks; extend constants to 8 first unless a separate migration design proves a table is needed).
- **MOM-062** Content coverage dashboard — BLOCKED on MOM-024.

### Track H — Story & Behavioral Engine · Gate 2/3
- **MOM-063** Story schema + review integration — **NEEDS_SPIKE** (no `Story` model exists yet;
  SPIKE-003's ReviewState-reuse findings apply directly once `Story` exists, but `Story`'s own
  schema — fields, columns, indexes — is not yet designed and needs its own short spike).
  *Migration → human-gated.*
- **MOM-064** Story CRUD API · **MOM-065** Story frontend · **MOM-066** Link stories↔prompts · **MOM-067** Rehearsal sessions — BLOCKED chain on MOM-063.

### Track I — AI Feedback Engine · Gate 4
- **MOM-068** AI SDK spike — **NEEDS_SPIKE** (SPIKE-005 Anthropic structured output; verify installed SDK before any code).
- **MOM-069** AiUsage migration — BLOCKED on MOM-068 + human approval.
- **MOM-070** Budget service · **MOM-071** Grading service · **MOM-072** Grade-attempt endpoint — BLOCKED chain.
- **MOM-073** AI feedback FE card · **MOM-074** Integrate into reflection panel — BLOCKED on MOM-039/072; **DEFER** until self-rating loop (Gate 2) is complete.

### Track J — Career Engine · Gate 5
- **MOM-075** Task consolidation migration design (`StudyPlanItem`→`Task`) — **NEEDS_SPIKE** (SPIKE-007). *Migration → human-gated.*
- **MOM-076** Merge StudyPlanItem into Task · **MOM-077** Remove old study-plan code — BLOCKED on MOM-075.
- **MOM-078** Reminder due-delivery / scheduler semantics - **NEEDS_REPO_INSPECTION** (`Reminder` model, task/job reminder creation, `GET /reminders`, dismiss endpoint, and dashboard summary already exist; no `@nestjs/schedule`/cron infra found).
- **MOM-079** Reminder API gap hardening - **NEEDS_REPO_INSPECTION**; do not recreate existing `GET /reminders` or `POST /reminders/:id/dismiss`; add only missing filters/status transitions/tests after inspection.
- **MOM-080** Reminder UI (Today + top bar) — BLOCKED on MOM-079, MOM-012.
- **MOM-081** Jobs page → mobile-first list (no drag-drop) — **NEEDS_REPO_INSPECTION** (`jobs/` route exists).
- **MOM-082** Career hub — **NEEDS_REPO_INSPECTION** (`career/` route exists).
- **MOM-083** Link jobs ↔ prep objects — BLOCKED on MOM-032.

### Track K — Operations & Hardening · Gate 6
- **MOM-084** Error/loading boundaries — READY (Next app router `error.tsx`/`loading.tsx`).
- **MOM-085** API exception filter + request logging — READY after MOM-017.
- **MOM-086** DB health ping — extends MOM-019.
- **MOM-087** Backup workflow (weekly encrypted) — **NEEDS_SPIKE** (Neon backup strategy).
- **MOM-088** Lighthouse + accessibility pass — BLOCKED on Gate 1 UI.
- **MOM-089** README rewrite — folded into MOM-004; final polish here.
- **MOM-090** Final full-product golden-path verification — BLOCKED on all gates.

---

## 5. Risk spikes (run before the dangerous task)

| Spike | Question to answer | Gates |
|---|---|---|
| SPIKE-001 | shadcn + Tailwind v4 + Next 16.2.9 compatibility (React 19) | MOM-007 |
| SPIKE-002 | Service-worker cache vs JWT auth behavior | MOM-016 |
| SPIKE-003 | ReviewState polymorphic `objectType/objectId` migration on existing DB — **DONE 2026-07-05 for ReviewState/MOM-026**, see ADR-0002. `Story`'s own schema (MOM-063) is separate and still open. | MOM-026, MOM-063 |
| SPIKE-004 | `ts-fsrs` real API + scheduling semantics — **DONE 2026-07-05**, see `apps/api/src/reviews/fsrs-scheduler.ts` | MOM-030 |
| SPIKE-005 | Anthropic SDK structured output — verify **installed** package, model ids, usage shape, error classes | MOM-068 |
| SPIKE-006 | LeetCode GraphQL response shape (metadata/links only) | MOM-049 |
| SPIKE-007 | `StudyPlanItem` → `Task` field mapping + backfill | MOM-075 |
| SPIKE-008 | Render cold-start reality + keep-warm | MOM-021 |

---

## 6. Hard rules honored by this backlog (planner scope)

- No code written. No app source modified. No migrations created. `backend/`/`mobile/` are **moved, never deleted** (MOM-003).
- Every migration-bearing task is **NEEDS_SPIKE + human-approval gated**; the planner does not author schema changes.
- Tasks are PR-sized, dependency-ordered, and each carries verification + rollback.
- No "implement Phase X" tasks; no opportunistic rewrites; kill/defer rules applied (service worker, AI UI, jobs kanban, content batch 3, Story review).
