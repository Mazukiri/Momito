# LOG

## 2026-07-20 - MOM-173: main was 73 commits behind the code we deploy (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0` → `main`. No migration. V2 Epic 0 (release hardening).

`main` sat **73 commits behind** `feat/careeros-phase-0`, and neither `render.yaml` nor `apps/web/vercel.json`
pins a branch — Render Blueprint takes the repo default branch, `origin/HEAD → origin/main`. Connecting the
Blueprint would therefore have deployed the pre-CareerOS tree: no interview rounds, debriefs, weakness signals,
contacts, offers or resume versions. Nothing was deployed yet (`NEXT.MD:346`, MOM-021 still open), so this cost
nothing to fix now and would have cost a confusing afternoon later.

Cleaned the working tree first, because a fresh clone did not build: `apps/api/src/common/date-key.ts` was
untracked while `dashboard.service.ts:5` imported it, and `package.json` ×2 + `pnpm-lock.yaml` were modified but
uncommitted, so CI's `--frozen-lockfile` was resolving a different dependency set than local. Kept the local dev
changes that turned out to be load-bearing (`dotenv` — `seed.ts` already used it via Prisma's transitive copy, and
this app reads `process.env` directly rather than through `@nestjs/config`; `next dev -p 3000` — Next
auto-increments off a busy port and would land on 3001, where the API listens). Dropped `debug_conn.ts`, a
throwaway probe that logged `DATABASE_URL` with credentials.

Five commits total: the cleanup, then MOM-172 / MOM-176 / MOM-174 separately.

**Note — concurrent merge.** While this was in progress the branch was also merged into `main` on GitHub as
PR #2, so the first `git push origin main` was correctly rejected as non-fast-forward. Resolved by fetching and
`git merge origin/main` — a merge commit, no rebase, so nothing already pushed was rewritten. The resulting tree
is byte-identical to the verified feature-branch tip (`git diff --stat feat/careeros-phase-0 main` empty).
Both branches now sit at `1e9041c`.

**Verified.** Full CI gate on the exact tree that was pushed: `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`,
**422 tests** (380 API across 42 files + 42 web across 10), and `pnpm build` — all green.

**Still open.** `render.yaml`/`vercel.json` remain unpinned. That is now correct-by-default since `main` is the
truth, but it is worth stating in `docs/adr/0016` (MOM-179) that main is the deploy branch, so nobody
re-introduces the drift.

## 2026-07-20 - MOM-174: refuse to seed a real database with the public demo login (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. V2 Epic 0 (release hardening).

Three existing behaviours combine into a way to lock yourself out of your own deployment:
`render.yaml` sets `ALLOW_MULTI_USER_REGISTRATION=false`, so `auth.service.ts:17-22` closes registration once one
user exists; `auth.controller.ts` exposes only register/login/logout/me, so **there is no password reset and no
recovery path**; and the deploy runbook seeds production by hand from a laptop. Skip the runbook step that sets
`SEED_USER_EMAIL`/`SEED_USER_PASSWORD` and the instance's only account is `demo@momito.local` with a password
committed to a public repository — an account the owner cannot change and a stranger can sign into.

B2 already knew about this (the comment at `seed.ts:12-17` says so) and mitigated it with env overrides that keep
the defaults. A comment did not stop it, because the failure is a skipped step, so the defaults are now refused
outright rather than documented.

New `prisma/seed-guard.ts` throws before any write when the built-in credentials would reach a non-local database.
**`NODE_ENV` is deliberately not the primary signal**: the seed runs from a developer machine where `NODE_ENV` is
unset, pointed at a remote `DATABASE_URL`, so "is the target local" is the question that actually matters —
`NODE_ENV === 'production'` is only a second trigger. Unparseable or absent URLs count as remote (fails closed).
The error names the reason and the exact command to re-run, and never prints the default password.

Verified this does not disturb existing workflows: the user's `apps/api/.env` points at `127.0.0.1` and CI's
`DATABASE_URL` is `localhost`, so both stay on the allowed path — while neither sets `SEED_USER_*`, which is
precisely the condition that would have bitten on the first production seed.

**Verified.** `pnpm lint` + `pnpm typecheck` clean at root. **380 API tests across 42 files** (was 369/41).
11 new `seed-guard.spec.ts` cases: local host recognition (incl. docker-compose service names), managed hosts as
remote, fail-closed on absent/unparseable URLs, refusal against a Neon-shaped URL, refusal under
`NODE_ENV=production` even on localhost, refusal when *either* field is left at its default, real credentials
allowed anywhere, guidance present in the message, and the default password absent from it.

## 2026-07-20 - MOM-176: daily crons ran 7 hours late; push marked failures as delivered (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. V2 Epic 0 (release hardening).

Two production bugs, both invisible from inside `src/`.

**1. Every daily cron fired 7 hours off.** `render.yaml` sets `TZ: UTC`, and `@Cron` with a bare expression is
interpreted in the server zone. None of the three schedulers passed a `timeZone`. So
`CronExpression.EVERY_DAY_AT_6AM` (interview prep) actually fired at **13:00 ICT** and `EVERY_DAY_AT_7AM`
(follow-up sweep) at **14:00 ICT** — jobs written as a morning routine running mid-afternoon.

The tempting fix — schedule them at 06:00 local — is worse, and that is the part worth recording.
`.github/workflows/keepwarm.yml` pings `/health` on `*/10 0-17 * * *` UTC, i.e. 07:00 ICT → 00:59 ICT. Render's
free tier sleeps the instance outside that window and an in-process cron cannot fire while asleep, so a 06:00 ICT
job (23:00 UTC) would never run at all. The old wrong-hour schedules at least landed inside the window, which is
why they worked. New `apps/api/src/common/schedule.ts` owns the times, states the coupling, and starts the daily
jobs just after 07:00 local: prep 07:02 → follow-up 07:05 → daily plan 07:10 (reserved for Epic 1 A4), ordered so
the plan snapshots inputs the earlier jobs have already produced.

**2. A failed push was permanently marked as delivered.** `reminder-push.scheduler.ts` stamped
`lastTriggeredAt` unconditionally after calling `sendToUser`, which returned `void` and swallowed every error —
so the caller could not distinguish delivery from total failure, and an undelivered reminder was never retried.
The loop also had no `try/catch`, so one bad row aborted the tick and silently starved every reminder behind it.
`PushService.sendToUser` now returns `{ subscriptions, delivered, failed }` and still never throws; the scheduler
settles a reminder only when at least one device accepted it, or when the user has no devices at all (nothing to
retry — otherwise that row re-scans every 5 minutes and crowds the `take: 100` window). 404/410 counts as
resolved, since the subscription is pruned rather than failing transiently.

**Verified.** `pnpm lint` + `pnpm typecheck` clean at root. **369 API tests pass across 41 files** (was 358/40).
New `test/schedule.spec.ts` (7) asserts the local hour maps to the expected UTC hour, that every daily job lands
inside the keep-warm window — **parsed out of `keepwarm.yml` itself, so narrowing that workflow fails this test
instead of silently killing a job** — that a 06:00 local schedule would fall outside it, job ordering, and that
reminder push never shares a minute with a daily job. `reminder-push.scheduler.spec.ts` grew 3 → 7: all-devices-
rejected leaves `lastTriggeredAt` null, no-devices settles, partial success settles, and one throwing reminder no
longer aborts the rest. `push.service.spec.ts` passes unchanged, confirming the widened return type is compatible.

**Risk.** The three daily jobs now run at a different wall-clock time than they did in production. That is the
point, but it means the first run after deploy shifts. `docs/adr/0016` (MOM-179) still needs to record the
cron ↔ keepwarm pairing as a standing constraint.

## 2026-07-19 - MOM-172: one shared local-day helper (V2 Epic 1 prerequisite) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. First task of the V2 "Prescriptive OS" roadmap.

Pure extraction, no behavior change. `DashboardService` owned the only definition of "what day is it" —
`computeStreak` / `shiftDateKey`, two private methods formatting `Asia/Ho_Chi_Minh` calendar-day keys. V2's
`DailyPlan` keys on the same notion (`planDate` is a `@db.Date`, one row per user per local day, and its
`@@unique([userId, planDate])` is the generator's idempotency key), so the two must resolve "today" identically.
Left split, a plan created between 00:00 and 07:00 local would file under the previous UTC day — silently
double-counting one day and skipping another, with the streak disagreeing with the plan it is supposed to measure.

New `apps/api/src/common/date-key.ts` exports `DEFAULT_TIME_ZONE`, `dayKey`, `shiftDayKey`, `dayKeyToDate`
(UTC midnight, the form Postgres `date` round-trips without drift), and `consecutiveDayStreak` (the streak walk
verbatim, plus an injectable `now` the daily-plan generator will need for deterministic tests).
`DashboardService.computeStreak` is now a one-line delegate keeping its existing signature and tz default.

**Verified.** `pnpm lint` + `pnpm typecheck` clean at root. 358 API tests pass across 40 files, including the
4 pre-existing `dashboard.service.spec.ts` cases unchanged (behavior preservation) and 15 new `date-key.spec.ts`
cases: the UTC+7 boundary both sides of 17:00Z, month/year/leap-day shifts, `@db.Date` round-trip, streak grace
when today is empty, gap termination, dedupe within a day, and late-evening local activity crediting the local day.

## 2026-07-12 - MOM-171: web test hardening (Momito 1.1 PR 6) (CLAUDE, no schema)

**Actor:** CLAUDE → Grok resume. Branch `feat/careeros-phase-0`. No migration. Final PR of Momito 1.1.

Three web surfaces that carried production logic with thin/no unit coverage:

1. **Flaky résumé Accept path** — two post-`fireEvent.click` assertions in `profile/resumes/__tests__/page.test.tsx`
   ran synchronously under parallel vitest load and sometimes read pre-flush state. Both now use `findBy*` /
   await the render flush (the known flake flagged in NEXT.MD after MOM-165).
2. **`JobReadinessCard`** (promised in MOM-167) — four tests pin load/render, ✓ resolve → formerly-dead
   `POST …/resolve` with optimistic drop + reload, ✕ dismiss via `…/dismiss`, and the amber `repairing` tag
   (partial evidence from MOM-166).
3. **Jobs list** — three tests pin sponsorship filter pills (companyRef preferred over `visaTag`, null → unknown),
   the ⏳ stalled badge with days-in-stage, and list→board toggle grouping by funnel stage.

**Verified.** 42 web tests (+7: 4 readiness card, 3 jobs page; résumé suite still 8). Typecheck + lint clean on web.
No API change.

## 2026-07-12 - MOM-170: ATS matching understands lowercase + multi-word skills (Momito 1.1 PR 5) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 5 of Momito 1.1.

`extractJdSkills` captured only `[A-Z]`-initial tokens, so a JD written in lowercase ("kubernetes", "golang") and
every multi-word skill ("dynamic programming", "threat modeling") were **invisible** to ATS coverage and to the
gap→task bridge — while `CAREER_ROLE_TRACKS` already carried a curated 143-phrase keyword lexicon that was never used
for this. `extractJdSkills` now unions the capitalized-token pass with a **case-insensitive, word-boundary phrase
scan** against that lexicon plus the user's own profile skill labels (threaded through — the résumé path now loads the
profile too, for the lexicon, though its coverage have-set is still the résumé). Matching a covered keyword: single
tokens keep exact set membership (so "go" doesn't fire inside "google"); multi-word phrases substring-match the
artifact's full lowercased text (a token set can't hold "dynamic programming"). The MOM-159 trailing-dot strip and the
`uniqueByNormalized` dedupe are preserved.

**Verified.** 343 API tests (+3 counterfactual: lowercase "kubernetes" + multi-word "dynamic programming" now matched;
a missing "threat modeling" flagged with a sane task title; a JD phrase reached only via the user's own "rust" skill
extracted — plus the existing MOM-159 tests stay green after updating the resume-path fixtures, since atsCoverage now
also reads the profile). Lint + typecheck clean. Live: an **all-lowercase** JD ("we use typescript and react with
dynamic programming and binary search") extracted 3 keywords — `typescript` covered from the profile, the two
multi-word phrases correctly missing — where the old capitalized-only pass would have extracted **zero**.

## 2026-07-12 - MOM-169: readiness computed once per request (Momito 1.1 PR 4) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 4 of Momito 1.1 — a pure performance refactor,
zero behavior change.

`career.getReadiness` ran `readiness.areaMastery(userId)` — a full ReviewState scan + full attempt scan + question
join — and `listActiveReadiness` called it once *per active goal*, `getTargetShortlist` once *per distinct track*.
Since `areaMastery` is user-scoped, not track-scoped, that was the identical heavy sweep repeated N times. `getReadiness`
now takes an optional `sharedMastery`; `listActiveReadiness` computes the sweep once and passes it to every goal, and
`getTargetShortlist` computes it once and passes it to every track. The dashboard benefits automatically (it calls
`listActiveReadiness` directly and again via `recommendations.list` — each is now a single sweep instead of one per
goal; the two remaining sweeps aren't deduped because that would couple dashboard to recommendations' internals,
deliberately not done). `loadEvidenceContext`'s per-track queries are left as-is — the mastery sweep is by far the
heaviest and the 80/20.

**Verified.** 340 API tests (+1: `areaMastery` mock called exactly once for a 3-goal `listActiveReadiness`, was 3×).
Lint + typecheck clean. Live before/after against the demo (2 active goals → 2 sweeps before, 1 after): the
`roleReadiness` payload is **byte-identical** — the change is invisible except in query count.

## 2026-07-12 - MOM-168: the AI grade feeds FSRS (one-tap suggested rating) (Momito 1.1 PR 3) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 3 of Momito 1.1.

`GradeResult.suggestedRating` ('again'|'hard'|'good'|'easy') was computed on every AI grade but only embedded as
Markdown text in `aiFeedback` — the FSRS rating stayed purely manual, and the grade never became schedulable input.
`gradeAttempt` now returns `suggestedRating` as a structured field (`null` on the cached path — it can't be recovered
from the persisted Markdown, stated honestly). `AiFeedbackCard` renders a one-tap "Rate '<Good>' — the AI's
suggestion" button (only on a fresh grade, only when the user hasn't already rated) that routes through
`RevealPanel.rate()`, so the missTags/reflection/FSRS-schedule flow is identical to a manual tap. The suggestion→star
map is the exact **inverse** of `fsrs-scheduler`'s `SELF_RATING_TO_GRADE` — again→1, hard→2, good→**3** (the
representative middle, not 4), easy→5 — so a tap-through and a manual "Good" schedule identically. No schema change
(no column added).

**Verified.** 339 API tests (+1: fresh returns the rating, cached returns null), 35 web tests (+1: tapping the
suggestion drives `PATCH /attempts/:id` with selfRating 3 for 'good'). Lint + typecheck clean. Live: a fresh grade
returned `suggestedRating:'again'` (aiScore 0.46), the immediate re-grade (cached) returned `suggestedRating:null`.
Throwaway attempt removed.

## 2026-07-12 - MOM-167: wire the dead resolve/dismiss endpoints + surface repairing (Momito 1.1 PR 2) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 2 of Momito 1.1.

The `POST /weaknesses/signals/:id/{resolve,dismiss}` endpoints and their `weaknessesApi` client methods existed but
had **zero UI callers** — dead code. `JobReadinessCard`'s flagged-signal chips are now interactive: each carries ✓
("mark repaired" → resolve) and ✕ ("not a real weakness" → dismiss), optimistically removed then reloaded so the
score/penalty update. A `repairing` signal (partial repair evidence from MOM-166) renders amber with a "repairing"
tag instead of rose, so in-progress repairs read differently from untouched ones. On Today, the repair recommendation
now titles `Repairing:` (with a "one more strong rep clears it" nudge) when the signal is repairing — progress, not
just a nag. **Judgment call:** the Today card is a full-width navigation `<button>`, so a nested dismiss button would
be invalid HTML and require restructuring the generic card for every rec type; full resolve/dismiss control lives on
the job card (where signals are naturally scoped), and Today shows repair *progress*. No API endpoint logic changed
beyond the copy.

**Verified.** 339 API tests (+1: repairing → "Repairing:" copy). Web lint + typecheck + 34 tests green. Live: a
throwaway dsa signal resolved via the formerly-dead `POST …/resolve` endpoint returned `status:resolved` and dropped
from the open list; throwaway removed, demo baseline (3 signals) intact. The JobReadinessCard buttons get an explicit
test in PR 6.

## 2026-07-12 - MOM-166: repair sessions actually repair (Momito 1.1 PR 1) (CLAUDE, no schema, D-023)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. First PR of the Momito 1.1 "close the half-closed
loops" release.

**The gap.** The repair loop was half-closed: a bombed interview emits a `WeaknessSignal`, Today shows a "Repair:"
card, the user runs the `weak_area_review`/`job_prep` session it drives — and *nothing happened to the signal*. The
`repairing` status was set by no code; the only exits were the 21-day half-life or the resolve/dismiss endpoints,
which had zero UI callers. You could repair a weakness perfectly and the app kept nagging.

**The fix.** Completing a `weak_area_review` or `job_prep` session now credits its **positive attempts** (the one
canonical `isPositiveAttempt` rule — extracted to a pure exported function in `readiness.service.ts` so sessions
reuses the exact D-013 definition without a service dependency) against the OPEN **area-type** signals for those
areas: one positive → `repairing`; two in a session, or one more on an already-`repairing` signal (evidence across
sessions) → `resolved`. `reason`-type signals stay manual-only (an attempt can't measure them). `sessions.service`
computes the `{area, positive}` verdict and hands it to `WeaknessesService.creditRepairEvidence`, which owns the
transitions (persistence-only). Crediting is gated to `status:'completed'` and wrapped in try/warn — an abandoned
session credits nothing and a credit failure never breaks completion.

**Live testing caught a real bug:** I first gated on `'weakness_repair'`, but the actual session-type enum value is
**`weak_area_review`** — my gate would have never fired for repair sessions. Fixed and re-verified.

**Verified.** 338 API tests (+10). Lint + typecheck clean. Live against local Postgres with the fixed build: bombed a
Meta debrief (areasWeak dsa) → open dsa signal; completed a 1-positive `weak_area_review` session → dsa `repairing`;
completed a second → `resolved` (gone from the open list). All test data (round, signal, 3 sessions, 4 attempts, 2
review states, 1 evidence row) removed afterward; the demo's 3 baseline signals are intact.

## 2026-07-12 - MOM-165: navigation restructure into sections (Momito 1.0 PR 6) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Final PR of Momito 1.0.

The sidebar was a flat 17-entry list (16 after Missions left) that accreted rather than being designed. Added an
optional `section` field to `NavItem` and grouped the 11 secondary items into **Pipeline** (Companies, Contacts,
Offers), **Prep** (Questions, Story Bank, History, Study Plan), and **Insights** (Career, Dashboard, Calendar), with
Settings as an un-sectioned tail. The 5 primary items (Today, Practice, Jobs, Learning, Profile) are unchanged and
stay ungrouped at the top; `BottomTabs` reads `PRIMARY_NAV_ITEMS` only, so mobile is untouched, and the
`PRIMARY_NAV_ITEMS.length > 5` guard stays. `Sidebar` now emits a small uppercase section header the first time each
section appears (items sharing a section are contiguous in the list).

**Verified:** web typecheck + lint + 34 tests green. (One résumé-page test flaked once under parallel load — it
renders no Sidebar, so it is unrelated to this change; passes in isolation and on re-run. Flagged in NEXT.MD as a
test-robustness follow-up.)

## 2026-07-12 - MOM-164: strip vestigial write-only job fields (Momito 1.0 PR 5) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 5 of Momito 1.0.

`JobApplication.referralName`, `h1bCountLastYear`, and `compensationNotes` were accepted, persisted, and serialized by
the API but **no web UI ever set or read them** (confirmed by grep: the only web hit was a comment). referralName was
superseded by the Contacts model (MOM-116); the other two never grew a UI. Removed all three from the create/update
DTOs (and the now-unused `IsInt`/`Min`/`Max` imports), the create/update writes, the serializer, and the
`JobApplicationResponse`/`CreateJobApplicationRequest` shared types. The **DB columns stay** (D-021 spirit — no data
destroyed). The `forbidNonWhitelisted` validation pipe now cleanly 400s a request that includes a removed field,
which no real client sends.

**Verified:** shared builds; 328 API + 34 web tests green; lint + typecheck clean both apps. Live: a job response no
longer carries the three fields; a create with `referralName` in the body → 400 "property referralName should not
exist"; a normal create still works. Throwaway job removed; baseline restored.

## 2026-07-12 - MOM-163: retire Missions — API half + shared types (Momito 1.0 PR 4) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 4 of Momito 1.0; completes D-021.

**Removed:** the whole `apps/api/src/missions/` module (controller, 775-line service, module, 4 DTOs) + its spec;
`MissionsModule` from `app.module.ts`; the `MissionsService` injection + priority-110 "Focus <mission>" cards +
overdue-task `missionId` deep-link from `recommendations.service` (overdue tasks now link to `/calendar`
unconditionally); the `MissionsService` injection + `focusMission`/`activeMissions`/`todayPlanItems` from
`dashboard.service`; all `Mission*`/`WeeklyPlan*`/`PlanItem*`/`MissionCheckIn*` types + `MISSION_*`/`PLAN_ITEM_*`
constants from `@momito/shared` (and the three mission fields on `DashboardSummaryResponse`). Also unwired the two
consuming modules (`recommendations.module`, `dashboard.module`) and refreshed the Today page's descriptive copy.

**Untouched (D-021):** the Prisma schema — all five mission tables and every `missionId` FK column (Task,
InterviewSession, LearningEvidence) stay. `TaskResponse.missionId` and `CreateSessionDto.missionId` remain accepted.
No data destroyed; the feature is restorable by reverting PRs 3+4.

**Verified:** shared builds; 328 API tests (−1 file: the deleted missions spec) + 34 web tests green; lint +
typecheck clean on both apps. Live against a rebuilt API: `GET /missions` → 404; `/practice/recommendations` → zero
`mission:` cards (8 cards total), overdue tasks link to `/calendar`; `/dashboard/summary` → no
focusMission/activeMissions/todayPlanItems, still carries recommendations + roleReadiness.

## 2026-07-12 - MOM-162: retire Missions — web half (Momito 1.0 PR 3) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 3 of Momito 1.0; D-021. Web-first so no page
can 404 against the API before PR 4 removes the routes (the API keeps serving `/missions` through this PR —
harmless, since the web simply stops calling it).

**Removed:** the two `missions/` pages, the `Mission` nav entry, the entire `missionsApi` client + its 7 shared-type
imports, the "Open/Create Mission" button + `openMission`/`missionId` state on the job detail page, the "Focus
Mission" card on the dashboard (and its now-orphaned `Link` import), and the `?missionId` filter handling on the
calendar and learning pages (filter param, badge, create-task/create-evidence `missionId` writes) and the
practice/new session-creation pass-through.

**Kept deliberately (D-021):** `tasksApi.list`, `learningApi.ledger`, and session creation still accept a `missionId`
param — the server columns stay, so this is harmless and lets any mission-linked history remain valid. The Today
page's copy still lists "missions"; that line changes in PR 4 when the mission recommendation cards are actually
removed from the backend.

**Verified:** web lint + typecheck clean (cleared the stale `.next` type cache that still referenced the deleted
pages), 34 web tests green. No API change, so the API suite is untouched.

## 2026-07-12 - MOM-161: grading reaches résumé-AI hardening parity (Momito 1.0 PR 2) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. PR 2 of the Momito 1.0 consolidation release.

**The gap.** `grading.service.ts` was a near-clone of the résumé AI's model call but never got MOM-147/148's hardening:
it still ran `MAX_TOKENS = 4096` (the exact value that truncated résumé output once adaptive thinking bills inside
it), and had no completeness contract — so a cheap/gateway model could silently score 3 of 5 rubric criteria and the
grade would be accepted whole, with no signal. Same coverage-not-quality trap the résumé work exposed.

**The change.** `MAX_TOKENS` 4096 → 16000. Rubric criteria are now enumerated `0..n-1` in the prompt; the
`GradeResultSchema` criteriaScores items carry an `index`; after the first parse, when a rubric was given, missing
indexes trigger **one repair pass** for only the skipped criteria, merged (deduped, sorted) with both calls' tokens
summed; a failed repair keeps the partial grade. No-rubric grading is exempt (nothing to enumerate → one call).
`formatFeedback()` needed no change (renders `criterionTitle` in the now-guaranteed rubric order).

**Verified.** 330 API tests (+4: max_tokens pin, criterion enumeration, repair-on-incomplete with summed tokens,
keep-partial-on-repair-failure). Lint + typecheck clean. Live against the running API with the real key: created an
attempt on a 4-criterion question, graded it — all 4 criteria scored (aiScore 0.41, correctly docking the missing
edge-case analysis), one request, $0.0165 (the model covered all 4 in the first pass, so the repair path stayed idle
— the happy path the headroom enables). Throwaway attempt deleted afterward.

## 2026-07-12 - MOM-160: true ever-reached funnel conversion (Momito 1.0 PR 1) (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. First PR of the Momito 1.0 consolidation release
(plan approved this session; D-022).

**The problem.** `funnel()` built `reached[k]` from currently-active apps at stage ≥ k. A rejected/withdrawn app was
dropped from every denominator, so conversion and responseRate were systematically inflated — the losses the metric
exists to surface were erased. MOM-103/104's `fromStatus/toStatus` transition history made the honest computation
possible.

**The change.** New `maxStageReached()` computes each app's deepest-ever funnel stage = max over {current status} ∪
{every from/to status of its `status_change` transitions}; a pre-MOM-102 terminal app with no transitions falls back
to `applied` (if it has an appliedDate) else `saved`. `reached[k]` = apps with depth ≥ k; `conversionFromPrev`,
`responseRate`, and the `breakdown()` offers/interviewing counts all derive from that. `atStage` stays a
current-status snapshot; `active` is now computed as the non-terminal count (it could no longer come from
`reached[0]`, which now equals `total`). `JobFunnelResponse` shape unchanged → zero web changes.

**Verified.** 326 API tests (+1 counterfactual: an app rejected out of an interview still counts at interview, in
responseRate, and as `interviewing` in the source breakdown; a no-transition rejected app with an appliedDate counts
only through applied). Lint + typecheck clean. Live: walked a throwaway job saved→applied→interview→rejected against
the running localhost API — `interview.reached` went 3→4 (the rejected app still counts), then deleted the throwaway
(no `@Delete` route exists on jobs, so removed it via a one-off Prisma script, since deleted) and confirmed the funnel
returned to baseline (total 8, interview.reached 3).

## 2026-07-12 - MOM-159: ATS coverage false-missed skills at sentence ends (CLAUDE, no schema, bug fix)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Found by careful reading of the ATS keyword matcher.

**The bug.** `extractJdSkills` pulls capitalized tokens with `/[A-Z][A-Za-z+#.]{1,30}/` — the dot is in the class so
"Node.js" survives intact. But that same dot **swallows the sentence-final period**: "…deep experience with
Kubernetes." captures the token `Kubernetes.`, and the only normalization applied to JD keywords is
`toLowerCase().trim()`, so it becomes `kubernetes.` — with the period. The résumé have-set (`resumeHaveSet`), meanwhile,
strips trailing dots (`token.replace(/\.+$/, '')`), so it holds `kubernetes`. The two never match: a skill the résumé
plainly lists gets reported **missing**, which deflates `coveragePct` and — via MOM-134's gap→task bridge — spawns a
bogus "Add to résumé: Kubernetes." study task telling the user to add something they already have. This fires on the
most ordinary JD phrasing there is: any skill at the end of a clause ("proficiency in Go.", "must have Kubernetes.").

**The fix.** Strip trailing dots from JD tokens too, so both sides normalize identically. A bonus: it also stops a
sentence-final stop-word like "We." (which kept its period and so slipped past the `{'We',…}` stop set) from being
mistaken for a skill.

**Verified.** A counterfactual unit test (constructed to fail on the old code, pass on the fix — confirmed by
temporarily reverting the one-line change). 325 API tests, lint + typecheck clean. No live round-trip: the buggy path
is pure string tokenization with no DB or network involved, so the counterfactual test is authoritative for it.

## 2026-07-12 - MOM-158: the "am I ready?" verdict could report a false 0/100 (CLAUDE, no schema, bug fix)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Found by careful reading of the flagship readiness
computation after the write-only-column sweep ran dry.

**The bug.** `getJobReadiness` (the "am I ready for <company>?" verdict) weights the headline by the linked company's
focus areas via `companyWeightedPercentage(areas, focusAreas)`. That function summed `focusAreas[area.area]` over the
role track's areas and divided by it — but a company's `focusAreas` (MOM-121 seed) is validated against
`CAREER_ROLE_AREA_IDS`, **not** against the chosen role track's checklist areas, so the two sets can be disjoint. When
they are, `weightSum` is 0, and the old `if (weightSum <= 0) return 0` reported a **0/100, not_ready** verdict for a
candidate who might be excellent — the emphasis simply didn't line up with the measured areas. The same false 0 fed
`getTargetShortlist`, sinking such a company to the bottom of "where to apply next".

**The fix.** `companyWeightedPercentage` now returns `null` for "no applicable weights", and both callers fall back to
the flat overall percentage — exactly what the no-focus-areas path already did. The `weakestAreas` ordering had the
same latent flaw (a disjoint emphasis makes every `focusDrag` 0, leaving the list unsorted), so it now keys off a
`companyWeighted` flag and falls back to lowest-percentage ordering.

**Reachability.** Not triggerable on pristine seed: every role track's areas include `dsa`, and every seed company's
focus includes `dsa`, so there is always an intersection. It is a latent bug for **user-created** catalog data — a
company a user adds with, say, `{cs_fundamentals: 5}` against a `big-tech-swe` job (no `cs_fundamentals` area).

**Verified.** A counterfactual unit test (constructed to fail on the old `return 0` and pass on the fix — confirmed by
temporarily reverting). 324 API tests, lint + typecheck clean. Live: forced the NVIDIA company's focus to `{behavioral:
5}` (disjoint from its `hpc-gpu-engineer` track) → the NVIDIA job verdict was 34 (the flat mean) with sensible
weakest-area fallback, not 0; restored the company's focus and confirmed the verdict returned to its baseline 50.

## 2026-07-12 - MOM-157: résumé drift enters the Today loop (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration.

MOM-155 gave drift a face — but on `/profile/resumes`, the one page a user opens only when they *already suspect* the
résumé is behind. Drift is a before-you-send signal; the app's whole thesis is that such signals surface on **Today**.
So `recommendations.service` now carries a résumé-drift card, fed by a new `ResumesService.driftSummary` (every stale
version in one pass — one profile read, one versions read, diffed in memory; calling `drift()` per version would N+1 the
one page that must stay fast).

The ranking is the design. A stale version **linked to a job still in `saved`** is fixable before you apply — the exact
moment the nudge earns an interruption — so it lands at **priority 74**, between application deadlines (90) and stalls
(68), with copy that names the company. Any other drift is a background reminder at **45**, below routine study. Only the
single most-drifted version surfaces; the rest would be noise. The card deep-links `?v=<id>` so tapping it lands on the
exact stale version (the page reads the param on load, falling back to the first version if it is absent or stale).

**Verified:** 323 API tests (+6, four of them the new drift cases: pre-send urgency, informational fallback, only-one-
surfaces, none-when-clean), lint + typecheck clean. Live against local Postgres: a version linked to the saved NVIDIA
job, with CUDA/OpenGL and a GPU Ray Tracer project added to the profile *after* the version was cut, returned
`missingCount:3` through the live drift path and resolved to the pre-send branch. The card is priority 74; the demo
account is saturated with ≥95 cards (an interview in 3 days, three repair signals from the bombed Meta round), so a 74
card correctly does not reach the top-8 there — which is the ranking working, not a failure. Card construction (title,
priority, reason, href) is pinned exactly by the unit tests. The demo profile was mutated to force drift and restored to
its exact prior state afterwards; the test version was deleted.

## 2026-07-12 - MOM-156: web tests for the résumé page — where the last two bugs actually lived (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Tests + one UI fix they caught.

Both bugs fixed today (MOM-153's silent-no-op "Accept", MOM-154's write-only `aiSuggestions`) lived in **the web
layer**, and `/profile/resumes` — by now the densest page in the app: editor, ATS panel, AI critique, rewrites,
cover letter, drift, per-version conversion — had **zero tests**. The API suite would not have caught either. Six
tests now pin the exact behaviours: rewrites stored on the version are restored on load (the MOM-154 bug); accepting
patches the draft, retires the suggestion, and Save writes the applied text *and* the pruned list in one call;
accepting a rewrite whose bullet has been edited away says so and **keeps** it; rejecting persists the dismissal;
the drift panel names what is missing and stays quiet when it is not.

**The tests immediately earned their keep.** Writing them surfaced a flaw in my own MOM-154 UI: the "Applied to the
draft — press Save" confirmation was rendered *inside* the suggestions list, which unmounts the moment the last
suggestion is accepted — so the confirmation was invisible in exactly the case where the user most needs it (you
accepted the only rewrite; did anything happen?). Moved outside the list. That is a bug no API test could ever have
seen, and I would not have found it by re-reading the diff.

**Verified:** 32 web tests (+6), 319 API tests, lint + typecheck clean.

## 2026-07-12 - MOM-155: résumé drift — the snapshot nobody read (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration.

**How it was found.** MOM-154 ended with a hypothesis: a column that is *written and serialized but read by no
client* is a dead loop by definition, so grep for more. Six candidates (`rawCvText`, `baseProfileSnapshot`,
`compBand`, `interviewProcess`, `roleTrackIds`, `visaFramingParagraph`); five were read by the web. One was not.

**`ResumeVersion.baseProfileSnapshot`** has recorded, since MOM-132, exactly what the `Profile` looked like when a
version was cut. Nothing ever read it — it was not even on the response type. But that snapshot is precisely what is
needed to answer a question a job seeker genuinely has and this app could not: *what have I done since I cut this
résumé?* Without it, a version rots in silence. You ship a project, add a skill, land an internship — and the résumé
you keep attaching to applications still predates all of it, with no signal anywhere in the product.

`GET /resumes/:id/drift` diffs the current profile against the snapshot **by identity** — skill string, project name,
company+role, case-insensitively — not by deep equality. That distinction is the whole design: an edited description
is not something to nag about; a *missing project* is. A version whose `contentMd` was supplied by hand has no
provenance to diff against, so it answers `hasSnapshot: false` rather than guessing or silently reporting "not
stale", which would be a lie of omission. `/profile/resumes` renders an amber panel naming exactly what is missing.

**Verified:** 319 API tests (+5), 26 web tests, lint + typecheck clean. Live: a version cut from the profile reported
clean; adding CUDA, a "GPU Ray Tracer" project and an NVIDIA role to the profile flipped it to `isStale: true` naming
all three; a hand-written version reported `hasSnapshot: false`. The demo profile was mutated to run this and was
**restored to its exact prior state** afterwards (verified by re-reading it); the test versions were deleted.

## 2026-07-12 - MOM-154: aiSuggestions was a write-only column (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Found while shipping MOM-153.

**The bug.** MOM-137's own comment says rewrites are persisted to `ResumeVersion.aiSuggestions` "so the UI can
accept/reject them across sessions". The orchestrator wrote them. The service serialized them. **The web page never
read them.** So a page reload threw your suggestions away while they sat in the database, invisible — and nothing
ever pruned an accepted one, so had anything loaded them, an applied rewrite would have come back from the dead.
This is the same dead-end shape as the MOM-146 Readwise ledger: captured, stored, never resurfaced. The lesson keeps
repeating — *persisting* something is not the same as *closing the loop on it*, and a comment saying "so the UI can…"
is a claim, not a wire.

**The fix.** Outstanding rewrites are restored with the résumé (on both the initial load and every version switch).
Accepting one applies the text and prunes the list in a **single** `PATCH` — so the applied rewrite cannot resurface.
Rejecting one persists immediately and sends *only* `aiSuggestions`, so an unsaved draft edit is left alone. The
update DTO validates each rewrite (nested, max 50) instead of accepting an opaque Json blob, and the serializer
filters malformed rows, because the response type promises `ResumeBulletRewrite[]` and the column is `Json` — a
promise worth nothing unless something checks it.

**Also closed the user-side half of MOM-153's silent-no-op.** MOM-153 fixed the *model-side* cause (a paraphrased
`original` that `contentMd.replace()` could never match). The other cause is the user: accept a rewrite whose bullet
you have since edited out of the draft, and the replace is still a no-op. It now says so and **keeps** the
suggestion, rather than retiring a button press that changed nothing.

**Verified:** 314 API tests (+4), 26 web tests, lint + typecheck clean. Live: a rewrite of a 2-bullet résumé returned
2 suggestions, both survived a plain `GET` (both verbatim-applicable); accept → the rewritten text is in `contentMd`,
the suggestion is gone and does not return on reload, the other is still waiting; reject → gone, `contentMd`
untouched; a malformed rewrite row → 400 from the DTO. Test rows deleted afterwards.

## 2026-07-12 - MOM-153: the rewrite catches up with the critique, and "Accept" stops lying (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Self-selected: the plan's backlog is closed, and this
was the largest *inconsistency* left inside the feature the owner last asked me to improve.

**The gap.** MOM-149/150 taught `analyze` to hold a target in mind (the application's JD + the company's focus areas)
and to ground its suggestions in the user's profile. `rewrite` and `coverLetter` never got either. They took a
hand-pasted `jdText` and nothing else — so the tool that *writes the words* was working from a strictly weaker brief
than the tool that merely criticises them, on the very same bullets. Worse, the JD was usually already in the
pipeline: the user had to re-paste, by hand, text the app was already storing on the application.

All three now share one `TailorContext` and one `loadContext()`. `jdText` became optional: a pasted JD wins (it is what
you are looking at right now), otherwise the JD stored on the targeted — or merely *linked* — application is used. With
no JD anywhere the call returns `{ok:false}` **before the model call**, so the refusal is free (live: `ai/usage` sat at
9 requests / $0.2318 across it). The `/profile/resumes` job select now drives all three tools instead of just the
critique.

**The bug this turned up.** The UI applies a rewrite with `contentMd.replace(original, rewritten)`. But we show the
model *normalized* bullets (whitespace collapsed — a PDF-extracted résumé is full of double spaces), and a model
returns what it was shown. So `original` was frequently **not a substring of the draft**, and `acceptRewrite`'s
`includes(...) ? replace : current` quietly took the else branch: the suggestion vanished from the list and the résumé
was unchanged. A button that reports success and does nothing. Rewrites are now snapped back to the verbatim source
line by matching on the normalized form; a rewrite matching no bullet at all is **dropped** rather than offered as a
dead Accept. Live proof on a deliberately double-spaced bullet: `original` came back with its irregular spacing intact
and `in-source: True`, while the normalized form the model would otherwise have returned was `in-source: False`.

**Sponsorship.** The cover letter's visa paragraph was being written blind, even though the pipeline knows the
employer's posture (`Company.sponsorshipStatus`, falling back to the application's own `visaTag`). It now gets three
distinct framings — and the `not_sponsoring` case is explicitly told not to paper over it, nor to claim work
authorisation the résumé does not evidence. Also fixed a contradiction this exposed: the cover-letter system prompt
said "ground every claim in the résumé" while we now feed it profile evidence the résumé omits; it says what it means
now (résumé *or* supplied evidence, never outside both).

**Verified:** 310 API tests (+8), 26 web tests, lint + typecheck clean on both apps. Live against local Postgres with
a real key: `POST /resumes/:id/ai/rewrite` with a body of literally `{}` pulled the JD from the linked NVIDIA
application and returned an applicable rewrite in 12s; the cover letter (21s) drew on profile evidence the 2-bullet
test résumé never mentioned, and its visa paragraph was brief and matter-of-fact, as instructed for a known sponsor.
All test rows deleted afterwards (résumé versions back to 0).

## 2026-07-11 - MOM-151/152: résumé findings become actions, and get measured (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Completes the five improvements the owner asked for
(148/149/150 shipped in the previous commit).

**MOM-151 — the analysis was a dead end.** It produced `issue`/`suggestion`/`missingThemes` and then stopped; you read
it and hand-edited. `POST /resumes/:id/ai/themes-to-tasks` now turns the themes into **study tasks**, reusing the
existing gap→task bridge shape (`profile-scores.atsGenerateTasks`) rather than inventing a second pattern: capped at
8, deduped by title so re-running an analysis cannot spam the plan, and **no model call** — the findings already
exist, so the action costs nothing. Live: `{created:2}` then `{created:0}` on the repeat, with `ai/usage` unchanged
at $0.2179 across both calls, proving the zero-spend claim rather than asserting it.

*Noticed and kept:* the task titles share the `Résumé gap:` prefix with MOM-135's profile-score gap tasks. That is a
feature, not a collision — an AI-found gap and a score-found gap for the same thing now **dedupe against each other**,
and `notes` preserves which produced it.

**MOM-152 — nothing measured whether the advice worked.** MOM-145 already computes conversion per résumé version
(joined through `ResumeVersion.jobApplicationId`), but it only rendered on the dashboard funnel card. The `/profile/
resumes` list now shows each version's real record — `N sent · N interviewing · N offers · N% conversion` — beside the
version you are editing. That closes the loop the whole track exists for: **analyse → rewrite → send → measure**, and
it is the only feedback in the feature that is not an opinion. Hidden when a version has no applications linked.

**Verification:** 302 API tests (+1) · lint + typecheck clean (api + web) · live: themes→tasks created 2, deduped to
0 on repeat, tasks landed on the study plan with the right type/status/priority, budget unmoved. All test rows deleted
afterwards (one DELETE returned a curl `000`, so the cleanup was re-checked rather than assumed — one task had
survived and was removed; the study plan is back to its 7-task demo baseline).

**Why no model upgrade.** The owner asked whether to raise model capability. Everything in 147–152 says no: coverage
was a contract bug, targeting was missing context, groundedness was missing data, and actionability and measurement
were missing wiring. None of those are fixed by a smarter model, and Gemini 3.1 Pro now matches Opus 4.8 on this task
at a third of the cost.

## 2026-07-11 - MOM-148/149/150: complete, targeted, evidence-grounded résumé analysis (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration. Owner asked "how do I make the AI feature better —
should I raise the model?" Answer: **no.** MOM-147 already showed the binding constraint was our contract with the
model, not the model's intelligence. These three tasks fix what was actually limiting it.

**MOM-148 — check the completeness contract, don't just state it.** MOM-147 added "return one entry per bullet" to
the prompt but never *verified* it, so a model returning 10 of 14 was still accepted silently — the exact failure
that made a cheap model look like a bargain. `analyze()` now diffs the returned `index`es against the enumerated
bullets and, on a gap, runs **one repair pass** for the missing indexes only, merges, and sorts. Both calls are
billed (`inputTokens` summed) — the budget must not under-count a two-call audit. If the repair itself fails we keep
the partial: half an audit beats no audit.

**MOM-149 — judge the résumé against a real target.** `analyze()` took only a role-track label, so it could only give
generic advice, while the DB already held `jdText` on every application and `focusAreas` on every company. Analysis
now accepts an optional `jobApplicationId`; when omitted it falls back to **`ResumeVersion.jobApplicationId`** — the
job the version was already sent to — so a targeted critique is the *default*, not an opt-in. The JD, the role, the
company name, and the company's focus areas all enter the prompt with "judge every bullet against THIS job".

**MOM-150 — ground suggestions in evidence the candidate actually has.** The model kept saying "add a metric" because
it *cannot know* one. It now receives the `Profile` (skills, projects, experience — the master record, D-014) and is
told to prefer a suggestion grounded in that evidence over a placeholder, and to invent nothing that appears in
neither résumé nor profile.

**Live proof (real 1-page CV, 14 bullets, Gemini 3.1 Pro).** Same CV, same model, only the target changed:
- *Untargeted:* "an exceptionally strong résumé … deep understanding of distributed systems."
- *Targeted at the NVIDIA GPU SWE role (real JD):* "heavily features Go, web backends and high-level NLP, **severely
  lacking applied C++, CUDA, and graphics or hardware-parallelism experience**." `missingThemes` came back as CUDA /
  GPU Architecture / Applied C++ / Hardware-Software Co-design, and per-bullet scores dropped (0,3,2 vs 1,4,5)
  because relevance *to this job* now counts. Coverage held at **14/14** in 36s.

That is the difference between a résumé linter and "am I ready for *this* job" — the same loop CareerOS already runs
for interviews.

**Verification:** 301 API tests (+5) · lint + typecheck clean (api + web) · live round-trip above; test résumé deleted.
**Risk:** the repair pass can double the cost of one audit when a model under-delivers. It only fires on an actual
gap, and both calls are recorded against the daily budget, so it cannot silently overspend.

## 2026-07-11 - MOM-147: model-agnostic résumé analysis + gateway pricing (CLAUDE, no schema)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No migration.

**Why:** the owner asked for the cheapest model that is still good enough for a résumé audit. Measured six candidates
through the real analyze prompt + schema on a **real 1-page CV** (14 bullets), and the price table turned out to be a
trap — the cheap models are cheap partly because they **silently do less work**:

| model | cost/audit | bullets critiqued | $/bullet |
|---|---|---|---|
| Opus 4.8 (was default) | $0.107 | 14/14 | $0.008 |
| Sonnet 5 | $0.069 | 14/14 | $0.005 |
| **Gemini 3.1 Pro** | **$0.037** | **3/14** ⚠️ | **$0.012** |
| Gemini 3 Flash | $0.007 | 6/14 | $0.001 |
| Gemini 3.1 Flash Lite | $0.0014 | 6/14 | $0.0002 |

Gemini 3.1 Pro looked 3× cheaper than Opus while critiquing **3 of 14 bullets** — per bullet actually audited it was
*more* expensive than Opus. Flash contradicted itself (`impactScore: 5` with `issue: "None. This is a perfect bullet
point"`). The cheap tiers were not worse *judges* so much as **incomplete auditors**, and nothing in the response
shape revealed it.

**Root cause — ours, not the model's.** Nothing in the prompt or schema required completeness. Opus/Sonnet infer
"critique every bullet"; other models don't. Gemini also spent feedback on *missing spaces* — PDF-extraction
artifacts, not résumé flaws.

**Fix (three changes, all in our code):**
1. **`ResumeAiService.extractBullets()`** — bullets are now found deterministically **in code**, not left to the model
   to decide what counts as one. They are passed back enumerated (`0.`, `1.`, …).
2. **Completeness contract** in `ANALYZE_SYSTEM` — "exactly N entries, one per numbered bullet, never skip a strong
   one" — plus a new `index` field on `ResumeBulletFeedback` so coverage is *checkable*, not hoped for.
3. **Ignore-formatting instruction** — stops feedback being spent on PDF whitespace artifacts.

Also `MAX_TOKENS` 4096 → 16000: adaptive thinking is billed **inside** `max_tokens`, so a full résumé at `effort:high`
was being truncated once thinking took its share. And an empty-bullet résumé now returns `{ok:false}` **without
calling the model** (no spend on an un-analysable input).

**Result — Gemini 3.1 Pro went 3/14 → 14/14** and is now the best value of the three (measured, same CV):

| model | coverage | cost/audit | latency |
|---|---|---|---|
| **Gemini 3.1 Pro (new default)** | 14/14 | **$0.041** | **29s** |
| Sonnet 5 | 14/14 | $0.059 | 56s |
| Opus 4.8 | 14/14 | $0.116 | 53s |

~3× cheaper and ~2× faster than Opus at equal coverage. Quality is substantive, not cosmetic: it flags that
*"Co-developed" obscures your specific contribution*, that *"co-architected" dilutes ownership*, and rates the
pprof/concurrency bullet a **senior** signal.

**Gateway pricing rows** added to `ai.config.ts`. The `opus-4-8` fallback silently mispriced every gateway slug —
over-reporting Gemini (cheaper than Opus) and, more dangerously, **under-reporting a Fable-tier model by 2×**, which
would have let the daily cap overspend. Live-verified: the analyze call billed **$0.0404**, matching Gemini's $2/$12.

**Verification:** 296 API tests (+3) · 26 web · lint + typecheck clean · **live round-trip**: `POST
/resumes/:id/ai/analyze` on the real CV returned 14/14 with indexes 0–13 complete in 26s. Test résumé deleted after.

**Honest caveats:** (a) `google/gemini-3.1-pro-preview` is a **preview** slug and can move or be retired — the pricing
row and `ANTHROPIC_MODEL` both need updating when the owner moves to Gemini 3.5 Pro, and that slug is **not on
OpenRouter yet** (checked 2026-07-11). (b) Haiku 4.5 failed schema parsing on two of three runs and passed on the
third — **intermittent**, cause not established; it is not recommended until that is understood.

## 2026-07-11 - LIVE AI VERIFICATION: MOM-068–074 + MOM-136/137/138 unblocked (CLAUDE, no code change)

**Actor:** CLAUDE. Branch `feat/careeros-phase-0`. No schema, **no application code changed** — this was a
verification pass, plus the doc fixes it forced.

**Trigger:** the owner supplied an API key. It was an **OpenRouter** key (`sk-or-v1-…`), not an Anthropic
`sk-ant-…` key, so it could not simply be dropped into `ANTHROPIC_API_KEY` — our code calls `api.anthropic.com`
through the Anthropic SDK. Rather than assume it was unusable, I probed it: **OpenRouter serves the Anthropic
`/v1/messages` shape *and* `output_config` structured outputs**, which is exactly what `messages.parse` +
`zodOutputFormat` needs. So the live path was reachable with **zero code change** — only env:

```
ANTHROPIC_API_KEY="sk-or-v1-…"           # in apps/api/.env (gitignored)
ANTHROPIC_BASE_URL="https://openrouter.ai/api"
ANTHROPIC_MODEL="anthropic/claude-opus-4.8"
```

**The one real trap** (cost a failed first run): the SDK appends `/v1/messages` to `ANTHROPIC_BASE_URL`, so
`https://openrouter.ai/api/v1` becomes `/api/v1/v1/messages` → OpenRouter's **HTML 404 page**, which surfaced as
the deliberately-vague `{ok:false,"reason":"AI service returned an error."}`. The base URL must stop at `/api`.
Now documented in `.env.example` and the README config table so nobody re-loses that hour.

**Verified live (6 requests, $0.1237 of real spend, budget debited correctly to $0.876 remaining):**
- `POST /attempts/:id/grade` — a real `messages.parse` succeeded (12.2s), returning a structured rubric that
  **correctly caught a nonsense answer**: "two-pointer sweep" for binary-tree max-path-sum → `aiScore` 0.02,
  suggested rating `again`. This is the MOM-068–074 gate that had been open since 2026-07-06.
- `POST /resumes/:id/ai/analyze` — every filler bullet ("Worked on the API.") scored impactScore 0 / junior,
  with 8 `missingThemes`.
- `POST /resumes/:id/ai/rewrite` — 3 JD-targeted rewrites that **did not fabricate metrics**, and the rewrites
  **persisted into `ResumeVersion.aiSuggestions`** (confirmed by re-fetching the version).
- `POST /resumes/:id/ai/cover-letter` — a 218-word draft plus a standalone visa-framing paragraph that picked up
  "sponsorship available" from the JD.

**A false alarm, recorded because it nearly became a false bug report:** the analyze output looked like mojibake
(`rÃ©sumÃ©`). Hexdumping the raw response showed `r\xc3\xa9sum\xc3\xa9` — **correct UTF-8**. The corruption was
Windows Python decoding piped stdin as cp1252. Always check raw bytes before blaming the encoding.

**Honest limits — what is still NOT verified:** (a) a native `sk-ant-` call against `api.anthropic.com` (the wire
format and structured-output handling are identical, but it is technically un-run); (b) the **budget-exceeded**
path, which would need ~$1 of real spend to trigger — the guard remains unit-tested only.

**Docs corrected:** the "the live AI path has never been executed" note I had written into the README *earlier the
same day* (MOM-089) was now false and was rewritten; MOM-068–074's status note and the MOM-136/137/138 rows were
flipped from VERIFICATION-BLOCKED to LIVE-VERIFIED with the evidence above; `ANTHROPIC_BASE_URL` (previously
undocumented anywhere) added to `.env.example` and the README config table.

**Security:** the key was pasted into a chat transcript, so it is compromised and the owner has been told to
rotate it. It lives only in `apps/api/.env`, which `apps/api/.gitignore` covers — confirmed via `git check-ignore`
and a clean `git status` before committing. **No key value is committed.**

## 2026-07-11 - MOM-089: README final polish (CLAUDE, docs only)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. No schema, no code — `README.md` only.

**Why now:** the handoff plan is complete, and every other open backlog row is credential-gated (MOM-021 deploy,
MOM-088 Lighthouse, MOM-070–074 / MOM-136–138 live AI key) or needs an explicit owner go-ahead (MOM-049 LeetCode
import). MOM-089 was the one genuinely unblocked item left. The README had drifted roughly twenty PRs behind the
product: it described a practice app with a job list, and said nothing about interview rounds, debriefs, weakness
signals, company intelligence, contacts, offers, or résumé versions — i.e. the entire reason CareerOS exists.

**What:**
- **Intro** now states the actual thesis: the job search and the study plan are one closed loop.
- **Screens & Routes** — added `/companies`, `/companies/[id]`, `/contacts`, `/offers`, `/profile/resumes`; corrected
  `/jobs` (list *or* kanban) and `/jobs/[id]` (rounds, debriefs, readiness, story gaps, prep queue, contacts, offer).
- **API Overview** — the one thin "Career OS" block became four accurate sections (Career OS / Job Pipeline / Résumé
  Versions / Tasks, Reminders & Learning). Every route was **read out of the controllers**, not recalled: funnel,
  events, rounds + round prep, weaknesses, contacts, offers, resumes + export + the three AI routes, ats-coverage +
  generate-tasks, target-shortlist, job readiness, story-gaps, and `GET /companies/:id`.
- **Features** — Career OS rewritten around the loop; new **Résumé Studio** section (versions, ATS coverage, export,
  dormant AI).
- **Architecture Decisions** — the list stopped at ADR-0006; ADR-0007…0015 added (all nine exist on disk).
- **QA & Known Notes** — new **"Verification-blocked, and not claimed to work"** block stating plainly that the live
  AI path has never been executed, that Lighthouse needs a real deployment, and that `pg_dump`/`pg_restore` were
  never run against a real Postgres. A reader should not have to dig through the backlog to learn what is scaffolding.
- **Config reference** — `ANTHROPIC_API_KEY` now says it also gates résumé tailoring, sharing one daily budget pool.

**Verification:** docs-only; no code changed since `85f3faf` (293 API + 26 web tests green there), so no suite was
re-run and nothing new is claimed about them. Route/ADR accuracy was checked against the source: `find` over
`apps/web/app/(authenticated)` for pages, the `@Controller`/`@Get`/`@Post` decorators for endpoints, `ls docs/adr/`
for the ADR list. **Rollback:** revert the commit.

## 2026-07-10 - MOM-145: conversion by résumé version (CLAUDE, no schema) — FINAL ITEM OF THE HANDOFF PLAN

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. No migration. Closes the approved handoff plan
(`~/.claude/plans/…mossy-moore.md`): Waves 1–4 are now complete.

**What:** `jobs.service.funnel()` gains **`byResumeVersion`** — conversion per résumé, joined through
`ResumeVersion.jobApplicationId` (the record of "this is the résumé I sent them"), keyed by the version's label and
reusing the existing `breakdown()` shape (total / interviewing / offers / conversion). This finally answers *which
résumé actually converts*, which is the whole point of having versions at all.

**Design call:** `breakdown()` is now generic and a `null` key **drops** the job. Applications with no version linked
carry zero signal about résumé performance, so including them as an "unlinked" bucket would only dilute the
comparison — they are excluded, and the funnel-card row stays hidden until versions are actually linked to jobs.

**Checks:** shared build; API + web lint/typecheck green; **293 API tests** (+2: the join/exclusion maths, and the
empty case) + 26 web. **Live-verified**: linked "Big-tech tailored v2" to the Databricks (offer) + Meta (interview)
apps and "Base résumé" to the rejected Airbnb app → tailored = 2 sent / 2 interviewing / 1 offer / **50% conversion**,
base = 1 sent / 0 / 0 / **0%**, and the other 5 applications correctly uncounted; `bySource`, `byRejectionReason` and
the MOM-104 `medianDaysInStage` all still intact. Demo state restored (versions deleted; the 8 jobs survived, which
also re-confirms the `SetNull` FK).

**Rollback:** revert code — no schema, no data.

## 2026-07-10 - MOM-136/137/138: AI résumé analysis / bullet-rewrite / cover-letter (CLAUDE, dormant-until-key)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. No migration. **VERIFICATION-BLOCKED on a live
`ANTHROPIC_API_KEY`** — the same honest status as MOM-068–074. The no-key path is fully verified; **the live model
path is not, and this entry does not claim it works.**

**What:** `apps/api/src/ai/resume-ai.service.ts` mirrors `grading.service.ts` exactly — `isAvailable()` =
`Boolean(getAnthropicApiKey())`, `client.messages.parse` + `zodOutputFormat`, adaptive thinking, and a structured
`{ok:false,reason}` for *every* failure (no key, schema miss, rate limit, auth, connection) so the feature is
**dormant, never broken**. `ResumeAiOrchestrator` mirrors `AiService.gradeAttempt`: availability → version lookup
(404) → **the same shared daily `BudgetService` pool** (`checkAndReserve` / `record` with real token counts) → call
→ record.

- **MOM-136** `ResumeAnalysisSchema` — per-bullet `impactScore` 0–5, `senioritySignal`, the issue, a concrete fix,
  plus `missingThemes`. `POST /resumes/:id/ai/analyze`.
- **MOM-137** `BulletRewriteSchema` — `original → rewritten + rationale`, JD-tailored. `POST /resumes/:id/ai/rewrite`
  persists the rewrites into `ResumeVersion.aiSuggestions` **on success only**. Web shows accept/reject; **accept is
  deterministic** — it swaps `original`→`rewritten` in the draft `contentMd`, then Save persists.
- **MOM-138** `CoverLetterDraftSchema` — `draftMarkdown` + a standalone `visaFramingParagraph` the candidate can slot
  in or drop. `POST /resumes/:id/ai/cover-letter`.

**Design note (deviation from the plan's letter, not its intent):** the plan said "zod schemas in shared". They live
in `ai/dto/resume-ai.schema.ts` instead — exactly where `grade-result.schema.ts` lives — because `zodOutputFormat()`
needs zod's **v4** API surface, which only the API depends on. The web consumes plain response interfaces
(`ResumeAnalysisResult`, `ResumeBulletRewrite`, `CoverLetterDraftResult`, `ResumeAiEnvelope<T>`) from `@momito/shared`.

**Checks:** shared build; API + web lint/typecheck green; **291 API tests** (+10, **all fully mocked, zero-network**:
no-key dormancy across all three methods, successful parse of each schema, JD passthrough, schema-miss/rate-limit/auth
→ structured failure, orchestrator dormancy touching neither DB nor budget nor model, budget `record` with real token
counts, suggestions persisted only on success, 404 foreign version, 400 budget exhausted) + 26 web. **Live-verified
(no-key path only)**: all three endpoints return `{"ok":false,"reason":"…no ANTHROPIC_API_KEY…"}`; `aiSuggestions`
stayed `[]`; `ai/usage` still `available:false, requests:0, costUsd:0` — nothing written, nothing billed; DTO
validation 400s on a missing `jdText`. Demo version deleted afterwards.

**Rollback:** revert code — no schema, no dependency, no data.

## 2026-07-10 - MOM-139: résumé export md|pdf (CLAUDE, no schema, no new dep)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. No migration. Depends on ResumeVersion (MOM-133).

**What:** `GET /resumes/:id/export?format=md|pdf` (declared before `:id` so it never shadows the plain GET).
MD = `contentMd` as a `text/markdown` attachment. PDF = an ATS-safe single-column render.

**Dependency decision (the plan flagged pdfkit vs puppeteer):** neither — **no new dependency**. An ATS parser
reads a PDF's text from its content stream using a standard font's glyph widths, so the safest possible output is
plain text, one column, in a built-in (non-embedded) font. That needs no library. `resume-pdf.util.ts` is a small,
deterministic, dependency-free PDF writer: Markdown → styled/wrapped lines → paginated Helvetica content streams
→ a correctly cross-referenced PDF. Accents/typographic symbols are transliterated to ASCII (ATS-preferred).
Anything heavier would be strictly worse for ATS parsing, so there was nothing to gain from a binary dep — and it
also sidesteps touching the (pre-existing, not-ours) `pnpm-lock.yaml`.

**Web:** `/profile/resumes` gains "Export .md" / "Export .pdf" buttons — `resumesApi.download` fetches with the
Bearer header (a plain `<a href>` can't authenticate) and triggers a blob download using the server's filename.

**Checks:** API + web lint/typecheck green; **281 API tests** (+3: MD verbatim + slug filename, valid PDF
header/xref/EOF + text op, 400 unknown format / 404 foreign version). **Live-verified** against local Postgres:
MD round-trips; the PDF is byte-deterministic (1545B, identical across repeated requests) and — the real proof —
**parses cleanly in `pypdf`**, extracting every résumé section (name, contact, Skills, Experience, Projects,
Education) as readable text; 400 on `format=docx`, 404 on a foreign id; demo version deleted afterwards.

**Rollback:** revert code — no schema, no dependency, no data.

## 2026-07-10 - MOM-134-full: ATS coverage vs a ResumeVersion (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. No migration. Builds on MOM-134-lite
(`AtsCoverageResponse` + coverage vs base profile) now that ResumeVersion (MOM-133) exists.

**What:** `profileScores.atsCoverage(jdText, userId, resumeVersionId?)` — when `resumeVersionId` is supplied
it measures the JD's keywords against that **`ResumeVersion.contentMd`** (every word token in the résumé, so a
skill named in a bullet counts, not just a skills line), otherwise the base profile skills (lite behaviour
preserved). The response gains `source: 'profile' | 'resume'` and `resumeVersionId` so the UI can label what was
measured. New **`POST /profile-scores/ats-coverage/generate-tasks`** applies the MOM-135 gap→task bridge to ATS
gaps: the JD keywords missing from the résumé become idempotent `Add to résumé: X` study tasks (cap 8,
dedup-by-title). Web: the `/profile/resumes` editor gains an ATS panel per version — paste a JD, see
covered/missing keyword chips + coverage %, and "Add missing to tasks".

**Design note:** the tokenizer is deterministic (`extractJdSkills` unchanged); résumé tokens keep `+`/`#`/`.`
so `c++`/`c#`/`node.js` survive, with trailing dots trimmed for membership. No AI, no persistence for the
coverage read itself.

**Checks:** shared build; API + web lint/typecheck green; **278 API tests** (+5: résumé-vs-profile coverage,
404 on foreign version, source=profile null id, gap→task create + idempotency) + 26 web. **Live-verified**
against local Postgres: created a version, coverage vs résumé = 0.25 vs profile = 0.125 (different artifacts),
`generate-tasks` created 6 then 0 (idempotent), 404 on a bogus `resumeVersionId`; demo state restored (version
+ 6 tasks deleted).

**Rollback:** revert code — no schema, no data.

## 2026-07-10 - MOM-132+133: ResumeVersion (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **Additive migration** `resume_versions` (new
table). Opens Wave 4 — the app can finally keep tailored résumés, not just one overwrite-on-upload profile.

**Design (SPIKE-014 resolved → ADR-0012 ACCEPTED, D-020):** new `ResumeVersion` (many per user) decoupled from
the master `Profile` (D-014). `label`, `targetRoleTrackId?`, `jobApplicationId?` FK **SetNull** (records which
version was sent), **`contentMd String` (canonical Markdown)**, `baseProfileSnapshot Json?` (provenance),
`aiSuggestions Json` (reserved for MOM-137). On create without explicit `contentMd`, the server derives it from
the Profile via a `profileToMarkdown` serializer (name/contact → Skills → Experience → Projects → Education)
and snapshots the source. Markdown chosen over per-section JSON so the artifact is editable/diffable/exportable
without a bespoke schema.

**API:** `resumes` CRUD module (`/resumes`). **Web:** `/profile/resumes` page — "Duplicate from profile"
(derives from the Profile), a version list, and a Markdown editor (label + contentMd) with save/delete; a
"Résumé versions" button added to the profile header.

**Checks:** shared build; API + web lint/typecheck green; **273 API tests** (+6: `profileToMarkdown` section
rendering, derive-from-profile + snapshot, verbatim contentMd (no snapshot), missing-profile 400, foreign-job
NotFound, update/remove NotFound) + 26 web tests. **Live:** POST derived contentMd from the demo profile
("# Demo Candidate …"), linked to Meta; list/update/delete round-trip clean. Rollback: drop the table
(Profile untouched).

## 2026-07-10 - MOM-114+115: Offer model + comparison (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **Additive migration** `offers` (new table).
Gives the end of the pipeline a place to land — record and compare offers.

**Design (SPIKE-015 resolved → ADR-0015, D-019):** new `Offer` model, **one per application**
(`jobApplicationId @unique`, `onDelete: Cascade`; nullable so it can be standalone). Comp as `Decimal?`
(`baseSalary`, `bonus`, `equityTotal`) + `equityYears Int @default(4)`, plus `currency`, `location?`,
`visaSponsored Boolean?`, `deadline?`, `notes?`, `status` ∈ `OFFER_STATUSES`. **Normalized annual total =
base + bonus + equityTotal/equityYears, computed at read time** (null when no comp figure set). **No FX in v1**
— the comparison shows each offer in its own currency and warns on mixed currencies (the SPIKE-015 scope cut).

**API:** `offers` module — `GET /offers` (comparison list) + per-job `GET/PUT/DELETE /jobs/:jobId/offer`; PUT
upserts on the unique FK so the UI never handles an offer id. Decimal → number at the boundary; currency
upper-cased. **Web:** `OfferCard` on the job detail page (edit comp + status, see the normalized total);
`/offers` comparison table (sorted by normalized total desc, visa-sponsored column, mixed-currency warning);
`💰 Offers` nav entry.

**Checks:** shared build; API + web lint/typecheck green; **267 API tests** (+6: normalized-total math,
null-total, upsert + ownership, currency upper-casing, NotFound on delete/foreign job) + 26 web tests. **Live:**
a Meta offer (190k base + 25k bonus + 240k/4 equity) returned `normalizedAnnualTotal 275000`, `currency` `usd`
→ `USD`; appeared in `/offers`; `status:'pending'` → 400; delete cleaned up to 0. Rollback: drop the table.

## 2026-07-10 - MOM-119: referral network view (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema, web-only.** Completes the
contacts triad (116/117/118/119) — the network is now browsable as a whole.

**Web:** new `/contacts` page grouping the user's contacts by relationship (recruiters → referrers → hiring
managers → peers → other → unspecified; empty groups hidden), each card showing name, company, email,
LinkedIn, and a chip linking to the contact's job (company name resolved by joining `contactsApi.list()`
with `jobsApi.list()` client-side — no backend change). `👥 Contacts` nav entry after Companies.

**Today thank-you nudge:** intentionally *not* a new `recommendations.service` card — the MOM-118
`thank_you` reminder already surfaces on Today via the reminder feed, so a second card would double-nudge.
Noted here as a deliberate scoping call.

**Checks:** web lint/typecheck green; **26 web tests** (unchanged — no API/shared change; API stays 261). The
page renders over `contactsApi.list()`/`jobsApi.list()`, both live-verified in MOM-117. No Playwright binary
for a screenshot. Rollback: delete the page + nav row.

## 2026-07-10 - MOM-118: follow-up cadence (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema.** Turns the pipeline + contacts
into proactive reminders.

**Service (`follow-up/FollowUpService.sweep`):** a daily idempotent sweep. (a) an `applied` app whose current
stage entered ≥ 10 days ago (from the MOM-104 status_change timing, else createdAt) with **no open `follow_up`
reminder** → creates "Follow up with {company}" (10d fires earlier than the MOM-105 stall threshold of 21d — a
nudge before it's officially stale). (b) an `InterviewRound` decided within the last day (`outcome != pending`,
`updatedAt ≥ now-1d`) that has a **contact on its job** and no existing `thank_you` reminder → creates "Send a
thank-you note for your {company} interview". Both caps make a re-run a no-op. `FollowUpScheduler` fires it via
`@Cron(EVERY_DAY_AT_7AM)`; new `FollowUpModule` (PrismaModule only — no cross-service deps).

**Checks:** API lint/typecheck green; **261 API tests** (+4: stale-applied nudge, within-threshold/already-open
skips, thank-you create, no-contact/duplicate skips). **Live:** a probe set a job to `applied` + backdated its
stage 15d — sweep #1 created "Follow up with NVIDIA" (pending); sweep #2 created 0 (count stayed 1, idempotent);
restored. Thank-you path is unit-verified. Rollback: delete the module (reminders are inert data).

## 2026-07-10 - MOM-116+117: Contact model (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **Additive migration** `contacts` (new table +
FK + create-only backfill). Opens Wave 3 — networking becomes first-class.

**Design (SPIKE-011 resolved → ADR-0014, D-018):** new `Contact` model (`name`, `email?`, `linkedinUrl?`,
`company?`, `relationship` ∈ `CONTACT_RELATIONSHIPS` = recruiter|referrer|hiring_manager|peer|other, `notes?`)
with a **nullable `jobApplicationId` FK, `onDelete: SetNull`** (standalone or job-attached; a job has many;
survives the job's deletion). `JobApplication.referralName` kept (D-004 fallback). **Backfill is create-only,
idempotent, dedup-safe**: `DISTINCT ON (userId, lower(name))` collapses a repeated referral to one contact
(earliest job wins), `NOT EXISTS` makes a re-run a no-op; no unique DB constraint (namesakes are legal). Used
`--create-only` → appended the backfill SQL → applied.

**API:** `contacts` module mirrors `interview-rounds` but one controller carries **both** route groups —
`/contacts` (standalone list/create/update/delete) and `/jobs/:jobId/contacts` (job-scoped list/create).
DTOs validate relationship, email, URL; the service ownership-checks any job link. **Web:** `ContactsCard`
on the job detail page (list + inline add + optimistic delete) fed by a new `contactsApi`.

**Checks:** shared build; API + web lint/typecheck green; **257 API tests** (+6: serialize, standalone create
with job validation, cross-user job rejection, nested create-from-path, update/remove NotFound) + 26 web tests.
**Live:** the migration backfilled 0 (no demo job has a referralName) — proven correct by a probe that gave a
job a referralName, ran the exact backfill SQL (inserted 1 `referrer` linked to the job, re-run inserted 0),
then cleaned up. Full CRUD round-trip: create-on-job → list → update relationship → appears in `/contacts` →
bad relationship 400 → delete 200. Rollback: drop the table + FK (referralName still displays).

## 2026-07-10 - MOM-107: Kanban pipeline view (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema, web-only.** Completes Wave 2
(pipeline truth).

**Web (`jobs/page.tsx`):** a list ↔ board view toggle in the header. The board renders one column per active
funnel stage (`JOB_FUNNEL_STAGES`: saved…offer; terminal outcomes stay in the list view). Cards are draggable
via **native HTML5 drag events** (no new dependency); dropping a card in another column calls `moveJob`, which
optimistically updates local state and calls the existing `jobsApi.update(id, {status})` — the same endpoint
that already writes the MOM-102/104 transition event and MOM-106 reason handling — reverting on error. Cards
show company/role, a compact stall pill, and a deadline chip; the funnel card + filter pills remain on the
list view only. A `dragJobId` state dims the card in flight and provides a dataTransfer fallback.

**Checks:** web lint/typecheck green; **26 web tests** (unchanged — no API/shared change; API stays 251). No
Playwright binary in this checkout for a board screenshot; the drag path delegates to `jobsApi.update(status)`,
which is live-verified end-to-end by MOM-102/104/106 (transition event + timing + reason). Rollback: revert the
page (the board is purely presentational over the existing status-update API).

## 2026-07-10 - MOM-106: rejection reasons (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **Additive migration**
`job_rejection_reason` (pure `ADD COLUMN`, no backfill). Turns "rejected" from a dead end into loss analysis.

**Shared:** `REJECTION_REASONS` (`no_response`, `resume_screen`, `oa_failed`, `interview_technical`,
`interview_behavioral`, `visa_sponsorship`, `position_closed`, `other`); `rejectionReason` on
`JobApplicationResponse` + optional on the create/update requests; `byRejectionReason: JobRejectionBreakdownRow[]`
on `JobFunnelResponse`.

**Schema/service:** `JobApplication.rejectionReason String?` (a property of the terminal outcome —
retroactively editable, aggregates via GROUP BY like source/visaTag — not on the event). DTO `@IsIn`;
the **service** enforces it's only accepted when the resulting status is `rejected` (400 otherwise), **clears**
it when the app is moved back out of rejected, and **copies** it onto the transition event's `notes` when the
transition *is* the rejection. `funnel()` adds a count-per-reason breakdown (unset → `unspecified`, most common
first). Web: a reason `<select>` appears on the job page when the status is rejected; the funnel card gains a
"Why rejected" row.

**Checks:** shared build; API + web lint/typecheck green; **251 API tests** (+6: create/update validation both
ways, event-note copy, auto-clear on reopen, funnel breakdown). **Live:** setting a reason on a non-rejected
app → 400; a `saved → rejected {visa_sponsorship}` transition stored the reason AND wrote
`notes="Rejection reason: visa_sponsorship"` on the event; funnel `byRejectionReason` = visa_sponsorship 1 /
unspecified 1; restoring the app to `saved` cleared the reason to null. Demo job restored. Rollback: drop 1 column.

## 2026-07-10 - MOM-105: stall detection (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema** — builds directly on the
MOM-104 transition timing. Surfaces applications that have gone quiet.

**Shared:** `JOB_STAGE_STALL_THRESHOLDS` (days): saved 14, applied 21, oa 7, interview 14, onsite 14,
offer 7 (terminal / unlisted stages never stall). `JobApplicationResponse` gains `daysInStage` (null for
terminal) + `isStalled`.

**Service (`jobs.service`):** `jobInclude` gains a `take:1` filtered `events` relation (latest
`status_change`) so the list query dates the current stage cheaply; `get()` reconstructs that shape from the
full timeline it already loads (the events key is overridden there). `serializeJob` computes
`daysInStage = floor(now − (latestTransition.eventAt ?? createdAt))` and `isStalled = daysInStage ≥ threshold`.
`recommendations.service` fetches the same `take:1` events for its active-job sample and, when a job is
stalled, emits a **"Follow up on {company} — {N}d in {stage}"** card (priority 68 — below interview
countdown 101+ and deadlines 90, above routine study) that *supersedes* the routine stage card for that job.

**Web:** the jobs list renders a `⏳ Stalled · {N}d` amber badge.

**Checks:** shared build; API + web lint/typecheck green; **245 API tests** (+4: stalled past threshold /
within threshold / terminal-null on the serializer; stall card supersedes the stage card / within-threshold
keeps it). **Live:** GET /jobs returns `daysInStage`/`isStalled` correctly (rejected → null); backdating a
saved job's createdAt 30d flipped `isStalled` true (daysInStage 30 ≥ 14), restored after. The stall
recommendation generates but sat below the top-8 slice on the busy demo board (8 items ≥95) — expected at
priority 68; the card itself is unit-verified. Rollback: revert (fields are additive/inert).

## 2026-07-10 - MOM-103+104: transition history + funnel timing (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **Additive migration**
`job_event_transition_status`. Gives the pipeline a real sense of *time*, not just current position.

**Schema (SPIKE-009 resolved → ADR-0009 ACCEPTED):** `JobEvent` gains `fromStatus`/`toStatus` (`String?`,
set only on `status_change` events). Chose structured columns on the existing event row over (a) a separate
`StatusTransition` table (would force a permanent dual-write with the MOM-102 audit trail) and (b) 8 per-stage
timestamp columns on `JobApplication` (can't model stage revisits; bloats the busiest row). **Backfill** in the
migration reconstructs the pair from the machine-written MOM-102 title via `split_part(title, ' → ', 1/2)`,
guarded idempotent (`from_status IS NULL`) and safe (both endpoints must be known statuses). `--create-only`
→ edited in the backfill → applied, so the checksum covers the final SQL.

**Service:** `jobs.service.update()` writes the structured pair on each transition (keeps `title` for display);
`serializeEvent` exposes them. `funnel()` now loads the ordered `status_change` events and diffs consecutive
`eventAt`s per job to emit `medianDaysInStage` per stage (first stage entry approximated by `job.createdAt`;
open current stage contributes no sample; revisits each sample → median, not a single span). Web: the funnel
card renders a `~Nd` median-time column per stage.

**Checks:** shared build; API + web lint/typecheck green; **241 API tests** (+2: median-days computed from
transitions & ignores the open stage; `fromStatus`/`toStatus` written on the event). **Live** (existing DB):
the 1 pre-existing `applied → oa` event backfilled correctly; a fresh `interview → onsite` transition landed
`fromStatus=interview toStatus=onsite`; funnel returned `medianDaysInStage` interview 1.5, applied 0. Meta job
restored to `interview`. Rollback: drop the 2 columns (free-text title untouched).

## 2026-07-10 - MOM-125: targeting shortlist (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema.** Answers "who should I apply
to next?" by ranking the whole catalog with the same focus-weighted grounded readiness the "am I ready for
Meta?" verdict uses per-job.

**Logic (`career.service.getTargetShortlist`):** for each catalog company with a focus profile, fit =
`companyWeightedPercentage(readiness.areas, focusAreas)` — the user's grounded (MOM-129 FSRS) readiness
weighted by that company's 1–5 interview emphasis. Grounded readiness is computed once per **distinct role
track** (memoized `readinessByTrack`), so ~20 companies cost a handful of evidence loads, not 20. Final
`score = fit × sponsorshipMultiplier × regionMultiplier`, rounded. Sponsorship gate (emigration-critical):
sponsored 1.0 / unknown 0.7 / not_sponsoring 0.2 (`null`→unknown). Region: inferred from the user's existing
pipeline (regions of their linked companies); 'Global'/null and preferred regions stay at 1.0, a specific
off-target region takes a 0.85 demerit — but with no pipeline signal nothing is penalized. Each item carries
`topFocusAreas` (weight + the user's % in each) and a human `reason`. Route `GET /career/target-shortlist`
(static, ordered before the `:jobId` routes). Web: a "Where to apply next" top-3 card on the career page,
each row linking to the company detail.

**Checks:** `pnpm --filter @momito/shared build`; API + web lint/typecheck green; **239 API tests** (+2:
fit-ranking with sponsorship scaling + focus-less companies skipped; region demerit only once a pipeline
preference exists) + 26 web tests. **Live:** the demo catalog ranks NVIDIA 51 → … → Amazon 15; ByteDance
(the sole `unknown` pack) correctly drops to score 15 on a 0.7 multiplier despite fit 21. Rollback: drop the
route + method + shared types (inert).

## 2026-07-10 - MOM-124: visa/sponsorship filter + sort (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema, web-only.** Makes the
sponsorship signal actionable on both the target catalog and the live pipeline.

**Catalog (`companies/page.tsx`):** a filter-pill row (All / Sponsors visas / Unknown / No sponsorship),
reusing the jobs-page status-pill pattern. `sponsorshipKey(status)` buckets `null` (no data) together with
explicit `'unknown'` so the filter never hides a company. Pills with a zero count hide (except All).

**Jobs list (`jobs/page.tsx`):** a parallel sponsorship-pill row (emerald active state to distinguish it
from the status row) plus a **sponsored-first sort** on the rendered list. A job's sponsorship prefers its
linked `companyRef.sponsorshipStatus`, falling back to the job's own `visaTag`, then `'unknown'`
(`jobSponsorship`); sort uses `SPONSORSHIP_RANK` (sponsored 0 < unknown 1 < not_sponsoring 2), stable so
same-bucket jobs keep their order. The status and sponsorship filters compose (AND).

**Checks:** web lint/typecheck green; **26 web tests** (+1: catalog filter buckets null with unknown and
narrows to each sponsorship class). No API/shared change → API stays 237. No Playwright in this checkout;
the filter logic is client-side and unit-covered. Rollback: revert the two pages + delete the test.

## 2026-07-10 - MOM-123: company detail + catalog pages (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema.** Surfaces the structured
company intelligence (MOM-121) as a browsable catalog + detail UI — the target side of the North-Star loop
now has a face.

**Web:** new `apps/web/app/(authenticated)/companies/page.tsx` (catalog grid — name, region badge,
sponsorship badge, top-3 focus-area chips; click → detail) and `companies/[id]/page.tsx` (detail —
focus-area weight bars, numbered interview process, notes, role tracks, linked question/story counts,
sponsorship badge, comp band). Nav entry `🏢 Companies` added to `navigation.ts` before Questions.

**API:** `CompaniesService.get(id)` now `include`s `_count: { questions, stories }` and returns
`linkedQuestionCount`/`linkedStoryCount` (added to `CompanyResponse` in shared). `list()` unchanged.

**Checks:** `pnpm --filter @momito/shared build`; API + web lint/typecheck green; **237 API tests** (+1:
`get()` surfaces linked counts) + 25 web tests; web build clean. **Live:** `GET /companies/:id` for Meta
returns `linkedQuestionCount: 4, linkedStoryCount: 0`. Playwright screenshot skipped — no Playwright binary
in this checkout; pages are build/typecheck/lint clean and reuse the verified `Card`/`Badge`/`companiesApi`
patterns, API data path live-verified. Rollback: delete the two pages + nav row + revert the `_count`
include (inert).

## 2026-07-10 - MOM-122-followup: company-weighted readiness (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema.** Makes the MOM-122 FK pay
off in the numbers: a job linked to a catalog company now gets a readiness verdict weighted by *that
company's* focus areas, not the flat role checklist.

**Logic (`career.service`):** `getJobReadiness` loads `companyRef.focusAreas`/`roleTrackIds`; when linked,
the headline `base` becomes the **focus-weighted mean** of area percentages (`companyWeightedPercentage`)
and `weakestAreas` is ordered by `focusDrag` = focus weight × (100 − percentage), so the areas the company
actually drills surface first. Unlinked → the existing role-checklist mean + lowest-percentage ordering
(unchanged). `getJobStoryGaps` falls back to `companyRef.roleTrackIds[0]` when the job has no explicit
roleTrack. New helpers `companyWeightedPercentage`/`focusDrag`/`firstRoleTrack`/`asFocusAreas`.

**Checks:** `pnpm -r lint/typecheck` green; **236 API tests** (+2: focus-weighted score math = 39 for a
dsa-heavy company; weakest area = the hardest-drilled one; story-gap role-track fallback to the linked
company). **Live**: the Meta job (focus dsa:5/system_design:4/behavioral:3) now returns a company-weighted
verdict whose weakest areas are exactly Meta's three focus areas, ordered by Meta's emphasis (score 10,
penalty 15 from the bombed system_design round).

**Next:** MOM-123 (company detail + catalog pages), MOM-124 (sponsorship filter), MOM-125 (targeting
shortlist) — the rest of Wave 1.

## 2026-07-10 - MOM-122: JobApplication.companyId FK + name-match backfill + link UI (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. The plan's **single highest-risk change**
(busiest table + seed). Additive migration `20260709190839_job_company_fk` under D-004.

**Schema/migration (additive; rollback = drop column+index+FK):** `job_applications` gains
`company_id UUID` + FK to `companies` (**`onDelete SetNull`** — pipeline survives catalog deletion) +
`@@index`. Free-text `company` KEPT untouched. Generated with `--create-only` (verified NOT auto-applied
via `migrate status`), then the **backfill UPDATE** was added to the SQL before applying (so the checksum
covers final content — no hand-edit-after-apply): exact case-insensitive match `lower(trim(company)) =
lower(trim(name))` against catalog names that are unique (`HAVING count(*)=1`, since `Company.name` has no
unique constraint). Idempotent (fills only NULLs).

**Service/DTO/shared:** Create/UpdateJobDto gain optional `companyId` (`@IsUUID`, null unlinks);
`jobs.service` validates the company exists (`ensureCompanyExists` → 400 on unknown), keeps writing the
free-text `company`, includes a slim `companyRef` (id/name/region/sponsorshipStatus/focusAreas) in
`jobInclude`, and serializes `companyId` + `companyRef` (`JobCompanyRef` in shared) — malformed focusAreas
Json coerced to `{}`. `updateData` switched to `UncheckedUpdateManyInput` to carry the scalar FK.

**Web:** job list "Add Job" form gains a `<datalist>` of catalog names — typing an exact (ci) match links
the company (green "links to the catalog" hint); job detail gains a **Company** card showing the linked
company + sponsorship and a "Link/Unlink" select for fixing non-matches. `companiesApi` return types
upgraded to `CompanyResponse` + a `get(id)`.

**Checks:** `pnpm -r lint/typecheck` green (API + web); **234 API tests** (+3: create validates+stores
companyId & serializes companyRef; unknown companyId → 400; update passes companyId/null through). Migration
is pure ADD COLUMN + idempotent NULL-only backfill, so fresh-DB behavior is a strict subset of the verified
existing-DB path. **Live** on :3001: backfill linked 6/7 demo jobs (Datadog, out-of-catalog, stays null);
Meta job returns `companyRef {sponsorship: sponsored, focusAreas {dsa:5,…}}`; created a Stripe-linked job,
unlinked it (companyRef→null, free-text "Stripe" kept), bad companyId → 400.

**Next:** wire `career.service.getJobReadiness`/`getJobStoryGaps` to weight by `companyRef.focusAreas`/
`roleTrackIds` when linked (deferred from this PR to keep the risky migration focused) — then company detail
page (MOM-123), sponsorship filter (MOM-124), targeting shortlist (MOM-125).

## 2026-07-10 - MOM-121: structured Company columns + seed enrichment (CLAUDE, additive migration)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. Additive migration under D-004 (standing
blanket approval). Migration `20260709185922_company_intelligence`.

**Schema (additive, rollback = drop 5 columns):** `companies` gains `focus_areas JSONB DEFAULT '{}'`
(map `{[CareerRoleAreaId]: 1–5}`), `role_track_ids JSONB DEFAULT '[]'`, `interview_process JSONB DEFAULT '[]'`,
`sponsorship_status TEXT` (a VISA_TAGS value; null = no data), `comp_band TEXT`. Pure `ADD COLUMN` — no
data step in the SQL. Json (not relation tables) per D-017: the taxonomies are TS-owned and the query is
always per-row.

**Seed enrichment:** the 20 packs' focus/track prose (previously only in `notes`) is hand-mapped into the
structured columns in `seed-data.ts` (tuples → objects; e.g. Meta → `focusAreas {dsa:5, system_design:4,
behavioral:3}`, `roleTrackIds ['big-tech-swe','fullstack-swe']`, `sponsorshipStatus 'sponsored'`). `notes`
kept verbatim as fallback. All sponsored except ByteDance (`unknown`). `seed.ts` upserts by fixed UUID so
existing DBs enrich on re-seed; the question-company index reference switched from `companies[i][0]` to
`companies[i].id`.

**Service/DTO/shared:** `CompaniesService` now serializes rows to a typed `CompanyResponse` (new shared
interface + `CompanyFocusAreas`/`CompanyInterviewStage`) and coerces malformed Json to safe empties; a new
`get(id)` + `GET /companies/:id` route (for MOM-123). DTOs validate the Json shapes at the boundary via a
new custom validator (`IsFocusAreas`/`IsRoleTrackIds`/`IsInterviewProcess` — keys ∈ `CAREER_ROLE_AREA_IDS`,
weights 1–5, tracks ∈ `CAREER_ROLE_TRACK_IDS`, roundType ∈ `INTERVIEW_ROUND_TYPES`) + `@IsIn(VISA_TAGS)`.
`toData` writes only the keys a PATCH provided (a notes-only update never clobbers focusAreas).

**Checks:** `pnpm -r lint/typecheck` green; **231 API tests** (+8: serialization, malformed-Json coercion,
partial-update, NotFound; DTO validation accept/reject for bad area key/weight/track/visa/roundType). Fixed
one pre-existing content-service company test mock (serializer now needs timestamps). **Live** on :3001:
`GET /companies` returns 20 enriched companies; `GET /companies/:id` (Meta) returns `focusAreas {dsa:5,…}`,
tracks, `sponsorshipStatus 'sponsored'`.

**Next:** MOM-122 — the `JobApplication.companyId` FK + name-match backfill + link UI (migration 2, the
highest-risk change), then downstream company detail/filter/shortlist (MOM-123/124/125).

## 2026-07-10 - MOM-120: DESIGN — company-as-FK + structured intelligence (CLAUDE, docs only)

**Actor:** CLAUDE (planner). Branch `feat/careeros-phase-0`. **Docs only, no migration run** — the design
gate for Phase 1D, the plan's highest-risk change (job↔company FK on the busiest table + 20 seed packs).

**SPIKE-012 (read-only, live dev DB):** of 7 job applications, **6 backfill** by exact case-insensitive
match to a unique catalog `Company.name`; the 1 miss ("Datadog") is out-of-catalog and correctly stays
null. Zero duplicate company names, but users can create dupes via `POST /companies` → backfill guards
with `HAVING count(*)=1`. Fuzzy matching rejected (a wrong link is worse than no link).

**Design (ADR-0010 → ACCEPTED, D-017):** two additive migrations. **MOM-121** adds structured `Company`
columns as **Json** (`focusAreas {area:1–5}`, `roleTrackIds`, `interviewProcess`) + scalar
`sponsorshipStatus` (VISA_TAGS value, null=no data) + free-text `compBand`, and hand-maps the 20 packs'
existing `notes` prose into them. **MOM-122** adds nullable `companyId` FK (`companyRef`, `onDelete:SetNull`)
keeping the free-text `company` column, with a name-match backfill in the migration SQL. Json (not a
relation table) matches the Question tag convention since the area taxonomy is TS-owned and queries are
per-row; DTO validates `focusAreas` keys against `CAREER_ROLE_AREA_IDS`.

**Files:** `docs/adr/0010-company-as-fk-structured-intelligence.md` (PROPOSED→ACCEPTED, full design),
`docs/agent/DECISIONS.MD` (D-017), BACKLOG/NEXT/LOG.

**Next:** MOM-121 — implement the structured Company columns + seed enrichment (additive migration 1).

## 2026-07-09 - MOM-131: story coverage → target-scoped behavioral gap map (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema.** Closes the last Gate-1 spine
item: a specific interview now gets a concrete behavioral **gap map** ("you have ownership but no ambiguity
story for Meta") instead of a generic "practice behavioral".

**Logic (`CareerService.getJobStoryGaps`, `GET /career/jobs/:jobId/story-gaps`):** the target role's
**expected** behavioral competencies = the concrete `STORY_COMPETENCIES` ids named in that track's
`behavioral`-area checklist keywords (big-tech-swe → ownership/conflict/ambiguity/failure), falling back to
the universal ownership/conflict/ambiguity/failure set when a track names none (e.g. infra's
incident/postmortem keywords aren't competency ids). Coverage = the user's `Story.competencyTags` matched
case-insensitively; each competency reports `covered` + `storyCount`, plus `coveredCount`/`missingCount`/
`totalStories`. Role-scoped now; company-specific weighting enriches when the structured Company FK (MOM-121)
lands.

**Web:** `StoryGapCard` (new) renders under `JobReadinessCard` on the job page — covered vs missing
competency chips, a plain-language "N of M covered, missing X, Y" line, and a "write a story for the gaps"
link (empty-bank state points to `/stories`). `careerApi.jobStoryGaps` added.

**Checks:** `pnpm -r lint/typecheck` green; **223 API tests** (+3: covered/missing with case-insensitive
tags + declaration-order competencies; all-missing on an empty bank; not-owned throws) + 25 web tests.
**Live** on :3001: Meta job (defaults big-tech-swe) → 4 competencies, `ownership` covered (1 story),
conflict/failure/ambiguity missing. **★ CareerOS Gate 1 spine (outcome→prep→verdict→gap) is complete.**

**Next:** Phase 1D — company-FK migration (MOM-120→121→122), the highest-risk migration (busiest table +
seed); SPIKE-012 + DESIGN-doc PR before the implementer PR, keeping the free-text `company` fallback.

## 2026-07-09 - MOM-146: Readwise highlight → FSRS spaced-repetition review — the read→retain loop (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema.** Net-new task (not in the
CareerOS plan) taken on the owner's explicit ask to "really think hard about how the Readwise features can
be improved to truly help the learner."

**The diagnosis.** The Readwise feature *captured* highlights (sync) and let you *tag* them (role/area), then
a reviewed highlight was filed into a write-only `LearningEvidence` ledger — and never seen again. But the
learner highlighted it *because they want to remember it*, and Momito's entire edge over plain Readwise is
**FSRS spaced repetition tied to a concrete target**. The highlight dead-ended exactly one step before the
app's core value: nothing made you *retain* it. Meanwhile the review engine (`ReviewState`) is already
polymorphic (`objectType/objectId`, ADR-0002) — highlights just weren't wired to it.

**The fix — highlights that stick.** A reviewed highlight now enters the same FSRS queue as questions and
stories. `REVIEWABLE_OBJECT_TYPES` gains `'highlight'` (a string-union add — `ReviewState.objectType` is a
plain `String` column and `objectId` is `@db.Uuid`, matching `LearningHighlight.id`, so **zero migration**).
- `reviews.service`: `'highlight'` supported; ownership-checked like Story (per-user private, ADR-0003);
  `listDue` titles a due highlight by its **source** ("you highlighted something in *Atomic Habits* — what
  was it?"), the text being the reveal.
- `learning.service.updateHighlight`: reviewing a highlight as anything but "ignored" seeds a `ReviewState`
  via `reviews.record(userId,'highlight',id,3)` (Good — you just read+understood it; FSRS picks the first
  interval). Best-effort (a scheduling hiccup can't fail the review). Ignored = filed to ledger only. Added
  `getHighlight` for the review card's reveal path (`GET /learning/highlights/:id`). A highlight deleted
  upstream in Readwise **suspends** its review state on the next sync so it stops resurfacing.
- Web: `TodayReviewCard` gains a highlight branch (cue → recall → reveal text+note → grade); inbox primary
  action relabeled **"Review" → "Remember"** with copy explaining it drops into the spaced-repetition queue.

**Checks:** `pnpm -r lint/typecheck` green; **220 API tests** (+11: highlight schedule/ownership/title-cue/
fallback in reviews; review-seeding on useful, not on ignored, not on retag, best-effort, getHighlight in
learning) + **25 web tests** (+1: highlight card cues by source, withholds text until reveal, grades
`('highlight','hl-1',3)`). **Live** on :3001 (seeded a real highlight for the demo user): review "useful" →
200 → `ReviewState` created (`objectType:highlight`, reps 1); `GET /learning/highlights/:id` returns text;
backdated its due → appears in `/reviews/due` titled **"Atomic Habits"**, type `highlight`; marked deleted →
suspended → gone from due. Cleaned up the seeded rows.

**Next:** back to the CareerOS Phase-1 plan — **MOM-131** (story coverage → behavioral gap map, role-scoped),
then Phase 1D company-FK migration (MOM-120→121→122, highest-risk, DESIGN PR first).

## 2026-07-09 - MOM-141: auto-assembled round-scoped prep queue + interview countdown on Today (CLAUDE, no schema)

**Actor:** CLAUDE (implementer). Branch `feat/careeros-phase-0`. **No schema.** Two parts, both riding
existing infrastructure: (1) a daily cron that fires MOM-111's `generatePrep` for imminent rounds, and (2)
an interview **countdown** card injected into the existing `recommendations.service` Today brain.

**Part 1 — auto-assemble (`InterviewRoundsService.autoAssembleUpcomingPrep(withinDays=7)` + `InterviewPrepScheduler`):**
finds `pending` rounds scheduled within the window that have **zero** tasks (`_count.tasks === 0`) and fires
`generatePrep` for each, returning `{ roundsPrepared, tasksCreated }`. Rounds that already have a prep queue
are skipped (idempotent — safe to run daily). `InterviewPrepScheduler.tick()` runs `@Cron(EVERY_DAY_AT_6AM)`
and logs only when it prepared something. Registered in `InterviewRoundsModule` providers.

**Part 2 — countdown card (`recommendations.service.list`):** queries `interviewRound.findMany` for `pending`
rounds with `scheduledAt` in `[now, now+14d]`, top 3 by soonest, and emits a `type:'job'` card
*"Prep your \<company\> \<RoundType\> \<today|tomorrow|in N days\>"* linking to `/jobs/:id`. Priority
`101 + (14 − daysUntil)` (101–115) so it sits **above overdue tasks (100)** and scales with proximity — a
nearer round outranks a farther one. Reason speaks the urgency ("in 3 days — build your prep queue now").

**Checks:** `pnpm -r lint/typecheck` green; **209 API tests** (+4: countdown ranks/copies by proximity for
3-days and tomorrow; autoAssemble preps only task-less rounds and no-ops on an empty window). **Live** on
:3001: created a `coding` round 3 days out → Today's top card became *"Prep your Meta Coding in 3 days"*
(priority 112), above a pre-existing Behavioral round 6 days out (109) and overdue tasks (100). Recommendations-
only injection (no new UI component, like MOM-142) → no screenshot.

**Next:** MOM-131 — story coverage → interview behavioral gap map (role-scoped version doable now). Then
Phase 1D company-FK migration (MOM-120→121→122, highest-risk, DESIGN PR first).

## 2026-07-09 - MOM-112: per-round interview-date reminder automation (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Additive migration under the D-004 gate (blanket approval). Branch
`feat/careeros-phase-0`. A scheduled round now auto-lands a countdown reminder on Today/calendar —
reusing the existing `ensureDeadlineReminder` sentinel-upsert idea, keyed per round.

**Schema (additive migration `20260708202903_reminder_interview_round`, rollback = drop):** `reminders`
gains a nullable `interview_round_id` UUID + index + FK to `interview_rounds` (`ON DELETE CASCADE` — a
deleted round takes its reminder with it). Back-relation `reminders Reminder[]` on `InterviewRound`.

**Logic (`InterviewRoundsService.ensureRoundReminder`):** idempotent upsert of one `type:'interview_round'`
reminder per round, found by `interviewRoundId`, due **09:00 UTC the day before** the round's `scheduledAt`,
titled *"Prep for your \<company\> \<RoundType\> on \<date\>"*. Called from `create()` (always) and from
`update()` when `scheduledAt` or `roundType` changed. No `scheduledAt` → no reminder, and any stale one is
deleted (so clearing the date cleans up). Surfaces through the existing reminders UI (job detail, Today,
calendar) with **no web change**.

**Checks:** `pnpm -r lint/typecheck/test` green — **205 API tests** (+3: scheduled create makes a reminder
due the day before; a dateless round makes none; clearing the date deletes the stale reminder). **Live**:
creating an onsite scheduled 2026-08-15 produced reminder *"Prep for your Meta Onsite on 2026-08-15"* due
2026-08-14; PATCH `scheduledAt:null` removed it; deleting the round cleaned up. Migration applied to the
running DB; client regenerated after killing the API node process (Windows DLL lock).

**Next:** MOM-141 — auto-assemble the round-scoped prep queue on an approaching date (fire MOM-111's
`generatePrep` for imminent rounds) + surface the interview countdown on Today (recommendations). Deps
111 ✓ / 128 ✓ / 131 (story gap — role-scoped version doable now).

## 2026-07-09 - MOM-111: round-scoped prep task generation + Task.interviewRoundId (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Additive migration under the D-004 gate (blanket approval). Branch
`feat/careeros-phase-0`. Delivers SPIKE-010's planned Task↔round back-ref and the round-typed prep it
enables — the input MOM-141 (auto prep queue) will fire on an approaching date.

**Schema (additive migration `20260708202012_task_interview_round`, rollback = drop):** `tasks` gains a
nullable `interview_round_id` UUID + index + FK to `interview_rounds` (`ON DELETE SET NULL` — deleting a
round detaches its tasks, doesn't delete them). Back-relation `tasks Task[]` on `InterviewRound`. No
backfill; purely additive on the busy `tasks` table.

**Round-typed prep (`InterviewRoundsService.generatePrep(jobId, roundId, userId)`, route `POST
/jobs/:jobId/rounds/:roundId/prep`):** a new `ROUND_TYPE_FOCUS` map says which competency areas each round
type tests (system_design → `[system_design]`, onsite → `[dsa, system_design, behavioral]`,
recruiter_screen → `[behavioral, profile]`, …). Prep pulls the role-track checklist filtered to those
areas (falls back to the full list if the filter is empty — never dead-ends), caps at 5, and creates
`Task`s back-referenced to the round (`interviewRoundId`), staggered to come due *before* the round's
`scheduledAt` (or the job deadline, or a week out). Reuses the existing `generatePrep` checklist→Task
pattern.

**Web:** `interviewRoundsApi.generatePrep` + a per-round **Prep** button in `InterviewRoundsCard` with a
confirmation toast ("Added N prep tasks — see the calendar.").

**Checks:** `pnpm -r lint/typecheck/test` green (api + web + shared) — **202 API tests** (+2: system_design
round creates system_design-scoped tasks back-referenced + due before the round; not-found round throws).
**Live**: `POST /jobs/<Meta>/rounds/<system_design>/prep` → `{created:1}`; a direct DB read confirms the
task carries `interviewRoundId`, `area=system_design`, due 2026-07-05 (one day before the 07-06 round).
Migration applied to the running DB; client regenerated after killing the API node process (Windows DLL
lock).

**Next:** MOM-112 (interview-date reminder automation — reuse `ensureDeadlineReminder`'s sentinel upsert,
keyed per round), then MOM-141 (auto-assemble the round-scoped prep queue + surface the countdown on Today).

## 2026-07-09 - MOM-130: "am I ready for <company>?" job readiness verdict (CLAUDE)

**Actor:** CLAUDE (implementer). No schema change. Branch `feat/careeros-phase-0`. The Gate-1 verdict:
a single go/no-go for one application that a bombed round visibly lowers.

**`career.getJobReadiness(jobId, userId)`** (route `GET /career/jobs/:jobId/readiness`) composes the two
loop halves: the target's **grounded role readiness** (MOM-129 `getReadiness` for the job's `roleTrackId`,
default `big-tech-swe`) minus a **penalty** from that job's **open weakness signals** (MOM-113 debrief
output, fetched via the new `weaknesses.listOpenSignals(userId, jobId)`, decayed). `penalty =
min(30, Σ severity·5)`; `score = clamp(overall − penalty, 0, 100)`; status `ready ≥75 / almost ≥50 /
not_ready`. Returns the 3 weakest grounded areas + the blocking signals. Company focus-area weighting is
derived from the role-track checklist for now; when the structured-`Company` migration (MOM-121) lands it
can weight by real company focus — additive.

**Shared:** `JOB_READINESS_STATUSES`, `JobReadinessResponse` (+ `JobReadinessWeakArea`). **Weaknesses:**
`openSignals` → public `listOpenSignals(userId, jobApplicationId?)`. **Web:** `careerApi.jobReadiness` +
a new `JobReadinessCard` at the top of the job detail aside — the score, status, `−penalty` explainer,
weakest-area bars, and the flagged-in-interviews chips.

**Checks:** `pnpm -r lint/typecheck/test` green (api + web + shared) — **200 API tests** (+3: penalty
docking, penalty cap + non-negative clamp, ownership 404). **Live**: `GET /career/jobs/<Meta>/readiness`
returns **score 2/100, not_ready, penalty 15** with `blockingSignals` = `[concept_gap, time_pressure,
system_design]` and weakest areas `projects/lld_oop/behavioral` — the bombed system-design round
demonstrably drags the Meta verdict down. Playwright screenshot shows the Interview Readiness card on the
job page.

**★ CareerOS Gate 1 loop is complete:** save a losing debrief → a target-scoped weakness is stored →
it appears on Today (MOM-142), leads the next `job_prep` (MOM-128), and lowers the FSRS-grounded
"am I ready for Meta?" verdict (MOM-129/130). Bombing a round provably reshapes prep *and* the go/no-go.
(Remaining Gate-1 polish: auto prep-queue countdown MOM-141, and the deferred structured-company context
MOM-120→122.)

**Next:** MOM-111 (round-scoped prep generation) + MOM-112 (interview-date reminders) — small, READY,
unblock MOM-141 (auto-assembled prep queue on an approaching date).

## 2026-07-09 - MOM-129: one FSRS-grounded readiness engine (consolidates the two) (CLAUDE)

**Actor:** CLAUDE (implementer). The plan's *large* task and its riskiest non-migration change — it
touches the two most-used services. No schema change; response shapes preserved (two additive fields).
Branch `feat/careeros-phase-0`. Implements ADR-0011 / D-013 ("single engine; supersedes the dual
readiness engines").

**Problem:** readiness was computed two divergent ways over the same checklist — `career.service`
(binary keyword *coverage*) and `missions.service.diagnose` (count-based *level 0–3*) — with **two
different `isPositiveAttempt` definitions**, so identical history produced different numbers. Neither
used FSRS; readiness never decayed and was gameable by keyword presence.

**New `ReadinessService` (`readiness` module)** is the single engine:
- `isPositiveAttempt()` — the one canonical rule (union of the old two: `rubricScore≥0.6 ||
  aiScore≥0.6 || selfRating≥3 || correctness∈{correct,strong}`; 'partial' excluded).
- `areaMastery(userId)` → per-area `{ retrievability, reviewedCount, gradedAttempts, positiveAttempts,
  score }`. Retention half = average **FSRS retrievability** (via `ts-fsrs` `get_retrievability`) over
  the user's question `ReviewState`s, mapped to areas by `Question.areaTags` — the bounded in-memory
  join ADR-0011 Q2 specced, no `ReviewState` denormalization. Performance half = graded attempts grouped
  by the MOM-128 `area` tag. `score = 0.6·retention + 0.4·min(1, positives/5)`; a New/zero-stability card
  contributes no retrievability signal.

**Consumers routed through it:** `career.service` injects it, drops its private `isPositiveAttempt`, and
in `getReadiness` blends each area's keyword coverage 50/50 with `masteryScore` **when the area has
review/attempt history** (else coverage-only, so profile/project areas aren't zeroed). Adds
`masteryScore`/`retrievability` to `RoleAreaReadiness`; `overallPercentage` is now the weight-weighted
mean of grounded area percentages. **`gapItems`/`topGaps`/`completedItems` logic is unchanged**, so the
recommendations that depend on them (MOM-142) are unaffected. `missions.service` injects it and replaces
its duplicated positive-attempt expression with the shared rule (missions stays frozen otherwise — D-015).

**Scoring formula note:** the 0.6/0.4 retention/volume split and the 50/50 coverage/mastery blend are
implementation choices under the ADR-0011 decision (single FSRS-grounded engine); recorded here rather
than a new ADR since the architectural decision was already ACCEPTED in ADR-0011.

**Checks:** `pnpm -r lint/typecheck/test` green (API + web + shared) — **197 API tests** (+7: readiness
`isPositiveAttempt` matrix, `areaMastery` grounding/partial-credit/New-card-skip; career grounding blend +
no-history fallback). **Live**: `GET /career/readiness` shows `dsa` and `language_runtime` (which have
review history) carrying real retrievability (0.955, 0.947) and blended percentages, while
`domain_knowledge`/`projects` (no history) stay coverage-only with `masteryScore: null`; `topGaps`
unchanged. `GET /dashboard/summary` (200) returns the same grounded areas incl. `masteryScore`. A mission
`diagnose` (200) still computes competency levels through the shared rule. No regression.

**Next:** MOM-130 — company-scoped readiness rollup ("am I ready for Meta?" go/no-go), reusing
`areaMastery` weighted by the target's focus areas + open weakness signals.

## 2026-07-09 - MOM-142: open WeaknessSignals as ranked Today items — Gate 1 loop visible (CLAUDE)

**Actor:** CLAUDE (implementer). No schema change. Branch `feat/careeros-phase-0`. The last Gate-1 wire:
the debrief-emitted weaknesses now **appear on Today** with a repair action, so the loop is visible to
the user, not just present in the database.

**Change (`recommendations.service.list`):** the service already fetched `weaknesses.summary()`, which
since MOM-127 carries `openSignals` — but only the *derived* struggle patterns/topics/reasons were
surfaced; the *stored* interview-grounded signals were dropped. Now the top 3 open signals (by decayed
severity) become first-class `type:'practice'` cards titled `Repair: {label}` (the label already carries
area + company, e.g. *"System design — weak at Meta"*), with a provenance-aware reason ("An interview
debrief flagged this weakness."). Area signals link to a `weak_area_review` filtered to that area; others
to a generic repair. Priority `94 + clamp(round(severity),1,5)` = **95–99**, i.e. at/above derived
weakness (95), below overdue tasks (100) and missions (110). The surfaced signal keys are recorded and
the derived weakness/reason paths skip them, so a stored signal never double-counts with its derived echo.

**Checks:** `pnpm --filter @momito/api lint/typecheck/test` green — **190 API tests** (+3: a debrief area
signal becomes a ranked repair card with the right href/priority/reason; a severe recurring signal caps at
99 and names its count; a stored reason signal suppresses the derived reason card). **Live**: `GET
/practice/recommendations` for the demo user returns the three Meta debrief signals
(`signal:area:system_design:…`, `signal:reason:time_pressure:…`, `signal:reason:concept_gap:…`) at
priority 95, above the NVIDIA apply card. **Playwright** screenshot of `/today` shows all three "Repair:
… at Meta" cards rendered in the priority queue.

**★ CareerOS Gate 1 core behavior is now demonstrable end-to-end:** save a losing debrief on an interview
round (MOM-110/113) → a target-scoped `WeaknessSignal` is stored (MOM-127) → it appears on Today as a
ranked repair card (MOM-142) **and** the next `job_prep` session for that job leads with that weak area
(MOM-128). Bombing a round provably reshapes tomorrow's prep. Remaining for the full gate: the FSRS-
grounded "am I ready for Meta?" verdict (MOM-129 → 130).

**Next:** MOM-129 — consolidate `career.service` + `missions.service` readiness into one FSRS-grounded
helper (missions-frozen consolidation), grounding per-area readiness in retrievability + graded attempts
(now tagged by area via MOM-128).

## 2026-07-09 - MOM-128: tag attempts with target dimension + the job_prep session branch (CLAUDE)

**Actor:** CLAUDE (implementer). No schema change (the `AnswerAttempt.roleTrackId`/`area` columns
landed in MOM-127). Branch `feat/careeros-phase-0`. Two loop wires: study signals now carry the target
dimension the readiness rollup (MOM-129/130) needs, and a target-scoped mock session type exists.

**Part 1 — tag attempts on create (`sessions.service.answer()`):** every graded attempt is now
attributed — `area` from the *question actually practiced* (its first `areaTags` entry that is a known
`CAREER_ROLE_AREA_ID`, falling back to the session's `area`), `roleTrackId` from the session's declared
target. Both stay `null` for untargeted global practice, which is correct — a random quick-practice
attempt isn't attributable to a specific target. The question's `areaTags` are read via the existing
session lookup (added to the `sessionQuestions` select), so no extra query.

**Part 2 — the `job_prep` session branch (`selectJobPrepQuestions`):** `job_prep` was in `SESSION_TYPES`
but silently fell through to a plain filtered draw. It now assembles *this application's* mock: candidates
are the target company's linked question bank (company matched by name until the MOM-122 FK lands) and,
leading the set, questions in the target's **exposed weak areas** — the open `WeaknessSignal`s scoped to
that `jobApplicationId`, i.e. what the MOM-113 debrief edge recorded. Weak-area questions sort first, so a
bombed round demonstrably reshapes the next prep set. Degrades to the job's role-track filtered draw, then
a plain draw (never dead-ends).

**Checks:** `pnpm --filter @momito/api lint/typecheck/test` green — **187 API tests** (+5: job_prep
weak-area-first from the company bank, role-track filtering when the company isn't catalogued, no-job
degradation; attempt tagging from session+question, and the untargeted-null fallback). **Live round-trip**:
a `job_prep` session scoped to the Meta job (whose only open weakness is `system_design`, from MOM-113's
bombed round) returned **4 questions, all `system_design`, from Meta's bank** — the debrief visibly
reshaped the prep set. Answering one produced an attempt tagged `area=system_design` (roleTrackId null —
Meta has no role track); a `role_drill` attempt scoped to `big-tech-swe` was tagged
`roleTrackId=big-tech-swe`, `area=dsa`.

**Loop status:** OUTCOME → PREP now closes end-to-end through study sessions too (not just the signal
store): bomb a round → its area becomes an open signal → the next `job_prep` for that target leads with
that area. Remaining Gate-1 wires: surface signals on Today (MOM-142), one grounded readiness engine +
"am I ready for Meta?" verdict (MOM-129/130).

**Next:** MOM-142 (register open weakness signals + pipeline stalls as first-class ranked
`recommendations` items on Today), then MOM-129 (consolidate the two readiness engines into one
FSRS-grounded helper) → MOM-130 (company-scoped readiness verdict).

## 2026-07-09 - MOM-113: debrief → WeaknessSignal + LearningEvidence — THE LOOP-CLOSING EDGE (CLAUDE)

**Actor:** CLAUDE (implementer). The single most important PR of Phase 1: the edge that makes an
interview OUTCOME reshape future PREP. No schema change (uses the MOM-127 `weakness_signals` store +
the existing `learning_evidence` ledger). Branch `feat/careeros-phase-0`. **CareerOS Gate 1 core
behavior now demonstrably works.**

**The edge:** `InterviewRoundsService.update()` now, *after* the write and *only* when the update
carried debrief content (`dto.debrief`/`areasWeak`/`missTags` defined — i.e. the "Save debrief"
action, not a bare outcome-toggle), calls a new private `emitDebriefSignals(round, userId)`:
- For each `areasWeak` entry → `weaknesses.recordSignal({signalType:'area', key:area, source:'debrief',
  area, jobApplicationId})` labelled e.g. *"System design — weak at Meta"*.
- For each valid `missTags` entry → a `signalType:'reason'` signal labelled e.g. *"Ran out of time —
  System design at Meta"*.
- Writes/updates one `LearningEvidence` row of type `interview_debrief` per round — the OUTCOME record
  **and** the idempotency ledger.

**Idempotency (the subtle part):** the weakness store *accrues* severity per event, so naive
re-emission on every save would inflate a weakness every time the user edits a typo. Each round keeps
exactly one `interview_debrief` evidence row whose `metadata.emittedKeys` records which signal keys it
has already fired; on re-save only *new* keys emit. This makes a round's contribution idempotent while
still letting two *different* rounds on the same job both accrue onto the shared job-scoped signal
(correct cross-round behavior). Removing an area does not retract its earlier signal — read-time decay
(21-day half-life, MOM-127) handles that. Emission is best-effort (wrapped; a failure logs a warning
and never fails the user's debrief save). Wired via `WeaknessesModule` import into
`InterviewRoundsModule` (no circular dep — Weaknesses depends only on Prisma).

**Checks:** `pnpm --filter @momito/api lint/typecheck/test` green — **182 API tests** (+3 new edge specs:
fresh emit fires area+reason signals and writes the ledger; identical re-save emits nothing and updates
the ledger; a re-save that adds an area emits only the delta). **Live round-trip** against local Postgres
on the Meta demo job (re-saving its bombed system_design round, which pre-dated the edge): baseline 0
open signals → PATCH #1 → 3 open signals (`area:system_design` + `reason:time_pressure` +
`reason:concept_gap`, all `src=debrief`, scoped to the Meta job, sev 1.00/occ 1) → PATCH #2 identical →
still 3, severities/occurrences unchanged (idempotent) → PATCH #3 adding `behavioral` → 4 (only the delta
fired) → `GET /learning/ledger` shows exactly **one** `interview_debrief` row despite 3 PATCHes. Test-only
`behavioral` reverted + its signal resolved; demo left in an accurate 3-signal state.

**Loop status:** bombing a round now provably lands a target-scoped weakness that the weakness engine
holds and decays. Surfacing these on Today (MOM-142) and letting them drive weakness-repair /
company-scoped readiness (MOM-129/130) are the remaining Gate-1 wires.

**Next:** MOM-128 (tag `AnswerAttempt.roleTrackId/area` on create + the missing `job_prep` session
branch), then MOM-142 (rank openSignals on Today), then MOM-129 (one FSRS-grounded readiness engine).

## 2026-07-09 - MOM-110: InterviewRound model + CRUD + job-detail timeline UI (CLAUDE, migration)

**Actor:** CLAUDE (implementer). Third PR of Phase 1, implementing the ADR-0013 design under the
D-004 human-approval gate (standing blanket approval for Phase 1 migrations). Branch
`feat/careeros-phase-0`. This lands the **OUTCOME source** the loop needs: a first-class interview
round with a debrief that carries `areasWeak`/`missTags` — the raw material MOM-113 will convert
into `WeaknessSignal`s.

**Schema (additive migration `20260708173028_interview_rounds`):** new `interview_rounds` table only —
no ALTER on existing tables, so rollback = drop. Columns: `roundType`, `sequence`, `scheduledAt?`,
`durationMinutes?`, `interviewer?`, `outcome` (default `pending`), `debrief?`, `areasWeak text[]`,
`missTags text[]`, timestamps. FKs to `User` and `JobApplication` (both `onDelete: Cascade`); indexed
on `userId`, `jobApplicationId`, `scheduledAt`. Per ADR-0013/SPIKE-010 the round owns no prep/practice
rows — Task/Session will back-ref it via a nullable `interviewRoundId` in MOM-111/141 (no dual-write).

**API:** new `interview-rounds` module — `InterviewRoundsService` (`listForJob`/`create`/`update`/
`remove`, all ownership-scoped through a private `ensureJob` findFirst; `update`/`remove` via
`updateMany`/`deleteMany` on `{id, jobApplicationId, userId}` → `NotFoundException` on count 0). Nested
controller `jobs/:jobId/rounds` with `ParseUUIDPipe`. DTOs validate `roundType`/`outcome` against the
shared enums, `areasWeak` against `CAREER_ROLE_AREA_IDS`, `missTags` against `MISS_TAG_REASONS`. A
comment marks where MOM-113 hooks the debrief→`WeaknessSignal` edge in `update()`.

**Shared:** `INTERVIEW_ROUND_TYPES` (+labels), `INTERVIEW_ROUND_OUTCOMES`, `InterviewRoundResponse`,
`Create/UpdateInterviewRoundRequest`.

**Web:** `interviewRoundsApi` client + new `InterviewRoundsCard` on the job detail page (between JD
Notes and Timeline): add-round form (type/date/interviewer), per-round inline outcome `<select>` with a
color-coded badge, and a `DebriefEditor` (free-text + area chips + miss-tag chips → single PATCH).

**Checks:** `pnpm -r lint/typecheck/test` green — **179 API tests** (+8 new interview-rounds specs) +
24 web. Live CRUD round-trip against local Postgres on the Meta demo job: create → PATCH debrief
(outcome `failed`, areasWeak `[system_design]`, missTags `[time_pressure, concept_gap]`) → list → delete
→ empty, all correct. Playwright screenshot confirms the card renders both a failed round (badge +
debrief + chips) and an upcoming pending round. Migration applied to the running DB; client regenerated
after killing the `nest start` node process to avoid the Windows Prisma DLL lock.

**Next:** MOM-113 (debrief → `recordSignal` + `LearningEvidence` — the loop-closing edge), then MOM-128
(tag attempts + `job_prep` branch), MOM-129 (grounded readiness).

## 2026-07-09 - MOM-109 DESIGN + SPIKE-010 resolved: InterviewRound + the outcome→weakness edge (CLAUDE)

**Actor:** CLAUDE (planner — design only, no migration). Second design PR of Phase 1. Produces
**ADR-0013** (new) + **D-016**; the model lands in MOM-110 under D-004. Branch `feat/careeros-phase-0`.

**Grounding:** an interview can currently only be a free-form `JobEvent` note — no roundType, date,
outcome, or debrief — so outcomes feed nothing. MOM-127 just landed the `WeaknessSignal` store
(`recordSignal`) the debrief needs; the missing piece is the first-class interview object.

**SPIKE-010 resolved (ADR-0013):**
1. *No dual-write.* `InterviewRound` owns no prep/practice rows — a round's prep is an ordinary `Task`,
   its mock an ordinary `InterviewSession`, each attributed by a single nullable `interviewRoundId`
   back-reference FK **added when needed** (MOM-111 / MOM-141), never a copy. Avoids the PlanItem/Task
   anti-pattern that motivated the missions freeze (D-015).
2. *Reminder idempotency* keys the `ensureDeadlineReminder` sentinel **per round** (a job has many
   rounds), so each round's `scheduledAt` gets its own reminder (MOM-112).
3. *`JobEvent` coexists* — no backfill; the upgraded timeline (MOM-110) merges structured rounds with
   free-form events chronologically.
4. *Round outcome ⟂ pipeline status* — no coupled state machines in MOM-110.

**Finalized schema (for MOM-110):** `interview_rounds` table (roundType, sequence, scheduledAt,
durationMinutes, interviewer, outcome, debrief, areasWeak[], missTags[]) off `JobApplication` (cascade)
+ `User`; shared `INTERVIEW_ROUND_TYPES` / `INTERVIEW_ROUND_OUTCOMES`; `areasWeak`/`missTags` reuse
`CAREER_ROLE_AREA_IDS` / `MISS_TAG_REASONS`. Migration is additive; rollback = drop. The debrief→weakness
edge itself is MOM-113 (calls MOM-127's `recordSignal` + emits `LearningEvidence`).

**Files:** `docs/adr/0013-interview-rounds-debriefs.md` (new), `docs/agent/DECISIONS.MD` (D-016),
`BACKLOG.md` (SPIKE-010 RESOLVED, MOM-109 DESIGN DONE, MOM-110 READY), `NEXT.MD`. No app code, no schema,
no migrate. **Next:** MOM-110 implementer PR (the additive migration + CRUD + timeline UI).

## 2026-07-09 - MOM-127: WeaknessSignal store + mixed_interview session type (CLAUDE, migration)

**Actor:** CLAUDE (implementer). **Migration** — crossed the D-004 gate under the owner's standing
blanket approval; owner said "Yes" to proceeding this turn. Branch `feat/careeros-phase-0`.

**What shipped (the store that lets interview outcomes become weaknesses):**
- **Additive migration** `20260708170956_weakness_signals`: new `weakness_signals` table + nullable
  `role_track_id`/`area` on `answer_attempts` + 5 indexes + 2 FKs. Verified purely additive (no ALTER
  of existing data, no backfill); rollback = drop. Applied cleanly on the existing dev DB; Prisma
  client regenerated (killed the API node processes first to dodge the Windows engine-DLL EPERM lock).
- **`weaknesses.service` store:** `recordSignal` (service-to-service upsert-by-find — accrues
  occurrences +1 and raw severity +1 capped at 10 onto a live signal for the same target+key, else
  creates; a resolved/dismissed match stays closed and a recurrence opens a fresh row), `resolveSignal`
  / `dismissSignal` (ownership-checked lifecycle), and `openSignals` — merged into `summary()` as the
  new additive `openSignals` field. **Severity decays at read time** (`severity·2^(-ageDays/21)`),
  dropping below a 0.15 floor — no cron. The derived practice-struggle path is untouched (SPIKE-013
  Q1: store only what can't be re-derived).
- **`POST /weaknesses/signals/:id/resolve|dismiss`** endpoints; web `weaknessesApi.resolveSignal/
  dismissSignal`.
- **`mixed_interview` session type** (SESSION_TYPES + `sessions.service` dispatch): interleaves
  recently-struggled questions with a fresh cross-area draw, degrading to a filtered draw with no
  history. Reconciliation recorded in ADR-0011 §3: `weak_area_review` already **is** "weakness_repair",
  so no duplicate type was added — it now also repairs debrief-derived weaknesses via the merged summary.

**Verification:** 171 API tests green (+10: 3 openSignals decay/sort, 3 recordSignal upsert/accrual/cap,
2 resolve/dismiss, 2 mixed_interview). API + web typecheck + lint clean; shared rebuilt. **Live
round-trip on local Postgres:** seeded a fresh (sev 3, debrief, linked to the NVIDIA job) and a
1-year-old signal → `GET /weaknesses` returned only the fresh one, decayed, with the stale one filtered
below the floor → `POST .../resolve` → re-GET showed `openSignals: []`. Also live-created a
`mixed_interview` session (4 questions). Test signals + temp scripts cleaned up.

**Boundary (honest):** the store is written by the debrief edge (MOM-113) and surfaced on Today by
recommendations (MOM-142) — both later PRs. MOM-127 delivers the foundation + the `weaknesses` API
surface + the summary field; the full "bomb a round → Today changes" demo lights up at MOM-113+142.
**Next:** MOM-109 DESIGN (InterviewRound), then MOM-113 (debrief → recordSignal, the loop-closing edge).

## 2026-07-08 - MOM-126 DESIGN + SPIKE-013 resolved: WeaknessSignal + FSRS-grounded readiness (CLAUDE)

**Actor:** CLAUDE (planner — design only, no migration run per D-004)
**Scope:** First PR of CareerOS Phase 1, loop-first ordering (owner decision 2026-07-08: close the
study↔target loop scoped to a `JobApplication` first, defer the highest-risk company-FK migration to
last). This is a **design-doc PR** — it finalizes ADR-0011 and resolves SPIKE-013; the migration and
service code are MOM-127 and await the D-004 human-approval gate.

**Grounding (read the real code first):** confirmed by direct read that readiness is computed by
**two divergent keyword-matching engines** — `career.service.getReadiness` (binary has-evidence,
weighted, never decays) and `missions.service.diagnose` (count-based `currentLevel` 0–3, persisted to
`MissionCompetencyState`) — producing different "am I ready" numbers for the same user. `AnswerAttempt`
carries `missTags`/`reflectionNote` but no `roleTrackId`/`area`, so nothing is target-scoped.
`weaknesses.service` derives signals on-demand with no table and is fed **only** by practice attempts —
interview outcomes feed nothing (the open loop). `ReviewState` holds the FSRS fields that a real
readiness engine should lean on, indexed `[userId, due]`.

**SPIKE-013 resolved (ADR-0011 §SPIKE-013 findings):**
1. *Keep the derived weakness path; add a table only for what can't be re-derived* — interview
   debriefs + manual signals + decay/repair-lifecycle/dismissal state. `summary()` merges derived ∪
   stored. Keeps MOM-127 small; preserves the working engine.
2. *FSRS-per-area is cheaply queryable without denormalizing `ReviewState`* — a user's review states
   are a single indexed scan; area resolves via an in-memory `objectId → Question.areaTags` map. Keeps
   `ReviewState` polymorphically pure (ADR-0002).
3. *Target tags go on `AnswerAttempt`* (`roleTrackId` + `area`), not `ReviewState` — a standalone
   attempt has no session to inherit from, and this also gives graded-attempt-per-area cheaply.
   `companyId` deferred (no `Company` FK yet); `WeaknessSignal.jobApplicationId` carries target scope
   until the MOM-122 FK lands — additive, no rework.

**Finalized schema (in ADR-0011, for MOM-127):** new `weakness_signals` table (signalType/key/label,
nullable roleTrackId/area/jobApplicationId, severity+occurrences with read-time exponential decay,
source, status lifecycle); `roleTrackId`/`area` nullable columns on `answer_attempts`. Migration is
**additive** (1 table + 2 nullable columns + indexes, no ALTER of data, no backfill); rollback = drop.

**Files:** `docs/adr/0011-*.md` (PROPOSED → ACCEPTED design), `docs/agent/BACKLOG.md` (SPIKE-013
RESOLVED, MOM-126 DESIGN DONE, MOM-127 READY, MOM-128 unblocked from MOM-122), `docs/agent/NEXT.MD`
(Phase 1 loop-first sub-phases; active task = MOM-127). No app code, no schema.prisma change, no
`prisma migrate` — that is MOM-127 under D-004.

**Next:** MOM-127 implementer PR (the additive migration + WeaknessSignal service + new session types),
then MOM-109 DESIGN (InterviewRound), then MOM-113 (debrief→WeaknessSignal — the loop-closing edge).

## 2026-07-08 - MOM-140-lite: stage-aware Today copy for pipeline items (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Final Phase 0 quick win (`docs/plans/MOMITO_CAREEROS_PLAN.md`, Track S). Schema-free,
API-only. Branch `feat/careeros-phase-0`.

**Change:** `recommendations.service.list()` previously emitted one generic "Prepare {company}
{roleTitle}" card for every pipeline job regardless of stage. A new `JOB_STAGE_CARD` map gives
each stage its own voice and ranking: `saved` → "Apply to {company} — {role}" (55), `applied` →
"Follow up with {company} — {role}" (62), `oa` → "Prep the {company} online assessment" (85),
`interview` → "Prep for your {company} interview" (88), `onsite` → "Prep for your {company}
onsite — the sharp end of the pipeline" (92). An application deadline is treated as apply-by
urgency (priority 90 + deadline reason) **only** while the job is still a `saved` lead — once
applied the deadline is moot, so from then on the stage governs both copy and ranking. Unknown
statuses fall back to the old generic copy at priority 60. No shared-type or schema change; the
Today page renders the existing `title`/`reason` fields, so no web edit needed.

**Checks:** 161 API tests green (3 new stage-aware job-card tests: onsite copy+ranking, saved
deadline-vs-no-deadline, post-application deadline is not apply-by urgency). API typecheck + lint
clean. Live round-trip against local Postgres confirmed the demo seed's `saved` NVIDIA (deadline)
rendered "Apply to NVIDIA — GPU Software Engineer" at 90, and two `oa` jobs (Stripe, Datadog)
rendered "Prep the {company} online assessment" at 85.

**Known limitation (deferred, not a regression):** the recommendations query still fetches only
the top 3 pipeline jobs ordered by deadline-asc/updatedAt-desc (`take: 3`), so a deadline-less
late-stage job (Jane Street onsite, Meta interview) can be crowded out of Today by earlier-stage
jobs that were updated more recently. The stage-aware *copy* is correct for whatever surfaces;
making the right stage-aware cards reliably *surface* (interview countdown + first-class ranked
career items) is MOM-140-full / MOM-142, deliberately out of the -lite copy scope.

**Phase 0 complete.** Next: Phase 1 loop-closure (migration-gated, D-004 human-approval per
migration): company context (MOM-120→121→122) · weakness spine (126→127→128) · outcome source
(109→110→113) · grounded readiness + company rollup (129→130) · story gap map (131) · auto prep
queue + recommendations wiring (141, 142).

## 2026-07-08 - CareerOS Phase 0: schema-free quick wins (MOM-101/102/135/108/134-lite) (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Phase 0 of the CareerOS transformation (`docs/plans/MOMITO_CAREEROS_PLAN.md`,
Tracks M–S). All six quick wins are schema-free — no migration, no D-004 gate — and were
built to make Momito feel like a CareerOS in a handful of small PRs before the migration-gated
loop-closure work begins. Branch `feat/careeros-phase-0`.

**MOM-101 — funnel & conversion analytics** (commit daf5cd1): `jobs.service.funnel(userId)`
computes cumulative reached-counts across the saved→applied→oa→interview→onsite→offer stage
ladder, per-stage conversion, response rate, and source/visaTag breakdowns; `ratio()` returns
null when the denominator is 0 so the UI never renders NaN. New `@Get('funnel')` route ordered
*before* `@Get(':id')` to dodge `ParseUUIDPipe`. `JobFunnelCard` renders the bars, conversion
%, response rate, and by-source breakdown on the jobs page.

**MOM-102 — auto-log a JobEvent on status transition** (commit 897df85): `jobs.service.update()`
reads `previousStatus` only when `dto.status` is present, and after the write creates a
`jobEvent` of type `status_change` titled `${from} → ${to}` only when the status genuinely
changed — a free timeline of pipeline movement with no schema change.

**MOM-135 — gaps → executable tasks** (commit b79cde5): `profile-scores.service.generateTasks()`
converts a résumé score's four gap categories into `Task` rows (skills high×3, experience×2,
project×2, presentation low×1, capped at 6), idempotent by title (queries existing task titles,
filters). `@Post(':id/generate-tasks')` + a "Turn gaps into tasks" button on the score page.

**MOM-108 + MOM-134-lite — paste-JD quick capture + deterministic ATS coverage** (this commit):
`profile-scores.service.atsCoverage(jdText, userId)` reuses `extractJdSkills` to tokenize a
pasted JD, normalizes against `profile.skills`, and returns `{jdKeywordCount, covered, missing,
coveragePct}`; `@Post('ats-coverage')` ordered before `@Get(':id')`. On the jobs Add form a
"Check ATS keyword coverage" button surfaces the coverage % and amber missing-keyword chips
while you paste, so a gap is visible at capture time. Honestly labeled **-lite**: the tokenizer
inherits the existing scorer's capitalized-noise limitation (grabs Backend/Engineer/Experience);
it is superseded by the AI résumé track (MOM-136) once the Anthropic key lands.

**Checks:** `pnpm -r lint && typecheck && test` green — **158 API tests** (7 new: 4 funnel,
3 status-transition, 2 atsCoverage, 3 generateTasks). API + web typecheck + lint clean. Live
round-trip against local Postgres confirmed the funnel aggregates and an ATS check (JD with 10
keywords → coveragePct 0.1, covered [PostgreSQL], missing [Backend, Engineer, Kubernetes, Go,
RPC, Python, Experience, Terraform, Kafka]). Playwright screenshot confirmed the Add-form ATS
UI renders the coverage line + amber chips with zero console errors.

**Deliberately not done:** no stage-timestamps or transition-history table (that's the
migration-gated MOM-103/104); the `-lite` ATS tokenizer is not being hardened (AI supersedes it).
Next: MOM-140-lite (stage-aware Today copy), then Phase 1 loop-closure (migration-gated).

## 2026-07-06 - MOM-087: weekly encrypted backup workflow, design + implementation (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing autonomously per user instruction. MOM-087 was marked NEEDS_SPIKE
("Neon backup strategy") — genuinely a design question, but one answerable without any
real Neon/hosting credentials by choosing a design that only needs two secrets the user
adds later.

**Design (ADR-0006, `docs/adr/0006-backup-strategy.md`):** a GitHub Actions workflow
(`.github/workflows/backup.yml`), weekly cron + manual `workflow_dispatch`, that dumps the
production database (`pg_dump --format=custom`), pipes it through `gpg --symmetric`
(AES256), and uploads the encrypted result as a 90-day-retention Actions artifact — chosen
over external object storage specifically to avoid needing a *third* untestable secret.
The first step checks whether `BACKUP_DATABASE_URL`/`BACKUP_GPG_PASSPHRASE` are configured
and exits cleanly (not a failure) if not, so merging this doesn't create weekly red-X
noise on a repo that hasn't opted in yet.

**Real bug caught and fixed before it could fail silently in production:** the first draft
had `pg_dump | gpg --passphrase-fd 0 ... <<< "$PASSPHRASE"` — wiring the passphrase to fd 0
while also piping the dump into fd 0 via the pipe. These collide; gpg would have read
whichever arrived first as "the passphrase," most likely corrupting the dump into an
undecryptable state (or worse, appearing to succeed with a wrong passphrase silently
baked in). Caught this on a careful re-read, not by running it. Fixed by moving the
passphrase to fd 3 (`--passphrase-fd 3` + `3<<<`), which the pipe never touches.

**Verified what could be verified without real infra:** this sandbox has `gpg` but not
`pg_dump`/`pg_restore` (no PostgreSQL client tools installed) and no real target database
to test a restore into. Did the next best thing — extracted the exact fd-3 passphrase
pattern into a standalone test with a fake multi-line file standing in for `pg_dump`'s
output, ran the real encrypt-then-decrypt round trip, and confirmed the decrypted output
matched the original byte-for-byte. This proves the shell mechanics are correct; the
`pg_dump`/`pg_restore` commands themselves remain genuinely untested against a real
database — disclosed as a limitation, not glossed over.

**Files changed:**
- `docs/adr/0006-backup-strategy.md` (new).
- `.github/workflows/backup.yml` (new).
- `docs/runbooks/backup-restore.md` (new) — manual restore procedure, deliberately not a
  one-click job (restoring onto production should never be a single person acting alone
  under time pressure without a deliberate pause).

**Verification:**
- YAML syntax validated via Python's `yaml.safe_load` (no parser available in this repo's
  own toolchain) — parsed without error.
- The fd-3 gpg passphrase pattern verified locally via a standalone encrypt/decrypt round
  trip (see above) — exact byte-for-byte match.
- **Not verified, disclosed honestly:** the actual `pg_dump`/`pg_restore` commands against
  a real Postgres/Neon database (no client tools installed locally, no real target to
  restore into); the workflow's actual execution on GitHub's runners (would need the repo
  pushed to GitHub with secrets configured to test end-to-end).

**Docs updated:** `BACKLOG.md` (MOM-087 → done, with the untested-scope disclosed inline).

**Next:** the remaining open backlog is now entirely gated on either external credentials
this agent doesn't hold (MOM-021 deploy, MOM-068+ AI feedback, MOM-049 LeetCode import) or
larger infra this agent can't provision (MOM-088 Lighthouse needs a real browser + running
app instance; MOM-090 golden-path needs Gate 4 AI feedback to be meaningfully "final").

---

## 2026-07-06 - Content gap fill (CS Fundamentals 149→150) + stale-backlog sweep (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** After closing Track H, swept remaining `BACKLOG.MD` entries for staleness (same
pattern as earlier in this session) and found one genuine, small, safe content gap.

**Real gap found and closed:** `pnpm content:stats` showed CS Fundamentals at 149/150 (one
short of the plan §8.2 target) — summing all 14 `CS_FUNDAMENTALS_TYPES` counts. Added one
original (not LeetCode-sourced, conceptual) `nodejs`-type seed question on stream
backpressure in Node.js, bringing the total to exactly 150. `content:validate` — 0 errors,
0 warnings, both before and after.

**Stale-status corrections (no further code changes, all pre-existing):**
- MOM-043/044 (seed structure/idempotent upserts) — done in an earlier session, entries
  never updated.
- MOM-045/046/047/048 (DSA seed/ladder batches) — 150/150 confirmed via `content:stats`.
- MOM-050/051 (DSA progress API/ladder UI) — both exist and are tested/linked.
- MOM-055/056/057 (system design batches/editor) — 25/25 confirmed; editor confirmed via
  MOM-038's earlier log entry.
- MOM-058/059 (behavioral batches) — 60/60 confirmed.
- MOM-060 (company packs) — exactly 20 confirmed by counting the `companies` array.
- MOM-006/008/012/004 (frontend utility foundation, nav model, `/today` stub, README) —
  all long done; this session alone extended `navigation.ts` and repeatedly relied on
  `/today` being the real, live implementation, not a stub.
- **Deliberately left open, not attempted:** MOM-049 (LeetCode import) — scraping/calling a
  third-party GraphQL API without an explicit go-ahead is a different risk class than
  writing original content, even scoped to links/metadata only. Flagging this as a
  judgment call rather than silently skipping it.

**Files changed:**
- `apps/api/prisma/seed-data.ts` — one new `nodejs` seed question.
- `README.md` — corrected the stale "149 CS Fundamentals"/"384 seeded questions" counts to
  150/385; added `/stories` to the routes table; replaced the dead `/study-plan` API
  section (routes no longer exist) with a `/tasks`-accurate note and a new "Story Bank" API
  section; added a "Story Bank" features blurb.
- `docs/agent/BACKLOG.md` — ~12 stale-status corrections.

**Verification:**
- `pnpm content:validate` — 0 errors, 0 warnings.
- `pnpm --filter @momito/api build` / `test` — 82/82 passed (content-only change, no
  service-layer impact expected or found).
- `pnpm lint` / `pnpm typecheck` / `pnpm build` (full workspace) — green.

**Docs updated:** `BACKLOG.md`, `README.md`.

---

## 2026-07-06 - MOM-067: story rehearsal sessions — Track H complete (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Closing Track H (Story & Behavioral Engine) end to end in one continuous
session per user instruction ("do it until you ran out of token and dont stop in the
middle"). This is the last piece: making stories actually reviewable via FSRS.

**Design:** extended `ReviewsService`'s `SUPPORTED_OBJECT_TYPES` to include `'story'`.
Unlike `Question` (a shared/global bank any user can review), `Story` is per-user private
data — added `ensureAccessible()`, called from `record()` before scheduling, which
`findFirst({id, userId})`-checks story ownership and 404s otherwise. This closes a real
access-control gap that would otherwise have existed the moment `'story'` became a
supported type: without it, any authenticated user could pass any story UUID and
schedule/read review metadata for a story they don't own (the FSRS state itself doesn't
leak story *content*, but it's still an authorization hole not worth leaving open).
`listDue()` now also enriches story-type rows with the story's title (mirroring the
existing question-title lookup, just against `this.prisma.story` instead).

**Frontend — the actual rehearsal entry point:** questions get their first `ReviewState`
row created implicitly when a user submits a self-rated answer during a practice session
(`sessions.service.ts`). Stories have no equivalent session flow, so MOM-067 needed its own
entry point: the Story Bank page gained a "Rehearse" button per story that expands into
the same 1-5 self-rating row Today already uses for questions, calling
`reviewsApi.record('story', id, rating)` directly. First rating creates the `ReviewState`
row (FSRS defaults); after that it's a normal FSRS review like anything else, surfacing on
`/today` when due.

**Real bug found and fixed while wiring this up:** `/today`'s due-review card always
built its navigate-on-click target as `/questions/${review.objectId}` — harmless while
`'question'` was the only supported type, but now that story reviews can appear in the
same due-queue, this would send a story review to `/questions/<story-uuid>`, which either
404s or (worse) silently mismatches if a question happened to share that UUID space.
Fixed by branching on `review.objectType`: story reviews now link to `/stories` (no
per-story detail route exists yet — MOM-065 only shipped list + inline expand). Also
changed the badge label to say "Story" instead of "Review" for story-type entries, so the
queue is self-explanatory instead of ambiguous.

**Files changed:**
- `apps/api/src/reviews/reviews.service.ts` — `'story'` added to
  `SUPPORTED_OBJECT_TYPES`; new `ensureAccessible()` ownership check; `listDue()`
  enriches story titles.
- `apps/api/test/reviews.service.spec.ts` — fixed a test that had been asserting `'story'`
  was *unsupported* (now wrong, since MOM-067 supports it — swapped to a genuinely
  unsupported type, `'behavioral_prompt'`); added 3 new tests (schedules for an owned
  story, rejects an unowned story, enriches due story reviews with title).
- `apps/web/app/(authenticated)/stories/page.tsx` — added the "Rehearse" action
  (self-rating row + `reviewsApi.record()` call + a confirmation message).
- `apps/web/app/(authenticated)/today/page.tsx` — fixed the review-card navigate target
  and badge label to branch on `review.objectType`.

**Verification:**
- `pnpm --filter @momito/api test` - 82/82 passed (was 79; +3 new tests).
- `pnpm lint` / `pnpm typecheck` / `pnpm build` (full workspace) - green.
- **Live round trip** against the real local Postgres: created a real story, rehearsed it
  three times via `POST /reviews/story/:id` (ratings 1, 1, 5 — deliberately including two
  "Again" grades to exercise the lapse-counting path), confirmed via a direct Prisma query
  that the persisted `ReviewState` row matched the API's last response exactly
  (`reps: 3, lapses: 1, state: 3`), then deleted the story and confirmed via the same
  direct query that the transactional orphan-cleanup (ADR-0002/0003) removed the
  `ReviewState` row too (0 remaining afterward). Did not wait for the real-time due
  window to pass to test `listDue()`'s enrichment against a live due story (FSRS scheduled
  it ~10 minutes out and polling that long wasn't a good use of this pass) — that code
  path is covered by a unit test with a mocked due row instead.

**Docs updated:** `BACKLOG.md` (MOM-067 → done — this closes Track H, MOM-063 through
MOM-067, entirely).

**This closes the full Story Bank feature**, from schema design through rehearsal
sessions, in one continuous session. Remaining open backlog items are all either
migration-gated-but-unattempted (MOM-069 AiUsage, entangled with the credential-gated
MOM-068 AI SDK spike) or genuinely credential-gated (deploy, AI feedback, LeetCode
import, backups) — see `NEXT.MD` for the current honest picture of what's left.

---

## 2026-07-06 - MOM-066: link stories to behavioral prompts (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing straight through the Story Bank chain (MOM-063→064→065→066 all in
one session, per user instruction to keep going without stopping). `StoryPrompt` table
already existed from ADR-0005's migration — this is CRUD on it plus the frontend affordance
to actually use it.

**Design:** `StoriesService.linkPrompt(storyId, questionId, userId)` — ownership-checks the
story, validates the question exists and is `type: 'behavioral'` (400 otherwise; the plan
explicitly scopes this to behavioral prompts, not any question type), and is idempotent —
if the pair already exists it just returns current state instead of a duplicate-key error,
matching how a user re-clicking "Link" shouldn't see a scary error. `unlinkPrompt` is a
plain scoped `deleteMany`. `StoryResponse.prompts` is `{questionId, questionTitle}[]` —
denormalized title so the frontend doesn't need a second fetch.

**Frontend:** rather than adding a reverse "stories for this question" endpoint, the new
`LinkedStories` component (in `questions/[id]/page.tsx`) fetches the user's full
`storiesApi.list()` once and derives linked/unlinked by checking each story's own
`prompts` array client-side — simpler than a new backend surface for what's a small
per-user list. Rendered only when `question.type === 'behavioral'`.

**Files changed:**
- `packages/shared/src/index.ts` — added `StoryPromptLink`, extended `StoryResponse` with
  `prompts`.
- `apps/api/src/stories/dto/link-story-prompt.dto.ts` (new).
- `apps/api/src/stories/stories.service.ts` — `storyInclude` now also includes `prompts`
  (with the linked question's `id`/`title`); added `linkPrompt`/`unlinkPrompt`; `serialize`
  maps `story.prompts` to the shared `StoryPromptLink` shape.
- `apps/api/src/stories/stories.controller.ts` — `POST /stories/:id/prompts`,
  `DELETE /stories/:id/prompts/:questionId`.
- `apps/api/test/stories.service.spec.ts` — 5 new tests (link, idempotent re-link, reject
  non-behavioral, reject nonexistent question, unlink) + updated `baseStory` fixture to
  include `prompts: []` (existing tests broke without it once `serialize` started reading
  `story.prompts`).
- `apps/web/app/lib/api-client.ts` — `storiesApi.linkPrompt`/`unlinkPrompt`.
- `apps/web/app/(authenticated)/questions/[id]/page.tsx` — new `LinkedStories` component,
  rendered for behavioral questions only.

**Verification:**
- `pnpm --filter @momito/api test` - 79/79 passed (was 74; +5 new tests).
- `pnpm lint` / `pnpm typecheck` / `pnpm build` (full workspace) - green.
- **Live round trip** against the real local Postgres: logged in as the demo user, found a
  real seeded behavioral question ("Prioritize under a deadline"), created a story, linked
  it (`POST /stories/:id/prompts`), confirmed a re-link is idempotent (still 201, not a
  duplicate-key error), unlinked it, and cleaned up the test story via delete. The
  non-behavioral-rejection path is covered by a unit test (a live negative-case query hit
  an unrelated grep/pagination-shape snag, not a bug in the endpoint itself).

**Docs updated:** `BACKLOG.md` (MOM-066 → done, MOM-067 → ready).

**Next:** MOM-067 (rehearsal sessions) — extend `ReviewsService.record()`'s `objectType`
allow-list past `'question'` to include `'story'`.

---

## 2026-07-06 - MOM-065: Story Bank frontend (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing straight through the Story Bank chain now that MOM-063/064 (schema +
API) are done. Pure frontend, no backend changes.

**Files changed:**
- `apps/web/app/(authenticated)/stories/page.tsx` (new).
- `apps/web/app/lib/navigation.ts` — added a "Story Bank" nav entry (non-primary; all 5
  mobile bottom-tab primary slots are already taken).

**Design:** list + inline create/edit form, following the exact conventions already
established by `/study-plan` and `/questions` (inline forms inside `Card`, delete-confirm
pattern, `Badge` for tags). STAR fields (situation/task/action/result) are four separate
textareas, not one blob, matching ADR-0005's schema rationale. Competency tags and
follow-up questions are comma-separated text inputs converted to/from `string[]` client-side
(no need for a chip-input component given comma-separated is already this codebase's
pattern for `roleTags`-shaped fields elsewhere). Companies are a toggle-chip multi-select
reusing the existing `companiesApi.list()`. Each story card has an expand/collapse toggle
to view the full STAR breakdown without navigating away from the list.

**Verification:**
- `pnpm --filter @momito/web lint` / `typecheck` / `build` - all green; `/stories` is now a
  32nd static route.
- HTTP smoke test: started the compiled API server and a production `next start` web
  server locally, `curl`'d `GET /stories` → 200, no server-side crash.
- **Not verified:** actual interactive behavior in a real browser (create/edit/delete
  flows, dark mode, mobile layout) — no browser-automation tool is available in this
  environment. Flagging this explicitly rather than claiming full manual QA.

**Docs updated:** `BACKLOG.md` (MOM-065 → done, MOM-066/067 → next).

**Next:** MOM-066 (link stories to behavioral prompts via `StoryPrompt`).

---

## 2026-07-06 - MOM-063/064: Story Bank schema + CRUD API, human-approved (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing autonomously through migration-gated backlog items under the user's
standing D-004 approval. First genuinely net-new schema in this pass (MOM-075 was a
merge/drop of an existing table) — a good test of the incident lesson from that task.

**Design (ADR-0005, `docs/adr/0005-story-bank-schema.md`):** three new, purely additive
tables — `Story` (STAR fields as separate required columns, not one blob, so a future
rehearsal UI can quiz each section independently), `StoryCompany` (mirrors the existing
`QuestionCompany` join-table shape exactly), `StoryPrompt` (many-to-many to `Question`,
deliberately not 1:1 — one story should be reusable across several behavioral prompts).
`competencyTags`/`followUpQuestions` are plain `String[]`, matching the existing
tag-field precedent (`Question.roleTags`/`missTags`) rather than inventing a DB-level enum
with no existing taxonomy to justify one. No `ReviewState` schema change — ADR-0002 already
reserved `objectType: 'story'`.

**Migration discipline follow-through from the MOM-075 incident:** this migration only
*adds* tables (no drops), so the `--create-only` self-apply surprise from that task posed
zero data-loss risk here regardless. Still hit a real problem worth recording: after
reverting my hand-edit to the *already-applied* `merge_study_plan_into_task` migration
(to fix its checksum after the MOM-075 incident), a second `migrate dev --create-only`
attempt found Prisma wanted to **reset the entire dev database** ("The migration ... was
modified after it was applied ... All data will be lost") — caused by the checksum
mismatch from my own edit. **Did not run the reset.** Instead reverted `migration.sql`
back to exactly what was actually applied (no backfill INSERT — moot anyway, since
`seed.ts` never populated `study_plan_items` and the table was already dropped), which
fixed the checksum without touching any data. Also found and removed a stray empty
duplicate migration folder from an earlier retry
(`20260705172843_merge_study_plan_into_task`, `-- This is an empty migration.`) before
retrying the Story migration cleanly. **Lesson restated more sharply than last time:
never hand-edit an already-applied migration's `.sql` file — it breaks the checksum and
the only way Prisma offers to "fix" it is a full reset. If a migration already applied
wrong, fix forward with a new migration, don't rewrite history.**

**Files changed:**
- `apps/api/prisma/schema.prisma` — added `Story`/`StoryCompany`/`StoryPrompt` models;
  `User.stories`, `Company.stories`, `Question.storyPrompts` back-relations.
- `apps/api/prisma/migrations/20260705174649_add_story_bank/migration.sql` — pure
  `CREATE TABLE` × 3 + indexes + FKs, verified via `prisma migrate status` to have stayed
  unapplied until I explicitly ran `migrate dev` (unlike the MOM-075 incident).
- `apps/api/prisma/migrations/20260705172825_merge_study_plan_into_task/migration.sql` —
  reverted to its originally-applied contents (see incident note above).
- `docs/adr/0005-story-bank-schema.md` (new).
- `packages/shared/src/index.ts` — added `StoryResponse`/`CreateStoryRequest`/
  `UpdateStoryRequest`.
- `apps/api/src/stories/` (new) — `stories.service.ts`, `stories.controller.ts`,
  `stories.module.ts`, `dto/create-story.dto.ts`, `dto/update-story.dto.ts`.
- `apps/api/src/app.module.ts` — registered `StoriesModule`.
- `apps/api/test/stories.service.spec.ts` (new, 5 tests): user-scoped list, 404 on
  cross-user get, deduplicated company-link creation, transactional delete (story +
  ReviewState cleanup) scoped to the owner, 404 on cross-user delete.
- `apps/web/app/lib/api-client.ts` — added `storiesApi` (list/get/create/update/remove).
  No page consumes it yet — MOM-065 (frontend) is a separate follow-up PR.

**Verification:**
- `pnpm --filter @momito/api test` - 74/74 passed (was 69; +5 new `stories.service` tests).
- `pnpm lint` / `pnpm typecheck` / `pnpm build` (full workspace) - green.
- **Live round trip** against the real local Postgres: logged in as the seeded demo user,
  created a real story with a linked company via `POST /stories`, fetched it via
  `GET /stories/:id`, listed via `GET /stories`, updated `metrics` via `PATCH /stories/:id`,
  deleted via `DELETE /stories/:id` (204), confirmed a subsequent `GET` 404s, and confirmed
  the route 401s without a token.

**Docs updated:** `BACKLOG.md` (MOM-063/064 → done, MOM-065/066/067 → READY, SPIKE-003 →
fully done), `docs/adr/0005-story-bank-schema.md` (new).

**Next:** MOM-065 (Story frontend page), MOM-066 (link stories to behavioral prompts via
the new `StoryPrompt` table), MOM-067 (rehearsal sessions reusing the FSRS scheduler) are
all now unblocked. Continuing to work through the remaining migration-gated backlog
(MOM-069 AiUsage table design is the other open one) under the same standing approval.

---

## 2026-07-06 - MOM-075/076/077: merge StudyPlanItem into Task, human-approved (CLAUDE)

**Actor:** CLAUDE (implementer)
**Trigger:** User granted blanket approval to cross the D-004 human-approval gate for
schema migrations for the remainder of the plan ("You will have all the permissions to
code on whatever you want to finish the plan... I will no longer question you"). Treated
as standing approval for migration-gated backlog items specifically (not for
credential-gated items like deploy/AI feedback/LeetCode import/backups — I don't hold
those credentials, so those remain genuinely blocked regardless of permission).

**Design (SPIKE-007):** `StudyPlanItem` is a strict subset of `Task`'s existing columns —
`title`/`notes`/`topicId`/`userId` map 1:1; `status` ('todo'|'in_progress'|'done') is a
strict subset of `TaskStatus`; `targetDate` → `dueDate`; `priority` defaults to `'medium'`
(StudyPlanItem never had one); `type` is always `'study'`.

**Incident — read this before trusting `--create-only` again:** ran
`prisma migrate dev --name merge_study_plan_into_task --create-only` intending to hand-edit
the generated SQL (add the backfill INSERT) *before* it touched the database. Prisma
instead applied the migration immediately — output showed "Applying migration ... The
following migration(s) have been applied" despite the flag — dropping `study_plan_items`
before the backfill INSERT existed anywhere. I could not recover the pre-drop row count
or contents afterward (`to_regclass('public.study_plan_items')` now returns null). This
local dev DB had only 2 users and light data at the time (consistent with this session's
established pattern of creating/cleaning up test rows), so real data loss risk looks low,
but I want this on record rather than quietly working around it: **before any future
`--create-only` on a table with data, get an explicit row count first, and don't trust
the flag to guarantee no database write occurs.** Added the backfill INSERT to the
migration's `migration.sql` anyway, since it's still correct (and necessary) for any other
environment (CI, a future fresh `migrate deploy`) that reaches this migration with
non-empty `study_plan_items` rows.

**Files changed:**
- `apps/api/prisma/schema.prisma` — removed `model StudyPlanItem` and its `User`/`Topic`
  back-relations.
- `apps/api/prisma/migrations/20260705172825_merge_study_plan_into_task/migration.sql` —
  hand-added the backfill `INSERT INTO tasks ... SELECT ... FROM study_plan_items` before
  the generated `DROP TABLE`.
- `apps/api/src/study-plan/` — deleted entirely (service, controller, 2 DTOs).
- `apps/api/src/app.module.ts` — removed `StudyPlanModule` import/registration.
- `apps/api/src/tasks/tasks.service.ts` — added `remove(id, userId)` (StudyPlanItem had
  delete; Task didn't yet — `Reminder.task` is `onDelete: Cascade` per schema, so deleting
  a task cleans up its reminder in the same statement).
- `apps/api/src/tasks/tasks.controller.ts` — added `DELETE /tasks/:id` → 204.
- `apps/api/test/study-plan.service.spec.ts` — deleted (tested the removed service).
- `apps/api/test/tasks.service.spec.ts` — new (2 tests: scoped delete, 404 for
  cross-user delete).
- `packages/shared/src/index.ts` — removed `StudyPlanItemResponse`/`STUDY_PLAN_STATUSES`/
  `StudyPlanStatus` (only consumers were the removed module and the rewritten web page).
- `apps/web/app/lib/api-client.ts` — removed `studyPlanApi`; added `tasksApi.remove(id)`.
- `apps/web/app/(authenticated)/study-plan/page.tsx` — rewritten onto `tasksApi` with
  `type: 'study'` and `dueDate` in place of `targetDate`. UI/UX intentionally unchanged
  (same tabs, same create/edit/delete flow, same route) — only the data layer moved.

**Verification:**
- `pnpm --filter @momito/api test` - 69/69 passed (was 72; -5 removed StudyPlanService
  tests, +2 new TasksService tests).
- `pnpm lint` / `pnpm typecheck` / `pnpm build` (full workspace, all 3 packages) - green.
- `pnpm content:validate` - 0 errors, 0 warnings (unrelated to this change, included in
  the standard verification set).
- **Live round trip** against the real local Postgres: logged in as the seeded demo user,
  created a real `type: 'study'` task via `POST /tasks`, listed it via
  `GET /tasks?type=study`, updated its status via `PATCH /tasks/:id`, deleted it via
  `DELETE /tasks/:id` (204), confirmed it no longer appears in the list, and confirmed
  `GET /study-plan` now 404s (old route fully gone). Cleaned up the test task via the
  delete call itself (idempotent — nothing left behind).
- Killed an orphaned earlier dev-server process squatting on port 4000 (from a
  backgrounded shell whose process outlived that Bash tool call) via
  `Get-CimInstance Win32_Process` + `Stop-Process`, same pattern as prior sessions'
  Windows housekeeping notes.

**Docs updated:** `BACKLOG.md` (MOM-075/076/077 → done, SPIKE-007 → done).

**Next:** continuing through the remaining migration-gated backlog (MOM-063 Story schema,
MOM-069 AiUsage) under the same standing approval; external-credential-gated items (deploy,
Anthropic AI feedback, LeetCode import, Neon backups) remain skipped since I don't hold
those credentials.

---

## 2026-07-06 - Backlog reality cleanup + MOM-080 top-bar reminder bell (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** Per `NEXT.MD`'s "safest next task" — inspect remaining `BACKLOG.MD`
READY/BLOCKED items against the current repo, correct stale statuses, and (since the one
genuinely open, non-migration, non-credential-gated gap found was small) close it.

**Stale-status corrections (no code changes, all pre-existing):**
- **MOM-017** (helmet + throttling) — `main.ts` already applies `helmet()` globally;
  `app.module.ts` already registers a global `ThrottlerModule`/`ThrottlerGuard`.
- **MOM-018** (auth throttling) — `auth.controller.ts`'s login/register already carry
  `@Throttle(AUTH_THROTTLE)`.
- **MOM-019** (health endpoint) — `health.module.ts`/`health.controller.ts` already exist
  and are registered.
- **MOM-022/023/024/025** (Knowledge Kernel constants/rubric types/content validation
  framework/KnowledgeObject helpers) — all already implemented in
  `packages/shared/src/index.ts` and `apps/api/scripts/content-*.ts`.
- **MOM-062** (content coverage dashboard) — already implemented end-to-end
  (`content.service.ts` + `settings/content/page.tsx`).
- **MOM-085** (exception filter + request logging) — `all-exceptions.filter.ts` and
  `request-logging.middleware.ts` already registered globally.
- **MOM-086** (DB health ping) — `GET /api/v1/health/db` already exists.

All corrected in `BACKLOG.MD` with verification notes; no source changed for any of these.

**Real gap found and closed — MOM-080's remaining top-bar half:** the Today page already
showed reminders (2026-07-05), but nothing outside `/today` gave any ambient signal that a
reminder was due.

**Files changed:**
- `apps/web/app/components/ReminderBell.tsx` (new)
- `apps/web/app/(authenticated)/layout.tsx`
- `docs/agent/BACKLOG.md`
- `docs/agent/LOG.MD`
- `docs/agent/LOCKS.MD`
- `docs/agent/NEXT.MD`

**Changes:**
- New `ReminderBell` component: fetches `remindersApi.list()` once on mount, computes how
  many pending reminders are already past `dueAt` (mirrors the API's own "due" predicate,
  not just "exists"), renders a bell icon linking to `/today` with a small red count badge
  only when that count is nonzero. Fetch failures are swallowed — this is an ambient
  indicator, not a page that should show an error banner.
- Wired into `(authenticated)/layout.tsx`'s header, next to the existing `ThemeToggle`.

**Verification:**
- `pnpm --filter @momito/web lint` - passed
- `pnpm --filter @momito/web typecheck` - passed
- `pnpm --filter @momito/web build` - passed (31 routes)
- `pnpm test` - passed (72/72 API tests; web has no test runner configured)

**Risks / follow-ups:**
- The bell fetches once on mount only (no polling/websocket) — a reminder crossing its due
  time while the layout is already mounted won't update the badge until next navigation/
  reload. Acceptable for a single-user app; a polling interval would be the natural
  follow-up if this becomes noticeable.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not
  touched by this task.

**Suggested commit message:** `feat(web): add top-bar reminder bell and fix stale backlog statuses`

---

## 2026-07-05 - Spaced review frontend handoff cleanup (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** Frontend follow-up for spaced-review sessions.

**Current behavior before change:** The practice creation page fetched due reviews and submitted every due question ID as an exact-question session. That duplicated backend selection behavior and could exceed `CreateSessionDto.questionCount`'s max of 100 when a user had more than 100 due reviews.

**Files changed:**
- `apps/web/app/(authenticated)/practice/new/page.tsx`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`
- `docs/agent/NEXT.MD`

**Changes:**
- Kept the due-review preview on the `spaced_review` form.
- Stopped sending explicit `questionIds` for spaced-review session creation.
- Submitted a capped `questionCount` so the API's due-review selector owns ordering and filtering.
- Added copy explaining that sessions start with the 100 oldest due reviews when more than 100 are due.

**Verification:**
- `pnpm --filter @momito/web lint` - passed
- `pnpm --filter @momito/web build` - passed (31 app routes)
- `pnpm --filter @momito/web typecheck` - initial run failed on stale `.next/types/validator.ts` missing `routes.js`; rerun after `next build` regenerated route metadata and passed

**Risks / follow-ups:**
- Frontend still fetches due reviews for preview/disabled state; creation now relies on the backend for the final authoritative due set.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `fix(web): let API select spaced review questions`

---

## 2026-07-05 - Spaced review session selection (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** Wire `spaced_review` sessions to due ReviewState questions.

**Current behavior before change:** `spaced_review` was a valid session type, but creating that session without explicit question IDs used the generic random filtered question selector instead of the user's due review queue.

**Files changed:**
- `apps/api/src/sessions/sessions.service.ts`
- `apps/api/test/sessions.service.spec.ts`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`
- `docs/agent/NEXT.MD`

**Changes:**
- Added due-review selection for `spaced_review` session creation, ordered by `ReviewState.due`.
- Limited selection by `questionCount`, ignored suspended/non-question/future review states, and skipped orphaned question review states.
- Preserved explicit `questionIds` as an override for manually curated sessions.
- Added session service tests for due ordering, orphan skipping, and explicit-ID override.

**Verification:**
- `pnpm --filter @momito/api test -- sessions.service.spec.ts` - passed (15 tests)
- `pnpm --filter @momito/api typecheck` - passed
- `pnpm --filter @momito/api build` - passed
- `pnpm --filter @momito/api test` - passed (72 tests)

**Risks / follow-ups:**
- This only changes backend session question selection; frontend can already choose `spaced_review`.
- If there are no due reviews, creation still returns the existing "No questions match the selected filters" error.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `feat(api): create spaced review sessions from due reviews`

---

## 2026-07-05 - MOM-004 root README accuracy refresh (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** MOM-004 / MOM-089 - Root project docs refresh.

**Current behavior before change:** The README still described `/today` as a stub, reported pre-MOM-048/MOM-056 seed counts, and described ADR-0002 ReviewState as design-only despite the current persisted review scheduling implementation.

**Files changed:**
- `README.md`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`

**Changes:**
- Updated seed totals to 384 questions, 150 DSA, and 25 system design cases.
- Updated `/today` to describe the live due-review/recommendation/reminder/prep queue.
- Updated ADR-0002 wording to reflect persisted ReviewState scheduling.

**Verification:**
- `rg -n "382|149 DSA|24 System|stub|design only|not yet implemented" README.md` - no stale count/status hits remained
- `pnpm content:stats` - passed (384 total questions, 150 DSA, 25 system design)
- `git diff --check -- README.md docs/agent/LOG.MD docs/agent/LOCKS.MD` - passed

**Risks / follow-ups:**
- Docs-only change; no runtime behavior changed.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `docs: refresh root README status`

---

## 2026-07-05 - MOM-083 job prep linkage regression coverage (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** MOM-083 - Link jobs to prep objects.

**Current behavior before change:** Job prep generation already created `Task` rows with `jobApplicationId`, and job detail already loaded linked tasks/reminders, but there was no focused service test guarding that job-to-prep linkage.

**Files changed:**
- `apps/api/test/jobs.service.spec.ts` (new)
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`

**Changes:**
- Added a `JobsService.generatePrep` regression test proving generated prep tasks include the target `jobApplicationId`, user, role track, deadline-relative due dates, and job deadline reminder linkage.
- No production behavior, schema, migrations, or API contracts changed.
- During inspection, MOM-050/MOM-051/MOM-057/MOM-060/MOM-062/MOM-085/MOM-086 were found already implemented in the current repo state.

**Verification:**
- `pnpm --filter @momito/api test -- jobs.service.spec.ts` - passed (1 test)
- `pnpm --filter @momito/api typecheck` - passed
- `pnpm --filter @momito/api build` - passed
- `pnpm --filter @momito/api test` - passed (69 tests)

**Risks / follow-ups:**
- This is coverage-only; any future UI affordance changes for job prep should remain separate.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `test(api): cover job prep task linkage`

---

## 2026-07-05 - MOM-056 final system design seed item (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** MOM-056 - System design cases batch 2.

**Current behavior before change:** The seed corpus had 24 system design questions, one short of the 25-question Track G target.

**Files changed:**
- `apps/api/prisma/seed-data.ts`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`

**Changes:**
- Added one original system design seed item for a feature flag platform.
- Covered targeted rollout, low-latency evaluation, auditability, rollback, deterministic rollout hashing, and stale-config tradeoffs.
- No schema, migrations, runtime code, or seeding logic changed.

**Verification:**
- `pnpm content:validate` - passed (0 errors, 0 warnings)
- `pnpm content:stats` - passed (384 total questions, 25 system design)
- `pnpm --filter @momito/api build` - passed
- `pnpm --filter @momito/api test` - passed (68 tests)

**Risks / follow-ups:**
- No live `pnpm db:seed` run was performed; this was verified through content tooling, build, and tests.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `data(api): add final system design seed item`

---

## 2026-07-05 - MOM-048 final DSA seed item (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** MOM-048 - DSA ladder batch 3.

**Current behavior before change:** The seed corpus had 149 DSA questions, one short of the 150-question Track G target.

**Files changed:**
- `apps/api/prisma/seed-data.ts`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`

**Changes:**
- Added one original, link-only DSA seed item for `Course Schedule IV`.
- Kept the change limited to static seed content and agent coordination docs.
- No schema, migrations, runtime code, or seeding logic changed.

**Verification:**
- `pnpm content:validate` - passed (0 errors, 0 warnings)
- `pnpm content:stats` - passed (383 total questions, 150 DSA)
- `pnpm --filter @momito/api build` - passed
- `pnpm --filter @momito/api test` - passed (68 tests)

**Risks / follow-ups:**
- No live `pnpm db:seed` run was performed; this was verified through content tooling, build, and tests.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `data(api): add final DSA seed item`

---

## 2026-07-05 - MOM-044 idempotent seed upsert utilities (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** MOM-044 - Idempotent seed upsert utilities.

**Current behavior before change:** Seeding was already idempotent, but the user/topic/company/question upserts and question-company relinking were inline inside `main()`.

**Files changed:**
- `apps/api/prisma/seed.ts`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`

**Changes:**
- Extracted named helpers for demo-user, topic, company, question, stable question ID, and question-company relation seeding.
- Preserved existing `upsert` behavior and the delete/create relinking strategy for question companies.
- No seed data, IDs, schema, migrations, or content semantics changed.

**Verification:**
- `pnpm content:validate` - passed (0 errors, 0 warnings)
- `pnpm content:stats` - passed (382 total questions)
- `pnpm --filter @momito/api build` - passed
- `pnpm --filter @momito/api test` - passed (68 tests)

**Risks / follow-ups:**
- No live `pnpm db:seed` run was performed; this was verified through TypeScript build, content tooling, and API tests.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `refactor(api): extract idempotent seed upsert helpers`

---

## 2026-07-05 - MOM-043 seed-data structure split (CLAUDE)

**Actor:** CLAUDE (implementer)
**Task:** MOM-043 - Seed-data structure.

**Current behavior before change:** `apps/api/prisma/seed.ts` mixed the static seed corpus, metadata inference helpers, and executable Prisma upsert flow in one large file. Content validation imported from `seed.ts`, relying on a guard to avoid running the live DB seeder as an import side effect.

**Files changed:**
- `apps/api/prisma/seed-data.ts` (new)
- `apps/api/prisma/seed.ts`
- `apps/api/scripts/content-lib.ts`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`

**Changes:**
- Moved topics, companies, questions, `SeedQuestion`, and metadata inference helpers into `seed-data.ts`.
- Kept `seed.ts` as the executable Prisma seeding entrypoint only.
- Updated content validation/stats/sample tooling to import seed data directly from `seed-data.ts`.
- No seed rows, IDs, question text, metadata inference behavior, schema, or migrations changed.

**Verification:**
- `pnpm content:validate` - passed (0 errors, 0 warnings)
- `pnpm content:stats` - passed (382 total questions)
- `pnpm --filter @momito/api build` - passed
- `pnpm --filter @momito/api test` - passed (68 tests)

**Risks / follow-ups:**
- The seed corpus is still a large single array; this PR separates data from execution but does not split by domain yet.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `refactor(api): split seed data from prisma seeder`

---

## 2026-07-05 - Dark mode pass, final cleanup: attempts detail + study plan (CLAUDE)

**Actor:** CLAUDE (implementer)
**Scope:** Finished the remaining dark-mode remediation surfaces left after batches 5-8.

**Files changed:**
- `apps/web/app/(authenticated)/attempts/[id]/page.tsx`
- `apps/web/app/(authenticated)/study-plan/page.tsx`
- `docs/agent/LOCKS.MD`
- `docs/agent/LOG.MD`

**Changes:**
- Added dark text/border/hover variants to attempt detail question/answer/reflection surfaces and the session button.
- Added dark-mode styling to study-plan status chips, create/edit forms, error/delete confirmations, tabs, item titles, due-date warning text, and action buttons.
- Kept this as CSS-class-only remediation; no API, data, routing, or schema behavior changed.

**Verification:**
- `pnpm --filter @momito/web typecheck` - passed
- `pnpm --filter @momito/web lint` - passed
- `pnpm --filter @momito/web build` - passed (31 static/dynamic routes generated)

**Risks / follow-ups:**
- No browser screenshot/manual visual QA was run in this pass.
- `AGENTS.MD` remains dirty from an earlier instruction/documentation change and was not touched by this task.

**Suggested commit message:** `feat(web): finish dark mode pass for attempts and study plan`

---

> Append-only execution journal. Newest entries on top. Every implementer PR adds an entry:
> task ID, files changed, checks run, result, risks/follow-ups.

---

## 2026-07-05 — Dark mode pass, batches 5-7: dashboard, profile family (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing the dark-mode remediation (committed as three separate commits —
`1e36c3a` dashboard, `a2682eb` profile, plus this profile-siblings pass — but only logged
here together since the first two commits didn't get their own LOG entry at the time).

**Pages fixed:**
- `dashboard/page.tsx` — summary cards, focus mission, role readiness bars, next actions,
  this week, topic progress bars, weak areas, suggested-topics chips, recent sessions.
- `profile/page.tsx` — heading, action buttons, contact form, all four textarea fields
  (skills/experience/projects/education), raw CV text toggle.
- `profile/upload/page.tsx` — heading, file input (including its `file:` pseudo-element
  classes), selected-file preview.
- `profile/scores/page.tsx` — heading, edit-profile button, role-template creation form,
  score cards, the `ScoreBars` sub-component's progress bars.
- `profile/scores/[id]/page.tsx` — heading, the `CategoryCard` sub-component (progress
  bars, gap chips), suggestions card, JD-used card.

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes) after each
sub-batch. `pnpm test`: 68/68 throughout (no API changes — pure CSS-class additions).

**Remaining:** `settings/page.tsx` (397 lines), `study-plan/page.tsx` (540 lines) — the
two largest remaining files, left for a final follow-up pass.

---

## 2026-07-05 — Dark mode pass, batch 4: practice/new, QuestionForm (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing the dark-mode remediation.

**Pages/components fixed:** `practice/new/page.tsx` (heading, error banner, all form
labels/inputs/selects including the new Spaced Review preview card), the shared
`QuestionForm.tsx` component (386 lines, used by both `questions/new` and
`questions/[id]/edit` — every label/input/textarea/select, the topic/company
inline-create rows, and the company toggle chips), plus the thin wrapper
headings/cards on `questions/new/page.tsx` and `questions/[id]/edit/page.tsx`.

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes — pure CSS-class additions).

**Remaining:** `dashboard/page.tsx` (293 lines), `profile/page.tsx` (343 lines),
`settings/page.tsx` (397 lines), `study-plan/page.tsx` (540 lines) — the four largest
files, left for a follow-up pass given their size.

---

## 2026-07-05 — Dark mode pass, batch 3: missions detail, learning, calendar (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing the dark-mode remediation.

**Pages fixed:** `missions/[id]/page.tsx` (all the repeated `border-zinc-200 p-3` cards,
headings, form inputs via targeted replace-all across the 286-line file), `learning/page.tsx`
(heading, Readwise connect/sync card, add-evidence form, evidence-ledger card titles),
`calendar/page.tsx` (heading, range-tab bar, task-creation form, task cards, reminders
card — the dismiss button itself was already fixed earlier this session, but the rest of
the page had zero dark classes until now).

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes — pure CSS-class additions).

**Remaining:** `dashboard/page.tsx` (293 lines), `profile/page.tsx` (343 lines),
`settings/page.tsx` (397 lines), `study-plan/page.tsx` (540 lines), `questions/new`,
`questions/[id]/edit`, `practice/new/page.tsx`. These are the largest remaining files —
continuing as budget allows.

---

## 2026-07-05 — Dark mode pass, batch 2: jobs, career, missions (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing the dark-mode remediation from batch 1.

**Pages fixed:** `jobs/page.tsx` (heading, status filter chips, the full "Add Job" form's
labels/inputs, job card titles), `jobs/[id]/page.tsx` (all card headings via one
replace-all, action buttons, JD notes text, timeline form + event cards, status select,
reminders row — building on the dismiss-button fix from earlier this session),
`career/page.tsx` (progress bars, heading, role-track selector, track cards' active/
inactive badge, readiness cards, area breakdowns, top-gaps list), `missions/page.tsx`
(heading, the full "New Mission" form's labels/inputs, mission card titles).

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes — pure CSS-class additions).

**Remaining:** `missions/[id]/page.tsx`, `learning/page.tsx`, `calendar/page.tsx`,
`dashboard/page.tsx`, `profile/page.tsx`, `settings/page.tsx`, `study-plan/page.tsx`,
`questions/new`, `questions/[id]/edit`, `practice/new/page.tsx`.

---

## 2026-07-05 — Dark mode pass, batch 1: core practice loop pages (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Trigger:** While checking the calendar page's dismiss-button styling, noticed it (and
every other top-level authenticated page except `/practice` and `/today`) had **zero**
`dark:` classes — a census confirmed 11 pages entirely light-only. Corrected an earlier
overclaim in this same session (MOM-013 marked fully DONE; actually only the `ui.tsx`
design-system primitives and a couple of pages support dark mode).

**Scope of this pass — the core practice/review loop, since it's the most-used part of
the app and directly tied to tonight's Learning Loop work:**
- `apps/web/app/(authenticated)/attempts/page.tsx` — heading, card title, hover border.
- `apps/web/app/(authenticated)/practice/session/[id]/page.tsx` — the one light-only
  error banner (its child components `SessionHeader`/`AllAnsweredPanel`/
  `ReviewQuestionCard` were already fine).
- `apps/web/app/(authenticated)/practice/session/[id]/summary/page.tsx` — heading, stat
  cards, per-question title/miss-tags/reflection text, status-color badges, action
  buttons.
- `apps/web/app/(authenticated)/questions/[id]/page.tsx` — heading, edit/delete buttons,
  delete-confirm dialog, prompt/notes text, reference-answer heading, practice-card
  accent border.
- `apps/web/app/(authenticated)/questions/page.tsx` — heading, search/filter
  inputs, card titles.

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes — pure CSS-class additions).

**Not done in this pass — genuinely large remaining scope, tracked for follow-up:**
`jobs/page.tsx` + `jobs/[id]/page.tsx`, `career/page.tsx`, `missions/page.tsx` +
`missions/[id]/page.tsx`, `learning/page.tsx`, `calendar/page.tsx`, `dashboard/page.tsx`
(293 lines), `profile/page.tsx` (343 lines), `settings/page.tsx` (397 lines),
`study-plan/page.tsx` (540 lines), `questions/new` + `questions/[id]/edit`,
`practice/new/page.tsx`. Continuing in the next entry.

---

## 2026-07-05 — Add missing (auth) error boundary + stale-doc batch fix (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing to sweep for real gaps vs. stale backlog entries.

**Real gap found and fixed:** `(auth)` (login/register) had no scoped `error.tsx`, unlike
`(authenticated)` — a render error on the login/register pages would fall all the way
through to `global-error.tsx`, replacing the entire `<html>` instead of just the auth
card content. Added `apps/web/app/(auth)/error.tsx`, mirroring the existing
`(authenticated)/error.tsx` pattern (renders inside the still-mounted `AuthLayout`).

**Large stale-doc batch fix (no code changes, all pre-existing):** verified against
actual code and corrected `BACKLOG.MD` for: MOM-007 (design system — `ui.tsx` primitives
already exist), MOM-009/010/011 (bottom tabs/sidebar/layout — `BottomTabs.tsx`/
`Sidebar.tsx` exist), MOM-013/014 (theme/auth styling — `dark:` variants everywhere),
MOM-015 (PWA manifest — `manifest.ts` exists), MOM-020 (Neon `directUrl` — already
correctly configured, independently re-verified as a P1 item earlier this session too),
MOM-034/036 (markdown renderer/timer hook — both exist), and a stale duplicate MOM-035
line. All of these were done in earlier sessions but never marked, making the backlog
increasingly unreliable as a picture of remaining work — worth a dedicated pass given how
much this pattern kept recurring throughout tonight.

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes).

---

## 2026-07-05 — Make job-detail reminders dismissible too (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** The earlier reminder-system investigation (this session, MOM-079/080) flagged
two read-only reminder displays: the calendar page (fixed already) and the job detail
page (`apps/web/app/(authenticated)/jobs/[id]/page.tsx`, via `job.reminders` from the job
detail payload directly, not `remindersApi`) — not fixed at the time since the calendar
fix was the higher-priority one. Closing the remaining gap now.

**Change:** Added a `dismissReminder` handler (same pattern as calendar/today) and a
Dismiss button next to each reminder in the job detail page's Reminders card.

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes — reused the existing `remindersApi.dismiss()`).

**This closes the last known read-only-reminder gap** — reminders are now dismissible
everywhere they're shown (calendar, Today, job detail).

---

## 2026-07-05 — Show reflection fields back to the user (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** While checking MOM-037/040 (session page/summary split — both already done,
just unmarked), found a real gap: MOM-039's reflection panel lets a user record
`missTags`/`reflectionNote`, but nothing ever displayed that data back — the session
summary and attempt-detail pages only showed `selfRating`. Reflection you can't see again
later isn't much of a reflection loop.

**Changes:**
- `apps/web/app/components/session/ReflectionPanel.tsx` — exported `MISS_TAG_LABELS` (was
  module-private) so other pages can reuse the same human-readable labels.
- `apps/web/app/(authenticated)/practice/session/[id]/summary/page.tsx` — each answered
  question's card now shows miss-tag chips and the reflection note, alongside the
  existing self-rating stars.
- `apps/web/app/(authenticated)/attempts/[id]/page.tsx` — same addition, as a new
  "Reflection" card (only rendered if there's actually a miss-tag or note to show).

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes — the fields were already in `AnswerAttemptResponse` from MOM-028).

**Also verified (no gap found):** MOM-037 (split session page into components) and
MOM-040 (session summary) are both already implemented — `practice/session/[id]/page.tsx`
already composes `SessionHeader`/`AnswerForm`/`AllAnsweredPanel`/`ReviewQuestionCard`, and
the summary route already exists at 238 lines. Both `BACKLOG.MD` entries were stale
(marked NEEDS_REPO_INSPECTION); fixed.

---

## 2026-07-05 — Unify Today into one priority-ranked queue (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** The last item explicitly flagged as "not blocked but not done" across the last
several `NEXT.MD` updates — plan §6.1's fuller vision of a single ranked queue, instead of
three stacked sections (due reviews / recommendations / reminders).

**Design:** kept each source's existing specialized card UI (inline re-rating for
reviews, dismiss for reminders, navigate for recommendations) — only the *arrangement*
changed, from three headed sections to one interleaved list sorted by a computed
priority:
- Due reviews: `200 + min(hoursOverdue, 100)` — reviews rank above everything else by
  default, since spaced-repetition forgetting compounds the longer a due item waits, and
  scale further with how overdue they are.
- Recommendations: unchanged, uses `RecommendationsService`'s existing priority field
  as-is (roughly 50-190 depending on source — mission/task/gap/job/reading).
- Reminders: `150 + min(hoursOverdue, 50)` if already past due (ranks just under
  fresh due-reviews), otherwise a flat low `30` — a reminder that isn't due yet still
  shows (nothing is hidden), but sinks toward the bottom rather than crowding out
  anything actually actionable right now.

**Changes:** `apps/web/app/(authenticated)/today/page.tsx` — replaced the three
`{!loading && !error && X.length > 0 && (...)}` blocks with a `useMemo`-computed,
discriminated-union `QueueEntry[]` sorted descending by priority, rendered via one
`.map()` with a per-`kind` branch. No API changes — purely a client-side merge of data
that was already being fetched in parallel.

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes this pass).

**This closes out every item this session's `NEXT.MD` had flagged as "not blocked but not
yet done."** Remaining backlog items are migration-gated (separate D-004 decisions),
credential-gated, or explicitly deferred pending those (MOM-073/074 AI feedback card).

---

## 2026-07-05 — Wire up the dormant `spaced_review` session type (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing autonomously per user instruction (no further check-ins). While
scanning `/practice/new` for other stale/incomplete pieces, found `spaced_review` had a
session-type label and description in the UI since an early session, but **zero backend
logic** — selecting it just fell through to the generic random-filtered draw, mislabeled.

**Fix:** No backend change needed — `sessions.service.ts`'s `create()` already supports
an exact `questionIds` list (`selectExactQuestions`), unused for this purpose until now.
- `apps/web/app/(authenticated)/practice/new/page.tsx` — when `sessionType ===
  'spaced_review'` is selected, fetches `reviewsApi.due()`, hides the topic/company/
  difficulty/questionCount/role-filter fields (the set is fixed to what's due, not
  filtered), shows a preview (count + first 5 titles), and submits
  `sessionsApi.create({ sessionType, questionIds: <due question ids>, questionCount:
  <due count> })` instead of the filtered-draw path. Submit is disabled while fetching or
  when nothing is due. Description text updated to reflect real behavior.

**Verification:**
- `pnpm lint`/`typecheck`/`build`: green (hit and fixed one `react-hooks/set-state-in-
  effect` lint error, same pattern as elsewhere in this codebase — added the matching
  eslint-disable comment).
- **Live round trip**: seeded two `selfRating: 1` reviews (Again grade → due almost
  immediately), polled until both appeared in `GET /reviews/due`, then created a real
  session via the exact `POST /sessions` call the new UI makes
  (`sessionType: 'spaced_review', questionIds: [...]`), confirmed both questions were
  included in the session in order. Cleaned up all test data afterward.

**Docs updated:** `BACKLOG.MD` — this had no MOM number (discovered gap, not a
pre-catalogued task), documented inline; also fixed MOM-042 (Today learning cards),
another stale BLOCKED entry whose blockers (MOM-012, MOM-032) were both already done.

---

## 2026-07-05 — MOM-039: reflection panel UI (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Unblocked immediately by MOM-028. Pure web UI work — the API side (schema,
DTO validation, persistence) was already built and live-verified in the MOM-028 commit.

**Changes:**
- New `apps/web/app/components/session/ReflectionPanel.tsx` — collapsed by default
  behind a "+ Add reflection (optional)" toggle (matches the low-friction spirit of the
  existing optional self-rating); expands into miss-tag chips (one per
  `MISS_TAG_REASONS` value, human-readable labels — e.g. `time_pressure` → "Ran out of
  time") and a short free-text note.
- `apps/web/app/components/session/AnswerForm.tsx` — added `missTags`/`onMissTagsChange`/
  `reflectionNote`/`onReflectionNoteChange` props, renders `ReflectionPanel` between the
  self-rating row and the submit/previous buttons.
- `apps/web/app/(authenticated)/practice/session/[id]/page.tsx` — added
  `missTags`/`reflectionNote` state, included in the `sessionsApi.answer()` call
  (only sent if non-empty, mirroring how `selfRating: 0` is treated as "not set"),
  cleared after each successful submit alongside `selfRating`.
- `apps/web/app/lib/api-client.ts` — `sessionsApi.answer()`'s body type extended with
  the four MOM-028 fields.

**Verification:** `pnpm typecheck`/`lint`/`build`: green (32+ web routes). `pnpm test`:
68/68 (no API changes this pass). No fresh live HTTP round trip — the exact API call
shape (`missTags`/`reflectionNote`/`language`/`complexity` on `POST /sessions/:id/
answer`) was already verified against a real Postgres instance in the MOM-028 commit
moments earlier; this pass only adds the UI that constructs that same request.

**This completes MOM-028→039**, the last item on tonight's approved-migration chain.

---

## 2026-07-05 — MOM-028: attempt reflection fields, human-approved (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Trigger:** User approved a second migration ("i approve") in response to being asked
about MOM-028 specifically. Treated as a distinct D-004 approval from the earlier
ReviewState one — a different migration, not covered by blanket prior consent.

**Design (from DECISIONS.MD D-003's existing MOM-028 inspection outcome, already
recorded in an earlier session):** add exactly the four genuinely-missing fields —
`missTags String[] @default([])`, `reflectionNote String?`, `language String?`,
`complexity String?` — to `AnswerAttempt`. Found the intended `missTags` taxonomy in
`docs/plans/MOMITO_REDESIGN_PLAN_V2.md` §5.4 (`WeaknessSignal.reason`): `misread |
wrong_pattern | edge_case | time_pressure | blank | implementation_bug | concept_gap |
communication_gap | tradeoff_gap` — not previously defined anywhere in the codebase.

**Changes:**
- `packages/shared/src/index.ts` — added `MISS_TAG_REASONS`/`MissTagReason`; extended
  `AnswerAttemptResponse` with the four new optional fields.
- `apps/api/prisma/schema.prisma` — added the four columns to `AnswerAttempt`, with a
  comment explaining `missTags` isn't DB-constrained to the taxonomy (validated at the
  DTO layer instead, consistent with how `correctness` is handled).
- `prisma migrate dev --name add_attempt_reflection_fields` — purely additive
  (`ALTER TABLE ... ADD COLUMN`, all nullable/defaulted), matching every prior migration's
  shape in this repo. Applied to the same real Postgres instance used for tonight's
  ReviewState migration.
- `apps/api/src/sessions/dto/create-answer.dto.ts` — added the four fields:
  `missTags?: MissTagReason[]` validated with `@IsArray() @ArrayMaxSize(...) @IsIn(...,
  { each: true })` against the taxonomy; `reflectionNote`/`language`/`complexity` as
  length-capped optional strings. **No `sessions.service.ts` change needed** —
  `answer()` already does `data: { ...dto, sessionId, userId }`, so the new fields flow
  through automatically once the DTO and schema both have them.
- New `apps/api/test/create-answer.dto.spec.ts` (3 tests: accepts valid taxonomy tags,
  rejects an out-of-taxonomy tag, rejects an over-length reflection note). Hit and fixed
  a `Reflect.getMetadata is not a function` error — this app relies on `@nestjs/common`/
  `@nestjs/core`'s own imports to transitively polyfill `reflect-metadata` (no explicit
  `import 'reflect-metadata'` in `main.ts`), so a standalone DTO test that doesn't import
  any Nest package needs that import itself; added it explicitly to the new test file.

**Verification:**
- `pnpm test`: 68/68 (was 65). `pnpm typecheck`/`lint`/`build`: green across all 3
  packages. `pnpm content:validate`: 0 errors.
- **Live round trip**: created a real session, submitted a real answer via
  `POST /sessions/:id/answer` with all four fields populated
  (`missTags: ["time_pressure", "edge_case"]`, a `reflectionNote`, `language:
  "typescript"`, `complexity: "O(n)"`), confirmed all four persisted correctly in the
  response. Separately confirmed an out-of-taxonomy miss tag (`"gave_up"`) is rejected
  with 400 and the correct validation message. Cleaned up all test data afterward.
- Killed lingering Momito node processes via `Get-CimInstance`/`Stop-Process` filtered by
  command line before each pipeline re-run, avoiding the `EPERM` lock issue from earlier.

**Docs updated:** `DECISIONS.MD` D-003 (implementation outcome appended), `BACKLOG.MD`
(MOM-028 → done, notes MOM-039 is now unblocked).

**Not done, deliberately:** MOM-039 (reflection panel UI) itself — that's the natural
next PR now that the fields exist, but is a separate unit of web work, not bundled here.

---

## 2026-07-05 — MOM-032 follow-up: inline "Review now" action on Today (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Per `NEXT.MD`'s own identified next step — closing the loop so a due review
can be re-rated without leaving `/today` or starting a full session.

**Changes:**
- `apps/web/app/lib/api-client.ts` — added `reviewsApi.record(objectType, objectId,
  selfRating)`, calling the existing `POST /reviews/:objectType/:objectId` (no new API
  work needed — MOM-029 already built this endpoint).
- `apps/web/app/(authenticated)/today/page.tsx` — each due-review card now has a
  "Review now" button that expands an inline 1-5 rating row (matching the existing
  self-rating star pattern used in `AnswerForm`); picking a rating calls
  `reviewsApi.record()` directly and refetches, so a rescheduled item immediately
  disappears from the due list.

**Verification:**
- `pnpm typecheck`/`lint`/`build`: green. `pnpm test`: 65/65 (no API changes this pass —
  purely a web-side wiring of an already-tested endpoint).
- **Live round trip**: recorded an initial `selfRating: 1` review, polled until due,
  then called the same endpoint the new "Review now" button calls with `selfRating: 5`,
  confirmed the item rescheduled ~1 day out (`reps: 2`, `state: 2`) and immediately
  disappeared from `GET /reviews/due`.
- Cleaned up test data; killed all lingering Momito node processes this time via
  `Get-CimInstance`/`Stop-Process` filtered by command line, rather than per-PID
  `taskkill`, avoiding the repeated `EPERM` lock issue from earlier in this session.

**This is the practical end of tonight's Learning Loop push.** The remaining `/today`
gap (merging reviews/recommendations/reminders into one ranked queue, per the plan's
fuller §6.1 vision) is a real but separate follow-up, not required for the loop to work.

---

## 2026-07-05 — MOM-032: due reviews on Today (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Closing out the P2 Learning Loop chain from this session: MOM-026→027→029→030→
031→032, each unblocking the next. This is the last piece — surfacing due reviews where a
user actually sees them.

**Changes:**
- `packages/shared/src/index.ts` — `ReviewStateResponse` gained a `title: string | null`
  field, populated for display purposes only.
- `apps/api/src/reviews/reviews.service.ts` — `listDue()` now does a second batched
  `question.findMany({ where: { id: { in: questionIds } } })` lookup for `question`-type
  due rows and merges titles in (can't join directly — `objectId` has no FK, by design,
  per ADR-0002). `record()`'s response leaves `title: null` (unnecessary there — the
  client already knows which question it just reviewed).
- `apps/web/app/lib/api-client.ts` — added `reviewsApi.due()`.
- `apps/web/app/(authenticated)/today/page.tsx` — fetches recommendations, reminders, and
  due reviews in parallel (`Promise.all`); renders a new "Due for Review" section above
  reminders, each card linking to `/questions/:id` (the existing read-only detail/
  reference-answer page — reviewing here means re-reading the question and its reference
  answer, not necessarily a full timed session). Updated the empty-state check to also
  require zero due reviews.
- `apps/api/test/reviews.service.spec.ts` — updated the existing `listDue` test for the
  new `question.findMany` call, added a new test asserting title enrichment.

**Verification:**
- `pnpm test`: 65/65 (unchanged count — one test updated, one added, net even after
  accounting for the earlier MOM-031 additions). `pnpm typecheck`/`lint`/`build`: green
  across all 3 packages (32+ web routes). `pnpm content:validate`: 0 errors.
- **Live round trip**: recorded a review via `POST /reviews/question/:id` with
  `selfRating: 1` (Again grade → ~1 minute relearning step), then polled
  `GET /reviews/due` every 10s until the due time passed, confirming the response
  included `"title":"Transaction isolation anomalies"` — the enrichment lookup works
  correctly end to end.
- Cleaned up all test `ReviewState` rows created during manual verification afterward.

**Housekeeping note:** hit repeated `EPERM` errors regenerating the Prisma client during
this task's verification passes — traced to **four** leftover `pnpm dev`/`nest start
--watch` process pairs plus one compiled `dist/main` server, all orphaned from earlier
manual E2E checks in this session (background `pnpm dev` launches whose `taskkill`s only
killed the wrapper process, not the actual `nest`/compiled child holding the Prisma
client file open). Found and killed all of them via `Get-CimInstance Win32_Process` +
`Stop-Process`, which cleared the lock permanently. Worth remembering for any future
manual E2E verification in this Windows sandbox: `taskkill //F //PID <wrapper>` is not
enough for `nest start --watch`; use `//T` (tree-kill) or find the actual listening PID
via `netstat`, not the process that launched it.

**This closes the Learning Loop groundwork this session set out to unblock.** `/today`
now shows three real, independently-useful sections (due reviews, recommendations,
reminders) instead of a static stub — not yet the single unified priority queue plan
§6.1 ultimately wants, but a genuine, working version of the loop: answer with a
self-rating → FSRS schedules a review → it surfaces on Today when due → reviewing it
(via `/questions/:id` today, a full review UI later) → back to Today.

---

## 2026-07-05 — MOM-031: hook answer submission into FSRS scheduling (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing straight from MOM-027/029 now that they're unblocked. This is the
step that actually makes the review loop *real* — until now, `ReviewState` rows only got
created via the standalone `/reviews` endpoint; nothing in the normal practice-session
flow touched them.

**Changes:**
- `apps/api/src/sessions/sessions.service.ts` — injected `ReviewsService`; `answer()` now
  calls `this.reviews.record(userId, 'question', dto.questionId, dto.selfRating)` right
  after creating the `AnswerAttempt`, but only when `dto.selfRating` is defined (it's
  optional on `CreateAnswerDto` — no rating means FSRS has no grade to schedule from).
  Wrapped in try/catch with `Logger.warn` on failure, matching the existing project
  principle (seen in the AI-feature docs) that a secondary feature's failure must never
  break the primary action — here, answer submission always succeeds even if scheduling
  doesn't.
- `apps/api/src/sessions/sessions.module.ts` — imports `ReviewsModule`.
- `apps/api/src/reviews/reviews.module.ts` — now `exports: [ReviewsService]` so other
  modules can inject it.
- `apps/api/test/sessions.service.spec.ts` — updated all 8 existing `new SessionsService(...)`
  call sites for the new second constructor argument, plus 3 new tests: fires
  `reviews.record` with a selfRating, doesn't fire without one, and the attempt is still
  returned even if `reviews.record` rejects.

**Verification:**
- `pnpm test`: 64/64 (was 61). `pnpm typecheck`/`build`/lint: all green.
- **Live round trip**: started the dev server again (hit and resolved a second
  Windows-specific `EADDRINUSE` — a prior server instance had survived an earlier
  `taskkill` on a different PID than the one actually bound to port 3001; found the real
  PID via `netstat` and killed that one instead), logged in as the demo user, created a
  real practice session via `POST /sessions`, submitted a real answer with
  `selfRating: 4` via `POST /sessions/:id/answer`, and confirmed directly in Postgres that
  a `ReviewState` row now exists for that user/question with FSRS-scheduled values
  (`stability: 2.3065`, `state: 1` Learning, `reps: 1`, due ~10 minutes out for a
  first-time Good-grade review). Cleaned up all test data (session, answer, review state)
  afterward.

**Docs updated:** `BACKLOG.MD` (MOM-031 → done, MOM-032 → ready).

**Next:** MOM-032 (Today API surfacing due reviews) is now the natural next step —
`GET /reviews/due` already exists; the work left is merging it into `/today`'s existing
recommendations+reminders feed.

---

## 2026-07-05 — MOM-027/029: ReviewState migration + Reviews module, human-approved (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Trigger:** The user explicitly approved crossing the D-004 human-approval gate ("do it
as you wish but follow strictly with the plan"), unblocking MOM-027 for the first time
this session. ADR-0002/SPIKE-003 (design) and MOM-030 (FSRS algorithm) were already done
from earlier in this session — this closes the loop by implementing the actual migration
and wiring it to real persistence.

**Environment note:** Docker isn't available in this sandbox (established earlier in the
session), but a Postgres instance turned out to be reachable directly on `localhost:5432`
with the credentials already in `apps/api/.env` — confirmed via `prisma db pull` before
proceeding. This let the whole migration be verified against a real database, not just
mocked.

**MOM-027 — schema + migration, exactly per ADR-0002:**
- Added `model ReviewState` to `apps/api/prisma/schema.prisma` — polymorphic
  `objectType`/`objectId` (no FK on `objectId`, by design), `@@unique([userId, objectType,
  objectId])`, `@@index([userId, due])`. Added a `user User @relation(...)` +
  `@@map("review_states")`, consistent with every other model's convention (ADR-0002's
  illustrative snippet omitted the User relation, but that wasn't a deliberate design
  choice to deviate from — followed repo convention here).
  Also added the `reviewStates ReviewState[]` back-relation on `User`.
- `prisma migrate dev --name add_review_state --create-only`, then hand-edited the
  generated `migration.sql` to append the SPIKE-003 partial index:
  `CREATE INDEX ... ON review_states(user_id, due) WHERE NOT suspended`.
- Applied the migration (`prisma migrate dev`) — purely additive, no data loss, matching
  ADR-0002's prediction.
- `apps/api/src/questions/questions.service.ts`'s `remove()` now wraps the delete in
  `prisma.$transaction([reviewState.deleteMany(...), question.delete(...)])` — the orphan
  fix SPIKE-003 scoped into this same PR. Added a regression test in
  `test/questions.service.spec.ts` (also had to update the existing 409-on-delete test's
  mock shape, since `remove()` no longer calls `question.delete` directly).

**MOM-029 — Reviews module, wiring MOM-030's FSRS scheduler to real persistence:**
- `packages/shared/src/index.ts` — added `ReviewStateResponse`, reusing the *existing*
  `ReviewableObjectType` union (found already defined for the MOM-022/023 Knowledge Kernel
  work — `question | story | system_design_case | behavioral_prompt | cs_card` — instead
  of declaring a conflicting duplicate, which briefly broke `@momito/shared`'s build until
  caught and fixed).
- New `apps/api/src/reviews/{reviews.service,reviews.controller,reviews.module}.ts` +
  `dto/record-review.dto.ts`. `ReviewsService.record()` only allows `objectType: 'question'`
  today (the only type with a real reviewable table so far) — get-or-creates a
  `ReviewState`, runs it through `fsrs-scheduler.ts`, upserts. `listDue()` runs the
  `due <= now AND NOT suspended` query the Today queue will eventually use.
  `GET /reviews/due`, `POST /reviews/:objectType/:objectId`. Registered in `app.module.ts`.
- New `test/reviews.service.spec.ts` (4 tests): rejects unsupported types before touching
  the DB, creates fresh state with FSRS defaults, schedules from existing state on repeat
  review (not resetting it), and the due-query shape.

**Verification — both mocked and live:**
- `pnpm test`: 61/61 (was 57 before this task: +1 questions.service orphan test, +4
  reviews.service tests, -1 net from the existing delete-test's mock rewrite not adding a
  net-new file). `pnpm typecheck`/`lint`/`build`: all green across all 3 packages.
- **Live round-trip against real Postgres** (not just unit tests): wrote and ran a
  throwaway script creating a `Question` + `ReviewState`, deleting the question through
  the exact same `$transaction` shape as the service, confirming zero orphaned
  `ReviewState` rows remained and the partial index (`review_states_user_due_active_idx
  ... WHERE NOT suspended`) exists via `pg_indexes`.
- **Live HTTP verification**: started the API dev server (had to `export` `.env` into the
  shell manually first — this NestJS app doesn't auto-load `.env` itself, only the Prisma
  CLI does that), logged in as the seeded demo user, and called the real endpoints:
  `POST /reviews/question/:id` with `selfRating: 5` scheduled ~8 days out (Easy grade,
  `state: 2` Review); `selfRating: 1` scheduled a ~1-minute relearning step (`state: 1`
  Learning), matching `ts-fsrs`'s real behavior; `POST /reviews/story/:id` correctly
  returned 400 for the unsupported type. Cleaned up all test data (`ReviewState` rows)
  created during this manual check afterward.
- Hit one Windows-specific hiccup: after killing the dev server, `prisma generate` failed
  with `EPERM` renaming the query engine `.dll.node` because a second lingering process
  was still holding port 3001 (nest's watch mode had spawned a second process beyond the
  one first killed) — found and killed it via `netstat`/`taskkill`, then the pipeline
  passed cleanly.

**Docs updated:** `docs/adr/0002-...md` (status → Implemented), `DECISIONS.MD` (D-005
outcome note), `BACKLOG.MD` (MOM-027/029 → done, MOM-030 note updated, MOM-031/032 → now
READY instead of BLOCKED, since their blocker is resolved).

**Explicitly not done, and why:** MOM-031 (hook answer submission into scheduling) and
MOM-032 (Today API surfacing due reviews) are the natural next steps and are now
genuinely unblocked, but weren't done in this same PR to keep this migration-crossing
change reviewable on its own. Continuing to MOM-031 next.

---

## 2026-07-05 — Stale-doc cleanup + final verification (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** After MOM-033/038/078/079/080, did a final sweep for any other backlog entries
that looked stale (marked NEEDS_REPO_INSPECTION/blocked from an earlier audit but likely
already done given how much has shipped since). Verified and marked done:
- **MOM-061** (role tracks) — `CAREER_ROLE_TRACKS` already has 10 tracks; backlog said 4.
- **MOM-081** (jobs mobile-first list) — `jobs/page.tsx` already a single-column,
  filterable card list, no drag-drop.
- **MOM-082** (career hub) — `career/page.tsx` already shows readiness bars, role track
  selection, and goals.
No code changes for these three — docs-only corrections against already-shipped work.

**Searched for remaining TODO/FIXME/stub markers** across `apps/web/app` and
`apps/api/src` — none found (the one `'todo'` match is the Task status enum value, not a
code comment).

**Final full-pipeline verification:** `pnpm lint` ✅ (3/3 projects), `pnpm typecheck` ✅
(3/3), `pnpm build` ✅ (32 web routes, api + shared build clean), `pnpm test` ✅ (56/56),
`pnpm content:validate` ✅ (0 errors, 382 questions, unchanged this session).

**State of the backlog after this session's 6 commits (MOM-035, P1 partial-correctness
fix, MOM-026/SPIKE-003, MOM-030/SPIKE-004, MOM-033, MOM-038, MOM-078/079/080, plus this
doc cleanup):** every remaining open backlog item is now genuinely blocked on one of three
things this agent cannot resolve unattended:
1. **Human approval for a schema migration** (D-004) — MOM-027 (ReviewState) is fully
   designed and ready; MOM-069 (AiUsage), MOM-075 (Task consolidation), MOM-063 (Story) are
   spike-gated the same way.
2. **Credentials/external services** — MOM-021 (deploy), MOM-068+ (AI feedback engine),
   MOM-049 (LeetCode import), MOM-087 (backup workflow).
3. **A running Docker/Postgres instance in this environment**, which isn't available —
   blocks manually verifying the Golden Path (MOM-090) and would block any task requiring
   live DB interaction beyond unit tests.
No further autonomous progress is possible without the user resolving one of these three
gates. Reported this back to the user rather than inventing further busywork.

---

## 2026-07-05 — MOM-079/080: reminder dismiss UI on calendar + Today (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing autonomously per user instruction (no further per-task check-ins
required; still honoring the standing gates — no schema migrations without explicit
approval, no credential-dependent features). Used an Explore subagent to inspect the
Reminder feature's current state first, since `BACKLOG.MD`'s MOM-078/079/080 entries
looked stale/speculative ("no cron infra found", "route mismatch").

**Correction to the subagent's finding:** it initially claimed `apps/web/lib/api-client.ts`
calls `/reminders` while the backend only serves `/tasks/reminders`, calling this a live
404 bug. I verified this myself against `apps/api/src/tasks/tasks.controller.ts` before
acting: the controller is `@Controller()` with **no base path**, so `@Get('reminders')`
and `@Post('reminders/:id/dismiss')` really are `/reminders` and `/reminders/:id/dismiss`
— exactly matching the frontend client. **No route mismatch exists.** Worth recording:
always verify a subagent's specific file/line claims before acting on them, especially
when the fix would touch working code.

**Real findings, confirmed:**
- MOM-078: due-delivery is already correctly just a query-time filter
  (`status: 'pending' AND dueAt <= now`); no `@nestjs/schedule`/cron is installed or
  needed, since there's no push-notification requirement — poll-on-fetch is sufficient by
  design. Marked resolved, not a gap.
- The actual gap: reminders were fetched and displayed read-only in two places (calendar
  page's Reminders aside, job detail page) but **never dismissible from the UI**, and
  never surfaced on `/today` at all.

**Changes:**
- `apps/web/app/(authenticated)/calendar/page.tsx` — added a `dismissReminder` handler
  (mirrors the existing `complete`/`snooze` pattern) and a Dismiss button on each
  Reminders card.
- `apps/web/app/(authenticated)/today/page.tsx` — now fetches `remindersApi.list()`
  alongside `recommendationsApi.list()` (parallel `Promise.all`) and renders a Reminders
  section above the recommendation queue, with the same Dismiss action. Empty-state card
  now checks both `items` and `reminders` are empty before showing "nothing urgent."

**Checks:** `pnpm --filter @momito/web typecheck/lint/build` ✅ (32 routes), `pnpm test` ✅
(56/56, unaffected — web-only change).

**Docs updated:** `BACKLOG.MD` — MOM-078 marked resolved (no scheduler needed), MOM-079
marked done (UI gap, not API gap), MOM-080 marked done for the Today half (top-bar
badge/bell still open, smaller follow-up).

---

## 2026-07-05 — MOM-038: split AnswerForm into per-question-type panels (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Unblocked now that MOM-034 (markdown) and MOM-035 (CodeMirror) are both done.
Pure refactor, no behavior change, per its own acceptance criteria.

**Change:** Extracted `AnswerForm.tsx`'s three inline answer surfaces into
`apps/web/app/components/session/answer-panels/`:
- `TextAnswerPanel.tsx` — the plain textarea (every non-special type).
- `SystemDesignAnswerPanel.tsx` — the MOM-057 7-section template button + Edit/Preview
  toggle + markdown preview, moved verbatim.
- `CodeAnswerPanel.tsx` — the MOM-035 `next/dynamic(..., { ssr: false })`-wrapped
  CodeMirror editor, moved verbatim (dynamic import path adjusted for the new directory).

`AnswerForm.tsx` now just picks one of the three based on `question.type` and no longer
holds `showPreview` state or the `SYSTEM_DESIGN_TEMPLATE` import itself — both moved into
`SystemDesignAnswerPanel`.

**Checks:** `pnpm --filter @momito/web typecheck/lint/build` ✅ (32 routes), `pnpm test` ✅
(56/56, unaffected — web-only change).

---

## 2026-07-05 — MOM-033: Today integration for recommendations (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Per user instruction, proceeding autonomously through the backlog without
further per-task check-ins (still honoring the standing gates: no schema migrations
without explicit human approval, no credential-dependent features, verify+commit each
PR-sized unit).

**Finding:** MOM-033's reason-taxonomy half was already implemented in an earlier session
(`RECOMMENDATION_REASONS` in `apps/api/src/recommendations/recommendations.service.ts`,
already consumed by the Dashboard's "Next Actions" card via `DashboardSummaryResponse`).
The "Today integration" half was not: `apps/web/app/(authenticated)/today/page.tsx` was
still the MOM-012 static stub with zero data fetching.

**Change:** Rewrote `today/page.tsx` as a client component calling the existing
`recommendationsApi.list()` (no new endpoint, no duplicate field — reused exactly what the
Dashboard already calls), rendering the priority-sorted recommendation queue (missions,
overdue tasks, readiness gaps, job deadlines, reading inbox) as clickable cards routing to
each item's `targetHref`, with loading/error states matching the Dashboard's pattern.
Explicitly noted in a comment that this is the "closest currently available path," not
the final decision-engine queue — spaced-repetition due-reviews still can't appear here
until MOM-027 (ReviewState migration, human-gated) and MOM-032 (Today API) land.

**Checks:** `pnpm --filter @momito/web typecheck/lint/build` ✅ (32 routes, no errors),
`pnpm test` ✅ (56/56, unaffected — web-only change).

---

## 2026-07-05 — MOM-030 / SPIKE-004: FSRS scheduling algorithm (CLAUDE, session 4)

**Actor:** CLAUDE (implementer)
**Scope:** Continuing `AGENTS.MD`'s P2 order after MOM-026/SPIKE-003. Verified `ts-fsrs`'s
real API (installed it in a throwaway scratch dir, read its `.d.ts`) before writing
against it, since AGENTS.MD explicitly requires that for third-party SDKs.

**Findings:** `ts-fsrs`'s `Card`/`State` shape maps almost 1:1 onto ADR-0002's planned
`ReviewState` columns — `stability`, `difficulty`, `due`, `reps`, `lapses`,
`last_review`, and critically its `State` enum (New=0/Learning=1/Review=2/Relearning=3)
exactly matches the planned `state: Int` column, so no extra state-code translation layer
is needed. `fsrs().next(card, now, grade)` is the core scheduling call.

**Implementation:** `apps/api/package.json` — added `ts-fsrs`. New
`apps/api/src/reviews/fsrs-scheduler.ts` — pure functions only, no NestJS
module/controller (nothing to inject into yet, no `ReviewState` table):
- `createInitialReviewState(now)` — new-card defaults via `ts-fsrs`'s `createEmptyCard`.
- `selfRatingToGrade(selfRating)` — maps the existing 1-5 star `selfRating` scale onto
  FSRS's 4 grades (1→Again, 2→Hard, 3→Good, 4→Good, 5→Easy); recorded as **D-010** in
  `DECISIONS.MD` since AGENTS.MD warns against silently changing scoring semantics. The
  existing `selfRating` column/UI/other consumers (dashboard, DSA/mission heuristics) are
  untouched — this mapping is scoped to the FSRS scheduler only.
- `scheduleNextReview(current, selfRating, now)` — the actual scheduling step, operating
  on/returning plain `ReviewCardState` objects (not Prisma models, since none exist yet).

New `apps/api/test/fsrs-scheduler.spec.ts` (4 tests): initial-state defaults, the
self-rating→grade mapping, that a higher rating schedules further out than a lower one,
and that grading "Again" after a completed review increments `lapses`.

**Checks:** `pnpm --filter @momito/api test` ✅ (56/56, was 52), `pnpm --filter @momito/api
typecheck` ✅, `pnpm --filter @momito/api build` ✅.

**Explicitly not done:** no NestJS module/controller/endpoint (nothing to wire to —
`ReviewState` doesn't exist), no persistence, no hook into `sessions.service.ts`'s answer
submission. That's MOM-031, blocked on MOM-027's human-approved migration landing first.

**Docs updated:** `BACKLOG.MD` (MOM-030 → done/algorithm-only, SPIKE-004 → done),
`DECISIONS.MD` (new D-010).

---

## 2026-07-05 — MOM-026 / SPIKE-003: ReviewState migration design finalized (CLAUDE, session 4)

**Actor:** CLAUDE (implementer, design-only task — no schema.prisma touched)
**Scope:** Per `AGENTS.MD`'s P2 priority (Learning Loop), the first actionable step is
designing the ReviewState migration so a human can approve implementation. ADR-0002 already
had the shape decision (D-005); SPIKE-003's three open questions were still unanswered.

**Findings (full detail in `docs/adr/0002-reviewstate-polymorphic-object-reference.md`):**
1. Migration is purely additive (`CREATE TABLE review_states` only, no `ALTER`/backfill on
   existing tables) — confirmed against the shape of the three most recent migrations in
   `apps/api/prisma/migrations/`. Safe on both fresh and existing DB.
2. Real orphan risk found: `apps/api/src/questions/questions.service.ts`'s `remove()` hard-
   deletes a `Question` with no FK from `ReviewState.objectId` (by design, polymorphic).
   MOM-027 must ship a transactional `reviewState.deleteMany({ where: { objectType, objectId
   } })` alongside every reviewable-object delete, as part of that same PR, not a follow-up.
3. Today's queue query (`due <= now() AND NOT suspended`) needs a Postgres partial index —
   Prisma's schema DSL can't express `WHERE NOT suspended` directly, so it must be added as
   raw SQL appended to the generated `migration.sql`.

**Docs updated:** `docs/adr/0002-reviewstate-polymorphic-object-reference.md` (SPIKE-003
findings section + status), `docs/agent/DECISIONS.MD` D-005 (outcome note),
`docs/agent/BACKLOG.MD` (MOM-026 → DONE, MOM-027 status clarified as ready-but-human-gated,
SPIKE-003 row marked done, MOM-063 clarified as a separate still-open Story-schema spike).

**Not a migration** — `schema.prisma` untouched, per D-004/standing hands-off zone.

**Next:** MOM-027 (the actual migration + service code) needs explicit human approval before
proceeding. Meanwhile MOM-030 (SPIKE-004: `ts-fsrs` real API/scheduling semantics) is
independently unblocked and doesn't touch schema — reasonable next step.

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

## 2026-07-07 — Post-redesign production-readiness pass (CLAUDE, autonomous overnight run)

**Actor:** CLAUDE (implementer, autonomous — user asleep, scheduled wake-up at token reset)
**Trigger:** User asked to judge the app against REDESIGN_PLAN.MD/V2 again, identify what's
left to improve for production readiness, and — separately — build push notifications
(initially assumed a Flutter rewrite was needed for this; corrected mid-conversation: iOS
16.4+ supports Web Push for installed PWAs, and the target iPhone X runs up to iOS 16.7).

**Method:** Three parallel research agents (docs/agent hygiene audit, API production-
readiness audit, web UX/quality audit including root-causing the dark-mode bug via a
compiled dev-vs-prod CSS diff) fed into a plan, approved, then executed as 6 phases, each
committed and verified separately (lint+typecheck+test+build, plus live round-trips against
the local Postgres instance via curl/Playwright).

**First action of the session:** discovered the *entire* prior session's uncommitted work
(Story Bank, AI grading scaffold, StudyPlanItem→Task merge, PWA offline support, deploy
scaffolding, streak, markdown highlighting — several thousand lines across ~70 files) sitting
in the working tree despite being tested and narrated as "done" in earlier LOG.MD entries.
Recovered all of it in two honestly-labeled `recover:` commits before starting new work,
including surgically splitting a handful of files (`schema.prisma`, `common/config.ts`,
`package.json`, `.env.example`, `app.module.ts`, `test/config.spec.ts`) that mixed prior
uncommitted hunks with this session's own new additions — temporarily reverted this
session's hunks, committed the recovered prior work, reapplied, committed separately.
**Lesson reinforced: commit far more often; don't let real working code sit uncommitted.**

**Phase 0 — dark-mode fix:** root cause was `@custom-variant dark` in `globals.css` sitting
after a foreign `@import`/`@plugin`, silently dropped by Turbopack's dev CSS pipeline (prod
`next build` compiled it fine). Moved the line; added a pre-hydration theme script + kept
its hydration-mismatch warning quiet via `suppressHydrationWarning`; made CodeMirror follow
the app theme. Live-verified via Playwright: background genuinely toggles now.

**Phase 1 — Web Push (MOM-092):** `PushSubscription` model (reused the existing
`Reminder.lastTriggeredAt` field to dedupe sends, no new column needed); `apps/api/src/push/`
(service/controller/`@Cron` scheduler); `sw.js` push/notificationclick handlers;
`push-settings-card.tsx` mirroring the AI-feedback-card's hidden-when-unavailable pattern.
14 zero-network tests. Live-verified with a self-generated VAPID keypair.

**Phase 2 — API hardening (MOM-093/094/095/098/099/100):** `enableShutdownHooks()`;
`User.tokenVersion` real token revocation (logout now actually revokes, live-verified:
old token → 401 after logout, new login still works); API ESLint wired into CI for the
first time (found + fixed 2 real issues); verified (not just assumed) the `aiScore` 0–1
scale is consistent across `dsa.service.ts`/`missions.service.ts`/`ai.service.ts` and pinned
it with regression tests; closed a narrow AI-budget check-and-reserve race via an atomic
conditional `updateMany`; added a composite `(userId, createdAt)` index for the dashboard's
hot query path.

**Phase 3 — Web UX/a11y (MOM-096):** 401 auto-logout via a `momito:unauthorized` window
event; debounced questions search (was 1 request/keystroke) + URL-persisted filters;
optimistic updates (verified ~100ms perceived latency) on Today's dismiss/review-rate and
Calendar's complete/snooze/dismiss; labeled previously-unlabeled form controls; made `Card`
keyboard-reachable; added `dark:` variants to `Badge`/`Pagination`; `ReminderBell` now polls
instead of fetching once; new `Skeleton`/`ListSkeleton` primitives.

**Phase 4 — frontend tests (MOM-097):** `apps/web` had zero tests. Added vitest +
`@testing-library/react` + jsdom (skipped `@vitejs/plugin-react` — a vite version conflict
in this monorepo; tsconfig's `jsx: react-jsx` is sufficient without it). 20 tests. Caught a
real bug in the *test* itself while writing the session-page test: a non-memoized
`useRouter` mock caused an infinite fetch loop by changing a `useCallback`'s dependency
identity every render — a test-mock artifact (real Next's router is stable), documented and
fixed rather than silently worked around.

**Phase 5 — docs hygiene:** reconciled the BACKLOG.md-vs-NEXT.MD contradiction on
MOM-068–074's status; fixed a dangling "ADR-0009" citation (never existed) in SPIKE-002;
fixed `AGENTS.MD`'s wrong plan filename; added a superseded-notice header to root
`REDESIGN_PLAN.MD` pointing at V2 + BACKLOG.md; rewrote `NEXT.MD`; logged this entry.

**Checks run per phase:** `pnpm --filter @momito/api {lint,typecheck,test,build}`,
`pnpm --filter @momito/web {lint,typecheck,test,build}`, live curl/Playwright round-trips
against a locally running API (port 3001) + web (port 3000) against the local Postgres.
Final full-monorepo `pnpm -r test`: **132 API tests + 20 web tests, all green.**

**Result:** 6 commits (`fix(web): dark mode...`, `feat(api): Web Push...`,
`feat(web): Web Push...`, `feat(api): production hardening...`,
`feat(web): UX and accessibility polish`, `test(web): frontend test foundation`), plus the
2 `recover:` commits for prior-session work. All pushed to local `main` (not remote — no
`git push` performed this session).

**Genuinely still open, not avoided:** MOM-021 (deploy, needs real hosting credentials),
MOM-068–074's live-key verification (needs a real `ANTHROPIC_API_KEY`), MOM-092's real iOS
push-receive path (needs the real HTTPS deploy), MOM-088's Lighthouse audit (needs a
deployed origin), MOM-049 (LeetCode import, disclosed judgment call), and the V2 plan's
`WeaknessSignal`/quality-gating vision chunk (net-new feature depth, not a readiness gap —
flagged for a future scoped plan, not started).

---

## 2026-07-07 — Learning-loop integrity: reveal-then-rate, real Today recall, live weakness engine

**Diagnosis first, code second.** Read the full repo against plan §7.2's attempt lifecycle
(`Submit → Reveal reference → Reflect → Rate → Schedule`) and found the loop implemented
*out of order* in three places: (1) sessions asked for self-rating and miss-tags **before**
the reference answer was ever shown — and never showed it at all, in-session or after; (2)
Today's "Review now" expanded into bare 1-5 buttons — a grade with no prompt, no recall, no
reveal; (3) `missTags` (§5.4 WeaknessSignal taxonomy, MOM-028) were written but read by
nothing — the prior session's log itself flagged this chunk as "not started". Blind grades
degrade FSRS scheduling; unread reflections make the reflection UI theater.

**Phase 1 — shared:** `MISS_TAG_LABELS` moved to `@momito/shared` (API recommendation
reasons now quote the exact wording the reflection UI showed); `SELF_RATING_SCALE`
(Again=1/Hard=2/Good=3/Easy=5, mirroring `fsrs-scheduler`'s existing 1→Again 2→Hard 3-4→Good
5→Easy map — value 4 intentionally absent, historical 4s untouched); weakness summary types.

**Phase 2 — API:** `POST /attempts` (standalone, sessionless — `sessionId` was already
nullable) and `PATCH /attempts/:id` (post-reveal rate/reflect; `answerText` deliberately
immutable — the attempt is a record of pre-reveal recall). Both schedule FSRS reviews on
rating, same non-fatal contract as `sessions.answer`. New `weaknesses` module: `GET
/weaknesses` derives reason/pattern/topic signals on the fly from windowed attempts
(§2.1.8 "derived from real attempts" — no new table, no migration). `RecommendationsService`
gains weakness-repair items at priority 95 (§6.1 slot 3: under overdue tasks, over readiness
gaps) with §6.2-style concrete reasons ("You struggled with 3 sliding-window questions
recently."), gated at ≥2 struggles so one bad attempt is noise, not a pattern.
`weak_area_review` sessions — previously identical to `quick_practice` — now redo recent
unrepaired misses (a later clean ≥3-rated attempt clears the flag) and fill with siblings
from the weakest patterns/topics; falls back to the filtered draw for new users.

**Phase 3 — web:** Session page rebuilt as a two-phase machine: `AnswerForm` is recall-only
(prompt → answer → "Submit & reveal answer"); new `RevealPanel` carries everything after —
reference answer, rubric criteria, the user's own answer side-by-side, reflection (moved
here, where "what did I miss" is answerable), labeled Again/Hard/Good/Easy grading via
`PATCH`, and the existing `AiFeedbackCard` (self-hides without a key). Navigating back to an
answered question reopens its reveal (keyed remount by attempt id); `ReviewQuestionCard`
deleted as superseded. Today's review card became `TodayReviewCard`: expand → prompt →
optional typed recall → reveal → grade; a *typed* recall posts a real standalone attempt
(streak/history/weakness all count it), a mental-only recall records just the grade. Summary
page: collapsible reference answers, Again/Hard/Good/Easy grade chips, and "Retry N missed →"
(unanswered ∪ rated ≤2 ∪ any miss-tag) via `questionIds`-pinned session. Practice hub shows
live weak spots + one-tap repair session.

**Checks:** `pnpm -r lint/typecheck/test` green — **146 API + 24 web tests** (was 132 + 20).
New coverage: attempt create/update scheduling + ownership, weakness aggregation +
repaired-miss exclusion, weak_area_review composition + fallback, weakness recommendations
(incl. noise gate), session reveal-order lifecycle, Today recall flow (typed-vs-mental
paths). `next build`/`nest build` compile (web verified with a temporary font stub — Google
Fonts is unreachable from this sandbox; stub reverted, not committed).

**Deliberately not done:** no `WeaknessSignal` table (derive-don't-store until decay/dismiss
is needed); no FSRS interval preview on grade buttons (needs an API surface — candidate
follow-up); DSA-ladder per-pattern drill links and dashboard weakness panel deferred (hub
card covers the entry point).
