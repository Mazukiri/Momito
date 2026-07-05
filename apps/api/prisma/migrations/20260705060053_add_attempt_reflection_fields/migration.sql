-- AlterTable
ALTER TABLE "answer_attempts" ADD COLUMN     "complexity" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "miss_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reflection_note" TEXT;
