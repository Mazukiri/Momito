# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).

## ★ Momito 1.1 — "Close the Half-Closed Loops" SHIPPED (2026-07-12)

Owner direction: **strengthen what exists — create nothing new.** Six PRs, all live-verified against localhost,
all suites green (**343 API + 42 web tests**, lint + typecheck clean on both apps). No schema migrations.

- **MOM-166** (`a920752`) — repair sessions actually close weakness signals (D-023): a completed
  `weak_area_review`/`job_prep` session's positive attempts drive open area-signals `open→repairing→resolved`. The
  loop that emitted a signal on a bombed round now *clears* it on demonstrated repair. (Live testing caught the real
  enum bug: `weak_area_review`, not `weakness_repair`.)
- **MOM-167** (`c068b7a`) — wired the previously-dead resolve/dismiss endpoints into `JobReadinessCard` (✓/✕ chips,
  amber `repairing` styling) and titled Today's repair card `Repairing:` with a one-more-rep nudge.
- **MOM-168** (`f2e12a2`) — the AI grade feeds FSRS: `gradeAttempt` returns `suggestedRating` (null on cached), and
  a one-tap "Rate '<Good>' — the AI's suggestion" button routes through `RevealPanel.rate()`. Map is the inverse of
  `SELF_RATING_TO_GRADE` (good→3).
- **MOM-169** (`e4efb4e`) — readiness computed once per request: `areaMastery` (the heavy ReviewState+attempt sweep)
  is shared across per-goal/per-track calls instead of re-run N times. Byte-identical output.
- **MOM-170** (`59261ff`) — ATS matching understands lowercase + multi-word skills via a 143-phrase lexicon (from
  `CAREER_ROLE_TRACKS` keywords) + the user's own skills; multi-word phrases substring-match.
- **MOM-171** (`fd22530`) — hardened the flaky résumé-Accept asserts (`findBy`/`await`) and added `JobReadinessCard`
  + jobs-list test coverage. 42 web tests, stable across repeated runs.

**Verification note:** all six PRs were individually live-verified during implementation (repair loop end-to-end, AI
grade suggestion, readiness before/after byte-diff, ATS lowercase JD). Post-release full-suite re-run confirmed
343 API + 42 web green, lint + typecheck clean, shared build clean. Working tree holds only pre-existing dev
scaffolding + the pending `/doctor` `CLAUDE.md` fix (owner to review in `git diff`).

## ★ Momito 1.0 — Consolidation Release SHIPPED (2026-07-12)

The consolidation release is complete — 6 PRs, all live-verified against localhost, all suites green
(**328 API + 34 web tests**, lint + typecheck clean on both apps):

- **MOM-160** (`8c81765`) — true ever-reached funnel conversion (D-022): rejected/withdrawn apps now count
  toward the deepest stage they reached, so conversion isn't inflated by erasing losses.
- **MOM-161** (`a3dde20`) — AI grading reached résumé-AI hardening parity: MAX_TOKENS 4096→16000 + a
  completeness contract with one repair pass (mirrors MOM-147/148).
- **MOM-162** (`204af05`) + **MOM-163** (`845daf3`) — **Missions retired** (D-021): web surface, then API
  module + shared types + both couplings. **The 5 DB tables and every `missionId` FK column are preserved**
  — restorable by reverting these two PRs; no migration.
- **MOM-164** (`56cebe9`) — stripped 3 vestigial write-only job fields (referralName/h1bCountLastYear/
  compensationNotes); columns preserved.
- **MOM-165** (`3082f5b`) — sidebar restructured into Pipeline / Prep / Insights sections + Settings.

**Deployed to localhost** (API :3001, web :3000, both running as background processes). Golden path verified:
`/missions`→404, zero mission cards on Today, ever-reached funnel numbers, clean job + dashboard responses,
sectioned nav in the bundle. D-021/D-022 recorded; README's routes/dir/ADR-0003 refs updated.

**Known follow-up (not blocking):** the résumé-page test `refuses to "accept" a rewrite whose bullet is no
longer in the draft` flakes under parallel vitest load (queries before the async state flush; it renders no
Sidebar so it's unrelated to MOM-165). Passes in isolation and on re-run. Worth a `waitFor` hardening pass.

Also still pending from the `/doctor` run: the one-line `CLAUDE.md` fix in the working tree (owner to review in
`git diff`), and disabling the unused Google Drive `/mcp` connection.

## Active initiative (2026-07-08): CareerOS transformation

New plan `docs/plans/MOMITO_CAREEROS_PLAN.md` — turn the study tool into a role-landing OS.
Thesis: the study loop closes; the career loop does not. Tracks **M–S / MOM-101…145** appended to
`BACKLOG.md` §4b. Owner decisions locked: (1) **close the study↔target loop first**; (2) résumé track
is **AI-first, dormant-until-key**; (3) **missions frozen** (D-015) — pipeline-driven loop primary, the
two readiness engines consolidate into one FSRS-grounded engine (MOM-129).

**Phase 0 quick wins — COMPLETE** (schema-free, branch `feat/careeros-phase-0`):
MOM-101 (funnel card, `daf5cd1`) · MOM-102 (auto-log status transition, `897df85`) ·
MOM-135 (gap→task, `b79cde5`) · MOM-108 + MOM-134-lite (paste-JD capture + ATS coverage,
`a5d6476`) · MOM-140-lite (stage-aware Today copy). All live-verified against local Postgres;
161 API tests green. See LOG.MD 2026-07-08 entries.

**Executing now — Phase 1, LOOP-FIRST ordering (owner decision 2026-07-08):** close the loop scoped
to a `JobApplication` first (low risk), prove Gate 1, then do the highest-risk company-FK migration
(MOM-120→122) **last** in Phase 1. Sub-phases: **1A outcome edge** (MOM-126→127 weakness spine,
MOM-109→110 InterviewRound, **MOM-113 debrief→WeaknessSignal = the loop-closing edge**, MOM-128
tagging + job_prep, MOM-142 recommendations wiring) · **1B grounded verdict** (MOM-129 one FSRS
engine, MOM-130 "am I ready for Meta?", MOM-131 story gap map) · **1C auto-prep + countdown**
(MOM-141, MOM-140-full) · **1D company context, last** (MOM-120→121→122).

**Shipped so far this initiative:** Phase 0 (MOM-101/102/135/108/134-lite/140-lite); MOM-126 DESIGN
(ADR-0011, SPIKE-013); **MOM-127** (migration `weakness_signals` — the WeaknessSignal store + decay +
`mixed_interview`; live-verified); **MOM-109 DESIGN** (ADR-0013 / D-016, SPIKE-010 — InterviewRound);
**MOM-110** (migration `interview_rounds` — first-class InterviewRound CRUD + `InterviewRoundsCard`
timeline UI with debrief editor; 179 API tests, live CRUD + Playwright verified); **MOM-113 — THE
LOOP-CLOSING EDGE** (debrief → area+reason `WeaknessSignal`s + one `interview_debrief` `LearningEvidence`
row per round, per-round idempotent; 182 API tests, live-verified: a bombed Meta round now lands 3
job-scoped open weakness signals).

**Shipped since:** **MOM-128** (attempts tagged with `area`/`roleTrackId`; `job_prep` branch draws the
company bank weak-area-first); **MOM-142** (open `WeaknessSignal`s surface as ranked `Repair:` Today cards
— live + Playwright verified). **★ CareerOS Gate 1 loop is now visible end-to-end**: bomb a round → a
target-scoped weakness is stored → it shows on Today AND leads the next `job_prep` for that job.

**Shipped since:** **MOM-129** (one FSRS-grounded `ReadinessService`); **MOM-130** (`getJobReadiness` —
grounded role readiness minus open-weakness-signal penalty; `JobReadinessCard` on the job page;
live-verified: bombed Meta round → verdict 2/100 not_ready). **★ CareerOS Gate 1 loop is COMPLETE** end
to end (debrief → stored weakness → Today card + weak-area-first job_prep + lowered "ready for Meta?"
verdict).

**Shipped since:** **MOM-111** (round-scoped `generatePrep` + `Task.interviewRoundId`); **MOM-112**
(`ensureRoundReminder` + `Reminder.interviewRoundId` — a scheduled round auto-lands a countdown reminder;
live-verified); **MOM-141** (`autoAssembleUpcomingPrep` + `InterviewPrepScheduler` `@Cron(6AM)` auto-fires
`generatePrep` for imminent task-less rounds; `recommendations.service` injects an interview **countdown**
card priority `101+(14−daysUntil)`, above overdue tasks; 209 API tests, live-verified: a round 3 days out
became Today's top card "Prep your Meta Coding in 3 days"). **Phase 1 sub-phases 1A + 1B + 1C are DONE.**

**Detour shipped (owner ask, 2026-07-09): MOM-146** — "really think hard about how the Readwise features can
be improved to truly help the learner." Diagnosis: highlights were captured + tagged, then filed into a
write-only ledger and never resurfaced — dead-ending one step before the app's FSRS retention edge. Fix:
a reviewed highlight now **enters the FSRS queue** (`ReviewState.objectType:'highlight'`, no migration) and
resurfaces on Today cued by its source until it sticks; "Review" → "Remember". 220 API + 25 web tests;
live-verified end-to-end. See LOG.MD.

**Shipped since:** **MOM-131** (`career.getJobStoryGaps` + `StoryGapCard` — the target's expected STAR
competencies vs the story bank's `competencyTags`; role-scoped, no schema; live-verified: Meta → 1/4 covered,
missing conflict/failure/ambiguity). **★ CareerOS Gate 1 spine is COMPLETE** — outcome (debrief) → stored
weakness → Today prep + weak-area-first job_prep + lowered "ready for Meta?" verdict + behavioral gap map +
auto prep-queue countdown. Everything in Gate 1 that does **not** require the company-FK migration is done.

**Shipped since:** **MOM-120 DESIGN** (ADR-0010, D-017); **MOM-121** (migration `company_intelligence` —
structured Company Json columns + 20 seed packs enriched + `CompanyResponse` + `GET /companies/:id`);
**MOM-122** (migration `job_company_fk` — nullable `companyId` FK `SetNull`, name-match backfill 6/7, free
text kept; `companyRef` serialized on jobs; web datalist + link/unlink card; live-verified). **★ Phase 1D
company context is landed** — the job↔company FK loop is closed.

**Shipped since:** **MOM-122-followup** (company-weighted readiness — `getJobReadiness` weights by the
linked company's `focusAreas`; `getJobStoryGaps` falls back to `companyRef.roleTrackIds[0]`; live: Meta
verdict's weakest areas are now Meta's three focus areas). **★ Wave 1 loop-value is realized.**

**Shipped since:** **MOM-123** (company catalog + detail pages — `companies/page.tsx` grid and
`companies/[id]/page.tsx` detail with focus-area weight bars, sponsorship badge, comp band, numbered
interview process, role tracks, linked question/story counts; `🏢 Companies` nav entry; `CompaniesService.get()`
adds `_count` → `linkedQuestionCount`/`linkedStoryCount`; live: Meta → 4 linked questions). **★ The target
side of the loop now has a browsable face.**

**Shipped since:** **MOM-124** (sponsorship filter-pill row on the companies catalog and the jobs list —
`sponsorshipKey` buckets null with 'unknown'; jobs list also sorts sponsored-first via `jobSponsorship` =
`companyRef.sponsorshipStatus ?? visaTag ?? 'unknown'`; filters compose with the status pills; 26 web tests).

**Shipped since:** **MOM-125** (targeting shortlist — `career.getTargetShortlist` ranks the catalog by
focus-weighted grounded readiness × sponsorship multiplier × region preference; readiness memoized per
distinct role track; `GET /career/target-shortlist`; "Where to apply next" top-3 card on the career page;
live: NVIDIA 51 → Amazon 15, ByteDance unknown ×0.7 → 15). **★ Wave 1 (Phase 1D company context, MOM-120→125)
is COMPLETE** — the target catalog is structured, linked to the pipeline, browsable, filterable, and ranked.

**Shipped since:** **MOM-103+104** (migration `job_event_transition_status` — `JobEvent.fromStatus`/`toStatus`
structured columns + title-parse backfill; `jobs.service.update()` writes the pair; `funnel()` emits
per-stage `medianDaysInStage` from ordered transition timing; funnel card shows `~Nd`; ADR-0009 ACCEPTED;
live-verified backfill + fresh transition + median 1.5/0). **★ Pipeline truth now has a time dimension.**

**Shipped since:** **MOM-105** (stall detection — `JOB_STAGE_STALL_THRESHOLDS` + `daysInStage`/`isStalled`
on the job response via a `take:1` latest-transition include; `recommendations.service` "Follow up on X —
Nd in stage" card at priority 68 superseding the stage card; jobs-list `⏳ Stalled` badge; live-verified a
backdated saved job flips stalled at 30d≥14). **★ The pipeline now nags you about apps that have gone quiet.**

**Shipped since:** **MOM-106** (migration `job_rejection_reason` — `rejectionReason` column + `REJECTION_REASONS`;
service enforces rejected-only, clears on reopen, copies to the transition event note; `funnel().byRejectionReason`
breakdown; job-page reason select + funnel "Why rejected" row; live-verified 400 guard / store+note / breakdown /
auto-clear). **★ Pipeline truth (Wave 2) is nearly done — only the Kanban view (MOM-107) remains.**

**Shipped since:** **MOM-107** (Kanban board — list↔board toggle on the jobs page; column per `JOB_FUNNEL_STAGES`;
native HTML5 drag → optimistic `moveJob` calling the live-verified `jobsApi.update(id,{status})`; funnel + pills
stay on list view). **★ Wave 2 (pipeline truth: MOM-103/104/105/106/107) is COMPLETE** — transitions are
timed, stalls surface, losses are analyzed, and the pipeline is a draggable board.

**Shipped since:** **MOM-116+117** (migration `contacts` — new `Contact` model, `jobApplicationId` FK SetNull,
create-only idempotent referralName backfill; `contacts` module exposing `/contacts` + `/jobs/:jobId/contacts`;
`ContactsCard` on the job detail page; ADR-0014 ACCEPTED, D-018, SPIKE-011 resolved; live: CRUD round-trip +
backfill SQL proven idempotent/dedup-safe). **★ Wave 3 opened — networking is first-class.**

**Shipped since:** **MOM-118** (follow-up cadence — `FollowUpService.sweep` daily @Cron emits idempotent
`follow_up` reminders for `applied` apps stale ≥10d and `thank_you` reminders for just-decided rounds that
have a job contact; `FollowUpModule` + scheduler; live-verified nudge + idempotency).

**Shipped since:** **MOM-119** (referral network view — `/contacts` page grouped by relationship with linked-job
chips; `👥 Contacts` nav; the Today thank-you nudge is already delivered by the MOM-118 `thank_you` reminder, so
no redundant rec card). **★ Wave 3 contacts (MOM-116/117/118/119) COMPLETE.**

**Shipped since:** **MOM-114+115** (migration `offers` — one-per-job `Offer` model with Decimal comp +
normalized-annual-total serializer; `offers` module `/offers` + `/jobs/:jobId/offer`; `OfferCard` on the job
page + `/offers` comparison table (single-currency v1, visa column); ADR-0015 ACCEPTED, D-019, SPIKE-015
resolved; live: normalized 275k, currency upper-cased, 400 guard, delete). **★ Wave 3 (contacts + offers)
COMPLETE.**

**Shipped since:** **MOM-132+133** (migration `resume_versions` — new `ResumeVersion` model, `jobApplicationId`
FK SetNull, `contentMd` Markdown derived from `Profile` via `profileToMarkdown` on create when omitted,
`baseProfileSnapshot` provenance, `aiSuggestions` default `[]`; `resumes` CRUD module `/resumes`; `/profile/resumes`
editor page + "Résumé versions" button on the profile page; ADR-0012 ACCEPTED, D-020, SPIKE-014 resolved; 273 API
tests; live: derive-from-profile "# Demo Candidate …" + CRUD round-trip verified). **★ Wave 4 opened — résumé
artifacts are first-class, deterministic-first.**

**Shipped since:** **MOM-134-full** (ATS coverage vs a `ResumeVersion.contentMd` — `atsCoverage` takes an optional
`resumeVersionId` and measures that version's Markdown instead of the base profile skills; `source`/`resumeVersionId`
on the response; new `POST /profile-scores/ats-coverage/generate-tasks` applies the MOM-135 gap→task bridge to missing
JD keywords; `/profile/resumes` gains an ATS panel with covered/missing chips + "Add missing to tasks"; 278 API tests;
live: résumé 0.25 vs profile 0.125, 6 tasks then 0 idempotent, 404 on foreign version).

**Shipped since:** **MOM-139** (résumé export `GET /resumes/:id/export?format=md|pdf` — MD = `contentMd`
attachment; PDF = ATS-safe single-column render via a **dependency-free** hand-rolled writer `resume-pdf.util.ts`
(standard Helvetica, no embedding, no binary dep — the safest ATS output is plain text + a standard font, which
needs no library, and this avoids touching the not-ours `pnpm-lock.yaml`); `/profile/resumes` export buttons via
an auth-header blob download; 281 API tests; live: PDF byte-deterministic + **verified parseable by pypdf**).
**★ Résumé artifacts are now editable, ATS-scored against a JD, and exportable.**

**Shipped since:** **MOM-136/137/138** (résumé AI, **dormant-until-key**, mirroring `grading.service.ts`:
`resume-ai.service.ts` + `ResumeAiOrchestrator` reusing the same daily `BudgetService` pool; `POST /resumes/:id/ai/
{analyze,rewrite,cover-letter}`; MOM-137 persists rewrites to `ResumeVersion.aiSuggestions` on success only and the
UI's "accept" deterministically swaps original→rewritten in the draft; 291 API tests, **all mocked, zero-network**;
live no-key path: all three return `{ok:false}`, nothing written, nothing billed). **Backlog rows are marked
"DONE (scaffold) — VERIFICATION-BLOCKED on live key" — the live model path is NOT verified and must not be claimed.**

**Shipped since:** **MOM-145** (`funnel().byResumeVersion` — conversion per résumé, joined through
`ResumeVersion.jobApplicationId`; apps with no version linked are excluded rather than diluting the comparison;
funnel card renders sent/interviewing/offers/conversion per version; live: tailored résumé 50% conversion vs base 0%).

---

## ★ The CareerOS handoff plan is COMPLETE (2026-07-10)

Every item in the approved plan (`~/.claude/plans/…mossy-moore.md`) has shipped, each as its own committed PR with
tests green and a live round-trip against local Postgres:

- **Wave 1 — company context (MOM-120→125):** structured `Company` intelligence + seed enrichment, the
  `JobApplication.companyId` FK with name-match backfill, company-weighted readiness, catalog + detail pages,
  sponsorship filters, and the ranked targeting shortlist.
- **Wave 2 — pipeline truth (MOM-103/104/105/106/107):** structured transition history + per-stage median timing,
  stall detection, rejection-reason loss analysis, and the Kanban board.
- **Wave 3 — contacts & offers (MOM-114→119):** the `Contact` model + referralName backfill, the follow-up/thank-you
  cadence scheduler, the referral network view, and the `Offer` model + normalized comparison table.
- **Wave 4 — résumé artifacts (MOM-132→139, 145):** `ResumeVersion` decoupled from the master `Profile`, ATS coverage
  against a version's `contentMd` + the gap→task bridge, dependency-free ATS-safe md/pdf export, the AI tailoring
  suite, and which-résumé-converts analytics.

**293 API tests + 26 web tests green.**

**Post-plan follow-on (2026-07-11): MOM-089 — README final polish (docs only).** With the plan closed, MOM-089 was the
only backlog row left that was neither credential-gated nor awaiting an owner decision. The README still described a
practice app with a job list — nothing about rounds, debriefs, weakness signals, company intelligence, contacts,
offers, or résumé versions — so it was rewritten around the CareerOS loop, with the missing routes and endpoints read
straight out of the source, the ADR list extended 0006 → 0015, and an explicit "verification-blocked, and not claimed
to work" note added so a new reader learns what is scaffolding without digging through this backlog.

### AI: LIVE-VERIFIED 2026-07-11 (this was the last open gate)

The owner supplied a key and **the live AI path now works** — MOM-068–074 (grading) and MOM-136/137/138 (résumé AI)
are all live-verified: real `messages.parse` calls, valid structured output, rewrites persisted to `aiSuggestions`,
budget debited ($0.1237 across 6 requests). Grading correctly failed a nonsense answer (2/100). See today's LOG entry.

The key is an **OpenRouter** key, which works with **no code change** via:
`ANTHROPIC_BASE_URL="https://openrouter.ai/api"` (must stop at `/api` — the SDK appends `/v1/messages`) +
`ANTHROPIC_MODEL="anthropic/claude-opus-4.8"`. It lives in `apps/api/.env` (gitignored; **never commit it**).
That key was pasted in chat and is compromised — if AI calls start 401ing, it was rotated: put the new value in
`apps/api/.env`.

**Still genuinely unverified:** a native `sk-ant-` call against `api.anthropic.com` (identical wire format, but
technically un-run), and the **budget-exceeded** path (would need ~$1 of real spend; guard is unit-tested only).

### Post-plan follow-on (2026-07-12): MOM-153 — parity for the rewrite and the cover letter

With the backlog closed, the largest remaining *inconsistency* was inside the résumé AI itself: MOM-149/150 gave the
**critique** a target (the application's JD + the company's focus areas) and profile evidence, while the **rewrite**
and the **cover letter** — the tools that actually write the words — still saw only a hand-pasted JD. All three now
share one `TailorContext`; the JD falls back to the one already stored on the linked application, so it is never
pasted twice, and a call with no JD anywhere refuses for free (no model call, nothing billed). The cover letter's visa
paragraph is calibrated to the employer's known sponsorship posture.

This also caught a live bug: **"Accept" on a rewrite silently did nothing** whenever the model returned the normalized
bullet (which it does — that is the form we show it) and the résumé carried PDF double spaces, because the UI applies
rewrites with `contentMd.replace(original, rewritten)`. Rewrites are now snapped back to the verbatim source line.
310 API tests.

### MOM-154 (2026-07-12) — `aiSuggestions` was a write-only column

Pulling that thread found a second one. MOM-137 wrote rewrites to `ResumeVersion.aiSuggestions` "so the UI can
accept/reject them across sessions"; the API serialized them; **the web page never read them.** A reload threw your
suggestions away while they sat invisible in the DB, and nothing pruned an accepted one. Same dead-end shape as the
MOM-146 Readwise ledger — *persisting* something is not *closing the loop on it*, and a comment saying "so the UI
can…" is a claim, not a wire. Outstanding rewrites now come back with the résumé; accept applies the text and retires
the suggestion in one write; reject persists immediately. 314 API tests.

### MOM-155 (2026-07-12) — the sweep paid off once: résumé drift

Ran that sweep. Six candidates; five were read by the web. The one that was not — **`baseProfileSnapshot`** — turned
out to be a feature waiting to happen: it records what the `Profile` looked like when a version was cut, which is
exactly what answers *"what have I done since I cut this résumé?"* Nobody was asking, so versions rotted in silence.
`GET /resumes/:id/drift` now diffs by identity (skill / project name / company+role), and `/profile/resumes` shows
"Your profile has moved on since this version was cut", naming what is missing. 319 API tests.

The write-only-column sweep is now **exhausted** for the résumé surface. If repeating the trick elsewhere: the shape
to grep for is a column the API writes and serializes that no `apps/web` file ever names.

### MOM-156 / MOM-157 (2026-07-12) — tests, then drift on Today

**MOM-156:** both MOM-153/154 bugs lived in the web layer, and `/profile/resumes` (the densest page in the app) had
**zero tests**. Added six; they immediately caught a flaw in MOM-154's own UI (the "Applied to the draft"
confirmation was rendered inside the suggestion list, so it vanished exactly when the last suggestion was accepted).
**MOM-157:** drift only helps *before you send*, and `/profile/resumes` is the one page you don't open unless you
already suspect the résumé is behind — so drift now surfaces on **Today** via `recommendations.service`
(`ResumesService.driftSummary`, one profile + one versions read). Priority 74 when the stale version is linked to a
still-`saved` job (fixable before applying, copy names the company), 45 otherwise; the card deep-links `?v=<id>` to
the exact version.

### MOM-158 (2026-07-12) — flagship bug: "am I ready?" could report a false 0/100

After the column sweep ran dry, careful reading of the readiness engine turned up a real bug in the headline
"am I ready for <company>?" verdict. `companyWeightedPercentage` divided by the sum of focus weights that matched a
role-track area — but a company's `focusAreas` is validated against `CAREER_ROLE_AREA_IDS`, not the chosen track's
areas, so the two can be disjoint, and `weightSum:0` returned a hard **0** ("not ready") for a strong candidate. Now
returns `null` → both callers (`getJobReadiness`, `getTargetShortlist`) fall back to the flat overall percentage.
Latent for user-created catalog data only (every seed track + company share `dsa`). Counterfactual unit test + live
proof (forced NVIDIA focus to a disjoint area → 34 not 0, restored to 50). If hunting more: the readiness/weakness/
`job_prep`-selection paths were read end-to-end this session and are otherwise correct.

### MOM-159 (2026-07-12) — ATS coverage false-missed skills at sentence ends

The JD tokenizer's capture class allows a dot (so "Node.js" survives) — which also swallowed the sentence-final
period, so "…experience with Kubernetes." kept its dot (`kubernetes.`) while the résumé have-set stripped it
(`kubernetes`), and a covered skill was reported missing (deflating `coveragePct`, spawning a bogus "Add to résumé"
task). Fires on the most ordinary JD phrasing. Fixed by stripping trailing dots from JD tokens; counterfactual test.

### Computation-core sweep (2026-07-12) — what was read and found correct

Careful reading covered the computation-heavy core end-to-end: `career.service` (found MOM-158),
`profile-scores` ATS matcher (found MOM-159), `jobs.service` funnel timing + median (correct), weakness severity
decay (correct), `sessions` `job_prep` selection (correct), readiness FSRS grounding (correct), dashboard streak
(correct — pure calendar math, DST-free tz), `reviews` listDue (correct), offer normalization (guards ÷0). One
**non-bug lead** for the owner: `jobs.service.funnel()`'s `reached`/`responseRate`/`conversionFromPrev` count only
*currently-active* apps (rejected/withdrawn excluded), so heavy rejection inflates the conversion rates — it is the
documented live-pipeline-snapshot design, and MOM-103/104's transition history now makes a true "ever-reached"
funnel computable if the owner wants conversion to reflect history rather than the current snapshot. Not changed
(redefining an owner-designed metric needs a signal).

**Session end state (2026-07-12):** 325 API + 34 web tests green, lint + typecheck clean on both apps. Commits this
session on `feat/careeros-phase-0` (`418f779` → `5eec0a6`): the résumé AI loop MOM-153–157 (+ deep-link follow-up),
two flagship bug fixes MOM-158 (`402b39f`) + MOM-159 (`eabe412`), plus docs/test-hardening. Working tree holds only
pre-existing dev scaffolding **plus** a one-line `CLAUDE.md` fix from a `/doctor` run (`LOCKS.md`→`LOCKS.MD`,
`LOG.md`→`LOG.MD` — left uncommitted for the owner to review in `git diff`, per the doctor's rules). The résumé AI
surface is a complete tested loop (analyse → rewrite → cover letter → ATS → drift → Today), and the career/readiness
computation core has been read end-to-end and hardened. No further non-gated work is queued; the next productive step
needs an owner signal (deploy, a new feature, or a pointer at a specific area) or the metric-semantics decision above.

## If resuming autonomously

The plan is done and the AI gate is closed, so the next step needs a signal from the owner. In rough order of value:

1. **Deploy** (`render.yaml`/`vercel.json` are ready) → unblocks MOM-021, MOM-088's Lighthouse pass, and the real iOS
   push-notification path (MOM-092). This is now the only remaining *infrastructure* blocker.
2. **Ask for a new feature**, or point at something these sessions' tests and live round-trips did not catch.
3. **MOM-049** (LeetCode import) — still needs an explicit go-ahead (third-party GraphQL API).

Still deliberately not attempted (a judgment call, not a hard block): **MOM-049** (LeetCode import) — calling a
third-party GraphQL API without an explicit go-ahead is a different risk class than writing original seed content.

**Gate 1 — MET.** Bombing a round demonstrably reshapes tomorrow's prep, and an FSRS-grounded "am I ready for Meta?"
verdict exists. Every schema task went SPIKE → DESIGN-doc → implementer PR (D-004, under the standing approval below),
each tested against the existing DB. Registries closed this initiative: SPIKE-009…015, ADR-0009…0015, D-016…D-020.

---

## Prior state (2026-07-07 session)

A second audit pass (three parallel research agents: docs/agent hygiene, API
production-readiness, web UX/quality) found and closed the highest-impact remaining gaps —
see Track L in `BACKLOG.md` for full detail (MOM-091 through MOM-100). Headlines:

1. **Dark mode was silently broken in `next dev`** (MOM-091) — root-caused via a compiled
   dev-vs-prod CSS diff, not guesswork. Fixed; live-verified with Playwright.
2. **Web Push notifications** (MOM-092), the user's explicit ask, shipped dormant-until-
   VAPID-keys (no third-party account needed — keys are self-generated).
3. API production hardening: graceful shutdown (MOM-093), real token revocation via
   `tokenVersion` (MOM-094, closes the single largest pre-existing security exposure), API
   linting wired into CI for the first time (MOM-095).
4. Web UX/accessibility polish (MOM-096): 401 auto-logout, debounced search + URL state,
   optimistic updates on the highest-frequency taps, labeled form controls, keyboard-
   reachable cards, dark-mode-legible badges, a live reminder badge, skeleton loading states.
5. Frontend test foundation (MOM-097) — `apps/web` had zero tests; now has 20 across the
   riskiest surfaces, plus one real bug caught in the test-writing process itself (a test-
   mock artifact, documented in the commit, not an app bug).
6. Verified (not just assumed) the `aiScore` 0–1 scale is consistent across every consumer
   (MOM-098) and closed a narrow AI-budget race condition (MOM-099).
7. Also reconciled the MOM-068–074 status contradiction between BACKLOG.md ("DONE") and this
   file ("blocked") — both were partially true; BACKLOG.md now says "DONE (scaffold) —
   VERIFICATION-BLOCKED on live key" for that whole track. Fixed a dangling ADR-0009
   citation (never existed) in SPIKE-002, and AGENTS.MD's wrong plan filename
   (`momito-redesign-v2.md` → `MOMITO_REDESIGN_PLAN_V2.md`). Added a superseded-notice
   header to root `REDESIGN_PLAN.MD` pointing at V2 + BACKLOG.md as the actual source of
   truth.

**Correction to a claim in this file's previous version:** it said "no browser-automation
tool available here" for MOM-088. That's no longer accurate — Playwright is usable in this
environment (used throughout this session for live verification and to build
`docs/tutorial/index.html`'s screenshots). MOM-088's Lighthouse audit specifically still
needs a *deployed* URL (Lighthouse audits a live origin, not `localhost` meaningfully for
production scoring), but a manual accessibility pass via Playwright/DOM inspection is
possible without a deploy — a chunk of that was done as part of MOM-096 (labels, keyboard
reachability, contrast), not exhaustively.

## Standing approval

The user has granted blanket approval to cross the D-004 human-approval gate for schema
migrations for the remainder of the plan. This does **not** extend to items blocked on
external credentials this agent does not hold.

## Hard-won lessons this session (read before any future migration or test-mocking)

1. `prisma migrate dev --create-only` can apply itself immediately instead of just staging
   the file — confirmed twice previously. Always run `prisma migrate status` right after,
   before editing the generated SQL.
2. **Never hand-edit an already-applied migration's `.sql` file.** It breaks Prisma's
   checksum tracking; the only fix Prisma offers is a full destructive `migrate reset`. Fix
   forward with a new migration instead.
3. On Windows, a running `nest start --watch` (or a stray compiled `dist/main` process) holds
   the Prisma query-engine `.dll.node` open, so `prisma generate` right after a migration
   fails with `EPERM: operation not permitted, rename ...`. Kill the node process holding it
   (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` to find it, `Stop-Process`) and
   retry — don't fight the lock, don't skip regenerating the client.
4. **A mocked `next/navigation` router/params object must be referentially stable across
   renders** if any effect's dependency array includes it — a mock like `useRouter: () =>
   ({push: vi.fn()})` returns a fresh object every call, which will silently retrigger any
   `useCallback`/`useEffect` chain depending on it, producing an infinite fetch loop that
   looks like a stuck-loading component. Memoize the mock object at module scope. (Caught
   writing the practice-session-page test this session — see MOM-097 / the test commit.)
5. Large uncommitted work can silently pile up across sessions. At the start of this
   session, `git status` revealed the *entire* prior session's Story Bank + AI grading +
   PWA + deploy-scaffolding + streak work (several thousand lines) had never been
   committed despite being tested and declared "done" in earlier LOG.MD entries. Recovered
   it in two honestly-labeled `recover:` commits before starting new work, splitting files
   that mixed prior uncommitted work with this session's own changes (temporarily reverting
   the new hunks, committing the recovered prior work, then reapplying). **Commit more
   often** — don't let a session's real, working, tested code sit uncommitted indefinitely.

## What's left — genuinely blocked, not avoided

1. **Credentials this agent does not hold:**
   - MOM-021 (deploy: Vercel/Render/Neon accounts)
   - MOM-068 through MOM-074 (AI feedback engine: needs a real Anthropic API key to verify
     the live grade/budget-exceeded/rendered-feedback paths — Track I, Gate 4; the no-key
     path is fully verified)
   - MOM-092 (Web Push: needs a real HTTPS deploy for the actual iOS install→subscribe→
     receive path — VAPID keys themselves need no third-party account and are already
     generated/working locally)
   - MOM-049 (LeetCode import: a judgment call, not a hard credential block — see below)
2. **Needs a real deployed origin, not just a local browser:**
   - MOM-088 (Lighthouse specifically — Playwright itself is available, see the correction
     above; a from-localhost Lighthouse run wouldn't reflect real production scores anyway)
3. **Deliberately not attempted, disclosed as a judgment call, not a hard block:**
   - MOM-049 — scraping/calling a third-party GraphQL API without an explicit go-ahead is a
     different risk class than writing original seed content. If the user wants this
     attempted, say so explicitly.
   - The V2 plan's `WeaknessSignal` model + `weakness_repair`/`mixed_interview` session
     types + content quality-gating (`qualityStatus`/provenance) were identified by this
     session's docs audit as vision the MOM backlog never picked up. Not started — this is
     a chunk of net-new feature depth, not a production-readiness gap, and deserves its own
     scoped plan if the user wants it built.
4. **Depends on #1 being resolved:**
   - MOM-090 (final golden-path verification) — everything reachable without Gate 1/4/6
     (deploy, AI live-key, production hardening) has been verified incrementally across two
     sessions' worth of live round trips; a "final" pass isn't meaningfully more final until
     those gates close.

## If resuming autonomously

No further non-credential-gated, non-deploy-blocked work items are left in `BACKLOG.md` as
of this pass. The next productive step requires one of:
- The user provides credentials (Anthropic API key, Vercel/Render/Neon accounts) — implement
  or verify the matching track.
- The user deploys the app (render.yaml/vercel.json are ready) — run MOM-088's Lighthouse
  pass and the real iOS push-notification check against the live HTTPS origin.
- The user explicitly asks for MOM-049 (LeetCode import) or the WeaknessSignal/content-
  quality-gating feature chunk despite the judgment calls above.
- The user asks for a new feature not yet in `BACKLOG.md`.
- The user points out something broken that this session's tests/live-verification didn't
  catch.

Absent any of those, re-reading `BACKLOG.md` top to bottom without a new signal would mostly
re-verify what these two sessions already confirmed.
