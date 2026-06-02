-- Normalize Client.operationalProvinces to the home Region's province enum value
-- so legacy data satisfies the new province↔region constraint (#47): each client's
-- operational province must equal its home region's province. Fixes inconsistent
-- legacy values like 'Punjab' (wrong case) and 'All Pakistan' (free text) →
-- the canonical Province enum (PUNJAB / SINDH / KPK / ...).
UPDATE "Client" c
SET "operationalProvinces" = r."province"::text
FROM "Region" r
WHERE c."regionId" = r."id"
  AND r."province" IS NOT NULL
  AND (c."operationalProvinces" IS DISTINCT FROM r."province"::text);
