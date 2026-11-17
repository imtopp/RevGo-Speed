/**
 * Rencana pembatalan servis — logika MURNI tanpa prisma (diuji unit test).
 *
 * Dipakai dua sisi dengan aturan yang sama:
 * - Server (`cancelService`): memutuskan pembayaran mana yang di-void,
 *   DP mana yang ditahan (hangus), dan apakah pembatalan ditolak.
 * - Client (`CancelForm`): merender ringkasan dampak sebagai lapis
 *   konfirmasi pertama — server tetap menghitung ulang sendiri dari DB.
 *
 * Aturan (disepakati saat desain):
 * - Semua pembayaran non-DP aktif → di-void otomatis (1 baris kas EXPENSE
 *   reversal per pembayaran — uang kembali ke customer).
 * - DP → ikut `dp_policy`: TANPA_REFUND = ditahan (hangus — baris Payment &
 *   kas INCOME tidak disentuh, tetap tercatat), REFUND_PENUH = ikut di-void.
 * - Baris REFUND aktif BERSAMA pembayaran positif → pembatalan DITOLAK:
 *   auto-void akan mengembalikan penuh pembayaran positif padahal kelebihan
 *   sudah pernah direfund → uang keluar dua kali untuk pihak yang sama.
 *   REFUND saja yang tersisa (positif sudah di-void manual lebih dulu) →
 *   BOLEH: tak ada gerakan kas sama sekali.
 */
import type { DpPolicy } from "@/lib/dp";

/** Kata konfirmasi lapis terakhir yang wajib diketik user (alur update/backup). */
export const KATA_BATALKAN = "BATALKAN";

/** Pembayaran aktif (voidedAt null) — bentuk ringkas lintas client/server. */
export type BayarAktif = {
  id: string;
  kind: string;
  method: string;
  amount: number;
};

export type RencanaPembatalan = {
  /** Pembayaran yang akan di-void otomatis (uang kembali ke customer). */
  voids: BayarAktif[];
  /** DP yang ditahan (hangus) — baris & kas income TIDAK disentuh. */
  hangusDp: BayarAktif[];
  /** Total rupiah yang akan dikembalikan lewat void. */
  totalVoid: number;
  /** Total rupiah DP yang hangus (tetap diterima bengkel). */
  totalHangus: number;
  /** Wajib centang "DP ditahan (tidak direfund)" sebelum submit. */
  perluCentangHangus: boolean;
  /**
   * REFUND aktif bersama pembayaran positif → pembatalan harus ditolak
   * server-side (auto-void akan mengembalikan lebih). REFUND sendirian
   * (positif sudah di-void manual) → boleh — tanpa gerakan kas.
   */
  terblokirRefund: boolean;
  /** Ada baris REFUND aktif (apa pun kondisinya) — untuk ringkasan UI. */
  adaRefund: boolean;
};

/** Hitung rencana void/hangus dari pembayaran aktif + kebijakan DP. */
export function rencanaPembatalan(
  bayarAktif: BayarAktif[],
  policy: DpPolicy,
): RencanaPembatalan {
  const adaRefund = bayarAktif.some((p) => p.kind === "REFUND");
  const dp = bayarAktif.filter((p) => p.kind === "DP");
  // REFUND (amount negatif) tidak bisa di-void — jangan pernah masuk rencana void.
  const lain = bayarAktif.filter(
    (p) => p.kind !== "DP" && p.kind !== "REFUND",
  );
  // REFUND_PENUH: DP ikut dikembalikan. TANPA_REFUND: DP ditahan (hangus).
  const hangusDp = policy === "REFUND_PENUH" ? [] : dp;
  const voids = policy === "REFUND_PENUH" ? [...lain, ...dp] : lain;
  // Blokir hanya bila masih ada pembayaran yang akan di-void — itu yang
  // membuat uang keluar dua kali. REFUND sendirian (voids kosong): pembatalan
  // murni flip status tanpa gerakan kas, aman — termasuk REFUND + DP yang
  // ditahan (hangus): net yang tercatat sudah benar.
  return {
    voids,
    hangusDp,
    totalVoid: voids.reduce((s, p) => s + p.amount, 0),
    totalHangus: hangusDp.reduce((s, p) => s + p.amount, 0),
    perluCentangHangus: hangusDp.length > 0,
    terblokirRefund: adaRefund && voids.length > 0,
    adaRefund,
  };
}

/**
 * Lapis konfirmasi terakhir: user mengetik kata `KATA_BATALKAN`.
 * Abai spasi di awal/akhir dan besar-kecil huruf.
 */
export function konfirmasiBatal(input: string): boolean {
  return input.trim().toUpperCase() === KATA_BATALKAN;
}
