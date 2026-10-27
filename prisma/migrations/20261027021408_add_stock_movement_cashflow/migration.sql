-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "cashflowId" TEXT;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_cashflowId_fkey" FOREIGN KEY ("cashflowId") REFERENCES "Cashflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
