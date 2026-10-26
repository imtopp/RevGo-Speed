/**
 * SKU otomatis per cabang — pola `PART-XXXX` (XXXX minimal 4 digit).
 * Urutan mengisi bolong dulu (tidak melompat), seri manual lain diabaikan,
 * dan hasil selalu lolos dari daftar SKU yang sudah ada.
 */
export function skuBerikutnya(ada: string[]): string {
  const terpakai = new Set(ada);
  for (let i = 1; i < 1_000_000; i++) {
    const kandidat = `PART-${String(i).padStart(4, "0")}`;
    if (!terpakai.has(kandidat)) return kandidat;
  }
  return `PART-${Date.now().toString(36).toUpperCase()}`;
}
