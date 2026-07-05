# NEXT - MOM-091

Goal:
Normalize attempt scoring semantics across API, shared types, and current UI so DSA progress and related learning signals stop treating partial or mis-scaled attempts as solved. Keep this within the existing schema; no ReviewState or FSRS work yet.

User-visible outcome:
Practice sessions use one clear self-rating scale, attempt details stop showing conflicting score semantics, and DSA ladder progress becomes more trustworthy after submitting a new DSA attempt.

Allowed files:
- `apps/api/src/sessions/dto/create-answer.dto.ts`
- `apps/api/src/dsa/dsa.service.ts`
- `apps/api/src/dashboard/dashboard.service.ts`
- `apps/api/src/career/career.service.ts`
- `apps/api/src/missions/missions.service.ts`
- `apps/web/app/components/session/AnswerForm.tsx`
- `apps/web/app/(authenticated)/attempts/page.tsx`
- `apps/web/app/(authenticated)/attempts/[id]/page.tsx`
- `apps/web/app/(authenticated)/practice/session/[id]/page.tsx`
- `apps/web/app/(authenticated)/practice/session/[id]/summary/page.tsx`
- `apps/web/app/lib/api-client.ts`
- `packages/shared/src/index.ts`
- `docs/agent/LOG.MD`

Forbidden files:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/app/(authenticated)/today/**`
- `docs/plans/**`
- `docs/agent/BACKLOG.md`
- `docs/agent/DECISIONS.md`

Dependencies:
- MOM-020 already verified in schema/docs.
- No migration approval required because this task must not change the database shape.

Acceptance criteria:
- `selfRating` semantics are standardized to one scale everywhere touched by the current practice flow.
- DSA solved/progress logic no longer counts `partial` as a clean solve.
- Any `aiScore` comparisons match its actual scale, or are removed from solved heuristics until AI scoring is implemented consistently.
- Dashboard/career/mission summaries no longer rely on conflicting success heuristics for the same attempt data.
- Existing answer submission still works without requiring new fields or migrations.

Verification commands:
- `pnpm --filter @momito/shared build`
- `pnpm --filter @momito/api test`
- `pnpm --filter @momito/api build`
- `pnpm --filter @momito/web typecheck`

Manual test:
- Login
- Open `/practice/dsa-ladder`
- Start a DSA session
- Submit one attempt rated below the clean-solve threshold and confirm the ladder does not over-count it as solved
- Submit one clearly solved attempt and confirm progress updates after the session summary/reload
- Open attempt detail/history and confirm the displayed self-rating scale matches the submission UI

Rollback note:
Revert the scoring-semantic changes in API/shared/web together as one unit. Do not keep a mixed state where the UI shows one scale but the API/progress services still interpret another.

Known risks:
- Existing seeded or historical attempts may already contain `selfRating=5`; decide whether to tolerate legacy reads or clamp/ignore them without a migration.
- Mission and dashboard heuristics may currently depend on "positive attempt" behavior; tightening the rule can reduce reported progress counts immediately.
- This task improves truthfulness, not completeness: ReviewState, reflection fields, and Today queue work remain separate follow-up tasks.
