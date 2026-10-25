-- AlterTable
ALTER TABLE "PartBatchUsage" ADD COLUMN     "saleItemId" TEXT,
ALTER COLUMN "servicePartId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "saleId" TEXT;

-- CreateTable
CREATE TABLE "PartSale" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "PartSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,

    CONSTRAINT "PartSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartSale_code_key" ON "PartSale"("code");

-- CreateIndex
CREATE INDEX "PartSaleItem_saleId_idx" ON "PartSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "PartSaleItem_partId_idx" ON "PartSaleItem"("partId");

-- CreateIndex
CREATE INDEX "PartBatchUsage_saleItemId_idx" ON "PartBatchUsage"("saleItemId");

-- CreateIndex
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- AddForeignKey
ALTER TABLE "PartBatchUsage" ADD CONSTRAINT "PartBatchUsage_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "PartSaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PartSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartSale" ADD CONSTRAINT "PartSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartSale" ADD CONSTRAINT "PartSale_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartSaleItem" ADD CONSTRAINT "PartSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PartSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartSaleItem" ADD CONSTRAINT "PartSaleItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
