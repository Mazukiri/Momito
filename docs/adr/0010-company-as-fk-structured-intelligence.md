# ADR-0010: Company as a first-class FK with structured interview intelligence

## Status
**ACCEPTED** — 2026-07-10 (SPIKE-012 / MOM-120 resolved; supersedes the PROPOSED stub of 2026-07-08).
Decision record: D-012 (catalog-as-FK) + D-017 (this design). Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`.
Implemented by MOM-121 (structured columns) then MOM-122 (the FK) — two separate additive migrations.

## Context
`JobApplication.company` is free text, disconnected from the curated 20-company `Company` catalog, so
the catalog and the real pipeline are two worlds. `Company` itself is `name/region/notes` only — no
interview process, no focus-area weights, no comp band, and no first-class sponsorship data (critical
for an emigrant; today `visaTag` is a hand-typed per-application badge defaulting to `unknown`). The
focus/track information already exists but is packed as **prose** in `Company.notes`
(e.g. *"Focus areas: system design, DSA depth… Linked tracks: big-tech-swe, google-l4-swe."*) — a
D-003 stopgap that readiness math cannot consume.

## SPIKE-012 findings (backfill safety)
A read-only match-rate check on the live dev DB (7 job applications, 20 catalog companies): **6/7 jobs
(86%)** case-insensitively match a unique catalog `Company.name` and would backfill; the 1 miss
("Datadog") is simply not in the 20-pack — it correctly stays `null` and keeps rendering its free text.
**Zero duplicate company names** exist, but users *can* create dupes via `POST /companies` (no unique
constraint on `Company.name`), so the backfill guards with `HAVING count(*) = 1`. Conclusion: exact
case-insensitive matching is safe and high-yield; fuzzy matching is rejected (a wrong link is worse than
no link).

## Decision

### Part 1 — structured `Company` columns (MOM-121, migration 1)
Add, all additive with safe defaults:
- `focusAreas Json @default("{}")` — a map `{ [CareerRoleAreaId]: weight 1–5 }`. **Json map, not a
  relation table:** the area taxonomy is TS-owned (`CAREER_ROLE_AREA_IDS`), `Question` already stores
  `roleTags/areaTags/patternTags` as Json, and the only query is "load one company, weight its readiness"
  — never "find companies by area". Keys are validated against `CAREER_ROLE_AREA_IDS` in the DTO layer so
  garbage keys can't leak into readiness math.
- `roleTrackIds Json @default("[]")` — `CareerRoleTrackId[]` (the "Linked tracks:" prose, structured).
- `interviewProcess Json @default("[]")` — ordered `[{ roundType, label, notes? }]` where `roundType`
  aligns with `INTERVIEW_ROUND_TYPES` (ADR-0013), so MOM-123 can render a pipeline preview.
- `sponsorshipStatus String?` — a `VISA_TAGS` value (`sponsored|unknown|not_sponsoring`). Reuses the
  existing taxonomy (one badge component serves both company- and application-level data). `null` = no
  data (do **not** default to `'unknown'`); a per-application `visaTag` still overrides.
- `compBand String?` — free text (mirrors `compensationNotes`); structured min/max deferred until a
  filter needs it.

Seed enrichment hand-maps the 20 packs from their existing prose into these columns in
`apps/api/prisma/seed-data.ts` (e.g. Google → `focusAreas {system_design:5, dsa:5, cs_fundamentals:3}`,
`roleTrackIds ['big-tech-swe','google-l4-swe']`, `sponsorshipStatus 'sponsored'`). `notes` prose is kept
untouched as the human-readable fallback. `seed.ts` upserts by fixed UUID, so existing DBs pick up the
values on the next `prisma db seed`.

### Part 2 — `companyId` FK on `JobApplication` (MOM-122, migration 2, highest-risk)
- `companyId String? @map("company_id") @db.Uuid` + relation `companyRef Company? @relation(..., onDelete: SetNull)`
  + `@@index([companyId])`; `Company` gains `jobApplications JobApplication[]`.
- The relation field is `companyRef`, not `company` (which stays as the **retained free-text column** —
  never dropped, D-004 fallback + display).
- **`onDelete: SetNull`** (not the Cascade used by `QuestionCompany`): a user's pipeline must survive a
  catalog deletion, and the free-text `company` keeps displaying. `companies.service.remove()`'s
  `rethrowDeleteConstraint` guard stays for question/story joins only.
- Name-match backfill runs in the migration SQL (exact case-insensitive, `HAVING count(*)=1` dup guard,
  idempotent — fills only NULLs). Non-matches stay null and are user-linkable from the edit form.

### Downstream (enabled, wired as the tasks land)
`career.service.getJobReadiness`/`getJobStoryGaps` weight areas by `companyRef.focusAreas` when linked
(retro-enriches MOM-130/131); `sessions.service` job_prep can switch from name-match to the FK;
sponsorship reaches the filter (MOM-124) and targeting shortlist (MOM-125); company detail page (MOM-123)
renders interview process + linked `QuestionCompany`/`StoryCompany` content.

## Consequences
Two independently-revertible additive migrations isolate the risky FK change. **Rollback** = revert app
code (columns are inert) or hard-drop the added columns/index/FK; **zero data loss** because the free-text
`company` column is never touched and the backfill only fills NULLs. Trade-off: keeping denormalized
`company` text can drift after a catalog rename — display prefers `companyRef.name` when linked. Gated by
D-004 (standing blanket approval in effect).
