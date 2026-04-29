-- Branch lifecycle status + Deployment EXTRA type (string, no enum) +
-- OJT training categories normalized lookup.
--
-- Notes:
--   * deploymentType is a free string column constrained at the API/zod
--     layer. We do NOT alter the column here; "EXTRA" is added as a valid
--     value in src/lib/schemas (deployments) and gated by the
--     `deployments.allowExtraType` workflow rule. The legacy
--     `isExtraGuard` boolean column is kept during the migration grace
--     window — the API populates both fields until callers migrate.
--   * Branch.status uses a new dedicated enum (no BLACKLISTED — branches
--     are not blacklisted; that's a client-level concept).

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable: Branch.status
ALTER TABLE "Branch" ADD COLUMN "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Branch_status_idx" ON "Branch"("status");

-- CreateTable: TrainingCategory (admin-managed OJT lookup)
CREATE TABLE "TrainingCategory" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCategory_name_key" ON "TrainingCategory"("name");
CREATE INDEX "TrainingCategory_isActive_sortOrder_idx" ON "TrainingCategory"("isActive", "sortOrder");

-- CreateTable: OjtTrainingCheck (Training <-> TrainingCategory join)
CREATE TABLE "OjtTrainingCheck" (
    "id"          TEXT NOT NULL,
    "ojtId"       TEXT NOT NULL,
    "categoryId"  TEXT NOT NULL,
    "completed"   BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OjtTrainingCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OjtTrainingCheck_ojtId_categoryId_key" ON "OjtTrainingCheck"("ojtId", "categoryId");
CREATE INDEX "OjtTrainingCheck_ojtId_idx" ON "OjtTrainingCheck"("ojtId");
CREATE INDEX "OjtTrainingCheck_categoryId_idx" ON "OjtTrainingCheck"("categoryId");

-- AddForeignKey
ALTER TABLE "OjtTrainingCheck"
    ADD CONSTRAINT "OjtTrainingCheck_ojtId_fkey"
    FOREIGN KEY ("ojtId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OjtTrainingCheck"
    ADD CONSTRAINT "OjtTrainingCheck_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "TrainingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
