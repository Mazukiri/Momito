# ADR-0009: CareerOS pipeline stage machine & transition history

## Status
**ACCEPTED** — 2026-07-10 (SPIKE-009 resolved, implemented in MOM-103+104). First increment
(auto-logged transitions, MOM-102, schema-free) shipped 2026-07-08; the structured-column increment
(MOM-103+104) shipped in migration `job_event_transition_status`. Decision record: D-011.
Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`.

## Context
`JobApplication.status` is a flat `String` (constrained to the 8-value `JOB_APPLICATION_STATUSES`
enum only at the DTO layer). There are no per-stage timestamps and no transition history, so the app
cannot answer "how many applied→interview," "how long am I stuck in OA," or "which source/résumé
converts." No funnel/conversion analytics exist anywhere — the single most actionable missing insight
at 30+ applications.

## Decision (SPIKE-009 resolved)
Record every status transition (from→to, when) as **structured columns on the existing `JobEvent`
row**, not a new table and not per-stage timestamps on `JobApplication`:

- **`JobEvent.fromStatus` / `JobEvent.toStatus`** (both `String?`, nullable — set only on
  `type = 'status_change'` events; null on other event types). `title` is kept for human-readable
  display ("saved → applied"); the structured pair is the machine-readable source of truth.
- **Rejected alternatives:**
  - *A normalized `StatusTransition` table* — would force a permanent dual-write with the MOM-102
    `JobEvent` audit trail (the same fact in two places), or a migration of the existing events. The
    events already exist and are already ordered by `eventAt`; adding two columns to them is strictly
    less machinery.
  - *Eight per-stage timestamp columns on `JobApplication`* — cannot represent a stage being revisited
    (e.g. onsite → rejected → reopened), and bloats the busiest, most-read row in the schema. Transition
    rows model revisits for free.

**Backfill:** the MOM-102 titles are machine-written (`"${from} → ${to}"` with a U+2192 arrow), so the
migration reconstructs the columns with `split_part(title, ' → ', 1/2)`, guarded by `from_status IS NULL`
(idempotent) and an `IN (…known statuses…)` filter on both endpoints (any hand-typed or malformed title
is a no-op). No data is lost; the free-text title remains.

**Funnel timing (MOM-104):** `jobs.service.funnel()` loads the user's ordered `status_change` events and
diffs consecutive `eventAt`s per job to get each stage's occupancy duration; the **first** stage's entry
is approximated by `job.createdAt` (there is no transition *into* the initial saved state). Stage revisits
each contribute a sample, so the surfaced number is a **median** (`medianDaysInStage`), not a single span.
The still-open current stage contributes no sample. Pre-MOM-102 apps with no events surface `null`.

## Consequences
Enables per-stage timing on the funnel card (MOM-104, live), time-in-stage stall detection (MOM-105),
and rejection-reason loss analysis (MOM-106). The `reached`/conversion counts remain a current-status
snapshot (an app rejected after onsite counts as an outcome, not as having reached onsite) — only *timing*
is history-grounded. Migration is additive (rollback = drop the two columns); gated by D-004 (standing
approval).
