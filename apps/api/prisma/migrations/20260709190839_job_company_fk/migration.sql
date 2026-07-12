-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "company_id" UUID;

-- CreateIndex
CREATE INDEX "job_applications_company_id_idx" ON "job_applications"("company_id");

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MOM-122 (D-017): backfill company_id by exact case-insensitive name match against
-- catalog names that are UNIQUE (Company.name has no unique constraint, so the
-- HAVING guard avoids ambiguous links). Idempotent (fills only NULLs); non-matches
-- stay null and keep rendering their free-text company. Safe on fresh + existing DBs.
UPDATE "job_applications" ja
SET "company_id" = c.id
FROM "companies" c
WHERE ja."company_id" IS NULL
  AND lower(trim(ja."company")) = lower(trim(c."name"))
  AND lower(trim(c."name")) IN (
    SELECT lower(trim("name")) FROM "companies" GROUP BY lower(trim("name")) HAVING count(*) = 1
  );
