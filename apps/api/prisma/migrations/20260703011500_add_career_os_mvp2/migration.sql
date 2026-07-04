-- AlterTable: questions gain role/practice metadata.
ALTER TABLE "questions" ADD COLUMN "role_tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "questions" ADD COLUMN "area_tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "questions" ADD COLUMN "pattern_tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "questions" ADD COLUMN "estimated_minutes" INTEGER;
ALTER TABLE "questions" ADD COLUMN "rubric" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "questions" ADD COLUMN "importance" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: sessions gain role/job context.
ALTER TABLE "interview_sessions" ADD COLUMN "role_track_id" TEXT;
ALTER TABLE "interview_sessions" ADD COLUMN "area" TEXT;
ALTER TABLE "interview_sessions" ADD COLUMN "practice_mode" TEXT;
ALTER TABLE "interview_sessions" ADD COLUMN "job_application_id" UUID;

-- AlterTable: attempts gain richer review metadata.
ALTER TABLE "answer_attempts" ADD COLUMN "correctness" TEXT;
ALTER TABLE "answer_attempts" ADD COLUMN "confidence" INTEGER;
ALTER TABLE "answer_attempts" ADD COLUMN "time_spent_seconds" INTEGER;
ALTER TABLE "answer_attempts" ADD COLUMN "hint_used" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "answer_attempts" ADD COLUMN "rubric_score" DOUBLE PRECISION;
ALTER TABLE "answer_attempts" ADD COLUMN "needs_review" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "career_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_track_id" TEXT NOT NULL,
    "horizon" TEXT NOT NULL DEFAULT '6_months',
    "status" TEXT NOT NULL DEFAULT 'active',
    "target_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company" TEXT NOT NULL,
    "role_title" TEXT NOT NULL,
    "url" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "role_track_id" TEXT,
    "jd_text" TEXT,
    "applied_date" DATE,
    "deadline" DATE,
    "source" TEXT,
    "referral_name" TEXT,
    "visa_tag" TEXT,
    "h1b_count_last_year" INTEGER,
    "compensation_notes" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_application_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "event_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "type" TEXT NOT NULL DEFAULT 'study',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "role_track_id" TEXT,
    "area" TEXT,
    "topic_id" UUID,
    "job_application_id" UUID,
    "planned_for" TIMESTAMPTZ(6),
    "due_date" TIMESTAMPTZ(6),
    "recurrence" TEXT,
    "reminder_offset_minutes" INTEGER,
    "completed_at" TIMESTAMPTZ(6),
    "snoozed_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "job_application_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "last_triggered_at" TIMESTAMPTZ(6),
    "dismissed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_sources" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "external_id" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "url" TEXT,
    "source_type" TEXT NOT NULL,
    "category" TEXT,
    "summary" TEXT,
    "cover_image_url" TEXT,
    "readwise_url" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "learning_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_highlights" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_id" UUID,
    "readwise_highlight_id" INTEGER,
    "text" TEXT NOT NULL,
    "note" TEXT,
    "color" TEXT,
    "location" TEXT,
    "location_type" TEXT,
    "highlighted_at" TIMESTAMPTZ(6),
    "readwise_updated_at" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_at" TIMESTAMPTZ(6),
    "usefulness" TEXT,
    "role_track_id" TEXT,
    "area" TEXT,
    "topic_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "learning_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_evidence" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "role_track_id" TEXT,
    "area" TEXT,
    "topic_id" UUID,
    "source_id" UUID,
    "highlight_id" UUID,
    "task_id" UUID,
    "question_id" UUID,
    "job_application_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readwise_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "last_synced_at" TIMESTAMPTZ(6),
    "next_page_cursor" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "readwise_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readwise_sync_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'running',
    "books_processed" INTEGER NOT NULL DEFAULT 0,
    "highlights_processed" INTEGER NOT NULL DEFAULT 0,
    "deleted_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "readwise_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_importance_idx" ON "questions"("importance");
CREATE INDEX "interview_sessions_role_track_id_idx" ON "interview_sessions"("role_track_id");
CREATE INDEX "interview_sessions_job_application_id_idx" ON "interview_sessions"("job_application_id");
CREATE INDEX "answer_attempts_needs_review_idx" ON "answer_attempts"("needs_review");
CREATE UNIQUE INDEX "career_goals_user_id_role_track_id_key" ON "career_goals"("user_id", "role_track_id");
CREATE INDEX "career_goals_user_id_idx" ON "career_goals"("user_id");
CREATE INDEX "career_goals_status_idx" ON "career_goals"("status");
CREATE INDEX "job_applications_user_id_idx" ON "job_applications"("user_id");
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");
CREATE INDEX "job_applications_role_track_id_idx" ON "job_applications"("role_track_id");
CREATE INDEX "job_applications_deadline_idx" ON "job_applications"("deadline");
CREATE INDEX "job_events_user_id_idx" ON "job_events"("user_id");
CREATE INDEX "job_events_job_application_id_idx" ON "job_events"("job_application_id");
CREATE INDEX "job_events_event_at_idx" ON "job_events"("event_at");
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_type_idx" ON "tasks"("type");
CREATE INDEX "tasks_role_track_id_idx" ON "tasks"("role_track_id");
CREATE INDEX "tasks_area_idx" ON "tasks"("area");
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");
CREATE INDEX "tasks_planned_for_idx" ON "tasks"("planned_for");
CREATE INDEX "reminders_user_id_idx" ON "reminders"("user_id");
CREATE INDEX "reminders_status_idx" ON "reminders"("status");
CREATE INDEX "reminders_due_at_idx" ON "reminders"("due_at");
CREATE INDEX "reminders_task_id_idx" ON "reminders"("task_id");
CREATE INDEX "reminders_job_application_id_idx" ON "reminders"("job_application_id");
CREATE UNIQUE INDEX "learning_sources_user_id_external_id_key" ON "learning_sources"("user_id", "external_id");
CREATE INDEX "learning_sources_user_id_idx" ON "learning_sources"("user_id");
CREATE INDEX "learning_sources_source_type_idx" ON "learning_sources"("source_type");
CREATE UNIQUE INDEX "learning_highlights_user_id_readwise_highlight_id_key" ON "learning_highlights"("user_id", "readwise_highlight_id");
CREATE INDEX "learning_highlights_user_id_idx" ON "learning_highlights"("user_id");
CREATE INDEX "learning_highlights_source_id_idx" ON "learning_highlights"("source_id");
CREATE INDEX "learning_highlights_role_track_id_idx" ON "learning_highlights"("role_track_id");
CREATE INDEX "learning_highlights_area_idx" ON "learning_highlights"("area");
CREATE INDEX "learning_highlights_topic_id_idx" ON "learning_highlights"("topic_id");
CREATE INDEX "learning_highlights_reviewed_at_idx" ON "learning_highlights"("reviewed_at");
CREATE INDEX "learning_evidence_user_id_idx" ON "learning_evidence"("user_id");
CREATE INDEX "learning_evidence_role_track_id_idx" ON "learning_evidence"("role_track_id");
CREATE INDEX "learning_evidence_area_idx" ON "learning_evidence"("area");
CREATE INDEX "learning_evidence_topic_id_idx" ON "learning_evidence"("topic_id");
CREATE INDEX "learning_evidence_occurred_at_idx" ON "learning_evidence"("occurred_at");
CREATE UNIQUE INDEX "readwise_connections_user_id_key" ON "readwise_connections"("user_id");
CREATE INDEX "readwise_sync_runs_user_id_idx" ON "readwise_sync_runs"("user_id");
CREATE INDEX "readwise_sync_runs_started_at_idx" ON "readwise_sync_runs"("started_at");

-- AddForeignKey
ALTER TABLE "career_goals" ADD CONSTRAINT "career_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_sources" ADD CONSTRAINT "learning_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_highlights" ADD CONSTRAINT "learning_highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_highlights" ADD CONSTRAINT "learning_highlights_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "learning_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_highlights" ADD CONSTRAINT "learning_highlights_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "learning_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_highlight_id_fkey" FOREIGN KEY ("highlight_id") REFERENCES "learning_highlights"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "readwise_connections" ADD CONSTRAINT "readwise_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "readwise_sync_runs" ADD CONSTRAINT "readwise_sync_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
