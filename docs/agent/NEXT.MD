# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).

## Current state

The core learning loop is substantially wired:

1. Answer submission can store self-rating and reflection metadata.
2. Self-rated answers update `ReviewState` through FSRS scheduling.
3. Due reviews appear on `/today`.
4. Inline review actions can reschedule due items.
5. `spaced_review` session creation now pulls due `ReviewState` question IDs in due order.

## Last completed task

**Spaced review sessions** - completed 2026-07-05.

`sessionType: "spaced_review"` now selects due, non-suspended question review states ordered by `due`, capped by `questionCount`, while preserving explicit `questionIds` as an override.

## Safest next task

**Today unified priority queue inspection / implementation.**

Goal: inspect whether `/today` still renders separate review/recommendation/reminder/prep sections instead of one ranked queue. If it is still split, implement the smallest backend/frontend change that presents a single ordered daily queue without changing schema or adding AI/external services.

Constraints:
- No schema or migration work.
- No AI SDK work.
- No new content batches.
- Preserve existing due-review inline rating behavior.
- Keep tests focused on ordering and item shape.
