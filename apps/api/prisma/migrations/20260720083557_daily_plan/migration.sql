-- CreateTable
CREATE TABLE "daily_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "capacity_minutes" INTEGER NOT NULL DEFAULT 90,
    "generator_inputs" JSONB NOT NULL DEFAULT '{}',
    "hidden_count" INTEGER NOT NULL DEFAULT 0,
    "committed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_plan_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "target_href" TEXT NOT NULL,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "skip_reason" TEXT,
    "target_count" INTEGER NOT NULL DEFAULT 1,
    "progress_count" INTEGER NOT NULL DEFAULT 0,
    "object_type" TEXT,
    "object_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_plans_user_id_status_idx" ON "daily_plans"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_plans_user_id_plan_date_key" ON "daily_plans"("user_id", "plan_date");

-- CreateIndex
CREATE INDEX "daily_plan_items_user_id_status_idx" ON "daily_plan_items"("user_id", "status");

-- CreateIndex
CREATE INDEX "daily_plan_items_plan_id_idx" ON "daily_plan_items"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_plan_items_plan_id_slot_key" ON "daily_plan_items"("plan_id", "slot");

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
