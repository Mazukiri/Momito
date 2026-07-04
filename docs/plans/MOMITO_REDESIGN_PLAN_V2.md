# Momito Redesign v2 — Knowledge OS for Software Engineering Interviews

> This is an upgraded system-design + execution plan based on the original Momito Redesign plan. The original plan already identified the core product gaps: phone usability, weak learning core, product sprawl, dead review/AI fields, and git risk. This v2 keeps the full-product ambition but makes the plan safer, more complete, and more implementable through PR-sized work.

---

## 0. Executive Doctrine

Momito is not merely an interview-prep CRUD app.

Momito is a **personal Knowledge Operating System for becoming a stronger software engineer**, with interview preparation as the first full use case.

The full app must include:

- mobile-first PWA usability;
- DSA/coding practice;
- CS fundamentals;
- system design;
- behavioral story bank;
- AI/self grading;
- spaced repetition;
- job/application pipeline;
- enough high-quality data to be useful without external spreadsheets;
- deployment, backup, security, and reliability.

But it must not be implemented as one giant rewrite.

```text
Full product vision.
Progressive implementation.
Small PRs.
Hard quality gates.
No fake completeness.
```

---

## 1. North Star Loop

Every major feature must serve the daily loop:

```text
Today
→ Recommended Action
→ Practice / Recall / Rehearse
→ Submit Attempt
→ Reflect on Mistake
→ Grade / Self-rate
→ Schedule Review
→ Update Progress
→ Return Tomorrow
```

If a feature does not improve this loop, connect to this loop, or feed useful data into this loop, it is either deferred or redesigned.

---

## 2. Product Invariants

### 2.1 Learning Invariants

1. Every practice object is reviewable or explicitly marked non-reviewable.
2. Every reviewable object has title, domain, difficulty, tags, source/reference, rubric, review state, and attempt history.
3. Every serious attempt creates history.
4. Every attempt can capture reflection.
5. Every reflection can produce weakness signals.
6. Every weakness signal can affect future recommendations.
7. Nothing valuable disappears silently.
8. Progress is derived from real attempts, not static checkboxes.

### 2.2 Data Invariants

1. Every seed item must be idempotent.
2. Every seed item must have a stable ID.
3. Every imported/generated item has provenance.
4. No copyrighted problem statements are copied into seeds.
5. External problems are represented through metadata, links, and original notes only.
6. Every rubric is machine-readable.
7. Every data batch has validation.
8. Every destructive migration has conversion and rollback notes.

### 2.3 UX Invariants

1. Phone experience is primary.
2. The app remains useful without AI.
3. The app remains usable with slow/cold API responses.
4. Today must never become a junk dashboard.
5. A useful session should start within 2 taps from Today.
6. Bottom nav must never cover content.
7. Every critical action must give visible feedback.

### 2.4 Engineering Invariants

1. One PR-sized task at a time.
2. Each task ends with diff summary and verification.
3. CI must stay green after each phase gate.
4. Migrations are tested on fresh DB and existing DB where applicable.
5. No broad rewrites unless explicitly permitted.
6. No “implement Phase X” prompts.
7. A feature is not done until its user journey passes.

---

## 3. Architecture Layers

```text
Layer 0 — Platform Foundation
Layer 1 — Knowledge Kernel
Layer 2 — Learning Engine
Layer 3 — Practice Engine
Layer 4 — Content Factory
Layer 5 — AI Feedback Engine
Layer 6 — Career Engine
Layer 7 — Reliability, Operations, and Polish
```

The original phase plan is still useful, but the layers define the long-term architecture.

---

## 4. Layer 0 — Platform Foundation

### Goal

Make the app reliable, deployable, secure enough for single-user public internet use, and excellent on phone.

### Must include

- git snapshot and rollback safety;
- archive abandoned Python backend and Expo mobile app;
- Next.js PWA shell;
- responsive authenticated layout;
- bottom tabs on mobile;
- sidebar on laptop;
- real `/today` route;
- provider setup;
- dark/light theme;
- API security baseline;
- health endpoint;
- deploy to Vercel + Render + Neon;
- documented env variables;
- green lint/typecheck/test/build.

### Output

A user can install the web app on phone, log in, and open Today.

---

## 5. Layer 1 — Knowledge Kernel

The app should evolve toward a common conceptual model called `KnowledgeObject`.

Do **not** immediately rewrite the database into a fully polymorphic abstraction. Implement this first at the service/type layer while preserving existing models such as `Question`, `Story`, `Task`, and `JobApplication`.

### 5.1 KnowledgeObject Concept

A KnowledgeObject is anything that contributes to learning or career progress.

Examples:

- DSA problem metadata;
- CS fundamentals card;
- system design case;
- behavioral prompt;
- personal STAR story;
- interview event;
- company target;
- job application;
- weak topic;
- learning note.

Conceptual shape:

```ts
type KnowledgeDomain =
  | 'dsa'
  | 'system_design'
  | 'cs_fundamentals'
  | 'behavioral'
  | 'career'
  | 'story'
  | 'company'
  | 'job';

interface KnowledgeObject {
  id: string;
  domain: KnowledgeDomain;
  title: string;
  summary?: string;
  tags: string[];
  difficulty?: 'easy' | 'medium' | 'hard' | 'advanced';
  sourceUrl?: string;
  provenance: 'seed' | 'imported' | 'user_created' | 'ai_generated' | 'manual_curated';
  qualityStatus: 'draft' | 'reviewable' | 'published' | 'verified';
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 Reviewable Concept

Every reviewable item should expose:

```ts
interface Reviewable {
  objectId: string;
  objectType: 'question' | 'story' | 'system_design_case' | 'behavioral_prompt' | 'cs_card';
  prompt: string;
  referenceAnswer?: string;
  rubricId?: string;
  reviewStateId?: string;
}
```

### 5.3 Rubric Concept

Every serious practice object must have a machine-readable rubric.

```ts
interface Rubric {
  id: string;
  objectId: string;
  criteria: Array<{
    id: string;
    title: string;
    description: string;
    weight: number;
    levels?: Array<{ score: number; description: string }>;
  }>;
  maxScore: number;
}
```

### 5.4 WeaknessSignal

Weakness signals make recommendations smarter.

```ts
interface WeaknessSignal {
  id: string;
  userId: string;
  objectId: string;
  domain: KnowledgeDomain;
  tag: string;
  reason:
    | 'misread'
    | 'wrong_pattern'
    | 'edge_case'
    | 'time_pressure'
    | 'blank'
    | 'implementation_bug'
    | 'concept_gap'
    | 'communication_gap'
    | 'tradeoff_gap';
  severity: 1 | 2 | 3 | 4 | 5;
  attemptId?: string;
  createdAt: string;
}
```

---

## 6. Layer 2 — Learning Engine

The Learning Engine decides what to show next and why.

It contains:

1. FSRS spaced repetition;
2. weakness-aware recommendation;
3. daily queue construction;
4. streak/progress;
5. coverage tracking;
6. adaptive curriculum.

### 6.1 Today Queue Priority

```text
1. Overdue reviews
2. Due reviews
3. Weakness repair items
4. Active curriculum next step
5. Upcoming career deadlines
6. Optional stretch practice
```

### 6.2 Recommendation Explanation

Every recommended item should explain why it appears.

Examples:

- “Due for review today.”
- “You failed 2 sliding-window questions recently.”
- “This unlocks the next system design topic.”
- “This is linked to an upcoming Meta backend interview.”
- “You have not rehearsed this behavioral story in 14 days.”

### 6.3 ReviewState Design

Prefer a future-proof object reference over nullable fields:

```prisma
model ReviewState {
  id         String @id @default(uuid()) @db.Uuid
  userId     String @map("user_id") @db.Uuid
  objectType String @map("object_type")
  objectId   String @map("object_id") @db.Uuid

  stability  Float @default(0)
  difficulty Float @default(0)
  due        DateTime @default(now()) @db.Timestamptz(6)
  state      Int @default(0)
  reps       Int @default(0)
  lapses     Int @default(0)
  suspended  Boolean @default(false)

  lastReviewedAt DateTime? @map("last_reviewed_at") @db.Timestamptz(6)

  @@unique([userId, objectType, objectId])
  @@index([userId, due])
  @@map("review_states")
}
```

If the repo strongly favors explicit relations, use nullable relation fields only after constraint tests.

### 6.4 Progress Metrics

Track:

- attempts per day;
- reviews completed per day;
- due/overdue reviews;
- streak;
- solved-clean / solved-with-hints / failed;
- weakness frequency by tag;
- coverage by domain;
- content quality status.

---

## 7. Layer 3 — Practice Engine

### 7.1 Session Types

- `dsa_practice`;
- `spaced_review`;
- `system_design`;
- `cs_fundamentals`;
- `behavioral_rehearsal`;
- `mixed_interview`;
- `weakness_repair`.

### 7.2 Attempt Lifecycle

```text
Start session
→ Load item
→ Read prompt
→ Work in editor/text area
→ Submit or save draft
→ Reveal reference/rubric
→ Reflect
→ Self-rate
→ Optional AI grade
→ Schedule review
→ Update progress
```

### 7.3 Reflection Fields

Every attempt should optionally store:

- miss tags;
- reflection note;
- outcome;
- language;
- complexity;
- confidence;
- time spent;
- AI score;
- AI feedback;
- rubric scores.

### 7.4 System Design Answer Format

Use markdown with fixed sections:

```md
## Requirements
## Estimation
## API
## Data Model
## High-level Design
## Deep Dives
## Tradeoffs
```

### 7.5 Behavioral Story Format

Use STAR:

```text
Situation
Task
Action
Result
Metrics
Competencies
Companies
Follow-up questions
```

---

## 8. Layer 4 — Content Factory

The app must have enough data. This requires a Knowledge Acquisition Pipeline, not random seed rows.

```text
Source
→ Normalize
→ Deduplicate
→ Tag
→ Generate original note
→ Attach rubric
→ Link graph
→ Validate
→ Publish
→ Monitor usage
```

### 8.1 Content Quality Levels

```text
draft       — exists but not ready for serious use
reviewable  — usable in practice sessions
published   — part of default curriculum
verified    — manually sampled and accepted
```

Only `published` and `verified` items should appear in default curriculum.

### 8.2 Full-Product Data Targets

| Domain | Full target | Must include |
|---|---:|---|
| DSA | 150 curated items | 25 patterns, difficulty ladder, links only, original notes, no copied statements |
| CS Fundamentals | 150 cards/questions | OS, networking, DB, concurrency, JS/TS, backend/API, OOP, C++, ML basics |
| System Design | 25 cases | 7-section template, weighted rubric, reference outline, tradeoffs |
| Behavioral | 60 prompts | competency tags, company mappings, follow-up questions |
| Story Bank | user-created | STAR editor, linked prompts, rehearsal schedule |
| Company Packs | 20 companies | role tags, common focus areas, linked prep paths |
| Role Tracks | 8 tracks | backend, AI/NLP, infra, mobile, fullstack, quant/HPC, data, security |
| Rubrics | 100% of published practice items | machine-readable criteria |
| Tags | 100% of published practice items | domain, topic, pattern, difficulty |
| Provenance | 100% | seed/imported/user/AI/manual |

### 8.3 DSA Item Specification

```ts
{
  id: string;
  title: string;
  sourceUrl: string;
  sourceSlug: string;
  sourcePlatform: 'leetcode' | 'codeforces' | 'custom' | 'other';
  difficulty: 'easy' | 'medium' | 'hard';
  patterns: string[];
  prerequisites: string[];
  originalPracticeNote: string;
  expectedComplexity?: string;
  rubric: Rubric;
  companyTags?: string[];
}
```

No external problem statement text.

### 8.4 Content Validation Scripts

Add scripts:

```text
pnpm content:validate
pnpm content:stats
pnpm content:sample
```

Validation checks:

- no missing IDs;
- no duplicate source URLs;
- no empty rubrics;
- no missing tags;
- no published item without reference answer/rubric;
- no known copyrighted statement patterns;
- seed idempotency;
- minimum coverage thresholds.

---

## 9. Layer 5 — AI Feedback Engine

AI grading is required in the full product, but the app must remain useful without it.

### 9.1 AI Principles

1. AI augments self-rating, not replaces it.
2. AI feedback must be rubric-grounded.
3. AI failure must not break sessions.
4. AI cost must be server-capped.
5. AI output must be structured.
6. AI SDK details must be verified against installed packages before implementation.

### 9.2 AI Grade Output

```ts
{
  overallScore: number;
  rubricScores: Array<{
    criterionId: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  gaps: string[];
  followUpQuestions: string[];
  suggestedRating: 'again' | 'hard' | 'good' | 'easy';
  weaknessSignals: WeaknessSignal[];
}
```

### 9.3 AI Integration Spike

Before full implementation, verify:

- actual SDK method names;
- structured output support;
- model names;
- pricing assumptions;
- response usage shape;
- error classes.

Do not rely blindly on the original plan's SDK syntax.

---

## 10. Layer 6 — Career Engine

The Career Engine turns learning into outcomes.

### 10.1 Career Loop

```text
Target company / role
→ Identify expected skills
→ Link to practice curriculum
→ Prepare stories
→ Track application
→ Schedule interview
→ Generate prep queue
→ Record interview outcome
→ Feed lessons back into learning engine
```

### 10.2 Core Objects

- JobApplication;
- Company;
- RoleTrack;
- InterviewEvent;
- ResumeVersion;
- Story;
- PrepPlan;
- Reminder;
- Task.

### 10.3 Jobs Kanban

No drag-and-drop initially. Mobile-first segmented list is safer.

Statuses:

- wishlist;
- applied;
- OA;
- recruiter;
- technical;
- onsite/final;
- offer;
- rejected;
- archived.

### 10.4 Reminders

In-app only.

Sources:

- Task due dates;
- job deadlines;
- interview dates;
- story rehearsal due dates;
- review deadlines.

---

## 11. Layer 7 — Reliability, Operations, and Polish

Must include:

- global error boundaries;
- route loading skeletons;
- API exception filter;
- request logging;
- health check with DB ping;
- weekly encrypted DB backup;
- restore documentation;
- Lighthouse mobile pass;
- accessibility pass;
- README rewrite;
- deployment runbook.

Reliability gates:

```text
Fresh install works
Fresh DB migration + seed works
Existing DB migration path works
Phone PWA works
Golden Path works
No AI key path works
Over-budget AI path works
Offline shell path works
Backup and restore documented
```

---

## 12. Golden Path Tests

### 12.1 Learning Golden Path

```text
Login
→ land on Today
→ see recommended review/practice
→ start session
→ answer item
→ reveal reference
→ record reflection
→ rate Again/Hard/Good/Easy
→ return to Today
→ see updated review/progress/streak
→ reload
→ state persists
```

### 12.2 DSA Golden Path

```text
Open Practice
→ DSA ladder
→ choose pattern
→ start item
→ code answer
→ record complexity
→ mark outcome
→ capture mistake
→ see pattern progress update
```

### 12.3 System Design Golden Path

```text
Open system design case
→ fill 7 sections
→ reveal rubric/reference
→ self-grade or AI-grade
→ schedule review
```

### 12.4 Behavioral Golden Path

```text
Create STAR story
→ link to behavioral prompt
→ rehearse story
→ rate recall
→ schedule review
```

### 12.5 Career Golden Path

```text
Add job
→ set deadline/interview
→ link role/company prep
→ see item on Today
→ update status
→ log outcome
```

---

## 13. PR Backlog

### Track A — Safety and Foundation

- MOM-001: Snapshot current repo state.
- MOM-002: Move plan and execution docs into repo.
- MOM-003: Archive legacy backend/mobile safely.
- MOM-004: Rewrite root project docs.
- MOM-005: Add architecture doctrine ADRs.

### Track B — Mobile Platform

- MOM-006: Add frontend utility foundation.
- MOM-007: Add design system primitives safely.
- MOM-008: Create navigation model.
- MOM-009: Implement mobile bottom tabs.
- MOM-010: Implement desktop sidebar and top bar.
- MOM-011: Rewrite authenticated layout shell.
- MOM-012: Add `/today` stub and redirects.
- MOM-013: Fix theme and typography baseline.
- MOM-014: Restyle auth pages for phone.
- MOM-015: Add PWA manifest and icons.
- MOM-016: Add offline page and service worker.

### Track C — API Foundation

- MOM-017: Add API security baseline.
- MOM-018: Add auth throttling and registration lock.
- MOM-019: Add health endpoint.
- MOM-020: Add Neon direct URL support.
- MOM-021: First deploy.

### Track D — Knowledge Kernel

- MOM-022: Add shared domain constants.
- MOM-023: Add rubric type definitions.
- MOM-024: Add content validation framework.
- MOM-025: Add KnowledgeObject response helpers.

### Track E — Review and Learning Engine

- MOM-026: Design ReviewState migration.
- MOM-027: Implement ReviewState migration.
- MOM-028: Add reflection fields to attempts.
- MOM-029: Implement reviews module.
- MOM-030: Add FSRS scheduling service.
- MOM-031: Hook answer submission into review scheduling.
- MOM-032: Implement Today dashboard API.
- MOM-033: Add recommendation reason field.

### Track F — Practice Engine UI

- MOM-034: Add markdown renderer.
- MOM-035: Add CodeMirror editor.
- MOM-036: Add timer hook.
- MOM-037: Split session page into components.
- MOM-038: Implement answer panel by question type.
- MOM-039: Implement reflection panel.
- MOM-040: Implement session summary.
- MOM-041: Implement practice hub.
- MOM-042: Implement Today learning cards.

### Track G — Content Factory

- MOM-043: Create seed-data structure.
- MOM-044: Implement idempotent seed upsert utilities.
- MOM-045: Seed DSA patterns.
- MOM-046: Seed DSA ladder batch 1 — 50 items.
- MOM-047: Seed DSA ladder batch 2 — 100 total.
- MOM-048: Seed DSA ladder batch 3 — 150 total.
- MOM-049: Add LeetCode import service.
- MOM-050: Add DSA progress API.
- MOM-051: Implement DSA ladder UI.
- MOM-052: Seed CS fundamentals batch 1 — 50 items.
- MOM-053: Seed CS fundamentals batch 2 — 100 total.
- MOM-054: Seed CS fundamentals batch 3 — 150 total.
- MOM-055: Seed system design batch 1 — 10 cases.
- MOM-056: Seed system design batch 2 — 25 total.
- MOM-057: Add system design editor.
- MOM-058: Seed behavioral prompts batch 1 — 30 prompts.
- MOM-059: Seed behavioral prompts batch 2 — 60 total.
- MOM-060: Add company packs — 20 companies.
- MOM-061: Add role tracks — 8 tracks.
- MOM-062: Add content coverage dashboard.

### Track H — Story and Behavioral Engine

- MOM-063: Design Story schema and review integration.
- MOM-064: Implement Story CRUD API.
- MOM-065: Implement Story frontend.
- MOM-066: Link stories to behavioral prompts.
- MOM-067: Add story rehearsal sessions.

### Track I — AI Feedback Engine

- MOM-068: AI SDK spike.
- MOM-069: Add AiUsage migration.
- MOM-070: Add budget service.
- MOM-071: Add grading service.
- MOM-072: Add grade attempt endpoint.
- MOM-073: Add AI feedback frontend card.
- MOM-074: Integrate AI grading into reflection panel.

### Track J — Career Engine

- MOM-075: Design task consolidation migration.
- MOM-076: Merge StudyPlanItem into Task.
- MOM-077: Remove old study-plan code.
- MOM-078: Implement reminders cron.
- MOM-079: Implement reminder API.
- MOM-080: Add reminder UI to Today and top bar.
- MOM-081: Rewrite jobs page as mobile-first kanban/list.
- MOM-082: Add career hub.
- MOM-083: Link jobs to prep objects.

### Track K — Operations and Hardening

- MOM-084: Add error/loading boundaries.
- MOM-085: Add API exception filter and request logging.
- MOM-086: Add DB health ping.
- MOM-087: Add backup workflow.
- MOM-088: Lighthouse and accessibility pass.
- MOM-089: README rewrite.
- MOM-090: Final full-product verification.

---

## 14. Task Template

Every MOM task should be expanded before implementation:

```md
## MOM-XXX — Task name

Goal:
User-visible outcome:
Allowed files:
Forbidden changes:
Dependencies:
Acceptance criteria:
Verification:
Manual test:
Rollback:
Commit message:
```

---

## 15. Phase Gates

### Gate 1 — Phone Foundation Complete

Required:

- login on phone;
- Today route;
- bottom tabs;
- deploy;
- health endpoint;
- app installable.

### Gate 2 — Learning Loop Complete

Required:

- create session;
- answer;
- reflect;
- rate;
- review state updates;
- Today queue updates.

### Gate 3 — Data Depth Complete

Required:

- DSA 150;
- CS 150;
- system design 25;
- behavioral 60;
- companies 20;
- role tracks 8;
- rubric coverage 100%;
- content validation passes.

### Gate 4 — AI Feedback Complete

Required:

- grade with key;
- no-key works;
- budget exceeded works;
- stored feedback renders;
- zero network in tests.

### Gate 5 — Career Engine Complete

Required:

- jobs;
- reminders;
- career hub;
- job-linked prep.

### Gate 6 — Production Complete

Required:

- backup;
- restore docs;
- Lighthouse;
- accessibility;
- final golden paths.

---

## 16. Risk Spikes

Run spikes before dangerous implementation.

```text
SPIKE-001: shadcn + Tailwind v4 + Next 16 compatibility
SPIKE-002: service worker cache/auth behavior
SPIKE-003: ReviewState objectType/objectId migration
SPIKE-004: ts-fsrs API and scheduling semantics
SPIKE-005: Anthropic SDK structured output
SPIKE-006: LeetCode GraphQL response shape
SPIKE-007: StudyPlanItem → Task migration mapping
SPIKE-008: Render cold start and keep-warm reality
```

---

## 17. Kill / Defer Rules

Full product is required, but sequencing still matters.

Defer a feature if implementing it now would break the golden path.

Examples:

- Defer service worker if it causes auth/cache instability; ship manifest first.
- Defer AI grading UI if self-rating loop is not complete.
- Defer jobs kanban if task consolidation is not safe.
- Defer content batch 3 if validation fails on batch 1/2.
- Defer Story review if ReviewState polymorphism is unresolved.

Defer means “not now”, not “never”.

---

## 18. Completion Definition

Momito v2 is complete when:

1. It is installable and usable on phone.
2. It has a real Today queue.
3. It supports DSA, CS, system design, behavioral, stories, and jobs.
4. It has enough published content to be useful.
5. It schedules reviews.
6. It captures mistakes.
7. It produces progress signals.
8. It grades with AI when configured.
9. It works without AI.
10. It deploys reliably.
11. It backs up data.
12. All golden paths pass.

The final product should feel like:

```text
A disciplined interview-prep companion that knows what I am weak at,
what I need to do today, what I should review, and how my career pipeline
connects to my study plan.
```

---

## 19. Prompting Protocol for AI Agents

### Planner Prompt

```md
MODE: PLANNER

Read the plan and the actual repository.

Do not code.

Select the next PR-sized task only.

Update docs/codex/NEXT.md with:
- task ID
- goal
- allowed files
- forbidden changes
- acceptance criteria
- verification
- rollback
```

### Implementer Prompt

```md
MODE: IMPLEMENTER

Implement only the task in docs/codex/NEXT.md.

Before editing:
- inspect relevant files
- restate current behavior
- explain minimal diff

During editing:
- no future tasks
- no opportunistic refactor
- keep diff small

After editing:
- run checks
- update LOG.md
- report files changed and risks
```

### Reviewer Prompt

```md
MODE: REVIEWER

Review current git diff only.

Do not code.

Check:
- scope creep
- broken imports
- runtime errors
- migration risks
- mobile regressions
- security regressions
- missing tests

Return:
- blocking issues
- non-blocking issues
- safe to commit or not
```

### Release Prompt

```md
MODE: RELEASE CAPTAIN

Prepare commit.

Show:
- git status
- diff summary
- checks run
- failures
- suggested commit message

Do not commit unless explicitly asked.
```

---

## 20. Final Strategy

The original plan was technically rich. This v2 makes it harder to fail.

The important upgrade is:

```text
Turn the plan into a system with invariants,
a knowledge/data pipeline,
quality gates,
and PR-sized implementation units.
```

That is how a very hard app becomes implementable.
