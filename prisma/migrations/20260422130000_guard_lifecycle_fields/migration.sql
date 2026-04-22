-- Add lifecycle status fields alongside legacy `status`.
-- `status` remains as a dual-written shadow for backward compatibility with
-- non-web consumers and is kept in sync by src/lib/guards/lifecycle.ts.

ALTER TABLE "Guard" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Guard" ADD COLUMN "terminationReason" TEXT;
ALTER TABLE "Guard" ADD COLUMN "lifecycleStatusUpdatedAt" TIMESTAMP(3);

-- Backfill from existing `status`.
-- ACTIVE, PRESENT, DEFAULT all indicate an employed guard → ACTIVE
-- BLACKLISTED (legacy, unused post-decoupling) → TERMINATED
-- ABSENT (never written by code) → INACTIVE as a conservative default
UPDATE "Guard"
SET "lifecycleStatus" = CASE
  WHEN "status" = 'PENDING' THEN 'PENDING'
  WHEN "status" = 'INACTIVE' THEN 'INACTIVE'
  WHEN "status" = 'TERMINATED' THEN 'TERMINATED'
  WHEN "status" = 'BLACKLISTED' THEN 'TERMINATED'
  WHEN "status" = 'ABSENT' THEN 'INACTIVE'
  ELSE 'ACTIVE'
END,
"lifecycleStatusUpdatedAt" = COALESCE("updatedAt", "createdAt");

CREATE INDEX "Guard_lifecycleStatus_idx" ON "Guard"("lifecycleStatus");
