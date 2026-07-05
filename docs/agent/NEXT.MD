# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> Implementers touch only what "Allowed files" permits. Full backlog: `BACKLOG.md`.
> See `LOG.MD` for full history. As of this update: Gate 3 (Data Depth) content is
> substantially complete — DSA 149/150, CS Fundamentals 149/150, System Design 24/25,
> Behavioral 60/60, Companies 20/20, Role Tracks 10 (covers all 8 plan categories). The
> practice hub, DSA ladder UI, content coverage dashboard, system design editor, and now
> the CodeMirror code editor for DSA/coding answers (MOM-035) are all shipped. Gate 2
> (Learning Loop)'s FSRS scheduling remains blocked on the ReviewState migration
> (human-approval gated, D-004).

---

## MOM-038 — Answer panel by question type

**Status:** READY
**Owner:** CLAUDE or CODEX
**Depends on:** MOM-035 (done), MOM-057 (done)

### Goal
`AnswerForm.tsx` currently branches internally between three answer surfaces (plain
textarea, system-design markdown editor + preview, CodeMirror code editor) via inline
conditionals (`isSystemDesign`, `isCodeAnswer`). Extract each surface into its own
dedicated component so the branching lives in one small dispatcher instead of growing
inside `AnswerForm` every time a new question-type-specific editor is added.

### User-visible outcome
None — this is a refactor. Behavior for every question type (textarea, system design
template/preview, DSA/cpp code editor) must be pixel-for-pixel identical before and after.

### Suggested shape
- `apps/web/app/components/session/answer-panels/TextAnswerPanel.tsx` — the plain
  textarea, used for every type not covered below.
- `apps/web/app/components/session/answer-panels/SystemDesignAnswerPanel.tsx` — wraps the
  existing template-insert button, preview toggle, and `Markdown`/textarea swap currently
  inline in `AnswerForm`.
- `apps/web/app/components/session/answer-panels/CodeAnswerPanel.tsx` — wraps the
  `next/dynamic`-loaded `CodeEditor` (keep the `ssr: false` dynamic import here).
- `AnswerForm.tsx` keeps the timer, question header/badges, self-rating, and
  previous/submit controls, and dispatches to one of the three panels based on
  `currentQuestion.question.type`.

### Allowed files
- `apps/web/app/components/session/AnswerForm.tsx`
- New files under `apps/web/app/components/session/answer-panels/`
- `apps/web/app/components/CodeEditor.tsx` (only if the dynamic-import wrapping moves,
  not the CodeMirror internals)

### Forbidden changes
- Do not change the API/DTOs or `answerText`'s string shape.
- Do not change the visual output or interaction behavior for any question type — this is
  a structural refactor, not a redesign.
- Do not touch `apps/web/app/lib/system-design-template.ts` contents.

### Acceptance criteria
- `pnpm --filter @momito/web build/lint/typecheck` all pass.
- Manually verified: a `dsa` question still shows the code editor with language picker; a
  `system_design` question still shows the template-insert button + preview toggle; every
  other type still shows the plain textarea. Submit/previous/self-rating/timer all still
  work.

### Verification
```bash
pnpm --filter @momito/web build
pnpm --filter @momito/web lint
pnpm --filter @momito/web typecheck
```

### Manual test
Walk through a practice session containing at least one `dsa`, one `system_design`, and
one plain-textarea-type question; confirm each renders its correct panel and that
submitting an answer for each works end-to-end.

### Rollback
`git checkout -- apps/web/app/components/session`

### Commit message
```text
refactor(web): split AnswerForm into per-question-type answer panels
```

### After completing
1. Append an entry to `LOG.MD`.
2. Set `NEXT.MD` to the next unblocked backlog item — check `BACKLOG.MD` for what remains
   unblocked (e.g. MOM-039 reflection panel, MOM-029/030/031/032 review/FSRS-adjacent
   pieces that don't require the ReviewState migration, MOM-088 Lighthouse/a11y pass).
3. Release any locks in `LOCKS.MD`.
