-- ============================================================
-- Drop legacy float deduction columns from Payroll.
-- PayrollDeductionEntry is now the single source of truth.
--
-- Pre-condition: 20260506100000_deductions_policy must have been applied
-- and any historical totals you care to keep have already been carried into
-- PayrollDeductionEntry rows by the canonical engine via persist.ts (the
-- prior persist.ts mirrored entries → these columns; current persist.ts
-- writes only entries).
-- ============================================================

ALTER TABLE "Payroll" DROP COLUMN IF EXISTS "cwf";
ALTER TABLE "Payroll" DROP COLUMN IF EXISTS "eobi";
ALTER TABLE "Payroll" DROP COLUMN IF EXISTS "essi";
ALTER TABLE "Payroll" DROP COLUMN IF EXISTS "trainingSchoolFees";
ALTER TABLE "Payroll" DROP COLUMN IF EXISTS "otherDeductions";
