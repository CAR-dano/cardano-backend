-- AlterTable
ALTER TABLE "users" ADD COLUMN     "inspection_branch_city_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_inspection_branch_city_id_fkey" FOREIGN KEY ("inspection_branch_city_id") REFERENCES "inspection_branch_city"("id") ON DELETE SET NULL ON UPDATE CASCADE;
