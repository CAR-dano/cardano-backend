-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "vehiclePlateNumber" VARCHAR(15),
    "inspectionDate" TIMESTAMP(3),
    "overallRating" TEXT,
    "page1_identitas" JSONB,
    "page2_dataKendaraan" JSONB,
    "page3_kelengkapan" JSONB,
    "page4_hasilInspeksi" JSONB,
    "page5_penilaian" JSONB,
    "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nftAssetId" TEXT,
    "transactionHash" TEXT,
    "reportPdfUrl" TEXT,
    "reportHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspections_nftAssetId_key" ON "inspections"("nftAssetId");

-- CreateIndex
CREATE INDEX "inspections_submittedByUserId_idx" ON "inspections"("submittedByUserId");

-- CreateIndex
CREATE INDEX "inspections_vehiclePlateNumber_idx" ON "inspections"("vehiclePlateNumber");

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
