# ADR-0010: Company as a first-class FK with structured interview intelligence

## Status
**PROPOSED** — 2026-07-08. Design pending SPIKE-012 / MOM-120. Decision record: D-012.
Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`.

## Context
`JobApplication.company` is free text, disconnected from the curated 20-company `Company` catalog, so
the catalog and the real pipeline are two worlds. `Company` itself is `name/region/notes` only — no
interview process, no focus-area weights, no comp band, and no first-class sponsorship data (critical
for an emigrant; today `visaTag` is a hand-typed per-application badge defaulting to `unknown`).

## Decision (to be finalized in SPIKE-012)
Add structured `Company` columns (interview-process rounds, focus-area weights mapped to
`CAREER_ROLE_AREA_IDS`, `sponsorshipStatus`, `compBand`, market notes) and a **nullable `companyId` FK**
on `JobApplication` with a **free-text fallback retained** and a name-match backfill. Company context
(linked questions/stories via the existing `QuestionCompany`/`StoryCompany` joins, focus weights,
sponsorship) then flows into the pipeline and into target-scoped readiness (ADR-0011).

## Consequences
The `companyId` FK migration is the **highest-risk change** in the CareerOS plan (busiest table + seed):
run on fresh + existing DB, keep the free-text column as fallback rather than dropping it, provide a
rollback. Unlocks company detail (MOM-123), sponsorship filter (MOM-124), and targeting shortlist (MOM-125).
Gated by D-004.
