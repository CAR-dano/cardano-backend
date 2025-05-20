/*
  Warnings:

  - You are about to drop the column `part` on the `inspection_change_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inspection_change_logs" DROP COLUMN "part",
ADD COLUMN     "subsubfieldname" TEXT;
