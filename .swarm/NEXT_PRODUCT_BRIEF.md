# Next Product Brief — Momito Complete Product

## Mission

Turn Momito from a working MVP into a complete, portfolio-ready Interview Prep App that a recruiter, mentor, or engineer can clone, run, demo, and understand.

The target outcome is not "more code". The target outcome is:

```txt
A coherent product that feels finished.
```

## Product Positioning

Momito is a structured interview-prep workspace for serious SWE / Backend / AI Engineer candidates.

It combines:

- question bank
- mock interview sessions
- answer history
- dashboard analytics
- study planning
- company/topic-focused preparation
- future AI feedback architecture

## Non-negotiable Product Requirements

### 1. First-run experience must work

A new developer should be able to run the app and see meaningful content.

Required:

- `.env.example` files
- database setup instructions
- seed script
- sample topics
- sample companies
- sample interview questions
- optional demo user or clear registration flow

The user should not land on an empty, confusing app.

### 2. Question management must be complete

The product must support:

- create question
- edit question
- delete question with confirmation
- select topic
- select companies
- set type and difficulty
- add reference answer
- add notes and source URL

Frontend routes required:

```txt
/questions/new
/questions/[id]/edit
```

### 3. Practice-this-question must be correct

When a user clicks "Practice This Question", the session must contain that exact question.

Acceptable implementations:

- add `questionIds?: string[]` to `POST /sessions`, or
- add `POST /questions/:id/practice-session`, or
- add `single_question_practice` session mode.

Do not leave the current random quick-practice behavior.

### 4. Topics and companies need a management path

At minimum:

- create topic
- create company
- use them in question form

This can be a simple `/settings` or `/settings/content` page.

### 5. Dashboard must be useful with empty and seeded states

Dashboard should show:

- useful empty/onboarding state when no activity exists
- progress cards when data exists
- recent sessions
- weak topics
- suggested next topics
- link to start practice
- link to create/import questions

### 6. Study plan must feel complete

Study plan should support:

- create
- edit title/topic/notes/target date
- change status
- delete
- filter by status

### 7. Auth/config must be production-aware

Required:

- `JWT_SECRET` must be required in production
- CORS origin should come from env
- env examples should be provided
- document localStorage token tradeoff or migrate to httpOnly cookies

### 8. Quality gate must pass

Before declaring done:

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

If scripts differ, add root scripts so these commands are valid or document the exact alternatives.

### 9. Documentation must be accurate

README must match reality.

If a route exists in README, it must exist in code.

Required docs:

- README quick start
- env setup
- database migration
- seed data
- running frontend/backend
- testing
- architecture overview
- known limitations
- roadmap

### 10. Handoff must be readable

At the end of the run, `.swarm/HANDOFF.md` must contain:

- what changed
- files changed
- commands run
- pass/fail results
- remaining issues
- how to run demo
- recommended next sprint
