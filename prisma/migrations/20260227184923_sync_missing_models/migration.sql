-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "conditionId" TEXT;

-- AlterTable
ALTER TABLE "ResidenceAssignment" ADD COLUMN     "residenceId" TEXT;

-- CreateTable
CREATE TABLE "BlacklistedCnic" (
    "id" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlacklistedCnic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentRate" (
    "id" TEXT NOT NULL,
    "regionId" TEXT,
    "clientId" TEXT,
    "branchId" TEXT,
    "deployAs" TEXT,
    "guardType" TEXT,
    "shiftType" TEXT,
    "salary" DOUBLE PRECISION,
    "overtime" DOUBLE PRECISION,
    "extraHours" DOUBLE PRECISION,
    "postAllowance" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Residence" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "supervisor" TEXT,
    "capacity" INTEGER,
    "occupied" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Residence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCondition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDemand" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "regionalOfficeId" TEXT,
    "quantity" INTEGER NOT NULL,
    "requiredBy" TIMESTAMP(3),
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryDemand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerSupervisorAssignment" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "regionalOfficeId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerSupervisorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSupervisorAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT,
    "supervisorId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSupervisorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardSupervisorAssignment" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardSupervisorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardBankName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardBankName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardPledgeableDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardPledgeableDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedCnic_cnic_key" ON "BlacklistedCnic"("cnic");

-- CreateIndex
CREATE INDEX "BlacklistedCnic_cnic_idx" ON "BlacklistedCnic"("cnic");

-- CreateIndex
CREATE INDEX "DeploymentRate_regionId_idx" ON "DeploymentRate"("regionId");

-- CreateIndex
CREATE INDEX "DeploymentRate_clientId_idx" ON "DeploymentRate"("clientId");

-- CreateIndex
CREATE INDEX "DeploymentRate_branchId_idx" ON "DeploymentRate"("branchId");

-- CreateIndex
CREATE INDEX "Residence_status_idx" ON "Residence"("status");

-- CreateIndex
CREATE INDEX "PayrollHoliday_date_idx" ON "PayrollHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCondition_name_key" ON "InventoryCondition"("name");

-- CreateIndex
CREATE INDEX "InventoryDemand_categoryId_idx" ON "InventoryDemand"("categoryId");

-- CreateIndex
CREATE INDEX "InventoryDemand_regionalOfficeId_idx" ON "InventoryDemand"("regionalOfficeId");

-- CreateIndex
CREATE INDEX "InventoryDemand_status_idx" ON "InventoryDemand"("status");

-- CreateIndex
CREATE INDEX "ManagerSupervisorAssignment_managerId_idx" ON "ManagerSupervisorAssignment"("managerId");

-- CreateIndex
CREATE INDEX "ManagerSupervisorAssignment_supervisorId_idx" ON "ManagerSupervisorAssignment"("supervisorId");

-- CreateIndex
CREATE INDEX "ManagerSupervisorAssignment_regionalOfficeId_idx" ON "ManagerSupervisorAssignment"("regionalOfficeId");

-- CreateIndex
CREATE INDEX "ClientSupervisorAssignment_clientId_idx" ON "ClientSupervisorAssignment"("clientId");

-- CreateIndex
CREATE INDEX "ClientSupervisorAssignment_branchId_idx" ON "ClientSupervisorAssignment"("branchId");

-- CreateIndex
CREATE INDEX "ClientSupervisorAssignment_supervisorId_idx" ON "ClientSupervisorAssignment"("supervisorId");

-- CreateIndex
CREATE INDEX "GuardSupervisorAssignment_guardId_idx" ON "GuardSupervisorAssignment"("guardId");

-- CreateIndex
CREATE INDEX "GuardSupervisorAssignment_supervisorId_idx" ON "GuardSupervisorAssignment"("supervisorId");

-- CreateIndex
CREATE INDEX "GuardSupervisorAssignment_status_idx" ON "GuardSupervisorAssignment"("status");

-- CreateIndex
CREATE INDEX "Requisition_status_idx" ON "Requisition"("status");

-- CreateIndex
CREATE INDEX "Requisition_module_idx" ON "Requisition"("module");

-- CreateIndex
CREATE INDEX "Requisition_requesterId_idx" ON "Requisition"("requesterId");

-- CreateIndex
CREATE INDEX "Requisition_approverId_idx" ON "Requisition"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardBankName_name_key" ON "GuardBankName"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GuardPledgeableDocument_name_key" ON "GuardPledgeableDocument"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_conditionId_idx" ON "InventoryItem"("conditionId");

-- CreateIndex
CREATE INDEX "ResidenceAssignment_residenceId_idx" ON "ResidenceAssignment"("residenceId");

-- AddForeignKey
ALTER TABLE "DeploymentRate" ADD CONSTRAINT "DeploymentRate_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRate" ADD CONSTRAINT "DeploymentRate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRate" ADD CONSTRAINT "DeploymentRate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidenceAssignment" ADD CONSTRAINT "ResidenceAssignment_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "InventoryCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDemand" ADD CONSTRAINT "InventoryDemand_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDemand" ADD CONSTRAINT "InventoryDemand_regionalOfficeId_fkey" FOREIGN KEY ("regionalOfficeId") REFERENCES "RegionalOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerSupervisorAssignment" ADD CONSTRAINT "ManagerSupervisorAssignment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerSupervisorAssignment" ADD CONSTRAINT "ManagerSupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerSupervisorAssignment" ADD CONSTRAINT "ManagerSupervisorAssignment_regionalOfficeId_fkey" FOREIGN KEY ("regionalOfficeId") REFERENCES "RegionalOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSupervisorAssignment" ADD CONSTRAINT "ClientSupervisorAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSupervisorAssignment" ADD CONSTRAINT "ClientSupervisorAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSupervisorAssignment" ADD CONSTRAINT "ClientSupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardSupervisorAssignment" ADD CONSTRAINT "GuardSupervisorAssignment_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardSupervisorAssignment" ADD CONSTRAINT "GuardSupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
