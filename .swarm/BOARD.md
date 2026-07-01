# Swarm Board — Productization Run

## Run Goal

Turn the current Momito MVP into a complete, portfolio-ready product.

The uploaded review shows a good MVP already exists. Do not rebuild from scratch.

Read first:

1. `AI_COLLAB.md`
2. `.swarm/CURRENT_STATE_REVIEW.md`
3. `.swarm/NEXT_PRODUCT_BRIEF.md`
4. `.swarm/PRODUCTION_ROADMAP.md`
5. `.swarm/QUALITY_GATE.md`
6. `.swarm/RELEASE_CHECKLIST.md`
7. relevant `.agents` skills

---

## Coordination Rules

- AGY coordinates and updates this board.
- Claude reviews architecture and product decisions.
- Codex owns backend, shared package, infra, root scripts, tests.
- DeepSeek owns frontend UI, forms, UX polish, docs support.
- Do not overwrite each other's files without claiming locks.
- Update `.swarm/HANDOFF.md` after each task.

---

## Sprint 2 Critical Path

### P0-001 — Repo hygiene and quality scripts

Owner: Codex (Completed)
Reviewer: Claude (Completed)

Scope:

- inspect `.gitignore` files
- ensure generated/local files are ignored:
  - `node_modules`
  - `dist`
  - `.next`
  - `build`
  - `coverage`
  - `*.tsbuildinfo`
  - `.env`
  - `.env.*`
- add root scripts:
  - `typecheck`
  - `test`
  - `db:generate`
  - `db:migrate`
  - `db:seed`
- add env examples:
  - `apps/api/.env.example`
  - `apps/web/.env.local.example`

Definition of done:

- repo hygiene documented
- root quality commands exist
- no secrets are committed

---

### P0-002 — Product and architecture sanity review

Owner: Claude (Completed)
Support: AGY

Scope:

- inspect current code
- update `.swarm/DECISIONS.md`
- document whether to keep localStorage token for now or migrate to httpOnly cookie
- decide exact implementation for single-question practice
- check API/frontend route mismatch
- write issues to `.swarm/QA.md`

Definition of done:

- Codex and DeepSeek have clear implementation decisions
- high-risk decisions are documented

---

### P1-001 — Seed data and first-run experience

Owner: Codex (Completed)  
Support: DeepSeek  
Reviewer: Claude (Completed)

Scope:

- add Prisma seed script
- seed default topics
- seed default companies
- seed at least 30 useful interview questions across backend, JS/TS, database, OS, networking, OOP, system design, behavioral
- update README with seed command
- optionally add dashboard empty-state CTA to seed/import/create questions

Definition of done:

- after migrate + seed, app has meaningful data
- `/questions` is useful immediately

---

### P1-002 — Correct "Practice This Question"

Owner: Codex (Completed)  
Support: DeepSeek  
Reviewer: Claude (Completed)

Scope:

- implement exact-question session creation
- choose one:
  - `questionIds?: string[]` in `POST /sessions`
  - or `POST /questions/:id/practice-session`
- update shared types and frontend API client
- update question detail button to use exact question
- add backend test for exact-question session

Definition of done:

- clicking "Practice This Question" always creates a session containing that exact question

---

### P1-003 — Question Create/Edit/Delete UI

Owner: DeepSeek (Completed)  
Support: Codex  
Reviewer: Claude (Completed)

Scope:

- add `/questions/new`
- add `/questions/[id]/edit`
- create reusable question form
- support title, prompt, type, difficulty, topic, companies, reference answer, notes, source URL
- add delete action with confirmation
- connect to existing backend APIs
- add error/loading/success states

Definition of done:

- user can create, edit, delete questions from UI
- question form works with topics/companies

---

### P1-004 — Topic and Company Management UI

Owner: DeepSeek (Completed)  
Support: Codex
Reviewer: Claude (Completed)

Scope:

- add `/settings` or `/settings/content`
- list topics and companies
- create topic
- create company
- optionally edit/delete if quick
- ensure question form can create missing topic/company or link to settings

Definition of done:

- user can bootstrap content without API tools

---

### P1-005 — Complete Study Plan UX

Owner: DeepSeek (Completed, minor fixes pending)  
Support: Codex
Reviewer: Claude (Completed)

Scope:

- add edit form for existing study plan item
- allow update title/topic/notes/target date
- improve due-date display
- keep delete confirmation
- add useful empty states

Definition of done:

- study plan has create/edit/status/delete

---

### P2-001 — Config and security hardening

Owner: Codex (Completed)  
Reviewer: Claude (Completed)

Scope:

- production mode must require `JWT_SECRET`
- add `CORS_ORIGIN` env support
- consider cookie auth or document localStorage tradeoff
- add basic request/response error consistency if feasible
- ensure no password hash leaks

Definition of done:

- local dev remains easy
- production defaults are safer
- README documents config

---

### P2-002 — Docker/dev bootstrap

Owner: Codex (Completed)
Reviewer: Claude (Completed)

Scope:

- add `infra/docker-compose.yml` or root `docker-compose.yml` for Postgres
- document database setup
- add seed/migrate commands
- ensure README Quick Start works

Definition of done:

- a new dev can run database locally without manual Postgres setup

---

### P2-003 — Testing and CI

Owner: Codex (Completed)  
Support: Claude
Reviewer: Claude (Completed)

Scope:

- add/repair backend tests for new flows
- add root test/typecheck commands
- run build/lint/typecheck/test
- optionally add GitHub Actions workflow

Definition of done:

- quality gate commands run
- failures are fixed or documented in `.swarm/QA.md`

---

### P3-001 — UX polish pass

Owner: DeepSeek (In Progress)  
Reviewer: Claude

Scope:

- improve layout consistency
- add better empty states
- add success/error banners
- improve mobile responsiveness
- add navigation consistency
- remove README-route mismatch

Definition of done:

- main user journey feels finished

---

### P3-002 — Documentation and final handoff

Owner: AGY (Completed)  
Support: Claude, Codex, DeepSeek

Scope:

- update README
- update `.swarm/HANDOFF.md`
- update `.swarm/QA.md`
- update `.swarm/DECISIONS.md`
- ensure release checklist is filled

Definition of done:

- human can read handoff and know exactly what changed
- README describes actual product
