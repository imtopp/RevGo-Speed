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
 * @param nomor hasil `normalizeWa` (digit, prefix 62) — data lama (`08…`)
 *   dinormalisasi dulu supaya `wa.me` tetap valid.
 * @param pesan pesan awal yang ikut terisi di kolom chat (opsional).
 */
export function waLink(nomor: string, pesan?: string): string {
  const target = normalizeWa(nomor) ?? nomor;
  const base = `https://wa.me/${target}`;
  return pesan ? `${base}?text=${encodeURIComponent(pesan)}` : base;
}

/**
 * Tampilan lokal dari nomor WhatsApp: `6281234567890` → `0812-3456-7890`.
 * Toleran terhadap data lama yang masih mentah (`08…`, `+62…`) — dinormalisasi
 * dulu, supaya `slice(2)` tidak membuang prefix yang salah (`0895…` jangan
 * jadi `0950-…`). Input tak dikenal ditampilkan apa adanya.
 */
export function formatWaLocal(nomor: string): string {
  const kanonik = normalizeWa(nomor);
  if (!kanonik) return nomor;
  const lokal = "0" + kanonik.slice(2);
  return lokal.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

/**
 * Pesan pratinjau WhatsApp konfirmasi booking — kode + rincian (motor,
 * layanan, jadwal) supaya customer tinggal kirim ke bengkel.
 * Rincian opsional yang kosong tidak menghasilkan baris kosong.
 */
export function pesanKonfirmasiBooking(opts: {
  appName: string;
  code: string;
  kendaraan?: string | null;
  layanan?: string | null;
  jadwal?: string | null;
}): string {
  const baris = [
    `Halo ${opts.appName}, saya mau konfirmasi booking ${opts.code}.`,
  ];
  if (opts.kendaraan) baris.push(`Motor: ${opts.kendaraan}`);
  if (opts.layanan) baris.push(`Layanan: ${opts.layanan}`);
  if (opts.jadwal) baris.push(`Jadwal: ${opts.jadwal}`);
  return baris.join("\n");
}
