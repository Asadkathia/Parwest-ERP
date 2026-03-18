-- Inventory V2 SoT parity migration (manual, additive, idempotent)
-- Scope: inventory-related tables only. No core-module table mutations.

-- 1) InventoryVendor parity fields
ALTER TABLE "InventoryVendor" ADD COLUMN IF NOT EXISTS "companyPhone" TEXT;
ALTER TABLE "InventoryVendor" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT;
ALTER TABLE "InventoryVendor" ADD COLUMN IF NOT EXISTS "contactPersonPhone" TEXT;
ALTER TABLE "InventoryVendor" ADD COLUMN IF NOT EXISTS "address" TEXT;

-- 2) Store parity fields
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "prefix" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "isHeadOffice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- 3) StoreInventoryCategory master table
CREATE TABLE IF NOT EXISTS "StoreInventoryCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "canAssignGuard" BOOLEAN NOT NULL DEFAULT false,
  "canAssignEmployee" BOOLEAN NOT NULL DEFAULT false,
  "canAssignClient" BOOLEAN NOT NULL DEFAULT false,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreInventoryCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreInventoryCategory_name_key" ON "StoreInventoryCategory"("name");
CREATE INDEX IF NOT EXISTS "StoreInventoryCategory_parentId_idx" ON "StoreInventoryCategory"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreInventoryCategory_parentId_fkey'
  ) THEN
    ALTER TABLE "StoreInventoryCategory"
    ADD CONSTRAINT "StoreInventoryCategory_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "StoreInventoryCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) StoreInventoryStatus -> category relation
ALTER TABLE "StoreInventoryStatus" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
CREATE INDEX IF NOT EXISTS "StoreInventoryStatus_categoryId_idx" ON "StoreInventoryStatus"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreInventoryStatus_categoryId_fkey'
  ) THEN
    ALTER TABLE "StoreInventoryStatus"
    ADD CONSTRAINT "StoreInventoryStatus_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "StoreInventoryCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) StoreInventoryProduct parity fields
ALTER TABLE "StoreInventoryProduct" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "StoreInventoryProduct" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
CREATE INDEX IF NOT EXISTS "StoreInventoryProduct_categoryId_idx" ON "StoreInventoryProduct"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreInventoryProduct_categoryId_fkey'
  ) THEN
    ALTER TABLE "StoreInventoryProduct"
    ADD CONSTRAINT "StoreInventoryProduct_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "StoreInventoryCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6) StoreInventoryPurchase parity fields + vendor relation
ALTER TABLE "StoreInventoryPurchase" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "StoreInventoryPurchase" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
CREATE INDEX IF NOT EXISTS "StoreInventoryPurchase_vendorId_idx" ON "StoreInventoryPurchase"("vendorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreInventoryPurchase_vendorId_fkey'
  ) THEN
    ALTER TABLE "StoreInventoryPurchase"
    ADD CONSTRAINT "StoreInventoryPurchase_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "InventoryVendor"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 7) StoreInventoryAssignment condition relation
ALTER TABLE "StoreInventoryAssignment" ADD COLUMN IF NOT EXISTS "conditionId" TEXT;
CREATE INDEX IF NOT EXISTS "StoreInventoryAssignment_conditionId_idx" ON "StoreInventoryAssignment"("conditionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreInventoryAssignment_conditionId_fkey'
  ) THEN
    ALTER TABLE "StoreInventoryAssignment"
    ADD CONSTRAINT "StoreInventoryAssignment_conditionId_fkey"
    FOREIGN KEY ("conditionId") REFERENCES "StoreInventoryConditionV2"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
