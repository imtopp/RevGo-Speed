-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "kuotaParalel" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN     "estimasiMenit" INTEGER NOT NULL DEFAULT 60;
