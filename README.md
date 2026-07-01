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

- **Node.js** >= 18
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

This creates all tables and then idempotently seeds 8 topics, 6 companies, and 32 interview questions. It also creates a demo account:

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
| `/` | Redirects to `/dashboard` |
| `/login` | Login |
| `/register` | Register |
| `/dashboard` | Progress overview, topic progress, weak areas, recent sessions |
| `/questions` | Browse, search, and filter questions |
| `/questions/new` | Create a new question |
| `/questions/[id]` | Question detail with answer and "Start Practice" button |
| `/questions/[id]/edit` | Edit an existing question |
| `/practice/new` | Create a new practice session (type, topic, company, difficulty) |
| `/practice/session/[id]` | Active question-by-question flow |
| `/practice/session/[id]/summary` | Session results, answer review, duration |
| `/attempts` | Past answer history |
| `/attempts/[id]` | Full attempt detail |
| `/study-plan` | Todo / In Progress / Done study plan with CRUD |
| `/settings` | Topic and company management |

---

## Project Structure

```
Momito/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/             # Prisma schema & migrations
│   │   └── src/                # Controllers, services, guards, DTOs
│   └── web/                    # Next.js frontend
│       └── app/
│           ├── (auth)/         # Login, Register pages
│           ├── (authenticated)/# Dashboard, Questions, Practice, Attempts, Study Plan
│           ├── components/     # Shared UI components
│           └── lib/            # API client, auth context
├── packages/
│   └── shared/                 # Shared DTO types, Zod schemas, enums
├── infra/                      # Docker / deployment config templates
├── .swarm/                     # Swarm agent coordination files
│   ├── BOARD.md
│   ├── DECISIONS.md
│   ├── LOCKS.md
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
| `pnpm typecheck` | Type-check all workspace packages |
| `pnpm test` | Run all workspace test suites |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | Apply development database migrations |
| `pnpm db:seed` | Idempotently load demo content and the demo user |

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

### Auth
- `POST /auth/register` — Register
- `POST /auth/login` — Login
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

### Question Bank
- 11 question types: DSA, Backend, JavaScript, TypeScript, Node.js, Database, OS, Networking, OOP, System Design, Behavioral
- 3 difficulty levels: Easy, Medium, Hard
- Search and multi-filter (topic, difficulty, type, company, keyword)
- Reference answer toggle for self-study

### Mock Interview Sessions
- Four session types: Quick Practice, Topic Practice, Company Practice, Mixed Mock
- Configurable question count (1–100)
- Question-by-question flow with text answer submission
- Self-rating (1–5 stars) per answer
- Session summary with per-question review and duration

### Progress Tracking
- Dashboard with total questions practiced and sessions completed
- Topic-level progress bars (color-coded: green ≥80%, amber ≥50%, red <50%)
- Weak areas identified by average self-rating
- Recent session history
- Suggested next topics to practice

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
| `DATABASE_URL` | — | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Development-only fallback | Production | JWT signing key. Production startup fails unless this is at least 32 characters. |
| `CORS_ORIGIN` | Open in development; disabled in production | Production deployments | Comma-separated browser origin allowlist, for example `https://momito.example`. |
| `NODE_ENV` | Node default | No | Set to `production` to enable production config checks. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Yes | Backend base URL for frontend API client |
| `PORT` | `3001` | No | Backend listen port |

---

## Architecture Decisions

Key decisions are documented in `.swarm/DECISIONS.md`:

- **DEC-001**: Tech stack (NestJS + Next.js + PostgreSQL + Prisma)
- **DEC-002**: JWT auth with bcrypt (no refresh tokens for MVP)
- **DEC-003**: Database schema (8 tables, UUID PKs, TEXT enums)
- **DEC-004**: RESTful API contract under `/api/v1`
- **DEC-005**: Shared package for DTO types and Zod schemas
- **DEC-006**: pnpm workspaces monorepo layout
- **DEC-007**: Error response shape (NestJS global filter)
- **DEC-008**: Session question selection logic

---

## QA & Known Notes

All integration review findings are recorded in `.swarm/QA.md`. Key non-blocking items:

- Browser CORS origins are configured with `CORS_ORIGIN`; production denies cross-origin requests when it is unset
- Authentication still uses a bearer JWT in `localStorage`; see the documented tradeoff above
- No debounce on question search input (acceptable for MVP)
- Dashboard summary loads all attempts in memory — could optimize with DB-side aggregates later
- Backend API test coverage is comprehensive (32/32 tests), but frontend e2e tests are not yet implemented

---

## License

MIT — built as a portfolio project for SWE/Backend/AI Engineer internship applications.
