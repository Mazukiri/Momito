-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_application_id" UUID,
    "base_salary" DECIMAL(14,2),
    "bonus" DECIMAL(14,2),
    "equity_total" DECIMAL(14,2),
    "equity_years" INTEGER NOT NULL DEFAULT 4,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "location" TEXT,
    "visa_sponsored" BOOLEAN,
    "deadline" DATE,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_job_application_id_key" ON "offers"("job_application_id");

-- CreateIndex
CREATE INDEX "offers_user_id_idx" ON "offers"("user_id");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
