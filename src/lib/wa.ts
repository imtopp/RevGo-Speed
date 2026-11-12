/**
 * Util nomor WhatsApp: normalisasi format & tautan wa.me.
 *
 * Aturan normalisasi (input bebas spasi/strip/kurung):
 * - `08xx…`   → `628xx…` (ganti prefix 0 dengan 62)
 * - `+628xx…` → `628xx…`
 * - `8xx…`    → `628xx…` (tanpa prefix, diasumsikan nomor seluler Indonesia)
 * - `628xx…`  → diterima apa adanya
 * Nomor non-seluler (darat `021…`, dsb.) dan format asing ditolak (null).
 */

/** Bentuk kanonik yang disimpan & dipakai wa.me: digit saja, prefix 62. */
const WA_PATTERN = /^628[1-9]\d{7,12}$/;

/**
 * Normalisasi nomor WhatsApp ke format kanonik `62…`.
 * @returns `62…` bila valid, `null` bila bukan nomor seluler Indonesia.
 */
export function normalizeWa(input: string): string | null {
  const cleaned = input.replace(/[\s()\-.]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;

  let digits = cleaned.replace(/^\+/, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  }
  // Yang diawali 62 diterima apa adanya — sisanya (mis. 6221 darat) gagal pola.

  return WA_PATTERN.test(digits) ? digits : null;
}

/**
 * Bangun tautan WhatsApp (`wa.me`).
 * @param nomor hasil `normalizeWa` (digit, prefix 62).
 * @param pesan pesan awal yang ikut terisi di kolom chat (opsional).
 */
export function waLink(nomor: string, pesan?: string): string {
  const base = `https://wa.me/${nomor}`;
  return pesan ? `${base}?text=${encodeURIComponent(pesan)}` : base;
}

/**
 * Tampilan lokal dari nomor kanonik: `6281234567890` → `0812-3456-7890`.
 * Dipakai di pesan sukses/konfirmasi agar pembaca (orang Indonesia) familiar.
 */
export function formatWaLocal(nomor: string): string {
  const lokal = "0" + nomor.slice(2);
  return lokal.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}
