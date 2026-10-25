-- Konvensi lama: input datetime-local disimpan apa adanya (server UTC), sehingga
-- epoch tersimpan +7 jam dari jam WIB yang dimaksudkan. Semua baris yang ada
-- saat migrasi ini dibuat pasti ditulis kode lama → normalisasi sekali ini saja.
UPDATE "Service"
SET "scheduledAt" = "scheduledAt" - INTERVAL '7 hours'
WHERE "scheduledAt" IS NOT NULL;
