/*
  Warnings:

  - A unique constraint covering the columns `[pretty_id]` on the table `inspections` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pretty_id` to the `inspections` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "pretty_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "inspections_pretty_id_key" ON "inspections"("pretty_id");
