/*
  Warnings:

  - You are about to drop the column `kodeKota` on the `inspection_branch_city` table. All the data in the column will be lost.
  - You are about to drop the column `namaKota` on the `inspection_branch_city` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[city]` on the table `inspection_branch_city` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `inspection_branch_city` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `city` to the `inspection_branch_city` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `inspection_branch_city` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `inspection_branch_city` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "inspection_branch_city_kodeKota_key";

-- DropIndex
DROP INDEX "inspection_branch_city_namaKota_key";

-- AlterTable
ALTER TABLE "inspection_branch_city" DROP COLUMN "kodeKota",
DROP COLUMN "namaKota",
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "code" VARCHAR(3) NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "inspection_branch_city_city_key" ON "inspection_branch_city"("city");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_branch_city_code_key" ON "inspection_branch_city"("code");
