/*
  Warnings:

  - You are about to drop the column `page1_identitas` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `page2_dataKendaraan` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `page3_kelengkapan` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `page4_hasilInspeksi` on the `inspections` table. All the data in the column will be lost.
  - You are about to drop the column `page5_penilaian` on the `inspections` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inspections" DROP COLUMN "page1_identitas",
DROP COLUMN "page2_dataKendaraan",
DROP COLUMN "page3_kelengkapan",
DROP COLUMN "page4_hasilInspeksi",
DROP COLUMN "page5_penilaian",
ADD COLUMN     "detailedAssessment" JSONB,
ADD COLUMN     "equipmentChecklist" JSONB,
ADD COLUMN     "identityDetails" JSONB,
ADD COLUMN     "inspectionSummary" JSONB,
ADD COLUMN     "vehicleData" JSONB;
