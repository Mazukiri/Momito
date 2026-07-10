# ADR-0015: Offer model & comparison

## Status
**ACCEPTED** — 2026-07-10 (SPIKE-015 resolved, implemented in MOM-114+115). Decision record: D-019.
Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`.

## Context
The pipeline can reach `offer` but the app has nowhere to record what the offer actually *is* — comp,
equity, deadline, visa terms — nor compare competing offers. The only prior signal was the free-text
`JobApplication.compensationNotes`. SPIKE-015 flagged the over-modeling risk: multi-currency FX conversion,
vesting schedules, tax modeling — none of which a v1 needs.

## Decision (SPIKE-015 resolved — deliberately minimal)
A new **`Offer`** model, at most one per application:

- `jobApplicationId @unique` (one offer per job; nullable so a standalone offer is possible), `onDelete:
  Cascade` (an offer has no meaning without its job).
- Comp as `Decimal?`: `baseSalary`, `bonus`, `equityTotal`, plus `equityYears Int @default(4)`. `currency
  String @default("USD")`, `location?`, `visaSponsored Boolean?`, `deadline Date?`, `notes?`, `status`
  (OFFER_STATUSES = received | negotiating | accepted | declined | expired, default `received`).
- `compensationNotes` on JobApplication is **kept** (D-004 fallback).

**Normalized annual total** = `base + bonus + equityTotal / equityYears`, computed at **read time** in the
serializer (null when no comp figure is set). **Single-currency v1: no FX conversion** — the comparison view
shows each offer in its own currency and prints a warning when currencies differ. This is the explicit
SPIKE-015 scope cut; multi-currency conversion is a v2 concern (needs a rate source + as-of date).

**API.** An `offers` module: `GET /offers` (the comparison list, richest-first sorted client-side) and the
per-job single offer at `GET/PUT/DELETE /jobs/:jobId/offer` (PUT upserts on the unique `jobApplicationId`, so
the UI never juggles an offer id).

## Consequences
Enables the offer-comparison view (MOM-115) and an offer card on the job page (MOM-114). Money is `Decimal`
in the DB, surfaced as `number` in the API. Rollback = drop the table (compensationNotes still displays).
Trade-offs (accepted for v1): no FX, no vesting cliffs/schedules (flat amortization over `equityYears`), no
tax/cost-of-living adjustment. The `visaSponsored` flag is the one emigration-specific column, since that can
override a higher headline number.
