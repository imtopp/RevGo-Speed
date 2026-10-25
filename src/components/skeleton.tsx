/**
 * Skeleton halaman untuk loading.tsx (server component, tanpa "use client").
 * Meniru layout halaman: judul + kartu stat + daftar kartu — pengguna tahu
 * halaman tujuan sedang dimuat, bukan aplikasi hang.
 */

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

function KartuSkeleton({ baris }: { baris: number }) {
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <Sk className="h-3 w-24" />
      <div className="mt-2 space-y-2">
        {Array.from({ length: baris }).map((_, i) => (
          <Sk key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({
  stat = 0,
  list = 4,
  baris = 2,
  filter = false,
}: {
  /** Jumlah kartu statistik (grid 2 kolom). */
  stat?: number;
  /** Jumlah kartu pada daftar. */
  list?: number;
  /** Baris isi per kartu daftar. */
  baris?: number;
  /** Tampilkan satu kartu baris penuh di atas (filter/pencarian). */
  filter?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Sk className="h-7 w-36" />
      {filter && <KartuSkeleton baris={1} />}
      {stat > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: stat }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
            >
              <Sk className="h-3 w-16" />
              <Sk className="mt-2 h-5 w-24" />
            </div>
          ))}
        </div>
      )}
      {list > 0 && (
        <div className="space-y-3">
          {Array.from({ length: list }).map((_, i) => (
            <KartuSkeleton key={i} baris={baris} />
          ))}
        </div>
      )}
      <p className="pt-1 text-center text-xs text-slate-400">Memuat halaman…</p>
    </div>
  );
}
