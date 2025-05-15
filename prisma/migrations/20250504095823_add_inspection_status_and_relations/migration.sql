/*
  Warnings:

  - You are about to drop the column `nftAssetId` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `reportHash` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `reportPdfUrl` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `submittedByUserId` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `transactionHash` on the `inspections` table. All the data in the column will be lost.
  - The `photoPaths` column on the `inspections` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[nft_asset_id]` on the table `inspections` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[blockchain_tx_hash]` on the table `inspections` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'ARCHIVING', 'ARCHIVED', 'FAIL_ARCHIVE', 'DEACTIVATED');

-- DropForeignKey
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_submittedByUserId_fkey";

-- DropIndex
DROP INDEX "inspections_nftAssetId_key";

-- DropIndex
DROP INDEX "inspections_submittedByUserId_idx";

-- AlterTable
ALTER TABLE "inspections" DROP COLUMN "nftAssetId",
DROP COLUMN "reportHash",
DROP COLUMN "reportPdfUrl",
DROP COLUMN "submittedByUserId",
DROP COLUMN "transactionHash",
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "blockchain_tx_hash" VARCHAR(255),
ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "inspector_id" TEXT,
ADD COLUMN     "nft_asset_id" VARCHAR(255),
ADD COLUMN     "pdf_file_hash" VARCHAR(255),
ADD COLUMN     "reviewer_id" TEXT,
ADD COLUMN     "status" "InspectionStatus" NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "url_pdf" VARCHAR(255),
DROP COLUMN "photoPaths",
ADD COLUMN     "photoPaths" JSONB[] DEFAULT ARRAY[]::JSONB[];

-- CreateIndex
CREATE UNIQUE INDEX "inspections_nft_asset_id_key" ON "inspections"("nft_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_blockchain_tx_hash_key" ON "inspections"("blockchain_tx_hash");

-- CreateIndex
CREATE INDEX "inspections_inspector_id_idx" ON "inspections"("inspector_id");

-- CreateIndex
CREATE INDEX "inspections_reviewer_id_idx" ON "inspections"("reviewer_id");

-- CreateIndex
CREATE INDEX "inspections_status_idx" ON "inspections"("status");

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
