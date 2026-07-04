# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> Implementers touch only what "Allowed files" permits. Full backlog: `BACKLOG.md`.
> See `LOG.MD` for full history — 25 tasks landed across two sessions (mobile shell, dark
> mode, PWA, API security/health/logging, Knowledge Kernel types, content validation, a
> 50-item DSA ladder batch, 20 company packs, 10 role tracks, session UI split + timer,
> error boundaries, README rewrite).

---

## MOM-047 — Seed DSA ladder batch 3 (100 total)

**Status:** READY
**Owner:** CLAUDE or CODEX
**Depends on:** MOM-046 (done — DSA ladder at 50/150, validated cleanly with 0 errors)

### Goal
Continue the DSA ladder toward the plan's Gate-3 target of 150 items. MOM-045+046 shipped
50 items spanning all 20 `DSA_PATTERNS` at least once. This task adds ~50 more original
items to reach roughly 100 total DSA questions, adding a second/third layer of depth to
every pattern (real ladders need multiple problems per pattern at increasing difficulty,
not just one).

### User-visible outcome
Deeper DSA practice coverage; better material for the future DSA ladder UI (MOM-051) and
progress tracking (MOM-050).

### Allowed files
- `apps/api/prisma/seed.ts` (append to the `questions` array only — do not reorder or
  renumber existing entries).
- `packages/shared/src/index.ts` only if truly justified — the 20 `DSA_PATTERNS` should
  already be broad enough; do not add a pattern just to have a new tag.

### Forbidden changes
- **No copied problem statements** (D-008 / ADR-0004). Original notes only; `sourceUrl`
  links to the real source — only use LeetCode slugs you're highly confident are correct
  and stable.
- No schema/migration changes. No changes to non-DSA seed content.
- Do not renumber/reorder existing `companies` or `questions` array entries.

### Acceptance criteria
- `pnpm content:validate` passes with 0 errors on the full seed set.
- `pnpm content:stats` shows DSA count at roughly 100 (±5).
- Difficulty distribution stays roughly balanced across the DSA set as a whole (a mix of
  easy/medium/hard, not all one tier).

### Verification
```bash
pnpm content:validate
pnpm content:stats
pnpm --filter @momito/api typecheck
pnpm --filter @momito/api test
```

### Manual test
`pnpm content:sample 8` (run from `apps/api`, or via the root `content:sample` script) —
confirm no entry reads like a restated problem body.

### Rollback
`git checkout -- apps/api/prisma/seed.ts`

### Commit message
```text
feat(content): seed DSA ladder batch 3 (100 total)
```

### After completing
1. Append an entry to `LOG.MD`.
2. Set `NEXT.MD` to **MOM-048 — Seed DSA ladder batch 4 (150 total)** if batch 3 validates
   cleanly, per the kill/defer rule.
3. Release any locks in `LOCKS.MD`.
