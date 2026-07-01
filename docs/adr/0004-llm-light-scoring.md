# LLM is called only at input and output boundaries, never for scoring

Score calculation is deterministic: set intersection for Skills Match, checklist matching for Project Quality, weighted rules for Experience Depth, regex + structure checks for Presentation. LLM is called exactly twice per session: once to parse a CV PDF into a structured Profile JSON (input boundary), and once to generate human-readable improvement suggestions from the computed gaps (output boundary). This keeps scores auditable and reproducible — adding a skill to the Profile always produces a predictable score change.

## Considered Options

- **LLM-heavy** — rejected because LLM scoring is non-deterministic; the same profile can score differently across calls, which makes progress tracking meaningless.
- **Hybrid with cache** — rejected for now; adds complexity (cache invalidation) without clear benefit over the LLM-light approach.
