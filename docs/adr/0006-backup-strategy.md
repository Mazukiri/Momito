# ADR-0006: Weekly encrypted database backup workflow

> Renumbered from 0004 → 0006 (2026-07-06): 0004 collided with the
> pre-existing `0004-no-copyrighted-problem-statements-in-seeds.md`. Content
> unchanged. (0005 is `0005-story-bank-schema.md`, renumbered in the same fix.)

## Status
**Designed and implemented (workflow inert until secrets are configured)** — 2026-07-06.
SPIKE (MOM-087's "Neon backup strategy" question) resolved without needing any real
Neon/hosting credentials, by choosing a design that only needs two secrets the user adds
later: a production database URL and a GPG passphrase.

**Verified locally (without pg_dump/pg_restore, which aren't installed in this
environment):** the encrypt/decrypt shell mechanics in `backup.yml` — specifically piping
data through `gpg --passphrase-fd 3 ... 3<<< "$PASSPHRASE"` — were tested standalone with
a fake multi-line file standing in for a `pg_dump` output, confirming byte-for-byte
round-trip fidelity. This caught and fixed a real bug in an earlier draft: the passphrase
was originally wired to fd 0 (`--passphrase-fd 0` + `<<<`), which collides with the piped
dump data also arriving on stdin (fd 0) — gpg would have silently misread the passphrase.
Moving the passphrase to fd 3 (`3<<<`) resolves the collision. The actual `pg_dump`/
`pg_restore` invocations against a real Postgres instance remain untested, since neither
binary is available in this sandbox and no real target database exists to test against —
that gap is disclosed, not hidden.

## Context
Plan §6 (Gate 6 — Production) calls for a weekly encrypted backup, but this agent has no
Neon account, no cloud storage credentials, and no way to test a backup against the real
production database. Any implementation must therefore be safe to merge and sit dormant
until the user provides real secrets — not something that half-works or produces
misleading "success" output against fake data.

## Decision
A single GitHub Actions workflow, `.github/workflows/backup.yml`:

1. **Trigger:** `workflow_dispatch` (manual, so the user can test it once secrets are
   added) **and** a weekly `schedule: cron` (Sunday 03:00 UTC), per the plan's "weekly"
   requirement.
2. **Secrets required (added by the user, not by this agent):**
   - `BACKUP_DATABASE_URL` — the production (Neon) connection string, ideally a read-only
     role scoped for backups only, not the app's main `DATABASE_URL`.
   - `BACKUP_GPG_PASSPHRASE` — a symmetric-encryption passphrase, stored somewhere safe
     (e.g. a password manager) — losing it means the backups become unrecoverable.
3. **Graceful no-op when secrets are absent:** the first step checks both secrets are set
   and exits `0` with a clear "skipped — secrets not configured" log line if not, instead
   of hard-failing every week and creating red-X noise for a genuinely-inert feature.
4. **Dump + encrypt:** `pg_dump --format=custom "$BACKUP_DATABASE_URL"` (custom format is
   smaller and supports selective restore) piped through `gpg --symmetric --batch
   --passphrase-fd 0`, producing one `.dump.gpg` file.
5. **Storage: GitHub Actions artifact, not external cloud storage.** Chose this
   deliberately to avoid requiring a *third* secret (S3/GCS credentials) this agent can't
   test either. `actions/upload-artifact` with `retention-days: 90` keeps roughly the last
   ~12 weekly backups before GitHub garbage-collects them. This is a real limitation
   (artifacts aren't a durable long-term archive) — documented below as a known gap, not
   hidden.
6. **Restore procedure documented, not automated** (see `docs/runbooks/backup-restore.md`)
   — a restore is a rare, high-stakes, human-judgment action (which environment, whether
   to overwrite live data) that should never be a one-click CI job.

## Consequences
- Merging this workflow is safe today: with no secrets configured, every scheduled run
  logs a skip and exits successfully (no red X, no attempted connection to a nonexistent
  database).
- Once the user adds the two secrets, `workflow_dispatch` lets them test a backup on
  demand before trusting the weekly schedule.
- **Known gap, not solved by this ADR:** 90-day artifact retention is not a long-term
  archival strategy. If durable long-term backups matter, MOM-087's natural follow-up is
  swapping the upload step for real object storage (S3/R2/GCS) once the user decides which
  provider and provides those credentials — the dump+encrypt steps stay unchanged either
  way.
- The backup contains the entire database (all users' data) encrypted at rest in the
  artifact; the GPG passphrase is the only thing standing between that artifact and
  plaintext user data — treat it as sensitive as the database credentials themselves.

## Related
- `.github/workflows/backup.yml` — the implementation.
- `docs/runbooks/backup-restore.md` — restore steps.
- `docs/agent/BACKLOG.md` — MOM-087.
