/*
  Warnings:

  - You are about to drop the `kota_cabang_inspeksi` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "kota_cabang_inspeksi";

-- CreateTable
CREATE TABLE "inspection_branch_city" (
    "id" TEXT NOT NULL,
    "namaKota" TEXT NOT NULL,
    "kodeKota" VARCHAR(3) NOT NULL,

    CONSTRAINT "inspection_branch_city_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspection_branch_city_namaKota_key" ON "inspection_branch_city"("namaKota");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_branch_city_kodeKota_key" ON "inspection_branch_city"("kodeKota");
