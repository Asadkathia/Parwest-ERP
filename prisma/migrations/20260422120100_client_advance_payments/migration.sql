-- Client advance payments + ledger that links them to invoices

CREATE TABLE "ClientAdvancePayment" (
  "id"             TEXT          NOT NULL,
  "clientId"       TEXT          NOT NULL,
  "branchId"       TEXT,
  "amount"         DOUBLE PRECISION NOT NULL,
  "appliedAmount"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentDate"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method"         TEXT,
  "reference"      TEXT,
  "notes"          TEXT,
  "recordedBy"     TEXT,
  "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "ClientAdvancePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientAdvancePayment_clientId_idx" ON "ClientAdvancePayment"("clientId");
CREATE INDEX "ClientAdvancePayment_branchId_idx" ON "ClientAdvancePayment"("branchId");

ALTER TABLE "ClientAdvancePayment"
  ADD CONSTRAINT "ClientAdvancePayment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientAdvancePayment"
  ADD CONSTRAINT "ClientAdvancePayment_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InvoiceAdvanceApplication" (
  "id"        TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "advanceId" TEXT NOT NULL,
  "amount"    DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceAdvanceApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceAdvanceApplication_invoiceId_idx" ON "InvoiceAdvanceApplication"("invoiceId");
CREATE INDEX "InvoiceAdvanceApplication_advanceId_idx" ON "InvoiceAdvanceApplication"("advanceId");

ALTER TABLE "InvoiceAdvanceApplication"
  ADD CONSTRAINT "InvoiceAdvanceApplication_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceAdvanceApplication"
  ADD CONSTRAINT "InvoiceAdvanceApplication_advanceId_fkey"
    FOREIGN KEY ("advanceId") REFERENCES "ClientAdvancePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
