CREATE TYPE "BillingMode" AS ENUM ('MANUAL','DYNAMIC');
CREATE TYPE "RateScopeLevel" AS ENUM ('BRANCH','REGION','PROVINCE','GLOBAL');
ALTER TABLE "ClientContract" ADD COLUMN "billingMode" "BillingMode" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ClientContractRate"
  ADD COLUMN "scopeLevel" "RateScopeLevel",
  ADD COLUMN "scopeBranchId" TEXT,
  ADD COLUMN "scopeRegionId" TEXT,
  ADD COLUMN "scopeProvince" "Province";
CREATE TABLE "ContractGuardRate" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL REFERENCES "ClientContract"("id") ON DELETE CASCADE,
  "guardId" TEXT NOT NULL REFERENCES "Guard"("id") ON DELETE CASCADE,
  "rate" DOUBLE PRECISION NOT NULL,
  "extraHourRate" DOUBLE PRECISION,
  "isCurrentRate" BOOLEAN NOT NULL DEFAULT true,
  "rateStartDate" TIMESTAMP(3),
  "rateEndDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ContractGuardRate_contractId_guardId_key" ON "ContractGuardRate"("contractId","guardId");
CREATE INDEX "ContractGuardRate_contractId_idx" ON "ContractGuardRate"("contractId");
CREATE INDEX "ContractGuardRate_guardId_idx" ON "ContractGuardRate"("guardId");

-- ── Data migration: legacy (province,city) + contract.branchId → explicit scope ──
-- NOTE for human applying: run `SELECT id, province, city FROM "ClientContractRate";`
-- and `SELECT id,name FROM "Region";` first to confirm the city→Region name match below
-- catches all rows; any row left with scopeLevel NULL after this block must be fixed
-- manually before the constraints migration runs.

-- Branch-contract rows -> BRANCH scope.
UPDATE "ClientContractRate" r SET "scopeLevel"='BRANCH', "scopeBranchId"=c."branchId"
FROM "ClientContract" c
WHERE c.id=r."contractId" AND c."branchId" IS NOT NULL AND r."scopeLevel" IS NULL;

-- Client-contract rows with a city -> REGION (match Region by name, case-insensitive).
-- NOTE: in Postgres UPDATE ... FROM, the target table `r` cannot be referenced in a
-- JOIN's ON clause — both FROM tables are comma-joined and all conditions (incl. the
-- r.city = reg.name match) live in WHERE.
UPDATE "ClientContractRate" r SET "scopeLevel"='REGION', "scopeRegionId"=reg.id
FROM "ClientContract" c, "Region" reg
WHERE c.id=r."contractId" AND c."branchId" IS NULL
  AND r.city IS NOT NULL AND r."scopeLevel" IS NULL
  AND LOWER(reg.name)=LOWER(r.city);

-- Client-contract rows with province only -> PROVINCE (best-effort enum map; unmapped stays NULL for manual fix).
UPDATE "ClientContractRate" r SET "scopeLevel"='PROVINCE',
  "scopeProvince" = CASE UPPER(TRIM(r.province))
     WHEN 'PUNJAB' THEN 'PUNJAB'::"Province"
     WHEN 'SINDH' THEN 'SINDH'::"Province"
     WHEN 'KPK' THEN 'KPK'::"Province"
     WHEN 'KHYBER PAKHTUNKHWA' THEN 'KPK'::"Province"
     WHEN 'BALOCHISTAN' THEN 'BALOCHISTAN'::"Province"
     WHEN 'ICT' THEN 'ICT'::"Province"
     WHEN 'ISLAMABAD' THEN 'ICT'::"Province"
     WHEN 'AJK' THEN 'AJK'::"Province"
     WHEN 'GILGIT_BALTISTAN' THEN 'GILGIT_BALTISTAN'::"Province"
     WHEN 'GILGIT BALTISTAN' THEN 'GILGIT_BALTISTAN'::"Province"
     ELSE NULL END
WHERE r."scopeLevel" IS NULL AND r.province IS NOT NULL AND r.city IS NULL
  AND UPPER(TRIM(r.province)) IN ('PUNJAB','SINDH','KPK','KHYBER PAKHTUNKHWA','BALOCHISTAN','ICT','ISLAMABAD','AJK','GILGIT_BALTISTAN','GILGIT BALTISTAN');

-- Everything still unscoped on a client-level contract -> GLOBAL.
UPDATE "ClientContractRate" r SET "scopeLevel"='GLOBAL'
FROM "ClientContract" c
WHERE c.id=r."contractId" AND c."branchId" IS NULL AND r."scopeLevel" IS NULL;
