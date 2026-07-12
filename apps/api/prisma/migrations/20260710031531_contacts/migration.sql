-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_application_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "linkedin_url" TEXT,
    "company" TEXT,
    "relationship" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_user_id_idx" ON "contacts"("user_id");

-- CreateIndex
CREATE INDEX "contacts_job_application_id_idx" ON "contacts"("job_application_id");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MOM-117 backfill: promote each job's free-text referral_name into a Contact
-- (relationship 'referrer', linked to that job). DISTINCT ON collapses the same
-- name per user to one row (earliest job wins) so a duplicated referral doesn't
-- create duplicate contacts; NOT EXISTS makes a re-run a no-op. gen_random_uuid()
-- is built into PostgreSQL 13+.
INSERT INTO "contacts" ("id", "user_id", "job_application_id", "name", "relationship", "created_at", "updated_at")
SELECT gen_random_uuid(), s."user_id", s."job_application_id", s."name", 'referrer', now(), now()
FROM (
  SELECT DISTINCT ON (ja."user_id", lower(trim(ja."referral_name")))
    ja."user_id", ja."id" AS "job_application_id", trim(ja."referral_name") AS "name"
  FROM "job_applications" ja
  WHERE ja."referral_name" IS NOT NULL AND trim(ja."referral_name") <> ''
  ORDER BY ja."user_id", lower(trim(ja."referral_name")), ja."created_at" ASC
) s
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."user_id" = s."user_id" AND lower(trim(c."name")) = lower(trim(s."name"))
);
