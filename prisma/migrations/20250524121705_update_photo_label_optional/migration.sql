-- AlterTable
ALTER TABLE "inspection_photos" ALTER COLUMN "label" DROP NOT NULL,
ALTER COLUMN "label" SET DEFAULT 'Tambahan',
ALTER COLUMN "category" SET DEFAULT 'General';
