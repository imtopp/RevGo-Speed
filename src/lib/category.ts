/** Rapikan input kategori: spasi ganda jadi satu, buang spasi di ujung. */
export function bersihkanKategori(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Samakan dengan kategori yang sudah ada (case-insensitive) — typo beda
 * kapital atau spasi tidak menghasilkan entri kategori baru.
 * Input kosong/whitespace → string kosong.
 */
export function samakanKategori(input: string, existing: string[]): string {
  const bersih = bersihkanKategori(input);
  if (!bersih) return "";
  const ketemu = existing.find((e) => e.toLowerCase() === bersih.toLowerCase());
  return ketemu ?? bersih;
}
