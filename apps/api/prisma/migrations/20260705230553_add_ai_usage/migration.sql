-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_user_id_day_key" ON "ai_usage"("user_id", "day");

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
