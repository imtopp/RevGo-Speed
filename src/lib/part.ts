/**
 * Rule hapus part (guard bertingkat) — dipakai `deletePart` di server action stok.
 *
 * 1. Part pernah dipakai servis/penjualan → TOLAK (HPP, tagihan, dan laporan
 *    sudah mereferensikannya).
 * 2. Riwayat stok selain stok awal (pembelian via Stok Masuk / penyesuaian
 *    opname) → TOLAK (kas/riwayat nyata sudah tercatat, koreksi via Opname).
 * 3. Riwayat HANYA stok awal (gerakan IN ber-note "Stok awal") atau bersih
 *    total → BOLEH dihapus; pembatalan kas stok awal di-reversal terpisah.
 */
export type AlasanTolakHapus =
  | "dipakai-transaksi"
  | "bukan-stok-awal"
  | null;

export function alasanTolakHapusPart(input: {
  serviceParts: number;
  saleItems: number;
  movements: { type: "IN" | "OUT"; note: string | null }[];
}): AlasanTolakHapus {
  if (input.serviceParts > 0 || input.saleItems > 0) return "dipakai-transaksi";
  const hanyaStokAwal = input.movements.every(
    (m) => m.type === "IN" && m.note === "Stok awal",
  );
  if (!hanyaStokAwal) return "bukan-stok-awal";
  return null;
}
