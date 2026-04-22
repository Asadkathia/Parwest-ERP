-- Convert Invoice.status from String to InvoiceStatus enum, add void fields
-- and a (clientId, branchId, month) unique index that treats NULL branchId as equal.

-- 1. Create the enum
CREATE TYPE "InvoiceStatus" AS ENUM (
  'DRAFT',
  'PENDING',
  'ADVANCE_PAID',
  'PARTIAL_PAID',
  'PAID',
  'UNPAID',
  'OVERDUE',
  'VOID'
);

-- 2. Normalize any unexpected status values before the cast
UPDATE "Invoice"
SET "status" = 'PENDING'
WHERE "status" IS NULL
   OR "status" NOT IN ('DRAFT','PENDING','ADVANCE_PAID','PARTIAL_PAID','PAID','UNPAID','OVERDUE','VOID');

-- 3. Drop the old default, alter the column type, restore default
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice"
  ALTER COLUMN "status" TYPE "InvoiceStatus"
  USING "status"::"InvoiceStatus";
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- 4. Void columns
ALTER TABLE "Invoice"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidReason" TEXT;

-- 5. Unique index: NULLS NOT DISTINCT so two invoices for same (client, NULL branch, month)
--    are treated as a duplicate. Requires Postgres 15+.
CREATE UNIQUE INDEX "Invoice_client_branch_month_key"
  ON "Invoice" ("clientId", "branchId", "month")
  NULLS NOT DISTINCT;
