-- Extend Payroll
ALTER TABLE "Payroll" ADD COLUMN "paymentRemarks" TEXT;
ALTER TABLE "Payroll" ADD COLUMN "paymentUpdatedAt" TIMESTAMP(3);

-- Extend PayrollHoliday
ALTER TABLE "PayrollHoliday" ADD COLUMN "dateFrom" TIMESTAMP(3);
ALTER TABLE "PayrollHoliday" ADD COLUMN "dateTo" TIMESTAMP(3);
ALTER TABLE "PayrollHoliday" ADD COLUMN "regionalOfficeId" TEXT;
ALTER TABLE "PayrollHoliday" ADD COLUMN "valueType" TEXT;
ALTER TABLE "PayrollHoliday" ADD COLUMN "value" DOUBLE PRECISION;
ALTER TABLE "PayrollHoliday" ADD COLUMN "status" TEXT DEFAULT 'active';
ALTER TABLE "PayrollHoliday" ADD COLUMN "comments" TEXT;
CREATE INDEX "PayrollHoliday_regionalOfficeId_idx" ON "PayrollHoliday"("regionalOfficeId");

-- Extend Loan
ALTER TABLE "Loan" ADD COLUMN "regionId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "supervisorUserId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "managerUserId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "slipNumber" TEXT;
ALTER TABLE "Loan" ADD COLUMN "paymentDate" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Loan" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Loan" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "Loan" ADD COLUMN "imageBase64" TEXT;
ALTER TABLE "Loan" ADD COLUMN "issuerId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN "finalizedById" TEXT;
CREATE INDEX "Loan_regionId_idx" ON "Loan"("regionId");
CREATE INDEX "Loan_month_idx" ON "Loan"("month");

-- PayrollSpecialDuty
CREATE TABLE "PayrollSpecialDuty" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "hourRate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "comments" TEXT,
    "attachmentBase64" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSpecialDuty_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayrollSpecialDuty_guardId_idx" ON "PayrollSpecialDuty"("guardId");
CREATE INDEX "PayrollSpecialDuty_dateFrom_idx" ON "PayrollSpecialDuty"("dateFrom");
ALTER TABLE "PayrollSpecialDuty" ADD CONSTRAINT "PayrollSpecialDuty_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PayrollLoanFinalizationHistory
CREATE TABLE "PayrollLoanFinalizationHistory" (
    "id" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedById" TEXT NOT NULL,
    "finalizedByName" TEXT NOT NULL,
    "regionId" TEXT,
    "regionName" TEXT,
    "month" TIMESTAMP(3) NOT NULL,
    "loanCount" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "loanIdsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLoanFinalizationHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayrollLoanFinalizationHistory_finalizedAt_idx" ON "PayrollLoanFinalizationHistory"("finalizedAt");
CREATE INDEX "PayrollLoanFinalizationHistory_month_idx" ON "PayrollLoanFinalizationHistory"("month");

-- PayrollSalarySlip
CREATE TABLE "PayrollSalarySlip" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "earningsJson" TEXT NOT NULL,
    "deductionsJson" TEXT NOT NULL,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "netPayable" DOUBLE PRECISION NOT NULL,
    "payslipBase64" TEXT,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSalarySlip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollSalarySlip_guardId_month_year_key" ON "PayrollSalarySlip"("guardId", "month", "year");
CREATE INDEX "PayrollSalarySlip_month_idx" ON "PayrollSalarySlip"("month");
ALTER TABLE "PayrollSalarySlip" ADD CONSTRAINT "PayrollSalarySlip_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PayrollDefault
CREATE TABLE "PayrollDefault" (
    "id" TEXT NOT NULL,
    "regionalOfficeId" TEXT,
    "trainingSchoolFeeTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trainingSchoolFeeMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cwfDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spBrVerAgeLimit" INTEGER,
    "spBrVerDays" INTEGER,
    "spBrVerAmount" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDefault_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayrollDefault_regionalOfficeId_idx" ON "PayrollDefault"("regionalOfficeId");
