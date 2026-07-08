# Momito → CareerOS Plan — turning a study tool into a role-landing operating system

> Companion to `MOMITO_REDESIGN_PLAN_V2.md`. V2 built the Knowledge OS (study loop). This plan builds
> the **Career OS**: the loop that turns study into a landed offer at a specific company abroad.
> Same philosophy — full vision, progressive implementation, small PRs, hard gates, no fake completeness.

---

## 0. Why this plan exists

Momito is a best-in-class **study** tool with a shallow **application log** bolted on. The study loop
closes (review → rate → FSRS reschedule → weakness repair). The **career loop does not close at all**:
nothing in the job pipeline changes what you study, and nothing you study is scoped to a target. The
owner is studying to **land a role abroad and emigrate**; today the app makes them good at interviews
in the abstract while doing almost nothing to help them land a *specific* role at a *specific* company.

Validated by a 7-agent read-only audit + direct code reads. Prioritized gaps:

1. **No pipeline truth.** `JobApplication.status` is a flat string — no state machine, no per-stage
   timestamps, no transition history, **zero funnel/conversion analytics anywhere**.
2. **The loop never closes.** `JobEvent` is a free-form note, not an interview-round model. Interview
   outcomes feed *nothing*. `WeaknessSignal` (V2 §5.4) and `weakness_repair`/`mixed_interview` session
   types (§7.1) were specced and **never built**.
3. **Study is global, not targeted.** Attempts/ReviewStates carry `roleTrackId/area = null`; readiness
   is **substring keyword-matching** over profile JSON, computed by *two divergent engines*
   (`career.service` vs `missions.service`).
4. **No company context reaches the pipeline.** `JobApplication.company` is free text, not an FK to the
   catalog; `Company` is `name/region/notes` only — no interview process, focus-area weights, comp band,
   or first-class sponsorship data (critical for an emigrant).
5. **No application artifacts.** `Profile.userId` is `@unique` — no per-job résumé versions, no record of
   which résumé was sent, no bullet rewriting, no ATS optimization, no export, no cover letters. The
   Anthropic scaffold (`grading.service.ts`) is unwired from résumé work.
6. **No relationship layer.** `referralName` is a bare string.
7. **No interview-date awareness / automation.** Only `deadline`; nothing counts down to an onsite or
   auto-assembles a prep queue. `generatePrep` is a manual, generic button.
8. **No offer/decision management.** Comp is a free-text string.

---

## 1. North-Star Career Loop

```text
TARGET → TAILOR → APPLY → PREP → INTERVIEW → OUTCOME → LEARN → re-TARGET
```

- **TARGET** a sponsorship-viable company+role from the catalog (fit × readiness × sponsorship).
- **TAILOR** a per-job résumé version; AI rewrites bullets to the JD; ATS coverage checked; gaps → tasks.
- **APPLY**; a stage machine records *when* each stage was entered; contacts attached; follow-ups scheduled.
- **PREP**: as an interview date nears, auto-assemble a company- and round-scoped prep queue (company
  question tags + this target's weak areas + the stories that round needs) into Today with countdown.
- **INTERVIEW**: each round is first-class (type, interviewer, scheduledAt, outcome, debrief).
- **OUTCOME**: the debrief emits a `WeaknessSignal`/`LearningEvidence`.
- **LEARN**: that signal reshapes target-scoped readiness + FSRS weakness repair — **the loop closes.**
- **re-TARGET**: funnel + conversion analytics (per source, per résumé) show where apps die and what converts.

**Invariant:** every feature must make an OUTCOME reshape the next PREP, or make a TARGET/conversion
decision sharper. Otherwise it is deferred.

---

## 2. Owner decisions (shape scope + order)

1. **First focus = close the study↔target loop** — company-scoped readiness, outcome→repair, auto
   prep-queue come *before* deeper funnel/kanban polish.
2. **Anthropic key is coming** → the résumé track (Q) is **AI-first**, built **dormant-until-key** exactly
   like `grading.service.ts` (MOM-068 pattern), verified when the key lands.
3. **Missions frozen** — the weekly-plan/competency/check-in engine (~774 lines) receives no new
   investment; the pipeline-driven loop is primary and self-running; the two readiness engines
   **collapse into one FSRS-grounded engine** (MOM-129). Missions stay functional/optional.

---

## 3. Reuse map (build on these, do not rebuild)

| Existing asset | File | Reused by |
|---|---|---|
| Priority-ranked Today brain | `apps/api/src/recommendations/recommendations.service.ts` | all career Today cards (S) |
| Idempotent deadline reminder | `jobs.service.ts` `ensureDeadlineReminder` | interview-date + follow-up cadence (N, O) |
| Checklist→Task prep generation | `jobs.service.ts` `generatePrep` | round-scoped prep, gap→task (N, Q, R) |
| Job serialize + job-as-hub rels | `jobs.service.ts` `serializeJob`; `JobApplication` rels | rounds, offers, contacts, companyId FK |
| Heuristic JD skill extraction | `profile-scores.service.ts` `extractJdSkills` | ATS coverage + quick capture (Q, M) |
| Dormant-until-key AI scaffold | `ai/grading.service.ts` | AI résumé/bullet/cover-letter (Q) |
| Derived weakness engine | `weaknesses/weaknesses.service.ts` | WeaknessSignal + repair/mixed sessions (R) |
| Evidence-leveling pattern | `MissionCompetencyState` | grounded readiness rollup (R) |
| FSRS review state | `reviews/`, `ReviewState` | FSRS-grounded readiness (R) |
| m2m company joins | `QuestionCompany`/`StoryCompany` | company detail linked content (P) |
| Shared taxonomies | `packages/shared` (`CAREER_ROLE_TRACKS`, `CAREER_ROLE_AREA_IDS`, `ROLE_TEMPLATES`, `JOB_APPLICATION_STATUSES`, `VISA_TAGS`, `JOB_APPLICATION_SOURCES`) | every track |
| Dashboard aggregation | `dashboard/dashboard.service.ts` | funnel card (M) |

Numbering continues cleanly from the repo: **MOM-101+**, **Tracks M–S**, **SPIKE-009+**, **ADR-0009+**, **D-011+**.

---

## 4. Tracks (catalog of PR-sized work)

Each schema task = a D-004 **DESIGN doc PR** (no `migrate` run) **then** a separate **human-approved
implementer PR** tested on fresh + existing DB. AI tasks land dormant with zero-network mocked tests,
VERIFICATION-BLOCKED until a real key.

### Track M — Pipeline Truth & Funnel Analytics
- **MOM-101** Funnel & conversion endpoint + dashboard card (per-source/per-visaTag). *small, no schema.*
- **MOM-102** Auto-create `JobEvent` on status transition. *small, no schema.*
- **MOM-103** SPIKE-009 + DESIGN: per-stage timestamps / `StatusTransition` history. *small.*
- **MOM-104** Implement timestamp + transition-history migration + writes. *medium, migration.*
- **MOM-105** Time-in-stage stall detection on job list + Today. *small.* (dep 104,117)
- **MOM-106** Rejection-reason + loss-analysis capture. *small.*
- **MOM-107** Kanban board pipeline view. *medium.*
- **MOM-108** Quick-add / paste-JD rapid capture. *medium, no schema.*

### Track N — Interview Rounds, Debriefs & Offers
- **MOM-109** SPIKE-010 + DESIGN: `InterviewRound` model. *small.*
- **MOM-110** Implement `InterviewRound` + CRUD + timeline UI upgrade. *medium, migration.*
- **MOM-111** Round-scoped prep task generation. *small.*
- **MOM-112** Interview-date reminder automation. *small.*
- **MOM-113** Debrief → `WeaknessSignal`/`LearningEvidence` (**the loop-closing edge**). *medium.* (dep 110,127)
- **MOM-114** SPIKE-015 + structured `Offer` model. *medium, migration.*
- **MOM-115** Offer comparison decision view. *small.*

### Track O — Contacts, Referrals & Follow-up Cadence
- **MOM-116** SPIKE-011 + DESIGN: `Contact` model; migrate `referralName`. *small.*
- **MOM-117** Implement `Contact` CRUD + attach to job + backfill. *medium, migration.*
- **MOM-118** Stage-driven follow-up cadence reminders. *small.*
- **MOM-119** Referral network view + Today thank-you nudges. *small.*

### Track P — Company Intelligence & Job↔Company Linkage
- **MOM-120** SPIKE-012 + DESIGN: structured `Company` + `JobApplication.companyId` FK. *small.*
- **MOM-121** Implement structured `Company` columns + migrate seed prose. *medium, migration.*
- **MOM-122** Add `companyId` FK + link/backfill UI (**highest-risk migration**). *medium, migration.*
- **MOM-123** Company detail page. *medium.*
- **MOM-124** Visa/sponsorship filter + sort. *small.*
- **MOM-125** Company targeting/fit shortlist. *medium.* (dep 121,130)

### Track R — Target-Scoped Readiness & Weakness Engine  *(spine; owner's first focus)*
- **MOM-126** SPIKE-013 + DESIGN: `WeaknessSignal` + target tags on attempts/reviews. *small.*
- **MOM-127** Implement `WeaknessSignal` + `weakness_repair`/`mixed_interview` sessions. *medium, migration.*
- **MOM-128** Tag study signals + implement `job_prep` session branch. *medium.* (dep 127,122)
- **MOM-129** **Ground readiness in FSRS + graded attempts; consolidate the two engines.** *large.*
- **MOM-130** Company-scoped readiness rollup ("am I ready for Meta?"). *medium.* (dep 129,121)
- **MOM-131** Story coverage → specific-interview behavioral gap map. *medium.* (dep 110,121)

### Track Q — Résumé Versioning, Tailoring & Artifacts  *(AI-first; key coming)*
- **MOM-132** SPIKE-014 + DESIGN: `ResumeVersion` decoupled from `@unique Profile`. *small.*
- **MOM-133** Implement `ResumeVersion` CRUD + link to job. *medium, migration.*
- **MOM-134** ATS keyword coverage vs a JD (deterministic). *small.*
- **MOM-135** Gap → Task bridge from `score-profile`/ATS. *small, no schema.*
- **MOM-136** AI résumé/bullet analysis service (dormant-until-key). *medium.*
- **MOM-137** AI bullet rewriting per JD. *medium.* (dep 136)
- **MOM-138** AI cover-letter drafting per job. *small.* (dep 136)
- **MOM-139** Résumé export — Markdown then ATS-safe PDF. *medium.*

### Track S — Career Today, Automation & Loop Closure
- **MOM-140** Stage-aware Today cards + interview countdown. *small.*
- **MOM-141** Auto-assembled company/round-scoped prep queue on approaching date. *medium.* (dep 111,128,131)
- **MOM-142** Register career-target items in `recommendations.service`. *small.* (dep 130,105)
- **MOM-145** Conversion analytics by source **and** résumé version. *medium.* (dep 101,133)

*(Synthesis tasks MOM-143/144 — mission auto-diagnose, mission-plan visa weighting — dropped under the
missions-frozen decision; their intent lives in MOM-141/142 and MOM-125.)*

---

## 5. Execution sequence (phased to owner decisions)

- **Phase 0 — Quick wins (schema-free):** MOM-101, 102, 135, 108, 134-lite, 140-lite.
- **Phase 1 — Close the study↔target loop (owner #1):** company context (120→121→122) · weakness spine
  (126→127→128) · outcome source (109→110→113) · one grounded readiness engine + company rollup
  (129→130) · story gap map (131) · auto prep queue + stage-aware Today + recommendations (141, 140, 142).
- **Phase 2 — Pipeline truth depth:** 103→104→105→106→107.
- **Phase 3 — Rounds/offers/contacts:** 111, 112, 114→115, 116→117→118→119.
- **Phase 4 — Résumé artifacts (AI-first):** 132→133→134→139, then 136→137→138 (dormant), then 145, 125, 123, 124.

Within every track: schema-free quick wins before migration tasks.

---

## 6. CareerOS Phase Gates (continue the repo Gate sequence; product Gates were 1–6)

- **Gate 1 — Loop Closes (Phase 1):** a target carries structured company context; an interview debrief
  emits a weakness signal that changes Today's prep; FSRS-grounded, company-scoped readiness verdict
  renders; auto prep-queue counts down. *(First, per owner's loop-closure-first choice.)*
- **Gate 2 — Pipeline Truth:** stage machine + transition history live; funnel card renders real
  aggregates; stalls + rejection reasons captured.
- **Gate 3 — Relationships & Rounds:** `InterviewRound` + debrief live; `Contact` replaces `referralName`;
  follow-up cadence fires; offers structured + comparable.
- **Gate 4 — Artifacts:** `ResumeVersion` + per-application linkage; ATS coverage + export live; AI
  tailoring/rewrite/cover-letter dormant (mocked tests), live path VERIFICATION-BLOCKED pending key.
- **Gate 5 — Targeting & Decision:** company detail + sponsorship filter + targeting shortlist;
  conversion-by-source-and-résumé analytics.

---

## 7. Risk spikes (run before the dangerous work)

- **SPIKE-009** (M/103): per-stage timestamps vs normalized `StatusTransition` table.
- **SPIKE-010** (N/109): `InterviewRound` + date + reminder idempotency; link to `InterviewSession`/`Task`
  **without repeating the PlanItem/Task dual-write anti-pattern**.
- **SPIKE-011** (O/116): migrate `referralName` → `Contact` rows without data loss.
- **SPIKE-012** (P/120): `company` free-text → `companyId` FK backfill; focus-area weights vs
  `CAREER_ROLE_AREA_IDS`. **Highest-risk migration** (busiest table + seed).
- **SPIKE-013** (R/126): `WeaknessSignal` schema + tagging; is FSRS retrievability cheaply queryable to
  ground readiness per area?
- **SPIKE-014** (Q/132,136): `ResumeVersion` decoupling; PDF-export library choice; AI cost/prompt budget
  mirroring MOM-068.
- **SPIKE-015** (N/114): offer/comp normalization (multi-currency, equity vesting, visa-adjusted).

**Cross-cutting risks:** (1) MOM-122 FK migration is the most dangerous change — fresh + existing DB,
rollback, keep the free-text column. (2) MOM-129 must consolidate the two readiness engines or Gate 1
ships contradictory numbers. (3) Do not shadow the `Task` model. (4) AI tasks land dormant + mocked,
never claimed complete until a real key verifies.

---

## 8. ADRs / decisions to file

- **ADR-0009** CareerOS pipeline stage machine & transition history (D-011).
- **ADR-0010** Company-as-FK + structured company intelligence (D-012).
- **ADR-0011** `WeaknessSignal` + target-scoped FSRS-grounded readiness — single engine; supersedes the
  dual readiness engines; cross-links ADR-0003 (D-013).
- **ADR-0012** `ResumeVersion` decoupled from `@unique Profile` (D-014).
- **D-015 — Missions frozen:** pipeline-driven loop is primary; missions remain functional/optional.

---

## 9. Verification (per PR + per gate)

Per PR: `pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm build` green, + a live round-trip
against local Postgres for any API-visible change (API on :3001 with explicit `DATABASE_URL`/`DIRECT_URL`/
`PORT`; web on :3000 to match `CORS_ORIGIN`), + Playwright screenshot for notable UI, + LOG.MD entry.
Migrations verified on fresh + existing DB with rollback notes; human-approval gate (D-004) per migration.
Per gate: the gate's golden-path passes end-to-end (e.g. Gate 1: create job → link company → add round →
save a losing debrief → observe a new weakness-repair item + lowered company readiness on Today after reload).

---

## 10. Out of scope / deferred

Missions ceremony expansion (frozen); drag-drop niceties beyond MOM-107; browser-extension capture;
multi-user/team features; external job-board integrations (LeetCode import remains standing deferred
SPIKE-006); anything not serving the outcome→prep edge or a target/conversion decision.
