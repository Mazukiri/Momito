-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "interview_round_id" UUID;

-- CreateIndex
CREATE INDEX "reminders_interview_round_id_idx" ON "reminders"("interview_round_id");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_interview_round_id_fkey" FOREIGN KEY ("interview_round_id") REFERENCES "interview_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
