-- CreateIndex
CREATE INDEX "answer_attempts_user_id_created_at_idx" ON "answer_attempts"("user_id", "created_at");
