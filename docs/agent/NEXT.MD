# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).

## Current state

The core learning loop is substantially wired:

1. Answer submission can store self-rating and reflection metadata.
2. Self-rated answers update `ReviewState` through FSRS scheduling.
3. Due reviews appear on `/today`.
4. Inline review actions can reschedule due items.
5. `spaced_review` session creation now pulls due `ReviewState` question IDs in due order.
6. The `/today` page already renders one priority-ranked queue that interleaves reviews, recommendations, and reminders.

## Last completed task

**Spaced review frontend/backend handoff** - completed 2026-07-05.

`sessionType: "spaced_review"` now selects due, non-suspended question review states ordered by `due`, capped by `questionCount`, while preserving explicit `questionIds` as an override. The frontend no longer sends every due question ID; it previews due reviews and lets the API choose the authoritative ordered set.

## Safest next task

**Backlog reality cleanup / final safe inspection.**

Goal: inspect remaining `BACKLOG.MD` READY/BLOCKED items against the current repo and update stale statuses only where the implementation is already present. Do not implement migration/spike-gated work.

Constraints:
- No schema or migration work.
- No AI SDK work.
- No external API/import work.
- No content batches unless a concrete target is still short.
- Prefer documentation/status cleanup over code if remaining items are already implemented.
