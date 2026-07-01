# Momito — Interview Prep App Project Brief

## 1. Product Vision

Momito is an Interview Prep App for serious Software Engineer, Backend Engineer, and AI Engineer internship preparation.

The app should help a CS student prepare for interviews beyond pure DSA. It should cover:

- DSA / LeetCode style practice
- Backend interview questions
- JavaScript / TypeScript / Node.js
- Databases
- Operating Systems
- Computer Networks
- OOP
- System Design fundamentals
- Behavioral interview preparation
- Company-specific preparation
- Mock interview sessions
- Progress tracking

This should become a strong portfolio project for Backend/SWE/AI internship applications.

Target user:

- CS student in Vietnam
- preparing for Big Tech / Mid Tech internships globally
- wants a serious, structured, productivity-focused preparation system

---

## 2. MVP Goals

The MVP should allow the user to:

1. Register and log in.
2. Store and browse interview questions.
3. Filter questions by topic, difficulty, company, and question type.
4. Start a mock interview session.
5. Answer questions in text form.
6. Save attempts and review past answers.
7. Track progress by topic.
8. See weak areas.
9. Maintain a personal study plan.
10. Prepare for real company interviews.

---

## 3. User Types

### Normal User

A student or job seeker preparing for interviews.

Needs:

- structured question bank
- mock interview mode
- progress tracking
- review history
- topic-based study
- company-specific prep

### Admin / Content Maintainer

For MVP, this can be the same user.

Needs:

- add/edit/delete questions
- add topics
- add companies
- tag questions
- organize question sets

---

## 4. MVP Feature Scope

### Authentication

Must support:

- user registration
- login
- logout
- session handling
- protected pages

Simple email/password auth is acceptable for MVP.

---

### Question Bank

Each question should have:

- title
- full prompt
- topic
- subtopic
- difficulty: `easy`, `medium`, `hard`
- type:
  - `dsa`
  - `backend`
  - `javascript`
  - `typescript`
  - `nodejs`
  - `database`
  - `os`
  - `networking`
  - `oop`
  - `system_design`
  - `behavioral`
- company tags, optional
- expected/reference answer
- notes
- source URL, optional
- created time
- updated time

User should be able to:

- list questions
- search questions
- filter questions
- view question detail
- add question
- edit question
- delete question

---

### Mock Interview Session

User should be able to start a session with options:

- topic selection
- difficulty selection
- number of questions
- session type:
  - `quick_practice`
  - `topic_practice`
  - `company_practice`
  - `mixed_mock`

During a session:

- show one question at a time
- user writes answer
- user submits answer
- app saves the answer attempt
- move to next question
- end session with summary

Session summary should show:

- number of questions answered
- topics covered
- self-rating, optional
- time spent
- list of answers
- weak topics, if available

---

### Answer Attempts

Each attempt should store:

- user
- question
- session
- user answer
- self rating, optional
- AI score, optional later
- feedback, optional later
- created time

User should be able to:

- view past attempts
- review answers for a question
- see progress over time

---

### Dashboard

Dashboard should show:

- total questions practiced
- total sessions completed
- progress by topic
- recent sessions
- weak areas
- suggested next practice topic

---

### Study Plan

For MVP, a simple study plan is enough.

A study plan item should have:

- topic
- target date
- status: `todo`, `in_progress`, `done`
- notes

User should be able to:

- create study plan items
- mark items done
- see upcoming study tasks

---

## 5. Future Scope

These are not required for the first MVP, but architecture should not block them.

### AI Evaluation

Later, the app should support AI-based feedback.

For each answer, AI can evaluate:

- correctness
- completeness
- clarity
- depth
- missing concepts
- suggested improved answer
- follow-up questions

### Company-specific Interview Packs

Examples:

- Google L3 Backend pack
- Meta SWE Intern pack
- Shopee Backend pack
- Grab Backend pack
- ByteDance Backend pack
- FPT / Vietnam local company pack

Each pack may contain:

- common questions
- topic distribution
- mock interview templates
- notes about interview style

### Spaced Repetition

Questions can have review states:

- new
- learning
- review
- mastered

### Coding Practice

Later add:

- code editor
- test cases
- DSA problem runner
- SQL practice runner

### Voice Mock Interview

Later add:

- voice input
- real-time interview simulation
- transcript
- AI interviewer

---

## 6. Suggested Tech Stack

Use a monorepo if possible:

```txt
Momito/
  apps/
    web/
    api/
  packages/
    shared/
  infra/
  .agents/
  .swarm/
```

Frontend:

- Next.js
- TypeScript
- Tailwind CSS
- reusable component system
- React Hook Form or similar
- Zod for validation if suitable

Backend:

- Node.js
- TypeScript
- NestJS preferred
- Express/Fastify acceptable if project already uses it

Database:

- PostgreSQL
- Prisma or Drizzle ORM

Optional for MVP:

- Redis for session/cache/rate limit/job queue later

Shared package:

- DTO types
- Zod schemas
- API contracts
- shared constants

---

## 7. Domain Model

### User

- id
- email
- passwordHash
- name
- role
- createdAt
- updatedAt

### Topic

- id
- name
- parentTopicId, optional
- description
- createdAt
- updatedAt

Examples:

- DSA
- Backend
- JavaScript
- Node.js
- Database
- OS
- Networking
- OOP
- System Design
- Behavioral

### Company

- id
- name
- region
- notes
- createdAt
- updatedAt

### Question

- id
- title
- prompt
- type
- difficulty
- topicId
- subtopic
- referenceAnswer
- notes
- sourceUrl
- createdByUserId
- createdAt
- updatedAt

Relations:

- many-to-many with Company
- many-to-many with tags, optional

### InterviewSession

- id
- userId
- title
- sessionType
- status: `active`, `completed`, `abandoned`
- startedAt
- endedAt
- createdAt
- updatedAt

### SessionQuestion

- id
- sessionId
- questionId
- order
- createdAt

### AnswerAttempt

- id
- userId
- sessionId
- questionId
- answerText
- selfRating
- aiScore, optional
- aiFeedback, optional
- createdAt
- updatedAt

### StudyPlanItem

- id
- userId
- topicId
- title
- notes
- targetDate
- status: `todo`, `in_progress`, `done`
- createdAt
- updatedAt

---

## 8. API Requirements

### Auth

```txt
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
```

### Questions

```txt
GET    /questions
GET    /questions/:id
POST   /questions
PATCH  /questions/:id
DELETE /questions/:id
```

Filters:

```txt
/questions?topic=database&difficulty=medium&type=backend&company=google&search=index
```

### Topics

```txt
GET    /topics
POST   /topics
PATCH  /topics/:id
DELETE /topics/:id
```

### Companies

```txt
GET    /companies
POST   /companies
PATCH  /companies/:id
DELETE /companies/:id
```

### Interview Sessions

```txt
POST   /sessions
GET    /sessions
GET    /sessions/:id
POST   /sessions/:id/answer
POST   /sessions/:id/complete
POST   /sessions/:id/abandon
```

### Attempts

```txt
GET /attempts
GET /attempts/:id
GET /questions/:id/attempts
```

### Dashboard

```txt
GET /dashboard/summary
```

Should return:

- totalQuestionsPracticed
- totalSessions
- topicProgress
- recentSessions
- weakTopics
- suggestedNextTopics

### Study Plan

```txt
GET    /study-plan
POST   /study-plan
PATCH  /study-plan/:id
DELETE /study-plan/:id
```

---

## 9. Frontend Pages

MVP web pages:

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
/study-plan
/settings
```

Dashboard page:

- greeting
- progress cards
- recent sessions
- weak topics
- suggested next actions

Questions page:

- search bar
- filters
- question list
- difficulty badges
- topic badges
- company tags

Question detail page:

- full prompt
- reference answer
- notes
- past attempts
- start practice button

Practice session page:

- current question
- answer textarea
- timer, optional
- submit answer button
- next question button
- progress indicator

Session summary page:

- session result
- questions answered
- list of answers
- weak areas
- recommended next steps

Study plan page:

- todo list
- in-progress list
- done list
- add study task form

---

## 10. UX Requirements

The app should feel like a serious productivity tool, not a toy.

UX rules:

- clean layout
- fast interactions
- good empty states
- good loading states
- good error states
- mobile-responsive web design
- keyboard-friendly where possible
- clear topic/difficulty badges
- minimal but professional UI

---

## 11. Engineering Requirements

Code quality:

- TypeScript strict mode preferred
- clear folder structure
- reusable components
- reusable API client
- shared validation schema if possible
- avoid huge files
- avoid duplicate business logic
- prefer small patches

Testing:

- typecheck must pass
- lint should pass if configured
- backend unit tests for core services if possible
- API tests for important endpoints if possible
- frontend component tests optional

Documentation:

- maintain `README.md`
- maintain `.swarm/BOARD.md`
- maintain `.swarm/DECISIONS.md`
- maintain `.swarm/QA.md`
- maintain `.swarm/HANDOFF.md`

---

## 12. MVP Definition of Done

MVP is done when:

1. User can register/login.
2. User can create and browse questions.
3. User can start a practice session.
4. User can answer questions.
5. Answers are saved.
6. User can view session summary.
7. Dashboard shows progress.
8. Study plan basic CRUD works.
9. Typecheck passes.
10. README explains how to run the project.
11. `.swarm/HANDOFF.md` contains final project state.
