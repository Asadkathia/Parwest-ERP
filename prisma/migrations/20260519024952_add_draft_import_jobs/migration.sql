-- AlterEnum
-- Postgres requires ADD VALUE outside a transaction; Prisma runs each statement
-- in its own implicit transaction for migrate, so this is split off.
ALTER TYPE "BulkImportStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "BulkImportJob" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BulkImportJob_status_expiresAt_idx" ON "BulkImportJob" ("status", "expiresAt");

-- CreateTable
CREATE TABLE "BulkImportJobRow" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "errors" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "skipped" BOOLEAN NOT NULL DEFAULT false,
  "dirty" BOOLEAN NOT NULL DEFAULT false,
  "lastEditedById" TEXT,
  "lastEditedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BulkImportJobRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkImportJobRow_jobId_rowNumber_key" ON "BulkImportJobRow" ("jobId", "rowNumber");
CREATE INDEX "BulkImportJobRow_jobId_skipped_idx" ON "BulkImportJobRow" ("jobId", "skipped");

-- AddForeignKey
ALTER TABLE "BulkImportJobRow"
  ADD CONSTRAINT "BulkImportJobRow_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "BulkImportJob" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
