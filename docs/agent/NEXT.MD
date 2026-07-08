# NEXT

> The single active PR-sized task. Only one at a time (Engineering Invariant 2.4.1).

## Active initiative (2026-07-08): CareerOS transformation

New plan `docs/plans/MOMITO_CAREEROS_PLAN.md` — turn the study tool into a role-landing OS.
Thesis: the study loop closes; the career loop does not. Tracks **M–S / MOM-101…145** appended to
`BACKLOG.md` §4b. Owner decisions locked: (1) **close the study↔target loop first**; (2) résumé track
is **AI-first, dormant-until-key**; (3) **missions frozen** (D-015) — pipeline-driven loop primary, the
two readiness engines consolidate into one FSRS-grounded engine (MOM-129).

**Executing now — Phase 0 quick wins (schema-free, on branch `feat/careeros-phase-0`):**
MOM-101 (funnel card) → MOM-102 (auto-log status transition) → MOM-135 (gap→task) →
MOM-108 + MOM-134-lite (paste-JD capture + ATS coverage) → MOM-140-lite (stage-aware Today copy).
Then Phase 1 (loop closure): company FK + WeaknessSignal + interview rounds/debrief + grounded
company-scoped readiness + auto prep queue. Each schema task = DESIGN-doc PR then human-approved
implementer PR (D-004). New registries: SPIKE-009…015, ADR-0009…0012, D-011…D-015.

---

## Prior state (2026-07-07 session)

A second audit pass (three parallel research agents: docs/agent hygiene, API
production-readiness, web UX/quality) found and closed the highest-impact remaining gaps —
see Track L in `BACKLOG.md` for full detail (MOM-091 through MOM-100). Headlines:

1. **Dark mode was silently broken in `next dev`** (MOM-091) — root-caused via a compiled
   dev-vs-prod CSS diff, not guesswork. Fixed; live-verified with Playwright.
2. **Web Push notifications** (MOM-092), the user's explicit ask, shipped dormant-until-
   VAPID-keys (no third-party account needed — keys are self-generated).
3. API production hardening: graceful shutdown (MOM-093), real token revocation via
   `tokenVersion` (MOM-094, closes the single largest pre-existing security exposure), API
   linting wired into CI for the first time (MOM-095).
4. Web UX/accessibility polish (MOM-096): 401 auto-logout, debounced search + URL state,
   optimistic updates on the highest-frequency taps, labeled form controls, keyboard-
   reachable cards, dark-mode-legible badges, a live reminder badge, skeleton loading states.
5. Frontend test foundation (MOM-097) — `apps/web` had zero tests; now has 20 across the
   riskiest surfaces, plus one real bug caught in the test-writing process itself (a test-
   mock artifact, documented in the commit, not an app bug).
6. Verified (not just assumed) the `aiScore` 0–1 scale is consistent across every consumer
   (MOM-098) and closed a narrow AI-budget race condition (MOM-099).
7. Also reconciled the MOM-068–074 status contradiction between BACKLOG.md ("DONE") and this
   file ("blocked") — both were partially true; BACKLOG.md now says "DONE (scaffold) —
   VERIFICATION-BLOCKED on live key" for that whole track. Fixed a dangling ADR-0009
   citation (never existed) in SPIKE-002, and AGENTS.MD's wrong plan filename
   (`momito-redesign-v2.md` → `MOMITO_REDESIGN_PLAN_V2.md`). Added a superseded-notice
   header to root `REDESIGN_PLAN.MD` pointing at V2 + BACKLOG.md as the actual source of
   truth.

**Correction to a claim in this file's previous version:** it said "no browser-automation
tool available here" for MOM-088. That's no longer accurate — Playwright is usable in this
environment (used throughout this session for live verification and to build
`docs/tutorial/index.html`'s screenshots). MOM-088's Lighthouse audit specifically still
needs a *deployed* URL (Lighthouse audits a live origin, not `localhost` meaningfully for
production scoring), but a manual accessibility pass via Playwright/DOM inspection is
possible without a deploy — a chunk of that was done as part of MOM-096 (labels, keyboard
reachability, contrast), not exhaustively.

## Standing approval

The user has granted blanket approval to cross the D-004 human-approval gate for schema
migrations for the remainder of the plan. This does **not** extend to items blocked on
external credentials this agent does not hold.

## Hard-won lessons this session (read before any future migration or test-mocking)

1. `prisma migrate dev --create-only` can apply itself immediately instead of just staging
   the file — confirmed twice previously. Always run `prisma migrate status` right after,
   before editing the generated SQL.
2. **Never hand-edit an already-applied migration's `.sql` file.** It breaks Prisma's
   checksum tracking; the only fix Prisma offers is a full destructive `migrate reset`. Fix
   forward with a new migration instead.
3. On Windows, a running `nest start --watch` (or a stray compiled `dist/main` process) holds
   the Prisma query-engine `.dll.node` open, so `prisma generate` right after a migration
   fails with `EPERM: operation not permitted, rename ...`. Kill the node process holding it
   (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` to find it, `Stop-Process`) and
   retry — don't fight the lock, don't skip regenerating the client.
4. **A mocked `next/navigation` router/params object must be referentially stable across
   renders** if any effect's dependency array includes it — a mock like `useRouter: () =>
   ({push: vi.fn()})` returns a fresh object every call, which will silently retrigger any
   `useCallback`/`useEffect` chain depending on it, producing an infinite fetch loop that
   looks like a stuck-loading component. Memoize the mock object at module scope. (Caught
   writing the practice-session-page test this session — see MOM-097 / the test commit.)
5. Large uncommitted work can silently pile up across sessions. At the start of this
   session, `git status` revealed the *entire* prior session's Story Bank + AI grading +
   PWA + deploy-scaffolding + streak work (several thousand lines) had never been
   committed despite being tested and declared "done" in earlier LOG.MD entries. Recovered
   it in two honestly-labeled `recover:` commits before starting new work, splitting files
   that mixed prior uncommitted work with this session's own changes (temporarily reverting
   the new hunks, committing the recovered prior work, then reapplying). **Commit more
   often** — don't let a session's real, working, tested code sit uncommitted indefinitely.

## What's left — genuinely blocked, not avoided

1. **Credentials this agent does not hold:**
   - MOM-021 (deploy: Vercel/Render/Neon accounts)
   - MOM-068 through MOM-074 (AI feedback engine: needs a real Anthropic API key to verify
     the live grade/budget-exceeded/rendered-feedback paths — Track I, Gate 4; the no-key
     path is fully verified)
   - MOM-092 (Web Push: needs a real HTTPS deploy for the actual iOS install→subscribe→
     receive path — VAPID keys themselves need no third-party account and are already
     generated/working locally)
   - MOM-049 (LeetCode import: a judgment call, not a hard credential block — see below)
2. **Needs a real deployed origin, not just a local browser:**
   - MOM-088 (Lighthouse specifically — Playwright itself is available, see the correction
     above; a from-localhost Lighthouse run wouldn't reflect real production scores anyway)
3. **Deliberately not attempted, disclosed as a judgment call, not a hard block:**
   - MOM-049 — scraping/calling a third-party GraphQL API without an explicit go-ahead is a
     different risk class than writing original seed content. If the user wants this
     attempted, say so explicitly.
   - The V2 plan's `WeaknessSignal` model + `weakness_repair`/`mixed_interview` session
     types + content quality-gating (`qualityStatus`/provenance) were identified by this
     session's docs audit as vision the MOM backlog never picked up. Not started — this is
     a chunk of net-new feature depth, not a production-readiness gap, and deserves its own
     scoped plan if the user wants it built.
4. **Depends on #1 being resolved:**
   - MOM-090 (final golden-path verification) — everything reachable without Gate 1/4/6
     (deploy, AI live-key, production hardening) has been verified incrementally across two
     sessions' worth of live round trips; a "final" pass isn't meaningfully more final until
     those gates close.

## If resuming autonomously

No further non-credential-gated, non-deploy-blocked work items are left in `BACKLOG.md` as
of this pass. The next productive step requires one of:
- The user provides credentials (Anthropic API key, Vercel/Render/Neon accounts) — implement
  or verify the matching track.
- The user deploys the app (render.yaml/vercel.json are ready) — run MOM-088's Lighthouse
  pass and the real iOS push-notification check against the live HTTPS origin.
- The user explicitly asks for MOM-049 (LeetCode import) or the WeaknessSignal/content-
  quality-gating feature chunk despite the judgment calls above.
- The user asks for a new feature not yet in `BACKLOG.md`.
- The user points out something broken that this session's tests/live-verification didn't
  catch.

Absent any of those, re-reading `BACKLOG.md` top to bottom without a new signal would mostly
re-verify what these two sessions already confirmed.
