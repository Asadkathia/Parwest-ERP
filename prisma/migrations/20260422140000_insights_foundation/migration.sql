-- AuditLog enrichment: target-entity + region columns for insights
ALTER TABLE "AuditLog" ADD COLUMN "targetEntityType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetEntityId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetRegionId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetRegionalOfficeId" TEXT;

CREATE INDEX "AuditLog_targetEntityType_targetEntityId_idx" ON "AuditLog"("targetEntityType", "targetEntityId");
CREATE INDEX "AuditLog_targetRegionId_idx" ON "AuditLog"("targetRegionId");
CREATE INDEX "AuditLog_targetRegionalOfficeId_idx" ON "AuditLog"("targetRegionalOfficeId");

-- InsightConfig: thresholds + mute state per insight key
CREATE TABLE "InsightConfig" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "key"              TEXT NOT NULL UNIQUE,
    "thresholds"       JSONB NOT NULL DEFAULT '{}',
    "muted"            BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil"       TIMESTAMP(3),
    "mutedReason"      TEXT,
    "mutedById"        TEXT,
    "severityOverride" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "updatedById"      TEXT
);

CREATE INDEX "InsightConfig_muted_idx" ON "InsightConfig"("muted");
