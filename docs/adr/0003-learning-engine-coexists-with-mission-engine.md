# ADR-0003: The FSRS learning engine coexists with the existing Mission engine

## Status
Accepted — 2026-07-05

## Context
`MOMITO_REDESIGN_PLAN_V2.md` describes a Learning Engine built on FSRS spaced repetition, a
Today queue, and weakness-aware recommendations (plan §6). It does not mention that
`apps/api/prisma/schema.prisma` already contains a separate, substantial engine:

- `Mission`, `MissionCompetencyState`, `WeeklyPlan`, `PlanItem`, `MissionCheckIn`, `CareerGoal` —
  a goal-driven weekly-planning system with its own stage machine (`diagnose` → ... ), competency
  scoring, and check-ins.
- `LearningSource`, `LearningHighlight`, `LearningEvidence`, `ReadwiseConnection`,
  `ReadwiseSyncRun` — a Readwise-integrated highlight/evidence capture system, also unrelated to
  the plan.

Both engines are live, have dedicated NestJS modules (`missions/`, `career/`, `learning/`), and
have corresponding `apps/web` routes (`/missions`, `/career`, `/learning`). This is the exact
"product sprawl" the plan itself warns about (plan §0) — except the sprawl already exists and
predates this redesign, rather than being a temptation to introduce.

Two options were considered:
1. **Consolidate** — fold Mission/WeeklyPlan/PlanItem into the new Learning Engine's data model
   (e.g. treat `PlanItem` as a `ReviewState`-schedulable object) as part of Gate 1/2.
2. **Coexist** — build the FSRS review loop and Today queue as an additive layer that aggregates
   from both the new `ReviewState` system and the existing Mission/PlanItem system, deferring any
   consolidation.

Consolidation would require a schema migration touching many existing rows and modules before
Gate 1 or 2 can close, directly violating "no broad rewrites unless explicitly permitted" and
"one PR-sized task at a time." Coexistence lets the daily loop (plan §1) ship additively.

## Decision
The Mission engine is not rewritten, merged, or deprecated as part of this redesign. The Today
queue (MOM-032) is an **aggregator**: it reads from the new `ReviewState`/weakness-signal system
*and* from existing `Mission`/`PlanItem`/`Task`/`Reminder`/`JobApplication` deadlines, presenting
one prioritized list per the queue order in plan §6.1 (overdue reviews → due reviews → weakness
repair → curriculum next step → career deadlines → stretch practice). Mission/PlanItem items slot
into "curriculum next step" and "career deadlines" without their underlying tables changing.

Any future consolidation of Mission/PlanItem into the KnowledgeObject/ReviewState model is a
separate, explicitly-scoped, spike-gated initiative — not implied or scheduled by this ADR.

## Consequences
- MOM-032 (Today dashboard API) must query both systems and merge/rank results; it cannot assume
  `ReviewState` is the only source of "what's due."
- No migration is needed to ship Gate 2 (Learning Loop Complete) — `ReviewState` is additive.
- Existing `/missions`, `/career`, `/learning` routes and their NestJS modules continue to operate
  unmodified except where a task explicitly extends them (e.g. linking a Mission's `PlanItem` to a
  Today card).
- Reviewers should reject any PR that "cleans up" or merges Mission engine tables as a side effect
  of unrelated Learning Engine work — that is scope creep per the engineering invariants.

## Related
- `docs/agent/DECISIONS.MD` — D-006
- `docs/agent/BACKLOG.MD` — MOM-032 (Today dashboard API), Track E (Review & Learning Engine),
  Track J (Career Engine, which already overlaps Mission's `CareerGoal`/`JobApplication`)
