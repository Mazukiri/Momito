# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).
> Implementers touch only what "Allowed files" permits. Full backlog: `BACKLOG.md`.
> See `LOG.MD` for full history. As of this update: Gate 3 (Data Depth) content is
> substantially complete — DSA 149/150, CS Fundamentals 149/150, System Design 24/25,
> Behavioral 60/60, Companies 20/20, Role Tracks 10 (covers all 8 plan categories). The
> practice hub, DSA ladder UI, content coverage dashboard, and system design editor are
> all shipped. Gate 2 (Learning Loop)'s FSRS scheduling remains blocked on the
> ReviewState migration (human-approval gated, D-004).

---

## MOM-035 — CodeMirror editor (SPIKE + implementation)

**Status:** NEEDS_SPIKE → READY after spike
**Owner:** CLAUDE or CODEX
**Depends on:** none directly, but unblocks MOM-038 (answer panel by question type)

### Goal
DSA/coding questions currently use the same plain `<textarea>` as every other question
type in `AnswerForm` — no syntax highlighting, no language selection, no monospace-by-
default editing. Add a CodeMirror-based code editor for `dsa` (and optionally `cpp`)
question types, matching plan §7.2's practice engine UI expectations.

### Spike questions (answer before writing the real component)
1. Does `@codemirror/lang-javascript` / `@uiw/react-codemirror` (or similar) SSR cleanly
   under Next 16.2.9 + React 19 + Turbopack, or does it need `next/dynamic` with
   `ssr: false`? Verify with a throwaway page before wiring it into `AnswerForm`.
2. Bundle size impact — CodeMirror language packs can be large; check what a minimal
   multi-language setup (JS/TS/Python/C++/Java, the common DSA-interview languages) adds
   to the `/practice/session/[id]` route's JS payload.
3. Does the dark/light theme (MOM-013's `ThemeProvider`) need a matching CodeMirror theme
   switch, or is one dark-friendly theme acceptable initially?

### User-visible outcome
Answering a DSA question shows a real code editor (line numbers, syntax highlighting, a
language picker) instead of a plain textarea; answering everything else is unchanged.

### Allowed files
- `apps/web/package.json` (add the CodeMirror dependency/dependencies), `pnpm-lock.yaml`.
- New `apps/web/app/components/CodeEditor.tsx` (or similar).
- `apps/web/app/components/session/AnswerForm.tsx` — swap the textarea for the code
  editor only when `currentQuestion.question.type === 'dsa'` (and optionally `cpp`);
  every other type keeps the existing textarea/system-design-preview behavior untouched.

### Forbidden changes
- Do not change the plain-textarea behavior for non-DSA question types.
- Do not touch the API/DTOs — `answerText` is still just a string; the editor only
  changes how it's authored client-side.

### Acceptance criteria
- `pnpm --filter @momito/web build` succeeds with no SSR errors from the new dependency.
- A DSA question in a practice session shows a syntax-highlighted code editor.
- Bundle size increase is documented in the PR description (run `next build` before/after
  and compare the route's First Load JS).
- Existing session flow (submit, timer, self-rating) is unaffected for every question type.

### Verification
```bash
pnpm --filter @momito/web build
pnpm --filter @momito/web lint
pnpm --filter @momito/web typecheck
```

### Manual test
Start a practice session with a DSA question; confirm the editor renders, accepts input,
and submitting still works end-to-end (check the summary page shows the submitted code).

### Rollback
`git checkout -- apps/web/package.json apps/web/app/components` and revert the lockfile.

### Commit message
```text
feat(web): add CodeMirror editor for DSA/coding answers
```

### After completing
1. Append an entry to `LOG.MD`.
2. Set `NEXT.MD` to **MOM-038 — Answer panel by question type**, which can now
   distinguish DSA (code editor) / system_design (markdown template, already done in
   MOM-057) / everything else (plain textarea) more explicitly as its own component.
3. Release any locks in `LOCKS.MD`.
