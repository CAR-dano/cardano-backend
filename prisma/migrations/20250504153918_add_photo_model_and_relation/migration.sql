/*
  Warnings:

  - You are about to drop the column `photoPaths` on the `inspections` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('FIXED', 'DYNAMIC', 'DOCUMENT');

-- AlterTable
ALTER TABLE "inspections" DROP COLUMN "photoPaths";

-- CreateTable
CREATE TABLE "inspection_photos" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "originalLabel" TEXT NOT NULL,
    "needAttention" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_photos_inspectionId_idx" ON "inspection_photos"("inspectionId");

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
