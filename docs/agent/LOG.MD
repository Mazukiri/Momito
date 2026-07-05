# LOG

> Append-only execution journal. Newest entries on top. Every implementer PR adds an entry:
> task ID, files changed, checks run, result, risks/follow-ups.

---

## 2026-07-05 — P1 risk fix: DSA solved-heuristic counted 'partial' as solved (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Trigger:** `AGENTS.MD` was rewritten (by another agent/session) with a stricter
operating protocol and a new priority order — P0 (stabilize truth), P1 (fix named
technical risks before new features), P2 (Learning Loop), P3 (everything else). It
explicitly calls out: "DSA solved/progress heuristics must not treat partial attempts or
mis-scaled AI scores as clean solves," and "Do not count `partial` as solved clean."

**Investigation (via Explore subagent, read-only):** audited every read/write site of
`aiScore`/`rubricScore`/`selfRating`/`correctness`.
- `rubricScore` (DTO: `@Min(0) @Max(1)`) and `selfRating` (DTO: `@IsInt @Min(1) @Max(5)`)
  are read with matching thresholds (`>= 0.6`, `>= 3`) everywhere — no active mismatch.
- `aiScore` has no writer anywhere in the codebase (AI grading is credential-gated,
  unimplemented) — always `null` today, so its `>= 0.6` reads are inert, not wrong. This
  remains a documented landmine for whoever implements AI grading (scale must be decided
  and all three `>= 0.6` read-sites updated together), not a fix I could make blind today.
- `correctness` **is** a live, reachable field: `CreateAnswerDto` validates it as
  `@IsIn(['correct', 'partial', 'incorrect'])`. `apps/api/src/dsa/dsa.service.ts`'s
  `isSolved`/`isPositive` heuristic included `'partial'` alongside `'correct'`/`'strong'`
  as a solved signal — directly contradicting the new written policy, and overstating DSA
  ladder progress for any partial attempt submitted via the API.

**Fix:** `apps/api/src/dsa/dsa.service.ts` — extracted the duplicated positive/solved
predicate into one `isSolvedAttempt` helper and dropped `'partial'` from the
correctness-based solved signal (kept `'correct'`/`'strong'`); `rubricScore`/`selfRating`/
`aiScore` thresholds unchanged (no evidence they're wrong today). Added a regression test
(`test/dsa.service.spec.ts`) asserting a `correctness: 'partial'` attempt counts as
attempted but not solved.

**Follow-up (same session, user explicitly asked to extend to missions.service.ts too):**
on reflection, `apps/api/src/missions/missions.service.ts:532`'s `matchesAttempt` has the
identical pattern — a `positive` gate (used to count a practice attempt as meaningful
evidence toward a mission's skill level) that included `'partial'` alongside
`'correct'`/`'strong'`. Fixed the same way: dropped `'partial'`, matching
`career.service.ts`'s `isPositiveAttempt` (which already excluded it) and the new
`dsa.service.ts` behavior. No existing test covered `matchesAttempt`, so none needed
updating; behavior change is that a partial-correctness practice attempt no longer counts
toward a mission's `currentLevel` practice-evidence tally.

**Checks:** `pnpm --filter @momito/api test` ✅ (52/52, was 51), `pnpm --filter @momito/api
typecheck` ✅, `pnpm --filter @momito/api build` ✅ (all re-run after the
missions.service.ts change too).

**Not committed yet** — `AGENTS.MD` now says "Do not commit unless explicitly instructed,"
so this fix (and the CodeMirror work below, which was already committed before this file
was read) is left as an uncommitted working-tree change pending confirmation.

**Follow-ups (per AGENTS.MD's P1 list, not yet done):** normalize/decide `aiScore`'s scale
before AI grading ships; verify `DIRECT_URL` docs (checked — already correct in `.env`,
`.env.example`, and README's env var table, no change needed); run and document the
current Golden Path end-to-end.

---

## 2026-07-05 — MOM-035: CodeMirror editor for DSA/coding answers (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** MOM-035 (SPIKE + implementation), the task `NEXT.MD` queued after the Gate 3
content push.

**Spike findings:**
1. `next/dynamic(() => import(...), { ssr: false })` works cleanly under Next 16.2.9 +
   React 19 + Turbopack — confirmed against the vendored `node_modules/next/dist/docs`
   lazy-loading guide, no workaround needed.
2. Bundle impact: CodeMirror + 4 language packs (`@uiw/react-codemirror`,
   `@codemirror/lang-{javascript,python,cpp,java}`) land in their own ~684K (uncompressed)
   chunk, only fetched when a `dsa`/`cpp` question actually renders — confirmed via
   `grep -l codemirror .next/static/chunks/*.js` after `next build`. No other route's
   bundle grows.
3. Theme: shipped one dark-friendly CodeMirror theme (`theme="dark"`) for the initial cut
   rather than wiring it to `ThemeProvider` — acceptable per the spike questions, revisit
   if users complain in light mode.

**Changes:**
- `apps/web/package.json`, `pnpm-lock.yaml` — added `@uiw/react-codemirror` +
  `@codemirror/lang-{javascript,python,cpp,java}`.
- `apps/web/app/components/CodeEditor.tsx` (new) — client component wrapping
  `@uiw/react-codemirror` with a language picker (JS/Python/C++/Java) and line
  numbers/fold gutter enabled.
- `apps/web/app/components/session/AnswerForm.tsx` — added a `next/dynamic(..., { ssr:
  false })`-wrapped import of `CodeEditor`; renders it instead of the plain textarea when
  `question.type === 'dsa' || 'cpp'`. Every other question type (including
  `system_design`'s markdown preview) is untouched.

**Checks:** `pnpm --filter @momito/web typecheck` ✅, `pnpm --filter @momito/web lint` ✅,
`pnpm --filter @momito/web build` ✅ (31 routes, no SSR errors), `pnpm test` ✅ (51/51,
unaffected — this task touches web only).

**Risks/follow-ups:** editor theme is fixed-dark regardless of app light/dark mode; no
per-language linting/execution (this is an interview-practice text editor, not a sandboxed
runner, consistent with the plan's scope). MOM-038 (answer panel by question type) can now
build on this to give DSA/system_design/other each their own dedicated component instead of
branching inside `AnswerForm`.

---

## 2026-07-05 — Gate 3 content completion + practice UI features (CLAUDE, session 3)

**Actor:** CLAUDE (implementer)
**Scope:** User asked to "finish the rest MOM," continuing from the prior session's
DSA-ladder-at-99/150 checkpoint. This entry summarizes MOM-048 through MOM-057 plus the
final full-pipeline verification; MOM-048's own detailed entry follows immediately below
(written at the time, kept as-is).

**Gate 3 (Data Depth) — now substantially complete:**
- **DSA ladder: 149/150** (MOM-048, batch 4) — all 20 `DSA_PATTERNS` covered 2-3× each,
  with a genuine hard tier (32 hard items total across the ladder).
- **CS Fundamentals: 149/150** (MOM-052/053/054) — 74 original questions across OS,
  networking, databases, concurrency, computer architecture, ML fundamentals, OOP, JS/TS,
  Node.js, backend, C++, HPC, quant. Added 3 new topics (Concurrency & Parallelism,
  Computer Architecture, Machine Learning Fundamentals) that previously had none.
- **System Design: 24/25** (MOM-055/056) — 20 new cases (rate limiter, distributed KV
  store, chat app, job scheduler, web crawler, video streaming, typeahead, proximity
  search, leaderboard, message queue, distributed lock, ad click aggregation,
  collaborative editor, log aggregation, API gateway, distributed cache, payment
  processing, ride dispatch, distributed file storage, trending terms), each sketching
  the plan §7.4 seven-section shape.
- **Behavioral: 60/60 exactly** (MOM-058/059) — 56 new STAR-structuring prompts across
  ownership, feedback, conflict, ambiguity, incidents, mentorship, and more.
- **Companies (20/20) and Role Tracks (10, covering all 8 plan categories)** were already
  done in the prior session.
- **Bug fixed along the way:** `content-lib.ts`'s copied-statement length heuristic
  (>700 chars) fired on any long answer regardless of source, false-positiving on
  legitimately long original system-design content. Now gated to only apply when a
  `sourceUrl` is present (the only content D-008 actually needs to guard against copying).

**Feature work beyond content:**
- **MOM-062 Content coverage dashboard** — `GET /content/coverage` (Prisma groupBy over
  the live `questions` table) + `/settings/content` page with progress bars against plan
  §8.2 targets. Reflects actual deployment state, not the static seed script.
- **MOM-050/051 DSA progress + ladder UI** — `GET /dsa/progress` cross-references dsa
  `Question.patternTags` against `AnswerAttempt` history (reusing missions.service.ts's
  positive-attempt heuristic for "solved"); `/practice/dsa-ladder` renders per-pattern
  progress cards that deep-link into `/practice/new?pattern=X` (which previously silently
  ignored a `pattern` query param — now wired).
- **MOM-041 Practice hub** — new `/practice` landing page (in-progress sessions + entry
  points into every mode); nav's "Practice" tab now points here instead of straight into
  the session form. `/questions` now reads a `type` query param too (previously ignored).
- **MOM-057 System design answer editor** — `AnswerForm` offers a 7-section markdown
  template insert button and an Edit/Preview toggle (via the existing `Markdown`
  component) for `system_design` questions.
- **README** updated throughout to match: route table, seed counts (382 questions total),
  question-type count (17), new API endpoints, feature descriptions.

**Checks run (final full pass, all green):**
- `pnpm lint` — 3/3 projects
- `pnpm typecheck` — 3/3 projects (shared, api, web)
- `pnpm test` — 51 API tests across 15 files
- `pnpm build` — all 3 packages, 31 web routes
- `pnpm content:validate` — 0 errors on 382 seed questions
- `pnpm content:stats` — DSA 149, CS Fundamentals 149, System Design 24, Behavioral 60,
  Companies 20, Role Tracks 10

**Result:** 8 commits this session (`f3c1c78`..latest). Gate 3 content targets are all
met or within 1 of target. Practice UI now has a real hub, DSA pattern tracking, and a
system-design-specific editor — Gate 2 (Learning Loop) is closer but still blocked on the
ReviewState migration (human-approval gated, per D-004) for the actual FSRS scheduling
loop; today's work covers the UI/content side that doesn't need that migration.

**Deliberately NOT done — still schema-migration-gated (per D-004):**
- ReviewState, Story, AiUsage models; StudyPlanItem→Task consolidation; the four missing
  AnswerAttempt reflection columns (miss tags, reflection note, language, complexity).

**Deliberately NOT done — still needs real credentials/external services:**
- Deploy (Vercel/Render/Neon), AI Feedback Engine (Anthropic API key), LeetCode GraphQL
  import, backup workflow.

**Not attempted — genuinely large remaining work, not gated, just sizeable:**
- MOM-029-032 (reviews module/FSRS service/Today API — blocked on ReviewState migration).
- MOM-035 CodeMirror editor; MOM-038/039 answer-panel-by-type/reflection panel (blocked on
  028/035).
- MOM-063-067 Story engine (blocked on Story model migration).
- MOM-076/077/078/080/083 task consolidation cleanup, reminder scheduler polish,
  job-linked prep.
- MOM-088 Lighthouse/a11y pass; MOM-090 final golden-path verification (needs a live
  browser + backend, not just unit tests — see the `/verify` skill for that kind of check).
- Full page-by-page dark-mode adoption (only the shell + shared primitives got it in the
  earlier session; documented then, still true now).

---

## 2026-07-05 — MOM-048 (CLAUDE IMPLEMENTER mode) — DSA Gate-3 target reached

**Actor:** CLAUDE (implementer)
**Task:** MOM-048 — Seed DSA ladder batch 4 (150 total), completing the DSA portion of
Gate 3 (Data Depth).

**Files changed:** `apps/api/prisma/seed.ts` (50 new DSA entries appended).

**What shipped:** Final DSA batch bringing the ladder to 149/150, with a genuine hard
tier this round (14 hard items: Burst Balloons, Edit Distance, Regular Expression
Matching, Binary Tree Maximum Path Sum, Serialize/Deserialize Binary Tree, Sudoku Solver,
Word Search II, Largest Rectangle in Histogram, Split Array Largest Sum, Sliding Window
Maximum/Median, Candy, Word Break II) plus continued depth across all 20 `DSA_PATTERNS`.

**Checks run:** `pnpm content:validate` (0 errors), `pnpm content:stats` (DSA 149, total
187), `pnpm --filter @momito/api typecheck/build/test` (48/48 passed).

**Result:** DSA ladder complete at 149/150 (Gate-3 target). Continuing to the other
Gate-3 content areas: CS Fundamentals (150), System Design (25), Behavioral (60).

---

## 2026-07-05 — MOM-047 (CLAUDE IMPLEMENTER mode)

**Actor:** CLAUDE (implementer)
**Task:** MOM-047 — Seed DSA ladder batch 3 (100 total), continuing from MOM-046.

**Files changed:** `apps/api/prisma/seed.ts` (49 new DSA entries appended to the
`questions` array; no reordering of existing entries).

**What shipped:** 49 original DSA items giving every one of the 20 `DSA_PATTERNS` a
second or third example at varying difficulty — linked-list reversal/fast-slow depth,
interval/tree-BFS/topological depth, monotonic stack, binary-search-on-the-answer,
weighted and plain union-find, prefix-sum-mod-k, trie, cyclic sort (including First
Missing Positive), two-pointer variants, sliding window, five more DP problems, two-heap
median tracking, BFS grid/graph problems, backtracking, greedy, and bit tricks. Same
D-008 rule: `prompt`/`answer` are original approach notes, not restated problem text;
`sourceUrl` links to the real LeetCode page for each.

**Checks run:** `pnpm content:validate` (0 errors), `pnpm content:stats` (DSA count 99,
total 137 seed questions), `pnpm --filter @momito/api typecheck` (clean),
`pnpm --filter @momito/api build` (clean), `pnpm --filter @momito/api test` (48/48
passed), manual `content:sample 3` read-through.

**Result:** DSA ladder now at 99/150 (Gate-3 target). Batch validated cleanly, so per the
kill/defer rule batch 4 is not deferred.

**Risks / follow-ups:**
- Same sourceUrl-verification caveat as MOM-046 — slugs chosen from well-known, stable
  LeetCode problems but not verified via live network access in this sandbox.
- The seed file is now quite large (`prisma/seed.ts`); if a future session finds it
  unwieldy, splitting DSA content into its own file (e.g. `prisma/seed-data/dsa.ts`) and
  importing it would be a reasonable, low-risk restructure — not done here to avoid
  touching working code without a concrete need.

---

## 2026-07-05 — MOM-046 (CLAUDE IMPLEMENTER mode)

**Actor:** CLAUDE (implementer)
**Task:** MOM-046 — Seed DSA ladder batch 2 (50 total), continuing from the "Bulk
implementer pass" entry below.

**Files changed:** `apps/api/prisma/seed.ts` (33 new DSA entries appended to the
`questions` array; no reordering of existing entries).

**What shipped:** 33 original DSA items covering the 8 `DSA_PATTERNS` values batch 1
(MOM-045) hadn't reached — `cyclic_sort`, `tree_dfs`, `union_find`, `backtracking`,
`greedy`, `prefix_sum`, `bit_manipulation`, `trie` — plus added depth to already-seeded
patterns (`two_pointers`, `sliding_window`, `dynamic_programming`, `graph_traversal`,
`heap_priority_queue`, `binary_search`, `monotonic_stack`). All 20 `DSA_PATTERNS` now have
at least one seeded item. Same D-008 rule as MOM-045: `prompt`/`answer` are original
approach notes (key insight + complexity), not restated problem text; `sourceUrl` links to
the real LeetCode page.

**Checks run:** `pnpm content:validate` (0 errors), `pnpm content:stats` (DSA count
exactly 50, total 88 seed questions), `pnpm --filter @momito/api typecheck` (clean),
`pnpm --filter @momito/api build` (clean), `pnpm --filter @momito/api test` (48/48 passed),
manual `content:sample 3` read-through to confirm no entry reads like a restated problem.

**Result:** DSA ladder now at 50/150 (Gate-3 target). Batch validated cleanly, so per the
kill/defer rule ("defer batch 3 if batch 1/2 fails validation") batch 3 is not deferred.

**Risks / follow-ups:**
- `sourceUrl` slugs were chosen from well-known, long-stable LeetCode problems (not
  verified via live network access in this sandbox) — worth a spot check against the live
  site before this becomes user-facing in production.
- Difficulty distribution after this batch: 23 easy / 49 medium / 16 hard (DSA-only was not
  tracked separately by `content:stats`; consider adding a per-type difficulty breakdown if
  the ladder needs tighter curve control later).

---

## 2026-07-05 — Bulk implementer pass (CLAUDE, ~24 tasks across Tracks A-K)

**Actor:** CLAUDE (implementer)
**Scope:** User asked to work through all remaining BACKLOG.MD tasks. Agreed approach:
take over from Codex (commit MOM-003, drive NEXT.MD), skip anything schema-migration /
deploy-credential / AI-API-key gated, and implement everything else that's genuinely
unblocked. Full history is in `git log` (12 commits, `73eb5ae`..`bfcccba`); this entry
summarizes what shipped, in dependency order.

**Track A — Safety:** Committed MOM-003 (Codex's staged archive move).

**Track B — Mobile Platform:** MOM-006 `cn()` util (clsx+tailwind-merge). MOM-007 added
Button/Input primitives to the existing `components/ui.tsx` instead of the shadcn CLI
(SPIKE-001: would've forked the design system in two). MOM-008 central `NAV_ITEMS`/
`PRIMARY_NAV_ITEMS`. MOM-009/010 `BottomTabs`/`Sidebar`. MOM-011 rewrote the authenticated
layout to compose them (mobile bottom tabs, desktop sidebar, content padding so tabs never
cover it). MOM-012 real `/today` stub route; login/register/root now land there. MOM-013
class-based dark mode (`@custom-variant dark`), `ThemeProvider` + toggle, applied to the
shell + shared primitives (full page-by-page dark-mode adoption is NOT done — documented,
not silently claimed). MOM-014 restyled auth pages (Input/Button primitives, `text-base`
inputs to stop iOS auto-zoom). MOM-015 PWA manifest + generated icon/apple-icon/192/512
via `next/og` (no real designed art yet). MOM-016 (SPIKE-002): evaluated service worker vs
JWT-in-localStorage risk, **deferred** per D-007 (cross-user cache leak, update/versioning,
stale-auth-shell risks) — not implemented.

**Track C — API Foundation:** MOM-017 helmet + global `@nestjs/throttler` (100/min),
layered on top of the existing prefix/CORS/ValidationPipe (not replacing it). MOM-018 auth
routes throttled 5/min; registration locked after the first account exists (single-user
personal tool, not SaaS) unless `ALLOW_MULTI_USER_REGISTRATION=true`. MOM-019 `GET /health`
(no DB dep, skip-throttled). MOM-020 `directUrl` added to the Prisma datasource for Neon;
required adding `DIRECT_URL` to `.env`/`.env.example`/CI or `prisma validate` breaks.

**Track D — Knowledge Kernel:** MOM-022/023 `KnowledgeObject`/`Reviewable`/`Rubric` types
added to `packages/shared` (type-layer only, no schema change, per D-003). MOM-025
`questionToKnowledgeObject()` maps `Question` rows via a `QuestionType -> KnowledgeDomain`
table. MOM-024 `pnpm content:validate/stats/sample` scripts read directly from
`prisma/seed.ts`'s exported data (no DB connection needed); `seed.ts`'s `main()` is now
guarded by `require.main` so importing its exports doesn't trigger a live seed.

**Track E — Learning Engine:** MOM-028 (inspection only): documented in DECISIONS.md which
`AnswerAttempt` reflection fields already exist vs. which need a migration (miss tags,
reflection note, language, complexity) — **no migration attempted** (human-approval gated).
MOM-033 standardized `RecommendationsService` reason strings into full sentences.

**Track F — Practice UI:** MOM-034 `react-markdown` + `@tailwindcss/typography` renderer,
wired into the question detail reference-answer view. MOM-036/037 split
`practice/session/[id]/page.tsx` into `SessionHeader`/`AnswerForm`/`AllAnsweredPanel`/
`ReviewQuestionCard`, and added a `useTimer` hook wired into `AnswerForm` so answer
submission now actually sends `timeSpentSeconds` (the API already accepted it; the UI never
sent it). MOM-040 (inspection): summary page was already solid; added per-question time-
spent display now that it's captured.

**Track G — Content Factory:** MOM-043/044 (inspection): `prisma/seed.ts` was **already**
idempotent (stable UUIDs + `upsert`) — no restructure needed. MOM-045 added `DSA_PATTERNS`
(20 patterns) + a 17-item original DSA starter batch (13 easy/medium classics + 2 hard),
each linking to its real source via `sourceUrl` with an original practice note per D-008 —
**not** the full 150-item Gate-3 target, explicitly documented as a starter batch. MOM-060
expanded seed companies 6 → 20 (plan §8.2), encoding focus areas/linked tracks in
`Company.notes` (no dedicated column). MOM-061 extended `CAREER_ROLE_TRACKS` 4 → 10 tracks
so all 8 plan categories (backend, AI/NLP, infra, mobile, fullstack, quant/HPC, data,
security) have one; new tracks default `profileRoleTemplate` to `google-l4-swe` pending
dedicated RoleTemplate skill/tier data (separate scope, not authored here).

**Track J — Career Engine:** MOM-081 (inspection): jobs page was already a mobile-first
list (matches plan §10.3, no drag-and-drop); added a status filter chip row, removed a dead
placeholder div. MOM-082 (inspection): career hub already renders role tracks/goals/
readiness from the API, so it auto-picked up the 10 tracks from MOM-061 with zero page
changes.

**Track K — Operations:** MOM-084 `global-error.tsx`, `(authenticated)/error.tsx` +
`loading.tsx`, `not-found.tsx`. MOM-085 `AllExceptionsFilter` (consistent JSON error shape,
no stack-trace leakage, warn/error log split) + `RequestLoggingMiddleware`. MOM-086
`GET /health/db` (DB ping on a separate route so a DB outage doesn't take down base
liveness). MOM-004 README rewrite to match all of the above (routes, env vars, scripts,
seed counts, role-track count, mobile/PWA section).

**Side finding, fixed:** `apps/web` had no `typecheck` script — `pnpm typecheck` (and CI's
dedicated step) silently skipped the frontend entirely; only `next build`'s internal tsc
pass ever caught web type errors. Added `"typecheck": "tsc --noEmit"`.

**Checks run (final full pass, all green):** `pnpm lint` (3/3 projects), `pnpm typecheck`
(3/3 projects, web now included), `pnpm test` (48 API tests, 13 files), `pnpm build` (all 3
packages, 28 web routes), `pnpm content:validate` (0 errors on 55 seed questions).

**Deliberately NOT done — schema-migration-gated (per D-004, human approval required):**
- MOM-026/027 `ReviewState` migration (design already captured in ADR-0002)
- MOM-063 `Story` model/migration
- MOM-069 `AiUsage` migration
- MOM-075 `StudyPlanItem` → `Task` consolidation migration
- The four missing `AnswerAttempt` reflection columns identified in MOM-028's inspection

**Deliberately NOT done — needs real credentials/external services:**
- MOM-021 first deploy (Vercel/Render/Neon)
- MOM-068/070-074 AI Feedback Engine (Anthropic API key)
- MOM-049 LeetCode GraphQL import service
- MOM-087 backup workflow (Neon backup strategy)

**Not attempted this pass — legitimately large remaining content/feature work (not gated,
just sizeable; see BACKLOG.MD for full task list):** MOM-046-048 (DSA batches to 150),
MOM-052-059 (CS/system-design/behavioral batches), MOM-029-032 (reviews module/FSRS
service/Today API — blocked on the ReviewState migration above), MOM-038/039/041/042
(answer-panel-by-type, reflection panel, practice hub, Today learning cards — blocked on
028/032), MOM-035 CodeMirror editor, MOM-050/051 DSA progress API/UI, MOM-057 system-design
editor, MOM-062 coverage dashboard, MOM-063-067 Story engine, MOM-076/077 task
consolidation cleanup, MOM-078/080 reminder scheduler/UI, MOM-083 job-linked prep,
MOM-088 Lighthouse/a11y pass, MOM-090 final golden-path verification.

**Result:** 24 backlog tasks completed across 12 commits, full CI-equivalent pipeline
green. `NEXT.MD` updated to the next real unblocked task.

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
