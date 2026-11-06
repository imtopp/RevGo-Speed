import sharp from "sharp";

/**
 * Olah file logo mentah menjadi WebP siap simpan:
 * - auto-orient sesuai EXIF;
 * - rapikan margin/tepi transparan (atau warna latar seragam) — isi logo
 *   jadi padat, tampil lebih besar & jelas di semua slot (favicon, header,
 *   login, landing) tanpa mengubah desainnya;
 * - resize maks 512px dengan rasio dipertahankan (fit inside — tidak
 *   pernah dipotong/dipaksa jadi kotak);
 * - konversi WebP.
 *
 * Melempar bila file rusak atau tidak didukung sharp.
 */
export async function processLogoImage(
  input: Buffer,
  quality: number,
): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .trim({ threshold: 10 })
    .resize({
      width: 512,
      height: 512,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();
}
