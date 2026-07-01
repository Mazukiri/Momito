# Quality Gate — Momito Complete Product

The swarm must not mark productization done until this file is satisfied or clearly documents blockers.

## Required commands

From repo root:

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

If `typecheck` or `test` does not exist at root, Codex must add root scripts.

Recommended root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "db:generate": "pnpm --filter @momito/api prisma:generate",
    "db:migrate": "cd apps/api && pnpm exec prisma migrate dev",
    "db:seed": "pnpm --filter @momito/api seed"
  }
}
```

Adjust to actual package scripts.

---

## Backend acceptance tests

Required behaviors:

- register user
- login user
- get current user
- create topic
- create company
- create question
- list questions with filters
- update question
- create single-question practice session
- submit answer
- complete session
- list attempts
- dashboard summary works
- create/update/delete study plan item

---

## Frontend acceptance checklist

Required routes must render:

```txt
/login
/register
/dashboard
/questions
/questions/new
/questions/[id]
/questions/[id]/edit
/practice/new
/practice/session/[id]
/practice/session/[id]/summary
/attempts
/attempts/[id]
/study-plan
/settings or /settings/content
```

Each main page must have:

- loading state
- error state
- useful empty state
- navigation back to related pages
- mobile-friendly layout

---

## Documentation acceptance

README must include:

- app purpose
- stack
- prerequisites
- env setup
- Docker/Postgres setup
- migration
- seed
- dev scripts
- test scripts
- route list matching actual files
- API overview
- deployment notes
- known limitations
- roadmap

---

## Repo hygiene acceptance

Do not track:

```txt
node_modules
dist
.next
build
coverage
*.tsbuildinfo
.env
.env.*
```

But keep example env files:

```txt
.env.example
.env.local.example
apps/api/.env.example
apps/web/.env.local.example
```
