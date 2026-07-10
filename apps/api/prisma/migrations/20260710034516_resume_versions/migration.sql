-- CreateTable
CREATE TABLE "resume_versions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_application_id" UUID,
    "label" TEXT NOT NULL,
    "target_role_track_id" TEXT,
    "content_md" TEXT NOT NULL,
    "base_profile_snapshot" JSONB,
    "ai_suggestions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_versions_user_id_idx" ON "resume_versions"("user_id");

-- CreateIndex
CREATE INDEX "resume_versions_job_application_id_idx" ON "resume_versions"("job_application_id");

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
