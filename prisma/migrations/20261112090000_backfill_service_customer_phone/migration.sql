-- Backfill customerPhone pada booking lama (idempoten — hanya baris yang NULL).
-- Sumber prioritas: nomor akun customer → nomor pemilik kendaraan → snapshot walk-in.
-- Catatan: baris target (s."customerId") TIDAK boleh direferensikan di klausa
-- JOIN pada FROM (ditolak Postgres, error 42P01 "invalid reference to
-- FROM-clause entry"). Pindahkan ke subquery terkorelasi di dalam SET.
UPDATE "Service" s
SET "customerPhone" = COALESCE(
  (SELECT u."phone" FROM "User" u WHERE u.id = s."customerId"),
  vo."phone",
  v."ownerPhone"
)
FROM "Vehicle" v
LEFT JOIN "User" vo ON vo.id = v."ownerId"
WHERE s."vehicleId" = v.id
  AND s."customerPhone" IS NULL;
