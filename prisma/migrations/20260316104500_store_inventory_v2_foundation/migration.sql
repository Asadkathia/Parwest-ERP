-- CreateEnum
CREATE TYPE "StoreInventoryDemandStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StoreInventoryDemandResponseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "StoreInventoryAssignmentStatus" AS ENUM ('ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "StoreInventoryMovementType" AS ENUM ('PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ASSIGNMENT_OUT', 'ASSIGNMENT_RETURN', 'DEMAND_OUT', 'DEMAND_IN');

-- CreateEnum
CREATE TYPE "StoreInventoryAdjustmentType" AS ENUM ('INCREASE', 'DECREASE', 'SET');

-- CreateEnum
CREATE TYPE "StoreInventoryPurchaseStatus" AS ENUM ('DRAFT', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "address" TEXT,
    "contactNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "regionalOfficeId" TEXT,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryConditionV2" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryConditionV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryWeaponType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryWeaponType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryCalibre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryCalibre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryLicenseType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryLicenseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryVariation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryRepairing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryRepairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryProduct" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serialRequired" BOOLEAN NOT NULL DEFAULT false,
    "minStockLevel" INTEGER,
    "maxStockLevel" INTEGER,
    "reorderLevel" INTEGER,
    "barcode" TEXT,
    "hsCode" TEXT,
    "warrantyMonths" INTEGER,
    "licenseNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT,
    "unitId" TEXT,
    "statusId" TEXT,
    "conditionId" TEXT,
    "weaponTypeId" TEXT,
    "calibreId" TEXT,
    "licenseTypeId" TEXT,
    "variationId" TEXT,
    "repairingId" TEXT,

    CONSTRAINT "StoreInventoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryBalance" (
    "id" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityHeld" INTEGER NOT NULL DEFAULT 0,
    "quantityIssued" INTEGER NOT NULL DEFAULT 0,
    "avgUnitCost" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "StoreInventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryPurchase" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT,
    "invoiceNo" TEXT,
    "supplierName" TEXT,
    "status" "StoreInventoryPurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,

    CONSTRAINT "StoreInventoryPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryPurchaseLine" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "StoreInventoryPurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryAdjustment" (
    "id" TEXT NOT NULL,
    "adjustmentType" "StoreInventoryAdjustmentType" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "adjustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "StoreInventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryAdjustmentLine" (
    "id" TEXT NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "StoreInventoryAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryDemand" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT,
    "status" "StoreInventoryDemandStatus" NOT NULL DEFAULT 'DRAFT',
    "requiredBy" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fromStoreId" TEXT,
    "toStoreId" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,

    CONSTRAINT "StoreInventoryDemand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryDemandLine" (
    "id" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "approvedQty" INTEGER,
    "fulfilledQty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "demandId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "StoreInventoryDemandLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryDemandResponse" (
    "id" TEXT NOT NULL,
    "status" "StoreInventoryDemandResponseStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "demandId" TEXT NOT NULL,
    "responderStoreId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,

    CONSTRAINT "StoreInventoryDemandResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryDemandResponseLine" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responseId" TEXT NOT NULL,
    "demandLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "StoreInventoryDemandResponseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryAssignment" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "StoreInventoryAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "returnedByUserId" TEXT,

    CONSTRAINT "StoreInventoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInventoryMovement" (
    "id" TEXT NOT NULL,
    "movementType" "StoreInventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "performedById" TEXT,

    CONSTRAINT "StoreInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");
CREATE INDEX "Store_regionalOfficeId_idx" ON "Store"("regionalOfficeId");
CREATE INDEX "Store_isActive_idx" ON "Store"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInventoryBrand_name_key" ON "StoreInventoryBrand"("name");
CREATE UNIQUE INDEX "StoreInventoryUnit_name_key" ON "StoreInventoryUnit"("name");
CREATE UNIQUE INDEX "StoreInventoryUnit_shortCode_key" ON "StoreInventoryUnit"("shortCode");
CREATE UNIQUE INDEX "StoreInventoryStatus_name_key" ON "StoreInventoryStatus"("name");
CREATE UNIQUE INDEX "StoreInventoryConditionV2_name_key" ON "StoreInventoryConditionV2"("name");
CREATE UNIQUE INDEX "StoreInventoryWeaponType_name_key" ON "StoreInventoryWeaponType"("name");
CREATE UNIQUE INDEX "StoreInventoryCalibre_name_key" ON "StoreInventoryCalibre"("name");
CREATE UNIQUE INDEX "StoreInventoryLicenseType_name_key" ON "StoreInventoryLicenseType"("name");
CREATE UNIQUE INDEX "StoreInventoryVariation_name_key" ON "StoreInventoryVariation"("name");
CREATE UNIQUE INDEX "StoreInventoryRepairing_name_key" ON "StoreInventoryRepairing"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInventoryProduct_sku_key" ON "StoreInventoryProduct"("sku");
CREATE INDEX "StoreInventoryProduct_name_idx" ON "StoreInventoryProduct"("name");
CREATE INDEX "StoreInventoryProduct_brandId_idx" ON "StoreInventoryProduct"("brandId");
CREATE INDEX "StoreInventoryProduct_unitId_idx" ON "StoreInventoryProduct"("unitId");
CREATE INDEX "StoreInventoryProduct_statusId_idx" ON "StoreInventoryProduct"("statusId");
CREATE INDEX "StoreInventoryProduct_conditionId_idx" ON "StoreInventoryProduct"("conditionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInventoryBalance_storeId_productId_key" ON "StoreInventoryBalance"("storeId", "productId");
CREATE INDEX "StoreInventoryBalance_productId_idx" ON "StoreInventoryBalance"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInventoryPurchase_referenceNo_key" ON "StoreInventoryPurchase"("referenceNo");
CREATE INDEX "StoreInventoryPurchase_storeId_idx" ON "StoreInventoryPurchase"("storeId");
CREATE INDEX "StoreInventoryPurchase_status_idx" ON "StoreInventoryPurchase"("status");
CREATE INDEX "StoreInventoryPurchase_createdById_idx" ON "StoreInventoryPurchase"("createdById");
CREATE INDEX "StoreInventoryPurchase_approvedById_idx" ON "StoreInventoryPurchase"("approvedById");

-- CreateIndex
CREATE INDEX "StoreInventoryPurchaseLine_purchaseId_idx" ON "StoreInventoryPurchaseLine"("purchaseId");
CREATE INDEX "StoreInventoryPurchaseLine_productId_idx" ON "StoreInventoryPurchaseLine"("productId");

-- CreateIndex
CREATE INDEX "StoreInventoryAdjustment_storeId_idx" ON "StoreInventoryAdjustment"("storeId");
CREATE INDEX "StoreInventoryAdjustment_createdById_idx" ON "StoreInventoryAdjustment"("createdById");
CREATE INDEX "StoreInventoryAdjustment_adjustmentType_idx" ON "StoreInventoryAdjustment"("adjustmentType");

-- CreateIndex
CREATE INDEX "StoreInventoryAdjustmentLine_adjustmentId_idx" ON "StoreInventoryAdjustmentLine"("adjustmentId");
CREATE INDEX "StoreInventoryAdjustmentLine_productId_idx" ON "StoreInventoryAdjustmentLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInventoryDemand_requestNo_key" ON "StoreInventoryDemand"("requestNo");
CREATE INDEX "StoreInventoryDemand_status_idx" ON "StoreInventoryDemand"("status");
CREATE INDEX "StoreInventoryDemand_fromStoreId_idx" ON "StoreInventoryDemand"("fromStoreId");
CREATE INDEX "StoreInventoryDemand_toStoreId_idx" ON "StoreInventoryDemand"("toStoreId");
CREATE INDEX "StoreInventoryDemand_requestedById_idx" ON "StoreInventoryDemand"("requestedById");
CREATE INDEX "StoreInventoryDemand_approvedById_idx" ON "StoreInventoryDemand"("approvedById");

-- CreateIndex
CREATE INDEX "StoreInventoryDemandLine_demandId_idx" ON "StoreInventoryDemandLine"("demandId");
CREATE INDEX "StoreInventoryDemandLine_productId_idx" ON "StoreInventoryDemandLine"("productId");

-- CreateIndex
CREATE INDEX "StoreInventoryDemandResponse_demandId_idx" ON "StoreInventoryDemandResponse"("demandId");
CREATE INDEX "StoreInventoryDemandResponse_responderStoreId_idx" ON "StoreInventoryDemandResponse"("responderStoreId");
CREATE INDEX "StoreInventoryDemandResponse_responderId_idx" ON "StoreInventoryDemandResponse"("responderId");
CREATE INDEX "StoreInventoryDemandResponse_status_idx" ON "StoreInventoryDemandResponse"("status");

-- CreateIndex
CREATE INDEX "StoreInventoryDemandResponseLine_responseId_idx" ON "StoreInventoryDemandResponseLine"("responseId");
CREATE INDEX "StoreInventoryDemandResponseLine_demandLineId_idx" ON "StoreInventoryDemandResponseLine"("demandLineId");
CREATE INDEX "StoreInventoryDemandResponseLine_productId_idx" ON "StoreInventoryDemandResponseLine"("productId");

-- CreateIndex
CREATE INDEX "StoreInventoryAssignment_storeId_idx" ON "StoreInventoryAssignment"("storeId");
CREATE INDEX "StoreInventoryAssignment_productId_idx" ON "StoreInventoryAssignment"("productId");
CREATE INDEX "StoreInventoryAssignment_assignedToUserId_idx" ON "StoreInventoryAssignment"("assignedToUserId");
CREATE INDEX "StoreInventoryAssignment_assignedByUserId_idx" ON "StoreInventoryAssignment"("assignedByUserId");
CREATE INDEX "StoreInventoryAssignment_returnedByUserId_idx" ON "StoreInventoryAssignment"("returnedByUserId");
CREATE INDEX "StoreInventoryAssignment_status_idx" ON "StoreInventoryAssignment"("status");

-- CreateIndex
CREATE INDEX "StoreInventoryMovement_storeId_productId_idx" ON "StoreInventoryMovement"("storeId", "productId");
CREATE INDEX "StoreInventoryMovement_movementType_idx" ON "StoreInventoryMovement"("movementType");
CREATE INDEX "StoreInventoryMovement_occurredAt_idx" ON "StoreInventoryMovement"("occurredAt");
CREATE INDEX "StoreInventoryMovement_performedById_idx" ON "StoreInventoryMovement"("performedById");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_regionalOfficeId_fkey" FOREIGN KEY ("regionalOfficeId") REFERENCES "RegionalOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "StoreInventoryBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "StoreInventoryUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "StoreInventoryStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "StoreInventoryConditionV2"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_weaponTypeId_fkey" FOREIGN KEY ("weaponTypeId") REFERENCES "StoreInventoryWeaponType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "StoreInventoryCalibre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_licenseTypeId_fkey" FOREIGN KEY ("licenseTypeId") REFERENCES "StoreInventoryLicenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "StoreInventoryVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryProduct" ADD CONSTRAINT "StoreInventoryProduct_repairingId_fkey" FOREIGN KEY ("repairingId") REFERENCES "StoreInventoryRepairing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryBalance" ADD CONSTRAINT "StoreInventoryBalance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryBalance" ADD CONSTRAINT "StoreInventoryBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreInventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryPurchase" ADD CONSTRAINT "StoreInventoryPurchase_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryPurchase" ADD CONSTRAINT "StoreInventoryPurchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryPurchase" ADD CONSTRAINT "StoreInventoryPurchase_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryPurchaseLine" ADD CONSTRAINT "StoreInventoryPurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "StoreInventoryPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryPurchaseLine" ADD CONSTRAINT "StoreInventoryPurchaseLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreInventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryAdjustment" ADD CONSTRAINT "StoreInventoryAdjustment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryAdjustment" ADD CONSTRAINT "StoreInventoryAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryAdjustmentLine" ADD CONSTRAINT "StoreInventoryAdjustmentLine_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "StoreInventoryAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryAdjustmentLine" ADD CONSTRAINT "StoreInventoryAdjustmentLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreInventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryDemand" ADD CONSTRAINT "StoreInventoryDemand_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemand" ADD CONSTRAINT "StoreInventoryDemand_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemand" ADD CONSTRAINT "StoreInventoryDemand_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemand" ADD CONSTRAINT "StoreInventoryDemand_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryDemandLine" ADD CONSTRAINT "StoreInventoryDemandLine_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "StoreInventoryDemand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemandLine" ADD CONSTRAINT "StoreInventoryDemandLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreInventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryDemandResponse" ADD CONSTRAINT "StoreInventoryDemandResponse_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "StoreInventoryDemand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemandResponse" ADD CONSTRAINT "StoreInventoryDemandResponse_responderStoreId_fkey" FOREIGN KEY ("responderStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemandResponse" ADD CONSTRAINT "StoreInventoryDemandResponse_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryDemandResponseLine" ADD CONSTRAINT "StoreInventoryDemandResponseLine_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "StoreInventoryDemandResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemandResponseLine" ADD CONSTRAINT "StoreInventoryDemandResponseLine_demandLineId_fkey" FOREIGN KEY ("demandLineId") REFERENCES "StoreInventoryDemandLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryDemandResponseLine" ADD CONSTRAINT "StoreInventoryDemandResponseLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreInventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryAssignment" ADD CONSTRAINT "StoreInventoryAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryAssignment" ADD CONSTRAINT "StoreInventoryAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreInventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryAssignment" ADD CONSTRAINT "StoreInventoryAssignment_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryAssignment" ADD CONSTRAINT "StoreInventoryAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryAssignment" ADD CONSTRAINT "StoreInventoryAssignment_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryMovement" ADD CONSTRAINT "StoreInventoryMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryMovement" ADD CONSTRAINT "StoreInventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreInventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreInventoryMovement" ADD CONSTRAINT "StoreInventoryMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
