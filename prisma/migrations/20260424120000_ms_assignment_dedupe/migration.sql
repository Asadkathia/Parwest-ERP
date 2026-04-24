ALTER TABLE "ManagerSupervisorAssignment" DROP COLUMN "effectiveDate";
-- Before adding the unique index, delete existing duplicates, keeping the earliest row per pair:
DELETE FROM "ManagerSupervisorAssignment" a
USING "ManagerSupervisorAssignment" b
WHERE a."managerId" = b."managerId"
  AND a."supervisorId" = b."supervisorId"
  AND a."createdAt" > b."createdAt";
CREATE UNIQUE INDEX "ManagerSupervisorAssignment_managerId_supervisorId_key"
  ON "ManagerSupervisorAssignment"("managerId", "supervisorId");
