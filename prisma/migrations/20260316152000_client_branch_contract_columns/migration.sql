-- Add missing client/branch contract columns required by current Prisma schema.
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "contractAttachments" JSONB;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "contractUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "contractAttachments" JSONB;
