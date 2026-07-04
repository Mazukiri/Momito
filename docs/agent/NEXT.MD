# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> Implementers touch only what "Allowed files" permits. Full backlog: `BACKLOG.md`.
> See `LOG.MD`'s 2026-07-05 "Bulk implementer pass" entry for everything already done —
> 24 tasks landed across Tracks A-K in this session (mobile shell, dark mode, PWA, API
> security/health/logging, Knowledge Kernel types, content validation, a 17-item DSA
> starter batch, 20 company packs, 10 role tracks, session UI split + timer, error
> boundaries). This file now points at the next real, unblocked task.

---

## MOM-046 — Seed DSA ladder batch 2 (50 total)

**Status:** READY
**Owner:** CLAUDE or CODEX
**Depends on:** MOM-045 (done — DSA_PATTERNS taxonomy + 17-item starter batch already seeded)

### Goal
Continue the DSA ladder toward the plan's Gate-3 target of 150 items. MOM-045 shipped a
17-item starter batch (13 easy/medium classics + 2 hard) covering ~11 of the 20
`DSA_PATTERNS`. This task adds enough additional original items to reach roughly 50 total
DSA questions, covering the patterns MOM-045 didn't touch yet (check `DSA_PATTERNS` in
`packages/shared/src/index.ts` against existing `patternTags` in `prisma/seed.ts`'s DSA
block to find gaps — at minimum: `cyclic_sort`, `union_find`, `bit_manipulation`, `trie`
have no seeded item yet).

### User-visible outcome
More DSA content available in Practice/Questions; better pattern coverage for the (future)
DSA ladder UI (MOM-051).

### Allowed files
- `apps/api/prisma/seed.ts` (append to the `questions` array only — do not reorder or
  renumber existing entries; company/question array indices are referenced positionally
  elsewhere in the file).
- `packages/shared/src/index.ts` only if a genuinely new pattern is needed beyond the
  existing 20 in `DSA_PATTERNS` (unlikely — the taxonomy should already be broad enough).

### Forbidden changes
- **No copied problem statements** (D-008 / ADR-0004). `prompt`/`answer` must be original
  notes written for this app; `sourceUrl` links to the real source (only use LeetCode slugs
  you are highly confident are correct and stable — well-known, long-established problems).
- No schema/migration changes. No changes to non-DSA seed content.
- Do not renumber/reorder existing `companies` or `questions` array entries.

### Acceptance criteria
- `pnpm content:validate` passes with 0 errors on the full seed set.
- `pnpm content:stats` shows DSA count at roughly 50 (±5), with each of the 20
  `DSA_PATTERNS` represented by at least one item once this batch and MOM-045 are combined
  (or a documented reason why a given pattern is deferred to MOM-047/048).
- Difficulty distribution stays roughly balanced (don't dump 30 hards).

### Verification
```bash
pnpm content:validate
pnpm content:stats
pnpm --filter @momito/api typecheck
pnpm --filter @momito/api test
```

### Manual test
`pnpm content:sample 8` — read the sample and confirm no entry reads like a restated
problem body (should read like a hint/approach note, not the problem itself).

### Rollback
`git checkout -- apps/api/prisma/seed.ts packages/shared/src/index.ts`

### Commit message
```text
feat(content): seed DSA ladder batch 2 (50 total)
```

### After completing
1. Append an entry to `LOG.MD`.
2. Set `NEXT.MD` to **MOM-047 — Seed DSA ladder batch 3 (100 total)** if batch 2 validates
   cleanly, per the kill/defer rule ("defer batch 3 if batch 1/2 fails validation").
3. Release any locks in `LOCKS.MD`.
