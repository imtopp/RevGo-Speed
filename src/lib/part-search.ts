export type PartCari = {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  quantity: number;
};

/**
 * Filter part dari teks bebas (nama, SKU, kategori).
 * Spasi = beberapa kata yang semuanya harus cocok, huruf besar/kecil diabaikan.
 * Urutan: yang cocok di awal nama dulu, lalu di tengah nama, lalu di SKU/kategori —
 * stabil terhadap urutan asli (server sudah kirim urut abjad).
 */
export function cariPart<T extends PartCari>(parts: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return parts;
  const tokens = q.split(/\s+/);
  const hasil: { p: T; rank: number }[] = [];
  for (const p of parts) {
    const hay = `${p.name} ${p.sku} ${p.category ?? ""}`.toLowerCase();
    if (!tokens.every((t) => hay.includes(t))) continue;
    const nama = p.name.toLowerCase();
    const rank = nama.startsWith(q) ? 0 : nama.includes(q) ? 1 : 2;
    hasil.push({ p, rank });
  }
  hasil.sort((a, b) => a.rank - b.rank);
  return hasil.map((h) => h.p);
}
