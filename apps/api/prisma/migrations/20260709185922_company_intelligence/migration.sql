-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "comp_band" TEXT,
ADD COLUMN     "focus_areas" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "interview_process" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "role_track_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "sponsorship_status" TEXT;
