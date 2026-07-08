# ADR-0012: ResumeVersion decoupled from the unique Profile

## Status
**PROPOSED** — 2026-07-08. Design pending SPIKE-014 / MOM-132. Decision record: D-014.
Plan: `docs/plans/MOMITO_CAREEROS_PLAN.md`.

## Context
`Profile.userId` is `@unique` and re-upload overwrites, so there is no way to keep a Google-tailored vs
a quant-tailored résumé, no record of which résumé was sent per application, no bullet rewriting, no ATS
optimization, and no export (the app ingests a PDF but can never emit one). The Anthropic scaffold
(`grading.service.ts`) exists but is unwired from résumé work. The owner will add an API key soon.

## Decision (to be finalized in SPIKE-014)
Add a `ResumeVersion` entity (many per user/target, linkable to a `JobApplication` to record which was
sent), decoupled from the master `Profile`. Deterministic first: ATS keyword coverage vs a JD (extend
`extractJdSkills`, MOM-134), gap→task bridge (MOM-135), Markdown then ATS-safe PDF export (MOM-139).
AI-first tailoring (semantic bullet rewriting, impact/seniority feedback, cover letters — MOM-136-138)
reuses `grading.service` (`isAvailable()` gating, budget, `zodOutputFormat`) and is built
**dormant-until-key**, VERIFICATION-BLOCKED until a real `ANTHROPIC_API_KEY` verifies the live path —
exactly the MOM-068 pattern.

## Consequences
The base `Profile` stays the master; versions derive from it. New PDF-export dependency chosen in the
spike (ATS-safe output). Enables which-résumé-converts analytics (MOM-145). Additive migration gated by
D-004; AI tasks land with zero-network mocked tests.
