/*
  Warnings:

  - You are about to drop the `ClozeBlank` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClozeBlank" DROP CONSTRAINT "ClozeBlank_questionId_fkey";

-- DropTable
DROP TABLE "ClozeBlank";
