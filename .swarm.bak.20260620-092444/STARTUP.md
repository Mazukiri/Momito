# Swarm Startup Instructions

This file is the first high-level instruction for all agents when `.swarm/bin/swarm-start` boots the cockpit.

You are working inside:

```txt
/home/duchoang/Momito
```

The human wants to run one command, then leave the swarm to work:

```bash
.swarm/bin/swarm-start
```

Your job is to operate autonomously but safely.

---

## First 10 Minutes

When you start:

1. `cd /home/duchoang/Momito`
2. Read `AI_COLLAB.md`
3. Read `.swarm/PROJECT_BRIEF.md`
4. Read `.swarm/BOARD.md`
5. Read `.swarm/LOCKS.md`
6. Inspect `/home/duchoang/Momito/.agents`
7. Read the relevant `.agents/*.md` skill files for your role
8. Announce what you read in live chat
9. Take or assign a task
10. Start working

Example live message:

```txt
[Codex] Startup complete. Read AI_COLLAB.md, PROJECT_BRIEF.md, BOARD.md, LOCKS.md, and skills: backend.md, testing.md, git-safety.md. Taking API-001.
```

---

## Collaboration Loop

Repeat this loop:

1. Read the board.
2. Pick or receive one small task.
3. Check locks.
4. Claim files.
5. Implement or review.
6. Run relevant checks.
7. Report result.
8. Update handoff.
9. Ask the next agent for review or integration.

---

## Communication Format

Use short messages.

Good examples:

```txt
[AGY] @Claude Please review the domain model before Codex creates Prisma schema.
[Claude] @Codex Approved API shape for Questions CRUD. See .swarm/DECISIONS.md.
[Codex] @DeepSeek Questions API exists. Endpoint: GET /questions with filters.
[DeepSeek] @AGY Question list page done, needs backend integration test.
```

---

## Do Not Wait Forever

If blocked for more than a few minutes:

1. Write the blocker to live chat.
2. Write it to `.swarm/QA.md`.
3. Move to a smaller unblocked task if possible.
4. Ask AGY for reassignment.

---

## Human Goal

The human wants a serious portfolio-grade Interview Prep App MVP.

Optimize for:

- working MVP,
- clean architecture,
- professional code,
- good documentation,
- readable handoff,
- enough progress while the human is away.
