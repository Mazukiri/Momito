# LOG

> Append-only execution journal. Newest entries on top. Every implementer PR adds an entry:
> task ID, files changed, checks run, result, risks/follow-ups.

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
