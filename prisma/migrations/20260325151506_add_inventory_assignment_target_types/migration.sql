-- Inventory V2: separate assignment targets for guard, employee, client.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'StoreInventoryAssignmentTargetType'
  ) THEN
    CREATE TYPE "StoreInventoryAssignmentTargetType" AS ENUM ('GUARD', 'EMPLOYEE', 'CLIENT');
  END IF;
END
$$;

ALTER TABLE "StoreInventoryAssignment"
  ADD COLUMN IF NOT EXISTS "assignedToType" "StoreInventoryAssignmentTargetType";

UPDATE "StoreInventoryAssignment"
SET "assignedToType" = 'EMPLOYEE'
WHERE "assignedToType" IS NULL;

ALTER TABLE "StoreInventoryAssignment"
  ALTER COLUMN "assignedToType" SET DEFAULT 'EMPLOYEE',
  ALTER COLUMN "assignedToType" SET NOT NULL;

ALTER TABLE "StoreInventoryAssignment"
  ALTER COLUMN "assignedToUserId" DROP NOT NULL;

ALTER TABLE "StoreInventoryAssignment"
  ADD COLUMN IF NOT EXISTS "assignedToGuardId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedToClientId" TEXT;

CREATE INDEX IF NOT EXISTS "StoreInventoryAssignment_assignedToGuardId_idx"
  ON "StoreInventoryAssignment"("assignedToGuardId");

CREATE INDEX IF NOT EXISTS "StoreInventoryAssignment_assignedToClientId_idx"
  ON "StoreInventoryAssignment"("assignedToClientId");

CREATE INDEX IF NOT EXISTS "StoreInventoryAssignment_assignedToType_idx"
  ON "StoreInventoryAssignment"("assignedToType");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StoreInventoryAssignment_assignedToGuardId_fkey'
  ) THEN
    ALTER TABLE "StoreInventoryAssignment"
      ADD CONSTRAINT "StoreInventoryAssignment_assignedToGuardId_fkey"
      FOREIGN KEY ("assignedToGuardId") REFERENCES "Guard"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StoreInventoryAssignment_assignedToClientId_fkey'
  ) THEN
    ALTER TABLE "StoreInventoryAssignment"
      ADD CONSTRAINT "StoreInventoryAssignment_assignedToClientId_fkey"
      FOREIGN KEY ("assignedToClientId") REFERENCES "Client"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
