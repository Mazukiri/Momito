# Production Roadmap — Momito

## Phase 0 — Stabilize and inspect

Goal: understand the actual state and avoid breaking the working MVP.

Tasks:

- inspect current repo
- run available checks
- update `.swarm/CURRENT_STATE_REVIEW.md` if findings differ
- ensure `.gitignore` excludes local/generated files
- create a safety checkpoint if the human allows commits

Definition of done:

- agents agree on actual repo state
- critical blockers are recorded in `.swarm/QA.md`

---

## Phase 1 — Complete MVP gaps

Goal: make the product complete as an interview-prep app, not only an MVP skeleton.

Tasks:

1. Add question create/edit/delete UI.
2. Add topic/company creation path.
3. Fix practice-this-question correctness.
4. Add seed data.
5. Improve empty/onboarding states.
6. Complete study-plan edit flow.
7. Make README match actual routes and scripts.

Definition of done:

- a new user can seed data, register/login, create questions, practice, review attempts, use study plan
- no README route claims are false

---

## Phase 2 — Product quality and safety

Goal: make the app clean enough to show as a portfolio project.

Tasks:

1. Add root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`.
2. Add `.env.example` files.
3. Add Docker Compose for Postgres.
4. Add production-aware config validation.
5. Restrict CORS through env.
6. Add backend tests for new session/question flows.
7. Add frontend build/lint fixes.
8. Add CI workflow if feasible.

Definition of done:

- one-command local setup is documented
- quality gate commands exist and pass or have documented blockers

---

## Phase 3 — UX polish

Goal: make the product feel finished.

Tasks:

1. Improve visual hierarchy.
2. Add better empty states.
3. Add breadcrumbs/back buttons.
4. Add destructive action confirmations.
5. Add success/error toasts or banners.
6. Add responsive fixes.
7. Add clear loading states.
8. Add keyboard-friendly form behavior.

Definition of done:

- product feels coherent across dashboard, questions, practice, attempts, study plan, settings

---

## Phase 4 — Optional differentiators

Only start after Phases 1-3 are stable.

Possible differentiators:

- AI answer feedback provider interface
- mock feedback mode without paid API
- spaced repetition states
- company-specific packs
- import/export question bank
- markdown rendering for prompts/reference answers

Definition of done:

- optional feature is integrated without destabilizing core flows
