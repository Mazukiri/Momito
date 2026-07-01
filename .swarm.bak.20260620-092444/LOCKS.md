# Locks

Agents should claim files/directories before editing.

| Agent | Task | Files/Dirs | Since |
|---|---|---|---|
| AGY | AGY-001 | .swarm/BOARD.md, .swarm/LOCKS.md, .swarm/HANDOFF.md | 2026-06-19 |
| Claude | ARCH-001 | .swarm/DECISIONS.md | 2026-06-19 |
| Codex | ARCH-002 | apps/api/**, packages/shared/** | 2026-06-19 |

## Rule

If a path is locked, other agents may read it but must not edit it.
