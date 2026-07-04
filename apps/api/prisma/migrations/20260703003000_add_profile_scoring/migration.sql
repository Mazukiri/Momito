-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "github_url" TEXT,
    "linkedin_url" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "experience" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "projects" JSONB NOT NULL DEFAULT '[]',
    "raw_cv_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_label" TEXT NOT NULL,
    "role_template" TEXT NOT NULL,
    "jd_text" TEXT,
    "skills_match" DOUBLE PRECISION NOT NULL,
    "project_quality" DOUBLE PRECISION NOT NULL,
    "experience_depth" DOUBLE PRECISION NOT NULL,
    "presentation" DOUBLE PRECISION NOT NULL,
    "skills_gaps" JSONB NOT NULL DEFAULT '[]',
    "project_gaps" JSONB NOT NULL DEFAULT '[]',
    "experience_gaps" JSONB NOT NULL DEFAULT '[]',
    "presentation_gaps" JSONB NOT NULL DEFAULT '[]',
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "profiles_user_id_idx" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "profile_scores_user_id_idx" ON "profile_scores"("user_id");

-- CreateIndex
CREATE INDEX "profile_scores_profile_id_idx" ON "profile_scores"("profile_id");

-- CreateIndex
CREATE INDEX "profile_scores_target_id_idx" ON "profile_scores"("target_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_scores" ADD CONSTRAINT "profile_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_scores" ADD CONSTRAINT "profile_scores_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
