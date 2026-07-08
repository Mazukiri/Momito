# ADR-0009: CareerOS pipeline stage machine & transition history

## Status
**PROPOSED** — 2026-07-08. Design pending SPIKE-009 / MOM-103; first increment (auto-logged
transitions, MOM-102) is schema-free. Decision record: D-011. Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`.

## Context
`JobApplication.status` is a flat `String` (constrained to the 8-value `JOB_APPLICATION_STATUSES`
enum only at the DTO layer). There are no per-stage timestamps and no transition history, so the app
cannot answer "how many applied→interview," "how long am I stuck in OA," or "which source/résumé
converts." No funnel/conversion analytics exist anywhere — the single most actionable missing insight
at 30+ applications.

## Decision (to be finalized in SPIKE-009)
Record every status transition (from→to, when). Increment 1 (MOM-102, no schema): `jobs.service.update()`
special-cases a status change to auto-create a structured `JobEvent`. Increment 2 (SPIKE-009 / MOM-103-104):
add per-stage timestamps and/or a normalized `StatusTransition` table — the spike decides which shape
best supports funnel timing + stall detection without bloating the busy `JobApplication` row. The 8-value
const enum stays the source of truth for allowed stages; no free-for-all transitions.

## Consequences
Enables the funnel/conversion card (MOM-101), time-in-stage stall detection (MOM-105), and
rejection-reason loss analysis (MOM-106). Migration is additive; gated by D-004.
