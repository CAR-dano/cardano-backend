-- CreateTable
CREATE TABLE "inspection_change_logs" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_change_logs_inspectionId_idx" ON "inspection_change_logs"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_change_logs_changedByUserId_idx" ON "inspection_change_logs"("changedByUserId");

-- AddForeignKey
ALTER TABLE "inspection_change_logs" ADD CONSTRAINT "inspection_change_logs_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_change_logs" ADD CONSTRAINT "inspection_change_logs_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
