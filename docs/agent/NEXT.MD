# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> Implementers touch only what "Allowed files" permits. Full backlog: `BACKLOG.md`.

---

## MOM-003 - Archive legacy Python backend & Expo mobile

**Status:** READY
**Owner:** EITHER
**Depends on:** MOM-001

### Goal
Move abandoned `backend/` (Python) and `mobile/` (Expo) out of the active build path without deleting history.

### User-visible outcome
Cleaner repo; `pnpm install` and `pnpm build` no longer touch dead apps.

### Allowed files
- `git mv backend/ archive/backend/`
- `git mv mobile/ archive/mobile/`
- `pnpm-workspace.yaml` only if inspection finds an active reference to the moved paths
- `archive/README.md`
- Agent bookkeeping: `docs/agent/LOG.MD`, `docs/agent/NEXT.MD`, `docs/agent/LOCKS.MD`

### Forbidden changes
- Do not delete `backend/` or `mobile/`; move only.
- Do not touch `apps/*` source.
- No schema, migrations, or dependency changes.
- Do not implement README rewrite or app code cleanup here.

### Acceptance criteria
1. `backend/` and `mobile/` no longer exist at repo root.
2. Both trees are present under `archive/`.
3. `git log --follow archive/backend/pyproject.toml` can show history.
4. `pnpm-workspace.yaml` still excludes the archived apps from active workspaces.
5. Any `docker-compose.yml` or `justfile` references to the moved paths are updated or documented as dead.

### Verification
```bash
pnpm build
git log --follow archive/backend/pyproject.toml --oneline -5
rg "mobile/|backend/" justfile docker-compose.yml
```

### Manual test
Fresh `pnpm install` should not reference Python or Expo packages.

### Rollback
```bash
git mv archive/backend backend
git mv archive/mobile mobile
```

### Commit message
```text
chore(repo): archive legacy python backend and expo mobile
```