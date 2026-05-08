-- CreateEnum
CREATE TYPE "BulkImportStatus" AS ENUM (
  'QUEUED',
  'VALIDATING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'PARTIALLY_COMPLETED'
);

-- CreateTable
CREATE TABLE "BulkImportJob" (
  "id" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "subModule" TEXT,
  "status" "BulkImportStatus" NOT NULL DEFAULT 'QUEUED',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "successRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "headers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "errorRows" JSONB,
  "metadata" JSONB,
  "fileKey" TEXT,
  "fileBlob" BYTEA,
  "fileName" TEXT,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BulkImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkImportJob_module_subModule_createdAt_idx" ON "BulkImportJob" ("module", "subModule", "createdAt");
CREATE INDEX "BulkImportJob_createdById_createdAt_idx" ON "BulkImportJob" ("createdById", "createdAt");
CREATE INDEX "BulkImportJob_status_createdAt_idx" ON "BulkImportJob" ("status", "createdAt");

-- AddForeignKey
ALTER TABLE "BulkImportJob"
  ADD CONSTRAINT "BulkImportJob_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
