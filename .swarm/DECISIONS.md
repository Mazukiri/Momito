# Architecture Decisions

---

### DEC-001 Tech Stack

Date: 2026-06-19
Owner: Claude
Decision: Node.js + TypeScript + NestJS for backend; Next.js + TypeScript + Tailwind CSS for web frontend; PostgreSQL with Prisma ORM; monorepo structure.
Reason: NestJS gives strong module boundaries, DI, and decorator-based validation that align with the structured domain. Prisma provides type-safe DB access and easy migrations. Next.js + Tailwind for fast, responsive UI. Monorepo lets web and api share DTO types via `packages/shared`.
Consequences: Slightly more boilerplate than Express, but much cleaner at scale. Prisma migrations must be run explicitly on schema change.

---

### DEC-002 Authentication

Date: 2026-06-19
Owner: Claude
Decision: JWT-based auth with bcrypt password hashing. Access token in Authorization header (Bearer). No refresh tokens for MVP — session expires with token TTL (24h).
Reason: Simple, stateless, works for a single-user tool. Refresh token flow adds complexity not needed for MVP.
Consequences: Logout is client-side (discard token). If token is leaked, it's valid until expiry. Acceptable for a personal/portfolio tool.

---

### DEC-003 Database Schema

Date: 2026-06-19
Owner: Claude
Decision: PostgreSQL with the following tables. Prisma schema is canonical.

#### Users
```
id          UUID PK default gen_random_uuid()
email       TEXT UNIQUE NOT NULL
passwordHash TEXT NOT NULL
name        TEXT NOT NULL
role        TEXT NOT NULL DEFAULT 'user'  -- 'user' | 'admin'
createdAt   TIMESTAMPTZ DEFAULT now()
updatedAt   TIMESTAMPTZ DEFAULT now()
```

#### Topics
```
id            UUID PK
name          TEXT NOT NULL
parentTopicId UUID FK -> topics(id) NULLABLE
description   TEXT
createdAt     TIMESTAMPTZ
updatedAt     TIMESTAMPTZ
```

#### Companies
```
id        UUID PK
name      TEXT NOT NULL
region    TEXT
notes     TEXT
createdAt TIMESTAMPTZ
updatedAt TIMESTAMPTZ
```

#### Questions
```
id                UUID PK
title             TEXT NOT NULL
prompt            TEXT NOT NULL
type              TEXT NOT NULL  -- enum: dsa|backend|javascript|typescript|nodejs|database|os|networking|oop|system_design|behavioral
difficulty        TEXT NOT NULL  -- enum: easy|medium|hard
topicId           UUID FK -> topics(id) NOT NULL
subtopic          TEXT
referenceAnswer   TEXT
notes             TEXT
sourceUrl         TEXT
createdByUserId   UUID FK -> users(id) NOT NULL
createdAt         TIMESTAMPTZ
updatedAt         TIMESTAMPTZ
```

#### QuestionCompanies (join table)
```
questionId UUID FK -> questions(id)
companyId  UUID FK -> companies(id)
PRIMARY KEY (questionId, companyId)
```

#### InterviewSessions
```
id          UUID PK
userId      UUID FK -> users(id) NOT NULL
title       TEXT
sessionType TEXT NOT NULL  -- enum: quick_practice|topic_practice|company_practice|mixed_mock
status      TEXT NOT NULL DEFAULT 'active'  -- enum: active|completed|abandoned
startedAt   TIMESTAMPTZ DEFAULT now()
endedAt     TIMESTAMPTZ
createdAt   TIMESTAMPTZ
updatedAt   TIMESTAMPTZ
```

#### SessionQuestions
```
id         UUID PK
sessionId  UUID FK -> interview_sessions(id) NOT NULL
questionId UUID FK -> questions(id) NOT NULL
order      INT NOT NULL
createdAt  TIMESTAMPTZ
```

#### AnswerAttempts
```
id          UUID PK
userId      UUID FK -> users(id) NOT NULL
sessionId   UUID FK -> interview_sessions(id) NULLABLE
questionId  UUID FK -> questions(id) NOT NULL
answerText  TEXT NOT NULL
selfRating  INT  -- 1-5, nullable
aiScore     FLOAT  -- nullable, for future
aiFeedback  TEXT   -- nullable, for future
createdAt   TIMESTAMPTZ
updatedAt   TIMESTAMPTZ
```

#### StudyPlanItems
```
id         UUID PK
userId     UUID FK -> users(id) NOT NULL
topicId    UUID FK -> topics(id) NULLABLE
title      TEXT NOT NULL
notes      TEXT
targetDate DATE
status     TEXT NOT NULL DEFAULT 'todo'  -- enum: todo|in_progress|done
createdAt  TIMESTAMPTZ
updatedAt  TIMESTAMPTZ
```

Reason: Normalized schema avoids duplication. UUIDs for all PKs (safe to expose in URLs). Soft enums as TEXT with app-level validation (Zod/class-validator) to keep Prisma migrations simple.
Consequences: Enum changes require only app-level code change, not DB migration. Validate enums at API boundary in NestJS DTOs.

---

### DEC-004 API Contract

Date: 2026-06-19
Owner: Claude
Decision: RESTful JSON API under `/api/v1`. All authenticated routes require `Authorization: Bearer <token>` header.

#### Base URL
```
/api/v1
```

#### Auth

```
POST /api/v1/auth/register
  Body: { email, password, name }
  Response 201: { user: { id, email, name, role }, accessToken }

POST /api/v1/auth/login
  Body: { email, password }
  Response 200: { user: { id, email, name, role }, accessToken }

POST /api/v1/auth/logout
  Auth: required
  Response 200: { message: "ok" }

GET  /api/v1/auth/me
  Auth: required
  Response 200: { id, email, name, role, createdAt }
```

#### Questions

```
GET /api/v1/questions
  Auth: required
  Query: topic? difficulty? type? company? search? page? limit?
  Response 200: { data: Question[], total, page, limit }

GET /api/v1/questions/:id
  Auth: required
  Response 200: Question (with topic, companies, recentAttempts)

POST /api/v1/questions
  Auth: required
  Body: { title, prompt, type, difficulty, topicId, subtopic?, referenceAnswer?, notes?, sourceUrl?, companyIds? }
  Response 201: Question

PATCH /api/v1/questions/:id
  Auth: required
  Body: Partial<above>
  Response 200: Question

DELETE /api/v1/questions/:id
  Auth: required
  Response 204
```

#### Topics

```
GET /api/v1/topics
  Auth: required
  Response 200: Topic[]

POST /api/v1/topics
  Auth: required
  Body: { name, parentTopicId?, description? }
  Response 201: Topic

PATCH /api/v1/topics/:id
  Auth: required
  Body: Partial<above>
  Response 200: Topic

DELETE /api/v1/topics/:id
  Auth: required
  Response 204
```

#### Companies

```
GET /api/v1/companies
  Auth: required
  Response 200: Company[]

POST /api/v1/companies
  Auth: required
  Body: { name, region?, notes? }
  Response 201: Company

PATCH /api/v1/companies/:id
  Auth: required
  Body: Partial<above>
  Response 200: Company

DELETE /api/v1/companies/:id
  Auth: required
  Response 204
```

#### Interview Sessions

```
POST /api/v1/sessions
  Auth: required
  Body: { title?, sessionType, topicId?, companyId?, difficulty?, questionCount }
  Response 201: { session: InterviewSession, questions: SessionQuestion[] }

GET /api/v1/sessions
  Auth: required
  Query: status? page? limit?
  Response 200: { data: InterviewSession[], total, page, limit }

GET /api/v1/sessions/:id
  Auth: required
  Response 200: InterviewSession (with sessionQuestions and attempts)

POST /api/v1/sessions/:id/answer
  Auth: required
  Body: { questionId, answerText, selfRating? }
  Response 201: AnswerAttempt

POST /api/v1/sessions/:id/complete
  Auth: required
  Response 200: InterviewSession (status: completed, endedAt set)

POST /api/v1/sessions/:id/abandon
  Auth: required
  Response 200: InterviewSession (status: abandoned, endedAt set)
```

#### Attempts

```
GET /api/v1/attempts
  Auth: required
  Query: questionId? sessionId? page? limit?
  Response 200: { data: AnswerAttempt[], total, page, limit }

GET /api/v1/attempts/:id
  Auth: required
  Response 200: AnswerAttempt

GET /api/v1/questions/:id/attempts
  Auth: required
  Query: page? limit?
  Response 200: { data: AnswerAttempt[], total, page, limit }
```

#### Dashboard

```
GET /api/v1/dashboard/summary
  Auth: required
  Response 200: {
    totalQuestionsPracticed: number,
    totalSessions: number,
    topicProgress: { topicId, topicName, attempted, total, percentage }[],
    recentSessions: InterviewSession[],
    weakTopics: { topicId, topicName, avgSelfRating }[],
    suggestedNextTopics: Topic[]
  }
```

#### Study Plan

```
GET /api/v1/study-plan
  Auth: required
  Query: status?
  Response 200: StudyPlanItem[]

POST /api/v1/study-plan
  Auth: required
  Body: { title, topicId?, notes?, targetDate? }
  Response 201: StudyPlanItem

PATCH /api/v1/study-plan/:id
  Auth: required
  Body: { title?, topicId?, notes?, targetDate?, status? }
  Response 200: StudyPlanItem

DELETE /api/v1/study-plan/:id
  Auth: required
  Response 204
```

Reason: RESTful conventions, versioned under /v1 for future flexibility. Pagination on list endpoints to keep responses manageable as the question bank grows.
Consequences: Frontend must include auth token on every protected request. Session question selection logic lives in backend (POST /sessions picks questions by filters).

---

### DEC-005 Shared Package Structure

Date: 2026-06-19
Owner: Claude
Decision: `packages/shared/src/` exports DTO types and Zod schemas used by both `apps/api` and `apps/web`.

```
packages/shared/src/
  types/
    user.ts
    question.ts
    topic.ts
    company.ts
    session.ts
    attempt.ts
    study-plan.ts
    dashboard.ts
  schemas/
    user.schema.ts
    question.schema.ts
    topic.schema.ts
    company.schema.ts
    session.schema.ts
    attempt.schema.ts
    study-plan.schema.ts
  index.ts
```

Reason: Single source of truth for DTO shape — prevents frontend/backend drift. Zod schemas double as runtime validators on the frontend and can be used with `@UsePipes(ZodValidationPipe)` on the backend.
Consequences: Both `apps/api` and `apps/web` must depend on `packages/shared`. Build order: shared → api, shared → web.

---

### DEC-006 Monorepo Layout

Date: 2026-06-19
Owner: Claude
Decision: pnpm workspaces monorepo.

```
Momito/
  apps/
    api/          NestJS backend
    web/          Next.js frontend
  packages/
    shared/       Shared DTO types and Zod schemas
  infra/          Docker Compose, env templates
  .agents/        Agent skill files
  .swarm/         Swarm coordination files
  package.json    workspace root
  pnpm-workspace.yaml
```

Reason: pnpm workspaces are lightweight and work well with NestJS + Next.js. Avoids duplication with local package linking.
Consequences: All agents must run `pnpm install` from repo root before working. Lock file is `pnpm-lock.yaml` — do not use npm or yarn.

---

### DEC-007 Error Response Shape

Date: 2026-06-19
Owner: Claude
Decision: All API errors follow this shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [...]
}
```

NestJS global exception filter handles this uniformly.
Reason: Consistent error shape lets the frontend handle errors generically. `details` array carries field-level validation errors from class-validator.
Consequences: Frontend API client should always check `response.ok` and parse the error body to show meaningful messages.

---

### DEC-008 Session Question Selection

Date: 2026-06-19
Owner: Claude
Decision: When creating a session (POST /sessions), backend selects questions using this logic:
1. Filter by `topicId` if provided.
2. Filter by `difficulty` if provided.
3. Filter by `companyId` if provided (via QuestionCompanies join).
4. Shuffle and take `questionCount` questions.
5. If fewer questions available than requested, use all available.

Reason: Simple deterministic selection. No ML or spaced repetition for MVP.
Consequences: Same questions may repeat across sessions. Spaced repetition can be layered on top in a future sprint without changing the API shape.

---

### DEC-009 Exact-Question Practice Session (P1-002)

Date: 2026-06-20
Owner: Claude
Decision: Add `questionIds?: string[]` to `CreateSessionDto` (POST /sessions). When `questionIds` is provided, the backend skips the filter/shuffle logic and uses those exact question IDs in order. `questionCount` is still required for backward compatibility but is ignored when `questionIds` is supplied.

Implementation changes required:
1. `packages/shared/src/types/session.ts` — add `questionIds?: string[]` to `CreateSessionRequest`.
2. `apps/api/src/sessions/dto/create-session.dto.ts` — add `@IsOptional() @IsArray() @IsUUID(undefined, { each: true }) questionIds?: string[]`.
3. `apps/api/src/sessions/sessions.service.ts` — branch on `questionIds`:
   - if provided: `const selected = dto.questionIds.map(id => ({ id }))` (skip filter + shuffle).
   - if not provided: existing filter + shuffle path unchanged.
4. `apps/web/app/lib/api-client.ts` — add `questionIds?: string[]` to `CreateSessionParams`.
5. `apps/web/app/(authenticated)/questions/[id]/page.tsx` — pass `questionIds: [id]` and set `questionCount: 1` in the "Start Practice" button handler.

Reason: Cleanest extension of the existing contract. No new endpoint needed. Preserves the existing filter-based session creation path unchanged. Naturally supports future "practice these N questions" use cases. Consistent with DEC-004 API shape.
Consequences: `questionCount` becomes a no-op when `questionIds` is present. The backend should validate that all supplied IDs exist and belong to accessible questions (return 400 if any ID is invalid).

---

### DEC-010 Auth Token Storage — Keep localStorage for MVP

Date: 2026-06-20
Owner: Claude
Decision: Retain JWT storage in `localStorage` for the MVP. Do not migrate to httpOnly cookies in this sprint.

Tradeoff analysis:
- **localStorage**: Simple, works with the current Bearer-header approach, zero backend changes. Risk: XSS can read the token. Mitigated by: (a) this is a personal single-user tool with no sensitive user data beyond interview notes, (b) no third-party scripts are loaded in the frontend.
- **httpOnly cookie**: XSS-resistant. Requires: backend sets `Set-Cookie` on login, frontend uses `credentials: 'include'` on all requests, CSRF token or `SameSite=Strict` protection, CORS must allow credentials. Significant complexity increase for a personal tool.

Decision rationale: For a portfolio/personal tool, the XSS risk of localStorage is acceptable. The complexity cost of migrating to httpOnly cookies exceeds the security benefit in this threat model.

Action required: Document this tradeoff in README under "Security Considerations". Note that migration to httpOnly cookies is the recommended next step before any multi-user or public deployment.

---

### DEC-011 API Client — Topics and Companies Write Methods

Date: 2026-06-20
Owner: Claude
Decision: `apps/web/app/lib/api-client.ts` currently exposes only `topicsApi.list()` and `companiesApi.list()`. The backend already has full CRUD for both resources (DEC-004). The frontend needs `create` methods (at minimum) to support P1-003 (question form) and P1-004 (settings page).

Required additions to `api-client.ts` before P1-003 and P1-004 can be implemented:
- `topicsApi.create(body: { name: string; parentTopicId?: string; description?: string })`
- `companiesApi.create(body: { name: string; region?: string; notes?: string })`

Optional (for P1-004 settings page completeness):
- `topicsApi.update(id, body)` / `topicsApi.delete(id)`
- `companiesApi.update(id, body)` / `companiesApi.delete(id)`

Owner of these additions: DeepSeek (api-client.ts is in `apps/web/`). Should be done as a prerequisite step in P1-003 or P1-004, not a separate ticket.
