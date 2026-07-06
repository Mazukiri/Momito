# Restoring a Momito database backup

See `docs/adr/0006-backup-strategy.md` for why this is manual, not automated.

## Prerequisites

- `gpg` and `pg_restore`/`psql` (from `postgresql-client`) installed locally.
- The `BACKUP_GPG_PASSPHRASE` value used to encrypt the backup (stored wherever your team
  keeps secrets — this is not recoverable if lost).
- A target Postgres connection string. **Never restore directly onto the live production
  database without a separate verification step first** — restore into a fresh/staging
  database, verify it looks correct, and only then decide whether/how to promote it.

## Steps

1. Download the encrypted artifact from the GitHub Actions run
   (`Weekly Encrypted Backup` workflow → the run you want → Artifacts).

2. Decrypt it:
   ```sh
   gpg --decrypt --batch --passphrase-fd 0 --output momito-backup.dump <<< "$BACKUP_GPG_PASSPHRASE" momito-backup-<timestamp>.dump.gpg
   ```

3. Restore into a **target you're certain is not the live production database**:
   ```sh
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname "$TARGET_DATABASE_URL" momito-backup.dump
   ```
   `--clean --if-exists` drops existing objects in the target first — this is why the
   target must be a scratch/staging database, never production, unless you have
   deliberately decided this is a disaster-recovery restore and have already accepted
   losing whatever is currently in production.

4. Verify the restored data looks correct (spot-check a few tables, row counts, recent
   timestamps) before treating the restore as trustworthy.

5. Delete the decrypted `.dump` file when done — it's plaintext user data.

## If this is a genuine disaster-recovery restore (restoring onto production)

Stop and get a second person to confirm before running `pg_restore` against a production
connection string. This runbook intentionally does not provide a one-command "restore to
prod" path — that decision should never be made by a single person acting alone under
time pressure without a deliberate pause to confirm the target.
