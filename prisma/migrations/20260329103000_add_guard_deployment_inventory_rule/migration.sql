CREATE TABLE IF NOT EXISTS "GuardDeploymentInventoryRule" (
  "id" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL DEFAULT 'default',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "minimumAssignedItems" INTEGER NOT NULL DEFAULT 1,
  "allowedCategoryIds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardDeploymentInventoryRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuardDeploymentInventoryRule_ruleKey_key"
  ON "GuardDeploymentInventoryRule"("ruleKey");

INSERT INTO "GuardDeploymentInventoryRule" (
  "id", "ruleKey", "isActive", "minimumAssignedItems", "allowedCategoryIds", "createdAt", "updatedAt"
)
SELECT
  'gdir_default', 'default', false, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "GuardDeploymentInventoryRule" WHERE "ruleKey" = 'default'
);
