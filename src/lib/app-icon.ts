/** Parameter route ikon dinamis /icon (favicon, apple-touch, ikon PWA). */

/** Ukuran ikon yang didukung route /icon (piksel, bujur sangkar). */
export const ICON_SIZES = [32, 48, 180, 192, 512] as const;

export type IconRequest = { size: number; maskable: boolean };

/**
 * Parse query `/icon?size=…&maskable=1`.
 * Mengembalikan null bila `size` hilang atau bukan salah satu ICON_SIZES.
 */
export function parseIconRequest(
  searchParams: URLSearchParams,
): IconRequest | null {
  const raw = Number(searchParams.get("size"));
  if (
    !Number.isInteger(raw) ||
    !(ICON_SIZES as readonly number[]).includes(raw)
  ) {
    return null;
  }
  return { size: raw, maskable: searchParams.get("maskable") === "1" };
}

export type IconSource =
  | { kind: "none" }
  | { kind: "process"; dataUrl: string }
  | { kind: "redirect"; url: string };

/**
 * Nilai `logo_url` → cara route /icon memakainya:
 * - data URL hasil upload → diproses jadi PNG bujur sangkar (rasio asli
 *   dipertahankan, ruang kosong transparan/mewah latar);
 * - URL https/path relatif → di-redirect apa adanya (tanpa olah);
 * - kosong → ikon statis bawaan.
 */
export function resolveIconSource(logoUrl: string | null): IconSource {
  if (!logoUrl) return { kind: "none" };
  if (logoUrl.startsWith("data:image/")) {
    return { kind: "process", dataUrl: logoUrl };
  }
  return { kind: "redirect", url: logoUrl };
}

/** Ikon statis bawaan saat logo belum diatur (fallback route /icon). */
export function fallbackIconFor({ size, maskable }: IconRequest): string {
  if (maskable) return "/icons/icon-maskable-512.png";
  if (size >= 512) return "/icons/icon-512.png";
  if (size >= 192) return "/icons/icon-192.png";
  if (size >= 180) return "/icons/apple-touch-icon.png";
  return "/icons/favicon.png";
}
