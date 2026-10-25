/**
 * Util murni penjualan part tanpa servis (modul PartSale).
 * Semua fungsi bebas DB/IO supaya bisa diuji unit.
 */

export const MAX_RUPIAH = 2_000_000_000;

export type ItemJual = {
  quantity: number;
  /** Harga jual per unit (Rp, integer). */
  price: number;
  /** HPP per unit saat transaksi (opsional untuk input; wajib utk laba). */
  cost?: number;
};

/**
 * Validasi input satu baris jual part. Balikkan pesan error, atau null bila sah.
 * qty: integer 1..1_000_000 · price: integer 0..MAX_RUPIAH (jual gratis = 0 sah).
 */
export function validasiItemJual(quantity: number, price: number): string | null {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return "Jumlah tidak valid — isi bilangan bulat minimal 1.";
  }
  if (!Number.isInteger(price) || price < 0 || price > MAX_RUPIAH) {
    return `Harga tidak valid — isi bilangan bulat 0 sampai ${MAX_RUPIAH.toLocaleString("id-ID")}.`;
  }
  return null;
}

/** Σ quantity × price — total penerimaan penjualan. */
export function totalPenjualan(items: ItemJual[]): number {
  return items.reduce((s, i) => s + i.quantity * i.price, 0);
}

/**
 * Σ (price − cost) × quantity — laba kotor penjualan.
 * Bisa negatif (jual di bawah HPP, wajar bila disengaja/diretur).
 */
export function labaPenjualan(items: ItemJual[]): number {
  return items.reduce((s, i) => s + (i.price - (i.cost ?? 0)) * i.quantity, 0);
}

/**
 * Kode penjualan `SL-{BR}{YY}-{urut4}` — konsisten pola generateServiceCode.
 * `urut` = jumlah PartSale cabang pada tahun berjalan + 1 (dihitung di action).
 */
export function kodePenjualanPart(branchCode: string, year: number, urut: number): string {
  const br = (branchCode || "X").slice(0, 2).toUpperCase();
  const yy = String(year % 100).padStart(2, "0");
  return `SL-${br}${yy}-${String(urut).padStart(4, "0")}`;
}
