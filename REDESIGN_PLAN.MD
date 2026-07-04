# Momito Redesign — Phone + Laptop Interview-Prep App

## Context

Momito (D:\Momito\Momito-clone) is an interview-prep + career app the user is betting everything on: they are studying to pass interviews abroad and emigrate. Today it is a pnpm monorepo — Next.js 16 web (`apps/web`), NestJS 11 + Prisma/Postgres API (`apps/api`, 26 models, ~75 endpoints), shared types (`packages/shared`) — plus an **abandoned** Python FastAPI `backend/` and a 2-screen Expo `mobile/` wired to that dead backend.

The data model is strong, but the product has critical gaps:
- **Unusable on phones**: primary nav is `hidden sm:flex` with no mobile menu (`apps/web/app/(authenticated)/layout.tsx:50`); no PWA manifest/SW/icons; broken vestigial dark mode + `font-family: Arial` override in `apps/web/app/globals.css`.
- **Weak learning core**: 38 conceptual seeded questions (0 DSA), plain-`<textarea>` answers, no markdown rendering, no code editor, no timers. Spaced repetition (`spaced_review`, `needsReview`) and AI feedback (`aiScore`/`aiFeedback`) exist as dead schema columns — never implemented.
- **Sprawl**: 12 flat nav links, three overlapping task systems (StudyPlanItem / Task / PlanItem), reminders that never fire (no cron), naive keyword-matching readiness scoring.
- **Git risk**: only 1 commit exists; the entire Career OS/missions layer (~40 files, 3 migrations) is uncommitted.

**User decisions (fixed):** ① PWA — one responsive Next.js app, archive Expo + Python backend. ② Free cloud hosting (Vercel + Render + Neon) so the phone works anywhere. ③ AI grading via Claude API is a core feature (budget-capped, graceful fallback). ④ All four domains built deep, in order: DSA/coding → system design + CS fundamentals → behavioral story bank → jobs/CV pipeline.

**Evidence-based prep practices this redesign encodes:** FSRS spaced repetition (active recall at optimal intervals), pattern-based DSA (interleaved, timed, with error journaling), structured system-design frameworks with rubrics, STAR story vault with rehearsal, a single "Today" queue (one decision: what do I do right now), consistency streaks, and rubric-based feedback (AI-graded, self-rating fallback).

Each phase ends with a git commit and green `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

---

## Verified compatibility decisions (checked against repo versions: Next 16.2.9 / React 19.2.4 / Tailwind v4 / NestJS 11 / Prisma 6.19 / Node 22 / pnpm 10)

| Concern | Decision |
|---|---|
| Service worker | **Hand-rolled `apps/web/public/sw.js` + `app/manifest.ts`** — NOT `next-pwa`/`@serwist/next` (webpack-based; Next 16 builds with Turbopack). Matches the official Next 16 PWA guide bundled in `node_modules/next/dist/docs/`. |
| UI primitives | **shadcn/ui via CLI** (supports Tailwind v4 + React 19, no tailwind.config needed — tokens go in `globals.css @theme`). Fallback: hand-vendor the same MIT `.tsx` files + Radix deps. |
| Icons / theme | `lucide-react`; `next-themes` (`attribute="class"`) + `@custom-variant dark` in globals.css |
| Data layer | `@tanstack/react-query` v5 **wrapping** the existing typed `apps/web/app/lib/api-client.ts` (keep it; don't rewrite) |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight`; `@tailwindcss/typography` via `@plugin` (the `prose` classes already in pages start working) |
| Code editor | `@uiw/react-codemirror` + language packs (js/python/cpp/java), `next/dynamic` `ssr:false`. NOT Monaco (too heavy for phones). |
| Spaced repetition | `ts-fsrs` (pure TS), server-side in NestJS |
| AI | `@anthropic-ai/sdk` + `zod` in apps/api. Default model **`claude-opus-4-8`** ($5/$25 per MTok), env-overridable (`claude-sonnet-5` $3/$15, `claude-haiku-4-5` $1/$5). `client.messages.parse()` + `zodOutputFormat` (from `@anthropic-ai/sdk/helpers/zod`) for structured grades; `thinking: {type:"adaptive"}`; typed error classes, never a 500. |
| API hardening | `helmet`, `@nestjs/throttler`, `@nestjs/schedule` (all NestJS-11 compatible) |
| Hosting | Web: Vercel Hobby. API: Render Free (+ keep-warm cron; documented $7/mo upgrade). DB: Neon Free (ap-southeast-1). |

Note: `QUESTION_TYPES` in `packages/shared/src/index.ts` **already includes** `dsa`, `system_design`, `behavioral` — do not re-add; only add the new constants listed per phase.

---

## Phase 0 — Git hygiene, archive legacy, fix stale docs (~½ day)

1. **LITERAL FIRST COMMAND:** `git add -A && git commit` — snapshot the uncommitted Career OS/missions/profile work (3 migrations + ~40 files are currently unrecoverable).
2. `git rm -r backend/ mobile/` — superseded; the one asset worth keeping (LeetCode GraphQL fetcher in `backend/app/routers/dsa.py`) is specified in Phase 3 and stays in git history. Also delete `AI_COLLAB.md.bak.*`, `.agents.bak.*`, `.swarm.bak.*`, and the stray file `your message.`.
3. Rewrite root `CLAUDE.md` (it describes the dead Python/Qdrant/Expo architecture): actual monorepo layout, stack, commands (`pnpm dev`, `docker compose up -d postgres`, `pnpm db:migrate`, `pnpm db:seed`). Trim `CONTEXT.md` (drop Source-of-Truth/crawler terms).
4. New ADRs in `docs/adr/`: `0009-single-nextjs-pwa.md` (supersedes 0002/0005/0006/0007), stubs for `0010-fsrs-spaced-repetition.md`, `0011-ai-grading-claude.md`, `0012-hosting-vercel-render-neon.md`.
5. Commit. **Verify:** clean `git status`; `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; CI green.

---

## Phase 1 — Mobile-first shell, design system, PWA baseline, security, FIRST DEPLOY (~3–5 days)

Goal: the app is installable and usable on the user's actual phone by the end of this phase. Every later phase then ships via `git push`.

### 1a. Design system (apps/web)
- Packages: `@tanstack/react-query`, `next-themes`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `@tailwindcss/typography`; dev: `sharp` (icon script).
- Verify `apps/web/tsconfig.json` has `"paths": {"@/*": ["./*"]}` (add if missing); create `apps/web/components.json`; run `pnpm dlx shadcn@latest init` + `add button card input textarea label select dialog sheet tabs badge skeleton separator dropdown-menu tooltip progress checkbox sonner` → `apps/web/app/components/ui/*.tsx` (coexists with legacy `app/components/ui.tsx`, which is retired page-by-page). Fallback if CLI fights Next 16: vendor the files manually.
- **Rewrite `apps/web/app/globals.css`**: full light/dark token set in `:root` / `.dark` mapped through `@theme inline`; `@plugin "@tailwindcss/typography";`; `@custom-variant dark (&:is(.dark *));`; **delete the `font-family: Arial` override and the `prefers-color-scheme` block** (Geist from `app/layout.tsx` takes over).
- `apps/web/app/lib/utils.ts` (`cn()`); `apps/web/app/lib/use-api.ts` (`useApiQuery`/`useApiMutation` generic wrappers over api-client — migrate pages only as later phases touch them, not all 26 at once).

### 1b. Shell + information architecture (12 links → 5 areas)
- `apps/web/app/components/providers.tsx` — QueryClientProvider (staleTime 30s) + ThemeProvider + sonner Toaster; wire into `app/layout.tsx` along with `export const viewport` (themeColor light/dark, `viewportFit:'cover'`) and appleWebApp metadata.
- **Rewrite `apps/web/app/(authenticated)/layout.tsx`** (the single most important fix):
  - `app/components/nav-items.ts` — **Today** `/today` · **Practice** `/practice` · **Career** `/career-hub` · **Library** `/library` · **Settings** `/settings`, each with lucide icon + desktop children (Practice → Bank `/questions`, New session `/practice/new`, Review `/practice/review`, History `/attempts`; Career → Jobs, CV & Scores `/profile`, Goals `/career`, Missions (legacy), Calendar; Library → Learning, Stories).
  - `app/components/bottom-tabs.tsx` — fixed bottom bar, `lg:hidden`, 5 tabs, ≥48px targets, `pb-[env(safe-area-inset-bottom)]`.
  - `app/components/sidebar.tsx` — `hidden lg:flex` grouped rail; `app/components/top-bar.tsx` — title, theme toggle, reminder bell (Phase 5), sign-out.
  - Main content `pb-20 lg:pb-8` so the tab bar never covers content.
- `apps/web/app/(authenticated)/today/page.tsx` stub (greeting + tiles); repoint `app/page.tsx` redirect and post-login redirect to `/today`. Restyle `(auth)/login` + `register` with new primitives (large touch-friendly inputs).
- All 26 legacy routes remain reachable during migration.

### 1c. PWA baseline
- `apps/web/app/manifest.ts` (name Momito, `display:'standalone'`, `start_url:'/today'`, icons 192/512 + maskable).
- `apps/web/scripts/generate-icons.mjs` (sharp) from an authored `public/icons/icon.svg` → PNGs + `apple-touch-icon.png`; run once, commit.
- `apps/web/public/sw.js` — versioned cache; precache `/` + `/offline`; network-first-with-cache-fallback for same-origin GET navigations/static assets; **never cache cross-origin API calls**; old-cache cleanup on activate.
- `apps/web/app/offline/page.tsx`; `app/components/sw-register.tsx` (production only, in root layout); `app/components/offline-banner.tsx`.

### 1d. API security + deploy prerequisites (apps/api)
- `main.ts`: `app.use(helmet())`; comma-separated `CORS_ORIGIN` list support in `src/common/config.ts`.
- `app.module.ts`: `ThrottlerModule` (120 req/min global) + `@Throttle({default:{limit:5,ttl:60_000}})` on login/register in `src/auth/auth.controller.ts`.
- `auth.service.ts` `register()`: throw `ForbiddenException` unless `REGISTRATION_ENABLED === 'true'` (single-user lockdown for public internet).
- JWT expiry → `JWT_EXPIRES_IN ?? '30d'` in `src/auth/auth.module.ts` (localStorage Bearer is an accepted single-user tradeoff, documented in ADR 0009; helmet CSP, no third-party scripts).
- `src/health/health.controller.ts` — `@Public() GET /api/v1/health` (Render health check + keep-warm).
- Neon prep: `directUrl = env("DIRECT_URL")` in `apps/api/prisma/schema.prisma` datasource; update `.env.example` (+`DIRECT_URL`, `CORS_ORIGIN`, `REGISTRATION_ENABLED`, `JWT_EXPIRES_IN`) and set `DIRECT_URL` in `.github/workflows/ci.yml`. Seed reads `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` env with demo defaults.

### 1e. Deploy (runbook below) + commit.

**Verify (Phase 1):** DevTools 390×844 — bottom tabs on every authed route, no horizontal scroll, nothing hidden behind tab bar; ≥1024px — sidebar, no tabs. Dark mode persists; Arial gone. `next start` + Lighthouse → installable, SW active; airplane mode → offline page. 6th rapid login → 429; register with flag off → 403. **On the real phone via deployed URL: log in, Add to Home Screen, launch standalone.**

---

## Phase 2 — Practice core: markdown, code editor, timers, FSRS, Today queue, error journaling (~5–7 days)

### Schema — migration `add_review_states_and_attempt_reflection`
```prisma
model ReviewState {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @map("user_id") @db.Uuid
  questionId     String?   @map("question_id") @db.Uuid   // storyId joins in Phase 3
  stability      Float     @default(0)
  difficulty     Float     @default(0)
  due            DateTime  @default(now()) @db.Timestamptz(6)
  state          Int       @default(0)      // ts-fsrs State enum
  reps           Int       @default(0)
  lapses         Int       @default(0)
  lastReviewedAt DateTime? @map("last_reviewed_at") @db.Timestamptz(6)
  suspended      Boolean   @default(false)
  // relations to User (Cascade) + Question (Cascade)
  @@unique([userId, questionId])
  @@index([userId, due])
  @@map("review_states")
}
```
`AnswerAttempt` additions: `missTags Json @default("[]")`, `reflectionNote String?`, `outcome String?` (solved-clean|solved-hints|failed), `language String?`, `timeComplexity String?`, `spaceComplexity String?`.

### API — new module `apps/api/src/reviews/`
- Package `ts-fsrs`. `reviews.service.ts` wraps `fsrs(generatorParameters({enable_fuzz:true}))`; lazy-creates ReviewState on first grade; maps `again|hard|good|easy` → FSRS ratings; persists scheduling fields.
- Endpoints: `GET /reviews/queue?limit&tz` (due ≤ end-of-day, joined question summaries) · `GET /reviews/stats?tz` (dueToday/overdue/reviewedToday/newEnrolled) · `POST /reviews/grade` `{questionId, rating, attemptId?}` · `POST /reviews/enroll` `{questionIds[]}` · `POST /reviews/:id/suspend|unsuspend`.
- Hook attempt flow: after `POST /sessions/:id/answer` persists an attempt that carries a rating, call `reviewsService.gradeFromAttempt(...)` (`apps/api/src/sessions/sessions.service.ts`).
- `spaced_review` session type (already in shared) now actually pulls from due ReviewStates in `sessions.service.ts#selectFilteredQuestions`.
- `GET /dashboard/today?tz` in `apps/api/src/dashboard/`: `{reviewStats, tasksToday (Task table), remindersDue, streak, lastSession}`. Streak = consecutive days (user tz, default `Asia/Ho_Chi_Minh`) with ≥1 attempt.
- DTOs: extend `create-answer.dto.ts` with reflection fields; add `MISS_REASONS` (`misread, wrong-pattern, edge-case, time-pressure, blank, implementation-bug`) to `packages/shared/src/index.ts`; extend `api-client.ts`.
- Tests: `apps/api/test/reviews.service.spec.ts` (mocked Prisma, fixed clocks: Again shortens due, Easy lengthens, lazy enroll, tz day-boundary).

### Web
- `app/components/markdown.tsx` (memoized react-markdown + gfm + highlight, light/dark hljs theme pair); `app/components/code-editor.tsx` (dynamic CodeMirror, language select persisted to localStorage, follows theme); `app/lib/use-timer.ts` (timestamp-based, survives tab switches).
- **Rewrite `apps/web/app/(authenticated)/practice/session/[id]/page.tsx`** into components: `SessionHeader` (progress, session timer), `QuestionCard` (markdown prompt, tags, source link), `AnswerPanel` (CodeMirror for `dsa`, textarea+preview otherwise), `RevealAnswer` (markdown reference), `ReflectionPanel` (**Again/Hard/Good/Easy** buttons → FSRS grade; miss-tag chips; outcome + complexity for dsa; note), `SessionSummary`.
- `practice/page.tsx` hub (Start / Review queue / Bank / History) + `practice/review/page.tsx` (due list → start `spaced_review` session).
- Fill `today/page.tsx`: ReviewQueueCard (due count → start), TasksToday (complete via existing tasks API), StreakBadge, RemindersDue placeholder.
- Question bank: markdown preview + "Add to reviews" action.

**Verify:** phone viewport full loop — create session → answer in editor → reflect → `review_states` row has future due; grade `again` → question returns to queue; Today shows counts + streak; `timeSpentSeconds` written; vitest green.

---

## Phase 3 — Content depth: DSA ladder + LeetCode import, system-design framework, CS fundamentals, story vault (~5–8 days, largely authoring)

### Schema — migration `add_stories_and_story_reviews`
`Story` (userId, title, STAR fields: situation/task/action/result, metrics?, `tags Json` competencies, `companies Json`) + `StoryQuestion` join + `ReviewState.storyId String? @db.Uuid` with `@@unique([userId, storyId])`.

### API
- `apps/api/src/stories/` module: CRUD `/stories`, `/stories/:id/questions` link/unlink, `POST /stories/:id/enroll` (FSRS rehearsal). `reviews/queue` items become `{itemType:'question'|'story', ...}`.
- **LeetCode import** — `apps/api/src/questions/leetcode.service.ts` (port from git history of `backend/app/routers/dsa.py`): slug regex `/leetcode\.com\/problems\/([a-z0-9-]+)/`; POST `https://leetcode.com/graphql` (headers `Content-Type: application/json`, `Referer: https://leetcode.com`; `AbortSignal.timeout(10_000)`) with query `question(titleSlug){ questionFrontendId title difficulty topicTags{name} }`; map topic tags → pattern ids; create Question `{type:'dsa', title:'LC {id}. {title}', prompt: 1–2-line original note + link — NEVER the statement text, sourceUrl, difficulty, patternTags}`; dedupe by slug in sourceUrl; upstream failure → 502, never crash. Endpoint `POST /questions/import/leetcode {url}`.
- `GET /dsa/progress` — per-pattern `{total, solvedClean, solvedHints, failed, attempted}` from latest attempt outcome per question.
- Shared additions: `DSA_PATTERNS` (~25: two-pointers, sliding-window, hashmap, prefix-sum, binary-search, sorting, greedy, stack, monotonic-stack, heap, intervals, linked-list, tree-bfs, tree-dfs, trie, graph-bfs, graph-dfs, topological-sort, union-find, backtracking, dp-1d, dp-2d, bit-manipulation, math, design — each `{id, name, description, whenToUse}`), `STORY_COMPETENCIES` (ownership, conflict, failure, leadership, ambiguity, delivery, growth, teamwork + Amazon LP mappings).
- **System-design representation: markdown with a fixed 7-section template** (Requirements / Estimation / API / Data model / High-level design / Deep dives / Tradeoffs), serialized into `answerText` with `##` headings; `Question.rubric` Json = `{sections:[{id,title,criteria[],weight}]}`. No schema change, human-readable, AI-gradable, degrades to plain textarea.

### Web
- `practice/dsa/page.tsx` — ladder grouped by pattern (header: name, when-to-use, progress bar; rows: LC number/title/difficulty/outcome icon/external link), "Practice this pattern", import-URL dialog.
- `app/components/system-design-editor.tsx` — 7 collapsible section textareas used by the session page for `system_design`.
- `library/page.tsx` hub + `library/stories/page.tsx` + `stories/[id]/page.tsx` — STAR editor, competency/company chips, linked-questions picker, "Rehearse" (enroll). Rehearsal in review sessions: show linked question → recall → reveal STAR → rate.
- Seed content in `apps/api/prisma/seed-data/{dsa-ladder,system-design,cs-fundamentals,behavioral}.ts`, wired into the idempotent `seed.ts` (all upserts by fixed UUID).

### Seed content targets (authored during implementation; original prose only — no copyrighted problem statements)
| Domain | Target | Composition |
|---|---|---|
| DSA ladder | 100 entries (links + metadata only) | ~20 patterns × 4–6 in ladder order; 30E/55M/15H; each with pattern ids + original "what to practice" note |
| System design | 15 | URL shortener, rate limiter, chat, feed, notifications, file storage, payments/idempotency, crawler, autocomplete, video, metrics pipeline, job scheduler, KV store, geo-nearby, ML inference — each with 7-section weighted rubric + reference outline |
| CS fundamentals | 40 → ~120 | OS 20, networking 20, DB 20, concurrency 10, JS/TS 15, backend/API design 20, OOP 10, C++/latency 10 (HPC/quant roleTags), ML 5 — **every question gets a 3–5-criterion rubric** (today's seed has none) |
| Behavioral | 30 questions | competency-tagged; 14 mapped to Amazon LPs; company packs via QuestionCompany; 0 seeded stories (personal) |
| Topics/Companies | +2 topics (DSA, ML); 6 → 12 companies (add e.g. TikTok, Nvidia, Stripe, Databricks, Two Sigma, Jane Street) |

**Verify:** import a real LC URL locally → correct metadata; ladder progress updates after attempts; story CRUD + rehearsal on phone viewport; system-design session emits well-formed markdown; seed runs twice cleanly; CI (which seeds) green.

---

## Phase 4 — AI grading with budget caps (~3–4 days)

### Schema — migration `add_ai_usage`
`AiUsage` (userId, `day @db.Date`, requests, inputTokens, outputTokens, costUsd; `@@unique([userId, day])`).

### API — `apps/api/src/ai/` (packages: `@anthropic-ai/sdk`, `zod`)
- `ai.config.ts`: `ANTHROPIC_API_KEY` (absent ⇒ `available:false`), `ANTHROPIC_MODEL` default `claude-opus-4-8`, `AI_DAILY_BUDGET_USD` default `1.00`, price table `{claude-opus-4-8: 5/25, claude-sonnet-5: 3/15, claude-haiku-4-5: 1/5}` $/MTok.
- `budget.service.ts`: `checkAndReserve(userId)` against today's row; `record(usage)` upserts increments with cost computed from response `usage` tokens.
- `grading.service.ts`: `client.messages.parse({ model, max_tokens: 4000, thinking:{type:'adaptive'}, system: GRADER_SYSTEM, messages:[buildGradePrompt(question, rubric, referenceAnswer, attempt)], output_config:{ format: zodOutputFormat(GradeSchema) } })`. `GradeSchema`: `{overallScore 0–100, rubricScores:[{criterion, score 0–5, comment}], strengths[], gaps[], followUpQuestions[3], suggestedRating: again|hard|good|easy}`. Persist `aiScore`/`aiFeedback` on AnswerAttempt (**bringing the dead columns alive**). Catch typed SDK errors (`RateLimitError`, `APIError`) → structured failure response, never a 500. Mock the Anthropic client via provider token in tests.
- Endpoints: `POST /attempts/:id/grade` (idempotent — returns stored grade unless `?force=true`) · `GET /ai/usage` `{today, budgetUsd, remainingUsd, model, available}`.
- **Degradation contract:** self-rating remains the FSRS input; AI's `suggestedRating` only pre-selects the button. No key / over budget ⇒ UI hides/disables AI affordances with a clear message.
- Cost reality (ADR 0011): ~$0.03–0.05/grade on opus-4-8 (adaptive thinking included), ~$0.01 on sonnet-5, ~$0.005 on haiku — default $1/day ≈ 20–40 opus grades.

### Web
- `app/components/ai-feedback-card.tsx` — score, per-criterion bars, strengths/gaps, follow-up questions, "used $x of $y today" footer.
- ReflectionPanel gains "Grade with AI" (hidden when unavailable); pre-selects suggested rating. Same card + regrade on `attempts/[id]`. Settings: AI section (model, budget meter; key lives server-side only).

**Verify:** with key — grade persists aiScore/aiFeedback, usage increments, regrade returns cache; budget $0.001 — clean fallback message; no key — affordances hidden; vitest green with zero network.

---

## Phase 5 — Career consolidation: one task system, jobs kanban, reminders that fire (~3–4 days)

### Kill StudyPlanItem — migration `merge_study_plan_into_tasks`
Migration SQL first **converts** rows (`INSERT INTO tasks (…) SELECT title, notes, topic_id, target_date→due_date, status-mapped, type='study' … FROM study_plan_items`, statuses mapped at implementation time against the shared TASK_STATUSES), then drops the table. Delete `apps/api/src/study-plan/` + its app.module import + `apps/api/test/study-plan.service.spec.ts` + `apps/web/app/(authenticated)/study-plan/` + StudyPlanItem types in shared + api-client methods; check `dashboard.service.ts` for references. Task is now the single personal-task system; PlanItem stays only as a frozen missions artifact.

### Reminders that actually fire — in-app only (no web push, no email)
- `@nestjs/schedule`: `ScheduleModule.forRoot()`; `apps/api/src/reminders/reminders.cron.ts` — `@Cron('*/5 * * * *')` + `onApplicationBootstrap` catch-up: `pending && dueAt <= now` → `status='due'`, set `lastTriggeredAt`. Materialize from `Task.reminderOffsetMinutes` and `JobApplication.deadline` (T-3d, T-1d, deduped).
- `GET /reminders?status=due` feeds Today's "Due now" + top-bar bell badge; dismiss/snooze endpoints. Render-free-tier caveat documented: cron sleeps when dyno sleeps; boot catch-up + daytime keep-warm ≈ correct enough; exact-time push is explicitly out of scope.

### Jobs kanban + Career hub
- Rewrite `apps/web/app/(authenticated)/jobs/page.tsx`: desktop = status columns (CSS grid), mobile = segmented status filter + card list; **no drag-and-drop lib** — tap card → Sheet with details/status select/timeline/linked prep/add-reminder. Existing `/jobs` CRUD suffices.
- `career-hub/page.tsx` — pipeline summary, next deadlines, links to Profile/Scores/Goals/Missions (labelled legacy).
- **Missions/readiness freeze:** remove from primary nav (reachable via Career hub), zero further investment, deprecation note in ADR 0009. Do not delete — it works and links to sessions/tasks.

**Verify:** job with deadline tomorrow → reminder appears in bell + Today after cron/boot; kanban usable at 390px; `grep StudyPlanItem` → 0 hits; `prisma migrate reset` + seed on fresh DB clean; CI green.

---

## Phase 6 — Hardening, polish, Lighthouse (~2–3 days)

- `error.tsx` / `global-error.tsx` / route `loading.tsx` skeletons (Today, Practice, Jobs).
- Lighthouse on deployed URL (mobile): installable, Perf ≥ 85, A11y ≥ 95 on Today + session pages; register only needed hljs languages; aria-labels on tabs/icon buttons; visible `:focus-visible` rings; `prefers-reduced-motion`.
- API: consistent global exception filter, one-line request logging, `/health` with DB ping.
- **Backups:** `.github/workflows/backup.yml` — weekly `pg_dump` via Neon direct URL secret → encrypted artifact (this data is the user's future; cheap insurance) + documented restore.
- README rewrite: screenshots, local dev, deploy, env table.

---

## Deployment runbook (executed end of Phase 1, refreshed later)

1. **Neon** free (ap-southeast-1): pooled URL → `DATABASE_URL`, direct URL → `DIRECT_URL`.
2. **Render** free web service, repo root. Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @momito/shared build && pnpm --filter @momito/api exec prisma generate && pnpm --filter @momito/api build`. Start: `bash -c "cd apps/api && pnpm exec prisma migrate deploy && node dist/main.js"`. Health check `/api/v1/health`. Env: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (≥32 chars), `JWT_EXPIRES_IN=30d`, `CORS_ORIGIN=https://<app>.vercel.app`, `REGISTRATION_ENABLED=false`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_DAILY_BUDGET_USD=1`, `NODE_VERSION=22`, `TZ=UTC`.
3. **Vercel** hobby: Root Directory `apps/web`; env `NEXT_PUBLIC_API_URL=https://<api>.onrender.com/api/v1`.
4. Wire real Vercel URL back into `CORS_ORIGIN`; seed prod once from local (`DATABASE_URL=<neon-direct> SEED_USER_EMAIL=… pnpm db:seed`).
5. Keep-warm: `.github/workflows/keepwarm.yml` — `*/10 0-17 * * *` UTC (07:00–24:00 ICT) curl `/health` (~510 instance-hours/mo, under Render's 750).
6. Phone: iOS Safari Share → Add to Home Screen / Android Chrome → Install.

## Risks (ordered)

1. **Uncommitted-work loss** — Phase 0 step 1 is the literal first command.
2. **Render cold starts (~30–60s)** — keep-warm cron + "server waking up…" toast on slow requests + documented $7/mo upgrade path.
3. **shadcn CLI × Next 16 friction** — fallback: vendor the same files manually.
4. **Phase 3 authoring volume** — fixed counts; ship incrementally (ladder can launch at 60); never block later phases on content.
5. **FSRS timezone bugs** — all `due` UTC; `tz` param (default Asia/Ho_Chi_Minh); fixed-clock unit tests.
6. **AI cost runaway** — pre-call budget check, `max_tokens` cap, per-day usage table, idempotent grade endpoint, UI meter, key optional.
7. **LeetCode GraphQL unofficial** — on-demand single-URL import only; seed is pre-authored; 10s timeout + 502 passthrough.
8. **localStorage token XSS** — accepted single-user tradeoff (ADR 0009): helmet CSP, no third-party scripts, 30d expiry, registration disabled.
9. **Neon pooling × prisma migrate** — `directUrl` in datasource; migrations run over direct URL.

## Scope guards (do NOT do)

- No web push / email (in-app due surfacing only). No offline mutation sync (SW caches shell only). No Monaco. No Expo/React Native revival. No Qdrant/crawlers/auto-apply. No multi-user/roles/refresh-token rotation. No drag-and-drop on the jobs board. No missions-engine or keyword-readiness investment (freeze + demote). No rewriting all 26 pages to TanStack Query in one pass. No Playwright suite before Phase 6. No i18n/analytics. No copying LeetCode/NeetCode/any copyrighted question text into seeds.

## Critical files

- `apps/web/app/(authenticated)/layout.tsx` — shell rewrite everything hangs off
- `apps/web/app/globals.css` — entire design-system config (Tailwind v4 tokens, dark variant, typography plugin)
- `apps/api/prisma/schema.prisma` — ReviewState/Story/AiUsage migrations, StudyPlanItem removal, `directUrl`
- `apps/web/app/lib/api-client.ts` — typed fetch layer every new endpoint + TanStack hook wraps
- `apps/api/src/app.module.ts` — registration point for reviews/stories/ai/throttler/schedule; study-plan removal
- `packages/shared/src/index.ts` — MISS_REASONS, DSA_PATTERNS, STORY_COMPETENCIES, story/review types (QUESTION_TYPES already complete)
- `apps/api/prisma/seed.ts` + new `apps/api/prisma/seed-data/*` — the content that makes the app worth studying with

## End-to-end verification

1. Per phase: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + the phase checklist + commit; CI green.
2. After Phase 2 (the core loop, on a phone viewport): login → Today shows due reviews → start review session → answer with editor/markdown → reflect (rating + miss tags) → due date moves → streak increments.
3. After Phase 4: grade an answer with AI → rubric feedback renders → budget meter moves → disable key → app fully usable without it.
4. After Phase 6: Lighthouse mobile pass on the deployed URL; install on the actual phone; full study session end-to-end away from the laptop.
