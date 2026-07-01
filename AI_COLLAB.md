# AI Collaboration Protocol for Momito

This repository is operated by a four-agent swarm:

- **AGY**: orchestrator / project manager
- **Claude**: architect / reviewer
- **Codex**: backend / integration implementer
- **DeepSeek**: frontend / UI / docs implementer

The human should be able to run:

```bash
cd /home/duchoang/Momito
.swarm/bin/swarm-start
```

Then the agents should read the project files, coordinate through live chat, claim work, implement the MVP, and report progress without requiring manual babysitting.

---

## Absolute Project Root

All agents must assume the project root is:

```txt
/home/duchoang/Momito
```

Before doing any work:

```bash
cd /home/duchoang/Momito
```

---

## Mandatory Reading Order

Every agent must read these files before planning or editing:

1. `AI_COLLAB.md`
2. `.swarm/PROJECT_BRIEF.md`
3. `.swarm/BOARD.md`
4. `.swarm/LOCKS.md`
5. `.swarm/STARTUP.md`
6. Relevant skill files under `.agents/`

The local skills directory is mandatory:

```txt
/home/duchoang/Momito/.agents
```

Every agent must inspect this directory before doing any task.

---

## Mandatory Live Chat Rule

All progress must be announced in live chat using the provided swarm messaging commands.

Preferred examples:

```bash
say agy "I have read PROJECT_BRIEF.md and will start planning."
say claude "Please review the domain model in .swarm/DECISIONS.md."
say codex "Please implement the Questions API according to DECISIONS.md."
say deepseek "The API contract is ready. Please build the question list page."
broadcast "Current sprint focus: MVP skeleton, Questions CRUD, Practice Session flow."
```

If the command names differ in the local swarm implementation, use the equivalent available command.

Each agent must announce:

- which task it is taking,
- which files or directories it is claiming,
- which `.agents` skill files it read,
- what it changed,
- which checks it ran,
- what remains blocked.

---

## File Locking Rule

Before editing files, an agent must check `.swarm/LOCKS.md`.

If a path is already claimed by another agent, do not edit it.

To claim work, append a message to live chat and update `.swarm/LOCKS.md` if possible.

Example:

```txt
[Codex] Claiming apps/api/src/questions/** and packages/shared/src/question.ts for API-001.
```

---

## Agent Ownership

### AGY owns

- `.swarm/BOARD.md`
- `.swarm/HANDOFF.md`
- sprint planning
- task assignment
- checking whether the swarm is stuck

AGY should not make large code changes.

### Claude owns

- `.swarm/DECISIONS.md`
- `.swarm/QA.md`
- architecture review
- database/API review
- code review
- risk detection

Claude should mostly review and guide, not implement large features.

### Codex owns

- `apps/api/**`
- `packages/shared/**`
- `infra/**`
- backend tests
- API integration

Codex should implement backend and shared contracts.

### DeepSeek owns

- `apps/web/**`
- frontend components
- frontend pages
- frontend API client
- UI states
- frontend docs

DeepSeek should implement frontend and UI.

---

## Safety Rules

Agents must not run destructive commands unless the human explicitly approves.

Forbidden by default:

```bash
rm -rf
git reset --hard
git clean -fd
git push --force
sudo rm
dropdb
docker volume rm
```

Agents may install dependencies, create files, edit files, run tests, run formatters, and start local services if needed.

Before any risky operation, ask the human.

---

## Git Discipline

Before starting large work, check:

```bash
git status
```

Prefer small, coherent patches.

Do not commit unless explicitly asked by the human.

Always leave a clear handoff in `.swarm/HANDOFF.md`.

---

## Definition of Done for an Agent Task

A task is done only when:

1. The implementation is complete enough for the assigned scope.
2. Relevant typecheck/lint/test commands have been run, or the agent clearly explains why they could not be run.
3. The agent updates live chat.
4. The agent updates `.swarm/HANDOFF.md` with changed files, status, commands run, and next steps.
5. Any bugs or risks are recorded in `.swarm/QA.md`.
