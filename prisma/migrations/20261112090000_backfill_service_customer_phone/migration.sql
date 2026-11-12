-- Backfill customerPhone pada booking lama (idempoten — hanya baris yang NULL).
-- Sumber prioritas: nomor akun customer → nomor pemilik kendaraan → snapshot walk-in.
UPDATE "Service" s
SET "customerPhone" = COALESCE(u."phone", vo."phone", v."ownerPhone")
FROM "Vehicle" v
LEFT JOIN "User" u ON u.id = s."customerId"
LEFT JOIN "User" vo ON vo.id = v."ownerId"
WHERE s."vehicleId" = v.id
  AND s."customerPhone" IS NULL;
