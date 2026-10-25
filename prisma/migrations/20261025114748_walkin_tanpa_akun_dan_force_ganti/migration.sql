-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_ownerId_fkey";

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownerPhone" TEXT,
ALTER COLUMN "ownerId" DROP NOT NULL;

-- Backfill snapshot nama/telp dari akun yang sudah ada
UPDATE "Service" s SET "customerName" = u."name"
FROM "User" u WHERE s."customerId" = u."id";
UPDATE "Vehicle" v SET "ownerName" = u."name", "ownerPhone" = u."phone"
FROM "User" u WHERE v."ownerId" = u."id";

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
