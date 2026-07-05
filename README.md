# Momito — Interview Prep App

A serious interview preparation tool for Software Engineer, Backend Engineer, and AI Engineer candidates. Supports structured practice across DSA, backend, system design, behavioral, and more — with mock interview sessions, progress tracking, and a personal study plan.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS 4 |
| Backend | NestJS 11 + TypeScript + Prisma ORM |
| Database | PostgreSQL |
| Monorepo | pnpm workspaces |
| Auth | JWT (Bearer token, 24h expiry) |
| Shared | `packages/shared` — DTO types, Zod schemas, shared constants |

---

## Prerequisites

- **Node.js** >= 20.16
- **pnpm** >= 9
- **Docker** with Docker Compose (recommended), or PostgreSQL 16+ running locally or remotely

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> momito
cd momito
pnpm install
```

### 2. Set up environment variables

Copy the checked-in environment examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

The default API environment is ready for the Docker database below:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/momito?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/momito?schema=public"
JWT_SECRET="replace-with-at-least-32-random-characters"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
NODE_ENV="development"
```

The web environment should contain:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

> **Note:** The NestJS backend defaults to port **3001** (`main.ts` line: `PORT ?? 3001`). The web app's `NEXT_PUBLIC_API_URL` must match this port.

### 3. Start and initialize the database

Start PostgreSQL in Docker:

```bash
docker compose up -d postgres
```

The service exposes PostgreSQL on `localhost:5432`, persists data in a named volume, and uses the credentials from `apps/api/.env.example`. Wait for it to report healthy, then apply migrations and seed the demo data:

```bash
docker compose ps
pnpm db:migrate
pnpm db:seed
```

This creates all tables and then idempotently seeds 12 topics, 20 companies, and 382 interview questions with role/area metadata — 149 DSA (all 20 coding-interview patterns, 2-3 examples each), 149 CS Fundamentals (OS, networking, databases, concurrency, computer architecture, ML fundamentals, OOP, JS/TS, Node.js, backend, C++), 24 System Design cases (7-section reference outlines), and 60 Behavioral prompts (STAR-structuring guidance). Run `pnpm content:stats` for a live breakdown, or visit `/settings/content` in the app. It also creates a demo account:

```txt
Email: demo@momito.local
Password: MomitoDemo123!
```

You can use the demo account immediately or register a new account. Running `pnpm db:seed` again updates the same seed records without duplicating them.

If you use an existing PostgreSQL server instead, update `DATABASE_URL` in `apps/api/.env` and skip the `docker compose` commands.

### 4. Start both apps

From the repository root, run both apps concurrently:

```bash
pnpm dev
```

This starts:

- **API** at `http://localhost:3001/api/v1`
- **Web** at `http://localhost:3000`

### Start individually

```bash
# Backend only
cd apps/api && pnpm dev

# Frontend only
cd apps/web && pnpm dev
```

---

## Screens & Routes

All frontend pages are under `apps/web/app/`.

| Route | Page |
|---|---|
| `/` | Redirects to `/today` |
| `/login` | Login (mobile-first, restyled) |
| `/register` | Register (mobile-first, restyled) |
| `/today` | Daily landing page (stub — the real reviews/practice/career queue lands with the Learning Engine, see `docs/agent/BACKLOG.MD` MOM-032) |
| `/dashboard` | Progress overview, topic progress, weak areas, recent sessions |
| `/missions` | Mission list (goal-driven weekly planning) |
| `/missions/[id]` | Mission detail: competency states, weekly plan, check-ins |
| `/career` | Role tracks, active career goals, readiness gaps |
| `/jobs` | Job application pipeline |
| `/jobs/[id]` | Job detail, prep generation, profile scoring, timeline |
| `/profile` | Editable profile parsed from a CV |
| `/profile/upload` | Upload and parse a PDF CV |
| `/profile/scores` | Create and review role-template / JD profile scores |
| `/profile/scores/[id]` | Profile score detail with category gaps and suggestions |
| `/learning` | Career learning ledger and Readwise connection |
| `/learning/inbox` | Review and map synced Readwise highlights |
| `/calendar` | Scheduled prep tasks and reminders |
| `/questions` | Browse, search, and filter questions |
| `/questions/new` | Create a new question |
| `/questions/[id]` | Question detail with answer and "Start Practice" button |
| `/questions/[id]/edit` | Edit an existing question |
| `/practice` | Practice hub — resume an active session, or jump into a mode |
| `/practice/new` | Create a new practice session (type, topic, company, difficulty, pattern) |
| `/practice/dsa-ladder` | DSA pattern-by-pattern progress (attempted/solved per pattern) |
| `/practice/session/[id]` | Active question-by-question flow (system design gets a 7-section template + markdown preview) |
| `/practice/session/[id]/summary` | Session results, answer review, duration, time spent per question |
| `/attempts` | Past answer history |
| `/attempts/[id]` | Full attempt detail |
| `/settings/content` | Content coverage dashboard — progress toward plan §8.2 data targets |
| `/study-plan` | Todo / In Progress / Done study plan with CRUD |
| `/settings` | Topic and company management |

---

## Project Structure

```
Momito/
├── apps/
│   ├── api/                    # NestJS backend (backend of record — see docs/adr/0001)
│   │   ├── prisma/             # Prisma schema, migrations, seed.ts
│   │   ├── scripts/            # content:validate / :stats / :sample
│   │   └── src/                # Controllers, services, guards, DTOs
│   └── web/                    # Next.js frontend (client of record)
│       └── app/
│           ├── (auth)/         # Login, Register pages
│           ├── (authenticated)/# Today, Dashboard, Missions, Career, Jobs, Questions,
│           │                   # Practice, Attempts, Study Plan, Learning, Calendar
│           ├── components/     # Shared UI components (design system, nav, session UI)
│           └── lib/            # API client, auth context, theme context, hooks
├── packages/
│   └── shared/                 # Shared DTO types, Zod schemas, enums, Knowledge Kernel types
├── archive/                    # Legacy, inactive code — moved (not deleted) out of the
│   │                           # active build path; see archive/README.md
│   ├── backend/                # Former Python/FastAPI-style backend
│   └── mobile/                 # Former Expo/React Native app
├── docs/
│   ├── plans/                  # Product/redesign plans (source of truth for scope)
│   ├── agent/                  # Multi-agent execution docs: BACKLOG, NEXT, LOCKS,
│   │                           # DECISIONS, LOG — read these before starting new work
│   └── adr/                    # Architecture Decision Records
├── .swarm/                     # Earlier swarm agent coordination files (pre-redesign)
│   ├── BOARD.md
│   ├── DECISIONS.md
│   └── QA.md
└── pnpm-workspace.yaml
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run both API and Web concurrently |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all workspace packages that define linting |
| `pnpm typecheck` | Build shared types, regenerate Prisma client, then type-check all workspace packages |
| `pnpm test` | Build shared types, regenerate Prisma client, then run all workspace test suites |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | Apply development database migrations |
| `pnpm db:seed` | Idempotently load demo content and the demo user |
| `pnpm content:validate` | Check seed content for missing titles/tags, invalid topic refs, missing reference answer or rubric, and copied-statement heuristics; exits non-zero on error |
| `pnpm content:stats` | Print seed content counts by type and difficulty |
| `pnpm content:sample [n]` | Print `n` (default 5) random seed questions for manual spot-checking |

---

## Local Database Commands

```bash
# Start PostgreSQL
docker compose up -d postgres

# Check service health and view database logs
docker compose ps
docker compose logs postgres

# Stop PostgreSQL without deleting its data
docker compose down
```

If port `5432` is already in use, stop the conflicting local PostgreSQL instance or change the host side of the port mapping in `docker-compose.yml` and update `DATABASE_URL` to match.

---

## API Overview

All endpoints are under `http://localhost:3001/api/v1`. Protected routes require `Authorization: Bearer <token>` header.

### Health
- `GET /health` — Liveness check, public, no DB dependency (safe for uptime pollers)
- `GET /health/db` — Adds a DB ping; returns 503 if the database is unreachable

### Auth
- `POST /auth/register` — Register. **Locked to a single account** once one user exists, unless `ALLOW_MULTI_USER_REGISTRATION=true` (Momito is a personal tool, not multi-tenant SaaS — see `docs/adr/`). Rate-limited to 5 requests/minute.
- `POST /auth/login` — Login. Rate-limited to 5 requests/minute.
- `POST /auth/logout` — Logout
- `GET /auth/me` — Current user

### Questions
- `GET /questions` — List (filters: topic, difficulty, type, company, search)
- `GET /questions/:id` — Detail
- `POST /questions` — Create
- `PATCH /questions/:id` — Update
- `DELETE /questions/:id` — Delete

### Topics & Companies
- `GET /topics`, `POST /topics`, `PATCH /topics/:id`, `DELETE /topics/:id`
- `GET /companies`, `POST /companies`, `PATCH /companies/:id`, `DELETE /companies/:id`

### Sessions
- `POST /sessions` — Create (with type, topic, difficulty, question count)
- `GET /sessions` — List
- `GET /sessions/:id` — Detail with questions and attempts
- `POST /sessions/:id/answer` — Submit answer
- `POST /sessions/:id/complete` — Complete session
- `POST /sessions/:id/abandon` — Abandon session

### Attempts
- `GET /attempts` — List
- `GET /attempts/:id` — Detail
- `GET /questions/:id/attempts` — Attempts for a question

### Dashboard & Study Plan
- `GET /dashboard/summary` — Aggregated stats (practiced count, topic progress, weak areas, recent sessions)
- `GET /study-plan` — List
- `POST /study-plan` — Create item
- `PATCH /study-plan/:id` — Update item (title, status, notes, targetDate)
- `DELETE /study-plan/:id` — Delete item

### Content & DSA Progress
- `GET /content/coverage` — Question counts by type/difficulty plus progress toward plan §8.2 domain targets (DSA, CS Fundamentals, System Design, Behavioral, companies, role tracks)
- `GET /dsa/progress` — Per-DSA-pattern totals/attempted/solved counts for the current user, cross-referencing `AnswerAttempt` history

### Career OS
- `GET /career/role-tracks` — Available long-term role tracks
- `GET /career/goals`, `POST /career/goals`, `PATCH /career/goals/:id` — Active career goals
- `GET /career/readiness`, `GET /career/role-tracks/:id/readiness` — Deterministic readiness by checklist area
- `GET /jobs`, `POST /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id` — Job pipeline
- `POST /jobs/:id/generate-prep` — Create prep tasks for a job
- `POST /jobs/:id/score-profile` — Score profile against a saved JD
- `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/complete`, `POST /tasks/:id/snooze` — Scheduled tasks
- `GET /reminders`, `POST /reminders/:id/dismiss` — In-app reminders
- `GET /learning/ledger`, `POST /learning/evidence`, `GET /learning/inbox`, `PATCH /learning/highlights/:id` — Learning ledger
- `POST /integrations/readwise/connect`, `POST /integrations/readwise/sync` — Readwise highlight sync
- `GET /practice/recommendations` — Next best actions

### Profile & CV Scoring
- `POST /profile/upload` — Upload a PDF CV and create/update the structured profile
- `GET /profile` — Current structured profile
- `PATCH /profile` — Edit profile contact, skills, experience, education, and projects
- `POST /profile-scores` — Score profile against a role template and optional JD text
- `GET /profile-scores` — List saved profile scores
- `GET /profile-scores/:id` — Score detail with category gaps and suggestions

Full API contract details: `.swarm/DECISIONS.md` (DEC-004)

---

## Features

### Authentication
- Email/password registration and login
- JWT-based session (24h expiry)
- Client-side token storage, auto-redirect on expiry

The frontend currently stores its bearer JWT in `localStorage`. This keeps the MVP simple,
but JavaScript running in the page can read the token, so an XSS vulnerability could expose it.
For a public multi-user deployment, migrate auth to `httpOnly`, `Secure`, `SameSite` cookies and
add CSRF protection as appropriate. Until then, only deploy trusted content and configure a
restrictive Content Security Policy at the hosting layer.

Momito is built as a **single-user personal tool**, not multi-tenant SaaS: registration is
locked after the first account exists (see `ALLOW_MULTI_USER_REGISTRATION` below), and both auth
routes are rate-limited. The API also applies `helmet()` security headers and a global rate limit
(100 req/min) via `@nestjs/throttler`, and a global exception filter returns a consistent JSON
error shape (`{ statusCode, message, path, timestamp }`) instead of leaking stack traces.

### Mobile & Installability

The web app is mobile-first: a fixed bottom tab bar on phone widths, a sidebar on tablet/desktop,
and light/dark theme (toggle in the top bar, persisted in `localStorage`, defaulting to system
preference). It ships an installable PWA manifest (`app/manifest.ts`) with generated icons, so it
can be added to a phone home screen; there is intentionally **no service worker yet** — see
`docs/agent/DECISIONS.MD` (D-007, SPIKE-002) for why that's deferred rather than shipped half-safe.

### Question Bank
- 17 question types: DSA, Backend, JavaScript, TypeScript, Node.js, Database, OS, Networking, OOP, System Design, Behavioral, C++, Concurrency, Computer Architecture, Machine Learning, HPC, Quant
- 3 difficulty levels: Easy, Medium, Hard
- Search and multi-filter (topic, difficulty, type, company, keyword) — deep-linkable via `?type=` query param
- Reference answer toggle for self-study, rendered as markdown
- 382 seeded questions: 149 DSA (all 20 coding patterns), 149 CS Fundamentals, 24 System Design, 60 Behavioral

### Mock Interview Sessions
- Four session types: Quick Practice, Topic Practice, Company Practice, Mixed Mock
- Configurable question count (1–100), filterable by DSA pattern
- Question-by-question flow with text answer submission and a per-question timer
- DSA/coding questions get a CodeMirror code editor (line numbers, syntax highlighting,
  JS/Python/C++/Java language picker) instead of a plain textarea
- System design questions get a 7-section template (Requirements/Estimation/API/Data
  Model/High-level Design/Deep Dives/Tradeoffs) with a markdown Edit/Preview toggle
- Self-rating (1–5 stars) per answer
- Session summary with per-question review, time spent, and duration
- Practice hub (`/practice`) surfaces in-progress sessions and every practice mode;
  a DSA ladder page (`/practice/dsa-ladder`) tracks attempted/solved counts per pattern

### Progress Tracking
- Dashboard with total questions practiced and sessions completed
- Topic-level progress bars (color-coded: green ≥80%, amber ≥50%, red <50%)
- Weak areas identified by average self-rating
- Recent session history
- Suggested next topics to practice

### Career OS
- 10 role tracks covering backend (Big Tech SWE, Google L4 SWE), quant/HPC (Quant SWE, HPC/GPU Engineer), AI/ML, infra/platform, mobile, fullstack, data engineering, and security
- Deterministic readiness by DSA, system design, LLD/OOP, CS fundamentals, language/runtime, projects, behavioral, and profile evidence
- Job pipeline with JD text, deadline reminders, prep-task generation, and profile scoring
- Learning ledger for long-term career evidence, including manual notes and reviewed Readwise highlights
- Calendar-style scheduled tasks with in-app reminders, snooze, and completion evidence
- Practice recommendations based on role gaps, overdue tasks, active jobs, and unmapped reading evidence

### Profile & CV Scoring
- PDF CV upload with text extraction and editable structured profile fields
- Deterministic four-category scoring: Skills Match, Project Quality, Experience Depth, Presentation
- Role templates for Google L4 SWE, HPC Engineer, and Quant Hedge Fund SWE
- Optional JD text adds concrete skill requirements to the target
- Gap lists and suggestions avoid claiming interview or visa probability predictions

### Study Plan
- Three status tabs: Todo, In Progress, Done
- Create items with title, topic, notes, and target date
- Inline edit form for title, topic, notes, and date
- Smart due-date display (overdue, today, soon)
- Status progression: Todo → In Progress → Done (or reopen)
- Delete items with confirmation

---

## Configuration Reference

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | — | Yes | PostgreSQL connection string (pooled, used at runtime) |
| `DIRECT_URL` | — | Yes for `prisma migrate` | Non-pooled connection string for migrations. With Neon, use its "direct connection" string (no `-pooler` in the hostname); without a pooler, set it to the same value as `DATABASE_URL`. |
| `JWT_SECRET` | Development-only fallback | Production | JWT signing key. Production startup fails unless this is at least 32 characters. |
| `CORS_ORIGIN` | Open in development; disabled in production | Production deployments | Comma-separated browser origin allowlist, for example `https://momito.example`. |
| `ALLOW_MULTI_USER_REGISTRATION` | `false` (registration locked after the first account) | No | Set to `true` to allow open registration beyond a single account. |
| `NODE_ENV` | Node default | No | Set to `production` to enable production config checks. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Yes | Backend base URL for frontend API client |
| `PORT` | `3001` | No | Backend listen port |

---

## Architecture Decisions

The original MVP decisions are documented in `.swarm/DECISIONS.md`:

- **DEC-001**: Tech stack (NestJS + Next.js + PostgreSQL + Prisma)
- **DEC-002**: JWT auth with bcrypt (no refresh tokens for MVP)
- **DEC-003**: Database schema (8 tables, UUID PKs, TEXT enums)
- **DEC-004**: RESTful API contract under `/api/v1`
- **DEC-005**: Shared package for DTO types and Zod schemas
- **DEC-006**: pnpm workspaces monorepo layout
- **DEC-007**: Error response shape (NestJS global filter)
- **DEC-008**: Session question selection logic

Ongoing redesign-v2 work (mobile-first shell, Knowledge Kernel, Learning Engine, content
factory, career engine) is tracked as PR-sized tasks in `docs/agent/BACKLOG.MD`, with its own
decision log at `docs/agent/DECISIONS.MD` and formal ADRs under `docs/adr/`:

- **ADR-0001**: NestJS `apps/api` is the backend of record (not the archived Python `backend/`)
- **ADR-0002**: `ReviewState` uses a polymorphic `objectType`/`objectId` reference (design only — not yet implemented; schema changes are human-approval gated)
- **ADR-0003**: The (not-yet-built) FSRS learning engine will coexist with the existing Mission engine rather than replace it
- **ADR-0004**: No copyrighted third-party problem statements in seed content — metadata, links, and original notes only

---

## QA & Known Notes

All integration review findings are recorded in `.swarm/QA.md`. Key non-blocking items:

- Browser CORS origins are configured with `CORS_ORIGIN`; production denies cross-origin requests when it is unset
- Authentication still uses a bearer JWT in `localStorage`; see the documented tradeoff above
- No debounce on question search input (acceptable for MVP)
- Dashboard summary loads all attempts in memory — could optimize with DB-side aggregates later
- Backend API test coverage is comprehensive, but frontend e2e tests are not yet implemented

---

## License

MIT — built as a portfolio project for SWE/Backend/AI Engineer internship applications.
