# ADR-0012: ResumeVersion decoupled from the unique Profile

## Status
**ACCEPTED** — 2026-07-10 (SPIKE-014 resolved, model implemented in MOM-132+133). Decision records: D-014
(Profile stays master), D-020 (ResumeVersion shape). Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`. Downstream:
MOM-134-full (ATS vs a version), MOM-139 (export), MOM-136–138 (AI, dormant-until-key), MOM-145 (conversion).

## Context
`Profile.userId` is `@unique` and re-upload overwrites, so there is no way to keep a Google-tailored vs
a quant-tailored résumé, no record of which résumé was sent per application, no bullet rewriting, no ATS
optimization, and no export (the app ingests a PDF but can never emit one). The Anthropic scaffold
(`grading.service.ts`) exists but is unwired from résumé work. The owner will add an API key soon.

## Decision (SPIKE-014 resolved)
Add a **`ResumeVersion`** entity (many per user/target), decoupled from the master `Profile`:

- Fields: `label` ("Google-tailored v2"), `targetRoleTrackId?`, `jobApplicationId?` FK **SetNull** (records
  which version was sent to which job; survives the job's deletion), **`contentMd String`** (the canonical
  editable content — Markdown, not a blob of JSON), `baseProfileSnapshot Json?` (what it was derived from, for
  provenance/diffing), `aiSuggestions Json @default("[]")` (where MOM-137 writes accept/reject suggestions).
- **`contentMd` is Markdown, deterministic-first.** On create without an explicit `contentMd`, the server
  derives it from the current `Profile` via a `profileToMarkdown` serializer (name/contact → Skills →
  Experience → Projects → Education) and snapshots the source. This makes the artifact editable, diffable,
  ATS-exportable (MOM-139), and AI-tailorable (MOM-137) without a bespoke schema per section.
- The base `Profile` stays the single master (D-014); versions are **derived artifacts** the user then edits.
- API: a `resumes` CRUD module (`/resumes`), PUT-less (POST/PATCH/DELETE); one version has one job link.

Deterministic downstream first: ATS keyword coverage vs a version's `contentMd` (MOM-134-full), Markdown then
ATS-safe PDF export (MOM-139). AI-first tailoring (semantic bullet rewriting, impact/seniority feedback, cover
letters — MOM-136–138) reuses `grading.service` (`isAvailable()` gating, budget, `zodOutputFormat`) and is
built **dormant-until-key**, VERIFICATION-BLOCKED until a real `ANTHROPIC_API_KEY` verifies the live path —
exactly the MOM-068 pattern.

## Consequences
The base `Profile` stays the master; versions derive from it. New PDF-export dependency chosen in the
spike (ATS-safe output). Enables which-résumé-converts analytics (MOM-145). Additive migration gated by
D-004; AI tasks land with zero-network mocked tests.
