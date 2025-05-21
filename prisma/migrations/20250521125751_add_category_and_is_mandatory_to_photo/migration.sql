-- AlterTable
ALTER TABLE "inspection_photos" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "isMandatory" BOOLEAN NOT NULL DEFAULT false;
