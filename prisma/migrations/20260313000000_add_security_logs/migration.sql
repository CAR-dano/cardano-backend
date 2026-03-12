-- Migration: 20260313000000_add_security_logs
-- Description: Add security_logs table for audit logging of sensitive actions
--              (login attempts, role changes, user deletions, etc.)
-- Applied via: prisma db push (schema drift — migration file is for documentation only)

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_logs_userId_timestamp_idx" ON "security_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "security_logs_type_timestamp_idx" ON "security_logs"("type", "timestamp");

-- CreateIndex
CREATE INDEX "security_logs_severity_timestamp_idx" ON "security_logs"("severity", "timestamp");
