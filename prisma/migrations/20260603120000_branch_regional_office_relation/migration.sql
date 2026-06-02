-- Add the Branch → RegionalOffice relation (the FK column already existed as a
-- dangling reference). Enables branch-based client scoping: a client is visible
-- to a regional manager when it has a branch in that region/office. (Phase B1)
-- Verified 0 orphan Branch.regionalOfficeId rows before adding the constraint.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Branch_regionalOfficeId_idx" ON "Branch"("regionalOfficeId");

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
