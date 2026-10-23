-- AlterEnum: Role + SYS_ADMIN
ALTER TYPE "Role" ADD VALUE 'SYS_ADMIN';

-- AlterEnum: ServiceStatus + WAITING_APPROVAL, CHECKED_IN
ALTER TYPE "ServiceStatus" ADD VALUE 'WAITING_APPROVAL';
ALTER TYPE "ServiceStatus" ADD VALUE 'CHECKED_IN';

-- CreateEnum
CREATE TYPE "ServiceSource" AS ENUM ('APP', 'ADMIN');

-- CreateEnum
CREATE TYPE "CashflowAccount" AS ENUM ('KAS', 'BANK');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('DP', 'PELUNASAN');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "jamBuka" TEXT NOT NULL DEFAULT '08:00',
    "jamTutup" TEXT NOT NULL DEFAULT '17:00',
    "hariAktif" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalog" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "deskripsi" TEXT,
    "hargaDasar" INTEGER NOT NULL DEFAULT 0,
    "allowDp" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "telepon" TEXT,
    "catatan" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- AlterTable: User + branchId (nullable; owner/sysadmin lintas cabang)
ALTER TABLE "User" ADD COLUMN "branchId" TEXT;

-- AlterTable: Part + branchId (wajib, stok per cabang) + supplierId
ALTER TABLE "Part" ADD COLUMN "branchId" TEXT NOT NULL;
ALTER TABLE "Part" ADD COLUMN "supplierId" TEXT;

-- AlterTable: StockMovement + cost (snapshot harga beli) + supplierId
ALTER TABLE "StockMovement" ADD COLUMN "cost" INTEGER;
ALTER TABLE "StockMovement" ADD COLUMN "supplierId" TEXT;

-- AlterTable: Service + branchId (wajib) + source/catalog/cancel/checkedIn
ALTER TABLE "Service" ADD COLUMN "branchId" TEXT NOT NULL;
ALTER TABLE "Service" ADD COLUMN "source" "ServiceSource" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Service" ADD COLUMN "catalogId" TEXT;
ALTER TABLE "Service" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Service" ADD COLUMN "checkedInAt" TIMESTAMP(3);

-- AlterTable: ServicePart + cost (snapshot HPP)
ALTER TABLE "ServicePart" ADD COLUMN "cost" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Payment + kind/paidAt/receivedById
ALTER TABLE "Payment" ADD COLUMN "kind" "PaymentKind" NOT NULL DEFAULT 'PELUNASAN';
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Cashflow + account (kantong) + branchId (wajib)
ALTER TABLE "Cashflow" ADD COLUMN "account" "CashflowAccount" NOT NULL DEFAULT 'KAS';
ALTER TABLE "Cashflow" ADD COLUMN "branchId" TEXT NOT NULL;

-- DropIndex: drop unique lama Part.sku (pindah ke komposit branchId+sku)
DROP INDEX "Part_sku_key";

-- CreateIndex
CREATE UNIQUE INDEX "Part_branchId_sku_key" ON "Part"("branchId", "sku");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cashflow" ADD CONSTRAINT "Cashflow_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
