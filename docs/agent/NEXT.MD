# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).

## Current state

This session closed out essentially every remaining non-credential-gated item in the
backlog:

1. Task/StudyPlanItem consolidation (MOM-075/076/077).
2. The full Story Bank feature, schema through rehearsal sessions (MOM-063→067, Track H
   complete).
3. A content gap fix (CS Fundamentals 149→150) and ~20 stale backlog statuses corrected
   across multiple sweeps.
4. A designed + implemented (but execution-untested against real infra) weekly encrypted
   backup workflow (MOM-087).
5. A holistic smoke test confirming every major API endpoint still returns 200 after all
   of the above (dashboard, tasks, reminders, reviews, recommendations, stories, career,
   jobs, learning, content, DSA progress, health).

## Standing approval

The user has granted blanket approval to cross the D-004 human-approval gate for schema
migrations for the remainder of the plan. This does **not** extend to items blocked on
external credentials this agent does not hold.

## Hard-won lessons this session (read before any future migration)

1. `prisma migrate dev --create-only` can apply itself immediately instead of just staging
   the file — confirmed twice. Always run `prisma migrate status` right after, before
   editing the generated SQL.
2. **Never hand-edit an already-applied migration's `.sql` file.** It breaks Prisma's
   checksum tracking; the only fix Prisma offers is a full destructive `migrate reset`. Fix
   forward with a new migration instead.
3. When a shell command pipes data through one program while also needing to feed that
   same program a secret (e.g. `pg_dump | gpg --passphrase-fd 0 ... <<< "$SECRET"`), the
   secret and the piped data collide on fd 0. Use a different fd (e.g. `--passphrase-fd 3`
   + `3<<<`) — and if you can't test the real command, extract the exact fd pattern into a
   standalone test with fake data before trusting it.

## What's left — genuinely blocked, not avoided

1. **Credentials this agent does not hold:**
   - MOM-021 (deploy: Vercel/Render/Neon accounts)
   - MOM-068 through MOM-074 (AI feedback engine: needs a real Anthropic API key to verify
     the SDK spike against — Track I, Gate 4)
   - MOM-049 (LeetCode import: a judgment call, not a hard credential block — see below)
2. **Infra this agent can't provision in this sandbox:**
   - MOM-088 (Lighthouse + accessibility pass — needs a real browser; no browser-automation
     tool available here)
3. **Deliberately not attempted, disclosed as a judgment call, not a hard block:**
   - MOM-049 — scraping/calling a third-party GraphQL API without an explicit go-ahead is a
     different risk class than writing original seed content. If the user wants this
     attempted, say so explicitly.
4. **Depends on #1 being resolved:**
   - MOM-090 (final golden-path verification) — everything reachable without Gate 4 (AI
     feedback) has effectively been verified incrementally throughout this session's many
     live round trips plus the final holistic smoke test above; a "final" pass isn't
     meaningfully more final until Gate 4 is either implemented or explicitly descoped by
     the user.

## If resuming autonomously

There is no further non-credential-gated, non-infra-blocked work items left in
`BACKLOG.md` as of this pass. The next productive step requires one of:
- The user provides credentials (Anthropic API key, Vercel/Render/Neon accounts, cloud
  storage for MOM-087's long-term-retention follow-up) — implement the matching track.
- The user explicitly asks for MOM-049 (LeetCode import) despite the judgment call above.
- The user asks for a new feature not yet in `BACKLOG.md`.
- The user points out something broken that this session's smoke tests didn't catch.

Absent any of those, re-reading the entire `BACKLOG.md` top to bottom once more without a
new signal would mostly re-verify what this session already confirmed — worth doing if
significant time has passed and drift is possible, but not a distinct next task right now.
