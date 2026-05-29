-- BILLING/PRICING INTEGRITY: only ONE "current" rate per combination of
--   {contractId, province, city, guardType, exService}
-- is allowed. Historical rows (isCurrentRate = false) are unlimited for the
-- same combination, so this is a PARTIAL index (WHERE "isCurrentRate" = true).
--
-- province / city / exService are nullable; we COALESCE them to '' inside the
-- index expression so that two rows with NULL in the same slot are treated as
-- equal and collide (Postgres otherwise treats NULLs as distinct in a unique
-- index, which would let duplicate NULL-keyed current rows through).
--
-- This is intentionally a PARTIAL + EXPRESSION index. Prisma's schema.prisma
-- @@unique cannot express either a WHERE clause or COALESCE expressions, so it
-- is defined here as raw SQL and is NOT represented in schema.prisma.
--
-- Apply in production with `prisma migrate deploy`.

-- Step 1 — Defensive demotion of pre-existing duplicate "current" rows.
-- Dirty prod data may already contain >1 isCurrentRate=true row for the same
-- combo, which would make the CREATE UNIQUE INDEX below fail. For each combo
-- with multiple current rows, keep only the most-recently-updated one as
-- current and demote the rest to historical (isCurrentRate=false).
UPDATE "ClientContractRate" AS r
SET "isCurrentRate" = false
FROM (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY
                "contractId",
                COALESCE("province", ''),
                COALESCE("city", ''),
                "guardType",
                COALESCE("exService", '')
            ORDER BY "updatedAt" DESC, "createdAt" DESC
        ) AS rn
    FROM "ClientContractRate"
    WHERE "isCurrentRate" = true
) AS ranked
WHERE r."id" = ranked."id"
  AND ranked.rn > 1;

-- Step 2 — Enforce the single-current-rate invariant going forward.
CREATE UNIQUE INDEX IF NOT EXISTS "ClientContractRate_current_combo_key"
    ON "ClientContractRate" (
        "contractId",
        COALESCE("province", ''),
        COALESCE("city", ''),
        "guardType",
        COALESCE("exService", '')
    )
    WHERE "isCurrentRate" = true;
