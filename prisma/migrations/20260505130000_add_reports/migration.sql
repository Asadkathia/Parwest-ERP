-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "ReportRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "ReportRunStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "scheduledId" TEXT,
    "fileKey" TEXT,
    "fileSize" INTEGER,
    "rowCount" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "formats" "ReportFormat"[],
    "cron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "recipients" TEXT[],
    "managerIds" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRunBlob" (
    "fileKey" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportRunBlob_pkey" PRIMARY KEY ("fileKey")
);

-- CreateIndex
CREATE INDEX "ReportRun_reportKey_createdAt_idx" ON "ReportRun"("reportKey", "createdAt");
CREATE INDEX "ReportRun_scheduledId_idx" ON "ReportRun"("scheduledId");
CREATE INDEX "ReportRun_requestedById_createdAt_idx" ON "ReportRun"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduledReport_active_nextRunAt_idx" ON "ScheduledReport"("active", "nextRunAt");
CREATE INDEX "ScheduledReport_createdById_idx" ON "ScheduledReport"("createdById");

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_scheduledId_fkey" FOREIGN KEY ("scheduledId") REFERENCES "ScheduledReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
