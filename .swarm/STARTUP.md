# Startup Instructions — Productization Run

You are continuing Momito after a successful MVP swarm run.

Do not rebuild the app from scratch.

The uploaded review indicates the app already has:

- Next.js frontend
- NestJS backend
- Prisma/PostgreSQL schema
- auth
- question listing/detail
- practice sessions
- attempts
- dashboard
- study plan

The goal now is to complete and polish the product.

## Read order

Every agent must read:

1. `AI_COLLAB.md`
2. `.swarm/CURRENT_STATE_REVIEW.md`
3. `.swarm/NEXT_PRODUCT_BRIEF.md`
4. `.swarm/PRODUCTION_ROADMAP.md`
5. `.swarm/BOARD.md`
6. `.swarm/QUALITY_GATE.md`
7. `.swarm/RELEASE_CHECKLIST.md`
8. relevant `.agents` skills

## First action by role

### AGY

- announce startup
- assign P0-001 to Codex
- assign P0-002 to Claude
- assign P1-003 exploration to DeepSeek
- keep board and handoff updated

### Claude

- inspect actual code
- update decisions
- review single-question practice design
- identify risks in QA

### Codex

- inspect backend and root config
- start P0-001 unless AGY assigns otherwise
- prepare P1-001 and P1-002

### DeepSeek

- inspect frontend routes
- confirm missing `/questions/new`, `/questions/[id]/edit`, `/settings`
- prepare reusable question form design

## Work style

- Claim files before editing.
- Keep patches small.
- Prefer completing P1 product gaps before speculative features.
- Run checks after meaningful changes.
- Update handoff.
