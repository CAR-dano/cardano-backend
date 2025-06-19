-- CreateEnum
CREATE TYPE "TargetPeriod" AS ENUM ('YEAR', 'MONTH', 'WEEK', 'DAY');

-- CreateTable
CREATE TABLE "inspection_targets" (
    "id" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "period" "TargetPeriod" NOT NULL,
    "targetDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspection_targets_period_targetDate_key" ON "inspection_targets"("period", "targetDate");
