-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "metrics" TEXT,
    "competency_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "follow_up_questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_companies" (
    "story_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,

    CONSTRAINT "story_companies_pkey" PRIMARY KEY ("story_id","company_id")
);

-- CreateTable
CREATE TABLE "story_prompts" (
    "id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stories_user_id_idx" ON "stories"("user_id");

-- CreateIndex
CREATE INDEX "story_companies_company_id_idx" ON "story_companies"("company_id");

-- CreateIndex
CREATE INDEX "story_prompts_question_id_idx" ON "story_prompts"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_prompts_story_id_question_id_key" ON "story_prompts"("story_id", "question_id");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_companies" ADD CONSTRAINT "story_companies_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_companies" ADD CONSTRAINT "story_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_prompts" ADD CONSTRAINT "story_prompts_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_prompts" ADD CONSTRAINT "story_prompts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
