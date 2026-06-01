-- Province tier: enum + nullable column on Region (backfilled below).
CREATE TYPE "Province" AS ENUM
  ('PUNJAB','SINDH','KPK','BALOCHISTAN','ICT','AJK','GILGIT_BALTISTAN');
ALTER TABLE "Region" ADD COLUMN "province" "Province";

-- BACKFILL — reconciled against the 8 real Region rows in prod (2026-05-30):
-- Faislabad [sic], Gujranwala, Islamabad, Karachi, Lahore, Multan, Peshawar, Sahiwal.
-- Names matched EXACTLY (note 'Faislabad' is misspelled in the data). The extra
-- names below are harmless forward-compat in case new regions are added later.
UPDATE "Region" SET "province"='PUNJAB'           WHERE name IN ('Faislabad','Faisalabad','Gujranwala','Lahore','Multan','Sahiwal','Rawalpindi','Sialkot','Bahawalpur','Sargodha');
UPDATE "Region" SET "province"='SINDH'            WHERE name IN ('Karachi','Hyderabad','Sukkur','Larkana');
UPDATE "Region" SET "province"='KPK'              WHERE name IN ('Peshawar','Abbottabad','Mardan','Swat','Kohat');
UPDATE "Region" SET "province"='BALOCHISTAN'      WHERE name IN ('Quetta','Gwadar');
UPDATE "Region" SET "province"='ICT'              WHERE name IN ('Islamabad');
UPDATE "Region" SET "province"='AJK'              WHERE name IN ('Muzaffarabad','Mirpur');
UPDATE "Region" SET "province"='GILGIT_BALTISTAN' WHERE name IN ('Gilgit','Skardu');

-- Safety: fail loudly at apply time if any region is still unmapped (forces a human fix).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "Region" WHERE "province" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Province backfill incomplete: % region(s) still NULL — add them to the backfill mapping', n;
  END IF;
END $$;
