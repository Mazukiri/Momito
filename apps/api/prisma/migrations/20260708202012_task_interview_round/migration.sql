-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "interview_round_id" UUID;

-- CreateIndex
CREATE INDEX "tasks_interview_round_id_idx" ON "tasks"("interview_round_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_interview_round_id_fkey" FOREIGN KEY ("interview_round_id") REFERENCES "interview_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
