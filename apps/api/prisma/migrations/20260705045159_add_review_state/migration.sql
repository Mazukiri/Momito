-- CreateTable
CREATE TABLE "review_states" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" UUID NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "last_reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_states_user_id_due_idx" ON "review_states"("user_id", "due");

-- CreateIndex
CREATE UNIQUE INDEX "review_states_user_id_object_type_object_id_key" ON "review_states"("user_id", "object_type", "object_id");

-- AddForeignKey
ALTER TABLE "review_states" ADD CONSTRAINT "review_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ADR-0002 SPIKE-003: the Today queue's core query is
-- `WHERE user_id = ? AND due <= now() AND NOT suspended`. A partial index
-- (excluding suspended rows) serves that lookup more efficiently than the
-- plain (user_id, due) index above once suspended rows accumulate, and
-- Prisma's schema DSL can't express a WHERE clause on @@index, so it's added
-- here by hand instead.
CREATE INDEX "review_states_user_due_active_idx" ON "review_states"("user_id", "due") WHERE NOT "suspended";
