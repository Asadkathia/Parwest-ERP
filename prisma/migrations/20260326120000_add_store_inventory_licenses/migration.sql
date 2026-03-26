CREATE TABLE IF NOT EXISTS "StoreInventoryLicense" (
  "id" TEXT NOT NULL,
  "validity" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "clientId" TEXT,
  "weaponNumber" TEXT,
  "weaponTypeId" TEXT,
  "calibreId" TEXT,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "attachmentName" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreInventoryLicense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreInventoryLicense_licenseNumber_key"
  ON "StoreInventoryLicense"("licenseNumber");

CREATE INDEX IF NOT EXISTS "StoreInventoryLicense_clientId_idx"
  ON "StoreInventoryLicense"("clientId");

CREATE INDEX IF NOT EXISTS "StoreInventoryLicense_weaponTypeId_idx"
  ON "StoreInventoryLicense"("weaponTypeId");

CREATE INDEX IF NOT EXISTS "StoreInventoryLicense_calibreId_idx"
  ON "StoreInventoryLicense"("calibreId");

CREATE INDEX IF NOT EXISTS "StoreInventoryLicense_createdById_idx"
  ON "StoreInventoryLicense"("createdById");
