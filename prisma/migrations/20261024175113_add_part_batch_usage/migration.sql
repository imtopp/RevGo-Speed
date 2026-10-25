-- CreateTable
CREATE TABLE "PartBatchUsage" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "servicePartId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartBatchUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartBatchUsage_movementId_idx" ON "PartBatchUsage"("movementId");

-- CreateIndex
CREATE INDEX "PartBatchUsage_servicePartId_idx" ON "PartBatchUsage"("servicePartId");

-- AddForeignKey
ALTER TABLE "PartBatchUsage" ADD CONSTRAINT "PartBatchUsage_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartBatchUsage" ADD CONSTRAINT "PartBatchUsage_servicePartId_fkey" FOREIGN KEY ("servicePartId") REFERENCES "ServicePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
