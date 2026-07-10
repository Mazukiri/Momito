-- AlterTable
ALTER TABLE "job_events" ADD COLUMN     "from_status" TEXT,
ADD COLUMN     "to_status" TEXT;

-- MOM-104 backfill: reconstruct the structured transition endpoints from the
-- machine-written MOM-102 title ("saved → applied"). Idempotent (from_status IS
-- NULL guard) and safe (both endpoints must be known statuses, so any stray or
-- hand-typed title is a no-op). The separator is the U+2192 arrow with spaces.
UPDATE "job_events"
SET "from_status" = split_part("title", ' → ', 1),
    "to_status"   = split_part("title", ' → ', 2)
WHERE "type" = 'status_change'
  AND "from_status" IS NULL
  AND split_part("title", ' → ', 1) IN ('saved','applied','oa','interview','onsite','offer','rejected','withdrawn')
  AND split_part("title", ' → ', 2) IN ('saved','applied','oa','interview','onsite','offer','rejected','withdrawn');
