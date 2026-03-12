-- AlterTable
ALTER TABLE "Residence" ADD COLUMN     "city" TEXT,
ADD COLUMN     "contractAttachment" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "rentPayable" DOUBLE PRECISION,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "utilityBills" TEXT;
