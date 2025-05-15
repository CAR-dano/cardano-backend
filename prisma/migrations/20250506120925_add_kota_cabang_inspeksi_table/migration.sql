-- CreateTable
CREATE TABLE "kota_cabang_inspeksi" (
    "id" TEXT NOT NULL,
    "namaKota" TEXT NOT NULL,
    "kodeKota" VARCHAR(3) NOT NULL,

    CONSTRAINT "kota_cabang_inspeksi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kota_cabang_inspeksi_namaKota_key" ON "kota_cabang_inspeksi"("namaKota");

-- CreateIndex
CREATE UNIQUE INDEX "kota_cabang_inspeksi_kodeKota_key" ON "kota_cabang_inspeksi"("kodeKota");
