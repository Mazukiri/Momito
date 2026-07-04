-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN "mission_id" UUID;
ALTER TABLE "tasks" ADD COLUMN "mission_id" UUID;
ALTER TABLE "learning_evidence" ADD COLUMN "mission_id" UUID;

-- CreateTable
CREATE TABLE "missions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "stage" TEXT NOT NULL DEFAULT 'diagnose',
    "role_track_id" TEXT NOT NULL,
    "career_goal_id" UUID,
    "job_application_id" UUID,
    "target_date" DATE,
    "weekly_hours" INTEGER NOT NULL DEFAULT 8,
    "success_definition" TEXT,
    "diagnosis_summary" TEXT,
    "active_plan_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_competency_states" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "role_track_id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "target_level" INTEGER NOT NULL DEFAULT 3,
    "current_level" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "rationale" TEXT,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "last_evidence_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mission_competency_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "focus_summary" TEXT,
    "generated_from_diagnosis" TEXT,
    "total_planned_hours" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "role_track_id" TEXT,
    "area" TEXT,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 45,
    "expected_artifact" TEXT,
    "scheduled_for" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_check_ins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "wins" TEXT,
    "blockers" TEXT,
    "adjustments" TEXT,
    "check_in_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "missions_active_plan_id_key" ON "missions"("active_plan_id");
CREATE INDEX "missions_user_id_idx" ON "missions"("user_id");
CREATE INDEX "missions_stage_idx" ON "missions"("stage");
CREATE INDEX "missions_role_track_id_idx" ON "missions"("role_track_id");
CREATE INDEX "missions_career_goal_id_idx" ON "missions"("career_goal_id");
CREATE INDEX "missions_job_application_id_idx" ON "missions"("job_application_id");
CREATE UNIQUE INDEX "mission_competency_states_mission_id_checklist_item_id_key" ON "mission_competency_states"("mission_id", "checklist_item_id");
CREATE INDEX "mission_competency_states_user_id_idx" ON "mission_competency_states"("user_id");
CREATE INDEX "mission_competency_states_mission_id_idx" ON "mission_competency_states"("mission_id");
CREATE INDEX "mission_competency_states_status_idx" ON "mission_competency_states"("status");
CREATE INDEX "mission_competency_states_area_idx" ON "mission_competency_states"("area");
CREATE INDEX "weekly_plans_user_id_idx" ON "weekly_plans"("user_id");
CREATE INDEX "weekly_plans_mission_id_idx" ON "weekly_plans"("mission_id");
CREATE INDEX "weekly_plans_status_idx" ON "weekly_plans"("status");
CREATE INDEX "weekly_plans_week_start_idx" ON "weekly_plans"("week_start");
CREATE INDEX "plan_items_user_id_idx" ON "plan_items"("user_id");
CREATE INDEX "plan_items_plan_id_idx" ON "plan_items"("plan_id");
CREATE INDEX "plan_items_mission_id_idx" ON "plan_items"("mission_id");
CREATE INDEX "plan_items_status_idx" ON "plan_items"("status");
CREATE INDEX "plan_items_scheduled_for_idx" ON "plan_items"("scheduled_for");
CREATE INDEX "mission_check_ins_user_id_idx" ON "mission_check_ins"("user_id");
CREATE INDEX "mission_check_ins_mission_id_idx" ON "mission_check_ins"("mission_id");
CREATE INDEX "mission_check_ins_check_in_at_idx" ON "mission_check_ins"("check_in_at");
CREATE INDEX "interview_sessions_mission_id_idx" ON "interview_sessions"("mission_id");
CREATE INDEX "tasks_mission_id_idx" ON "tasks"("mission_id");
CREATE INDEX "learning_evidence_mission_id_idx" ON "learning_evidence"("mission_id");

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_career_goal_id_fkey" FOREIGN KEY ("career_goal_id") REFERENCES "career_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_active_plan_id_fkey" FOREIGN KEY ("active_plan_id") REFERENCES "weekly_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mission_competency_states" ADD CONSTRAINT "mission_competency_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mission_competency_states" ADD CONSTRAINT "mission_competency_states_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "weekly_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mission_check_ins" ADD CONSTRAINT "mission_check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mission_check_ins" ADD CONSTRAINT "mission_check_ins_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
