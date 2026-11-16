-- AlterEnum
ALTER TYPE "ServiceStatus" ADD VALUE 'WAITING_DP';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "dpClaimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceLabor" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLabor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLabor_serviceId_idx" ON "ServiceLabor"("serviceId");

-- AddForeignKey
ALTER TABLE "ServiceLabor" ADD CONSTRAINT "ServiceLabor_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
