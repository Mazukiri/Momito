# Momito — Interview Prep App

A serious interview preparation tool for Software Engineer, Backend Engineer, and AI Engineer candidates. Supports structured practice across DSA, backend, system design, behavioral, and more — with mock interview sessions, progress tracking, and a personal study plan.

Beyond practice, Momito runs the **job search itself** as a closed loop (“CareerOS”): a job pipeline with per-round tracking, interview debriefs that record what you actually bombed, and a Today queue that reshapes tomorrow's prep around those gaps. Companies carry structured intelligence (focus-area weights, interview process, sponsorship), applications carry contacts and offers, and résumés are versioned artifacts you can tailor to a JD and export ATS-safe.

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

This creates all tables and then idempotently seeds 12 topics, 20 companies, and 384 interview questions with role/area metadata — 150 DSA (all 20 coding-interview patterns), 149 CS Fundamentals (OS, networking, databases, concurrency, computer architecture, ML fundamentals, OOP, JS/TS, Node.js, backend, C++), 25 System Design cases (7-section reference outlines), and 60 Behavioral prompts (STAR-structuring guidance). Run `pnpm content:stats` for a live breakdown, or visit `/settings/content` in the app. It also creates a demo account:

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
| `/today` | Daily queue for due reviews, recommendations, reminders, and scheduled prep work |
| `/dashboard` | Progress overview, topic progress, weak areas, recent sessions |
| `/missions` | Mission list (goal-driven weekly planning) |
| `/missions/[id]` | Mission detail: competency states, weekly plan, check-ins |
| `/career` | Role tracks, active career goals, readiness gaps, target shortlist |
| `/jobs` | Job pipeline — list view (funnel + filter pills) or drag-and-drop kanban board |
| `/jobs/[id]` | Job detail: interview rounds, debriefs, readiness verdict, story gaps, prep queue, contacts, offer, timeline |
| `/companies` | Company catalog with sponsorship filter |
| `/companies/[id]` | Company detail: interview process, focus-area weights, sponsorship, comp band, linked questions/stories/applications |
| `/contacts` | Referral network grouped by relationship, with linked jobs |
| `/offers` | Offer comparison (normalized annual total, visa flag) |
| `/profile` | Editable profile parsed from a CV |
| `/profile/upload` | Upload and parse a PDF CV |
| `/profile/resumes` | Résumé versions: Markdown editor, ATS coverage vs a JD, AI tailoring, export |
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
| `/study-plan` | Todo / In Progress / Done study tasks (backed by the `Task` model, `type: 'study'`) |
| `/stories` | Story Bank — STAR-formatted behavioral stories, linkable to prompts, rehearsable via FSRS |
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
│           ├── (authenticated)/# Today, Dashboard, Missions, Career, Jobs, Companies,
│           │                   # Contacts, Offers, Questions, Practice, Attempts,
│           │                   # Study Plan, Stories, Profile (+ résumé versions),
│           │                   # Learning, Calendar, Settings
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

## Deploy

Free-tier stack: **Neon** (Postgres) + **Render** (API) + **Vercel** (web). Config for the
API and web builds is already committed (`render.yaml`, `apps/web/vercel.json`) — nothing
below requires code changes, only connecting accounts and setting secrets.

1. **Neon** (free, pick a region close to you): create a project, then copy both the
   pooled connection string (`DATABASE_URL`) and the direct connection string —
   no `-pooler` in the hostname — (`DIRECT_URL`).
2. **Render**: New → Blueprint, point at this repo (picks up `render.yaml`
   automatically). Set the secrets it leaves blank: `DATABASE_URL`, `DIRECT_URL`,
   `JWT_SECRET` (32+ random characters), and `CORS_ORIGIN` (leave a placeholder for
   now — you'll set it to the real Vercel URL in step 4). Health check is
   `/api/v1/health`.
3. **Vercel**: New Project → this repo, Root Directory `apps/web` (picks up
   `apps/web/vercel.json`'s build command automatically). Env var:
   `NEXT_PUBLIC_API_URL=https://<your-api>.onrender.com/api/v1`.
4. Wire the real Vercel URL back into Render's `CORS_ORIGIN` env var and redeploy the API.
5. Seed production once, from your machine (never commit real credentials):
   ```bash
   DATABASE_URL="<neon-direct-url>" DIRECT_URL="<neon-direct-url>" \
     SEED_USER_EMAIL="you@example.com" SEED_USER_PASSWORD="a-real-password" \
     pnpm db:seed
   ```
6. **Keep-warm** (optional, avoids ~30-60s cold starts): set the `API_HEALTH_URL`
   repository variable (Settings → Secrets and variables → Actions → Variables) to
   `https://<your-api>.onrender.com/api/v1/health` — `.github/workflows/keepwarm.yml`
   then pings it every 10 minutes during Vietnam daytime hours, staying under Render's
   free 750 instance-hours/month.
7. **Install on your phone**: open the Vercel URL, then iOS Safari → Share → Add to
   Home Screen, or Android Chrome → ⋮ → Install app.

**AI grading** (Workstream C) is optional — set `ANTHROPIC_API_KEY` on Render (and
optionally `ANTHROPIC_MODEL`/`AI_DAILY_BUDGET_USD`) to enable it; the app is fully
usable on self-rating alone if you never set a key. **Backups**: see
`docs/adr/0006-backup-strategy.md` for the weekly encrypted-backup workflow, which is
similarly dormant until its own two secrets are set.

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
- `GET /companies`, `GET /companies/:id`, `POST /companies`, `PATCH /companies/:id`, `DELETE /companies/:id` — the catalog carries structured intelligence: focus-area weights, role tracks, interview process, sponsorship status, comp band

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

### Dashboard
- `GET /dashboard/summary` — Aggregated stats (practiced count, topic progress, weak areas, recent sessions)

### Content & DSA Progress
- `GET /content/coverage` — Question counts by type/difficulty plus progress toward plan §8.2 domain targets (DSA, CS Fundamentals, System Design, Behavioral, companies, role tracks)
- `GET /dsa/progress` — Per-DSA-pattern totals/attempted/solved counts for the current user, cross-referencing `AnswerAttempt` history

### Story Bank
- `GET /stories`, `POST /stories`, `GET/PATCH/DELETE /stories/:id` — STAR-formatted stories (user-owned)
- `POST /stories/:id/prompts`, `DELETE /stories/:id/prompts/:questionId` — Link/unlink a story to a behavioral prompt
- `GET /reviews/due`, `POST /reviews/:objectType/:objectId` — FSRS review scheduling; `objectType` is `question` or `story`

### Career OS
- `GET /career/role-tracks` — Available long-term role tracks
- `GET /career/goals`, `POST /career/goals`, `PATCH /career/goals/:id` — Active career goals
- `GET /career/readiness`, `GET /career/role-tracks/:id/readiness` — Deterministic readiness by checklist area
- `GET /career/jobs/:jobId/readiness` — "Am I ready for Meta?" go/no-go, company-weighted and penalized by open weakness signals
- `GET /career/jobs/:jobId/story-gaps` — Behavioral competencies this company expects that you have no story for
- `GET /career/target-shortlist` — Companies ranked by fit × sponsorship × region
- `GET /practice/recommendations` — Next best actions

### Job Pipeline
- `GET /jobs`, `POST /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id` — Job pipeline (status changes emit a transition event)
- `GET /jobs/funnel` — Funnel counts, conversion, median days in stage, and breakdowns by source, rejection reason, and résumé version
- `POST /jobs/:id/events` — Append a timeline event
- `POST /jobs/:id/generate-prep` — Create prep tasks for a job
- `POST /jobs/:id/score-profile` — Score profile against a saved JD
- `GET|POST /jobs/:jobId/rounds`, `PATCH|DELETE /jobs/:jobId/rounds/:roundId` — Interview rounds (scheduled date, outcome, debrief)
- `POST /jobs/:jobId/rounds/:roundId/prep` — Auto-assemble a prep queue for a round
- `GET /weaknesses` — Open weakness signals emitted by debriefs
- `POST /weaknesses/signals/:id/resolve`, `POST /weaknesses/signals/:id/dismiss`
- `GET|POST /contacts`, `PATCH|DELETE /contacts/:id`, `GET|POST /jobs/:jobId/contacts` — Referral network
- `GET /offers`, `GET|PUT|DELETE /jobs/:jobId/offer` — Offers and comparison

### Résumé Versions
- `GET|POST /resumes`, `GET|PATCH|DELETE /resumes/:id` — Versioned résumé artifacts (Markdown)
- `GET /resumes/:id/export?format=md|pdf` — Download; PDF is single-column ATS-safe (standard Helvetica, no embedded fonts)
- `POST /resumes/:id/ai/analyze`, `/ai/rewrite`, `/ai/cover-letter` — AI tailoring (**dormant without `ANTHROPIC_API_KEY`** — returns `{ok:false, reason}`, never throws)
- `POST /profile-scores/ats-coverage` — Keyword coverage of a JD against a résumé version (or the base profile)
- `POST /profile-scores/ats-coverage/generate-tasks` — Turn missing keywords into study tasks

### Tasks, Reminders & Learning
- `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/complete`, `POST /tasks/:id/snooze` — Scheduled tasks
- `GET /reminders`, `POST /reminders/:id/dismiss` — In-app reminders
- `GET /learning/ledger`, `POST /learning/evidence`, `GET /learning/inbox`, `PATCH /learning/highlights/:id` — Learning ledger
- `POST /integrations/readwise/connect`, `POST /integrations/readwise/sync` — Readwise highlight sync

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
- 385 seeded questions: 150 DSA (all 20 coding patterns), 150 CS Fundamentals, 25 System Design, 60 Behavioral

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
The point of CareerOS is that the job search and the study plan are **one loop**, not two tools:
you bomb a system-design round at Meta → the debrief stores that as a weakness signal →
tomorrow's Today queue leads with system design → the "am I ready for Meta?" verdict moves
only when the underlying FSRS retrievability moves.

- 10 role tracks covering backend (Big Tech SWE, Google L4 SWE), quant/HPC (Quant SWE, HPC/GPU Engineer), AI/ML, infra/platform, mobile, fullstack, data engineering, and security
- Deterministic readiness by DSA, system design, LLD/OOP, CS fundamentals, language/runtime, projects, behavioral, and profile evidence — **grounded in FSRS retrievability**, not self-report
- Job pipeline (list or drag-and-drop kanban) with JD text, deadline reminders, prep-task generation, profile scoring, stall detection, and a funnel with conversion, median days-in-stage, and breakdowns by source / rejection reason / résumé version
- **Interview rounds** with scheduled dates, outcomes, and structured debriefs; a debrief emits **weakness signals** that penalize readiness and outrank routine study on Today until resolved
- **Company intelligence**: focus-area weights and role tracks weight the readiness verdict; interview process, sponsorship status, and comp band inform targeting; a fit-ranked target shortlist
- **Behavioral story gaps**: the competencies a company expects that you have no STAR story for
- **Contacts** (recruiter / referrer / hiring manager) with a follow-up and thank-you cadence
- **Offers** with a normalized annual total (base + bonus + equity/years), single-currency v1
- Learning ledger for long-term career evidence, including manual notes and reviewed Readwise highlights
- Calendar-style scheduled tasks with in-app reminders, snooze, and completion evidence
- Practice recommendations ranked across weakness signals, upcoming rounds, deadlines, stalled applications, role gaps, and unmapped reading evidence

### Résumé Studio
- **Versioned résumés** (`ResumeVersion`) as Markdown artifacts derived from the master profile — "Google-tailored v2" — each linkable to the job it was sent to, which is what makes the funnel's per-version conversion breakdown possible
- **ATS coverage**: paste a JD, see which keywords your résumé actually contains, and turn the missing ones into study tasks in one click
- **Export**: `.md`, or an ATS-safe `.pdf` — single-column, plain text, standard non-embedded Helvetica, written by a dependency-free renderer (an ATS reads the content stream with a standard font's glyph widths, so this is the *most* parseable output, not a compromise)
- **AI tailoring** (bullet impact/seniority analysis, JD-specific rewrites with accept/reject, cover-letter drafting with visa framing) — **dormant until `ANTHROPIC_API_KEY` is set**; without a key the endpoints return a structured `{ok:false, reason}` and the app stays fully usable

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
- Backed by the consolidated `Task` model (`type: 'study'`) — no separate schema

### Story Bank
- STAR-formatted stories (Situation/Task/Action/Result/Metrics) with competency tags,
  linked companies, and follow-up questions
- Link a story to one or more behavioral prompts; a behavioral question's detail page
  shows an "Answer with a Story" picker
- "Rehearse" a story with a 1–5 self-rating, scheduling its next review via the same FSRS
  engine used for practice questions — it then resurfaces on `/today` when due

---

## Configuration Reference

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | — | Yes | PostgreSQL connection string (pooled, used at runtime) |
| `DIRECT_URL` | — | Yes for `prisma migrate` | Non-pooled connection string for migrations. With Neon, use its "direct connection" string (no `-pooler` in the hostname); without a pooler, set it to the same value as `DATABASE_URL`. |
| `JWT_SECRET` | Development-only fallback | Production | JWT signing key. Production startup fails unless this is at least 32 characters. |
| `JWT_EXPIRES_IN` | `30d` | No | Access-token lifetime. Long by default since this is a single-user, localStorage-Bearer app — a phone user studying daily shouldn't be logged out every day. A token can still be revoked immediately via logout (`User.tokenVersion`), so the long expiry doesn't mean a leaked token is unrevocable. |
| `CORS_ORIGIN` | Open in development; disabled in production | Production deployments | Comma-separated browser origin allowlist, for example `https://momito.example`. |
| `ALLOW_MULTI_USER_REGISTRATION` | `false` (registration locked after the first account) | No | Set to `true` to allow open registration beyond a single account. |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | `demo@momito.local` / `MomitoDemo123!` | No (set both before seeding a real deployment) | Overrides the seeded demo account's credentials. `pnpm db:seed` never logs the password. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / `AI_DAILY_BUDGET_USD` | Unset / `claude-opus-4-8` / `1.00` | No | Enables AI grading and AI résumé tailoring (analysis, JD rewrites, cover letters) when a key is set; both share one daily budget pool. The app is fully usable on self-rating and deterministic scoring alone without one — the AI endpoints simply report themselves unavailable. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Unset / Unset / `mailto:admin@example.com` | No | Enables Web Push notifications (ADR-0008) when both keys are set; generate a keypair with `npx web-push generate-vapid-keys` (no third-party account needed). Without them, the notification settings UI is hidden and the reminder-push scheduler no-ops. |
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
- **ADR-0002**: `ReviewState` uses a polymorphic `objectType`/`objectId` reference for persisted review scheduling
- **ADR-0003**: The FSRS learning engine coexists with the existing Mission engine rather than replacing it
- **ADR-0004**: No copyrighted third-party problem statements in seed content — metadata, links, and original notes only
- **ADR-0005**: Story Bank schema (STAR-format, user-authored, reviewable via the same polymorphic `ReviewState`)
- **ADR-0006**: Weekly encrypted database backup workflow (dormant until `BACKUP_DATABASE_URL`/`BACKUP_GPG_PASSPHRASE` secrets are set)
- **ADR-0007**: AI grading scaffold — dormant until `ANTHROPIC_API_KEY` is set; structured refusal, never a throw
- **ADR-0008**: Web Push notifications (VAPID, no third-party account)
- **ADR-0009**: CareerOS pipeline stage machine — status transitions as structured `fromStatus`/`toStatus` on the existing `JobEvent`, not a parallel table
- **ADR-0010**: `Company` as an FK with structured intelligence (focus-area weights as Json, name-match backfill with free-text fallback)
- **ADR-0011**: `WeaknessSignal` — event-sourced debrief output that grounds targeted readiness
- **ADR-0012**: `ResumeVersion` decoupled from the singleton `Profile`; profile stays master, versions are derived artifacts
- **ADR-0013**: Interview rounds and debriefs — the round owns no rows; back-ref FKs avoid the PlanItem/Task dual-write anti-pattern
- **ADR-0014**: Contacts and follow-up cadence (create-only backfill from `referralName`)
- **ADR-0015**: Offer model — minimal by design; normalized annual total at read time, single-currency v1 (no FX)

---

## QA & Known Notes

All integration review findings are recorded in `.swarm/QA.md`. Key non-blocking items:

- Browser CORS origins are configured with `CORS_ORIGIN`; production denies cross-origin requests when it is unset
- Authentication still uses a bearer JWT in `localStorage`; see the documented tradeoff above
- No debounce on question search input (acceptable for MVP)
- Dashboard summary loads all attempts in memory — could optimize with DB-side aggregates later
- Backend API test coverage is comprehensive, but frontend e2e tests are not yet implemented

**Verification-blocked, and not claimed to work:**

- **The live AI path has never been executed.** AI grading and AI résumé tailoring are built, unit-tested (fully mocked, zero network), and verified *dormant* — with no `ANTHROPIC_API_KEY` they return a structured `{ok:false, reason}`, write nothing, and spend nothing. The path where a real model actually responds is untested until someone sets a key. Treat it as scaffolding, not a working feature.
- **Lighthouse and the deployed-URL checks** need a real browser against a real deployment; a manual accessibility pass (labeled controls, keyboard-reachable cards, dark-mode contrast) was done instead.
- **`pg_dump`/`pg_restore` in the backup workflow** have not been run against a real Postgres instance.

---

## License

MIT — built as a portfolio project for SWE/Backend/AI Engineer internship applications.
