# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> Implementers touch only what "Allowed files" permits. Full backlog: `BACKLOG.md`.
> See `LOG.MD` for full history. As of this update: mobile shell, dark mode, PWA manifest,
> API security/health/logging, Knowledge Kernel types, content validation framework, a
> 99-item DSA ladder, 20 company packs, 10 role tracks, session UI split + timer, error
> boundaries, and the README are all done. DSA ladder is at 99/150.

---

## MOM-048 — Seed DSA ladder batch 4 (150 total)

**Status:** READY
**Owner:** CLAUDE or CODEX
**Depends on:** MOM-047 (done — DSA ladder at 99/150, validated cleanly with 0 errors)

### Goal
Finish the DSA ladder to the plan's Gate-3 target of 150 items. Batches 1-3 (MOM-045/046/
047) covered all 20 `DSA_PATTERNS` with 2-3 examples each at ~99 total items. This task
adds ~50 more to reach 150, rounding out remaining gaps and adding a few more advanced/hard
problems so the ladder has a genuine top tier, not just easy/medium depth.

### User-visible outcome
DSA content reaches its full planned depth; ready for the DSA ladder UI (MOM-051) and
progress API (MOM-050) once those are built.

### Allowed files
- `apps/api/prisma/seed.ts` (append to the `questions` array only — do not reorder or
  renumber existing entries). If the file has become unwieldy, consider (as a separate,
  clearly-labeled commit) extracting DSA content into its own module imported by
  `seed.ts` — do not mix a refactor and new content into one commit.

### Forbidden changes
- **No copied problem statements** (D-008 / ADR-0004). Original notes only; `sourceUrl`
  links to the real source — only use LeetCode slugs you're highly confident are correct
  and stable. Before treating this as production-ready, a live spot-check of a sample of
  `sourceUrl`s against the real site is recommended (not done in MOM-045/046/047 — no
  network access in that sandbox).
- No schema/migration changes. No changes to non-DSA seed content.
- Do not renumber/reorder existing `companies` or `questions` array entries.

### Acceptance criteria
- `pnpm content:validate` passes with 0 errors on the full seed set.
- `pnpm content:stats` shows DSA count at roughly 150 (±5).
- Difficulty distribution includes a meaningful hard tier (batches 1-3 skew
  easy/medium-heavy — aim for hards to be a genuine third of new items this round).

### Verification
```bash
pnpm content:validate
pnpm content:stats
pnpm --filter @momito/api typecheck
pnpm --filter @momito/api test
```

### Manual test
`pnpm content:sample 8` (from `apps/api`, or via the root `content:sample` script) —
confirm no entry reads like a restated problem body.

### Rollback
`git checkout -- apps/api/prisma/seed.ts`

### Commit message
```text
feat(content): seed DSA ladder batch 4 (150 total)
```

### After completing
1. Append an entry to `LOG.MD`.
2. Gate 3 (Data Depth) also needs CS Fundamentals (150), System Design (25), Behavioral
   (60), Company Packs (20 — done), Role Tracks (8 — done) before it's complete. Once the
   DSA ladder hits 150, a reasonable next task is **MOM-052 — Seed CS Fundamentals batch 1
   (50 items)**, following the same original-notes-only pattern (D-008 applies less
   strictly here since these aren't sourced from a single external site, but original
   authorship is still required).
3. Release any locks in `LOCKS.MD`.
