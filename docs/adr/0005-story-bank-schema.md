# ADR-0005: Story Bank schema (STAR-format, user-authored)

> Renumbered from 0003 → 0005 (2026-07-06): 0003 collided with the pre-existing
> `0003-learning-engine-coexists-with-mission-engine.md`, apparently created
> without checking for an existing file at that number. Content unchanged.

## Status
**Implemented** — 2026-07-06. User granted blanket approval to cross the D-004
human-approval gate for the remainder of the plan. Migration `20260705174649_add_story_bank`
is applied (purely additive — three new tables, no changes to any existing table).

## Context
Plan §7.5/§8.2 calls for a user-authored "Story Bank": STAR-formatted behavioral stories
(Situation/Task/Action/Result/Metrics), taggable by competency and company, linkable to
multiple behavioral prompts, and reviewable via spaced repetition like any other knowledge
object. ADR-0002 already reserved `'story'` in `ReviewableObjectType` for this — no
`ReviewState` schema change is needed here, only the `Story` table itself and its two
linking tables.

## Decision
Three new, purely additive tables:

```prisma
model Story {
  id                String        @id @default(uuid()) @db.Uuid
  userId            String        @map("user_id") @db.Uuid
  title             String
  situation         String
  task              String
  action            String
  result            String
  metrics           String?
  competencyTags    String[]      @default([]) @map("competency_tags")
  followUpQuestions String[]      @default([]) @map("follow_up_questions")
  createdAt         DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  companies         StoryCompany[]
  prompts           StoryPrompt[]

  @@index([userId])
  @@map("stories")
}

model StoryCompany {
  storyId   String  @map("story_id") @db.Uuid
  companyId String  @map("company_id") @db.Uuid
  story     Story   @relation(fields: [storyId], references: [id], onDelete: Cascade)
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@id([storyId, companyId])
  @@index([companyId])
  @@map("story_companies")
}

model StoryPrompt {
  id         String   @id @default(uuid()) @db.Uuid
  storyId    String   @map("story_id") @db.Uuid
  questionId String   @map("question_id") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  story      Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([storyId, questionId])
  @@index([questionId])
  @@map("story_prompts")
}
```

**Field-shape rationale:**
- `situation`/`task`/`action`/`result` are separate required `String` columns rather than one
  free-text blob — the STAR structure is the whole value proposition of a story *bank* (as
  opposed to a plain note), and keeping them separate lets a future rehearsal UI (MOM-067)
  quiz each section independently.
- `metrics` is optional — not every story has a quantifiable result, and forcing one would
  push users toward inventing fake numbers.
- `competencyTags`/`followUpQuestions` are plain `String[]`, not DB-level enums — matching
  the existing precedent (`Question.roleTags`/`areaTags`/`patternTags`, `AnswerAttempt.missTags`)
  of validating tag-shaped fields at the DTO layer instead of constraining the schema. No
  behavioral-competency taxonomy exists yet in this codebase to constrain against; inventing
  one here would be scope creep beyond "design the Story schema."
- `StoryCompany` mirrors the existing `QuestionCompany` join-table shape exactly (same
  composite-key pattern, same `onDelete: Cascade` on both sides).
- `StoryPrompt` is many-to-many (`@@unique([storyId, questionId])`, not a 1:1 FK on either
  side) because the entire point of a story bank is *reusing* one strong story across
  several behavioral prompts, and a single prompt often has more than one story that could
  answer it.
- No FK from `ReviewState.objectId` to `stories.id` — consistent with ADR-0002's polymorphic
  design; a `Story` becomes reviewable purely by a `ReviewState` row existing with
  `objectType = 'story'` and `objectId = story.id`. Deleting a `Story` must clean up any
  matching `ReviewState` rows in the same transaction, exactly like `questions.service.ts`'s
  `remove()` already does for `Question` — this is MOM-064's responsibility, not a schema
  concern.

## Consequences
- MOM-064 (CRUD API) can build directly on this shape with no further schema changes.
- MOM-066 (linking stories to prompts) is just CRUD on `StoryPrompt` — no new tables needed.
- MOM-067 (rehearsal sessions) can reuse the existing `ReviewState`/FSRS scheduler
  (`objectType: 'story'`) once `ReviewsService.record()`'s allow-list is extended past
  `'question'` — no schema change, a service-layer change only.
- Deleting a `Company` cascades to `StoryCompany` (loses the tag, not the story); deleting a
  `Question` cascades to `StoryPrompt` (loses the link, not the story or the answer history).

## Related
- `docs/agent/BACKLOG.md` — MOM-063 (this ADR), MOM-064 (CRUD API), MOM-065 (frontend),
  MOM-066 (prompt linking), MOM-067 (rehearsal sessions)
- `docs/adr/0002-reviewstate-polymorphic-object-reference.md` — the review-state shape this
  reuses
