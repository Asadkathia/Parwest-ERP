-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "dayShiftEnd" TEXT,
ADD COLUMN     "dayShiftStart" TEXT,
ADD COLUMN     "deploymentType" TEXT DEFAULT 'REGULAR',
ADD COLUMN     "extraHours" DOUBLE PRECISION,
ADD COLUMN     "guardType" TEXT,
ADD COLUMN     "isExtraGuard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nightShiftEnd" TEXT,
ADD COLUMN     "nightShiftStart" TEXT,
ADD COLUMN     "overtime" DOUBLE PRECISION,
ADD COLUMN     "postAllowance" DOUBLE PRECISION,
ADD COLUMN     "salary" DOUBLE PRECISION;
