/** Aturan file & nilai logo aplikasi (SystemSetting.logo_url). */

/** Tipe MIME yang diterima saat upload. */
export const LOGO_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

/** Batas file asli sebelum diproses. */
export const LOGO_MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;

/** Batas hasil proses (data URL base64) — jaga kolom & payload tetap wajar. */
export const LOGO_MAX_DATA_URL_CHARS = 400_000;

/**
 * Validasi metadata file logo. Mengembalikan pesan error, atau null jika lolos.
 * Pemrosesan image (resize/konversi) terjadi di server action — sini hanya cek
 * tipe & ukuran supaya aturannya bisa diuji unit tanpa I/O.
 */
export function validateLogoFileMeta(file: {
  type: string;
  size: number;
}): string | null {
  if (!(LOGO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Format logo harus PNG, JPEG, WebP, atau SVG.";
  }
  if (file.size <= 0) return "File logo kosong.";
  if (file.size > LOGO_MAX_ORIGINAL_BYTES) {
    return "Ukuran file logo maksimal 5 MB.";
  }
  return null;
}

/**
 * True bila nilai logo_url aman dipakai sebagai src <img>:
 * https://, path relatif /, atau data URL image (webp/png/jpeg) yang kita hasilkan.
 * Memblokir skema berbahaya (javascript:, http:) dan data URL selain image.
 */
export function isSafeLogoValue(value: string): boolean {
  if (value.startsWith("https://") || value.startsWith("/")) return true;
  if (value.length > LOGO_MAX_DATA_URL_CHARS) return false;
  return /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/** Ringkasan nilai logo untuk log audit (jangan menaruh base64 penuh). */
export function summarizeLogoValue(value: string): string {
  if (value.startsWith("data:image/")) {
    const mime = value.slice(0, value.indexOf(";"));
    return `${mime} (base64, ${Math.round(value.length / 1024)} KB)`;
  }
  return value;
}
