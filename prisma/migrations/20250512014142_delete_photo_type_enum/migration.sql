/*
  Warnings:

  - You are about to drop the column `type` on the `inspection_photos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inspection_photos" DROP COLUMN "type";

-- DropEnum
DROP TYPE "PhotoType";
