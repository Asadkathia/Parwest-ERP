-- ClientContractRate: finalize the scope-column migration.
--
-- ORDERING (CRITICAL): this migration MUST be applied LAST, AFTER the app
-- deploy that (a) stopped reading the legacy `province`/`city` columns and
-- (b) already writes the explicit scope columns
-- (`scopeLevel`/`scopeBranchId`/`scopeRegionId`/`scopeProvince`). Applying it
-- before the app deploy would break the running app (it would still order/
-- select on `province`/`city`, and `scopeLevel` would not yet be guaranteed
-- non-null on freshly written rows). Run only once the app is confirmed
-- migrated and the legacy data backfill (20260530121xxx) has populated scope
-- columns for every existing row.

-- 1. scopeLevel becomes mandatory (every row must declare a scope level).
ALTER TABLE "ClientContractRate" ALTER COLUMN "scopeLevel" SET NOT NULL;

-- 2. Enforce that exactly the right scope target is set for each scopeLevel.
ALTER TABLE "ClientContractRate" ADD CONSTRAINT "ccr_scope_target_ck" CHECK (
  ("scopeLevel"='BRANCH'   AND "scopeBranchId" IS NOT NULL AND "scopeRegionId" IS NULL AND "scopeProvince" IS NULL) OR
  ("scopeLevel"='REGION'   AND "scopeRegionId" IS NOT NULL AND "scopeBranchId" IS NULL AND "scopeProvince" IS NULL) OR
  ("scopeLevel"='PROVINCE' AND "scopeProvince" IS NOT NULL AND "scopeBranchId" IS NULL AND "scopeRegionId" IS NULL) OR
  ("scopeLevel"='GLOBAL'   AND "scopeBranchId" IS NULL AND "scopeRegionId" IS NULL AND "scopeProvince" IS NULL)
);

-- 3. Defensive demotion: the NEW scope key is coarser than the legacy combo
--    (it drops guardType/exService), so two rows that were distinct-current under
--    the old index can collide as duplicate-current under the new one. Keep only
--    the most-recently-effective current row per scope combo; demote the rest.
UPDATE "ClientContractRate" r SET "isCurrentRate" = false
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "contractId", "scopeLevel",
      COALESCE("scopeBranchId",''), COALESCE("scopeRegionId",''), COALESCE("scopeProvince"::text,'')
    ORDER BY "rateStartDate" DESC NULLS LAST, "updatedAt" DESC, "createdAt" DESC
  ) AS rn
  FROM "ClientContractRate" WHERE "isCurrentRate" = true
) ranked
WHERE r."id" = ranked."id" AND ranked.rn > 1;

-- 4. Swap the one-current-rate uniqueness key from the legacy
--    {province,city,guardType,exService} combo to the scope key.
DROP INDEX IF EXISTS "ClientContractRate_current_combo_key";
CREATE UNIQUE INDEX "ClientContractRate_current_scope_key"
  ON "ClientContractRate" (
    "contractId", "scopeLevel",
    COALESCE("scopeBranchId",''), COALESCE("scopeRegionId",''),
    COALESCE("scopeProvince"::text,'')
  ) WHERE "isCurrentRate" = true;

-- 4. Drop the now-obsolete legacy location columns.
ALTER TABLE "ClientContractRate" DROP COLUMN "province", DROP COLUMN "city";
