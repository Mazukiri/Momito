/*
  Warnings:

  - You are about to drop the `study_plan_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "study_plan_items" DROP CONSTRAINT "study_plan_items_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "study_plan_items" DROP CONSTRAINT "study_plan_items_user_id_fkey";

-- DropTable
DROP TABLE "study_plan_items";
