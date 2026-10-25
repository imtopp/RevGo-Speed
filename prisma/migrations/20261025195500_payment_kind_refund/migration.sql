-- Tambah nilai enum REFUND: pengembalian kelebihan bayar (amount negatif,
-- mengurangi total bayar servis tanpa membatalkan pembayaran asli).
ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'REFUND';