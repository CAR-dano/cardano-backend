/*
  Warnings:

  - The values [SUBMITTED,REJECTED] on the enum `InspectionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InspectionStatus_new" AS ENUM ('NEED_REVIEW', 'APPROVED', 'ARCHIVING', 'ARCHIVED', 'FAIL_ARCHIVE', 'DEACTIVATED');
ALTER TABLE "inspections" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "inspections" ALTER COLUMN "status" TYPE "InspectionStatus_new" USING ("status"::text::"InspectionStatus_new");
ALTER TYPE "InspectionStatus" RENAME TO "InspectionStatus_old";
ALTER TYPE "InspectionStatus_new" RENAME TO "InspectionStatus";
DROP TYPE "InspectionStatus_old";
ALTER TABLE "inspections" ALTER COLUMN "status" SET DEFAULT 'NEED_REVIEW';
COMMIT;

-- AlterTable
ALTER TABLE "inspections" ALTER COLUMN "status" SET DEFAULT 'NEED_REVIEW';
