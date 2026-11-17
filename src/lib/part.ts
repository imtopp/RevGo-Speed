/**
 * Rule hapus part (guard bertingkat) — dipakai `deletePart` di server action stok.
 *
 * 1. Part pernah dipakai servis/penjualan → TOLAK (HPP, tagihan, dan laporan
 *    sudah mereferensikannya).
 * 2. Riwayat stok selain stok awal (pembelian via Stok Masuk / penyesuaian
 *    opname) → TOLAK (kas/riwayat nyata sudah tercatat, koreksi via Opname).
 * 3. Riwayat HANYA stok awal (gerakan IN ber-note "Stok awal" / "Stok awal
 *    (konsinyasi)") atau bersih total → BOLEH dihapus; pembatalan kas stok
 *    awal di-reversal terpisah (konsinyasi tanpa kas → tanpa reversal).
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
    (m) =>
      m.type === "IN" && (m.note === "Stok awal" || m.note === "Stok awal (konsinyasi)"),
  );
  if (!hanyaStokAwal) return "bukan-stok-awal";
  return null;
}

/**
 * Gerakan IN yang BUKAN pembelian uang nyata — koreksi kas harus dilewati.
 *
 * Pencocokan kas koreksi/HPP pakai heuristik amount ±1 hari (data legacy
 * tanpa `cashflowId`); false-match ke gerakan ini menghasilkan **kas fiktif**
 * (baris kas tanpa uang bergerak). Gerakan yang di sini memang tak pernah
 * menyentuh kas: konsinyasi, retur servis, penyesuaian opname, retur
 * penjualan yang dibatalkan.
 */
export function gerakanBukanPembelianKas(note: string | null): boolean {
  const n = (note ?? "").trim().toLowerCase();
  return (
    n.includes("konsinyasi") ||
    n.startsWith("dikembalikan dari servis") ||
    n.startsWith("penyesuaian") ||
    n.startsWith("penjualan")
  );
}
