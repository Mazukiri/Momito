# AI Collaboration Protocol

This project uses AI Swarm Cockpit.

All agents must follow this protocol.

## Shared files

- `.swarm/chat.log` — human-readable live chat
- `.swarm/messages.jsonl` — message bus used by the router
- `.swarm/BOARD.md` — task board
- `.swarm/LOCKS.md` — claimed files and directories
- `.swarm/DECISIONS.md` — architecture decisions
- `.swarm/QA.md` — bugs, risks, review notes
- `.swarm/HANDOFF.md` — task handoff notes

## Communication

Use these shell commands from inside the project:

```bash
say claude "message"
say codex "message"
say deepseek "message"
say agy "message"
broadcast "message"
```

Do not rely on terminal output alone. If another agent needs to know something, send it through `say` or `broadcast`.

## File ownership

Before editing, update `.swarm/LOCKS.md` or announce in chat:

```txt
I claim apps/api/src/interview-session/* for API-001.
```

Rules:

1. Do not edit files claimed by another agent.
2. Keep patches small.
3. Prefer separate directories per agent.
4. Run relevant checks before reporting done.
5. Update `.swarm/BOARD.md` when task status changes.
6. Update `.swarm/QA.md` when you find a bug, failing test, or risk.
7. Update `.swarm/DECISIONS.md` for important architecture decisions.
8. Do not run destructive commands unless the human explicitly approves.

## Agent roles

- AGY: orchestrator, planner, task board owner
- Claude: architect, reviewer, design critic
- Codex: main backend/integration implementer
- DeepSeek: frontend/component/test/doc implementer

## Completion report

When done with a task, send a message like:

```bash
say agy "DONE API-001. Changed files: ... Checks run: ... Risks: ..."
```
