-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "branch_city_id" TEXT;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_branch_city_id_fkey" FOREIGN KEY ("branch_city_id") REFERENCES "inspection_branch_city"("id") ON DELETE SET NULL ON UPDATE CASCADE;
