# Current State Review — Momito After MVP Swarm Run

This review is based on the uploaded `momito-review.zip`.

## What exists now

The MVP is real and has a coherent monorepo structure:

```txt
apps/web              # Next.js frontend
apps/api              # NestJS backend
packages/shared       # shared TypeScript constants and response types
apps/api/prisma       # Prisma schema and migration
```

Implemented backend modules:

- Auth
- Questions
- Topics
- Companies
- Sessions
- Attempts
- Dashboard
- Study Plan

Implemented frontend routes:

```txt
/login
/register
/dashboard
/questions
/questions/[id]
/practice/new
/practice/session/[id]
/practice/session/[id]/summary
/attempts
/attempts/[id]
/study-plan
```

Implemented product capabilities:

- register/login with JWT bearer token
- protected pages
- question listing, filtering, and detail view
- practice session creation
- answer submission
- session completion/abandon
- attempts history
- dashboard progress summary
- study plan create/status/delete flow

This is a strong MVP baseline.

---

## Important gaps before calling it a complete product

### Product gaps

1. The README lists `/questions/new`, `/questions/[id]/edit`, and `/settings`, but these pages do not exist in the uploaded frontend.
2. The API client supports `questionsApi.create`, `questionsApi.update`, and `questionsApi.delete`, but the UI does not expose create/edit/delete question management.
3. There is no topic/company management UI.
4. There is no seed/demo content. A new user may see empty screens and cannot meaningfully practice unless data is inserted manually.
5. "Practice This Question" on the question detail page creates a generic quick practice session and does not guarantee the selected question is included.
6. Study plan has create/status/delete, but no full edit form.
7. There is no clear onboarding flow for an empty database/user.

### Engineering gaps

1. Root `package.json` has `dev`, `build`, `lint`, but not root-level `typecheck`, `test`, `db:*`, or `seed` scripts.
2. The README mentions `.swarm/DECISIONS.md`, but `.swarm` files were not included in the uploaded zip. The swarm should restore and maintain these.
3. `_review_tree.txt` shows generated files and local files in the working tree such as `apps/api/dist`, `apps/web/tsconfig.tsbuildinfo`, `apps/api/tsconfig.build.tsbuildinfo`, `node_modules`, and `apps/api/.env`. Ensure `.gitignore` excludes these and they are not tracked.
4. `JWT_SECRET` has a development fallback. This is acceptable for local development, but production mode should fail fast if the secret is missing.
5. CORS is currently open with `app.enableCors()`. Production should restrict origin via env.
6. Frontend stores JWT in `localStorage`. This is acceptable for MVP but not ideal for a production-quality app. At minimum, document the tradeoff; preferably move to httpOnly cookies in a focused auth hardening task.
7. Backend has unit tests, but there is no uploaded root-level test/typecheck output proving the whole workspace passes.
8. No Docker Compose/Postgres bootstrap or seed script was included in the zip.
9. No CI workflow was included.
10. No deployment guide was included.

---

## Productization target

The next swarm run should move Momito from:

```txt
working MVP
```

to:

```txt
complete portfolio-ready product
```

That means:

- complete the missing UI,
- add seed/demo data,
- fix session-specific practice,
- harden auth/config,
- add root scripts,
- add Docker/dev setup,
- add tests and quality gates,
- polish UX,
- update README and handoff.

Do not start speculative features before the MVP gaps above are closed.
