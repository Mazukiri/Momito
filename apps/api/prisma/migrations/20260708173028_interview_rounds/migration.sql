-- CreateTable
CREATE TABLE "interview_rounds" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_application_id" UUID NOT NULL,
    "round_type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER,
    "interviewer" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "debrief" TEXT,
    "areas_weak" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "miss_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interview_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_rounds_user_id_idx" ON "interview_rounds"("user_id");

-- CreateIndex
CREATE INDEX "interview_rounds_job_application_id_idx" ON "interview_rounds"("job_application_id");

-- CreateIndex
CREATE INDEX "interview_rounds_scheduled_at_idx" ON "interview_rounds"("scheduled_at");

-- AddForeignKey
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
