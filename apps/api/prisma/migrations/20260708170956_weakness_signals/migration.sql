-- AlterTable
ALTER TABLE "answer_attempts" ADD COLUMN     "area" TEXT,
ADD COLUMN     "role_track_id" TEXT;

-- CreateTable
CREATE TABLE "weakness_signals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "signal_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role_track_id" TEXT,
    "area" TEXT,
    "job_application_id" UUID,
    "severity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "last_signal_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "weakness_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weakness_signals_user_id_status_idx" ON "weakness_signals"("user_id", "status");

-- CreateIndex
CREATE INDEX "weakness_signals_job_application_id_idx" ON "weakness_signals"("job_application_id");

-- CreateIndex
CREATE INDEX "weakness_signals_role_track_id_area_idx" ON "weakness_signals"("role_track_id", "area");

-- CreateIndex
CREATE INDEX "answer_attempts_user_id_area_idx" ON "answer_attempts"("user_id", "area");

-- AddForeignKey
ALTER TABLE "weakness_signals" ADD CONSTRAINT "weakness_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weakness_signals" ADD CONSTRAINT "weakness_signals_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
