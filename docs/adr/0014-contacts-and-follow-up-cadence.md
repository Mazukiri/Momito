# ADR-0014: Contacts & follow-up cadence

## Status
**ACCEPTED** — 2026-07-10 (SPIKE-011 resolved, implemented in MOM-116+117). Decision record: D-018.
Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`. Follow-up cadence (MOM-118) and referral view (MOM-119)
build on this model.

## Context
Networking is invisible in the pipeline. A job's only contact signal is the free-text
`JobApplication.referralName` — a single string, not reusable, not queryable, with no relationship type,
no email/LinkedIn, and no way to see "who do I know across all my applications". The CareerOS loop needs
contacts as first-class records to drive referral nudges and thank-you follow-ups.

## Decision (SPIKE-011 resolved)
A new **`Contact`** model, not more columns on `JobApplication`:

- Fields: `name` (required), `email?`, `linkedinUrl?`, `company?` (free text — a contact's employer,
  independent of the catalog), `relationship String?` (one of `CONTACT_RELATIONSHIPS` =
  recruiter | referrer | hiring_manager | peer | other, constrained at the DTO), `notes?`, timestamps.
- **`jobApplicationId String?` FK with `onDelete: SetNull`**: a contact can be standalone *or* attached to
  a job; a job has many contacts; deleting the job keeps the contact (just detaches it). SetNull, not
  Cascade, because your network outlives any single application.
- `JobApplication.referralName` is **kept** (D-004 — never drop a column with data) as a legacy display
  fallback.

**Backfill (SPIKE-011): create-only, idempotent, dedup-safe.** In the migration, each job's non-empty
`referralName` becomes a `Contact {relationship:'referrer', jobApplicationId}`:

```sql
INSERT INTO "contacts" (...)
SELECT gen_random_uuid(), s.user_id, s.job_application_id, s.name, 'referrer', now(), now()
FROM (
  SELECT DISTINCT ON (ja.user_id, lower(trim(ja.referral_name)))
    ja.user_id, ja.id AS job_application_id, trim(ja.referral_name) AS name
  FROM job_applications ja
  WHERE ja.referral_name IS NOT NULL AND trim(ja.referral_name) <> ''
  ORDER BY ja.user_id, lower(trim(ja.referral_name)), ja.created_at ASC
) s
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.user_id = s.user_id AND lower(trim(c.name)) = lower(trim(s.name)));
```

`DISTINCT ON (userId, lower(name))` collapses a name referred on several jobs to a single contact (earliest
job wins); `NOT EXISTS` makes a re-run a no-op. There is deliberately **no** unique DB constraint on
`(userId, name)` — users can have genuine namesakes; idempotency lives in the migration SQL, not the schema.

**API.** A `contacts` module mirrors `interview-rounds`, but exposes **both** route groups from one
controller: `/contacts` (standalone list/create/update/delete) and `/jobs/:jobId/contacts` (job-scoped
list/create). The nested create takes the job from the path.

## Consequences
Zero data loss (referralName untouched; the backfill only inserts). Enables the job-detail contacts card
(MOM-117), stage-driven follow-up + thank-you reminders (MOM-118), and the referral-network view (MOM-119).
Rollback = drop the table + FK; referralName still displays. Trade-off: an edited Contact and its origin
`referralName` can diverge — going forward the Contact is the source of truth; referralName is legacy.
