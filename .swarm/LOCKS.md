# Locks

Agents should claim files/directories before editing.

| Agent | Task | Files/Dirs | Since |
|---|---|---|---|
| AGY | AGY-001 | .swarm/BOARD.md, .swarm/LOCKS.md, .swarm/HANDOFF.md | 2026-06-19 |
| Claude | ARCH-001 | .swarm/DECISIONS.md | 2026-06-19 |
| Codex | ARCH-002 | apps/api/**, packages/shared/** | 2026-06-19 |
| Codex | P0-001 | package.json, .gitignore, apps/api/.env.example, apps/web/.env.local.example | 2026-06-20 |
| Claude | P0-002 | .swarm/DECISIONS.md, .swarm/QA.md | 2026-06-20 |
| DeepSeek | P3-001 | apps/web/app/** | 2026-06-20 |

## Rule

If a path is locked, other agents may read it but must not edit it.
