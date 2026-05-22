-- Switch Guard.cnic from a global unique to a partial unique:
-- at most one NON-terminated profile per CNIC; unlimited terminated (re-hire history).
DROP INDEX IF EXISTS "Guard_cnic_key";

CREATE UNIQUE INDEX "Guard_cnic_active_unique"
  ON "Guard" ("cnic")
  WHERE "lifecycleStatus" <> 'TERMINATED';
