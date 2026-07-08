# ADR-0011: WeaknessSignal + one target-scoped, FSRS-grounded readiness engine

## Status
**PROPOSED** — 2026-07-08. Design pending SPIKE-013 / MOM-126. Decision record: D-013.
Supersedes the dual readiness engines; cross-links ADR-0003 (learning/mission coexistence).
Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`.

## Context
Readiness is substring keyword-matching over profile/attempt text, computed by **two divergent engines**
(`career.service` binary-weighted vs `missions.service` leveled), so the "am I ready" number is
untrustworthy and can contradict itself. Study signals carry `roleTrackId/area = null`, so nothing can be
scoped to a specific target. The `WeaknessSignal` model (V2 plan §5.4) and the `weakness_repair` /
`mixed_interview` session types (§7.1) were specced and never built. Interview outcomes feed nothing.

## Decision (to be finalized in SPIKE-013)
1. Build `WeaknessSignal` (V2 §5.4) plus `roleTrackId/area/companyId` tag columns on `AnswerAttempt` /
   `ReviewState` (MOM-126-127), reusing the derived `weaknesses.service` + `selectWeaknessQuestions`.
2. Implement the missing `weakness_repair` / `mixed_interview` session types and the `job_prep` branch
   that auto-derives a company/question set from `jobApplicationId` (MOM-127-128).
3. **Ground readiness in FSRS retrievability + graded attempts and collapse the two engines into one
   shared helper** (MOM-129); add a company-scoped rollup → "am I ready for Meta?" (MOM-130).
Per D-015 (missions frozen), the mission engine's readiness becomes a view over this single engine,
not a parallel computation.

## Consequences
Interview debriefs (MOM-113) emit `WeaknessSignal`/`LearningEvidence` that reshape target-scoped
readiness and FSRS repair — closing the career loop. Additive migration gated by D-004; the spike must
confirm FSRS retrievability is cheaply queryable per area.
