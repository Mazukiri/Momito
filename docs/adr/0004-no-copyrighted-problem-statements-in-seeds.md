# ADR-0004: No copyrighted problem statements in seed content

## Status
Accepted — 2026-07-05

## Context
Plan §2.2 (Data Invariants) and §8 (Content Factory) require enough DSA/CS/system-design/
behavioral content to make the app useful (Gate 3 targets: 150 DSA items, 150 CS cards, 25
system-design cases, 60 behavioral prompts) while explicitly forbidding copying external problem
statements into seed data: "No copyrighted problem statements are copied into seeds" (§2.2.4) and
"External problems are represented through metadata, links, and original notes only" (§2.2.5).

`apps/api/prisma/seed.ts` and the `Question` model already support `sourceUrl` and
`referenceAnswer`/`notes` fields, meaning the schema is capable of storing either approach — the
risk is procedural (what a future content-seeding task writes into those fields), not structural.
Sites like LeetCode explicitly prohibit republishing their problem text; scraping and storing it
in seed data would create legal exposure for a plan that otherwise emphasizes "enough
high-quality data... without external spreadsheets."

## Decision
Every DSA/CS/system-design/behavioral seed item stores only:
- a `title` (the problem's public name, e.g. "Two Sum" — names are not copyrightable),
- `sourceUrl` / `sourceSlug` / `sourcePlatform` (a link to the original, not its text),
- tags, difficulty, patterns, prerequisites — original classification metadata,
- an **original** practice note (`originalPracticeNote` per plan §8.3) written for this app,
  explaining the approach/pattern rather than restating the problem,
- a machine-readable rubric authored for this app.

No field stores scraped or copy-pasted third-party problem statements, official solutions, or
editorial text. `content:validate` (MOM-024) enforces this mechanically with a
known-copyrighted-statement pattern check (e.g. flagging seed entries whose `notes`/`prompt`
text closely matches known problem-statement fingerprints or exceeds a length threshold typical
of copied statements) and blocks publish (`qualityStatus` promotion) on violation.

## Consequences
- Content-seeding tasks (MOM-045 onward) must write original notes, not paraphrased-but-still-
  derivative restatements of the source problem.
- `content:validate` failing this check is a hard gate — per the kill/defer rule, a content batch
  that fails validation is deferred, not shipped with the check disabled.
- The LeetCode import service (MOM-049, SPIKE-006) may only ingest metadata (title, slug, tags,
  difficulty) via the public GraphQL API — never problem body text — and must document this
  constraint in its own spike output.
- User-authored content (their own STAR stories, personal notes) is exempt — this ADR governs
  seeded/imported third-party-sourced content only.

## Related
- `docs/agent/DECISIONS.MD` — D-008
- `docs/agent/BACKLOG.MD` — MOM-024 (content validation framework), MOM-045..059 (seed batches),
  MOM-049 (LeetCode import), SPIKE-006
