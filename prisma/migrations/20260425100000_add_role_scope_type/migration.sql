-- Add regional scoping metadata to Role.
-- Every role defaults to REGIONAL; only "Super User" remains GLOBAL.
-- The application enforces: REGIONAL role users must have a regionId assigned,
-- GLOBAL role users must not.
--
-- The "Regional Admin" role is added by prisma/seed.ts rather than here so it
-- gets a Prisma-style cuid id consistent with the rest of the Role table.

-- 1. Create the enum type.
CREATE TYPE "RoleScopeType" AS ENUM ('GLOBAL', 'REGIONAL');

-- 2. Add the column with default REGIONAL (existing rows inherit the default).
ALTER TABLE "Role"
    ADD COLUMN "scopeType" "RoleScopeType" NOT NULL DEFAULT 'REGIONAL';

-- 3. Promote Super User to GLOBAL.
UPDATE "Role" SET "scopeType" = 'GLOBAL' WHERE name = 'Super User';
