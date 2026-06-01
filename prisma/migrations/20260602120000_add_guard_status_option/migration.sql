-- CreateTable
CREATE TABLE "GuardStatusOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardStatusOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardStatusOption_name_key" ON "GuardStatusOption"("name");

-- Seed the legacy default status labels (idempotent). These are display/reference
-- only and can be edited/deleted by admins afterwards. See ticket #58.
INSERT INTO "GuardStatusOption" ("id", "name", "color", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'present',     'green',  true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'absent',      'yellow', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'on-training', 'red',    true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'default',     'blue',   true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'resigned',    'brown',  true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Long Leave',  'orange', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Inactive',    'gray',   true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Pending',     'teal',   true, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
