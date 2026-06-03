-- Add the Branch → RegionalOffice relation (the FK column already existed as a
-- dangling reference). Enables branch-based client scoping: a client is visible
-- to a regional manager when it has a branch in that region/office. (Phase B1)
-- Verified 0 orphan Branch.regionalOfficeId rows before adding the constraint.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Branch_regionalOfficeId_idx" ON "Branch"("regionalOfficeId");

-- Self-heal any orphan references BEFORE validating the FK. The column existed
-- unconstrained since 20260209223151, so a deleted office could leave a dangling
-- regionalOfficeId — which would make the validating ADD CONSTRAINT (below) abort
-- the whole deploy. Nulling orphans is exactly the FK's own ON DELETE SET NULL
-- semantics, so it's safe and makes this migration re-runnable on any prod state.
UPDATE "Branch" b SET "regionalOfficeId" = NULL
WHERE b."regionalOfficeId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "RegionalOffice" ro WHERE ro."id" = b."regionalOfficeId"
  );

-- AddForeignKey (idempotent — only add if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Branch_regionalOfficeId_fkey'
  ) THEN
    ALTER TABLE "Branch"
      ADD CONSTRAINT "Branch_regionalOfficeId_fkey"
      FOREIGN KEY ("regionalOfficeId") REFERENCES "RegionalOffice"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
