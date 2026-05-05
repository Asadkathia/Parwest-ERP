-- ============================================================
-- Deductions Policy (Wave 3)
-- Canonical, effective-dated rate tables + per-guard ledgers
-- ============================================================

-- ----- Guard: resignation date (drives uniform tenure-tier recovery) -----
ALTER TABLE "Guard" ADD COLUMN "resignedOn" TIMESTAMP(3);

-- ----- PayrollDeductionType: rate-source contract -----
ALTER TABLE "PayrollDeductionType" ADD COLUMN "rateSource" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "PayrollDeductionType" ADD COLUMN "isPolicyManaged" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "PayrollDeductionType_rateSource_idx" ON "PayrollDeductionType"("rateSource");

-- ----- PayrollDeductionEntry: traceability + override audit -----
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "computedAmount" DOUBLE PRECISION;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "rateRowId" TEXT;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "rateSource" TEXT;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "breakdown" JSONB;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "isOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "overrideById" TEXT;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "overrideByName" TEXT;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "overrideReason" TEXT;
ALTER TABLE "PayrollDeductionEntry" ADD COLUMN "overrideAt" TIMESTAMP(3);
CREATE INDEX "PayrollDeductionEntry_rateRowId_idx" ON "PayrollDeductionEntry"("rateRowId");

-- ============================================================
-- Rate tables (effective-dated, supersession-based)
-- ============================================================

-- APSAA branch rate
CREATE TABLE "ApsaaBranchRate" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "sourceDocumentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApsaaBranchRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApsaaBranchRate_branchId_idx" ON "ApsaaBranchRate"("branchId");
CREATE INDEX "ApsaaBranchRate_status_idx" ON "ApsaaBranchRate"("status");
CREATE INDEX "ApsaaBranchRate_effectiveFrom_idx" ON "ApsaaBranchRate"("effectiveFrom");
-- One ACTIVE rate per branch at a time
CREATE UNIQUE INDEX "ApsaaBranchRate_branch_active_uniq"
  ON "ApsaaBranchRate"("branchId")
  WHERE "status" = 'ACTIVE';
ALTER TABLE "ApsaaBranchRate"
  ADD CONSTRAINT "ApsaaBranchRate_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CWF region rate
CREATE TABLE "CwfRegionRate" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "sourceDocumentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CwfRegionRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CwfRegionRate_regionId_idx" ON "CwfRegionRate"("regionId");
CREATE INDEX "CwfRegionRate_status_idx" ON "CwfRegionRate"("status");
CREATE INDEX "CwfRegionRate_effectiveFrom_idx" ON "CwfRegionRate"("effectiveFrom");
CREATE UNIQUE INDEX "CwfRegionRate_region_active_uniq"
  ON "CwfRegionRate"("regionId")
  WHERE "status" = 'ACTIVE';
ALTER TABLE "CwfRegionRate"
  ADD CONSTRAINT "CwfRegionRate_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EOBI rate (global singleton)
CREATE TABLE "EobiRate" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "sourceDocumentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EobiRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EobiRate_status_idx" ON "EobiRate"("status");
CREATE INDEX "EobiRate_effectiveFrom_idx" ON "EobiRate"("effectiveFrom");
CREATE UNIQUE INDEX "EobiRate_active_uniq" ON "EobiRate"((true)) WHERE "status" = 'ACTIVE';

-- APSAA Punjab (global singleton)
CREATE TABLE "ApsaaPunjabRate" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "sourceDocumentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApsaaPunjabRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApsaaPunjabRate_status_idx" ON "ApsaaPunjabRate"("status");
CREATE INDEX "ApsaaPunjabRate_effectiveFrom_idx" ON "ApsaaPunjabRate"("effectiveFrom");
CREATE UNIQUE INDEX "ApsaaPunjabRate_active_uniq" ON "ApsaaPunjabRate"((true)) WHERE "status" = 'ACTIVE';

-- Uniform plan (global singleton)
CREATE TABLE "UniformPlan" (
    "id" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "sourceDocumentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniformPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UniformPlan_status_idx" ON "UniformPlan"("status");
CREATE INDEX "UniformPlan_effectiveFrom_idx" ON "UniformPlan"("effectiveFrom");
CREATE UNIQUE INDEX "UniformPlan_active_uniq" ON "UniformPlan"((true)) WHERE "status" = 'ACTIVE';

-- Uniform resignation tiers (multiple rows = tier table)
CREATE TABLE "UniformResignationTier" (
    "id" TEXT NOT NULL,
    "minMonths" INTEGER NOT NULL,
    "maxMonths" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniformResignationTier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UniformResignationTier_status_idx" ON "UniformResignationTier"("status");
CREATE INDEX "UniformResignationTier_effectiveFrom_idx" ON "UniformResignationTier"("effectiveFrom");

-- Night-call rule config (global singleton)
CREATE TABLE "NightCallRule" (
    "id" TEXT NOT NULL,
    "callsPerNight" INTEGER NOT NULL DEFAULT 3,
    "twoMissedDeduction" INTEGER NOT NULL DEFAULT 1,
    "repeatedDayPenalty" INTEGER NOT NULL DEFAULT 1,
    "consecutiveOneMissedWarningDay" INTEGER NOT NULL DEFAULT 1,
    "consecutiveOneMissedDeductionDay" INTEGER NOT NULL DEFAULT 1,
    "dayRateBasis" TEXT NOT NULL DEFAULT 'BASE_DIV_30',
    "customDayRate" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NightCallRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NightCallRule_status_idx" ON "NightCallRule"("status");
CREATE INDEX "NightCallRule_effectiveFrom_idx" ON "NightCallRule"("effectiveFrom");
CREATE UNIQUE INDEX "NightCallRule_active_uniq" ON "NightCallRule"((true)) WHERE "status" = 'ACTIVE';

-- ============================================================
-- Per-guard ledgers driven by triggers
-- ============================================================

-- Uniform issuance + installments
CREATE TABLE "UniformIssuance" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "uniformPlanId" TEXT NOT NULL,
    "issuedOn" TIMESTAMP(3) NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "issuedById" TEXT,
    "issuedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniformIssuance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UniformIssuance_guardId_idx" ON "UniformIssuance"("guardId");
CREATE INDEX "UniformIssuance_status_idx" ON "UniformIssuance"("status");
ALTER TABLE "UniformIssuance"
  ADD CONSTRAINT "UniformIssuance_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UniformInstallment" (
    "id" TEXT NOT NULL,
    "uniformIssuanceId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "payrollMonth" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payrollId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniformInstallment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UniformInstallment_issuance_month_uniq"
  ON "UniformInstallment"("uniformIssuanceId", "payrollMonth");
CREATE INDEX "UniformInstallment_guard_month_idx"
  ON "UniformInstallment"("guardId", "payrollMonth");
CREATE INDEX "UniformInstallment_status_idx" ON "UniformInstallment"("status");
ALTER TABLE "UniformInstallment"
  ADD CONSTRAINT "UniformInstallment_uniformIssuanceId_fkey"
  FOREIGN KEY ("uniformIssuanceId") REFERENCES "UniformIssuance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UniformResignationRecovery" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "resignedOn" TIMESTAMP(3) NOT NULL,
    "monthsServed" INTEGER NOT NULL,
    "tierId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "payrollMonth" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payrollId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniformResignationRecovery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UniformResignationRecovery_guard_month_uniq"
  ON "UniformResignationRecovery"("guardId", "payrollMonth");
CREATE INDEX "UniformResignationRecovery_guardId_idx" ON "UniformResignationRecovery"("guardId");
CREATE INDEX "UniformResignationRecovery_status_idx" ON "UniformResignationRecovery"("status");
ALTER TABLE "UniformResignationRecovery"
  ADD CONSTRAINT "UniformResignationRecovery_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Advance salary + recovery schedule
CREATE TABLE "AdvanceSalary" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "issuedOn" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedById" TEXT,
    "issuedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvanceSalary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdvanceSalary_guardId_idx" ON "AdvanceSalary"("guardId");
CREATE INDEX "AdvanceSalary_status_idx" ON "AdvanceSalary"("status");
ALTER TABLE "AdvanceSalary"
  ADD CONSTRAINT "AdvanceSalary_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdvanceSalaryRecovery" (
    "id" TEXT NOT NULL,
    "advanceSalaryId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "payrollMonth" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payrollId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvanceSalaryRecovery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdvanceSalaryRecovery_advance_month_uniq"
  ON "AdvanceSalaryRecovery"("advanceSalaryId", "payrollMonth");
CREATE INDEX "AdvanceSalaryRecovery_guard_month_idx"
  ON "AdvanceSalaryRecovery"("guardId", "payrollMonth");
CREATE INDEX "AdvanceSalaryRecovery_status_idx" ON "AdvanceSalaryRecovery"("status");
ALTER TABLE "AdvanceSalaryRecovery"
  ADD CONSTRAINT "AdvanceSalaryRecovery_advanceSalaryId_fkey"
  FOREIGN KEY ("advanceSalaryId") REFERENCES "AdvanceSalary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Night-call logs and derived deductions
CREATE TABLE "NightCallLog" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "callTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NightCallLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NightCallLog_guardId_callTime_idx" ON "NightCallLog"("guardId", "callTime");
CREATE INDEX "NightCallLog_status_idx" ON "NightCallLog"("status");
ALTER TABLE "NightCallLog"
  ADD CONSTRAINT "NightCallLog_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NightCallDeduction" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "daysDeducted" INTEGER NOT NULL DEFAULT 0,
    "ruleRowId" TEXT,
    "payrollMonth" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payrollId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NightCallDeduction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NightCallDeduction_guard_date_type_uniq"
  ON "NightCallDeduction"("guardId", "date", "type");
CREATE INDEX "NightCallDeduction_guard_payrollMonth_idx"
  ON "NightCallDeduction"("guardId", "payrollMonth");
CREATE INDEX "NightCallDeduction_status_idx" ON "NightCallDeduction"("status");
ALTER TABLE "NightCallDeduction"
  ADD CONSTRAINT "NightCallDeduction_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EOBI enrollment per guard
CREATE TABLE "EobiEnrollment" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "eobiNumber" TEXT,
    "registrationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EobiEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EobiEnrollment_guardId_key" ON "EobiEnrollment"("guardId");
CREATE INDEX "EobiEnrollment_isActive_idx" ON "EobiEnrollment"("isActive");
ALTER TABLE "EobiEnrollment"
  ADD CONSTRAINT "EobiEnrollment_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Audit log for any rate change
CREATE TABLE "DeductionPolicyAudit" (
    "id" TEXT NOT NULL,
    "rateTable" TEXT NOT NULL,
    "rateRowId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scopeKey" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "byUserId" TEXT,
    "byUserName" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeductionPolicyAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DeductionPolicyAudit_table_row_idx"
  ON "DeductionPolicyAudit"("rateTable", "rateRowId");
CREATE INDEX "DeductionPolicyAudit_createdAt_idx"
  ON "DeductionPolicyAudit"("createdAt");

-- ESSI rate (global singleton) + per-guard enrollment
CREATE TABLE "EssiRate" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "proposedById" TEXT,
    "proposedByName" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "sourceDocumentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EssiRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EssiRate_status_idx" ON "EssiRate"("status");
CREATE INDEX "EssiRate_effectiveFrom_idx" ON "EssiRate"("effectiveFrom");
CREATE UNIQUE INDEX "EssiRate_active_uniq" ON "EssiRate"((true)) WHERE "status" = 'ACTIVE';

CREATE TABLE "EssiEnrollment" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "essiNumber" TEXT,
    "registrationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EssiEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EssiEnrollment_guardId_key" ON "EssiEnrollment"("guardId");
CREATE INDEX "EssiEnrollment_isActive_idx" ON "EssiEnrollment"("isActive");
ALTER TABLE "EssiEnrollment"
  ADD CONSTRAINT "EssiEnrollment_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Training School Fees: per-guard tuition issuance + installment recovery
CREATE TABLE "TrainingSchoolFeeIssuance" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "issuedOn" TIMESTAMP(3) NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "issuedById" TEXT,
    "issuedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingSchoolFeeIssuance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrainingSchoolFeeIssuance_guardId_idx" ON "TrainingSchoolFeeIssuance"("guardId");
CREATE INDEX "TrainingSchoolFeeIssuance_status_idx" ON "TrainingSchoolFeeIssuance"("status");
ALTER TABLE "TrainingSchoolFeeIssuance"
  ADD CONSTRAINT "TrainingSchoolFeeIssuance_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TrainingSchoolFeeInstallment" (
    "id" TEXT NOT NULL,
    "issuanceId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "payrollMonth" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payrollId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingSchoolFeeInstallment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainingSchoolFeeInstallment_issuance_month_uniq"
  ON "TrainingSchoolFeeInstallment"("issuanceId", "payrollMonth");
CREATE INDEX "TrainingSchoolFeeInstallment_guard_month_idx"
  ON "TrainingSchoolFeeInstallment"("guardId", "payrollMonth");
CREATE INDEX "TrainingSchoolFeeInstallment_status_idx"
  ON "TrainingSchoolFeeInstallment"("status");
ALTER TABLE "TrainingSchoolFeeInstallment"
  ADD CONSTRAINT "TrainingSchoolFeeInstallment_issuanceId_fkey"
  FOREIGN KEY ("issuanceId") REFERENCES "TrainingSchoolFeeIssuance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Seed: canonical policy-managed deduction types (idempotent)
-- ============================================================
INSERT INTO "PayrollDeductionType"
  ("id", "code", "name", "description", "defaultAmount", "isActive", "sortOrder", "rateSource", "isPolicyManaged", "createdAt", "updatedAt")
VALUES
  ('dt_apsaa',                'APSAA',                'APSAA',                  'Client branch–wise approved rate',                                   0, true, 10,  'CLIENT_BRANCH_RATE', true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_cwf',                  'CWF',                  'CWF',                    'Region-wise approved Contribution Welfare Fund',                     0, true, 20,  'REGION_RATE',        true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_advance_salary',       'ADVANCE_SALARY',       'Advance Salary',         'Recovered per actual advance + schedule',                            0, true, 30,  'ACTUAL',             true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_uniform',              'UNIFORM',              'Uniform / Jersey',       'Auto installments on issuance + tenure-tier resignation recovery',   0, true, 40,  'INSTALLMENT_PLAN',   true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_apsaa_punjab',         'APSAA_PUNJAB',         'APSAA — Punjab',         'Auto-applied at enrollment for guards deployed in Punjab',           0, true, 50,  'CLIENT_BRANCH_RATE', true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_night_call',           'NIGHT_CALL',           'Night Call Monitoring',  'Day-salary deduction for missed night calls',                        0, true, 60,  'CALL_LOG_DERIVED',   true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_absent',               'ABSENT',               'Absentees',              'Per-day deduction from verified attendance',                         0, true, 70,  'ATTENDANCE_DERIVED', true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_eobi',                 'EOBI',                 'EOBI',                   'Monthly EOBI contribution per notified rate',                        0, true, 80,  'EOBI_RATE',          true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_essi',                 'ESSI',                 'ESSI',                   'Monthly Provincial ESSI contribution (parallel to EOBI)',            0, true, 85,  'EOBI_RATE',          true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_training_school_fees', 'TRAINING_SCHOOL_FEES', 'Training School Fees',   'Course tuition recovered via per-guard installments',                0, true, 88,  'INSTALLMENT_PLAN',   true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dt_other',                'OTHER',                'Other',                  'Manual ad-hoc deductions (require management approval)',             0, true, 90,  'MANUAL',             false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name"            = EXCLUDED."name",
  "description"     = EXCLUDED."description",
  "rateSource"      = EXCLUDED."rateSource",
  "isPolicyManaged" = EXCLUDED."isPolicyManaged",
  "sortOrder"       = EXCLUDED."sortOrder",
  "updatedAt"       = CURRENT_TIMESTAMP;
