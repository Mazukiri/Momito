# ADR-0007: AI grading scaffold (dormant until `ANTHROPIC_API_KEY` is set)

## Status
**Implemented, dormant by default** — 2026-07-06. Workstream C of the redesign-plan judgment
pass. Built and unit-tested (mocked Anthropic client, zero network) without any real API key
in this environment; the live Claude call path is therefore unverified against the real
Anthropic API and will only run once a key is added.

## Context
`REDESIGN_PLAN.MD` calls for AI-graded practice answers (score + feedback) as Phase 4. The
schema already had `AnswerAttempt.aiScore`/`aiFeedback` columns sitting dead — read as a
null-fallback in `dsa.service.ts`/`missions.service.ts`, never written. Momito is a
single-user personal tool with no bundled Anthropic credentials, so this feature must:
1. Build and ship without a key present (CI, `pnpm build`, `pnpm test` all key-less).
2. Report itself unavailable rather than 500ing when no key is configured.
3. Never let a slow/expensive/failing model call take down the answer-submission flow it's
   attached to — grading is requested explicitly via a separate endpoint, not inline.
4. Cap spend with a simple daily budget, since a personal tool has no request quota tooling.

## Decision
1. **`AiUsage` table** (`userId`, `day @db.Date`, `requests`, `inputTokens`, `outputTokens`,
   `costUsd`, unique on `(userId, day)`) — one row per user per UTC day, upserted after each
   graded call. Powers both the budget gate and `GET /ai/usage`.
2. **`apps/api/src/ai/`**:
   - `ai.config.ts` — static `$/1M token` price table (`claude-opus-4-8` and neighbors),
     `priceForModel`/`costUsdFor` helpers. Model id and daily budget default (`$1.00`) are
     read via `common/config.ts`'s `getAnthropicModel`/`getAiDailyBudgetUsd`, following this
     repo's existing convention that all env access goes through that one file.
   - `budget.service.ts` — `getUsage`/`checkAndReserve` (refuse once today's spend has
     already met the budget) / `record` (upsert after a real call, cost computed from actual
     token counts — the pre-flight check is necessarily an estimate since real cost is only
     known after Claude replies).
   - `grading.service.ts` — `client.messages.parse()` + `zodOutputFormat(GradeResultSchema)`
     (structured output, GA path — not the beta tool-use workaround), `thinking: {type:
     "adaptive"}`, `output_config: {effort: "high", format: ...}`. Every Anthropic SDK error
     class (`AuthenticationError`, `RateLimitError`, `APIConnectionError`, `BadRequestError`,
     generic `APIError`) is caught most-specific-first and turned into a structured
     `{ok: false, reason}` — **this service never throws for a remote failure.**
   - `ai.service.ts` — orchestrates: 404 if the attempt isn't the caller's, return the cached
     grade unless `?force=true`, refuse (400) if the daily budget is exhausted, else call
     `grading.service`, persist `aiScore` (0–1, matching the existing
     `rubricScore`/`aiScore` convention already used as a `>= 0.6` threshold elsewhere in the
     codebase) and `aiFeedback` (a formatted markdown string — table of rubric criteria
     scores, strengths, gaps, follow-up questions — rendered through the same `Markdown`
     component already used for reference answers), and record budget usage.
3. **Endpoints:** `POST /attempts/:id/grade` (idempotent — replays the cached grade unless
   forced; `?force=true` regrades) and `GET /ai/usage` (returns `{available, ...budgetSnapshot}`
   — the single source of truth the web client polls to decide whether to show any AI
   affordance at all).
4. **`ANTHROPIC_API_KEY` absent ⇒ `available: false` everywhere**, checked explicitly via
   `common/config.ts::isAiGradingAvailable`, not inferred from an SDK construction failure —
   `new Anthropic()` with no key succeeds at construction time and only fails on the first
   call, which would be a much later and less clear failure point.
5. **Model:** `claude-opus-4-8` default (per the plan and the bundled `claude-api` skill's
   current pricing table), overridable via `ANTHROPIC_MODEL`.
6. **Web:** `ai-feedback-card.tsx` renders `aiFeedback` through the existing `Markdown`
   component; a "Grade with AI" affordance appears in the attempt/reflection view **only**
   when `GET /ai/usage` reports `available: true`.

## Consequences
- Zero-key deployments (the default) build, typecheck, lint, and test exactly as before —
  confirmed by running the full suite with `ANTHROPIC_API_KEY` unset.
- The moment a key + `AI_DAILY_BUDGET_USD` are added to `.env` (or `render.yaml`'s secrets),
  the feature activates with no code changes or redeploy logic beyond restarting the API.
- **Known gap, disclosed, not solved by this ADR:** the live Claude API call path
  (`grading.service.ts`'s `messages.parse` call) is only exercised by mocked unit tests in
  this environment — there is no real `ANTHROPIC_API_KEY` available to smoke-test an actual
  graded response end-to-end. The mocked tests cover the request shape (model id, `thinking`,
  `output_config`), the success-parsing path, and every documented SDK error class; they
  cannot catch a live-API contract drift the SDK's own types wouldn't already catch at
  compile time.
- `aiScore`/`aiFeedback` are user-scoped and only ever touched by a request the attempt's
  owner explicitly makes — grading never runs automatically on attempt submission.

## Related
- `apps/api/src/ai/` — implementation.
- `apps/api/prisma/migrations/20260705230553_add_ai_usage/` — the `AiUsage` migration.
- `apps/api/.env.example` — `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`/`AI_DAILY_BUDGET_USD`.
- `render.yaml` — the same three keys, commented `sync: false` for the secret.
- `docs/agent/BACKLOG.md` — the redesign-plan judgment pass, Workstream C.
